
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
}

export enum GameMode {
  LOCAL = 'LOCAL',
  AI = 'AI',
  ONLINE = 'ONLINE'
}

export type AppView = 'play' | 'puzzles' | 'learn' | 'dominoes';

export interface UserSettings {
  chessTheme: 'green' | 'wood' | 'blue' | 'gray';
  dominoTheme: 'felt' | 'wood' | 'dark' | 'blue';
}

export interface User {
  id: string;
  name: string;
  elo: number;
  avatar: string;
  lastSeen?: number;
  dominoElo?: number;
  settings?: UserSettings;
}

// Added missing Puzzle interface for Puzzles component
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  description: string;
  difficulty: number;
}

// Added missing Lesson interface for Learn component
export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: string;
  fen: string;
  icon: string;
}

// Tipos de Dominó
export interface DominoTile {
  sideA: number;
  sideB: number;
  id: string;
}

export interface DominoMove {
  tile: DominoTile;
  side: 'left' | 'right';
  isFlipped: boolean;
}

export interface DominoChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

export type DominoMode = 'individual' | 'teams';

export interface DominoGameState {
  players: User[];
  turnIndex: number;
  board: DominoMove[];
  hands: Record<string, DominoTile[]>;
  boneyard?: DominoTile[];
  status: 'waiting' | 'playing' | 'finished';
  mode: DominoMode;
  winnerId?: string;
  winningTeam?: number; // 0 para Jogadores 1 e 3, 1 para Jogadores 2 e 4
  chat?: Record<string, DominoChatMessage>;
}

declare global {
  interface Window {
    Peer: any;
    firebase: any;
  }
}
