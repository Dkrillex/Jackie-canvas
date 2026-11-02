# jc/ — hinnflow 二次开发区

本目录放**本分支相对上游 `basketikun/infinite-canvas` 的自研功能**。上游永远不会碰这个
目录，所以合并 upstream/main 时这里恒不冲突。

## 为什么是目录而不是文件名前缀

Git 冲突是按文件按 hunk 算的：只有你改、上游不改的文件，叫什么名字都不会冲突；真正会
打架的是**双方都改的文件**。所以隔离的关键不是给文件起名，而是

1. 自研代码全部放进上游没有的目录（就是这里）；
2. 不得不动的上游文件，只留**一行注册**，而且是那种上游几乎不会改的行。

## 当前占用的上游接缝（改动时请保持在一行以内）

| 上游文件                                      | 接缝                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `src/router.tsx`                              | `...jcRoutes` —— 路由全在 `jc/routes.tsx`            |
| `src/i18n/index.ts`                           | `mergeJcLocale(zhCN, jcZhCN)` —— 文案全在 `jc/i18n/` |
| `src/components/layout/app-top-nav.tsx`       | 导航项来自 `jc/nav.ts` 的 `useVisibleNavTools()`，顶栏视觉是 `jc-top-nav` + `<BrandName />` |
| `src/components/layout/mobile-nav-drawer.tsx` | 导航项同上                                           |
| `src/pages/home/index.tsx`                    | 挂 `<FlowBackdrop />` + `hero-title.css` / `home-page.css`（HINNFLOW AI 大标题、胶囊按钮、玻璃展示卡） |

仓库根部的 `docker-compose.hinnflow.yml`、`hinnflow-docker.conf`（`/new-api` 反代）、`nginx-hinnflow.conf`（宿主机 HTTPS 示例）
和 `web/vite.config.ts` 的 `/new-api` 开发代理也属于二开范围，都是新增文件或几行基础设施配置。

`web/index.html`（标题、Inter 字体、首屏默认亮色）、`public/logo.svg`、`use-theme-store.ts` 的默认主题、
`globals.css` 的标题动画时长也改过，都是品牌相关的单行改动。

## 目录

```
jc/
  routes.tsx      路由注册（唯一出口）
  nav.ts          顶栏 / 移动端导航项，以及需要登录才显示、需要隐藏的 slug
  config.ts       前端开关与常量（如 AGENT_UI_ENABLED、LOCAL_PROXY_UI_ENABLED）
  i18n/           中英文案 + 与上游 locale 的合并函数
  pages/          页面：wallet（额度充值）
  services/       调 server/ 的 HTTP 客户端
  components/     二开组件（品牌名、首页流体背景、商务联系弹窗）
  styles/         组件私有 CSS（Vite 支持组件级 import，不进 globals.css）
```

## 和上游首页装饰的关系

上游的 `components/home/ascii-ring.tsx`（字符莫比乌斯环）本分支不用，首页背景换成
Paper `MeshGradient`（`FlowBackdrop`，蓝底紫色流体）。上游那个文件**原样留着没动**，只是首页不再引用它。
