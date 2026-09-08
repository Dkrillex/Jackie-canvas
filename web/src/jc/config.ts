/** 积分充值与接单服务（server/），前端走同源 `/pay-api`，由 Vite 代理或部署平台 rewrite 转发。 */
export const PAY_API_BASE = import.meta.env.VITE_PAY_API_BASE || "/pay-api";

/** 与 server/src/packages.ts 的 MAX_RECHARGE_YUAN 对齐，只用于展示过滤。真正拦单在服务端。 */
export const MAX_RECHARGE_YUAN = 200;

/** 大额充值不走支付宝，引导用户加微信；邮件作为备用。 */
export const BUSINESS_MAIL = "mailto:1844025705@qq.com?subject=Jackie%20Canvas%20%E5%A4%A7%E9%A2%9D%E5%85%85%E5%80%BC";

/**
 * 商务微信二维码。**目前是占位图**（复用 `public/demo/job-demo.jpg`），
 * 换成真码时把这里指到新文件即可，页面不用动。
 */
export const BUSINESS_WECHAT_QR = "/demo/job-demo.jpg";

/** 二维码扫不出来时的备用联系方式，和 BUSINESS_MAIL 是同一个地址，这里只是给人看的文本。 */
export const BUSINESS_MAIL_TEXT = "1844025705@qq.com";
