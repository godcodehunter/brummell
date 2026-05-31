import React, { useMemo, useState } from 'react';
import { ReactComponent as Loupe } from '../assets/loupe.svg';
import { StyleSheet, css } from 'aphrodite';
import { gql, useQuery } from "@apollo/client";
import { ChipHolder, Tag } from './Chip';
import { useHover } from '../hooks';
import * as R from 'ramda';
import chroma from 'chroma-js';
import { Autocomplete } from './Autocomplete';
import { SegmentedControls } from './SegmentedControls';

const GET_TAGS = gql`
  query GetTags {
    getTag { label color tooltip }
  }
`;

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
    const [topics, setTopics] = useState<Tag[]>([]);
    const [contentType, setContentType] = useState<ContentType[]>([]);

    const { data: tagData } = useQuery(GET_TAGS);
    const allTags: Tag[] = useMemo(() => {
        const raw = tagData?.getTag ?? [];
        return raw.map((t: { label: string, color: string, tooltip: string }) => ({
            label: t.label,
            color: chroma(t.color),
            tooltip: t.tooltip,
        }));
    }, [tagData]);

    // Don't suggest topics that are already picked.
    const available = useMemo(
        () => allTags.filter(t => !topics.some(tp => tp.label === t.label)),
        [allTags, topics],
    );

    return (
        <div className={css(styles.substrate)} style={{...style}}>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
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
                <Autocomplete<Tag>
                    variants={available}
                    getLabel={(t) => t.label}
                    onSelect={(t) => setTopics(prev => [...prev, t])}
                    placeholder="Add a topic..."
                />
                <span className={css(styles.headline)}>
                    CONTENT TYPE
                </span>
                <SegmentedControls variants={[
                        {label: "POSTS", isActive: true, value: "Posts"},
                        {label: "SHOTS", isActive: true, value: "Tweets"},
                        {label: "PODCAST", isActive: true, value: "Talks"},
                    ]}
                    onUpdate={setContentType}
                />
            </div>
        </div>
    );
};
