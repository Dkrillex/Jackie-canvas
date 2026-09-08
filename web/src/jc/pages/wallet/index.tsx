import { Alert, App, Button, InputNumber, Modal, Result, Spin, Table, Tabs, Tag, Typography } from "antd";
import { ArrowRightLeft, CheckCircle2, QrCode, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRequireLogin } from "@/hooks/use-require-login";
import { createExchange, listExchanges, listRechargeOrders, listWalletLedger, type CreditExchange, type LedgerEntry, type RechargeRecord } from "@/jc/services/wallet";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletStore } from "@/jc/stores/use-wallet-store";
import { BUSINESS_MAIL, BUSINESS_MAIL_TEXT, BUSINESS_WECHAT_QR, MAX_RECHARGE_YUAN } from "@/jc/config";
import { useRecharge } from "./use-recharge";

const statusColor: Record<string, string> = { created: "gold", paid: "success", closed: "default" };
const exchangeStatusColor: Record<string, string> = { pending: "processing", done: "success", failed: "error" };

export default function WalletPage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const requireLogin = useRequireLogin();
    const user = useUserStore((state) => state.user);

    const { balance, frozen, available, loading, error, refresh, clear } = useWalletStore();
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [records, setRecords] = useState<RechargeRecord[]>([]);
    const [exchanges, setExchanges] = useState<CreditExchange[]>([]);
    const [selected, setSelected] = useState("");
    const [exchangeCredits, setExchangeCredits] = useState<number | null>(10);
    const [exchanging, setExchanging] = useState(false);
    const [businessOpen, setBusinessOpen] = useState(false);

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
            listExchanges()
                .then((data) => setExchanges(data.exchanges))
                .catch(() => undefined),
        ]);
    }, [refresh]);

    useEffect(() => {
        if (user) void reload();
        else clear();
    }, [clear, reload, user]);

    const { packages, enabled, missing, loadError, order, creating, paid, pollError, start, reset } = useRecharge(reload);
    const visiblePackages = packages.filter((item) => Number(item.amount) <= MAX_RECHARGE_YUAN);

    useEffect(() => {
        if (visiblePackages.length && !visiblePackages.some((item) => item.id === selected)) {
            setSelected(visiblePackages[0].id);
        }
    }, [visiblePackages, selected]);

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

    const exchange = async () => {
        if (!requireLogin()) return;
        if (!exchangeCredits || exchangeCredits <= 0) return;
        setExchanging(true);
        try {
            await createExchange(exchangeCredits);
            await reload();
            message.success(t("wallet.exchangeSubmitted"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("wallet.exchangeFailed"));
        } finally {
            setExchanging(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
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
                    {user ? (
                        <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void reload()}>
                            {t("wallet.refresh")}
                        </Button>
                    ) : null}
                </div>

                {/* 主题把 colorInfo 设成了近黑（app-theme.ts），antd 的 info Alert 会变成一块黑板 */}
                {!user ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white/60 py-14 text-center dark:border-stone-800 dark:bg-white/[0.02]">
                        <div className="flex size-11 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                            <Wallet className="size-5 text-stone-500" />
                        </div>
                        <div className="text-sm text-stone-500 dark:text-stone-400">{t("wallet.loginFirst")}</div>
                        <Button type="primary" onClick={() => requireLogin("/wallet")}>
                            {t("config.account.goLogin")}
                        </Button>
                    </div>
                ) : (
                    <>
                        {error ? <Alert type="warning" showIcon message={error} /> : null}
                        {loadError ? <Alert type="warning" showIcon message={loadError} /> : null}
                        {!loadError && !enabled && packages.length ? <Alert type="warning" showIcon message={t(missing.length === 1 ? `wallet.unavailable_${missing[0]}` : "wallet.unavailable")} /> : null}

                        {/* 三张大卡各放一个小数字，中间全是空白；收成一条，可用额仍然是最大的那个数 */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-stone-200 bg-white/60 px-5 py-4 dark:border-stone-800 dark:bg-white/[0.02]">
                            <Wallet className="size-4 shrink-0 text-stone-400" />
                            {[
                                { label: t("wallet.available"), value: available, strong: true },
                                { label: t("wallet.balance"), value: balance, strong: false },
                                { label: t("wallet.frozen"), value: frozen, strong: false },
                            ].map((item, index) => (
                                <div key={item.label} className={index ? "border-stone-200 pl-6 sm:border-l dark:border-stone-800" : ""}>
                                    <div className="text-[11px] text-stone-400">{item.label}</div>
                                    <div className={`tabular-nums ${item.strong ? "text-2xl font-semibold" : "text-lg text-stone-500 dark:text-stone-400"}`}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white/60 px-5 py-4 dark:border-stone-800 dark:bg-white/[0.02]">
                            <div className="text-sm font-semibold">{t("wallet.pickPackage")}</div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {visiblePackages.map((item) => {
                                    const active = item.id === selected;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelected(item.id)}
                                            className={`rounded-xl border px-4 py-3.5 text-left transition ${active ? "border-stone-900 bg-stone-50 dark:border-stone-100 dark:bg-white/[0.06]" : "border-stone-200 hover:border-stone-400 dark:border-stone-800 dark:hover:border-stone-600"}`}
                                        >
                                            <div className="text-xl font-semibold tabular-nums">¥{item.amount}</div>
                                            <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t("wallet.packageCredits", { credits: item.credits })}</div>
                                            {Number(item.bonus) > 0 ? (
                                                <Tag color="orange" className="!mr-0 mt-2">
                                                    {t("wallet.bonus", { bonus: item.bonus })}
                                                </Tag>
                                            ) : null}
                                        </button>
                                    );
                                })}
                                {/* 200 元以上走商务，样式做成虚线以示它不是一个可付款的档位 */}
                                <button
                                    type="button"
                                    onClick={() => setBusinessOpen(true)}
                                    className="rounded-xl border border-dashed border-stone-300 px-4 py-3.5 text-left transition hover:border-stone-500 dark:border-stone-700 dark:hover:border-stone-500"
                                >
                                    <div className="text-xl font-semibold">{t("wallet.enterpriseTitle")}</div>
                                    <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t("wallet.enterpriseHint")}</div>
                                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-stone-900 dark:text-stone-100">
                                        <QrCode className="size-3.5" />
                                        {t("wallet.enterpriseContact")}
                                    </div>
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
                                <span className="text-xs text-stone-400">{t("wallet.payHintShort")}</span>
                                <Button type="primary" loading={creating} disabled={!enabled || !selected} onClick={() => void pay()}>
                                    {t("wallet.pay")}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white/60 px-5 py-4 dark:border-stone-800 dark:bg-white/[0.02]">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <ArrowRightLeft className="size-4" />
                                {t("wallet.exchangeTitle")}
                            </div>
                            <div className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">{t("wallet.exchangeHint")}</div>
                            <div className="flex flex-wrap items-center gap-3">
                                {/* 上限就是可用积分本身。`|| 1` 那种写法在余额为 0 时会让上限变成 1，看着像还能兑换 1 积分 */}
                                <InputNumber min={1} max={Number(available)} value={exchangeCredits} onChange={setExchangeCredits} className="w-48" addonAfter={t("wallet.creditsUnit")} />
                                <Button type="primary" loading={exchanging} disabled={!user || !exchangeCredits || exchangeCredits > Number(available)} onClick={() => void exchange()}>
                                    {t("wallet.exchangeConfirm")}
                                </Button>
                                <span className="text-xs text-stone-500">{t("wallet.exchangeAvailable", { available })}</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-stone-200 bg-white/60 px-5 pb-2 dark:border-stone-800 dark:bg-white/[0.02]">
                            <Tabs
                                items={[
                                    {
                                        key: "ledger",
                                        label: t("wallet.tabLedger"),
                                        children: (
                                            <Table<LedgerEntry>
                                                rowKey="id"
                                                size="small"
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
                                                size="small"
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
                                    {
                                        key: "exchanges",
                                        label: t("wallet.tabExchanges"),
                                        children: (
                                            <Table<CreditExchange>
                                                rowKey="id"
                                                size="small"
                                                dataSource={exchanges}
                                                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                                                columns={[
                                                    { title: t("wallet.time"), dataIndex: "createdAt", width: 180 },
                                                    { title: t("wallet.exchangeCredits"), dataIndex: "credits", width: 120, align: "right", render: (value: string) => <span className="tabular-nums">{value}</span> },
                                                    { title: t("wallet.status"), dataIndex: "status", width: 130, render: (status: string) => <Tag color={exchangeStatusColor[status] || "default"}>{t(`wallet.exchange_${status}`, status)}</Tag> },
                                                    { title: t("wallet.gwRef"), dataIndex: "gwRef", render: (value: string | null, row: CreditExchange) => value || row.note || "—" },
                                                ]}
                                            />
                                        ),
                                    },
                                ]}
                            />
                        </div>
                    </>
                )}

                <Modal open={businessOpen} onCancel={() => setBusinessOpen(false)} footer={null} title={t("wallet.businessTitle")} width={380}>
                    <div className="flex flex-col items-center gap-3 pb-2 pt-1 text-center">
                        <div className="text-sm text-stone-500 dark:text-stone-400">{t("wallet.businessHint")}</div>
                        <img src={BUSINESS_WECHAT_QR} alt={t("wallet.businessTitle")} className="size-52 rounded-xl border border-stone-200 object-cover dark:border-stone-800" />
                        <div className="text-xs text-stone-400">
                            {t("wallet.businessMail")}
                            <a href={BUSINESS_MAIL} className="ml-1">
                                {BUSINESS_MAIL_TEXT}
                            </a>
                        </div>
                    </div>
                </Modal>

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
        </div>
    );
}
