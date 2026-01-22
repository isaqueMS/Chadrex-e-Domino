
import React, { useState, useMemo } from 'react';
import { Board, Position, Move, PieceType, UserSettings } from '../types';
import { PIECE_IMAGES } from '../constants';
import { isValidMove, isCheck, findKing } from '../services/chessLogic';

interface ChessBoardProps {
  board: Board;
  onMove: (move: Move) => void;
  turn: 'w' | 'b';
  isFlipped?: boolean;
  lastMove: Move | null;
  gameOver?: boolean;
  settings?: UserSettings;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ board, onMove, turn, isFlipped = false, lastMove, gameOver, settings }) => {
  const [selected, setSelected] = useState<Position | null>(null);
  const [promotionPending, setPromotionPending] = useState<Move | null>(null);

  const themeColors = {
    green: { light: 'bg-[#ebecd0]', dark: 'bg-[#779556]', textLight: 'text-[#779556]', textDark: 'text-[#ebecd0]', highlight: 'bg-yellow-400/40' },
    wood: { light: 'bg-[#decba4]', dark: 'bg-[#966f33]', textLight: 'text-[#966f33]', textDark: 'text-[#decba4]', highlight: 'bg-orange-400/40' },
    blue: { light: 'bg-[#dee3e6]', dark: 'bg-[#8ca2ad]', textLight: 'text-[#8ca2ad]', textDark: 'text-[#dee3e6]', highlight: 'bg-blue-400/40' },
    gray: { light: 'bg-[#e0e0e0]', dark: 'bg-[#a0a0a0]', textLight: 'text-[#a0a0a0]', textDark: 'text-[#e0e0e0]', highlight: 'bg-gray-400/40' },
  };

  const currentTheme = themeColors[settings?.chessTheme || 'green'];

  // Cache possible moves for selected piece to avoid overhead
  const possibleMoves = useMemo(() => {
    if (!selected) return [];
    const moves: Position[] = [];
    const piece = board[selected.row][selected.col];
    if (!piece) return [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const m: Move = { from: selected, to: { row: r, col: c }, piece, captured: board[r][c] || undefined };
        if (isValidMove(board, m)) moves.push({ row: r, col: c });
      }
    }
    return moves;
  }, [selected, board]);

  const handleSquareClick = (r: number, c: number) => {
    if (promotionPending || gameOver) return;
    const piece = board[r][c];

    if (selected) {
      if (selected.row === r && selected.col === c) {
        setSelected(null);
        return;
      }
      
      const selectedPiece = board[selected.row][selected.col];
      if (piece && piece.color === turn) {
        setSelected({ row: r, col: c });
        return;
      }

      if (selectedPiece) {
        const move: Move = { from: selected, to: { row: r, col: c }, piece: selectedPiece, captured: piece || undefined };
        if (isValidMove(board, move)) {
          const isPromotion = selectedPiece.type === 'p' && (r === 0 || r === 7);
          if (isPromotion) {
            setPromotionPending(move);
          } else {
            onMove(move);
            setSelected(null);
          }
          return;
        }
      }
    }
    
    if (piece && piece.color === turn) {
      setSelected({ row: r, col: c });
    } else {
      setSelected(null);
    }
  };

  const completePromotion = (type: PieceType) => {
    if (promotionPending) {
      onMove({ ...promotionPending, promotion: type });
      setPromotionPending(null);
      setSelected(null);
    }
  };

  const kingInCheck = isCheck(board, turn) ? findKing(board, turn) : null;
  const indices = [0, 1, 2, 3, 4, 5, 6, 7];
  const rows = isFlipped ? [...indices].reverse() : indices;
  const cols = isFlipped ? [...indices].reverse() : indices;

  return (
    <div className="aspect-square w-full max-w-[640px] bg-[#262421] rounded shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden border-2 border-[#1a1917] relative select-none">
      <div className="chess-board-grid w-full h-full">
        {rows.map((r) => (
          cols.map((c) => {
            const piece = board[r][c];
            const isLight = (r + c) % 2 === 0;
            const isSelected = selected?.row === r && selected?.col === c;
            const isLastMove = lastMove && (
              (lastMove.from.row === r && lastMove.from.col === c) || 
              (lastMove.to.row === r && lastMove.to.col === c)
            );
            const isKingInCheck = kingInCheck?.row === r && kingInCheck?.col === c;
            const isTargeted = possibleMoves.some(m => m.row === r && m.col === c);

            return (
              <div 
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                className={`relative flex items-center justify-center cursor-pointer transition-all duration-150
                  ${isLight ? currentTheme.light : currentTheme.dark}
                  ${isSelected ? currentTheme.highlight : ''}
                  ${isLastMove && !isSelected ? 'bg-yellow-100/30' : ''}
                  hover:brightness-[1.05]
                `}
              >
                {/* Coordinates */}
                {c === (isFlipped ? 7 : 0) && (
                  <span className={`absolute top-0.5 left-0.5 text-[8px] md:text-[10px] font-black pointer-events-none opacity-50 ${isLight ? currentTheme.textLight : currentTheme.textDark}`}>
                    {8-r}
                  </span>
                )}
                {r === (isFlipped ? 0 : 7) && (
                  <span className={`absolute bottom-0.5 right-0.5 text-[8px] md:text-[10px] font-black pointer-events-none opacity-50 ${isLight ? currentTheme.textLight : currentTheme.textDark}`}>
                    {String.fromCharCode(97+c)}
                  </span>
                )}

                {/* Piece Image */}
                {piece && (
                  <img 
                    src={PIECE_IMAGES[`${piece.color}-${piece.type}`]} 
                    className={`w-[90%] h-[90%] z-10 piece-shadow drop-shadow-xl transform transition-transform duration-200 ${isSelected ? 'scale-110 -translate-y-1' : ''} ${isKingInCheck ? 'bg-red-500/60 rounded-full ring-4 ring-red-500/20 animate-pulse' : ''}`}
                    draggable={false}
                    alt={`${piece.color}-${piece.type}`}
                  />
                )}
                
                {/* Move Hints */}
                {isTargeted && !piece && (
                  <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-black/15 z-0 animate-pulse"></div>
                )}
                {isTargeted && piece && (
                  <div className="absolute inset-0 border-[3px] md:border-[6px] border-black/10 rounded-none z-0"></div>
                )}
              </div>
            );
          })
        ))}
      </div>

      {/* Promotion Modal Overlay */}
      {promotionPending && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-[#262421] p-4 md:p-6 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 md:gap-6 border border-white/10 animate-in zoom-in duration-200">
            <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Escolha a Promoção</h4>
            <div className="flex gap-2 md:gap-4">
              {['q', 'r', 'b', 'n'].map((type) => (
                <button 
                  key={type} 
                  onClick={() => completePromotion(type as PieceType)} 
                  className="bg-[#3c3a37] hover:bg-[#81b64c] p-2 md:p-4 rounded-xl md:rounded-2xl transition-all hover:scale-110 shadow-lg group"
                >
                  <img src={PIECE_IMAGES[`${promotionPending.piece.color}-${type}`]} className="w-10 h-10 md:w-16 md:h-16 group-hover:brightness-110" alt={type} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessBoard;
