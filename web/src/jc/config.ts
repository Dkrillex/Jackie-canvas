/** 积分充值与接单服务（server/），前端走同源 `/pay-api`，由 Vite 代理或部署平台 rewrite 转发。 */
export const PAY_API_BASE = import.meta.env.VITE_PAY_API_BASE || "/pay-api";
