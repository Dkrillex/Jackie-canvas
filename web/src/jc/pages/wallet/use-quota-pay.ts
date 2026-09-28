import { useCallback, useEffect, useRef, useState } from "react";

import { fetchCurrentUser } from "@/services/api/user";
import { getNovaTopUpInfo, openNovaEpayCheckout, quoteNovaPayAmount, requestNovaEpay, type NovaPayMethod } from "@/jc/services/nova-pay";
import { useUserStore } from "@/stores/use-user-store";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 120_000;

export function useQuotaPay() {
    const user = useUserStore((state) => state.user);
    const setUser = useUserStore((state) => state.setUser);
    const [enabled, setEnabled] = useState(false);
    const [methods, setMethods] = useState<NovaPayMethod[]>([]);
    const [amounts, setAmounts] = useState<number[]>([]);
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState("");
    const [money, setMoney] = useState("");
    const [loadError, setLoadError] = useState("");
    const [creating, setCreating] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [paid, setPaid] = useState(false);
    const baselineRef = useRef(0);

    useEffect(() => {
        if (!user) return;
        getNovaTopUpInfo()
            .then((info) => {
                const options = info.amountOptions.filter((item) => item >= info.minTopup);
                setEnabled(info.enableOnlineTopup && options.length > 0 && info.payMethods.length > 0);
                setMethods(info.payMethods);
                setAmounts(options);
                setAmount((current) => (options.includes(current) ? current : options[0] || 0));
                setMethod((current) => (info.payMethods.some((item) => item.type === current) ? current : info.payMethods[0]?.type || ""));
            })
            .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "获取额度充值信息失败"));
    }, [user]);

    useEffect(() => {
        if (!user || !enabled || !amount) {
            setMoney("");
            return;
        }
        let cancelled = false;
        quoteNovaPayAmount(amount)
            .then((value) => {
                if (!cancelled) setMoney(value);
            })
            .catch(() => {
                if (!cancelled) setMoney("");
            });
        return () => {
            cancelled = true;
        };
    }, [amount, enabled, user]);

    useEffect(() => {
        if (!waiting || paid) return;
        const deadline = Date.now() + POLL_MAX_MS;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const tick = async () => {
            try {
                const next = await fetchCurrentUser();
                if (stopped) return;
                setUser(next);
                if (next.quota > baselineRef.current) {
                    setPaid(true);
                    setWaiting(false);
                    return;
                }
            } catch {
                // 查询失败继续轮询：钱可能已经付了
            }
            if (!stopped && Date.now() < deadline) timer = setTimeout(tick, POLL_INTERVAL_MS);
            else if (!stopped) setWaiting(false);
        };
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [paid, setUser, waiting]);

    const start = useCallback(async (targetName = "_blank") => {
        if (!amount || !method) throw new Error("请选择档位和支付方式");
        setCreating(true);
        setPaid(false);
        try {
            baselineRef.current = useUserStore.getState().user?.quota || 0;
            const checkout = await requestNovaEpay(amount, method);
            openNovaEpayCheckout(checkout.url, checkout.fields, targetName);
            setWaiting(true);
        } finally {
            setCreating(false);
        }
    }, [amount, method]);

    const reset = useCallback(() => {
        setWaiting(false);
        setPaid(false);
    }, []);

    return { enabled, methods, amounts, amount, setAmount, method, setMethod, money, loadError, creating, waiting, paid, start, reset };
}
