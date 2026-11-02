/**
 * 充值订单，以及「确认到账 → 加积分」这一步。
 *
 * 整个模块只有一个地方能把钱变多：settle()。异步通知、前端轮询时的主动查询、后台兜底
 * 对账，三条腿走的都是它，而它是幂等的 —— 无论被调用多少次，一笔订单只会入账一次。
 */
import { randomUUID } from "node:crypto";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool, withTransaction } from "./db.js";

export const STATUS_CREATED = "created";
export const STATUS_PAID = "paid";
export const STATUS_CLOSED = "closed";

export type OrderRow = {
    out_trade_no: string;
    user_id: string;
    package_id: string;
    subject: string;
    amount: string;
    credits: string;
    status: string;
    trade_no: string | null;
    created_at: string;
    paid_at: string | null;
};

const COLUMNS = "out_trade_no, user_id, package_id, subject, amount, credits, status, trade_no, created_at, paid_at";

/**
 * 商户订单号。时间前缀方便人眼排查，后面接一段随机避免同秒撞号。
 *
 * 必须服务端生成：前端造的号可以随便改，改成别人的号就能把别人的付款认到自己头上。
 */
export function newOrderNo(): string {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        `${now.getMonth() + 1}`.padStart(2, "0"),
        `${now.getDate()}`.padStart(2, "0"),
        `${now.getHours()}`.padStart(2, "0"),
        `${now.getMinutes()}`.padStart(2, "0"),
        `${now.getSeconds()}`.padStart(2, "0"),
    ].join("");
    return stamp + randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function create(input: { outTradeNo: string; userId: string; packageId: string; subject: string; amount: string; credits: string }): Promise<void> {
    const pool = await getPool();
    await pool.execute(
        `INSERT INTO recharge_orders (out_trade_no, user_id, package_id, subject, amount, credits, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [input.outTradeNo, input.userId, input.packageId, input.subject, input.amount, input.credits, STATUS_CREATED],
    );
}

export async function get(outTradeNo: string): Promise<OrderRow | null> {
    const pool = await getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${COLUMNS} FROM recharge_orders WHERE out_trade_no = ?`, [outTradeNo]);
    return (rows[0] as OrderRow) || null;
}

export async function listByUser(userId: string, limit = 20): Promise<OrderRow[]> {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [userId, limit]);
    return rows as OrderRow[];
}

/**
 * 关掉一笔还没付的单。只关 created 的：已付的单是账，任何时候都不该被改状态。
 *
 * 用在下单时支付宝那步失败的收尾上 —— 库里的记录已经建好，但它永远等不到付款，
 * 留着只会让待付列表越积越长，看的人还以为是用户放弃了。
 */
export async function close(outTradeNo: string, reason: string): Promise<void> {
    const pool = await getPool();
    await pool.execute("UPDATE recharge_orders SET status = ?, notify_raw = ? WHERE out_trade_no = ? AND status = ?", [
        STATUS_CLOSED,
        JSON.stringify({ closed_reason: reason.slice(0, 200) }),
        outTradeNo,
        STATUS_CREATED,
    ]);
}

/**
 * 还没付的单，新的排前面。给兜底对账用。
 *
 * 只看最近这段时间的：再老的多半是用户点开又走了，一直查下去纯属浪费调用次数。
 */
export async function listPending(withinMinutes: number, limit = 100): Promise<OrderRow[]> {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${COLUMNS} FROM recharge_orders
         WHERE status = ? AND created_at >= (NOW() - INTERVAL ? MINUTE)
         ORDER BY created_at DESC LIMIT ?`,
        [STATUS_CREATED, withinMinutes, limit],
    );
    return rows as OrderRow[];
}

export type SettleResult = {
    /** 这次调用是否真的把钱加上去了。false 表示订单不存在，或之前已经入过账 */
    credited: boolean;
    order: OrderRow | null;
};

/**
 * 确认一笔单已付，并把积分加到用户钱包。**必须幂等**。
 *
 * 支付宝在没收到 success 之前会按 4m/10m/10m/1h… 反复重发同一条通知，同时前端轮询和
 * 后台对账也可能同时命中同一笔单。三件事保证一笔订单只入账一次：
 *
 *   1. 先 `SELECT ... FOR UPDATE` 锁住订单行，把并发的几路串起来；
 *   2. `UPDATE ... WHERE status <> 'paid'`，第二次进来影响行数是 0，据此直接返回；
 *   3. 流水表上的 `UNIQUE KEY (kind, ref_no)` 兜最后一道底，重复入账会直接撞唯一键。
 *
 * 状态判断和加钱、记流水在同一个事务里 —— 分开写的话，进程在两步之间挂掉就会出现
 * 「订单已付、积分没到」，而重发的通知因为状态已是 paid 再也不会补上。
 */
export async function settle(outTradeNo: string, input: { tradeNo: string; payload: unknown }): Promise<SettleResult> {
    return withTransaction(async (conn: PoolConnection) => {
        const [locked] = await conn.execute<RowDataPacket[]>(`SELECT ${COLUMNS} FROM recharge_orders WHERE out_trade_no = ? FOR UPDATE`, [outTradeNo]);
        const order = (locked[0] as OrderRow) || null;
        if (!order) return { credited: false, order: null };

        const [updated] = await conn.execute<ResultSetHeader>(
            `UPDATE recharge_orders SET status = ?, trade_no = ?, paid_at = NOW(), notify_raw = ?
             WHERE out_trade_no = ? AND status <> ?`,
            [STATUS_PAID, input.tradeNo, JSON.stringify(input.payload), outTradeNo, STATUS_PAID],
        );
        // 影响行数为 0 说明这条之前已经处理过了（支付宝重发 / 轮询和对账撞在一起）。
        // 照样算成功返回，但绝不能再走一遍加钱。
        if (updated.affectedRows === 0) return { credited: false, order };

        await conn.execute("INSERT INTO user_wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id", [order.user_id]);
        // 加法交给数据库做：读出来在 JS 里加再写回去，两路并发就会丢掉一笔
        await conn.execute("UPDATE user_wallets SET balance = balance + ? WHERE user_id = ?", [order.credits, order.user_id]);
        const [wallet] = await conn.execute<RowDataPacket[]>("SELECT balance FROM user_wallets WHERE user_id = ?", [order.user_id]);
        await conn.execute(
            `INSERT INTO wallet_ledger (user_id, kind, amount, balance_after, ref_no, note)
             VALUES (?, 'recharge', ?, ?, ?, ?)`,
            [order.user_id, order.credits, wallet[0].balance, outTradeNo, order.subject],
        );

        return { credited: true, order: { ...order, status: STATUS_PAID, trade_no: input.tradeNo } };
    });
}
