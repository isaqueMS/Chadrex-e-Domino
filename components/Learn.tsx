
import React, { useState } from 'react';
import ChessBoard from './ChessBoard';
import { Board, Lesson, Move } from '../types';
import { parseFen, makeMove } from '../services/chessLogic';

const LESSONS: Lesson[] = [
  { id: '1', title: 'Fundamentos: Abertura', description: 'Domine o centro com peões e desenvolva suas peças menores (cavalos e bispos) para casas ativas antes do seu oponente.', category: 'Princípios', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', icon: 'fa-chess-pawn' },
  { id: '2', title: 'Mate do Pastor', description: 'Aprenda a reconhecer a ameaça na casa f7 e como se defender contra o ataque rápido de Dama e Bispo.', category: 'Tática de Alerta', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', icon: 'fa-bolt' },
  { id: '3', title: 'Domínio da Sétima', description: 'Uma torre na sétima fileira é devastadora. Ela paralisia o rei inimigo e ataca a cadeia de peões por trás.', category: 'Estratégia', fen: '8/8/2r5/8/8/8/2R5/8 w - - 0 1', icon: 'fa-chess-rook' }
];

const Learn: React.FC = () => {
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<Move[]>([]);

  const startLesson = (lesson: Lesson) => {
    setSelected(lesson);
    setBoard(parseFen(lesson.fen));
    setHistory([]);
  };

  const handleLessonMove = (move: Move) => {
    if (!board) return;
    const nextBoard = makeMove(board, move);
    setBoard(nextBoard);
    setHistory([...history, move]);
  };

  const resetSandbox = () => {
    if (selected) {
      setBoard(parseFen(selected.fen));
      setHistory([]);
    }
  };

  if (selected && board) {
    return (
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl py-8 animate-in slide-in-from-right duration-500">
        <div className="flex-1 w-full max-w-[640px] flex flex-col gap-4">
          <button 
            onClick={() => setSelected(null)} 
            className="flex items-center gap-3 text-gray-500 hover:text-[#81b64c] uppercase text-[10px] font-black tracking-widest mb-2 transition-colors w-fit group"
          >
            <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> Retornar ao Arquivo
          </button>
          
          <div className="bg-[#262421] p-1 rounded-xl shadow-2xl border border-white/5">
            <ChessBoard board={board} onMove={handleLessonMove} turn="w" lastMove={history[history.length-1] || null} />
          </div>
        </div>

        <div className="w-full lg:w-[420px] flex flex-col gap-6">
          <div className="bg-[#262421] rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#81b64c]/5 rounded-bl-full pointer-events-none" />
            <span className="bg-[#81b64c]/10 text-[#81b64c] px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#81b64c]/20">
              {selected.category}
            </span>
            <h2 className="text-4xl font-black mt-8 mb-6 leading-tight tracking-tighter">{selected.title}</h2>
            <p className="text-gray-400 text-base leading-relaxed mb-10">{selected.description}</p>
            
            <div className="bg-[#1a1917] p-8 rounded-3xl border border-white/5 space-y-6 shadow-inner">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#3c3a37] rounded-xl flex items-center justify-center">
                  <i className="fas fa-flask text-[#81b64c]"></i>
                </div>
                <h4 className="font-black text-xs text-gray-200 uppercase tracking-widest">Sandbox Experimental</h4>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed italic">Simule variações táticas livremente no tabuleiro acima para absorver os conceitos industriais.</p>
              <button 
                onClick={resetSandbox} 
                className="w-full py-4 bg-[#81b64c] hover:bg-[#95c65d] rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                Reiniciar Simulação
              </button>
            </div>
          </div>
          
          <div className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10 flex gap-4 items-center">
            <i className="fas fa-info-circle text-blue-400 text-xl"></i>
            <p className="text-[10px] text-blue-400/80 uppercase font-bold leading-relaxed">Dica: Movimentos realizados no sandbox não afetam seu ELO global.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl py-10 animate-in fade-in duration-700">
      <div className="mb-14 border-l-4 border-[#81b64c] pl-8">
        <h1 className="text-6xl font-black tracking-tighter italic uppercase mb-2">Knowledge Base</h1>
        <p className="text-gray-500 font-bold uppercase text-xs tracking-[0.3em]">Protocolos de treinamento avançado para operadores pro.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {LESSONS.map(l => (
          <div 
            key={l.id} 
            onClick={() => startLesson(l)} 
            className="bg-[#262421] p-10 rounded-[2.5rem] border border-white/5 hover:border-[#81b64c] transition-all cursor-pointer group shadow-xl relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-[#81b64c]/10 transition-colors" />
            <div className="w-16 h-16 bg-[#3c3a37] group-hover:bg-[#81b64c] rounded-2xl flex items-center justify-center mb-8 transition-all duration-500 shadow-lg group-hover:rotate-12 group-hover:scale-110">
              <i className={`fas ${l.icon} text-2xl group-hover:text-white transition-colors`}></i>
            </div>
            <span className="text-[10px] font-black text-[#81b64c] uppercase tracking-[0.2em]">{l.category}</span>
            <h3 className="text-2xl font-black mt-4 mb-4 tracking-tight group-hover:text-[#81b64c] transition-colors">{l.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{l.description}</p>
            <div className="mt-8 flex items-center gap-2 text-[#81b64c] text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 transition-transform">
              Acessar Módulo <i className="fas fa-chevron-right ml-1"></i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Learn;
