
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChessBoard from './components/ChessBoard';
import GameControls from './components/GameControls';
import Puzzles from './components/Puzzles';
import Learn from './components/Learn';
import DominoGame from './components/DominoGame';
import { Board, Move, Color, GameMode, User, AppView, UserSettings } from './types';
import { createInitialBoard, makeMove, getGameState, getBestMove, parseFen } from './services/chessLogic';
import { db } from './services/firebase';

const Confetti: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
    {[...Array(80)].map((_, i) => (
      <div key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, backgroundColor: ['#81b64c', '#f6f669', '#ffffff', '#779556', '#ffd700'][Math.floor(Math.random() * 5)], animationDelay: `${Math.random() * 4}s`, animationDuration: `${2.5 + Math.random() * 2}s`, width: `${5 + Math.random() * 10}px`, height: `${5 + Math.random() * 10}px`, opacity: Math.random() * 0.7 + 0.3 }} />
    ))}
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('domino')) return 'dominoes';
    return 'play';
  });
  
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('chess_profile_v6');
    if (saved) return JSON.parse(saved);
    const newId = `u_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: newId,
      name: `Jogador_${Math.random().toString(36).substr(2, 4)}`,
      elo: 1200,
      dominoElo: 1200,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`,
      lastSeen: Date.now(),
      settings: { chessTheme: 'green', dominoTheme: 'felt' }
    };
  });

  const boardRef = useRef<Board>(createInitialBoard());
  const historyRef = useRef<Move[]>([]);
  const [board, setBoard] = useState<Board>(boardRef.current);
  const [turn, setTurn] = useState<Color>('w');
  const [history, setHistory] = useState<Move[]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [timers, setTimers] = useState({ w: 600, b: 600 });
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.LOCAL);
  const [onlineRoom, setOnlineRoom] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<Color>('w');
  const [opponent, setOpponent] = useState<User | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const lastProcessedTs = useRef<number>(0);

  // Inicialização e Monitoramento de Salas de Xadrez
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setOnlineRoom(room);
      setGameMode(GameMode.ONLINE);
      joinChessRoom(room);
    }
  }, []);

  useEffect(() => {
    if (!onlineRoom) return;
    const roomRef = db.ref(`rooms/${onlineRoom}`);
    
    // Escuta movimentos
    const movesRef = roomRef.child('moves');
    movesRef.on('child_added', (snap) => {
      const { move, playerId, timestamp } = snap.val();
      if (timestamp > lastProcessedTs.current) {
        lastProcessedTs.current = timestamp;
        if (playerId !== currentUser.id) {
          applyMove(move);
        }
      }
    });

    // Escuta jogadores
    roomRef.child('players').on('value', snap => {
      const players = snap.val();
      if (players) {
        const opp = Object.values(players).find((p: any) => p.id !== currentUser.id) as User;
        if (opp) setOpponent(opp);
      }
    });

    // Escuta chat
    roomRef.child('chat').on('value', snap => {
      if (snap.exists()) setMessages(Object.values(snap.val()));
    });

    return () => {
      movesRef.off();
      roomRef.child('players').off();
      roomRef.child('chat').off();
    };
  }, [onlineRoom, currentUser.id]);

  const createChessRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    const roomData = {
      id,
      status: 'waiting',
      players: { [currentUser.id]: currentUser },
      createdAt: Date.now()
    };
    db.ref(`rooms/${id}`).set(roomData).then(() => {
      setOnlineRoom(id);
      setPlayerColor('w');
      setGameMode(GameMode.ONLINE);
      window.history.replaceState(null, '', `?room=${id}`);
    });
  };

  const joinChessRoom = (id: string) => {
    const roomRef = db.ref(`rooms/${id}`);
    roomRef.once('value').then(snap => {
      const data = snap.val();
      if (!data) return;
      const players = data.players || {};
      const playerList = Object.values(players);
      
      if (!players[currentUser.id] && playerList.length < 2) {
        roomRef.child(`players/${currentUser.id}`).set(currentUser);
        setPlayerColor('b'); // Segundo a entrar é Pretas
      } else if (players[currentUser.id]) {
        // Re-entrada, descobre a cor original
        const isFirst = Object.keys(players)[0] === currentUser.id;
        setPlayerColor(isFirst ? 'w' : 'b');
      }
    });
  };

  const applyMove = useCallback((move: Move) => {
    try {
      const newBoard = makeMove(boardRef.current, move);
      boardRef.current = newBoard;
      historyRef.current.push(move);
      setBoard([...newBoard]);
      setHistory([...historyRef.current]);
      setTurn(move.piece.color === 'w' ? 'b' : 'w');
      
      const state = getGameState(newBoard, move.piece.color === 'w' ? 'b' : 'w');
      if (state === 'checkmate') {
        setGameOver(`Xeque-mate! Vitória das ${move.piece.color === 'w' ? 'Brancas' : 'Pretas'}`);
        if (move.piece.color === playerColor) {
          setShowCelebration(true);
          updateElo(25);
        }
      } else if (state === 'stalemate') {
        setGameOver('Empate por afogamento.');
      }
      return true;
    } catch (e) { return false; }
  }, [playerColor]);

  const updateElo = (amount: number) => {
    const newElo = (currentUser.elo || 1200) + amount;
    const updated = { ...currentUser, elo: newElo };
    setCurrentUser(updated);
    db.ref(`users/${currentUser.id}`).update({ elo: newElo });
    localStorage.setItem('chess_profile_v6', JSON.stringify(updated));
  };

  const handleMove = (move: Move) => {
    if (gameOver) return;
    if (gameMode === GameMode.ONLINE) {
      if (turn !== playerColor || !onlineRoom) return;
      const ts = Date.now();
      lastProcessedTs.current = ts;
      if (applyMove(move)) {
        db.ref(`rooms/${onlineRoom}/moves`).push({ move, playerId: currentUser.id, timestamp: ts });
      }
    } else {
      applyMove(move);
    }
  };

  const resetGame = () => {
    boardRef.current = createInitialBoard();
    historyRef.current = [];
    setBoard(boardRef.current);
    setHistory([]);
    setTurn('w');
    setGameOver(null);
    setOnlineRoom(null);
    setGameMode(GameMode.LOCAL);
    window.history.replaceState(null, '', window.location.origin);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#312e2b] text-white overflow-hidden">
      <Sidebar user={currentUser} onProfileClick={() => setShowProfileModal(true)} onRankingClick={() => {}} currentView={currentView} onViewChange={setCurrentView} />
      {showCelebration && <Confetti />}
      
      <main className="flex-1 flex flex-col items-center overflow-y-auto pt-2 sm:pt-4 px-2 custom-scrollbar">
        {currentView === 'play' && (
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-6xl items-center lg:items-start pb-24 md:pb-6">
            <div className="w-full max-w-[600px] flex flex-col gap-2 relative">
              {/* Painel Adversário */}
              <div className="flex justify-between items-center px-3 py-2 bg-[#262421]/60 rounded-xl border border-white/5 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#3c3a37] rounded-lg overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
                    {opponent ? <img src={opponent.avatar} className="w-full h-full" /> : <i className="fas fa-robot text-gray-400 text-sm"></i>}
                  </div>
                  <div>
                    <div className="font-black text-sm">{opponent?.name || (gameMode === GameMode.ONLINE ? 'Aguardando...' : 'Stockfish')}</div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase leading-none tracking-widest">ELO {opponent?.elo || 1200}</div>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-lg font-mono text-xl ${turn !== playerColor && !gameOver ? 'bg-[#81b64c] text-white' : 'bg-[#1a1917] text-gray-500'} shadow-md transition-colors`}>
                  {Math.floor(timers[playerColor==='w'?'b':'w']/60)}:{(timers[playerColor==='w'?'b':'w']%60).toString().padStart(2,'0')}
                </div>
              </div>
              
              <ChessBoard board={board} onMove={handleMove} turn={turn} isFlipped={playerColor==='b'} lastMove={history.length>0?history[history.length-1]:null} gameOver={!!gameOver} settings={currentUser.settings} />
              
              {/* Painel Usuário */}
              <div className="flex justify-between items-center px-3 py-2 bg-[#262421]/60 rounded-xl border border-white/5 shadow-lg">
                <div className="flex items-center gap-3">
                  <img src={currentUser.avatar} className="w-9 h-9 rounded-lg border border-[#81b64c] shadow-lg" />
                  <div>
                    <div className="font-black text-sm">{currentUser.name} <span className="text-[10px] text-[#81b64c] ml-1">VOCÊ</span></div>
                    <div className="text-[9px] text-[#81b64c] font-bold uppercase leading-none tracking-widest">ELO {currentUser.elo}</div>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-lg font-mono text-xl ${turn === playerColor && !gameOver ? 'bg-[#81b64c] text-white' : 'bg-[#1a1917] text-gray-500'} shadow-md transition-colors`}>
                  {Math.floor(timers[playerColor]/60)}:{(timers[playerColor]%60).toString().padStart(2,'0')}
                </div>
              </div>

              {gameOver && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl p-6 text-center animate-in fade-in">
                  <h2 className="text-4xl font-black mb-4 text-[#81b64c] tracking-tighter italic uppercase">Fim de Jogo</h2>
                  <p className="text-xl mb-8 font-bold text-gray-300">{gameOver}</p>
                  <button onClick={resetGame} className="bg-[#81b64c] px-12 py-4 rounded-2xl font-black text-xl shadow-[0_6px_0_#456528] active:translate-y-1 transition-all">NOVA PARTIDA</button>
                </div>
              )}
            </div>
            
            <div className="w-full lg:w-[380px] h-[450px] lg:h-[580px]">
              <GameControls 
                history={history} 
                onUndo={resetGame} 
                onResign={() => setGameOver('Você abandonou a partida.')} 
                turn={turn} 
                whiteTimer={timers.w} 
                blackTimer={timers.b} 
                gameMode={gameMode} 
                messages={messages} 
                onlineRoom={onlineRoom} 
                onSendMessage={t => onlineRoom && db.ref(`rooms/${onlineRoom}/chat`).push({user: currentUser.name, text: t, timestamp: Date.now()})}
                onCreateOnline={createChessRoom}
              />
            </div>
          </div>
        )}
        
        {currentView === 'puzzles' && <div className="pb-24 md:pb-6 w-full max-w-6xl"><Puzzles /></div>}
        {currentView === 'learn' && <div className="pb-24 md:pb-6 w-full max-w-6xl"><Learn /></div>}
        {currentView === 'dominoes' && <DominoGame currentUser={currentUser} />}

        {/* Modal de Configurações */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
            <div className="bg-[#262421] p-8 rounded-[2.5rem] w-full max-w-2xl border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic tracking-tighter text-[#81b64c]">CONFIGURAÇÕES</h2>
                <button onClick={() => setShowProfileModal(false)} className="text-gray-500 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <div className="flex flex-col items-center gap-6 bg-[#1a1917] p-8 rounded-3xl border border-white/5">
                      <img src={currentUser.avatar} className="w-24 h-24 rounded-2xl border-2 border-[#81b64c] shadow-2xl" />
                      <button onClick={() => setCurrentUser({...currentUser, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`})} className="bg-[#3c3a37] px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#81b64c] transition-all">Trocar Avatar</button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Nickname</label>
                      <input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-[#1a1917] border border-white/5 p-4 rounded-2xl outline-none focus:border-[#81b64c] font-black text-sm" />
                    </div>
                </div>
                <div className="space-y-8">
                    <div>
                        <label className="text-[10px] font-black uppercase text-[#81b64c] tracking-[0.2em] block mb-4">Tabuleiro Xadrez</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['green', 'wood', 'blue', 'gray'].map(t => (
                                <button key={t} onClick={() => setCurrentUser({...currentUser, settings: {...currentUser.settings!, chessTheme: t as any}})} className={`py-3 rounded-xl border font-black text-[10px] uppercase transition-all ${currentUser.settings?.chessTheme === t ? 'bg-[#81b64c] border-[#81b64c] text-white shadow-lg' : 'bg-[#1a1917] border-white/5 text-gray-500 hover:border-white/20'}`}>{t}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-[#81b64c] tracking-[0.2em] block mb-4">Mesa Dominó</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['felt', 'wood', 'dark', 'blue'].map(t => (
                                <button key={t} onClick={() => setCurrentUser({...currentUser, settings: {...currentUser.settings!, dominoTheme: t as any}})} className={`py-3 rounded-xl border font-black text-[10px] uppercase transition-all ${currentUser.settings?.dominoTheme === t ? 'bg-[#81b64c] border-[#81b64c] text-white shadow-lg' : 'bg-[#1a1917] border-white/5 text-gray-500 hover:border-white/20'}`}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
              <button onClick={() => { setShowProfileModal(false); localStorage.setItem('chess_profile_v6', JSON.stringify(currentUser)); }} className="w-full bg-[#81b64c] py-5 rounded-2xl font-black text-xl mt-10 shadow-[0_8px_0_#456528] active:translate-y-1 transition-all">SALVAR ALTERAÇÕES</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
