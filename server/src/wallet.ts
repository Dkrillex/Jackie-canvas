/** 钱包读取。写只发生在 orders.settle()（充值到账）里，这里不提供任何加钱入口。 */
import type { RowDataPacket } from "mysql2/promise";

import { getPool } from "./db.js";

export type WalletView = { balance: string; frozen: string; available: string };

export type LedgerRow = {
    id: number;
    kind: string;
    amount: string;
    balance_after: string;
    frozen_after: string;
    ref_no: string | null;
    note: string;
    created_at: string;
};

export async function getWallet(userId: string): Promise<WalletView> {
    const pool = await getPool();
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT balance, frozen FROM user_wallets WHERE user_id = ?", [userId]);
    // 没充过值的用户库里没有行。不在这里 INSERT：读接口不该产生写，
    // 第一次充值到账时 settle() 自然会把行建出来。
    const balance = (rows[0]?.balance as string) || "0.00";
    const frozen = (rows[0]?.frozen as string) || "0.00";
    return { balance, frozen, available: (Number(balance) - Number(frozen)).toFixed(2) };
}

export async function listLedger(userId: string, limit = 50): Promise<LedgerRow[]> {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, kind, amount, balance_after, frozen_after, ref_no, note, created_at FROM wallet_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        [userId, limit],
    );
    return rows as LedgerRow[];
}
