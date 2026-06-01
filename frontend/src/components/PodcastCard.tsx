import React from 'react';
import { css } from 'aphrodite';
import { Tag, ChipHolder } from './Chip';
import { ReactComponent as Calendar } from '../assets/calendar.svg';
import cassette from '../assets/cassette.png';
import { DateTime } from 'luxon';
import { globalStyles } from '../globalStyles';
import { stringifyTime } from '../utilsTime';

interface PodcastCardProps {
    headline: string,
    tags?: Tag[],
    created_at: DateTime,
    onOpen: () => void,
    style?: any,
}

// Compact feed-tile counterpart to ArticleCard. Podcasts don't carry
// per-item illustrations (yet?), so the artwork slot is filled with the
// shared cassette.png. No reading-time row either — only the publish date.
export const PodcastCard: React.FC<PodcastCardProps> = ({
    headline,
    tags = [],
    created_at,
    onOpen,
    style = {},
}) => {
    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <div
                className={css(globalStyles.substrate, globalStyles.pressable)}
                style={style}
                onClick={onOpen}
            >
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <img
                        src={cassette}
                        alt={headline}
                        // contain — preserve the cassette's aspect ratio so
                        // tape reels stay centred; no background colour so
                        // the png's transparency lets the card substrate
                        // show through.
                        style={{ width: "100%", height: 280, objectFit: "contain", display: "block" }}
                    />
                    <div style={{ margin: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{
                            fontFamily: "Monda",
                            fontStyle: "normal",
                            fontWeight: "normal",
                            fontSize: "24px",
                            lineHeight: "26px",
                            color: "#D4D4D4",
                        }}>
                            {headline}
                        </span>
                        <ChipHolder data={tags} />
                        <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end" }}>
                            <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
                                <div style={{ height: 14, width: 14 }}><Calendar fill={"#ABABAB"} /></div>
                                <span style={{
                                    fontFamily: "Roboto",
                                    fontStyle: "normal",
                                    fontWeight: "normal",
                                    fontSize: "12px",
                                    color: "#D4D4D4",
                                }}>
                                    {stringifyTime(created_at)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
