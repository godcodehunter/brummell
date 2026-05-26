import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, css } from 'aphrodite';

export interface ContextMenuItem {
    label: string,
    onClick: () => void,
    danger?: boolean,
    disabled?: boolean,
}

interface ContextMenuProps {
    x: number,
    y: number,
    items: ContextMenuItem[],
    onClose: () => void,
}

const VIEWPORT_MARGIN = 8;

const styles = StyleSheet.create({
    menu: {
        position: "fixed",
        minWidth: 160,
        padding: "4px 0",
        backgroundColor: "#252526",
        border: "1px solid #3A3A3A",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
        zIndex: 1000,
    },
    item: {
        padding: "4px 14px",
        fontSize: 13,
        color: "#CCCCCC",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ":hover": {
            backgroundColor: "#094771",
            color: "#FFFFFF",
        },
    },
    danger: {
        color: "#F48771",
    },
    disabled: {
        color: "#5A5A5A",
        cursor: "default",
        ":hover": {
            backgroundColor: "transparent",
            color: "#5A5A5A",
        },
    },
});

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });

    // Clamp inside the viewport so a click near the right/bottom edge doesn't
    // push the menu offscreen. useLayoutEffect runs before paint, so the
    // adjusted position is the first thing shown — no flicker.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        const left = Math.min(x, window.innerWidth - width - VIEWPORT_MARGIN);
        const top = Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN);
        setPos({ left: Math.max(VIEWPORT_MARGIN, left), top: Math.max(VIEWPORT_MARGIN, top) });
    }, [x, y]);

    // Capture-phase listeners so we catch the dismissing interaction before it
    // reaches anything else (e.g. a right-click that should reopen the menu
    // elsewhere closes this one first, then the new contextmenu reopens it).
    useEffect(() => {
        const onPointerDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) onClose();
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("mousedown", onPointerDown, true);
        window.addEventListener("contextmenu", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("mousedown", onPointerDown, true);
            window.removeEventListener("contextmenu", onPointerDown, true);
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [onClose]);

    return (
        <div ref={ref} className={css(styles.menu)} style={{ left: pos.left, top: pos.top }}>
            {items.map((item, i) => (
                <div
                    key={i}
                    className={css(styles.item, item.danger && styles.danger, item.disabled && styles.disabled)}
                    onClick={() => {
                        if (item.disabled) return;
                        item.onClick();
                        onClose();
                    }}
                >
                    {item.label}
                </div>
            ))}
        </div>
    );
};
