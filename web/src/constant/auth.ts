export const AUTH_TOKEN_KEY = "infinite-canvas:auth_token";
export const AUTH_USER_ID_KEY = "infinite-canvas:auth_user_id";

/** 登录态请求头：Bearer access_token + New-Api-User */
export function getSessionHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
    const userId = window.localStorage.getItem(AUTH_USER_ID_KEY) || "";
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(userId ? { "New-Api-User": userId } : {}),
    };
}
