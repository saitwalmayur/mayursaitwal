import { GridCoord, PlayerColor } from './ludo.models';

export const TILE_SIZE = 1.35;
export const BOARD_CELLS = 15;
export const BOARD_HALF_SIZE = (BOARD_CELLS * TILE_SIZE) / 2;

// The 52 perimeter steps of the Ludo board in clockwise order
export const TRACK_STEPS: GridCoord[] = [
  // 0..4 (heading right along row 6)
  { col: 1, row: 6 }, // 0: RED START (Safe)
  { col: 2, row: 6 }, // 1
  { col: 3, row: 6 }, // 2
  { col: 4, row: 6 }, // 3
  { col: 5, row: 6 }, // 4
  // 5..10 (turning up along col 6)
  { col: 6, row: 5 }, // 5
  { col: 6, row: 4 }, // 6
  { col: 6, row: 3 }, // 7
  { col: 6, row: 2 }, // 8: STAR (Safe)
  { col: 6, row: 1 }, // 9
  { col: 6, row: 0 }, // 10
  // 11..12 (top turn)
  { col: 7, row: 0 }, // 11
  { col: 8, row: 0 }, // 12
  // 13..17 (heading down along col 8)
  { col: 8, row: 1 }, // 13: GREEN START (Safe)
  { col: 8, row: 2 }, // 14
  { col: 8, row: 3 }, // 15
  { col: 8, row: 4 }, // 16
  { col: 8, row: 5 }, // 17
  // 18..23 (turning right along row 6)
  { col: 9, row: 6 },  // 18
  { col: 10, row: 6 }, // 19
  { col: 11, row: 6 }, // 20
  { col: 12, row: 6 }, // 21: STAR (Safe)
  { col: 13, row: 6 }, // 22
  { col: 14, row: 6 }, // 23
  // 24..25 (right turn)
  { col: 14, row: 7 }, // 24
  { col: 14, row: 8 }, // 25
  // 26..30 (heading left along row 8)
  { col: 13, row: 8 }, // 26: YELLOW START (Safe)
  { col: 12, row: 8 }, // 27
  { col: 11, row: 8 }, // 28
  { col: 10, row: 8 }, // 29
  { col: 9, row: 8 },  // 30
  // 31..36 (turning down along col 8)
  { col: 8, row: 9 },  // 31
  { col: 8, row: 10 }, // 32
  { col: 8, row: 11 }, // 33
  { col: 8, row: 12 }, // 34: STAR (Safe)
  { col: 8, row: 13 }, // 35
  { col: 8, row: 14 }, // 36
  // 37..38 (bottom turn)
  { col: 7, row: 14 }, // 37
  { col: 6, row: 14 }, // 38
  // 39..43 (heading up along col 6)
  { col: 6, row: 13 }, // 39: BLUE START (Safe)
  { col: 6, row: 12 }, // 40
  { col: 6, row: 11 }, // 41
  { col: 6, row: 10 }, // 42
  { col: 6, row: 9 },  // 43
  // 44..49 (turning left along row 8)
  { col: 5, row: 8 }, // 44
  { col: 4, row: 8 }, // 45
  { col: 3, row: 8 }, // 46
  { col: 2, row: 8 }, // 47: STAR (Safe)
  { col: 1, row: 8 }, // 48
  { col: 0, row: 8 }, // 49
  // 50..51 (left turn)
  { col: 0, row: 7 }, // 50
  { col: 0, row: 6 }, // 51
];

// Safe track indexes (8 star/starting tiles where pawns cannot be captured)
export const SAFE_TRACK_INDEXES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

// Color-specific start track index
export const PLAYER_START_INDEX: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// 5 Home column path tiles per player (step 51..55)
export const HOME_PATHS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  green: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  blue: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
};

// Final Goal coordinate (step 56)
export const GOAL_COORDS: Record<PlayerColor, GridCoord> = {
  red: { col: 6, row: 7 },
  green: { col: 7, row: 6 },
  yellow: { col: 8, row: 7 },
  blue: { col: 7, row: 8 },
};

// 4 Pawn spawn spots inside each color's base yard
export const YARD_COORDS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { col: 1.8, row: 1.8 },
    { col: 3.7, row: 1.8 },
    { col: 1.8, row: 3.7 },
    { col: 3.7, row: 3.7 },
  ],
  green: [
    { col: 10.8, row: 1.8 },
    { col: 12.7, row: 1.8 },
    { col: 10.8, row: 3.7 },
    { col: 12.7, row: 3.7 },
  ],
  yellow: [
    { col: 10.8, row: 10.8 },
    { col: 12.7, row: 10.8 },
    { col: 10.8, row: 12.7 },
    { col: 12.7, row: 12.7 },
  ],
  blue: [
    { col: 1.8, row: 10.8 },
    { col: 3.7, row: 10.8 },
    { col: 1.8, row: 12.7 },
    { col: 3.7, row: 12.7 },
  ],
};

// Exact top surface heights of board elements so 3D pawns rest directly on them with 0 hovering
export const SURFACE_TRACK = 0.88;
export const SURFACE_YARD = 1.02;
export const SURFACE_HOME = 0.90;
export const SURFACE_GOAL = 1.06;

// Helper to convert grid (col, row) to 3D coordinates (x, y, z)
export function gridToWorld(col: number, row: number, y: number = SURFACE_TRACK): { x: number; y: number; z: number } {
  return {
    x: (col - 7) * TILE_SIZE,
    y: y,
    z: (row - 7) * TILE_SIZE,
  };
}

// Map a pawn's progress (stepCount: -1 = yard, 0..50 = track, 51..55 = home, 56 = goal) to 3D world position
export function getPawnWorldPosition(
  color: PlayerColor,
  pawnId: number,
  stepCount: number,
  offsetIndex: number = 0,
  totalOnTile: number = 1
): { x: number; y: number; z: number } {
  if (stepCount === -1) {
    // In yard - sits flush on top of the socket pad
    const c = YARD_COORDS[color][pawnId];
    return gridToWorld(c.col, c.row, SURFACE_YARD);
  }

  let coord: GridCoord;
  let surfaceY: number;

  if (stepCount <= 50) {
    const startIndex = PLAYER_START_INDEX[color];
    const trackIdx = (startIndex + stepCount) % 52;
    coord = TRACK_STEPS[trackIdx];
    surfaceY = SURFACE_TRACK;
  } else if (stepCount <= 55) {
    const homeStep = stepCount - 51;
    coord = HOME_PATHS[color][homeStep];
    surfaceY = SURFACE_HOME;
  } else {
    coord = GOAL_COORDS[color];
    surfaceY = SURFACE_GOAL;
  }

  const base = gridToWorld(coord.col, coord.row, surfaceY);

  // If multiple pawns share the exact same tile, spread them out slightly so they don't overlap awkwardly
  if (totalOnTile > 1) {
    const angle = (offsetIndex / totalOnTile) * Math.PI * 2;
    const spreadRadius = 0.28;
    base.x += Math.cos(angle) * spreadRadius;
    base.z += Math.sin(angle) * spreadRadius;
  }

  return base;
}

// Convert player stepCount to actual track index (or -1 if yard/home)
export function getTrackIndex(color: PlayerColor, stepCount: number): number {
  if (stepCount < 0 || stepCount > 50) return -1;
  const startIndex = PLAYER_START_INDEX[color];
  return (startIndex + stepCount) % 52;
}
