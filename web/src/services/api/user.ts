import axios from "axios";

import type { AiConfig } from "@/stores/use-config-store";

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

const NEW_API_QUOTA_PER_UNIT = 500_000;

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

function buildHostApiUrl(baseUrl: string, path: string) {
    const normalized = baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
    return `${normalized}${path.startsWith("/") ? path : `/${path}`}`;
}
