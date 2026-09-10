# Jackie Canvas 充值服务

支付宝充值 + 积分钱包。前端其余部分仍然是纯浏览器直连，**只有充值这条链路需要服务端** ——
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
        recharge_orders 置为 paid + user_wallets 加余额 + wallet_ledger 记流水
                        （同一个事务）
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
cp .env.example .env     # 填支付宝密钥和 MySQL
npm run check:alipay     # 自检密钥有没有填反（最难查的错）
npm run check:db         # 自检数据库，顺便把三张表建出来
npm run dev
```

默认监听 `8787`。前端 `bun run dev` 时 Vite 会把 `/pay-api` 代理过来，不用改任何前端配置。

## 部署

前端和本服务要在同一个域名下，前端才能用同源的 `/pay-api`。

- **Vercel（本仓库）**：`/pay-api` 由根目录 `api/pay.js` 挂载本服务，不再需要 `PAY_UPSTREAM`。
  构建时会 `cd server && npm install && npm run build`。支付宝和 MySQL 默认写在 `src/config.ts`，
  环境变量仍可覆盖。通知地址默认 `https://canvas.hinnflow.com/pay-api/api/pay/notify`。
  本机开发仍用 `npm run dev` + Vite `/pay-api` 代理。
- **Docker**：`docker-compose.yml` 里有一段注释掉的 `pay` 服务，取消注释即可；
  再把 `nginx.conf` 里的 `/pay-api` 反代到 `pay:8787`。
- 跨域部署时把 `CORS_ORIGIN` 设成前端域名，不要在生产留 `*`。

`ALIPAY_NOTIFY_URL` 要填公网可达的 `https://你的域名/pay-api/api/pay/notify`。本地调试用
ngrok / frp 把它暴露出去；不填也能到账，只是只剩轮询和对账两条腿，慢一点。

## 数据表

首次连接自动建，不需要手工执行 SQL。

| 表 | 用途 |
| --- | --- |
| `recharge_orders` | 充值订单。`credits` 在下单时从档位抄一份，之后调价不影响旧单 |
| `user_wallets` | 用户积分余额。`frozen` 预留给接单托管，当前只读 |
| `wallet_ledger` | 积分流水。`UNIQUE KEY (kind, ref_no)` 兜住重复入账 |

金额和积分全部用 `DECIMAL`，读出来也保持字符串 —— 钱经不起二进制小数的舍入。

## 身份

本服务不自建账号：前端带着现有的 MaaS JWT 过来，这里拿去问 MaaS `/system/user/getInfo`
「你是谁」，认它返回的 `userId`。所以钱包天然和现有登录体系对齐，不用同步用户表。

MaaS 可能加密返回（响应头带 `encrypt-key`），`src/auth.ts` 里做了对应的解密。注意其中的
PKCS#1 去填充是手写的：Node 20 起 `privateDecrypt` 不再接受 `RSA_PKCS1_PADDING`
（CVE-2023-46809），而前端 JSEncrypt 用的正是这个填充。
