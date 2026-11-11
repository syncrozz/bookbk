import React, { useState, useEffect, useRef } from 'react';
import { LoginUserCard } from './LoginUserCard';
import { CloudSyncModal } from './CloudSyncModal';
import { StaffUser } from '../types';
import { getStoredActiveUser, clearActiveUser, subscribeToActiveUser } from '../utils/storage';
import { APP_VERSION_LABEL } from '../config/version';
import { subscribeToAppVersion, saveAppVersionToCloud } from '../lib/firebase';
import { 
  Menu,
  X,
  User,
  ChevronDown,
  Cloud,
  LogOut,
  Pencil,
  Check,
  Loader2
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
  activeTab, 
  setActiveTab, 
  pendingCount, 
  staffList, 
  isAdmin = false,
  onLogoutAdmin,
  onRequirePinChange
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredActiveUser());

  // Dynamic App Version (Firestore metadata/appVersion with fixed fallback)
  const [cloudVersion, setCloudVersion] = useState<string | null>(null);
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [editVersionInput, setEditVersionInput] = useState('');
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  const displayVersion = cloudVersion || APP_VERSION_LABEL;

  useEffect(() => {
    const unsubscribe = subscribeToAppVersion((label) => {
      setCloudVersion(label);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && isEditingVersion) {
      setIsEditingVersion(false);
      setVersionError(null);
    }
  }, [isAdmin, isEditingVersion]);

  const handleStartEditingVersion = () => {
    setEditVersionInput(displayVersion);
    setVersionError(null);
    setIsEditingVersion(true);
    setTimeout(() => {
      versionInputRef.current?.focus();
      versionInputRef.current?.select();
    }, 60);
  };

  const handleCancelEditingVersion = () => {
    setIsEditingVersion(false);
    setVersionError(null);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    let hour = getPart('hour');
    if (hour === '24') hour = '00';
    const minute = getPart('minute');
    setEditVersionInput(`v${day}.${month}.${hour}${minute}`);
    setVersionError(null);
  };

  const handleSaveVersion = async () => {
    let formatted = editVersionInput.trim();
    if (!formatted.startsWith('v') && !formatted.startsWith('V')) {
      formatted = 'v' + formatted;
    } else if (formatted.startsWith('V')) {
      formatted = 'v' + formatted.slice(1);
    }

    const isValid = /^v\d{2}\.\d{2}\.\d{4}$/.test(formatted);
    if (!isValid) {
      setVersionError('Format: v30.10.0855');
      return;
    }

    setIsSavingVersion(true);
    setVersionError(null);
    try {
      await saveAppVersionToCloud(formatted);
      setIsEditingVersion(false);
    } catch (err: any) {
      setVersionError(err?.message || 'Gagal menyimpan versi ke Cloud Firestore.');
    } finally {
      setIsSavingVersion(false);
    }
  };

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
  }, [userMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
        setShowCloudSyncModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Left: Brand Logo, Title & Dynamic Version Tag */}
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

            {/* Version Display & In-Place Admin Editor */}
            {!isEditingVersion ? (
              <div className="flex items-center">
                <span
                  id="header-version-tag"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-400 tracking-tight px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 select-none shadow-xs"
                  title={`Versi Platform: ${displayVersion}${isAdmin ? ' (Klik pensel untuk sunting)' : ''}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>{displayVersion}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditingVersion();
                      }}
                      className="ml-0.5 p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition cursor-pointer"
                      title="Sunting versi platform (Admin)"
                      aria-label="Sunting versi"
                    >
                      <Pencil className="w-3 h-3 text-slate-400 hover:text-white" />
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <div className="relative flex items-center z-50">
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-blue-500 shadow-lg shadow-black/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
                  <input
                    ref={versionInputRef}
                    type="text"
                    value={editVersionInput}
                    onChange={(e) => {
                      setEditVersionInput(e.target.value);
                      if (versionError) setVersionError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveVersion();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEditingVersion();
                      }
                    }}
                    disabled={isSavingVersion}
                    className="w-24 bg-slate-900 text-white font-mono text-[11px] px-1 py-0.5 rounded border border-slate-700 focus:outline-none focus:border-blue-400 tabular-nums"
                    placeholder="v30.10.0855"
                  />
                  <button
                    type="button"
                    onClick={handleSaveVersion}
                    disabled={isSavingVersion}
                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 cursor-pointer"
                    title="Simpan Versi (Enter)"
                    aria-label="Simpan"
                  >
                    {isSavingVersion ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditingVersion}
                    disabled={isSavingVersion}
                    className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
                    title="Batal (Esc)"
                    aria-label="Batal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSetCurrentTime}
                    disabled={isSavingVersion}
                    className="hidden xs:inline-block sm:inline-block px-1.5 py-0.5 rounded bg-blue-900/70 hover:bg-blue-800 text-blue-200 text-[10px] border border-blue-700/50 transition cursor-pointer shrink-0 font-sans"
                    title="Gunakan masa sekarang (Asia/Kuala_Lumpur)"
                  >
                    Guna masa sekarang
                  </button>
                </div>
                {versionError && (
                  <div className="absolute top-full left-0 mt-1 px-2 py-0.5 bg-rose-950 border border-rose-600 text-rose-200 text-[10px] rounded shadow-md whitespace-nowrap z-50">
                    {versionError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigasi bahagian atas dipadamkan kerana fungsi navigasi telah disediakan oleh QuickNavGrid di bahagian bawah */}

          {/* 3. Right: Admin Access (Distinct Amber Style) & Profile Card / Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Cloud Sync Live Status Indicator (Disembunyikan dari paparan atas permintaan pengguna, fungsi kekal aktif di latar belakang) */}
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

            {/* Butang Admin Access telah dipadamkan daripada bar pengepala utama mengikut permintaan, fungsi kawalan pentadbir kekal aktif sepenuhnya */}

            {/* Single Primary Logout Button when staff is active (Navigation Header) */}
            {currentUser && (
              <button
                id="btn-header-quick-logout"
                onClick={() => {
                  clearActiveUser();
                  setCurrentUser(null);
                  setUserMenuOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-950/40 transition cursor-pointer"
                title={`Log keluar daripada ${currentUser.applicantName} (kembali ke default view)`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Keluar</span>
              </button>
            )}

            {/* Profile Dropdown Toggle */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`group px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-md ${
                  currentUser
                    ? 'bg-gradient-to-r from-blue-900/80 via-indigo-900/70 to-slate-900 border-blue-500/50 hover:border-blue-400 text-white shadow-blue-950/40 ring-1 ring-blue-500/30 hover:ring-blue-400/60'
                    : 'bg-gradient-to-r from-slate-800 via-slate-800 to-blue-950/80 hover:from-slate-700 hover:to-blue-900 text-slate-100 border-blue-500/40 hover:border-blue-400 shadow-slate-950/40 ring-1 ring-blue-500/20 hover:ring-blue-400/50'
                } ${userMenuOpen ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
                title={currentUser ? `Akaun Staf: ${currentUser.applicantName}` : "Tetapan & Log Masuk Akaun Staf"}
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/90">
                    {currentUser ? 'Staf Aktif' : 'Akaun Staf'}
                  </span>
                  <span className="text-xs font-extrabold text-white max-w-[130px] sm:max-w-[150px] truncate">
                    {currentUser ? currentUser.applicantName : 'Log Masuk'}
                  </span>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-blue-300/80 transition-transform duration-200 ml-0.5 ${userMenuOpen ? 'rotate-180 text-blue-200' : 'group-hover:translate-y-0.5'}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Akaun Staf Pengguna</span>
                    <button onClick={() => setUserMenuOpen(false)} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <LoginUserCard 
                    staffList={staffList} 
                    compact={true} 
                    onProfileChange={() => {
                      setCurrentUser(getStoredActiveUser());
                      setUserMenuOpen(false);
                    }} 
                    isAdmin={isAdmin}
                    onRequirePinChange={onRequirePinChange}
                  />
                </div>
              )}
            </div>

            {/* Mobile Nav Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              aria-label="Buka Menu Navigasi"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer / Staff Account */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Akaun Staf Pengguna</span>
            <button 
              onClick={() => setMobileMenuOpen(false)} 
              className="text-slate-400 hover:text-white p-1"
              aria-label="Tutup menu akaun"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <LoginUserCard 
              staffList={staffList} 
              compact={true} 
              onProfileChange={() => {
                setCurrentUser(getStoredActiveUser());
                setMobileMenuOpen(false);
              }} 
              isAdmin={isAdmin}
              onRequirePinChange={onRequirePinChange}
            />
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

