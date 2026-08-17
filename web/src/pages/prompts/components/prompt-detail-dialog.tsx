import { BookmarkPlus, Copy, FileText, FolderPlus } from "lucide-react";
import { Button, Modal, Space, Tag } from "antd";

import { formatPromptDate, type Prompt } from "@/services/api/prompts";
import { useI18n } from "@/stores/use-locale-store";

export function PromptDetailDialog({ prompt, onClose, onCopy, onSaveAsset, onSavePrompt }: { prompt: Prompt | null; onClose: () => void; onCopy: (prompt: string) => void; onSaveAsset?: (prompt: Prompt) => void; onSavePrompt?: (prompt: Prompt) => void }) {
    const { t } = useI18n();
    return (
        <>
            <Modal title={prompt?.title} open={Boolean(prompt)} onCancel={onClose} footer={null} width={860}>
                {prompt ? (
                    <>
                        <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
                            <div className="space-y-3">
                                {prompt.coverUrl ? <img src={prompt.coverUrl} alt={prompt.title} className="aspect-[4/3] w-full rounded-lg object-cover" /> : <div className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground"><FileText className="size-9" /></div>}
                                {prompt.referenceImageUrls.length > 1 ? <div className="grid grid-cols-3 gap-2">{prompt.referenceImageUrls.filter((url) => url !== prompt.coverUrl).slice(0, 6).map((url) => <img key={url} src={url} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" />)}</div> : null}
                                {prompt.preview ? <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground dark:bg-muted dark:text-muted-foreground">{prompt.preview}</pre> : null}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap gap-1.5">
                                    {prompt.tags.map((tag) => (
                                        <Tag key={tag} className="m-0">
                                            {tag}
                                        </Tag>
                                    ))}
                                </div>
                                {prompt.description ? <p className="mt-4 text-sm leading-6 text-muted-foreground dark:text-muted-foreground">{prompt.description}</p> : null}
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90 dark:text-muted-foreground">{prompt.prompt}</p>
                                {prompt.createdAt || prompt.updatedAt ? <div className="mt-4 text-xs text-muted-foreground dark:text-muted-foreground">{prompt.createdAt ? t("prompts.created", { date: formatPromptDate(prompt.createdAt) }) : null}{prompt.createdAt && prompt.updatedAt ? " · " : null}{prompt.updatedAt ? t("prompts.updated", { date: formatPromptDate(prompt.updatedAt) }) : null}</div> : null}
                                <Space wrap className="mt-5">
                                    <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(prompt.prompt)}>
                                        {t("prompts.copyPrompt")}
                                    </Button>
                                    {onSaveAsset ? (
                                        <Button icon={<FolderPlus className="size-4" />} onClick={() => onSaveAsset(prompt)}>
                                            {t("prompts.addAsset")}
                                        </Button>
                                    ) : null}
                                    {onSavePrompt ? (
                                        <Button icon={<BookmarkPlus className="size-4" />} onClick={() => onSavePrompt(prompt)}>
                                            {t("prompts.saveToMine")}
                                        </Button>
                                    ) : null}
                                </Space>
                            </div>
                        </div>
                    </>
                ) : null}
            </Modal>
        </>
    );
}
