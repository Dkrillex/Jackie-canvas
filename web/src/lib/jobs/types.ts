/** 1 积分 = 1 美元。金额用两位小数。真正的加减在服务端做，这里的 number 只用于展示。 */

/** 列表筛选：大厅可接的单 / 我发布的 / 我报过价或已接的 */
export type JobScope = "hall" | "client" | "creator";

export type JobStatus = "open" | "quoted" | "active" | "submitted" | "completed" | "cancelled";

export type JobQuote = {
    id: string;
    creatorId: string;
    amount: number;
    note: string;
    createdAt: string;
};

export type JobDelivery = {
    content: string;
    link?: string;
    canvasId?: string;
    submittedAt: string;
    rejectReason?: string;
};

export type JobSettlement = {
    quoteAmount: number;
    costAmount: number;
    platformFee: number;
    creatorPayout: number;
    profit: number;
    settledAt: string;
};

export type Job = {
    id: string;
    title: string;
    brief: string;
    budget: number;
    status: JobStatus;
    clientId: string;
    creatorId?: string;
    quotes: JobQuote[];
    acceptedQuoteId?: string;
    delivery?: JobDelivery;
    settlement?: JobSettlement;
    createdAt: string;
    updatedAt: string;
};

/** 展示用。实际抽成以服务端 server/src/jobs.ts 的 PLATFORM_FEE_RATE 为准。 */
export const PLATFORM_FEE_RATE = 0.1;
