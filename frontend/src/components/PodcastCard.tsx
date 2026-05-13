import React from "react";
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
});

const stubCategory = [
    { range: { start: 0, end: 2 }, text: "some" },
    { range: { start: 0, end: 2 }, text: "some" },
    { range: { start: 0, end: 2 }, text: "some" },
];

const speakers = [
    { image: "", name: "jon", who_is: "who" }
];

const stubSubtitles = [
    {
        speakerIdx: 0,
        words: [
            { range: { start: 0, end: 2 }, text: "some1 some2" },
            { range: { start: 0, end: 2 }, text: "some3" },
            { range: { start: 0, end: 2 }, text: "some4 some5" },
        ],
    },
];

export const PodcastCard: React.FC = () => (
    <div className={css(globalStyles.substrate, styles.card)}>
        empty
        <div style={{ display: "flex", flexDirection: "column" }}>
            {stubCategory.map((item, idx) => <div />)}
        </div>
        <div style={{ display: "flex", flexDirection: "row" }}>
            {stubSubtitles.map((item, idx) => {
                const speaker = speakers[item.speakerIdx];

                const Speaker = () => <b>{`${speaker.name}: `}</b>;
                const Words = () => (
                    <>
                        {item.words.map((w, idx) => (
                            <React.Fragment key={idx}>
                                <span style={{ backgroundColor: "red" }}>
                                    {w.text}
                                </span>
                                {idx < item.words.length - 1 && " "}
                            </React.Fragment>
                        ))}
                    </>
                );
                
                return (
                    <div>
                        <Speaker />
                        <Words />
                    </div>
                )
            })}
        </div>
    </div>
);
