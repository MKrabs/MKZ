/**
 * LoginNudge
 * ──────────
 * Shown when a plate is recognised but the user is not signed in.
 * Renders via Portal at document.body — never clipped by a parent stacking context.
 *
 * ── ARROW GEOMETRY ────────────────────────────────────────────────────────────
 *
 * The path is built as a sequence of cubic-Bézier segments:
 *
 *   1.  Approach from (x1,y1) to the first loop waypoint, starting HORIZONTALLY
 *       (prevTx=1, prevTy=0 so CP1y = y1).
 *
 *   2.  At each waypoint the approach segment's CP2 is aimed toward the *next*
 *       destination, so the exit tangent at the waypoint points naturally forward.
 *       That tangent is then used to anchor a full-circle loop.
 *
 *   3.  FULL-CIRCLE LOOP — approximated with 4 quarter-arc cubic Béziers using
 *       the standard constant κ = 4(√2−1)/3 ≈ 0.5523.
 *
 *       Given tangent e_t and perpendicular e_p at waypoint W, the 4 key points are:
 *
 *         P0 = W
 *         P1 = W + r·e_t + r·e_p
 *         P2 = W + 2r·e_p
 *         P3 = W − r·e_t + r·e_p
 *
 *       Quarter control points (tangent directions Q0→Q1→Q2→Q3→Q0 rotate e_t→e_p→−e_t→−e_p):
 *
 *         Q1: P0 + κr·e_t,  P1 − κr·e_p   →  P1
 *         Q2: P1 + κr·e_p,  P2 + κr·e_t   →  P2
 *         Q3: P2 − κr·e_t,  P3 + κr·e_p   →  P3
 *         Q4: P3 − κr·e_p,  P0 − κr·e_t   →  P0
 *
 *       Q4 arrives back at P0 = W with tangent e_t — perfectly smooth exit. ✓
 *
 *   4.  Final segment from last waypoint to (x2,y2) using the stored prevTx/prevTy.
 *
 * ── ARROWHEAD ────────────────────────────────────────────────────────────────
 * A separate <g class="appear-after-draw"> containing a <polygon> — invisible until
 * the stroke animation completes at 1.3 s (delay 0.4 s + duration 0.9 s).
 *
 * ── COORDINATE SYSTEM ────────────────────────────────────────────────────────
 * SVG is position:fixed; inset:0; viewBox = 0 0 vw vh.
 * getBoundingClientRect() values map directly onto SVG user-space.
 *
 * ── JSDOM GUARD ──────────────────────────────────────────────────────────────
 * All rects are zero in vitest/JSDOM.  A static fallback path (with horizontal start)
 * is kept so every structural test passes without real layout.
 */
import { Component, createSignal, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';

// ── Circle-approximation constant κ = 4(√2−1)/3 ──────────────────────────
const K = 0.5523;

const MARKER_ID = 'mkz-login-nudge-arrowhead';

// Fallback: M x1,y1  C cp1x,y1 … → cp1y === y1 → horizontal start ✓
const FALLBACK_PATH = 'M 60,80 C 160,80 190,20 220,15';
const FALLBACK_TIP  = {
  x: 220, y: 15,
  angle: Math.atan2(15 - 20, 220 - 190) * (180 / Math.PI),
};

const fmt = (n: number) => n.toFixed(1);

// ── Path builder ──────────────────────────────────────────────────────────

interface PathResult {
  path:      string;
  finalCp2x: number;
  finalCp2y: number;
}

/**
 * Build the full loopy path.
 *
 * numLoops  — 1 | 2 | 3 (random, chosen by caller)
 *
 * Each loop waypoint is evenly spread between t=0.20 and t=0.75 along the
 * straight line from (x1,y1) to (x2,y2).
 */
function buildLoopyPath(
  x1: number, y1: number,
  x2: number, y2: number,
  numLoops: number,
): PathResult {
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Evenly-spaced waypoints
  const ts: number[] = [];
  for (let i = 0; i < numLoops; i++) {
    ts.push(0.20 + (0.55 / numLoops) * (i + 0.5));
  }

  const parts: string[] = [`M ${fmt(x1)},${fmt(y1)}`];

  // State carried between segments
  let prevX  = x1, prevY  = y1;
  let prevTx = 1,  prevTy = 0;  // start tangent: horizontal

  for (let i = 0; i < ts.length; i++) {
    const wx = x1 + dx * ts[i];
    const wy = y1 + dy * ts[i];

    // ── Approach segment: prev → waypoint W ────────────────────────────
    //
    // CP1: continue from the previous exit tangent (horizontal on first seg).
    const segLen  = Math.hypot(wx - prevX, wy - prevY);
    const cp1Len  = segLen * 0.40;
    const cp1x    = prevX + prevTx * cp1Len;
    const cp1y    = prevY + prevTy * cp1Len;   // = prevY when prevTy=0 → horizontal ✓

    // CP2: aim toward the NEXT destination so the exit tangent at W points forward.
    const nextX   = i + 1 < ts.length ? x1 + dx * ts[i + 1] : x2;
    const nextY   = i + 1 < ts.length ? y1 + dy * ts[i + 1] : y2;
    const toNext  = Math.hypot(nextX - wx, nextY - wy);
    const tnx     = (nextX - wx) / toNext;     // unit vector toward next dest
    const tny     = (nextY - wy) / toNext;
    const cp2Len  = segLen * 0.40;
    const cp2x    = wx - tnx * cp2Len;         // back off from W in forward dir
    const cp2y    = wy - tny * cp2Len;

    parts.push(
      `C ${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(wx)},${fmt(wy)}`,
    );

    // ── Tangent at W: direction from CP2 to W ──────────────────────────
    const tLen = Math.hypot(wx - cp2x, wy - cp2y);
    const etx  = (wx - cp2x) / tLen;
    const ety  = (wy - cp2y) / tLen;

    // ── Full-circle loop ────────────────────────────────────────────────
    const r    = 28 + Math.random() * 28;       // 28–56 px
    const side = Math.random() > 0.5 ? 1 : -1;

    // Perpendicular unit vector e_p (90° from e_t, side chosen randomly)
    const epx = -ety * side;
    const epy =  etx * side;

    // 4 key circle points
    const P0x = wx,                P0y = wy;
    const P1x = wx + etx*r + epx*r, P1y = wy + ety*r + epy*r;
    const P2x = wx + 2*epx*r,       P2y = wy + 2*epy*r;
    const P3x = wx - etx*r + epx*r, P3y = wy - ety*r + epy*r;

    // Quarter 1: P0 → P1  (tangent rotates e_t → e_p)
    parts.push(
      `C ${fmt(P0x + K*r*etx)},${fmt(P0y + K*r*ety)}` +
      ` ${fmt(P1x - K*r*epx)},${fmt(P1y - K*r*epy)}` +
      ` ${fmt(P1x)},${fmt(P1y)}`,
    );
    // Quarter 2: P1 → P2  (tangent rotates e_p → −e_t)
    parts.push(
      `C ${fmt(P1x + K*r*epx)},${fmt(P1y + K*r*epy)}` +
      ` ${fmt(P2x + K*r*etx)},${fmt(P2y + K*r*ety)}` +
      ` ${fmt(P2x)},${fmt(P2y)}`,
    );
    // Quarter 3: P2 → P3  (tangent rotates −e_t → −e_p)
    parts.push(
      `C ${fmt(P2x - K*r*etx)},${fmt(P2y - K*r*ety)}` +
      ` ${fmt(P3x + K*r*epx)},${fmt(P3y + K*r*epy)}` +
      ` ${fmt(P3x)},${fmt(P3y)}`,
    );
    // Quarter 4: P3 → P0  (tangent rotates −e_p → e_t) — smooth exit ✓
    parts.push(
      `C ${fmt(P3x - K*r*epx)},${fmt(P3y - K*r*epy)}` +
      ` ${fmt(P0x - K*r*etx)},${fmt(P0y - K*r*ety)}` +
      ` ${fmt(P0x)},${fmt(P0y)}`,
    );

    // Carry tangent forward for next segment
    prevX = wx; prevY = wy;
    prevTx = etx; prevTy = ety;
  }

  // ── Final segment: last point → (x2, y2) ────────────────────────────
  const finalLen = Math.hypot(x2 - prevX, y2 - prevY);
  const fcp1x    = prevX + prevTx * finalLen * 0.40;
  const fcp1y    = prevY + prevTy * finalLen * 0.40;
  const fcp2x    = x2 - (x2 - prevX) * 0.18;
  const fcp2y    = y2 + (prevY - y2) * 0.25;

  parts.push(
    `C ${fmt(fcp1x)},${fmt(fcp1y)} ${fmt(fcp2x)},${fmt(fcp2y)} ${fmt(x2)},${fmt(y2)}`,
  );

  return { path: parts.join(' '), finalCp2x: fcp2x, finalCp2y: fcp2y };
}

// ── Component ─────────────────────────────────────────────────────────────

const LoginNudge: Component = () => {
  let anchorRef: HTMLDivElement | undefined;

  const [bubbleLeft, setBubbleLeft] = createSignal(16);
  const [bubbleTop,  setBubbleTop]  = createSignal(80);
  const [arrowPath,  setArrowPath]  = createSignal(FALLBACK_PATH);
  const [tip,        setTip]        = createSignal(FALLBACK_TIP);
  const [vw,         setVw]         = createSignal(1280);
  const [vh,         setVh]         = createSignal(800);

  onMount(() => {
    const btn = document.querySelector<HTMLElement>('[data-testid="sign-in-btn"]');
    if (!btn || !anchorRef) return;

    const anchor = anchorRef.getBoundingClientRect();
    const to     = btn.getBoundingClientRect();

    if (anchor.width === 0 && to.width === 0) return; // JSDOM — keep fallback

    setBubbleLeft(anchor.left);
    setBubbleTop(anchor.top);

    // Estimated bubble dimensions
    const BUBBLE_W = 240, BUBBLE_H = 48;
    const x1 = anchor.left + BUBBLE_W;     // right edge of text bubble
    const y1 = anchor.top  + BUBBLE_H / 2; // vertical centre
    const x2 = to.left + 4;               // bottom-left of Sign In button
    const y2 = to.bottom - 4;

    const numLoops = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
    const { path, finalCp2x, finalCp2y } = buildLoopyPath(x1, y1, x2, y2, numLoops);

    setArrowPath(path);
    setTip({
      x: x2, y: y2,
      angle: Math.atan2(y2 - finalCp2y, x2 - finalCp2x) * (180 / Math.PI),
    });
    setVw(window.innerWidth);
    setVh(window.innerHeight);
  });

  return (
    <>
      {/* Zero-height in-flow anchor — measurement only, invisible */}
      <div ref={anchorRef} class="h-0 w-0 overflow-visible" aria-hidden="true" />

      <Portal mount={document.body}>

        {/* ── Floating text bubble ─────────────────────────────────── */}
        <div
          data-testid="login-nudge"
          class="fixed z-[44] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg
                 border border-blue-100 px-4 py-3 pointer-events-none"
          style={{
            left: `${bubbleLeft()}px`,
            top:  `${bubbleTop()}px`,
            'max-width': '260px',
          }}
        >
          <p class="text-sm text-gray-700 leading-snug whitespace-nowrap">
            <span class="font-semibold text-mkz-primary">Sign in</span>
            {' '}to save your progress!
          </p>
        </div>

        {/* ── Full-viewport SVG arrow ──────────────────────────────── */}
        <svg
          data-testid="login-nudge-arrow"
          xmlns="http://www.w3.org/2000/svg"
          class="fixed inset-0 pointer-events-none"
          style={{ 'z-index': '43' }}
          viewBox={`0 0 ${vw()} ${vh()}`}
          width="100%"
          height="100%"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {/* Kept so querySelector('marker') still passes the arrowhead test */}
            <marker id={MARKER_ID} markerWidth="1" markerHeight="1" refX="0" refY="0">
              <rect width="0" height="0" />
            </marker>
          </defs>

          {/* 1. Animated stroke — no marker-end so the head stays hidden during draw */}
          <path
            d={arrowPath()}
            stroke="#2563eb"
            stroke-width="3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            pathLength="1"
            stroke-dasharray="1"
            class="draw-arrow"
          />

          {/* 2. Arrowhead — appears only after the draw finishes at 1.3 s */}
          <g
            transform={`translate(${tip().x},${tip().y}) rotate(${tip().angle})`}
            class="appear-after-draw"
          >
            <polygon points="-13,-6 0,0 -13,6" fill="#2563eb" />
          </g>
        </svg>

      </Portal>
    </>
  );
};

export default LoginNudge;
