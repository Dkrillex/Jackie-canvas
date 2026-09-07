import jcEnUS from "./en-US";
import jcZhCN from "./zh-CN";

export { jcEnUS, jcZhCN };

/**
 * 把二开文案合到上游 locale 上。顶层键做一层浅合并 —— 这样 `navigation` 只是加一个
 * `wallet` 而不会把上游那一整块盖掉，同时 `jobs` 里没列出的键继续沿用上游。
 *
 * 只做一层是刻意的：再深就得考虑数组、undefined 覆盖之类的边界，而这里的文案结构
 * 从来只有两层，多写的分支只会变成没人验证过的代码。真要覆盖第三层（比如
 * `jobs.status.*`），在二开文件里把整个 `status` 对象写全即可。
 */
export function mergeJcLocale<T extends Record<string, unknown>>(base: T, extra: Record<string, unknown>): T {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(extra)) {
        const previous = merged[key];
        const bothPlainObjects = isPlainObject(previous) && isPlainObject(value);
        merged[key] = bothPlainObjects ? { ...previous, ...value } : value;
    }
    return merged as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
