import { BriefcaseBusiness, Plus, RefreshCw, Wallet } from "lucide-react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Segmented, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { formatCredits } from "@/lib/jobs/settlement";
import type { Job, JobScope, JobStatus } from "@/lib/jobs/types";
import { useRequireLogin } from "@/hooks/use-require-login";
import { useJobStore } from "@/stores/use-job-store";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletStore } from "@/stores/use-wallet-store";
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
    const user = useUserStore((state) => state.user);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm] = Form.useForm<{ title: string; brief: string; budget: number }>();

    const scope = useJobStore((s) => s.scope);
    const setScope = useJobStore((s) => s.setScope);
    const jobs = useJobStore((s) => s.jobs);
    const loading = useJobStore((s) => s.loading);
    const error = useJobStore((s) => s.error);
    const refresh = useJobStore((s) => s.refresh);
    const clear = useJobStore((s) => s.clear);
    const createJob = useJobStore((s) => s.createJob);

    const balance = useWalletStore((s) => s.balance);
    const frozen = useWalletStore((s) => s.frozen);
    const available = useWalletStore((s) => s.available);
    const refreshWallet = useWalletStore((s) => s.refresh);

    useEffect(() => {
        if (!user) {
            clear();
            return;
        }
        void refresh();
        void refreshWallet();
    }, [clear, refresh, refreshWallet, user]);

    const onCreate = async () => {
        if (!requireLogin()) return;
        const values = await createForm.validateFields();
        setCreating(true);
        try {
            await createJob(values);
            setCreateOpen(false);
            createForm.resetFields();
            message.success(t("jobs.created"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("jobs.actionFailed"));
        } finally {
            setCreating(false);
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
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>
                        {t("jobs.refresh")}
                    </Button>
                    <Button
                        type="primary"
                        icon={<Plus className="size-4" />}
                        onClick={() => {
                            if (!requireLogin()) return;
                            setCreateOpen(true);
                        }}
                    >
                        {t("jobs.create")}
                    </Button>
                </Space>
            </div>

            {!user ? <Alert type="info" showIcon message={t("jobs.loginFirst")} /> : null}
            {error ? <Alert type="warning" showIcon message={error} /> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800">
                <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <Wallet className="size-4" />
                    <span>{t("jobs.walletSummary", { balance, frozen, available })}</span>
                </div>
                {/* 充值是真实支付，统一走 /wallet 那条链路，这里只做入口 */}
                <Link to="/wallet">
                    <Button type="primary">{t("jobs.goRecharge")}</Button>
                </Link>
            </div>

            <Segmented
                value={scope}
                onChange={(value) => setScope(value as JobScope)}
                options={[
                    { label: t("jobs.tabHall"), value: "hall" },
                    { label: t("jobs.tabPosted"), value: "client" },
                    { label: t("jobs.tabTaken"), value: "creator" },
                ]}
            />

            <Table
                rowKey="id"
                size="middle"
                loading={loading}
                pagination={{ pageSize: 8 }}
                dataSource={jobs}
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
                    },
                    {
                        title: t("jobs.colAction"),
                        width: 100,
                        render: (_: unknown, job: Job) => <Link to={`/jobs/${job.id}`}>{t("jobs.open")}</Link>,
                    },
                ]}
            />

            <Modal title={t("jobs.create")} open={createOpen} confirmLoading={creating} onCancel={() => setCreateOpen(false)} onOk={onCreate} width={720} destroyOnHidden>
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
        </div>
    );
}
