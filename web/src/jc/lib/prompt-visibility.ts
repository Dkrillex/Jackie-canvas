const HIDDEN_PROMPT_TAGS = new Set(["nsfw", "unknown"]);

/** 提示词库不展示带 NSFW / Unknown 标签的条目。 */
export function isVisibleLibraryPrompt(item: { tags?: string[] }) {
    return !(item.tags || []).some((tag) => HIDDEN_PROMPT_TAGS.has(String(tag).trim().toLowerCase()));
}
