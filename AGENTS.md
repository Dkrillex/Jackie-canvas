# AGENTS.md

本文档用于约束本项目中的 AI / 自动化开发行为。开发时优先遵循本文件，其次遵循用户当前消息。

## 基本原则

- 先读现有代码，再动手修改，优先沿用项目已有结构和写法。
- 写代码保持最少行数，能简单实现就不要引入复杂抽象。
- 标准格式、协议、解析、压缩、加密、日期等通用能力优先使用成熟稳定的库，不要手写底层实现，除非用户明确要求或项目已有实现必须沿用。
- 不要为了“兼容更多场景”写大量分支，只实现当前明确需要的功能。
- 项目尚未上线，不需要兼容旧数据；本地存储结构调整时直接按新设计修改，不写旧字段兼容或数据迁移兜底，除非用户明确要求。
- 每次写完代码，不需要检查语法，不需要执行构建，用户会自己做。
- 不要改无关文件，不要顺手重构。
- 如果工作区已有用户改动，不要回滚，不要覆盖；只在必要范围内追加修改。

## 反复提醒沉淀

- 如果开发过程中总是遇到某个问题，或者用户反复提醒同一个注意事项，需要把该注意事项补充到本文件。
- 补充时写成明确、可执行的规则，避免只写模糊描述。
- 新规则应放到最相关的章节；找不到合适章节时放到“项目注意事项”。

## 前端规范

- 前端使用 Vite、React、React Router、TypeScript、Ant Design、Tailwind、Zustand。
- 编写 Ant Design 相关代码时，参考 https://ant.design/llms-full.txt 理解组件 API、示例和设计规范，并优先结合项目当前 antd 版本与既有写法。
- 外部服务请求统一放在 `web/src/services/api/`，由浏览器前端直连，不假设存在项目后端。唯一例外是 `server/`（积分充值与接单中心），它必须有服务端，见「充值与钱包规范」。
- 全局或跨页面状态优先放在 `web/src/stores/`。
- 已经放在全局 store 或全局 hook 中的状态/动作，组件需要时直接使用对应 store/hook，不要为了“纯组件”层层透传 props；避免一个组件传递过多参数。
- 全局组件、全局常量、全局配置等全局性质的内容不要作为 props 或参数层层传递；哪里需要就在哪里直接从对应全局入口获取。
- 多个页面重复出现的 UI 副作用动作，例如复制文本并提示、下载并提示、统一确认弹窗，优先抽成 `web/src/hooks/` 下的全局 hook；不要放进 store，除非它确实是需要共享/订阅的状态。
- 路由页面放在 `web/src/pages/`，页面布局放在 `web/src/layouts/`，路由配置放在 `web/src/router.tsx`。
- 画布页面放在 `web/src/pages/canvas/`，画布组件放在 `web/src/components/canvas/`，画布状态放在 `web/src/stores/canvas/`，画布工具函数放在 `web/src/lib/canvas/`。
- 页面按目录组织，例如 `web/src/pages/image/index.tsx`；页面里只有一个主业务组件时直接写在对应页面入口中，不要单独拆 `Manager` 组件再传一堆 props。
- 不要新增只做简单转发的组件，例如只 `return <X>{children}</X>` 或只换个名字透传 props；直接在使用处使用真实组件或把逻辑写进当前文件。
- 页面私有 hook 放在对应页面目录下，例如 `admin/assets/use-admin-assets.ts`；只有多个页面真实复用的 hook 才放到外层 `hooks/`。
- 管理后台页面私有组件放到各自页面目录的 `components/` 下，例如 `admin/assets/components/`、`admin/prompts/components/`；不要为了单页面使用放到 `admin/components/` 共享目录。
- 管理后台主题、背景、卡片阴影、表格配色等统一在 `web/src/lib/app-theme.ts`、`AppProviders` 或必要的全局 CSS 作用域中配置；页面私有组件不要自己写 `dark ? ...` 主题分支。
- 组件优先使用函数组件和现有 hooks，不新增大型状态管理方案。
- UI 图标优先使用 `lucide-react` 或项目已经使用的 Ant Design 图标。
- 页面文案通过 `useTranslation` / `i18next`（`web/src/i18n`）做中英双语；默认跟随本地存储语言，顶栏语言按钮可切换，Ant Design locale 同步切换。
- 不要在组件里堆太多无关逻辑；复杂逻辑优先抽成同目录工具函数或小组件。
- 样式优先由组件自己管理；组件私有样式优先使用 Tailwind className 或少量内联 style，不要为单个组件新增大量全局 CSS。
- 全局 CSS 只放基础变量、全局重置、跨页面通用样式和少量第三方组件必要覆盖；不要在 `globals.css` 堆页面私有样式。
- 代码尽量短小直接，少拆不必要组件，少做多层 props 传递，避免为了抽象堆出更多代码。
- 前端业务数据需要浏览器本地持久化时，默认使用 `localforage`；`localStorage` 只用于极小的简单配置，不要用来保存业务列表、生成记录、图片、base64 或大 JSON。

## 画布 UI 规范

- 做 canvas 前端 UI 时必须遵循当前画布主题。
- 优先使用 `canvasThemes`、`useThemeStore` 或 Ant Design `ConfigProvider` token。
- 不要硬编码黑白、stone、slate 等颜色导致浅色/深色主题不一致。
- 新增画布按钮、弹窗、浮层时，尽量复用已有工具栏、节点面板、Modal 的视觉风格。
- 画布顶部工具栏和状态信息优先采用极简扁平风格：无边框、无阴影、无胶囊背景，融入整体背景，弱化按钮感，仅保留轻微 hover 反馈，保持简洁现代、低视觉重量。
- 左侧画布面板等列表里的节点/元素缩略图容器，非图片类型（文本、配置、视频、音频等）不要使用 `theme.node.fill`（`#e7e5df`/`#292524`）这类灰色背景，图标直接无背景展示，尽量不要给多余底色，保持干净。
- 画布内的操作按钮（如面板里的「添加」「导出」「选择」等）默认用扁平无底色样式：透明背景、仅 `hover:bg-black/5 dark:hover:bg-white/10` 轻微反馈，靠图标+文字表达，不要用 `theme.toolbar.activeBg`（`#e7e5df`/`#3a3631`）或 `theme.node.fill` 之类的灰色作为按钮填充底色。灰色 `activeBg` 只允许用于「选中态」等需要表达状态的高亮，不要当普通装饰底色。
- 图片节点尺寸逻辑要尊重原始比例，除非功能明确要求自由变形。
- 批量生成、多图展示、助手面板等画布交互要尽量简洁，不要占用过多画布空间。

## 二次开发分区（jc/）

- 本分支相对上游 `basketikun/infinite-canvas` 的自研前端功能，一律放在 `web/src/jc/`。上游不会碰这个目录，合并 upstream/main 时恒不冲突。
- 隔离靠的是**目录**不是文件名：Git 冲突按文件按 hunk 算，只有你改、上游不改的文件永远不冲突。不要为了区分去给文件加前缀，那不减少冲突。
- 不得不动的上游文件**只留一行注册**，且必须是上游几乎不会改的行。目前只有四处接缝：`src/router.tsx`（`...jcRoutes`）、`src/i18n/index.ts`（`mergeJcLocale`）、`src/components/layout/app-top-nav.tsx` 与 `mobile-nav-drawer.tsx`（`visibleNavTools`）。新增功能优先接到这四处已有的出口上，不要再去上游文件里开新口子。
- 二开文案写在 `web/src/jc/i18n/`，只写新增的和要覆盖上游的键；`mergeJcLocale` 对顶层键做一层浅合并，未列出的键继续沿用上游。不要再往 `src/i18n/locales/*.ts` 里加二开文案。
- 详见 `web/src/jc/README.md`。

## 充值与钱包规范

- 充值服务在 `server/`（Node + TypeScript + Hono + mysql2 + alipay-sdk），前端走同源 `/pay-api`。不要把支付宝私钥、验签或订单状态判断挪到浏览器里。
- **金额只认服务端**：下单接口只收 `packageId`，价目表写在 `server/src/packages.ts`。任何时候都不要新增「前端传金额」的参数，那等于让用户自己定价。
- **能把订单改成已付的只有两处**：验过签的 `/api/pay/notify`，和主动查询支付宝的结果。查状态接口只读库，不接受前端写入。
- 通知处理必须过四道关：验签 → `app_id` 一致 → 订单存在 → 金额一致；缺一道就是可以被伪造充值的洞。
- 入账必须幂等且和订单状态在同一个事务里：`SELECT ... FOR UPDATE` + `UPDATE ... WHERE status <> 'paid'` + 流水表 `UNIQUE KEY (kind, ref_no)`。改这段代码前先想清楚支付宝会重发通知。
- 钱一律用 `DECIMAL` 存、字符串读，不要在 JS 里用浮点数做加减；余额的加法交给数据库 `balance = balance + ?`，不要读出来算完再写回去。
- 新增前缀（如 `/pay-api`）时，Vite 代理、`middleware.js`、`vercel.json` 的 SPA fallback 排除项三处都要一起改，漏一处就会返回一页 HTML 而不是接口响应。SPA fallback 还必须排除 `/api`（线上 `/gw` 的 Node 函数）。
- 接单中心的冻结与结算是真实托管：接受报价冻结雇主积分（压可用额、不动余额），验收时在一个事务里扣款、解冻、给创作者打款。任何动余额的地方都要先 `SELECT ... FOR UPDATE` 锁钱包行，并把状态流转写进 `UPDATE ... WHERE status = ?`，不要先查后改。
- 工单有三个时钟：`work_deadline_at`（交付）、`review_deadline_at`（验收）、`job_deadline_at`（整单）。到期处置在 `server/src/expire.ts`，扫描顺序必须是「验收 → 工时 → 整单」，且整单过期那一档**不能包含 submitted** —— 否则雇主拖着不验收就能把交付物白拿走再把钱要回去。
- 接单押金冻结在接单人身上，罚没时按 `JOB_DEPOSIT_TO_CLIENT` 分给雇主、其余进 `platform_ledger`。平台的每一笔收入（抽成、罚没）都要写 `platform_ledger`，不要只写在工单的结算列里。
- 谁能做什么一律由服务端按登录 userId 判定（发单人才能接受报价/打回/验收/取消，接单人才能交付）。前端的筛选和按钮显隐只是界面，不算权限。

## 文档规范

- README 保持简洁，只放项目介绍、核心功能、快速开始和文档入口。
- `docs/index.md` 放给 AI 使用的文档索引，不要再放到 `docs/content/docs/` 内容目录里。
- 详细功能介绍写到 `docs/content/docs/overview/features.mdx`。
- 后续待办写到 `docs/content/docs/progress/todo.mdx`。
- 已实现但还需要用户测试确认的事项写到 `docs/content/docs/progress/pending-test.mdx`。
- `docs/content/docs/progress/pending-test.mdx` 用来记录这个版本实际做了哪些可测试变更；`CHANGELOG.md` 的 `Unreleased` 只保留对这些变更的版本级归纳，避免逐条照搬实现细节。
- 每次重大改动（新增/调整/删除功能、接口或工具，影响用户可感知行为）完成后，都要在 `CHANGELOG.md` 的 `Unreleased` 追加一条记录，按 `[新增]` / `[调整]` / `[修复]` / `[优化]` 前缀分类，用一句中文归纳；纯内部重构、格式化、无用户可感知影响的小改动可不记。
- 本仓库（Jackie / `canvas-dev`）相对上游的定制改动，在类型前缀后再加 `[Jackie]`，并尽量写在 `Unreleased` 下的 `### Jackie（本分支定制）` 小节；合入上游的条目写在 `### Upstream（合入上游）`，不加 `[Jackie]`。示例：`+ [新增][Jackie] ……`。
- 每次 todo 事项完成后，先从 `docs/content/docs/progress/todo.mdx` 移到 `docs/content/docs/progress/pending-test.mdx`，不要直接写进正式功能说明；用户确认测试通过后再更新 `docs/content/docs/overview/features.mdx`。
- 每次任务完成前，都要根据实际变更检查并更新 `docs/content/docs/progress/todo.mdx` 和 `docs/content/docs/progress/pending-test.mdx`；如果功能或待办没有变化，也要确认无需修改。
- 文档不要写过期日期；除非用户明确要求记录具体时间。

## 发版本流程

- 发版本时，先把 `CHANGELOG.md` 的 `Unreleased` 变更整理成新的版本记录，并保留空的 `Unreleased` 标题。
- 按当前版本号提升一个版本，更新根目录 `VERSION`。
- 将当前未提交的代码全部提交到 Git。
- 提交完成后，给当前提交打最新版本号对应的 tag，例如 `v0.0.5`。
- 发版本流程中不要执行编译、测试或构建，除非用户明确要求。

## PR 审查与处理

- 审查 PR 时必须把“需求价值”和“实现质量”分开判断，分别给出结论；实现差不等于需求不需要，需求有价值也不等于当前代码可以合并。
- 需求价值需要单独结合项目方向、用户场景、现有能力和后续规划判断；无法从项目上下文确定是否需要时，必须询问用户，不得仅凭代码质量、作者或改动规模推断需求不需要。
- 实现质量重点检查正确性、安全性、改动范围、重复代码、无关文件、现有结构复用、可维护性、测试与文档以及与最新 `main` 的冲突。改动几十个文件、疑似 AI 批量生成、重复代码多只能作为重点复核或拒绝当前实现的信号，不能单独作为放弃需求的依据。
- 对“需求有价值但实现不合格”的 PR，优先考虑要求作者修改、提取可用思路后自行重做，或把需求保留到 issue/todo；不要直接把需求一起否定。
- 建议关闭 PR 前，必须先向用户分别说明需求价值、实现质量、可保留的思路和建议处理方式，并取得用户明确确认；批量关闭时也要让用户能看清每个 PR 的需求是否仍需保留。
- 可以先在独立分支审查、修复、测试和准备提交；任何合并进 `main` 的操作都必须先说明修复内容、测试结果、风险与冲突，并取得用户明确同意。需要 force-push PR 作者分支时也必须提前说明影响并取得同意。

## 项目注意事项

- 新增或调整超时、重试次数、大小限制、并发上限等会改变实际行为的边界值前，必须先向用户说明适用环节、默认值和失败后的处理方式，并取得确认；不要把经验值当成纯内部实现静默加入。
- 当前画布项目和“我的素材”主要保存在浏览器本地，不要在文档中误写成已支持云同步。
- 当前 AI API Key 存在浏览器本地，并由前端直接请求 OpenAI 兼容接口；涉及安全说明时要写清楚。
- Docker 静态资源路径目前仍是待办项，文档中不要过度承诺生产部署已经完全验证。
- 对外产品展示：顶栏品牌、浏览器标题、登录弹窗用 hinnflow；首页大标题为 NOVAWANDER AI，字体对齐 maas.novawander.cn（Inter：NOVA / AI 为 900，WANDER 为 300）。不要再写 Jackie Canvas、「无限画布」或 Infinite Canvas（存储键、npm 包名等技术标识可继续用 `infinite-canvas`）。
- 对外文案与渠道配置界面不要暴露底层服务品牌、域名或内置 API Key（如 gravitex）；默认 OpenAI 兼容地址用同源 `/gw`。渠道 Base URL / API Key 表单项仅 `admin` 账号渲染，普通用户不显示。配置中心 WebDAV 同步、提示词来源页签仅 `admin` 账号可见。
- 提示词库内置来源 Banana Prompt Quicker 默认关闭（含 NSFW / Unknown 条目），不要改回默认开启。
- Seedance 视频模型在 `/gw`（OpenAI 兼容渠道）下按模型名识别（含 `seedance`），不要只依赖 `apiFormat === "ark"`；时长需落在 Seedance 合法范围（2.0 一般为 4–15 或 -1）。
- Seedream 5.0 生图请求的 `size` 总像素至少 3686400（16:9 至少 2560×1440）；界面仍可选 1K，发请求时按比例抬上去，不要改回把 1536×864 原样发给上游。
- 顶栏配置齿轮与导航「配置」仅登录后显示。
- 「开始生成」等会发起 AI 请求的操作按钮，未登录时应提示并弹出登录，不真正发起生成。
- 登录鉴权走同源 `/prod-api`（MaaS：`/auth/login` + JWT + 请求体 AES/RSA 加密），不要再走 New API 的 `/api/user/login` Cookie/`New-Api-User`。AI 请求仍走 `/gw`。
- 登录成功与 hydrate 后，用 `/prod-api/llm/tokens/list`（仅 JWT，不传 userId）拉取当前账号密钥，取第一把启用且分组为 `auto` 的 Key 写入默认渠道；退出时清空。不要再写死内置 API Key。
- 部署到 Vercel 时 `/gw` 必须走 Node 函数 `api/gw.js`（`maxDuration` 300 秒），不要走 Edge Middleware 或外部 rewrite——后两者约 25–30 秒会把生图/生视频掐成 504。`/prod-api` 仍走 Middleware 或外部 rewrite。SPA fallback 不能匹配 `/gw`、`/prod-api`、`/pay-api`、`/api`。登录不要改去未部署的 `/api` 回退，否则会 405。
