import React, { useState, useRef } from 'react';
import { ReactComponent as Loupe } from '../resource/loupe.svg';
import { StyleSheet, css } from 'aphrodite';
import { ChipHolder, Tag } from './Chip';
import { useHover } from '../hooks';
import * as R from 'ramda';
import chroma from 'chroma-js';
import { Autocomplete } from './Autocomplete';
import { SegmentedControls } from './SegmentedControls';
import { LoadingIndicator } from './LoadingIndicator';

const styles = StyleSheet.create({
    substrate: {
        backgroundColor: "#2E2E2E",
        boxShadow: "8px 8px 0px rgba(0, 0, 0, 0.25)",
    },
    field: {
        display: "flex",  
        backgroundColor: "#3F3D3D", 
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
    content: {
        padding: 8,
    },
});

interface SearchProps {
    // Calling when search is applied, this happens when 
    // you press Enter or when you click the loupe icon
    onSearch: (data: String)=>void,
    
    // Called when `isSearchInProgress` is true and a text 
    // is changed or the cross icon is clicked
    onSuspend: ()=>void,
    
    // Must be set to true when searching and false when done
    // When true right icon is cross otherwise a loupe
    isSearchInProgress?: boolean,
}

const Search = ({onSearch, isSearchInProgress}: SearchProps) => {
    const ENTER_KEY_CODE = 13

    const [hovered, eventHandlers] = useHover();
    const [focused, setFocused] = useState<Boolean>(false);
    const [text, setText] = useState("");
    
    const handleChange = (event: any) => setText(event.target.value);
    const handleKeyDown = (event: any) => {
        if(event.keyCode === ENTER_KEY_CODE) {
            onSearch(text)
        } 
    };

    return (
        <div className={css(styles.field)} 
            style={{ 
                height: 25,
                padding: focused ? 0 : 0.4,
                boxSizing: "border-box",
                border: focused ? "0.4px solid #ABABAB" : undefined,
            }} 
            onFocus={() => setFocused(true)} 
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
        >
            <input className={css(styles.input)}/>
            {!isSearchInProgress ?
                <Loupe 
                    fill={hovered ?  "#FAFAFA": "#ABABAB"} 
                    style={{width: 20, padding: 4, cursor: "pointer",}} 
                    {...eventHandlers}
                    onClick={() => onSearch(text)}
                />
                :
                <></>
            }
        </div>
    );
}

enum ContentType {
    Posts = "Posts",
    Tweets = "Tweets",
    Talks = "Talks",
}

interface SearchCardProps {
    onSearch?: (
        data: String, 
        tags: String[], 
        content_type: ContentType[],
    ) => void,
    style?: React.CSSProperties,
}

export const SearchCard = ({onSearch = undefined, style}: SearchCardProps) => {
    const [topics, setTopics] = useState<Tag[]>([
        {label: "Electronic", color: chroma.random(), tooltip: "test1"}, 
        {label: "Soldering", color: chroma.random(), tooltip: "test2"}, 
        {label: "Fun", color: chroma.random(), tooltip: "test3"}
    ]);
    const [contentType, setContentType] = useState<ContentType[]>([]);

    const callSearch = () => {
        // onSearch("test", topics.map((i) => i.label), contentType)
    }

    return (
        <div className={css(styles.substrate)} style={{...style}}>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
            {/* <LoadingIndicator color={"#ABABAB"}/> */}
            <div className={css(styles.content)}>
                <span className={css(styles.headline)}>
                    SEARCH
                </span>
                <Search onSuspend={()=>{}} onSearch={(e)=>console.log(e)}/>
                <span className={css(styles.headline)}>
                    TOPICS
                </span>
                <ChipHolder 
                    removable
                    data={topics} 
                    style={{marginBottom: topics.length !== 0 ? 6 : 0}} 
                    onRemove={(i)=>{setTopics(R.remove(i, 1, topics));}}
                />
                <Autocomplete
                    variants={["banana", "ball", "beicon", "binary", "control", "constant"]}
                    filter={(q, e)=>{}}
                />
                <span className={css(styles.headline)}>
                    CONTENT TYPE
                </span>
                <SegmentedControls variants={[
                        {label: "Posts", isActive: true, value: "Posts"}, 
                        {label: "Tweets", isActive: true, value: "Tweets"}, 
                        {label: "Talks", isActive: true, value: "Talks"},
                    ]}
                    onUpdate={setContentType}
                />
            </div>
        </div>
    );
};
