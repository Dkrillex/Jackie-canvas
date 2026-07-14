import { App } from "antd";
import copy from "copy-to-clipboard";

import { useLocaleStore } from "@/stores/use-locale-store";

export function useCopyText() {
    const { message } = App.useApp();

    return (value: string, successText?: string) => {
        copy(value);
        message.success(successText ?? useLocaleStore.getState().t("action.copied"));
    };
}
