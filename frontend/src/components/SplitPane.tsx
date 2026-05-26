import React, { useCallback, useState } from 'react';
import { StyleSheet, css } from 'aphrodite';

// VSCode's sash hover/active color.
const ACCENT = "#007ACC";
// Hit area around the 1px line — wide enough to grab without pixel-hunting.
const RESIZER_SIZE = 6;
const DEFAULT_PANEL_SIZE = 240;

type Direction = "horizontal" | "vertical";

export interface PanelProps {
    children: React.ReactNode;
    // Initial size along the split axis, in px. Ignored when `flex` is set.
    defaultSize?: number;
    // Clamp bounds for the draggable size, in px.
    minSize?: number;
    maxSize?: number;
    // A flexible panel absorbs the remaining space and isn't sized directly —
    // dragging an adjacent divider resizes its fixed neighbour instead.
    flex?: boolean;
}

// Marker component: SplitPane reads these props off its children and renders
// the actual content itself inside a sized wrapper, so <Panel> never renders
// on its own.
export const Panel: React.FC<PanelProps> = ({ children }) => <>{children}</>;

interface SplitPaneProps {
    children: React.ReactNode;
    direction?: Direction;
    style?: React.CSSProperties;
    // When set, panel sizes are persisted to localStorage under this key so the
    // layout survives reloads — like VSCode remembering the sidebar width.
    storageKey?: string;
}

const styles = StyleSheet.create({
    container: {
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
    },
    panel: {
        // Children fill the panel; minWidth/minHeight:0 lets a flex panel shrink
        // below its content's intrinsic size (needed for the editor to narrow).
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
        minHeight: 0,
    },
    resizer: {
        position: "relative",
        flexGrow: 0,
        flexShrink: 0,
        zIndex: 5,
        // Disable native touch scrolling/gestures so a touch drag resizes.
        touchAction: "none",
    },
    resizerH: {
        flexBasis: RESIZER_SIZE,
        cursor: "col-resize",
    },
    resizerV: {
        flexBasis: RESIZER_SIZE,
        cursor: "row-resize",
    },
    line: {
        position: "absolute",
        transition: "background-color 120ms ease-out",
    },
    lineH: {
        top: 0,
        bottom: 0,
        left: "50%",
        width: 1,
        transform: "translateX(-50%)",
    },
    lineV: {
        left: 0,
        right: 0,
        top: "50%",
        height: 1,
        transform: "translateY(-50%)",
    },
});

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const loadSizes = (storageKey: string | undefined, count: number): (number | null)[] => {
    if (storageKey) {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length === count) return parsed;
            }
        } catch {
            // Corrupt/blocked storage — fall back to defaults.
        }
    }
    return new Array(count).fill(null);
};

export const SplitPane: React.FC<SplitPaneProps> & { Panel: typeof Panel } = ({
    children,
    direction = "horizontal",
    style,
    storageKey,
}) => {
    const horizontal = direction === "horizontal";

    const panels = React.Children.toArray(children).filter(
        (c): c is React.ReactElement<PanelProps> => React.isValidElement(c) && c.type === Panel,
    );

    // `null` means "use the panel's defaultSize" — keeps state independent of the
    // declared defaults so changing a default in JSX still takes effect on reload
    // (until the user drags, after which the stored value wins).
    const [sizes, setSizes] = useState<(number | null)[]>(() => loadSizes(storageKey, panels.length));
    const [activeResizer, setActiveResizer] = useState<number | null>(null);
    const [hoverResizer, setHoverResizer] = useState<number | null>(null);

    const sizeOf = (i: number) => sizes[i] ?? panels[i]?.props.defaultSize ?? DEFAULT_PANEL_SIZE;

    // The divider at boundary `i` (between panel i and i+1) resizes whichever
    // side is fixed: the left panel normally, or the right panel (with inverted
    // delta) when the left one is flexible. Two flexible panels share no fixed
    // edge, so that boundary isn't draggable.
    const resizeTarget = (i: number): { idx: number; sign: 1 | -1 } | null => {
        if (!panels[i].props.flex) return { idx: i, sign: 1 };
        if (panels[i + 1] && !panels[i + 1].props.flex) return { idx: i + 1, sign: -1 };
        return null;
    };

    const onResizerDown = useCallback(
        (boundary: number, target: { idx: number; sign: 1 | -1 }) => (e: React.PointerEvent) => {
            e.preventDefault();
            const startPos = horizontal ? e.clientX : e.clientY;
            const startSize = sizeOf(target.idx);
            const { minSize = 0, maxSize = Infinity } = panels[target.idx].props;

            setActiveResizer(boundary);
            // Keep the resize cursor and kill text selection for the whole drag,
            // even as the pointer races outside the thin sash.
            const prevCursor = document.body.style.cursor;
            const prevSelect = document.body.style.userSelect;
            document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
            document.body.style.userSelect = "none";

            let latest = startSize;
            const onMove = (ev: PointerEvent) => {
                const pos = horizontal ? ev.clientX : ev.clientY;
                latest = clamp(startSize + target.sign * (pos - startPos), minSize, maxSize);
                setSizes(prev => {
                    const next = [...prev];
                    next[target.idx] = latest;
                    return next;
                });
            };
            const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                document.body.style.cursor = prevCursor;
                document.body.style.userSelect = prevSelect;
                setActiveResizer(null);
                if (storageKey) {
                    setSizes(prev => {
                        try {
                            localStorage.setItem(storageKey, JSON.stringify(prev));
                        } catch {
                            // Ignore storage write failures.
                        }
                        return prev;
                    });
                }
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        },
        // sizeOf/panels are derived from props each render; the handler reads them
        // at call time via closure, so we only depend on the stable axis/key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [horizontal, storageKey],
    );

    return (
        <div className={css(styles.container)} style={{ flexDirection: horizontal ? "row" : "column", ...style }}>
            {panels.map((panel, i) => {
                const { flex } = panel.props;
                const flexValue = flex ? "1 1 0" : `0 0 ${sizeOf(i)}px`;
                const target = i < panels.length - 1 ? resizeTarget(i) : null;
                const lit = activeResizer === i || hoverResizer === i;
                return (
                    <React.Fragment key={i}>
                        <div className={css(styles.panel)} style={{ flex: flexValue }}>
                            {panel.props.children}
                        </div>
                        {target && (
                            <div
                                className={css(styles.resizer, horizontal ? styles.resizerH : styles.resizerV)}
                                onPointerDown={onResizerDown(i, target)}
                                onMouseEnter={() => setHoverResizer(i)}
                                onMouseLeave={() => setHoverResizer(prev => (prev === i ? null : prev))}
                            >
                                <div
                                    className={css(styles.line, horizontal ? styles.lineH : styles.lineV)}
                                    style={{ backgroundColor: lit ? ACCENT : "transparent" }}
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

SplitPane.Panel = Panel;
