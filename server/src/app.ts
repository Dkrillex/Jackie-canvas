import { Hono } from "hono";
import { cors } from "hono/cors";

import { Unauthorized } from "./auth.js";
import { alipayConfigured, mysqlConfigured, settings } from "./config.js";
import { DatabaseNotConfigured } from "./db.js";
import { ExchangeError } from "./exchange.js";
import { startJobExpiryLoop } from "./expire.js";
import { JobError } from "./jobs.js";
import { startReconcileLoop } from "./reconcile.js";
import { exchangeRoutes } from "./routes/exchange.js";
import { jobRoutes } from "./routes/jobs.js";
import { payRoutes } from "./routes/pay.js";
import { walletRoutes } from "./routes/wallet.js";

export const app = new Hono();

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
    if (error instanceof JobError) return c.json({ message: error.message }, error.status as 400);
    if (error instanceof ExchangeError) return c.json({ message: error.message }, error.status as 400);
    console.error(`[pay] 未处理的错误 ${c.req.method} ${c.req.path}：${error.stack || error.message}`);
    return c.json({ message: error.message || "服务异常" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, alipay: alipayConfigured(), mysql: mysqlConfigured() }));
app.route("/api/pay", payRoutes);
app.route("/api/wallet", walletRoutes);
app.route("/api/jobs", jobRoutes);
app.route("/api/exchange", exchangeRoutes);

let backgroundStarted = false;
export function startBackgroundJobsOnce() {
    if (backgroundStarted) return;
    backgroundStarted = true;
    startReconcileLoop();
    startJobExpiryLoop();
}
