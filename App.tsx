
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChessBoard from './components/ChessBoard';
import GameControls from './components/GameControls';
import Puzzles from './components/Puzzles';
import Learn from './components/Learn';
import DominoGame from './components/DominoGame';
import { Board, Move, Color, GameMode, User, AppView, UserSettings } from './types';
import { createInitialBoard, makeMove, getGameState, getBestMove } from './services/chessLogic';
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
    return params.has('domino') ? 'dominoes' : 'play';
  });
  
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('chess_profile_v5');
    if (saved) return JSON.parse(saved);
    const newId = `u_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: newId,
      name: `Mestre_${Math.random().toString(36).substr(2, 4)}`,
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
  const [isWaiting, setIsWaiting] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [opponent, setOpponent] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<{from: User, roomId: string} | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const lastProcessedTs = useRef<number>(0);

  useEffect(() => {
    const updateProfile = () => {
      const updatedUser = { ...currentUser, lastSeen: Date.now() };
      localStorage.setItem('chess_profile_v5', JSON.stringify(updatedUser));
      db.ref(`users/${currentUser.id}`).update(updatedUser);
    };
    updateProfile();
    const heartbeat = setInterval(updateProfile, 30000);
    const challengesRef = db.ref(`users/${currentUser.id}/invitations`);
    challengesRef.on('child_added', snap => { const inv = snap.val(); if (inv && Date.now() - inv.timestamp < 60000) setIncomingChallenge(inv); });
    const playersRef = db.ref('users').orderByChild('elo');
    playersRef.on('value', snap => { const val = snap.val(); if (val) setLeaderboard((Object.values(val) as User[]).sort((a,b) => (b.elo||0)-(a.elo||0))); });
    return () => { clearInterval(heartbeat); challengesRef.off(); playersRef.off(); };
  }, [currentUser]);

  useEffect(() => {
    if (currentView !== 'play' || gameOver || isWaiting || isSpectator || (gameMode === GameMode.ONLINE && !opponent)) return;
    const interval = setInterval(() => {
      setTimers(prev => {
        if (prev[turn] <= 0) {
          const winner = turn === 'w' ? 'Pretas' : 'Brancas';
          setGameOver(`Tempo esgotado! Vitória das ${winner}`);
          if (turn !== playerColor) setShowCelebration(true);
          return prev;
        }
        return { ...prev, [turn]: prev[turn] - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, gameOver, isWaiting, gameMode, opponent, isSpectator, playerColor, currentView]);

  const applyMove = useCallback((move: Move) => {
    try {
      const newBoard = makeMove(boardRef.current, move);
      boardRef.current = newBoard;
      historyRef.current.push(move);
      setBoard([...newBoard]);
      setHistory([...historyRef.current]);
      setTurn(move.piece.color === 'w' ? 'b' : 'w');
      const state = getGameState(newBoard, move.piece.color === 'w' ? 'b' : 'w');
      if (state === 'checkmate') { setGameOver(`Xeque-mate! Vitória das ${move.piece.color === 'w' ? 'Brancas' : 'Pretas'}`); if (move.piece.color === playerColor) setShowCelebration(true); }
      else if (state === 'stalemate') setGameOver('Empate por afogamento.');
      return true;
    } catch (e) { return false; }
  }, [playerColor]);

  const handleMove = (move: Move) => {
    if (gameOver || isSpectator) return;
    if (gameMode === GameMode.ONLINE) {
      if (turn !== playerColor || !onlineRoom) return;
      const ts = Date.now();
      lastProcessedTs.current = ts;
      if (applyMove(move)) db.ref(`rooms/${onlineRoom}/moves`).push({ move, playerId: currentUser.id, timestamp: ts });
    } else applyMove(move);
  };

  const updateSettings = (updates: Partial<UserSettings>) => {
    const updated = { ...currentUser, settings: { ...currentUser.settings!, ...updates } };
    setCurrentUser(updated);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#312e2b] text-white overflow-hidden">
      <Sidebar user={currentUser} onProfileClick={() => setShowProfileModal(true)} onRankingClick={() => setShowRanking(true)} currentView={currentView} onViewChange={setCurrentView} />
      {showCelebration && <Confetti />}
      
      <main className="flex-1 flex flex-col items-center overflow-y-auto pt-2 sm:pt-4 px-2 custom-scrollbar">
        {currentView === 'play' && (
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-6xl items-center lg:items-start pb-24 md:pb-6">
            <div className="w-full max-w-[600px] flex flex-col gap-2 relative">
              {/* Opponent Info */}
              <div className="flex justify-between items-center px-3 py-1.5 bg-[#262421]/50 rounded border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#3c3a37] rounded overflow-hidden flex items-center justify-center relative">{opponent ? <img src={opponent.avatar} className="w-full h-full" /> : <i className="fas fa-robot text-gray-400 text-xs"></i>}</div>
                  <div><div className="font-bold text-[11px] sm:text-sm">{opponent?.name || 'Stockfish'}</div><div className="text-[8px] text-gray-500 font-bold uppercase leading-none">ELO {opponent?.elo || 1200}</div></div>
                </div>
                <div className={`px-3 py-1 rounded font-mono text-sm sm:text-lg ${turn !== playerColor && !gameOver ? 'bg-white text-black font-bold' : 'bg-[#211f1c] text-gray-500'}`}>{Math.floor(timers[playerColor==='w'?'b':'w']/60)}:{(timers[playerColor==='w'?'b':'w']%60).toString().padStart(2,'0')}</div>
              </div>
              
              <ChessBoard board={board} onMove={handleMove} turn={turn} isFlipped={playerColor==='b'} lastMove={history.length>0?history[history.length-1]:null} gameOver={!!gameOver} settings={currentUser.settings} />
              
              {/* User Info */}
              <div className="flex justify-between items-center px-3 py-1.5 bg-[#262421]/50 rounded border border-white/5">
                <div className="flex items-center gap-2"><img src={currentUser.avatar} className="w-8 h-8 rounded border border-white/10" /><div><div className="font-bold text-[11px] sm:text-sm">{currentUser.name} <span className="text-[8px] text-[#81b64c] ml-1 font-black">VOCÊ</span></div><div className="text-[8px] text-[#81b64c] font-bold uppercase leading-none">ELO {currentUser.elo}</div></div></div>
                <div className={`px-3 py-1 rounded font-mono text-sm sm:text-lg ${turn === playerColor && !gameOver ? 'bg-white text-black font-bold' : 'bg-[#211f1c] text-gray-500'}`}>{Math.floor(timers[playerColor]/60)}:{(timers[playerColor]%60).toString().padStart(2,'0')}</div>
              </div>
            </div>
            
            {/* Game Controls - No mobile ele fica embaixo do tabuleiro */}
            <div className="w-full lg:w-[380px] h-[400px] lg:h-[520px]">
              <GameControls history={history} onUndo={() => {if(gameMode!==GameMode.ONLINE) { boardRef.current=createInitialBoard(); setBoard(boardRef.current); setHistory([]); setTurn('w'); setGameOver(null); }}} onResign={() => setGameOver('Abandonou.')} turn={turn} whiteTimer={timers.w} blackTimer={timers.b} gameMode={gameMode} messages={messages} onlineRoom={onlineRoom} onSendMessage={t => {if(onlineRoom) db.ref(`rooms/${onlineRoom}/chat`).push({user: currentUser.name, text: t, timestamp: Date.now()})}} />
            </div>
          </div>
        )}
        
        {currentView === 'puzzles' && <div className="pb-24 md:pb-6 w-full max-w-6xl"><Puzzles /></div>}
        {currentView === 'learn' && <div className="pb-24 md:pb-6 w-full max-w-6xl"><Learn /></div>}
        {currentView === 'dominoes' && <DominoGame currentUser={currentUser} />}

        {/* Modal Perfil Responsivo */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-[#262421] p-6 sm:p-8 rounded-none sm:rounded-3xl h-full sm:h-auto w-full max-w-2xl border border-white/10 shadow-2xl overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6 sm:mb-8"><h2 className="text-xl sm:text-3xl font-black italic tracking-tighter text-[#81b64c]">PERFIL E TEMAS</h2><button onClick={() => setShowProfileModal(false)} className="text-gray-500 hover:text-white"><i className="fas fa-times text-xl"></i></button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                <div className="space-y-6">
                    <div className="flex flex-col items-center gap-4 bg-[#1a1917] p-6 rounded-2xl border border-white/5"><img src={currentUser.avatar} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-[#81b64c] shadow-2xl" /><button onClick={() => setCurrentUser({...currentUser, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`})} className="bg-[#3c3a37] px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4a4844]">Mudar Avatar</button></div>
                    <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Nickname</label><input value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-[#1a1917] border border-white/5 p-3 rounded-xl outline-none focus:border-[#81b64c] font-bold text-sm" /></div>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-[#81b64c] tracking-[0.2em] block mb-3">Tema Xadrez</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['green', 'wood', 'blue', 'gray'].map(t => (
                                <button key={t} onClick={() => updateSettings({ chessTheme: t as any })} className={`py-2 px-3 rounded-xl border transition-all capitalize text-[10px] font-black ${currentUser.settings?.chessTheme === t ? 'border-[#81b64c] bg-[#81b64c]/10 text-[#81b64c]' : 'border-white/5 bg-[#1a1917] text-gray-500'}`}>{t}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-[#81b64c] tracking-[0.2em] block mb-3">Mesa Dominó</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['felt', 'wood', 'dark', 'blue'].map(t => (
                                <button key={t} onClick={() => updateSettings({ dominoTheme: t as any })} className={`py-2 px-3 rounded-xl border transition-all capitalize text-[10px] font-black ${currentUser.settings?.dominoTheme === t ? 'border-[#81b64c] bg-[#81b64c]/10 text-[#81b64c]' : 'border-white/5 bg-[#1a1917] text-gray-500'}`}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="w-full bg-[#81b64c] py-4 rounded-xl font-black text-lg mt-8 shadow-lg active:scale-95 transition-all">SALVAR TUDO</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
