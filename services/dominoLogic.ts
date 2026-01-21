
import { DominoTile, DominoMove } from '../types';

export const createFullSet = (): DominoTile[] => {
  const set: DominoTile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      // Create a stable, globally unique ID for each tile
      const uniqueId = `tile_${i}_${j}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      set.push({ sideA: i, sideB: j, id: uniqueId });
    }
  }
  return set;
};

export const shuffleSet = (set: DominoTile[]): DominoTile[] => {
  const newSet = [...set];
  // Secure Fisher-Yates shuffle
  for (let i = newSet.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newSet[i], newSet[j]] = [newSet[j], newSet[i]];
  }
  return newSet;
};

export const canPlayTile = (tile: DominoTile, board: DominoMove[]): { side: 'left' | 'right'; isFlipped: boolean }[] => {
  // Empty board: can play anywhere, we default to right
  if (!board || board.length === 0) {
    return [{ side: 'right', isFlipped: false }];
  }

  const leftMove = board[0];
  const rightMove = board[board.length - 1];

  // Number exposed at left end
  const leftValue = leftMove.isFlipped ? leftMove.tile.sideB : leftMove.tile.sideA;
  // Number exposed at right end
  const rightValue = rightMove.isFlipped ? rightMove.tile.sideA : rightMove.tile.sideB;

  const validOptions: { side: 'left' | 'right'; isFlipped: boolean }[] = [];

  // Check left connection
  if (tile.sideA === leftValue) {
    validOptions.push({ side: 'left', isFlipped: true });
  } else if (tile.sideB === leftValue) {
    validOptions.push({ side: 'left', isFlipped: false });
  }

  // Check right connection
  if (tile.sideA === rightValue) {
    validOptions.push({ side: 'right', isFlipped: false });
  } else if (tile.sideB === rightValue) {
    validOptions.push({ side: 'right', isFlipped: true });
  }

  // Deduplicate: some moves might appear identical if values on both ends are the same
  // We keep the unique sides
  const seenSides = new Set<string>();
  const uniqueOptions = validOptions.filter(opt => {
    if (seenSides.has(opt.side)) return false;
    seenSides.add(opt.side);
    return true;
  });

  return uniqueOptions;
};
