'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/* Custom scroll container with a soft-fading overlay thumb.
 *
 * We hide the native browser scrollbar (Chromium doesn't animate
 * `::-webkit-scrollbar-thumb` properties reliably) and render our own
 * thumb as an absolutely-positioned div on the right edge of the content.
 * Opacity fades in fast on scroll, out slow on idle, so the bar feels
 * present-when-needed and gone-when-not.
 *
 * The CSS this depends on lives in globals.css under `.hide-native-scrollbar`
 * and `.custom-scroll-thumb`.
 */
export default function ScrollArea({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const compute = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight + 1) {
        setThumb(null);
        return;
      }
      const ratio = clientHeight / scrollHeight;
      const thumbHeight = Math.max(28, clientHeight * ratio);
      const maxScroll = scrollHeight - clientHeight;
      const usableTrack = clientHeight - thumbHeight;
      const thumbTop = (scrollTop / maxScroll) * usableTrack;
      setThumb({ top: thumbTop, height: thumbHeight });
    };

    const onScroll = () => {
      compute();
      setVisible(true);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setVisible(false), 750);
    };

    compute();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(compute);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div
      className={className}
      style={{ position: 'relative', ...style }}
    >
      <div
        ref={scrollRef}
        className="hide-native-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
      {thumb && (
        <div
          className="custom-scroll-thumb"
          style={{
            position: 'absolute',
            right: 2,
            top: thumb.top,
            width: 5,
            height: thumb.height,
            borderRadius: 3,
            opacity: visible ? 1 : 0,
            transition: visible
              ? 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1), top 60ms linear, height 60ms linear'
              : 'opacity 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: 'none',
            willChange: 'opacity, top',
          }}
        />
      )}
    </div>
  );
}
