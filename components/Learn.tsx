
import React, { useState } from 'react';
import ChessBoard from './ChessBoard';
import { parseFen, createInitialBoard } from '../services/chessLogic';
import { Lesson } from '../types';

const LESSONS: Lesson[] = [
  { id: '1', title: 'Como as Peças se Movem', description: 'Aprenda o básico de cada peça no tabuleiro.', category: 'Basics', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', icon: 'fa-chess-pawn' },
  { id: '2', title: 'O Poder da Torre', description: 'Domine as colunas abertas com suas torres.', category: 'Tactics', fen: '8/8/8/4R3/8/8/8/8', icon: 'fa-chess-rook' },
  { id: '3', title: 'Xeque-Mate do Pastor', description: 'Uma das armadilhas mais famosas do xadrez.', category: 'Tactics', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', icon: 'fa-bolt' },
  { id: '4', title: 'Finais de Peão', description: 'Como coroar seu peão e ganhar o jogo.', category: 'Endgames', fen: '8/4P3/8/4K3/8/8/3k4/8 w - - 0 1', icon: 'fa-chess-king' }
];

const Learn: React.FC = () => {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  if (selectedLesson) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl items-center lg:items-start p-4">
        <div className="w-full max-w-[600px] flex flex-col gap-4">
          <button onClick={() => setSelectedLesson(null)} className="self-start text-gray-400 hover:text-white flex items-center gap-2 mb-2 font-bold text-sm uppercase">
            <i className="fas fa-arrow-left"></i> Voltar para Lições
          </button>
          <ChessBoard board={parseFen(selectedLesson.fen)} onMove={() => {}} turn="w" lastMove={null} />
        </div>
        <div className="w-full lg:w-[380px] bg-[#262421] rounded-xl p-8 border border-[#3c3a37] shadow-xl">
           <div className="mb-6">
              <span className="bg-[#81b64c]/20 text-[#81b64c] px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{selectedLesson.category}</span>
              <h2 className="text-3xl font-bold mt-4">{selectedLesson.title}</h2>
           </div>
           <p className="text-gray-400 leading-relaxed mb-8">{selectedLesson.description}</p>
           <div className="p-4 bg-[#1a1917] rounded-lg border border-white/5 space-y-4">
              <h4 className="font-bold text-sm text-[#81b64c]">O que você vai aprender:</h4>
              <ul className="text-xs space-y-2 text-gray-400">
                <li className="flex items-center gap-2"><i className="fas fa-check text-[#81b64c]"></i> Posicionamento ideal</li>
                <li className="flex items-center gap-2"><i className="fas fa-check text-[#81b64c]"></i> Estratégias fundamentais</li>
                <li className="flex items-center gap-2"><i className="fas fa-check text-[#81b64c]"></i> Erros comuns para evitar</li>
              </ul>
           </div>
           <button className="w-full bg-[#81b64c] py-4 rounded-xl font-bold mt-8 shadow-lg hover:scale-[1.02] transition-transform">INICIAR LIÇÃO PRÁTICA</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl p-6">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Aprenda Xadrez</h1>
        <p className="text-gray-500">Cursos interativos para todos os níveis de habilidade.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {LESSONS.map(lesson => (
          <div 
            key={lesson.id} 
            onClick={() => setSelectedLesson(lesson)}
            className="group bg-[#262421] p-6 rounded-2xl border border-[#3c3a37] hover:border-[#81b64c]/50 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
          >
            <div className="w-14 h-14 bg-[#3c3a37] group-hover:bg-[#81b64c] rounded-xl flex items-center justify-center mb-6 transition-colors">
              <i className={`fas ${lesson.icon} text-2xl group-hover:text-white`}></i>
            </div>
            <span className="text-[10px] font-bold text-[#81b64c] uppercase tracking-widest">{lesson.category}</span>
            <h3 className="text-xl font-bold mt-2 mb-3">{lesson.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{lesson.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Learn;
