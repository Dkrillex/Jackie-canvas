/** 数据库自检：连得上吗、表建好了吗、当前有多少单和多少余额。`npm run check:db` */
import { getPool } from "../src/db.js";
import { mysqlConfigured, settings } from "../src/config.js";

if (!mysqlConfigured()) {
    console.error("✗ MySQL 没配全：需要 MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE");
    process.exit(1);
}

console.log(`连接 ${settings.mysqlUser}@${settings.mysqlHost}:${settings.mysqlPort}/${settings.mysqlDatabase} …`);
const pool = await getPool(); // getPool 内部会建表，跑通即说明建表语句也没问题
console.log("✓ 连接成功，表已就绪");

for (const table of ["recharge_orders", "user_wallets", "wallet_ledger", "jobs", "job_quotes", "credit_exchanges"]) {
    const [rows] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM ${table}`);
    console.log(`  ${table}: ${rows[0].n} 行`);
}
const [paid] = await pool.query<any[]>("SELECT COUNT(*) AS n, IFNULL(SUM(amount),0) AS total FROM recharge_orders WHERE status = 'paid'");
console.log(`  已付订单 ${paid[0].n} 笔，合计 ¥${paid[0].total}`);
await pool.end();
