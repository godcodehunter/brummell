import React, { useState } from 'react';
import { StyleSheet, css } from 'aphrodite';

const BORDER = "0.4px solid #4A4A4A";

const segmentedControls = StyleSheet.create({
    container: {
        display: "flex",
        flexDirection: "row",
        height: 25,
        border: BORDER,
        boxSizing: "border-box",
        width: "max-content",
    },
    segment: {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textTransform: "uppercase",
        padding: "0 10px",
        fontSize: "10px",
        fontFamily: "Roboto",
        fontWeight: 600,
        letterSpacing: 0.4,
        cursor: "pointer",
        userSelect: "none",
        transition: "background-color 120ms ease, color 120ms ease",
    },
    divider: {
        borderRight: BORDER,
    },
    on: {
        backgroundColor: "#3F3D3D",
        color: "#FAFAFA",
    },
    off: {
        backgroundColor: "transparent",
        color: "#7A7A7A",
        ':hover': {
            color: "#D4D4D4",
        },
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
    // State is the set of selected `value`s, not the variant objects — the
    // parent passes a fresh `variants` array on every render, so object
    // identity is not stable across renders.
    const [selectedValues, setSelectedValues] = useState<any[]>(
        () => variants.filter(v => v.isActive).map(v => v.value),
    );

    const handleToggle = (item: Variant) => {
        const next = selectedValues.includes(item.value)
            ? selectedValues.filter(v => v !== item.value)
            : [...selectedValues, item.value];
        setSelectedValues(next);
        onUpdate(next);
    };

    return (
        <div className={css(segmentedControls.container)}>
            {variants.map((item, i) => {
                const isOn = selectedValues.includes(item.value);
                const isLast = i === variants.length - 1;
                return (
                    <div
                        key={i}
                        className={css(
                            segmentedControls.segment,
                            isOn ? segmentedControls.on : segmentedControls.off,
                            !isLast && segmentedControls.divider,
                        )}
                        onClick={() => handleToggle(item)}
                    >
                        {item.label}
                    </div>
                );
            })}
        </div>
    );
};
