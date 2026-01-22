
import React, { useState, useEffect, useRef } from 'react';
import { User, DominoTile, DominoMove, DominoGameState, DominoChatMessage, DominoMode } from '../types';
import { createFullSet, shuffleSet, canPlayTile, calculatePoints } from '../services/dominoLogic';
import { db } from '../services/firebase';
import { analyzeDominoMove } from '../services/ai';

const QUICK_EMOJIS = ['🎲', '🎯', '🔥', '🏆', '💪', '🤝', '🤫', '💀', '⚡', '🧠'];

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
      <div className={`relative ${size === 'sm' ? 'w-8 h-12' : size === 'md' ? 'w-10 h-16' : 'w-14 h-22'} bg-[#121212] rounded-lg border border-white/10 shrink-0 shadow-2xl overflow-hidden`}
           style={{ backgroundImage: 'linear-gradient(145deg, #1a1a1a 0%, #000 100%)' }}>
        <div className="absolute inset-1.5 border border-white/5 rounded-md flex items-center justify-center">
          <div className="w-1 h-3 bg-[#81b64c]/20 rounded-full animate-pulse shadow-[0_0_8px_#81b64c33]" />
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
      <div className={`grid grid-cols-3 grid-rows-3 gap-[1.5px] w-full h-full ${size === 'xl' ? 'p-3' : 'p-2'}`}>
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dotPos.includes(i) && (
              <div className={`rounded-full transition-all duration-300 
                ${highlight && !disabled ? 'bg-[#a3e635] shadow-[0_0_12px_#a3e635]' : 'bg-[#81b64c] shadow-[0_0_8px_rgba(129,182,76,0.6)]'} 
                ${size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : size === 'xl' ? 'w-4 h-4' : 'w-3 h-3'}`} 
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const isBucha = tile.sideA === tile.sideB;
  const isHorizontal = isBoardPiece ? !isBucha : true;

  const dims = {
    sm: isHorizontal ? 'w-16 h-8' : 'w-8 h-16',
    md: isHorizontal ? 'w-24 h-12' : 'w-12 h-24',
    lg: isHorizontal ? 'w-28 h-14' : 'w-14 h-28',
    xl: isHorizontal ? 'w-40 h-20' : 'w-20 h-40',
  }[size];

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`relative flex ${isHorizontal ? 'flex-row' : 'flex-col'} transition-all duration-300 shrink-0 border-[1.5px]
        ${!disabled ? 'cursor-pointer hover:border-[#a3e635] hover:-translate-y-4 hover:scale-105 active:scale-95 z-10' : 'cursor-default opacity-90'} 
        ${dims}
        ${isBoardPiece ? 'rounded-md shadow-lg border-white/20' : 'rounded-xl shadow-2xl border-white/30'}
        ${highlight && !disabled ? 'ring-2 ring-[#a3e635] border-[#a3e635] shadow-[0_0_20px_rgba(163,230,53,0.3)]' : ''}
      `}
      style={{ 
        backgroundColor: '#1a1a1a',
        backgroundImage: 'linear-gradient(145deg, #222 0%, #050505 100%)', 
      }}
    >
      <div className={`${isHorizontal ? 'flex-1 h-full' : 'w-full h-1/2'} flex items-center justify-center z-10 overflow-hidden`}>
        {renderDots(a)}
      </div>
      
      {/* Visual Separator */}
      <div className={`${isHorizontal ? 'w-[1.5px] h-3/4 my-auto' : 'h-[1.5px] w-3/4 mx-auto'} bg-[#333] relative z-10 opacity-40`} />
      
      <div className={`${isHorizontal ? 'flex-1 h-full' : 'w-full h-1/2'} flex items-center justify-center z-10 overflow-hidden`}>
        {renderDots(b)}
      </div>
      
      {/* Central Metallic Pin */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${size === 'xl' ? 'w-6 h-6' : 'w-4 h-4'} bg-[#262626] rounded-full border border-white/20 shadow-lg z-20 flex items-center justify-center`}>
         <div className={`rounded-full bg-[#111] border border-white/5 ${size === 'xl' ? 'w-3 h-3' : 'w-2 h-2'}`}>
            <div className={`m-auto bg-[#81b64c]/20 rounded-full ${size === 'xl' ? 'w-1.5 h-1.5' : 'w-1 h-1'}`} />
         </div>
      </div>
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
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = db.ref(`domino_rooms/${roomId}`);
    
    const onValue = (snap: any) => {
      const val = snap.val();
      if (val) {
        setGameState(val);
        if (val.mode) setLocalGameMode(val.mode);
        const players = val.players || [];
        if (val.status === 'waiting' && !players.some((p: User) => p.id === currentUser.id) && players.length < 4) {
          roomRef.child('players').set([...players, currentUser]);
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

  const toggleMode = (mode: DominoMode) => {
    if (!roomId || gameState?.status !== 'waiting') return;
    db.ref(`domino_rooms/${roomId}`).update({ mode });
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?domino=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (text: string) => {
    const msg = text || chatInput;
    if (!msg.trim() || !roomId) return;
    db.ref(`domino_rooms/${roomId}/chat`).push({
      user: currentUser.name,
      text: msg,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  const startMatch = () => {
    if (!gameState || !roomId) return;
    const players = gameState.players || [];
    if (players.length < 2) return;
    if (gameState.mode === 'teams' && players.length !== 4) return;

    const fullSet = shuffleSet(createFullSet());
    const hands: Record<string, DominoTile[]> = {};
    
    players.forEach((p, i) => {
      hands[p.id] = fullSet.slice(i * 7, (i + 1) * 7);
    });

    const boneyard = fullSet.slice(players.length * 7);

    // Rule: Member of the winning team/player starts next round
    const startTurn = gameState.winnerId 
      ? players.findIndex(p => p.id === gameState.winnerId)
      : 0;

    db.ref(`domino_rooms/${roomId}`).update({
      status: 'playing',
      hands,
      boneyard,
      board: [],
      turnIndex: startTurn !== -1 ? startTurn : 0,
      winnerId: null,
      winningTeam: null,
      isLocked: false
    });
    setAiTip(null);
  };

  const drawTile = () => {
    if (!gameState || !roomId || !isMyTurn) return;
    const boneyard = gameState.boneyard || [];
    if (boneyard.length === 0) return;

    const drawn = boneyard[0];
    const newBoneyard = boneyard.slice(1);
    const currentHand = (gameState.hands?.[currentUser.id]) || [];
    const newHand = [...currentHand, drawn];

    db.ref(`domino_rooms/${roomId}`).update({
      boneyard: newBoneyard,
      [`hands/${currentUser.id}`]: newHand
    });
  };

  const passTurn = () => {
    if (!gameState || !roomId || !isMyTurn) return;
    const players = gameState.players || [];
    const nextTurn = (gameState.turnIndex + 1) % players.length;
    checkLockedGame(nextTurn);
  };

  const checkLockedGame = (nextTurnIndex: number) => {
    if (!gameState || !roomId) return;
    const players = gameState.players || [];
    const board = gameState.board || [];
    const boneyard = gameState.boneyard || [];

    // If there's still a boneyard, just pass
    if (boneyard.length > 0) {
      db.ref(`domino_rooms/${roomId}`).update({ turnIndex: nextTurnIndex });
      return;
    }

    // Check if ANYONE can play
    const anyoneCanPlay = players.some(p => {
      const hand = gameState.hands?.[p.id] || [];
      return hand.some(t => canPlayTile(t, board).length > 0);
    });

    if (!anyoneCanPlay && board.length > 0) {
      handleLockFinish();
    } else {
      db.ref(`domino_rooms/${roomId}`).update({ turnIndex: nextTurnIndex });
    }
  };

  const handleLockFinish = () => {
    if (!gameState || !roomId) return;
    const players = gameState.players || [];
    
    const scores = players.map(p => {
      const hand = gameState.hands?.[p.id] || [];
      return { id: p.id, points: calculatePoints(hand) };
    });

    // Winner has lowest points
    scores.sort((a, b) => a.points - b.points);
    const winner = scores[0];

    const updates: any = {
      status: 'finished',
      winnerId: winner.id,
      isLocked: true
    };

    if (gameState.mode === 'teams') {
      const winnerIndex = players.findIndex(p => p.id === winner.id);
      updates.winningTeam = winnerIndex % 2;
    }

    db.ref(`domino_rooms/${roomId}`).update(updates);
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

    if (newHand.length === 0) {
      const updates: any = {
        board: newBoard,
        [`hands/${currentUser.id}`]: newHand,
        status: 'finished',
        winnerId: currentUser.id
      };
      if (gameState.mode === 'teams') {
        const winnerIndex = players.findIndex(p => p.id === currentUser.id);
        updates.winningTeam = winnerIndex % 2;
      }
      db.ref(`domino_rooms/${roomId}`).update(updates);
    } else {
      db.ref(`domino_rooms/${roomId}/board`).set(newBoard);
      db.ref(`domino_rooms/${roomId}/hands/${currentUser.id}`).set(newHand);
      checkLockedGame((gameState.turnIndex + 1) % players.length);
    }
    setPendingSelection(null);
    setAiTip(null);
  };

  const getAiSuggestion = async () => {
    if (!gameState || !isMyTurn || isAnalyzing) return;
    setIsAnalyzing(true);
    const suggestion = await analyzeDominoMove(gameState.board || [], myHand);
    setAiTip(suggestion || "Sem sugestões no momento.");
    setIsAnalyzing(false);
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
    <div className="flex flex-col items-center justify-center h-full gap-12 bg-[#1a1917] w-full max-w-4xl rounded-[4rem] border border-white/5 shadow-2xl p-12 animate-in zoom-in duration-500">
      <div className="text-center">
        <h1 className="text-7xl font-black italic tracking-tighter text-white mb-4 uppercase">Carbon <span className="text-[#81b64c]">Core</span></h1>
        <p className="text-gray-500 uppercase text-xs font-bold tracking-[0.2em] max-w-xs mx-auto">SISTEMA DE DOMINÓ INDUSTRIAL</p>
      </div>
      <button onClick={createRoom} className="bg-[#81b64c] hover:bg-[#95c65d] px-20 py-6 rounded-3xl font-black text-xl shadow-[0_8px_0_#456528] active:translate-y-1 transition-all uppercase tracking-widest text-white">CRIAR SALA TÁTICA</button>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full w-full max-w-[1600px] gap-6 overflow-hidden pb-24 lg:pb-12 px-4 relative animate-in fade-in duration-700">
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="bg-[#262421] px-6 py-4 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-wrap items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-4">
            <div className="bg-[#1a1917] px-5 py-2.5 rounded-2xl border border-[#81b64c]/30 text-[#81b64c] font-black font-mono shadow-inner text-sm flex items-center gap-3">
              <div className="w-2 h-2 bg-[#81b64c] rounded-full animate-pulse" />
              <span className="opacity-40 select-none uppercase">Node:</span> {roomId}
            </div>
            <button onClick={copyInviteLink} className={`p-3 rounded-2xl transition-all shadow-lg ${copied ? 'bg-[#81b64c] text-white' : 'bg-[#3c3a37] text-gray-300 hover:bg-[#4a4844]'}`}>
              <i className={`fas ${copied ? 'fa-check' : 'fa-link'}`}></i>
            </button>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-black/40 px-5 py-2.5 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest border border-white/5">
                Boneyard: {boneyard.length}
             </div>
             <div className="bg-[#81b64c]/10 px-5 py-2.5 rounded-xl text-[10px] font-black text-[#81b64c] uppercase tracking-widest border border-[#81b64c]/20">
                {gameMode === 'individual' ? 'Solo' : 'Duplas'}
             </div>
          </div>
        </div>

        <div className="flex-1 bg-[#0d0d0d] rounded-[3.5rem] border-[14px] border-[#262421] relative shadow-inner overflow-hidden flex flex-col">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          
          {gameState?.status === 'waiting' ? (
            <div className="h-full flex flex-col items-center justify-center p-10 z-10">
              <div className="flex flex-col items-center gap-8 bg-[#1a1917] p-12 rounded-[3.5rem] border border-white/5 shadow-2xl max-w-lg w-full">
                <h2 className="text-2xl font-black text-white/40 uppercase tracking-[0.4em] mb-4">Protocolo de Espera</h2>
                <div className="flex w-full gap-4 p-2 bg-black/50 rounded-2xl">
                  <button onClick={() => toggleMode('individual')} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${gameMode === 'individual' ? 'bg-[#81b64c] text-white' : 'text-gray-600'}`}>Solo</button>
                  <button onClick={() => toggleMode('teams')} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${gameMode === 'teams' ? 'bg-[#81b64c] text-white' : 'text-gray-600'}`}>Duplas</button>
                </div>
                <div className="flex items-center gap-3">
                  {players.map(p => (
                    <img key={p.id} src={p.avatar} className="w-12 h-12 rounded-2xl border-2 border-white/10 shadow-xl" alt="op" />
                  ))}
                </div>
                <button 
                  onClick={startMatch} 
                  disabled={(gameMode === 'individual' && players.length < 2) || (gameMode === 'teams' && players.length !== 4)}
                  className="w-full bg-[#81b64c] disabled:opacity-30 hover:bg-[#95c65d] py-6 rounded-2xl font-black text-xl shadow-[0_8px_0_#456528] active:translate-y-1 transition-all uppercase text-white"
                >
                  INICIAR SEQUÊNCIA
                </button>
              </div>
            </div>
          ) : (
            <div ref={boardRef} className="flex-1 flex items-center gap-6 px-48 py-20 overflow-x-auto overflow-y-hidden w-full no-scrollbar custom-scrollbar scroll-smooth z-10">
              <div className="flex-shrink-0 w-[40%]" />
              {(gameState?.board || []).map((m, i) => (
                <div key={`${m.tile.id}-${i}`} className="animate-in zoom-in slide-in-from-right-20 duration-500 flex-shrink-0 flex items-center justify-center">
                  <IndustrialTile tile={m.tile} isFlipped={m.isFlipped} isBoardPiece size="md" />
                </div>
              ))}
              <div className="flex-shrink-0 w-[40%]" />
            </div>
          )}

          {/* AI Tip Bar */}
          {aiTip && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[#262421]/90 backdrop-blur-md px-8 py-4 rounded-full border border-purple-500/30 shadow-2xl z-40 max-w-md animate-in slide-in-from-top-4">
              <p className="text-xs font-bold text-purple-400 italic tracking-tight">{aiTip}</p>
            </div>
          )}

          {pendingSelection && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
               <h3 className="text-3xl font-black text-[#81b64c] uppercase tracking-[0.4em] mb-20 italic">DIRECIONAR FLUXO</h3>
               <div className="flex gap-20">
                 {pendingSelection.options.map((opt, i) => (
                   <button key={i} onClick={() => executeMove(pendingSelection.tile, opt)} className="group flex flex-col items-center gap-8">
                      <div className="w-40 h-40 bg-[#262421] rounded-[3rem] flex items-center justify-center border-4 border-white/5 group-hover:border-[#a3e635] group-hover:bg-[#a3e635]/10 transition-all shadow-2xl group-active:scale-90">
                        <i className={`fas fa-chevron-${opt.side === 'left' ? 'left' : 'right'} text-6xl text-white/10 group-hover:text-[#a3e635] transition-colors`}></i>
                      </div>
                      <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] group-hover:text-[#a3e635]">TERMINAL {opt.side.toUpperCase()}</span>
                   </button>
                 ))}
               </div>
               <button onClick={() => setPendingSelection(null)} className="mt-24 text-gray-600 hover:text-white font-black uppercase text-[11px] tracking-widest border-b border-white/10 pb-1">ABORTAR</button>
            </div>
          )}

          {gameState?.status === 'finished' && (
            <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-12 animate-in zoom-in duration-500 text-center">
               <div className="w-28 h-28 bg-[#81b64c] rounded-[2.5rem] flex items-center justify-center mb-12 shadow-[0_0_80px_rgba(129,182,76,0.5)]">
                 <i className={`fas ${gameState.isLocked ? 'fa-lock' : 'fa-flag-checkered'} text-5xl text-white`}></i>
               </div>
               <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-4">
                 {gameState.isLocked ? 'SISTEMA TRANCADO' : 'SISTEMA DOMINADO'}
               </h2>
               <div className="flex flex-col gap-2 mb-16">
                 <p className="text-[#81b64c] text-2xl font-black uppercase tracking-[0.4em]">VENCEDOR: {players.find(p => p.id === gameState.winnerId)?.name}</p>
                 {gameState.mode === 'teams' && (
                   <div className="bg-blue-500/10 text-blue-400 px-8 py-3 rounded-full border border-blue-500/20 text-sm font-black uppercase tracking-widest self-center mt-2">TIME {gameState.winningTeam === 0 ? 'ALFA (1&3)' : 'BETA (2&4)'}</div>
                 )}
               </div>
               <button onClick={startMatch} className="bg-[#81b64c] hover:bg-[#95c65d] px-24 py-7 rounded-3xl font-black text-2xl shadow-[0_10px_0_#456528] active:translate-y-1 transition-all uppercase tracking-widest text-white">REINICIAR</button>
            </div>
          )}
        </div>

        <div className={`bg-[#262421] p-8 md:p-10 rounded-[4rem] border-t-[10px] shadow-2xl transition-all duration-700 ${isMyTurn ? 'border-[#a3e635] bg-[#2a2825]' : 'border-[#1a1917]'}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
            <div className="flex items-center gap-8">
               <div className="relative">
                 <img src={currentUser.avatar} className="w-20 h-20 rounded-[2rem] border-4 border-white/10 shadow-2xl" alt="op" />
                 {isMyTurn && <div className="absolute -top-3 -right-3 w-9 h-9 bg-[#a3e635] rounded-full flex items-center justify-center animate-bounce shadow-[0_0_20px_#a3e635] border-4 border-[#262421]"><i className="fas fa-bolt text-xs text-white"></i></div>}
               </div>
               <div className="flex flex-col">
                 <h3 className="font-black text-2xl text-white tracking-tighter uppercase italic">Arsenal Tático</h3>
                 <div className="flex items-center gap-3 mt-2">
                   <div className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-[#a3e635] animate-pulse shadow-[0_0_12px_#a3e635]' : 'bg-gray-700'}`} />
                   <span className={`text-xs font-black uppercase tracking-[0.2em] ${isMyTurn ? 'text-[#a3e635]' : 'text-gray-600'}`}>
                     {isMyTurn ? 'OPERADOR ATIVO: SINCRONIZADO' : 'STANDBY'}
                   </span>
                 </div>
               </div>
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={getAiSuggestion} 
                disabled={!isMyTurn || isAnalyzing}
                className={`h-16 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-4 bg-purple-500/10 border-2 border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                <i className={`fas ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-brain'} text-xl`}></i> Análise AI
              </button>
              <button disabled={!isMyTurn || boneyard.length === 0 || canIPlay} onClick={drawTile} className={`flex-1 md:flex-none h-16 px-10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-4 border-2 ${(!isMyTurn || boneyard.length === 0 || canIPlay) ? 'bg-[#1a1917] border-transparent text-gray-700 opacity-40 cursor-not-allowed' : 'bg-[#3c3a37] border-white/5 text-white hover:bg-[#4a4844] shadow-2xl'}`}>
                <i className="fas fa-plus-square text-xl"></i> COMPRAR
              </button>
              <button disabled={!isMyTurn || boneyard.length > 0 || canIPlay} onClick={passTurn} className={`flex-1 md:flex-none h-16 px-10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-4 border-2 ${(!isMyTurn || boneyard.length > 0 || canIPlay) ? 'bg-[#1a1917] border-transparent text-gray-700 opacity-40 cursor-not-allowed' : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 shadow-2xl'}`}>
                <i className="fas fa-forward text-xl"></i> PASSAR
              </button>
            </div>
          </div>

          <div className="bg-black/80 rounded-[3rem] p-10 border border-white/5 shadow-inner min-h-[260px] flex items-center gap-10 overflow-x-auto no-scrollbar custom-scrollbar relative">
            {myHand.length === 0 && gameState?.status === 'playing' ? (
              <div className="flex-1 text-center py-10 opacity-10 font-black uppercase tracking-[2em] text-sm text-white">Arsenal Esgotado</div>
            ) : (
              myHand.map((t) => (
                <div key={t.id} className="transition-all duration-300">
                  <IndustrialTile 
                    tile={t} 
                    onClick={() => handlePlay(t)} 
                    disabled={!isMyTurn} 
                    highlight={isMyTurn && canPlayTile(t, gameState?.board || []).length > 0} 
                    size="xl"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[400px] flex flex-col gap-4">
         <div className="bg-[#262421] p-8 rounded-[3rem] border border-white/5 shadow-2xl">
           <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 px-2">UNIDADES EM CAMPO</h4>
           <div className="space-y-4">
             {players.map((p, idx) => {
               const active = turnIndex === idx;
               const handCount = (gameState?.hands?.[p.id] || []).length;
               return (
                 <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-500 ${active ? 'bg-[#81b64c]/10 border-[#81b64c] shadow-lg scale-[1.03]' : 'bg-[#1a1917] border-transparent opacity-70'}`}>
                    <div className="flex items-center gap-4">
                      <img src={p.avatar} className="w-12 h-12 rounded-xl border border-white/10" alt="av" />
                      <span className="font-black text-sm text-white/90 truncate max-w-[140px] uppercase tracking-tight">{p.name}</span>
                    </div>
                    <div className="bg-black/80 px-4 py-2 rounded-xl font-mono text-xs font-black text-[#81b64c] border border-[#81b64c]/20 shadow-inner">
                      {handCount} PC
                    </div>
                 </div>
               );
             })}
           </div>
         </div>

         <div className="flex-1 bg-[#262421] rounded-[3rem] border border-white/5 shadow-2xl flex flex-col overflow-hidden min-h-[450px]">
            <div className="p-7 border-b border-white/5 bg-black/20 flex items-center gap-4">
              <div className="w-3 h-3 bg-[#81b64c] rounded-full animate-pulse shadow-[0_0_8px_#81b64c]" />
              <span className="font-black text-xs text-white uppercase tracking-[0.2em]">COMMS FEED LINK</span>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar">
               {chatMessages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-10 py-10">
                   <i className="fas fa-terminal text-6xl mb-6 text-gray-700"></i>
                   <p className="text-[11px] font-black uppercase tracking-[0.3em]">Criptografia Estabelecida...</p>
                 </div>
               ) : (
                 chatMessages.map((m, i) => (
                   <div key={i} className={`flex flex-col ${m.user === 'SISTEMA' ? 'items-center py-2' : ''}`}>
                     {m.user !== 'SISTEMA' && <span className={`text-[9px] font-black text-gray-500 uppercase mb-1.5 px-3 ${m.user === currentUser.name ? 'self-end' : ''}`}>{m.user}</span>}
                     <div className={`px-5 py-3.5 rounded-[1.5rem] text-[13px] shadow-lg border transition-all ${m.user === 'SISTEMA' ? 'bg-transparent border-transparent text-[#81b64c] italic text-[10px] text-center' : m.user === currentUser.name ? 'bg-[#81b64c]/10 border-[#81b64c]/30 text-white self-end rounded-tr-none' : 'bg-[#1a1917] border-white/5 text-gray-300 self-start rounded-tl-none'}`}>
                        {m.text}
                     </div>
                   </div>
                 ))
               )}
               <div ref={chatEndRef} />
            </div>

            <div className="bg-[#1a1917] border-t border-white/5 p-5 space-y-5">
              <div className="flex justify-between px-3">
                {QUICK_EMOJIS.map(e => (
                  <button key={e} onClick={() => handleSendMessage(e)} className="text-2xl transition-all hover:scale-150 filter drop-shadow-lg">{e}</button>
                ))}
              </div>
              <form onSubmit={e => { e.preventDefault(); handleSendMessage(chatInput); }} className="flex gap-3">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Transmitir dados..." className="flex-1 bg-[#262421] border border-white/10 rounded-2xl px-6 py-4 text-xs outline-none text-white font-mono shadow-inner focus:ring-1 focus:ring-[#81b64c]/50" />
                <button type="submit" className="bg-[#81b64c] w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-[0_4px_0_#456528] active:translate-y-1 transition-all">
                  <i className="fas fa-paper-plane text-lg"></i>
                </button>
              </form>
            </div>
         </div>
      </div>
    </div>
  );
};

export default DominoGame;
