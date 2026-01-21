
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
      className={`bg-[#f0f0f0] rounded border-2 border-gray-400 flex shadow-md transition-all
        ${!disabled ? 'cursor-pointer hover:border-[#81b64c] hover:-translate-y-1' : 'cursor-default opacity-90'}
        ${isHorizontal ? 'flex-row w-14 h-9' : 'flex-col w-9 h-14'}
        ${small ? 'scale-90' : ''}`}
    >
      <div className="flex-1 flex items-center justify-center relative">{renderDots(a)}</div>
      <div className={`${isHorizontal ? 'w-[2px] h-full bg-gray-300' : 'h-[2px] w-full bg-gray-300'}`}></div>
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

  const startNewMatch = (currentPlayers: User[]) => {
    if (!roomId) return;
    const fullSet = createFullSet();
    const shuffled = shuffleSet(fullSet);
    
    const hands: Record<string, DominoTile[]> = {};
    currentPlayers.forEach((p, i) => {
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
    roomRef.once('value', (snap) => {
      const state = snap.val() as DominoGameState;
      if (!state) {
        alert("Sala não encontrada.");
        setRoomId(null);
        return;
      }
      
      const isAlreadyIn = state.players.find(p => p.id === currentUser.id);
      if (!isAlreadyIn) {
        if (state.players.length >= 4) {
          alert("A sala está cheia (máx 4 jogadores).");
          setRoomId(null);
          return;
        }
        const updatedPlayers = [...state.players, currentUser];
        roomRef.update({ players: updatedPlayers });
      }
      setRoomId(id);
    });
  };

  const playMove = (tileId: string) => {
    if (!gameState || gameState.status !== 'playing' || !roomId) return;
    const activePlayer = gameState.players[gameState.turnIndex];
    if (activePlayer.id !== currentUser.id) return;

    const myHand = gameState.hands[currentUser.id] || [];
    const tile = myHand.find(t => t.id === tileId);
    if (!tile) return;

    const options = canPlayTile(tile, gameState.board);
    if (options.length === 0) {
      alert("Movimento inválido! Esta peça não encaixa nas extremidades.");
      return;
    }

    // Prioriza o encaixe automático (simplificado)
    const { side, isFlipped } = options[0];
    const newBoard = side === 'left' 
      ? [{ tile, side, isFlipped }, ...gameState.board] 
      : [...gameState.board, { tile, side, isFlipped }];
    
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
      // Update Elo
      const newElo = (currentUser.dominoElo || 1200) + 25;
      db.ref(`users/${currentUser.id}`).update({ dominoElo: newElo });
    }

    db.ref(`domino_rooms/${roomId}`).update(updates);
  };

  const passTurn = () => {
    if (!gameState || !roomId || gameState.status !== 'playing') return;
    const activePlayer = gameState.players[gameState.turnIndex];
    if (activePlayer.id !== currentUser.id) return;

    // Verifica se realmente não tem jogada
    const myHand = gameState.hands[currentUser.id] || [];
    const hasMove = myHand.some(t => canPlayTile(t, gameState.board).length > 0);
    
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
    setCopyStatus('Copiado!');
    setTimeout(() => setCopyStatus('Copiar Link'), 2000);
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-8 p-6">
        <div className="text-center space-y-2">
            <div className="inline-block bg-[#81b64c]/10 p-4 rounded-full mb-4">
                <i className="fas fa-border-all text-6xl text-[#81b64c]"></i>
            </div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Dominó Profissional</h1>
            <p className="text-gray-400 max-w-sm mx-auto">Crie uma sala, convide amigos e mostre quem é o mestre das pedras.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
            <button onClick={createRoom} className="bg-[#81b64c] py-10 rounded-3xl font-black text-2xl hover:brightness-110 shadow-[0_8px_0_rgb(69,101,40)] transition-all active:translate-y-1 active:shadow-none">
              <i className="fas fa-plus-circle mr-2"></i> CRIAR SALA
            </button>
            <div className="flex flex-col gap-2">
                <input id="roomInput" placeholder="CÓDIGO DA SALA" className="bg-[#262421] border-2 border-[#3c3a37] p-5 rounded-3xl outline-none focus:border-[#81b64c] text-center font-bold text-xl uppercase tracking-widest" />
                <button onClick={() => {
                    const id = (document.getElementById('roomInput') as HTMLInputElement).value;
                    if(id) joinRoom(id);
                }} className="bg-[#3c3a37] py-4 rounded-2xl font-bold hover:bg-[#4a4844] text-white">
                  ENTRAR NA SALA
                </button>
            </div>
        </div>
      </div>
    );
  }

  const isHost = gameState?.players[0]?.id === currentUser.id;
  const myHand = gameState?.hands?.[currentUser.id] || [];
  const isMyTurn = gameState?.players[gameState.turnIndex]?.id === currentUser.id;

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-4 gap-4 overflow-hidden">
      {/* Header com Jogadores */}
      <div className="flex flex-wrap justify-between items-center bg-[#262421] p-4 rounded-2xl border border-white/5 shadow-2xl gap-4">
        <div className="flex items-center gap-3">
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-black">CÓDIGO</span>
                <span className="font-mono text-[#81b64c] font-black text-lg">{roomId}</span>
            </div>
            <button onClick={shareLink} className="bg-[#3c3a37] px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-[#81b64c] hover:text-white transition-all">
               <i className="fas fa-link mr-1"></i> {copyStatus}
            </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
            {gameState?.players.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${gameState.turnIndex === i && gameState.status === 'playing' ? 'bg-[#81b64c]/20 border-[#81b64c] scale-105' : 'bg-[#1a1917] border-transparent'}`}>
                    <div className="relative">
                        <img src={p.avatar} className="w-6 h-6 rounded-lg" />
                        {gameState.turnIndex === i && gameState.status === 'playing' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#81b64c] rounded-full animate-ping"></div>}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black truncate max-w-[80px]">{p.name}</span>
                        <span className="text-[8px] text-gray-500 font-bold uppercase">{gameState.hands?.[p.id]?.length || 0} PEÇAS</span>
                    </div>
                </div>
            ))}
            {(!gameState || gameState.players.length < 4) && gameState?.status === 'waiting' && (
                <div className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-dashed border-[#3c3a37] animate-pulse">
                    <i className="fas fa-user-plus text-gray-600 text-xs"></i>
                </div>
            )}
        </div>
      </div>

      {/* Área Principal de Jogo */}
      <div className="flex-1 bg-[#1a1917] rounded-[40px] border-8 border-[#262421] relative flex flex-col items-center justify-center p-8 overflow-hidden shadow-inner group">
         <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
             <i className="fas fa-border-all text-[20vw]"></i>
         </div>

         {gameState?.status === 'waiting' ? (
             <div className="text-center space-y-6 z-10">
                <div className="text-gray-600 font-black text-2xl uppercase tracking-[0.2em] mb-4">Aguardando Jogadores</div>
                <div className="flex justify-center gap-4">
                    {gameState.players.length >= 2 ? (
                        isHost ? (
                            <button onClick={() => startNewMatch(gameState.players)} className="bg-[#81b64c] px-12 py-5 rounded-3xl font-black text-xl shadow-[0_6px_0_rgb(69,101,40)] hover:brightness-110 active:translate-y-1 active:shadow-none transition-all">
                                COMEÇAR PARTIDA
                            </button>
                        ) : (
                            <div className="bg-[#3c3a37] px-8 py-4 rounded-2xl text-gray-400 font-bold">
                                AGUARDANDO HOST INICIAR...
                            </div>
                        )
                    ) : (
                        <p className="text-gray-500 font-bold italic">Mínimo de 2 jogadores para iniciar.</p>
                    )}
                </div>
             </div>
         ) : (
             <div className="flex flex-wrap items-center justify-center gap-1 overflow-auto max-h-full p-10 custom-scrollbar z-10">
                {gameState?.board.map((move, i) => (
                    <DominoTileUI key={i} tile={move.tile} isFlipped={move.isFlipped} isHorizontal={true} small disabled />
                ))}
             </div>
         )}

         {gameState?.status === 'finished' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-500">
                <div className="relative mb-8">
                    <div className="text-8xl animate-bounce">🏆</div>
                    <div className="absolute -top-4 -right-4 text-4xl">✨</div>
                </div>
                <h2 className="text-5xl font-black mb-2 uppercase tracking-tighter">Bateu o Jogo!</h2>
                <p className="text-xl text-[#81b64c] font-bold mb-10 bg-[#81b64c]/10 px-6 py-2 rounded-full border border-[#81b64c]/30">
                    {gameState.players.find(p => p.id === gameState.winnerId)?.name} é o grande campeão!
                </p>
                <div className="flex gap-4">
                    {isHost ? (
                        <button onClick={() => startNewMatch(gameState.players)} className="bg-[#81b64c] px-12 py-5 rounded-3xl font-black text-xl shadow-[0_6px_0_rgb(69,101,40)] hover:scale-105 active:translate-y-1 transition-all">
                            JOGAR NOVAMENTE
                        </button>
                    ) : (
                        <div className="bg-[#3c3a37] px-8 py-5 rounded-3xl text-gray-400 font-bold uppercase tracking-widest">
                            Aguardando Revanche...
                        </div>
                    )}
                    <button onClick={() => setRoomId(null)} className="bg-red-500/10 text-red-500 border-2 border-red-500/20 px-8 py-5 rounded-3xl font-black text-xl hover:bg-red-500 hover:text-white transition-all">
                        SAIR
                    </button>
                </div>
            </div>
         )}
      </div>

      {/* Minha Mão e Controles */}
      <div className="bg-[#262421] p-6 rounded-[32px] border border-white/5 shadow-2xl flex flex-col items-center gap-6 relative">
         <div className="flex justify-between w-full items-center px-4">
            <div className="flex items-center gap-4">
                <span className={`text-xs font-black uppercase tracking-widest transition-all ${isMyTurn && gameState?.status === 'playing' ? 'text-[#81b64c] scale-110' : 'text-gray-600'}`}>
                    {gameState?.status === 'playing' ? (isMyTurn ? '● É SUA VEZ' : 'AGUARDANDO...') : 'SALA DE ESPERA'}
                </span>
                {isMyTurn && gameState?.status === 'playing' && (
                    <button onClick={passTurn} className="bg-red-500/10 text-red-400 text-[10px] px-3 py-1 rounded-full font-black border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                        PASSAR VEZ
                    </button>
                )}
            </div>
            <div className="flex gap-2">
                <span className="bg-[#1a1917] px-3 py-1 rounded-full text-[10px] text-gray-400 font-bold border border-white/5 uppercase">Minhas Peças: {myHand.length}</span>
            </div>
         </div>

         <div className="flex flex-wrap justify-center gap-4 min-h-[100px] items-center">
            {myHand.length > 0 ? (
                myHand.map((tile) => (
                    <DominoTileUI 
                      key={tile.id} 
                      tile={tile} 
                      onClick={() => playMove(tile.id)}
                      disabled={!isMyTurn || gameState?.status !== 'playing'}
                    />
                ))
            ) : (
                <div className="text-gray-700 font-black uppercase tracking-widest opacity-30 italic">Nenhuma peça na mão</div>
            )}
         </div>

         {isMyTurn && gameState?.status === 'playing' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#81b64c] px-4 py-1 rounded-full text-[10px] font-black text-white animate-bounce shadow-lg">
                SUA JOGADA!
            </div>
         )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3c3a37; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #81b64c; }
      `}</style>
    </div>
  );
};

export default DominoGame;
