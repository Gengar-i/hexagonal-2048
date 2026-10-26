import { add, boardCells, DIRECTIONS, hexKey, sub, type Direction, type Hex } from "./hex";

export interface Tile {
	id: number;
	value: number;
	cell: Hex;
}

/** How a tile from the previous state travels during a move (used for animation). */
export interface Motion {
	id: number;
	value: number;
	from: Hex;
	to: Hex;
}

export interface GameState {
	radius: number;
	tiles: Tile[];
	score: number;
	over: boolean;
}

export interface MoveResult {
	state: GameState;
	motions: Motion[];
	merged: number[];
	spawned: number[];
}

let nextId = 1;

function spawnTile(radius: number, tiles: Tile[]): Tile | null {
	const taken = new Set(tiles.map(t => hexKey(t.cell)));
	const free = boardCells(radius).filter(c => !taken.has(hexKey(c)));
	if (free.length === 0) return null;
	const cell = free[Math.floor(Math.random() * free.length)];
	return { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, cell };
}

function canMove(radius: number, tiles: Tile[]): boolean {
	if (tiles.length < boardCells(radius).length) return true;
	const byCell = new Map(tiles.map(t => [hexKey(t.cell), t.value]));
	return tiles.some(t =>
		Object.values(DIRECTIONS).some(d => byCell.get(hexKey(add(t.cell, d))) === t.value)
	);
}

export function newGame(radius: number): GameState {
	const tiles: Tile[] = [];
	for (let i = 0; i < 2; i++) {
		const tile = spawnTile(radius, tiles);
		if (tile) tiles.push(tile);
	}
	return { radius, tiles, score: 0, over: false };
}

/** Slides every tile towards `dir`, merging equal neighbours once per move. Returns null if nothing moved. */
export function move(state: GameState, dir: Direction): MoveResult | null {
	if (state.over) return null;

	const d = DIRECTIONS[dir];
	const cells = boardCells(state.radius);
	const onBoard = new Set(cells.map(hexKey));
	const byCell = new Map(state.tiles.map(t => [hexKey(t.cell), t]));

	const tiles: Tile[] = [];
	const motions: Motion[] = [];
	const merged: number[] = [];
	let score = state.score;
	let moved = false;

	for (const front of cells) {
		// Each line starts at the cell furthest along `dir` and runs backwards.
		if (onBoard.has(hexKey(add(front, d)))) continue;
		const line: Hex[] = [];
		for (let c = front; onBoard.has(hexKey(c)); c = sub(c, d)) line.push(c);

		let slot = 0;
		let open: Tile | null = null; // last placed tile that can still absorb a merge
		for (const cell of line) {
			const tile = byCell.get(hexKey(cell));
			if (!tile) continue;

			if (open && open.value === tile.value) {
				const combined = { id: nextId++, value: tile.value * 2, cell: open.cell };
				tiles[tiles.length - 1] = combined;
				motions.push({ id: tile.id, value: tile.value, from: tile.cell, to: open.cell });
				merged.push(combined.id);
				score += combined.value;
				moved = true;
				open = null;
			} else {
				const to = line[slot++];
				const placed = { ...tile, cell: to };
				tiles.push(placed);
				motions.push({ id: tile.id, value: tile.value, from: tile.cell, to });
				if (hexKey(to) !== hexKey(tile.cell)) moved = true;
				open = placed;
			}
		}
	}

	if (!moved) return null;

	const spawned = spawnTile(state.radius, tiles);
	if (spawned) tiles.push(spawned);

	return {
		state: { radius: state.radius, tiles, score, over: !canMove(state.radius, tiles) },
		motions,
		merged,
		spawned: spawned ? [spawned.id] : []
	};
}
