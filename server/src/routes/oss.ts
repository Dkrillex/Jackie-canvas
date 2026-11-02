import { Hono } from "hono";

import { resolveUserFrom } from "../auth.js";
import { isAllowedUploadType, signUpload } from "../oss.js";

export const ossRoutes = new Hono();

/** 签发单文件预签名上传地址。需要登录，免得任何人都能往 bucket 里写。 */
ossRoutes.post("/sign", async (c) => {
    const { userId } = await resolveUserFrom(c);
    const body = (await c.req.json().catch(() => ({}))) as { fileName?: unknown; contentType?: unknown };
    const contentType = String(body.contentType || "").trim().toLowerCase();
    if (!isAllowedUploadType(contentType)) return c.json({ message: "不支持的文件类型" }, 400);
    return c.json(signUpload(userId, String(body.fileName || "file"), contentType));
});
