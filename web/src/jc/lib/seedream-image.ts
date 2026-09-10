/** Seedream 5.0 上游要求总像素至少 3686400（恰好是 2560×1440）。 */
export const SEEDREAM5_MIN_PIXELS = 3_686_400;
const SIZE_STEP = 16;

export function isSeedream5Model(model: string) {
    return /seedream[-_]?5/i.test(model);
}

/** 过小的 WxH 按原比例抬到 Seedream 5.0 下限；非该模型或非像素尺寸原样返回。 */
export function clampSeedreamRequestSize(size: string | undefined, model: string) {
    if (!size || !isSeedream5Model(model)) return size;
    const match = size.match(/^(\d+)x(\d+)$/i);
    if (!match) return size;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height || width * height >= SEEDREAM5_MIN_PIXELS) return size;
    const landscape = width >= height;
    const longRatio = landscape ? width / height : height / width;
    let long = Math.ceil(Math.sqrt(SEEDREAM5_MIN_PIXELS * longRatio) / SIZE_STEP) * SIZE_STEP;
    let short = Math.max(SIZE_STEP, Math.round(long / longRatio / SIZE_STEP) * SIZE_STEP);
    while (long * short < SEEDREAM5_MIN_PIXELS) {
        long += SIZE_STEP;
        short = Math.max(SIZE_STEP, Math.round(long / longRatio / SIZE_STEP) * SIZE_STEP);
    }
    return landscape ? `${long}x${short}` : `${short}x${long}`;
}
