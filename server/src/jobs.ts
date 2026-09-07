/**
 * 接单中心：工单状态机 + 托管结算 + 押金 + 两个有效期。
 *
 * 和充值那条链路的区别在于：充值只有「加钱」一个方向，这里的钱在两个用户和平台之间搬。
 * 所以每一处动余额的地方都必须满足两件事 ——
 *   1. 校验和写入在同一个事务里，钱包行先 `SELECT ... FOR UPDATE` 锁住；
 *      分开写的话两笔并发的「接受报价」会各自读到同一份可用余额，双双冻结成功，
 *      冻结额加起来超过余额。
 *   2. 状态流转带在 UPDATE 的 WHERE 里（`AND status = ?`），影响行数为 0 就当作
 *      「别人已经改过了」拒绝掉，不要先查后改。
 *
 * 三个时钟，到期后的处置各不相同（见 expire.ts 的扫描器）：
 *   work_deadline_at    接单人没按时交付 → 罚没押金、单子退回市场，雇主的钱继续冻着
 *   review_deadline_at  雇主没按时验收   → 自动验收打款，否则雇主只要不点验收就能白嫖
 *   job_deadline_at     整单过期         → 退出市场、雇主解冻退款、押金原样退回
 */
import { randomUUID } from "node:crypto";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { settings } from "./config.js";
import { getPool, withTransaction } from "./db.js";

/** 平台抽成。和前端 web/src/jc/lib/job-types.ts 的 PLATFORM_FEE_RATE 保持一致，但以服务端为准。 */
export const PLATFORM_FEE_RATE = 0.1;

export type JobStatus = "open" | "quoted" | "active" | "submitted" | "completed" | "cancelled" | "expired";

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

const JOB_COLUMNS = `id, title, brief, budget, status, client_id, creator_id, accepted_quote_id, deposit_id, frozen_amount,
    work_days, work_deadline_at, job_deadline_at, review_deadline_at,
    delivery_content, delivery_link, delivery_canvas_id, delivery_submitted_at, delivery_reject_reason,
    settle_quote_amount, settle_cost_amount, settle_platform_fee, settle_creator_payout, settle_profit, settled_at,
    expire_reason, created_at, updated_at`;

type JobRow = RowDataPacket & {
    id: string;
    title: string;
    brief: string;
    budget: string;
    status: JobStatus;
    client_id: string;
    creator_id: string | null;
    accepted_quote_id: string | null;
    deposit_id: string | null;
    frozen_amount: string;
    work_days: number;
    work_deadline_at: string | null;
    job_deadline_at: string;
    review_deadline_at: string | null;
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
    expire_reason: string | null;
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

/** 对外形状。刻意贴着前端的 Job 类型，页面不用为了换数据源重写渲染逻辑。 */
export type JobView = {
    id: string;
    title: string;
    brief: string;
    budget: string;
    status: JobStatus;
    clientId: string;
    creatorId?: string;
    acceptedQuoteId?: string;
    workDays: number;
    /** 接单人必须在此之前交付，超时罚没押金并退回市场 */
    workDeadlineAt?: string;
    /** 整单有效期，到期作废并退款给雇主 */
    jobDeadlineAt: string;
    /** 雇主必须在此之前验收，超时自动验收打款 */
    reviewDeadlineAt?: string;
    /** 接单需要冻结的押金，展示用；实际以服务端 settings 为准 */
    depositAmount: string;
    quotes: { id: string; creatorId: string; amount: string; note: string; createdAt: string }[];
    delivery?: { content: string; link?: string; canvasId?: string; submittedAt: string; rejectReason?: string };
    settlement?: { quoteAmount: string; costAmount: string; platformFee: string; creatorPayout: string; profit: string; settledAt: string };
    expireReason?: string;
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
        workDays: job.work_days,
        workDeadlineAt: job.work_deadline_at || undefined,
        jobDeadlineAt: job.job_deadline_at,
        reviewDeadlineAt: job.review_deadline_at || undefined,
        depositAmount: money(settings.jobDepositAmount),
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
        expireReason: job.expire_reason || undefined,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
    };
}

async function attachQuotes(rows: JobRow[]): Promise<JobView[]> {
    if (!rows.length) return [];
    const pool = await getPool();
    const [quotes] = await pool.query<QuoteRow[]>(`SELECT id, job_id, creator_id, amount, note, created_at FROM job_quotes WHERE job_id IN (?) ORDER BY created_at ASC`, [
        rows.map((row) => row.id),
    ]);
    return rows.map((row) =>
        toView(
            row,
            quotes.filter((quote) => quote.job_id === row.id),
        ),
    );
}

/** 只有发单人和接单人能看到交付内容与结算明细，其余人拿到的是去掉这两块的版本。 */
function redactForViewer(job: JobView, viewerId: string): JobView {
    if (job.clientId === viewerId || job.creatorId === viewerId) return job;
    return { ...job, delivery: undefined, settlement: undefined };
}

/**
 * scope: hall=可接的单，client=我发的，creator=我报过价或已接的
 *
 * creator 这一档包含「报过价但没被选中」的单，那些单对当前用户来说只是历史记录，
 * 中标者的交付物和结算金额不该跟着一起返回 —— 所以这里同样要过一遍 redactForViewer。
 */
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
    return (await attachQuotes(rows)).map((job) => redactForViewer(job, userId));
}

/**
 * 读一个工单。`viewerId` 决定看得到多少 —— 工单本身（标题、需求、预算、状态）对登录用户
 * 公开，因为大厅要能浏览；但**交付内容和结算明细只对当事双方可见**。
 */
export async function get(jobId: string, viewerId: string): Promise<JobView | null> {
    const pool = await getPool();
    const [rows] = await pool.execute<JobRow[]>(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`, [jobId]);
    if (!rows.length) return null;
    return redactForViewer((await attachQuotes(rows))[0], viewerId);
}

export async function create(userId: string, input: { title: string; brief: string; budget: number; workDays: number; jobDays: number }): Promise<string> {
    const title = input.title.trim();
    const budget = round(input.budget);
    const workDays = Math.floor(input.workDays);
    const jobDays = Math.floor(input.jobDays);
    if (!title) throw new JobError("标题不能为空");
    if (!(budget > 0)) throw new JobError("预算必须大于 0");
    if (!(workDays >= 1)) throw new JobError("接单工时有效期至少 1 天");
    if (!(jobDays >= 1)) throw new JobError("任务单整体有效期至少 1 天");
    // 整体有效期比工时还短的话，接单人一接单就注定超时，属于配错了
    if (jobDays < workDays) throw new JobError("任务单整体有效期不能短于接单工时有效期");

    const id = newId();
    const pool = await getPool();
    await pool.execute(
        `INSERT INTO jobs (id, title, brief, budget, status, client_id, work_days, job_deadline_at)
         VALUES (?, ?, ?, ?, 'open', ?, ?, NOW() + INTERVAL ? DAY)`,
        [id, title, input.brief.trim(), money(budget), userId, workDays, jobDays],
    );
    return id;
}

/** 报价。一个创作者对同一个单只保留最新一份（`UNIQUE (job_id, creator_id)` + upsert）。 */
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
 * 接受报价。这一步同时动两个人的钱：
 *   雇主  —— 冻结报价金额（只压可用额，余额不动，验收时才真扣）
 *   接单人 —— 冻结押金（超时不交付会被罚没，2 给雇主 3 给平台）
 *
 * 雇主那边按**差额**冻结：单子超时退回市场后被别人以不同价格接走时，之前冻的还在，
 * 只需要补上或退回差的部分。job.frozen_amount 记着当前冻了多少。
 */
export async function accept(userId: string, jobId: string, quoteId: string): Promise<void> {
    const deposit = round(settings.jobDepositAmount);

    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.client_id !== userId) throw new JobError("只有发单人可以接受报价", 403);
        if (job.status !== "open" && job.status !== "quoted") throw new JobError("该工单已不能接受报价");

        const [quotes] = await conn.execute<QuoteRow[]>("SELECT id, job_id, creator_id, amount, note, created_at FROM job_quotes WHERE id = ? AND job_id = ?", [quoteId, jobId]);
        const picked = quotes[0];
        if (!picked) throw new JobError("报价不存在");
        const quoteAmount = round(Number(picked.amount));

        // 两个钱包按 user_id 排序加锁，避免两笔互为对方雇主/接单人的操作同时发生时死锁
        const wallets = await lockWallets(conn, [userId, picked.creator_id]);
        const clientWallet = wallets[userId];
        const creatorWallet = wallets[picked.creator_id];

        // 雇主：只补差额
        const alreadyFrozen = round(Number(job.frozen_amount));
        const delta = round(quoteAmount - alreadyFrozen);
        const clientAvailable = round(Number(clientWallet.balance) - Number(clientWallet.frozen));
        if (delta > 0 && clientAvailable < delta) throw new JobError("可用积分不足，请先充值");

        // 接单人：押金
        const creatorAvailable = round(Number(creatorWallet.balance) - Number(creatorWallet.frozen));
        if (creatorAvailable < deposit) throw new JobError(`接单人可用积分不足 ${money(deposit)}，无法冻结接单押金`);

        const depositId = newId();
        const clientFrozen = round(Number(clientWallet.frozen) + delta);
        const creatorFrozen = round(Number(creatorWallet.frozen) + deposit);

        if (delta !== 0) {
            await conn.execute("UPDATE user_wallets SET frozen = ? WHERE user_id = ?", [money(clientFrozen), userId]);
            await pushLedger(conn, {
                userId,
                kind: delta > 0 ? "freeze" : "unfreeze",
                amount: Math.abs(delta),
                balanceAfter: Number(clientWallet.balance),
                frozenAfter: clientFrozen,
                refNo: depositId,
                jobId,
                note: delta > 0 ? "接受报价冻结" : "换接单人后退回多冻的部分",
            });
        }

        await conn.execute("UPDATE user_wallets SET frozen = ? WHERE user_id = ?", [money(creatorFrozen), picked.creator_id]);
        await pushLedger(conn, {
            userId: picked.creator_id,
            kind: "deposit",
            amount: deposit,
            balanceAfter: Number(creatorWallet.balance),
            frozenAfter: creatorFrozen,
            refNo: depositId,
            jobId,
            note: "接单押金冻结",
        });
        await conn.execute("INSERT INTO job_deposits (id, job_id, creator_id, amount, status) VALUES (?, ?, ?, ?, 'held')", [depositId, jobId, picked.creator_id, money(deposit)]);

        const [updated] = await conn.execute<ResultSetHeader>(
            `UPDATE jobs SET status = 'active', accepted_quote_id = ?, creator_id = ?, deposit_id = ?, frozen_amount = ?,
                 work_deadline_at = NOW() + INTERVAL work_days DAY, delivery_reject_reason = NULL
             WHERE id = ? AND status IN ('open','quoted')`,
            [quoteId, picked.creator_id, depositId, money(quoteAmount), jobId],
        );
        if (updated.affectedRows === 0) throw new JobError("该工单状态已变化，请刷新后重试");
    });
}

export async function submitDelivery(userId: string, jobId: string, input: { content: string; link?: string; canvasId?: string }): Promise<void> {
    const pool = await getPool();
    const [updated] = await pool.execute<ResultSetHeader>(
        `UPDATE jobs SET status = 'submitted', delivery_content = ?, delivery_link = ?, delivery_canvas_id = ?,
             delivery_submitted_at = NOW(), delivery_reject_reason = NULL,
             review_deadline_at = NOW() + INTERVAL ? DAY
         WHERE id = ? AND creator_id = ? AND status IN ('active','submitted')`,
        [input.content.trim(), input.link?.trim() || null, input.canvasId?.trim() || null, settings.jobReviewDays, jobId, userId],
    );
    if (updated.affectedRows === 0) throw new JobError("无法提交交付：请确认你是接单人且工单处于进行中");
}

/** 打回后重新计时：接单人拿回完整的工时期限去改，验收期限清掉。 */
export async function rejectDelivery(userId: string, jobId: string, reason: string): Promise<void> {
    const pool = await getPool();
    const [updated] = await pool.execute<ResultSetHeader>(
        `UPDATE jobs SET status = 'active', delivery_reject_reason = ?, review_deadline_at = NULL,
             work_deadline_at = NOW() + INTERVAL work_days DAY
         WHERE id = ? AND client_id = ? AND status = 'submitted'`,
        [reason.trim().slice(0, 500), jobId, userId],
    );
    if (updated.affectedRows === 0) throw new JobError("无法打回：请确认你是发单人且工单处于待验收");
}

/**
 * 验收结算。一次事务里搬四处钱：
 *   雇主  balance −报价、frozen −冻结额
 *   接单人 balance +（报价 − 抽成）、frozen −押金（押金原样退回）
 *   平台  记一笔抽成收入
 *
 * `auto` 为 true 表示验收期到了雇主没表态，由扫描器自动通过 —— 不这么做的话，
 * 雇主只要不点验收就能拖到整单过期，白拿交付物还把钱拿回去。
 */
export async function acceptDelivery(userId: string, jobId: string, costAmount: number, auto = false): Promise<void> {
    const cost = round(Math.max(0, costAmount));

    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (!auto && job.client_id !== userId) throw new JobError("只有发单人可以验收", 403);
        if (job.status !== "submitted") throw new JobError("该工单当前不可验收");
        if (!job.accepted_quote_id || !job.creator_id) throw new JobError("工单缺少已接受的报价");

        const [quotes] = await conn.execute<QuoteRow[]>("SELECT amount FROM job_quotes WHERE id = ?", [job.accepted_quote_id]);
        if (!quotes.length) throw new JobError("报价不存在");
        const quoteAmount = round(Number(quotes[0].amount));
        const platformFee = round(quoteAmount * PLATFORM_FEE_RATE);
        const creatorPayout = round(quoteAmount - platformFee);
        const profit = round(platformFee - cost);
        const frozenForJob = round(Number(job.frozen_amount));

        const wallets = await lockWallets(conn, [job.client_id, job.creator_id]);
        const clientWallet = wallets[job.client_id];
        const creatorWallet = wallets[job.creator_id];

        const clientBalance = round(Number(clientWallet.balance) - quoteAmount);
        const clientFrozen = round(Math.max(0, Number(clientWallet.frozen) - frozenForJob));
        await conn.execute("UPDATE user_wallets SET balance = ?, frozen = ? WHERE user_id = ?", [money(clientBalance), money(clientFrozen), job.client_id]);
        await pushLedger(conn, {
            userId: job.client_id,
            kind: "charge",
            amount: -quoteAmount,
            balanceAfter: clientBalance,
            frozenAfter: clientFrozen,
            refNo: jobId,
            jobId,
            note: `工单结算（抽成 ${money(platformFee)}）${auto ? "・验收超时自动通过" : ""}`,
        });

        // 接单人：收款 + 押金解冻
        const releasedDeposit = await releaseDeposit(conn, job, creatorWallet, "验收完成，押金退回");
        const creatorBalance = round(Number(creatorWallet.balance) + creatorPayout);
        await conn.execute("UPDATE user_wallets SET balance = ? WHERE user_id = ?", [money(creatorBalance), job.creator_id]);
        await pushLedger(conn, {
            userId: job.creator_id,
            kind: "payout",
            amount: creatorPayout,
            balanceAfter: creatorBalance,
            frozenAfter: releasedDeposit.frozenAfter,
            refNo: jobId,
            jobId,
            note: auto ? "工单收款（验收超时自动通过）" : "工单收款",
        });

        await recordPlatformIncome(conn, { kind: "fee", amount: platformFee, refNo: jobId, jobId, note: "工单抽成" });

        const [updated] = await conn.execute<ResultSetHeader>(
            `UPDATE jobs SET status = 'completed', settle_quote_amount = ?, settle_cost_amount = ?, settle_platform_fee = ?,
                 settle_creator_payout = ?, settle_profit = ?, settled_at = NOW(), frozen_amount = 0,
                 work_deadline_at = NULL, review_deadline_at = NULL
             WHERE id = ? AND status = 'submitted'`,
            [money(quoteAmount), money(cost), money(platformFee), money(creatorPayout), money(profit), jobId],
        );
        if (updated.affectedRows === 0) throw new JobError("该工单状态已变化，请刷新后重试");
    });
}

/** 雇主取消。冻结款解冻，接单人押金原样退回（取消是雇主的决定，不算接单人违规）。 */
export async function cancel(userId: string, jobId: string): Promise<void> {
    await withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.client_id !== userId) throw new JobError("只有发单人可以取消", 403);
        if (job.status === "completed" || job.status === "cancelled" || job.status === "expired") throw new JobError("该工单已结束");
        await unwindJob(conn, job, "cancelled", "发单人取消工单");
    });
}

// ---------------------------------------------------------------------------
// 到期处置。由 expire.ts 的扫描器调用，返回是否真的改了状态（幂等）。
// ---------------------------------------------------------------------------

/**
 * 接单工时超时：罚没押金，单子退回市场。
 *
 * 雇主的钱**继续冻着** —— 单子还在流转，下一个接单人接了就要接着用；解冻再冻一遍
 * 只会给雇主一个把钱挪走的窗口，让已经排队的报价接不上。
 */
export async function expireWork(jobId: string): Promise<boolean> {
    return withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        if (job.status !== "active" || !job.creator_id || !job.deposit_id) return false;

        const wallets = await lockWallets(conn, [job.client_id, job.creator_id]);
        await forfeitDeposit(conn, job, wallets[job.creator_id], wallets[job.client_id]);

        // 超时的人不该被再选一次；其他人当初落选的报价保留，雇主可以直接选下一个
        await conn.execute("DELETE FROM job_quotes WHERE job_id = ? AND creator_id = ?", [jobId, job.creator_id]);
        const [remaining] = await conn.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM job_quotes WHERE job_id = ?", [jobId]);
        const nextStatus = Number(remaining[0].n) > 0 ? "quoted" : "open";

        const [updated] = await conn.execute<ResultSetHeader>(
            `UPDATE jobs SET status = ?, creator_id = NULL, accepted_quote_id = NULL, deposit_id = NULL,
                 work_deadline_at = NULL, review_deadline_at = NULL,
                 delivery_content = NULL, delivery_link = NULL, delivery_canvas_id = NULL,
                 delivery_submitted_at = NULL, delivery_reject_reason = NULL
             WHERE id = ? AND status = 'active'`,
            [nextStatus, jobId],
        );
        return updated.affectedRows > 0;
    });
}

/** 验收超时：视为通过，按正常结算打款。雇主没填成本，按 0 算。 */
export async function expireReview(jobId: string): Promise<boolean> {
    try {
        await acceptDelivery("", jobId, 0, true);
        return true;
    } catch (error) {
        // 状态已经被人改过（雇主刚好点了验收或打回）不算错误
        if (error instanceof JobError) return false;
        throw error;
    }
}

/** 整单过期：退出市场，雇主冻结款解冻退回，当前接单人押金原样退回（他没违规）。 */
export async function expireJob(jobId: string): Promise<boolean> {
    return withTransaction(async (conn) => {
        const job = await lockJob(conn, jobId);
        // submitted 不走这条路：交付物已经在了，该由 expireReview 自动验收，
        // 否则雇主拖到整单过期就能白拿交付物还把钱拿回去。
        if (job.status !== "open" && job.status !== "quoted" && job.status !== "active") return false;
        return unwindJob(conn, job, "expired", "任务单整体有效期已到");
    });
}

// ---------------------------------------------------------------------------

/** 结束一个还没结算的单：解冻雇主的钱、退回押金、置为目标状态。 */
async function unwindJob(conn: PoolConnection, job: JobRow, nextStatus: "cancelled" | "expired", reason: string): Promise<boolean> {
    const frozenForJob = round(Number(job.frozen_amount));
    const parties = [job.client_id, ...(job.creator_id ? [job.creator_id] : [])];
    const wallets = await lockWallets(conn, parties);

    if (frozenForJob > 0) {
        const clientWallet = wallets[job.client_id];
        const clientFrozen = round(Math.max(0, Number(clientWallet.frozen) - frozenForJob));
        await conn.execute("UPDATE user_wallets SET frozen = ? WHERE user_id = ?", [money(clientFrozen), job.client_id]);
        await pushLedger(conn, {
            userId: job.client_id,
            kind: "unfreeze",
            amount: frozenForJob,
            balanceAfter: Number(clientWallet.balance),
            frozenAfter: clientFrozen,
            refNo: job.deposit_id || job.id,
            jobId: job.id,
            note: reason,
        });
    }

    if (job.creator_id && job.deposit_id) await releaseDeposit(conn, job, wallets[job.creator_id], reason);

    const [updated] = await conn.execute<ResultSetHeader>(
        `UPDATE jobs SET status = ?, frozen_amount = 0, deposit_id = NULL, work_deadline_at = NULL, review_deadline_at = NULL, expire_reason = ?
         WHERE id = ? AND status NOT IN ('completed','cancelled','expired')`,
        [nextStatus, reason.slice(0, 255), job.id],
    );
    return updated.affectedRows > 0;
}

/** 押金原样退回：解冻，余额不变。返回退回后的冻结额，供调用方继续记账。 */
async function releaseDeposit(conn: PoolConnection, job: JobRow, creatorWallet: WalletRow, reason: string): Promise<{ frozenAfter: number }> {
    if (!job.deposit_id || !job.creator_id) return { frozenAfter: round(Number(creatorWallet.frozen)) };
    const [rows] = await conn.execute<RowDataPacket[]>("SELECT amount, status FROM job_deposits WHERE id = ? FOR UPDATE", [job.deposit_id]);
    const row = rows[0] as { amount: string; status: string } | undefined;
    if (!row || row.status !== "held") return { frozenAfter: round(Number(creatorWallet.frozen)) };

    const amount = round(Number(row.amount));
    const frozenAfter = round(Math.max(0, Number(creatorWallet.frozen) - amount));
    await conn.execute("UPDATE user_wallets SET frozen = ? WHERE user_id = ?", [money(frozenAfter), job.creator_id]);
    await conn.execute("UPDATE job_deposits SET status = 'refunded', note = ?, settled_at = NOW() WHERE id = ? AND status = 'held'", [reason.slice(0, 255), job.deposit_id]);
    await pushLedger(conn, {
        userId: job.creator_id,
        kind: "deposit_back",
        amount,
        balanceAfter: Number(creatorWallet.balance),
        frozenAfter,
        refNo: job.deposit_id,
        jobId: job.id,
        note: reason,
    });
    // 让调用方后续的余额计算基于最新冻结额
    creatorWallet.frozen = money(frozenAfter);
    return { frozenAfter };
}

/** 罚没押金：接单人真扣，按配置分给雇主和平台。 */
async function forfeitDeposit(conn: PoolConnection, job: JobRow, creatorWallet: WalletRow, clientWallet: WalletRow): Promise<void> {
    if (!job.deposit_id || !job.creator_id) return;
    const [rows] = await conn.execute<RowDataPacket[]>("SELECT amount, status FROM job_deposits WHERE id = ? FOR UPDATE", [job.deposit_id]);
    const row = rows[0] as { amount: string; status: string } | undefined;
    if (!row || row.status !== "held") return;

    const amount = round(Number(row.amount));
    const toClient = round(Math.min(settings.jobDepositToClient, amount));
    const toPlatform = round(amount - toClient);

    // 接单人：解冻并真扣掉
    const creatorFrozen = round(Math.max(0, Number(creatorWallet.frozen) - amount));
    const creatorBalance = round(Number(creatorWallet.balance) - amount);
    await conn.execute("UPDATE user_wallets SET balance = ?, frozen = ? WHERE user_id = ?", [money(creatorBalance), money(creatorFrozen), job.creator_id]);
    await conn.execute("UPDATE job_deposits SET status = 'forfeited', to_client = ?, to_platform = ?, note = ?, settled_at = NOW() WHERE id = ? AND status = 'held'", [
        money(toClient),
        money(toPlatform),
        "接单工时超时未交付",
        job.deposit_id,
    ]);
    await pushLedger(conn, {
        userId: job.creator_id,
        kind: "forfeit",
        amount: -amount,
        balanceAfter: creatorBalance,
        frozenAfter: creatorFrozen,
        refNo: job.deposit_id,
        jobId: job.id,
        note: `接单超时罚没押金（赔付 ${money(toClient)}，平台 ${money(toPlatform)}）`,
    });
    creatorWallet.balance = money(creatorBalance);
    creatorWallet.frozen = money(creatorFrozen);

    // 雇主：拿到赔付
    if (toClient > 0) {
        const clientBalance = round(Number(clientWallet.balance) + toClient);
        await conn.execute("UPDATE user_wallets SET balance = ? WHERE user_id = ?", [money(clientBalance), job.client_id]);
        await pushLedger(conn, {
            userId: job.client_id,
            kind: "compensate",
            amount: toClient,
            balanceAfter: clientBalance,
            frozenAfter: Number(clientWallet.frozen),
            refNo: job.deposit_id,
            jobId: job.id,
            note: "接单人超时的押金赔付",
        });
        clientWallet.balance = money(clientBalance);
    }

    if (toPlatform > 0) await recordPlatformIncome(conn, { kind: "forfeit", amount: toPlatform, refNo: job.deposit_id, jobId: job.id, note: "接单超时罚没" });
}

async function recordPlatformIncome(conn: PoolConnection, input: { kind: string; amount: number; refNo: string; jobId: string; note: string }) {
    await conn.execute("INSERT INTO platform_ledger (kind, amount, ref_no, job_id, note) VALUES (?, ?, ?, ?, ?)", [
        input.kind,
        money(input.amount),
        input.refNo,
        input.jobId,
        input.note,
    ]);
}

type WalletRow = { balance: string; frozen: string };

async function lockJob(conn: PoolConnection, jobId: string): Promise<JobRow> {
    const [rows] = await conn.execute<JobRow[]>(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ? FOR UPDATE`, [jobId]);
    if (!rows.length) throw new JobError("工单不存在", 404);
    return rows[0];
}

/**
 * 按 user_id 排序锁多个钱包行。
 *
 * 排序是关键：不排的话「A 验收 B 的单」和「B 验收 A 的单」同时发生时，两个事务各持一把、
 * 各等对方那把，直接死锁。钱包行可能还不存在（没充过值），先补一行再锁。
 */
async function lockWallets(conn: PoolConnection, userIds: string[]): Promise<Record<string, WalletRow>> {
    const unique = [...new Set(userIds)].sort();
    const out: Record<string, WalletRow> = {};
    for (const userId of unique) {
        await conn.execute("INSERT INTO user_wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id", [userId]);
        const [rows] = await conn.execute<RowDataPacket[]>("SELECT balance, frozen FROM user_wallets WHERE user_id = ? FOR UPDATE", [userId]);
        out[userId] = rows[0] as WalletRow;
    }
    return out;
}

async function pushLedger(
    conn: PoolConnection,
    input: { userId: string; kind: string; amount: number; balanceAfter: number; frozenAfter: number; refNo: string; jobId: string; note: string },
) {
    await conn.execute("INSERT INTO wallet_ledger (user_id, kind, amount, balance_after, frozen_after, ref_no, job_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        input.userId,
        input.kind,
        money(input.amount),
        money(input.balanceAfter),
        money(input.frozenAfter),
        input.refNo,
        input.jobId,
        input.note,
    ]);
}
