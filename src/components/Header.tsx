import React, { useState, useEffect } from 'react';
import { LoginUserCard } from './LoginUserCard';
import { CloudSyncModal } from './CloudSyncModal';
import { StaffUser } from '../types';
import { getStoredActiveUser, clearActiveUser, subscribeToActiveUser } from '../utils/storage';
import { 
  X,
  User,
  ChevronDown,
  Cloud,
  LogOut,
  Lock,
  UserCheck
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'matrix' | 'academic' | 'mybookings' | 'directory' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount: number;
  staffList?: StaffUser[];
  isAdmin?: boolean;
  onLogoutAdmin?: () => void;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab: _activeTab, 
  setActiveTab, 
  pendingCount: _pendingCount, 
  staffList, 
  isAdmin = false,
  onLogoutAdmin: _onLogoutAdmin,
  onRequirePinChange
}) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredActiveUser());

  useEffect(() => {
    // Pastikan sebarang rekod caption lama dipadamkan dari simpanan tempatan
    try {
      localStorage.removeItem('kpmbp_header_caption');
    } catch {}
  }, []);

  useEffect(() => {
    const handleSync = () => {
      setCurrentUser(getStoredActiveUser());
    };
    handleSync();
    const unsubscribe = subscribeToActiveUser((user) => {
      setCurrentUser(user);
    });
    return () => {
      unsubscribe();
    };
  }, [isLoginModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLoginModalOpen(false);
        setShowCloudSyncModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsLoginModalOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Left: Brand Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => handleTabClick('matrix')}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all text-left bg-transparent border-0 p-0"
              title="Papar Kalendar Ketersediaan Ruang (Calendar)"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-slate-800 border border-slate-700/80 shadow-md shadow-blue-900/30 shrink-0">
                <img
                  src="https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/BookBK/icon-192x192.png"
                  alt="Logo BookBK KPMBP"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div className="flex items-center gap-2 leading-tight">
                <span className="font-bold text-base tracking-tight">
                  <span className="text-white">Book</span>
                  <span className="text-blue-400">BK</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-slate-800 text-blue-300 rounded border border-slate-700">
                  KPMBP
                </span>
              </div>
            </button>
          </div>

          {/* Navigasi bahagian atas dipadamkan kerana fungsi navigasi telah disediakan oleh QuickNavGrid di bahagian bawah */}

          {/* 3. Right: Admin Access & Profile Card / Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Cloud Sync Live Status Indicator */}
            <button
              onClick={() => setShowCloudSyncModal(true)}
              className="hidden items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
              title="Status Firebase Cloud Sync (Penyegerakan Real-time Pelbagai Peranti)"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Cloud Sync</span>
            </button>

            {/* Single Primary Logout Button when staff is active (Navigation Header) */}
            {currentUser && (
              <button
                id="btn-header-quick-logout"
                onClick={() => {
                  clearActiveUser();
                  setCurrentUser(null);
                  setIsLoginModalOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-950/40 transition cursor-pointer"
                title={`Log keluar daripada ${currentUser.applicantName} (kembali ke default view)`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Log Keluar</span>
              </button>
            )}

            {/* Profile / Floating Login Modal Trigger Button (Responsive for Desktop & Mobile) */}
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className={`group px-2.5 sm:px-3 py-1.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-md ${
                currentUser
                  ? 'bg-gradient-to-r from-blue-900/80 via-indigo-900/70 to-slate-900 border-blue-500/50 hover:border-blue-400 text-white shadow-blue-950/40 ring-1 ring-blue-500/30 hover:ring-blue-400/60'
                  : 'bg-gradient-to-r from-slate-800 via-slate-800 to-blue-950/80 hover:from-slate-700 hover:to-blue-900 text-slate-100 border-blue-500/40 hover:border-blue-400 shadow-slate-950/40 ring-1 ring-blue-500/20 hover:ring-blue-400/50'
              } ${isLoginModalOpen ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
              title={currentUser ? `Akaun Staf: ${currentUser.applicantName}` : "Log Masuk Akaun Staf"}
            >
              <div className="relative flex items-center justify-center">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                  currentUser 
                    ? 'bg-blue-600 text-white border-blue-400 shadow-xs' 
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/40 group-hover:bg-blue-500/30'
                }`}>
                  <User className="w-3.5 h-3.5" />
                </div>
                {currentUser && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                )}
              </div>

              <div className="flex flex-col text-left leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/90 hidden xs:inline-block">
                  {currentUser ? 'Staf Aktif' : 'Akaun Staf'}
                </span>
                <span className="text-xs font-extrabold text-white max-w-[105px] sm:max-w-[150px] truncate">
                  {currentUser ? currentUser.applicantName : 'Log Masuk'}
                </span>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-blue-300/80 transition-transform duration-200 ml-0.5 ${isLoginModalOpen ? 'rotate-180 text-blue-200' : 'group-hover:translate-y-0.5'}`} />
            </button>
          </div>

        </div>
      </div>

      {/* Floating Login Modal (Centered in Screen with Backdrop Overlay - No Layout Shift) */}
      {isLoginModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="floating-login-modal-title"
        >
          {/* Backdrop Dismiss Area */}
          <div 
            className="fixed inset-0"
            onClick={() => setIsLoginModalOpen(false)}
            aria-hidden="true"
          />

          {/* Centered Modal Card with Blue Border and Dark Navy Theme */}
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-blue-500/40 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-10 animate-in zoom-in-95 duration-200 ring-1 ring-blue-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header: Ikon Lock, Tajuk "Login" sahaja, dan Butang Tutup (X) */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  {currentUser ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-blue-400" />}
                </div>
                <h3 id="floating-login-modal-title" className="text-base font-extrabold text-white leading-tight">
                  {currentUser ? 'Akaun Staf' : 'Login'}
                </h3>
              </div>

              {/* Single Close Button */}
              <button 
                type="button"
                onClick={() => setIsLoginModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Tutup (Esc)"
                aria-label="Tutup modal login"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-0">
              <LoginUserCard 
                staffList={staffList} 
                compact={true} 
                onProfileChange={() => {
                  setCurrentUser(getStoredActiveUser());
                  setTimeout(() => {
                    setIsLoginModalOpen(false);
                  }, 500);
                }} 
                isAdmin={isAdmin}
                onRequirePinChange={(st) => {
                  setIsLoginModalOpen(false);
                  if (onRequirePinChange) onRequirePinChange(st);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cloud Sync Status & Multi-Device Details Modal */}
      <CloudSyncModal 
        isOpen={showCloudSyncModal} 
        onClose={() => setShowCloudSyncModal(false)} 
      />
    </header>
  );
};

