/**
 * 身份识别。本服务不自建账号，也不自己验 JWT 的签名（MaaS 的签名密钥不在我们手上）——
 * 而是把前端带来的 token 原样拿去问 MaaS「这是谁」，认它返回的 userId。
 *
 * 这样做的好处是订单和钱包天然和现有登录体系对齐，不用同步用户表；代价是每次校验多一跳
 * 网络。前端轮询订单是 2 秒一次，所以这里必须有缓存，否则一个人开着付款页就能把 MaaS
 * 打出限流。
 */
import crypto from "node:crypto";

import { settings } from "./config.js";

export class Unauthorized extends Error {}

type CachedUser = { userId: string; username: string; expiresAt: number };

const cache = new Map<string, CachedUser>();

/**
 * PKCS#1 v1.5 去填充：00 02 <非零填充> 00 <明文>。
 *
 * 得自己写是因为 Node 20 起 `privateDecrypt` 不再接受 RSA_PKCS1_PADDING
 * （CVE-2023-46809，Marvin 计时攻击），而前端用的 JSEncrypt 正是这个填充。
 * 所以走 RSA_NO_PADDING 做裸解密，再自己把填充剥掉。
 */
function unpadPkcs1(block: Buffer): Buffer {
    let i = block[0] === 0x00 ? 1 : 0;
    if (block[i] !== 0x02) throw new Error("响应解密失败：填充类型不对");
    i += 1;
    while (i < block.length && block[i] !== 0x00) i += 1;
    if (i >= block.length) throw new Error("响应解密失败：找不到分隔符");
    return block.subarray(i + 1);
}

/**
 * 直接按 DER 导入，不去拼 PEM。
 *
 * 拼 PEM 要自己按 64 字符折行，而 base64 长度正好是 64 的倍数时会多折出一个空行，
 * OpenSSL 直接报 `DECODER routines::unsupported` —— 报错和密钥内容毫无关系，很难查。
 * base64 解出来就是 DER，交给 Node 自己认最稳；PKCS#8 和 PKCS#1 各试一次。
 */
function importPrivateKey(base64: string): crypto.KeyObject {
    const der = Buffer.from(base64, "base64");
    for (const type of ["pkcs8", "pkcs1"] as const) {
        try {
            return crypto.createPrivateKey({ key: der, format: "der", type });
        } catch {
            // 换一种结构再试
        }
    }
    throw new Error("AUTH_RSA_PRIVATE_KEY 解析失败：应为 PEM 正文的 base64（不带 BEGIN/END 行）");
}

/** 与前端 lib/auth-crypto.ts 的 decryptResponseBody 对应：RSA 解出 AES 密钥，再 AES-ECB 解正文 */
function decryptResponseBody(body: string, encryptKeyHeader: string): unknown {
    const raw = crypto.privateDecrypt(
        { key: importPrivateKey(settings.authRsaPrivateKey), padding: crypto.constants.RSA_NO_PADDING },
        Buffer.from(encryptKeyHeader, "base64"),
    );
    const aesKey = Buffer.from(unpadPkcs1(raw).toString("utf8"), "base64");
    const decipher = crypto.createDecipheriv(aesKey.length === 32 ? "aes-256-ecb" : "aes-128-ecb", aesKey, null);
    const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    return JSON.parse(plain);
}

type UserInfoResponse = {
    code?: number | string;
    msg?: string;
    data?: { user?: { userId?: string | number; userName?: string; nickName?: string } };
    user?: { userId?: string | number; userName?: string; nickName?: string };
};

async function fetchUser(token: string): Promise<{ userId: string; username: string }> {
    const response = await fetch(`${settings.authApiBase}/system/user/getInfo`, {
        headers: { Authorization: `Bearer ${token}`, Clientid: settings.authClientId },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Unauthorized("登录已失效，请重新登录");

    const text = await response.text();
    const encryptKey = response.headers.get("encrypt-key");
    let payload: UserInfoResponse;
    if (encryptKey) {
        payload = decryptResponseBody(text, encryptKey) as UserInfoResponse;
    } else {
        payload = JSON.parse(text) as UserInfoResponse;
    }

    const code = payload.code;
    if (code !== undefined && code !== 200 && code !== "200") throw new Unauthorized(payload.msg || "登录已失效，请重新登录");

    const profile = payload.data?.user || payload.user;
    const userId = String(profile?.userId ?? "").trim();
    if (!userId) throw new Unauthorized("登录已失效，请重新登录");
    return { userId, username: String(profile?.userName || "").trim() || userId };
}

/** 从 Authorization 头解析出当前用户。校验不过一律抛 Unauthorized。 */
export async function resolveUser(authorization: string | undefined): Promise<{ userId: string; username: string }> {
    const token = (authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Unauthorized("请先登录");

    const now = Date.now();
    const hit = cache.get(token);
    if (hit && hit.expiresAt > now) return { userId: hit.userId, username: hit.username };

    const user = await fetchUser(token);
    cache.set(token, { ...user, expiresAt: now + settings.authCacheSec * 1000 });
    // 缓存只增不减会慢慢涨。用户数不多时无所谓，但没有上界的缓存迟早出事，
    // 超过一定条数就把过期的清掉，还不够就整个丢弃重来。
    if (cache.size > 1000) {
        for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
        if (cache.size > 1000) cache.clear();
    }
    return user;
}
