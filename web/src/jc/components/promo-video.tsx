import { Trans, useTranslation } from "react-i18next";

/** 首页产品宣传片：静音循环自动播放，带控件可开声音；素材在 public/home/ */
export function PromoVideo() {
    const { t } = useTranslation();
    return (
        <section className="jc-promo px-6">
            <div className="mb-10 text-center">
                <p className="jc-section-eyebrow">{t("home.promoEyebrow")}</p>
                <h2 className="jc-section-title">
                    <Trans i18nKey="home.promoTitle" components={{ serif: <em className="jc-serif-accent" /> }} />
                </h2>
                <p className="jc-showcase-lead">{t("home.promoDescription")}</p>
            </div>
            <div className="jc-promo-frame">
                <video src="/home/hinnflow-promo.mp4" poster="/home/hinnflow-promo.jpg" autoPlay muted loop playsInline controls preload="metadata" />
            </div>
        </section>
    );
}
