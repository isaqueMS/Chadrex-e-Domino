
import React, { useState } from 'react';
import { Board, Position, Move, PieceType } from '../types';
import { PIECE_IMAGES } from '../constants';
import { isValidMove, isCheck, findKing } from '../services/chessLogic';

interface ChessBoardProps {
  board: Board;
  onMove: (move: Move) => void;
  turn: 'w' | 'b';
  isFlipped?: boolean;
  lastMove: Move | null;
  gameOver?: boolean;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ board, onMove, turn, isFlipped = false, lastMove, gameOver }) => {
  const [selected, setSelected] = useState<Position | null>(null);
  const [promotionPending, setPromotionPending] = useState<Move | null>(null);

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
        const move: Move = {
          from: selected,
          to: { row: r, col: c },
          piece: selectedPiece,
          captured: piece || undefined
        };

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
    <div className="aspect-square w-full max-w-[600px] bg-[#262421] rounded shadow-2xl overflow-hidden border-4 border-[#262421] relative select-none">
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

            return (
              <div 
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                className={`relative flex items-center justify-center cursor-pointer
                  ${isLight ? 'square-light' : 'square-dark'}
                  ${isSelected ? 'bg-[#f6f669aa]' : ''}
                  ${isLastMove ? 'after:absolute after:inset-0 after:bg-yellow-400/30' : ''}
                `}
              >
                {c === (isFlipped ? 7 : 0) && <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold ${isLight ? 'text-[#779556]' : 'text-[#ebecd0]'}`}>{8-r}</span>}
                {r === (isFlipped ? 0 : 7) && <span className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold ${isLight ? 'text-[#779556]' : 'text-[#ebecd0]'}`}>{String.fromCharCode(97+c)}</span>}

                {piece && (
                  <img 
                    src={PIECE_IMAGES[`${piece.color}-${piece.type}`]} 
                    className={`w-[92%] h-[92%] z-10 piece-shadow ${isKingInCheck ? 'bg-red-500/50 rounded-full' : ''}`}
                    draggable={false}
                  />
                )}
                
                {selected && !piece && isValidMove(board, { from: selected, to: {row:r, col:c}, piece: board[selected.row][selected.col]! }) && (
                  <div className="w-3 h-3 rounded-full bg-black/10 z-0"></div>
                )}
              </div>
            );
          })
        ))}
      </div>

      {promotionPending && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-xl shadow-2xl flex gap-4 animate-in zoom-in duration-200">
            {['q', 'r', 'b', 'n'].map((type) => (
              <button 
                key={type} 
                onClick={() => completePromotion(type as PieceType)}
                className="hover:bg-gray-200 p-2 rounded-lg transition-colors"
              >
                <img src={PIECE_IMAGES[`${promotionPending.piece.color}-${type}`]} className="w-16 h-16" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessBoard;
