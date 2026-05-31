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
    // Fires on every keystroke so the parent can react live (e.g. drive
    // a debounced query off the current query string).
    onChange?: (text: string) => void,

    // Fires when the query is "committed" — Enter or the loupe icon.
    onSearch: (data: string) => void,
}

const Search = ({ onChange, onSearch }: SearchProps) => {
    const [hovered, eventHandlers] = useHover();
    const [focused, setFocused] = useState<boolean>(false);
    const [text, setText] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setText(v);
        onChange?.(v);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") onSearch(text);
    };

    return (
        <div className={css(styles.field)}
            style={{
                height: 25,
                padding: focused ? 0 : 0.4,
                boxSizing: "border-box",
                border: focused ? "0.4px solid #ABABAB" : undefined,
            }}
        >
            <input
                className={css(styles.input)}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
            <Loupe
                fill={hovered ? "#FAFAFA" : "#ABABAB"}
                style={{ width: 20, padding: 4, cursor: "pointer", }}
                {...eventHandlers}
                onClick={() => onSearch(text)}
            />
        </div>
    );
}

enum ContentType {
    posts = "posts",
    shots = "shots",
    podcasts = "podcasts",
}

interface SearchCardProps {
    onSearch?: (
        data: String,
        tags: String[],
        content_type: ContentType[],
    ) => void,
    style?: React.CSSProperties,
}

export const SearchCard = ({ onSearch = undefined, style }: SearchCardProps) => {
    const [topics, setTopics] = useState<Tag[]>([]);
    const [contentType, setContentType] = useState<ContentType[]>([]);
    const [query, setQuery] = useState("");

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
        <div className={css(styles.substrate)} style={{ ...style }}>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Monda:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <div className={css(styles.content)}>
                <span className={css(styles.headline)}>
                    SEARCH
                </span>
                <Search
                    onChange={setQuery}
                    onSearch={(e) => console.log("submit:", e, "live:", query)}
                />
                <span className={css(styles.headline)}>
                    TOPICS
                </span>
                <ChipHolder
                    removable
                    data={topics}
                    style={{ marginBottom: topics.length !== 0 ? 6 : 0 }}
                    onRemove={(i) => { setTopics(R.remove(i, 1, topics)); }}
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
                    { label: "POSTS", isActive: true, value: "posts" },
                    { label: "SHOTS", isActive: true, value: "shots" },
                    { label: "PODCAST", isActive: true, value: "podcasts" },
                ]}
                    onUpdate={setContentType}
                />
            </div>
        </div>
    );
};
