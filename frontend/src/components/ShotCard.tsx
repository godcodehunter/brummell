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
    card: {
        backgroundColor: "#2E2E2E",
        padding: "16px 24px 12px 24px",
        cursor: "default",
    },
    header: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    headerIcon: {
        fontSize: 18,
        lineHeight: 1,
    },
    headerLabel: {
        fontFamily: "Roboto",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: "#ABABAB",
    },
    body: {
        fontFamily: "Roboto",
        fontSize: 16,
        lineHeight: 1.5,
        color: "#E6E6E6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
    chips: {
        marginTop: 14,
    },
    date: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
        marginTop: 10,
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
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <div className={css(styles.card)} style={style}>
                <div className={css(styles.header)}>
                    <span aria-hidden="true" className={css(styles.headerIcon)}>🎬</span>
                    <span className={css(styles.headerLabel)}>Shot</span>
                </div>
                <div className={css(styles.body)}>{text}</div>
                <div className={css(styles.chips)}>
                    <ChipHolder data={tags} />
                </div>
                <div className={css(styles.date)}>
                    <div style={{ height: 14, width: 14 }}><Calendar fill="#ABABAB" /></div>
                    <span className={css(styles.dateText)}>{stringifyTime(created_at)}</span>
                </div>
            </div>
        </>
    );
};
