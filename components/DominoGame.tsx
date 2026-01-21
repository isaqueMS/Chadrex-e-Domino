
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

  // REQUISITO: Buchas (duplas) SEMPRE verticais no tabuleiro.
  const isBucha = tile.sideA === tile.sideB;
  const finalHorizontal = isBoardPiece ? !isBucha : isHorizontal;

  const renderDots = (n: number) => {
    const dotPos = [
      [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8],
    ][n];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-[1px] w-full h-full p-0.5 sm:p-1">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dotPos.includes(i) && (
              <div className="w-[85%] h-[85%] bg-[#1a1a1a] rounded-full shadow-inner" />
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
        relative bg-[#fffdf5] border border-[#d8d0c5] flex transition-all duration-200 shrink-0
        ${!disabled ? 'cursor-pointer hover:brightness-105 active:scale-95 shadow-md' : 'cursor-default shadow-sm'}
        ${finalHorizontal ? 'flex-row w-12 h-7 sm:w-16 sm:h-9 md:w-18 md:h-10' : 'flex-col w-7 h-12 sm:w-9 sm:h-16 md:w-10 md:h-18'}
        ${isBoardPiece ? 'rounded-[1px]' : 'rounded-[3px]'}
        ${highlight ? 'ring-2 ring-[#81b64c] ring-offset-1 ring-offset-[#1a1917] z-20' : ''}
      `}
      style={{
        backgroundImage: 'linear-gradient(145deg, #ffffff 0%, #f4eee1 60%, #e2d8c7 100%)',
        boxShadow: isBoardPiece ? '0.5px 0.5px 2px rgba(0,0,0,0.5)' : '0 4px 6px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex-1 flex items-center justify-center">{renderDots(a)}</div>
      <div className={`${finalHorizontal ? 'w-[1.5px] h-3/4 my-auto bg-[#cbbda9]' : 'h-[1.5px] w-3/4 mx-auto bg-[#cbbda9]'}`} />
      <div className="flex-1 flex items-center justify-center">{renderDots(b)}</div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-[#967d4f] rounded-full z-10 border border-[#b8a176] shadow-sm" />
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
  const boardRef = useRef<HTMLDivElement>(null);

  const emojis = ['😂', '😎', '🤫', '🎲', '🏆', '🔥', '👏', '🤝'];

  const tableThemes = {
    felt: 'bg-[#1a4a2a]',
    wood: 'bg-[#3d2b1f]',
    dark: 'bg-[#1a1917]',
    blue: 'bg-[#1b2b3a]',
  };
  
  const currentTableBg = tableThemes[currentUser.settings?.dominoTheme || 'felt'];

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
    return () => { roomRef.off('value', handler); chatRef.off('value', chatHandler); };
  }, [roomId]);

  useEffect(() => {
    if (boardRef.current && gameState?.board) {
      boardRef.current.scrollLeft = boardRef.current.scrollWidth;
    }
  }, [gameState?.board]);

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    const newState: DominoGameState = { players: [currentUser], turnIndex: 0, board: [], hands: {}, status: 'waiting' };
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
      else { setRoomId(null); }
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
    db.ref(`domino_rooms/${roomId}`).update({ board: [], hands, turnIndex: 0, status: 'playing', winnerId: null });
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
    if (options.length === 2) setPendingMove({ tile, options });
    else executeMove(tile, options[0]);
  };

  const executeMove = (tile: DominoTile, choice: any) => {
    if (!gameState || !roomId) return;
    const { side, isFlipped } = choice;
    const currentBoard = gameState.board || [];
    const newBoard = side === 'left' ? [{ tile, side, isFlipped }, ...currentBoard] : [...currentBoard, { tile, side, isFlipped }];
    const myHand = (gameState.hands?.[currentUser.id] || []).filter(t => t.id !== tile.id);
    const isWinner = myHand.length === 0;
    const nextTurn = (gameState.turnIndex + 1) % gameState.players.length;
    const updates: any = { board: newBoard, [`hands/${currentUser.id}`]: myHand, turnIndex: nextTurn };
    if (isWinner) {
      updates.status = 'finished';
      updates.winnerId = currentUser.id;
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

  const sendChatMessage = (text: string) => {
    if (!text.trim() || !roomId) return;
    db.ref(`domino_rooms/${roomId}/chat`).push({ user: currentUser.name, text: text.trim(), timestamp: Date.now() });
    setChatInput('');
  };

  const isHost = gameState?.players?.[0]?.id === currentUser.id;
  const myHand = gameState?.hands?.[currentUser.id] || [];
  const isMyTurn = gameState?.players[gameState?.turnIndex]?.id === currentUser.id;
  const winner = gameState?.players?.find(p => p.id === gameState.winnerId);

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-4 text-center pb-24 md:pb-6">
        <div className="space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#81b64c]/10 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-th-large text-3xl sm:text-4xl text-[#81b64c]"></i></div>
            <h1 className="text-3xl sm:text-5xl font-black italic tracking-tighter text-white">DOMINÓ <span className="text-[#81b64c]">ONLINE</span></h1>
            <p className="text-gray-400 text-xs">A clássica mesa de bar, agora no seu celular.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={createRoom} className="bg-[#81b64c] py-4 rounded-2xl font-black text-lg shadow-[0_4px_0_#456528] active:translate-y-1">CRIAR MESA</button>
            <div className="flex gap-2">
                <input id="roomInput" placeholder="CÓDIGO" className="flex-1 bg-[#262421] border border-[#3c3a37] p-3 rounded-xl text-center font-bold outline-none focus:border-[#81b64c]" />
                <button onClick={() => { const id = (document.getElementById('roomInput') as HTMLInputElement).value; if(id) joinRoom(id); }} className="bg-[#3c3a37] px-4 rounded-xl font-bold">IR</button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden select-none pb-20 md:pb-4">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-[#262421] p-3 rounded-2xl border border-white/5 shadow-xl">
        <div className="flex items-center gap-2">
            <div className="bg-[#1a1917] px-3 py-1 rounded-lg border border-white/5"><span className="text-[10px] text-[#81b64c] font-black uppercase tracking-widest">{roomId}</span></div>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?domino=${roomId}`); setCopyStatus('Copiado!'); setTimeout(() => setCopyStatus('Convidar'), 2000); }} className="h-7 px-3 rounded-lg text-[8px] font-black uppercase bg-[#3c3a37] text-white tracking-widest">{copyStatus}</button>
        </div>
        <div className="flex-1 flex justify-end gap-2 overflow-x-auto px-2 custom-scrollbar">
            {gameState?.players?.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded-xl border transition-all shrink-0 ${gameState.turnIndex === i && gameState.status === 'playing' ? 'bg-[#81b64c]/10 border-[#81b64c]' : 'bg-[#1a1917] border-transparent'}`}>
                    <img src={p.avatar} className="w-5 h-5 rounded shadow-md" />
                    <span className="text-[9px] font-black truncate max-w-[40px] uppercase">{p.name}</span>
                </div>
            ))}
        </div>
        <button onClick={() => setShowChat(!showChat)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ml-2 ${showChat ? 'bg-[#81b64c] text-white' : 'bg-[#3c3a37] text-gray-400'}`}><i className="fas fa-comments text-xs"></i></button>
      </div>

      {/* REQUISITO: Tabuleiro com gap-0 (peças coladas) */}
      <div className="flex-1 flex gap-2 overflow-hidden relative">
        <div className={`flex-1 ${currentTableBg} rounded-[24px] md:rounded-[40px] border-[10px] md:border-[16px] border-[#262421] relative flex items-center justify-center p-2 sm:p-4 overflow-hidden shadow-inner transition-colors duration-500`}>
           <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
           
           {gameState?.status === 'waiting' ? (
               <div className="text-center z-10 flex flex-col items-center gap-4">
                  <div className="text-white/20 font-black text-xl sm:text-3xl uppercase tracking-[0.3em] animate-pulse px-4">Mesa Aberta</div>
                  {isHost && (gameState.players?.length || 0) >= 2 && <button onClick={startNewMatch} className="mt-2 bg-[#81b64c] px-12 py-4 rounded-2xl font-black text-xl shadow-[0_6px_0_#456528] active:translate-y-1">COMEÇAR JOGO</button>}
               </div>
           ) : (
               <div ref={boardRef} className="flex items-center justify-start sm:justify-center gap-0 overflow-x-auto overflow-y-hidden h-full w-full p-10 custom-scrollbar z-10 scroll-smooth">
                  {gameState?.board?.map((move, i) => <DominoTileUI key={i} tile={move.tile} isFlipped={move.isFlipped} isBoardPiece />)}
               </div>
           )}

           {pendingMove && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4">
                  <div className="bg-[#262421] p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center w-full max-w-xs animate-in zoom-in">
                      <h3 className="text-xl font-black mb-6 uppercase text-white tracking-tighter italic">Qual lado jogar?</h3>
                      <div className="flex justify-around items-center gap-4 mb-8">
                          <div className="flex flex-col items-center gap-3"><DominoTileUI tile={pendingMove.tile} isFlipped={pendingMove.options.find(o => o.side === 'left')?.isFlipped} isHorizontal={true} disabled /><button onClick={() => executeMove(pendingMove.tile, pendingMove.options.find(o => o.side === 'left'))} className="bg-[#3c3a37] px-5 py-2 rounded-xl font-black uppercase text-[9px] hover:bg-[#81b64c]">Esq</button></div>
                          <div className="flex flex-col items-center gap-3"><DominoTileUI tile={pendingMove.tile} isFlipped={pendingMove.options.find(o => o.side === 'right')?.isFlipped} isHorizontal={true} disabled /><button onClick={() => executeMove(pendingMove.tile, pendingMove.options.find(o => o.side === 'right'))} className="bg-[#3c3a37] px-5 py-2 rounded-xl font-black uppercase text-[9px] hover:bg-[#81b64c]">Dir</button></div>
                      </div>
                      <button onClick={() => setPendingMove(null)} className="text-gray-500 font-black text-[10px] uppercase hover:text-white">Cancelar</button>
                  </div>
              </div>
           )}

           {gameState?.status === 'finished' && (
              <div className="absolute inset-0 bg-[#111]/95 backdrop-blur-lg flex flex-col items-center justify-center z-[60] text-center p-6 animate-in fade-in">
                  <div className="text-7xl sm:text-9xl mb-4 drop-shadow-2xl">🏆</div>
                  <h2 className="text-3xl sm:text-6xl font-black mb-8 text-white uppercase tracking-tighter italic">{winner?.name} BATUCOU!</h2>
                  <div className="flex flex-col gap-4 w-full max-w-xs">
                      {isHost && <button onClick={startNewMatch} className="bg-[#81b64c] py-5 rounded-2xl font-black text-xl shadow-[0_6px_0_#456528] active:translate-y-1">REVANCHE</button>}
                      <button onClick={() => window.location.assign(window.location.origin)} className="bg-[#3c3a37] py-4 rounded-xl font-bold text-gray-400 uppercase tracking-widest">Sair da Mesa</button>
                  </div>
              </div>
           )}
        </div>

        {showChat && (
          <div className="fixed inset-0 md:relative md:inset-auto md:w-80 bg-[#262421] border md:border-white/5 md:rounded-[30px] flex flex-col shadow-2xl z-[150] animate-in slide-in-from-right">
            <div className="p-5 border-b border-white/5 flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 italic">Bate-papo</span><button onClick={() => setShowChat(false)} className="md:hidden text-gray-600 hover:text-white"><i className="fas fa-times"></i></button></div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-[#1a1917]/30">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.user === currentUser.name ? 'items-end' : 'items-start'}`}>
                  <span className="text-[8px] font-black text-gray-600 uppercase mb-1">{m.user}</span>
                  <div className={`px-4 py-2.5 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${m.user === currentUser.name ? 'bg-[#81b64c] text-white rounded-tr-none' : 'bg-[#3c3a37] text-gray-200 rounded-tl-none'}`}>{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-5 bg-[#1a1917] space-y-4">
              <div className="flex justify-between px-1 overflow-x-auto gap-3 pb-2 custom-scrollbar">
                {emojis.map(e => (
                  <button key={e} onClick={() => sendChatMessage(e)} className="hover:scale-125 transition-transform text-xl shrink-0">{e}</button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(chatInput); }} className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Mande a letra..." className="flex-1 bg-[#262421] rounded-xl px-4 py-3 text-xs outline-none text-gray-300 border border-white/5 focus:border-[#81b64c] transition-all" />
                <button type="submit" className="bg-[#81b64c] w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95"><i className="fas fa-paper-plane text-sm"></i></button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Área do Jogador */}
      <div className="bg-[#262421] p-4 sm:p-6 md:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col gap-4 relative">
         <div className="flex justify-between w-full items-center px-4">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-[#81b64c] animate-ping' : 'bg-gray-700'}`}></div>
              <span className={`text-[11px] font-black uppercase tracking-widest ${isMyTurn ? 'text-[#81b64c]' : 'text-gray-600'}`}>{isMyTurn ? 'É A SUA VEZ' : 'AGUARDE'}</span>
              {isMyTurn && gameState?.status === 'playing' && <button onClick={passTurn} className="ml-4 bg-red-500/10 text-red-400 text-[9px] px-4 py-1.5 rounded-full font-black border border-red-500/20 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Pular</button>}
            </div>
            <div className="text-gray-500 font-black text-[10px] uppercase tracking-widest">{myHand.length} PEÇAS RESTANTES</div>
         </div>
         <div className="flex items-center justify-start sm:justify-center gap-4 min-h-[100px] overflow-x-auto pb-4 px-2 w-full custom-scrollbar scroll-smooth">
            {myHand.map((tile) => (
              <div key={tile.id} className="shrink-0">
                <DominoTileUI tile={tile} isHorizontal={false} onClick={() => handleTileClick(tile.id)} disabled={!isMyTurn || gameState?.status !== 'playing'} highlight={isMyTurn && canPlayTile(tile, gameState?.board || []).length > 0} />
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default DominoGame;
