import type { Motion, Tile } from "./game";
import { boardCells, type Hex } from "./hex";

/** What the canvas should show: the current tiles plus how they got there. */
export interface View {
	tiles: Tile[];
	motions: Motion[];
	merged: Set<number>;
	spawned: Set<number>;
	start: number;
}

export const SLIDE_MS = 110;
const POP_MS = 160;
const SQRT3 = Math.sqrt(3);

const BOARD_COLOR = "#bbada0";
const SLOT_COLOR = "#cdc1b4";
const TILE_COLORS: Record<number, string> = {
	2: "#eee4da",
	4: "#ede0c8",
	8: "#f2b179",
	16: "#f59563",
	32: "#f67c5f",
	64: "#f65e3b",
	128: "#edcf72",
	256: "#edcc61",
	512: "#edc850",
	1024: "#edc53f",
	2048: "#edc22e"
};

const tileColor = (value: number) => TILE_COLORS[value] ?? "#3c3a32";
const textColor = (value: number) => (value <= 4 ? "#776e65" : "#f9f6f2");
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI / 3) * i + rotation;
		ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
	}
	ctx.closePath();
}

/** Fills a hex with softly rounded corners by stroking it in the same colour. */
function fillHex(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotation = 0) {
	const round = size * 0.14;
	hexPath(ctx, x, y, size - round / 2, rotation);
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.lineWidth = round;
	ctx.lineJoin = "round";
	ctx.fill();
	ctx.stroke();
}

/** Draws one frame. Returns true while an animation is still running. */
export function draw(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	radius: number,
	view: View,
	now: number
): boolean {
	// The board outline is a pointy-top hexagon whose flat sides sit just past the outermost cells,
	// so in cell sizes it is 2·apothem wide and 2·outline tall.
	const apothem = 1.5 * radius + 1.15;
	const outline = (apothem * 2) / SQRT3;
	const size = Math.min(width / (2 * apothem), height / (2 * outline));
	const cx = width / 2;
	const cy = height / 2;
	const toPixel = (h: Hex) => ({ x: cx + size * 1.5 * h.q, y: cy + size * SQRT3 * (h.r + h.q / 2) });
	const cellSize = size * 0.9;

	ctx.clearRect(0, 0, width, height);
	// The board's outline is a pointy-top hexagon even though its cells are flat-top.
	fillHex(ctx, cx, cy, size * outline, BOARD_COLOR, Math.PI / 6);
	for (const cell of boardCells(radius)) {
		const { x, y } = toPixel(cell);
		fillHex(ctx, x, y, cellSize, SLOT_COLOR);
	}

	const drawTile = (x: number, y: number, value: number, scale: number) => {
		if (scale <= 0) return;
		const s = cellSize * scale;
		fillHex(ctx, x, y, s, tileColor(value));
		const digits = String(value).length;
		ctx.fillStyle = textColor(value);
		ctx.font = `bold ${s * (digits <= 2 ? 0.75 : digits === 3 ? 0.6 : 0.45)}px "Clear Sans", "Helvetica Neue", Arial, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(String(value), x, y + s * 0.04);
	};

	const elapsed = now - view.start;
	if (elapsed < SLIDE_MS && view.motions.length > 0) {
		const t = easeOut(elapsed / SLIDE_MS);
		for (const m of view.motions) {
			const a = toPixel(m.from);
			const b = toPixel(m.to);
			drawTile(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, m.value, 1);
		}
		return true;
	}

	const p = clamp01((elapsed - SLIDE_MS) / POP_MS);
	for (const tile of view.tiles) {
		const { x, y } = toPixel(tile.cell);
		let scale = 1;
		if (view.spawned.has(tile.id)) scale = easeOut(p);
		else if (view.merged.has(tile.id)) scale = 1 + 0.18 * Math.sin(Math.PI * p);
		drawTile(x, y, tile.value, scale);
	}
	return p < 1;
}
