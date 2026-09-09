import type { RouteObject } from "react-router-dom";

import EnterprisePage from "./pages/enterprise";
import JobsPage from "./pages/jobs";
import JobDetailPage from "./pages/jobs/detail";
import WalletPage from "./pages/wallet";

/**
 * 二开路由的唯一出口。`src/router.tsx` 只 spread 这一个数组，新增页面改这里就行，
 * 不用再去动上游那个文件。
 *
 * `/jobs` 原本是上游的 Mock 接单中心，本分支改成服务端落库后由这里接管。
 */
export const jcRoutes: RouteObject[] = [
    { path: "/jobs", element: <JobsPage /> },
    { path: "/jobs/:id", element: <JobDetailPage /> },
    { path: "/wallet", element: <WalletPage /> },
    { path: "/enterprise", element: <EnterprisePage /> },
];
