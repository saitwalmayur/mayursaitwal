import * as THREE from 'three';

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type PlayerType = 'human' | 'bot';
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type PawnState = 'yard' | 'track' | 'home' | 'goal';

export interface LudoPlayerConfig {
  color: PlayerColor;
  name: string;
  type: PlayerType;
  difficulty: BotDifficulty;
  active: boolean;
}

export interface LudoPawn {
  id: number; // 0..3
  color: PlayerColor;
  state: PawnState;
  stepCount: number; // -1 if in yard, 0..50 on track, 51..55 in home path, 56 at goal
  mesh?: THREE.Group;
  indicatorMesh?: THREE.Mesh;
  targetPos?: THREE.Vector3;
}

export interface LudoPlayer {
  color: PlayerColor;
  name: string;
  type: PlayerType;
  difficulty: BotDifficulty;
  active: boolean;
  pawns: LudoPawn[];
  rank: number; // 0 = playing, 1 = 1st place, etc.
  homeColorHex: number;
  homeColorCss: string;
  avatar: string;
}

export interface MoveAction {
  pawnIndex: number;
  pawn: LudoPawn;
  fromStep: number;
  toStep: number;
  isCapture: boolean;
  targetPawnToCapture?: LudoPawn;
  entersHome: boolean;
  reachesGoal: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  playerColor: PlayerColor;
  playerName: string;
  text: string;
  badge?: string;
  type: 'roll' | 'move' | 'capture' | 'goal' | 'pass' | 'win';
}

export interface GridCoord {
  col: number; // 0..14
  row: number; // 0..14
}

export interface BoardPosition3D {
  x: number;
  y: number;
  z: number;
}
