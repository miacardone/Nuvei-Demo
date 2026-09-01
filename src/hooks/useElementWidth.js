import { useEffect, useRef, useState } from 'react';

/**
 * Measures an element's content width so an SVG can be drawn at 1:1.
 *
 * WHY THIS EXISTS. The charts previously used a fixed 680-unit viewBox with
 * width:100% and preserveAspectRatio="meet". In a ~1150px card that scales the
 * whole drawing 1.7× — a chart asked for 260px tall rendered at ~440px, and
 * 10px tick labels rendered at ~17px. Every "the scale is off" symptom traced
 * back to it.
 *
 * Drawing into a viewBox that matches the real pixel width means one SVG unit
 * is one CSS pixel: heights are exactly what the caller asks for, and text is
 * the size the stylesheet says it is.
 */
export function useElementWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export default useElementWidth;
