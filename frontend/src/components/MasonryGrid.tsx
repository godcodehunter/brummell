import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

interface Props {
  columnWidth: number;
  gutterX?: number;
  gutterY?: number;
  className?: string;
  children: React.ReactNode;
}

const TRANSITION = "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";

export const MasonryGrid: React.FC<Props> = ({
  columnWidth,
  gutterX = 0,
  gutterY = 0,
  className,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemNodes = useRef<Map<string, HTMLDivElement>>(new Map());

  const [containerWidth, setContainerWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});

  const items = useMemo(() => {
    const arr: { key: string; node: React.ReactElement }[] = [];
    React.Children.forEach(children, (child, i) => {
      if (!React.isValidElement(child)) return;
      arr.push({ key: String(child.key ?? `__mg_${i}`), node: child });
    });
    return arr;
  }, [children]);
  const itemsKey = items.map(i => i.key).join("|");

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(entries => {
      setHeights(prev => {
        let changed = false;
        const next = { ...prev };
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.mgKey;
          if (!key) continue;
          const h = e.contentRect.height;
          if (next[key] !== h) {
            next[key] = h;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    itemNodes.current.forEach(node => ro.observe(node));
    return () => ro.disconnect();
  }, [itemsKey]);

  const cols = Math.max(
    1,
    Math.floor((containerWidth + gutterX) / (columnWidth + gutterX)),
  );
  const actualWidth = cols * columnWidth + (cols - 1) * gutterX;
  const offsetX = Math.max(0, (containerWidth - actualWidth) / 2);

  const colHeights = new Array<number>(cols).fill(0);
  const positions = items.map(({ key }) => {
    let col = 0;
    for (let i = 1; i < cols; i++) {
      if (colHeights[i] < colHeights[col]) col = i;
    }
    const h = heights[key];
    const top = colHeights[col];
    const left = offsetX + col * (columnWidth + gutterX);
    if (h != null) colHeights[col] += h + gutterY;
    return { top, left, ready: h != null };
  });
  const totalHeight = Math.max(0, ...colHeights) - gutterY;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: Math.max(0, totalHeight),
        transition: "height 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      {items.map(({ key, node }, i) => {
        const { top, left, ready } = positions[i];
        return (
          <div
            key={key}
            data-mg-key={key}
            ref={el => {
              if (el) itemNodes.current.set(key, el);
              else itemNodes.current.delete(key);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: columnWidth,
              transform: `translate3d(${left}px, ${top}px, 0)`,
              transition: ready ? TRANSITION : undefined,
              visibility: ready ? "visible" : "hidden",
              willChange: "transform",
            }}
          >
            {node}
          </div>
        );
      })}
    </div>
  );
};
