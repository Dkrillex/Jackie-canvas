# hinnflow-v20 迁移清单

`hinnflow-v20` 分支从 `main`（v0.20.0，提交 `9cd3dea`）新建，把 `hinnflow` 分支的定制功能按模块逐项移植进来。`hinnflow` 分支保持不动，作为对照。

## 迁移方式

- 按功能模块移植 `hinnflow` 的**最终代码**，不逐个 cherry-pick 71 个历史提交（其中很多是中途修补，最终状态已经包含）。
- 每一项的流程：我先说明要改哪些文件、和 v20 哪里冲突 → 你确认 → 我移植 → 你本地测试 → 在下表把状态改成「已移植」。
- 每项移植完单独提交一次（只在本地，不推送），出问题可以单独回退。
- 二开代码继续放 `web/src/jc/`，上游文件只留一行接缝，规则沿用 `hinnflow` 的 `AGENTS.md` 与 `web/src/jc/README.md`。

状态：`待确认` / `进行中` / `已移植` / `不需要`

## 一、要移植的功能（按建议顺序）

后面的项依赖前面的项，建议按顺序来。

| # | 功能 | 主要文件 | 和 v20 的冲突点 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | **二开分区骨架**：`web/src/jc/` 目录、`jc/README.md`、四处接缝（路由、i18n 合并、顶栏和移动端导航）、`AGENTS.md` 里的 hinnflow 规则 | `jc/routes.tsx`、`jc/i18n/`、`jc/nav.ts`、`jc/config.ts`、`router.tsx`、`i18n/index.ts`、`app-top-nav.tsx`、`mobile-nav-drawer.tsx`、`AGENTS.md` | 小：只是一行注册 | 已移植（待测试） |
| 2 | **品牌与外观**：浏览器标题和顶栏用 hinnflow，首页大标题 HINNFLOW AI（Inter 字体），首页流体背景和玻璃卡片，Logo，默认亮色主题，标题动画 10 秒 | `web/index.html`、`public/logo.svg`、`jc/components/brand-name.tsx`、`flow-backdrop.tsx`、`jc/styles/*`、`pages/home/index.tsx`、`use-theme-store.ts`、`globals.css` | 小：v20 自 v0.18 起没改过首页，直接沿用 hinnflow 版本 | 已移植（待测试） |
| 3 | **Docker 部署**（只用 Docker，不用 Vercel，去掉 `/gw`）：容器 nginx 只反代 `/new-api/api/`（同源登录 Cookie，DNS 定期重新解析），加 gzip 和静态资源缓存；compose 只起前端、只监听本机 5000；宿主机 HTTPS 反代示例；本机开发 Vite 代理 `/new-api` | `hinnflow-docker.conf`、`docker-compose.hinnflow.yml`、`nginx-hinnflow.conf`、`web/vite.config.ts`、`.gitignore` | 小：上游 `Dockerfile`、`nginx.conf`、`docker-compose.yml` 不动 | 已移植（待测试） |
| 4 | **登录鉴权**：New API 登录（含两步验证）、注册走 `/pay-api` 直写用户表、刷新后恢复登录、登录后自动拉取 `auto` 分组 Key 写入默认渠道、退出清空、未登录点「生成」弹登录 | `services/api/user.ts`、`stores/use-user-store.ts`、`components/layout/login-modal.tsx`、`hooks/use-require-login.ts`、`app-providers.tsx`、`user-layout.tsx`、`constant/env.ts`，以及图片页、视频页、画布的生成按钮 | 中：v20 的图片页和视频页都改过，生成按钮处要合并 | 已移植（待测试）：另加了配置弹窗的「用户中心」页签（账号、余额、密钥、退出），兑换码留到第 17 项；登录后的生成要等第 6 项把默认渠道换成 NovaWander 才能真正出图 |
| 5 | **权限与入口收紧**：配置只走顶栏头像；渠道 Base URL / API Key 只对 admin 显示；WebDAV、提示词来源页签只对 admin 显示；关闭本地 Agent 入口和本地代理页签；画布菜单去掉文档入口 | `app-config-modal.tsx`、`user-status-actions.tsx`、`canvas-top-bar.tsx`、`jc/config.ts` | **大**：v20 在配置弹窗新增了默认生图 / 视频分辨率设置，要逐处合并 | 已移植（待测试）：同 hinnflow 一并去掉语言和主题切换；渠道页签对所有人隐藏；v20 的偏好设置全部保留 |
| 6 | **默认渠道与模型**：只放 NovaWander 现网模型（图片 6 个、Seedance 3 档、对话 2 个），默认视频模型改为 Seedance 2.0；`VIDEO_KEYWORDS` 加 `seedance`；默认 Base URL 改为 `https://api.novawander.cn`（不再用 `/gw`） | `stores/use-config-store.ts` | 中：v20 的模型选择规则（模型被移除时阻止生成）要和登录后注入渠道一起验证 | 已移植（待测试）：画布一次生成数改为 1；全局默认模型不在列表里时回到默认值，节点上的选择仍按 v20 规则拦截 |
| 7 | **Gemini 生图走 OpenAI 格式渠道**：OpenAI 格式渠道下，Nano Banana 等 Gemini 图片模型改走 `generateContent` | `services/api/image.ts` | 中：v20 改了 Gemini 的 `imageSize` 逻辑 | 已移植（待测试）：先确认 New API 的 OpenAI 生图接口对 Gemini 只支持 imagen；Bearer 头只在非 Google 地址时带 |
| 8 | **Seedance 视频适配**：按模型名识别，走方舟原生任务接口（hinnflow 里默认网关地址 `/gw` 要改成渠道 Base URL；NovaWander 用 `/api/v3/...`，New API rc.45 用 `/doubao/api/v3/...`）；不带 `asset://` 云素材相关代码；首尾帧和全能参考两种模式；参考图 / 视频 / 音频及校验；fast / mini 最高 720p；时长 4–15 秒或 -1 的专用面板；轮询遇到 5xx 继续等待 | `lib/seedance-video.ts`、`services/api/video.ts`、`components/video-settings-panel.tsx`、`pages/video/index.tsx`、`canvas-node-generation.ts`、`pages/canvas/project.tsx`、`types/*` | **大**：v20 的视频页、画布页、缩略图、原地重新生成都要合并 | 已移植（待测试）：路径前缀自动兼容 NovaWander 与 New API rc.45；视频页新增参考视频 / 音频；本地素材经第 9 项自动上传 |
| 9 | **OSS 上传**（改为由 server 签发）：`POST /pay-api/api/oss/sign` 登录后签发单文件预签名 PUT 地址（默认 10 分钟），浏览器直传 OSS，Seedance 本地参考图 / 视频 / 音频自动上传 | `server/src/oss.ts`、`server/src/routes/oss.ts`、`server/.env.example`、`web/src/services/oss-upload.ts`、`services/api/video.ts` | 小 | 已移植（待测试）：AccessKey 只在 `server/.env`，前端不再有 OSS 配置 |
| 10 | **Seedance 云素材库**：`asset-groups` / `assets` 接口、画布侧栏「云素材」子页签、`asset://` 节点、预览用 `gravitex_url`、反推提示词不再把 `asset://` 当 base64 | `services/api/seedance-assets.ts`、`seedance-assets-panel.tsx`、`seedance-assets-modal.tsx`、`canvas-side-panel.tsx`、`asset-picker-modal.tsx`、`canvas-node.tsx`、`canvas-resource-references.ts`、`image-storage.ts` | **大**：v20 的 WebP 缩略图也改了 `image-storage.ts` | 不需要：New API（含 v1.0.0-rc.45）没有素材库接口，只有 NovaWander 定制网关有 |
| 11 | **Seedream 5.0 尺寸下限**：请求总像素不足 3686400 时按比例放大 | `jc/lib/seedream-image.ts`、`services/api/image.ts` | 中：v20 的 `resolveRequestSize` 已不再接收 quality，要按新签名改写 | 已移植（待测试）：按 v20 的 `resolveRequestSize(size, model)` 接入；只对 5.0 lite 放大，pro / flash 不再误判 |
| 12 | **提示词库**：Banana Prompt Quicker 默认关闭，过滤 NSFW / Unknown 条目 | `prompt-source-presets.ts`、`prompts.ts`、`jc/lib/prompt-visibility.ts` | 小 | 已移植（待测试） |
| 13 | **画布离开页面时保活**：后台继续跑完生成 | `jc/components/persistent-canvas-host.tsx`、`router.tsx`、`user-layout.tsx`、`infinite-canvas.tsx`、`canvas-top-bar.tsx`、`pages/canvas/project.tsx` | **大**：v20 改了聚焦和视口测量，后台画布的测量要验证 | 暂缓：先跳过，`project.tsx` 冲突大；以后要做时隐藏状态下测到 0×0 尺寸要跳过更新 |
| 14 | **画布小改进**：拦截触控板捏合；文本节点拉出图片节点时预填提示词；局部遮罩按原图尺寸生成；组装提示词 @ 菜单跟随光标、组字时隐藏占位、@ 后光标留在文本节点；配置节点打开时隐藏悬浮工具栏；组装提示词只打纯文字时不丢连着的参考 | `infinite-canvas.tsx`、`pages/canvas/project.tsx`、`canvas-node-generation.ts`、`lib/media-size.ts`、`canvas-config-composer.tsx`、`canvas-prompt-chip-input.tsx` | 中：`project.tsx` 两边都改得多 | 已移植（待测试）：捏合拦截去掉了对画布保活的依赖；纯文字时连带组内素材一起带上 |
| 15 | **我的资产拖入本地图片批量导入** | `pages/assets/index.tsx` | 中：v20 也改了资产页 | 已移植（待测试） |
| 16 | **充值服务与钱包**：`server/`（Hono + MySQL + 支付宝），档位含 30 元、单笔上限 200 元，三路到账对账，钱包页，大额商务联系弹窗；Docker 里加 `pay` 容器和 `/pay-api` 反代、本机开发 Vite 代理 `/pay-api`。第 4 项的注册依赖它 | `server/`、`hinnflow-docker.conf`、`docker-compose.hinnflow.yml`、`web/vite.config.ts`、`jc/pages/wallet/`、`jc/services/wallet.ts`、`jc/stores/use-wallet-store.ts`、`business-contact-modal.tsx`、`web/package.json`（构建脚本和依赖） | 小：基本是新增文件 | 已改造（待测试）：去掉独立的积分钱包，支付宝到账后直接给 New API 账号加调用额度，界面按 1 积分 = $1 显示成积分（30 元→4 积分、50 元→7 积分、200 元→29 积分）；发放记录 `quota_grants`，失败 / 结果未知的人工重试；钱包页显示账号额度和充值记录；旧积分钱包和余额废弃，不迁移 |
| 17 | **兑换码充值**：配置中心账户页签 | `jc/components/redeem-code.tsx`、`app-config-modal.tsx` | 小 | 已移植（待测试）：走 New API `/api/user/topup`，直接充入账号额度 |
| 18 | **积分兑换 API 额度** | `server/src/exchange.ts`、`routes/exchange.ts`、钱包页 | 小 | 不需要：去掉积分后，充值直接发放额度，并入第 16 项 |
| 19 | **接单中心**：发单、报价、交付验收、佣金结算、押金、三个有效期、平台账，Markdown 交付说明 | `server/src/jobs.ts` 等、`jc/pages/jobs/`、`jc/services/jobs.ts`、`jc/stores/use-job-store.ts` | 小：基本是新增文件 | 不需要：依赖积分钱包的冻结与结算，去掉积分后先不做 |
| 20 | **文档与 CHANGELOG**：`pending-test`、`todo`、`features` 里的 hinnflow 条目，CHANGELOG 加 `[hinnflow]` 小节 | `docs/content/docs/progress/*`、`CHANGELOG.md` | 小 | 已完成：CHANGELOG `hinnflow（本分支定制）` 小节、pending-test 与 todo 中英两份；features 等测试通过后再写 |

## 二、不需要，跟随 v20

| hinnflow 里的内容 | 原因 |
| --- | --- |
| 图片尺寸随质量档变化（`resolveRequestSize(quality, …)`） | v20 已把质量和尺寸解耦，质量只作为 `quality` 参数提交 |
| `d24284e` 选中图片时不隐藏悬浮工具栏 | v20 的隐藏条件里已经没有 `dialogNodeId`，效果相同 |
| `fc19737` 补回视频参考素材、`875a0f7` 补回 `unwrapSeedanceTask` | 合并 v0.18 时的修补，按模块移植时自然包含 |
| `9472e3b` / `df2f197` 同步 pnpm-lock、`cfb4bde` 合并提交 | 锁文件按 v20 重新生成 |
| 易支付（`8201e8e` 加入、`691611e` 已撤回） | hinnflow 里已经撤掉 |
| 接单中心本地 Mock（`78fae90`） | 已被服务端落库版本取代 |
| 「Jackie Canvas」改名：README、文档、`canvas-agent`、`plugins/canvas` 描述 | hinnflow 自己的规则已改为对外只用 hinnflow，不再用 Jackie Canvas |
| MaaS 企业管理页面，以及 MaaS 登录用的 RSA / AES 常量（`constant/auth.ts`、`lib/auth-crypto.ts`） | 入口已隐藏、登录已改走 New API；同时去掉前端写死的 RSA 私钥 |
| `NOVAWANDER AI` 首页标题等过渡文案 | 已被 HINNFLOW AI 取代 |
| Vercel 部署：`api/gw.js`、`api/pay.js`、`web/api/*`、`middleware.js`、`web/middleware.js`、两份 `vercel.json` 的改动，以及 `build:pay` 构建脚本 | 只用 Docker 部署 |
| `/gw` AI 网关反代 | 上游 `api.novawander.cn` 允许跨域，浏览器直连即可；渠道地址只对 admin 显示 |
| `/prod-api` MaaS 反代 | 企业管理不搬 |
| Seedance 云素材库（`asset-groups` / `assets`、侧栏「云素材」、`asset://` 节点、`gravitex_url` 预览） | New API 不支持素材库接口，只有 NovaWander 定制网关有；移植第 8 项时一并不带相关代码 |
| 前端 OSS 配置与浏览器直传（`ali-oss` + 写死的 AccessKey、配置弹窗 OSS 页签） | AccessKey 会随前端泄露；改为 server 签发预签名地址 |

## 三、需要你决定

- [x] 企业管理（MaaS）：不要，页面代码和 MaaS 的 RSA 常量都没搬。
- [ ] README、`SECURITY.md`、赞助和授权文档里的联系方式（hinnflow 改成了 1658176374）是否要改？上游要求二次开发保留原作者信息。
- [ ] WorkBuddy / CodeBuddy 插件市场配置和 Canvas Agent 发布文档：本地 Agent 入口目前关闭，是现在移植还是以后单独开分支？
- [ ] 默认视频模型是否加入 Seedance 2.5（`doubao-seedance-2-5-260628`）？加入的话时长和素材上限要按 2.5 放宽，并确认网关已经支持。

以上未定事项也记在 `docs/content/docs/progress/todo.mdx`。

## 四、移植后要回归的 v20 功能

这些是 v20 新增、又和 hinnflow 定制碰在一起的地方，移植完相应项后要实际测一遍：

- v0.19 WebP 缩略图：OSS 上传的参考图和 Seedance 生成的视频封面能否正常显示缩略图（第 8、9 项）
- v0.20 原地重新生成：Seedance 节点原地重新生成时参考素材和参数不丢（第 8 项）
- v0.20 已选模型被移除时阻止生成：登录后注入默认渠道、退出清空后的表现（第 4、6 项）
- v0.20 选中自动居中、聚焦测量：画布保活时后台画布的测量是否正确（第 13 项）
- v0.20 质量 5 档和默认分辨率：直连 `api.novawander.cn` 时 gpt-image-2.5 和 Gemini 是否正常（第 6、7 项）
