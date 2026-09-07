import { Alert, App, Button, Modal, Result, Spin, Table, Tabs, Tag, Typography } from "antd";
import { CheckCircle2, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRequireLogin } from "@/hooks/use-require-login";
import { listRechargeOrders, listWalletLedger, type LedgerEntry, type RechargeRecord } from "@/services/api/wallet";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletStore } from "@/stores/use-wallet-store";
import { useRecharge } from "./use-recharge";

const statusColor: Record<string, string> = { created: "gold", paid: "success", closed: "default" };

export default function WalletPage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const requireLogin = useRequireLogin();
    const user = useUserStore((state) => state.user);

    const { balance, frozen, available, loading, error, refresh, clear } = useWalletStore();
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [records, setRecords] = useState<RechargeRecord[]>([]);
    const [selected, setSelected] = useState("");

    const reload = useCallback(async () => {
        await refresh();
        // 流水和充值记录失败不该盖掉余额：余额是主信息，列表空着也能看
        await Promise.all([
            listWalletLedger()
                .then((data) => setLedger(data.entries))
                .catch(() => undefined),
            listRechargeOrders()
                .then((data) => setRecords(data.orders))
                .catch(() => undefined),
        ]);
    }, [refresh]);

    useEffect(() => {
        if (user) void reload();
        else clear();
    }, [clear, reload, user]);

    const { packages, enabled, loadError, order, creating, paid, pollError, start, reset } = useRecharge(reload);

    useEffect(() => {
        if (packages.length && !selected) setSelected(packages[0].id);
    }, [packages, selected]);

    const pay = async () => {
        if (!requireLogin()) return;
        // 先同步开一个空白窗口再去下单：等接口回来才 open 的话，浏览器会认为这不是
        // 用户手势触发的，直接拦掉弹窗，用户点了没反应。
        const cashier = window.open("", "_blank");
        try {
            const created = await start(selected);
            if (cashier) cashier.location.href = created.payUrl;
        } catch (err) {
            cashier?.close();
            message.error(err instanceof Error ? err.message : t("wallet.createFailed"));
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Typography.Title level={3} className="!mb-1 !flex items-center gap-2">
                        <Wallet className="size-6" />
                        {t("wallet.title")}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" className="!mb-0">
                        {t("wallet.subtitle")}
                    </Typography.Paragraph>
                </div>
                <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>
                    {t("wallet.refresh")}
                </Button>
            </div>

            {!user ? (
                <Alert
                    type="info"
                    showIcon
                    message={t("wallet.loginFirst")}
                    action={
                        <Button size="small" type="primary" onClick={() => requireLogin("/wallet")}>
                            {t("config.account.goLogin")}
                        </Button>
                    }
                />
            ) : null}
            {user && error ? <Alert type="warning" showIcon message={error} /> : null}
            {loadError ? <Alert type="warning" showIcon message={loadError} /> : null}
            {!loadError && !enabled && packages.length ? <Alert type="warning" showIcon message={t("wallet.unavailable")} /> : null}

            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    { label: t("wallet.available"), value: available, strong: true },
                    { label: t("wallet.balance"), value: balance, strong: false },
                    { label: t("wallet.frozen"), value: frozen, strong: false },
                ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800">
                        <div className="text-xs text-stone-500">{item.label}</div>
                        <div className={`mt-1 font-semibold tabular-nums ${item.strong ? "text-2xl" : "text-lg text-stone-600 dark:text-stone-300"}`}>{item.value}</div>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <div className="text-sm font-semibold">{t("wallet.pickPackage")}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {packages.map((item) => {
                        const active = item.id === selected;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelected(item.id)}
                                className={`rounded-xl border px-4 py-4 text-left transition ${active ? "border-stone-900 dark:border-stone-100" : "border-stone-200 hover:border-stone-400 dark:border-stone-800 dark:hover:border-stone-600"}`}
                            >
                                <div className="text-2xl font-semibold tabular-nums">¥{item.amount}</div>
                                <div className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t("wallet.packageCredits", { credits: item.credits })}</div>
                                {Number(item.bonus) > 0 ? (
                                    <Tag color="orange" className="mt-2">
                                        {t("wallet.bonus", { bonus: item.bonus })}
                                    </Tag>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                <Button type="primary" size="large" loading={creating} disabled={!enabled || !selected} onClick={() => void pay()}>
                    {t("wallet.pay")}
                </Button>
            </div>

            <Tabs
                items={[
                    {
                        key: "ledger",
                        label: t("wallet.tabLedger"),
                        children: (
                            <Table<LedgerEntry>
                                rowKey="id"
                                dataSource={ledger}
                                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                                columns={[
                                    { title: t("wallet.time"), dataIndex: "createdAt", width: 180 },
                                    { title: t("wallet.kind"), dataIndex: "kind", width: 110, render: (kind: string) => t(`wallet.kind_${kind}`, kind) },
                                    { title: t("wallet.amount"), dataIndex: "amount", width: 120, align: "right", render: (amount: string) => <span className="tabular-nums">{Number(amount) > 0 ? `+${amount}` : amount}</span> },
                                    { title: t("wallet.balanceAfter"), dataIndex: "balanceAfter", width: 120, align: "right", render: (value: string) => <span className="tabular-nums">{value}</span> },
                                    { title: t("wallet.note"), dataIndex: "note" },
                                ]}
                            />
                        ),
                    },
                    {
                        key: "orders",
                        label: t("wallet.tabOrders"),
                        children: (
                            <Table<RechargeRecord>
                                rowKey="outTradeNo"
                                dataSource={records}
                                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                                columns={[
                                    { title: t("wallet.time"), dataIndex: "createdAt", width: 180 },
                                    { title: t("wallet.orderNo"), dataIndex: "outTradeNo", width: 240 },
                                    { title: t("wallet.payAmount"), dataIndex: "amount", width: 120, align: "right", render: (amount: string) => <span className="tabular-nums">¥{amount}</span> },
                                    { title: t("wallet.willCredit"), dataIndex: "credits", width: 120, align: "right", render: (value: string) => <span className="tabular-nums">{value}</span> },
                                    { title: t("wallet.status"), dataIndex: "status", width: 110, render: (status: string) => <Tag color={statusColor[status] || "default"}>{t(`wallet.status_${status}`, status)}</Tag> },
                                ]}
                            />
                        ),
                    },
                ]}
            />

            <Modal open={Boolean(order)} onCancel={reset} footer={null} maskClosable={false} title={paid ? null : t("wallet.payingTitle")}>
                {paid ? (
                    <Result
                        status="success"
                        icon={<CheckCircle2 className="mx-auto size-12 text-emerald-500" />}
                        title={t("wallet.paidTitle")}
                        subTitle={t("wallet.paidDesc", { credits: order?.credits })}
                        extra={
                            <Button type="primary" onClick={reset}>
                                {t("wallet.done")}
                            </Button>
                        }
                    />
                ) : (
                    <div className="space-y-4 py-2">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                                <span className="text-stone-500">{t("wallet.orderNo")}</span>
                                <span className="font-mono text-xs">{order?.outTradeNo}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-stone-500">{t("wallet.payAmount")}</span>
                                <span className="font-semibold tabular-nums">¥{order?.amount}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-stone-500">{t("wallet.willCredit")}</span>
                                <span className="tabular-nums">{order?.credits}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-3 text-sm dark:border-stone-800">
                            <Spin size="small" />
                            <span>{t("wallet.payHint")}</span>
                        </div>
                        {/* 浏览器可能仍然拦掉了新窗口，留一个能手点的入口 */}
                        <a href={order?.payUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                            {t("wallet.openCashier")}
                        </a>
                        {pollError ? <Alert type="warning" showIcon message={pollError} /> : null}
                    </div>
                )}
            </Modal>
        </div>
    );
}
