import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Skeleton, Steps, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { computeSettlement, formatCredits } from "@/jc/lib/settlement";
import type { Job } from "@/jc/lib/job-types";
import { JOB_STATUS_COLOR, PLATFORM_FEE_RATE } from "@/jc/lib/job-types";
import { useRequireLogin } from "@/hooks/use-require-login";
import * as api from "@/jc/services/jobs";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletStore } from "@/jc/stores/use-wallet-store";
import { JobBriefEditor } from "./brief-editor";
import { JobBriefView } from "./brief-view";
import { JobDeadline } from "./job-deadline";

export default function JobDetailPage() {
    const { id = "" } = useParams();
    const { t } = useTranslation();
    const { message } = App.useApp();
    const requireLogin = useRequireLogin();
    const user = useUserStore((state) => state.user);
    const refreshWallet = useWalletStore((state) => state.refresh);

    const [job, setJob] = useState<Job | null>(null);
    const [userId, setUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const [quoteOpen, setQuoteOpen] = useState(false);
    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [quoteForm] = Form.useForm<{ amount: number; note: string }>();
    const [deliveryForm] = Form.useForm<{ content: string; link?: string; canvasId?: string }>();
    const [acceptForm] = Form.useForm<{ costAmount: number }>();
    const [rejectForm] = Form.useForm<{ reason: string }>();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await api.getJob(id);
            setJob(data.job);
            setUserId(data.userId);
        } catch (err) {
            setJob(null);
            setError(err instanceof Error ? err.message : t("jobs.notFound"));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        if (user) void load();
        else setLoading(false);
    }, [load, user]);

    const acceptedQuote = useMemo(() => job?.quotes.find((quote) => quote.id === job.acceptedQuoteId), [job]);
    const previewCost = Form.useWatch("costAmount", acceptForm) ?? 0;
    const previewSettlement = acceptedQuote ? computeSettlement(acceptedQuote.amount, previewCost || 0) : null;

    /**
     * 跑一个动作，成功后重新拉工单和余额。
     * 权限和状态都由服务端判定，这里把它的拒绝原因原样弹出来 —— 那句话比「操作失败」有用得多。
     */
    const run = async (fn: () => Promise<unknown>, successKey: string, onDone?: () => void) => {
        if (!requireLogin()) return;
        setBusy(true);
        try {
            await fn();
            await Promise.all([load(), refreshWallet()]);
            message.success(t(successKey));
            onDone?.();
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("jobs.actionFailed"));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full overflow-y-auto">
                <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
                    <Skeleton active paragraph={{ rows: 6 }} />
                </div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="h-full overflow-y-auto">
                <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
                    <BackLink />
                    <Typography.Title level={4}>{user ? t("jobs.notFound") : t("jobs.loginFirst")}</Typography.Title>
                    {error && user ? <Alert type="warning" showIcon message={error} /> : null}
                    {!user ? (
                        <Button type="primary" onClick={() => requireLogin(`/jobs/${id}`)}>
                            {t("config.account.goLogin")}
                        </Button>
                    ) : null}
                </div>
            </div>
        );
    }

    // 能做什么由「你是谁」决定，不再由界面上的角色开关决定。这些判断只影响按钮显不显示，
    // 真正的拦截在服务端 —— 直接构造请求也越不过去。
    const isClient = job.clientId === userId;
    const isCreator = Boolean(job.creatorId) && job.creatorId === userId;
    const openForQuote = job.status === "open" || job.status === "quoted";
    const myQuote = job.quotes.find((quote) => quote.creatorId === userId);

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
                <BackLink />

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <Typography.Title level={3} className="!mb-2">
                            {job.title}
                        </Typography.Title>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Tag color={JOB_STATUS_COLOR[job.status]} className="!mr-0">
                                {t(`jobs.status.${job.status}`)}
                            </Tag>
                            <JobDeadline job={job} />
                            {isClient ? <Tag className="!mr-0">{t("jobs.youArePoster")}</Tag> : null}
                            {isCreator ? <Tag className="!mr-0">{t("jobs.youAreTaker")}</Tag> : null}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!isClient && openForQuote ? (
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (!requireLogin()) return;
                                    setQuoteOpen(true);
                                }}
                            >
                                {myQuote ? t("jobs.updateQuote") : t("jobs.submitQuote")}
                            </Button>
                        ) : null}
                        {isCreator && (job.status === "active" || job.status === "submitted") ? (
                            <Button
                                type="primary"
                                onClick={() => {
                                    if (!requireLogin()) return;
                                    setDeliveryOpen(true);
                                }}
                            >
                                {t("jobs.submitDelivery")}
                            </Button>
                        ) : null}
                        {isClient && job.status === "submitted" ? (
                            <>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        if (!requireLogin()) return;
                                        setAcceptOpen(true);
                                    }}
                                >
                                    {t("jobs.acceptDelivery")}
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!requireLogin()) return;
                                        setRejectOpen(true);
                                    }}
                                >
                                    {t("jobs.rejectDelivery")}
                                </Button>
                            </>
                        ) : null}
                        {isClient && job.status !== "completed" && job.status !== "cancelled" ? (
                            <Button danger loading={busy} onClick={() => void run(() => api.cancelJob(job.id), "jobs.cancelled")}>
                                {t("jobs.cancel")}
                            </Button>
                        ) : null}
                    </div>
                </div>

                <JobSteps job={job} />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label={t("jobs.labelBudget")} value={`${formatCredits(job.budget)} credits`} strong />
                    <Stat label={t("jobs.labelDeposit")} value={`${formatCredits(job.depositAmount)} credits`} />
                    <Stat label={t("jobs.fieldWorkDays")} value={t("jobs.workDaysValue", { n: job.workDays })} />
                    <Stat label={t("jobs.deadlineJob")} value={job.jobDeadlineAt.slice(0, 16)} />
                </div>

                {job.workDeadlineAt || job.reviewDeadlineAt || acceptedQuote || job.expireReason ? (
                    <Section title={t("jobs.detailMeta")}>
                        <div>
                            {acceptedQuote ? <Row label={t("jobs.acceptedQuote")}>{formatCredits(acceptedQuote.amount)} credits</Row> : null}
                            {job.workDeadlineAt ? <Row label={t("jobs.deadlineWork")}>{job.workDeadlineAt}</Row> : null}
                            {job.reviewDeadlineAt ? <Row label={t("jobs.deadlineReview")}>{job.reviewDeadlineAt}</Row> : null}
                            {job.expireReason ? <Row label={t("jobs.expireReason")}>{job.expireReason}</Row> : null}
                        </div>
                    </Section>
                ) : null}

                {/* 需求说明以前挤在 Descriptions 的一个格子里，图片和列表全被压扁，给它整块地方 */}
                <Section title={t("jobs.briefSection")}>
                    <JobBriefView markdown={job.brief} />
                </Section>

                <Section title={t("jobs.quotes")} extra={<span className="text-xs text-stone-400">{t("jobs.quotesCount", { n: job.quotes.length })}</span>}>
                    {job.quotes.length ? (
                        <div className="space-y-2">
                            {job.quotes.map((quote) => {
                                const accepted = quote.id === job.acceptedQuoteId;
                                return (
                                    <div
                                        key={quote.id}
                                        className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${accepted ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-stone-200 dark:border-stone-800"}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 font-medium tabular-nums">
                                                {formatCredits(quote.amount)} credits
                                                {quote.creatorId === userId ? <Tag className="!mr-0">{t("jobs.yourQuote")}</Tag> : null}
                                                {accepted ? (
                                                    <Tag color="success" className="!mr-0">
                                                        {t("jobs.acceptedQuote")}
                                                    </Tag>
                                                ) : null}
                                            </div>
                                            <div className="mt-0.5 whitespace-pre-wrap text-stone-500 dark:text-stone-400">{quote.note || t("jobs.noNote")}</div>
                                        </div>
                                        {/* 接受报价从页头挪到这一行：报价有几条页头就长几个按钮，那样根本看不出接的是谁 */}
                                        {isClient && openForQuote ? (
                                            <Button size="small" type="primary" loading={busy} onClick={() => void run(() => api.acceptQuote(job.id, quote.id), "jobs.quoteAccepted")}>
                                                {t("jobs.acceptQuote")}
                                            </Button>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-2 text-sm text-stone-400">{t("jobs.noQuotes")}</div>
                    )}
                </Section>

                {job.delivery ? (
                    <Section title={t("jobs.delivery")} extra={<span className="text-xs text-stone-400">{job.delivery.submittedAt}</span>}>
                        {/* 交付说明和需求说明走同一套 Markdown 渲染：以前是纯文本，雇主那边贴的图片链接只会显示成一行字 */}
                        <JobBriefView markdown={job.delivery.content} />
                        {job.delivery.link ? (
                            <a href={job.delivery.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm">
                                <ExternalLink className="size-3.5" />
                                {job.delivery.link}
                            </a>
                        ) : null}
                        {job.delivery.canvasId ? (
                            <div>
                                <Link to={`/canvas/${job.delivery.canvasId}`} className="text-sm">
                                    {t("jobs.openCanvas")}
                                </Link>
                            </div>
                        ) : null}
                        {job.delivery.rejectReason ? <Alert type="warning" showIcon message={`${t("jobs.lastReject")}: ${job.delivery.rejectReason}`} /> : null}
                    </Section>
                ) : null}

                {job.settlement ? (
                    <Section title={t("jobs.settlement")} extra={<span className="text-xs text-stone-400">{job.settlement.settledAt}</span>}>
                        <div>
                            <Row label={t("jobs.settleQuote")}>{formatCredits(job.settlement.quoteAmount)}</Row>
                            <Row label={`${t("jobs.settleFee")} · ${Math.round(PLATFORM_FEE_RATE * 100)}%`}>{formatCredits(job.settlement.platformFee)}</Row>
                            <Row label={t("jobs.settlePayout")}>{formatCredits(job.settlement.creatorPayout)}</Row>
                            <Row label={t("jobs.settleCost")}>{formatCredits(job.settlement.costAmount)}</Row>
                            <Row label={t("jobs.settleProfit")}>{formatCredits(job.settlement.profit)}</Row>
                        </div>
                    </Section>
                ) : null}

                <Modal
                    title={myQuote ? t("jobs.updateQuote") : t("jobs.submitQuote")}
                    open={quoteOpen}
                    confirmLoading={busy}
                    onCancel={() => setQuoteOpen(false)}
                    onOk={async () => {
                        const values = await quoteForm.validateFields();
                        await run(
                            () => api.submitQuote(job.id, values.amount, values.note || ""),
                            "jobs.quoteSubmitted",
                            () => {
                                setQuoteOpen(false);
                                quoteForm.resetFields();
                            },
                        );
                    }}
                    destroyOnHidden
                >
                    {/* 主题把 colorInfo 设成了近黑（app-theme.ts），antd 的 info Alert 会变成一块黑板，这里自己画一个提示框 */}
                    <div className="mb-4 flex gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-600 dark:border-stone-800 dark:bg-white/[0.03] dark:text-stone-300">
                        <Info className="mt-0.5 size-4 shrink-0 text-stone-400" />
                        <span>{t("jobs.depositNotice", { amount: formatCredits(job.depositAmount), days: job.workDays })}</span>
                    </div>
                    <Form form={quoteForm} layout="vertical" initialValues={{ amount: myQuote?.amount ?? job.budget, note: myQuote?.note ?? "" }}>
                        <Form.Item name="amount" label={t("jobs.quoteAmount")} rules={[{ required: true }]}>
                            <InputNumber min={1} className="w-full" addonAfter="credits" />
                        </Form.Item>
                        <Form.Item name="note" label={t("jobs.quoteNote")}>
                            <Input.TextArea rows={3} />
                        </Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title={t("jobs.submitDelivery")}
                    open={deliveryOpen}
                    confirmLoading={busy}
                    onCancel={() => setDeliveryOpen(false)}
                    onOk={async () => {
                        const values = await deliveryForm.validateFields();
                        await run(
                            () => api.submitDelivery(job.id, values),
                            "jobs.deliverySubmitted",
                            () => {
                                setDeliveryOpen(false);
                                deliveryForm.resetFields();
                            },
                        );
                    }}
                    destroyOnHidden
                >
                    <Form form={deliveryForm} layout="vertical">
                        <Form.Item name="content" label={t("jobs.deliveryContent")} rules={[{ required: true }]}>
                            <JobBriefEditor />
                        </Form.Item>
                        <Form.Item name="link" label={t("jobs.deliveryLink")}>
                            <Input placeholder="https://" />
                        </Form.Item>
                        <Form.Item name="canvasId" label={t("jobs.deliveryCanvas")}>
                            <Input placeholder="canvas id" />
                        </Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title={t("jobs.acceptDelivery")}
                    open={acceptOpen}
                    confirmLoading={busy}
                    onCancel={() => setAcceptOpen(false)}
                    onOk={async () => {
                        const values = await acceptForm.validateFields();
                        await run(
                            () => api.acceptDelivery(job.id, values.costAmount || 0),
                            "jobs.settled",
                            () => {
                                setAcceptOpen(false);
                                acceptForm.resetFields();
                            },
                        );
                    }}
                    destroyOnHidden
                >
                    <Form form={acceptForm} layout="vertical" initialValues={{ costAmount: 0 }}>
                        <Form.Item name="costAmount" label={t("jobs.costAmount")} rules={[{ required: true }]}>
                            <InputNumber min={0} className="w-full" addonAfter="credits" />
                        </Form.Item>
                        {previewSettlement ? (
                            <div className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
                                {t("jobs.settlePreview", {
                                    fee: formatCredits(previewSettlement.platformFee),
                                    payout: formatCredits(previewSettlement.creatorPayout),
                                    profit: formatCredits(previewSettlement.profit),
                                })}
                            </div>
                        ) : null}
                    </Form>
                </Modal>

                <Modal
                    title={t("jobs.rejectDelivery")}
                    open={rejectOpen}
                    confirmLoading={busy}
                    onCancel={() => setRejectOpen(false)}
                    onOk={async () => {
                        const values = await rejectForm.validateFields();
                        await run(
                            () => api.rejectDelivery(job.id, values.reason.trim() || t("jobs.rejectDefault")),
                            "jobs.rejected",
                            () => {
                                setRejectOpen(false);
                                rejectForm.resetFields();
                            },
                        );
                    }}
                    destroyOnHidden
                >
                    <Form form={rejectForm} layout="vertical">
                        <Form.Item name="reason" label={t("jobs.rejectReason")} rules={[{ required: true }]}>
                            <Input.TextArea rows={3} />
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </div>
    );
}

function BackLink() {
    const { t } = useTranslation();
    return (
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
            <ArrowLeft className="size-4" />
            {t("jobs.back")}
        </Link>
    );
}

/**
 * 工单走到哪一步了。四个状态字段（status / acceptedQuoteId / delivery / settlement）
 * 拼起来才能说清进度，一个状态徽章说不了；取消和过期停在当前那一步标红。
 */
function JobSteps({ job }: { job: Job }) {
    const { t } = useTranslation();
    // 步骤：0 发布 → 1 报价接单 → 2 交付 → 3 验收结算。current 指「正在进行的那一步」，
    // 4 表示四步都走完了。取消/过期就停在它当时进行到的那一步。
    const dead = job.status === "cancelled" || job.status === "expired";
    const current = dead ? (job.acceptedQuoteId ? 2 : 1) : job.status === "completed" ? 4 : job.status === "submitted" ? 3 : job.status === "active" ? 2 : 1;

    return (
        <div className="rounded-xl border border-stone-200 px-5 py-4 dark:border-stone-800">
            <Steps
                size="small"
                current={current}
                status={dead ? "error" : job.status === "completed" ? "finish" : "process"}
                items={[{ title: t("jobs.stepPost") }, { title: t("jobs.stepQuote") }, { title: t("jobs.stepDeliver") }, { title: t("jobs.stepSettle") }]}
            />
        </div>
    );
}

function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
    return (
        <section className="space-y-3 rounded-xl border border-stone-200 px-4 py-4 dark:border-stone-800">
            <div className="flex items-center justify-between gap-3">
                <h2 className="!mb-0 text-sm font-semibold">{title}</h2>
                {extra}
            </div>
            {children}
        </section>
    );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800">
            <div className="text-xs text-stone-500">{label}</div>
            <div className={`mt-1 tabular-nums ${strong ? "text-lg font-semibold" : "text-sm text-stone-600 dark:text-stone-300"}`}>{value}</div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-t border-stone-100 py-2 text-sm first:border-t-0 first:pt-0 dark:border-stone-800/70">
            <span className="text-stone-500">{label}</span>
            <span className="text-right tabular-nums">{children}</span>
        </div>
    );
}
