import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { nanoid } from "nanoid";

import { localForageStorage } from "@/lib/localforage-storage";
import { normalizeBriefImageRefs } from "@/lib/jobs/brief-markdown";
import { availableCredits, computeSettlement, roundCredits } from "@/lib/jobs/settlement";
import {
    CREATOR_ROLE,
    CLIENT_ROLE,
    type Job,
    type JobRole,
    type LedgerEntry,
    type LedgerKind,
    type Wallet,
} from "@/lib/jobs/types";

type JobStore = {
    hydrated: boolean;
    role: JobRole;
    wallets: Record<JobRole, Wallet>;
    ledger: LedgerEntry[];
    jobs: Job[];
    setRole: (role: JobRole) => void;
    recharge: (amount: number, note?: string) => void;
    createJob: (input: { title: string; brief: string; budget: number }) => string;
    submitQuote: (jobId: string, amount: number, note: string) => void;
    acceptQuote: (jobId: string, quoteId: string) => void;
    submitDelivery: (jobId: string, input: { content: string; link?: string; canvasId?: string }) => void;
    rejectDelivery: (jobId: string, reason: string) => void;
    acceptDelivery: (jobId: string, costAmount: number) => void;
    cancelJob: (jobId: string) => void;
    resetDemo: () => void;
};

const STORE_KEY = "infinite-canvas:job_store";

const emptyWallet = (): Wallet => ({ balance: 0, frozen: 0 });

function seedState(): Pick<JobStore, "role" | "wallets" | "ledger" | "jobs"> {
    const now = new Date().toISOString();
    return {
        role: CLIENT_ROLE,
        wallets: {
            client: { balance: 200, frozen: 0 },
            creator: { balance: 20, frozen: 0 },
        },
        ledger: [
            {
                id: nanoid(),
                role: CLIENT_ROLE,
                kind: "recharge",
                amount: 200,
                balanceAfter: 200,
                frozenAfter: 0,
                note: "Demo seed",
                createdAt: now,
            },
            {
                id: nanoid(),
                role: CREATOR_ROLE,
                kind: "recharge",
                amount: 20,
                balanceAfter: 20,
                frozenAfter: 0,
                note: "Demo seed",
                createdAt: now,
            },
        ],
        jobs: [
            {
                id: nanoid(),
                title: "品牌短视频分镜与 Seedance 成片",
                brief: "## 需求\n\n- 时长约 30 秒\n- 科技感产品片\n- 提交分镜说明与成片链接\n\n可在正文用 Markdown，并插入参考图。",
                budget: 80,
                status: "open",
                clientId: CLIENT_ROLE,
                quotes: [],
                createdAt: now,
                updatedAt: now,
            },
        ],
    };
}

const storage: PersistStorage<JobStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        return value ? (JSON.parse(value) as StorageValue<JobStore>) : null;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

function pushLedger(
    state: JobStore,
    role: JobRole,
    kind: LedgerKind,
    amount: number,
    wallet: Wallet,
    note: string,
    jobId?: string,
): LedgerEntry {
    return {
        id: nanoid(),
        role,
        kind,
        amount: roundCredits(amount),
        balanceAfter: wallet.balance,
        frozenAfter: wallet.frozen,
        jobId,
        note,
        createdAt: new Date().toISOString(),
    };
}

export const useJobStore = create<JobStore>()(
    persist(
        (set, get) => ({
            hydrated: false,
            ...seedState(),
            setRole: (role) => set({ role }),
            recharge: (amount, note) => {
                const value = roundCredits(amount);
                if (value <= 0) throw new Error("invalid_amount");
                const role = get().role;
                set((state) => {
                    const wallet = { ...state.wallets[role], balance: roundCredits(state.wallets[role].balance + value) };
                    return {
                        wallets: { ...state.wallets, [role]: wallet },
                        ledger: [pushLedger(state, role, "recharge", value, wallet, note || "Mock recharge"), ...state.ledger],
                    };
                });
            },
            createJob: ({ title, brief, budget }) => {
                const id = nanoid();
                const now = new Date().toISOString();
                const job: Job = {
                    id,
                    title: title.trim(),
                    brief: normalizeBriefImageRefs(brief.trim()),
                    budget: roundCredits(budget),
                    status: "open",
                    clientId: CLIENT_ROLE,
                    quotes: [],
                    createdAt: now,
                    updatedAt: now,
                };
                set((state) => ({ jobs: [job, ...state.jobs] }));
                return id;
            },
            submitQuote: (jobId, amount, note) => {
                const value = roundCredits(amount);
                if (value <= 0) throw new Error("invalid_amount");
                set((state) => ({
                    jobs: state.jobs.map((job) => {
                        if (job.id !== jobId || (job.status !== "open" && job.status !== "quoted")) return job;
                        const quote = {
                            id: nanoid(),
                            creatorId: CREATOR_ROLE,
                            amount: value,
                            note: note.trim(),
                            createdAt: new Date().toISOString(),
                        };
                        return {
                            ...job,
                            status: "quoted" as const,
                            quotes: [...job.quotes.filter((item) => item.creatorId !== CREATOR_ROLE), quote],
                            updatedAt: new Date().toISOString(),
                        };
                    }),
                }));
            },
            acceptQuote: (jobId, quoteId) => {
                const job = get().jobs.find((item) => item.id === jobId);
                const quote = job?.quotes.find((item) => item.id === quoteId);
                if (!job || !quote || (job.status !== "open" && job.status !== "quoted")) throw new Error("invalid_job");
                const client = get().wallets.client;
                if (availableCredits(client.balance, client.frozen) < quote.amount) throw new Error("insufficient_credits");
                set((state) => {
                    const wallet = {
                        ...state.wallets.client,
                        frozen: roundCredits(state.wallets.client.frozen + quote.amount),
                    };
                    return {
                        wallets: { ...state.wallets, client: wallet },
                        ledger: [pushLedger(state, CLIENT_ROLE, "freeze", quote.amount, wallet, "Freeze quote", jobId), ...state.ledger],
                        jobs: state.jobs.map((item) =>
                            item.id === jobId
                                ? {
                                      ...item,
                                      status: "active" as const,
                                      acceptedQuoteId: quoteId,
                                      creatorId: quote.creatorId,
                                      updatedAt: new Date().toISOString(),
                                  }
                                : item,
                        ),
                    };
                });
            },
            submitDelivery: (jobId, input) => {
                set((state) => ({
                    jobs: state.jobs.map((job) => {
                        if (job.id !== jobId || (job.status !== "active" && job.status !== "submitted")) return job;
                        return {
                            ...job,
                            status: "submitted" as const,
                            delivery: {
                                content: input.content.trim(),
                                link: input.link?.trim() || undefined,
                                canvasId: input.canvasId?.trim() || undefined,
                                submittedAt: new Date().toISOString(),
                            },
                            updatedAt: new Date().toISOString(),
                        };
                    }),
                }));
            },
            rejectDelivery: (jobId, reason) => {
                set((state) => ({
                    jobs: state.jobs.map((job) => {
                        if (job.id !== jobId || job.status !== "submitted" || !job.delivery) return job;
                        return {
                            ...job,
                            status: "active" as const,
                            delivery: { ...job.delivery, rejectReason: reason.trim() },
                            updatedAt: new Date().toISOString(),
                        };
                    }),
                }));
            },
            acceptDelivery: (jobId, costAmount) => {
                const job = get().jobs.find((item) => item.id === jobId);
                const quote = job?.quotes.find((item) => item.id === job.acceptedQuoteId);
                if (!job || !quote || job.status !== "submitted") throw new Error("invalid_job");
                const settlement = { ...computeSettlement(quote.amount, costAmount), settledAt: new Date().toISOString() };
                set((state) => {
                    const clientWallet: Wallet = {
                        balance: roundCredits(state.wallets.client.balance - settlement.quoteAmount),
                        frozen: roundCredits(Math.max(0, state.wallets.client.frozen - settlement.quoteAmount)),
                    };
                    const creatorWallet: Wallet = {
                        ...state.wallets.creator,
                        balance: roundCredits(state.wallets.creator.balance + settlement.creatorPayout),
                    };
                    const entries: LedgerEntry[] = [
                        pushLedger(state, CLIENT_ROLE, "charge", -settlement.quoteAmount, clientWallet, `Pay job (fee ${settlement.platformFee}, profit ${settlement.profit})`, jobId),
                        pushLedger(state, CREATOR_ROLE, "payout", settlement.creatorPayout, creatorWallet, "Creator payout", jobId),
                    ];
                    return {
                        wallets: { client: clientWallet, creator: creatorWallet },
                        ledger: [...entries, ...state.ledger],
                        jobs: state.jobs.map((item) =>
                            item.id === jobId
                                ? { ...item, status: "completed" as const, settlement, updatedAt: new Date().toISOString() }
                                : item,
                        ),
                    };
                });
            },
            cancelJob: (jobId) => {
                const job = get().jobs.find((item) => item.id === jobId);
                if (!job || job.status === "completed" || job.status === "cancelled") throw new Error("invalid_job");
                const quote = job.quotes.find((item) => item.id === job.acceptedQuoteId);
                set((state) => {
                    let wallets = state.wallets;
                    let ledger = state.ledger;
                    if (quote && (job.status === "active" || job.status === "submitted")) {
                        const clientWallet = {
                            ...state.wallets.client,
                            frozen: roundCredits(Math.max(0, state.wallets.client.frozen - quote.amount)),
                        };
                        wallets = { ...state.wallets, client: clientWallet };
                        ledger = [pushLedger(state, CLIENT_ROLE, "unfreeze", quote.amount, clientWallet, "Cancel job unfreeze", jobId), ...state.ledger];
                    }
                    return {
                        wallets,
                        ledger,
                        jobs: state.jobs.map((item) =>
                            item.id === jobId ? { ...item, status: "cancelled" as const, updatedAt: new Date().toISOString() } : item,
                        ),
                    };
                });
            },
            resetDemo: () => set({ ...seedState() }),
        }),
        {
            name: STORE_KEY,
            storage,
            partialize: (state) =>
                ({
                    role: state.role,
                    wallets: state.wallets,
                    ledger: state.ledger,
                    jobs: state.jobs,
                }) as StorageValue<JobStore>["state"],
            onRehydrateStorage: () => () => {
                useJobStore.setState({ hydrated: true });
            },
        },
    ),
);

export function getJobWallet(role: JobRole = useJobStore.getState().role) {
    return useJobStore.getState().wallets[role] || emptyWallet();
}
