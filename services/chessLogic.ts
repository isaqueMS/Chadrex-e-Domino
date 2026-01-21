
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

// Tabelas de Posicionamento (PST) - Estratégia de Grandmaster
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20]
];

const PST: Record<PieceType, number[][]> = {
  p: PAWN_PST, n: KNIGHT_PST, b: BISHOP_PST, r: ROOK_PST, q: QUEEN_PST, k: KING_PST
};

const PIECE_VALUES: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

export const evaluateBoard = (board: Board): number => {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        const val = PIECE_VALUES[p.type];
        const table = PST[p.type];
        const row = p.color === 'w' ? r : 7 - r;
        const pstVal = table[row][c];
        score += (p.color === 'w' ? 1 : -1) * (val + pstVal);
      }
    }
  }
  return score;
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
      if (to.col === from.col && !target) {
        if (to.row === from.row + dir) return true;
        if (from.row === (piece.color === 'w' ? 6 : 1) && to.row === from.row + 2 * dir && !board[from.row + dir][from.col]) return true;
      } else if (dx === 1 && to.row === from.row + dir && target) return true;
      return false;
    case 'r': return (dx === 0 || dy === 0) && isPathClear(board, from, to);
    case 'n': return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    case 'b': return dx === dy && isPathClear(board, from, to);
    case 'q': return (dx === dy || dx === 0 || dy === 0) && isPathClear(board, from, to);
    case 'k': 
      if (dx <= 1 && dy <= 1) return true;
      if (!ignoreCheck && dy === 0 && dx === 2) {
        const isKingSide = to.col > from.col;
        const rookCol = isKingSide ? 7 : 0;
        const rook = board[from.row][rookCol];
        if (rook?.type === 'r' && rook.color === piece.color) {
          const pathCols = isKingSide ? [5, 6] : [1, 2, 3];
          if (pathCols.every(c => !board[from.row][c])) {
             const opp = piece.color === 'w' ? 'b' : 'w';
             if (isCheck(board, piece.color)) return false;
             const testCol = isKingSide ? 5 : 3;
             if (isSquareAttacked(board, {row: from.row, col: testCol}, opp)) return false;
             return true;
          }
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

export const findKing = (board: Board, color: Color): Position => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) 
    if (board[r][c]?.type === 'k' && board[r][c]?.color === color) return { row: r, col: c };
  return { row: -1, col: -1 };
};

export const isCheck = (board: Board, color: Color): boolean => {
  const kingPos = findKing(board, color);
  if (kingPos.row === -1) return false;
  return isSquareAttacked(board, kingPos, color === 'w' ? 'b' : 'w');
};

export const isSquareAttacked = (board: Board, pos: Position, attackerColor: Color): boolean => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === attackerColor) {
        if (isPseudoLegalMove(board, { from: { row: r, col: c }, to: pos, piece: p } as any, true)) return true;
      }
    }
  }
  return false;
};

export const isValidMove = (board: Board, move: Move): boolean => {
  if (!isPseudoLegalMove(board, move)) return false;
  const sim = makeMove(board, move);
  return !isCheck(sim, move.piece.color);
};

export const makeMove = (board: Board, move: Move): Board => {
  const nb = board.map(r => [...r]);
  const { from, to, piece, promotion } = move;
  if (piece.type === 'k' && Math.abs(to.col - from.col) === 2) {
    const isKingSide = to.col > from.col;
    const rookFromCol = isKingSide ? 7 : 0;
    const rookToCol = isKingSide ? 5 : 3;
    const rook = nb[from.row][rookFromCol];
    nb[from.row][rookToCol] = rook;
    nb[from.row][rookFromCol] = null;
  }
  nb[to.row][to.col] = promotion ? { type: promotion, color: piece.color } : { ...piece };
  nb[from.row][from.col] = null;
  return nb;
};

export const getGameState = (board: Board, turn: Color) => {
  const moves = getAllValidMoves(board, turn);
  if (moves.length === 0) return isCheck(board, turn) ? 'checkmate' : 'stalemate';
  return 'playing';
};

const getAllValidMoves = (board: Board, color: Color): Move[] => {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            const m = { from: { row: r, col: c }, to: { row: tr, col: tc }, piece: p };
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
  if (moves.length === 0) return isCheck(board, turn) ? (isMaximizing ? -30000 : 30000) : 0;

  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const ev = minimax(makeMove(board, m), depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const ev = minimax(makeMove(board, m), depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getBestMove = (board: Board, color: Color, userElo: number = 1500): Move | null => {
  const moves = getAllValidMoves(board, color);
  if (moves.length === 0) return null;
  const depth = userElo < 1500 ? 2 : userElo < 2500 ? 3 : 4;
  let bestMove = moves[0];
  let bestValue = color === 'w' ? -Infinity : Infinity;
  for (const m of moves) {
    const val = minimax(makeMove(board, m), depth - 1, -Infinity, Infinity, color !== 'w');
    if ((color === 'w' && val > bestValue) || (color === 'b' && val < bestValue)) {
      bestValue = val;
      bestMove = m;
    }
  }
  return bestMove;
};
