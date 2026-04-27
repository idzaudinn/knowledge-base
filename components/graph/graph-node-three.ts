import * as THREE from "three";
import type { GraphNode } from "@/lib/types";

export function createLabeledNode(
  n: GraphNode,
  options: { meshColor: string; size: number }
): THREE.Object3D {
  const { meshColor, size } = options;
  const r = 4 * Math.max(0.35, Math.min(2.2, size * 0.5));

  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 18, 18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(meshColor) })
  );
  group.add(sphere);

  const label = n.label || "(untitled)";
  const sprite = makeLabelSprite(label, "#e2e8f0");
  const sy = sprite.scale.y;
  sprite.position.set(0, r + (sy * 0.5) + 0.4, 0);
  group.add(sprite);

  return group;
}

function makeLabelSprite(text: string, fg: string): THREE.Sprite {
  const t = text.length > 40 ? text.slice(0, 38) + "…" : text;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Sprite();
  }
  const fontSize = 22;
  const padX = 12;
  const padY = 8;
  const font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.min(720, Math.ceil(ctx.measureText(t).width) + padX * 2);
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
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t, w / 2, h / 2);
  const map = new THREE.CanvasTexture(canvas);
  map.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map, depthTest: true, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const sx = w / 32;
  const syy = h / 32;
  sprite.scale.set(sx, syy, 1);
  return sprite;
}
