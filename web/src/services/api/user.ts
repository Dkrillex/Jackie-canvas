import axios from "axios";

import { AUTH_TOKEN_KEY, AUTH_USER_ID_KEY, getSessionHeaders } from "@/constant/auth";
import { AUTH_API_BASE } from "@/constant/env";
import { PAY_API_BASE } from "@/jc/config";
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

type NewApiResponse<T = unknown> = {
    success?: boolean;
    message?: string;
    data?: T;
};

type LoginUserData = {
    id?: string | number;
    username?: string;
    display_name?: string;
    role?: number;
    status?: number;
    group?: string;
    require_2fa?: boolean;
};

type SelfUserData = {
    id?: string | number;
    username?: string;
    display_name?: string;
    role?: number;
    quota?: number;
    used_quota?: number;
};

type TokenRow = {
    id?: number;
    key?: string;
    status?: number;
    group?: string;
    expired_time?: number;
};

const NEW_API_QUOTA_PER_UNIT = 500_000;

export class TwoFactorRequiredError extends Error {
    constructor() {
        super("需要两步验证");
        this.name = "TwoFactorRequiredError";
    }
}

const authClient = axios.create({
    baseURL: AUTH_API_BASE,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

authClient.interceptors.request.use((config) => {
    const headers = getSessionHeaders();
    config.headers = config.headers || {};
    for (const [key, value] of Object.entries(headers)) {
        config.headers[key] = value;
    }
    return config;
});

export async function loginWithPassword(username: string, password: string): Promise<LocalUser> {
    clearAuthSession();
    const data = await request(
        authClient.post<NewApiResponse<LoginUserData>>("/api/user/login", {
            username: username.trim(),
            password,
        }),
        "登录失败",
    );
    if (data?.require_2fa) throw new TwoFactorRequiredError();
    return completeSession(data);
}

export async function loginWithTwoFactor(code: string): Promise<LocalUser> {
    const data = await request(authClient.post<NewApiResponse<LoginUserData>>("/api/user/login/2fa", { code: code.trim() }), "两步验证失败");
    return completeSession(data);
}

export async function registerWithPassword(username: string, password: string): Promise<void> {
    clearAuthSession();
    const response = await fetch(`${PAY_API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = (await response.json().catch(() => null)) as NewApiResponse | null;
    if (!response.ok || data?.success === false) throw new Error(data?.message || "注册失败");
}

export async function fetchCurrentUser(): Promise<LocalUser> {
    if (!getAuthToken() || !getAuthUserId()) throw new Error("未登录或会话已失效");
    const profile = await request(authClient.get<NewApiResponse<SelfUserData>>("/api/user/self"), "未登录或会话已失效");
    const username = (profile.username || "").trim() || "用户";
    const userId = String(profile.id ?? "").trim();
    if (!userId) throw new Error("未登录或会话已失效");
    if (typeof window !== "undefined") window.localStorage.setItem(AUTH_USER_ID_KEY, userId);
    return {
        id: userId,
        username,
        displayName: (profile.display_name || username).trim() || username,
        avatarUrl: "",
        quota: Number(profile.quota) || 0,
        usedQuota: Number(profile.used_quota) || 0,
        role: Number(profile.role) || 0,
    };
}

/** 凭登录态拉取当前账号启用中的第一把 group=auto 密钥 */
export async function fetchAutoUserApiKey(): Promise<string | null> {
    const list = await request(
        authClient.get<NewApiResponse<{ items?: TokenRow[] }>>("/api/token/", {
            params: { p: 1, page_size: 100 },
        }),
        "获取密钥失败",
    );
    const rows = Array.isArray(list?.items) ? list.items : [];
    const token = rows.find((item) => Number(item.status) === 1 && isAutoGroup(item) && item.id != null && !isExpired(item));
    if (!token?.id) return null;
    const revealed = await request(authClient.post<NewApiResponse<{ key?: string }>>(`/api/token/${token.id}/key`, {}), "获取密钥失败");
    const key = String(revealed?.key || "").trim();
    if (!key) return null;
    return key.startsWith("sk-") ? key : `sk-${key}`;
}

export async function logoutRemote(): Promise<void> {
    await authClient.get<NewApiResponse>("/api/user/logout").catch(() => undefined);
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

async function completeSession(data: LoginUserData | undefined): Promise<LocalUser> {
    const userId = String(data?.id ?? "").trim();
    if (!userId) throw new Error("登录失败：未返回用户信息");
    if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.setItem(AUTH_USER_ID_KEY, userId);
    }
    const accessToken = await request(authClient.get<NewApiResponse<string>>("/api/user/token"), "登录失败：未返回 access_token");
    const token = String(accessToken || "").trim();
    if (!token) throw new Error("登录失败：未返回 access_token");
    setAuthToken(token);
    return fetchCurrentUser();
}

async function request<T>(pending: Promise<{ data: NewApiResponse<T> }>, fallback: string): Promise<T> {
    try {
        return unwrapNewApi(await pending, fallback);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as NewApiResponse | undefined;
            throw new Error(data?.message || fallback);
        }
        throw error;
    }
}

function unwrapNewApi<T>(response: { data: NewApiResponse<T> }, fallback: string): T {
    const res = response.data;
    if (res?.success === false) throw new Error(res.message || fallback);
    if (res?.success === true) return res.data as T;
    if (res?.data !== undefined) return res.data;
    throw new Error(res?.message || fallback);
}

function isAutoGroup(item: TokenRow) {
    return String(item.group || "")
        .trim()
        .toLowerCase() === "auto";
}

function isExpired(item: TokenRow) {
    const expired = Number(item.expired_time);
    return Number.isFinite(expired) && expired > 0 && expired * 1000 < Date.now();
}

function getAuthToken() {
    return typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_KEY) || "" : "";
}

function getAuthUserId() {
    return typeof window !== "undefined" ? window.localStorage.getItem(AUTH_USER_ID_KEY) || "" : "";
}

function setAuthToken(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
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
