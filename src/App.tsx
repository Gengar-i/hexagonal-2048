import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { move, newGame, type GameState } from "./game/game";
import type { Direction } from "./game/hex";
import { draw, SLIDE_MS, type View } from "./game/renderer";

const RADIUS = 2;
const BEST_KEY = "hexagonal-2048-best";
const SWIPE_MIN_PX = 30;

const KEYS: Record<string, Direction> = {
	KeyW: "N",
	KeyE: "NE",
	KeyD: "SE",
	KeyS: "S",
	KeyA: "SW",
	KeyQ: "NW"
};

// Screen angle (degrees, y pointing down) of each move direction, used to resolve swipes.
const SWIPE_ANGLES: [Direction, number][] = [
	["SE", 30],
	["S", 90],
	["SW", 150],
	["NW", 210],
	["N", 270],
	["NE", 330]
];

function swipeDirection(dx: number, dy: number): Direction {
	const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
	const distance = (a: number) => Math.min(Math.abs(angle - a), 360 - Math.abs(angle - a));
	return SWIPE_ANGLES.reduce((best, cur) => (distance(cur[1]) < distance(best[1]) ? cur : best))[0];
}

function loadBest(): number {
	try {
		return Number(localStorage.getItem(BEST_KEY)) || 0;
	} catch {
		return 0;
	}
}

function saveBest(best: number) {
	try {
		localStorage.setItem(BEST_KEY, String(best));
	} catch {
		// Storage can be unavailable (private mode); the best score just won't persist.
	}
}

/** A view that pops every tile in, used for a fresh board. */
function freshView(state: GameState): View {
	return {
		tiles: state.tiles,
		motions: [],
		merged: new Set(),
		spawned: new Set(state.tiles.map(t => t.id)),
		start: performance.now() - SLIDE_MS
	};
}

function App() {
	const [game, setGame] = useState(() => newGame(RADIUS));
	const [best, setBest] = useState(loadBest);

	const gameRef = useRef(game);
	const viewRef = useRef<View | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const redrawRef = useRef<() => void>(() => {});
	const swipeRef = useRef<{ x: number; y: number } | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current!;
		const ctx = canvas.getContext("2d")!;
		viewRef.current ??= freshView(gameRef.current);
		let frame = 0;

		const loop = () => {
			frame = 0;
			const dpr = window.devicePixelRatio || 1;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			const animating = draw(ctx, canvas.clientWidth, canvas.clientHeight, RADIUS, viewRef.current!, performance.now());
			if (animating) frame = requestAnimationFrame(loop);
		};
		redrawRef.current = () => {
			if (!frame) frame = requestAnimationFrame(loop);
		};

		const resize = new ResizeObserver(() => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(canvas.clientWidth * dpr);
			canvas.height = Math.round(canvas.clientHeight * dpr);
			redrawRef.current();
		});
		resize.observe(canvas);

		return () => {
			resize.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);

	const show = useCallback((state: GameState, view: View) => {
		gameRef.current = state;
		viewRef.current = view;
		setGame(state);
		setBest(prev => {
			if (state.score <= prev) return prev;
			saveBest(state.score);
			return state.score;
		});
		redrawRef.current();
	}, []);

	const play = useCallback(
		(dir: Direction) => {
			const result = move(gameRef.current, dir);
			if (!result) return;
			show(result.state, {
				tiles: result.state.tiles,
				motions: result.motions,
				merged: new Set(result.merged),
				spawned: new Set(result.spawned),
				start: performance.now()
			});
		},
		[show]
	);

	const restart = useCallback(() => {
		const state = newGame(RADIUS);
		show(state, freshView(state));
	}, [show]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			const dir = KEYS[e.code];
			if (!dir) return;
			e.preventDefault();
			play(dir);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [play]);

	const onPointerDown = (e: PointerEvent) => {
		swipeRef.current = { x: e.clientX, y: e.clientY };
	};
	const onPointerUp = (e: PointerEvent) => {
		const start = swipeRef.current;
		swipeRef.current = null;
		if (!start) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		if (Math.hypot(dx, dy) >= SWIPE_MIN_PX) play(swipeDirection(dx, dy));
	};

	return (
		<main className="game">
			<header className="header">
				<h1>Hexagonal 2048</h1>
				<div className="scores">
					<div className="score">
						<span>Score</span>
						<strong>{game.score}</strong>
					</div>
					<div className="score">
						<span>Best</span>
						<strong>{best}</strong>
					</div>
				</div>
			</header>

			<div className="toolbar">
				<p>Join the hexes and get past 2048 points!</p>
				<button onClick={restart}>New game</button>
			</div>

			<div className="board">
				<canvas
					ref={canvasRef}
					onPointerDown={onPointerDown}
					onPointerUp={onPointerUp}
					onPointerCancel={() => (swipeRef.current = null)}
				/>
				{game.over && (
					<div className="overlay">
						<p>Game over!</p>
						<button onClick={restart}>Try again</button>
					</div>
				)}
			</div>

			<div className="keys" aria-label="Controls">
				<kbd className="q">Q</kbd>
				<kbd className="w">W</kbd>
				<kbd className="e">E</kbd>
				<kbd className="a">A</kbd>
				<kbd className="s">S</kbd>
				<kbd className="d">D</kbd>
			</div>
			<p className="hint">Use the keys above or swipe on the board to move the hexes.</p>
		</main>
	);
}

export default App;
