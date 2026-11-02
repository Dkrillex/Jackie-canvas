import { App, Button, Form, Input } from "antd";
import { Ticket } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatQuotaCurrency, redeemCode } from "@/services/api/user";

/** 账户页签里的兑换码输入：走 New API `POST /api/user/topup`，到账后让外层刷新余额。 */
export function RedeemCode({ onRedeemed }: { onRedeemed: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        // 按钮 loading 挡不住回车，连按会把同一个码再提交一次，第二次必然报「兑换失败」
        if (!code.trim() || loading) return;
        setLoading(true);
        try {
            const quota = await redeemCode(code);
            message.success(t("redeem.success", { amount: formatQuotaCurrency(quota) }));
            setCode("");
            onRedeemed();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("redeem.failed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form.Item label={t("redeem.title")} extra={t("redeem.hint")} className="mb-0 md:col-span-2">
            <div className="flex items-center gap-2">
                <Input value={code} onChange={(event) => setCode(event.target.value)} onPressEnter={() => void submit()} placeholder={t("redeem.placeholder")} prefix={<Ticket className="size-4 text-stone-400" />} allowClear />
                <Button type="primary" loading={loading} disabled={!code.trim()} onClick={() => void submit()}>
                    {t("redeem.submit")}
                </Button>
            </div>
        </Form.Item>
    );
}
