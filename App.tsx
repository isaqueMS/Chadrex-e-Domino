
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChessBoard from './components/ChessBoard';
import GameControls from './components/GameControls';
import Puzzles from './components/Puzzles';
import Learn from './components/Learn';
import DominoGame from './components/DominoGame';
import { Board, Move, Color, GameMode, User, AppView, UserSettings } from './types';
import { createInitialBoard, makeMove, getGameState } from './services/chessLogic';
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
    if (params.has('puzzles')) return 'puzzles';
    if (params.has('learn')) return 'learn';
    return 'play';
  });
  
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('chess_profile_v12');
    if (saved) return JSON.parse(saved);
    const newId = `u_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: newId,
      name: `Mestre_${Math.random().toString(36).substr(2, 4)}`,
      elo: 1200,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`,
      settings: { chessTheme: 'green', dominoTheme: 'dark' }
    };
  });

  const boardRef = useRef<Board>(createInitialBoard());
  const historyRef = useRef<Move[]>([]);
  const [board, setBoard] = useState<Board>(boardRef.current);
  const [turn, setTurn] = useState<Color>('w');
  const [history, setHistory] = useState<Move[]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.LOCAL);
  const [playerColor, setPlayerColor] = useState<Color>('w');
  const [opponent, setOpponent] = useState<User | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Profile Form State
  const [editName, setEditName] = useState(currentUser.name);
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [editChessTheme, setEditChessTheme] = useState<UserSettings['chessTheme']>(currentUser.settings?.chessTheme || 'green');

  // Chess Online Room Listener
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = onlineRoom || params.get('room');
    
    if (roomId && currentView === 'play') {
      const roomRef = db.ref(`chess_rooms/${roomId}`);
      
      const onValue = (snap: any) => {
        const val = snap.val();
        if (val) {
          if (val.board) {
            boardRef.current = val.board;
            setBoard([...val.board]);
          }
          if (val.turn) setTurn(val.turn);
          if (val.history) {
            historyRef.current = val.history;
            setHistory([...val.history]);
          }
          if (val.gameOver) setGameOver(val.gameOver);
          
          const players = val.players || {};
          const playerIds = Object.keys(players);
          const otherId = playerIds.find(id => id !== currentUser.id);
          if (otherId) setOpponent(players[otherId]);
          
          if (!val.creatorId) roomRef.update({ creatorId: currentUser.id });
          setPlayerColor(val.creatorId === currentUser.id ? 'w' : 'b');
          setGameMode(GameMode.ONLINE);
          setOnlineRoom(roomId);
        }
      };

      roomRef.on('value', onValue);
      roomRef.child('players').child(currentUser.id).set(currentUser);

      return () => roomRef.off('value', onValue);
    }
  }, [onlineRoom, currentUser, currentView]);

  const applyMove = useCallback((move: Move) => {
    try {
      const newBoard = makeMove(boardRef.current, move);
      boardRef.current = newBoard;
      const newHistory = [...historyRef.current, move];
      historyRef.current = newHistory;
      
      const nextTurn = move.piece.color === 'w' ? 'b' : 'w';
      const state = getGameState(newBoard, nextTurn);
      let endMsg = null;

      if (state === 'checkmate') {
        endMsg = `Xeque-mate! Vitória das ${move.piece.color === 'w' ? 'Brancas' : 'Pretas'}`;
      } else if (state === 'stalemate') {
        endMsg = 'Empate por afogamento.';
      }

      if (gameMode === GameMode.ONLINE && onlineRoom) {
        db.ref(`chess_rooms/${onlineRoom}`).update({
          board: newBoard,
          turn: nextTurn,
          history: newHistory,
          gameOver: endMsg
        });
      } else {
        setBoard([...newBoard]);
        setHistory(newHistory);
        setTurn(nextTurn);
        if (endMsg) setGameOver(endMsg);
      }

      if (endMsg && move.piece.color === playerColor) setShowCelebration(true);
      return true;
    } catch (e) { 
      console.error("Move application error", e);
      return false; 
    }
  }, [gameMode, onlineRoom, playerColor]);

  const handleMove = useCallback((move: Move) => {
    if (gameOver) return;
    if (gameMode === GameMode.ONLINE && turn !== playerColor) return;
    applyMove(move);
  }, [gameOver, applyMove, gameMode, turn, playerColor]);

  const createOnlineRoom = () => {
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    window.history.replaceState(null, '', url);
    setOnlineRoom(id);
    setGameMode(GameMode.ONLINE);
    db.ref(`chess_rooms/${id}`).set({
      creatorId: currentUser.id,
      board: createInitialBoard(),
      turn: 'w',
      history: [],
      players: { [currentUser.id]: currentUser }
    });
  };

  const resetGame = () => {
    boardRef.current = createInitialBoard();
    historyRef.current = [];
    setBoard([...boardRef.current]);
    setHistory([]);
    setTurn('w');
    setGameOver(null);
    setGameMode(GameMode.LOCAL);
    setOnlineRoom(null);
    setOpponent(null);
    setShowCelebration(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const saveProfileChanges = () => {
    const newUser = { 
      ...currentUser, 
      name: editName, 
      avatar: editAvatar,
      settings: {
        ...currentUser.settings,
        chessTheme: editChessTheme
      }
    };
    setCurrentUser(newUser);
    localStorage.setItem('chess_profile_v12', JSON.stringify(newUser));
    setShowProfileModal(false);
  };

  const generateNewAvatar = () => {
    const newSeed = Math.random().toString(36).substr(2, 7);
    setEditAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#312e2b] text-white overflow-hidden">
      <Sidebar 
        user={currentUser} 
        onProfileClick={() => { 
          setEditName(currentUser.name); 
          setEditAvatar(currentUser.avatar); 
          setEditChessTheme(currentUser.settings?.chessTheme || 'green');
          setShowProfileModal(true); 
        }} 
        onRankingClick={() => {}} 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      {showCelebration && <Confetti />}
      
      <main className="flex-1 flex flex-col items-center overflow-y-auto pt-4 md:pt-8 px-4 custom-scrollbar">
        {currentView === 'play' && (
          <div className="flex flex-col lg:flex-row gap-8 w-full max-w-[1200px] items-start pb-24 md:pb-12">
            <div className="flex-1 w-full max-w-[640px] flex flex-col gap-4">
              {/* Opponent UI */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#262421] rounded-xl border border-white/5 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 bg-[#3c3a37] rounded-lg overflow-hidden border border-white/10 ring-2 ring-transparent">
                    {opponent ? <img src={opponent.avatar} className="w-full h-full object-cover" alt="opponent" /> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-user text-gray-500"></i></div>}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-bold text-base truncate max-w-[150px]">{opponent?.name || (gameMode === GameMode.ONLINE ? 'Aguardando oponente...' : 'Treinamento Local')}</h3>
                    <div className="text-[10px] font-black uppercase tracking-tighter text-gray-500">
                      {`ELO ${opponent?.elo || '?'}`}
                    </div>
                  </div>
                </div>
                <div className={`px-5 py-2 rounded-lg font-mono text-2xl font-bold transition-colors ${turn !== playerColor && !gameOver ? 'bg-[#81b64c] text-white shadow-[0_0_15px_rgba(129,182,76,0.3)]' : 'bg-[#1a1917] text-gray-500'}`}>10:00</div>
              </div>

              {/* Board Stage */}
              <div className="relative p-1 bg-[#262421] rounded-md shadow-2xl border border-white/5">
                <ChessBoard 
                  board={board} 
                  onMove={handleMove} 
                  turn={turn} 
                  isFlipped={playerColor==='b'} 
                  lastMove={history.length>0?history[history.length-1]:null} 
                  gameOver={!!gameOver} 
                  settings={currentUser.settings} 
                />
                
                {gameOver && (
                  <div className="absolute inset-0 z-50 bg-[#1a1917]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300">
                    <h2 className="text-4xl md:text-5xl font-black mb-4 text-[#81b64c] tracking-tighter uppercase italic drop-shadow-lg">Fim de Jogo</h2>
                    <p className="text-lg md:text-xl mb-10 font-medium text-gray-300 max-w-sm">{gameOver}</p>
                    <button onClick={resetGame} className="bg-[#81b64c] hover:bg-[#95c65d] px-12 md:px-16 py-4 md:py-5 rounded-xl font-black text-lg md:text-xl shadow-[0_6px_0_#456528] active:translate-y-1">NOVA PARTIDA</button>
                  </div>
                )}
              </div>

              {/* Player UI */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#262421] rounded-xl border border-white/5 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#81b64c]/10 rounded-lg overflow-hidden border border-[#81b64c]/30">
                    <img src={currentUser.avatar} className="w-full h-full object-cover" alt="me" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{currentUser.name}</h3>
                    <div className="text-[10px] font-black uppercase text-[#81b64c]">ELO {currentUser.elo}</div>
                  </div>
                </div>
                <div className={`px-5 py-2 rounded-lg font-mono text-2xl font-bold transition-colors ${turn === playerColor && !gameOver ? 'bg-[#81b64c] text-white shadow-[0_0_15px_rgba(129,182,76,0.3)]' : 'bg-[#1a1917] text-gray-500'}`}>10:00</div>
              </div>
            </div>
            
            <div className="w-full lg:w-[420px] sticky top-8">
              <GameControls 
                history={history} 
                onUndo={resetGame} 
                onResign={() => setGameOver('Partida abandonada.')} 
                turn={turn} 
                whiteTimer={600} 
                blackTimer={600} 
                gameMode={gameMode} 
                onlineRoom={onlineRoom}
                onCreateOnline={createOnlineRoom}
              />
            </div>
          </div>
        )}
        
        {currentView === 'puzzles' && <Puzzles />}
        {currentView === 'learn' && <Learn />}
        {currentView === 'dominoes' && <DominoGame currentUser={currentUser} />}
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-[#262421] w-full max-w-md rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl my-8">
            <div className="h-32 bg-gradient-to-r from-[#81b64c] to-[#779556] relative">
              <div className="absolute -bottom-10 left-8 flex items-end gap-4">
                <img src={editAvatar} className="w-24 h-24 rounded-3xl bg-[#262421] p-1 border border-white/10 shadow-xl" alt="preview" />
                <button onClick={generateNewAvatar} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white backdrop-blur-md mb-2 transition-colors">
                  <i className="fas fa-random"></i>
                </button>
              </div>
            </div>
            <div className="pt-16 px-8 pb-10 space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Seu Nickname</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#1a1917] border border-white/5 rounded-2xl px-5 py-4 outline-none focus:ring-1 focus:ring-[#81b64c] transition-all font-bold text-white shadow-inner"
                  placeholder="Nickname"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 mb-4 block tracking-widest">Tema do Tabuleiro</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['green', 'wood', 'blue', 'gray'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setEditChessTheme(theme)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${editChessTheme === theme ? 'bg-[#81b64c]/10 border-[#81b64c]' : 'bg-[#1a1917] border-white/5 hover:bg-white/5'}`}
                    >
                      <div className={`w-8 h-8 rounded-md shadow-inner ${
                        theme === 'green' ? 'bg-[#779556]' : 
                        theme === 'wood' ? 'bg-[#966f33]' : 
                        theme === 'blue' ? 'bg-[#8ca2ad]' : 'bg-[#a0a0a0]'
                      }`}></div>
                      <span className="text-[10px] font-black uppercase tracking-wider">{theme === 'green' ? 'Verde' : theme === 'wood' ? 'Madeira' : theme === 'blue' ? 'Azul' : 'Cinza'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={saveProfileChanges} className="flex-1 bg-[#81b64c] hover:bg-[#95c65d] py-4 rounded-2xl font-black text-sm uppercase shadow-lg transition-all active:scale-95">Salvar</button>
                <button onClick={() => setShowProfileModal(false)} className="px-8 bg-[#3c3a37] hover:bg-[#4a4844] py-4 rounded-2xl font-black text-sm uppercase transition-colors">Sair</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
