import { ImagePlus, Link2, TriangleAlert } from "lucide-react";
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

    const insertImageUrl = () => {
        const url = window.prompt(t("jobs.insertImageUrlPrompt"), "https://")?.trim();
        if (!url || url === "https://") return;
        onChange?.(`${value.trimEnd()}\n![image](${url})\n`);
    };

    return (
        <div className="space-y-2">
            {/* 工具条 + 正文 + 状态条包成一个面板：三样东西各自飘着的时候，弹窗里看不出这是一个编辑器 */}
            <div className="overflow-hidden rounded-xl border border-stone-200 transition focus-within:border-stone-400 dark:border-stone-800 dark:focus-within:border-stone-600">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/80 px-2.5 py-2 dark:border-stone-800 dark:bg-white/[0.03]">
                    <Segmented
                        size="small"
                        value={mode}
                        onChange={(next) => setMode(next as "write" | "preview")}
                        options={[
                            { label: t("jobs.briefWrite"), value: "write" },
                            { label: t("jobs.briefPreview"), value: "preview" },
                        ]}
                    />
                    <div className="flex items-center gap-1">
                        {/* 图片 URL 是唯一「所有人都看得见」的插法，给它一个和上传同级的入口 */}
                        <Button type="text" size="small" icon={<Link2 className="size-3.5" />} onClick={insertImageUrl}>
                            {t("jobs.insertImageUrl")}
                        </Button>
                        <Button type="text" size="small" icon={<ImagePlus className="size-3.5" />} loading={uploading} onClick={() => inputRef.current?.click()}>
                            {t("jobs.uploadImage")}
                        </Button>
                    </div>
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
                        <Input.TextArea variant="borderless" value={value} onChange={(event) => onChange?.(event.target.value)} rows={10} placeholder={t("jobs.briefPlaceholder")} className="!rounded-none px-3.5 py-3 font-mono !text-sm" />
                    </Spin>
                ) : (
                    <div className="min-h-52 px-3.5 py-3">{value.trim() ? <JobBriefView markdown={value} /> : <span className="text-sm text-stone-400">{t("jobs.briefEmptyPreview")}</span>}</div>
                )}

                <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/80 px-3 py-1.5 text-[11px] text-stone-400 dark:border-stone-800 dark:bg-white/[0.03]">
                    <span>Markdown</span>
                    <span className="tabular-nums">{t("jobs.briefCount", { n: value.length })}</span>
                </div>
            </div>

            <div className="space-y-1 text-xs text-stone-500">
                <div>{t("jobs.briefHint")}</div>
                {/* 实测：本机上传的 image: 引用在别人浏览器里会渲染成「Image blocked」，只有 URL 到处都显示 */}
                <div className="flex gap-1.5 text-amber-600 dark:text-amber-500">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span>{t("jobs.briefImageWarn")}</span>
                </div>
            </div>
        </div>
    );
}
