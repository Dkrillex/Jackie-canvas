/**
 * 一次性迁移：把旧积分钱包 user_wallets 里的余额按 1 积分 = $1 转成 New API 调用额度。
 *
 *   npm run migrate:wallet -- --dry-run   只列出要转的账号和金额，不改任何数据
 *   npm run migrate:wallet                正式执行
 *
 * 每个账号在一个事务里：锁钱包行 → 记一条 wallet:<user_id> 发放（唯一键防重复）→ 余额和冻结清零 → 记一条调账流水；
 * 提交后再调 New API 发放。重复运行不会多发：已迁移的账号余额是 0、发放记录也已存在。
 * 冻结中的积分来自接单中心的托管款，接单中心已下线，这部分一并转给当前账号（等于退给雇主）。
 */
import type { RowDataPacket } from "mysql2/promise";

import { mysqlConfigured, novaAdminConfigured } from "../src/config.js";
import { getPool, withTransaction } from "../src/db.js";
import { createGrant, processGrant } from "../src/grants.js";

const dryRun = process.argv.includes("--dry-run");

if (!mysqlConfigured()) {
    console.error("✗ 没配 MYSQL_*，连不上钱包库");
    process.exit(1);
}

const pool = await getPool();
let wallets: RowDataPacket[] = [];
try {
    [wallets] = await pool.query<RowDataPacket[]>("SELECT user_id, balance, frozen FROM user_wallets WHERE balance > 0 ORDER BY user_id");
} catch (error) {
    if ((error as { code?: string }).code === "ER_NO_SUCH_TABLE") {
        console.log("✓ 没有 user_wallets 表，无需迁移");
        process.exit(0);
    }
    throw error;
}

if (!wallets.length) {
    console.log("✓ 没有余额大于 0 的钱包，无需迁移");
    process.exit(0);
}

console.log(`${dryRun ? "[预览] " : ""}共 ${wallets.length} 个账号：`);
for (const row of wallets) console.log(`  user ${row.user_id}  余额 ${row.balance}  其中冻结 ${row.frozen}  → 发放 $${row.balance}`);
if (dryRun) process.exit(0);

if (!novaAdminConfigured()) {
    console.error("✗ 没配 NEW_API_ADMIN_TOKEN，无法发放额度");
    process.exit(1);
}

for (const row of wallets) {
    const userId = String(row.user_id);
    const refNo = `wallet:${userId}`;
    const moved = await withTransaction(async (conn) => {
        const [locked] = await conn.execute<RowDataPacket[]>("SELECT balance, frozen FROM user_wallets WHERE user_id = ? FOR UPDATE", [userId]);
        const balance = String(locked[0]?.balance || "0");
        if (!(Number(balance) > 0)) return "";
        await createGrant(conn, { refNo, userId, usd: balance });
        await conn.execute("UPDATE user_wallets SET balance = 0, frozen = 0 WHERE user_id = ?", [userId]);
        await conn.execute(
            `INSERT INTO wallet_ledger (user_id, kind, amount, balance_after, frozen_after, ref_no, note) VALUES (?, 'adjust', ?, 0, 0, ?, '积分转为 New API 调用额度')`,
            [userId, `-${balance}`, `migrate:${userId}`],
        );
        return balance;
    });
    if (!moved) continue;
    const status = await processGrant(refNo);
    console.log(`  user ${userId}  $${moved}  → ${status}`);
}
console.log("完成。failed / unknown 的用 npm run grants:retry 处理");
process.exit(0);
