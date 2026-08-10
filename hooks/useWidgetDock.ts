import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DOCK,
  applyWidgetDock,
  clampDock,
  dockFromPosition,
  getWidgetDock,
  measureWidget,
  saveWidgetDock,
  setWidgetDragLock,
  snapTargets,
  viewportBounds,
  type WidgetDock,
} from '@/lib/widget';

const DRAG_THRESHOLD = 8;
const FRICTION = 6.2;
const SPRING = 92;
const DAMPING = 14;
const BOUNCE = 0.38;
const STOP_SPEED = 18;
const STOP_DISTANCE = 0.6;
const MAX_SPEED = 4200;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
  samples: Array<{ t: number; x: number; y: number }>;
};

export function useWidgetDock(open: boolean, onFabActivate?: () => void) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [dock, setDock] = useState<WidgetDock>(DEFAULT_DOCK);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const dockRef = useRef(dock);
  const motionRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const rafRef = useRef(0);
  dockRef.current = dock;

  const stopMotion = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const commit = useCallback((next: WidgetDock, persist = true) => {
    const widget = widgetRef.current;
    if (!widget) return next;
    const size = measureWidget(widget);
    const clamped = clampDock(next, size.width, size.height);
    dockRef.current = clamped;
    motionRef.current.x = clamped.x;
    motionRef.current.y = clamped.y;
    setDock(clamped);
    applyWidgetDock(widget, clamped);
    if (persist) void saveWidgetDock(clamped);
    return clamped;
  }, []);

  const placeCurrent = useCallback(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    commit(dockRef.current, false);
  }, [commit]);

  useEffect(() => {
    void getWidgetDock().then((saved) => {
      requestAnimationFrame(() => commit(saved));
    });
  }, [commit]);

  useEffect(() => {
    requestAnimationFrame(() => placeCurrent());
  }, [open, placeCurrent]);

  useEffect(() => {
    const onResize = () => placeCurrent();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [placeCurrent]);

  useEffect(() => () => stopMotion(), [stopMotion]);

  const tick = useCallback((last: number) => {
    const widget = widgetRef.current;
    if (!widget) {
      rafRef.current = 0;
      return;
    }

    const now = performance.now();
    const dt = Math.min(0.032, (now - last) / 1000);
    const size = measureWidget(widget);
    const bounds = viewportBounds(size.width, size.height);
    const motion = motionRef.current;
    const snaps = snapTargets(motion.x, motion.y, size.width, size.height);

    let ax = 0;
    let ay = 0;
    if (snaps.x != null) ax += SPRING * (snaps.x - motion.x) - DAMPING * motion.vx;
    else motion.vx *= Math.exp(-FRICTION * dt);
    if (snaps.y != null) ay += SPRING * (snaps.y - motion.y) - DAMPING * motion.vy;
    else motion.vy *= Math.exp(-FRICTION * dt);

    motion.vx += ax * dt;
    motion.vy += ay * dt;
    motion.x += motion.vx * dt;
    motion.y += motion.vy * dt;

    if (motion.x < bounds.minX) {
      motion.x = bounds.minX;
      motion.vx = Math.abs(motion.vx) * BOUNCE;
    } else if (motion.x > bounds.maxX) {
      motion.x = bounds.maxX;
      motion.vx = -Math.abs(motion.vx) * BOUNCE;
    }
    if (motion.y < bounds.minY) {
      motion.y = bounds.minY;
      motion.vy = Math.abs(motion.vy) * BOUNCE;
    } else if (motion.y > bounds.maxY) {
      motion.y = bounds.maxY;
      motion.vy = -Math.abs(motion.vy) * BOUNCE;
    }

    applyWidgetDock(widget, {
      left: false,
      right: false,
      top: false,
      bottom: false,
      x: motion.x,
      y: motion.y,
    });

    const speed = Math.hypot(motion.vx, motion.vy);
    const dx = snaps.x == null ? 0 : Math.abs(snaps.x - motion.x);
    const dy = snaps.y == null ? 0 : Math.abs(snaps.y - motion.y);
    const settled =
      speed < STOP_SPEED &&
      dx < STOP_DISTANCE &&
      dy < STOP_DISTANCE;

    if (!settled) {
      rafRef.current = requestAnimationFrame(() => tick(now));
      return;
    }

    rafRef.current = 0;
    commit(dockFromPosition(motion.x, motion.y, size.width, size.height));
  }, [commit]);

  const fling = useCallback((vx: number, vy: number) => {
    const widget = widgetRef.current;
    if (!widget) return;
    stopMotion();
    const rect = widget.getBoundingClientRect();
    motionRef.current = {
      x: rect.left,
      y: rect.top,
      vx: clamp(vx, -MAX_SPEED, MAX_SPEED),
      vy: clamp(vy, -MAX_SPEED, MAX_SPEED),
    };
    rafRef.current = requestAnimationFrame(() => tick(performance.now()));
  }, [stopMotion, tick]);

  const moveTo = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const widget = widgetRef.current;
    if (!drag || !widget) return;

    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    if (!drag.moved) {
      drag.moved = true;
      stopMotion();
      setWidgetDragLock(true);
      setDragging(true);
      const widget = widgetRef.current;
      if (widget && !widget.hasPointerCapture(drag.pointerId)) {
        try {
          widget.setPointerCapture(drag.pointerId);
        } catch {
          // Pointer may have already been released.
        }
      }
    }

    const now = performance.now();
    drag.samples.push({ t: now, x: clientX, y: clientY });
    if (drag.samples.length > 6) drag.samples.shift();

    const next = {
      left: false,
      right: false,
      top: false,
      bottom: false,
      x: drag.originX + dx,
      y: drag.originY + dy,
    };
    const size = measureWidget(widget);
    const clamped = clampDock(next, size.width, size.height);
    motionRef.current.x = clamped.x;
    motionRef.current.y = clamped.y;
    applyWidgetDock(widget, clamped);
  }, [stopMotion]);

  const velocityFromSamples = (samples: DragState['samples']) => {
    if (samples.length < 2) return { vx: 0, vy: 0 };
    const newest = samples[samples.length - 1]!;
    let oldest = samples[0]!;
    for (let i = samples.length - 2; i >= 0; i -= 1) {
      const sample = samples[i]!;
      if (newest.t - sample.t >= 32) {
        oldest = sample;
        break;
      }
      oldest = sample;
    }
    const dt = Math.max(1, newest.t - oldest.t) / 1000;
    return {
      vx: (newest.x - oldest.x) / dt,
      vy: (newest.y - oldest.y) / dt,
    };
  };

  const endDrag = useCallback((event?: PointerEvent) => {
    const drag = dragRef.current;
    const widget = widgetRef.current;
    dragRef.current = null;
    setWidgetDragLock(false);
    if (!drag) return false;

    if (widget?.hasPointerCapture(drag.pointerId)) {
      widget.releasePointerCapture(drag.pointerId);
    }

    if (!drag.moved || !widget) {
      setDragging(false);
      const target = event?.target as HTMLElement | null;
      if (target?.closest('.panel-head.drag-handle') && !open) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 50);
        onFabActivate?.();
      }
      return false;
    }

    const { vx, vy } = velocityFromSamples(drag.samples);
    setDragging(false);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 50);
    fling(vx, vy);
    return true;
  }, [fling, onFabActivate, open]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('.icon-btn, .linkish, textarea, input, select, .row')) {
        return;
      }
      if (!target?.closest('.drag-handle')) return;

      const rect = widget.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        moved: false,
        samples: [{ t: performance.now(), x: event.clientX, y: event.clientY }],
      };
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      moveTo(event.clientX, event.clientY);
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag(event);
    };

    widget.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      widget.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [endDrag, moveTo, open]);

  const consumeClickIfDragged = useCallback((event: React.MouseEvent) => {
    if (!suppressClickRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  return {
    widgetRef,
    dragging,
    consumeClickIfDragged,
    dock,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
