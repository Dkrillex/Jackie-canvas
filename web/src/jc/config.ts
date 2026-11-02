/** 登录鉴权走 New API 同源代理（hinnflow-docker.conf / Vite 的 /new-api）。 */
export const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || "/new-api";

/** 积分充值与注册服务（server/），前端走同源 `/pay-api`。 */
export const PAY_API_BASE = import.meta.env.VITE_PAY_API_BASE || "/pay-api";

/** 本地 Agent 入口暂时关闭，代码留着，单独开分支再打开。 */
export const AGENT_UI_ENABLED = false;

/** 本地代理页签暂时关闭，代码留着，单独开分支再打开。 */
export const LOCAL_PROXY_UI_ENABLED = false;
