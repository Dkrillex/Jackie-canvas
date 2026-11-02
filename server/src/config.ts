import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const envDir = process.cwd();
loadEnv({ path: resolve(envDir, ".env") });
const localEnv = resolve(envDir, ".env.local");
if (existsSync(localEnv)) loadEnv({ path: localEnv, override: true });

const env = (key: string, fallback = "") => (process.env[key] ?? fallback).trim();

// 密钥、数据库账号一律只从 server/.env 读，不在代码里写默认值：仓库是公开的。

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

    // ---------- nova-api 用户库（和上面钱包库不是同一台）----------
    // hinnflow 注册直写这张 users 表，登录仍走 /new-api。
    novaApiMysqlHost: env("NOVA_API_MYSQL_HOST"),
    novaApiMysqlPort: Number(env("NOVA_API_MYSQL_PORT", "3306")),
    novaApiMysqlUser: env("NOVA_API_MYSQL_USER"),
    novaApiMysqlPassword: env("NOVA_API_MYSQL_PASSWORD"),
    novaApiMysqlDatabase: env("NOVA_API_MYSQL_DATABASE"),

    // ---------- 对象存储（阿里云 OSS，Seedance 参考素材上传）----------
    // AccessKey 只在服务端用来签发预签名上传地址，浏览器拿不到。Bucket 需公共读，并允许站点来源跨域 PUT。
    ossRegion: env("OSS_REGION"),
    ossBucket: env("OSS_BUCKET"),
    ossAccessKeyId: env("OSS_ACCESS_KEY_ID"),
    ossAccessKeySecret: env("OSS_ACCESS_KEY_SECRET"),
    ossPrefix: env("OSS_PREFIX", "canvas/"),
    /** 公网访问地址，留空用 https://{bucket}.{region}.aliyuncs.com */
    ossPublicBaseUrl: env("OSS_PUBLIC_BASE_URL"),
    /** 预签名上传地址有效期（秒），过期后上传失败、需要重新签发 */
    ossSignExpiresSec: Number(env("OSS_SIGN_EXPIRES_SEC", "600")),

    // ---------- 兜底对账 ----------
    reconcileIntervalSec: Number(env("RECONCILE_INTERVAL_SEC", "60")),
    reconcileWindowMin: Number(env("RECONCILE_WINDOW_MIN", "1440")),

    // ---------- 用户身份（复用前端已有的 New API 登录）----------
    // 本服务不自建账号：前端带着 access_token 和 New-Api-User 过来，这里拿去问 nova-api「你是谁」，认它返回的
    // userId。订单和钱包因此天然和现有登录体系对齐，不用再发一套凭据、也不用同步用户表。
    authApiBase: env("AUTH_API_BASE", "https://api.novawander.cn"),
    /** token → userId 的缓存秒数。前端每 2 秒轮一次订单，不缓存会把鉴权上游打爆 */
    authCacheSec: Number(env("AUTH_CACHE_SEC", "60")),
};

export const alipayConfigured = () => Boolean(settings.alipayAppId && settings.alipayPrivateKey && settings.alipayPublicKey);

export const mysqlConfigured = () => Boolean(settings.mysqlHost && settings.mysqlUser && settings.mysqlPassword && settings.mysqlDatabase);

export const ossConfigured = () => Boolean(settings.ossRegion && settings.ossBucket && settings.ossAccessKeyId && settings.ossAccessKeySecret);

export const novaApiMysqlConfigured = () =>
    Boolean(settings.novaApiMysqlHost && settings.novaApiMysqlUser && settings.novaApiMysqlPassword && settings.novaApiMysqlDatabase);
