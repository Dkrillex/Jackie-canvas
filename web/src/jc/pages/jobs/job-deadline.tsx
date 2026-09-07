import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import type { Job } from "@/jc/lib/job-types";

/**
 * 显示当前这个单最紧的那个截止时间。
 *
 * 三个时钟同时存在，但任一时刻只有一个真正约束着人：进行中看交付期、待验收看验收期、
 * 还没人接看整单有效期。全列出来只会让人分不清该盯哪个，所以只显示当前生效的那个。
 */
export function JobDeadline({ job }: { job: Job }) {
    const { t } = useTranslation();

    const active =
        job.status === "active" && job.workDeadlineAt
            ? { at: job.workDeadlineAt, label: t("jobs.deadlineWork") }
            : job.status === "submitted" && job.reviewDeadlineAt
              ? { at: job.reviewDeadlineAt, label: t("jobs.deadlineReview") }
              : job.status === "open" || job.status === "quoted"
                ? { at: job.jobDeadlineAt, label: t("jobs.deadlineJob") }
                : null;

    if (!active) return <span className="text-stone-400">—</span>;

    const left = remaining(active.at);
    const text = left.overdue ? t("jobs.deadlineOverdue") : left.unit === "day" ? t("jobs.deadlineDays", { n: left.value }) : left.unit === "hour" ? t("jobs.deadlineHours", { n: left.value }) : t("jobs.deadlineMinutes", { n: left.value });

    return (
        <Tooltip title={`${active.label} · ${active.at}`}>
            <Tag color={left.overdue ? "error" : left.urgent ? "warning" : "default"}>
                {active.label} {text}
            </Tag>
        </Tooltip>
    );
}

/**
 * 剩余时间。服务端的时间列是不带时区的 'YYYY-MM-DD HH:MM:SS'，直接丢给 `new Date()`
 * 在 Safari 上会解析失败，所以把空格换成 T 再交给它。两边是同一台机器的时钟，按本地时间比即可。
 */
function remaining(at: string) {
    const target = new Date(at.replace(" ", "T")).getTime();
    if (!Number.isFinite(target)) return { overdue: true, urgent: false, unit: "day" as const, value: 0 };

    const diffMs = target - Date.now();
    if (diffMs <= 0) return { overdue: true, urgent: false, unit: "day" as const, value: 0 };

    const hours = Math.floor(diffMs / 3_600_000);
    const days = Math.floor(hours / 24);
    if (days >= 1) return { overdue: false, urgent: false, unit: "day" as const, value: days };
    if (hours >= 1) return { overdue: false, urgent: true, unit: "hour" as const, value: hours };
    return { overdue: false, urgent: true, unit: "minute" as const, value: Math.max(1, Math.floor(diffMs / 60_000)) };
}
