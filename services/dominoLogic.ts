
import { DominoTile, DominoMove } from '../types';

export const createFullSet = (): DominoTile[] => {
  const set: DominoTile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      const uniqueId = `tile_${i}_${j}_${Math.random().toString(36).substr(2, 6)}`;
      set.push({ sideA: i, sideB: j, id: uniqueId });
    }
  }
  return set;
};

export const shuffleSet = (set: DominoTile[]): DominoTile[] => {
  const newSet = [...set];
  for (let i = newSet.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newSet[i], newSet[j]] = [newSet[j], newSet[i]];
  }
  return newSet;
};

export const calculatePoints = (hand: DominoTile[]): number => {
  return hand.reduce((sum, tile) => sum + tile.sideA + tile.sideB, 0);
};

export const canPlayTile = (tile: DominoTile, board: DominoMove[]): { side: 'left' | 'right'; isFlipped: boolean }[] => {
  if (!board || board.length === 0) {
    return [{ side: 'right', isFlipped: false }];
  }

  const leftMove = board[0];
  const rightMove = board[board.length - 1];

  const leftValue = leftMove.isFlipped ? leftMove.tile.sideB : leftMove.tile.sideA;
  const rightValue = rightMove.isFlipped ? rightMove.tile.sideA : rightMove.tile.sideB;

  const validOptions: { side: 'left' | 'right'; isFlipped: boolean }[] = [];

  // Check left extremity
  if (tile.sideA === leftValue) {
    validOptions.push({ side: 'left', isFlipped: true });
  } else if (tile.sideB === leftValue) {
    validOptions.push({ side: 'left', isFlipped: false });
  }

  // Check right extremity
  if (tile.sideA === rightValue) {
    validOptions.push({ side: 'right', isFlipped: false });
  } else if (tile.sideB === rightValue) {
    validOptions.push({ side: 'right', isFlipped: true });
  }

  return validOptions;
};
