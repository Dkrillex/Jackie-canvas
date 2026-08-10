import { BookmarkPlus, FolderPlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { type ReactNode, type UIEvent, useEffect, useMemo, useState } from "react";
import { App, Button, Empty, Input, Popconfirm, Space, Spin, Tabs, Tag, Tooltip } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { MyPromptEditorDialog } from "./components/my-prompt-editor-dialog";
import { PromptDetailDialog } from "./components/prompt-detail-dialog";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { useI18n } from "@/stores/use-locale-store";
import { usePromptStore, type PersonalPrompt, type PersonalPromptInput } from "@/stores/use-prompt-store";
import { PUBLIC_PROMPT_CATEGORY } from "@/services/api/prompt-source-presets";
import { useUserStore } from "@/stores/use-user-store";
import { ALL_PROMPTS_OPTION, personalPromptToPrompt, type Prompt } from "@/services/api/prompts";

export default function PromptsPage() {
    const { message } = App.useApp();
    const { t } = useI18n();
    const isAdmin = (useUserStore((state) => state.user)?.username || "").trim().toLowerCase() === "admin";
    const [activeTab, setActiveTab] = useState("library");
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PersonalPrompt | null>(null);
    const addAsset = useAssetStore((state) => state.addAsset);
    const personalPrompts = usePromptStore((state) => state.prompts);
    const addPrompt = usePromptStore((state) => state.addPrompt);
    const updatePrompt = usePromptStore((state) => state.updatePrompt);
    const removePrompt = usePromptStore((state) => state.removePrompt);
    const copyText = useCopyText();
    const filterTags = isAdmin ? selectedTags : [];
    const filterCategory = isAdmin ? selectedCategory : PUBLIC_PROMPT_CATEGORY;
    const { query, items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts } = usePromptList({ keyword: titleKeyword, tags: filterTags, category: filterCategory, enabled: activeTab === "library" });
    const filteredPersonalPrompts = useMemo(() => {
        const keyword = titleKeyword.trim().toLowerCase();
        if (!keyword) return personalPrompts;
        return personalPrompts.filter((item) => [item.title, item.prompt, item.description, ...item.tags].join(" ").toLowerCase().includes(keyword));
    }, [personalPrompts, titleKeyword]);

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? query.error.message : t("prompts.fetchFailed"));
    }, [message, query.error, query.isError, t]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };

    const savePromptAsset = (item: Prompt) => {
        addAsset({ kind: "text", title: item.title, coverUrl: item.coverUrl, tags: item.tags, source: item.category, data: { content: item.prompt }, metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl } });
        message.success(t("prompts.addedAsset"));
    };

    const saveToMyPrompts = (item: Prompt) => {
        addPrompt(toPersonalInput(item));
        message.success(t("prompts.savedToMine"));
    };

    const openNewPrompt = () => {
        setEditingPrompt(null);
        setEditorOpen(true);
    };

    const openEditPrompt = (item: PersonalPrompt) => {
        setEditingPrompt(item);
        setEditorOpen(true);
    };

    const savePersonalPrompt = (input: PersonalPromptInput) => {
        if (editingPrompt) updatePrompt(editingPrompt.id, input);
        else addPrompt(input);
        message.success(editingPrompt ? t("prompts.personalUpdated") : t("prompts.personalAdded"));
    };

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        if (activeTab !== "library") return;
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) void query.fetchNextPage();
    };

    const personalItems = filteredPersonalPrompts.map(personalPromptToPrompt);
    const visibleCount = activeTab === "library" ? totalPrompts : filteredPersonalPrompts.length;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-800 dark:text-stone-100">
            <main data-app-page-scroll className="tennda-page-bg min-h-0 flex-1 overflow-y-auto px-6 py-8" onScroll={handleListScroll}>
                <div className="mx-auto max-w-7xl pb-8">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("page.promptsTitle")}</h1>
                            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t("prompts.count", { n: visibleCount })}</p>
                        </div>
                        {activeTab === "personal" ? (
                            <Button type="primary" icon={<Plus className="size-4" />} onClick={openNewPrompt}>
                                {t("prompts.new")}
                            </Button>
                        ) : null}
                    </div>
                    <Tabs
                        className="mt-5"
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={[
                            { key: "library", label: t("prompts.library") },
                            { key: "personal", label: `${t("prompts.personal")} (${personalPrompts.length})` },
                        ]}
                    />
                    <div className="mx-auto mt-2 w-full max-w-2xl">
                        <Input size="large" prefix={<Search className="size-4 text-stone-400" />} value={titleKeyword} placeholder={t("prompts.searchPh")} onChange={(event) => setTitleKeyword(event.target.value)} />
                    </div>
                    {activeTab === "library" && isAdmin ? (
                        <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                            <PromptFilter label={t("prompts.category")} options={promptCategoryOptions} selected={selectedCategory} onChange={setSelectedCategory} allLabel={t("common.all")} />
                            <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">{t("prompts.tags")}</div>
                                <div className="flex flex-wrap gap-2">
                                    {promptTags.map((tag) => {
                                        const active = tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag);
                                        return (
                                            <Tag.CheckableTag key={tag} checked={active} className={cn("prompt-filter-tag", active && "is-active")} onChange={() => toggleTag(tag)}>
                                                {tag === ALL_PROMPTS_OPTION ? t("common.all") : tag}
                                            </Tag.CheckableTag>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {activeTab === "library" && query.isLoading ? (
                    <div className="flex h-60 items-center justify-center">
                        <Spin />
                    </div>
                ) : null}
                {activeTab === "library" && !query.isLoading ? (
                    <PromptGrid
                        items={promptItems}
                        onOpen={setSelectedPrompt}
                        renderActions={(item) => (
                            <>
                                <Button size="small" icon={<BookmarkPlus className="size-3.5" />} onClick={() => saveToMyPrompts(item)}>
                                    {t("prompts.save")}
                                </Button>
                                <Tooltip title={t("prompts.addAsset")}>
                                    <Button type="text" size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)} />
                                </Tooltip>
                            </>
                        )}
                        onCopy={(item) => copyText(item.prompt, t("prompts.copied"))}
                        emptyText={t("prompts.empty")}
                    />
                ) : null}
                {activeTab === "personal" ? (
                    <PromptGrid
                        items={personalItems}
                        onOpen={setSelectedPrompt}
                        onCopy={(item) => copyText(item.prompt, t("prompts.copied"))}
                        renderActions={(item) => {
                            const personal = personalPrompts.find((prompt) => prompt.id === item.id)!;
                            return (
                                <Space size={0}>
                                    <Tooltip title={t("action.edit")}>
                                        <Button type="text" size="small" icon={<Pencil className="size-3.5" />} onClick={() => openEditPrompt(personal)} />
                                    </Tooltip>
                                    <Popconfirm title={t("prompts.deleteConfirm")} okText={t("action.delete")} cancelText={t("action.cancel")} onConfirm={() => removePrompt(item.id)}>
                                        <Tooltip title={t("action.delete")}>
                                            <Button type="text" danger size="small" icon={<Trash2 className="size-3.5" />} />
                                        </Tooltip>
                                    </Popconfirm>
                                </Space>
                            );
                        }}
                        emptyText={t("prompts.emptyPersonal")}
                    />
                ) : null}
                {activeTab === "library" ? (
                    <div className="mx-auto mt-6 max-w-7xl text-center text-xs text-stone-500 dark:text-stone-400">
                        {query.isFetchingNextPage ? t("common.loading") : query.hasNextPage ? t("prompts.loadMore") : promptItems.length > 0 ? t("prompts.end") : null}
                    </div>
                ) : null}
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(prompt) => copyText(prompt, t("prompts.copied"))} onSaveAsset={selectedPrompt?.sourceId === "personal" ? undefined : savePromptAsset} onSavePrompt={selectedPrompt?.sourceId === "personal" ? undefined : saveToMyPrompts} />
            <MyPromptEditorDialog open={editorOpen} prompt={editingPrompt} onSave={savePersonalPrompt} onClose={() => setEditorOpen(false)} />
        </div>
    );
}

function PromptFilter({ label, options, selected, onChange, allLabel }: { label: string; options: string[]; selected: string; onChange: (value: string) => void; allLabel: string }) {
    return (
        <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
            <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">{label}</div>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <Tag.CheckableTag key={option} checked={selected === option} className={cn("prompt-filter-tag", selected === option && "is-active")} onChange={() => onChange(option)}>
                        {option === ALL_PROMPTS_OPTION ? allLabel : option}
                    </Tag.CheckableTag>
                ))}
            </div>
        </div>
    );
}

function PromptGrid({ items, onOpen, onCopy, renderActions, emptyText }: { items: Prompt[]; onOpen: (item: Prompt) => void; onCopy: (item: Prompt) => void; renderActions: (item: Prompt) => ReactNode; emptyText: string }) {
    return (
        <div>
            <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((item) => (
                    <PromptCard key={`${item.sourceId}:${item.id}`} item={item} onOpen={() => onOpen(item)} onCopy={() => onCopy(item)} extraAction={renderActions(item)} />
                ))}
            </div>
            {items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} className="py-16" /> : null}
        </div>
    );
}

function toPersonalInput(item: Prompt): PersonalPromptInput {
    return { title: item.title, prompt: item.prompt, description: item.description, coverUrl: item.coverUrl, referenceImageUrls: item.referenceImageUrls, tags: item.tags, imageMode: item.imageMode, imageModel: item.imageModel, imageSize: item.imageSize, imageCount: item.imageCount };
}
