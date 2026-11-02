# hinnflow 充值服务

支付宝充值（到账直接加 New API 调用额度）+ 注册（直写 nova-api 用户表）+ 对象存储签名。前端其余部分仍然是纯浏览器直连，**只有充值这条链路需要服务端** ——
支付宝私钥、通知验签和订单落库都不能放在浏览器里。

不部署这个服务，前端一切照常，只有 `/wallet` 页面会提示充值不可用。

## 它负责什么

```
浏览器 ──POST /api/pay/orders (只传档位 id)──► 本服务 ──签名──► 支付宝收银台
                                                  │
   用户在支付宝付款 ──────────────────────────────┘
                     │
   ┌─────────────────┼──────────────────────┐
   │                 │                      │
异步通知          前端轮询主动查          后台兜底对账
(验签后入账)      (用户还在页面上)        (谁都不在的时候)
   └─────────────────┴──────────────────────┘
                     ▼
            orders.settle()（幂等，一笔单只入账一次）
                     ▼
        recharge_orders 置为 paid + quota_grants 插一条 pending（同一个事务）
                     ▼
        grants.processGrant()：管理员令牌调 New API add_quota 给账号加额度
```

为什么要三条腿：异步通知会丢（回调地址被挡、隧道断掉、服务重启的那几秒），而用户的钱是
真扣了；前端轮询能兜住一部分，但它只在用户开着页面时才跑。三条走的都是同一个幂等函数，
同时命中也只会入账一次。

## 安全边界

- **金额永远由服务端决定。** 下单接口只收 `packageId`，价目表在 `src/packages.ts`。
  让前端传金额等于让用户自己定价。
- **能改「已付」状态的只有两处**：验过签的 `/api/pay/notify`，和主动查询支付宝的结果。
  查状态接口只读库，不接受前端写入。
- **通知要过四道关**：验签 → `app_id` 对得上 → 订单存在 → 金额一致。
- **入账幂等靠三层**：订单行 `SELECT ... FOR UPDATE`、`UPDATE ... WHERE status <> 'paid'`、
  流水表 `UNIQUE KEY (kind, ref_no)`。

## 起服务

```bash
cd server
npm install
cp .env.example .env.local   # 本地开发
# 线上 Docker 用 .env，填公网 ALIPAY_NOTIFY_URL / ALIPAY_RETURN_URL
npm run check:alipay     # 自检密钥有没有填反（最难查的错）
npm run check:db         # 自检数据库，顺便把三张表建出来
npm run dev
```

默认监听 `8787`。前端 `bun run dev` 时 Vite 会把 `/pay-api` 代理过来，不用改任何前端配置。

## 部署

前端和本服务要在同一个域名下，前端才能用同源的 `/pay-api`。只用 Docker：

```bash
cp server/.env.example server/.env   # 填支付宝、两套 MySQL、公网 ALIPAY_NOTIFY_URL / ALIPAY_RETURN_URL
docker compose -f docker-compose.hinnflow.yml up -d --build
```

`docker-compose.hinnflow.yml` 会起 `pay` 容器（只在 compose 内网监听 8787，不映射到宿主机），
`hinnflow-docker.conf` 把 `/pay-api/` 反代到 `pay:8787`。

- 密钥和数据库账号**只放 `server/.env`**（已被 `.gitignore` 忽略），不要写进 `src/config.ts` 默认值：仓库是公开的。
- 跨域部署时把 `CORS_ORIGIN` 设成前端域名，不要在生产留 `*`。

`ALIPAY_NOTIFY_URL` 要填公网可达的 `https://你的域名/pay-api/api/pay/notify`。本地调试用
ngrok / frp 把它暴露出去；不填也能到账，只是只剩轮询和对账两条腿，慢一点。

## 数据表

首次连接自动建，不需要手工执行 SQL。

| 表 | 用途 |
| --- | --- |
| `recharge_orders` | 充值订单。`credits` 是到账的美元额度，下单时从档位抄一份，之后调价不影响旧单 |
| `quota_grants` | 额度发放记录。`ref_no` 唯一，一笔充值单只发一次 |

金额和额度全部用 `DECIMAL`，读出来也保持字符串 —— 钱经不起二进制小数的舍入。

旧版本的积分钱包 `user_wallets` / `wallet_ledger` 已废弃，代码不再读写也不再建这两张表；库里的旧表和旧余额不迁移，可自行删除。

## 额度发放

到账后用 `NEW_API_ADMIN_TOKEN` 调 New API `POST /api/user/manage`（`action=add_quota`）。

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| `pending` | 已付款，还没调用 | 通知、轮询、后台对账都会自动处理 |
| `granting` | 调用中 | 长时间停在这里说明进程中途挂了，按 `unknown` 处理 |
| `done` | 已到账 | — |
| `failed` | New API 明确拒绝（令牌错、用户不存在等） | 修好配置后 `npm run grants:retry` |
| `unknown` | 超时或 5xx，额度可能已经加上 | 先到 New API 后台核对，确认没加上再 `npm run grants:retry -- --unknown` |

`npm run grants:retry -- --list` 列出所有需要处理的记录。


## 身份

本服务不自建账号：前端带着 New API 的 `access_token` 和 `New-Api-User` 过来，这里拿去问
nova-api `GET /api/user/self`「你是谁」，认它返回的用户 id。所以订单天然和现有登录体系对齐，
不用同步用户表。默认 `AUTH_API_BASE=https://api.novawander.cn`。

## 注册

`POST /api/auth/register` 由本服务直接写 nova-api 的 `users` 表（备注固定 `Hinnflow`，并插一把 `group=auto` 的初始令牌），
不调用 nova-api 公开的 `POST /api/user/register`。需要在 `.env` 里配 `NOVA_API_MYSQL_*`，这和订单库不是同一台。

## 对象存储上传

`POST /api/oss/sign`（需要登录）给 Seedance 的本地参考素材签发单文件预签名 PUT 地址，默认 10 分钟有效；
浏览器直接把文件传到 OSS，再把公网地址交给 Seedance。AccessKey 只放 `.env` 的 `OSS_*`，不下发到前端。
预签名地址限制不了文件大小，大小只在前端校验；bucket 请用只读写这一个 bucket 的 RAM 子账号。
