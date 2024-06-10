import React, { useState } from 'react';

interface Showcase {
    children: JSX.Element[],
}

export const Showcase: React.FC<Showcase> = ({children}) => {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                flexWrap: "wrap",
                overflowY: "scroll",
                gap: 40,
            }}
        >
            {children}
        </div>
    );
};