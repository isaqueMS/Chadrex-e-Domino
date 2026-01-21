
import React, { useState, useEffect, useRef } from 'react';
import { User, DominoTile, DominoMove, DominoGameState, DominoChatMessage } from '../types';
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
  highlight?: boolean;
  isBoardPiece?: boolean;
}> = ({ tile, isFlipped, onClick, isHorizontal, small, disabled, highlight, isBoardPiece }) => {
  const a = isFlipped ? tile.sideB : tile.sideA;
  const b = isFlipped ? tile.sideA : tile.sideB;

  const renderDots = (n: number) => {
    const dotPos = [
      [],                          // 0
      [4],                         // 1
      [0, 8],                      // 2
      [0, 4, 8],                   // 3
      [0, 2, 6, 8],                // 4
      [0, 2, 4, 6, 8],             // 5
      [0, 2, 3, 5, 6, 8],          // 6
    ][n];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-[1px] w-full h-full p-1 sm:p-1.5">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dotPos.includes(i) && (
              <div className="w-[80%] h-[80%] bg-[#111] rounded-full shadow-inner" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`
        relative bg-[#fffdfa] rounded-[3px] border-[1px] border-[#d1d1d1] flex transition-all duration-200
        ${!disabled ? 'cursor-pointer hover:brightness-95 hover:-translate-y-1 active:translate-y-0 active:shadow-none' : 'cursor-default'}
        ${isHorizontal ? 'flex-row w-14 h-9 sm:w-20 sm:h-12' : 'flex-col w-9 h-14 sm:w-12 sm:h-20'}
        ${small ? 'scale-75 origin-center' : ''}
        ${highlight ? 'ring-2 ring-[#81b64c] ring-offset-2 ring-offset-[#1a1917] z-20' : ''}
        ${isBoardPiece ? 'shadow-lg' : 'shadow-md'}
      `}
      style={{
        boxShadow: isBoardPiece ? '2px 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)' : '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
        backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f7f3ed 100%)'
      }}
    >
      <div className="flex-1 flex items-center justify-center">{renderDots(a)}</div>
      <div className={`${isHorizontal ? 'w-[2px] h-3/4 my-auto bg-[#ccc] shadow-sm' : 'h-[2px] w-3/4 mx-auto bg-[#ccc] shadow-sm'}`} />
      <div className="flex-1 flex items-center justify-center">{renderDots(b)}</div>
      
      {/* The classic central pin */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 sm:w-1.5 h-1 sm:h-1.5 bg-[#9c7c2e] rounded-full shadow-sm z-10" />
    </div>
  );
};

const DominoGame: React.FC<DominoGameProps> = ({ currentUser }) => {
  const [roomId, setRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('domino');
  });
  const [gameState, setGameState] = useState<DominoGameState | null>(null);
  const [messages, setMessages] = useState<DominoChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [copyStatus, setCopyStatus] = useState('Convidar');
  const [pendingMove, setPendingMove] = useState<{ tile: DominoTile, options: any[] } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (roomId) joinRoom(roomId);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = db.ref(`domino_rooms/${roomId}`);
    const handler = (snap: any) => {
      const val = snap.val();
      if (val) {
        setGameState({
          players: val.players || [],
          turnIndex: val.turnIndex ?? 0,
          board: val.board || [],
          hands: val.hands || {},
          status: val.status || 'waiting',
          winnerId: val.winnerId
        });
      }
    };
    roomRef.on('value', handler);

    const chatRef = roomRef.child('chat');
    const chatHandler = (snap: any) => {
      const data = snap.val();
      if (data) {
        const list = Object.values(data) as DominoChatMessage[];
        setMessages(list.sort((a, b) => a.timestamp - b.timestamp));
      }
    };
    chatRef.on('value', chatHandler);

    return () => {
      roomRef.off('value', handler);
      chatRef.off('value', chatHandler);
    };
  }, [roomId]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

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
      window.history.replaceState(null, '', `?domino=${id}`);
    });
  };

  const joinRoom = (id: string) => {
    const roomRef = db.ref(`domino_rooms/${id}`);
    roomRef.transaction((currentData) => {
      if (!currentData) return currentData;
      const players = currentData.players || [];
      const alreadyIn = players.find((p: any) => p.id === currentUser.id);
      if (!alreadyIn && players.length < 4) {
        currentData.players = [...players, currentUser];
      }
      return currentData;
    }).then((result) => {
      if (result.committed) setRoomId(id);
      else { alert("Não foi possível entrar na sala."); setRoomId(null); }
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

  const handleTileClick = (tileId: string) => {
    if (!gameState || gameState.status !== 'playing' || !roomId) return;
    const isMyTurn = gameState.players[gameState.turnIndex]?.id === currentUser.id;
    if (!isMyTurn) return;

    const myHand = gameState.hands?.[currentUser.id] || [];
    const tile = myHand.find(t => t.id === tileId);
    if (!tile) return;

    const options = canPlayTile(tile, gameState.board || []);
    if (options.length === 0) return;

    if (options.length === 2) {
      setPendingMove({ tile, options });
    } else {
      executeMove(tile, options[0]);
    }
  };

  const executeMove = (tile: DominoTile, choice: any) => {
    if (!gameState || !roomId) return;
    const { side, isFlipped } = choice;
    const currentBoard = gameState.board || [];
    
    const newBoard = side === 'left' 
      ? [{ tile, side, isFlipped }, ...currentBoard] 
      : [...currentBoard, { tile, side, isFlipped }];
    
    const myHand = (gameState.hands?.[currentUser.id] || []).filter(t => t.id !== tile.id);
    const isWinner = myHand.length === 0;
    const nextTurn = (gameState.turnIndex + 1) % gameState.players.length;

    const updates: any = {
      board: newBoard,
      [`hands/${currentUser.id}`]: myHand,
      turnIndex: nextTurn
    };

    if (isWinner) {
      updates.status = 'finished';
      updates.winnerId = currentUser.id;
      db.ref(`users/${currentUser.id}`).update({
        dominoElo: (currentUser.dominoElo || 1200) + 25
      });
    }

    db.ref(`domino_rooms/${roomId}`).update(updates);
    setPendingMove(null);
  };

  const passTurn = () => {
    if (!gameState || !roomId || gameState.status !== 'playing') return;
    if (gameState.players[gameState.turnIndex]?.id !== currentUser.id) return;
    const nextTurn = (gameState.turnIndex + 1) % gameState.players.length;
    db.ref(`domino_rooms/${roomId}`).update({ turnIndex: nextTurn });
  };

  const sendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !roomId) return;

    const msg: DominoChatMessage = {
      user: currentUser.name,
      text: chatInput,
      timestamp: Date.now()
    };
    db.ref(`domino_rooms/${roomId}/chat`).push(msg);
    setChatInput('');
  };

  const shareLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/?domino=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopyStatus('Copiado!');
    setTimeout(() => setCopyStatus('Convidar'), 2000);
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-10 p-6 text-center">
        <div className="space-y-4">
            <div className="w-24 h-24 bg-[#81b64c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-th-large text-5xl text-[#81b64c]"></i>
            </div>
            <h1 className="text-5xl font-black italic tracking-tighter text-white">DOMINÓ <span className="text-[#81b64c]">ONLINE</span></h1>
            <p className="text-gray-400 max-w-md mx-auto">Convide seus amigos para uma partida clássica de dominó. Quem bater primeiro leva os pontos!</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
            <button onClick={createRoom} className="flex-1 bg-[#81b64c] py-6 rounded-3xl font-black text-xl shadow-[0_6px_0_#456528] active:translate-y-1 active:shadow-none transition-all">
               CRIAR MESA
            </button>
            <div className="flex-1 flex flex-col gap-2">
                <input id="roomInput" placeholder="CÓDIGO DA MESA" className="bg-[#262421] border-2 border-[#3c3a37] p-4 rounded-2xl text-center font-bold text-lg uppercase tracking-widest outline-none focus:border-[#81b64c]" />
                <button onClick={() => {
                    const id = (document.getElementById('roomInput') as HTMLInputElement).value;
                    if(id) joinRoom(id);
                }} className="bg-[#3c3a37] py-3 rounded-2xl font-bold hover:bg-[#4a4844] transition-colors">ENTRAR</button>
            </div>
        </div>
      </div>
    );
  }

  const isHost = gameState?.players?.[0]?.id === currentUser.id;
  const myHand = gameState?.hands?.[currentUser.id] || [];
  const isMyTurn = gameState?.players?.[gameState.turnIndex]?.id === currentUser.id;
  const winner = gameState?.players?.find(p => p.id === gameState.winnerId);

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-2 sm:p-4 gap-4 overflow-hidden select-none">
      {/* Upper Info Bar */}
      <div className="flex justify-between items-center bg-[#262421] p-3 sm:p-4 rounded-3xl border border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
            <div className="bg-[#1a1917] px-4 py-1.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-tighter leading-none">MESA</span>
                <span className="font-mono text-[#81b64c] font-black text-sm">{roomId}</span>
            </div>
            <button onClick={shareLink} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase bg-[#3c3a37] hover:bg-[#4a4844] transition-colors">
               <i className="fas fa-user-plus mr-2 text-[#81b64c]"></i> {copyStatus}
            </button>
        </div>
        
        <div className="flex gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-1">
            {gameState?.players?.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl border-2 transition-all shrink-0 ${gameState.turnIndex === i && gameState.status === 'playing' ? 'bg-[#81b64c]/10 border-[#81b64c]' : 'bg-[#1a1917] border-transparent'}`}>
                    <div className="relative">
                        <img src={p.avatar} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-md" />
                        {gameState.turnIndex === i && gameState.status === 'playing' && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#81b64c] rounded-full border-2 border-[#1a1917] animate-pulse"></div>}
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] sm:text-xs font-black truncate max-w-[60px]">{p.name}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase">{gameState.hands?.[p.id]?.length || 0} PEÇAS</span>
                    </div>
                </div>
            ))}
        </div>
        
        <button onClick={() => setShowChat(!showChat)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative ${showChat ? 'bg-[#81b64c] text-white' : 'bg-[#3c3a37] text-gray-400'}`}>
            <i className="fas fa-comments"></i>
            {!showChat && messages.length > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#262421]"></div>}
        </button>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden relative">
        {/* Main Board Area */}
        <div className="flex-1 bg-[#1a1917] rounded-[40px] sm:rounded-[56px] border-[8px] sm:border-[14px] border-[#262421] relative flex items-center justify-center p-6 sm:p-12 overflow-hidden shadow-inner group">
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

           {gameState?.status === 'waiting' ? (
               <div className="text-center z-10 flex flex-col items-center gap-6">
                  <div className="text-gray-600 font-black text-2xl sm:text-3xl uppercase tracking-[0.2em] animate-pulse">Aguardando Oponentes...</div>
                  <div className="flex items-center gap-4">
                    {gameState.players?.map(p => (
                      <img key={p.id} src={p.avatar} className="w-12 h-12 rounded-2xl border-2 border-[#3c3a37] shadow-xl" />
                    ))}
                    {[...Array(4 - (gameState.players?.length || 0))].map((_, i) => (
                      <div key={i} className="w-12 h-12 rounded-2xl border-2 border-dashed border-[#222] flex items-center justify-center">
                        <i className="fas fa-plus text-[#222]"></i>
                      </div>
                    ))}
                  </div>
                  {isHost && (gameState.players?.length || 0) >= 2 && (
                      <button onClick={startNewMatch} className="mt-4 bg-[#81b64c] px-14 py-5 rounded-[2rem] font-black text-2xl shadow-[0_8px_0_#456528] hover:scale-105 active:translate-y-1 transition-all">
                          COMEÇAR JOGO
                      </button>
                  )}
               </div>
           ) : (
               <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 overflow-auto max-h-full p-4 sm:p-10 custom-scrollbar z-10 w-full content-center">
                  {gameState?.board?.map((move, i) => (
                      <DominoTileUI key={i} tile={move.tile} isFlipped={move.isFlipped} isHorizontal={true} small disabled isBoardPiece />
                  ))}
                  {(!gameState?.board || gameState.board.length === 0) && (
                     <div className="w-32 h-20 rounded-3xl border-4 border-dashed border-[#222] flex items-center justify-center opacity-40">
                        <span className="text-[10px] font-black text-gray-700 uppercase">Início</span>
                     </div>
                  )}
               </div>
           )}

           {/* Choice Modal */}
           {pendingMove && (
              <div className="absolute inset-0 bg-[#000]/70 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-300">
                  <div className="bg-[#262421] p-10 rounded-[3rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center max-w-sm w-full mx-4">
                      <h3 className="text-2xl font-black mb-8 uppercase tracking-tighter text-white">Escolha o Lado</h3>
                      <div className="flex justify-center items-center gap-10 mb-10">
                          <div className="flex flex-col items-center gap-4">
                              <DominoTileUI tile={pendingMove.tile} isFlipped={pendingMove.options.find(o => o.side === 'left')?.isFlipped} isHorizontal={true} disabled />
                              <button 
                                onClick={() => executeMove(pendingMove.tile, pendingMove.options.find(o => o.side === 'left'))}
                                className="bg-[#3c3a37] hover:bg-[#81b64c] text-white px-6 py-3 rounded-2xl font-bold uppercase text-[10px] transition-all"
                              >
                                  Esquerda
                              </button>
                          </div>
                          <div className="h-20 w-[1px] bg-white/10"></div>
                          <div className="flex flex-col items-center gap-4">
                              <DominoTileUI tile={pendingMove.tile} isFlipped={pendingMove.options.find(o => o.side === 'right')?.isFlipped} isHorizontal={true} disabled />
                              <button 
                                onClick={() => executeMove(pendingMove.tile, pendingMove.options.find(o => o.side === 'right'))}
                                className="bg-[#3c3a37] hover:bg-[#81b64c] text-white px-6 py-3 rounded-2xl font-bold uppercase text-[10px] transition-all"
                              >
                                  Direita
                              </button>
                          </div>
                      </div>
                      <button onClick={() => setPendingMove(null)} className="text-gray-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors">Cancelar Jogada</button>
                  </div>
              </div>
           )}

           {/* Game Finished Modal */}
           {gameState?.status === 'finished' && (
              <div className="absolute inset-0 bg-[#111]/95 backdrop-blur-lg flex flex-col items-center justify-center z-[60] animate-in fade-in duration-700">
                  <div className="relative mb-10">
                      <div className="text-[120px] leading-none animate-bounce">🏆</div>
                      <div className="absolute top-0 -right-4 text-4xl">✨</div>
                  </div>
                  <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase text-white">Bateu o Jogo!</h2>
                  <div className="flex items-center gap-4 mb-12 bg-white/5 px-8 py-4 rounded-full border border-white/10 shadow-xl">
                      <img src={winner?.avatar} className="w-12 h-12 rounded-2xl border-2 border-[#81b64c]" />
                      <div className="text-left">
                          <div className="text-2xl font-black text-[#81b64c] leading-none uppercase">{winner?.name}</div>
                          <div className="text-xs text-gray-500 font-bold uppercase">Campeão da Mesa</div>
                      </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md px-6">
                      {isHost && (
                          <button onClick={startNewMatch} className="flex-1 bg-[#81b64c] py-6 rounded-3xl font-black text-xl shadow-[0_6px_0_#456528] active:translate-y-1 transition-all uppercase">
                             REVANCHE
                          </button>
                      )}
                      <button onClick={() => window.location.assign(window.location.origin)} className="flex-1 bg-[#3c3a37] py-6 rounded-3xl font-black text-xl text-gray-400 border border-white/5 hover:bg-[#444] transition-colors uppercase">
                         MENU PRINCIPAL
                      </button>
                  </div>
              </div>
           )}
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-72 bg-[#262421] border border-white/5 rounded-[40px] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Bate-papo</span>
              <button onClick={() => setShowChat(false)} className="text-gray-600 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.length === 0 && <div className="text-center text-gray-700 text-[10px] mt-10 uppercase font-bold italic">Sem mensagens ainda</div>}
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.user === currentUser.name ? 'items-end' : 'items-start'}`}>
                  <span className="text-[8px] font-black text-gray-600 uppercase mb-1">{m.user}</span>
                  <div className={`px-3 py-2 rounded-2xl text-[11px] max-w-[90%] break-words ${m.user === currentUser.name ? 'bg-[#81b64c] text-white rounded-tr-none' : 'bg-[#1a1917] text-gray-300 rounded-tl-none'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChatMessage} className="p-4 bg-[#1a1917] rounded-b-[40px] flex gap-2">
              <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Diga algo..."
                className="flex-1 bg-transparent text-xs outline-none text-gray-300 placeholder-gray-700"
              />
              <button type="submit" className="text-[#81b64c] hover:scale-110 transition-transform"><i className="fas fa-paper-plane"></i></button>
            </form>
          </div>
        )}
      </div>

      {/* Player Hand / Control Bar */}
      <div className="bg-[#262421] p-5 sm:p-8 rounded-[40px] border border-white/5 shadow-2xl flex flex-col items-center gap-6 relative">
         <div className="flex justify-between w-full items-center px-4">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-[#81b64c] animate-ping' : 'bg-gray-700'}`}></div>
                   <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${isMyTurn ? 'text-[#81b64c]' : 'text-gray-600'}`}>
                       {gameState?.status === 'playing' ? (isMyTurn ? 'SUA JOGADA' : 'AGUARDANDO VEZ') : 'PRONTO'}
                   </span>
                </div>
                {isMyTurn && gameState?.status === 'playing' && (
                    <button onClick={passTurn} className="bg-red-500/10 text-red-400 text-[10px] px-5 py-2 rounded-full font-black border border-red-500/20 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest">
                        PASSAR VEZ
                    </button>
                )}
            </div>
            <div className="hidden sm:flex items-center gap-4 text-gray-600 font-bold text-[10px] uppercase">
                <i className="fas fa-hand-paper text-xs"></i> Minha Mão: {myHand.length} Peças
            </div>
         </div>

         <div className="flex flex-wrap justify-center gap-3 sm:gap-5 min-h-[120px] items-center px-4 w-full max-w-4xl">
            {myHand.length > 0 ? (
                myHand.map((tile) => {
                    const canPlay = isMyTurn && canPlayTile(tile, gameState?.board || []).length > 0;
                    return (
                        <DominoTileUI 
                          key={tile.id} 
                          tile={tile} 
                          onClick={() => handleTileClick(tile.id)}
                          disabled={!isMyTurn || gameState?.status !== 'playing'}
                          highlight={canPlay}
                        />
                    );
                })
            ) : (
                gameState?.status === 'playing' && <div className="text-gray-800 font-black text-xl uppercase italic tracking-widest opacity-20">Aguardando Distribuição...</div>
            )}
         </div>

         {isMyTurn && gameState?.status === 'playing' && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#81b64c] px-8 py-2 rounded-full text-xs font-black text-white animate-bounce shadow-2xl uppercase tracking-widest">
                É a sua vez!
            </div>
         )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3c3a37; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #81b64c; }
        
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoom-in { from { transform: scale(0.9); } to { transform: scale(1); } }
        .animate-in { animation: fade-in 0.3s ease-out both; }
        .zoom-in { animation: zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>
    </div>
  );
};

export default DominoGame;
