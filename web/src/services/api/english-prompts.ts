import { PUBLIC_PROMPT_CATEGORY } from "./prompt-source-presets";
import { fetchPrompts } from "./prompts";

/** Homepage showcase: same DavidWu GPT Image 2 list as public `/prompts` library. */
export async function fetchEnglishPrompts(limit = 12) {
    const { items } = await fetchPrompts({ category: PUBLIC_PROMPT_CATEGORY, page: 1, pageSize: limit, includePersonal: false });
    return items;
}
