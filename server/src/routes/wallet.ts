import { Hono } from "hono";

import { resolveUser } from "../auth.js";
import { mysqlConfigured } from "../config.js";
import { getWallet, listLedger } from "../wallet.js";

export const walletRoutes = new Hono();

walletRoutes.get("/", async (c) => {
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置" }, 503);
    const user = await resolveUser(c.req.header("Authorization"));
    return c.json(await getWallet(user.userId));
});

walletRoutes.get("/ledger", async (c) => {
    if (!mysqlConfigured()) return c.json({ message: "订单库还没配置" }, 503);
    const user = await resolveUser(c.req.header("Authorization"));
    const limit = Math.min(Number(c.req.query("limit") || 50) || 50, 200);
    const rows = await listLedger(user.userId, limit);
    return c.json({
        entries: rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            amount: row.amount,
            balanceAfter: row.balance_after,
            frozenAfter: row.frozen_after,
            refNo: row.ref_no,
            note: row.note,
            createdAt: row.created_at,
        })),
    });
});
