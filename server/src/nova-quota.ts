/**
 * 用 New API 管理员接口给用户加额度。
 * POST /api/user/manage  { action: "add_quota", mode: "add" }
 * users.id 是 BIGINT，JSON 里必须原样写成数字，不能经 JS Number（会丢精度）。
 */
import { settings } from "./config.js";

export class QuotaGrantError extends Error {
    constructor(
        message: string,
        readonly status = 502,
        /** 超时/5xx：额度可能已经加上，不能退积分、也不能让前端当失败再点一次 */
        readonly uncertain = false,
    ) {
        super(message);
    }
}

type ManageResponse = { success?: boolean; message?: string };

/** 1.00 积分 = novaQuotaPerUnit。两位小数按分换算，避免浮点。 */
export function creditsToQuota(credits: string): number {
    const match = String(credits).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) throw new QuotaGrantError("兑换积分格式无效");
    const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
    const perUnit = settings.novaQuotaPerUnit;
    if (perUnit % 100 !== 0) throw new QuotaGrantError("NEW_API_QUOTA_PER_UNIT 必须能被 100 整除");
    const quota = (cents * perUnit) / 100;
    if (!(quota > 0) || !Number.isSafeInteger(quota)) throw new QuotaGrantError("兑换额度超出可发放范围");
    return quota;
}

export async function grantUserQuota(userId: string, quota: number): Promise<string> {
    const token = settings.novaAdminToken;
    const adminId = settings.novaAdminUserId;
    if (!token || !adminId) throw new QuotaGrantError("尚未配置 New API 管理员令牌，无法发放额度", 503);
    if (!/^\d+$/.test(userId)) throw new QuotaGrantError("用户 id 无效");
    if (!Number.isSafeInteger(quota) || quota <= 0) throw new QuotaGrantError("发放额度无效");

    const body = `{"id":${userId},"action":"add_quota","mode":"add","value":${quota}}`;
    let response: Response;
    try {
        response = await fetch(`${settings.authApiBase}/api/user/manage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "New-Api-User": adminId,
            },
            body,
            signal: AbortSignal.timeout(10_000),
        });
    } catch (error) {
        const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new QuotaGrantError(error instanceof Error ? error.message : "发放额度请求失败", timeout ? 504 : 502, true);
    }

    const payload = (await response.json().catch(() => null)) as ManageResponse | null;
    if (!response.ok || payload?.success === false) {
        const uncertain = response.status >= 500;
        throw new QuotaGrantError(payload?.message || `发放额度失败（HTTP ${response.status}）`, uncertain ? 504 : 502, uncertain);
    }
    return "granted";
}
