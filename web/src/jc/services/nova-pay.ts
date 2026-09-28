import axios from "axios";

import { getSessionHeaders } from "@/constant/auth";
import { AUTH_API_BASE } from "@/constant/env";

type NewApiEnvelope<T = unknown> = {
    success?: boolean;
    message?: string;
    data?: T;
    url?: string;
};

export type NovaPayMethod = {
    type: string;
    name: string;
};

export type NovaTopUpInfo = {
    enableOnlineTopup: boolean;
    payMethods: NovaPayMethod[];
    amountOptions: number[];
    minTopup: number;
};

const client = axios.create({
    baseURL: AUTH_API_BASE,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    for (const [key, value] of Object.entries(getSessionHeaders())) {
        config.headers[key] = value;
    }
    return config;
});

export async function getNovaTopUpInfo(): Promise<NovaTopUpInfo> {
    const data = unwrapOk(await client.get<NewApiEnvelope<Record<string, unknown>>>("/api/user/topup/info"), "获取充值信息失败");
    const methods = Array.isArray(data.pay_methods) ? data.pay_methods : [];
    const amounts = Array.isArray(data.amount_options) ? data.amount_options : [];
    return {
        enableOnlineTopup: Boolean(data.enable_online_topup),
        payMethods: methods.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const type = String((item as { type?: string }).type || "").trim();
            if (!type) return [];
            return [{ type, name: String((item as { name?: string }).name || type).trim() || type }];
        }),
        amountOptions: amounts.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0),
        minTopup: Number(data.min_topup) || 0,
    };
}

export async function quoteNovaPayAmount(amount: number): Promise<string> {
    const data = unwrapPay(await client.post<NewApiEnvelope<string>>("/api/user/amount", { amount }), "询价失败");
    return String(data || "").trim();
}

export async function requestNovaEpay(amount: number, paymentMethod: string) {
    const response = await client.post<NewApiEnvelope<Record<string, string>>>("/api/user/pay", {
        amount,
        payment_method: paymentMethod,
    });
    const body = response.data;
    if (body?.message === "error" || body?.success === false) {
        throw new Error(typeof body.data === "string" && body.data ? body.data : body.message || "下单失败");
    }
    const fields = body?.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : {};
    const url = String(body?.url || "").trim();
    if (!url) throw new Error("未返回支付地址");
    return { url, fields };
}

/** 易支付按 HTTP_REFERER 校验支付域名，必须从当前站点发起；空白窗 / noreferrer 会被当成没过白。 */
export function openNovaEpayCheckout(url: string, fields: Record<string, string>, targetName = "_blank") {
    const entries = Object.entries(fields).filter(([, value]) => value != null && value !== "");
    if (!entries.length) {
        if (targetName === "_self") {
            window.location.href = url;
            return;
        }
        const cashier = window.open(url, targetName);
        if (!cashier) window.location.href = url;
        return;
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.target = targetName;
    form.referrerPolicy = "origin";
    form.style.display = "none";
    for (const [name, value] of entries) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
}

function unwrapOk<T>(response: { data: NewApiEnvelope<T> }, fallback: string): T {
    const res = response.data;
    if (res?.success === false) throw new Error(res.message || fallback);
    if (res?.data !== undefined) return res.data as T;
    throw new Error(res?.message || fallback);
}

function unwrapPay(response: { data: NewApiEnvelope<string> }, fallback: string): string {
    const res = response.data;
    if (res?.message === "error" || res?.success === false) {
        throw new Error(typeof res.data === "string" && res.data ? res.data : res.message || fallback);
    }
    return String(res?.data ?? "");
}
