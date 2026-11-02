/**
 * 充值到账 → 给 New API 账号加调用额度。
 *
 * 加额度是外部 HTTP，进不了订单的事务，所以拆成两步：
 *   1. settle() 在订单标为已付的同一个事务里插一条 pending（ref_no 唯一，一笔单只有一条）；
 *   2. 事务提交后 processGrant() 去调 New API。
 *
 * 状态：pending → granting →（done | failed | unknown）
 *   failed  New API 明确拒绝（令牌错、用户不存在等），额度肯定没加上，修好配置后用脚本重试；
 *   unknown 超时 / 5xx，额度可能已经加上，自动重发会多发，只能人工核对后处理；
 *   granting 停在这里说明进程在调用途中挂了，同样按 unknown 人工核对。
 * 只有 pending 会被自动处理，failed / unknown 一律不自动重发。
 */
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool } from "./db.js";
import { grantUserQuota, QuotaGrantError, usdToQuota } from "./nova-quota.js";

export type GrantStatus = "pending" | "granting" | "done" | "failed" | "unknown";

/** 在调用方的事务里插一条待发放记录。重复插入会撞 ref_no 唯一键。 */
export async function createGrant(conn: PoolConnection, input: { refNo: string; userId: string; usd: string }) {
    await conn.execute("INSERT INTO quota_grants (ref_no, user_id, usd, quota, status) VALUES (?, ?, ?, ?, 'pending')", [input.refNo, input.userId, input.usd, usdToQuota(input.usd)]);
}

/** 发放一条。先用条件更新抢到这条记录，通知、轮询、对账同时命中也只会有一路去调 New API。 */
export async function processGrant(refNo: string, from: GrantStatus[] = ["pending"]): Promise<GrantStatus | null> {
    const pool = await getPool();
    const [claimed] = await pool.query<ResultSetHeader>(`UPDATE quota_grants SET status = 'granting', attempts = attempts + 1 WHERE ref_no = ? AND status IN (?)`, [refNo, from]);
    if (claimed.affectedRows === 0) return null;
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT user_id, quota FROM quota_grants WHERE ref_no = ?", [refNo]);
    const grant = rows[0] as { user_id: string; quota: number | string } | undefined;
    if (!grant) return null;

    let status: GrantStatus = "done";
    let error = "";
    try {
        await grantUserQuota(String(grant.user_id), Number(grant.quota));
    } catch (caught) {
        status = caught instanceof QuotaGrantError && caught.uncertain ? "unknown" : "failed";
        error = (caught as Error).message.slice(0, 250);
        console.error(`[pay] 发放额度 ${refNo} ${status === "unknown" ? "结果未知，需人工核对" : "失败"}：${error}`);
    }
    await pool.execute("UPDATE quota_grants SET status = ?, last_error = ? WHERE ref_no = ?", [status, error, refNo]);
    return status;
}

/** 自动处理只看 pending：settle 提交后进程挂了、没来得及调用的那些。 */
export async function listPendingGrants(limit = 50): Promise<string[]> {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT ref_no FROM quota_grants WHERE status = 'pending' ORDER BY id LIMIT ?", [limit]);
    return rows.map((row) => String(row.ref_no));
}

export async function grantStatusByRef(refNos: string[]): Promise<Map<string, GrantStatus>> {
    if (!refNos.length) return new Map();
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT ref_no, status FROM quota_grants WHERE ref_no IN (?)", [refNos]);
    return new Map(rows.map((row) => [String(row.ref_no), row.status as GrantStatus]));
}
