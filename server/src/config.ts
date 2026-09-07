import { config as loadEnv } from "dotenv";

loadEnv();

const env = (key: string, fallback = "") => (process.env[key] ?? fallback).trim();

export const settings = {
    host: env("HOST", "0.0.0.0"),
    port: Number(env("PORT", "8787")),
    /** 允许跨域的前端来源，逗号分隔；`*` 表示不限制 */
    corsOrigin: env("CORS_ORIGIN", "*"),

    // ---------- 支付宝（电脑网站支付）----------
    // ALIPAY_PRIVATE_KEY 是自己的应用私钥（用来签名），ALIPAY_PUBLIC_KEY 是支付宝公钥
    // （用来验它发来的通知）。这两个极容易搞混：配反了的表现是下单正常、收银台也能打开，
    // 但用户付完款订单永远停在未付 —— 因为通知验签过不了。
    alipayAppId: env("ALIPAY_APP_ID"),
    alipayPrivateKey: env("ALIPAY_PRIVATE_KEY"),
    alipayPublicKey: env("ALIPAY_PUBLIC_KEY"),
    alipayGateway: env("ALIPAY_GATEWAY", "https://openapi.alipay.com/gateway.do"),
    /** 异步通知地址，必须公网可达并指向本服务的 /api/pay/notify；留空则只能靠轮询和对账 */
    alipayNotifyUrl: env("ALIPAY_NOTIFY_URL"),
    /** 付完之后浏览器跳回来的页面。只是「用户回来了」，不能当付款成功的凭据 */
    alipayReturnUrl: env("ALIPAY_RETURN_URL"),

    // ---------- 订单与钱包库（MySQL）----------
    mysqlHost: env("MYSQL_HOST"),
    mysqlPort: Number(env("MYSQL_PORT", "3306")),
    mysqlUser: env("MYSQL_USER"),
    mysqlPassword: env("MYSQL_PASSWORD"),
    mysqlDatabase: env("MYSQL_DATABASE"),
    mysqlConnectionLimit: Number(env("MYSQL_CONNECTION_LIMIT", "10")),

    // ---------- 兜底对账 ----------
    reconcileIntervalSec: Number(env("RECONCILE_INTERVAL_SEC", "60")),
    reconcileWindowMin: Number(env("RECONCILE_WINDOW_MIN", "1440")),

    // ---------- 用户身份（复用前端已有的 MaaS 登录）----------
    // 本服务不自建账号：前端带着 MaaS 的 JWT 过来，这里拿去问 MaaS「你是谁」，认它返回的
    // userId。订单和钱包因此天然和现有登录体系对齐，不用再发一套凭据、也不用同步用户表。
    authApiBase: env("AUTH_API_BASE", "https://maas.gravitex.ai/prod-api"),
    authClientId: env("AUTH_CLIENT_ID", "e5cd7e4891bf95d1d19206ce24a7b32e"),
    /** 与前端 constant/auth.ts 同一把：MaaS 用配对公钥加密响应体的 AES 密钥 */
    authRsaPrivateKey: env(
        "AUTH_RSA_PRIVATE_KEY",
        "MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAmc3CuPiGL/LcIIm7zryCEIbl1SPzBkr75E2VMtxegyZ1lYRD+7TZGAPkvIsBcaMs6Nsy0L78n2qh+lIZMpLH8wIDAQABAkEAk82Mhz0tlv6IVCyIcw/s3f0E+WLmtPFyR9/WtV3Y5aaejUkU60JpX4m5xNR2VaqOLTZAYjW8Wy0aXr3zYIhhQQIhAMfqR9oFdYw1J9SsNc+CrhugAvKTi0+BF6VoL6psWhvbAiEAxPPNTmrkmrXwdm/pQQu3UOQmc2vCZ5tiKpW10CgJi8kCIFGkL6utxw93Ncj4exE/gPLvKcT+1Emnoox+O9kRXss5AiAMtYLJDaLEzPrAWcZeeSgSIzbL+ecokmFKSDDcRske6QIgSMkHedwND1olF8vlKsJUGK3BcdtM8w4Xq7BpSBwsloE=",
    ),
    /** token → userId 的缓存秒数。前端每 2 秒轮一次订单，不缓存会把 MaaS 打爆 */
    authCacheSec: Number(env("AUTH_CACHE_SEC", "60")),
};

export const alipayConfigured = () => Boolean(settings.alipayAppId && settings.alipayPrivateKey && settings.alipayPublicKey);

export const mysqlConfigured = () => Boolean(settings.mysqlHost && settings.mysqlUser && settings.mysqlPassword && settings.mysqlDatabase);
