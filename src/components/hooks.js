import { useState, useMemo, useRef, useEffect} from 'react';
import ResizeObserver from 'resize-observer-polyfill'

export const useHover = () => {
  const [hovered, setHovered] = useState();
  
  const eventHandlers = useMemo(() => ({
      onMouseOver() { setHovered(true); },
      onMouseOut() { setHovered(false); }
  }), []);
  
  return [hovered, eventHandlers];
}

export function useMeasure() {
  const ref = useRef()
  const [bounds, set] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [ro] = useState(() => new ResizeObserver(([entry]) => set(entry.contentRect)))
  useEffect(() => (ro.observe(ref.current), ro.disconnect), [])
  return [{ ref }, bounds]
}


