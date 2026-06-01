import React from 'react';
import { StyleSheet, css } from 'aphrodite';
import { Tag, ChipHolder } from './Chip';
import { ReactComponent as Calendar } from '../assets/calendar.svg';
import { DateTime } from 'luxon';
import { stringifyTime } from '../utilsTime';

interface ShotCardProps {
    text: string,
    tags?: Tag[],
    created_at: DateTime,
    style?: any,
}

const styles = StyleSheet.create({
    // Same blocky palette as ArticleCard/PodcastCard but without the
    // pressable shadow — the absence of the heavy 8px drop-shadow is the
    // primary "this isn't clickable" signal.
    card: {
        position: "relative",
        backgroundColor: "#2E2E2E",
        padding: "20px 24px 12px 24px",
        cursor: "default",
    },
    // Big serif quotation marks bracket the text — turn the whole card
    // into a "quote/pull-out" rather than a link card. Hand-positioned in
    // the corners so the body text reads as the quoted content itself.
    quoteOpen: {
        position: "absolute",
        top: -2,
        left: 6,
        fontFamily: "Monda",
        fontSize: 64,
        lineHeight: 1,
        color: "#4A4A4A",
        userSelect: "none",
        pointerEvents: "none",
    },
    quoteClose: {
        position: "absolute",
        bottom: -28,
        right: 10,
        fontFamily: "Monda",
        fontSize: 64,
        lineHeight: 1,
        color: "#4A4A4A",
        userSelect: "none",
        pointerEvents: "none",
    },
    body: {
        position: "relative",
        fontFamily: "Roboto",
        fontStyle: "italic",
        fontSize: 16,
        lineHeight: 1.5,
        color: "#E6E6E6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
    footer: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 14,
        gap: 8,
    },
    chips: {
        flex: 1,
        minWidth: 0,
    },
    date: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
    },
    dateText: {
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: "normal",
        fontSize: 12,
        color: "#ABABAB",
    },
});

export const ShotCard: React.FC<ShotCardProps> = ({ text, tags = [], created_at, style = {} }) => {
    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <div className={css(styles.card)} style={style}>
                <span aria-hidden="true" className={css(styles.quoteOpen)}>«</span>
                <span aria-hidden="true" className={css(styles.quoteClose)}>»</span>
                <div className={css(styles.body)}>{text}</div>
                <div className={css(styles.footer)}>
                    <div className={css(styles.chips)}>
                        <ChipHolder data={tags} />
                    </div>
                    <div className={css(styles.date)}>
                        <div style={{ height: 14, width: 14 }}><Calendar fill="#ABABAB" /></div>
                        <span className={css(styles.dateText)}>{stringifyTime(created_at)}</span>
                    </div>
                </div>
            </div>
        </>
    );
};
