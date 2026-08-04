import { App } from "antd";
import { useCallback } from "react";
import { useLocation } from "react-router-dom";

import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

/** 操作前校验登录；未登录则提示并打开登录弹窗，返回 false。 */
export function useRequireLogin() {
    const { message } = App.useApp();
    const { t } = useI18n();
    const { pathname } = useLocation();
    const user = useUserStore((state) => state.user);
    const openLoginModal = useUserStore((state) => state.openLoginModal);

    return useCallback(
        (redirectPath?: string) => {
            if (user) return true;
            message.warning(t("login.actionRequired"));
            openLoginModal(redirectPath || pathname || "/image");
            return false;
        },
        [message, openLoginModal, pathname, t, user],
    );
}
