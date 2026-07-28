import axios, { type AxiosResponse } from "axios";

import { AUTH_CLIENT_ID, AUTH_GRANT_TYPE, AUTH_TENANT_ID, AUTH_TOKEN_KEY, AUTH_USER_ID_KEY } from "@/constant/auth";
import { AUTH_API_BASE } from "@/constant/env";
import { decryptResponseBody, encryptRequestBody } from "@/lib/auth-crypto";
import type { AiConfig } from "@/stores/use-config-store";
import type { LocalUser } from "@/stores/use-user-store";

export type UserCenterInfo = {
    username: string;
    tokenName: string;
    totalAvailable: number;
    totalGranted: number;
    totalUsed: number;
    unlimitedQuota: boolean;
};

type TokenUsageResponse = {
    code?: boolean;
    message?: string;
    data?: {
        name?: string;
        total_available?: number;
        total_granted?: number;
        total_used?: number;
        unlimited_quota?: boolean;
    };
};

type TokenLogResponse = {
    success?: boolean;
    data?: Array<{ username?: string; token_name?: string }>;
};

type RuoyiResponse<T = unknown> = {
    code?: number | string;
    msg?: string;
    data?: T;
    access_token?: string;
    client_id?: string;
    expire_in?: number;
};

type LoginData = {
    access_token?: string;
    client_id?: string;
    expire_in?: number;
};

type UserInfoData = {
    permissions?: string[];
    roles?: string[];
    user?: {
        userId?: number | string;
        userName?: string;
        nickName?: string;
        avatar?: string;
        apiId?: number | string;
    };
};

type UserQuotaData = {
    quota?: number;
    quotaDollar?: string | number;
    usedQuota?: number;
};

type LlmTokenRow = {
    key?: string;
    status?: number;
    deletedAt?: string | null;
    userGroup?: string;
    group?: string;
};

type LlmTokenListRaw = RuoyiResponse<LlmTokenRow[] | { rows?: LlmTokenRow[]; total?: number }> & {
    rows?: LlmTokenRow[];
    total?: number;
};

const NEW_API_QUOTA_PER_UNIT = 500_000;

const authClient = axios.create({
    baseURL: AUTH_API_BASE,
    headers: {
        "Content-Type": "application/json;charset=utf-8",
        Clientid: AUTH_CLIENT_ID,
    },
});

authClient.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_KEY) : "";
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export async function loginWithPassword(username: string, password: string): Promise<LocalUser> {
    const payload = {
        username: username.trim(),
        password,
        clientId: AUTH_CLIENT_ID,
        grantType: AUTH_GRANT_TYPE,
        tenantId: AUTH_TENANT_ID,
    };
    const { body, encryptKey } = encryptRequestBody(payload);
    const response = await authClient.post<RuoyiResponse<LoginData>>("/auth/login", body, {
        headers: { "encrypt-key": encryptKey },
        transformRequest: [(data) => data],
    });
    const login = unwrapRuoyi(await maybeDecrypt(response), "登录失败") as LoginData;
    const token = login.access_token;
    if (!token) throw new Error("登录失败：未返回 access_token");
    setAuthToken(token);
    return fetchCurrentUser();
}

export async function fetchCurrentUser(): Promise<LocalUser> {
    const token = getAuthToken();
    if (!token) throw new Error("未登录或会话已失效");

    const response = await authClient.get<RuoyiResponse<UserInfoData>>("/system/user/getInfo");
    const raw = await maybeDecrypt(response);
    const info = unwrapRuoyi(raw, "未登录或会话已失效") as UserInfoData & { user?: UserInfoData["user"] };
    // 兼容 data.user / 顶层 user
    const profile = info.user || (raw as UserInfoData).user;
    if (!profile) throw new Error("未登录或会话已失效");

    const username = (profile.userName || "").trim() || "用户";
    const userId = String(profile.userId ?? username);
    // 余额接口仍可能需要 Nebula apiId；仅临时使用，不写入 LocalUser
    const quotaUserId = String(profile.apiId ?? profile.userId ?? "").trim();
    if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTH_USER_ID_KEY, userId);
    }

    const quota = quotaUserId ? await fetchUserQuota(quotaUserId).catch(() => ({ quota: 0, usedQuota: 0 })) : { quota: 0, usedQuota: 0 };
    return {
        id: userId,
        username,
        displayName: (profile.nickName || username).trim() || username,
        avatarUrl: (profile.avatar || "").trim(),
        quota: quota.quota,
        usedQuota: quota.usedQuota,
    };
}

/** 凭登录 JWT 拉取当前账号启用中的第一把 group=auto 密钥（不传 userId） */
export async function fetchAutoUserApiKey(): Promise<string | null> {
    const response = await authClient.get<LlmTokenListRaw>("/llm/tokens/list", {
        params: { pageNum: 1, pageSize: 100 },
    });
    const raw = await maybeDecrypt(response);
    const code = (raw as RuoyiResponse)?.code;
    if (code !== undefined && code !== 200 && code !== "200") {
        throw new Error((raw as RuoyiResponse).msg || "获取密钥失败");
    }
    const rows = parseTokenRows(raw);
    const token = rows.find((item) => !item?.deletedAt && Number(item.status) === 1 && isAutoGroup(item) && String(item.key || "").trim());
    const key = String(token?.key || "").trim();
    if (!key) return null;
    return key.startsWith("sk-") ? key : `sk-${key}`;
}

export async function logoutRemote(): Promise<void> {
    await authClient.post<RuoyiResponse>("/auth/logout", {}).catch(() => undefined);
    clearAuthSession();
}

export async function fetchUserCenterInfo(config: Pick<AiConfig, "baseUrl" | "apiKey">): Promise<UserCenterInfo> {
    if (!config.baseUrl.trim()) throw new Error("请先配置 Base URL");
    if (!config.apiKey.trim()) throw new Error("请先配置 API Key");

    const headers = { Authorization: `Bearer ${config.apiKey}` };
    const [usageResponse, logResponse] = await Promise.all([
        axios.get<TokenUsageResponse>(buildHostApiUrl(config.baseUrl, "/api/usage/token/"), { headers }),
        axios.get<TokenLogResponse>(buildHostApiUrl(config.baseUrl, "/api/log/token"), { headers, params: { p: 0, page_size: 1 } }).catch(() => null),
    ]);

    const usage = usageResponse.data;
    if (!usage?.data || usage.code === false) throw new Error(usage?.message || "获取用户信息失败");

    const username = logResponse?.data?.data?.[0]?.username?.trim() || "";
    return {
        username: username || usage.data.name || "未知用户",
        tokenName: usage.data.name || "",
        totalAvailable: Number(usage.data.total_available) || 0,
        totalGranted: Number(usage.data.total_granted) || 0,
        totalUsed: Number(usage.data.total_used) || 0,
        unlimitedQuota: Boolean(usage.data.unlimited_quota),
    };
}

export function formatQuotaCredits(quota: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(quota)));
}

export function formatQuotaCurrency(quota: number) {
    return `$${(Math.max(0, quota) / NEW_API_QUOTA_PER_UNIT).toFixed(2)}`;
}

async function fetchUserQuota(apiId: string): Promise<{ quota: number; usedQuota: number }> {
    const response = await authClient.get<RuoyiResponse<UserQuotaData>>(`/api/users/${apiId}`);
    const data = unwrapRuoyi(await maybeDecrypt(response), "获取余额失败");
    const dollar = Number(data.quotaDollar ?? data.quota);
    const used = Number(data.usedQuota);
    // 小数视为美元余额，整数大额视为 New API quota 单位
    if (Number.isFinite(dollar) && Math.abs(dollar) < 1_000_000) {
        return {
            quota: Math.round(dollar * NEW_API_QUOTA_PER_UNIT),
            usedQuota: Number.isFinite(used) && Math.abs(used) < 1_000_000 ? Math.round(used * NEW_API_QUOTA_PER_UNIT) : 0,
        };
    }
    return {
        quota: Number.isFinite(dollar) ? Math.round(dollar) : 0,
        usedQuota: Number.isFinite(used) ? Math.round(used) : 0,
    };
}

function parseTokenRows(raw: LlmTokenListRaw | unknown): LlmTokenRow[] {
    const res = raw as LlmTokenListRaw;
    if (Array.isArray(res?.rows)) return res.rows;
    const data = res?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray((data as { rows?: LlmTokenRow[] }).rows)) {
        return (data as { rows: LlmTokenRow[] }).rows;
    }
    return [];
}

function isAutoGroup(item: LlmTokenRow) {
    const group = String(item.userGroup || item.group || "")
        .trim()
        .toLowerCase();
    return group === "auto";
}

function unwrapRuoyi<T>(raw: RuoyiResponse<T> | T, fallback: string): T & RuoyiResponse {
    const res = raw as RuoyiResponse<T>;
    const code = res?.code;
    if (code !== undefined && code !== 200 && code !== "200") {
        throw new Error(res.msg || fallback);
    }
    if (res?.data !== undefined) return res.data as T & RuoyiResponse;
    return raw as T & RuoyiResponse;
}

async function maybeDecrypt<T>(response: AxiosResponse<RuoyiResponse<T>>): Promise<RuoyiResponse<T>> {
    const headers = response.headers as { get?: (name: string) => string | undefined; [key: string]: unknown };
    const encryptKey = headers.get?.("encrypt-key") || (headers["encrypt-key"] as string | undefined) || (headers["Encrypt-Key"] as string | undefined);
    if (!encryptKey || typeof response.data !== "string") return response.data;
    try {
        return decryptResponseBody(response.data, encryptKey) as RuoyiResponse<T>;
    } catch {
        return response.data;
    }
}

function getAuthToken() {
    return typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_KEY) || "" : "";
}

function setAuthToken(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    window.localStorage.removeItem(AUTH_USER_ID_KEY);
}

function clearAuthSession() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_ID_KEY);
}

function buildHostApiUrl(baseUrl: string, path: string) {
    const normalized = baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
    return `${normalized}${path.startsWith("/") ? path : `/${path}`}`;
}
