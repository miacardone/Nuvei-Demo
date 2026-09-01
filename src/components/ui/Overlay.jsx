import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';

/**
 * Tooltip and Popover — both rendered in a PORTAL at document.body with fixed
 * positioning and a high z-index.
 *
 * This is the fix for the reference's clipping bug. Its Tooltip was already
 * portalled, but its popovers (column toggle, filter lists, menus) were
 * absolutely positioned inside the table's `overflow-x: auto` container, so
 * they were clipped by it and trapped in its stacking context. Everything that
 * floats goes through this module.
 *
 * Tooltips open after a delay, and dismiss on scroll — a tooltip left hanging
 * over a scrolled table points at the wrong row.
 */

const OFFSET = 8;
const OPEN_DELAY = 400;

function place(rect, side) {
  switch (side) {
    case 'bottom': return { left: rect.left + rect.width / 2, top: rect.bottom + OFFSET, transform: 'translate(-50%, 0)' };
    case 'left': return { left: rect.left - OFFSET, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' };
    case 'right': return { left: rect.right + OFFSET, top: rect.top + rect.height / 2, transform: 'translate(0, -50%)' };
    default: return { left: rect.left + rect.width / 2, top: rect.top - OFFSET, transform: 'translate(-50%, -100%)' };
  }
}

/** Keeps a fixed-position box inside the viewport. */
function clamp(pos, width = 260) {
  const margin = 8;
  const half = width / 2;
  const left = Math.min(Math.max(pos.left, half + margin), window.innerWidth - half - margin);
  return { ...pos, left };
}

export function Tooltip({ label, side = 'top', wide = false, disabled = false, children, className = '' }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  const show = useCallback(() => {
    if (disabled || !label) return;
    timer.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  }, [disabled, label]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    setPos(clamp(place(ref.current.getBoundingClientRect(), side), wide ? 320 : 260));
  }, [open, side, wide]);

  // A tooltip that survives a scroll is pointing at the wrong thing.
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, hide]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && pos && createPortal(
        <span
          role="tooltip"
          className={`tooltip ${wide ? 'tooltip--wide' : ''}`.trim()}
          style={{ left: pos.left, top: pos.top, transform: pos.transform }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}

/**
 * Popover — click-to-open, portalled, closes on Escape, outside click or
 * scroll. `render` receives a `close` callback.
 */
export function Popover({ trigger, children, align = 'left', width = 240, className = '' }) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = align === 'right' ? r.right - width : r.left;
    const maxLeft = window.innerWidth - width - 8;
    const margin = 8;

    // A popover that opens below a trigger near the bottom of the screen can
    // run off the viewport — since it's position:fixed, that overflow isn't
    // reachable by scrolling the page, so it just looks broken/unscrollable.
    // Flip upward when there's more room there, and always cap the height to
    // whatever space is actually available so its own overflow-y can work.
    const spaceBelow = window.innerHeight - r.bottom - margin - 4;
    const spaceAbove = r.top - margin - 4;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;

    setPos({
      left: Math.min(Math.max(left, 8), maxLeft),
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(160, openUp ? spaceAbove : spaceBelow),
    });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    // Scrolling the popover's own (overflow-y:auto) content also fires a
    // capturing 'scroll' event on window — ignore that so the list can
    // actually be scrolled instead of closing on the first tick.
    const onScroll = (e) => {
      if (bodyRef.current && e.target && bodyRef.current.contains(e.target)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  return (
    <>
      <span ref={ref} className={className} style={{ display: 'inline-flex' }}>
        {typeof trigger === 'function' ? trigger({ open, toggle: () => setOpen((v) => !v) }) : (
          <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
        )}
      </span>

      {open && pos && createPortal(
        <>
          <div className="popover__backdrop" onClick={close} aria-hidden />
          <div ref={bodyRef} className="popover" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width, maxHeight: pos.maxHeight }} role="dialog">
            {typeof children === 'function' ? children({ close }) : children}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

/**
 * Drawer — a persistent right-docked panel, portalled, closes on Escape or
 * backdrop click. Unlike Popover, it does NOT close on scroll: a filter
 * panel that vanished because the table under it scrolled would be actively
 * wrong for something meant to stay open while you work.
 */
export function Drawer({ open, onClose, title, children, width = 340 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="drawer" style={{ width }} role="dialog" aria-label={title}>
        <div className="drawer__head">
          <span className="drawer__title">{title}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Wraps text that may overflow: renders truncated, and only attaches a tooltip
 * when it actually overflows its box.
 */
export function TruncatedText({ value, className = '', tooltip }) {
  const ref = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollWidth > el.clientWidth + 1);
  }, [value]);

  const content = <span ref={ref} className={`truncate ${className}`.trim()}>{value}</span>;

  return overflowing || tooltip
    ? <Tooltip label={tooltip ?? value} className={className}>{content}</Tooltip>
    : content;
}

export default Tooltip;
