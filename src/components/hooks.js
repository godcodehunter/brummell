import { useState, useMemo } from 'react';

export const useHover = () => {
    const [hovered, setHovered] = useState();
    
    const eventHandlers = useMemo(() => ({
        onMouseOver() { setHovered(true); },
        onMouseOut() { setHovered(false); }
    }), []);
    
    return [hovered, eventHandlers];
}

