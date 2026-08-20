/**
 * Popover menu used by the toolbars, the card kebabs and the file menu.
 *
 * The menu renders into `document.body` with fixed positioning rather than
 * inside the trigger: card grids and the comment list are scroll containers,
 * and an absolutely-positioned menu got clipped by them at the edges.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "./Icons";

interface Position {
  left: number;
  top: number;
  maxHeight: number;
}

const MARGIN = 8;

export const Dropdown = ({
  trigger,
  title,
  active,
  align = "right",
  up = false,
  triggerClass = "icon-btn",
  menuClass = "",
  children,
}: {
  trigger: ReactNode;
  title?: string;
  /** Highlights the trigger, e.g. when a filter is applied. */
  active?: boolean;
  align?: "left" | "right";
  /** Prefer opening upwards; flipped automatically when there's no room. */
  up?: boolean;
  /** Swap for a wider trigger, e.g. the asset name menu. */
  triggerClass?: string;
  menuClass?: string;
  children: (close: () => void) => ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Measure after paint so the menu's real size drives the flip and clamp.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!anchor || !menu) return;

    const spaceBelow = window.innerHeight - anchor.bottom - MARGIN - 6;
    const spaceAbove = anchor.top - MARGIN - 6;
    const fitsBelow = menu.height <= spaceBelow;
    const fitsAbove = menu.height <= spaceAbove;
    // Prefer the requested side, then whichever side actually fits, then the
    // roomier one — a long preset list scrolls inside whatever we land on.
    const openUp = up ? fitsAbove || !fitsBelow : !fitsBelow && spaceAbove > spaceBelow;

    const maxHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
    const height = Math.min(menu.height, maxHeight);

    const rawLeft = align === "right" ? anchor.right - menu.width : anchor.left;
    setPosition({
      left: Math.min(
        Math.max(MARGIN, rawLeft),
        Math.max(MARGIN, window.innerWidth - menu.width - MARGIN)
      ),
      top: openUp ? anchor.top - height - 6 : anchor.bottom + 6,
      maxHeight,
    });
  }, [open, align, up]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // A scroll behind the menu would leave it floating away from its trigger —
    // but scrolling *inside* the menu is how you reach a long list.
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        className={`${triggerClass}${active ? " accented" : ""}${open ? " on" : ""}`}
        onClick={(event) => {
          // Card menus live inside a clickable card; don't trigger the card.
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        title={title}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`menu ${menuClass}`}
            style={
              position
                ? {
                    left: position.left,
                    top: position.top,
                    maxHeight: position.maxHeight,
                  }
                : // Kept off-screen for the first, measuring paint.
                  { left: -9999, top: 0, visibility: "hidden" }
            }
            onClick={(event) => event.stopPropagation()}
          >
            {title && <div className="menu-title">{title}</div>}
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
};

export const MenuCheck = ({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button className="menu-item" onClick={() => onChange(!checked)}>
    {icon && <span className="menu-icon">{icon}</span>}
    <span className="menu-label">{label}</span>
    <span className={`menu-box${checked ? " on" : ""}`}>
      {checked && <IconCheck width={10} height={10} />}
    </span>
  </button>
);

export const MenuRadio = ({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) => (
  <button className="menu-item" onClick={onSelect}>
    <span className="menu-label">{label}</span>
    {checked && (
      <span className="menu-tick">
        <IconCheck width={12} height={12} />
      </span>
    )}
  </button>
);

export const MenuAction = ({
  label,
  sub,
  icon,
  danger,
  onSelect,
}: {
  label: string;
  sub?: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) => (
  <button className={`menu-item${danger ? " danger" : ""}`} onClick={onSelect}>
    {icon && <span className="menu-icon">{icon}</span>}
    <span className="menu-label">
      {label}
      {sub && <em>{sub}</em>}
    </span>
  </button>
);
