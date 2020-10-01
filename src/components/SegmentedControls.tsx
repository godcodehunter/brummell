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
    },
});

export const SegmentedControls = ({variants, onUpdate}: {variants: any, onUpdate: (variants: any) => void}) => {
    const [selected, setSelected] = useState<any[]>([]);
    
    useEffect(() => {
        setSelected(variants.filter((item: any) => item.isActive));
    }, [variants]);
    
    return (
        <div className={css(segmentedControls.container)}>
            {
                variants.map((item: any, i: number) =>(
                    <div
                        key={i}
                        className={css(segmentedControls.segment)}
                        style={{backgroundColor: selected.includes(item) ? "#1E1E1F" : undefined}}
                        onClick={() => {
                            if(!selected.includes(item)) {
                                setSelected([...selected, item]);
                            } else {
                                setSelected(ex => ex.filter(n => n !== item));
                            }
                        }}
                    >
                        {item.label}
                    </div>
                ))
            }
        </div>
    );
};
