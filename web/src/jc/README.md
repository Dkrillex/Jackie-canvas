# jc/ — Jackie Canvas 二次开发区

本目录放**本分支相对上游 `basketikun/infinite-canvas` 的自研功能**。上游永远不会碰这个
目录，所以合并 upstream/main 时这里恒不冲突。

## 为什么是目录而不是文件名前缀

Git 冲突是按文件按 hunk 算的：只有你改、上游不改的文件，叫什么名字都不会冲突；真正会
打架的是**双方都改的文件**。所以隔离的关键不是给文件起名，而是

1. 自研代码全部放进上游没有的目录（就是这里）；
2. 不得不动的上游文件，只留**一行注册**，而且是那种上游几乎不会改的行。

## 当前占用的上游接缝（改动时请保持在一行以内）

| 上游文件                                      | 接缝                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| `src/router.tsx`                              | `...jcRoutes` —— 路由全在 `jc/routes.tsx`                    |
| `src/i18n/index.ts`                           | `mergeJcLocale(zhCN, jcZhCN)` —— 文案全在 `jc/i18n/`         |
| `src/components/layout/app-top-nav.tsx`       | 导航项来自 `jc/nav.ts` 的 `useVisibleNavTools()`，顶栏视觉是 `jc-top-nav` + `<BrandName />` |
| `src/components/layout/mobile-nav-drawer.tsx` | 同上                                                         |
| `src/pages/home/index.tsx`                    | 挂 `<FlowBackdrop />` + `home-page.css`（胶囊按钮 / 玻璃展示卡），并移除上游的 `<AsciiRing />` |

仓库根部的 `server/`（充值与接单服务）、`vite.config.ts` 的 `/pay-api` 代理、
`middleware.js`、`vercel.json`、`nginx.conf` 也属于二开范围，但它们要么是新增文件、
要么是几行基础设施配置，不在这张表里。

## 目录

```
jc/
  routes.tsx      路由注册（唯一出口）
  nav.ts          顶栏/移动端导航项 + 需要登录才显示的 slug
  config.ts       前端环境常量（如 /pay-api 基址）
  i18n/           中英文案 + 与上游 locale 的合并函数
  pages/          页面：wallet（积分充值）、jobs（接单中心）、enterprise（企业管理）
  services/       调 server/ 的 HTTP 客户端
  stores/         zustand 全局状态
  lib/            工单类型与展示用工具
  styles/         组件私有 CSS（Vite 支持组件级 import，不进 globals.css）
```

## 和上游 home 装饰的关系

上游的 `components/home/ascii-ring.tsx`（字符莫比乌斯环）本分支不用了，首页背景改成
和 hinnflow.com 同一套 Paper `MeshGradient`（`FlowBackdrop`），配色是白银而不是电光蓝。
首页与顶栏跟站点默认无衬线走，不再单独套衬线字体。
上游那个文件**原样留着没动**，只是首页不再引用它。曾经做过一版流动的字符环，需要的话从
`23cbb46` 取回。

## 和上游 jobs 的关系

上游原本有一套纯前端 Mock 的接单中心（`pages/jobs/`、`stores/use-job-store.ts`、
`services/api/jobs.ts`、`lib/jobs/`）。本分支改成了服务端落库 + 真实积分托管，
上游那套已整体删除，`/jobs` 路由由 `jc/pages/jobs/` 接管。上游后续对 Mock 的改动
可以直接合并后忽略。

## 和 MaaS 企业管理的关系

`/enterprise` 是**平台已有能力的前端**，本仓库没有对应的服务端代码：接口是 MaaS 的客户侧企业接口
（`Gravitex-API-End` 的 `ClientEnterpriseController` / `ClientEnterpriseSettingsController`），
挂在登录用的同源 `/prod-api` 下，凭同一把 JWT，**不需要新前缀，也不需要后台权限位**。

```
GET    /system/enterprise/client/mine              我的企业（没加入返回空）
GET    /system/enterprise/client/mine/users        成员列表（管理员看全部，成员只看到自己）
POST   /system/enterprise/client/maas/users/add    新增成员，返回账号 + 初始密码（只给这一次）
PUT    /system/enterprise/client/mine/users/{id}   编辑成员
DELETE /system/enterprise/client/mine/users/{id}   移除成员
POST   /system/enterprise/client/mine/quota/allocate  从管理员额度划给成员
```

两个容易踩的点，都写在 `services/enterprise.ts` 里了：

1. **状态的约定是反的**：列表返回的 `status` 是企业成员表的 `1=启用 / 0=禁用`，而编辑接口收的是
   sys_user 的 `0=正常 / 1=禁用`（服务端 `editMember` 三表同步时按后者解释）。转换只在
   `editMember()` 一处做，页面上一律用 `enabled` 布尔量。
2. **RuoYi 的失败是 HTTP 200 + `code !== 200`**，只看 HTTP 状态会把「你不是企业管理员」当成功。

页面分三个页签：**成员**（所有人）、**消费看板**（仅管理员）、**调用日志**（成员看自己、管理员看全部）。
看板和日志用的是另外四条接口，时间参数都是**秒级** Unix 时间戳：

```
GET /system/enterprise/client/mine/settings/dashboard-summary        区间汇总 calls/quota/tokens
GET /system/enterprise/client/mine/settings/dashboard-trend          时间桶趋势（granularity=hour|day|week）
GET /system/enterprise/client/mine/settings/dashboard-trend-by-model 时间桶 × 模型
GET /api/enterprise/logs                                             调用日志分页（注意不在 /system 下）
```

看板的两张图是**手写的**（`pages/enterprise/charts.tsx`），没有引图表库：这里只有「一个量随时间」和
「一个量按模型排序」两种形状，为它们装一整套图表库不划算。两张都是单序列，所以统一用中性色而不是
给每根柱子换色 —— 颜色在这里表示不了额外信息。柱子按像素排布而不是画进 SVG：拉伸的 viewBox 会让
x/y 缩放比不一致，圆角被抻成椭圆。

还没接的：风险预警、告警邮箱、安全开关（`.../mine/settings/risk-warnings`、`/alert-emails`、`/toggles`、
`/test-notify`），以及日志导出（`POST /api/enterprise/logs/export`，服务端还带一套 taskId 进度）。
前端可参考 `gravitex-api-cli` 的 `pages/EnterpriseManage/`。
