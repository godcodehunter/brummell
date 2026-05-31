import React, { useState, useEffect } from 'react';
import { StyleSheet, css } from 'aphrodite';

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
        userSelect: "none",
        color: "#D4D4D4",
    },
});

interface Variant {
    label: string,
    value: any,
    isActive?: boolean,
}

interface Props {
    variants: Variant[],
    onUpdate: (values: any[]) => void,
}

export const SegmentedControls: React.FC<Props> = ({ variants, onUpdate }) => {
    const [selected, setSelected] = useState<Variant[]>(
        () => variants.filter(v => v.isActive),
    );

    // Reset internal selection when the variants list itself changes.
    useEffect(() => {
        setSelected(variants.filter(v => v.isActive));
    }, [variants]);

    const handleToggle = (item: Variant) => {
        const next = selected.includes(item)
            ? selected.filter(n => n !== item)
            : [...selected, item];
        setSelected(next);
        onUpdate(next.map(it => it.value));
    };

    return (
        <div className={css(segmentedControls.container)}>
            {variants.map((item, i) => (
                <div
                    key={i}
                    className={css(segmentedControls.segment)}
                    style={{
                        backgroundColor: selected.includes(item) ? "#1E1E1F" : undefined,
                    }}
                    onClick={() => handleToggle(item)}
                >
                    {item.label}
                </div>
            ))}
        </div>
    );
};
