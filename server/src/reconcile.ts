/**
 * 兜底对账：定期把还没付的单拿去问支付宝，付了就入账。
 *
 * 为什么必须有这个 —— 异步通知会丢。回调地址被挡、本地开发的隧道断掉、服务重启的那
 * 几秒，通知就没了，而用户的钱是真扣了。前端轮询能兜住一部分，但它只在用户开着页面时
 * 才跑；用户付完就关标签页的话，没有任何人会去查。
 *
 * 所以三条腿：异步通知（最快）、前端轮询时主动查（用户还在页面上）、这个后台对账
 * （谁都不在的时候）。三条走的是同一个 orders.settle()，而它是幂等的，
 * 所以三条同时命中也只会入账一次。
 */
import { tradeQuery } from "./alipay.js";
import { alipayConfigured, mysqlConfigured, settings } from "./config.js";
import { listPending, settle, type OrderRow } from "./orders.js";

const PAID_STATUS = ["TRADE_SUCCESS", "TRADE_FINISHED"];

/** 查一笔，付了就入账。返回这次有没有真的加钱。 */
export async function settleFromQuery(order: OrderRow): Promise<boolean> {
    let result;
    try {
        result = await tradeQuery(order.out_trade_no);
    } catch (error) {
        const message = (error as Error).message || "";
        // 用户还没点进收银台时支付宝就是这个响应，属于正常，不用刷屏
        if (!message.includes("TRADE_NOT_EXIST")) console.warn(`[pay] 查 ${order.out_trade_no} 失败：${message.slice(0, 120)}`);
        return false;
    }
    if (!PAID_STATUS.includes(String(result.trade_status))) return false;

    // 金额还是要比一次：防的是订单号被拿去和别的交易拼接
    if (Math.abs(Number(result.total_amount || 0) - Number(order.amount)) > 0.001) {
        console.error(`[pay] ${order.out_trade_no} 金额对不上：${result.total_amount} vs ${order.amount}，不入账`);
        return false;
    }

    const { credited } = await settle(order.out_trade_no, { tradeNo: String(result.trade_no || ""), payload: result });
    return credited;
}

export function startReconcileLoop(): void {
    const interval = settings.reconcileIntervalSec;
    if (interval <= 0) {
        console.log("[pay] 兜底对账已关闭（RECONCILE_INTERVAL_SEC<=0）");
        return;
    }
    console.log(`[pay] 兜底对账已启动，每 ${interval}s 扫一次近 ${settings.reconcileWindowMin} 分钟的待付单`);

    const tick = async () => {
        if (!alipayConfigured() || !mysqlConfigured()) return;
        const pending = await listPending(settings.reconcileWindowMin);
        if (!pending.length) return;
        let settled = 0;
        // 一笔一笔查，不并发：后台任务慢一点没关系，但别在支付宝那边压出一堆并发招来限流
        for (const order of pending) if (await settleFromQuery(order)) settled += 1;
        if (settled) console.log(`[pay] 本轮补记 ${settled}/${pending.length} 笔`);
    };

    const timer = setInterval(() => {
        // 后台任务不能因为一次异常就死掉
        tick().catch((error) => console.error(`[pay] 对账本轮出错（下轮继续）：${(error as Error).message}`));
    }, interval * 1000);
    timer.unref();
}
