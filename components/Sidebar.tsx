
import React from 'react';
import { User, AppView } from '../types';

interface SidebarProps {
  user: User;
  onProfileClick: () => void;
  onRankingClick: () => void;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onProfileClick, onRankingClick, currentView, onViewChange }) => {
  const menuItems: { icon: string, label: string, view: AppView }[] = [
    { icon: 'fa-chess-knight', label: 'Jogar', view: 'play' },
    { icon: 'fa-cubes-stacked', label: 'Dominó', view: 'dominoes' },
    { icon: 'fa-brain', label: 'Problemas', view: 'puzzles' },
    { icon: 'fa-book-open', label: 'Aprender', view: 'learn' },
  ];

  return (
    <>
      {/* Sidebar Desktop */}
      <div className="hidden md:flex flex-col w-20 lg:w-72 bg-[#262421] border-r border-white/5 h-screen sticky top-0 z-40 shadow-2xl">
        <div className="p-8 flex items-center justify-center lg:justify-start gap-3 mb-4">
          <div className="w-10 h-10 bg-[#81b64c] rounded-xl flex items-center justify-center shadow-lg shadow-[#81b64c]/20">
            <i className="fas fa-chess-queen text-white text-xl"></i>
          </div>
          <span className="hidden lg:block font-black text-2xl tracking-tighter uppercase italic">CHESS<span className="text-[#81b64c]">.PRO</span></span>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          {menuItems.map((item, idx) => (
            <button 
              key={idx} 
              onClick={() => onViewChange(item.view)}
              className={`w-full flex flex-col lg:flex-row items-center lg:gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group ${currentView === item.view ? 'bg-[#3c3a37] text-[#81b64c] shadow-lg border border-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <div className={`w-6 h-6 flex items-center justify-center transition-colors ${currentView === item.view ? 'text-[#81b64c]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                <i className={`fas ${item.icon} text-lg`}></i>
              </div>
              <span className={`hidden lg:block font-black text-xs uppercase tracking-widest ${currentView === item.view ? 'text-white' : 'text-gray-500'}`}>{item.label}</span>
            </button>
          ))}
          
          <div className="pt-4 mt-4 border-t border-white/5">
            <button 
              onClick={onRankingClick}
              className="w-full flex flex-col lg:flex-row items-center lg:gap-4 px-4 py-4 rounded-2xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all group"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="fas fa-trophy text-lg"></i>
              </div>
              <span className="hidden lg:block font-black text-xs uppercase tracking-widest">Ranking</span>
            </button>
          </div>
        </nav>

        <div 
          className="m-4 p-4 bg-[#1a1917] rounded-3xl border border-white/5 cursor-pointer hover:bg-[#211f1c] transition-all shadow-lg flex items-center gap-4"
          onClick={onProfileClick}
        >
          <div className="relative">
            <img src={user.avatar} className="w-12 h-12 rounded-2xl border border-white/10 shadow-inner bg-white/5" alt="user" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#81b64c] border-2 border-[#1a1917] rounded-full"></div>
          </div>
          <div className="hidden lg:block overflow-hidden">
            <div className="text-sm font-black truncate">{user.name}</div>
            <div className="text-[10px] text-[#81b64c] font-black flex items-center gap-1 mt-0.5">
              <i className="fas fa-medal"></i> ELO {user.elo}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#262421]/95 backdrop-blur-xl border-t border-white/5 z-[100] flex justify-around items-center px-4 pb-4">
        {menuItems.map((item, idx) => (
          <button 
            key={idx} 
            onClick={() => onViewChange(item.view)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all relative ${currentView === item.view ? 'text-[#81b64c]' : 'text-gray-500'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-all ${currentView === item.view ? 'bg-[#81b64c]/10' : ''}`}>
              <i className={`fas ${item.icon} text-xl`}></i>
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            {currentView === item.view && <div className="absolute -top-1 w-8 h-1 bg-[#81b64c] rounded-full shadow-[0_0_10px_#81b64c]"></div>}
          </button>
        ))}
        <button 
          onClick={onProfileClick}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-500 group"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1 group-active:bg-white/5 transition-all">
            <img src={user.avatar} className="w-7 h-7 rounded-lg border border-white/10" alt="me" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-tighter">Perfil</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;
