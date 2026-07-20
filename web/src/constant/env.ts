export const APP_VERSION = __APP_VERSION__ || "dev";

export const DOCS_URL = import.meta.env.VITE_DOC_URL || "https://docs.canvas.best";

export const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || "/gw";

// 官方插件清单地址:CI 发布到 plugins-dist 分支,经 jsDelivr 远程拉取;可用环境变量覆盖成自建来源
export const PLUGIN_REGISTRY_URL = import.meta.env.VITE_PLUGIN_REGISTRY_URL || "https://cdn.jsdelivr.net/gh/basketikun/infinite-canvas@plugins-dist/official-plugins.json";
