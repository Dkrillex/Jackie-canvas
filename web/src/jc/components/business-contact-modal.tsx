import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { BUSINESS_MAIL, BUSINESS_MAIL_TEXT, BUSINESS_WECHAT_QR } from "@/jc/config";

/** 商务微信二维码。充值页的「更大额度」和企业页的「还没加入企业」都要用，别抄两份。 */
export function BusinessContactModal({ open, onClose, hint }: { open: boolean; onClose: () => void; hint?: string }) {
    const { t } = useTranslation();

    return (
        <Modal open={open} onCancel={onClose} footer={null} title={t("wallet.businessTitle")} width={380}>
            <div className="flex flex-col items-center gap-3 pb-2 pt-1 text-center">
                <div className="text-sm text-stone-500 dark:text-stone-400">{hint || t("wallet.businessHint")}</div>
                <img src={BUSINESS_WECHAT_QR} alt={t("wallet.businessTitle")} className="size-52 rounded-xl border border-stone-200 object-cover dark:border-stone-800" />
                <div className="text-xs text-stone-400">
                    {t("wallet.businessMail")}
                    <a href={BUSINESS_MAIL} className="ml-1">
                        {BUSINESS_MAIL_TEXT}
                    </a>
                </div>
            </div>
        </Modal>
    );
}
