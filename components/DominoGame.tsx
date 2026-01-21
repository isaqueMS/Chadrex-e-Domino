
import React, { useState, useEffect } from 'react';
import { User, DominoTile, DominoMove, DominoGameState } from '../types';
import { createFullSet, shuffleSet, canPlayTile } from '../services/dominoLogic';
import { db } from '../services/firebase';

interface DominoGameProps {
  currentUser: User;
}

const DominoTileUI: React.FC<{ 
  tile: DominoTile; 
  isFlipped?: boolean; 
  onClick?: () => void; 
  isHorizontal?: boolean; 
  small?: boolean;
  disabled?: boolean;
}> = ({ tile, isFlipped, onClick, isHorizontal, small, disabled }) => {
  const a = isFlipped ? tile.sideB : tile.sideA;
  const b = isFlipped ? tile.sideA : tile.sideB;

  const renderDots = (n: number) => {
    return (
      <div className={`grid grid-cols-3 gap-0.5 p-1 h-full w-full`}>
        {n === 0 && null}
        {n === 1 && <><div/><div/><div/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div/><div/><div/></>}
        {n === 2 && <><div className="bg-black rounded-full w-full h-full"/><div/><div/><div/><div/><div/><div/><div/><div className="bg-black rounded-full w-full h-full"/></>}
        {n === 3 && <><div className="bg-black rounded-full w-full h-full"/><div/><div/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div/><div/><div className="bg-black rounded-full w-full h-full"/></>}
        {n === 4 && <><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/></>}
        {n === 5 && <><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/></>}
        {n === 6 && <><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/><div className="bg-black rounded-full w-full h-full"/><div/><div className="bg-black rounded-full w-full h-full"/></>}
      </div>
    );
  };

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`bg-[#fdfdfd] rounded border-2 border-gray-400 flex shadow-md transition-all
        ${!disabled ? 'cursor-pointer hover:border-[#81b64c] hover:-translate-y-1' : 'cursor-default opacity-90'}
        ${isHorizontal ? 'flex-row w-14 h-9' : 'flex-col w-9 h-14'}
        ${small ? 'scale-90' : ''}`}
    >
      <div className="flex-1 flex items-center justify-center relative">{renderDots(a)}</div>
      <div className={`${isHorizontal ? 'w-[1px] h-full bg-gray-200' : 'h-[1px] w-full bg-gray-200'}`}></div>
      <div className="flex-1 flex items-center justify-center relative">{renderDots(b)}</div>
    </div>
  );
};

const DominoGame: React.FC<DominoGameProps> = ({ currentUser }) => {
  const [roomId, setRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('domino');
  });
  const [gameState, setGameState] = useState<DominoGameState | null>(null);
  const [copyStatus, setCopyStatus] = useState('Copiar Link');

  useEffect(() => {
    if (roomId) joinRoom(roomId);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = db.ref(`domino_rooms/${roomId}`);
    const handler = (snap: any) => {
      const val = snap.val();
      if (val) setGameState(val);
    };
    roomRef.on('value', handler);
    return () => roomRef.off('value', handler);
  }, [roomId]);

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    const newState: DominoGameState = {
      players: [currentUser],
      turnIndex: 0,
      board: [],
      hands: {},
      status: 'waiting'
    };
    db.ref(`domino_rooms/${id}`).set(newState).then(() => {
      setRoomId(id);
    });
  };

  const joinRoom = (id: string) => {
    const roomRef = db.ref(`domino_rooms/${id}`);
    // Usamos transaction para garantir que a entrada de jogadores seja atômica e não "quebre" a sala
    roomRef.transaction((currentData) => {
      if (currentData === null) return currentData;
      
      const players = currentData.players || [];
      const alreadyIn = players.find((p: any) => p.id === currentUser.id);
      
      if (!alreadyIn) {
        if (players.length >= 4) return; // Sala cheia
        currentData.players = [...players, currentUser];
      }
      return currentData;
    }).then((result) => {
      if (result.committed) {
        setRoomId(id);
      } else {
        alert("Não foi possível entrar na sala.");
        setRoomId(null);
      }
    });
  };

  const startNewMatch = () => {
    if (!roomId || !gameState) return;
    const fullSet = createFullSet();
    const shuffled = shuffleSet(fullSet);
    
    const hands: Record<string, DominoTile[]> = {};
    gameState.players.forEach((p, i) => {
      hands[p.id] = shuffled.slice(i * 7, (i + 1) * 7);
    });

    db.ref(`domino_rooms/${roomId}`).update({
      board: [],
      hands,
      turnIndex: 0,
      status: 'playing',
      winnerId: null
    });
  };

  const playMove = (tileId: string) => {
    if (!gameState || gameState.status !== 'playing' || !roomId) return;
    const activePlayer = gameState.players[gameState.turnIndex];
    if (activePlayer.id !== currentUser.id) return;

    const myHand = gameState.hands?.[currentUser.id] || [];
    const tile = myHand.find(t => t.id === tileId);
    if (!tile) return;

    const options = canPlayTile(tile, gameState.board || []);
    if (options.length === 0) return;

    const { side, isFlipped } = options[0];
    const currentBoard = gameState.board || [];
    const newBoard = side === 'left' 
      ? [{ tile, side, isFlipped }, ...currentBoard] 
      : [...currentBoard, { tile, side, isFlipped }];
    
    const newHand = myHand.filter(t => t.id !== tileId);
    const isWinner = newHand.length === 0;
    const nextTurn = (gameState.turnIndex + 1) % gameState.players.length;

    const updates: any = {
      board: newBoard,
      [`hands/${currentUser.id}`]: newHand,
      turnIndex: nextTurn
    };

    if (isWinner) {
      updates.status = 'finished';
      updates.winnerId = currentUser.id;
      const currentElo = currentUser.dominoElo || 1200;
      db.ref(`users/${currentUser.id}`).update({ dominoElo: currentElo + 25 });
    }

    db.ref(`domino_rooms/${roomId}`).update(updates);
  };

  const passTurn = () => {
    if (!gameState || !roomId || gameState.status !== 'playing') return;
    if (gameState.players[gameState.turnIndex]?.id !== currentUser.id) return;

    const myHand = gameState.hands?.[currentUser.id] || [];
    const hasMove = myHand.some(t => canPlayTile(t, gameState.board || []).length > 0);
    
    if (hasMove) {
      alert("Você tem peças que podem ser jogadas!");
      return;
    }

    const nextTurn = (gameState.turnIndex + 1) % gameState.players.length;
    db.ref(`domino_rooms/${roomId}`).update({ turnIndex: nextTurn });
  };

  const shareLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/?domino=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopyStatus('Link Copiado!');
    setTimeout(() => setCopyStatus('Copiar Link'), 2000);
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-8 p-6 text-center">
        <div className="bg-[#81b64c]/10 p-6 rounded-full animate-pulse">
            <i className="fas fa-th-large text-7xl text-[#81b64c]"></i>
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tighter">Dominó Online</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
            <button onClick={createRoom} className="bg-[#81b64c] py-10 rounded-3xl font-black text-2xl hover:brightness-110 shadow-[0_8px_0_rgb(69,101,40)] transition-all active:translate-y-1">
              CRIAR SALA
            </button>
            <div className="flex flex-col gap-2">
                <input id="roomInput" placeholder="CÓDIGO" className="bg-[#262421] border-2 border-[#3c3a37] p-5 rounded-3xl text-center font-bold text-xl uppercase" />
                <button onClick={() => {
                    const val = (document.getElementById('roomInput') as HTMLInputElement).value;
                    if(val) joinRoom(val);
                }} className="bg-[#3c3a37] py-4 rounded-2xl font-bold">ENTRAR</button>
            </div>
        </div>
      </div>
    );
  }

  const isHost = gameState?.players?.[0]?.id === currentUser.id;
  const myHand = gameState?.hands?.[currentUser.id] || [];
  const isMyTurn = gameState?.players?.[gameState.turnIndex]?.id === currentUser.id;

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-2 gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#262421] p-3 rounded-xl border border-white/5">
        <div className="flex gap-2">
            <span className="bg-[#1a1917] px-3 py-1 rounded-lg text-xs font-mono text-[#81b64c]">{roomId}</span>
            <button onClick={shareLink} className="text-[10px] font-bold uppercase text-gray-400 hover:text-white">{copyStatus}</button>
        </div>
        <div className="flex gap-1">
            {gameState?.players?.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg border-2 ${gameState.turnIndex === i && gameState.status === 'playing' ? 'border-[#81b64c] bg-[#81b64c]/10' : 'border-transparent'}`}>
                    <img src={p.avatar} className="w-5 h-5 rounded-md" />
                    <span className="text-[10px] font-bold hidden sm:block">{p.name}</span>
                    <span className="text-[9px] text-gray-500">({gameState.hands?.[p.id]?.length || 0})</span>
                </div>
            ))}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 bg-[#1a1917] rounded-3xl border-4 border-[#262421] relative flex items-center justify-center p-4 overflow-auto custom-scrollbar">
         {gameState?.status === 'waiting' ? (
             <div className="text-center">
                <p className="text-gray-500 uppercase font-black tracking-widest mb-6">Aguardando Jogadores ({gameState.players?.length}/4)</p>
                {isHost && gameState.players?.length >= 2 && (
                    <button onClick={startNewMatch} className="bg-[#81b64c] px-10 py-4 rounded-2xl font-black text-lg shadow-[0_5px_0_rgb(69,101,40)] active:translate-y-1 transition-all">
                        INICIAR JOGO
                    </button>
                )}
             </div>
         ) : (
             <div className="flex flex-wrap items-center justify-center gap-1 min-w-max p-10">
                {gameState?.board?.map((move, i) => (
                    <DominoTileUI key={i} tile={move.tile} isFlipped={move.isFlipped} isHorizontal={true} small disabled />
                ))}
             </div>
         )}

         {gameState?.status === 'finished' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in">
                <div className="text-7xl mb-4">🏆</div>
                <h2 className="text-3xl font-black uppercase">{gameState.players?.find(p => p.id === gameState.winnerId)?.name} VENCEU!</h2>
                <div className="flex gap-3 mt-8">
                    {isHost && (
                        <button onClick={startNewMatch} className="bg-[#81b64c] px-8 py-3 rounded-xl font-black uppercase">Jogar Novamente</button>
                    )}
                    <button onClick={() => window.location.assign(window.location.origin)} className="bg-[#3c3a37] px-8 py-3 rounded-xl font-black uppercase">Sair</button>
                </div>
            </div>
         )}
      </div>

      {/* Hand */}
      <div className="bg-[#262421] p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-4 relative">
         <div className="flex justify-between w-full items-center px-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isMyTurn && gameState?.status === 'playing' ? 'text-[#81b64c] animate-pulse' : 'text-gray-500'}`}>
                {isMyTurn && gameState?.status === 'playing' ? 'SUA VEZ' : 'AGUARDE'}
            </span>
            {isMyTurn && gameState?.status === 'playing' && (
                <button onClick={passTurn} className="bg-red-500/20 text-red-400 text-[9px] px-3 py-1 rounded-full font-black border border-red-500/30">PASSAR</button>
            )}
         </div>
         <div className="flex flex-wrap justify-center gap-2">
            {myHand.map((tile) => (
                <DominoTileUI key={tile.id} tile={tile} onClick={() => playMove(tile.id)} disabled={!isMyTurn || gameState?.status !== 'playing'} />
            ))}
            {gameState?.status === 'playing' && myHand.length === 0 && <span className="text-xs text-gray-600">Carregando peças...</span>}
         </div>
      </div>
    </div>
  );
};

export default DominoGame;
