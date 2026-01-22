
import React, { useState, useEffect } from 'react';
import ChessBoard from './ChessBoard';
import { Board, Move, Puzzle } from '../types';
import { parseFen, makeMove, isValidMove } from '../services/chessLogic';

const PUZZLES_DATA: Puzzle[] = [
  { id: '1', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', moves: ['h5f7'], description: 'As Brancas dão xeque-mate em 1 lance.', difficulty: 400 },
  { id: '2', fen: '6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1', moves: ['g1f1'], description: 'Melhore a centralização do Rei no final.', difficulty: 600 },
  { id: '3', fen: 'r1b1k1nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1 w - - 0 1', moves: ['f3f7'], description: 'Inicie o ataque decisivo com sacrifício.', difficulty: 1200 }
];

const Puzzles: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [board, setBoard] = useState<Board>(() => parseFen(PUZZLES_DATA[0].fen));
  const [status, setStatus] = useState<'solving' | 'correct' | 'wrong'>('solving');
  const [lastMove, setLastMove] = useState<Move | null>(null);

  useEffect(() => {
    setBoard(parseFen(PUZZLES_DATA[currentIdx].fen));
    setLastMove(null);
    setStatus('solving');
  }, [currentIdx]);

  const handleMove = (move: Move) => {
    if (status === 'correct') return;
    
    // Simple coordinate-based move validation for puzzles
    const moveStr = `${String.fromCharCode(97 + move.from.col)}${8 - move.from.row}${String.fromCharCode(97 + move.to.col)}${8 - move.to.row}`;
    
    if (moveStr === PUZZLES_DATA[currentIdx].moves[0]) {
      const nextBoard = makeMove(board, move);
      setBoard(nextBoard);
      setLastMove(move);
      setStatus('correct');
    } else {
      setStatus('wrong');
      // Reset after a brief feedback period
      setTimeout(() => setStatus('solving'), 1200);
    }
  };

  const nextPuzzle = () => {
    setCurrentIdx((prev) => (prev + 1) % PUZZLES_DATA.length);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl items-start py-8 animate-in fade-in duration-500">
      <div className="flex-1 w-full max-w-[640px] flex flex-col gap-6">
        <div className={`p-6 rounded-2xl font-black text-center border shadow-xl transition-all duration-500 ${
          status === 'correct' ? 'bg-[#81b64c]/20 border-[#81b64c] text-[#81b64c] shadow-[#81b64c]/10' : 
          status === 'wrong' ? 'bg-red-500/20 border-red-500 text-red-500 animate-shake' : 
          'bg-[#262421] border-white/5 text-gray-300'
        }`}>
          <div className="text-[10px] uppercase tracking-[0.3em] mb-2 text-gray-500">Objetivo Tático</div>
          <p className="text-lg italic">{status === 'correct' ? 'EXCELENTE! OPERAÇÃO BEM SUCEDIDA.' : status === 'wrong' ? 'LANCE INCORRETO. TENTE NOVAMENTE.' : PUZZLES_DATA[currentIdx].description}</p>
        </div>
        
        <div className="bg-[#262421] p-1 rounded-xl shadow-2xl border border-white/5">
          <ChessBoard board={board} onMove={handleMove} turn="w" lastMove={lastMove} gameOver={status === 'correct'} />
        </div>
      </div>

      <div className="w-full lg:w-[380px] space-y-6">
        <div className="bg-[#262421] rounded-[2.5rem] p-8 border border-white/5 shadow-2xl">
          <h2 className="text-3xl font-black text-[#81b64c] mb-8 italic uppercase tracking-tighter">Tactical Node</h2>
          <div className="space-y-6">
            <div className="bg-[#1a1917] p-6 rounded-2xl border border-white/5 shadow-inner">
              <span className="text-[10px] text-gray-500 uppercase font-black block mb-2 tracking-widest">Complexidade</span>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-mono font-black text-white">{PUZZLES_DATA[currentIdx].difficulty}</span>
                <span className="text-xs text-[#81b64c] font-bold">Rating</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => setBoard(parseFen(PUZZLES_DATA[currentIdx].fen))} 
                className="w-full py-4 bg-[#3c3a37] hover:bg-[#4a4844] rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Resetar Posição
              </button>
              {status === 'correct' && (
                <button 
                  onClick={nextPuzzle} 
                  className="w-full bg-[#81b64c] py-5 rounded-2xl font-black text-lg shadow-[0_5px_0_#456528] active:translate-y-1 transition-all animate-pulse"
                >
                  PRÓXIMO NÓ
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-[#1a1917] p-6 rounded-3xl border border-white/5 opacity-40">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Dica de Especialista</h4>
           <p className="text-xs text-gray-400 leading-relaxed">Avalie todas as capturas e xeques antes de decidir seu lance industrial definitivo.</p>
        </div>
      </div>
    </div>
  );
};

export default Puzzles;
