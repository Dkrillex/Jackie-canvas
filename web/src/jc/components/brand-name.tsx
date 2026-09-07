/**
 * 产品名整段用 Instrument Serif 斜体（.jc-wordmark），和首页大标题同一套。
 */
export function BrandName() {
    return (
        <>
            <span className="jc-brand-mark" aria-hidden />
            <span className="jc-brand-name jc-wordmark">Jackie Canvas</span>
        </>
    );
}
