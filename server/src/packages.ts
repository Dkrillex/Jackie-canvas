/**
 * 充值套餐档位。**价格表只存在于服务端。**
 *
 * 下单接口只收一个 packageId，绝不收金额 —— 一旦允许前端传金额，改一个数字就能
 * 一分钱买下全部积分，这是支付集成最常见的洞。前端拿到的档位列表只是展示，
 * 真正结算的金额从这里按 id 查回来。
 *
 * 档位里同时写死了「多少钱换多少积分」，因此运行时不需要任何汇率换算 ——
 * 这张表本身就是价目表。调价直接改这里（或用 RECHARGE_PACKAGES 覆盖），
 * 已经创建的订单不受影响：订单落库时把 amount 和 credits 都抄了一份。
 *
 * 在线支付宝单笔上限 200 元。RECHARGE_PACKAGES 里更高的档会被丢掉；
 * 更大额度走商务，不要在这里加档。
 */

/** 在线充值单笔上限（元）。超过的档位既不展示也不能下单。 */
export const MAX_RECHARGE_YUAN = 200;

export type RechargePackage = {
    id: string;
    /** 人民币金额，两位小数的字符串。用字符串不用 number：钱经不起二进制小数的舍入 */
    amount: string;
    /** 到账积分。项目里 1 积分 = 1 美元 */
    credits: string;
    /** 相对基础档多送的积分，纯展示用 */
    bonus: string;
    subject: string;
};

const DEFAULT_PACKAGES: RechargePackage[] = [
    { id: "starter", amount: "50.00", credits: "7.00", bonus: "0.00", subject: "NOVAWANDER AI 积分充值 50 元" },
    { id: "basic", amount: "200.00", credits: "29.00", bonus: "1.00", subject: "NOVAWANDER AI 积分充值 200 元" },
];

function parsePackages(): RechargePackage[] {
    const raw = (process.env.RECHARGE_PACKAGES || "").trim();
    if (!raw) return DEFAULT_PACKAGES;
    try {
        const parsed = JSON.parse(raw) as RechargePackage[];
        if (!Array.isArray(parsed) || !parsed.length) throw new Error("空列表");
        // 金额和积分统一成两位小数字符串，免得覆盖配置里写成数字后一路带着浮点误差
        const normalized = parsed.map((item) => ({
            ...item,
            amount: Number(item.amount).toFixed(2),
            credits: Number(item.credits).toFixed(2),
            bonus: Number(item.bonus || 0).toFixed(2),
        }));
        const capped = normalized.filter((item) => Number(item.amount) <= MAX_RECHARGE_YUAN);
        if (capped.length !== normalized.length) {
            console.warn(`[pay] RECHARGE_PACKAGES 里有超过 ${MAX_RECHARGE_YUAN} 元的档，已丢弃`);
        }
        if (!capped.length) throw new Error(`没有不超过 ${MAX_RECHARGE_YUAN} 元的档`);
        return capped;
    } catch (error) {
        // 配错了就退回默认档位并且说清楚，不要静默用一份谁也不知道的价目表
        console.error(`[pay] RECHARGE_PACKAGES 解析失败，改用内置档位：${(error as Error).message}`);
        return DEFAULT_PACKAGES;
    }
}

export const packages = parsePackages();

export function findPackage(id: string) {
    return packages.find((item) => item.id === id);
}
