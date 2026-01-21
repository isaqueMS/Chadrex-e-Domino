
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChessBoard from './components/ChessBoard';
import GameControls from './components/GameControls';
import Puzzles from './components/Puzzles';
import Learn from './components/Learn';
import DominoGame from './components/DominoGame';
import { Board, Move, Color, GameMode, User, AppView } from './types';
import { createInitialBoard, makeMove, getGameState, getBestMove } from './services/chessLogic';
import { db } from './services/firebase';

const Confetti: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {[...Array(80)].map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ['#81b64c', '#f6f669', '#ffffff', '#779556', '#ffd700'][Math.floor(Math.random() * 5)],
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${2.5 + Math.random() * 2}s`,
            width: `${5 + Math.random() * 10}px`,
            height: `${5 + Math.random() * 10}px`,
            opacity: Math.random() * 0.7 + 0.3
          }}
        />
      ))}
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    if(params.has('domino')) return 'dominoes';
    return 'play';
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
  const [isWaiting, setIsWaiting] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [opponent, setOpponent] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<{from: User, roomId: string} | null>(null);
  const [rematchStatus, setRematchStatus] = useState<{A: boolean, B: boolean}>({A: false, B: false});
  const [showCelebration, setShowCelebration] = useState(false);

  const lastProcessedTs = useRef<number>(0);

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('chess_profile_v4');
    if (saved) return JSON.parse(saved);
    const newId = `u_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: newId,
      name: `Mestre_${Math.random().toString(36).substr(2, 4)}`,
      elo: 1200,
      dominoElo: 1200,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`,
      lastSeen: Date.now()
    };
  });

  // SINCRONIZAÇÃO E NOTIFICAÇÕES
  useEffect(() => {
    const updateProfile = () => {
      const updatedUser = { ...currentUser, lastSeen: Date.now() };
      localStorage.setItem('chess_profile_v4', JSON.stringify(updatedUser));
      db.ref(`users/${currentUser.id}`).update(updatedUser);
    };

    updateProfile();
    const heartbeat = setInterval(updateProfile, 30000);

    const challengesRef = db.ref(`users/${currentUser.id}/invitations`);
    challengesRef.on('child_added', (snap) => {
      const invite = snap.val();
      if (invite && (Date.now() - invite.timestamp < 60000)) {
        setIncomingChallenge(invite);
      }
    });

    const playersRef = db.ref('users').orderByChild('elo');
    playersRef.on('value', (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.values(val) as User[];
        setLeaderboard(list.sort((a, b) => (b.elo || 0) - (a.elo || 0)));
      }
    });

    return () => {
      clearInterval(heartbeat);
      challengesRef.off();
      playersRef.off();
    };
  }, [currentUser]);

  // CRONÔMETRO XADREZ
  useEffect(() => {
    if (currentView !== 'play' || gameOver || isWaiting || isSpectator || (gameMode === GameMode.ONLINE && !opponent)) return;
    const interval = setInterval(() => {
      setTimers(prev => {
        const currentSeconds = prev[turn];
        if (currentSeconds <= 0) {
          const winner = turn === 'w' ? 'Pretas' : 'Brancas';
          setGameOver(`Tempo esgotado! Vitória das ${winner}`);
          if ((turn === 'b' && playerColor === 'w') || (turn === 'w' && playerColor === 'b')) {
            setShowCelebration(true);
          }
          clearInterval(interval);
          return prev;
        }
        return { ...prev, [turn]: currentSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, gameOver, isWaiting, gameMode, opponent, isSpectator, playerColor, currentView]);

  const resetGameState = useCallback((newColor?: Color) => {
    boardRef.current = createInitialBoard();
    historyRef.current = [];
    setBoard(boardRef.current);
    setHistory([]);
    setTurn('w');
    setGameOver(null);
    setShowCelebration(false);
    setTimers({ w: 600, b: 600 });
    setMessages([]);
    setRematchStatus({A: false, B: false});
    if (newColor) setPlayerColor(newColor);
  }, []);

  const applyMove = useCallback((move: Move) => {
    try {
      const newBoard = makeMove(boardRef.current, move);
      boardRef.current = newBoard;
      historyRef.current.push(move);
      setBoard([...newBoard]);
      setHistory([...historyRef.current]);
      const nextTurn = move.piece.color === 'w' ? 'b' : 'w';
      setTurn(nextTurn);
      const state = getGameState(newBoard, nextTurn);
      if (state === 'checkmate') {
        const won = move.piece.color === playerColor;
        setGameOver(`Xeque-mate! Vitória das ${move.piece.color === 'w' ? 'Brancas' : 'Pretas'}`);
        if (won) setShowCelebration(true);
        const eloChange = won ? 20 : -15;
        const newElo = Math.max(100, currentUser.elo + eloChange);
        setCurrentUser(prev => ({ ...prev, elo: newElo }));
      } else if (state === 'stalemate') {
        setGameOver('Empate por afogamento.');
      }
      return true;
    } catch (e) { return false; }
  }, [playerColor, currentUser.elo]);

  // SYNC DA IA
  useEffect(() => {
    if (currentView === 'play' && gameMode === GameMode.AI && turn === 'b' && !gameOver) {
      const timer = setTimeout(() => {
        const move = getBestMove(board, 'b', currentUser.elo);
        if (move) applyMove(move);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [turn, gameMode, gameOver, board, currentUser.elo, applyMove, currentView]);

  // MULTIPLAYER XADREZ SYNC
  useEffect(() => {
    if (!onlineRoom) return;
    const roomRef = db.ref(`rooms/${onlineRoom}`);
    
    roomRef.on('value', (snap) => {
      const data = snap.val();
      if (!data) return;
      
      setSpectatorCount(data.spectators ? Object.keys(data.spectators).length : 0);
      if (isSpectator) setOpponent(data.playerB || data.playerA);
      else setOpponent(playerColor === 'w' ? data.playerB : data.playerA);
      
      if (data.status === 'playing') setIsWaiting(false);
      if (data.status === 'resigned') setGameOver('Oponente abandonou a partida.');
      
      if (data.rematch) {
        setRematchStatus(data.rematch);
        if (data.rematch.A && data.rematch.B) {
          resetGameState(playerColor === 'w' ? 'b' : 'w');
          db.ref(`rooms/${onlineRoom}/rematch`).remove();
          db.ref(`rooms/${onlineRoom}/moves`).remove();
        }
      }
    });

    const movesRef = roomRef.child('moves');
    movesRef.on('child_added', (snap) => {
      const data = snap.val();
      if (data && data.timestamp > lastProcessedTs.current && data.playerId !== currentUser.id) {
        lastProcessedTs.current = data.timestamp;
        applyMove(data.move);
      }
    });

    const chatRef = roomRef.child('chat');
    chatRef.on('child_added', (snap) => {
      setMessages(prev => [...prev, snap.val()]);
    });

    return () => { roomRef.off(); movesRef.off(); chatRef.off(); };
  }, [onlineRoom, playerColor, currentUser.id, applyMove, isSpectator, resetGameState]);

  const handleMove = (move: Move) => {
    if (gameOver || isSpectator) return;
    if (gameMode === GameMode.ONLINE) {
      if (turn !== playerColor || !onlineRoom) return;
      const ts = Date.now();
      lastProcessedTs.current = ts;
      if (applyMove(move)) {
        db.ref(`rooms/${onlineRoom}/moves`).push({
          move: JSON.parse(JSON.stringify(move)),
          playerId: currentUser.id,
          timestamp: ts
        });
      }
    } else {
      applyMove(move);
    }
  };

  const createOnlineGame = (targetId?: string) => {
    const id = Math.random().toString(36).substring(2, 10);
    setOnlineRoom(id); setGameMode(GameMode.ONLINE); setPlayerColor('w'); setIsWaiting(true); setIsSpectator(false);
    db.ref(`rooms/${id}`).set({ id, status: 'waiting', playerA: currentUser });
    if (targetId) db.ref(`users/${targetId}/invitations`).push({ from: currentUser, roomId: id, timestamp: Date.now() });
  };

  // Fix error: requestRematch was missing in App.tsx
  const requestRematch = () => {
    if (!onlineRoom) return;
    const side = playerColor === 'w' ? 'A' : 'B';
    db.ref(`rooms/${onlineRoom}/rematch`).update({ [side]: true });
  };

  const isPlayerOnline = (lastSeen?: number) => lastSeen ? (Date.now() - lastSeen < 60000) : false;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#312e2b] text-white overflow-hidden">
      <Sidebar 
        user={currentUser} 
        onProfileClick={() => setShowProfileModal(true)} 
        onRankingClick={() => setShowRanking(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      
      {showCelebration && <Confetti />}

      <main className="flex-1 flex flex-col items-center overflow-y-auto pt-4 px-2">
        {currentView === 'play' && (
          <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl items-center lg:items-start">
            <div className="w-full max-w-[600px] flex flex-col gap-2 relative">
              {isSpectator && (
                <div className="absolute top-2 right-2 z-20 bg-red-600 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse"><i className="fas fa-eye"></i> SPECTATOR</div>
              )}
              <div className="flex justify-between items-center px-4 py-2 bg-[#262421]/50 rounded border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#3c3a37] rounded overflow-hidden flex items-center justify-center relative">
                    {opponent ? <img src={opponent.avatar} className="w-full h-full" /> : <i className="fas fa-robot text-gray-400"></i>}
                    {opponent && isPlayerOnline(opponent.lastSeen) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#262421] rounded-full"></div>}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{opponent?.name || (gameMode === GameMode.AI ? 'Stockfish 3.0' : 'Aguardando...')}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase">ELO {opponent?.elo || 1200}</div>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded font-mono text-xl ${turn !== playerColor && !gameOver ? 'bg-white text-black font-bold' : 'bg-[#211f1c] text-gray-500'}`}>
                  {Math.floor(timers[playerColor === 'w' ? 'b' : 'w'] / 60)}:{(timers[playerColor === 'w' ? 'b' : 'w'] % 60).toString().padStart(2, '0')}
                </div>
              </div>
              <ChessBoard board={board} onMove={handleMove} turn={turn} isFlipped={playerColor === 'b'} lastMove={history.length > 0 ? history[history.length - 1] : null} gameOver={!!gameOver} />
              <div className="flex justify-between items-center px-4 py-2 bg-[#262421]/50 rounded border border-white/5">
                <div className="flex items-center gap-3">
                  <img src={currentUser.avatar} className="w-10 h-10 rounded-md cursor-pointer border border-white/10" onClick={() => setShowProfileModal(true)} />
                  <div>
                    <div className="font-bold text-sm">{currentUser.name} <span className="text-[9px] text-[#81b64c] ml-1">VOCÊ</span></div>
                    <div className="text-[10px] text-[#81b64c] font-bold uppercase">ELO {currentUser.elo}</div>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded font-mono text-xl ${turn === playerColor && !gameOver ? 'bg-white text-black font-bold' : 'bg-[#211f1c] text-gray-500'}`}>
                  {Math.floor(timers[playerColor] / 60)}:{(timers[playerColor] % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
            <div className="w-full lg:w-[380px] flex flex-col gap-4">
              <div className="h-[520px]">
                <GameControls history={history} onUndo={() => { if (gameMode !== GameMode.ONLINE) resetGameState(); }} onResign={() => { if (onlineRoom && !isSpectator) db.ref(`rooms/${onlineRoom}`).update({ status: 'resigned' }); setGameOver('Partida abandonada.'); }} turn={turn} whiteTimer={timers.w} blackTimer={timers.b} gameMode={gameMode} messages={messages} onlineRoom={onlineRoom} onSendMessage={(text) => { if (onlineRoom) db.ref(`rooms/${onlineRoom}/chat`).push({ user: currentUser.name, text, timestamp: Date.now() }); }} />
              </div>
              {!onlineRoom && (
                <div className="flex flex-col gap-2">
                  <button onClick={() => createOnlineGame()} className="bg-[#81b64c] hover:bg-[#95c562] py-4 rounded-lg font-bold text-xl shadow-[0_4px_0_rgb(69,101,40)] transition-transform active:translate-y-1">NOVA PARTIDA ONLINE</button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setGameMode(GameMode.AI); resetGameState(); }} className="bg-[#3c3a37] py-3 rounded-lg font-bold hover:bg-[#4a4844]">IA GRANDMASTER</button>
                    <button onClick={() => setShowRanking(true)} className="bg-[#3c3a37] py-3 rounded-lg font-bold hover:bg-[#4a4844]">COMUNIDADE</button>
                  </div>
                </div>
              )}
              {onlineRoom && <button onClick={() => window.location.assign(window.location.origin)} className="bg-[#3c3a37] py-3 rounded-lg font-bold hover:bg-red-900/40">ENCERRAR SESSÃO</button>}
            </div>
          </div>
        )}

        {currentView === 'puzzles' && <Puzzles />}
        {currentView === 'learn' && <Learn />}
        {currentView === 'dominoes' && <DominoGame currentUser={currentUser} />}

        {/* NOTIFICAÇÃO DE DESAFIO */}
        {incomingChallenge && (
          <div className="fixed top-6 right-6 z-[200] bg-[#262421] border-2 border-[#81b64c] p-6 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500 w-80">
            <div className="flex items-center gap-4 mb-4">
              <img src={incomingChallenge.from.avatar} className="w-12 h-12 rounded-lg" />
              <div>
                <div className="font-bold text-[#81b64c]">{incomingChallenge.from.name}</div>
                <div className="text-[10px] text-gray-500 uppercase font-bold">Te desafiou!</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { 
                setCurrentView('play'); 
                const roomId = incomingChallenge.roomId;
                setOnlineRoom(roomId); setGameMode(GameMode.ONLINE); setPlayerColor('b');
                db.ref(`rooms/${roomId}`).update({ playerB: currentUser, status: 'playing' });
                db.ref(`users/${currentUser.id}/invitations`).remove();
                setIncomingChallenge(null);
              }} className="flex-1 bg-[#81b64c] py-2 rounded font-bold">ACEITAR</button>
              <button onClick={() => { db.ref(`users/${currentUser.id}/invitations`).remove(); setIncomingChallenge(null); }} className="bg-[#3c3a37] px-4 py-2 rounded font-bold text-gray-400">RECUSAR</button>
            </div>
          </div>
        )}

        {/* MODAL RANKING */}
        {showRanking && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[120] p-4">
            <div className="bg-[#262421] p-8 rounded-2xl w-full max-w-xl border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#81b64c]">Ranking Global</h2>
                <button onClick={() => setShowRanking(false)} className="text-gray-400 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {leaderboard.map((u, idx) => (
                  <div key={u.id} className={`flex items-center justify-between p-4 rounded-xl transition-all ${u.id === currentUser.id ? 'bg-[#81b64c]/10 border border-[#81b64c]/30' : 'bg-[#1a1917] hover:bg-[#211f1c]'}`}>
                    <div className="flex items-center gap-4">
                      <span className={`w-6 text-center font-bold text-sm ${idx === 0 ? 'text-yellow-400' : 'text-gray-600'}`}>#{idx + 1}</span>
                      <div className="relative">
                          <img src={u.avatar} className="w-10 h-10 rounded-lg" />
                          {isPlayerOnline(u.lastSeen) && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#1a1917] rounded-full"></div>}
                      </div>
                      <div className="font-bold text-sm">{u.name}</div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-[#81b64c] text-xs">♟️ {u.elo || 0}</span>
                            <span className="font-mono font-bold text-blue-400 text-[10px]">🎲 {u.dominoElo || 0}</span>
                        </div>
                        {u.id !== currentUser.id && isPlayerOnline(u.lastSeen) && (
                            <button onClick={() => { setShowRanking(false); createOnlineGame(u.id); }} className="bg-[#81b64c] text-[10px] font-bold px-4 py-2 rounded shadow-lg active:scale-95">DESAFIAR</button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL FIM DE JOGO XADREZ */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[130] p-4">
            <div className="bg-[#262421] p-10 rounded-3xl text-center shadow-2xl max-w-sm w-full border border-white/10 scale-in-center">
              <div className="text-6xl mb-4">{showCelebration ? '👑' : '🏆'}</div>
              <h2 className="text-2xl font-bold mb-2">{showCelebration ? 'Vitória Brilhante!' : 'Fim da Batalha'}</h2>
              <p className="text-gray-400 mb-8">{gameOver}</p>
              <div className="flex flex-col gap-3">
                {gameMode === GameMode.ONLINE && !isSpectator && (
                  <button onClick={requestRematch} disabled={rematchStatus[playerColor === 'w' ? 'A' : 'B']} className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg ${rematchStatus[playerColor === 'w' ? 'A' : 'B'] ? 'bg-gray-700 text-gray-500' : 'bg-[#81b64c] text-white hover:brightness-110'}`}>
                    {rematchStatus[playerColor === 'w' ? 'A' : 'B'] ? 'AGUARDANDO OPONENTE...' : 'PEDIR REVANCHE'}
                  </button>
                )}
                <button onClick={() => window.location.assign(window.location.origin)} className="w-full bg-[#3c3a37] py-4 rounded-xl font-bold text-gray-300">VOLTAR AO MENU</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PERFIL */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[150] p-4">
            <div className="bg-[#262421] p-8 rounded-2xl w-full max-w-md border border-white/10">
              <h2 className="text-2xl font-bold mb-6">Configurar Identidade</h2>
              <div className="space-y-6">
                <input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-[#1a1917] border border-[#3c3a37] p-4 rounded-lg outline-none focus:border-[#81b64c] font-bold" />
                <div className="flex flex-col items-center gap-4">
                  <img src={currentUser.avatar} className="w-24 h-24 rounded-2xl border-2 border-[#81b64c]" />
                  <button onClick={() => setCurrentUser({...currentUser, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`})} className="bg-[#3c3a37] px-6 py-2 rounded-lg text-sm font-bold">GERAR NOVO AVATAR</button>
                </div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="w-full bg-[#81b64c] py-4 rounded-xl font-bold mt-8 shadow-lg">SALVAR MESTRE</button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3c3a37; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #81b64c; }
        @keyframes scale-in-center { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .scale-in-center { animation: scale-in-center 0.4s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
        @keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        .confetti-piece { position: absolute; top: -20px; animation: confetti-fall linear forwards; }
      `}</style>
    </div>
  );
};

export default App;
