/**
 * Motion primitives (Framer Motion). Every animation here is subtle, fast and
 * opt-out: MotionConfig reducedMotion="user" turns them into plain renders when
 * the OS asks for reduced motion, and CountUp/Stagger check the same signal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

export const EASE = [0.16, 1, 0.3, 1] as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: EASE }}>{children}</MotionConfig>;
}

/** Crossfade + small rise between routes. Keyed on the path, so tabs and query changes do not re-animate. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} style={{ minHeight: '100%' }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Variants propagate from a motion parent to motion children, so List/ListRow and StatRow/StatTile stagger without extra wrappers. */
export const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } } };
export const staggerItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const container = staggerContainer;
const item = staggerItem;

/** Children fade in one after another. Used by List and StatRow. */
export function Stagger({ children, className, style, as = 'div' }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; as?: 'div' | 'ul' }) {
  const Tag = as === 'ul' ? motion.ul : motion.div;
  return (
    <Tag className={className} style={style} variants={container} initial="hidden" animate="show">
      {React.Children.map(children, (child) => (child == null || child === false ? null : <motion.div variants={item} style={{ minWidth: 0 }}>{child}</motion.div>))}
    </Tag>
  );
}

/**
 * Counts a server-computed number up to its value on first paint. The formatted
 * text is what the reader sees, so the format function owns rounding/locale.
 * Renders the final value at once under reduced motion.
 */
export function CountUp({ value, format, duration = 0.8 }: { value: number; format: (n: number) => string; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced) { setShown(value); return; }
    const controls = animate(from.current, value, { duration, ease: EASE, onUpdate: (v) => setShown(v) });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduced]);
  return <>{format(shown)}</>;
}

/** Hover lift for tappable surfaces; a no-op on touch devices and under reduced motion (CSS handles both). */
export function Lift({ children, className, style, ...rest }: React.ComponentProps<typeof motion.div>) {
  return <motion.div className={className} style={style} whileHover={{ y: -2 }} whileTap={{ scale: 0.995 }} {...rest}>{children}</motion.div>;
}
