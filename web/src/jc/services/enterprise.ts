/**
 * 企业管理。接口是 MaaS 平台的**客户侧**企业接口（`/system/enterprise/client/...`），
 * 走的是登录用的同源 `/prod-api`，凭同一把 JWT —— 不需要新前缀，也没有后台权限位。
 *
 * 权限由服务端判：`client/mine/users` 对管理员返回全部成员、对普通成员只返回自己；
 * 分配额度 / 增删改成员都要求 `userType === 1`。前端的按钮显隐只是界面。
 */
import axios from "axios";

import { AUTH_CLIENT_ID, AUTH_TOKEN_KEY } from "@/constant/auth";
import { AUTH_API_BASE } from "@/constant/env";

/** 1-企业管理员 2-企业用户 */
export const ENTERPRISE_ADMIN = 1;

export type MyEnterprise = {
    /** 雪花 ID，且服务端这个字段**没有**序列化成字符串，JSON 里是数字（超出安全整数会丢精度）。
     *  当前所有接口都从登录态推企业，不需要把它回传，真要传之前先想清楚精度。 */
    id: number | string;
    enterpriseName: string;
    enterpriseTag?: string;
    userCount?: number;
    /** 最大成员数，0 或空表示不限 */
    maxUserCount?: number;
    status: number;
    createTime?: string;
    userType: number;
};

export type EnterpriseMember = {
    id: string;
    userId: string;
    userType: number;
    /** 成员在企业里的状态：**1=启用 0=禁用**（和下面编辑接口的约定相反，见 editMember） */
    status: number;
    userName: string;
    nickName: string;
    email?: string;
    phonenumber?: string;
    /** 服务端按 500000 quota = $1 折算好的美元数 */
    quotaUsd: number;
    usedQuotaUsd: number;
    group?: string;
    createTime?: string;
};

export type AddMemberInput = {
    userName: string;
    nickName: string;
    password: string;
    email?: string;
    phonenumber?: string;
    /** 初始余额（美元），从管理员自己的额度里扣，0 表示不分配 */
    initialBalanceUsd?: number;
};

export type EditMemberInput = {
    userName?: string;
    nickName?: string;
    /** 新密码，不填则不重置 */
    newPassword?: string;
    /** 启用 / 禁用。往接口发的时候会转成 sys_user 的约定 */
    enabled?: boolean;
};

/**
 * 上游 `services/api/user.ts` 里那个 authClient 没有导出，这里照它的样子再建一个：
 * 只有 `/auth/login` 需要 AES/RSA 加密，其余接口是普通 JSON + Bearer。
 */
const client = axios.create({
    baseURL: AUTH_API_BASE,
    headers: { "Content-Type": "application/json;charset=utf-8", Clientid: AUTH_CLIENT_ID },
});

client.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_KEY) : "";
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

type RuoyiResponse<T> = { code?: number; msg?: string; data?: T };

/** RuoYi 的失败是 200 + code!==200，不看 code 只看 HTTP 状态会把「不是管理员」当成功。 */
function unwrap<T>(payload: RuoyiResponse<T>, fallback: string): T {
    if (payload?.code !== undefined && Number(payload.code) !== 200) throw new Error(payload.msg || fallback);
    return payload?.data as T;
}

const BASE = "/system/enterprise/client";

/** 当前登录用户所属的企业；没加入任何企业时服务端返回空数据。 */
export async function getMyEnterprise(): Promise<MyEnterprise | null> {
    const { data } = await client.get<RuoyiResponse<MyEnterprise | null>>(`${BASE}/mine`);
    return unwrap(data, "获取企业信息失败") ?? null;
}

export async function listMembers(): Promise<EnterpriseMember[]> {
    const { data } = await client.get<RuoyiResponse<EnterpriseMember[]>>(`${BASE}/mine/users`);
    return unwrap(data, "获取成员列表失败") ?? [];
}

/** 从自己的额度里划一笔给成员。金额单位是美元，服务端最小 0.01。 */
export async function allocateQuota(targetUserId: string, amountUsd: number) {
    const { data } = await client.post<RuoyiResponse<void>>(`${BASE}/mine/quota/allocate`, { targetUserId, amountUsd });
    unwrap(data, "分配额度失败");
}

/** 新增成员：服务端建账号并绑到本企业，返回账号和初始密码（只在这一次响应里出现）。 */
export async function addMember(input: AddMemberInput): Promise<{ userName: string; password: string }> {
    const { data } = await client.post<RuoyiResponse<{ userName: string; password: string }>>(`${BASE}/maas/users/add`, input);
    return unwrap(data, "新增成员失败");
}

/**
 * 编辑成员。**状态的约定在这里是反的**：列表里 `status` 是企业成员表的 1=启用 / 0=禁用，
 * 而这个接口收的是 sys_user 的 0=正常 / 1=禁用（服务端 editMember 里三表同步时按后者解释）。
 * 转换只放在这一处，页面上一律用 `enabled` 这个布尔量。
 */
export async function editMember(userId: string, input: EditMemberInput) {
    const { enabled, ...rest } = input;
    const body: Record<string, unknown> = { ...rest };
    if (enabled !== undefined) body.status = enabled ? 0 : 1;
    const { data } = await client.put<RuoyiResponse<void>>(`${BASE}/mine/users/${encodeURIComponent(userId)}`, body);
    unwrap(data, "保存成员失败");
}

export async function deleteMember(userId: string) {
    const { data } = await client.delete<RuoyiResponse<void>>(`${BASE}/mine/users/${encodeURIComponent(userId)}`);
    unwrap(data, "删除成员失败");
}

/* ---------------------------------------------------------------------------
 * 消费看板与调用日志
 *
 * 看板三个接口都只对企业管理员开放，成员范围由服务端按登录态推（`userId` 只是再筛一个人）。
 * 时间参数是**秒级** Unix 时间戳，别把 Date.now() 直接丢进去。
 * ------------------------------------------------------------------------ */

/** 服务端的额度单位。展示一律换算成美元，和成员列表里的 quotaUsd 对齐。 */
const QUOTA_PER_USD = 500_000;

export const quotaToUsd = (quota: number) => (Number(quota) || 0) / QUOTA_PER_USD;

export type Granularity = "hour" | "day" | "week";

export type DashboardSummary = { calls: number; quota: number; tokens: number };

/** bucket 是服务端给的桶标签：hour → "yyyy-MM-dd HH:00"，day/week → "yyyy-MM-dd" */
export type DashboardBucket = { bucket: string; calls: number; quota: number; tokens: number };

export type DashboardModelBucket = DashboardBucket & { modelName: string };

export type DashboardQuery = {
    /** 只看某个成员；不传表示聚合企业全部成员 */
    userId?: string;
    startTimestamp: number;
    endTimestamp: number;
    granularity?: Granularity;
};

const SETTINGS = `${BASE}/mine/settings`;

export async function getDashboardSummary(query: DashboardQuery): Promise<DashboardSummary> {
    const { data } = await client.get<RuoyiResponse<DashboardSummary>>(`${SETTINGS}/dashboard-summary`, { params: query });
    return unwrap(data, "获取看板汇总失败") ?? { calls: 0, quota: 0, tokens: 0 };
}

export async function getDashboardTrend(query: DashboardQuery): Promise<DashboardBucket[]> {
    const { data } = await client.get<RuoyiResponse<DashboardBucket[]>>(`${SETTINGS}/dashboard-trend`, { params: query });
    return unwrap(data, "获取趋势失败") ?? [];
}

export async function getDashboardTrendByModel(query: DashboardQuery): Promise<DashboardModelBucket[]> {
    const { data } = await client.get<RuoyiResponse<DashboardModelBucket[]>>(`${SETTINGS}/dashboard-trend-by-model`, { params: query });
    return unwrap(data, "获取模型分布失败") ?? [];
}

/** 日志类型：0 未知 1 充值 2 消费 3 管理 4 系统 5 错误 6 退款 */
export type EnterpriseLog = {
    id?: number;
    userId?: number;
    /** 秒级 Unix 时间戳 */
    createdAt?: number;
    type?: number;
    username?: string;
    tokenName?: string;
    modelName?: string;
    content?: string;
    quota?: number;
    /** 服务端已折算好的美元 */
    quotaDollar?: number;
    promptTokens?: number;
    completionTokens?: number;
    /** 耗时（毫秒） */
    useTime?: number;
    isStream?: boolean;
    group?: string;
    ip?: string;
    requestId?: string;
    /** 服务端按语言拼好的计费过程说明 */
    billingProcessTextZh?: string;
    billingProcessTextEn?: string;
};

export type LogQuery = {
    pageNum: number;
    pageSize: number;
    /** 只看某个成员；普通成员传什么都会被服务端改写成自己 */
    userId?: string;
    modelName?: string;
    tokenName?: string;
    requestId?: string;
    type?: number;
    startTimestamp?: number;
    endTimestamp?: number;
};

/** 调用日志。注意它不在 /system/enterprise 下，是另一条 `/api/enterprise/logs`。 */
export async function listLogs(query: LogQuery): Promise<{ rows: EnterpriseLog[]; total: number }> {
    const { data } = await client.get<RuoyiResponse<{ rows: EnterpriseLog[]; total: number }>>("/api/enterprise/logs", { params: query });
    return unwrap(data, "获取调用日志失败") ?? { rows: [], total: 0 };
}
