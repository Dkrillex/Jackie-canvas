/**
 * 充值下单、查状态、收通知。
 *
 * 安全上只有一句话要记住：**能决定「这笔钱到底付没付」的只有验过签的 /notify 和主动
 * 查询的结果**。前端说什么都不算数 —— 查状态那个接口只是把库里的状态读出来给界面用，
 * 不接受前端写入；下单接口不收金额，只收档位 id。
 */
import { Hono } from "hono";

import { AlipayNotConfigured, pagePayUrl, verifyNotify } from "../alipay.js";
import { resolveUser } from "../auth.js";
import { alipayConfigured, mysqlConfigured, settings } from "../config.js";
import { DatabaseNotConfigured } from "../db.js";
import * as orders from "../orders.js";
import { findPackage, MAX_RECHARGE_YUAN, packages } from "../packages.js";
import { settleFromQuery } from "../reconcile.js";

export const payRoutes = new Hono();

// 上次为某笔单问过支付宝的时刻。前端每 2 秒轮询一次，要是每次都去问，一个页面开着就是
// 30 次/分钟，多开几个就该撞限流了。这里压到最多每 4 秒问一次；中间那些轮询只读库，
// 反正通知和后台对账都会写库。
const lastAsked = new Map<string, number>();
const ASK_GAP_MS = 4000;

function shouldAskAlipay(outTradeNo: string): boolean {
    const now = Date.now();
    if (now - (lastAsked.get(outTradeNo) || 0) < ASK_GAP_MS) return false;
    lastAsked.set(outTradeNo, now);
    if (lastAsked.size > 500) {
        for (const [key, at] of lastAsked) if (now - at > ASK_GAP_MS * 10) lastAsked.delete(key);
    }
    return true;
}

/** 前端展示用。价格以这里为准 —— 前端那份档位列表只是文案。 */
payRoutes.get("/packages", (c) => {
    // enabled 要两样都齐：支付宝配好、库连得上，这条链路才真的能用。少算一样的话
    // 前端会亮出充值入口，用户点下去才撞 503。
    const missing = [!alipayConfigured() && "alipay", !mysqlConfigured() && "mysql"].filter(Boolean) as string[];
    // 服务端知道缺的是哪一个，就别让前端笼统地说「支付宝或数据库」——
    // 两样都没配和只差一样，排查方向完全不同。
    return c.json({ enabled: missing.length === 0, missing, packages });
});

/**
 * 下一笔充值单。
 *
 * 只收 packageId，**不收金额** —— 金额和到账积分都按 id 从服务端价目表查。一旦允许
 * 前端传金额，改一个数字就能一分钱买下全部积分。
 */
payRoutes.post("/orders", async (c) => {
    if (!alipayConfigured()) return c.json({ message: "支付宝还没配置：请在服务端填 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY" }, 503);
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置：请在服务端填 MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE" }, 503);

    const user = await resolveUser(c.req.header("Authorization"));
    const body = await c.req.json<{ packageId?: string }>().catch(() => ({}) as { packageId?: string });
    const pkg = findPackage(String(body.packageId || ""));
    if (!pkg) return c.json({ message: "充值档位不存在" }, 400);
    if (Number(pkg.amount) > MAX_RECHARGE_YUAN) {
        return c.json({ message: `单笔充值最多 ${MAX_RECHARGE_YUAN} 元，更大额度请联系商务` }, 400);
    }

    const outTradeNo = orders.newOrderNo();
    // 先落库再去支付宝：反过来的话，支付宝那边单建好了、我们这边没记上，
    // 用户付了钱通知打回来会查无此单。
    try {
        await orders.create({ outTradeNo, userId: user.userId, packageId: pkg.id, subject: pkg.subject, amount: pkg.amount, credits: pkg.credits });
    } catch (error) {
        if (error instanceof DatabaseNotConfigured) return c.json({ message: error.message }, 503);
        return c.json({ message: `订单入库失败：${(error as Error).message}` }, 502);
    }

    try {
        const payUrl = pagePayUrl({ outTradeNo, amount: pkg.amount, subject: pkg.subject });
        return c.json({ outTradeNo, payUrl, amount: pkg.amount, credits: pkg.credits, subject: pkg.subject, status: orders.STATUS_CREATED });
    } catch (error) {
        // 库里那条已经建好了。支付宝这步没成，它永远等不到付款，留着只会让待付列表
        // 越积越长，看的人还以为是用户放弃了。就地关掉。
        await orders.close(outTradeNo, (error as Error).message).catch(() => undefined);
        if (error instanceof AlipayNotConfigured) return c.json({ message: error.message }, 503);
        return c.json({ message: `生成支付链接失败：${(error as Error).message}` }, 502);
    }
});

/**
 * 给前端轮询用。
 *
 * 库里已经是已付就直接回；还没有的话**主动问一次支付宝**。只靠异步通知是不够的：回调
 * 地址不通、隧道断了、服务重启的那几秒，通知就丢了，而用户的钱是真扣了。
 */
payRoutes.get("/orders/:outTradeNo", async (c) => {
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置" }, 503);
    const user = await resolveUser(c.req.header("Authorization"));
    const outTradeNo = c.req.param("outTradeNo");

    let order = await orders.get(outTradeNo);
    // 订单号不是自己的就当不存在，不要回「无权查看」—— 那等于确认了这个号真实存在
    if (!order || order.user_id !== user.userId) return c.json({ message: "订单不存在" }, 404);

    if (order.status === orders.STATUS_CREATED && alipayConfigured() && shouldAskAlipay(outTradeNo)) {
        if (await settleFromQuery(order)) order = (await orders.get(outTradeNo)) || order;
    }

    return c.json({
        outTradeNo: order.out_trade_no,
        status: order.status,
        amount: order.amount,
        credits: order.credits,
        subject: order.subject,
        paid: order.status === orders.STATUS_PAID,
        createdAt: order.created_at,
        paidAt: order.paid_at,
    });
});

/** 当前用户的充值记录。 */
payRoutes.get("/orders", async (c) => {
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置" }, 503);
    const user = await resolveUser(c.req.header("Authorization"));
    const limit = Math.min(Number(c.req.query("limit") || 20) || 20, 100);
    const rows = await orders.listByUser(user.userId, limit);
    return c.json({
        orders: rows.map((row) => ({
            outTradeNo: row.out_trade_no,
            subject: row.subject,
            amount: row.amount,
            credits: row.credits,
            status: row.status,
            createdAt: row.created_at,
            paidAt: row.paid_at,
        })),
    });
});

/**
 * 支付宝的异步通知。**整条链路唯一的安全边界。**
 *
 * 四道关，缺一不可：
 *   1. 验签 —— 不验的话谁都能 POST 一条「已付款」给自己充值
 *   2. app_id 对得上 —— 防的是拿别的应用的合法通知来打这个端点
 *   3. 订单存在 —— 查无此单说明号是伪造的
 *   4. 金额一致 —— 防「下一笔一分钱的单、把通知改成 1000 元」这类拼接
 *
 * 返回体必须是纯文本 success，支付宝收不到这七个字母就会按 4m/10m/10m/1h… 一直重发，
 * 所以处理必须幂等（见 orders.settle）。
 */
payRoutes.post("/notify", async (c) => {
    const form = Object.fromEntries(Object.entries(await c.req.parseBody()).map(([key, value]) => [key, String(value)]));

    if (!verifyNotify(form)) {
        console.error(`[pay] 通知验签不通过，丢弃：${form.out_trade_no}`);
        return c.text("invalid sign", 400);
    }
    if (form.app_id !== settings.alipayAppId) {
        console.error(`[pay] 通知的 app_id 对不上：${form.app_id}`);
        return c.text("app_id mismatch", 400);
    }

    const order = await orders.get(String(form.out_trade_no || ""));
    if (!order) {
        console.error(`[pay] 通知里的订单号库里没有：${form.out_trade_no}`);
        return c.text("unknown order", 400);
    }
    if (Math.abs(Number(form.total_amount || 0) - Number(order.amount)) > 0.001) {
        console.error(`[pay] 通知金额和订单对不上：${form.total_amount} vs ${order.amount}`);
        return c.text("amount mismatch", 400);
    }

    if (form.trade_status === "TRADE_SUCCESS" || form.trade_status === "TRADE_FINISHED") {
        const { credited } = await orders.settle(order.out_trade_no, { tradeNo: String(form.trade_no || ""), payload: form });
        // credited=false 说明之前已经入过账（支付宝重发）。照样回 success，但不再加一次钱。
        console.log(`[pay] 订单 ${order.out_trade_no} ${credited ? `已入账 ${order.credits} 积分` : "重复通知，忽略"}`);
    }

    return c.text("success");
});
