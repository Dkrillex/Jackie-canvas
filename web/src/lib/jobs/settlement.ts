import { PLATFORM_FEE_RATE, type JobSettlement } from "./types";

export function roundCredits(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function availableCredits(balance: number, frozen: number) {
    return roundCredits(Math.max(0, balance - frozen));
}

export function formatCredits(value: number) {
    return `${roundCredits(value).toFixed(2)}`;
}

export function computeSettlement(quoteAmount: number, costAmount: number): Omit<JobSettlement, "settledAt"> {
    const quote = roundCredits(quoteAmount);
    const cost = roundCredits(Math.max(0, costAmount));
    const platformFee = roundCredits(quote * PLATFORM_FEE_RATE);
    const creatorPayout = roundCredits(quote - platformFee);
    const profit = roundCredits(platformFee - cost);
    return { quoteAmount: quote, costAmount: cost, platformFee, creatorPayout, profit };
}
