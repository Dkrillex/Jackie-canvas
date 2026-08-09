export type ReferenceVideo = {
    id: string;
    name: string;
    type: string;
    url: string;
    storageKey?: string;
    bytes?: number;
    width?: number;
    height?: number;
    durationMs?: number;
    seedanceGroupId?: string;
    seedanceAssetStatus?: "pending" | "active" | "failed";
};

export type ReferenceAudio = {
    id: string;
    name: string;
    type: string;
    url: string;
    storageKey?: string;
    durationMs?: number;
    seedanceGroupId?: string;
    seedanceAssetStatus?: "pending" | "active" | "failed";
};
