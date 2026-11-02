import { randomInt } from "node:crypto";

import { hashSync } from "bcryptjs";
import mysql from "mysql2/promise";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import { novaApiMysqlConfigured, settings } from "./config.js";

const KEY_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const HINNFLOW_REMARK = "Hinnflow";
const DEFAULT_SIDEBAR_SETTING =
    '{"gotify_priority":0,"sidebar_modules":"{\\"chat\\":{\\"enabled\\":true,\\"playground\\":true,\\"chat\\":true},\\"console\\":{\\"enabled\\":true,\\"detail\\":true,\\"token\\":true,\\"log\\":true,\\"midjourney\\":true,\\"task\\":true},\\"personal\\":{\\"enabled\\":true,\\"topup\\":true,\\"personal\\":true}}"}';

export class RegisterError extends Error {
    constructor(
        message: string,
        readonly status = 400,
    ) {
        super(message);
    }
}

export class NovaApiDatabaseNotConfigured extends Error {
    constructor() {
        super("注册库没配置：需要 NOVA_API_MYSQL_HOST / NOVA_API_MYSQL_USER / NOVA_API_MYSQL_PASSWORD / NOVA_API_MYSQL_DATABASE");
    }
}

let pool: Pool | null = null;
let ready: Promise<Pool> | null = null;

async function init(): Promise<Pool> {
    if (!novaApiMysqlConfigured()) throw new NovaApiDatabaseNotConfigured();
    return mysql.createPool({
        host: settings.novaApiMysqlHost,
        port: settings.novaApiMysqlPort,
        user: settings.novaApiMysqlUser,
        password: settings.novaApiMysqlPassword,
        database: settings.novaApiMysqlDatabase,
        charset: "utf8mb4",
        waitForConnections: true,
        connectionLimit: 4,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: true,
    });
}

function getNovaApiPool(): Promise<Pool> {
    if (pool) return Promise.resolve(pool);
    if (!ready) {
        ready = init()
            .then((created) => {
                pool = created;
                return created;
            })
            .catch((error) => {
                ready = null;
                throw error;
            });
    }
    return ready;
}

function randomChars(length: number) {
    let out = "";
    for (let i = 0; i < length; i++) out += KEY_CHARS[randomInt(KEY_CHARS.length)];
    return out;
}

function validate(username: string, password: string) {
    if (!username) throw new RegisterError("用户名不能为空");
    if (username.length > 20) throw new RegisterError("用户名最多 20 个字符");
    if (password.length < 8 || password.length > 20) throw new RegisterError("密码长度须为 8–20 个字符");
}

async function quotaForNewUser(conn: PoolConnection) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT `value` FROM options WHERE `key` = 'QuotaForNewUser' LIMIT 1");
    const n = Number(rows[0]?.value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function registerNovaApiUser(rawUsername: string, password: string) {
    const username = rawUsername.trim();
    validate(username, password);
    const conn = await (await getNovaApiPool()).getConnection();
    try {
        await conn.beginTransaction();
        const [exist] = await conn.query<RowDataPacket[]>("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
        if (exist.length) throw new RegisterError("用户已存在");

        const now = Math.floor(Date.now() / 1000);
        const quota = await quotaForNewUser(conn);
        const hashed = hashSync(password, 10);
        let affCode = randomChars(4);
        for (let attempt = 0; attempt < 8; attempt++) {
            try {
                await conn.query(
                    `INSERT INTO users (username, password, display_name, role, status, \`quota\`, \`group\`, aff_code, inviter_id, setting, remark, created_at)
                     VALUES (?, ?, ?, 1, 1, ?, 'default', ?, 0, ?, ?, ?)`,
                    [username, hashed, username, quota, affCode, DEFAULT_SIDEBAR_SETTING, HINNFLOW_REMARK, now],
                );
                break;
            } catch (error) {
                if (!isDup(error)) throw error;
                if (dupOn(error, "username")) throw new RegisterError("用户已存在");
                affCode = randomChars(4);
                if (attempt === 7) throw new RegisterError("注册失败，请重试");
            }
        }

        const [created] = await conn.query<RowDataPacket[]>("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
        const userId = String(created[0]?.id || "").trim();
        if (!userId) throw new RegisterError("注册失败：未写入用户");

        let tokenKey = randomChars(48);
        for (let attempt = 0; attempt < 8; attempt++) {
            try {
                await conn.query(
                    `INSERT INTO tokens (user_id, \`key\`, status, name, created_time, accessed_time, expired_time, remain_quota, unlimited_quota, model_limits_enabled, \`group\`)
                     VALUES (?, ?, 1, ?, ?, ?, -1, 500000, 1, 0, 'auto')`,
                    [userId, tokenKey, `${username}的初始令牌`, now, now],
                );
                break;
            } catch (error) {
                if (!isDup(error)) throw error;
                tokenKey = randomChars(48);
                if (attempt === 7) throw new RegisterError("注册失败：无法创建密钥");
            }
        }

        await conn.commit();
        return { userId, username };
    } catch (error) {
        await conn.rollback().catch(() => undefined);
        throw error;
    } finally {
        conn.release();
    }
}

function isDup(error: unknown) {
    return Boolean(error && typeof error === "object" && "errno" in error && (error as { errno: number }).errno === 1062);
}

function dupOn(error: unknown, field: string) {
    const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "";
    return msg.toLowerCase().includes(field);
}
