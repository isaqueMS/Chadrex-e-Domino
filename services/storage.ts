
import { Move } from '../types';

export interface SavedGame {
  id: string;
  date: string;
  result: string;
  moves: Move[];
  mode: string;
}

const STORAGE_KEY = 'gm_chess_history';

export const saveGameToLocal = (game: SavedGame) => {
  const history = getLocalHistory();
  history.unshift(game);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50))); // Mantém as últimas 50
};

export const getLocalHistory = (): SavedGame[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};
