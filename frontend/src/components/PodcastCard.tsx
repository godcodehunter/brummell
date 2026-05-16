import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, css } from "aphrodite";
import { globalStyles } from "../globalStyles";

const styles = StyleSheet.create({
    card: {
        // display: "flex",
        // alignItems: "center",
        // justifyContent: "center",
        // padding: "60px 24px",
        // minHeight: 160,
        // fontFamily: "Monda",
        // fontSize: 14,
        // letterSpacing: 4,
        // textTransform: "uppercase",
        // color: "#ABABAB",
    },
    canvas: {
        display: "block",
        width: "100%",
        height: 160,
        touchAction: "none",
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

const speakers = [
    { image: "", name: "jon", who_is: "who", color: "green" },
    { image: "", name: "carl", who_is: "who", color: "red" }
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
];

export const PodcastCard: React.FC = () => {
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

    return (
        <div className={css(globalStyles.substrate, styles.card)}>
            <audio ref={audioRef} controls src={AUDIO_SRC} />
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
            <div style={{ display: "flex", flexDirection: "column" }}>
                {stubCategory.map((item) => <div>{item.text}</div>)}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
                {stubSubtitles.map((item) => {
                    const speaker = speakers[item.speakerIdx];

                    const currentTime = progress * duration;
                    const Speaker = () => <b>{`${speaker.name}: `}</b>;
                    const Words = () => (
                        <>
                            {item.words.map((w, idx) => {
                                const isPlaying =
                                    currentTime >= w.range.start &&
                                    currentTime <= w.range.end;
                                return (
                                    <React.Fragment key={idx}>
                                        <span
                                            style={{
                                                backgroundColor: "red",
                                                textTransform: isPlaying
                                                    ? "uppercase"
                                                    : undefined,
                                            }}
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
                        <div>
                            <Speaker />
                            <Words />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
