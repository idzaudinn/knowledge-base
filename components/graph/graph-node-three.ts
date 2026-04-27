import * as THREE from "three";
import type { GraphNode } from "@/lib/types";

function safeNodeColor(value: string): THREE.Color {
  const c = new THREE.Color();
  try {
    c.set(value);
  } catch {
    c.set(0x64748b);
  }
  return c;
}

/**
 * Text plate above the node. Kept separate from the sphere so the colored body
 * always renders even if a canvas/texture path misbehaves in some WebGL setups.
 */
function makeLabelSprite(text: string, fg: string): THREE.Sprite {
  const t = text.length > 40 ? text.slice(0, 38) + "…" : text;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Sprite();
  }
  const fontSize = 20;
  const padX = 10;
  const padY = 6;
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const w = Math.min(480, Math.ceil(ctx.measureText(t).width) + padX * 2);
  const h = fontSize + padY * 2;
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  canvas.width = Math.max(1, w * dpr);
  canvas.height = Math.max(1, h * dpr);
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "rgb(15, 23, 42)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgb(100, 116, 139)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.fillStyle = fg;
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t, w / 2, h / 2);

  const map = new THREE.CanvasTexture(canvas);
  map.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  const sx = w / 32;
  const syy = h / 32;
  sprite.scale.set(sx, syy, 1);
  return sprite;
}

/**
 * Colored sphere (real mesh) + optional label sprite. This is more reliable than
 * a single all-canvas billboard, which can fail to show in some environments.
 */
export function createLabeledNode(
  n: GraphNode,
  options: { meshColor: string; size: number }
): THREE.Object3D {
  const { meshColor, size } = options;
  const s = Number.isFinite(size) && size > 0 ? size : 1;
  const r = 4 * Math.max(0.35, Math.min(2.2, s * 0.5));

  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 22, 22),
    new THREE.MeshBasicMaterial({
      color: safeNodeColor(meshColor),
    })
  );
  group.add(sphere);

  const label = (n.label || "—").trim() || "—";
  const plate = makeLabelSprite(label, "#e2e8f0");
  const sy = plate.scale.y;
  plate.position.set(0, r + sy * 0.5 + 0.45, 0);
  group.add(plate);

  return group;
}
