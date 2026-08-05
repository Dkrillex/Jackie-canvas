import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

const brand = {
    light: {
        primary: "#0175DA",
        primaryHover: "#015AD1",
        primaryText: "#ffffff",
        menuBg: "#f1f4ff",
        menuText: "#015AD1",
        selectActiveBg: "#f1f4ff",
        selectSelectedBg: "#e8eefc",
        selectText: "#1F2937",
        tableSelectedBg: "rgba(1, 117, 218, 0.06)",
        tableSelectedHoverBg: "rgba(1, 117, 218, 0.1)",
    },
    dark: {
        primary: "#0190E4",
        primaryHover: "#66fff9",
        primaryText: "#ffffff",
        menuBg: "#2a2e3c",
        menuText: "#66fff9",
        selectActiveBg: "#2a2e3c",
        selectSelectedBg: "#343849",
        selectText: "#ffffff",
        tableSelectedBg: "rgba(1, 144, 228, 0.14)",
        tableSelectedHoverBg: "rgba(102, 255, 249, 0.12)",
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
            colorBgBase: dark ? "#1c1f2b" : "#f5f7fa",
            colorBgContainer: dark ? "#2a2e3c" : "#ffffff",
            colorBorder: dark ? "rgba(255,255,255,0.12)" : "#e4e7ec",
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
