import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

import type { InsertAssetPayload } from "./asset-picker-modal";
import { SeedanceAssetsPanel } from "./seedance-assets-panel";

type Props = {
    open: boolean;
    onInsert: (payload: InsertAssetPayload) => void;
    onClose: () => void;
};

export function SeedanceAssetsModal({ open, onInsert, onClose }: Props) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <Modal title={t("canvas.assets.seedance")} open={open} onCancel={onClose} footer={null} width={760} destroyOnHidden styles={{ body: { height: 560, padding: 0, overflow: "hidden" } }}>
            <div className="h-full min-h-0" style={{ color: theme.node.text }}>
                <SeedanceAssetsPanel
                    theme={theme}
                    onInsert={(payload) => {
                        onInsert(payload);
                        onClose();
                    }}
                />
            </div>
        </Modal>
    );
}
