import { Spin } from "antd";
import { useEffect, useState } from "react";
import { Streamdown, type Components } from "streamdown";

import { hydrateJobBriefMarkdown } from "@/jc/lib/brief-markdown";

type JobBriefViewProps = {
    markdown: string;
};

export function JobBriefView({ markdown }: JobBriefViewProps) {
    const [htmlMd, setHtmlMd] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void hydrateJobBriefMarkdown(markdown)
            .then((value) => {
                if (cancelled) return;
                setHtmlMd(value);
            })
            .catch(() => {
                if (cancelled) return;
                setHtmlMd(markdown);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [markdown]);

    if (loading && !htmlMd) return <Spin size="small" />;

    return (
        <Streamdown
            className="job-brief-streamdown text-sm [&_img]:max-h-80 [&_img]:rounded-lg"
            components={{ img: BriefMedia }}
            controls={{ code: { copy: true, download: false }, table: { copy: false, download: false, fullscreen: false } }}
            lineNumbers={false}
        >
            {htmlMd}
        </Streamdown>
    );
}

const VIDEO_EXT = /\.(mp4|webm|ogv|m4v|mov)(\?|#|$)/i;

/**
 * Markdown 没有视频语法，而 `<video>` 标签会被渲染器的 sanitize 直接丢掉 ——
 * 所以视频只能借图片语法写：`![clip](https://.../a.mp4)`，到这里再换成播放器。
 */
const BriefMedia: Components["img"] = ({ src, alt, node: _node, ...rest }) => {
    if (typeof src !== "string" || !src) return null;
    if (VIDEO_EXT.test(src)) return <video src={src} controls preload="metadata" className="max-h-80 w-full rounded-lg" />;
    return <img src={src} alt={alt || ""} {...rest} />;
};
