import { useState, useMemo } from 'react';

type EventHandlers = {
  onMouseOver: () => void;
  onMouseOut: () => void;
};

export const useHover = (): [boolean, EventHandlers]  => {
  const [hovered, setHovered] = useState(false);

  const eventHandlers = useMemo(() => ({
    onMouseOver: () => setHovered(true),
    onMouseOut: () => setHovered(false),
  }), []);

  return [hovered, eventHandlers];
}