/** 1 积分 = 1 美元。金额用两位小数。真正的加减在服务端做，这里的 number 只用于展示。 */

/** 列表筛选：大厅可接的单 / 我发布的 / 我报过价或已接的 */
export type JobScope = "hall" | "client" | "creator";

export type JobStatus = "open" | "quoted" | "active" | "submitted" | "completed" | "cancelled" | "expired";

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
    /** 接受报价后允许的交付天数 */
    workDays: number;
    /** 接单人必须在此之前交付，超时罚没押金并退回市场 */
    workDeadlineAt?: string;
    /** 整单有效期，到期作废退款给雇主 */
    jobDeadlineAt: string;
    /** 雇主必须在此之前验收，超时自动验收打款 */
    reviewDeadlineAt?: string;
    /** 接单要冻结的押金，服务端给的展示值 */
    depositAmount: number;
    expireReason?: string;
    quotes: JobQuote[];
    acceptedQuoteId?: string;
    delivery?: JobDelivery;
    settlement?: JobSettlement;
    createdAt: string;
    updatedAt: string;
};

/** 展示用。实际抽成以服务端 server/src/jobs.ts 的 PLATFORM_FEE_RATE 为准。 */
export const PLATFORM_FEE_RATE = 0.1;

/** 状态徽章配色。列表和详情共用一份，两处各写一遍迟早会对不上。 */
export const JOB_STATUS_COLOR: Record<JobStatus, string> = {
    open: "blue",
    quoted: "cyan",
    active: "processing",
    submitted: "gold",
    completed: "success",
    cancelled: "default",
    expired: "default",
};
