/**
 * MySQL 连接池与建表。
 *
 * 为什么不是内存或 SQLite：支付宝的异步通知会重发、会乱序、会在进程重启之后才到，
 * 订单状态必须落在扛得住重启、且多实例能看到同一份的地方。本地文件做不到 ——
 * 下单写进 A 实例、通知打到 B 实例，B 会说「查无此单」，然后支付宝一直重发。
 *
 * 池子懒建：没配数据库时服务照常起，只有 /api/pay/* 回 503。
 */
import mysql, { type Pool } from "mysql2/promise";

import { mysqlConfigured, settings } from "./config.js";

export class DatabaseNotConfigured extends Error {}

const SCHEMA = [
    // 充值订单。金额一律 DECIMAL 不用 FLOAT —— 钱经不起二进制小数的舍入
    `CREATE TABLE IF NOT EXISTS recharge_orders (
        id            BIGINT AUTO_INCREMENT PRIMARY KEY,
        out_trade_no  VARCHAR(64)   NOT NULL UNIQUE  COMMENT '商户订单号，服务端生成',
        user_id       VARCHAR(64)   NOT NULL         COMMENT 'New API user id，下单时从登录态解出来',
        package_id    VARCHAR(64)   NOT NULL         COMMENT '充值档位 id',
        subject       VARCHAR(255)  NOT NULL,
        amount        DECIMAL(12,2) NOT NULL         COMMENT '应付人民币',
        credits       DECIMAL(12,2) NOT NULL         COMMENT '付款成功后到账的美元调用额度（列名沿用旧的 credits），下单时从档位抄一份，调价不影响旧单',
        status        VARCHAR(16)   NOT NULL         COMMENT 'created/paid/closed',
        trade_no      VARCHAR(64)   NULL             COMMENT '支付宝交易号，退款和对账要用',
        notify_raw    TEXT          NULL             COMMENT '原样存一份通知报文，日后有争议时这是唯一凭据',
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_at       DATETIME      NULL,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='充值订单'`,

    // 额度发放记录：充值到账后给 New API 账号加调用额度。加额度是外部 HTTP，进不了订单的事务，
    // 所以把「要发多少、发到哪一步」显式落库：settle() 在同一个事务里插入 pending，之后再去调用。
    // ref_no 唯一：一笔充值单只会有一条，重复触发只会撞唯一键。
    `CREATE TABLE IF NOT EXISTS quota_grants (
        id          BIGINT AUTO_INCREMENT PRIMARY KEY,
        ref_no      VARCHAR(64)   NOT NULL UNIQUE  COMMENT '充值单号 out_trade_no',
        user_id     VARCHAR(64)   NOT NULL         COMMENT 'New API user id，BIGINT 当字符串存',
        usd         DECIMAL(14,2) NOT NULL         COMMENT '发放的美元额度',
        quota       BIGINT        NOT NULL         COMMENT 'New API 内部 quota = usd × NEW_API_QUOTA_PER_UNIT',
        status      VARCHAR(16)   NOT NULL         COMMENT 'pending/granting/done/failed/unknown',
        attempts    INT           NOT NULL DEFAULT 0,
        last_error  VARCHAR(255)  NOT NULL DEFAULT '',
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='New API 额度发放记录'`,
];

let pool: Pool | null = null;
let ready: Promise<Pool> | null = null;

async function init(): Promise<Pool> {
    if (!mysqlConfigured()) {
        throw new DatabaseNotConfigured("订单库没配置：需要 MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE");
    }
    const created = mysql.createPool({
        host: settings.mysqlHost,
        port: settings.mysqlPort,
        user: settings.mysqlUser,
        password: settings.mysqlPassword,
        database: settings.mysqlDatabase,
        charset: "utf8mb4",
        waitForConnections: true,
        connectionLimit: settings.mysqlConnectionLimit,
        // RDS 会掐掉空闲连接。mysql2 靠这两项自己回收，否则服务闲一会儿再来请求
        // 就报 "MySQL server has gone away"
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        // DECIMAL 默认会被转成 JS number，钱一旦过一遍浮点就可能变成 0.009999999。
        // 这里让它保持字符串，进出都用字符串，只在必须比大小时才转 number。
        decimalNumbers: false,
        // DATETIME 原样返回 'YYYY-MM-DD HH:MM:SS'，不让驱动按某个时区重新解释成 Date。
        // 库里所有时间都用 NOW() 写入，读出来是同一个时钟，前端直接展示即可。
        dateStrings: true,
    });
    for (const statement of SCHEMA) await created.query(statement);
    pool = created;
    return created;
}

export function getPool(): Promise<Pool> {
    if (pool) return Promise.resolve(pool);
    if (!ready) {
        ready = init().catch((error) => {
            ready = null; // 建池失败要能重试，否则一次网络抖动就把服务钉死
            throw error;
        });
    }
    return ready;
}

/** 在一个事务里跑。抛异常自动回滚。 */
export async function withTransaction<T>(run: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const conn = await (await getPool()).getConnection();
    try {
        await conn.beginTransaction();
        const result = await run(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback().catch(() => undefined);
        throw error;
    } finally {
        conn.release();
    }
}
