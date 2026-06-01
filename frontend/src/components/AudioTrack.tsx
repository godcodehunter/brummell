import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, css } from "aphrodite";
import chroma from "chroma-js";
import { globalStyles } from "../globalStyles";

// Self-contained audio waveform + transport. Pulled out of PodcastHead so
// the admin podcast-meta form can reuse the same widget. Both consumers
// share the same data shapes (Guest/Subtitle) — the waveform colours each
// peak by which speaker owns that timestamp.

const TRACK_BG = "#1E1E1F";

const styles = StyleSheet.create({
    canvas: {
        display: "block",
        width: "100%",
        height: 160,
        cursor: "pointer",
    },
    controls: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 10,
        padding: 10,
    },
    button: {
        padding: "8px 14px",
        backgroundColor: TRACK_BG,
        fontFamily: "Monda",
        fontSize: 13,
        fontWeight: "bold",
        color: "#D4D4D4",
        letterSpacing: 0.5,
    },
    volumeLabel: {
        fontWeight: "bold",
        fontFamily: "Roboto",
        fontSize: 12,
        color: "#ABABAB",
        letterSpacing: 0.5,
        textTransform: "uppercase",
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

    const fractionFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): number => {
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
        const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        mql.addEventListener("change", render);
        return () => {
            resizeObserver.disconnect();
            mql.removeEventListener("change", render);
        };
    }, []);

    useEffect(() => { renderRef.current(); }, [draw]);

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

interface BarProps {
    value: number;
    onChange: (value: number) => void;
    minWidth?: number;
}

const Bar: React.FC<BarProps> = ({ value, onChange, minWidth = 120 }) => {
    const draggingRef = useRef(false);
    const fractionFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };
    const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(fractionFromEvent(e));
    };
    const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        onChange(fractionFromEvent(e));
    };
    const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };
    const filled = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
    return (
        <div
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            style={{
                flex: `0 0 ${minWidth}px`,
                minWidth,
                height: 6,
                alignSelf: "center",
                position: "relative",
                backgroundColor: TRACK_BG,
                cursor: "pointer",
                touchAction: "none",
            }}
        >
            <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: filled, backgroundColor: "#D4D4D4",
            }} />
        </div>
    );
};

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

export interface AudioRange {
    start: number;
    end: number;
}

export interface AudioSubtitle {
    speakerIdx: number;
    words: { range: AudioRange, text: string }[];
}

export interface AudioGuestColor {
    color: string;
}

type SpeakerRange = { start: number; end: number; speakerIdx: number };

const mergeSubtitleRanges = (subs: AudioSubtitle[]): SpeakerRange[] => {
    const all: SpeakerRange[] = [];
    for (const sub of subs) {
        for (const w of sub.words) {
            all.push({ start: w.range.start, end: w.range.end, speakerIdx: sub.speakerIdx });
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

export interface AudioTrackProps {
    src: string;
    // Per-speaker tints used to colour the waveform inside the speaker's
    // active ranges. Index matches `subtitle.speakerIdx`. Empty/missing
    // entries fall back to a neutral grey.
    guestColors?: AudioGuestColor[];
    subtitles?: AudioSubtitle[];
    // Fires when the audio's playhead advances. Lets the parent drive
    // dependent UI (e.g. subtitle scroller highlighting) without owning
    // playback state itself.
    onProgress?: (currentTime: number, duration: number) => void;
    onPlayingChange?: (playing: boolean) => void;
    // Called once on mount with a function that seeks the audio to a given
    // time in seconds — gives the parent an imperative handle (e.g. for
    // click-a-word-jump-to-time) without lifting all playback state out.
    onSeekHandler?: (seekTo: (seconds: number) => void) => void;
}

// Auto-assigns a stable colour per speaker index when the caller doesn't
// pass guestColors. Random hue so multiple instances in the same view
// don't all look alike.
const fallbackColor = () => chroma.hsl(Math.random() * 360, 0.7, 0.65).hex();

export const AudioTrack: React.FC<AudioTrackProps> = ({
    src,
    guestColors,
    subtitles = [],
    onProgress,
    onPlayingChange,
    onSeekHandler,
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [peaks, setPeaks] = useState<Float32Array | null>(null);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);

    const effectiveColors = useMemo<string[]>(() => {
        const n = Math.max(1, ...subtitles.map(s => s.speakerIdx + 1));
        return Array.from({ length: n }, (_, i) => guestColors?.[i]?.color ?? fallbackColor());
    }, [guestColors, subtitles]);

    const mergedRanges = useMemo(() => mergeSubtitleRanges(subtitles), [subtitles]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) audio.volume = volume;
    }, [volume]);

    // Decode audio once per src so we can show a static waveform. The
    // AudioContext is closed right after to release native resources.
    useEffect(() => {
        if (!src) {
            setPeaks(null);
            return;
        }
        let cancelled = false;
        const AC: typeof AudioContext =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        fetch(src)
            .then(r => r.arrayBuffer())
            .then(buf => ctx.decodeAudioData(buf))
            .then(decoded => {
                if (cancelled) return;
                setPeaks(computePeaks(decoded, PEAKS_BUCKETS));
            })
            .catch(() => { })
            .finally(() => ctx.close());
        return () => { cancelled = true; };
    }, [src]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const update = () => {
            const d = audio.duration;
            if (isFinite(d) && d > 0) setDuration(d);
            const p = d > 0 && isFinite(d) ? audio.currentTime / d : 0;
            setProgress(p);
            onProgress?.(audio.currentTime, isFinite(d) ? d : 0);
        };
        const syncPlaying = () => {
            setIsPlaying(!audio.paused);
            onPlayingChange?.(!audio.paused);
        };
        update();
        syncPlaying();
        audio.addEventListener("loadedmetadata", update);
        audio.addEventListener("durationchange", update);
        audio.addEventListener("timeupdate", update);
        audio.addEventListener("seeked", update);
        audio.addEventListener("ended", update);
        audio.addEventListener("play", syncPlaying);
        audio.addEventListener("pause", syncPlaying);
        audio.addEventListener("ended", syncPlaying);
        return () => {
            audio.removeEventListener("loadedmetadata", update);
            audio.removeEventListener("durationchange", update);
            audio.removeEventListener("timeupdate", update);
            audio.removeEventListener("seeked", update);
            audio.removeEventListener("ended", update);
            audio.removeEventListener("play", syncPlaying);
            audio.removeEventListener("pause", syncPlaying);
            audio.removeEventListener("ended", syncPlaying);
        };
    }, [src]);

    const draw: DrawFn = (ctx, width, height) => {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, width, height);
        if (!peaks || duration <= 0) return;

        const mid = height / 2;
        const cursorX = width * progress;
        let rIdx = 0;
        for (let x = 0; x < width; x++) {
            const t = (x / width) * duration;
            while (rIdx < mergedRanges.length && mergedRanges[rIdx].end < t) rIdx++;
            const r = mergedRanges[rIdx];
            const inRange = r && r.start <= t && t <= r.end;
            const color = inRange ? (effectiveColors[r.speakerIdx] ?? "#555") : "#555";
            const i = Math.min(peaks.length - 1, Math.floor((x / width) * peaks.length));
            const h = peaks[i] * mid * 0.9;
            ctx.fillStyle = color;
            ctx.fillRect(x, mid - h, 1, h * 2);
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(cursorX, 0, 1, height);
    };

    const togglePlayback = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) audio.play().catch(() => { }); else audio.pause();
    };

    const seekBy = (deltaSeconds: number) => {
        const audio = audioRef.current;
        if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
        const clamped = Math.max(0, Math.min(audio.currentTime + deltaSeconds, audio.duration));
        audio.currentTime = clamped;
        setProgress(clamped / audio.duration);
    };

    // Imperative seek-to-time exposed via onSeekHandler — fresh closure each
    // render captures the latest audioRef; the handler ref dance keeps the
    // parent's stored function pointing at this latest version.
    const seekToRef = useRef<(t: number) => void>(() => { });
    seekToRef.current = (seconds: number) => {
        const audio = audioRef.current;
        if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
        const clamped = Math.max(0, Math.min(seconds, audio.duration));
        audio.currentTime = clamped;
        setProgress(clamped / audio.duration);
    };
    useEffect(() => {
        onSeekHandler?.((t: number) => seekToRef.current(t));
    }, [onSeekHandler]);

    return (
        <>
            <audio ref={audioRef} src={src} />
            <Canvas
                draw={draw}
                onSeek={fraction => {
                    const audio = audioRef.current;
                    if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
                    audio.currentTime = fraction * audio.duration;
                    setProgress(fraction);
                }}
                className={css(styles.canvas)}
            />
            <div className={css(styles.controls)}>
                <div className={css(globalStyles.pressable, styles.button)} onClick={() => seekBy(-10)}>
                    <span>{"« 10s"}</span>
                </div>
                <div className={css(globalStyles.pressable, styles.button)} onClick={togglePlayback}>
                    <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
                </div>
                <div className={css(globalStyles.pressable, styles.button)} onClick={() => seekBy(10)}>
                    <span>{"10s »"}</span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "row", gap: 10 }}>
                    <span className={css(styles.volumeLabel)}>{"VOLUME"}</span>
                    <Bar value={volume} onChange={setVolume} minWidth={120} />
                </div>
            </div>
        </>
    );
};
