
import { Board, Color, Piece, PieceType, Position, Move } from '../types';

export const parseFen = (fen: string): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const [position] = fen.split(' ');
  const rows = position.split('/');

  rows.forEach((row, r) => {
    let c = 0;
    for (const char of row) {
      if (isNaN(parseInt(char))) {
        const color: Color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase() as PieceType;
        board[r][c] = { type, color };
        c++;
      } else {
        c += parseInt(char);
      }
    }
  });
  return board;
};

export const createInitialBoard = (): Board => {
  return parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
};

const PIECE_VALUES: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PST: Record<PieceType, number[][]> = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0], [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50], [-40, -20, 0, 5, 5, 0, -20, -40],
    [-30, 5, 10, 15, 15, 10, 5, -30], [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30], [-30, 0, 10, 15, 15, 10, 0, -30],
    [-40, -20, 0, 0, 0, 0, -20, -40], [-50, -40, -30, -30, -30, -30, -40, -50]
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20], [-10, 5, 0, 0, 0, 0, 5, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10], [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10], [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 0, 0, 0, 0, 0, 0, -10], [-20, -10, -10, -10, -10, -10, -10, -20]
  ],
  r: [
    [0, 0, 0, 5, 5, 0, 0, 0], [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5],
    [5, 10, 10, 10, 10, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20], [-10, 0, 5, 0, 0, 0, 0, -10],
    [-10, 5, 5, 5, 5, 5, 0, -10], [0, 0, 5, 5, 5, 5, 0, -5],
    [-5, 0, 5, 5, 5, 5, 0, -5], [-10, 0, 5, 5, 5, 5, 0, -10],
    [-10, 0, 0, 0, 0, 0, 0, -10], [-20, -10, -10, -5, -5, -10, -10, -20]
  ],
  k: [
    [20, 30, 10, 0, 0, 10, 30, 20], [20, 20, 0, 0, 0, 0, 20, 20],
    [-10, -20, -20, -20, -20, -20, -20, -10], [-20, -30, -30, -40, -40, -30, -30, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30]
  ]
};

export const evaluateBoard = (board: Board): number => {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        const val = PIECE_VALUES[p.type];
        const table = PST[p.type];
        const row = p.color === 'w' ? r : 7 - r;
        score += (p.color === 'w' ? 1 : -1) * (val + (table[row]?.[c] || 0));
      }
    }
  }
  return score;
};

const orderMoves = (board: Board, moves: Move[]): Move[] => {
  return moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (a.captured) scoreA = 10 * PIECE_VALUES[a.captured.type] - PIECE_VALUES[a.piece.type];
    if (b.captured) scoreB = 10 * PIECE_VALUES[b.captured.type] - PIECE_VALUES[b.piece.type];
    if (a.promotion) scoreA += 900;
    if (b.promotion) scoreB += 900;
    return scoreB - scoreA;
  });
};

export const isPseudoLegalMove = (board: Board, move: Move, ignoreCheck = false): boolean => {
  const { from, to, piece } = move;
  const target = board[to.row][to.col];
  
  if (!ignoreCheck && target && target.color === piece.color) return false;

  const dx = Math.abs(to.col - from.col);
  const dy = Math.abs(to.row - from.row);

  switch (piece.type) {
    case 'p':
      const dir = piece.color === 'w' ? -1 : 1;
      if (to.col === from.col && !target && !ignoreCheck) {
        if (to.row === from.row + dir) return true;
        if (from.row === (piece.color === 'w' ? 6 : 1) && to.row === from.row + 2 * dir && !board[from.row + dir][from.col]) return true;
      } else if (dx === 1 && to.row === from.row + dir) {
        if (target || ignoreCheck) return true;
      }
      return false;
    case 'r': return (dx === 0 || dy === 0) && isPathClear(board, from, to);
    case 'n': return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    case 'b': return dx === dy && isPathClear(board, from, to);
    case 'q': return (dx === dy || dx === 0 || dy === 0) && isPathClear(board, from, to);
    case 'k': 
      if (dx <= 1 && dy <= 1) return true;
      if (dy === 0 && dx === 2 && !ignoreCheck) {
        const isKingside = to.col === 6;
        const rookCol = isKingside ? 7 : 0;
        const rook = board[from.row][rookCol];
        if (rook?.type === 'r' && rook.color === piece.color) {
            const step = isKingside ? 1 : -1;
            for(let c = from.col + step; c !== rookCol; c += step) {
              if(board[from.row][c]) return false;
            }
            return true;
        }
      }
      return false;
    default: return false;
  }
};

const isPathClear = (board: Board, from: Position, to: Position): boolean => {
  const stepRow = Math.sign(to.row - from.row);
  const stepCol = Math.sign(to.col - from.col);
  let r = from.row + stepRow, c = from.col + stepCol;
  while (r !== to.row || c !== to.col) {
    if (board[r][c]) return false;
    r += stepRow; c += stepCol;
  }
  return true;
};

export const findKing = (board: Board, color: Color): Position | null => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.type === 'k' && p?.color === color) return { row: r, col: c };
    }
  }
  return null;
};

export const isCheck = (board: Board, color: Color): boolean => {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos, color === 'w' ? 'b' : 'w');
};

export const isSquareAttacked = (board: Board, pos: Position, attackerColor: Color): boolean => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === attackerColor) {
        if (p.type === 'p') {
          const dir = p.color === 'w' ? -1 : 1;
          const dx = Math.abs(pos.col - c);
          if (dx === 1 && pos.row === r + dir) return true;
        } else if (isPseudoLegalMove(board, { from: { row: r, col: c }, to: pos, piece: p } as Move, true)) {
          return true;
        }
      }
    }
  }
  return false;
};

export const isValidMove = (board: Board, move: Move): boolean => {
  if (!isPseudoLegalMove(board, move)) return false;
  
  if (move.piece.type === 'k' && Math.abs(move.to.col - move.from.col) === 2) {
      if (isCheck(board, move.piece.color)) return false;
      const step = move.to.col > move.from.col ? 1 : -1;
      if (isSquareAttacked(board, { row: move.from.row, col: move.from.col + step }, move.piece.color === 'w' ? 'b' : 'w')) return false;
  }

  const sim = makeMove(board, move);
  return !isCheck(sim, move.piece.color);
};

export const makeMove = (board: Board, move: Move): Board => {
  const nb = board.map(r => [...r]);
  const { from, to, piece, promotion } = move;
  
  if (piece.type === 'k' && Math.abs(to.col - from.col) === 2) {
    const isKingside = to.col > from.col;
    const rookFromCol = isKingside ? 7 : 0;
    const rookToCol = isKingside ? 5 : 3;
    const rook = nb[from.row][rookFromCol];
    nb[from.row][rookToCol] = rook;
    nb[from.row][rookFromCol] = null;
  }

  nb[to.row][to.col] = promotion ? { type: promotion, color: piece.color } : { ...piece };
  nb[from.row][from.col] = null;
  return nb;
};

export const getAllValidMoves = (board: Board, color: Color): Move[] => {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            const m: Move = { 
              from: { row: r, col: c }, 
              to: { row: tr, col: tc }, 
              piece: p, 
              captured: board[tr][tc] || undefined 
            };
            if (isValidMove(board, m)) moves.push(m);
          }
        }
      }
    }
  }
  return moves;
};

const minimax = (board: Board, depth: number, alpha: number, beta: number, isMaximizing: boolean): number => {
  if (depth === 0) return evaluateBoard(board);
  
  const turn: Color = isMaximizing ? 'w' : 'b';
  const moves = getAllValidMoves(board, turn);
  
  if (moves.length === 0) {
    if (isCheck(board, turn)) return isMaximizing ? -1000000 : 1000000;
    return 0;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of orderMoves(board, moves)) {
      const ev = minimax(makeMove(board, m), depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of orderMoves(board, moves)) {
      const ev = minimax(makeMove(board, m), depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getGameState = (board: Board, color: Color): 'checkmate' | 'stalemate' | 'playing' => {
  const moves = getAllValidMoves(board, color);
  if (moves.length > 0) return 'playing';
  return isCheck(board, color) ? 'checkmate' : 'stalemate';
};

export const getBestMove = (board: Board, color: Color, elo: number = 1200): Move | null => {
  const moves = getAllValidMoves(board, color);
  if (moves.length === 0) return null;

  let depth = 2; // Default depth for reasonable AI performance
  if (elo >= 2400) depth = 3;
  if (elo <= 1000) depth = 1;

  const isMaximizing = color === 'w';
  let bestEval = isMaximizing ? -Infinity : Infinity;
  let bestMove = moves[0];

  for (const m of orderMoves(board, moves)) {
    const ev = minimax(makeMove(board, m), depth - 1, -Infinity, Infinity, !isMaximizing);
    if (isMaximizing) {
      if (ev > bestEval) {
        bestEval = ev;
        bestMove = m;
      }
    } else {
      if (ev < bestEval) {
        bestEval = ev;
        bestMove = m;
      }
    }
  }
  return bestMove;
};
