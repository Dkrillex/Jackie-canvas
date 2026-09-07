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

    // ref_no 是「这条流水属于哪一次动作」的键，配合 UNIQUE(kind, ref_no) 兜重复写入：
    //   充值   → out_trade_no      兑换/退回 → exchange id
    //   结算   → job id（一个单只结算一次）
    //   冻结/解冻/押金/罚没 → job_deposits.id，也就是「这一次接单」的 id
    // 最后一类不能用 job id：单子超时会回到市场被别人再接，同一个 job 会有多次冻结和押金，
    // 用 job id 当键第二次就撞唯一约束了。job_id 另开一列，方便按单查全部资金流水。
    `CREATE TABLE IF NOT EXISTS wallet_ledger (
        id            BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id       VARCHAR(64)   NOT NULL,
        kind          VARCHAR(16)   NOT NULL         COMMENT 'recharge/freeze/unfreeze/charge/payout/deposit/deposit_back/forfeit/compensate/exchange/refund/adjust',
        amount        DECIMAL(14,2) NOT NULL         COMMENT '正负即方向；freeze/unfreeze/deposit 记的是冻结变动量',
        balance_after DECIMAL(14,2) NOT NULL,
        frozen_after  DECIMAL(14,2) NOT NULL DEFAULT 0,
        ref_no        VARCHAR(64)   NULL             COMMENT '见上方说明',
        job_id        VARCHAR(32)   NULL             COMMENT '工单相关流水的所属工单',
        note          VARCHAR(255)  NOT NULL DEFAULT '',
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_kind_ref (kind, ref_no),
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_job (job_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分流水'`,

    // 工单。交付和结算都是一对一的，拆表只会让每次读都要多 join 一次，直接铺平成列。
    //
    // 两个有效期是分开的，因为到期后的处置完全相反：
    //   work_deadline_at  接单工时有效期 —— 超时罚没接单人押金、单子退回市场重新接，
    //                     雇主的钱**继续冻结**（单子还在流转，下一个人接了要继续用）
    //   job_deadline_at   任务单整体有效期 —— 超时整单作废、退出市场，
    //                     雇主的冻结款**解冻返还**，当前接单人押金原样退回（他没违规）
    // frozen_amount 记的是这个单当前替雇主冻着多少：换一个接单人时报价可能不同，
    // 要按差额补冻或退冻，没有这一列就只能靠猜。
    `CREATE TABLE IF NOT EXISTS jobs (
        id                     VARCHAR(32)   NOT NULL PRIMARY KEY,
        title                  VARCHAR(255)  NOT NULL,
        brief                  MEDIUMTEXT    NOT NULL COMMENT 'Markdown 正文，可能内嵌图片引用',
        budget                 DECIMAL(14,2) NOT NULL,
        status                 VARCHAR(16)   NOT NULL COMMENT 'open/quoted/active/submitted/completed/cancelled/expired',
        client_id              VARCHAR(64)   NOT NULL COMMENT '发单人 MaaS userId',
        creator_id             VARCHAR(64)   NULL     COMMENT '接单人，接受报价时写入',
        accepted_quote_id      VARCHAR(32)   NULL,
        deposit_id             VARCHAR(32)   NULL     COMMENT '当前这次接单的押金记录 id',
        frozen_amount          DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '当前替雇主冻结的金额',
        work_days              INT           NOT NULL DEFAULT 3 COMMENT '接受报价后允许的交付天数',
        work_deadline_at       DATETIME      NULL     COMMENT '接受报价时算出 = NOW() + work_days',
        job_deadline_at        DATETIME      NOT NULL COMMENT '发单时算出 = NOW() + job_days',
        review_deadline_at     DATETIME      NULL     COMMENT '提交交付时算出；到期未验收则自动验收打款',
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
        expire_reason          VARCHAR(255)  NULL,
        created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_created (status, created_at),
        INDEX idx_client (client_id, created_at),
        INDEX idx_creator (creator_id, created_at),
        INDEX idx_work_deadline (status, work_deadline_at),
        INDEX idx_job_deadline (status, job_deadline_at),
        INDEX idx_review_deadline (status, review_deadline_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接单中心工单'`,

    // 积分 → API 额度的兑换。这是一张**中间表**：点「确认转换」时先把积分扣掉并落一条
    // pending，等真正调 `/gw` 发放额度成功后再置 done；发放失败则置 failed 并把积分退回。
    // 分两步是因为扣积分（我们的库）和发额度（对方的服务）不可能在一个事务里，
    // 中间总有一刻会不一致 —— 这张表就是记录「这笔到底走到哪一步了」的地方。
    `CREATE TABLE IF NOT EXISTS credit_exchanges (
        id          VARCHAR(32)   NOT NULL PRIMARY KEY,
        user_id     VARCHAR(64)   NOT NULL,
        credits     DECIMAL(14,2) NOT NULL         COMMENT '消耗的积分，1 积分 = 1 美元',
        status      VARCHAR(16)   NOT NULL         COMMENT 'pending/done/failed',
        gw_ref      VARCHAR(128)  NULL             COMMENT '网关侧回执，接入 /gw 后写入',
        note        VARCHAR(255)  NOT NULL DEFAULT '',
        created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        settled_at  DATETIME      NULL,
        updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分兑换 API 额度'`,

    // 接单押金。按「哪个单 × 哪次接单」记，不是按单记 —— 单子超时会回到市场被别人再接，
    // 同一个 job 会产生多笔押金，各自独立结算。
    `CREATE TABLE IF NOT EXISTS job_deposits (
        id           VARCHAR(32)   NOT NULL PRIMARY KEY,
        job_id       VARCHAR(32)   NOT NULL,
        creator_id   VARCHAR(64)   NOT NULL,
        amount       DECIMAL(14,2) NOT NULL,
        status       VARCHAR(16)   NOT NULL         COMMENT 'held/refunded/forfeited',
        to_client    DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '罚没时赔给雇主的部分',
        to_platform  DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '罚没时归平台的部分',
        note         VARCHAR(255)  NOT NULL DEFAULT '',
        created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        settled_at   DATETIME      NULL,
        INDEX idx_job (job_id),
        INDEX idx_creator (creator_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接单押金'`,

    // 平台自己的账。在此之前，10% 抽成只写在 jobs.settle_platform_fee 那一列里 ——
    // 每单算得出来，但没有任何地方汇总，平台到底赚了多少无从对账。罚没的押金同理。
    `CREATE TABLE IF NOT EXISTS platform_ledger (
        id         BIGINT        AUTO_INCREMENT PRIMARY KEY,
        kind       VARCHAR(16)   NOT NULL         COMMENT 'fee=工单抽成 / forfeit=罚没押金',
        amount     DECIMAL(14,2) NOT NULL,
        ref_no     VARCHAR(64)   NULL             COMMENT 'fee 用 job id，forfeit 用押金 id',
        job_id     VARCHAR(32)   NULL,
        note       VARCHAR(255)  NOT NULL DEFAULT '',
        created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_kind_ref (kind, ref_no),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台收入流水'`,

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
