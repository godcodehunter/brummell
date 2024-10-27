import { useState, useMemo, useRef, useEffect } from 'react';
import ResizeObserver from 'resize-observer-polyfill'

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

// export function useMeasure() {
//   const ref = useRef()
//   const [bounds, set] = useState({ left: 0, top: 0, width: 0, height: 0 })
//   const [ro, _] = useState(() => new ResizeObserver(([entry]) => set(entry.contentRect)))
//   useEffect(() => {
//     ro.observe(ref.current);
//     ro.disconnect();
//   }, [ro])
//   return [{ ref }, bounds]
// }


