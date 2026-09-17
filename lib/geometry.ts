import type { MoveKind, Vec } from "./scene";

/** Catmull-Rom through every point, emitted as a cubic Bézier `d` string. */
export function curvePath(points: Vec[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    const a = points[0];
    const b = points[points.length - 1];
    return `M ${r(a.x)} ${r(a.y)} L ${r(b.x)} ${r(b.y)}`;
  }
  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * Ramer–Douglas–Peucker. A drag produces ~300 points; 0.25 m tolerance cuts
 * that to roughly 8 without anyone seeing the difference.
 */
export function simplify(points: Vec[], tolerance = 0.25): Vec[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist <= tolerance) return [first, last];

  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * A curve sampled into a dense polyline with cumulative arc lengths — enough to
 * answer "where is the token at 40% of this move?" without measuring the DOM.
 */
export type Sampled = { pts: Vec[]; cum: number[]; length: number };

export function sample(points: Vec[], stepSize = 0.25): Sampled {
  const dense = densify(points, stepSize);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  return { pts: dense, cum, length: cum[cum.length - 1] ?? 0 };
}

function densify(points: Vec[], stepSize: number): Vec[] {
  if (points.length < 3) return points.slice();
  const out: Vec[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(segLen / stepSize));
    for (let s = 0; s < steps; s++) {
      out.push(catmullAt(p0, p1, p2, p3, s / steps));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function catmullAt(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function pointAtLength(s: Sampled, length: number): Vec {
  if (s.pts.length === 0) return { x: 0, y: 0 };
  const target = Math.max(0, Math.min(length, s.length));
  let lo = 0;
  let hi = s.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return s.pts[0];
  const span = s.cum[lo] - s.cum[lo - 1] || 1;
  const t = (target - s.cum[lo - 1]) / span;
  const a = s.pts[lo - 1];
  const b = s.pts[lo];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** The first `length` metres of the curve, for a path that draws itself. */
export function subPath(s: Sampled, length: number, wavy = false): string {
  const target = Math.max(0.001, Math.min(length, s.length));
  let d = "";
  for (let i = 0; i < s.pts.length; i++) {
    if (s.cum[i] > target) break;
    const p = wavy ? wave(s, i) : s.pts[i];
    d += `${i === 0 ? "M" : " L"} ${r(p.x)} ${r(p.y)}`;
  }
  const tip = wavy ? { ...pointAtLength(s, target) } : pointAtLength(s, target);
  d += `${d ? " L" : "M"} ${r(tip.x)} ${r(tip.y)}`;
  return d;
}

/** The dribble squiggle: displace along the normal so the line reads as carrying. */
function wave(s: Sampled, i: number): Vec {
  const p = s.pts[i];
  const a = s.pts[Math.max(0, i - 1)];
  const b = s.pts[Math.min(s.pts.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const m = Math.hypot(dx, dy) || 1;
  const off = Math.sin(s.cum[i] * 2.6) * 0.42;
  return { x: p.x + (-dy / m) * off, y: p.y + (dx / m) * off };
}

export function headAt(s: Sampled, length: number): { x: number; y: number; angle: number } {
  const target = Math.max(0.4, Math.min(length, s.length));
  const tip = pointAtLength(s, target);
  const back = pointAtLength(s, Math.max(0, target - 0.6));
  return { x: tip.x, y: tip.y, angle: (Math.atan2(tip.y - back.y, tip.x - back.x) * 180) / Math.PI };
}

/** Stroke vocabulary — one style per move kind, standard coaching notation. */
export const MOVE_STYLE: Record<MoveKind, { width: number; dash: string; head: number; wavy: boolean; label: string }> = {
  run: { width: 0.26, dash: "", head: 1, wavy: false, label: "Corrida" },
  dribble: { width: 0.26, dash: "", head: 1, wavy: true, label: "Condução" },
  pass: { width: 0.24, dash: "1.05 0.75", head: 1, wavy: false, label: "Passe" },
  shot: { width: 0.42, dash: "", head: 1.35, wavy: false, label: "Remate" },
  screen: { width: 0.26, dash: "", head: 0, wavy: false, label: "Bloqueio" },
};
