import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, css } from "aphrodite";
import { globalStyles } from "../globalStyles";
import chroma from 'chroma-js';
import Badge, { BAGE_VARIANTS } from "./Badge";
import { ChipHolder, Tag } from "./Chip";

const SCROLL_AREA_BG = "#1E1E1F";
const BASE_PADDING_X = 12;
const ROW_HEIGHT = 24;

const styles = StyleSheet.create({
    header: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        // Left padding clears the absolutely-positioned Badge ribbon so the
        // whole header (title, intro, tags) shares one consistent edge.
        paddingLeft: 120,
        paddingRight: BASE_PADDING_X,
        paddingTop: 15,
        paddingBottom: 15,
    },
    title: {
        fontFamily: "Monda",
        fontSize: 48,
        fontWeight: "bold",
        lineHeight: 1.05,
        color: "#FFFFFF",
        margin: 0,
        textShadow: "0 2px 12px rgba(0,0,0,0.6)",
    },
    preview: {
        fontFamily: "Roboto",
        fontStyle: "italic",
        fontWeight: "normal",
        fontSize: 16,
        lineHeight: 1.5,
        color: "#E6E6E6",
        margin: 0,
        maxWidth: "75%",
    },
    headline: {
        marginLeft: 8,
    },
    row: {
        paddingLeft: BASE_PADDING_X,
        paddingRight: BASE_PADDING_X,
        lineHeight: `${ROW_HEIGHT}px`,
    },
    word: {
        cursor: "pointer",
        // Same hover/active palette as the TreeCard rows on the article page.
        transition: "background-color 80ms ease-out",
        ":hover": {
            backgroundColor: "#3A3A3A",
        },
    },
    wordPlaying: {
        textTransform: "uppercase",
    },
    scrollArea: {
        backgroundColor: SCROLL_AREA_BG,
        flexGrow: 0,
        flexShrink: 1,
        flexBasis: "auto",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        paddingTop: 8,
        paddingBottom: 8,
    },
    canvas: {
        display: "block",
        width: "100%",
        height: 160,
        cursor: "pointer",
    },
});

type DrawFn = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
) => void;

interface CanvasProps {
    draw: DrawFn;
    onSeek?: (fraction: number) => void;
    className?: string;
}

const Canvas: React.FC<CanvasProps> = ({ draw, onSeek, className }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawRef = useRef(draw);
    drawRef.current = draw;
    const onSeekRef = useRef(onSeek);
    onSeekRef.current = onSeek;
    const renderRef = useRef<() => void>(() => { });
    const draggingRef = useRef(false);

    const fractionFromEvent = (
        e: React.PointerEvent<HTMLCanvasElement>,
    ): number => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        return Math.max(0, Math.min(1, x / rect.width));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!onSeekRef.current) return;
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeekRef.current(fractionFromEvent(e));
    };
    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!draggingRef.current || !onSeekRef.current) return;
        onSeekRef.current(fractionFromEvent(e));
    };
    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const render = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const cssWidth = Math.max(1, Math.floor(rect.width));
            const cssHeight = Math.max(1, Math.floor(rect.height));
            const pixelWidth = Math.floor(cssWidth * dpr);
            const pixelHeight = Math.floor(cssHeight * dpr);

            if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssWidth, cssHeight);
            drawRef.current(ctx, cssWidth, cssHeight);
        };
        renderRef.current = render;

        render();

        const resizeObserver = new ResizeObserver(render);
        resizeObserver.observe(canvas);

        const mql = window.matchMedia(
            `(resolution: ${window.devicePixelRatio}dppx)`,
        );
        mql.addEventListener("change", render);

        return () => {
            resizeObserver.disconnect();
            mql.removeEventListener("change", render);
        };
    }, []);

    useEffect(() => {
        renderRef.current();
    }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        />
    );
};

const AUDIO_SRC =
    "https://2526926d-44a8-4f33-b0fb-96fd1117a13a.mdnplay.dev/shared-assets/audio/t-rex-roar.mp3";
const PEAKS_BUCKETS = 2000;

const computePeaks = (buffer: AudioBuffer, buckets: number): Float32Array => {
    const channel = buffer.getChannelData(0);
    const samplesPerBucket = Math.max(1, Math.floor(channel.length / buckets));
    const peaks = new Float32Array(buckets);
    for (let i = 0; i < buckets; i++) {
        const start = i * samplesPerBucket;
        const end = Math.min(start + samplesPerBucket, channel.length);
        let max = 0;
        for (let j = start; j < end; j++) {
            const v = Math.abs(channel[j]);
            if (v > max) max = v;
        }
        peaks[i] = max;
    }
    return peaks;
};

type SpeakerRange = { start: number; end: number; speakerIdx: number };

const mergeSubtitleRanges = (
    subs: typeof stubSubtitles,
): SpeakerRange[] => {
    const all: SpeakerRange[] = [];
    for (const sub of subs) {
        for (const w of sub.words) {
            all.push({
                start: w.range.start,
                end: w.range.end,
                speakerIdx: sub.speakerIdx,
            });
        }
    }
    all.sort((a, b) => a.start - b.start);

    const merged: SpeakerRange[] = [];
    for (const r of all) {
        const last = merged[merged.length - 1];
        if (last && last.speakerIdx === r.speakerIdx && r.start <= last.end) {
            last.end = Math.max(last.end, r.end);
        } else {
            merged.push({ ...r });
        }
    }
    return merged;
};

const stubCategory = [
    { range: { start: 0, end: 2 }, text: "Category1" },
    { range: { start: 0, end: 2 }, text: "Category2" },
    { range: { start: 0, end: 2 }, text: "Category3" },
];

const TAG_COLORS = ["#7AB8FF", "#FFB87A", "#7AFFB8"];

const podcastTags: Tag[] = stubCategory.map((c, i) => ({
    label: c.text,
    color: chroma(TAG_COLORS[i % TAG_COLORS.length]),
    tooltip: c.text,
}));

const speakers = [
    { avatar: "", nickname: "jon", whoIs: "who", color: "green" },
    { avatar: "", nickname: "carl", whoIs: "who", color: "red" }
];

const stubSubtitles = [
    {
        speakerIdx: 0,
        words: [
            { range: { start: 0, end: 0.2 }, text: "some1 some2" },
            { range: { start: 0.4, end: 0.6 }, text: "some3" },
            { range: { start: 0.8, end: 1.2 }, text: "some4 some5" },
        ],
    },
    {
        speakerIdx: 1,
        words: [
            { range: { start: 1.3, end: 1.5 }, text: "some1 some2" },
            { range: { start: 1.6, end: 1.8 }, text: "some3" },
            { range: { start: 1.9, end: 2.1 }, text: "some4 some5" },
        ],
    },
    {
        speakerIdx: 0,
        words: [
            { range: { start: 0, end: 0.2 }, text: "some1 some2" },
            { range: { start: 0.4, end: 0.6 }, text: "some3" },
            { range: { start: 0.8, end: 1.2 }, text: "some4 some5" },
        ],
    },
    {
        speakerIdx: 1,
        words: [
            { range: { start: 1.3, end: 1.5 }, text: "some1 some2" },
            { range: { start: 1.6, end: 1.8 }, text: "some3" },
            { range: { start: 1.9, end: 2.1 }, text: "some4 some5" },
        ],
    },
];

const GuestInsert = ({ identColor, avatar, nickname, whoIs }: { avatar: string, nickname: string, identColor: string, whoIs: string }) => {
    const base = "#585858";

    return <div style={{ display: "flex", alignSelf: "flex-start", border: `0.4px solid ${base}`, backgroundColor: String(chroma(base).alpha(0.2)) }}>
        <img src={avatar} alt="Boris" width={80} height={80} />
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                borderLeft: `0.4px solid ${base}`,
            }}
        >
            <h3 style={{ margin: 0, padding: 8, borderBottom: `0.4px solid ${base}`, color: identColor }}>{nickname}
            </h3>
            <p style={{ margin: 0, padding: 8 }}>
                {whoIs}
            </p>
        </div>
    </div>
};

export const PodcastCard: React.FC = () => {
    const bage = true;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [peaks, setPeaks] = useState<Float32Array | null>(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const mergedRanges = useMemo(() => mergeSubtitleRanges(stubSubtitles), []);

    useEffect(() => {
        let cancelled = false;
        const AC: typeof AudioContext =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
        const ctx = new AC();
        fetch(AUDIO_SRC)
            .then((r) => r.arrayBuffer())
            .then((buf) => ctx.decodeAudioData(buf))
            .then((decoded) => {
                if (cancelled) return;
                setPeaks(computePeaks(decoded, PEAKS_BUCKETS));
            })
            .catch(() => { })
            .finally(() => ctx.close());
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const update = () => {
            const d = audio.duration;
            if (isFinite(d) && d > 0) setDuration(d);
            setProgress(d > 0 && isFinite(d) ? audio.currentTime / d : 0);
        };
        update();
        audio.addEventListener("loadedmetadata", update);
        audio.addEventListener("durationchange", update);
        audio.addEventListener("timeupdate", update);
        audio.addEventListener("seeked", update);
        audio.addEventListener("ended", update);
        return () => {
            audio.removeEventListener("loadedmetadata", update);
            audio.removeEventListener("durationchange", update);
            audio.removeEventListener("timeupdate", update);
            audio.removeEventListener("seeked", update);
            audio.removeEventListener("ended", update);
        };
    }, []);

    const draw: DrawFn = (ctx, width, height) => {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, width, height);
        if (!peaks || duration <= 0) return;

        const mid = height / 2;
        const cursorX = width * progress;
        let rIdx = 0;
        for (let x = 0; x < width; x++) {
            const t = (x / width) * duration;
            while (
                rIdx < mergedRanges.length &&
                mergedRanges[rIdx].end < t
            ) {
                rIdx++;
            }
            const r = mergedRanges[rIdx];
            const inRange = r && r.start <= t && t <= r.end;
            const color = inRange ? speakers[r.speakerIdx].color : "#555";

            const i = Math.min(
                peaks.length - 1,
                Math.floor((x / width) * peaks.length),
            );
            const h = peaks[i] * mid * 0.9;
            ctx.fillStyle = color;
            ctx.fillRect(x, mid - h, 1, h * 2);
        }

        ctx.fillStyle = "#fff";
        ctx.fillRect(cursorX, 0, 1, height);
    };

    const movePlayingTo = (start: number) => {
        const audio = audioRef.current;
        if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
        const clamped = Math.max(0, Math.min(start, audio.duration));
        audio.currentTime = clamped;
        setProgress(clamped / audio.duration);
    };

    return (
        <div
            className={css(globalStyles.substrate)}
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                flex: "0 1 auto",
                maxHeight: "100%",
                minHeight: 0,
            }}
        >
            {bage && (
                <Badge
                    color={BAGE_VARIANTS["hot"].color}
                    text={BAGE_VARIANTS["hot"].text}
                />
            )}
            <audio ref={audioRef} src={AUDIO_SRC} />
            <div className={css(styles.header)}>
                <div className={css(styles.title)}>{"Title"}</div>
                <p className={css(styles.preview)}>
                    {"A short overview of the piece — the kind of lead-in you'd see hovering over the card on the main page. Two or three sentences setting up what the article covers and why it matters."}
                </p>
                <ChipHolder data={podcastTags} />
            </div>
            <Canvas
                draw={draw}
                onSeek={(fraction) => {
                    const audio = audioRef.current;
                    if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
                    audio.currentTime = fraction * audio.duration;
                    setProgress(fraction);
                }}
                className={css(styles.canvas)}
            />
            <>
                <span className={css(globalStyles.headline, styles.headline)}>
                    {"GUESTS"}
                </span>
                <div style={{
                    display: "flex",
                    gap: "10px",
                    flexDirection: "column",
                    background: SCROLL_AREA_BG,
                    padding: BASE_PADDING_X,
                }}>
                    {speakers.map((item) =>
                        <GuestInsert 
                            avatar={item.avatar}
                            identColor={item.color}
                            nickname={item.nickname} 
                            whoIs={item.whoIs}
                        />)
                    }
                </div>
            </>
            <span className={css(globalStyles.headline, styles.headline)}>
                {"SUBTITLES"}
            </span>
            <div className={css(styles.scrollArea)}>
                {stubSubtitles.map((item) => {
                    const speaker = speakers[item.speakerIdx];

                    const currentTime = progress * duration;
                    const Speaker = () =>
                        <b style={{ color: speaker.color }}>{`${speaker.nickname}: `}</b>;
                    const Words = () => (
                        <>
                            {item.words.map((w, idx) => {
                                const isPlaying =
                                    currentTime >= w.range.start &&
                                    currentTime <= w.range.end;
                                return (
                                    <React.Fragment key={idx}>
                                        <span
                                            className={css(
                                                styles.word,
                                                isPlaying && styles.wordPlaying,
                                            )}
                                            onClick={() => movePlayingTo(w.range.start)}
                                        >
                                            {w.text}
                                        </span>
                                        {idx < item.words.length - 1 && " "}
                                    </React.Fragment>
                                );
                            })}
                        </>
                    );

                    return (
                        <div className={css(styles.row)}>
                            <Speaker />
                            <Words />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
