
import React, { useState, useEffect } from 'react';
import ChessBoard from './ChessBoard';
import { Board, Move, Puzzle } from '../types';
import { parseFen, makeMove } from '../services/chessLogic';

const PUZZLES_DATA: Puzzle[] = [
  { id: '1', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', moves: ['h5f7'], description: 'Brancas dão xeque-mate em 1 lance.', difficulty: 400 },
  { id: '2', fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 1', moves: ['c4d5'], description: 'Brancas ganham um peão central.', difficulty: 600 },
  { id: '3', fen: 'r1b1k1nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1 w - - 0 1', moves: ['f3f7'], description: 'Ache o melhor ataque.', difficulty: 1200 }
];

const Puzzles: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [puzzle, setPuzzle] = useState(PUZZLES_DATA[0]);
  const [board, setBoard] = useState<Board>(parseFen(puzzle.fen));
  const [history, setHistory] = useState<Move[]>([]);
  const [status, setStatus] = useState<'solving' | 'correct' | 'wrong'>('solving');
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const p = PUZZLES_DATA[currentIdx];
    setPuzzle(p);
    setBoard(parseFen(p.fen));
    setHistory([]);
    setStatus('solving');
  }, [currentIdx]);

  const handleMove = (move: Move) => {
    if (status === 'correct') return;

    const moveStr = `${String.fromCharCode(97 + move.from.col)}${8 - move.from.row}${String.fromCharCode(97 + move.to.col)}${8 - move.to.row}`;
    
    if (moveStr === puzzle.moves[0]) {
      const nb = makeMove(board, move);
      setBoard(nb);
      setHistory([move]);
      setStatus('correct');
      setStreak(s => s + 1);
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus('solving'), 1000);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl items-center lg:items-start p-4">
      <div className="w-full max-w-[600px] flex flex-col gap-4">
        <div className={`p-4 rounded-lg font-bold text-center transition-all ${status === 'correct' ? 'bg-[#81b64c] text-white' : status === 'wrong' ? 'bg-red-600 text-white' : 'bg-[#262421] text-gray-400'}`}>
          {status === 'correct' ? 'MUITO BEM!' : status === 'wrong' ? 'TENTE NOVAMENTE' : puzzle.description}
        </div>
        <ChessBoard board={board} onMove={handleMove} turn="w" lastMove={history[0] || null} />
      </div>

      <div className="w-full lg:w-[380px] bg-[#262421] rounded-xl p-6 border border-[#3c3a37] shadow-xl">
        <h2 className="text-2xl font-bold text-[#81b64c] mb-6 flex items-center gap-2">
            <i className="fas fa-puzzle-piece"></i> Problemas
        </h2>
        
        <div className="space-y-6">
            <div className="bg-[#1a1917] p-4 rounded-lg border border-white/5">
                <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Dificuldade Estimada</span>
                <span className="text-xl font-mono font-black text-[#81b64c]">{puzzle.difficulty}</span>
            </div>

            <div className="bg-[#1a1917] p-4 rounded-lg border border-white/5 flex justify-between items-center">
                <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Sessão Atual</span>
                    <span className="text-lg font-bold">{streak} Acertos</span>
                </div>
                <div className="text-3xl">🔥</div>
            </div>

            {status === 'correct' && (
                <button 
                    onClick={() => setCurrentIdx((currentIdx + 1) % PUZZLES_DATA.length)}
                    className="w-full bg-[#81b64c] py-4 rounded-xl font-bold text-xl shadow-lg hover:brightness-110 transition-all"
                >
                    PRÓXIMO PROBLEMA
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default Puzzles;
