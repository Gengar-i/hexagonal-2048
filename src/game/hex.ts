// Axial coordinates on a flat-top hex grid: q grows to the right, r grows downwards.
// Conventions follow https://www.redblobgames.com/grids/hexagons/.
export interface Hex {
	q: number;
	r: number;
}

export type Direction = "N" | "NE" | "SE" | "S" | "SW" | "NW";

export const DIRECTIONS: Record<Direction, Hex> = {
	N: { q: 0, r: -1 },
	NE: { q: 1, r: -1 },
	SE: { q: 1, r: 0 },
	S: { q: 0, r: 1 },
	SW: { q: -1, r: 1 },
	NW: { q: -1, r: 0 }
};

export const hexKey = (h: Hex) => `${h.q},${h.r}`;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const sub = (a: Hex, b: Hex): Hex => ({ q: a.q - b.q, r: a.r - b.r });

/** All cells of a hexagon-shaped board with the given radius (radius 2 → 19 cells). */
export function boardCells(radius: number): Hex[] {
	const cells: Hex[] = [];
	for (let q = -radius; q <= radius; q++) {
		const rMin = Math.max(-radius, -q - radius);
		const rMax = Math.min(radius, -q + radius);
		for (let r = rMin; r <= rMax; r++) cells.push({ q, r });
	}
	return cells;
}
