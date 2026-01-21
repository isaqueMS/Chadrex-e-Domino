
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

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  description: string;
  difficulty: number;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: 'Basics' | 'Tactics' | 'Endgames';
  fen: string;
  icon: string;
}

export interface User {
  id: string;
  name: string;
  elo: number;
  avatar: string;
  lastSeen?: number;
  dominoElo?: number;
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

export interface DominoGameState {
  players: User[];
  turnIndex: number;
  board: DominoMove[];
  hands: Record<string, DominoTile[]>;
  status: 'waiting' | 'playing' | 'finished';
  winnerId?: string;
  chat?: Record<string, DominoChatMessage>;
}

declare global {
  interface Window {
    Peer: any;
    firebase: any;
  }
}
