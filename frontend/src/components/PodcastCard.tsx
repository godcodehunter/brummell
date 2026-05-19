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
    subs: Subtitle[],
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

export interface Range {
    start: number,
    end: number,
}

interface Subtitle {
    speakerIdx: number,
    words: { range: Range, text: string }[]
}

interface Guest {
    image: string,
    name: string,
    whoIs: string,
    color: string,
}

interface PodcastCardProps {
    badge?: "hot" | "new",
    tags: Tag[],
    title: string,
    sound: string,
    description: string,
    guests: Guest[]
    subtitles: Subtitle[],
}

export const PodcastCard: React.FC<PodcastCardProps> = ({ 
    badge,
    tags,
    title,
    sound,
    description,
    guests,
    subtitles,
}) => {
    // Assigns each guest a random colour, once. Hue is random while
    // saturation/lightness stay fixed so the colour stays legible as text
    // (guest name, subtitle speaker) on the dark card.
    const coloredGuests = useMemo(
        () =>
            guests.map((guest) => ({
                ...guest,
                color: chroma.hsl(Math.random() * 360, 0.7, 0.65).hex(),
            })),
        [guests],
    );

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [peaks, setPeaks] = useState<Float32Array | null>(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const mergedRanges = useMemo(() => mergeSubtitleRanges(subtitles), []);

    useEffect(() => {
        let cancelled = false;
        const AC: typeof AudioContext =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
        const ctx = new AC();
        fetch(sound)
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
            const color = inRange ? coloredGuests[r.speakerIdx].color : "#555";

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

    // Index of the subtitle row currently being spoken (any of its words
    // covers the playhead). -1 when nothing is playing.
    const activeRowIdx = useMemo(() => {
        const currentTime = progress * duration;
        return subtitles.findIndex((item) =>
            item.words.some(
                (w) =>
                    currentTime >= w.range.start &&
                    currentTime <= w.range.end,
            ),
        );
    }, [progress, duration]);

    // Keep the spoken row visible inside the subtitle scroller (and only
    // that scroller — same min-nudge approach as the TreeCard active row).
    useEffect(() => {
        if (activeRowIdx < 0) return;
        const container = scrollRef.current;
        if (!container) return;
        const row = container.querySelector(
            `[data-sub-row="${activeRowIdx}"]`,
        ) as HTMLElement | null;
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        if (rowRect.top < contRect.top) {
            container.scrollTop += rowRect.top - contRect.top;
        } else if (rowRect.bottom > contRect.bottom) {
            container.scrollTop += rowRect.bottom - contRect.bottom;
        }
    }, [activeRowIdx]);

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
            {badge && (
                <Badge
                    color={BAGE_VARIANTS[badge].color}
                    text={BAGE_VARIANTS[badge].text}
                />
            )}
            <audio ref={audioRef} src={sound} />
            <div className={css(styles.header)}>
                <div className={css(styles.title)}>{title}</div>
                <p className={css(styles.preview)}>
                    {description}
                </p>
                <ChipHolder data={tags} />
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
                    flexDirection: "row",
                    background: SCROLL_AREA_BG,
                    padding: BASE_PADDING_X,
                }}>
                    {coloredGuests.map((item, idx) =>
                        <GuestInsert
                            key={idx}
                            avatar={item.image}
                            identColor={item.color}
                            nickname={item.name} 
                            whoIs={item.whoIs}
                        />)
                    }
                </div>
            </>
            <span className={css(globalStyles.headline, styles.headline)}>
                {"SUBTITLES"}
            </span>
            <div ref={scrollRef} className={css(styles.scrollArea)}>
                {subtitles.map((item, itemIdx) => {
                    const speaker = coloredGuests[item.speakerIdx];

                    const currentTime = progress * duration;
                    const Speaker = () =>
                        <b style={{ color: speaker.color }}>{`${speaker.name}: `}</b>;
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
                        <div
                            key={itemIdx}
                            data-sub-row={itemIdx}
                            className={css(styles.row)}
                        >
                            <Speaker />
                            <Words />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
