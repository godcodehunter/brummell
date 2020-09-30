import React, { useState} from 'react';
import { ReactComponent as Arrow } from '../resource/arrow.svg';
import { ReactComponent as Loupe } from '../resource/loupe.svg';
import { StyleSheet, css } from 'aphrodite';
import { ChipHolder } from './Chip';
import { useHover } from './hooks';
import * as R from 'ramda';
import chroma from 'chroma-js';

const styles = StyleSheet.create({
    substrate: {
        backgroundColor: "#2E2E2E",
        boxShadow: "8px 8px 0px rgba(0, 0, 0, 0.25)",
    },
    field: {
        display: "flex",  
        // alignItems: "center", 
        border: "0.4px solid #ABABAB", 
        backgroundColor: "#3F3D3D",
        height: 28,
    },
    input: {
        flexGrow: 1,
        backgroundColor: "rgba(0, 0, 0, 0)", 
        border: "none",
        paddingLeft: 5,
        ':hover': {
            outline: "none",
        },
        ':focus': {
            outline: "none",
        }
    },
    headline: {
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: "bold",
        fontSize: "12px",
        lineHeight: "26px",
        color: "#D4D4D4",
        alignItems: "center",
    },
    delimiter: {
        borderLeft: "0.4px solid #ABABAB", 
        marginTop: 2, 
        marginBottom: 2,
    },
    content: {
        padding: 8,
    },
});

const Search = ({}) => {
    const [hovered, eventHandlers] = useHover();

    return (
        <div className={css(styles.field)}>
            <input className={css(styles.input)}/>
            <div className={css(styles.delimiter)}/>
            <Loupe fill={hovered ?  "#FAFAFA": "#ABABAB"} style={{width: 20, padding: 4, cursor: "pointer",}} {...eventHandlers}/>
        </div>
    );
}

const Autocomplete = ({}) => {
    const [hovered, eventHandlers] = useHover();

    return (
        <div className={css(styles.field)}>
            <input className={css(styles.input)}/>
            <Arrow 
                style={{display: "block", margin: "auto", height: "100%", width: 28, cursor: "pointer",}}
                stroke={hovered ?  "#FAFAFA": "#ABABAB"}
                {...eventHandlers}
            />
        </div>
    );
};

const segmentedControls = StyleSheet.create({
    container: {
        display: "flex", 
        height: 25,
    },
    segment: {
        boxSizing: "border-box",
        textTransform: "uppercase",
        padding: "5px 8px 4px",
        marginTop: "-1px",
        fontSize: "10px",
        height: "25px",
        lineHeight: "1.5em",
        border: "1px solid #4A4A4A",
        cursor: "pointer",
    },
});

const SegmentedControls = ({variants}) => {
    const [selected, setSelected] = useState([]);

    return (
        <div className={css(segmentedControls.container)}>
            {
                variants.map((e, i)=>(
                    <div
                        key={i}
                        className={css(segmentedControls.segment)}
                        style={{backgroundColor: selected.includes(e) ? "#1E1E1F" : undefined,}}
                        onClick={() => {
                            if(!selected.includes(e)) {
                                setSelected([...selected, e])
                            } else {
                                setSelected(ex => ex.filter(n => n !== e))
                            }
                        }}
                    >
                        {e}
                    </div>
                ))
            }
        </div>
    );
};

export const SearchCard = ({onSearch = undefined, style}) => {
    const [chips, setChips] = useState([
        {label: "Electronic", color: chroma.random(), tooltip: "test1"}, 
        {label: "Soldering", color: chroma.random(), tooltip: "test2"}, 
        {label: "Fun", color: chroma.random(), tooltip: "test3"}
    ]);

    return (
        <div className={css(styles.substrate)} style={{...style}}>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
            <div className={css(styles.content)}>
                <span className={css(styles.headline)}>
                    SEARCH
                </span>
                <Search/>
                <span className={css(styles.headline)}>
                    TOPICS
                </span>
                <ChipHolder 
                    removable
                    data={chips} 
                    style={{marginBottom: chips.length !== 0 ? 6 : 0}} 
                    onRemove={(i)=>{setChips(R.remove(i, 1, chips));}}
                />
                <Autocomplete/>
                <span className={css(styles.headline)}>
                    CONTENT TYPE
                </span>
                <SegmentedControls variants={["Posts","Tweets","Talks"]}/>
            </div>
        </div>
    );
};
