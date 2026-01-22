
import React, { useState, useEffect, useRef } from 'react';
import { User, DominoTile, DominoMove, DominoGameState, DominoChatMessage } from '../types';
import { createFullSet, shuffleSet, canPlayTile } from '../services/dominoLogic';
import { db } from '../services/firebase';

const IndustrialTile: React.FC<{ 
  tile?: DominoTile; 
  isFlipped?: boolean; 
  onClick?: () => void; 
  disabled?: boolean;
  highlight?: boolean;
  isBoardPiece?: boolean;
  isClosed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ tile, isFlipped, onClick, disabled, highlight, isBoardPiece, isClosed, size = 'md' }) => {
  if (isClosed) {
    return (
      <div className={`relative ${size === 'sm' ? 'w-6 h-10' : 'w-8 h-14'} bg-[#1a1a1a] rounded-lg border border-white/10 shrink-0 shadow-lg`}
           style={{ backgroundImage: 'linear-gradient(145deg, #222 0%, #000 100%)' }}>
        <div className="absolute inset-1.5 border border-[#81b64c]/5 rounded-sm flex items-center justify-center">
          <div className="w-1 h-1 bg-[#81b64c]/20 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!tile) return null;

  const a = isFlipped ? tile.sideB : tile.sideA;
  const b = isFlipped ? tile.sideA : tile.sideB;
  
  const renderDots = (n: number) => {
    const dotPos = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]][n];
    return (
      <div className={`grid grid-cols-3 grid-rows-3 gap-[1px] w-full h-full ${size === 'sm' ? 'p-1' : 'p-1.5'}`}>
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dotPos.includes(i) && (
              <div className={`rounded-full shadow-[0_0_8px_#81b64c] transition-colors duration-300 ${highlight ? 'bg-[#f6f669]' : 'bg-[#81b64c]'} ${size === 'sm' ? 'w-[60%] h-[60%]' : 'w-[75%] h-[75%]'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const isBucha = tile.sideA === tile.sideB;
  const isHorizontal = isBoardPiece ? !isBucha : false;

  const dimensions = {
    sm: isHorizontal ? 'w-14 h-7' : 'w-7 h-14',
    md: isHorizontal ? 'w-20 h-10' : 'w-10 h-20',
    lg: isHorizontal ? 'w-24 h-12' : 'w-12 h-24',
  }[size];

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`relative flex transition-all duration-300 shrink-0 border border-white/5 
        ${!disabled ? 'cursor-pointer hover:border-[#81b64c] hover:scale-105 active:scale-95' : 'cursor-default'} 
        ${dimensions}
        ${isBoardPiece ? 'rounded-sm' : 'rounded-xl'}
        ${highlight ? 'ring-2 ring-[#81b64c]/50 border-[#81b64c]' : ''}
      `}
      style={{ 
        backgroundImage: 'linear-gradient(145deg, #2a2a2a 0%, #0a0a0a 100%)', 
        boxShadow: isBoardPiece ? '2px 2px 8px rgba(0,0,0,0.6)' : '0 8px 20px rgba(0,0,0,0.8)' 
      }}
    >
      <div className="flex-1 flex items-center justify-center">{renderDots(a)}</div>
      <div className={`${isHorizontal ? 'w-[1.5px] h-3/4 my-auto bg-[#333]' : 'h-[1.5px] w-3/4 mx-auto bg-[#333]'}`} />
      <div className="flex-1 flex items-center justify-center">{renderDots(b)}</div>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-[#444] rounded-sm rotate-45 border border-white/10`} />
    </div>
  );
};

const DominoGame: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [roomId, setRoomId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('domino'));
  const [gameState, setGameState] = useState<DominoGameState | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ tile: DominoTile, options: any[] } | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = db.ref(`domino_rooms/${roomId}`);
    
    const onValue = (snap: any) => {
      const val = snap.val();
      if (val) {
        setGameState(val);
        const players = val.players || [];
        if (val.status === 'waiting' && !players.some((p: User) => p.id === currentUser.id) && players.length < 4) {
          roomRef.child('players').set([...players, currentUser]);
          sendSystemMessage(`Operador ${currentUser.name} sincronizado.`);
        }
      }
    };

    roomRef.on('value', onValue);
    return () => roomRef.off('value', onValue);
  }, [roomId, currentUser]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.chat]);

  useEffect(() => {
    if (boardRef.current) {
      const { scrollWidth, clientWidth } = boardRef.current;
      boardRef.current.scrollTo({
        left: scrollWidth - clientWidth / 2,
        behavior: 'smooth'
      });
    }
  }, [gameState?.board?.length]);

  const createRoom = () => {
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const newRoomData = {
      players: [currentUser],
      turnIndex: 0,
      board: [],
      hands: {},
      boneyard: shuffleSet(createFullSet()),
      status: 'waiting',
      createdAt: Date.now(),
      chat: {}
    };
    db.ref(`domino_rooms/${id}`).set(newRoomData);
    setRoomId(id);
    window.history.replaceState(null, '', `?domino=${id}`);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?domino=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendSystemMessage = (text: string) => {
    if (!roomId) return;
    db.ref(`domino_rooms/${roomId}/chat`).push({
      user: 'SISTEMA',
      text,
      timestamp: Date.now()
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomId) return;

    db.ref(`domino_rooms/${roomId}/chat`).push({
      user: currentUser.name,
      text: chatInput,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  const startMatch = () => {
    if (!gameState || !roomId) return;
    const fullSet = shuffleSet(createFullSet());
    const players = gameState.players || [];
    const hands: Record<string, DominoTile[]> = {};
    
    players.forEach((p, i) => {
      hands[p.id] = fullSet.slice(i * 7, (i + 1) * 7);
    });

    const boneyard = fullSet.slice(players.length * 7);

    db.ref(`domino_rooms/${roomId}`).update({
      status: 'playing',
      hands,
      boneyard,
      board: [],
      turnIndex: 0,
      winnerId: null
    });
    sendSystemMessage("Sequência tática iniciada. Boa sorte.");
  };

  const drawTile = () => {
    if (!gameState || !roomId || !isMyTurn) return;
    const boneyard = gameState.boneyard || [];
    if (boneyard.length === 0) return;

    const drawn = boneyard[0];
    const newBoneyard = boneyard.slice(1);
    const newHand = [...(gameState.hands?.[currentUser.id] || []), drawn];

    db.ref(`domino_rooms/${roomId}`).update({
      boneyard: newBoneyard,
      [`hands/${currentUser.id}`]: newHand
    });
  };

  const passTurn = () => {
    if (!gameState || !roomId || !isMyTurn) return;
    const players = gameState.players || [];
    db.ref(`domino_rooms/${roomId}`).update({
      turnIndex: (gameState.turnIndex + 1) % players.length
    });
  };

  const handlePlay = (tile: DominoTile) => {
    if (!gameState || !roomId || gameState.status !== 'playing') return;
    if (!isMyTurn) return;

    const options = canPlayTile(tile, gameState.board || []);
    if (options.length === 0) return;

    if (options.length > 1) {
      setPendingSelection({ tile, options });
    } else {
      executeMove(tile, options[0]);
    }
  };

  const executeMove = (tile: DominoTile, choice: any) => {
    if (!gameState || !roomId) return;
    const players = gameState.players || [];
    const move = { tile, side: choice.side, isFlipped: choice.isFlipped };
    const board = gameState.board || [];
    const newBoard = move.side === 'left' ? [move, ...board] : [...board, move];
    
    const currentHand = (gameState.hands?.[currentUser.id]) || [];
    const newHand = currentHand.filter((t: any) => t.id !== tile.id);

    const updates: any = {
      board: newBoard,
      [`hands/${currentUser.id}`]: newHand,
      turnIndex: (gameState.turnIndex + 1) % players.length
    };

    if (newHand.length === 0) {
      updates.status = 'finished';
      updates.winnerId = currentUser.id;
      sendSystemMessage(`Operação concluída. Vencedor: ${currentUser.name}`);
    }

    db.ref(`domino_rooms/${roomId}`).update(updates);
    setPendingSelection(null);
  };

  const players = gameState?.players || [];
  const myHand = (gameState?.hands?.[currentUser.id]) || [];
  const boneyard = gameState?.boneyard || [];
  const turnIndex = gameState?.turnIndex ?? 0;
  const currentTurnPlayer = players[turnIndex];
  const isMyTurn = currentTurnPlayer?.id === currentUser.id;
  const canIPlay = myHand.some(t => canPlayTile(t, gameState?.board || []).length > 0);
  // Fix: Explicitly type chatMessages to DominoChatMessage[] to resolve 'unknown' inference in map
  const chatMessages: DominoChatMessage[] = gameState?.chat ? Object.values(gameState.chat) : [];

  if (!roomId) return (
    <div className="flex flex-col items-center justify-center h-full gap-12 bg-[#1a1917] w-full max-w-4xl rounded-[4rem] border border-white/5 shadow-2xl p-12">
      <div className="text-center">
        <h1 className="text-7xl font-black italic tracking-tighter text-white mb-4 uppercase">Carbon <span className="text-[#81b64c]">Core</span></h1>
        <p className="text-gray-500 uppercase text-xs font-bold tracking-[0.2em] max-w-xs mx-auto">Domino Industrial Tactic Simulation</p>
      </div>
      <button onClick={createRoom} className="bg-[#81b64c] hover:bg-[#95c65d] px-20 py-6 rounded-3xl font-black text-xl shadow-[0_8px_0_#456528] active:translate-y-1 transition-all">GERAR ACESSO</button>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full w-full max-w-[1400px] gap-6 overflow-hidden pb-20 px-4 relative">
      
      {/* Coluna Principal: Game Area */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Header Industrial */}
        <div className="flex flex-wrap justify-between items-center bg-[#262421] p-5 rounded-3xl border border-white/5 shadow-xl gap-4 z-10">
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-3">
                <div className="bg-[#1a1917] px-4 py-2 rounded-xl border border-[#81b64c]/20 text-[#81b64c] font-black font-mono shadow-inner text-sm">
                  <span className="text-gray-600 mr-2 text-[9px]">NODE:</span>{roomId}
                </div>
                <button 
                  onClick={copyInviteLink} 
                  className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${copied ? 'bg-[#81b64c] text-white' : 'bg-[#3c3a37] text-gray-300 hover:bg-[#4a4844]'}`}
                >
                  <i className={`fas ${copied ? 'fa-check' : 'fa-link'}`}></i>
                  {copied ? 'COPIADO' : 'CONVIDAR'}
                </button>
             </div>
             <div className="bg-black/40 px-3 py-1.5 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-widest border border-white/5 w-fit">
               Boneyard: {boneyard.length} UNITS
             </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {players.map((p, i) => {
              const playerHandCount = (gameState?.hands?.[p.id] || []).length;
              const active = turnIndex === i;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-2xl border transition-all duration-300 ${active ? 'bg-[#81b64c]/10 border-[#81b64c] scale-105 shadow-lg' : 'bg-[#1a1917] border-transparent opacity-60'}`}>
                  <div className="relative">
                    <img src={p.avatar} className="w-8 h-8 rounded-xl bg-black/50 border border-white/10" alt="avatar" />
                    {active && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#81b64c] rounded-full animate-pulse shadow-[0_0_8px_#81b64c]" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-white leading-none truncate max-w-[70px]">{p.name}</span>
                    <span className="text-[8px] text-gray-500 font-bold mt-1 tracking-tighter">{playerHandCount} PEÇAS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 min-h-0 bg-[#121212] rounded-[3rem] border-[8px] md:border-[12px] border-[#262421] relative flex items-center justify-center overflow-hidden shadow-2xl z-0">
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
          
          {gameState?.status === 'waiting' ? (
            <div className="z-10 text-center flex flex-col items-center p-10">
              <h2 className="text-3xl md:text-4xl font-black text-white/20 mb-10 uppercase tracking-[0.3em]">Aguardando Operação</h2>
              {players.length >= 2 ? (
                <button onClick={startMatch} className="bg-[#81b64c] hover:bg-[#95c65d] px-16 py-5 rounded-2xl font-black text-white shadow-[0_6px_0_#456528] active:translate-y-1 transition-all uppercase tracking-widest text-lg">SINCRONIZAR</button>
              ) : (
                <div className="text-gray-600 font-bold uppercase text-[10px] tracking-widest animate-pulse">Min. 2 Operadores Requeridos ({players.length}/2)</div>
              )}
            </div>
          ) : (
            <div 
              ref={boardRef} 
              className="flex items-center gap-1.5 px-10 md:px-40 py-20 overflow-x-auto overflow-y-hidden w-full h-full custom-scrollbar no-scrollbar"
              style={{ scrollBehavior: 'smooth' }}
            >
              <div className="flex-shrink-0 w-[5%] md:w-[15%]" />
              {(gameState?.board || []).map((m, i) => (
                <IndustrialTile key={`${m.tile.id}-${i}`} tile={m.tile} isFlipped={m.isFlipped} isBoardPiece size="md" />
              ))}
              <div className="flex-shrink-0 w-[5%] md:w-[15%]" />
            </div>
          )}

          {/* Overlay de Seleção */}
          {pendingSelection && (
            <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
              <h3 className="text-xl font-black text-white uppercase tracking-[0.4em] mb-12">Direcionar Fluxo</h3>
              <div className="flex gap-8 md:gap-16">
                {pendingSelection.options.map((opt, i) => (
                  <button 
                    key={i}
                    onClick={() => executeMove(pendingSelection.tile, opt)}
                    className="group flex flex-col items-center gap-6"
                  >
                    <div className="bg-[#262421] p-6 md:p-10 rounded-3xl border-2 border-[#81b64c]/20 group-hover:border-[#81b64c] transition-all transform group-hover:scale-110 shadow-2xl">
                       <i className={`fas fa-chevron-${opt.side === 'left' ? 'left' : 'right'} text-4xl md:text-5xl text-[#81b64c]`}></i>
                    </div>
                    <span className="text-[10px] md:text-[11px] font-black uppercase text-[#81b64c] tracking-[0.2em]">{opt.side === 'left' ? 'TERMINAL ALFA' : 'TERMINAL ÔMEGA'}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setPendingSelection(null)} className="mt-16 text-gray-500 hover:text-white uppercase text-[9px] font-black tracking-widest">CANCELAR</button>
            </div>
          )}

          {gameState?.status === 'finished' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[200] p-10 backdrop-blur-xl">
              <h2 className="text-4xl md:text-7xl font-black text-[#81b64c] mb-4 uppercase italic tracking-tighter drop-shadow-xl text-center">SISTEMA DOMINADO</h2>
              <p className="text-white text-lg md:text-xl font-bold mb-12 uppercase tracking-widest">OPERADOR: {players.find(p => p.id === gameState.winnerId)?.name}</p>
              <button onClick={startMatch} className="bg-[#81b64c] hover:bg-[#95c65d] px-16 md:px-20 py-5 md:py-6 rounded-3xl font-black text-lg md:text-xl shadow-[0_8px_0_#456528]">NOVA OPERAÇÃO</button>
            </div>
          )}
        </div>

        {/* Control Panel / Hand Area */}
        <div className="bg-[#262421] p-4 md:p-6 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row gap-6 shadow-2xl relative overflow-hidden z-10">
          <div className="flex flex-row md:flex-col justify-between md:justify-center gap-4 min-w-0 md:min-w-[180px]">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isMyTurn ? 'bg-[#81b64c] shadow-[0_0_12px_#81b64c]' : 'bg-gray-800'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isMyTurn ? 'text-[#81b64c]' : 'text-gray-600'} truncate`}>
                {isMyTurn ? 'OPERADOR ATIVO' : 'STANDBY'}
              </span>
            </div>
            
            <div className="flex flex-row md:flex-col gap-2">
              <button 
                disabled={!isMyTurn || boneyard.length === 0 || canIPlay}
                onClick={drawTile}
                className={`py-2 md:py-3 px-3 md:px-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${(!isMyTurn || boneyard.length === 0 || canIPlay) ? 'bg-[#1a1917] text-gray-700 opacity-50 cursor-not-allowed' : 'bg-[#3c3a37] text-white hover:bg-[#4a4844] shadow-lg active:scale-95'}`}
              >
                <i className="fas fa-plus-circle mr-1 md:mr-2"></i> COMPRAR
              </button>
              <button 
                disabled={!isMyTurn || boneyard.length > 0 || canIPlay}
                onClick={passTurn}
                className={`py-2 md:py-3 px-3 md:px-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${(!isMyTurn || boneyard.length > 0 || canIPlay) ? 'bg-[#1a1917] text-gray-700 opacity-50 cursor-not-allowed' : 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white shadow-lg active:scale-95'}`}
              >
                <i className="fas fa-forward mr-1 md:mr-2"></i> PASSAR
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-3 md:gap-4 overflow-x-auto py-2 md:py-4 px-3 md:px-4 custom-scrollbar no-scrollbar bg-black/20 rounded-2xl md:rounded-3xl border border-white/5 shadow-inner">
            {myHand.map((t) => (
              <IndustrialTile 
                key={t.id} 
                tile={t} 
                onClick={() => handlePlay(t)} 
                disabled={!isMyTurn} 
                highlight={isMyTurn && canPlayTile(t, gameState?.board || []).length > 0} 
                size="lg"
              />
            ))}
            {myHand.length === 0 && gameState?.status === 'playing' && (
              <div className="flex-1 flex items-center justify-center opacity-10 uppercase font-black tracking-widest text-xs">Aguardando...</div>
            )}
          </div>
        </div>
      </div>

      {/* Coluna Lateral: Chat Industrial */}
      <div className="w-full lg:w-[320px] bg-[#262421] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl h-[400px] lg:h-auto mb-20 lg:mb-0">
        <div className="bg-[#1a1917] p-5 border-b border-white/5 flex items-center gap-3">
          <i className="fas fa-comments text-[#81b64c]"></i>
          <h3 className="font-black text-xs uppercase tracking-widest text-white">Interface de Chat</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
              <i className="fas fa-terminal text-4xl mb-4"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma transmissão registrada</p>
            </div>
          ) : (
            chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.user === 'SISTEMA' ? 'items-center py-2' : ''}`}>
                {m.user !== 'SISTEMA' && (
                  <span className={`text-[8px] font-black uppercase tracking-tighter mb-1 ${m.user === currentUser.name ? 'text-[#81b64c] text-right pr-2' : 'text-gray-500 pl-2'}`}>
                    {m.user}
                  </span>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-[11px] leading-relaxed shadow-sm break-words ${
                  m.user === 'SISTEMA' ? 'bg-transparent text-[#81b64c] italic text-center text-[9px]' : 
                  m.user === currentUser.name ? 'bg-[#81b64c]/10 text-white border border-[#81b64c]/20 self-end rounded-tr-none' : 
                  'bg-[#1a1917] text-gray-300 border border-white/5 self-start rounded-tl-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-[#1a1917] border-t border-white/5 flex gap-2">
          <input 
            type="text" 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)} 
            placeholder="Transmitir mensagem..." 
            className="flex-1 bg-[#262421] border border-white/5 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-[#81b64c]/50 transition-all text-white placeholder:text-gray-600 font-mono"
          />
          <button type="submit" className="bg-[#81b64c] w-10 h-10 rounded-xl flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition-all">
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>

    </div>
  );
};

export default DominoGame;
