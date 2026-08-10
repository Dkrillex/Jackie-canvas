/** 1 credit = 1 USD。金额用两位小数。 */

export type JobRole = "client" | "creator";

export type JobStatus = "open" | "quoted" | "active" | "submitted" | "completed" | "cancelled";

export type LedgerKind = "recharge" | "freeze" | "unfreeze" | "charge" | "payout" | "fee" | "cost" | "adjust";

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

export type Wallet = {
    balance: number;
    frozen: number;
};

export type LedgerEntry = {
    id: string;
    role: JobRole;
    kind: LedgerKind;
    amount: number;
    balanceAfter: number;
    frozenAfter: number;
    jobId?: string;
    note: string;
    createdAt: string;
};

export const PLATFORM_FEE_RATE = 0.1;
export const CLIENT_ROLE: JobRole = "client";
export const CREATOR_ROLE: JobRole = "creator";
