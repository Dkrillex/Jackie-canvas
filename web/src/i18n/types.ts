import type { en } from "./messages/en";

export type AppLocale = "en" | "zh";

export type MessageKey = keyof typeof en;

export type Messages = Record<MessageKey, string>;
