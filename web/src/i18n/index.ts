import { en } from "./messages/en";
import { zh } from "./messages/zh";
import type { AppLocale, MessageKey, Messages } from "./types";

export const messages: Record<AppLocale, Messages> = { en: en as Messages, zh };

export type TranslateVars = Record<string, string | number>;

export function translate(locale: AppLocale, key: MessageKey, vars?: TranslateVars) {
    let text = messages[locale][key] || messages.en[key] || key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
    }
    return text;
}

export type { AppLocale, MessageKey, Messages };
