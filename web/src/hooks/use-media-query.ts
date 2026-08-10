import { useEffect, useState } from "react";

/** Tailwind `md` is 768px — below that is the mobile shell. */
export const MOBILE_NAV_QUERY = "(max-width: 767px)";
/** Tailwind `lg` is 1024px — workbench / Studio dual-pane. */
export const DESKTOP_SIDE_QUERY = "(min-width: 1024px)";

export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));

    useEffect(() => {
        const media = window.matchMedia(query);
        const onChange = () => setMatches(media.matches);
        onChange();
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}

/** True when viewport is below Tailwind `md` (mobile nav / desktop-only features hidden). */
export function useIsMobileNav() {
    return useMediaQuery(MOBILE_NAV_QUERY);
}

/** True when viewport is at least Tailwind `lg` (side panel beside main column). */
export function useIsDesktopSide() {
    return useMediaQuery(DESKTOP_SIDE_QUERY);
}

/** Cap a preferred width to the current viewport (for drawers). */
export function useViewportWidth(max: number, gutter = 16) {
    const [width, setWidth] = useState(() => (typeof window !== "undefined" ? Math.min(max, Math.max(240, window.innerWidth - gutter)) : max));
    useEffect(() => {
        const sync = () => setWidth(Math.min(max, Math.max(240, window.innerWidth - gutter)));
        sync();
        window.addEventListener("resize", sync);
        return () => window.removeEventListener("resize", sync);
    }, [gutter, max]);
    return width;
}
