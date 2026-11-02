/**
 * 人工重试没发出去的额度。自动流程只处理 pending，failed / unknown 都要人来决定。
 *
 *   npm run grants:retry -- --list        列出 failed / unknown / 卡在 granting 的记录
 *   npm run grants:retry                  重试 failed（New API 明确拒绝过，额度肯定没加上）
 *   npm run grants:retry -- --unknown     重试 unknown 和卡住的 granting。
 *                                         先去 New API 后台核对这笔额度确实没加上，否则会多发
 */
import type { RowDataPacket } from "mysql2/promise";

import { mysqlConfigured, novaAdminConfigured } from "../src/config.js";
import { getPool } from "../src/db.js";
import { processGrant, type GrantStatus } from "../src/grants.js";

if (!mysqlConfigured()) {
    console.error("✗ 没配 MYSQL_*");
    process.exit(1);
}

const pool = await getPool();
const listOnly = process.argv.includes("--list");
const statuses: GrantStatus[] = listOnly ? ["failed", "unknown", "granting"] : process.argv.includes("--unknown") ? ["unknown", "granting"] : ["failed"];
const [rows] = await pool.query<RowDataPacket[]>("SELECT ref_no, user_id, usd, status, attempts, last_error, updated_at FROM quota_grants WHERE status IN (?) ORDER BY id", [statuses]);

if (!rows.length) {
    console.log(`✓ 没有 ${statuses.join(" / ")} 的记录`);
    process.exit(0);
}
for (const row of rows) console.log(`  ${row.ref_no}  user ${row.user_id}  $${row.usd}  ${row.status}  第 ${row.attempts} 次  ${row.updated_at}  ${row.last_error}`);
if (listOnly) process.exit(0);

if (!novaAdminConfigured()) {
    console.error("✗ 没配 NEW_API_ADMIN_TOKEN，无法发放额度");
    process.exit(1);
}
for (const row of rows) console.log(`  ${row.ref_no} → ${await processGrant(String(row.ref_no), statuses)}`);
process.exit(0);
