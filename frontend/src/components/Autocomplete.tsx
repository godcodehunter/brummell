import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, css } from 'aphrodite';
import { useSpring, animated } from 'react-spring';
import Fuse from 'fuse.js';
import { ReactComponent as Arrow } from '../assets/arrow.svg';
import { useHover } from '../hooks';

const ROW_HEIGHT = 25;
const MAX_DROPDOWN_HEIGHT = 160;
const COLLAPSED_HEIGHT = 25;

const autocomplete = StyleSheet.create({
    field: {
        boxSizing: "border-box",
        backgroundColor: "#3F3D3D",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },
    input: {
        flexGrow: 1,
        backgroundColor: "rgba(0, 0, 0, 0)",
        border: "none",
        paddingLeft: 5,
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 12,
        minWidth: 0,
        ':hover': { outline: "none" },
        ':focus': { outline: "none" },
    },
    row: {
        boxSizing: "border-box",
        padding: "4px 8px",
        height: ROW_HEIGHT,
        color: "#D4D4D4",
        fontFamily: "Roboto",
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
});

interface AutocompleteProps<T> {
    variants: T[],
    getLabel: (item: T) => string,
    onSelect: (item: T) => void,
    placeholder?: string,
}

export function Autocomplete<T>({
    variants,
    getLabel,
    onSelect,
    placeholder,
}: AutocompleteProps<T>) {
    const [hovered, eventHandlers] = useHover();
    const [text, setText] = useState("");
    const [isOpen, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const [activeIdx, setActiveIdx] = useState<number>(-1);
    const listRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Rebuild the index only when the source list itself changes. The label
    // accessor is read through a ref so callers can pass a fresh `getLabel`
    // closure each render without busting the index.
    const getLabelRef = useRef(getLabel);
    getLabelRef.current = getLabel;
    const fuse = useMemo(
        () => new Fuse(variants, {
            keys: [{ name: "__label", getFn: (item: T) => getLabelRef.current(item) }],
            threshold: 0.4,
            ignoreLocation: true,
        }),
        [variants],
    );

    const filtered = useMemo(() => {
        const q = text.trim();
        if (!q) return variants;
        return fuse.search(q).map(r => r.item);
    }, [text, fuse, variants]);

    // Re-anchor the keyboard cursor when the filtered list changes.
    useEffect(() => {
        setActiveIdx(filtered.length > 0 ? 0 : -1);
    }, [filtered]);

    // Keep the highlighted row in view as the user arrows past the visible
    // window of the dropdown.
    useEffect(() => {
        if (activeIdx < 0) return;
        itemRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" });
    }, [activeIdx]);

    const expanded = isOpen || focused || text.length > 0;
    const targetHeight = expanded
        ? Math.min(MAX_DROPDOWN_HEIGHT, ROW_HEIGHT + filtered.length * ROW_HEIGHT)
        : COLLAPSED_HEIGHT;
    const animProps = useSpring({ height: targetHeight, from: { height: COLLAPSED_HEIGHT } });

    const selectAt = (idx: number) => {
        const item = filtered[idx];
        if (item === undefined) return;
        onSelect(item);
        setText("");
        setActiveIdx(-1);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setOpen(true);
                setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIdx(i => Math.max(0, i - 1));
                break;
            case "Enter":
                e.preventDefault();
                if (activeIdx >= 0) selectAt(activeIdx);
                break;
            case "Escape":
                setOpen(false);
                break;
        }
    };

    return (
        <animated.div
            className={css(autocomplete.field)}
            style={{
                ...animProps,
                border: focused ? "0.4px solid #ABABAB" : "0.4px solid transparent",
            }}
        >
            <div style={{
                display: "flex",
                flexDirection: "row",
                height: ROW_HEIGHT,
                flexShrink: 0,
            }}>
                <input
                    className={css(autocomplete.input)}
                    value={text}
                    placeholder={placeholder}
                    onChange={(e) => { setText(e.target.value); setOpen(true); }}
                    onFocus={() => { setFocused(true); setOpen(true); }}
                    onBlur={() => setFocused(false)}
                    onKeyDown={onKeyDown}
                />
                <Arrow
                    style={{ display: "block", margin: "auto", height: "100%", width: 25, cursor: "pointer" }}
                    stroke={hovered ? "#FAFAFA" : "#ABABAB"}
                    {...eventHandlers}
                    onClick={() => setOpen(o => !o)}
                />
            </div>
            <div ref={listRef} style={{
                backgroundColor: "#1E1E1F",
                overflowY: "auto",
                flex: 1,
                minHeight: 0,
            }}>
                {filtered.map((item, i) => (
                    <div
                        key={getLabel(item)}
                        ref={el => { itemRefs.current[i] = el; }}
                        className={css(autocomplete.row)}
                        style={{
                            backgroundColor: activeIdx === i ? "#3F3D3D" : undefined,
                        }}
                        onMouseEnter={() => setActiveIdx(i)}
                        // mousedown (not click) so we select before the input's
                        // blur tears down the list under the cursor.
                        onMouseDown={(e) => { e.preventDefault(); selectAt(i); }}
                    >
                        {getLabel(item)}
                    </div>
                ))}
            </div>
        </animated.div>
    );
}
