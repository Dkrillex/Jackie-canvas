import { Spin } from "antd";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";

import { hydrateJobBriefMarkdown } from "@/lib/jobs/brief-markdown";

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
            controls={{ code: { copy: true, download: false }, table: { copy: false, download: false, fullscreen: false } }}
            lineNumbers={false}
        >
            {htmlMd}
        </Streamdown>
    );
}
