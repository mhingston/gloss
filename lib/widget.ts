export type WidgetDock = {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  x: number;
  y: number;
};

export const DEFAULT_DOCK: WidgetDock = {
  left: false,
  right: true,
  top: false,
  bottom: true,
  x: 0,
  y: 0,
};

const MARGIN = 16;
export const SNAP_DISTANCE = 72;
const WIDGET_KEY = 'widgetDock';
const TOP_Z = '2147483647';

let dragLocked = false;

export function setWidgetDragLock(locked: boolean): void {
  dragLocked = locked;
}

function setImportant(el: HTMLElement, prop: string, value: string): void {
  el.style.setProperty(prop, value, 'important');
}

export function keepHostOnTop(host: HTMLElement): void {
  if (dragLocked) return;

  setImportant(host, 'all', 'initial');
  setImportant(host, 'display', 'block');
  setImportant(host, 'position', 'fixed');
  setImportant(host, 'top', '0px');
  setImportant(host, 'left', '0px');
  setImportant(host, 'width', '0px');
  setImportant(host, 'height', '0px');
  setImportant(host, 'margin', '0px');
  setImportant(host, 'padding', '0px');
  setImportant(host, 'border', 'none');
  setImportant(host, 'z-index', TOP_Z);
  setImportant(host, 'overflow', 'visible');
  setImportant(host, 'pointer-events', 'none');
  setImportant(host, 'background', 'transparent');
  setImportant(host, 'filter', 'none');
  setImportant(host, 'transform', 'none');
  setImportant(host, 'opacity', '1');
  setImportant(host, 'clip-path', 'none');
  setImportant(host, 'mask', 'none');
  setImportant(host, 'box-shadow', 'none');

  const root = document.documentElement;
  if (host.parentElement !== root || root.lastElementChild !== host) {
    root.append(host);
  }

  const inner = host.shadowRoot?.querySelector('div');
  if (inner instanceof HTMLElement) {
    setImportant(inner, 'all', 'initial');
    setImportant(inner, 'display', 'block');
    setImportant(inner, 'position', 'static');
    setImportant(inner, 'width', 'auto');
    setImportant(inner, 'height', 'auto');
    setImportant(inner, 'pointer-events', 'none');
    setImportant(inner, 'overflow', 'visible');
    setImportant(inner, 'background', 'transparent');
  }
}

export function watchHostOnTop(host: HTMLElement): () => void {
  keepHostOnTop(host);
  let timer = 0;
  const observer = new MutationObserver(() => {
    if (!host.isConnected || dragLocked) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => keepHostOnTop(host), 80);
  });
  observer.observe(document.documentElement, { childList: true });
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
}

export async function getWidgetDock(): Promise<WidgetDock> {
  const data = await browser.storage.local.get(WIDGET_KEY);
  const stored = data[WIDGET_KEY] as Partial<WidgetDock> | undefined;
  if (!stored) return { ...DEFAULT_DOCK };
  const dock: WidgetDock = {
    left: Boolean(stored.left),
    right: Boolean(stored.right),
    top: Boolean(stored.top),
    bottom: Boolean(stored.bottom),
    x: typeof stored.x === 'number' ? stored.x : 0,
    y: typeof stored.y === 'number' ? stored.y : 0,
  };
  return dock;
}

export async function saveWidgetDock(dock: WidgetDock): Promise<void> {
  await browser.storage.local.set({ [WIDGET_KEY]: dock });
}

export function applyWidgetDock(widget: HTMLElement, dock: WidgetDock): void {
  const size = measureWidget(widget);
  const next = clampDock(dock, size.width, size.height);
  const inset = `${MARGIN}px`;
  widget.style.position = 'fixed';
  widget.style.margin = '0';
  widget.style.zIndex = TOP_Z;
  widget.style.pointerEvents = 'auto';

  if (next.right) {
    widget.style.left = 'auto';
    widget.style.right = inset;
  } else {
    widget.style.right = 'auto';
    widget.style.left = `${next.x}px`;
  }

  if (next.bottom) {
    widget.style.top = 'auto';
    widget.style.bottom = inset;
  } else {
    widget.style.bottom = 'auto';
    widget.style.top = `${next.y}px`;
  }
}

export function measureWidget(widget: HTMLElement): { width: number; height: number } {
  const rect = widget.getBoundingClientRect();
  return {
    width: widget.offsetWidth || rect.width || 160,
    height: widget.offsetHeight || rect.height || 40,
  };
}

export function viewportBounds(width: number, height: number) {
  return {
    minX: MARGIN,
    minY: MARGIN,
    maxX: Math.max(MARGIN, window.innerWidth - width - MARGIN),
    maxY: Math.max(MARGIN, window.innerHeight - height - MARGIN),
  };
}

export function clampDock(dock: WidgetDock, width: number, height: number): WidgetDock {
  const { minX, minY, maxX, maxY } = viewportBounds(width, height);
  let x = clamp(dock.x, minX, maxX);
  let y = clamp(dock.y, minY, maxY);
  if (dock.right) x = maxX;
  else if (dock.left) x = minX;
  if (dock.bottom) y = maxY;
  else if (dock.top) y = minY;
  return { ...dock, x, y };
}

export function snapTargets(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number | null; y: number | null } {
  const { minX, minY, maxX, maxY } = viewportBounds(width, height);
  let snapX: number | null = null;
  let snapY: number | null = null;
  if (x - minX <= SNAP_DISTANCE) snapX = minX;
  else if (maxX - x <= SNAP_DISTANCE) snapX = maxX;
  if (y - minY <= SNAP_DISTANCE) snapY = minY;
  else if (maxY - y <= SNAP_DISTANCE) snapY = maxY;
  return { x: snapX, y: snapY };
}

export function dockFromPosition(x: number, y: number, width: number, height: number): WidgetDock {
  const { minX, minY, maxX, maxY } = viewportBounds(width, height);
  x = clamp(x, minX, maxX);
  y = clamp(y, minY, maxY);
  const snaps = snapTargets(x, y, width, height);
  return {
    left: snaps.x === minX,
    right: snaps.x === maxX,
    top: snaps.y === minY,
    bottom: snaps.y === maxY,
    x: snaps.x ?? x,
    y: snaps.y ?? y,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
