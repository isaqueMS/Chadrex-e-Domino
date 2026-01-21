
import { DominoTile, DominoMove } from '../types';

export const createFullSet = (): DominoTile[] => {
  const set: DominoTile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      // Garantimos um ID único para cada peça baseado nos valores para evitar conflitos de renderização
      set.push({ sideA: i, sideB: j, id: `tile_${i}_${j}_${Math.random().toString(36).substr(2, 4)}` });
    }
  }
  return set;
};

export const shuffleSet = (set: DominoTile[]): DominoTile[] => {
  const newSet = [...set];
  // Fisher-Yates shuffle
  for (let i = newSet.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newSet[i], newSet[j]] = [newSet[j], newSet[i]];
  }
  return newSet;
};

export const canPlayTile = (tile: DominoTile, board: DominoMove[]): { side: 'left' | 'right'; isFlipped: boolean }[] => {
  // Se o tabuleiro estiver vazio, qualquer peça pode ser jogada no início
  if (board.length === 0) return [{ side: 'left', isFlipped: false }];

  const leftMove = board[0];
  const rightMove = board[board.length - 1];

  // Pegamos os valores das extremidades livres
  const leftValue = leftMove.isFlipped ? leftMove.tile.sideB : leftMove.tile.sideA;
  const rightValue = rightMove.isFlipped ? rightMove.tile.sideA : rightMove.tile.sideB;

  const validOptions: { side: 'left' | 'right'; isFlipped: boolean }[] = [];

  // Verifica encaixe na esquerda
  if (tile.sideA === leftValue) {
    validOptions.push({ side: 'left', isFlipped: true });
  } else if (tile.sideB === leftValue) {
    validOptions.push({ side: 'left', isFlipped: false });
  }

  // Verifica encaixe na direita
  if (tile.sideA === rightValue) {
    validOptions.push({ side: 'right', isFlipped: false });
  } else if (tile.sideB === rightValue) {
    validOptions.push({ side: 'right', isFlipped: true });
  }

  return validOptions;
};
