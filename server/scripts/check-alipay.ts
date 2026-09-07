/**
 * 支付宝密钥自检。`npm run check:alipay`
 *
 * 专治最难查的那个错：把「应用私钥」和「支付宝公钥」填反了。填反后下单一切正常、
 * 收银台也能打开，只有用户付完款之后订单永远停在未付 —— 因为通知验签过不了，
 * 而验签失败是静默的。这里提前把它验出来。
 */
import crypto from "node:crypto";

import { pagePayUrl } from "../src/alipay.js";
import { alipayConfigured, settings } from "../src/config.js";

if (!alipayConfigured()) {
    console.error("✗ 支付宝没配全：需要 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY");
    process.exit(1);
}

// 按 64 字符切块再 join，不要用 replace 加换行：base64 长度正好是 64 的倍数时
// replace 会多产生一个空行，OpenSSL 报 `DECODER routines::unsupported`，看着像密钥错了。
const wrap = (body: string, label: string) => [`-----BEGIN ${label}-----`, ...(body.match(/.{1,64}/g) || []), `-----END ${label}-----`].join("\n");

// 1. 私钥能不能解析
let privateKey: crypto.KeyObject | null = null;
for (const label of ["PRIVATE KEY", "RSA PRIVATE KEY"]) {
    try {
        privateKey = crypto.createPrivateKey(wrap(settings.alipayPrivateKey, label));
        console.log(`✓ 应用私钥可解析（${label}，${privateKey.asymmetricKeyDetails?.modulusLength} bit）`);
        break;
    } catch {
        // 换一种头再试
    }
}
if (!privateKey) {
    console.error("✗ 应用私钥解析失败：检查是不是漏了字符，或者把公钥填到 ALIPAY_PRIVATE_KEY 了");
    process.exit(1);
}

// 2. 支付宝公钥能不能解析
let alipayPublicKey: crypto.KeyObject;
try {
    alipayPublicKey = crypto.createPublicKey(wrap(settings.alipayPublicKey, "PUBLIC KEY"));
    console.log(`✓ 支付宝公钥可解析（${alipayPublicKey.asymmetricKeyDetails?.modulusLength} bit）`);
} catch (error) {
    console.error(`✗ 支付宝公钥解析失败：${(error as Error).message}`);
    process.exit(1);
}

// 3. 两把是不是配对的 —— 如果是，说明填反了：ALIPAY_PUBLIC_KEY 该填支付宝给你的那串，
//    不是你自己上传上去的应用公钥。
const probe = Buffer.from("jackie-canvas-key-probe");
const signature = crypto.sign("RSA-SHA256", probe, privateKey);
if (crypto.verify("RSA-SHA256", probe, alipayPublicKey, signature)) {
    console.error("✗ ALIPAY_PUBLIC_KEY 和你的应用私钥是一对 —— 你填成「应用公钥」了。");
    console.error("  这里要填开放平台上的「支付宝公钥」，否则通知永远验不过，订单会一直停在未付。");
    process.exit(1);
}
console.log("✓ 两把密钥不配对（正确：一把是自己的私钥，一把是支付宝的公钥）");

// 4. 真签一次，看能不能拼出收银台链接
const url = pagePayUrl({ outTradeNo: "CHECKONLY000000000000", amount: "0.01", subject: "密钥自检（不会真的下单）" });
console.log(`✓ 收银台链接签名成功：${url.slice(0, 80)}…`);
console.log(`\n网关 ${settings.alipayGateway}`);
console.log(settings.alipayNotifyUrl ? `通知地址 ${settings.alipayNotifyUrl}` : "⚠ 未配置 ALIPAY_NOTIFY_URL：只能靠前端轮询和后台对账确认到账");
