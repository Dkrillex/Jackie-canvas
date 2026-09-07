/**
 * 接单中心。每个动作都要先确认「你是不是有资格做这件事」——
 * 发单人才能接受报价、打回、验收、取消；接单人才能提交交付。
 * 这些判断全部落在 jobs.ts 的事务里，路由只负责取用户和参数。
 */
import { Hono, type Context } from "hono";

import { resolveUser } from "../auth.js";
import { mysqlConfigured } from "../config.js";
import * as jobs from "../jobs.js";

export const jobRoutes = new Hono();

jobRoutes.use("*", async (c, next) => {
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置" }, 503);
    return next();
});

/** 请求体解析失败当成空对象：字段校验在 jobs.ts 里做，这里不重复一遍 */
const body = <T>(c: Context) => c.req.json<T>().catch(() => ({}) as T);

jobRoutes.get("/", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const scope = c.req.query("scope");
    const list = await jobs.list(user.userId, scope === "client" || scope === "creator" ? scope : "hall");
    return c.json({ jobs: list, userId: user.userId });
});

jobRoutes.post("/", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const input = await body<{ title?: string; brief?: string; budget?: number }>(c);
    const id = await jobs.create(user.userId, { title: String(input.title || ""), brief: String(input.brief || ""), budget: Number(input.budget) });
    return c.json({ id });
});

jobRoutes.get("/:id", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const job = await jobs.get(c.req.param("id"));
    if (!job) return c.json({ message: "工单不存在" }, 404);
    return c.json({ job, userId: user.userId });
});

jobRoutes.post("/:id/quotes", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const input = await body<{ amount?: number; note?: string }>(c);
    await jobs.quote(user.userId, c.req.param("id"), { amount: Number(input.amount), note: String(input.note || "") });
    return c.json({ ok: true });
});

jobRoutes.post("/:id/accept", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const input = await body<{ quoteId?: string }>(c);
    await jobs.accept(user.userId, c.req.param("id"), String(input.quoteId || ""));
    return c.json({ ok: true });
});

jobRoutes.post("/:id/delivery", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const input = await body<{ content?: string; link?: string; canvasId?: string }>(c);
    await jobs.submitDelivery(user.userId, c.req.param("id"), { content: String(input.content || ""), link: input.link, canvasId: input.canvasId });
    return c.json({ ok: true });
});

jobRoutes.post("/:id/reject", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const input = await body<{ reason?: string }>(c);
    await jobs.rejectDelivery(user.userId, c.req.param("id"), String(input.reason || ""));
    return c.json({ ok: true });
});

jobRoutes.post("/:id/complete", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    const input = await body<{ costAmount?: number }>(c);
    await jobs.acceptDelivery(user.userId, c.req.param("id"), Number(input.costAmount) || 0);
    return c.json({ ok: true });
});

jobRoutes.post("/:id/cancel", async (c) => {
    const user = await resolveUser(c.req.header("Authorization"));
    await jobs.cancel(user.userId, c.req.param("id"));
    return c.json({ ok: true });
});
