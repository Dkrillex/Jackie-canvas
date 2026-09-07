/**
 * 接单中心。数据落在服务端 MySQL，冻结与结算是真实的托管事务（见 server/src/jobs.ts）。
 *
 * 金额在服务端一律是 DECIMAL、传回来是字符串；这里在边界上转成 number 供页面展示。
 * **只用于显示** —— 冻结、扣款、抽成的实际计算全在服务端做，前端算出来的数字不作数。
 */
import { PAY_API_BASE } from "@/jc/config";
import { AUTH_TOKEN_KEY } from "@/constant/auth";
import type { Job, JobQuote, JobScope } from "@/jc/lib/job-types";

export type { Job, JobScope };

/** 服务端返回的工单，金额都是字符串 */
type JobPayload = Omit<Job, "budget" | "quotes" | "settlement"> & {
    budget: string;
    quotes: (Omit<JobQuote, "amount"> & { amount: string })[];
    settlement?: Record<keyof NonNullable<Job["settlement"]>, string>;
};

async function jobRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
    const response = await fetch(`${PAY_API_BASE}/api/jobs${path}`, {
        ...init,
        headers: {
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init?.headers,
        },
    });
    if (!response.ok) {
        // 服务端把拒绝原因写得很具体（状态不对、可用积分不足、不是你的单），直接透出去
        const detail = await response.json().catch(() => null);
        throw new Error((detail as { message?: string })?.message || `${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

function toJob(payload: JobPayload): Job {
    return {
        ...payload,
        budget: Number(payload.budget),
        quotes: payload.quotes.map((quote) => ({ ...quote, amount: Number(quote.amount) })),
        settlement: payload.settlement
            ? {
                  quoteAmount: Number(payload.settlement.quoteAmount),
                  costAmount: Number(payload.settlement.costAmount),
                  platformFee: Number(payload.settlement.platformFee),
                  creatorPayout: Number(payload.settlement.creatorPayout),
                  profit: Number(payload.settlement.profit),
                  settledAt: payload.settlement.settledAt,
              }
            : undefined,
    };
}

const post = (path: string, body?: unknown) => jobRequest<{ ok: true }>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

/** scope: hall=大厅可接的单，client=我发布的，creator=我报过价或已接的 */
export async function listJobs(scope: JobScope) {
    const data = await jobRequest<{ jobs: JobPayload[]; userId: string }>(`?scope=${scope}`);
    return { jobs: data.jobs.map(toJob), userId: data.userId };
}

export async function getJob(id: string) {
    const data = await jobRequest<{ job: JobPayload; userId: string }>(`/${encodeURIComponent(id)}`);
    return { job: toJob(data.job), userId: data.userId };
}

export async function createJob(input: { title: string; brief: string; budget: number }) {
    return jobRequest<{ id: string }>("", { method: "POST", body: JSON.stringify(input) });
}

export const submitQuote = (jobId: string, amount: number, note: string) => post(`/${encodeURIComponent(jobId)}/quotes`, { amount, note });

export const acceptQuote = (jobId: string, quoteId: string) => post(`/${encodeURIComponent(jobId)}/accept`, { quoteId });

export const submitDelivery = (jobId: string, input: { content: string; link?: string; canvasId?: string }) => post(`/${encodeURIComponent(jobId)}/delivery`, input);

export const rejectDelivery = (jobId: string, reason: string) => post(`/${encodeURIComponent(jobId)}/reject`, { reason });

export const acceptDelivery = (jobId: string, costAmount: number) => post(`/${encodeURIComponent(jobId)}/complete`, { costAmount });

export const cancelJob = (jobId: string) => post(`/${encodeURIComponent(jobId)}/cancel`);
