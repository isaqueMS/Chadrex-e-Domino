
import React, { useState } from 'react';
import { Move, GameMode } from '../types';

interface GameControlsProps {
  history: Move[];
  onUndo: () => void;
  onResign: () => void;
  turn: 'w' | 'b';
  whiteTimer: number;
  blackTimer: number;
  gameMode: GameMode;
  messages?: {user: string, text: string}[];
  onSendMessage?: (text: string) => void;
  onlineRoom?: string | null;
  onCreateOnline?: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({ 
  history, onUndo, onResign, turn, whiteTimer, blackTimer, gameMode, messages = [], onSendMessage, onlineRoom, onCreateOnline
}) => {
  const [activeTab, setActiveTab] = useState<'moves' | 'chat'>('moves');
  const [chatInput, setChatInput] = useState('');

  // Pair moves for the list display
  const pairedMoves: Move[][] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairedMoves.push([history[i], history[i+1]]);
  }

  const formatSquare = (col: number, row: number) => {
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  };

  return (
    <div className="flex flex-col h-[640px] bg-[#262421] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
      <div className="flex bg-[#1a1917]/50 border-b border-white/5 p-2 gap-1">
        <button 
          onClick={() => setActiveTab('moves')} 
          className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'moves' ? 'bg-[#3c3a37] text-[#81b64c] shadow-lg ring-1 ring-white/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <i className="fas fa-list-ol"></i> Lances
        </button>
        <button 
          onClick={() => setActiveTab('chat')} 
          className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-[#3c3a37] text-[#81b64c] shadow-lg ring-1 ring-white/5' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <i className="fas fa-comments"></i> Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'moves' ? (
          <div className="w-full">
            {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-4">
                      <i className="fas fa-chess-pawn text-2xl"></i>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Partida não iniciada</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="py-2 text-[9px] font-black text-gray-600 uppercase w-10">#</th>
                      <th className="py-2 text-[9px] font-black text-gray-600 uppercase">Brancas</th>
                      <th className="py-2 text-[9px] font-black text-gray-600 uppercase">Pretas</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    {pairedMoves.map((pair, idx) => (
                      <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white/[0.02]' : ''} group`}>
                        <td className="py-2.5 text-gray-600 font-mono text-xs">{idx + 1}.</td>
                        <td className="py-2.5 text-gray-100 uppercase tracking-tight">
                          <span className="font-bold">{formatSquare(pair[0].to.col, pair[0].to.row)}</span>
                          {pair[0].captured && <span className="text-gray-500 text-[10px] ml-1">x</span>}
                        </td>
                        <td className="py-2.5 text-gray-100 uppercase tracking-tight">
                          {pair[1] ? (
                            <>
                              <span className="font-bold">{formatSquare(pair[1].to.col, pair[1].to.row)}</span>
                              {pair[1].captured && <span className="text-gray-500 text-[10px] ml-1">x</span>}
                            </>
                          ) : (
                            <span className="w-2 h-0.5 bg-gray-700 block rounded-full"></span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {gameMode !== GameMode.ONLINE ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-30 px-10">
                    <i className="fas fa-shield-halved text-4xl mb-6 text-gray-500"></i>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Ambiente Protegido</p>
                    <p className="text-[10px] text-gray-600 uppercase font-black leading-relaxed">O chat é habilitado automaticamente em conexões ponto-a-ponto com oponentes reais.</p>
                </div>
            ) : (
                <>
                    <div className="flex-1 space-y-4 overflow-y-auto mb-4 pr-2 custom-scrollbar">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.user === 'Sistema' ? 'items-center opacity-50' : 'items-start'}`}>
                          {m.user !== 'Sistema' && <span className="text-[8px] font-black text-gray-500 uppercase ml-3 mb-1">{m.user}</span>}
                          <div className={`px-4 py-2.5 rounded-2xl text-[12px] shadow-sm leading-relaxed ${m.user === 'Sistema' ? 'bg-transparent text-gray-500 italic' : 'bg-[#3c3a37] text-gray-200 border border-white/5 rounded-tl-none'}`}>
                            {m.text}
                          </div>
                        </div>
                    ))}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); if(chatInput.trim() && onSendMessage) { onSendMessage(chatInput); setChatInput(''); } }} className="flex gap-2">
                      <input 
                        value={chatInput} 
                        onChange={e => setChatInput(e.target.value)} 
                        placeholder="Escreva sua mensagem..." 
                        className="flex-1 bg-[#1a1917] border border-white/5 rounded-2xl px-5 py-3 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]/50 transition-all shadow-inner" 
                      />
                      <button type="submit" className="bg-[#81b64c] w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg hover:brightness-110 active:scale-95 transition-all">
                        <i className="fas fa-paper-plane"></i>
                      </button>
                    </form>
                </>
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-[#1a1917] border-t border-white/5 flex flex-col gap-4">
        {onlineRoom ? (
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?room=${onlineRoom}`); }} className="w-full py-4 bg-[#81b64c] rounded-2xl font-black text-xs uppercase shadow-[0_4px_0_#456528] active:translate-y-1 active:shadow-none hover:brightness-110 transition-all flex items-center justify-center gap-3">
            <i className="fas fa-link"></i> Compartilhar Link
          </button>
        ) : (
          <button onClick={onCreateOnline} className="w-full py-4 bg-[#3c3a37] hover:bg-[#4a4844] rounded-2xl font-black text-xs uppercase shadow-[0_4px_0_#1a1917] active:translate-y-1 active:shadow-none hover:brightness-110 transition-all flex items-center justify-center gap-3">
            <i className="fas fa-user-friends"></i> Criar Sala Online
          </button>
        )}
        <div className="flex gap-3 mt-2">
          <button onClick={onUndo} className="flex-1 bg-[#262421] border border-white/5 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-[#3c3a37] transition-all text-gray-400 hover:text-white">
            <i className="fas fa-redo-alt mr-2"></i> Resetar
          </button>
          <button onClick={onResign} className="flex-1 bg-red-500/10 border border-red-500/20 py-3 rounded-xl font-black text-[10px] uppercase text-red-400 hover:bg-red-500 hover:text-white transition-all">
            <i className="fas fa-flag mr-2"></i> Render-se
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameControls;
