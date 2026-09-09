import { Alert, Segmented, Select, Skeleton } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDashboardSummary, getDashboardTrend, getDashboardTrendByModel, quotaToUsd, type DashboardBucket, type DashboardModelBucket, type DashboardSummary, type Granularity } from "@/jc/services/enterprise";
import { useEnterpriseStore } from "@/jc/stores/use-enterprise-store";
import { BucketBars, RankBars } from "./charts";

/** 预设区间。粒度跟着区间走：24 小时看小时桶，7/30 天看天桶，不给用户第二个旋钮去拧。 */
const PRESETS = {
    last24h: { seconds: 24 * 3600, granularity: "hour" as Granularity },
    last7d: { seconds: 7 * 86400, granularity: "day" as Granularity },
    last30d: { seconds: 30 * 86400, granularity: "day" as Granularity },
};

type PresetKey = keyof typeof PRESETS;

const usd = (value: number) => `$${value.toFixed(2)}`;
const compact = (value: number) => (value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value));

/** 桶标签只在图上占一点位置，天桶去掉年份、小时桶只留「日 时」 */
const shortBucket = (bucket: string) => (bucket.length > 10 ? bucket.slice(5, 13) : bucket.slice(5));

export function DashboardTab() {
    const { t } = useTranslation();
    const members = useEnterpriseStore((s) => s.members);

    const [preset, setPreset] = useState<PresetKey>("last7d");
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [summary, setSummary] = useState<DashboardSummary>({ calls: 0, quota: 0, tokens: 0 });
    const [trend, setTrend] = useState<DashboardBucket[]>([]);
    const [byModel, setByModel] = useState<DashboardModelBucket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const { seconds, granularity } = PRESETS[preset];
        // 服务端要的是秒级时间戳
        const endTimestamp = Math.floor(Date.now() / 1000);
        const query = { userId, startTimestamp: endTimestamp - seconds, endTimestamp, granularity };
        setLoading(true);
        setError("");
        try {
            const [summaryData, trendData, modelData] = await Promise.all([getDashboardSummary(query), getDashboardTrend(query), getDashboardTrendByModel(query)]);
            setSummary(summaryData);
            setTrend(trendData);
            setByModel(modelData);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("enterprise.actionFailed"));
        } finally {
            setLoading(false);
        }
    }, [preset, t, userId]);

    useEffect(() => {
        void load();
    }, [load]);

    const bars = useMemo(
        () =>
            trend.map((item) => ({
                label: shortBucket(item.bucket),
                value: quotaToUsd(item.quota),
                tooltip: `${item.bucket} · ${usd(quotaToUsd(item.quota))} · ${t("enterprise.statCalls")} ${item.calls}`,
            })),
        [t, trend],
    );

    /** 按模型汇总：接口给的是「模型 × 时间桶」，看板上只关心谁花得多，取前 8 名 */
    const models = useMemo(() => {
        const totals = new Map<string, { usd: number; calls: number }>();
        for (const item of byModel) {
            const name = item.modelName || "—";
            const prev = totals.get(name) || { usd: 0, calls: 0 };
            totals.set(name, { usd: prev.usd + quotaToUsd(item.quota), calls: prev.calls + (item.calls || 0) });
        }
        return [...totals.entries()]
            .map(([label, value]) => ({ label, value: value.usd, hint: `${value.calls} ${t("enterprise.callsUnit")}` }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [byModel, t]);

    const empty = !loading && !summary.calls && !trend.length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Segmented
                    value={preset}
                    onChange={(value) => setPreset(value as PresetKey)}
                    options={[
                        { label: t("enterprise.last24h"), value: "last24h" },
                        { label: t("enterprise.last7d"), value: "last7d" },
                        { label: t("enterprise.last30d"), value: "last30d" },
                    ]}
                />
                <div className="w-56">
                    <Select
                        allowClear
                        value={userId}
                        onChange={(value) => setUserId(value || undefined)}
                        placeholder={t("enterprise.allMembers")}
                        options={members.map((member) => ({ label: `${member.nickName || member.userName}`, value: member.userId }))}
                    />
                </div>
            </div>

            {error ? <Alert type="warning" showIcon message={error} /> : null}

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: t("enterprise.statSpend"), value: usd(quotaToUsd(summary.quota)), strong: true },
                    { label: t("enterprise.statCalls"), value: compact(summary.calls || 0), strong: false },
                    { label: t("enterprise.statTokens"), value: compact(summary.tokens || 0), strong: false },
                ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800">
                        <div className="text-[11px] text-stone-400">{item.label}</div>
                        <div className={`mt-0.5 tabular-nums ${item.strong ? "text-2xl font-semibold" : "text-xl text-stone-600 dark:text-stone-300"}`}>{item.value}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="rounded-xl border border-stone-200 px-4 py-4 dark:border-stone-800">
                    <Skeleton active paragraph={{ rows: 4 }} />
                </div>
            ) : empty ? (
                <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-400 dark:border-stone-800">{t("enterprise.noUsage")}</div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-5">
                    <div className="rounded-xl border border-stone-200 px-4 pb-3 pt-4 lg:col-span-3 dark:border-stone-800">
                        <div className="mb-4 text-sm font-semibold">{t("enterprise.trendTitle")}</div>
                        <BucketBars data={bars} formatValue={usd} />
                    </div>
                    <div className="rounded-xl border border-stone-200 px-4 py-4 lg:col-span-2 dark:border-stone-800">
                        <div className="mb-4 text-sm font-semibold">{t("enterprise.modelTitle")}</div>
                        {models.length ? <RankBars data={models} formatValue={usd} /> : <div className="py-6 text-center text-sm text-stone-400">{t("enterprise.noUsage")}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
