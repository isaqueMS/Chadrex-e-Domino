
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
  const [shareStatus, setShareStatus] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && onSendMessage) {
      onSendMessage(chatInput);
      setChatInput('');
    }
  };

  const handleShare = async () => {
    if (!onlineRoom) return;
    const url = `${window.location.origin}/?room=${onlineRoom}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus(true);
      setTimeout(() => setShareStatus(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link', err);
    }
  };

  return (
    <div className="flex flex-col h-full sidebar-bg rounded-3xl overflow-hidden border border-[#3c3a37] shadow-2xl">
      <div className="flex border-b border-[#3c3a37]">
        <button 
          onClick={() => setActiveTab('moves')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'moves' ? 'text-[#81b64c] bg-[#3c3a37]/30 border-b-2 border-[#81b64c]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Lances
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'text-[#81b64c] bg-[#3c3a37]/30 border-b-2 border-[#81b64c]' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Chat {messages.length > 0 && `(${messages.length})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#1a1917]/50 custom-scrollbar">
        {activeTab === 'moves' ? (
          <div className="space-y-1">
            {history.map((move, i) => (
              <div key={i} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${Math.floor(i/2) % 2 === 0 ? 'bg-white/5' : ''}`}>
                <span className="text-gray-600 font-mono w-5">{i % 2 === 0 ? `${Math.floor(i/2) + 1}.` : ''}</span>
                <span className="font-bold text-gray-200">
                   <i className={`fas fa-chess-${move.piece.type === 'n' ? 'knight' : move.piece.type === 'b' ? 'bishop' : move.piece.type === 'r' ? 'rook' : move.piece.type === 'q' ? 'queen' : move.piece.type === 'k' ? 'king' : 'pawn'} mr-2 opacity-50`}></i>
                  {String.fromCharCode(97 + move.to.col)}{8 - move.to.row}
                </span>
                {move.captured && <span className="text-red-400 text-[10px] font-black uppercase">Captura</span>}
              </div>
            ))}
            {history.length === 0 && <div className="text-center text-gray-600 text-[10px] mt-10 uppercase font-black tracking-widest animate-pulse">Aguardando lance...</div>}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4 overflow-y-auto mb-4 pr-1">
              {messages.length === 0 && <div className="text-center text-gray-600 text-[10px] mt-10 italic uppercase font-black">Silêncio na sala...</div>}
              {messages.map((m, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-500 uppercase mb-1">{m.user}</span>
                  <div className={`px-3 py-2 rounded-xl text-[11px] inline-block max-w-[90%] ${m.user === 'System' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-[#3c3a37] text-gray-200'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
              <input 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Provocar oponente..."
                className="flex-1 bg-[#262421] border border-[#3c3a37] rounded-xl px-4 py-2 text-xs outline-none focus:border-[#81b64c] transition-all"
              />
              <button type="submit" className="bg-[#81b64c] w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="p-4 bg-[#2a2825] border-t border-[#3c3a37] flex flex-col gap-3">
        {onlineRoom ? (
          <button 
            onClick={handleShare}
            className={`w-full py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${shareStatus ? 'bg-[#81b64c] text-white shadow-[0_4px_0_#456528]' : 'bg-[#3c3a37] text-[#81b64c] border border-[#81b64c]/30 hover:bg-[#81b64c]/10'}`}
          >
            <i className={`fas ${shareStatus ? 'fa-check' : 'fa-link'}`}></i>
            {shareStatus ? 'Link Copiado!' : 'Convidar Amigo'}
          </button>
        ) : (
          <button 
            onClick={onCreateOnline}
            className="w-full py-3 bg-[#81b64c] rounded-xl font-black text-[10px] uppercase shadow-[0_4px_0_#456528] active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-globe"></i> Jogar Online
          </button>
        )}
        <div className="flex gap-2">
          <button 
            onClick={onUndo}
            className="flex-1 bg-[#3c3a37] py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-[#4a4844] transition-all"
          >
            Novo Jogo
          </button>
          <button onClick={onResign} className="flex-1 bg-red-500/10 border border-red-500/20 py-2.5 rounded-xl font-black text-[9px] uppercase text-red-400 hover:bg-red-500 hover:text-white transition-all">
            Desistir
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameControls;
