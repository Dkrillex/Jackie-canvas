import { BriefcaseBusiness, Plus, RefreshCw, Wallet } from "lucide-react";
import { App, Button, Form, Input, InputNumber, Modal, Segmented, Space, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { availableCredits, formatCredits } from "@/lib/jobs/settlement";
import type { Job, JobRole, JobStatus } from "@/lib/jobs/types";
import { useRequireLogin } from "@/hooks/use-require-login";
import { useJobStore } from "@/stores/use-job-store";
import { JobBriefEditor } from "./job-brief-editor";

const statusColor: Record<JobStatus, string> = {
    open: "blue",
    quoted: "geekblue",
    active: "processing",
    submitted: "gold",
    completed: "success",
    cancelled: "default",
};

export default function JobsPage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const requireLogin = useRequireLogin();
    const [tab, setTab] = useState<"hall" | "mine" | "wallet">("hall");
    const [createOpen, setCreateOpen] = useState(false);
    const [rechargeOpen, setRechargeOpen] = useState(false);
    const [createForm] = Form.useForm<{ title: string; brief: string; budget: number }>();
    const [rechargeForm] = Form.useForm<{ amount: number }>();

    const role = useJobStore((s) => s.role);
    const setRole = useJobStore((s) => s.setRole);
    const jobs = useJobStore((s) => s.jobs);
    const wallets = useJobStore((s) => s.wallets);
    const ledger = useJobStore((s) => s.ledger);
    const createJob = useJobStore((s) => s.createJob);
    const recharge = useJobStore((s) => s.recharge);
    const resetDemo = useJobStore((s) => s.resetDemo);
    const wallet = wallets[role];

    const visibleJobs = useMemo(() => {
        if (tab === "hall") return jobs.filter((job) => job.status === "open" || job.status === "quoted");
        if (role === "client") return jobs.filter((job) => job.clientId === "client");
        return jobs.filter((job) => job.creatorId === "creator" || job.quotes.some((q) => q.creatorId === "creator"));
    }, [jobs, role, tab]);

    const roleLedger = useMemo(() => ledger.filter((entry) => entry.role === role), [ledger, role]);

    const onCreate = async () => {
        if (!requireLogin()) return;
        const values = await createForm.validateFields();
        const id = createJob(values);
        setCreateOpen(false);
        createForm.resetFields();
        message.success(t("jobs.created"));
        return id;
    };

    const onRecharge = async () => {
        if (!requireLogin()) return;
        const values = await rechargeForm.validateFields();
        try {
            recharge(values.amount);
            setRechargeOpen(false);
            rechargeForm.resetFields();
            message.success(t("jobs.recharged"));
        } catch {
            message.error(t("jobs.invalidAmount"));
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Typography.Title level={3} className="!mb-1 !flex items-center gap-2">
                        <BriefcaseBusiness className="size-6" />
                        {t("jobs.title")}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" className="!mb-0">
                        {t("jobs.subtitle")}
                    </Typography.Paragraph>
                </div>
                <Space wrap>
                    <Segmented
                        value={role}
                        onChange={(value) => setRole(value as JobRole)}
                        options={[
                            { label: t("jobs.roleClient"), value: "client" },
                            { label: t("jobs.roleCreator"), value: "creator" },
                        ]}
                    />
                    <Button icon={<RefreshCw className="size-4" />} onClick={() => { resetDemo(); message.success(t("jobs.resetDone")); }}>
                        {t("jobs.resetDemo")}
                    </Button>
                </Space>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800">
                <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <Wallet className="size-4" />
                    <span>
                        {t("jobs.walletSummary", {
                            balance: formatCredits(wallet.balance),
                            frozen: formatCredits(wallet.frozen),
                            available: formatCredits(availableCredits(wallet.balance, wallet.frozen)),
                        })}
                    </span>
                </div>
                <Space>
                    <Button type="primary" onClick={() => { if (!requireLogin()) return; setRechargeOpen(true); }}>
                        {t("jobs.mockRecharge")}
                    </Button>
                    {role === "client" ? (
                        <Button icon={<Plus className="size-4" />} onClick={() => { if (!requireLogin()) return; setCreateOpen(true); }}>
                            {t("jobs.create")}
                        </Button>
                    ) : null}
                </Space>
            </div>

            <Segmented
                value={tab}
                onChange={(value) => setTab(value as typeof tab)}
                options={[
                    { label: t("jobs.tabHall"), value: "hall" },
                    { label: t("jobs.tabMine"), value: "mine" },
                    { label: t("jobs.tabWallet"), value: "wallet" },
                ]}
            />

            {tab === "wallet" ? (
                <Table
                    rowKey="id"
                    size="middle"
                    pagination={{ pageSize: 8 }}
                    dataSource={roleLedger}
                    columns={[
                        { title: t("jobs.ledgerTime"), dataIndex: "createdAt", render: (value: string) => new Date(value).toLocaleString() },
                        { title: t("jobs.ledgerKind"), dataIndex: "kind", render: (value: string) => t(`jobs.ledgerKinds.${value}`, { defaultValue: value }) },
                        {
                            title: t("jobs.ledgerAmount"),
                            dataIndex: "amount",
                            render: (value: number) => `${value >= 0 ? "+" : ""}${formatCredits(value)}`,
                        },
                        { title: t("jobs.ledgerNote"), dataIndex: "note" },
                    ]}
                />
            ) : (
                <Table
                    rowKey="id"
                    size="middle"
                    pagination={{ pageSize: 8 }}
                    dataSource={visibleJobs}
                    locale={{ emptyText: t("jobs.empty") }}
                    columns={[
                        {
                            title: t("jobs.colTitle"),
                            dataIndex: "title",
                            render: (title: string, job: Job) => <Link to={`/jobs/${job.id}`}>{title}</Link>,
                        },
                        {
                            title: t("jobs.colStatus"),
                            dataIndex: "status",
                            width: 120,
                            render: (status: JobStatus) => <Tag color={statusColor[status]}>{t(`jobs.status.${status}`)}</Tag>,
                        },
                        {
                            title: t("jobs.colBudget"),
                            dataIndex: "budget",
                            width: 120,
                            render: (value: number) => formatCredits(value),
                        },
                        {
                            title: t("jobs.colUpdated"),
                            dataIndex: "updatedAt",
                            width: 180,
                            render: (value: string) => new Date(value).toLocaleString(),
                        },
                        {
                            title: t("jobs.colAction"),
                            width: 100,
                            render: (_: unknown, job: Job) => <Link to={`/jobs/${job.id}`}>{t("jobs.open")}</Link>,
                        },
                    ]}
                />
            )}

            <Modal title={t("jobs.create")} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={onCreate} width={720} destroyOnHidden>
                <Form form={createForm} layout="vertical" initialValues={{ budget: 50, brief: "" }}>
                    <Form.Item name="title" label={t("jobs.fieldTitle")} rules={[{ required: true }]}>
                        <Input maxLength={80} />
                    </Form.Item>
                    <Form.Item name="brief" label={t("jobs.fieldBrief")} rules={[{ required: true, message: t("jobs.briefRequired") }]}>
                        <JobBriefEditor />
                    </Form.Item>
                    <Form.Item name="budget" label={t("jobs.fieldBudget")} rules={[{ required: true }]}>
                        <InputNumber min={1} step={1} className="w-full" addonAfter="credits" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title={t("jobs.mockRecharge")} open={rechargeOpen} onCancel={() => setRechargeOpen(false)} onOk={onRecharge} destroyOnHidden>
                <Form form={rechargeForm} layout="vertical" initialValues={{ amount: 50 }}>
                    <Form.Item name="amount" label={t("jobs.rechargeAmount")} rules={[{ required: true }]}>
                        <InputNumber min={1} step={10} className="w-full" addonAfter="credits ($)" />
                    </Form.Item>
                    <Typography.Paragraph type="secondary" className="!mb-0">
                        {t("jobs.creditHint")}
                    </Typography.Paragraph>
                </Form>
            </Modal>
        </div>
    );
}
