/**
 * 接单中心：工单状态机 + 托管结算。
 *
 * 和充值那条链路的区别在于：充值只有「加钱」一个方向，这里的钱会在两个用户之间搬。
 * 所以每一处动余额的地方都必须满足两件事 ——
 *   1. 校验和写入在同一个事务里，钱包行先 `SELECT ... FOR UPDATE` 锁住；
 *      分开写的话两笔并发的「接受报价」会各自读到同一份可用余额，双双冻结成功，
 *      冻结额加起来超过余额。
 *   2. 状态流转带在 UPDATE 的 WHERE 里（`AND status = ?`），影响行数为 0 就当作
 *      「别人已经改过了」拒绝掉，不要先查后改。
 *
 * `wallet_ledger` 上的 `UNIQUE KEY (kind, ref_no)` 在这里同样兜底：一个工单的
 * freeze / unfreeze / charge / payout 各自只可能发生一次，重复写会直接撞唯一键。
 */
import { randomUUID } from "node:crypto";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool, withTransaction } from "./db.js";

/** 平台抽成。和前端 web/src/jc/lib/job-types.ts 的 PLATFORM_FEE_RATE 保持一致，但以服务端为准。 */
export const PLATFORM_FEE_RATE = 0.1;

export type JobStatus = "open" | "quoted" | "active" | "submitted" | "completed" | "cancelled";

export class JobError extends Error {
    constructor(
        message: string,
        readonly status = 400,
    ) {
        super(message);
    }
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => round(value).toFixed(2);
const newId = () => randomUUID().replace(/-/g, "").slice(0, 21);

const JOB_COLUMNS = `id, title, brief, budget, status, client_id, creator_id, accepted_quote_id,
    delivery_content, delivery_link, delivery_canvas_id, delivery_submitted_at, delivery_reject_reason,
    settle_quote_amount, settle_cost_amount, settle_platform_fee, settle_creator_payout, settle_profit, settled_at,
    created_at, updated_at`;

type JobRow = RowDataPacket & {
    id: string;
    title: string;
    brief: string;
    budget: string;
    status: JobStatus;
    client_id: string;
    creator_id: string | null;
    accepted_quote_id: string | null;
    delivery_content: string | null;
    delivery_link: string | null;
    delivery_canvas_id: string | null;
    delivery_submitted_at: string | null;
    delivery_reject_reason: string | null;
    settle_quote_amount: string | null;
    settle_cost_amount: string | null;
    settle_platform_fee: string | null;
    settle_creator_payout: string | null;
    settle_profit: string | null;
    settled_at: string | null;
    created_at: string;
    updated_at: string;
};

type QuoteRow = RowDataPacket & {
    id: string;
    job_id: string;
    creator_id: string;
    amount: string;
    note: string;
    created_at: string;
};

/** 对外形状。刻意贴着前端原有的 Job 类型，页面不用为了换数据源重写渲染逻辑。 */
export type JobView = {
    id: string;
    title: string;
    brief: string;
    budget: string;
    status: JobStatus;
    clientId: string;
    creatorId?: string;
    acceptedQuoteId?: string;
    quotes: { id: string; creatorId: string; amount: string; note: string; createdAt: string }[];
    delivery?: { content: string; link?: string; canvasId?: string; submittedAt: string; rejectReason?: string };
    settlement?: { quoteAmount: string; costAmount: string; platformFee: string; creatorPayout: string; profit: string; settledAt: string };
    createdAt: string;
    updatedAt: string;
};

function toView(job: JobRow, quotes: QuoteRow[]): JobView {
    return {
        id: job.id,
        title: job.title,
        brief: job.brief,
        budget: job.budget,
        status: job.status,
        clientId: job.client_id,
        creatorId: job.creator_id || undefined,
        acceptedQuoteId: job.accepted_quote_id || undefined,
        quotes: quotes.map((quote) => ({ id: quote.id, creatorId: quote.creator_id, amount: quote.amount, note: quote.note, createdAt: quote.created_at })),
        delivery: job.delivery_submitted_at
            ? {
                  content: job.delivery_content || "",
                  link: job.delivery_link || undefined,
                  canvasId: job.delivery_canvas_id || undefined,
                  submittedAt: job.delivery_submitted_at,
                  rejectReason: job.delivery_reject_reason || undefined,
              }
            : undefined,
        settlement: job.settled_at
            ? {
                  quoteAmount: job.settle_quote_amount || "0.00",
                  costAmount: job.settle_cost_amount || "0.00",
                  platformFee: job.settle_platform_fee || "0.00",
                  creatorPayout: job.settle_creator_payout || "0.00",
                  profit: job.settle_profit || "0.00",
                  settledAt: job.settled_at,
              }
            : undefined,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
    };
}

async function attachQuotes(rows: JobRow[]): Promise<JobView[]> {
    if (!rows.length) return [];
    const pool = await getPool();
    const [quotes] = await pool.query<QuoteRow[]>(
        `SELECT id, job_id, creator_id, amount, note, created_at FROM job_quotes WHERE job_id IN (?) ORDER BY created_at ASC`,
        [rows.map((row) => row.id)],
    );
    return rows.map((row) => toView(row, quotes.filter((quote) => quote.job_id === row.id)));
}

/** scope: hall=可接的单，client=我发的，creator=我报过价或已接的 */
export async function list(userId: string, scope: "hall" | "client" | "creator"): Promise<JobView[]> {
    const pool = await getPool();
    const sql =
        scope === "client"
            ? `SELECT ${JOB_COLUMNS} FROM jobs WHERE client_id = ? ORDER BY created_at DESC LIMIT 200`
            : scope === "creator"
              ? `SELECT ${JOB_COLUMNS} FROM jobs WHERE creator_id = ?
                 OR id IN (SELECT job_id FROM job_quotes WHERE creator_id = ?) ORDER BY created_at DESC LIMIT 200`
              : `SELECT ${JOB_COLUMNS} FROM jobs WHERE status IN ('open','quoted') ORDER BY created_at DESC LIMIT 200`;
    const params = scope === "creator" ? [userId, userId] : scope === "client" ? [userId] : [];
    const [rows] = await pool.query<JobRow[]>(sql, params);
    return attachQuotes(rows);
}

export async function get(jobId: string): Promise<JobView | null> {
    const pool = await getPool();
    const [rows] = await pool.execute<JobRow[]>(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`, [jobId]);
    if (!rows.length) return null;
    return (await attachQuotes(rows))[0];
}

export async function create(userId: string, input: { title: string; brief: string; budget: number }): Promise<string> {
    const title = input.title.trim();
    const budget = round(input.budget);
    if (!title) throw new JobError("标题不能为空");
    if (!(budget > 0)) throw new JobError("预算必须大于 0");

    const id = newId();
    const pool = await getPool();
    await pool.execute("INSERT INTO jobs (id, title, brief, budget, status, client_id) VALUES (?, ?, ?, ?, 'open', ?)", [id, title, input.brief.trim(), money(budget), userId]);
    return id;
}

/**
 * 报价。一个创作者对同一个单只保留最新一份（`UNIQUE (job_id, creator_id)` + upsert），
 * 和原来 mock 里「先过滤掉自己的旧报价再push」是同一个语义。
 */
export async function quote(userId: string, jobId: string, input: { amount: number; note: string }): Promise<void> {
    const amount = round(input.amount);
    if (!(amount > 0)) throw new JobError("报价必须大于 0");

    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.status !== "open" && job.status !== "quoted") throw new JobError("该工单已不接受报价");
        if (job.client_id === userId) throw new JobError("不能给自己发布的工单报价");

        await conn.execute(
            `INSERT INTO job_quotes (id, job_id, creator_id, amount, note) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE amount = VALUES(amount), note = VALUES(note), created_at = NOW()`,
            [newId(), jobId, userId, money(amount), input.note.trim().slice(0, 500)],
        );
        await conn.execute("UPDATE jobs SET status = 'quoted' WHERE id = ? AND status = 'open'", [jobId]);
    });
}

/**
 * 接受报价 → 冻结客户的积分。
 *
 * 冻结不是把钱扣掉，只是把「可用余额」压下去（available = balance - frozen），
 * 验收时才真正从 balance 扣走。所以校验必须用可用余额，不能用余额。
 */
export async function accept(userId: string, jobId: string, quoteId: string): Promise<void> {
    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.client_id !== userId) throw new JobError("只有发单人可以接受报价", 403);
        if (job.status !== "open" && job.status !== "quoted") throw new JobError("该工单已不能接受报价");

        const [quotes] = await conn.execute<QuoteRow[]>("SELECT id, job_id, creator_id, amount, note, created_at FROM job_quotes WHERE id = ? AND job_id = ?", [quoteId, jobId]);
        const picked = quotes[0];
        if (!picked) throw new JobError("报价不存在");

        const wallet = await lockWallet(conn, userId);
        const available = round(Number(wallet.balance) - Number(wallet.frozen));
        if (available < Number(picked.amount)) throw new JobError("可用积分不足，请先充值");

        const frozen = round(Number(wallet.frozen) + Number(picked.amount));
        await conn.execute("UPDATE user_wallets SET frozen = ? WHERE user_id = ?", [money(frozen), userId]);
        await pushLedger(conn, userId, "freeze", Number(picked.amount), Number(wallet.balance), frozen, jobId, "接受报价冻结");

        const [updated] = await conn.execute<ResultSetHeader>(
            "UPDATE jobs SET status = 'active', accepted_quote_id = ?, creator_id = ? WHERE id = ? AND status IN ('open','quoted')",
            [quoteId, picked.creator_id, jobId],
        );
        if (updated.affectedRows === 0) throw new JobError("该工单状态已变化，请刷新后重试");
    });
}

export async function submitDelivery(userId: string, jobId: string, input: { content: string; link?: string; canvasId?: string }): Promise<void> {
    const pool = await getPool();
    const [updated] = await pool.execute<ResultSetHeader>(
        `UPDATE jobs SET status = 'submitted', delivery_content = ?, delivery_link = ?, delivery_canvas_id = ?,
             delivery_submitted_at = NOW(), delivery_reject_reason = NULL
         WHERE id = ? AND creator_id = ? AND status IN ('active','submitted')`,
        [input.content.trim(), input.link?.trim() || null, input.canvasId?.trim() || null, jobId, userId],
    );
    if (updated.affectedRows === 0) throw new JobError("无法提交交付：请确认你是接单人且工单处于进行中");
}

export async function rejectDelivery(userId: string, jobId: string, reason: string): Promise<void> {
    const pool = await getPool();
    const [updated] = await pool.execute<ResultSetHeader>(
        "UPDATE jobs SET status = 'active', delivery_reject_reason = ? WHERE id = ? AND client_id = ? AND status = 'submitted'",
        [reason.trim().slice(0, 500), jobId, userId],
    );
    if (updated.affectedRows === 0) throw new JobError("无法打回：请确认你是发单人且工单处于待验收");
}

/**
 * 验收 → 结算。一次事务里搬三处钱：
 *   客户 balance 扣掉报价、frozen 同额解冻；创作者 balance 加上扣除平台抽成后的金额。
 * 平台抽成不落到任何用户钱包（没有平台账号），只记在工单的结算字段里。
 */
export async function acceptDelivery(userId: string, jobId: string, costAmount: number): Promise<void> {
    const cost = round(Math.max(0, costAmount));

    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.client_id !== userId) throw new JobError("只有发单人可以验收", 403);
        if (job.status !== "submitted") throw new JobError("该工单当前不可验收");
        if (!job.accepted_quote_id || !job.creator_id) throw new JobError("工单缺少已接受的报价");

        const [quotes] = await conn.execute<QuoteRow[]>("SELECT amount FROM job_quotes WHERE id = ?", [job.accepted_quote_id]);
        if (!quotes.length) throw new JobError("报价不存在");
        const quoteAmount = round(Number(quotes[0].amount));
        const platformFee = round(quoteAmount * PLATFORM_FEE_RATE);
        const creatorPayout = round(quoteAmount - platformFee);
        const profit = round(platformFee - cost);

        // 钱包按 user_id 排序加锁，避免「A 验收 B 的单」和「B 验收 A 的单」同时发生时互相等对方的行造成死锁
        const [firstId, secondId] = [userId, job.creator_id].sort();
        const first = await lockWallet(conn, firstId);
        const second = firstId === secondId ? first : await lockWallet(conn, secondId);
        const clientWallet = userId === firstId ? first : second;
        const creatorWallet = job.creator_id === firstId ? first : second;

        const clientBalance = round(Number(clientWallet.balance) - quoteAmount);
        const clientFrozen = round(Math.max(0, Number(clientWallet.frozen) - quoteAmount));
        await conn.execute("UPDATE user_wallets SET balance = ?, frozen = ? WHERE user_id = ?", [money(clientBalance), money(clientFrozen), userId]);
        await pushLedger(conn, userId, "charge", -quoteAmount, clientBalance, clientFrozen, jobId, `工单结算（抽成 ${money(platformFee)}）`);

        // 自己接自己的单在业务上被 quote() 拦掉了，但结算这里仍要按「已经落库的余额」重算一次，
        // 否则同一行被两条 UPDATE 各按各自的旧值覆盖，后写的会把前一次的扣款抹掉。
        const creatorBase = job.creator_id === userId ? clientBalance : round(Number(creatorWallet.balance));
        const creatorBalance = round(creatorBase + creatorPayout);
        await conn.execute("UPDATE user_wallets SET balance = ? WHERE user_id = ?", [money(creatorBalance), job.creator_id]);
        await pushLedger(conn, job.creator_id, "payout", creatorPayout, creatorBalance, Number(creatorWallet.frozen), jobId, "工单收款");

        const [updated] = await conn.execute<ResultSetHeader>(
            `UPDATE jobs SET status = 'completed', settle_quote_amount = ?, settle_cost_amount = ?, settle_platform_fee = ?,
                 settle_creator_payout = ?, settle_profit = ?, settled_at = NOW()
             WHERE id = ? AND status = 'submitted'`,
            [money(quoteAmount), money(cost), money(platformFee), money(creatorPayout), money(profit), jobId],
        );
        if (updated.affectedRows === 0) throw new JobError("该工单状态已变化，请刷新后重试");
    });
}

/** 取消。已冻结的先解冻，钱回到可用余额。 */
export async function cancel(userId: string, jobId: string): Promise<void> {
    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.client_id !== userId) throw new JobError("只有发单人可以取消", 403);
        if (job.status === "completed" || job.status === "cancelled") throw new JobError("该工单已结束");

        if (job.accepted_quote_id && (job.status === "active" || job.status === "submitted")) {
            const [quotes] = await conn.execute<QuoteRow[]>("SELECT amount FROM job_quotes WHERE id = ?", [job.accepted_quote_id]);
            const amount = round(Number(quotes[0]?.amount || 0));
            if (amount > 0) {
                const wallet = await lockWallet(conn, userId);
                const frozen = round(Math.max(0, Number(wallet.frozen) - amount));
                await conn.execute("UPDATE user_wallets SET frozen = ? WHERE user_id = ?", [money(frozen), userId]);
                await pushLedger(conn, userId, "unfreeze", amount, Number(wallet.balance), frozen, jobId, "取消工单解冻");
            }
        }

        const [updated] = await conn.execute<ResultSetHeader>("UPDATE jobs SET status = 'cancelled' WHERE id = ? AND status NOT IN ('completed','cancelled')", [jobId]);
        if (updated.affectedRows === 0) throw new JobError("该工单状态已变化，请刷新后重试");
    });
}

async function lockJob(conn: PoolConnection, jobId: string): Promise<JobRow> {
    const [rows] = await conn.execute<JobRow[]>(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ? FOR UPDATE`, [jobId]);
    if (!rows.length) throw new JobError("工单不存在", 404);
    return rows[0];
}

/** 钱包行可能还不存在（没充过值），先补一行再锁，保证后续 UPDATE 一定有目标。 */
async function lockWallet(conn: PoolConnection, userId: string): Promise<{ balance: string; frozen: string }> {
    await conn.execute("INSERT INTO user_wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id", [userId]);
    const [rows] = await conn.execute<RowDataPacket[]>("SELECT balance, frozen FROM user_wallets WHERE user_id = ? FOR UPDATE", [userId]);
    return rows[0] as { balance: string; frozen: string };
}

async function pushLedger(conn: PoolConnection, userId: string, kind: string, amount: number, balanceAfter: number, frozenAfter: number, jobId: string, note: string) {
    await conn.execute(
        "INSERT INTO wallet_ledger (user_id, kind, amount, balance_after, frozen_after, ref_no, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, kind, money(amount), money(balanceAfter), money(frozenAfter), jobId, note],
    );
}
