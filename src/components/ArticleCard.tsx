import React from 'react';
import { StyleSheet, css } from 'aphrodite';
import { Tag, ChipHolder } from './Chip';
import { ReactComponent as Clock } from '../resource/clock.svg';
import { ReactComponent as Calendar } from '../resource/calendar.svg';
import { DateTime, Duration } from 'luxon';

const styles = StyleSheet.create({
    substrate: {
        backgroundColor: "#2E2E2E",
        boxShadow: "8px 8px 0px rgba(0, 0, 0, 0.25)",
        cursor: "pointer",
    },
});

interface ArticleCardProps {
    illustration: string,
    headline: string,
    tags: Tag[], 
    reading_time: Duration, 
    publication_time: DateTime,
    onOpen: () => void,
    style: any,
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
    illustration, 
    headline, 
    tags,
    reading_time,
    publication_time,
    onOpen,
    style={}
}) => {
    const getCalendarFormat = (myDateTime: DateTime, now: DateTime): string =>{
        var diff = myDateTime.diff(now.startOf("day"), 'days').as('days');
        return diff < -6 ? 'sameElse' :
            diff < -1 ? 'lastWeek' :
            diff < 0 ? 'lastDay' :
            diff < 1 ? 'sameDay' :
            diff < 2 ? 'nextDay' :
            diff < 7 ? 'nextWeek' : 'sameElse';
    };

    const stringifyPublicationTime = (timestamp: DateTime) => {
        const ts = timestamp.toLocal().setLocale("en");
        const cur = DateTime.local();
        const human_readable = getCalendarFormat(ts, cur);
        
        if(human_readable === "sameDay"){
            return `today at ${ts.toFormat("T")}`;
        }
        if(human_readable === "lastDay"){
            return `yesterday at ${ts.toFormat("T")}`;
        }
        
        return ts.toFormat("DD T");
    };

    const stringifyReadingTime = (duration: Duration): string => {
        const dur = duration.shiftTo('hours', 'minutes');
        let ret: string = "";
        [[dur.hours, "h"],[dur.minutes, "min"]].map((i) => {
            if(i[0].valueOf() !== 0){
                if(ret.length > 0) {
                    ret += " ";
                }
                ret += `${i[0]} ${i[1]}`;
            }
        });
        return ret+=" read";
    };
    
    return (
        <>
        <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
        <div className={css(styles.substrate)} style={{...style}} onClick={onOpen}>
            <div style={{display: "flex", flexDirection: "column"}}>
                <div style={{backgroundColor: "red", width: "100%", height: 160}}/>
                <div style={{margin: 8, display: "flex", flexDirection: "column", gap: 8}}>
                <span style={{
                        fontFamily: "Monda",
                        fontStyle: "normal",
                        fontWeight: "normal",
                        fontSize: "24px",
                        lineHeight: "26px",
                        color: "#D4D4D4",
                        }}>
                    Simple digital clock
                </span>
                    <ChipHolder data={tags}/>
                    <span style={{
                        fontFamily: "Roboto",
                        fontStyle: "normal",
                        fontWeight: "normal",
                        fontSize: "14px",
                        // lineHeight: "14px",
                        color: "#D4D4D4",
                    }}>
                    In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.
                    </span>
                    <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between"}}>
                        <div style={{display: "flex", flexDirection: "row", gap: 4}}>
                            <div style={{height: 14, width: 14}}><Clock fill={"#ABABAB"}/></div>
                            <span style={{
                                fontFamily: "Roboto",
                                fontStyle: "normal",
                                fontWeight: "normal",
                                fontSize: "12px",
                                // lineHeight: "14px",
                                color: "#D4D4D4",
                            }}>
                                {stringifyReadingTime(reading_time)}
                            </span>
                        </div>
                        <div style={{display: "flex", flexDirection: "row", gap: 4}}>
                            <div style={{height: 14, width: 14}}><Calendar fill={"#ABABAB"}/></div>
                            <span style={{
                                fontFamily: "Roboto",
                                fontStyle: "normal",
                                fontWeight: "normal",
                                fontSize: "12px",
                                // lineHeight: "14px",
                                color: "#D4D4D4",
                            }}>{stringifyPublicationTime(publication_time)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};
