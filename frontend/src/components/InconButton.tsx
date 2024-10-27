import React from "react";
import { SVGProps } from "react";
import { useHover } from "../hooks";

interface IconButtonProps {
    url: string,
    Icon: React.FC<SVGProps<SVGSVGElement>>,
}

export const IconButton: React.FC<IconButtonProps> = ({ url, Icon }) => {
    const [hovered, eventHandlers] = useHover();
    return (
        <Icon
            fill={hovered ? "#FAFAFA" : "#ABABAB"}
            onClick={() => window.open(url, '_blank')}
            style={{ cursor: "pointer", }}
            {...eventHandlers}
        />
    );
}
