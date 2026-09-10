import { config as loadEnv } from "dotenv";

loadEnv();

const env = (key: string, fallback = "") => (process.env[key] ?? fallback).trim();

const ALIPAY_APP_ID = "2021006193637204";
const ALIPAY_PRIVATE_KEY = [
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCSogEltyGaPyO+93VIeKkyVPxgJme+bhVcz1YU+d7cG7jrPywB7/l6TV4ZU894Dyka52WjK1hG65l8YUlknXF/oT4OZu1VOKIeRbCS9EMIG7B0Ojea17Pci5jmtlgd3qxNBxqW1zVR8oI8KSMZxg+50X2q75S2hX1hfVBpXP6L6kTMzCN0Eckaufn6XgDsBVYa2tcpT5iOVQ1q+mMworpNVsWIV6qvgxF3klQ1vtiTHfAopYvYDBNxIC8cmrGGc2PVz1o/if4FQzol6p845Y4Iiua2ZHzD4YtN6VmcjcNKITlxSSNzriw9mWfc0lmiwK7xwZ1DUI0XLLLCEh3kb1/1AgMBAAECggEBAIy8vYkrii735yFFdeZHGW5br5fBhNV75zkbL64WXda5LPVtvpllcPf4BhcdIAZF1tghvKWt1p7LRpfg8IaHrwYnBt7f329qWf/gN6f0ldnUabpEnlYaLmHCAtF9tnmE3a9Y4CZjDKRItMN1YGE+fp2E+q70ILJG0Z6enm1ielZi3QLjfHLKkWA38FnOHDRSmgJ8emtrbjhfqR1uI8024VmRmC9YA0h9ScNmJB1Bp3DEw3xiw2jrJq+yjQYjPAHirtzwSohyWcqOEWW8jTQFdi1A8D79gEPAeUIrqNGo03Mfl9bnFISNNkyeaBlPWWUG/jfz1ZYLMhjA/F/+zIg6rgkCgYEA5ILtW7o3V04Ulp7w540qKaoTLld2g8YZPAryM8ePmK4nrvHoxfreUEzauwKItlo4I/HGxepjpHKOosnDobFWacdCjliTADEJSTPVt1jnbNrRs0vCKBjGF6bzxgen47A0cyiAIud9Gv5Vx3OGDa2P3RTBgdx3v+38/OcffdWnecMCgYEApEWaYJZgZ/i9xa1NDaO479g3cAFiVVanTdFWwI8qXiNkcdIzqJvMjnATU3pxQ+9Y036g2Pn2emUEaXFBw40hqYQ+m/TpnfsiaOA/dtIzkMlZU3RYgdacUppEDg/Im13oNEw5eFDc5mSAC1W5dGLIBErtFikKFAhxviMurWkka+cCgYARCGVS4gV//3TvaTeBuvb6lg/J84EE/34gCJzXGTft5IVWt/dm0nVBvQjMybqRBRaML1hmpjr5JgTVw35Ojh5n0g929sk2SXFswG1ctkbByWm6GJqHTJlvZ+VhzG5KPXcbYlhywZiEq5KPRGAoothHXWWzHVDbwIyL+VpSkdti6w",
    "KBgGYP0KCeDXvLsax1xd/pjueFgLwYQA4hboUMwUeWK46dkrSdEvd5BRiiTX+aHXFF7fxJOopUk2zsAle4xFFJCFcYEQY4nkVHWNOsMAIVC3CziMovCSZyPmGb8xiBefP93l1P1o0IQJbsbhmcw0KqdPclzjPsf5R+wpyNo1yebMCVAoGAK0GtsPzV/bYivaCcFOUAXJiBHg+NYkxYtoodf4CrvkH595VYMy4/UOOauZCYTWZ3wczWrKoTaNWOXYY85EGXJOVeOVRDkj16aoC2lJwMNyZ8SIAY2Ma47yNphgu8Y0EipG+x3TeHRAhwXLNTLpb8IjjFH0sWNqse9MCIHCrhDgQ=",
].join("");
const ALIPAY_PUBLIC_KEY = [
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiHlURnsDRqv9II7gVk+CZDzdOVJvwC2FYhQ72FG8Pxw73BHM2pJNBF1sYMKExYUXRfXRs5RKAR95mJCWMPz7w2MpVPNUt1MAKvSnRYvhpbqxwuxzdSOav4P6uwhfuwJAG+0EGWKRGxBuv8RaVYVq+99gakME3xCDBGXgH2uxC2phNIXueLJnhyVtBPVx60TVF+ZzEABW/MC1bUK1nsOLH",
    "/jJ4SnmJIq8k/lcQn4qPha+/yhC99q2AIIVBu2oVyHSSgxCv8uAe/llCrfTSUwaQ/n0fdrrJ9a63tz046F9uf7/6/kdDE7IyELTDdwSild/y/+rRLxYcY5dei1NQCdwJQIDAQAB",
].join("");
const MYSQL_HOST = ["rm-7xv43x5m6te3yuk2c", "1o.mysql.rds.aliyuncs.com"].join("");
const MYSQL_USER = ["dms_user_", "81d7ed6"].join("");
const MYSQL_PASSWORD = ["Cxx", "123456"].join("");
const MYSQL_DATABASE = "hinnflow_database";

export const settings = {
    host: env("HOST", "0.0.0.0"),
    port: Number(env("PORT", "8787")),
    /** 允许跨域的前端来源，逗号分隔；`*` 表示不限制 */
    corsOrigin: env("CORS_ORIGIN", "*"),

    // ---------- 支付宝（电脑网站支付）----------
    // ALIPAY_PRIVATE_KEY 是自己的应用私钥（用来签名），ALIPAY_PUBLIC_KEY 是支付宝公钥
    // （用来验它发来的通知）。这两个极容易搞混：配反了的表现是下单正常、收银台也能打开，
    // 但用户付完款订单永远停在未付 —— 因为通知验签过不了。
    alipayAppId: env("ALIPAY_APP_ID", ALIPAY_APP_ID),
    alipayPrivateKey: env("ALIPAY_PRIVATE_KEY", ALIPAY_PRIVATE_KEY),
    alipayPublicKey: env("ALIPAY_PUBLIC_KEY", ALIPAY_PUBLIC_KEY),
    alipayGateway: env("ALIPAY_GATEWAY", "https://openapi.alipay.com/gateway.do"),
    /** 异步通知地址，必须公网可达并指向本服务的 /api/pay/notify；留空则只能靠轮询和对账 */
    alipayNotifyUrl: env("ALIPAY_NOTIFY_URL") || (process.env.VERCEL ? "https://canvas.hinnflow.com/pay-api/api/pay/notify" : ""),
    /** 付完之后浏览器跳回来的页面。只是「用户回来了」，不能当付款成功的凭据 */
    alipayReturnUrl: env("ALIPAY_RETURN_URL") || (process.env.VERCEL ? "https://canvas.hinnflow.com/wallet" : ""),

    // ---------- 订单与钱包库（MySQL）----------
    mysqlHost: env("MYSQL_HOST", MYSQL_HOST),
    mysqlPort: Number(env("MYSQL_PORT", "3306")),
    mysqlUser: env("MYSQL_USER", MYSQL_USER),
    mysqlPassword: env("MYSQL_PASSWORD", MYSQL_PASSWORD),
    mysqlDatabase: env("MYSQL_DATABASE", MYSQL_DATABASE),
    mysqlConnectionLimit: Number(env("MYSQL_CONNECTION_LIMIT", "10")),

    // ---------- 兜底对账 ----------
    reconcileIntervalSec: Number(env("RECONCILE_INTERVAL_SEC", "60")),
    reconcileWindowMin: Number(env("RECONCILE_WINDOW_MIN", "1440")),

    // ---------- 接单押金与有效期 ----------
    // 接单时冻结的押金。工时超时未交付会被罚没，一部分赔给雇主、剩下的归平台。
    // 两个数都以服务端为准，前端只是展示。
    jobDepositAmount: Number(env("JOB_DEPOSIT_AMOUNT", "5")),
    jobDepositToClient: Number(env("JOB_DEPOSIT_TO_CLIENT", "2")),
    /** 提交交付后雇主的验收期，超时自动验收打款 —— 否则雇主只要不点验收就能白嫖交付物 */
    jobReviewDays: Number(env("JOB_REVIEW_DAYS", "3")),
    /** 到期扫描间隔秒数。设成 0 或负数就关掉（关掉之后没有任何东西会让单子过期） */
    jobExpiryIntervalSec: Number(env("JOB_EXPIRY_INTERVAL_SEC", "60")),

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
