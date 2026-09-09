import { Building2, Plus, RefreshCw } from "lucide-react";
import { Alert, Button, Tabs, Tag, Typography } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ENTERPRISE_ADMIN } from "@/jc/services/enterprise";
import { BusinessContactModal } from "@/jc/components/business-contact-modal";
import { useEnterpriseStore } from "@/jc/stores/use-enterprise-store";
import { useRequireLogin } from "@/hooks/use-require-login";
import { useUserStore } from "@/stores/use-user-store";
import { DashboardTab } from "./dashboard-tab";
import { LogsTab } from "./logs-tab";
import { MembersTab } from "./members-tab";

const usd = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

export default function EnterprisePage() {
    const { t } = useTranslation();
    const requireLogin = useRequireLogin();
    const user = useUserStore((state) => state.user);

    const enterprise = useEnterpriseStore((s) => s.enterprise);
    const members = useEnterpriseStore((s) => s.members);
    const loading = useEnterpriseStore((s) => s.loading);
    const error = useEnterpriseStore((s) => s.error);
    const refresh = useEnterpriseStore((s) => s.refresh);
    const clear = useEnterpriseStore((s) => s.clear);

    const [tab, setTab] = useState("members");
    const [contactOpen, setContactOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);

    useEffect(() => {
        if (user) void refresh();
        else clear();
    }, [clear, refresh, user]);

    const isAdmin = enterprise?.userType === ENTERPRISE_ADMIN;
    /** 管理员自己那行的剩余额度，就是分配额度时能划出去的上限（钱从他账上扣） */
    const myQuotaUsd = useMemo(() => members.find((item) => item.userId === user?.id)?.quotaUsd ?? 0, [members, user?.id]);

    if (!user) {
        return (
            <Shell>
                <EmptyCard text={t("enterprise.loginFirst")}>
                    <Button type="primary" onClick={() => requireLogin("/enterprise")}>
                        {t("config.account.goLogin")}
                    </Button>
                </EmptyCard>
            </Shell>
        );
    }

    return (
        <Shell
            actions={
                enterprise ? (
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>
                        {t("enterprise.refresh")}
                    </Button>
                ) : null
            }
        >
            {error ? <Alert type="warning" showIcon message={error} /> : null}

            {!enterprise && !loading ? (
                <EmptyCard text={t("enterprise.notJoined")}>
                    <Button type="primary" onClick={() => setContactOpen(true)}>
                        {t("wallet.enterpriseContact")}
                    </Button>
                </EmptyCard>
            ) : null}

            {enterprise ? (
                <>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-stone-200 bg-white/60 px-5 py-4 dark:border-stone-800 dark:bg-white/[0.02]">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                                <Building2 className="size-5 text-stone-500" />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate font-medium">{enterprise.enterpriseName}</div>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                    <Tag color={isAdmin ? "geekblue" : "default"} className="!mr-0">
                                        {t(isAdmin ? "enterprise.roleAdmin" : "enterprise.roleMember")}
                                    </Tag>
                                    {enterprise.status === 0 ? (
                                        <Tag color="error" className="!mr-0">
                                            {t("enterprise.statusDisabled")}
                                        </Tag>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="border-stone-200 pl-6 sm:border-l dark:border-stone-800">
                            <div className="text-[11px] text-stone-400">{t("enterprise.memberCount")}</div>
                            <div className="text-lg tabular-nums">
                                {enterprise.userCount ?? members.length}
                                {/* 0 或空都表示不限，写成 /0 会像「上限为 0」 */}
                                <span className="text-sm text-stone-400">{enterprise.maxUserCount ? ` / ${enterprise.maxUserCount}` : ` / ${t("enterprise.unlimited")}`}</span>
                            </div>
                        </div>
                        {isAdmin ? (
                            <div className="border-stone-200 pl-6 sm:border-l dark:border-stone-800">
                                <div className="text-[11px] text-stone-400">{t("enterprise.myQuota")}</div>
                                <div className="text-lg font-semibold tabular-nums">{usd(myQuotaUsd)}</div>
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white/60 px-5 pb-4 dark:border-stone-800 dark:bg-white/[0.02]">
                        <Tabs
                            activeKey={tab}
                            onChange={setTab}
                            // 看板和日志各自带筛选条件，切走就销毁：回来重新拉一次比给用户看一份旧数据好
                            destroyOnHidden
                            tabBarExtraContent={
                                isAdmin && tab === "members" ? (
                                    <Button type="primary" size="small" icon={<Plus className="size-3.5" />} onClick={() => setAddOpen(true)}>
                                        {t("enterprise.addMember")}
                                    </Button>
                                ) : null
                            }
                            items={[
                                { key: "members", label: t("enterprise.members"), children: <MembersTab isAdmin={Boolean(isAdmin)} myQuotaUsd={myQuotaUsd} currentUserId={user.id} addOpen={addOpen} onCloseAdd={() => setAddOpen(false)} /> },
                                // 看板那三个接口只对企业管理员开放，普通成员连页签都不给
                                ...(isAdmin ? [{ key: "dashboard", label: t("enterprise.dashboard"), children: <DashboardTab /> }] : []),
                                { key: "logs", label: t("enterprise.logs"), children: <LogsTab isAdmin={Boolean(isAdmin)} /> },
                            ]}
                        />
                    </div>
                </>
            ) : null}

            <BusinessContactModal open={contactOpen} onClose={() => setContactOpen(false)} hint={t("enterprise.contactHint")} />
        </Shell>
    );
}

function Shell({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
    const { t } = useTranslation();
    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-5 px-6 py-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <Typography.Title level={3} className="!mb-1 !flex items-center gap-2">
                            <Building2 className="size-6" />
                            {t("enterprise.title")}
                        </Typography.Title>
                        <Typography.Paragraph type="secondary" className="!mb-0">
                            {t("enterprise.subtitle")}
                        </Typography.Paragraph>
                    </div>
                    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
                </div>
                {children}
            </div>
        </div>
    );
}

function EmptyCard({ text, children }: { text: string; children?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white/60 py-16 text-center dark:border-stone-800 dark:bg-white/[0.02]">
            <div className="flex size-11 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                <Building2 className="size-5 text-stone-500" />
            </div>
            <div className="text-sm text-stone-500 dark:text-stone-400">{text}</div>
            {children}
        </div>
    );
}
