import { ArrowLeft } from "lucide-react";
import { Alert, App, Button, Descriptions, Form, Input, InputNumber, Modal, Skeleton, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { computeSettlement, formatCredits } from "@/jc/lib/settlement";
import type { Job, JobStatus } from "@/jc/lib/job-types";
import { PLATFORM_FEE_RATE } from "@/jc/lib/job-types";
import { useRequireLogin } from "@/hooks/use-require-login";
import * as api from "@/jc/services/jobs";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletStore } from "@/jc/stores/use-wallet-store";
import { JobBriefView } from "./brief-view";
import { JobDeadline } from "./job-deadline";

const statusColor: Record<JobStatus, string> = {
    open: "blue",
    quoted: "geekblue",
    active: "processing",
    submitted: "gold",
    completed: "success",
    cancelled: "default",
    expired: "default",
};

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
            <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
                <Skeleton active paragraph={{ rows: 6 }} />
            </div>
        );
    }

    if (!job) {
        return (
            <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
                <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-stone-500">
                    <ArrowLeft className="size-4" />
                    {t("jobs.back")}
                </Link>
                <Typography.Title level={4}>{user ? t("jobs.notFound") : t("jobs.loginFirst")}</Typography.Title>
                {error && user ? <Alert type="warning" showIcon message={error} /> : null}
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
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
                <ArrowLeft className="size-4" />
                {t("jobs.back")}
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Typography.Title level={3} className="!mb-2">
                        {job.title}
                    </Typography.Title>
                    <Space size={4}>
                        <Tag color={statusColor[job.status]}>{t(`jobs.status.${job.status}`)}</Tag>
                        <JobDeadline job={job} />
                        {isClient ? <Tag>{t("jobs.youArePoster")}</Tag> : null}
                        {isCreator ? <Tag>{t("jobs.youAreTaker")}</Tag> : null}
                    </Space>
                </div>
                <Space wrap>
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
                    {isClient && openForQuote
                        ? job.quotes.map((quote) => (
                              <Button key={quote.id} type="primary" loading={busy} onClick={() => void run(() => api.acceptQuote(job.id, quote.id), "jobs.quoteAccepted")}>
                                  {t("jobs.acceptQuoteAmount", { amount: formatCredits(quote.amount) })}
                              </Button>
                          ))
                        : null}
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
                </Space>
            </div>

            <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label={t("jobs.fieldBudget")}>{formatCredits(job.budget)} credits</Descriptions.Item>
                <Descriptions.Item label={t("jobs.fieldBrief")}>
                    <JobBriefView markdown={job.brief} />
                </Descriptions.Item>
                <Descriptions.Item label={t("jobs.fieldWorkDays")}>{t("jobs.workDaysValue", { n: job.workDays })}</Descriptions.Item>
                <Descriptions.Item label={t("jobs.fieldJobDays")}>{job.jobDeadlineAt}</Descriptions.Item>
                {job.workDeadlineAt ? <Descriptions.Item label={t("jobs.deadlineWork")}>{job.workDeadlineAt}</Descriptions.Item> : null}
                {job.reviewDeadlineAt ? <Descriptions.Item label={t("jobs.deadlineReview")}>{job.reviewDeadlineAt}</Descriptions.Item> : null}
                {acceptedQuote ? <Descriptions.Item label={t("jobs.acceptedQuote")}>{formatCredits(acceptedQuote.amount)} credits</Descriptions.Item> : null}
                {job.expireReason ? <Descriptions.Item label={t("jobs.expireReason")}>{job.expireReason}</Descriptions.Item> : null}
            </Descriptions>

            {job.quotes.length ? (
                <div className="space-y-2">
                    <Typography.Title level={5}>{t("jobs.quotes")}</Typography.Title>
                    {job.quotes.map((quote) => (
                        <div key={quote.id} className="rounded-lg border border-stone-200 px-4 py-3 text-sm dark:border-stone-800">
                            <div className="flex items-center gap-2 font-medium">
                                {formatCredits(quote.amount)} credits
                                {quote.creatorId === userId ? <Tag>{t("jobs.yourQuote")}</Tag> : null}
                            </div>
                            <div className="text-stone-500">{quote.note || t("jobs.noNote")}</div>
                        </div>
                    ))}
                </div>
            ) : null}

            {job.delivery ? (
                <div className="space-y-2">
                    <Typography.Title level={5}>{t("jobs.delivery")}</Typography.Title>
                    <div className="rounded-lg border border-stone-200 px-4 py-3 text-sm dark:border-stone-800">
                        <div className="whitespace-pre-wrap">{job.delivery.content}</div>
                        {job.delivery.link ? (
                            <div className="mt-2">
                                <a href={job.delivery.link} target="_blank" rel="noreferrer">
                                    {job.delivery.link}
                                </a>
                            </div>
                        ) : null}
                        {job.delivery.canvasId ? (
                            <div className="mt-2">
                                <Link to={`/canvas/${job.delivery.canvasId}`}>{t("jobs.openCanvas")}</Link>
                            </div>
                        ) : null}
                        {job.delivery.rejectReason ? (
                            <div className="mt-2 text-amber-700 dark:text-amber-400">
                                {t("jobs.lastReject")}: {job.delivery.rejectReason}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {job.settlement ? (
                <div className="space-y-2">
                    <Typography.Title level={5}>{t("jobs.settlement")}</Typography.Title>
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label={t("jobs.settleQuote")}>{formatCredits(job.settlement.quoteAmount)}</Descriptions.Item>
                        <Descriptions.Item label={t("jobs.settleFee")}>
                            {formatCredits(job.settlement.platformFee)} ({Math.round(PLATFORM_FEE_RATE * 100)}%)
                        </Descriptions.Item>
                        <Descriptions.Item label={t("jobs.settlePayout")}>{formatCredits(job.settlement.creatorPayout)}</Descriptions.Item>
                        <Descriptions.Item label={t("jobs.settleCost")}>{formatCredits(job.settlement.costAmount)}</Descriptions.Item>
                        <Descriptions.Item label={t("jobs.settleProfit")}>{formatCredits(job.settlement.profit)}</Descriptions.Item>
                    </Descriptions>
                </div>
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
                <Alert type="info" showIcon className="!mb-4" message={t("jobs.depositNotice", { amount: formatCredits(job.depositAmount), days: job.workDays })} />
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
                        <Input.TextArea rows={4} />
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
                        <Typography.Paragraph type="secondary" className="!mb-0">
                            {t("jobs.settlePreview", {
                                fee: formatCredits(previewSettlement.platformFee),
                                payout: formatCredits(previewSettlement.creatorPayout),
                                profit: formatCredits(previewSettlement.profit),
                            })}
                        </Typography.Paragraph>
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
    );
}
