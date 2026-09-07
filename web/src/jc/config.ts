/** 积分充值与接单服务（server/），前端走同源 `/pay-api`，由 Vite 代理或部署平台 rewrite 转发。 */
export const PAY_API_BASE = import.meta.env.VITE_PAY_API_BASE || "/pay-api";

/** 与 server/src/packages.ts 的 MAX_RECHARGE_YUAN 对齐，只用于展示过滤。真正拦单在服务端。 */
export const MAX_RECHARGE_YUAN = 200;

/** 大额充值不走支付宝，引导用户写信。 */
export const BUSINESS_MAIL = "mailto:1844025705@qq.com?subject=Jackie%20Canvas%20%E5%A4%A7%E9%A2%9D%E5%85%85%E5%80%BC";
