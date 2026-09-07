/**
 * MySQL 连接池与建表。
 *
 * 为什么不是内存或 SQLite：支付宝的异步通知会重发、会乱序、会在进程重启之后才到，
 * 订单状态必须落在扛得住重启、且多实例能看到同一份的地方。本地文件做不到 ——
 * 下单写进 A 实例、通知打到 B 实例，B 会说「查无此单」，然后支付宝一直重发。
 *
 * 池子懒建：没配数据库时服务照常起，只有 /api/pay/* 和 /api/wallet/* 回 503。
 */
import mysql, { type Pool } from "mysql2/promise";

import { mysqlConfigured, settings } from "./config.js";

export class DatabaseNotConfigured extends Error {}

const SCHEMA = [
    // 充值订单。金额一律 DECIMAL 不用 FLOAT —— 钱经不起二进制小数的舍入
    `CREATE TABLE IF NOT EXISTS recharge_orders (
        id            BIGINT AUTO_INCREMENT PRIMARY KEY,
        out_trade_no  VARCHAR(64)   NOT NULL UNIQUE  COMMENT '商户订单号，服务端生成',
        user_id       VARCHAR(64)   NOT NULL         COMMENT 'MaaS userId，下单时从 JWT 解出来',
        package_id    VARCHAR(64)   NOT NULL         COMMENT '充值档位 id',
        subject       VARCHAR(255)  NOT NULL,
        amount        DECIMAL(12,2) NOT NULL         COMMENT '应付人民币',
        credits       DECIMAL(12,2) NOT NULL         COMMENT '付款成功后到账的积分，下单时从档位抄一份，调价不影响旧单',
        status        VARCHAR(16)   NOT NULL         COMMENT 'created/paid/closed',
        trade_no      VARCHAR(64)   NULL             COMMENT '支付宝交易号，退款和对账要用',
        notify_raw    TEXT          NULL             COMMENT '原样存一份通知报文，日后有争议时这是唯一凭据',
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_at       DATETIME      NULL,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分充值订单'`,

    `CREATE TABLE IF NOT EXISTS user_wallets (
        user_id     VARCHAR(64)   NOT NULL PRIMARY KEY,
        balance     DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '积分余额',
        frozen      DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '冻结中的积分，接单托管用，当前只读',
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户积分钱包'`,

    // uk_kind_ref 是「同一笔订单只能入账一次」的第二道保险：即使事务里的状态判断
    // 因为哪天改坏了而漏过，重复入账也会在这里撞唯一键失败。ref_no 为 NULL 的手工
    // 调账不受约束（MySQL 唯一索引不比较 NULL）。
    `CREATE TABLE IF NOT EXISTS wallet_ledger (
        id            BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id       VARCHAR(64)   NOT NULL,
        kind          VARCHAR(16)   NOT NULL         COMMENT 'recharge/freeze/unfreeze/charge/payout/adjust',
        amount        DECIMAL(14,2) NOT NULL         COMMENT '正负即方向：入账为正，扣款为负；freeze/unfreeze 记的是冻结变动量',
        balance_after DECIMAL(14,2) NOT NULL,
        frozen_after  DECIMAL(14,2) NOT NULL DEFAULT 0,
        ref_no        VARCHAR(64)   NULL             COMMENT '关联单号：充值是 out_trade_no，工单是 job id',
        note          VARCHAR(255)  NOT NULL DEFAULT '',
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_kind_ref (kind, ref_no),
        INDEX idx_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分流水'`,

    // 工单。交付和结算都是一对一的，拆表只会让每次读都要多 join 一次，直接铺平成列。
    `CREATE TABLE IF NOT EXISTS jobs (
        id                     VARCHAR(32)   NOT NULL PRIMARY KEY,
        title                  VARCHAR(255)  NOT NULL,
        brief                  MEDIUMTEXT    NOT NULL COMMENT 'Markdown 正文，可能内嵌图片引用',
        budget                 DECIMAL(14,2) NOT NULL,
        status                 VARCHAR(16)   NOT NULL COMMENT 'open/quoted/active/submitted/completed/cancelled',
        client_id              VARCHAR(64)   NOT NULL COMMENT '发单人 MaaS userId',
        creator_id             VARCHAR(64)   NULL     COMMENT '接单人，接受报价时写入',
        accepted_quote_id      VARCHAR(32)   NULL,
        delivery_content       MEDIUMTEXT    NULL,
        delivery_link          VARCHAR(500)  NULL,
        delivery_canvas_id     VARCHAR(64)   NULL,
        delivery_submitted_at  DATETIME      NULL,
        delivery_reject_reason VARCHAR(500)  NULL,
        settle_quote_amount    DECIMAL(14,2) NULL,
        settle_cost_amount     DECIMAL(14,2) NULL,
        settle_platform_fee    DECIMAL(14,2) NULL,
        settle_creator_payout  DECIMAL(14,2) NULL,
        settle_profit          DECIMAL(14,2) NULL,
        settled_at             DATETIME      NULL,
        created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_created (status, created_at),
        INDEX idx_client (client_id, created_at),
        INDEX idx_creator (creator_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接单中心工单'`,

    // 一个创作者对同一个工单只保留最新一份报价，靠唯一键 + upsert 实现
    `CREATE TABLE IF NOT EXISTS job_quotes (
        id          VARCHAR(32)   NOT NULL PRIMARY KEY,
        job_id      VARCHAR(32)   NOT NULL,
        creator_id  VARCHAR(64)   NOT NULL,
        amount      DECIMAL(14,2) NOT NULL,
        note        VARCHAR(500)  NOT NULL DEFAULT '',
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_job_creator (job_id, creator_id),
        INDEX idx_job (job_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单报价'`,
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
