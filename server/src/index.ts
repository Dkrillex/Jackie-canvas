import { serve } from "@hono/node-server";

import { alipayConfigured, mysqlConfigured, settings } from "./config.js";
import { app, startBackgroundJobsOnce } from "./app.js";

startBackgroundJobsOnce();

serve({ fetch: app.fetch, hostname: settings.host, port: settings.port }, (info) => {
    console.log(`[pay] 充值服务已启动 http://${settings.host}:${info.port}`);
    if (!alipayConfigured()) console.warn("[pay] 支付宝未配置，/api/pay/orders 会回 503");
    if (!mysqlConfigured()) console.warn("[pay] MySQL 未配置，充值与钱包接口会回 503");
    if (alipayConfigured() && !settings.alipayNotifyUrl) {
        console.warn("[pay] 未配置 ALIPAY_NOTIFY_URL：支付宝不会推送通知，只能靠前端轮询和后台对账确认到账");
    }
});
