/**
 * 接单/积分 Mock API。当前全部走本地 store，后续接后端时只替换本文件实现。
 * 1 credit = 1 USD。
 */
import { useJobStore } from "@/stores/use-job-store";
import type { Job, JobRole, LedgerEntry, Wallet } from "@/lib/jobs/types";

export type { Job, JobRole, LedgerEntry, Wallet };

export async function listJobs(): Promise<Job[]> {
    return useJobStore.getState().jobs;
}

export async function getJob(id: string): Promise<Job | undefined> {
    return useJobStore.getState().jobs.find((job) => job.id === id);
}

export async function getWallet(role?: JobRole): Promise<Wallet> {
    const state = useJobStore.getState();
    return state.wallets[role || state.role];
}

export async function listLedger(role?: JobRole): Promise<LedgerEntry[]> {
    const state = useJobStore.getState();
    const current = role || state.role;
    return state.ledger.filter((entry) => entry.role === current);
}

export async function mockRecharge(amount: number, note?: string) {
    useJobStore.getState().recharge(amount, note);
}

export async function mockCreateJob(input: { title: string; brief: string; budget: number }) {
    return useJobStore.getState().createJob(input);
}

export async function mockSubmitQuote(jobId: string, amount: number, note: string) {
    useJobStore.getState().submitQuote(jobId, amount, note);
}

export async function mockAcceptQuote(jobId: string, quoteId: string) {
    useJobStore.getState().acceptQuote(jobId, quoteId);
}

export async function mockSubmitDelivery(jobId: string, input: { content: string; link?: string; canvasId?: string }) {
    useJobStore.getState().submitDelivery(jobId, input);
}

export async function mockRejectDelivery(jobId: string, reason: string) {
    useJobStore.getState().rejectDelivery(jobId, reason);
}

export async function mockAcceptDelivery(jobId: string, costAmount: number) {
    useJobStore.getState().acceptDelivery(jobId, costAmount);
}

export async function mockCancelJob(jobId: string) {
    useJobStore.getState().cancelJob(jobId);
}
