import { Hono } from "hono";

import { resolveUserFrom } from "../auth.js";
import { mysqlConfigured, novaAdminConfigured } from "../config.js";
import * as exchange from "../exchange.js";
import { creditsToQuota, grantUserQuota, QuotaGrantError } from "../nova-quota.js";

export const exchangeRoutes = new Hono();

exchangeRoutes.use("*", async (c, next) => {
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置" }, 503);
    return next();
});

const toView = (row: exchange.ExchangeRow) => ({
    id: row.id,
    credits: row.credits,
    status: row.status,
    gwRef: row.gw_ref,
    note: row.note,
    createdAt: row.created_at,
    settledAt: row.settled_at,
});

/**
 * 发起兑换：先扣积分落 pending，事务外调 New API add_quota。
 * 明确失败才 markFailed 退积分；超时/5xx 和「额度已发但没写成 done」都留 pending，
 * 避免前端当失败再点一次导致双花。不要把 HTTP 塞回 create()。
 */
exchangeRoutes.post("/", async (c) => {
    if (!novaAdminConfigured()) return c.json({ message: "尚未配置 New API 管理员令牌，无法发放额度" }, 503);

    const user = await resolveUserFrom(c);
    const body = await c.req.json<{ credits?: number }>().catch(() => ({}) as { credits?: number });
    const row = await exchange.create(user.userId, Number(body.credits));

    let granted = false;
    try {
        const quota = creditsToQuota(row.credits);
        const ref = await grantUserQuota(user.userId, quota);
        granted = true;
        const marked = await exchange.markDone(row.id, ref);
        if (!marked) console.error(`[pay] 兑换 ${row.id} 额度已发但 markDone 未改到行`);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const uncertain = error instanceof QuotaGrantError && error.uncertain;
        if (granted || uncertain) {
            console.error(`[pay] 兑换 ${row.id} 发放结果不确定，留 pending：`, error);
        } else {
            await exchange.markFailed(row.id, reason).catch((refundError) => {
                console.error(`[pay] 兑换 ${row.id} 发放失败后退积分也失败：`, refundError);
            });
            throw error instanceof QuotaGrantError ? error : new QuotaGrantError(reason);
        }
    }

    const settled = (await exchange.getById(row.id)) ?? { ...row, status: granted ? exchange.STATUS_DONE : exchange.STATUS_PENDING };
    return c.json({ exchange: toView(settled) });
});

exchangeRoutes.get("/", async (c) => {
    const user = await resolveUserFrom(c);
    const limit = Math.min(Number(c.req.query("limit") || 20) || 20, 100);
    const rows = await exchange.listByUser(user.userId, limit);
    return c.json({ exchanges: rows.map(toView) });
});
