import React, { useState } from 'react';

interface Showcase {
    className?: string,
    children: JSX.Element[],
    style?: any,
}

export const Showcase: React.FC<Showcase> = ({
    children,
    className,
    style = {}
}) => {
    return (
        <div
            className={className}
            style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "flex-start",
                flexWrap: "wrap",
                overflowY: "scroll",
                ...style,
            }}
        >
            {children}
        </div>
    );
};