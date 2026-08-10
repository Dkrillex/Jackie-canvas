import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { AdminRoute } from "@/components/layout/admin-route";
import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import { DesktopOnlyRoute } from "@/components/layout/desktop-only-route";
import { TENNDA_MODEL_CATALOG } from "@/constant/tennda-models";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ConfigPage from "@/pages/config";
import AgentStudioPage from "@/pages/agent";
import DeveloperDocsPage from "@/pages/developer/docs";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import ModelDetailPage from "@/pages/models";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";

export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <AnalyticsTracker />
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/models", element: <Navigate to={`/models/${TENNDA_MODEL_CATALOG[0].slug}`} replace /> },
            { path: "/models/:slug", element: <ModelDetailPage /> },
            { path: "/developer/docs", element: <DeveloperDocsPage /> },
            { path: "/agent", element: <AgentStudioPage /> },
            { path: "/image", element: <ImagePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/prompts", element: <PromptsPage /> },
            {
                path: "/canvas",
                element: (
                    <DesktopOnlyRoute>
                        <AdminRoute>
                            <CanvasPage />
                        </AdminRoute>
                    </DesktopOnlyRoute>
                ),
            },
            {
                path: "/canvas/:id",
                element: (
                    <DesktopOnlyRoute>
                        <AdminRoute>
                            <CanvasProjectPage />
                        </AdminRoute>
                    </DesktopOnlyRoute>
                ),
            },
            { path: "/config", element: <ConfigPage /> },
        ],
    },
    { path: "*", element: <NotFound /> },
]);
