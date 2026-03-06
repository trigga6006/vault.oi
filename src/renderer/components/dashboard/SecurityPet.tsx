/**
 * SecurityPet — pixel-art companion.
 *
 * Three distinct creatures, selectable in Settings:
 *   UV      — bioluminescent octopus  (round blob + tentacles + antennae)
 *   Void    — shadow wraith           (tall flame shape + glowing eyes + smoke)
 *   Crystal — floating gem            (diamond body + orbiting fragments + refraction)
 *
 * Canvas: 64x72 internal pixels, CSS 2x upscale -> 128x144 px.
 * Two loops: 60fps CSS translateY float + 10fps canvas pixel redraw.
 */

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';
import { usePetHealth, type PetMood } from '../../hooks/usePetHealth';
import { useUiStore, type PetKind } from '../../store/ui-store';

// -- Canvas constants ---------------------------------------------------------
const SW    = 64;
const SH    = 72;
const SCALE = 2;
const CX    = 32;
const CY    = 26;
const BR    = 19.2;

// -- Sparkle seed table (shared by all creatures) -----------------------------
const SPARK_SEEDS = [0.17, 0.43, 0.61, 0.29, 0.77, 0.52, 0.08, 0.91, 0.35, 0.66];

// -- Reaction system (shared) -------------------------------------------------
type ReactionKind = 'twirl' | 'ripple' | 'wave' | 'scatter' | 'engulf' | 'shatter' | 'prismatic';
interface Reaction { kind: ReactionKind; startTs: number; dur: number }
interface ReactionMod {
  rippleAmp:  number;
  rippleFreq: number;
  tentBoost:  number;
  colorFlash: number;
  edgeDrop:   number;
  hueShift:   number;
  sizeScale:  number;  // multiplier on creature dimensions (1 = normal)
}
const NO_MOD: ReactionMod = { rippleAmp: 0, rippleFreq: 0, tentBoost: 0, colorFlash: 0, edgeDrop: 0, hueShift: 0, sizeScale: 1 };
const REACTION_DUR: Record<ReactionKind, number> = {
  twirl: 920, ripple: 860, wave: 740, scatter: 800,
  engulf: 1400, shatter: 1000, prismatic: 900,
};

// -- Ghost helper (shared dead-mood animation) --------------------------------
function drawGhost(ctx: CanvasRenderingContext2D, ghostY: number, color: string) {
  if (ghostY <= 0.5) return;
  const gy = Math.floor(CY - ghostY * 2.3);
  const gx = CX - 3;
  const fade = Math.max(0, 0.85 - ghostY / 24);
  if (fade <= 0.05 || gy < 0) return;
  ctx.globalAlpha = fade;
  ctx.fillStyle = color;
  const shape = [[0,1,0],[1,1,1],[1,1,1],[1,0,1]];
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < 3; c++) {
      const px = gx + c * 2, py = gy + r * 2;
      if (shape[r][c] && py >= 0 && py + 1 < SH && px >= 0 && px + 1 < SW)
        ctx.fillRect(px, py, 2, 2);
    }
  ctx.globalAlpha = 1;
}

// =============================================================================
//  UV — Bioluminescent Octopus
// =============================================================================

function blobR(angle: number, t: number, mood: PetMood): number {
  if (mood === 'thriving')
    return BR * (1
      + 0.09 * Math.sin(angle * 3 + t * 1.6)
      + 0.05 * Math.sin(angle * 5 - t * 1.2)
      + 0.04 * Math.cos(angle * 2 + t * 0.9));
  if (mood === 'content')
    return BR * 0.96 * (1 + 0.05 * Math.sin(angle * 3 + t * 1.0));
  if (mood === 'worried')
    return BR * 0.90 * (1
      + 0.05 * Math.sin(angle * 3 + t * 0.7)
      + 0.03 * Math.sin(angle * 6 + t * 0.4));
  if (mood === 'critical')
    return BR * 0.87 * (1
      + 0.10 * Math.sin(angle * 4 + t * 2.8)
      + 0.06 * Math.sin(angle * 7 + t * 2.0));
  return BR * 0.82;
}

function uvBodyColor(
  band: number, angle: number, dist: number, t: number,
  mood: PetMood, flash = 0, hueShift = 0,
): string {
  let h: number, l: number, c: number;
  if (mood === 'thriving') {
    const shimmer =
      Math.sin(t * 1.6 + dist * 0.325) * 26
      + Math.cos(angle * 2.5 + t * 1.1) * 18
      + Math.cos(t * 2.8 + angle * 1.4) * 10;
    h = 342 - band * 78 + shimmer;
    l = 0.84 - band * 0.52;
    c = 0.28 - band * 0.04;
  } else if (mood === 'content') {
    const shimmer = Math.sin(t * 0.9 + dist * 0.225) * 12;
    h = 275 - band * 35 + shimmer; l = 0.70 - band * 0.42; c = 0.23 - band * 0.03;
  } else if (mood === 'worried') {
    const shimmer = Math.sin(t * 0.7 + dist * 0.15) * 8;
    h = 68 - band * 28 + shimmer; l = 0.78 - band * 0.46; c = 0.20 - band * 0.04;
  } else if (mood === 'critical') {
    const shimmer = Math.sin(t * 3.2 + dist * 0.45) * 7;
    h = 24 - band * 12 + shimmer; l = 0.68 - band * 0.38; c = 0.26 - band * 0.06;
  } else {
    h = 280; l = 0.50 - band * 0.28; c = 0.006;
  }
  if (flash > 0.005) { l += (0.96 - l) * flash * 0.55; c *= (1 - flash * 0.22); }
  h = ((h + hueShift) % 360 + 360) % 360;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

interface Tent { bx: number; len: number; amp: number; freq: number; ph: number }
const UV_TENTS: Record<PetMood, Tent[]> = {
  thriving: [
    { bx: 20, len: 16, amp: 3.2, freq: 2.6, ph: 0.0 },
    { bx: 23, len: 22, amp: 4.4, freq: 2.3, ph: 0.9 },
    { bx: 27, len: 26, amp: 5.0, freq: 2.0, ph: 1.8 },
    { bx: 32, len: 28, amp: 5.4, freq: 1.7, ph: 2.7 },
    { bx: 37, len: 26, amp: 5.0, freq: 2.0, ph: 3.6 },
    { bx: 41, len: 22, amp: 4.4, freq: 2.3, ph: 4.5 },
    { bx: 44, len: 16, amp: 3.2, freq: 2.6, ph: 5.4 },
  ],
  content: [
    { bx: 20, len: 16, amp: 3.0, freq: 1.8, ph: 0.0 },
    { bx: 26, len: 20, amp: 3.8, freq: 1.5, ph: 1.1 },
    { bx: 32, len: 22, amp: 4.0, freq: 1.3, ph: 2.2 },
    { bx: 38, len: 20, amp: 3.8, freq: 1.5, ph: 3.3 },
    { bx: 44, len: 16, amp: 3.0, freq: 1.8, ph: 4.4 },
  ],
  worried: [
    { bx: 22, len: 14, amp: 2.2, freq: 1.2, ph: 0.0 },
    { bx: 32, len: 16, amp: 2.6, freq: 1.0, ph: 1.6 },
    { bx: 42, len: 14, amp: 2.2, freq: 1.2, ph: 3.2 },
  ],
  critical: [
    { bx: 26, len: 10, amp: 1.4, freq: 0.8, ph: 0.0 },
    { bx: 38, len: 10, amp: 1.4, freq: 0.8, ph: 1.6 },
  ],
  dead: [],
};

function uvTentColor(j: number, total: number, t: number, mood: PetMood): string {
  const b = j / total;
  if (mood === 'thriving') {
    const h = 320 - b * 85 + Math.sin(t * 2.0 + j * 0.5) * 20;
    return `oklch(${(0.72 - b * 0.40).toFixed(3)} ${(0.25 - b * 0.06).toFixed(3)} ${((h + 360) % 360).toFixed(1)})`;
  }
  if (mood === 'content')
    return `oklch(${(0.60 - b * 0.32).toFixed(3)} 0.21 ${(268 - b * 30).toFixed(1)})`;
  if (mood === 'worried')
    return `oklch(${(0.64 - b * 0.30).toFixed(3)} 0.17 ${(62 - b * 22).toFixed(1)})`;
  if (mood === 'critical')
    return `oklch(${(0.55 - b * 0.26).toFixed(3)} 0.22 ${(22 - b * 8).toFixed(1)})`;
  return 'oklch(0 0 0)';
}

interface Antenna { bx: number; len: number; amp: number; freq: number; ph: number }
const UV_ANTENNAE: Partial<Record<PetMood, Antenna[]>> = {
  thriving: [
    { bx: 24, len: 12, amp: 2.2, freq: 1.5, ph: 0.0 },
    { bx: 32, len: 16, amp: 1.2, freq: 1.2, ph: 1.3 },
    { bx: 40, len: 12, amp: 2.2, freq: 1.5, ph: 2.6 },
  ],
  content: [
    { bx: 26, len: 8, amp: 1.8, freq: 1.0, ph: 0.0 },
    { bx: 38, len: 8, amp: 1.8, freq: 1.0, ph: 1.8 },
  ],
  worried: [{ bx: 32, len: 6, amp: 1.0, freq: 0.6, ph: 0.0 }],
};

function uvAntColor(frac: number, t: number, ph: number, mood: PetMood): string {
  if (mood === 'thriving') {
    const h = ((338 - frac * 55 + Math.sin(t * 2.2 + ph) * 14) % 360 + 360) % 360;
    return `oklch(${(0.58 + frac * 0.38).toFixed(3)} ${(0.25 - frac * 0.06).toFixed(3)} ${h.toFixed(1)})`;
  }
  if (mood === 'content') return `oklch(${(0.52 + frac * 0.16).toFixed(3)} 0.18 275)`;
  return `oklch(${(0.44 + frac * 0.10).toFixed(3)} 0.11 70)`;
}

function drawUV(ctx: CanvasRenderingContext2D, mood: PetMood, t: number, ghostY: number, mod: ReactionMod) {
  const tentMult = 1 + mod.tentBoost;

  // 0. Antennae (before body — body covers base)
  const antBaseY = Math.round(CY - BR * 0.62);
  for (const ant of (UV_ANTENNAE[mood] ?? [])) {
    for (let j = 0; j < ant.len; j++) {
      const tx = Math.round(ant.bx + Math.sin(j * 0.35 + t * ant.freq + ant.ph) * ant.amp);
      const ty = antBaseY - j;
      if (tx < 0 || tx >= SW || ty < 0 || ty >= SH) continue;
      ctx.fillStyle = uvAntColor(j / (ant.len - 1), t, ant.ph, mood);
      ctx.fillRect(tx, ty, 1, 1);
    }
    if (mood === 'thriving') {
      const tipJ = ant.len - 1;
      const tx = Math.round(ant.bx + Math.sin(tipJ * 0.35 + t * ant.freq + ant.ph) * ant.amp);
      const ty = antBaseY - tipJ;
      if (tx >= 0 && tx + 1 < SW && ty >= 0 && ty + 1 < SH) {
        const h = ((310 + Math.sin(t * 2.5 + ant.ph) * 22) % 360 + 360) % 360;
        ctx.fillStyle = `oklch(0.97 0.30 ${h.toFixed(1)})`;
        ctx.fillRect(tx, ty, 2, 2);
      }
    }
  }

  // 1. Body
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const dx = x - CX, dy = y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const ripple = mod.rippleAmp > 0 ? mod.rippleAmp * Math.sin(angle * mod.rippleFreq + t * 4.0) : 0;
      const r = blobR(angle, t, mood) * (1 + ripple);
      if (dist > r) continue;
      const band = dist / r;
      if (mod.edgeDrop > 0 && band > 0.45 && Math.random() < mod.edgeDrop * ((band - 0.45) / 0.55)) continue;
      ctx.fillStyle = uvBodyColor(band, angle, dist, t, mood, mod.colorFlash, mod.hueShift);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 2. Tentacles (AFTER body — roots draw on top, always connected)
  const maxDy = Math.ceil(BR * 1.4);
  for (const tent of UV_TENTS[mood]) {
    const dx = tent.bx - CX;
    let startY = Math.round(CY + BR * 0.92);
    for (let dy = 0; dy <= maxDy; dy++) {
      if (Math.sqrt(dx * dx + dy * dy) >= blobR(Math.atan2(dy, dx), t, mood)) {
        startY = Math.floor(CY + dy) - 2;
        break;
      }
    }
    for (let j = 0; j < tent.len; j++) {
      const xOff = Math.sin(j * 0.5 + t * tent.freq + tent.ph) * tent.amp * tentMult;
      const tx = Math.round(tent.bx + xOff);
      const ty = startY + j;
      if (tx < 0 || tx >= SW || ty < 0 || ty >= SH) continue;
      ctx.fillStyle = uvTentColor(j, tent.len, t, mood);
      ctx.fillRect(tx, ty, j < tent.len * 0.55 && tx + 1 < SW ? 2 : 1, 1);
    }
  }

  // 3. Sparkles
  if (mood === 'thriving') {
    for (let i = 0; i < SPARK_SEEDS.length; i++) {
      const bright = (Math.sin(t * 1.3 + SPARK_SEEDS[i] * Math.PI * 2) + 1) / 2;
      if (bright > 0.82) {
        const bk = Math.floor(t * 0.4 + SPARK_SEEDS[i] * 7);
        const sx = 2 + Math.floor(((SPARK_SEEDS[i] * 137 + bk * 31) % 1 + 1) % 1 * (SW - 4));
        const sy = 2 + Math.floor(((SPARK_SEEDS[i] * 251 + bk * 17) % 1 + 1) % 1 * (SH - 4));
        ctx.fillStyle = `oklch(0.92 0.08 ${(300 + SPARK_SEEDS[i] * 60).toFixed(0)})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
  }

  // 4. Glitch
  if (mood === 'critical' && Math.random() < 0.22) {
    const row = Math.floor(CY - BR * 0.8 + Math.random() * BR * 1.6);
    if (row >= 0 && row < SH) {
      const data = ctx.getImageData(0, row, SW, 1);
      ctx.clearRect(0, row, SW, 1);
      ctx.putImageData(data, Math.round(Math.random() * 3) - 1, row);
    }
  }

  // 5. Ghost
  if (mood === 'dead') drawGhost(ctx, ghostY, 'oklch(0.72 0.04 285)');
}

// =============================================================================
//  VOID — Shadow Wraith
//  Tall flickering flame with per-pixel fire noise, cat-slit eyes, shadow
//  tendrils, ember sparks, smoke wisps, and a dark energy ring.
// =============================================================================

interface VoidTendril { angle: number; len: number; amp: number; freq: number; ph: number }
const VOID_TENDRILS: Partial<Record<PetMood, VoidTendril[]>> = {
  thriving: [
    { angle: Math.PI * 0.62, len: 18, amp: 3.0, freq: 2.2, ph: 0.0 },
    { angle: Math.PI * 0.38, len: 18, amp: 3.0, freq: 2.2, ph: 1.4 },
    { angle: Math.PI * 0.80, len: 13, amp: 2.2, freq: 2.8, ph: 2.8 },
    { angle: Math.PI * 0.20, len: 13, amp: 2.2, freq: 2.8, ph: 4.2 },
    { angle: Math.PI * 0.50, len: 22, amp: 3.5, freq: 1.8, ph: 5.0 },
  ],
  content: [
    { angle: Math.PI * 0.60, len: 14, amp: 2.4, freq: 1.8, ph: 0.0 },
    { angle: Math.PI * 0.40, len: 14, amp: 2.4, freq: 1.8, ph: 1.4 },
    { angle: Math.PI * 0.50, len: 16, amp: 2.8, freq: 1.4, ph: 3.5 },
  ],
  worried: [
    { angle: Math.PI * 0.55, len: 10, amp: 1.6, freq: 1.2, ph: 0.0 },
    { angle: Math.PI * 0.45, len: 10, amp: 1.6, freq: 1.2, ph: 2.0 },
  ],
  critical: [
    { angle: Math.PI * 0.58, len: 14, amp: 3.0, freq: 3.5, ph: 0.0 },
    { angle: Math.PI * 0.42, len: 14, amp: 3.0, freq: 3.5, ph: 1.4 },
    { angle: Math.PI * 0.50, len: 16, amp: 3.4, freq: 4.0, ph: 3.0 },
  ],
};

function drawVoid(ctx: CanvasRenderingContext2D, mood: PetMood, t: number, ghostY: number, mod: ReactionMod) {
  const msBase = mood === 'thriving' ? 1.0 : mood === 'content' ? 0.85 : mood === 'worried' ? 0.72
               : mood === 'critical' ? 0.88 : 0.40;
  const ms = msBase * mod.sizeScale;
  const flameH = Math.round(32 * ms);
  const baseHalf = Math.round(11 * ms);
  const baseY = CY + Math.round(14 * ms);
  const tipY = baseY - flameH;
  const flickSpd = mood === 'critical' ? 5.0 : mood === 'worried' ? 4.2 : 3.2;
  const flickAmp = (mood === 'critical' ? 3.5 : 2.0) + mod.rippleAmp * 12;
  const heartbeat = Math.sin(t * 1.5) * 0.5 + 0.5;

  // Helper: flame half-width at row y
  const flameW = (y: number): number => {
    const p = Math.max(0, Math.min(1, (baseY - y) / flameH));
    return baseHalf * (1 - p * 0.86)
      + Math.sin(p * 5 + t * flickSpd) * flickAmp * p
      + Math.cos(p * 3.2 + t * flickSpd * 0.7) * flickAmp * 0.5 * p;
  };

  // 0. Shadow tendrils (before body — body covers roots)
  for (const tend of (VOID_TENDRILS[mood] ?? [])) {
    const dirX = Math.cos(tend.angle), dirY = Math.sin(tend.angle);
    const perpX = -dirY, perpY = dirX;
    const startR = baseHalf * 0.45;
    const ox = CX, oy = CY + 5;
    for (let j = 0; j < tend.len; j++) {
      const frac = j / tend.len;
      const wave = Math.sin(j * 0.5 + t * tend.freq + tend.ph) * tend.amp * (1 - frac * 0.4);
      const r = startR + j;
      const tx = Math.round(ox + dirX * r + perpX * wave);
      const ty = Math.round(oy + dirY * r + perpY * wave);
      if (tx < 0 || tx >= SW || ty < 0 || ty >= SH) continue;
      const fade = 1 - frac;
      const hue = (350 + Math.sin(t * 1.5 + tend.ph + j * 0.2) * 12 + 360) % 360;
      const ll = (mood === 'thriving' ? 0.22 : 0.16) * fade;
      const cc = (mood === 'thriving' ? 0.16 : 0.10) * fade;
      ctx.fillStyle = `oklch(${Math.max(0, ll).toFixed(3)} ${Math.max(0, cc).toFixed(3)} ${hue.toFixed(1)})`;
      ctx.fillRect(tx, ty, frac < 0.45 && tx + 1 < SW ? 2 : 1, 1);
    }
  }

  // 1. Outer shadow aura (scattered dark pixels orbiting the flame)
  if (mood !== 'dead') {
    const auraR = baseHalf + 6;
    for (let i = 0; i < 16; i++) {
      const seed = SPARK_SEEDS[i % SPARK_SEEDS.length];
      const ang = seed * Math.PI * 2 + t * 0.25 + i * 0.39;
      const r = auraR + Math.sin(t * 0.8 + seed * 5) * 3;
      const ax = Math.round(CX + Math.cos(ang) * r);
      const ay = Math.round(CY + 2 + Math.sin(ang) * r * 0.72);
      if (ax >= 0 && ax < SW && ay >= 0 && ay < SH) {
        const f = 0.08 + Math.sin(t * 1.5 + seed * 7) * 0.03;
        ctx.fillStyle = `oklch(${f.toFixed(3)} 0.06 300)`;
        ctx.fillRect(ax, ay, 1, 1);
      }
    }
  }

  // 2. Main flame body with per-pixel noise texture
  for (let y = tipY - 1; y <= baseY + 1; y++) {
    if (y < 0 || y >= SH) continue;
    const p = Math.max(0, Math.min(1, (baseY - y) / flameH));
    const halfW = flameW(y);
    const cx = CX + Math.sin(p * 2 + t * 1.8) * p * 1.8;

    for (let x = Math.floor(cx - halfW - 1); x <= Math.ceil(cx + halfW + 1); x++) {
      if (x < 0 || x >= SW) continue;
      const band = Math.abs(x - cx) / Math.max(halfW, 0.5);
      if (band > 1.08) continue;

      // Ragged edge dissolution
      if (band > 0.72 && Math.random() < (band - 0.72) / 0.36 * 0.50) continue;
      if (mod.edgeDrop > 0 && band > 0.4 && Math.random() < mod.edgeDrop * ((band - 0.4) / 0.6)) continue;

      // Per-pixel fire noise (boiling texture)
      const noise = Math.sin(x * 4.7 + y * 3.1 + t * 2.5) * 0.5
                  + Math.cos(x * 2.3 - y * 5.3 + t * 1.8) * 0.3
                  + Math.sin((x + y) * 2.1 + t * 3.2) * 0.2;

      let h: number, l: number, c: number;
      if (mood === 'thriving') {
        h = 350 - band * 22 - p * 18 + noise * 8;
        l = 0.30 - band * 0.14 + p * 0.05 + noise * 0.04;
        c = 0.22 - band * 0.10 + p * 0.03 + noise * 0.02;
        // Pulsing core heartbeat
        if (p < 0.30 && band < 0.22) {
          const cg = (1 - p / 0.30) * (1 - band / 0.22);
          l += 0.14 * cg * (0.7 + heartbeat * 0.3);
          c += 0.06 * cg;
          h -= 10 * cg;
        }
      } else if (mood === 'content') {
        h = 285 - band * 15 + noise * 5;
        l = 0.24 - band * 0.14 + noise * 0.03;
        c = 0.16 - band * 0.08 + noise * 0.015;
        if (p < 0.25 && band < 0.20) { l += 0.08 * (1 - p / 0.25); c += 0.03; }
      } else if (mood === 'worried') {
        h = 265 + noise * 4;
        l = 0.18 - band * 0.10 + noise * 0.025;
        c = 0.10 - band * 0.04;
      } else if (mood === 'critical') {
        h = 10 - band * 8 + noise * 6;
        l = 0.38 - band * 0.22 + Math.sin(t * 6) * 0.06 + noise * 0.04;
        c = 0.28 - band * 0.12;
        if (p < 0.35 && band < 0.25) l += 0.12 * (1 - p / 0.35) * (0.5 + Math.sin(t * 8) * 0.5);
      } else {
        h = 280; l = 0.07 + noise * 0.01; c = 0.02;
      }

      if (band > 0.65) l *= 1 - (band - 0.65) / 0.43 * 0.72;
      l += mod.colorFlash * 0.25;
      h = ((h + mod.hueShift) % 360 + 360) % 360;
      ctx.fillStyle = `oklch(${Math.max(0, l).toFixed(3)} ${Math.max(0, c).toFixed(3)} ${h.toFixed(1)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 3. Eyes — cat-slit style with glow halos
  if (mood !== 'dead') {
    const isBlinking = (t * 0.2) % 12 < 0.12;
    const eyeNarrow = Math.sin(t * 0.35) * 0.5 + 0.5; // 0-1 narrowing
    if (!isBlinking) {
      const eyeY = Math.round(CY - 2 * ms);
      const eyeSp = Math.round(4 * ms);
      const irisL = mood === 'critical' ? 0.55 + Math.sin(t * 5) * 0.15
                  : mood === 'thriving' ? 0.48 : 0.32;
      const pupilL = irisL + 0.20;
      const eyeHue = mood === 'critical' ? 15 : 355;

      for (const side of [-1, 1]) {
        const ecx = CX + side * eyeSp;

        // Glow halo — radius scales with creature size
        const glowR = Math.round(2.8 * Math.max(1, ms));
        for (let gy = -glowR; gy <= glowR; gy++) {
          for (let gx = -glowR; gx <= glowR; gx++) {
            const gpx = ecx + gx, gpy = eyeY + gy;
            if (gpx < 0 || gpx >= SW || gpy < 0 || gpy >= SH) continue;
            const gDist = Math.sqrt(gx * gx + gy * gy);
            if (gDist < 0.5 || gDist > glowR) continue;
            ctx.fillStyle = `oklch(${Math.max(0, 0.10 - gDist * 0.035 / Math.max(1, ms * 0.6)).toFixed(3)} 0.08 ${eyeHue})`;
            ctx.fillRect(gpx, gpy, 1, 1);
          }
        }

        // Eye slit — scales with size (huge during engulf)
        const eyeHW = eyeNarrow > 0.72 ? Math.max(1, Math.round(ms)) : Math.max(2, Math.round(1.5 * ms));
        const eyeRows = eyeNarrow > 0.82 ? Math.max(1, Math.round(ms)) : Math.max(2, Math.round(1.2 * ms));
        for (let ex = -eyeHW; ex <= eyeHW; ex++) {
          const px = ecx + ex;
          if (px < 0 || px >= SW) continue;
          const isCenter = Math.abs(ex) === 0;
          const bright = isCenter ? pupilL : irisL;
          const chr = isCenter ? 0.32 : 0.24;
          for (let ey = 0; ey < eyeRows; ey++) {
            const py = eyeY + ey;
            if (py < 0 || py >= SH) continue;
            ctx.fillStyle = `oklch(${bright.toFixed(3)} ${chr.toFixed(3)} ${eyeHue})`;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  // 4. Ember sparks (bright red/orange, rising fast)
  if (mood !== 'dead') {
    const emberN = mood === 'thriving' ? 7 : mood === 'content' ? 4 : 2;
    for (let i = 0; i < emberN; i++) {
      const seed = SPARK_SEEDS[(i + 3) % SPARK_SEEDS.length];
      const life = ((t * 0.6 + seed * 4) % 1.5);
      if (life < 1.0) {
        const rise = life * 14;
        const drift = Math.sin(seed * 8 + t * 1.8) * (2 + life * 3);
        const px = Math.round(CX + drift + (seed - 0.5) * 6);
        const py = Math.round(tipY + 4 - rise);
        if (px >= 0 && px < SW && py >= 0 && py < SH) {
          const fade = Math.max(0, 0.62 - life * 0.62);
          ctx.fillStyle = `oklch(${fade.toFixed(3)} 0.28 ${(15 + seed * 20).toFixed(1)})`;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }

  // 5. Smoke wisps (dark, slow, wider than embers)
  if (mood !== 'dead') {
    const smokeN = mood === 'thriving' ? 10 : mood === 'content' ? 6 : 4;
    for (let i = 0; i < smokeN; i++) {
      const seed = SPARK_SEEDS[i % SPARK_SEEDS.length];
      const life = ((t * 0.3 + seed * 5) % 2.5);
      if (life < 1.8) {
        const rise = life * 8;
        const drift = Math.sin(seed * 10 + t * 0.9) * (4 + life * 3);
        const px = Math.round(CX + drift);
        const py = Math.round(tipY - rise);
        if (px >= 0 && px < SW && py >= 0 && py < SH) {
          const fade = Math.max(0, 0.16 - life * 0.09);
          if (fade > 0.02) {
            ctx.fillStyle = `oklch(${fade.toFixed(3)} 0.06 330)`;
            ctx.fillRect(px, py, 1, 1);
            if (life > 0.4 && life < 1.2 && px + 1 < SW) {
              ctx.fillStyle = `oklch(${(fade * 0.6).toFixed(3)} 0.04 330)`;
              ctx.fillRect(px + 1, py, 1, 1);
            }
          }
        }
      }
    }
  }

  // 6. Dark energy ring (orbiting arc of pixels)
  if (mood === 'thriving' || mood === 'critical') {
    const ringR = baseHalf + 8;
    const ringSpd = mood === 'critical' ? 1.5 : 0.7;
    const ringA = t * ringSpd;
    for (let i = 0; i < 8; i++) {
      const a = ringA + (i - 3.5) * 0.17;
      const rx = Math.round(CX + Math.cos(a) * ringR);
      const ry = Math.round(CY + 3 + Math.sin(a) * ringR * 0.6);
      if (rx >= 0 && rx < SW && ry >= 0 && ry < SH) {
        const fade = Math.max(0, 0.22 - Math.abs(i - 3.5) * 0.05);
        ctx.fillStyle = `oklch(${fade.toFixed(3)} 0.18 345)`;
        ctx.fillRect(rx, ry, 1, 1);
      }
    }
  }

  // 7. Glitch (critical)
  if (mood === 'critical' && Math.random() < 0.30) {
    const row = Math.floor(CY - BR * 0.8 + Math.random() * BR * 1.6);
    if (row >= 0 && row < SH) {
      const data = ctx.getImageData(0, row, SW, 1);
      ctx.clearRect(0, row, SW, 1);
      ctx.putImageData(data, Math.round(Math.random() * 3) - 1, row);
    }
  }

  if (mood === 'dead') drawGhost(ctx, ghostY, 'oklch(0.38 0.12 350)');
}

// =============================================================================
//  CRYSTAL — Floating Gem
//  Faceted diamond with internal seam lines, 6-point core star, 3 refraction
//  beams, prismatic rainbow, aura glow, mini-diamond shards, light caustics.
// =============================================================================

function drawCrystal(ctx: CanvasRenderingContext2D, mood: PetMood, t: number, ghostY: number, mod: ReactionMod) {
  const ms = mood === 'thriving' ? 1.0 : mood === 'content' ? 0.92 : mood === 'worried' ? 0.80
           : mood === 'critical' ? 0.85 : 0.62;
  const halfW = Math.round(13 * ms * mod.sizeScale);
  const halfH = Math.round(17 * ms * mod.sizeScale);
  const cy = CY + 3;

  const lightAngle = t * 0.4;
  const pulse = Math.sin(t * 0.8) * 0.04;
  const wobble = mod.rippleAmp * 0.06;

  // 3 refraction beams
  const beam1Y = cy + Math.sin(t * 0.5) * halfH * 0.5;
  const beam2Y = cy + Math.cos(t * 0.38) * halfH * 0.4;
  const beam3Slope = 0.45;
  const beam3Off = Math.sin(t * 0.3) * 8;

  // Core star rotation
  const starRot = t * 0.12;
  const STAR_N = 6;

  // 0. Soft pulsing aura glow (faint ring outside diamond)
  if (mood !== 'dead') {
    for (let y = cy - halfH - 3; y <= cy + halfH + 3; y++) {
      for (let x = CX - halfW - 3; x <= CX + halfW + 3; x++) {
        if (x < 0 || x >= SW || y < 0 || y >= SH) continue;
        const d = Math.abs(x - CX) / halfW + Math.abs(y - cy) / halfH;
        if (d <= 1 || d > 1.22) continue;
        const glow = (1.22 - d) / 0.22;
        const aL = (mood === 'thriving' ? 0.30 : 0.20) * glow * (0.75 + pulse * 2);
        ctx.fillStyle = `oklch(${aL.toFixed(3)} 0.06 210)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // 1. Diamond body (full detail per-pixel)
  for (let y = cy - halfH; y <= cy + halfH; y++) {
    for (let x = CX - halfW; x <= CX + halfW; x++) {
      if (x < 0 || x >= SW || y < 0 || y >= SH) continue;
      const dx = x - CX, dy = y - cy;
      const d = Math.abs(dx) / halfW + Math.abs(dy) / halfH;
      if (d > 1 + wobble) continue;
      if (mod.edgeDrop > 0 && d > 0.5 && Math.random() < mod.edgeDrop * ((d - 0.5) / 0.5)) continue;

      // Facet lighting (8 sectors)
      const angle = Math.atan2(dy, dx);
      const facet = Math.floor(((angle + Math.PI) / (Math.PI / 4))) % 8;
      const facetAng = (facet + 0.5) * Math.PI / 4 - Math.PI;
      const lightDot = Math.cos(facetAng - lightAngle);

      // Facet seam lines (bright edges between facets)
      const withinFacet = ((angle + Math.PI) % (Math.PI / 4)) / (Math.PI / 4);
      const nearSeam = Math.min(withinFacet, 1 - withinFacet);
      const seamBright = nearSeam < 0.09 ? (0.09 - nearSeam) / 0.09 * 0.14 * d : 0;

      // Core star radial light lines (6-point star)
      let starBright = 0;
      for (let s = 0; s < STAR_N; s++) {
        const la = s * Math.PI / (STAR_N / 2) + starRot;
        const ldx = Math.cos(la), ldy = Math.sin(la);
        const proj = dx * ldx + dy * ldy;
        if (proj > 0) {
          const perp = Math.abs(dx * ldy - dy * ldx);
          if (perp < 1.3) starBright = Math.max(starBright, (1.3 - perp) / 1.3 * 0.08 * (1 - d * 0.5));
        }
      }

      // Refraction beams
      let refrBright = 0;
      const b1d = Math.abs(y - beam1Y);
      if (b1d < 1.2) refrBright += (1.2 - b1d) / 1.2 * 0.10;
      const b2d = Math.abs(y - beam2Y);
      if (b2d < 1.0) refrBright += (1.0 - b2d) / 1.0 * 0.07;
      const b3d = Math.abs((y - cy) - beam3Slope * (x - CX) - beam3Off);
      if (b3d < 1.3) refrBright += (1.3 - b3d) / 1.3 * 0.08;

      // Prismatic rainbow where beams are strong
      let prismShift = 0;
      if (refrBright > 0.10) prismShift = (dx / halfW) * 45;

      let h: number, l: number, c: number;
      if (mood === 'thriving') {
        h = 210 + lightDot * 15 + Math.cos(angle * 2 + t * 0.3) * 8 + prismShift;
        l = 0.92 - d * 0.50 + lightDot * 0.08 + pulse + refrBright + seamBright + starBright;
        c = 0.18 - d * 0.08 + lightDot * 0.03;
        if (prismShift !== 0) c += 0.06;
      } else if (mood === 'content') {
        h = 215 + lightDot * 10 + prismShift * 0.5;
        l = 0.82 - d * 0.46 + lightDot * 0.06 + pulse + refrBright * 0.8 + seamBright + starBright;
        c = 0.14 - d * 0.06;
      } else if (mood === 'worried') {
        h = 200 + lightDot * 8;
        l = 0.68 - d * 0.38 + lightDot * 0.04 + refrBright * 0.5 + seamBright * 0.7;
        c = 0.10 - d * 0.04;
      } else if (mood === 'critical') {
        const cr1 = Math.abs(Math.sin(dx * 2.2 + dy * 1.5 + t * 0.2));
        const cr2 = Math.abs(Math.sin(dx * 1.1 - dy * 2.8 + t * 0.15));
        const crackDark = (cr1 > 0.94 || cr2 > 0.96) ? -0.16 : 0;
        h = 195 + lightDot * 6;
        l = 0.58 - d * 0.34 + lightDot * 0.03 + crackDark + seamBright;
        c = 0.14 - d * 0.06;
      } else {
        h = 220; l = 0.35 - d * 0.20; c = 0.04;
      }

      // Bright rim
      if (d > 0.85 && d <= 1 + wobble) { l += 0.08; c += 0.04; }

      // Core brilliance (near-white center)
      if (d < 0.15 && mood !== 'dead') {
        const coreFac = 1 - d / 0.15;
        l += 0.12 * coreFac;
        c -= 0.04 * coreFac;
      }

      l += mod.colorFlash * 0.28;
      h = ((h + mod.hueShift) % 360 + 360) % 360;
      ctx.fillStyle = `oklch(${Math.max(0, Math.min(1, l)).toFixed(3)} ${Math.max(0, c).toFixed(3)} ${h.toFixed(1)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 2. Orbiting crystal shards (mini-diamond cross shapes with trailing glow)
  const fragN = mood === 'thriving' ? 4 : mood === 'content' ? 3 : mood === 'dead' ? 0 : 2;
  const orbitR = 22 + Math.sin(t * 1.2) * 3 + mod.tentBoost * 3;
  const orbitSpd = (mood === 'critical' ? 1.2 : 0.6) * (1 + mod.rippleAmp * 4);

  for (let i = 0; i < fragN; i++) {
    const a = (i / fragN) * Math.PI * 2 + t * orbitSpd;
    const fx = Math.round(CX + Math.cos(a) * orbitR);
    const fy = Math.round(cy + Math.sin(a) * orbitR * 0.65);
    const fH = 205 + Math.sin(t * 1.5 + i) * 10;
    const fL = mood === 'thriving' ? 0.82 : mood === 'content' ? 0.68 : 0.52;

    // Mini-diamond (5-pixel cross)
    for (const [sdx, sdy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]] as const) {
      const sx = fx + sdx, sy = fy + sdy;
      if (sx < 0 || sx >= SW || sy < 0 || sy >= SH) continue;
      const isCtr = sdx === 0 && sdy === 0;
      ctx.fillStyle = `oklch(${(isCtr ? fL : fL * 0.65).toFixed(3)} 0.14 ${fH.toFixed(1)})`;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Trailing glow (4 pixels behind the shard)
    for (let tr = 1; tr <= 4; tr++) {
      const ta = a - tr * 0.11;
      const tx = Math.round(CX + Math.cos(ta) * orbitR);
      const ty = Math.round(cy + Math.sin(ta) * orbitR * 0.65);
      if (tx >= 0 && tx < SW && ty >= 0 && ty < SH) {
        const trFade = fL * (0.30 - tr * 0.06);
        if (trFade > 0.02) {
          ctx.fillStyle = `oklch(${trFade.toFixed(3)} 0.04 ${fH.toFixed(1)})`;
          ctx.fillRect(tx, ty, 1, 1);
        }
      }
    }
  }

  // 3. Light caustics below crystal (dancing projected light spots)
  if ((mood === 'thriving' || mood === 'content') && cy + halfH + 6 < SH) {
    const causticY = cy + halfH + 6;
    for (let i = 0; i < 5; i++) {
      const seed = SPARK_SEEDS[(i + 5) % SPARK_SEEDS.length];
      const cx2 = CX + Math.sin(t * 0.6 + seed * 8) * halfW * 0.8;
      const cw = 1 + Math.floor(Math.sin(t * 0.4 + seed * 3) * 0.5 + 0.5);
      const cl = mood === 'thriving' ? 0.28 + Math.sin(t * 1.2 + seed * 5) * 0.08 : 0.18;
      const px = Math.round(cx2);
      if (px >= 0 && px + cw < SW) {
        ctx.fillStyle = `oklch(${cl.toFixed(3)} 0.06 210)`;
        ctx.fillRect(px, causticY, cw + 1, 1);
      }
    }
  }

  // 4. Ice sparkles (cross-shaped bursts inside the diamond)
  if (mood === 'thriving' || mood === 'content') {
    for (let i = 0; i < SPARK_SEEDS.length; i++) {
      const bright = (Math.sin(t * 1.8 + SPARK_SEEDS[i] * Math.PI * 2) + 1) / 2;
      if (bright > 0.82) {
        const bk = Math.floor(t * 0.5 + SPARK_SEEDS[i] * 7);
        const sx = CX - halfW + Math.floor(((SPARK_SEEDS[i] * 137 + bk * 31) % 1 + 1) % 1 * halfW * 2);
        const sy = cy - halfH + Math.floor(((SPARK_SEEDS[i] * 251 + bk * 17) % 1 + 1) % 1 * halfH * 2);
        if (sx >= 0 && sx < SW && sy >= 0 && sy < SH) {
          const sd = Math.abs(sx - CX) / halfW + Math.abs(sy - cy) / halfH;
          if (sd <= 1) {
            ctx.fillStyle = 'oklch(0.97 0.03 210)';
            ctx.fillRect(sx, sy, 1, 1);
            // Cross arms on brightest sparkles
            if (bright > 0.90) {
              for (const [cdx, cdy] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
                const cpx = sx + cdx, cpy = sy + cdy;
                if (cpx >= 0 && cpx < SW && cpy >= 0 && cpy < SH) {
                  ctx.fillStyle = 'oklch(0.78 0.05 210)';
                  ctx.fillRect(cpx, cpy, 1, 1);
                }
              }
            }
          }
        }
      }
    }
  }

  // 5. Glitch (critical)
  if (mood === 'critical' && Math.random() < 0.15) {
    const row = Math.floor(cy - halfH + Math.random() * halfH * 2);
    if (row >= 0 && row < SH) {
      const data = ctx.getImageData(0, row, SW, 1);
      ctx.clearRect(0, row, SW, 1);
      ctx.putImageData(data, Math.round(Math.random() * 3) - 1, row);
    }
  }

  if (mood === 'dead') drawGhost(ctx, ghostY, 'oklch(0.78 0.08 210)');
}

// =============================================================================
//  Frame dispatcher
// =============================================================================

function drawFrame(
  ctx: CanvasRenderingContext2D, mood: PetMood, t: number,
  ghostY: number, kind: PetKind, mod: ReactionMod = NO_MOD,
) {
  ctx.clearRect(0, 0, SW, SH);
  switch (kind) {
    case 'void':    return drawVoid(ctx, mood, t, ghostY, mod);
    case 'crystal': return drawCrystal(ctx, mood, t, ghostY, mod);
    default:        return drawUV(ctx, mood, t, ghostY, mod);
  }
}

// =============================================================================
//  Escape animation frame
// =============================================================================

interface EscapeFrame {
  petX:     number;
  petY:     number;
  clipPath: string;
  animated: boolean;
  easing:   string;
  dur:      number;
}

// =============================================================================
//  Component
// =============================================================================

export function SecurityPet({ keys }: { keys: ApiKeyMetadata[] }) {
  const { score, mood, label } = usePetHealth(keys);
  const petKind = useUiStore((s) => s.petKind);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floatRef  = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<{ ghostY: number; reaction: Reaction | null }>({
    ghostY: 0, reaction: null,
  });

  const escCanvasRef  = useRef<HTMLCanvasElement>(null);
  const isEscapingRef = useRef(false);
  const escTimers     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [escapeFrame, setEscapeFrame] = useState<EscapeFrame | null>(null);

  const triggerEscape = () => {
    if (isEscapingRef.current) return;
    const homeEl = canvasRef.current;
    if (!homeEl) return;

    if (floatRef.current) floatRef.current.style.transform = 'translateY(0px)';
    homeEl.getContext('2d')?.clearRect(0, 0, SW, SH);
    isEscapingRef.current = true;
    escTimers.current.forEach(clearTimeout);
    escTimers.current = [];

    const W = SW * SCALE, H = SH * SCALE;
    const vw = window.innerWidth, vh = window.innerHeight;
    const rc = (r: DOMRect) =>
      `inset(${r.top.toFixed(0)}px ${(vw - r.right).toFixed(0)}px ${(vh - r.bottom).toFixed(0)}px ${r.left.toFixed(0)}px)`;
    const HIDE = 'inset(50% 50% 50% 50%)';
    const F = (pX: number, pY: number, clip: string, anim: boolean, ease: string, dur: number): EscapeFrame =>
      ({ petX: pX, petY: pY, clipPath: clip, animated: anim, easing: ease, dur });
    const at = (ms: number, f: EscapeFrame | null) => {
      escTimers.current.push(setTimeout(() => {
        setEscapeFrame(f);
        if (f === null) isEscapingRef.current = false;
      }, ms));
    };

    const homeRect = homeEl.getBoundingClientRect();
    const homeX = homeRect.left + homeRect.width / 2 - W / 2;
    const homeY = homeRect.top + homeRect.height / 2 - H / 2;

    const sideEl = document.querySelector<HTMLElement>('aside');
    const sideRect = sideEl?.getBoundingClientRect() ?? new DOMRect(0, 0, 72, vh);
    const sidCX = sideRect.left + sideRect.width / 2 - W / 2;
    const sidY  = sideRect.top + sideRect.height * 0.62 - H / 2;
    const sidInX = sideRect.left - W - 2;

    const h1El = Array.from(document.querySelectorAll<HTMLElement>('h1'))
                   .find(h => /workspace|overview/i.test(h.textContent ?? ''));
    const ovCard = h1El?.closest<HTMLElement>('.glass-strong') ?? h1El?.parentElement;
    const ovRect = ovCard?.getBoundingClientRect() ?? new DOMRect(sideRect.right + 16, 32, 400, 120);
    const ovX     = ovRect.left + ovRect.width * 0.74 - W / 2;
    const ovLandY = ovRect.top + ovRect.height * 0.52 - H / 2;
    const ovExitY = ovRect.bottom + 6;

    setEscapeFrame(F(homeX, homeY, rc(homeRect), false, 'linear', 0));
    at(80,   F(homeX + 55, homeY - 95, rc(homeRect), true, 'ease-in', 0.62));
    at(700,  F(homeX + 55, homeY - 95, HIDE, false, 'linear', 0));
    at(750,  F(sidInX, sidY, rc(sideRect), false, 'linear', 0));
    at(830,  F(sidCX, sidY, rc(sideRect), true, 'cubic-bezier(0.16, 1, 0.3, 1)', 0.65));
    at(1680, F(sidInX, sidY, rc(sideRect), true, 'ease-in', 0.50));
    at(2220, F(sidInX, sidY, HIDE, false, 'linear', 0));
    at(2270, F(ovX, ovExitY, rc(ovRect), false, 'linear', 0));
    at(2350, F(ovX, ovLandY, rc(ovRect), true, 'cubic-bezier(0.16, 1, 0.3, 1)', 0.62));
    at(3200, F(ovX, ovExitY, rc(ovRect), true, 'ease-in', 0.50));
    at(3730, F(ovX, ovExitY, HIDE, false, 'linear', 0));
    at(3780, F(homeX, homeY - 88, rc(homeRect), false, 'linear', 0));
    at(3860, F(homeX, homeY, rc(homeRect), true, 'cubic-bezier(0.16, 1, 0.3, 1)', 0.72));
    at(4650, null);
  };

  useEffect(() => { if (mood !== 'dead') stateRef.current.ghostY = 0; }, [mood]);
  useEffect(() => () => { escTimers.current.forEach(clearTimeout); }, []);

  const handleClick = () => {
    if (isEscapingRef.current) return;
    if (Math.random() < 0.12) { triggerEscape(); return; }
    let kinds: ReactionKind[];
    if (petKind === 'void')         kinds = ['engulf', 'twirl', 'scatter', 'ripple'];
    else if (petKind === 'crystal') kinds = ['shatter', 'prismatic', 'scatter', 'wave'];
    else                            kinds = ['twirl', 'ripple', 'wave', 'scatter'];
    const pick = kinds[Math.floor(Math.random() * kinds.length)];
    stateRef.current.reaction = { kind: pick, startTs: performance.now(), dur: REACTION_DUR[pick] };
  };

  useEffect(() => {
    let rafId: number;
    const SPRITE_MS = 100;
    let lastSprite = 0;
    let nextFidget = performance.now() + 12000 + Math.random() * 8000;

    const fidgetPools: Record<PetKind, ReactionKind[]> = {
      void:    ['engulf', 'twirl', 'scatter', 'ripple'],
      crystal: ['shatter', 'prismatic', 'scatter', 'wave'],
      uv:      ['twirl', 'ripple', 'wave', 'scatter'],
    };

    const loop = (ts: number) => {
      const t = ts * 0.001;

      // -- Idle fidget: spontaneous animation every ~12-20s --
      if (ts >= nextFidget && !stateRef.current.reaction && !isEscapingRef.current && mood !== 'dead') {
        const pool = fidgetPools[petKind];
        const pick = pool[Math.floor(Math.random() * pool.length)];
        stateRef.current.reaction = { kind: pick, startTs: ts, dur: REACTION_DUR[pick] };
        nextFidget = ts + 12000 + Math.random() * 8000;
      }

      // -- Reaction --
      let mod: ReactionMod = NO_MOD;
      const rx = stateRef.current.reaction;
      if (rx) {
        const p = Math.min(1, (ts - rx.startTs) / rx.dur);
        if (p >= 1) { stateRef.current.reaction = null; }
        else {
          const ease = Math.sin(p * Math.PI);
          switch (rx.kind) {
            case 'twirl':
              mod = { rippleAmp: ease * 0.06, rippleFreq: 3, tentBoost: ease * 1.5,
                      colorFlash: ease * 0.10, edgeDrop: 0, hueShift: ease * 150, sizeScale: 1 }; break;
            case 'ripple':
              mod = { rippleAmp: ease * 0.07, rippleFreq: 5, tentBoost: ease * 3.0,
                      colorFlash: ease * 0.08, edgeDrop: 0, hueShift: 0, sizeScale: 1 }; break;
            case 'wave':
              mod = { rippleAmp: ease * 0.32, rippleFreq: 3, tentBoost: ease * 1.4,
                      colorFlash: ease * 0.12, edgeDrop: 0, hueShift: 0, sizeScale: 1 }; break;
            case 'scatter':
              mod = { rippleAmp: ease * 0.05, rippleFreq: 4, tentBoost: ease * 2.4,
                      colorFlash: ease * 0.22, edgeDrop: ease * 0.90, hueShift: 0, sizeScale: 1 }; break;
            case 'engulf':
              mod = { rippleAmp: ease * 0.12, rippleFreq: 3, tentBoost: ease * 2.0,
                      colorFlash: ease * 0.35, edgeDrop: 0, hueShift: 0, sizeScale: 1 + ease * 1.8 }; break;
            case 'shatter':
              mod = { rippleAmp: ease * 0.08, rippleFreq: 4, tentBoost: ease * 5.0,
                      colorFlash: ease * 0.30, edgeDrop: ease * 0.45, hueShift: 0, sizeScale: 1 - ease * 0.12 }; break;
            case 'prismatic':
              mod = { rippleAmp: ease * 0.04, rippleFreq: 3, tentBoost: ease * 1.0,
                      colorFlash: ease * 0.15, edgeDrop: 0, hueShift: ease * 220, sizeScale: 1 + ease * 0.06 }; break;
          }
        }
      }

      // -- 60fps: ambient float (kind-specific, frozen during escape) --
      if (floatRef.current && !isEscapingRef.current) {
        let bobY: number;
        if (petKind === 'void') {
          bobY = Math.sin(t * 0.65) * 3.5 + Math.sin(t * 1.3) * 1.2;
        } else if (petKind === 'crystal') {
          bobY = Math.sin(t * 0.5) * 2.8;
        } else {
          bobY = Math.sin(t * 0.82) * 4.2;
        }
        floatRef.current.style.transform = `translateY(${bobY.toFixed(2)}px)`;
      }

      if (mood === 'dead') stateRef.current.ghostY = (stateRef.current.ghostY + 0.075) % 28;

      // -- 10fps: pixel redraw --
      if (ts - lastSprite >= SPRITE_MS) {
        lastSprite = ts;
        if (isEscapingRef.current) {
          const ec = escCanvasRef.current;
          if (ec) {
            const ctx = ec.getContext('2d', { willReadFrequently: true });
            if (ctx) drawFrame(ctx, mood, t, 0, petKind, {
              rippleAmp: 0.05, rippleFreq: 3, tentBoost: 2.2,
              colorFlash: 0.06, edgeDrop: 0, hueShift: 0, sizeScale: 1,
            });
          }
        } else {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) drawFrame(ctx, mood, t, stateRef.current.ghostY, petKind, mod);
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [mood, petKind]);

  return (
    <div
      className="relative w-full flex flex-col items-center justify-center"
      style={{ minHeight: 200, flex: 1, cursor: 'pointer' }}
      onClick={handleClick}
    >
      <div ref={floatRef} style={{ willChange: 'transform' }}>
        <canvas
          ref={canvasRef}
          width={SW}
          height={SH}
          style={{ width: SW * SCALE, height: SH * SCALE, imageRendering: 'pixelated', display: 'block' }}
        />
      </div>

      <div className="pointer-events-none absolute bottom-3 inset-x-0 flex justify-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/55">
          security.pet&nbsp;·&nbsp;{label}&nbsp;·&nbsp;{score}%
        </span>
      </div>

      {escapeFrame !== null && createPortal(
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
          clipPath: escapeFrame.clipPath,
        }}>
          <div style={{
            position: 'absolute', left: escapeFrame.petX, top: escapeFrame.petY,
            transition: escapeFrame.animated
              ? `left ${escapeFrame.dur}s ${escapeFrame.easing}, top ${escapeFrame.dur}s ${escapeFrame.easing}`
              : 'none',
            willChange: 'left, top',
          }}>
            <canvas
              ref={escCanvasRef}
              width={SW} height={SH}
              style={{ width: SW * SCALE, height: SH * SCALE, imageRendering: 'pixelated', display: 'block' }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
