import React from 'react';
import { css } from 'aphrodite';
import { Tag, ChipHolder } from './Chip';
import { ReactComponent as Clock } from '../assets/clock.svg';
import { ReactComponent as Calendar } from '../assets/calendar.svg';
import { DateTime, Duration } from 'luxon';
import { globalStyles } from '../globalStyles';
import { stringifyDuration, stringifyTime } from '../utilsTime';
import Badge, { BAGE_VARIANTS } from './Badge';

interface ArticleCardProps {
    illustration: string,
    headline: string,
    tags: Tag[],
    preview_txt: string,
    reading_time: Duration,
    created_at: DateTime,
    onOpen: () => void,
    ribbon?: "hot" | "new" | null,
    style?: any,
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
    illustration,
    headline,
    tags,
    preview_txt,
    reading_time,
    created_at,
    onOpen,
    ribbon,
    style={}
}) => {
    return (
        <>
        <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <div
            className={css(globalStyles.substrate, globalStyles.pressable)}
            style={{ position: "relative", ...style }}
            onClick={onOpen}
        >
            {ribbon && (
                <Badge
                    color={BAGE_VARIANTS[ribbon].color}
                    text={BAGE_VARIANTS[ribbon].text}
                />
            )}
            <div style={{display: "flex", flexDirection: "column"}}>
                <img
                    src={illustration}
                    alt={headline}
                    style={{width: "100%", height: 160, objectFit: "cover", display: "block"}}
                />
                <div style={{margin: 8, display: "flex", flexDirection: "column", gap: 8}}>
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
                    <ChipHolder data={tags}/>
                    <span style={{
                        fontFamily: "Roboto",
                        fontStyle: "normal",
                        fontWeight: "normal",
                        fontSize: "14px",
                        color: "#D4D4D4",
                    }}>
                    {preview_txt}
                    </span>
                    <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between"}}>
                        <div style={{display: "flex", flexDirection: "row", gap: 4}}>
                            <div style={{height: 14, width: 14}}><Clock fill={"#ABABAB"}/></div>
                            <span style={{
                                fontFamily: "Roboto",
                                fontStyle: "normal",
                                fontWeight: "normal",
                                fontSize: "12px",
                                color: "#D4D4D4",
                            }}>
                                {stringifyDuration(reading_time)}
                            </span>
                        </div>
                        <div style={{display: "flex", flexDirection: "row", gap: 4}}>
                            <div style={{height: 14, width: 14}}><Calendar fill={"#ABABAB"}/></div>
                            <span style={{
                                fontFamily: "Roboto",
                                fontStyle: "normal",
                                fontWeight: "normal",
                                fontSize: "12px",
                                color: "#D4D4D4",
                            }}>{stringifyTime(created_at)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};
