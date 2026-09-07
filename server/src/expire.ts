/**
 * 工单到期扫描。三个时钟各扫一遍，**顺序有讲究**：
 *
 *   1. 验收超时（submitted 且 review_deadline_at 已过）→ 自动验收打款
 *   2. 工时超时（active   且 work_deadline_at   已过）→ 罚没押金、退回市场
 *   3. 整单过期（open/quoted/active 且 job_deadline_at 已过）→ 作废退款
 *
 * 验收放在最前面：已经交付的单不该被整单过期吞掉，否则雇主拖着不验收就能白拿交付物
 * 还把钱要回去。整单过期那一档也刻意不包含 submitted，两处一起保证这件事。
 *
 * 每一笔都各自开事务、各自幂等（状态判断带在 UPDATE 的 WHERE 里），
 * 所以一笔失败不影响其余，下一轮还会再试。
 */
import type { RowDataPacket } from "mysql2/promise";

import { settings } from "./config.js";
import { getPool } from "./db.js";
import { expireJob, expireReview, expireWork } from "./jobs.js";

type Due = { id: string; title: string };

async function dueJobs(sql: string): Promise<Due[]> {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows as Due[];
}

/** 跑一轮。返回各类处理了多少笔，方便测试直接调用而不用等定时器。 */
export async function sweepExpiredJobs(): Promise<{ review: number; work: number; job: number }> {
    const result = { review: 0, work: 0, job: 0 };

    for (const row of await dueJobs("SELECT id, title FROM jobs WHERE status = 'submitted' AND review_deadline_at IS NOT NULL AND review_deadline_at <= NOW() LIMIT 100")) {
        if (await expireReview(row.id)) {
            result.review += 1;
            console.log(`[jobs] 验收超时自动通过：${row.title}`);
        }
    }

    for (const row of await dueJobs("SELECT id, title FROM jobs WHERE status = 'active' AND work_deadline_at IS NOT NULL AND work_deadline_at <= NOW() LIMIT 100")) {
        if (await expireWork(row.id)) {
            result.work += 1;
            console.log(`[jobs] 接单工时超时，罚没押金并退回市场：${row.title}`);
        }
    }

    for (const row of await dueJobs("SELECT id, title FROM jobs WHERE status IN ('open','quoted','active') AND job_deadline_at <= NOW() LIMIT 100")) {
        if (await expireJob(row.id)) {
            result.job += 1;
            console.log(`[jobs] 任务单整体有效期已到，作废并退款：${row.title}`);
        }
    }

    return result;
}

export function startJobExpiryLoop(): void {
    const interval = settings.jobExpiryIntervalSec;
    if (interval <= 0) {
        console.log("[jobs] 到期扫描已关闭（JOB_EXPIRY_INTERVAL_SEC<=0），工单不会自动过期");
        return;
    }
    console.log(`[jobs] 到期扫描已启动，每 ${interval}s 一轮（押金 ${settings.jobDepositAmount}，验收期 ${settings.jobReviewDays} 天）`);

    const timer = setInterval(() => {
        // 后台任务不能因为一次异常就死掉
        sweepExpiredJobs().catch((error) => console.error(`[jobs] 到期扫描本轮出错（下轮继续）：${(error as Error).message}`));
    }, interval * 1000);
    timer.unref();
}
