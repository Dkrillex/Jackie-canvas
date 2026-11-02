import type { RouteObject } from "react-router-dom";

import WalletPage from "./pages/wallet";

/**
 * 二开路由的唯一出口。`src/router.tsx` 只 spread 这一个数组，新增页面改这里就行，
 * 不用再去动上游那个文件。
 */
export const jcRoutes: RouteObject[] = [{ path: "/wallet", element: <WalletPage /> }];
