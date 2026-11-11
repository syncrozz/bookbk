import React, { useState, useEffect } from 'react';
import { 
  getStoredActiveUser, 
  saveActiveUser, 
  clearActiveUser,
  subscribeToActiveUser,
  UserProfileHistory 
} from '../utils/storage';
import { StaffUser } from '../types';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { matchStaffByEmail } from '../utils/staff-matcher';
import { verifyStaffCredentials, setStaffSessionPin, getStaffSessionPin } from '../lib/firebase';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  LogIn, 
  LogOut,
  CheckCircle2, 
  UserCheck, 
  Mail, 
  ShieldCheck, 
  KeyRound, 
  AlertTriangle,
  Lock,
  ExternalLink
} from 'lucide-react';

interface LoginUserCardProps {
  onProfileChange?: (profile: UserProfileHistory | null) => void;
  staffList?: StaffUser[];
  compact?: boolean;
  isAdmin?: boolean;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const LoginUserCard: React.FC<LoginUserCardProps> = ({ 
  onProfileChange, 
  staffList = INITIAL_STAFF_DATA,
  compact = false,
  isAdmin = false,
  onRequirePinChange
}) => {
  const initialUser = getStoredActiveUser();
  const [activeUser, setActiveUser] = useState<UserProfileHistory | null>(initialUser);
  const [isEditing, setIsEditing] = useState<boolean>(!initialUser);

  // Verification Form states
  const [emailInput, setEmailInput] = useState<string>(initialUser?.applicantEmail || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredActiveUser();
    setActiveUser(user);
    if (user?.applicantEmail) {
      setEmailInput(user.applicantEmail);
    } else {
      setIsEditing(true);
    }

    const unsubscribe = subscribeToActiveUser((latestUser) => {
      setActiveUser(latestUser);
      if (latestUser?.applicantEmail) {
        setEmailInput(latestUser.applicantEmail);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let cleanEmail = emailInput.trim().toLowerCase();
    const cleanPin = pinInput.trim().replace(/\D/g, '').slice(0, 4);

    if (!cleanEmail) {
      setErrorMsg('Sila masukkan e-mel staf berdaftar.');
      return;
    }

    if (!cleanPin || cleanPin.length !== 4) {
      setErrorMsg('Sila masukkan 4 digit PIN keselamatan.');
      return;
    }

    // Verify that the email is registered in staff sources / CSV
    const preMatch = matchStaffByEmail(cleanEmail, staffList);
    if (!preMatch) {
      setErrorMsg('E-mel ini tidak didaftarkan dalam senarai staf sumber CSV.');
      return;
    }

    const result = await verifyStaffCredentials(cleanEmail, cleanPin, staffList);

    if (!result.success || !result.staff) {
      setErrorMsg(result.errorMsg || 'Email atau PIN tidak sah.');
      return;
    }

    const matchedStaff = result.staff;

    // Check mandatory PIN change if still using default PIN 1234
    if (matchedStaff.pinStatus === 'DEFAULT') {
      if (onRequirePinChange) {
        onRequirePinChange(matchedStaff);
      }
      return;
    }

    const updatedProfile: UserProfileHistory = {
      staffId: matchedStaff.id,
      applicantName: matchedStaff.name,
      applicantEmail: matchedStaff.email,
      applicantRole: matchedStaff.role,
      department: matchedStaff.department,
      applicantPhone: matchedStaff.phone,
      lastUsedAt: new Date().toISOString(),
      pinStatus: matchedStaff.pinStatus
    };

    saveActiveUser(updatedProfile);
    setStaffSessionPin(matchedStaff.id, pinInput);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('kpmbp_active_user_pin', pinInput);
    }
    setActiveUser(updatedProfile);
    setIsEditing(false);
    setErrorMsg(null);
    setSaveSuccessMsg(`Pengesahan Berjaya! Selamat datang, ${matchedStaff.name}.`);

    if (onProfileChange) {
      onProfileChange(updatedProfile);
    }

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4500);
  };

  const handleLogout = () => {
    clearActiveUser();
    setActiveUser(null);
    setIsEditing(true);
    setEmailInput('');
    setPinInput('');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kpmbp_active_user_pin');
    }
    setErrorMsg(null);
    setSaveSuccessMsg('Berjaya log keluar. Kembali ke paparan lalai (default view).');

    if (onProfileChange) {
      onProfileChange(null);
    }

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);
  };

  // Helper for user initials
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.replace(/bin|binti|dr\.|pn\.|en\./gi, '').trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full bg-slate-900 overflow-hidden">
      {saveSuccessMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-700/80 px-3.5 py-2 text-[11px] font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Mode 1: Logged In Display Mode */}
      {!isEditing && activeUser ? (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white text-base shadow-md shadow-blue-950/50 shrink-0">
              {getInitials(activeUser.applicantName)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white truncate block">
                  {activeUser.applicantName}
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" title="Akaun Staf KPMBP Disahkan" />
              </div>
              <p className="text-[11px] text-blue-300 font-medium truncate">
                {activeUser.applicantEmail}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {activeUser.department} • {activeUser.applicantRole}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              Status Akaun
            </span>
            <span className="font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Akaun Sah &amp; Aktif
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition cursor-pointer text-center"
            >
              Tukar Staf
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="py-2 px-3 bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-900 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-200 transition cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Keluar</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Mode 2: Verification Login Form (Compact Spacing & Zero-Batal) */}
      {/* Mode 2: Verification Login Form (Compact Spacing, Symmetrical, Ultra-Clean) */}
      {(isEditing || !activeUser) && (
        <form onSubmit={handleVerifyAndLogin} className="p-4 sm:p-5 space-y-3 bg-slate-900">
          {/* E-mel Input: Tanpa label/helper text, placeholder nama@mara.gov.my, ikon Mail */}
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="E-mel Staf"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value.trim().toLowerCase())}
              placeholder="nama@mara.gov.my"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* PIN Input: Ikon key, 4-digit input */}
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="one-time-code"
              required
              aria-label="PIN Keselamatan"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                setErrorMsg(null);
              }}
              placeholder="••••"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono tracking-widest placeholder:tracking-normal placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-800 p-2.5 rounded-xl text-xs text-red-200 flex flex-col gap-2 animate-in fade-in duration-150">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-red-300 block">{errorMsg}</span>
                  <p className="text-[10px] text-red-200/80 leading-tight">
                    Sila pastikan e-mel dan PIN 4-digit tepat.
                  </p>
                </div>
              </div>

              {/* Forgot PIN direct assistance box */}
              <div className="bg-slate-900/95 border border-red-800/60 rounded-lg p-2.5 space-y-1 text-xs text-slate-200">
                <p className="font-bold text-amber-300 text-[11px]">
                  Terlupa PIN?
                </p>
                <p className="text-slate-300 text-[10px] leading-relaxed">
                  Sila hubungi Admin untuk bantuan mendapatkan semula akses.
                </p>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 font-mono">
                    014-5313756
                  </span>
                  <a
                    href="https://wasap.my/60145313756"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[10px] rounded-md shadow-xs transition flex items-center gap-1 shrink-0"
                    title="WhatsApp Admin untuk bantuan PIN"
                  >
                    <WhatsAppIcon className="w-3 h-3" />
                    <span>WhatsApp Admin</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Butang Login berwarna biru, full-width */}
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-900/40 transition flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <span>Login</span>
          </button>

          {activeUser && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 pt-0.5 transition cursor-pointer"
            >
              Kekalkan akaun semasa ({activeUser.applicantName})
            </button>
          )}
        </form>
      )}
    </div>
  );
};
