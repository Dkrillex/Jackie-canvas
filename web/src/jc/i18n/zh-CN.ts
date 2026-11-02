/**
 * 二开文案。只写「新增的」和「要覆盖上游的」键，其余从上游 locale 继承
 * （合并规则见 ./index.ts 的 mergeJcLocale：顶层键做一层浅合并）。
 */
export default {
    meta: {
        title: "hinnflow",
        description: "hinnflow 创作工具",
    },
    home: {
        heroTitle: "HINNFLOW AI",
        description: "在 <canvas>HINNFLOW AI</canvas> 中生成、连接和重组 <content>图片、文字与图形</content>，让创作从单次生成变成连续推演。",
        showcaseEyebrow: "Prompt Library",
        showcaseTitle: "沉淀每一次 <serif>好结果</serif>",
    },
};
