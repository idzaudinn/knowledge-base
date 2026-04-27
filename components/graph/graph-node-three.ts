import * as THREE from "three";
import type { GraphNode } from "@/lib/types";

function parseHexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  if (h.length !== 6) return { r: 100, g: 116, b: 139 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function textColorOnBackground(hex: string): string {
  const { r, g, b } = parseHexToRgb(hex);
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return l > 0.55 ? "#0f172a" : "#f1f5f9";
}

/** Draw wrapped lines that fit in maxW; returns how many lines used */
function fitWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
  startFont: number
): { lines: string[]; fontSize: number } {
  let fontSize = startFont;
  for (; fontSize >= 10; fontSize -= 1) {
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const tryLine = line ? `${line} ${w}` : w;
      if (ctx.measureText(tryLine).width <= maxW) {
        line = tryLine;
      } else {
        if (line) lines.push(line);
        if (ctx.measureText(w).width > maxW) {
          // single long word: hard-break
          let acc = w;
          while (acc.length > 0) {
            let j = acc.length;
            while (j > 0 && ctx.measureText(acc.slice(0, j)).width > maxW) j--;
            if (j === 0) j = 1;
            lines.push(acc.slice(0, j));
            acc = acc.slice(j);
            if (lines.length >= maxLines) return { lines: lines.slice(0, maxLines), fontSize };
          }
          line = "";
        } else {
          line = w;
        }
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
  }
  return { lines: [text.slice(0, 24) + "…"], fontSize: 10 };
}

/**
 * One billboard sprite: filled circle (node color) + label text centered inside.
 * The label is always on the node, not a separate floating box.
 */
export function createLabeledNode(
  n: GraphNode,
  options: { meshColor: string; size: number }
): THREE.Object3D {
  const { meshColor, size } = options;
  const scaleW = 6 * Math.max(0.4, Math.min(2.4, size * 0.5));

  const label = (n.label || "—").trim() || "—";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Sprite();
  }
  const texSize = 512;
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  canvas.width = texSize * dpr;
  canvas.height = texSize * dpr;
  ctx.scale(dpr, dpr);

  const cx = texSize / 2;
  const cy = texSize / 2;
  const radius = texSize * 0.44;

  const { r, g, b } = parseHexToRgb(meshColor);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const textPad = texSize * 0.1;
  const maxTextW = radius * 1.5;
  const maxLines = 4;
  const startFont = Math.min(32, Math.max(14, Math.floor(texSize * 0.07)));
  const { lines, fontSize } = fitWrappedLines(ctx, label, maxTextW, maxLines, startFont);
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const fg = textColorOnBackground(`#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`);

  const lineH = fontSize * 1.15;
  const totalH = lines.length * lineH;
  let yStart = cy - totalH / 2 + lineH * 0.35;
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const line of lines) {
    ctx.fillText(line, cx, yStart, maxTextW);
    yStart += lineH;
  }

  const map = new THREE.CanvasTexture(canvas);
  map.minFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({
    map,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 0;
  sprite.scale.set(scaleW, scaleW, 1);
  return sprite;
}
