import { RefreshCw, Search } from "lucide-react";
import { Alert, Button, Input, Select, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listLogs, type EnterpriseLog } from "@/jc/services/enterprise";
import { useEnterpriseStore } from "@/jc/stores/use-enterprise-store";

/** 0 未知 1 充值 2 消费 3 管理 4 系统 5 错误 6 退款。只有「错误」值得抢眼。 */
const TYPE_COLOR: Record<number, string> = { 1: "success", 2: "default", 3: "geekblue", 4: "default", 5: "error", 6: "gold" };

const PRESETS = { last24h: 24 * 3600, last7d: 7 * 86400, last30d: 30 * 86400 };
type PresetKey = keyof typeof PRESETS;

const time = (seconds?: number) => (seconds ? new Date(seconds * 1000).toLocaleString(undefined, { hour12: false }) : "—");

export function LogsTab({ isAdmin }: { isAdmin: boolean }) {
    const { t, i18n } = useTranslation();
    const members = useEnterpriseStore((s) => s.members);

    const [rows, setRows] = useState<EnterpriseLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [preset, setPreset] = useState<PresetKey>("last7d");
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [modelName, setModelName] = useState("");
    // 输入框里的字不该每敲一个就打一次接口，回车或点查询才生效
    const [applied, setApplied] = useState({ modelName: "" });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const endTimestamp = Math.floor(Date.now() / 1000);
        setLoading(true);
        setError("");
        try {
            const data = await listLogs({
                pageNum: page,
                pageSize,
                userId,
                modelName: applied.modelName || undefined,
                startTimestamp: endTimestamp - PRESETS[preset],
                endTimestamp,
            });
            setRows(data.rows || []);
            setTotal(data.total || 0);
        } catch (err) {
            setRows([]);
            setTotal(0);
            setError(err instanceof Error ? err.message : t("enterprise.actionFailed"));
        } finally {
            setLoading(false);
        }
    }, [applied.modelName, page, pageSize, preset, t, userId]);

    useEffect(() => {
        void load();
    }, [load]);

    const search = () => {
        setPage(1);
        setApplied({ modelName: modelName.trim() });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="w-36">
                    <Select
                        value={preset}
                        onChange={(value) => {
                            setPage(1);
                            setPreset(value);
                        }}
                        options={[
                            { label: t("enterprise.last24h"), value: "last24h" },
                            { label: t("enterprise.last7d"), value: "last7d" },
                            { label: t("enterprise.last30d"), value: "last30d" },
                        ]}
                    />
                </div>
                {/* 普通成员只能看自己的日志，服务端会强制改写，这里索性不给这个筛选 */}
                {isAdmin ? (
                    <div className="w-48">
                        <Select
                            allowClear
                            value={userId}
                            onChange={(value) => {
                                setPage(1);
                                setUserId(value || undefined);
                            }}
                            placeholder={t("enterprise.allMembers")}
                            options={members.map((member) => ({ label: member.nickName || member.userName, value: member.userId }))}
                        />
                    </div>
                ) : null}
                <div className="w-52">
                    <Input allowClear value={modelName} onChange={(event) => setModelName(event.target.value)} onPressEnter={search} prefix={<Search className="size-4 text-stone-400" />} placeholder={t("enterprise.filterModel")} />
                </div>
                <Button onClick={search}>{t("enterprise.search")}</Button>
                <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()} />
            </div>

            {error ? <Alert type="warning" showIcon message={error} /> : null}

            <Table<EnterpriseLog>
                rowKey={(row) => String(row.id ?? `${row.createdAt}-${row.requestId}`)}
                size="small"
                loading={loading}
                dataSource={rows}
                scroll={{ x: 860 }}
                expandable={{
                    // 计费过程是服务端拼好的整段文字，塞进列里会把表格撑爆，收进展开行
                    expandedRowRender: (row) => (
                        <div className="space-y-1 py-1 text-xs text-stone-500 dark:text-stone-400">
                            <div>{(i18n.language.startsWith("zh") ? row.billingProcessTextZh : row.billingProcessTextEn) || row.content || t("enterprise.noDetail")}</div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-stone-400">
                                {row.requestId ? <span className="font-mono">{row.requestId}</span> : null}
                                {row.ip ? <span>IP {row.ip}</span> : null}
                                {row.group ? (
                                    <span>
                                        {t("enterprise.colGroup")} {row.group}
                                    </span>
                                ) : null}
                                {row.isStream ? <span>stream</span> : null}
                            </div>
                        </div>
                    ),
                }}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    pageSizeOptions: [20, 50, 100],
                    showTotal: (count) => t("enterprise.logTotal", { n: count }),
                    onChange: (nextPage, nextSize) => {
                        setPage(nextPage);
                        setPageSize(nextSize);
                    },
                }}
                columns={[
                    { title: t("enterprise.colTime"), dataIndex: "createdAt", width: 170, render: (value?: number) => <span className="tabular-nums">{time(value)}</span> },
                    ...(isAdmin ? [{ title: t("enterprise.colMember"), dataIndex: "username", width: 120 }] : []),
                    { title: t("enterprise.colModel"), dataIndex: "modelName", width: 180, render: (value?: string) => value || "—" },
                    { title: t("enterprise.colType"), dataIndex: "type", width: 90, render: (value?: number) => <Tag color={TYPE_COLOR[value ?? 0] || "default"}>{t(`enterprise.logType_${value ?? 0}`, String(value ?? 0))}</Tag> },
                    {
                        title: t("enterprise.colTokens"),
                        width: 130,
                        align: "right",
                        render: (_: unknown, row) => <span className="tabular-nums text-stone-500">{`${row.promptTokens ?? 0} / ${row.completionTokens ?? 0}`}</span>,
                    },
                    { title: t("enterprise.colLatency"), dataIndex: "useTime", width: 90, align: "right", render: (value?: number) => <span className="tabular-nums text-stone-500">{value ? `${value} ms` : "—"}</span> },
                    { title: t("enterprise.colSpend"), dataIndex: "quotaDollar", width: 100, align: "right", render: (value?: number) => <span className="font-medium tabular-nums">${Number(value ?? 0).toFixed(4)}</span> },
                    { title: t("enterprise.colToken"), dataIndex: "tokenName", width: 130, render: (value?: string) => value || "—" },
                ]}
            />
        </div>
    );
}
