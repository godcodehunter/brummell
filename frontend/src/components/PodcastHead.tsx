import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, css } from "aphrodite";
import { globalStyles } from "../globalStyles";
import chroma from 'chroma-js';
import Badge, { BAGE_VARIANTS } from "./Badge";
import { ChipHolder, Tag } from "./Chip";
import { AudioTrack } from "./AudioTrack";

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
    button: {
        padding: "8px 14px",
        backgroundColor: "#1E1E1F",
        fontFamily: "Monda",
        fontSize: 13,
        fontWeight: "bold",
        color: "#D4D4D4",
        letterSpacing: 0.5,
    },
});

// Waveform Canvas, volume Bar, peaks computation and speaker-range merging
// used to live here; they've moved into AudioTrack so the admin meta form
// can reuse the same widget. See components/AudioTrack.tsx.

const GuestInsert = ({ identColor, avatar, nickname, whoIs }: { avatar: string, nickname: string, identColor: string, whoIs: string }) => {
    const base = "#585858";

    return <div style={{ display: "flex", flexDirection: "column", border: `0.4px solid ${base}`, backgroundColor: String(chroma(base).alpha(0.2)), width: "400px" }}>
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                borderBottom: `0.4px solid ${base}`,
            }}
        >
            <img src={avatar} alt={nickname} style={{ borderRight: `0.4px solid ${base}` }} width={40} height={40} />
            <h3 style={{ margin: 0, fontWeight: "bold", padding: 8, color: identColor }}>{nickname}
            </h3>
        </div>
        <p style={{ margin: 0, padding: 8 }}>
            {whoIs}
        </p>
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

interface PodcastHeadProps {
    badge?: "hot" | "new",
    tags: Tag[],
    title: string,
    path: string,
    description: string,
    guests: Guest[]
    subtitles: Subtitle[],
}

export const PodcastHead: React.FC<PodcastHeadProps> = ({
    badge,
    tags,
    title,
    path,
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

    const scrollRef = useRef<HTMLDivElement | null>(null);
    // AudioTrack owns playback + waveform — we just listen for current time
    // to drive subtitle highlighting/scroll and word-level click-to-seek.
    const [currentTime, setCurrentTime] = useState(0);
    const movePlayingToRef = useRef<((t: number) => void) | null>(null);

    const movePlayingTo = (start: number) => {
        movePlayingToRef.current?.(start);
    };

    // Index of the subtitle row currently being spoken (any of its words
    // covers the playhead). -1 when nothing is playing.
    const activeRowIdx = useMemo(() => {
        return subtitles.findIndex((item) =>
            item.words.some(
                (w) =>
                    currentTime >= w.range.start &&
                    currentTime <= w.range.end,
            ),
        );
    }, [currentTime, subtitles]);

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
            <div className={css(styles.header)}>
                <div className={css(styles.title)}>{title}</div>
                <p className={css(styles.preview)}>
                    {description}
                </p>
                <ChipHolder data={tags} />
            </div>
            <AudioTrack
                src={path}
                guestColors={coloredGuests}
                subtitles={subtitles}
                onProgress={(t, _d) => setCurrentTime(t)}
                onSeekHandler={(fn) => { movePlayingToRef.current = fn; }}
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
                    const Speaker = () =>
                        <b style={{ fontWeight: "bold", color: speaker.color }}>{`${speaker.name}: `}</b>;
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
