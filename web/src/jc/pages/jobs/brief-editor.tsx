import { ImagePlus } from "lucide-react";
import { App, Button, Input, Segmented, Spin } from "antd";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { toJobImageRef } from "@/jc/lib/brief-markdown";
import { uploadImage } from "@/services/image-storage";
import { JobBriefView } from "./brief-view";

type JobBriefEditorProps = {
    value?: string;
    onChange?: (value: string) => void;
};

export function JobBriefEditor({ value = "", onChange }: JobBriefEditorProps) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const inputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<"write" | "preview">("write");
    const [uploading, setUploading] = useState(false);

    const insertImage = async (file: File) => {
        setUploading(true);
        try {
            const image = await uploadImage(file);
            const alt = file.name.replace(/\.[^.]+$/, "") || "image";
            const snippet = `\n![${alt}](${toJobImageRef(image.storageKey)})\n`;
            onChange?.(`${value.trimEnd()}${snippet}`);
            message.success(t("jobs.imageUploaded"));
        } catch {
            message.error(t("jobs.imageUploadFailed"));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Segmented
                    size="small"
                    value={mode}
                    onChange={(next) => setMode(next as "write" | "preview")}
                    options={[
                        { label: t("jobs.briefWrite"), value: "write" },
                        { label: t("jobs.briefPreview"), value: "preview" },
                    ]}
                />
                <Button size="small" icon={<ImagePlus className="size-3.5" />} loading={uploading} onClick={() => inputRef.current?.click()}>
                    {t("jobs.uploadImage")}
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void insertImage(file);
                    }}
                />
            </div>
            {mode === "write" ? (
                <Spin spinning={uploading}>
                    <Input.TextArea value={value} onChange={(event) => onChange?.(event.target.value)} rows={10} placeholder={t("jobs.briefPlaceholder")} className="font-mono text-sm" />
                </Spin>
            ) : (
                <div className="min-h-48 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800">{value.trim() ? <JobBriefView markdown={value} /> : <span className="text-sm text-stone-400">{t("jobs.briefEmptyPreview")}</span>}</div>
            )}
            <div className="text-xs text-stone-500">{t("jobs.briefHint")}</div>
        </div>
    );
}
