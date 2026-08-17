import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

/** Illucent AI — purple + white, SiliconFlow-inspired. */
const brand = {
    light: {
        primary: "#7C5CFC",
        primaryHover: "#6B4AE8",
        primaryText: "#ffffff",
        menuBg: "#F3F0FF",
        menuText: "#5B41D9",
        selectActiveBg: "#F3F0FF",
        selectSelectedBg: "#E9E3FF",
        selectText: "#1F2937",
        tableSelectedBg: "rgba(124, 92, 252, 0.06)",
        tableSelectedHoverBg: "rgba(124, 92, 252, 0.1)",
    },
    dark: {
        primary: "#9B87FF",
        primaryHover: "#C4B5FD",
        primaryText: "#ffffff",
        menuBg: "#2A2540",
        menuText: "#C4B5FD",
        selectActiveBg: "#2A2540",
        selectSelectedBg: "#35304A",
        selectText: "#ffffff",
        tableSelectedBg: "rgba(155, 135, 255, 0.14)",
        tableSelectedHoverBg: "rgba(196, 181, 253, 0.12)",
    },
};

export function getAntThemeConfig(dark: boolean): ThemeConfig {
    const color = dark ? brand.dark : brand.light;

    return {
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: dark ? "infinite-canvas-dark" : "infinite-canvas-light" },
        token: {
            fontFamily: '"Outfit", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontFamilyCode: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            colorPrimary: color.primary,
            colorInfo: color.primary,
            colorLink: color.primary,
            colorLinkHover: color.primaryHover,
            colorLinkActive: color.primary,
            colorTextLightSolid: color.primaryText,
            colorBgBase: dark ? "#16141F" : "#FAFAFC",
            colorBgContainer: dark ? "#221F33" : "#ffffff",
            colorBorder: dark ? "rgba(255,255,255,0.12)" : "#E8E4F2",
            borderRadius: 10,
        },
        components: {
            Button: {
                primaryShadow: "none",
                borderRadius: 999,
            },
            Menu: {
                itemActiveBg: color.menuBg,
                itemHoverBg: color.menuBg,
                itemSelectedBg: color.menuBg,
                itemSelectedColor: color.menuText,
                darkItemHoverBg: brand.dark.menuBg,
                darkItemSelectedBg: brand.dark.menuBg,
                darkItemSelectedColor: brand.dark.menuText,
            },
            Select: {
                optionActiveBg: color.selectActiveBg,
                optionSelectedBg: color.selectSelectedBg,
                optionSelectedColor: color.selectText,
            },
            Table: {
                rowSelectedBg: color.tableSelectedBg,
                rowSelectedHoverBg: color.tableSelectedHoverBg,
            },
        },
    };
}
