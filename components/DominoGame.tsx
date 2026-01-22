
import React, { useState, useEffect, useRef } from 'react';
import { User, DominoTile, DominoMove, DominoGameState, DominoChatMessage, DominoMode } from '../types';
import { createFullSet, shuffleSet, canPlayTile } from '../services/dominoLogic';
import { db } from '../services/firebase';

const QUICK_EMOJIS = ['♟️', '🎲', '🧩', '🔥', '🧠', '🦾', '⚡', '🏆', '🤝', '💀'];

const IndustrialTile: React.FC<{ 
  tile?: DominoTile; 
  isFlipped?: boolean; 
  onClick?: () => void; 
  disabled?: boolean;
  highlight?: boolean;
  isBoardPiece?: boolean;
  isClosed?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ tile, isFlipped, onClick, disabled, highlight, isBoardPiece, isClosed, size = 'md' }) => {
  if (isClosed) {
    return (
      <div className={`relative ${size === 'sm' ? 'w-8 h-12' : size === 'md' ? 'w-10 h-16' : 'w-14 h-22'} bg-[#1a1a1a] rounded-lg border border-white/10 shrink-0 shadow-lg`}
           style={{ backgroundImage: 'linear-gradient(145deg, #222 0%, #000 100%)' }}>
        <div className="absolute inset-2 border border-[#81b64c]/10 rounded-sm flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-[#81b64c]/30 rounded-full animate-pulse" />
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
      <div className={`grid grid-cols-3 grid-rows-3 gap-[1px] w-full h-full ${size === 'sm' ? 'p-1' : size === 'xl' ? 'p-3' : 'p-2'}`}>
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dotPos.includes(i) && (
              <div className={`rounded-full shadow-[0_0_12px_#81b64c] transition-all duration-300 ${highlight ? 'bg-[#f6f669] scale-125' : 'bg-[#81b64c]'} ${size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : size === 'xl' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const isBucha = tile.sideA === tile.sideB;
  const isHorizontal = isBoardPiece ? !isBucha : false;

  const dims = {
    sm: isHorizontal ? 'w-16 h-8' : 'w-8 h-16',
    md: isHorizontal ? 'w-24 h-12' : 'w-12 h-24',
    lg: isHorizontal ? 'w-28 h-14' : 'w-14 h-28',
    xl: isHorizontal ? 'w-36 h-18' : 'w-18 h-36',
  }[size];

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`relative flex transition-all duration-300 shrink-0 border 
        ${!disabled ? 'cursor-pointer hover:border-[#81b64c] hover:scale-110 hover:-translate-y-2 active:scale-95' : 'cursor-default'} 
        ${dims}
        ${isBoardPiece ? 'rounded-sm border-white/20' : 'rounded-2xl border-white/30'}
        ${highlight && !disabled ? 'ring-[4px] ring-[#81b64c]/40 border-[#81b64c] z-20 shadow-[0_0_20px_rgba(129,182,76,0.4)]' : ''}
      `}
      style={{ 
        backgroundImage: 'linear-gradient(145deg, #333 0%, #050505 100%)', 
        boxShadow: isBoardPiece ? '4px 4px 12px rgba(0,0,0,0.8)' : '0 15px 35px rgba(0,0,0,0.9)' 
      }}
    >
      <div className={`${isHorizontal ? 'flex-1 h-full' : 'h-1/2 w-full'} flex items-center justify-center`}>{renderDots(a)}</div>
      <div className={`${isHorizontal ? 'w-[2px] h-4/5 my-auto bg-[#444]' : 'h-[2px] w-4/5 mx-auto bg-[#444] shadow-inner'}`} />
      <div className={`${isHorizontal ? 'flex-1 h-full' : 'h-1/2 w-full'} flex items-center justify-center`}>{renderDots(b)}</div>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-3 h-3'} bg-[#555] rounded-sm rotate-45 border border-white/10 shadow-lg`} />
    </div>
  );
};

const DominoGame: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [roomId, setRoomId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('domino'));
  const [gameState, setGameState] = useState<DominoGameState | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ tile: DominoTile, options: any[] } | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [gameMode, setLocalGameMode] = useState<DominoMode>('individual');
  const boardRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = db.ref(`domino_rooms/${roomId}`);
    
    const onValue = (snap: any) => {
      const val = snap.val();
      if (val) {
        setGameState(val);
        setLocalGameMode(val.mode || 'individual');
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
    if (boardRef.current && gameState?.board) {
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
      mode: 'individual',
      createdAt: Date.now(),
      chat: {}
    };
    db.ref(`domino_rooms/${id}`).set(newRoomData);
    setRoomId(id);
    window.history.replaceState(null, '', `?domino=${id}`);
  };

  const toggleMode = () => {
    if (!roomId || gameState?.status !== 'waiting') return;
    const newMode = gameMode === 'individual' ? 'teams' : 'individual';
    db.ref(`domino_rooms/${roomId}`).update({ mode: newMode });
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

  const handleSendMessage = (text: string) => {
    if (!text.trim() || !roomId) return;
    db.ref(`domino_rooms/${roomId}/chat`).push({
      user: currentUser.name,
      text,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  const addEmoji = (emoji: string) => {
    setChatInput(prev => prev + emoji);
  };

  const startMatch = () => {
    if (!gameState || !roomId) return;
    const players = gameState.players || [];
    if (players.length < 2) return;
    if (gameState.mode === 'teams' && players.length !== 4) {
      sendSystemMessage("O modo DUPLAS requer exatamente 4 operadores.");
      return;
    }

    // Garantir embaralhamento aleatório robusto antes da distribuição
    const fullSet = shuffleSet(createFullSet());
    const hands: Record<string, DominoTile[]> = {};
    
    players.forEach((p, i) => {
      // 7 peças por jogador
      hands[p.id] = fullSet.slice(i * 7, (i + 1) * 7);
    });

    const boneyard = fullSet.slice(players.length * 7);

    db.ref(`domino_rooms/${roomId}`).update({
      status: 'playing',
      hands,
      boneyard,
      board: [],
      turnIndex: 0,
      winnerId: null,
      winningTeam: null
    });
    sendSystemMessage(`Sequência tática [${gameState.mode.toUpperCase()}] iniciada.`);
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
      
      if (gameState.mode === 'teams') {
        // Encontra o index do vencedor para determinar o time
        const winnerIndex = players.findIndex(p => p.id === currentUser.id);
        updates.winningTeam = winnerIndex % 2; // Time 0 (idx 0 e 2) ou Time 1 (idx 1 e 3)
      }
      
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
    <div className="flex flex-col lg:flex-row h-full w-full max-w-[1400px] gap-6 overflow-hidden pb-24 px-4 relative">
      
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
             <div className="flex gap-2">
               <div className="bg-black/40 px-3 py-1.5 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-widest border border-white/5 w-fit">
                 Dorminhoco: {boneyard.length}
               </div>
               <div className="bg-[#81b64c]/10 px-3 py-1.5 rounded-full text-[9px] font-black text-[#81b64c] uppercase tracking-widest border border-[#81b64c]/20 w-fit">
                 {gameMode === 'individual' ? 'Individual' : 'Duplas'}
               </div>
             </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {players.map((p, i) => {
              const playerHandCount = (gameState?.hands?.[p.id] || []).length;
              const active = turnIndex === i;
              const isPartner = gameMode === 'teams' && ((players.findIndex(pl => pl.id === currentUser.id) % 2) === (i % 2));
              
              return (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-2xl border transition-all duration-300 ${active ? 'bg-[#81b64c]/10 border-[#81b64c] scale-105 shadow-lg' : 'bg-[#1a1917] border-transparent opacity-60'}`}>
                  <div className="relative">
                    <img src={p.avatar} className="w-8 h-8 rounded-xl bg-black/50 border border-white/10" alt="avatar" />
                    {active && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#81b64c] rounded-full animate-pulse shadow-[0_0_8px_#81b64c]" />}
                    {isPartner && <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6] flex items-center justify-center text-[6px] text-white"><i className="fas fa-link"></i></div>}
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
        <div className="flex-1 min-h-[300px] bg-[#0d0d0d] rounded-[3rem] border-[8px] md:border-[12px] border-[#262421] relative flex items-center justify-center overflow-hidden shadow-2xl z-0">
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          
          {gameState?.status === 'waiting' ? (
            <div className="z-10 text-center flex flex-col items-center p-10 bg-[#1a1917]/80 backdrop-blur-md rounded-[3rem] border border-white/5">
              <h2 className="text-3xl md:text-4xl font-black text-[#81b64c] mb-6 uppercase tracking-[0.3em] italic">Aguardando Operadores</h2>
              
              <div className="flex flex-col gap-6 mb-10">
                <div className="flex gap-4">
                  <button onClick={toggleMode} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${gameMode === 'individual' ? 'bg-[#81b64c] text-white border-[#81b64c]' : 'bg-[#262421] text-gray-500 border-white/10'}`}>Individual</button>
                  <button onClick={toggleMode} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${gameMode === 'teams' ? 'bg-[#81b64c] text-white border-[#81b64c]' : 'bg-[#262421] text-gray-500 border-white/10'}`}>Duplas (2x2)</button>
                </div>
                
                <div className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">
                  Status: {players.length} / {gameMode === 'individual' ? '2-4' : '4'} Conectados
                </div>
              </div>

              {((gameMode === 'individual' && players.length >= 2) || (gameMode === 'teams' && players.length === 4)) ? (
                <button onClick={startMatch} className="bg-[#81b64c] hover:bg-[#95c65d] px-20 py-6 rounded-2xl font-black text-white shadow-[0_8px_0_#456528] active:translate-y-1 transition-all uppercase tracking-widest text-xl">INICIAR OPERAÇÃO</button>
              ) : (
                <div className="text-[#81b64c] font-black uppercase text-[12px] tracking-[0.2em] animate-pulse py-4 border-2 border-dashed border-[#81b64c]/30 rounded-2xl px-8">Aguardando mais operadores...</div>
              )}
            </div>
          ) : (
            <div 
              ref={boardRef} 
              className="flex items-center gap-2 px-10 md:px-40 py-10 overflow-x-auto overflow-y-hidden w-full h-full custom-scrollbar no-scrollbar scroll-smooth"
            >
              <div className="flex-shrink-0 w-[10%] md:w-[20%]" />
              {(gameState?.board || []).map((m, i) => (
                <IndustrialTile key={`${m.tile.id}-${i}`} tile={m.tile} isFlipped={m.isFlipped} isBoardPiece size="md" />
              ))}
              <div className="flex-shrink-0 w-[10%] md:w-[20%]" />
            </div>
          )}

          {/* Overlay de Seleção */}
          {pendingSelection && (
            <div className="absolute inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
              <h3 className="text-xl font-black text-white uppercase tracking-[0.4em] mb-12">Direcionar Fluxo</h3>
              <div className="flex gap-8 md:gap-16">
                {pendingSelection.options.map((opt, i) => (
                  <button 
                    key={i}
                    onClick={() => executeMove(pendingSelection.tile, opt)}
                    className="group flex flex-col items-center gap-6"
                  >
                    <div className="bg-[#262421] p-8 md:p-12 rounded-3xl border-2 border-[#81b64c]/20 group-hover:border-[#81b64c] transition-all transform group-hover:scale-110 shadow-2xl">
                       <i className={`fas fa-chevron-${opt.side === 'left' ? 'left' : 'right'} text-4xl md:text-6xl text-[#81b64c]`}></i>
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
              <div className="flex flex-col items-center gap-2 mb-12">
                <p className="text-white text-lg md:text-xl font-bold uppercase tracking-widest">VENCEDOR: {players.find(p => p.id === gameState.winnerId)?.name}</p>
                {gameState.mode === 'teams' && (
                  <div className="bg-blue-500/20 text-blue-400 px-6 py-2 rounded-full border border-blue-500/30 text-xs font-black uppercase tracking-widest">Vitória do Time {gameState.winningTeam === 0 ? 'ALFA (1&3)' : 'BETA (2&4)'}</div>
                )}
              </div>
              <button onClick={startMatch} className="bg-[#81b64c] hover:bg-[#95c65d] px-16 md:px-20 py-5 md:py-6 rounded-3xl font-black text-lg md:text-xl shadow-[0_8px_0_#456528]">REINICIAR SEQUÊNCIA</button>
            </div>
          )}
        </div>

        {/* Control Panel / Hand Area (OPERADOR ATIVO) */}
        <div className="bg-[#262421] p-5 md:p-8 rounded-[3rem] border-t-4 border-[#81b64c]/30 flex flex-col gap-6 shadow-2xl relative overflow-hidden z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full transition-all duration-500 ${isMyTurn ? 'bg-[#81b64c] shadow-[0_0_15px_#81b64c]' : 'bg-gray-800'}`} />
              <div className="flex flex-col">
                <span className={`text-[12px] font-black uppercase tracking-[0.3em] ${isMyTurn ? 'text-[#81b64c]' : 'text-gray-600'}`}>
                  {isMyTurn ? 'MODO DE ATAQUE ATIVO' : 'MODO STANDBY'}
                </span>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Sua Mão Tática</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                disabled={!isMyTurn || boneyard.length === 0 || canIPlay}
                onClick={drawTile}
                className={`h-12 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 ${(!isMyTurn || boneyard.length === 0 || canIPlay) ? 'bg-[#1a1917] text-gray-700 opacity-50 cursor-not-allowed' : 'bg-[#3c3a37] text-white hover:bg-[#4a4844] shadow-lg active:scale-95 border border-white/5'}`}
              >
                <i className="fas fa-hand-holding-medical text-base"></i> COMPRAR PEÇA
              </button>
              <button 
                disabled={!isMyTurn || boneyard.length > 0 || canIPlay}
                onClick={passTurn}
                className={`h-12 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 ${(!isMyTurn || boneyard.length > 0 || canIPlay) ? 'bg-[#1a1917] text-gray-700 opacity-50 cursor-not-allowed' : 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white shadow-lg active:scale-95 border border-red-500/20'}`}
              >
                <i className="fas fa-forward text-base"></i> ABORTAR TURNO
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-4 md:gap-8 overflow-x-auto py-8 px-8 custom-scrollbar no-scrollbar bg-black/60 rounded-[2.5rem] border border-white/5 shadow-inner min-h-[220px]">
            {myHand.length === 0 && gameState?.status === 'playing' ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-20 uppercase font-black tracking-[0.8em] text-sm animate-pulse">
                <i className="fas fa-box-open text-4xl mb-4"></i>
                Arsenal Esgotado
              </div>
            ) : (
              myHand.map((t) => (
                <IndustrialTile 
                  key={t.id} 
                  tile={t} 
                  onClick={() => handlePlay(t)} 
                  disabled={!isMyTurn} 
                  highlight={isMyTurn && canPlayTile(t, gameState?.board || []).length > 0} 
                  size="xl"
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Coluna Lateral: Chat Industrial */}
      <div className="w-full lg:w-[320px] bg-[#262421] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl h-[450px] lg:h-auto mb-24 lg:mb-0">
        <div className="bg-[#1a1917] p-5 border-b border-white/5 flex items-center gap-3">
          <i className="fas fa-comments text-[#81b64c]"></i>
          <h3 className="font-black text-xs uppercase tracking-widest text-white">COMMS FEED</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
              <i className="fas fa-terminal text-4xl mb-4"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">SISTEMA EM SILÊNCIO</p>
            </div>
          ) : (
            chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.user === 'SISTEMA' ? 'items-center py-2' : ''}`}>
                {m.user !== 'SISTEMA' && (
                  <span className={`text-[8px] font-black uppercase tracking-tighter mb-1 ${m.user === currentUser.name ? 'text-[#81b64c] text-right pr-2' : 'text-gray-500 pl-2'}`}>
                    {m.user}
                  </span>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-[11px] leading-relaxed shadow-sm break-words border transition-all hover:brightness-110 ${
                  m.user === 'SISTEMA' ? 'bg-transparent text-[#81b64c] border-transparent italic text-center text-[9px] tracking-tight' : 
                  m.user === currentUser.name ? 'bg-[#81b64c]/10 text-white border-[#81b64c]/30 self-end rounded-tr-none' : 
                  'bg-[#1a1917] text-gray-300 border-white/10 self-start rounded-tl-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="px-4 pb-2 pt-1 flex gap-2 justify-center bg-[#1a1917]/50">
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => handleSendMessage(e)} className="text-sm hover:scale-125 transition-transform duration-200">{e}</button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(chatInput); }} className="p-4 bg-[#1a1917] border-t border-white/5 flex gap-2">
          <input 
            type="text" 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)} 
            placeholder="Transmitir..." 
            className="flex-1 bg-[#262421] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-[#81b64c]/50 transition-all text-white placeholder:text-gray-600 font-mono shadow-inner"
          />
          <button type="submit" className="bg-[#81b64c] w-12 h-12 rounded-xl flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition-all shadow-lg">
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>

    </div>
  );
};

export default DominoGame;
