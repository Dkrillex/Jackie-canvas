/**
 * 积分 → API 额度的兑换。
 *
 * 扣积分在我们自己的库里，发额度在网关那边，两件事不可能放进同一个事务 —— 中间必然
 * 有一刻是「积分已扣、额度未到」。所以这里不假装它是原子的，而是把每一笔的进度显式
 * 记在 `credit_exchanges` 上：
 *
 *   create()      扣积分 + 落一条 pending（这一步是事务，扣款和记录同生共死）
 *   markDone()    网关发放成功 → done，写下回执
 *   markFailed()  网关发放失败 → failed，并把积分原样退回（同样是事务）
 *
 * 卡在 pending 的记录就是需要人去对账的那些。宁可留着让人看见，也不要偷偷当成功。
 *
 * TODO(接入 /gw)：目前 create() 只到 pending 为止，没有真正调网关。拿到 /gw 的发放
 * 接口后，在路由层 create() 之后调用它，成功回 markDone()、失败回 markFailed()。
 * 不要把网关调用塞进 create() 的事务里 —— 一个跨网络的请求会把数据库事务拖到几秒，
 * 期间钱包行一直被锁着。
 */
import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool, withTransaction } from "./db.js";

export const STATUS_PENDING = "pending";
export const STATUS_DONE = "done";
export const STATUS_FAILED = "failed";

export class ExchangeError extends Error {
    constructor(
        message: string,
        readonly status = 400,
    ) {
        super(message);
    }
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => round(value).toFixed(2);

export type ExchangeRow = {
    id: string;
    credits: string;
    status: string;
    gw_ref: string | null;
    note: string;
    created_at: string;
    settled_at: string | null;
};

const COLUMNS = "id, credits, status, gw_ref, note, created_at, settled_at";

/** 发起一笔兑换：扣积分并落 pending。返回这笔记录的 id。 */
export async function create(userId: string, credits: number): Promise<ExchangeRow> {
    const amount = round(credits);
    if (!(amount > 0)) throw new ExchangeError("兑换积分必须大于 0");

    const id = randomUUID().replace(/-/g, "").slice(0, 21);
    return withTransaction(async (conn) => {
        await conn.execute("INSERT INTO user_wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id", [userId]);
        const [rows] = await conn.execute<RowDataPacket[]>("SELECT balance, frozen FROM user_wallets WHERE user_id = ? FOR UPDATE", [userId]);
        const wallet = rows[0] as { balance: string; frozen: string };
        // 冻结中的积分是工单托管款，不能拿来兑换，所以看的是可用余额而不是余额
        const available = round(Number(wallet.balance) - Number(wallet.frozen));
        if (available < amount) throw new ExchangeError("可用积分不足");

        const balanceAfter = round(Number(wallet.balance) - amount);
        await conn.execute("UPDATE user_wallets SET balance = ? WHERE user_id = ?", [money(balanceAfter), userId]);
        await conn.execute(
            "INSERT INTO wallet_ledger (user_id, kind, amount, balance_after, frozen_after, ref_no, note) VALUES (?, 'exchange', ?, ?, ?, ?, ?)",
            [userId, money(-amount), money(balanceAfter), money(Number(wallet.frozen)), id, "兑换 API 额度"],
        );
        await conn.execute("INSERT INTO credit_exchanges (id, user_id, credits, status) VALUES (?, ?, ?, ?)", [id, userId, money(amount), STATUS_PENDING]);

        const [created] = await conn.execute<RowDataPacket[]>(`SELECT ${COLUMNS} FROM credit_exchanges WHERE id = ?`, [id]);
        return created[0] as ExchangeRow;
    });
}

/** 网关发放成功。只有 pending 能转 done，重复调用影响行数为 0。 */
export async function markDone(id: string, gwRef: string): Promise<boolean> {
    const pool = await getPool();
    const [updated] = await pool.execute<ResultSetHeader>(
        "UPDATE credit_exchanges SET status = ?, gw_ref = ?, settled_at = NOW() WHERE id = ? AND status = ?",
        [STATUS_DONE, gwRef.slice(0, 128), id, STATUS_PENDING],
    );
    return updated.affectedRows > 0;
}

/**
 * 网关发放失败：置 failed 并把积分退回。
 *
 * 退款和改状态在同一个事务里，且 `WHERE status = 'pending'` 影响行数为 0 时直接返回 ——
 * 否则重试一次就会多退一笔积分。
 */
export async function markFailed(id: string, reason: string): Promise<boolean> {
    return withTransaction(async (conn) => {
        const [rows] = await conn.execute<RowDataPacket[]>("SELECT user_id, credits, status FROM credit_exchanges WHERE id = ? FOR UPDATE", [id]);
        const row = rows[0] as { user_id: string; credits: string; status: string } | undefined;
        if (!row || row.status !== STATUS_PENDING) return false;

        const [updated] = await conn.execute<ResultSetHeader>("UPDATE credit_exchanges SET status = ?, note = ?, settled_at = NOW() WHERE id = ? AND status = ?", [
            STATUS_FAILED,
            reason.slice(0, 255),
            id,
            STATUS_PENDING,
        ]);
        if (updated.affectedRows === 0) return false;

        await conn.execute("UPDATE user_wallets SET balance = balance + ? WHERE user_id = ?", [row.credits, row.user_id]);
        const [wallet] = await conn.execute<RowDataPacket[]>("SELECT balance, frozen FROM user_wallets WHERE user_id = ?", [row.user_id]);
        await conn.execute(
            "INSERT INTO wallet_ledger (user_id, kind, amount, balance_after, frozen_after, ref_no, note) VALUES (?, 'refund', ?, ?, ?, ?, ?)",
            [row.user_id, row.credits, wallet[0].balance, wallet[0].frozen, id, `兑换失败退回：${reason.slice(0, 100)}`],
        );
        return true;
    });
}

export async function listByUser(userId: string, limit = 20): Promise<ExchangeRow[]> {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM credit_exchanges WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [userId, limit]);
    return rows as ExchangeRow[];
}
