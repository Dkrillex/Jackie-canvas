import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { Unauthorized } from "./auth.js";
import { alipayConfigured, mysqlConfigured, settings } from "./config.js";
import { DatabaseNotConfigured } from "./db.js";
import { JobError } from "./jobs.js";
import { startReconcileLoop } from "./reconcile.js";
import { jobRoutes } from "./routes/jobs.js";
import { payRoutes } from "./routes/pay.js";
import { walletRoutes } from "./routes/wallet.js";

const app = new Hono();

const origins = settings.corsOrigin.split(",").map((item) => item.trim()).filter(Boolean);
app.use(
    "*",
    cors({
        origin: origins.includes("*") ? "*" : origins,
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "OPTIONS"],
    }),
);

app.onError((error, c) => {
    if (error instanceof Unauthorized) return c.json({ message: error.message }, 401);
    if (error instanceof DatabaseNotConfigured) return c.json({ message: error.message }, 503);
    // 工单的业务拒绝（状态不对、余额不够、不是你的单）是预期内的，原样把原因回给用户
    if (error instanceof JobError) return c.json({ message: error.message }, error.status as 400);
    console.error(`[pay] 未处理的错误 ${c.req.method} ${c.req.path}：${error.stack || error.message}`);
    return c.json({ message: error.message || "服务异常" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, alipay: alipayConfigured(), mysql: mysqlConfigured() }));
app.route("/api/pay", payRoutes);
app.route("/api/wallet", walletRoutes);
app.route("/api/jobs", jobRoutes);

startReconcileLoop();

serve({ fetch: app.fetch, hostname: settings.host, port: settings.port }, (info) => {
    console.log(`[pay] 充值服务已启动 http://${settings.host}:${info.port}`);
    if (!alipayConfigured()) console.warn("[pay] 支付宝未配置，/api/pay/orders 会回 503");
    if (!mysqlConfigured()) console.warn("[pay] MySQL 未配置，充值与钱包接口会回 503");
    if (alipayConfigured() && !settings.alipayNotifyUrl) {
        console.warn("[pay] 未配置 ALIPAY_NOTIFY_URL：支付宝不会推送通知，只能靠前端轮询和后台对账确认到账");
    }
});
