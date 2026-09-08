import { BriefcaseBusiness, Info, Plus, RefreshCw, Search, Wallet } from "lucide-react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Pagination, Segmented, Skeleton, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { briefExcerpt } from "@/jc/lib/brief-markdown";
import { formatCredits } from "@/jc/lib/settlement";
import { JOB_STATUS_COLOR, type Job, type JobScope } from "@/jc/lib/job-types";
import { useRequireLogin } from "@/hooks/use-require-login";
import { useJobStore } from "@/jc/stores/use-job-store";
import { useUserStore } from "@/stores/use-user-store";
import { useWalletStore } from "@/jc/stores/use-wallet-store";
import { JobBriefEditor } from "./brief-editor";
import { JobDeadline } from "./job-deadline";

const PAGE_SIZE = 9;

export default function JobsPage() {
    const { t } = useTranslation();
    const requireLogin = useRequireLogin();
    const user = useUserStore((state) => state.user);
    const [createOpen, setCreateOpen] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [page, setPage] = useState(1);

    const scope = useJobStore((s) => s.scope);
    const setScope = useJobStore((s) => s.setScope);
    const jobs = useJobStore((s) => s.jobs);
    const loading = useJobStore((s) => s.loading);
    const error = useJobStore((s) => s.error);
    const refresh = useJobStore((s) => s.refresh);
    const clear = useJobStore((s) => s.clear);

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

    const filtered = useMemo(() => {
        const word = keyword.trim().toLowerCase();
        return word ? jobs.filter((job) => job.title.toLowerCase().includes(word)) : jobs;
    }, [jobs, keyword]);

    // 筛完可能比当前页还短（搜索、切 tab、刷新都会），页码越界时列表会空成一片
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const current = Math.min(page, pageCount);
    const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const openCreate = () => {
        if (!requireLogin("/jobs")) return;
        setCreateOpen(true);
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
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
                    {user ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>
                                {t("jobs.refresh")}
                            </Button>
                            <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
                                {t("jobs.create")}
                            </Button>
                        </div>
                    ) : null}
                </div>

                {/* 未登录时列表、余额、筛选都是空的，摆出来只是三块噪音，直接换成一张登录卡 */}
                {!user ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white/60 py-16 text-center dark:border-stone-800 dark:bg-white/[0.02]">
                        <div className="flex size-11 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                            <BriefcaseBusiness className="size-5 text-stone-500" />
                        </div>
                        <div className="text-sm text-stone-500 dark:text-stone-400">{t("jobs.loginFirst")}</div>
                        <Button type="primary" onClick={() => requireLogin("/jobs")}>
                            {t("config.account.goLogin")}
                        </Button>
                    </div>
                ) : (
                    <>
                        {error ? <Alert type="warning" showIcon message={error} /> : null}

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-stone-200 bg-white/60 px-5 py-4 dark:border-stone-800 dark:bg-white/[0.02]">
                            <Wallet className="size-4 shrink-0 text-stone-400" />
                            {[
                                { label: t("jobs.statAvailable"), value: available, strong: true },
                                { label: t("jobs.statBalance"), value: balance, strong: false },
                                { label: t("jobs.statFrozen"), value: frozen, strong: false },
                            ].map((item, index) => (
                                <div key={item.label} className={index ? "border-stone-200 pl-6 sm:border-l dark:border-stone-800" : ""}>
                                    <div className="text-[11px] text-stone-400">{item.label}</div>
                                    <div className={`tabular-nums ${item.strong ? "text-lg font-semibold" : "text-lg text-stone-500 dark:text-stone-400"}`}>{item.value}</div>
                                </div>
                            ))}
                            {/* 充值是真实支付，统一走 /wallet 那条链路，这里只做入口；实心留给「发布工作」，两个黑按钮会互相抢 */}
                            <Link to="/wallet" className="ml-auto">
                                <Button>{t("jobs.goRecharge")}</Button>
                            </Link>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Segmented
                                value={scope}
                                onChange={(value) => {
                                    setPage(1);
                                    setScope(value as JobScope);
                                }}
                                options={[
                                    { label: t("jobs.tabHall"), value: "hall" },
                                    { label: t("jobs.tabPosted"), value: "client" },
                                    { label: t("jobs.tabTaken"), value: "creator" },
                                ]}
                            />
                            <div className="flex items-center gap-3">
                                {filtered.length ? <span className="text-xs text-stone-400">{t("jobs.totalCount", { n: filtered.length })}</span> : null}
                                {/* 宽度必须落在外层 div 上：antd 运行时注入的 .ant-input-affix-wrapper{width:100%} 排在 Tailwind 之后，w-64 盖不住它 */}
                                <div className="w-56">
                                    <Input
                                        allowClear
                                        value={keyword}
                                        onChange={(event) => {
                                            setPage(1);
                                            setKeyword(event.target.value);
                                        }}
                                        prefix={<Search className="size-4 text-stone-400" />}
                                        placeholder={t("jobs.searchPlaceholder")}
                                    />
                                </div>
                            </div>
                        </div>

                        {loading && !jobs.length ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {[0, 1, 2].map((key) => (
                                    <div key={key} className="rounded-2xl border border-stone-200 px-5 py-4 dark:border-stone-800">
                                        <Skeleton active paragraph={{ rows: 3 }} title={{ width: "60%" }} />
                                    </div>
                                ))}
                            </div>
                        ) : visible.length ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {visible.map((job) => (
                                    <JobCard key={job.id} job={job} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-200 py-14 text-center dark:border-stone-800">
                                <div className="flex size-11 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                                    <BriefcaseBusiness className="size-5 text-stone-400" />
                                </div>
                                <div className="text-sm text-stone-500 dark:text-stone-400">{keyword.trim() ? t("jobs.emptySearch") : t(`jobs.empty_${scope}`)}</div>
                                {scope !== "hall" && !keyword.trim() ? (
                                    <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
                                        {t("jobs.create")}
                                    </Button>
                                ) : null}
                            </div>
                        )}

                        {filtered.length > PAGE_SIZE ? (
                            <div className="flex justify-center">
                                <Pagination current={current} pageSize={PAGE_SIZE} total={filtered.length} showSizeChanger={false} onChange={setPage} />
                            </div>
                        ) : null}
                    </>
                )}

                <CreateJobModal open={createOpen} onClose={() => setCreateOpen(false)} />
            </div>
        </div>
    );
}

/**
 * 一张单一张卡。表格把标题挤成一列、需求完全看不见，扫一眼决定要不要接这件事做不了；
 * 卡片把「做什么 / 多少钱 / 什么时候要 / 有几个人在抢」放在同一个视野里。
 */
function JobCard({ job }: { job: Job }) {
    const { t } = useTranslation();
    const excerpt = briefExcerpt(job.brief);

    return (
        <Link
            to={`/jobs/${job.id}`}
            className="flex h-full flex-col gap-3 rounded-2xl border border-stone-200 bg-white/60 px-5 py-4 no-underline shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_10px_24px_rgba(28,25,23,0.08)] dark:border-stone-800 dark:bg-white/[0.02] dark:hover:border-stone-700 dark:hover:shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
        >
            <div className="flex items-start justify-between gap-3">
                <span className="line-clamp-2 font-medium text-stone-900 dark:text-stone-100">{job.title}</span>
                <Tag color={JOB_STATUS_COLOR[job.status]} className="!mr-0 shrink-0">
                    {t(`jobs.status.${job.status}`)}
                </Tag>
            </div>

            <p className="!mb-0 line-clamp-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{excerpt || t("jobs.briefEmptyPreview")}</p>

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-stone-100 pt-3 dark:border-stone-800/70">
                <div>
                    <div className="text-[11px] text-stone-400">{t("jobs.labelBudget")}</div>
                    <div className="font-semibold tabular-nums">
                        {formatCredits(job.budget)}
                        <span className="ml-1 text-xs font-normal text-stone-500">credits</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <JobDeadline job={job} />
                    <span className="text-[11px] text-stone-400">
                        {t("jobs.quotesCount", { n: job.quotes.length })} · {job.updatedAt.slice(5, 16)}
                    </span>
                </div>
            </div>
        </Link>
    );
}

/**
 * 发布工作。表单状态和 store 调用都收在这里 —— 页面只管开关，
 * 也就不用为了一个弹窗在列表页顶上挂一份 Form 实例和 creating 标志。
 */
function CreateJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const createJob = useJobStore((s) => s.createJob);
    const [form] = Form.useForm<{ title: string; brief: string; budget: number; workDays: number; jobDays: number }>();
    const [creating, setCreating] = useState(false);
    const jobDays = Form.useWatch("jobDays", form);

    const submit = async () => {
        const values = await form.validateFields();
        setCreating(true);
        try {
            await createJob(values);
            onClose();
            form.resetFields();
            message.success(t("jobs.created"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("jobs.actionFailed"));
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={720}
            destroyOnHidden
            title={
                <div className="flex items-start gap-3 pb-1">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                        <BriefcaseBusiness className="size-4 text-stone-500" />
                    </div>
                    <div>
                        <div className="text-base font-semibold">{t("jobs.create")}</div>
                        {/* 发单时不扣也不冻积分，接受报价那一刻才冻 —— 不说清楚的话没人敢按这个按钮 */}
                        <div className="text-xs font-normal text-stone-500 dark:text-stone-400">{t("jobs.createSubtitle")}</div>
                    </div>
                </div>
            }
            footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-stone-400">{t("jobs.createFooterNote")}</span>
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button type="primary" loading={creating} onClick={() => void submit()}>
                            {t("jobs.okCreate")}
                        </Button>
                    </div>
                </div>
            }
        >
            <Form form={form} layout="vertical" initialValues={{ budget: 50, brief: "", workDays: 3, jobDays: 30 }} requiredMark={false} className="pt-1">
                <Form.Item name="title" label={t("jobs.fieldTitle")} rules={[{ required: true }]}>
                    <Input maxLength={80} showCount placeholder={t("jobs.titlePlaceholder")} />
                </Form.Item>
                <Form.Item name="brief" label={t("jobs.fieldBrief")} rules={[{ required: true, message: t("jobs.briefRequired") }]} className="!mb-0">
                    <JobBriefEditor />
                </Form.Item>

                {/* 三个数字挤在一行：原来两段长灰字说明把弹窗撑得要滚动，说明改挂在 label 的问号上 */}
                <div className="mt-5 rounded-xl border border-stone-200 px-4 py-4 dark:border-stone-800">
                    <div className="mb-3 text-xs font-semibold text-stone-500">{t("jobs.createTerms")}</div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Form.Item name="budget" label={t("jobs.labelBudget")} tooltip={t("jobs.budgetHint")} rules={[{ required: true }]} className="!mb-0">
                            <InputNumber min={1} step={1} className="w-full" addonAfter="credits" />
                        </Form.Item>
                        <Form.Item name="workDays" label={t("jobs.labelWorkDays")} tooltip={t("jobs.workDaysHint")} rules={[{ required: true }]} extra={t("jobs.workDaysFrom")} className="!mb-0">
                            <InputNumber min={1} max={365} className="w-full" addonAfter={t("jobs.daysUnit")} />
                        </Form.Item>
                        {/* 有效期填天数、心里想的是日期，这里替他算出来 */}
                        <Form.Item name="jobDays" label={t("jobs.labelJobDays")} tooltip={t("jobs.jobDaysHint")} rules={[{ required: true }]} extra={jobDays ? t("jobs.jobDaysUntil", { date: dateAfterDays(jobDays) }) : undefined} className="!mb-0">
                            <InputNumber min={1} max={365} className="w-full" addonAfter={t("jobs.daysUnit")} />
                        </Form.Item>
                    </div>
                </div>
            </Form>
        </Modal>
    );
}

/** N 天之后是几号。整单有效期填的是天数，但雇主关心的是哪天作废。 */
function dateAfterDays(days: number) {
    const at = new Date(Date.now() + days * 86_400_000);
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}
