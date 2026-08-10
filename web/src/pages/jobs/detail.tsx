import { ArrowLeft } from "lucide-react";
import { App, Button, Descriptions, Form, Input, InputNumber, Modal, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { computeSettlement, formatCredits } from "@/lib/jobs/settlement";
import type { JobStatus } from "@/lib/jobs/types";
import { PLATFORM_FEE_RATE } from "@/lib/jobs/types";
import { useRequireLogin } from "@/hooks/use-require-login";
import { useJobStore } from "@/stores/use-job-store";
import { JobBriefView } from "./job-brief-view";

const statusColor: Record<JobStatus, string> = {
    open: "blue",
    quoted: "geekblue",
    active: "processing",
    submitted: "gold",
    completed: "success",
    cancelled: "default",
};

export default function JobDetailPage() {
    const { id = "" } = useParams();
    const { t } = useTranslation();
    const { message } = App.useApp();
    const requireLogin = useRequireLogin();
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [quoteForm] = Form.useForm<{ amount: number; note: string }>();
    const [deliveryForm] = Form.useForm<{ content: string; link?: string; canvasId?: string }>();
    const [acceptForm] = Form.useForm<{ costAmount: number }>();
    const [rejectForm] = Form.useForm<{ reason: string }>();

    const role = useJobStore((s) => s.role);
    const job = useJobStore((s) => s.jobs.find((item) => item.id === id));
    const submitQuote = useJobStore((s) => s.submitQuote);
    const acceptQuote = useJobStore((s) => s.acceptQuote);
    const submitDelivery = useJobStore((s) => s.submitDelivery);
    const rejectDelivery = useJobStore((s) => s.rejectDelivery);
    const acceptDelivery = useJobStore((s) => s.acceptDelivery);
    const cancelJob = useJobStore((s) => s.cancelJob);

    const acceptedQuote = useMemo(() => job?.quotes.find((quote) => quote.id === job.acceptedQuoteId), [job]);
    const previewCost = Form.useWatch("costAmount", acceptForm) ?? 0;
    const previewSettlement = acceptedQuote ? computeSettlement(acceptedQuote.amount, previewCost || 0) : null;

    if (!job) {
        return (
            <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
                <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-stone-500">
                    <ArrowLeft className="size-4" />
                    {t("jobs.back")}
                </Link>
                <Typography.Title level={4}>{t("jobs.notFound")}</Typography.Title>
            </div>
        );
    }

    const run = (fn: () => void, successKey: string) => {
        if (!requireLogin()) return;
        try {
            fn();
            message.success(t(successKey));
        } catch (error) {
            const code = error instanceof Error ? error.message : "";
            message.error(t(code === "insufficient_credits" ? "jobs.insufficient" : "jobs.actionFailed"));
        }
    };

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
                    <Tag color={statusColor[job.status]}>{t(`jobs.status.${job.status}`)}</Tag>
                </div>
                <Space wrap>
                    {role === "creator" && (job.status === "open" || job.status === "quoted") ? (
                        <Button type="primary" onClick={() => { if (!requireLogin()) return; setQuoteOpen(true); }}>
                            {t("jobs.submitQuote")}
                        </Button>
                    ) : null}
                    {role === "client" && job.status === "quoted"
                        ? job.quotes.map((quote) => (
                              <Button key={quote.id} type="primary" onClick={() => run(() => acceptQuote(job.id, quote.id), "jobs.quoteAccepted")}>
                                  {t("jobs.acceptQuoteAmount", { amount: formatCredits(quote.amount) })}
                              </Button>
                          ))
                        : null}
                    {role === "creator" && (job.status === "active" || job.status === "submitted") ? (
                        <Button type="primary" onClick={() => { if (!requireLogin()) return; setDeliveryOpen(true); }}>
                            {t("jobs.submitDelivery")}
                        </Button>
                    ) : null}
                    {role === "client" && job.status === "submitted" ? (
                        <>
                            <Button type="primary" onClick={() => { if (!requireLogin()) return; setAcceptOpen(true); }}>
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
                    {role === "client" && job.status !== "completed" && job.status !== "cancelled" ? (
                        <Button danger onClick={() => run(() => cancelJob(job.id), "jobs.cancelled")}>
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
                {acceptedQuote ? (
                    <Descriptions.Item label={t("jobs.acceptedQuote")}>{formatCredits(acceptedQuote.amount)} credits</Descriptions.Item>
                ) : null}
            </Descriptions>

            {job.quotes.length ? (
                <div className="space-y-2">
                    <Typography.Title level={5}>{t("jobs.quotes")}</Typography.Title>
                    {job.quotes.map((quote) => (
                        <div key={quote.id} className="rounded-lg border border-stone-200 px-4 py-3 text-sm dark:border-stone-800">
                            <div className="font-medium">{formatCredits(quote.amount)} credits</div>
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
                title={t("jobs.submitQuote")}
                open={quoteOpen}
                onCancel={() => setQuoteOpen(false)}
                onOk={async () => {
                    const values = await quoteForm.validateFields();
                    run(() => {
                        submitQuote(job.id, values.amount, values.note || "");
                        setQuoteOpen(false);
                        quoteForm.resetFields();
                    }, "jobs.quoteSubmitted");
                }}
                destroyOnHidden
            >
                <Form form={quoteForm} layout="vertical" initialValues={{ amount: job.budget, note: "" }}>
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
                onCancel={() => setDeliveryOpen(false)}
                onOk={async () => {
                    const values = await deliveryForm.validateFields();
                    run(() => {
                        submitDelivery(job.id, values);
                        setDeliveryOpen(false);
                        deliveryForm.resetFields();
                    }, "jobs.deliverySubmitted");
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
                onCancel={() => setAcceptOpen(false)}
                onOk={async () => {
                    const values = await acceptForm.validateFields();
                    run(() => {
                        acceptDelivery(job.id, values.costAmount || 0);
                        setAcceptOpen(false);
                        acceptForm.resetFields();
                    }, "jobs.settled");
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
                onCancel={() => setRejectOpen(false)}
                onOk={async () => {
                    const values = await rejectForm.validateFields();
                    rejectDelivery(job.id, values.reason.trim() || t("jobs.rejectDefault"));
                    setRejectOpen(false);
                    rejectForm.resetFields();
                    message.success(t("jobs.rejected"));
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
