import i18n from "@/i18n";

const USD_AMOUNT = /[＄$]\s*(-?\d+(?:\.\d+)?)/g;
const INSUFFICIENT = /额度不足|预扣费额度失败|quota is not enough|insufficient/i;

const points = (value: string) => i18n.t("wallet.points", { value: Math.max(0, Number(value)).toFixed(2) });

/** New API 报错里的美元额度（如「用户额度不足, 剩余额度: ＄-0.54」）换成积分文案，界面不出现美元 */
export function toPointsMessage(message: string) {
    if (INSUFFICIENT.test(message)) {
        const balance = [...message.matchAll(USD_AMOUNT)][0]?.[1];
        return balance === undefined ? i18n.t("apiErrors.insufficientPoints") : i18n.t("apiErrors.insufficientPointsWithBalance", { balance: points(balance) });
    }
    return message.replace(USD_AMOUNT, (_, value: string) => points(value));
}
