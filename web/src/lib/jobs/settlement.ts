import { PLATFORM_FEE_RATE, type JobSettlement } from "./types";

/** 展示用格式化。真正的金额计算在服务端，这里只负责把数字画到界面上。 */
export function formatCredits(value: number) {
    return value.toFixed(2);
}

/**
 * 验收弹窗里的结算预览。**只是预览** —— 实际抽成、到手和利润以服务端
 * server/src/jobs.ts 的 acceptDelivery 算出并落库的为准。
 */
export function computeSettlement(quoteAmount: number, costAmount: number): Omit<JobSettlement, "settledAt"> {
    const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const quote = round(quoteAmount);
    const cost = round(Math.max(0, costAmount));
    const platformFee = round(quote * PLATFORM_FEE_RATE);
    const creatorPayout = round(quote - platformFee);
    return { quoteAmount: quote, costAmount: cost, platformFee, creatorPayout, profit: round(platformFee - cost) };
}
