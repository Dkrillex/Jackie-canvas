import { Hono } from "hono";

import { novaApiMysqlConfigured } from "../config.js";
import { RegisterError, registerNovaApiUser } from "../nova-users.js";

export const authRoutes = new Hono();

authRoutes.post("/register", async (c) => {
    if (!novaApiMysqlConfigured()) return c.json({ success: false, message: "注册服务未配置" }, 503);
    const body = await c.req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    try {
        await registerNovaApiUser(username, password);
        return c.json({ success: true, message: "" });
    } catch (error) {
        if (error instanceof RegisterError) return c.json({ success: false, message: error.message }, error.status as 400);
        throw error;
    }
});
