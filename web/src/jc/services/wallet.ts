/**
 * 积分钱包与支付宝充值。走同源 `/pay-api`（本地 Vite 代理、线上 rewrite 到充值服务）。
 *
 * 这里**不出现金额** —— 下单只传档位 id，金额和到账积分都由服务端价目表决定。
 * 一旦允许前端传金额，改一个数字就能一分钱买下全部积分。页面上显示的价格来自
 * `getRechargePackages()`，也就是服务端那份，不会和结算价对不上。
 */
import { AUTH_TOKEN_KEY } from "@/constant/auth";
import { PAY_API_BASE } from "@/jc/config";

export type RechargePackage = {
    id: string;
    amount: string;
    credits: string;
    bonus: string;
    subject: string;
};

export type WalletView = { balance: string; frozen: string; available: string };

export type LedgerEntry = {
    id: number;
    kind: "recharge" | "consume" | "adjust";
    amount: string;
    balanceAfter: string;
    refNo: string | null;
    note: string;
    createdAt: string;
};

export type RechargeOrder = {
    outTradeNo: string;
    payUrl: string;
    amount: string;
    credits: string;
    subject: string;
    status: string;
};

export type OrderStatus = {
    outTradeNo: string;
    status: string;
    amount: string;
    credits: string;
    subject: string;
    paid: boolean;
    createdAt: string;
    paidAt: string | null;
};

export type RechargeRecord = Omit<OrderStatus, "paid">;

async function payRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
    const response = await fetch(`${PAY_API_BASE}${path}`, {
        ...init,
        headers: {
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init?.headers,
        },
    });
    if (!response.ok) {
        // 服务端把不可用原因写在 message 里（没配支付宝、连不上库、登录失效），
        // 直接透出去比统一报「请求失败」有用得多
        const detail = await response.json().catch(() => null);
        throw new Error((detail as { message?: string })?.message || `${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

/** 服务端认的档位表。enabled 为 false 说明支付宝或数据库没配好，充值入口应置灰。 */
export async function getRechargePackages() {
    return payRequest<{ enabled: boolean; packages: RechargePackage[] }>("/api/pay/packages");
}

/** 下一笔充值单，返回支付宝收银台地址。只传档位 id。 */
export async function createRechargeOrder(packageId: string) {
    return payRequest<RechargeOrder>("/api/pay/orders", { method: "POST", body: JSON.stringify({ packageId }) });
}

/** 查一笔单的状态。付款是在支付宝那边完成的，页面靠轮询这个才知道到账没有。 */
export async function getRechargeOrder(outTradeNo: string) {
    return payRequest<OrderStatus>(`/api/pay/orders/${encodeURIComponent(outTradeNo)}`);
}

export async function listRechargeOrders(limit = 20) {
    return payRequest<{ orders: RechargeRecord[] }>(`/api/pay/orders?limit=${limit}`);
}

export async function getWallet() {
    return payRequest<WalletView>("/api/wallet");
}

export async function listWalletLedger(limit = 50) {
    return payRequest<{ entries: LedgerEntry[] }>(`/api/wallet/ledger?limit=${limit}`);
}

export type CreditExchange = {
    id: string;
    credits: string;
    /** pending=已扣积分待发放，done=额度已发放，failed=发放失败且积分已退回 */
    status: "pending" | "done" | "failed";
    gwRef: string | null;
    note: string;
    createdAt: string;
    settledAt: string | null;
};

/**
 * 发起一笔积分兑换 API 额度。
 *
 * 服务端此刻只做到「扣积分 + 落一条 pending」，真正发额度的网关接口还没接。
 * 所以前端拿到 pending 是正常结果，不要显示成失败。
 */
export async function createExchange(credits: number) {
    return payRequest<{ exchange: CreditExchange }>("/api/exchange", { method: "POST", body: JSON.stringify({ credits }) });
}

export async function listExchanges(limit = 20) {
    return payRequest<{ exchanges: CreditExchange[] }>(`/api/exchange?limit=${limit}`);
}
