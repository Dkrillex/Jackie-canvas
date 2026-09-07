import { useCallback, useEffect, useRef, useState } from "react";

import { createRechargeOrder, getRechargePackages, getRechargeOrder, type RechargeOrder, type RechargePackage } from "@/services/api/wallet";

/** 付款在支付宝那边完成，页面只能靠轮询知道结果。2 秒一次，服务端会压住真正打给支付宝的频次。 */
const POLL_INTERVAL_MS = 2000;

export function useRecharge(onPaid: () => void) {
    const [packages, setPackages] = useState<RechargePackage[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [order, setOrder] = useState<RechargeOrder | null>(null);
    const [creating, setCreating] = useState(false);
    const [paid, setPaid] = useState(false);
    const [pollError, setPollError] = useState("");

    useEffect(() => {
        getRechargePackages()
            .then((data) => {
                setPackages(data.packages);
                setEnabled(data.enabled);
            })
            .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "获取充值档位失败"));
    }, []);

    const onPaidRef = useRef(onPaid);
    onPaidRef.current = onPaid;

    useEffect(() => {
        if (!order || paid) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const tick = async () => {
            try {
                const status = await getRechargeOrder(order.outTradeNo);
                if (stopped) return;
                if (status.paid) {
                    setPaid(true);
                    onPaidRef.current();
                    return;
                }
                setPollError("");
            } catch (error) {
                // 查询失败不该中断轮询：网络抖一下、服务重启一会儿都会失败，
                // 而用户的钱可能已经付了，停下来反而看不到到账。
                if (!stopped) setPollError(error instanceof Error ? error.message : "查询订单失败");
            }
            if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS);
        };
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [order, paid]);

    const start = useCallback(async (packageId: string) => {
        setCreating(true);
        setPollError("");
        setPaid(false);
        try {
            const created = await createRechargeOrder(packageId);
            setOrder(created);
            return created;
        } finally {
            setCreating(false);
        }
    }, []);

    const reset = useCallback(() => {
        setOrder(null);
        setPaid(false);
        setPollError("");
    }, []);

    return { packages, enabled, loadError, order, creating, paid, pollError, start, reset };
}
