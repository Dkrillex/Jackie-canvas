/**
 * 身份识别。本服务不自建账号，也不自己验 New API access_token 的签名——
 * 而是把前端带来的 token 原样拿去问 nova-api「这是谁」，认它返回的 user id。
 *
 * 这样做的好处是订单和钱包天然和现有登录体系对齐，不用同步用户表；代价是每次校验多一跳
 * 网络。前端轮询订单是 2 秒一次，所以这里必须有缓存，否则一个人开着付款页就能把上游
 * 打出限流。
 */

import { settings } from "./config.js";

export class Unauthorized extends Error {}

type CachedUser = { userId: string; username: string; expiresAt: number };

const cache = new Map<string, CachedUser>();

type SelfResponse = {
    success?: boolean;
    message?: string;
    data?: { id?: string | number; username?: string; display_name?: string };
};

async function fetchUser(token: string, userId: string): Promise<{ userId: string; username: string }> {
    const response = await fetch(`${settings.authApiBase}/api/user/self`, {
        headers: { Authorization: `Bearer ${token}`, "New-Api-User": userId },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Unauthorized("登录已失效，请重新登录");

    const payload = (await response.json()) as SelfResponse;
    if (payload.success === false) throw new Unauthorized(payload.message || "登录已失效，请重新登录");

    const id = String(payload.data?.id ?? "").trim();
    if (!id || id !== userId) throw new Unauthorized("登录已失效，请重新登录");
    return { userId: id, username: String(payload.data?.username || "").trim() || id };
}

/** 从 Authorization + New-Api-User 解析出当前用户。校验不过一律抛 Unauthorized。 */
export async function resolveUser(authorization: string | undefined, newApiUser?: string): Promise<{ userId: string; username: string }> {
    const token = (authorization || "").replace(/^Bearer\s+/i, "").trim();
    const userId = (newApiUser || "").trim();
    if (!token || !userId) throw new Unauthorized("请先登录");

    const now = Date.now();
    const cacheKey = `${token}:${userId}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now) return { userId: hit.userId, username: hit.username };

    const user = await fetchUser(token, userId);
    cache.set(cacheKey, { ...user, expiresAt: now + settings.authCacheSec * 1000 });
    if (cache.size > 1000) {
        for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
        if (cache.size > 1000) cache.clear();
    }
    return user;
}

export function resolveUserFrom(c: { req: { header: (name: string) => string | undefined } }) {
    return resolveUser(c.req.header("Authorization"), c.req.header("New-Api-User"));
}
