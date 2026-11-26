// Small geometry + RNG helpers shared by the simulation, the renderer and the tests.

export interface Pt {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Deterministic PRNG (mulberry32). Every run is reproducible from its seed. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/**
 * Intersection of segment A→B with segment C→D.
 * Returns the point, or null when they do not properly cross.
 */
export function segIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): Pt | null {
  const rx = bx - ax, ry = by - ay;
  const sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + rx * t, y: ay + ry * t };
}

/** Signed area (shoelace). Positive or negative depending on winding. */
export function polyArea(p: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[(i + 1) % n];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a / 2;
}

export function polyPerimeter(p: readonly Pt[]): number {
  let l = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[(i + 1) % n];
    l += Math.hypot(q.x - p[i].x, q.y - p[i].y);
  }
  return l;
}

export function polyCentroid(p: readonly Pt[]): Pt {
  let x = 0, y = 0;
  for (const q of p) {
    x += q.x;
    y += q.y;
  }
  return { x: x / p.length, y: y / p.length };
}

export function pointInPoly(x: number, y: number, p: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i].x, yi = p[i].y, xj = p[j].x, yj = p[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Squared distance from point P to segment A→B. */
export function distToSegSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}

/**
 * How round a closed loop is: 4πA / P². A perfect circle scores 1,
 * a square 0.785, a thin sliver close to 0.
 */
export function roundness(p: readonly Pt[]): number {
  const per = polyPerimeter(p);
  if (per <= 0) return 0;
  return clamp((4 * Math.PI * Math.abs(polyArea(p))) / (per * per), 0, 1);
}

export function circlePoly(cx: number, cy: number, r: number, n = 28): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

export function scalePoly(p: readonly Pt[], k: number): Pt[] {
  const c = polyCentroid(p);
  return p.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }));
}
