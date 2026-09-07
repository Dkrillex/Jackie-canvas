import { Hono } from "hono";

import { resolveUser } from "../auth.js";
import { mysqlConfigured } from "../config.js";
import * as exchange from "../exchange.js";

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
 * 发起兑换：扣积分并落一条 pending 记录。
 *
 * 现在到此为止 —— 真正给账号发 API 额度的 `/gw` 接口还没接。接上之后在这里
 * `create()` 之后调它，成功 `markDone(id, 回执)`、失败 `markFailed(id, 原因)`（会退积分）。
 * 网关调用要放在事务外，不要塞回 create() 里。
 */
exchangeRoutes.post("/", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const body = await c.req.json<{ credits?: number }>().catch(() => ({}) as { credits?: number });
    const row = await exchange.create(user.userId, Number(body.credits));
    return c.json({ exchange: toView(row) });
});

exchangeRoutes.get("/", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const limit = Math.min(Number(c.req.query("limit") || 20) || 20, 100);
    const rows = await exchange.listByUser(user.userId, limit);
    return c.json({ exchanges: rows.map(toView) });
});
