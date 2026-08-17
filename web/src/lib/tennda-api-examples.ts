import type { TenndaModelCapability } from "@/constant/tennda-models";

const PYTHON_HEADER = `import os
import requests

BASE_URL = os.environ.get("ILLUCENT_BASE_URL", "https://ai.tennda.com/gw")
API_KEY = os.environ["ILLUCENT_API_KEY"]

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}`;

export type TenndaApiParam = {
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string;
    options?: string[];
    description: string;
};

export type TenndaApiContract = {
    method: "POST";
    path: string;
    contentType: string;
    requestBody: string;
    responseBody: string;
    responseNote?: string;
    parameters: TenndaApiParam[];
};

/** Illucent Waves voice catalog (public API ids). */
export const TENNDA_VOICE_OPTIONS = [
    { value: "aurora", label: "Aurora", tone: "Bright · clear narration" },
    { value: "ember", label: "Ember", tone: "Warm · product demos" },
    { value: "harbor", label: "Harbor", tone: "Calm · explainers" },
    { value: "grove", label: "Grove", tone: "Soft · storytelling" },
    { value: "lyric", label: "Lyric", tone: "Expressive · ads" },
    { value: "pulse", label: "Pulse", tone: "Energetic · shorts" },
    { value: "canyon", label: "Canyon", tone: "Deep · documentary" },
    { value: "meadow", label: "Meadow", tone: "Gentle · onboarding" },
    { value: "glaze", label: "Glaze", tone: "Crisp · UI voiceover" },
    { value: "stanza", label: "Stanza", tone: "Poetic · brand films" },
    { value: "flint", label: "Flint", tone: "Neutral · tutorials" },
    { value: "reef", label: "Reef", tone: "Friendly · support" },
] as const;

export const TENNDA_IMAGE_SIZE_OPTIONS = [
    { value: "1024x1024", label: "1:1 · 1024" },
    { value: "1536x1024", label: "3:2 · landscape" },
    { value: "1024x1536", label: "2:3 · portrait" },
    { value: "1360x1024", label: "4:3 · landscape" },
    { value: "1024x1360", label: "3:4 · portrait" },
    { value: "1824x1024", label: "16:9 · landscape" },
    { value: "1024x1824", label: "9:16 · portrait" },
    { value: "2048x2048", label: "1:1 · 2K" },
    { value: "2048x1152", label: "16:9 · 2K" },
    { value: "1152x2048", label: "9:16 · 2K" },
    { value: "3840x2160", label: "16:9 · 4K" },
    { value: "2160x3840", label: "9:16 · 4K" },
    { value: "auto", label: "auto · model default" },
] as const;

export const TENNDA_VIDEO_SIZE_OPTIONS = [
    { value: "1280x720", label: "16:9 · 720p" },
    { value: "720x1280", label: "9:16 · 720p" },
    { value: "1920x1080", label: "16:9 · 1080p" },
    { value: "1080x1920", label: "9:16 · 1080p" },
    { value: "1024x1024", label: "1:1 · square" },
    { value: "1792x1024", label: "wide cinematic" },
    { value: "1024x1792", label: "tall cinematic" },
    { value: "auto", label: "auto · model default" },
] as const;

export const TENNDA_VIDEO_SECONDS_OPTIONS = ["4", "6", "8", "10", "12", "16", "20"] as const;

function imageParameters(apiId: string): TenndaApiParam[] {
    return [
        { name: "model", type: "string", required: true, defaultValue: apiId, options: [apiId], description: "Illucent image model api id." },
        { name: "prompt", type: "string", required: true, description: "Text description of the image to generate. Supports English scene, lighting, and style direction." },
        {
            name: "n",
            type: "integer",
            required: false,
            defaultValue: "1",
            options: ["1", "2", "3", "4"],
            description: "Number of images to return in one request. Higher n increases latency and cost.",
        },
        {
            name: "size",
            type: "string",
            required: false,
            defaultValue: "1024x1024",
            options: TENNDA_IMAGE_SIZE_OPTIONS.map((item) => item.value),
            description: "Output resolution as WIDTHxHEIGHT, or auto. 2K/4K sizes are available on Illusion / Dream.",
        },
        {
            name: "quality",
            type: "string",
            required: false,
            defaultValue: "auto",
            options: ["auto", "high", "medium", "low"],
            description: "Render quality preset. high favors detail; low favors speed for drafts.",
        },
        {
            name: "background",
            type: "string",
            required: false,
            defaultValue: "opaque",
            options: ["opaque", "transparent"],
            description: "Canvas background. transparent returns RGBA-compatible assets when supported.",
        },
    ];
}

function videoParameters(apiId: string): TenndaApiParam[] {
    return [
        { name: "model", type: "string", required: true, defaultValue: apiId, options: [apiId], description: "Illucent video model api id." },
        { name: "prompt", type: "string", required: true, description: "Shot description: subject, camera move, lighting, and pacing." },
        {
            name: "seconds",
            type: "string | integer",
            required: false,
            defaultValue: "6",
            options: [...TENNDA_VIDEO_SECONDS_OPTIONS],
            description: "Clip duration in seconds. Motion Lite/Fast typically 4–12s; Cinema supports longer shots.",
        },
        {
            name: "size",
            type: "string",
            required: false,
            defaultValue: "1280x720",
            options: TENNDA_VIDEO_SIZE_OPTIONS.map((item) => item.value),
            description: "Frame size as WIDTHxHEIGHT, or auto. Prefer 16:9 for landscape and 9:16 for vertical.",
        },
        {
            name: "resolution",
            type: "string",
            required: false,
            defaultValue: "720p",
            options: ["480p", "720p", "1080p"],
            description: "Clarity tier. 1080p is available on Motion Fast / Cinema when the selected size matches.",
        },
    ];
}

function audioParameters(apiId: string): TenndaApiParam[] {
    return [
        { name: "model", type: "string", required: true, defaultValue: apiId, options: [apiId], description: "Illucent speech model api id (tennda-waves)." },
        { name: "input", type: "string", required: true, description: "Text to synthesize. Keep under the model context budget for best quality." },
        {
            name: "voice",
            type: "string",
            required: false,
            defaultValue: "aurora",
            options: TENNDA_VOICE_OPTIONS.map((item) => item.value),
            description: "Illucent Waves studio voice. See voice catalog below for tone guidance.",
        },
        {
            name: "speed",
            type: "number",
            required: false,
            defaultValue: "1.0",
            options: ["0.25", "0.5", "0.75", "1.0", "1.25", "1.5", "2.0", "3.0", "4.0"],
            description: "Playback rate from 0.25× to 4.0×. Values outside the range are clamped.",
        },
        {
            name: "response_format",
            type: "string",
            required: false,
            defaultValue: "mp3",
            options: ["mp3", "wav", "opus", "aac", "flac", "pcm"],
            description: "Audio container / encoding for the binary response body.",
        },
    ];
}

function textParameters(apiId: string): TenndaApiParam[] {
    return [
        { name: "model", type: "string", required: true, defaultValue: apiId, options: [apiId], description: "Illucent text model api id." },
        { name: "input", type: "string", required: true, description: "User prompt or instruction for the model." },
        {
            name: "max_output_tokens",
            type: "integer",
            required: false,
            defaultValue: "2048",
            options: ["512", "1024", "2048", "4096", "8192", "16384"],
            description: "Upper bound on generated tokens. Must stay within the model max output.",
        },
        {
            name: "temperature",
            type: "number",
            required: false,
            defaultValue: "1.0",
            options: ["0", "0.2", "0.5", "0.7", "1.0", "1.2"],
            description: "Sampling temperature. Lower is more deterministic; higher is more creative.",
        },
    ];
}

/** Documented request / response bodies for the public Illucent API surface. */
export function tenndaApiContract(capability: TenndaModelCapability, apiId: string): TenndaApiContract {
    if (capability === "image") {
        return {
            method: "POST",
            path: "/v1/images/generations",
            contentType: "application/json",
            requestBody: JSON.stringify(
                {
                    model: apiId,
                    prompt: "A ceramic cup on linen, soft daylight",
                    n: 1,
                    size: "1024x1024",
                    quality: "high",
                    background: "opaque",
                },
                null,
                2,
            ),
            responseBody: JSON.stringify(
                {
                    created: 1710000000,
                    data: [
                        {
                            url: "https://cdn.example.com/tennda/illusion-01.png",
                            revised_prompt: "A ceramic cup on linen, soft daylight",
                        },
                    ],
                },
                null,
                2,
            ),
            parameters: imageParameters(apiId),
        };
    }

    if (capability === "video") {
        return {
            method: "POST",
            path: "/v1/videos",
            contentType: "application/json",
            requestBody: JSON.stringify(
                {
                    model: apiId,
                    prompt: "Morning fog drifting over quiet hills",
                    seconds: "8",
                    size: "1280x720",
                    resolution: "720p",
                },
                null,
                2,
            ),
            responseBody: JSON.stringify(
                {
                    id: "video_abc123",
                    object: "video",
                    model: apiId,
                    status: "queued",
                    progress: 0,
                    created_at: 1710000000,
                },
                null,
                2,
            ),
            responseNote: "Poll GET /v1/videos/{id} until status is completed, then download GET /v1/videos/{id}/content.",
            parameters: videoParameters(apiId),
        };
    }

    if (capability === "audio") {
        return {
            method: "POST",
            path: "/v1/audio/speech",
            contentType: "application/json",
            requestBody: JSON.stringify(
                {
                    model: apiId,
                    input: "Welcome to Illucent.",
                    voice: "aurora",
                    speed: 1.0,
                    response_format: "mp3",
                },
                null,
                2,
            ),
            responseBody: "(binary audio bytes — Content-Type: audio/mpeg)",
            responseNote: "Success returns raw audio bytes, not JSON. Save the response body to a .mp3 file.",
            parameters: audioParameters(apiId),
        };
    }

    return {
        method: "POST",
        path: "/v1/responses",
        contentType: "application/json",
        requestBody: JSON.stringify(
            {
                model: apiId,
                input: "Write a short creative brief for a product launch.",
                max_output_tokens: 2048,
                temperature: 0.7,
            },
            null,
            2,
        ),
        responseBody: JSON.stringify(
            {
                id: "resp_abc123",
                object: "response",
                model: apiId,
                status: "completed",
                output: [
                    {
                        type: "message",
                        role: "assistant",
                        content: [
                            {
                                type: "output_text",
                                text: "Here is a concise creative brief…",
                            },
                        ],
                    },
                ],
                usage: {
                    input_tokens: 24,
                    output_tokens: 128,
                    total_tokens: 152,
                },
            },
            null,
            2,
        ),
        parameters: textParameters(apiId),
    };
}

/** Python requests snippet for an Illucent public api id. */
export function tenndaPythonSnippet(capability: TenndaModelCapability, apiId: string) {
    if (capability === "image") {
        return `${PYTHON_HEADER}

# ${apiId} — image generation
resp = requests.post(
    f"{BASE_URL}/v1/images/generations",
    headers=headers,
    json={
        "model": "${apiId}",
        "prompt": "A ceramic cup on linen, soft daylight",
        "n": 1,
        "size": "1024x1024",
        "quality": "high",
    },
    timeout=120,
)
resp.raise_for_status()
print(resp.json())`;
    }

    if (capability === "video") {
        return `${PYTHON_HEADER}

# ${apiId} — video generation
resp = requests.post(
    f"{BASE_URL}/v1/videos",
    headers=headers,
    json={
        "model": "${apiId}",
        "prompt": "Morning fog drifting over quiet hills",
        "seconds": "8",
        "size": "1280x720",
        "resolution": "720p",
    },
    timeout=300,
)
resp.raise_for_status()
print(resp.json())`;
    }

    if (capability === "audio") {
        return `${PYTHON_HEADER}

# ${apiId} — speech synthesis
resp = requests.post(
    f"{BASE_URL}/v1/audio/speech",
    headers=headers,
    json={
        "model": "${apiId}",
        "input": "Welcome to Illucent.",
        "voice": "aurora",
        "speed": 1.0,
        "response_format": "mp3",
    },
    timeout=60,
)
resp.raise_for_status()
with open("tennda-speech.mp3", "wb") as f:
    f.write(resp.content)
print("saved tennda-speech.mp3")`;
    }

    return `${PYTHON_HEADER}

# ${apiId} — text / chat
resp = requests.post(
    f"{BASE_URL}/v1/responses",
    headers=headers,
    json={
        "model": "${apiId}",
        "input": "Write a short creative brief for a product launch.",
        "max_output_tokens": 2048,
        "temperature": 0.7,
    },
    timeout=60,
)
resp.raise_for_status()
print(resp.json())`;
}

export function tenndaCurlSnippet(capability: TenndaModelCapability, apiId: string) {
    if (capability === "image") {
        return `curl -X POST "https://ai.tennda.com/gw/v1/images/generations" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${apiId}",
    "prompt": "A ceramic cup on linen",
    "n": 1,
    "size": "1024x1024",
    "quality": "high"
  }'`;
    }

    if (capability === "video") {
        return `curl -X POST "https://ai.tennda.com/gw/v1/videos" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${apiId}",
    "prompt": "Morning fog drifting over quiet hills",
    "seconds": "8",
    "size": "1280x720",
    "resolution": "720p"
  }'`;
    }

    if (capability === "audio") {
        return `curl -X POST "https://ai.tennda.com/gw/v1/audio/speech" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${apiId}",
    "input": "Welcome to Illucent.",
    "voice": "aurora",
    "speed": 1.0,
    "response_format": "mp3"
  }' \\
  --output tennda-speech.mp3`;
    }

    return `curl -X POST "https://ai.tennda.com/gw/v1/responses" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${apiId}",
    "input": "Hello from Illucent",
    "max_output_tokens": 2048,
    "temperature": 0.7
  }'`;
}
