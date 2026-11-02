/**
 * 支付宝「电脑网站支付」这一层。三件事：生成收银台链接、主动查订单、验通知签名。
 *
 * 用官方 SDK 而不是自己拼签名串：验签写错就是个安全洞 —— 谁都能伪造一条「已付款」的
 * POST 打过来给自己充值。签名的规范化细节（哪些字段参与、空值怎么处理、编码顺序）
 * 不值得自己实现一遍。
 */
import { createPrivateKey } from "node:crypto";

import { AlipaySdk } from "alipay-sdk";

import { alipayConfigured, settings } from "./config.js";

export class AlipayNotConfigured extends Error {}

/**
 * 把应用私钥统一成 PKCS#1 的 base64 正文。
 *
 * 支付宝的密钥工具能导出两种格式：PKCS#1（「非 JAVA 适用」）和 PKCS#8（「JAVA 适用」）。
 * SDK 靠 keyType 区分，配反了报的错和密钥毫无关系，第一次见很难联想到是格式问题。
 * 这里用 node:crypto 解析（两种都认）再按 PKCS#1 导出，用户粘哪种都能用。
 */
function normalizePrivateKey(input: string): string {
    const body = input.trim();
    if (!body) return body;
    const wrapped = body.includes("-----BEGIN") ? body : `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
    // createPrivateKey 看的是内容不是头，但头写错时它会挑剔，两种头都试一遍最稳
    for (const candidate of [wrapped, wrapped.replace(/(BEGIN|END) PRIVATE KEY/g, "$1 RSA PRIVATE KEY")]) {
        try {
            const pem = createPrivateKey(candidate).export({ type: "pkcs1", format: "pem" }).toString();
            return pem
                .split("\n")
                .filter((line) => line && !line.startsWith("-----"))
                .join("");
        } catch {
            // 换一种头再试
        }
    }
    return body; // 解析不了就原样交给 SDK，让它报自己的错
}

let sdk: AlipaySdk | null = null;

function client(): AlipaySdk {
    if (sdk) return sdk;
    if (!alipayConfigured()) {
        throw new AlipayNotConfigured("支付宝密钥没配全：需要 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY");
    }
    sdk = new AlipaySdk({
        appId: settings.alipayAppId,
        privateKey: normalizePrivateKey(settings.alipayPrivateKey),
        alipayPublicKey: settings.alipayPublicKey,
        gateway: settings.alipayGateway,
        signType: "RSA2",
        keyType: "PKCS1",
        // 保留支付宝原始的下划线字段名（trade_status / total_amount / trade_no），
        // 和文档、和通知报文对得上，排查时不用在两套命名之间换算
        camelcase: false,
    });
    return sdk;
}

/**
 * 生成收银台链接，让浏览器跳过去付款。
 *
 * 这一步**不发起网络请求** —— 只是把参数签名后拼成一个 URL，所以这里不会有
 * 「支付宝下单失败」，真正的受理发生在用户打开这个链接时。
 *
 * 金额和标题都由调用方（服务端按档位查出来）给，绝不能取前端传来的值。
 */
export function pagePayUrl(input: { outTradeNo: string; amount: string; subject: string }): string {
    return client().pageExecute("alipay.trade.page.pay", "GET", {
        // 没配就整个键都不要传。SDK 签名时会遍历所有键，留一个值为 undefined 的键在这里
        // 会让它在 Array.prototype.toString.call(undefined) 上直接抛错 —— 表现是每次
        // 下单都 500，而错误信息和支付宝毫无关系。
        ...(settings.alipayNotifyUrl ? { notifyUrl: settings.alipayNotifyUrl } : {}),
        // 付完之后浏览器跳回来的地址。它只说明「用户回来了」，**不能**当作付款成功的凭据 ——
        // 这个跳转是用户浏览器发起的，可以伪造。钱到没到只认验过签的 notify 和 trade_query。
        ...(settings.alipayReturnUrl ? { returnUrl: settings.alipayReturnUrl } : {}),
        bizContent: {
            out_trade_no: input.outTradeNo,
            total_amount: input.amount,
            subject: input.subject,
            product_code: "FAST_INSTANT_TRADE_PAY", // 电脑网站支付的即时到账场景，固定这个值
        },
    });
}

export type TradeQueryResult = {
    code?: string;
    sub_code?: string;
    trade_status?: string;
    total_amount?: string;
    trade_no?: string;
    [key: string]: unknown;
};

/**
 * 主动问支付宝这笔单付了没。
 *
 * 有了它，付款结果就不只依赖异步通知：通知可能因为回调地址不通、隧道断了、服务重启
 * 而没收到，而这个接口随时可以问。订单还没被支付宝创建时会回 ACQ.TRADE_NOT_EXIST，
 * 那不是错误，只是「用户还没点进收银台」。
 */
export async function tradeQuery(outTradeNo: string): Promise<TradeQueryResult> {
    return (await client().exec("alipay.trade.query", {
        bizContent: { out_trade_no: outTradeNo },
    })) as TradeQueryResult;
}

/**
 * 验异步通知的签名。**这是整条链路唯一的安全边界** —— 不验签的话，任何人都能往
 * notify 端点 POST 一条 trade_status=TRADE_SUCCESS 给自己充值。
 *
 * 用 V2（raw 模式）：表单解析时值已经 URL decode 过了，再 decode 一次就对不上。
 * 验不过时再去掉空值参数试一遍 —— 支付宝签名时本来就不带空值字段，而 SDK 会把它们
 * 留在待验串里，真遇到带空值的通知就会全军覆没且毫无报错。
 */
export function verifyNotify(form: Record<string, string>): boolean {
    try {
        if (client().checkNotifySignV2(form)) return true;
        const compact = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ""));
        if (Object.keys(compact).length !== Object.keys(form).length && client().checkNotifySignV2(compact)) {
            console.warn("[pay] 通知带空值字段，去掉后验签通过");
            return true;
        }
        return false;
    } catch (error) {
        // 验签失败一律当没通过，但要留下痕迹：静默失败的表现是「订单永远停在未付、
        // 却没有任何报错」，那是最难查的一种。
        console.error(`[pay] 验签异常（当作没通过）：${(error as Error).message}`);
        return false;
    }
}
