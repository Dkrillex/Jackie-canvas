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
| `src/components/layout/app-top-nav.tsx`       | 导航项与登录可见性来自 `jc/nav.ts`                           |
| `src/components/layout/mobile-nav-drawer.tsx` | 同上                                                         |
| `src/pages/home/index.tsx`                    | 挂 `<FlowBackdrop />`，并移除上游的 `<AsciiRing />`   |

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
  pages/          页面：wallet（积分充值）、jobs（接单中心）
  services/       调 server/ 的 HTTP 客户端
  stores/         zustand 全局状态
  lib/            工单类型与展示用工具
  styles/         组件私有 CSS（Vite 支持组件级 import，不进 globals.css）
```

## 和上游 home 装饰的关系

上游的 `components/home/ascii-ring.tsx`（字符莫比乌斯环）本分支不用了，首页背景改成
`FlowBackdrop`。上游那个文件**原样留着没动**，只是首页不再引用它 —— 上游以后怎么改都
不会冲突。曾经做过一版流动的字符环，需要的话从 `23cbb46` 取回。

## 和上游 jobs 的关系

上游原本有一套纯前端 Mock 的接单中心（`pages/jobs/`、`stores/use-job-store.ts`、
`services/api/jobs.ts`、`lib/jobs/`）。本分支改成了服务端落库 + 真实积分托管，
上游那套已整体删除，`/jobs` 路由由 `jc/pages/jobs/` 接管。上游后续对 Mock 的改动
可以直接合并后忽略。
