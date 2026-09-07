export const APP_VERSION = __APP_VERSION__ || "dev";

export const DOCS_URL = import.meta.env.VITE_DOC_URL || "https://docs.canvas.best";

/** 登录鉴权走 MaaS 同源代理；AI 网关仍用 /gw */
export const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || "/prod-api";

/** 积分充值服务（支付宝下单 / 订单与钱包），同源代理到 server/ */
export const PAY_API_BASE = import.meta.env.VITE_PAY_API_BASE || "/pay-api";

// Official plugin registry URL: CI publishes to plugins-dist for jsDelivr delivery; an environment variable may override it for self-hosting.
export const PLUGIN_REGISTRY_URL = import.meta.env.VITE_PLUGIN_REGISTRY_URL || "https://cdn.jsdelivr.net/gh/basketikun/infinite-canvas@plugins-dist/official-plugins.json";
