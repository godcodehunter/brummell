import React, { useMemo, useState } from 'react';
import { ReactComponent as Loupe } from '../assets/loupe.svg';
import { CloseInSquare } from '../assets/icons';
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
    // Fully controlled input value — owner state lives in the parent.
    value: string,
    onChange: (text: string) => void,

    // Fires when the query is "committed" — Enter key or loupe icon click.
    onSubmit: () => void,

    // When true the trailing icon flips to a cross and clicking it calls
    // onReset. Reflects whether the parent is showing search results.
    isActive?: boolean,
    onReset?: () => void,
}

const Search = ({ value, onChange, onSubmit, isActive, onReset }: SearchProps) => {
    const [hovered, eventHandlers] = useHover();
    const [focused, setFocused] = useState<boolean>(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") onSubmit();
    };

    const iconColor = hovered ? "#FAFAFA" : "#ABABAB";
    const onIconClick = isActive ? onReset : onSubmit;

    return (
        <div className={css(styles.field)}
            style={{
                height: 25,
                padding: focused ? 0 : 0.4,
                boxSizing: "border-box",
                border: focused ? "0.4px solid #ABABAB" : undefined,
                alignItems: "center",
            }}
        >
            <input
                className={css(styles.input)}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
            {isActive ? (
                <CloseInSquare
                    style={{
                        width: 19,
                        height: 19,
                        marginRight: 3,
                        cursor: "pointer",
                        flexShrink: 0,
                    }}
                    fill={iconColor}
                    {...eventHandlers}
                    onClick={onIconClick}
                />
            ) : (
                <Loupe
                    fill={iconColor}
                    style={{ width: 20, padding: 4, cursor: "pointer" }}
                    {...eventHandlers}
                    onClick={onIconClick}
                />
            )}
        </div>
    );
}

enum ContentType {
    article = "article",
    shot = "shot",
    podcast = "podcast",
}

interface SearchCardProps {
    onSearch?: (
        query: string,
        tagLabels: string[],
        contentTypes: ContentType[],
    ) => void,
    onReset?: () => void,
    isSearchActive?: boolean,
    style?: React.CSSProperties,
}

export const SearchCard = ({
    onSearch,
    onReset,
    isSearchActive = false,
    style,
}: SearchCardProps) => {
    const [topics, setTopics] = useState<Tag[]>([]);
    const [contentType, setContentType] = useState<ContentType[]>([]);
    const [query, setQuery] = useState("");

    const handleSubmit = () => {
        onSearch?.(query, topics.map(t => t.label), contentType);
    };
    const handleReset = () => {
        setQuery("");
        onReset?.();
    };

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
                    value={query}
                    onChange={setQuery}
                    onSubmit={handleSubmit}
                    isActive={isSearchActive}
                    onReset={handleReset}
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
                    { label: "POSTS", isActive: true, value: "article" },
                    { label: "SHOTS", isActive: true, value: "shot" },
                    { label: "PODCAST", isActive: true, value: "podcast" },
                ]}
                    onUpdate={setContentType}
                />
            </div>
        </div>
    );
};
