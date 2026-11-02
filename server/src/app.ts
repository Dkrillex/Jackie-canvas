import { Hono } from "hono";
import { cors } from "hono/cors";

import { Unauthorized } from "./auth.js";
import { alipayConfigured, mysqlConfigured, novaAdminConfigured, novaApiMysqlConfigured, ossConfigured, settings } from "./config.js";
import { DatabaseNotConfigured } from "./db.js";
import { NovaApiDatabaseNotConfigured } from "./nova-users.js";
import { OssNotConfigured } from "./oss.js";
import { startReconcileLoop } from "./reconcile.js";
import { authRoutes } from "./routes/auth.js";
import { ossRoutes } from "./routes/oss.js";
import { payRoutes } from "./routes/pay.js";

export const app = new Hono();

const origins = settings.corsOrigin.split(",").map((item) => item.trim()).filter(Boolean);
app.use(
    "*",
    cors({
        origin: origins.includes("*") ? "*" : origins,
        allowHeaders: ["Content-Type", "Authorization", "New-Api-User"],
        allowMethods: ["GET", "POST", "OPTIONS"],
    }),
);

app.onError((error, c) => {
    if (error instanceof Unauthorized) return c.json({ message: error.message }, 401);
    if (error instanceof DatabaseNotConfigured) return c.json({ message: error.message }, 503);
    if (error instanceof NovaApiDatabaseNotConfigured) return c.json({ success: false, message: error.message }, 503);
    if (error instanceof OssNotConfigured) return c.json({ message: error.message }, 503);
    console.error(`[pay] 未处理的错误 ${c.req.method} ${c.req.path}：${error.stack || error.message}`);
    return c.json({ message: error.message || "服务异常" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, alipay: alipayConfigured(), mysql: mysqlConfigured(), novaApi: novaApiMysqlConfigured(), novaAdmin: novaAdminConfigured(), oss: ossConfigured() }));
app.route("/api/auth", authRoutes);
app.route("/api/pay", payRoutes);
app.route("/api/oss", ossRoutes);

let backgroundStarted = false;
export function startBackgroundJobsOnce() {
    if (backgroundStarted) return;
    backgroundStarted = true;
    startReconcileLoop();
}
