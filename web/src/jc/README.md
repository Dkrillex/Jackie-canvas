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
| `src/components/layout/app-top-nav.tsx`       | 导航项来自 `jc/nav.ts` 的 `useVisibleNavTools()`     |
| `src/components/layout/mobile-nav-drawer.tsx` | 同上                                                 |

## 目录

```
jc/
  routes.tsx      路由注册（唯一出口）
  nav.ts          顶栏 / 移动端导航项，以及需要登录才显示、需要隐藏的 slug
  config.ts       前端开关与常量（如 AGENT_UI_ENABLED、LOCAL_PROXY_UI_ENABLED）
  i18n/           中英文案 + 与上游 locale 的合并函数
```
