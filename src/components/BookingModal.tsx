import React, { useState, useEffect } from 'react';
import { 
  Room, 
  PurposeCategory, 
  AdHocBooking, 
  StaffUser,
  AcademicScheduleSlot,
  InstitutionalBlock,
  AcademicExemption
} from '../types';
import { 
  formatDateMalay, 
  getMalayDayOfWeek, 
  calculateDurationText, 
  checkRoomAvailability,
  findActiveExemption,
  parseTimeMinutes 
} from '../utils/availabilityEngine';
import { 
  validateBookingTime, 
  isTimeRangeNight,
  isNightTime,
  minutesToTimeString,
  BOOKING_START_OPTIONS
} from '../utils/timeSlots';
import { 
  getStoredUserProfiles, 
  getStoredActiveUser, 
  findProfileByEmail, 
  saveActiveUser, 
  UserProfileHistory 
} from '../utils/storage';
import { generateBookingIdempotencyKey } from '../utils/idempotency';
import { matchStaffByEmail } from '../utils/staff-matcher';
import { verifyStaffCredentials, setStaffSessionPin, getStaffSessionPin, verifyAdminPin } from '../lib/firebase';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { ForgotPinHelp } from './ForgotPinHelp';
import { 
  Building, 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  Users, 
  CheckCircle2, 
  X, 
  Sparkles,
  ArrowRight,
  Mail,
  Phone,
  Check,
  AlertCircle,
  Zap,
  KeyRound,
  ShieldCheck,
  Shield,
  Moon,
  Sun,
  Lock
} from 'lucide-react';

interface BookingModalProps {
  room: Room;
  date: string;
  startTime: string;
  endTime: string;
  initialPurpose: PurposeCategory;
  staffList?: StaffUser[];
  academicSchedule?: AcademicScheduleSlot[];
  adhocBookings?: AdHocBooking[];
  institutionalBlocks?: InstitutionalBlock[];
  exemptions?: AcademicExemption[];
  isAdmin?: boolean;
  isFallbackMode?: boolean;
  onClose: () => void;
  onSubmitBooking: (bookingData: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'> | Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>[]) => void;
  onRequirePinChange?: (staff: StaffUser) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  room,
  date,
  startTime,
  endTime,
  initialPurpose,
  staffList = INITIAL_STAFF_DATA,
  academicSchedule = [],
  adhocBookings = [],
  institutionalBlocks = [],
  exemptions = [],
  isAdmin = false,
  isFallbackMode = false,
  onClose,
  onSubmitBooking,
  onRequirePinChange
}) => {
  // Multi-day state (Support e.g. 11 - 13 Okt 2026 or any custom range)
  const isOctSpecial = date >= '2026-10-11' && date <= '2026-10-13';
  const [isMultiDay, setIsMultiDay] = useState<boolean>(isOctSpecial);
  const [startDate, setStartDate] = useState<string>(date);
  const [endDate, setEndDate] = useState<string>(isOctSpecial ? '2026-10-13' : date);

  // Compute default end time: default to 1 hour (60 mins) from startTime, fallback to endTime
  const computeInitialEndTime = () => {
    const startMin = parseTimeMinutes(startTime);
    const oneHourEndMin = startMin + 60;
    const maxEndMin = room.allowNightBooking === false ? 1110 : 1380; // 23:00 ceiling

    if (oneHourEndMin <= maxEndMin) {
      const oneHourStr = minutesToTimeString(oneHourEndMin);
      if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
        const check = checkRoomAvailability(
          room,
          date,
          startTime,
          oneHourStr,
          academicSchedule,
          adhocBookings,
          institutionalBlocks,
          exemptions
        );
        if (check.status === 'AVAILABLE') {
          return oneHourStr;
        }
      } else {
        return oneHourStr;
      }
    }
    return endTime || minutesToTimeString(Math.min(startMin + 60, maxEndMin));
  };

  const [selectedStartTime, setSelectedStartTime] = useState<string>(startTime);
  const [selectedEndTime, setSelectedEndTime] = useState<string>(computeInitialEndTime);

  // Helper to compute list of dates in range
  const getDatesInRange = (s: string, e: string): string[] => {
    if (!s) return [];
    if (!e || e < s) return [s];
    const list: string[] = [];
    const curr = new Date(s);
    const finish = new Date(e);
    let count = 0;
    while (curr <= finish && count < 14) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      list.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return list.length > 0 ? list : [s];
  };

  const activeDates = isMultiDay ? getDatesInRange(startDate, endDate) : [startDate || date];

  // Pre-load logged-in user credentials if available; if not logged in, leave empty
  const getInitialActiveUser = () => {
    const activeUser = getStoredActiveUser();
    if (activeUser && activeUser.applicantEmail) {
      let pin = '';
      if (activeUser.staffId) {
        pin = getStaffSessionPin(activeUser.staffId) || '';
      }
      if (!pin && typeof window !== 'undefined') {
        pin = sessionStorage.getItem('kpmbp_active_user_pin') || '';
      }
      if (!pin && activeUser.pinStatus === 'DEFAULT') {
        pin = '1234';
      }
      return {
        name: activeUser.applicantName || '',
        email: activeUser.applicantEmail || '',
        pin: pin,
        phone: activeUser.applicantPhone || '',
        role: activeUser.applicantRole || 'Pensyarah',
        department: activeUser.department || 'Pengajian Am'
      };
    }
    return {
      name: '',
      email: '',
      pin: '',
      phone: '',
      role: '',
      department: ''
    };
  };

  const initialCreds = getInitialActiveUser();
  const [applicantName, setApplicantName] = useState<string>(initialCreds.name);
  const [applicantEmail, setApplicantEmail] = useState<string>(initialCreds.email);
  const [pinInput, setPinInput] = useState<string>(initialCreds.pin);
  const [applicantPhone, setApplicantPhone] = useState<string>(initialCreds.phone);
  const [applicantRole, setApplicantRole] = useState<string>(initialCreds.role);
  const [department, setDepartment] = useState<string>(initialCreds.department);
  const [purposeCategory, setPurposeCategory] = useState<PurposeCategory>(initialPurpose || 'Kelas');
  const [paxCount, setPaxCount] = useState<number>(Math.min(room.capacity, 28));
  const [notes, setNotes] = useState<string>('');

  // Admin booking on behalf of staff state
  const [isAdminBooking, setIsAdminBooking] = useState<boolean>(isAdmin);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(isAdmin);
  const [adminPasscodeInput, setAdminPasscodeInput] = useState<string>('');

  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Load active user profile on mount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const activeUser = getStoredActiveUser();

    if (activeUser && activeUser.applicantEmail) {
      setApplicantName(activeUser.applicantName || '');
      setApplicantEmail(activeUser.applicantEmail || '');
      setApplicantRole(activeUser.applicantRole || 'Pensyarah');
      setDepartment(activeUser.department || 'Pengajian Am');
      if (activeUser.applicantPhone) setApplicantPhone(activeUser.applicantPhone);

      let pin = '';
      if (activeUser.staffId) {
        pin = getStaffSessionPin(activeUser.staffId) || '';
      }
      if (!pin && typeof window !== 'undefined') {
        pin = sessionStorage.getItem('kpmbp_active_user_pin') || '';
      }
      if (!pin && activeUser.pinStatus === 'DEFAULT') {
        pin = '1234';
      }
      if (pin) {
        setPinInput(pin);
      }
    } else {
      // Jika belum login, biarkan ruang kosong untuk diisi kemudian
      setApplicantName('');
      setApplicantEmail('');
      setPinInput('');
      setApplicantPhone('');
      setApplicantRole('');
      setDepartment('');
    }
  }, [staffList]);

  const handleEmailInputChange = (val: string) => {
    setApplicantEmail(val);
    setVerificationError(null);
    const clean = val.trim().toLowerCase();
    if (!clean) {
      setApplicantName('');
      setApplicantPhone('');
      setApplicantRole('');
      setDepartment('');
      return;
    }
    // Auto-match staff metadata from list with smart alias and institutional domain resolution
    const match = matchStaffByEmail(clean, staffList);
    if (match) {
      setApplicantName(match.name);
      setApplicantRole(match.role);
      setDepartment(match.department);
      setApplicantPhone(match.phone);
    }
  };

  const handleStaffNameChange = (val: string) => {
    setApplicantName(val);
    setVerificationError(null);
    if (!val.trim()) return;

    // Auto-match staff metadata if typing a known lecturer's name (e.g. Tahira)
    const clean = val.trim().toLowerCase();
    const match = staffList.find(s => 
      s.name.toLowerCase() === clean || 
      s.name.toLowerCase().includes(clean)
    );
    if (match) {
      if (match.email) setApplicantEmail(match.email);
      if (match.phone) setApplicantPhone(match.phone);
      if (match.role) setApplicantRole(match.role);
      if (match.department) setDepartment(match.department);
    }
  };

  const handleVerifyAdminPasscode = async () => {
    const cleanPasscode = adminPasscodeInput.trim();
    if (!cleanPasscode) {
      setVerificationError('Sila masukkan Passcode Pentadbir.');
      return;
    }
    const res = await verifyAdminPin(cleanPasscode);
    if (res.success) {
      setIsAdminAuthenticated(true);
      setVerificationError(null);
    } else {
      setVerificationError(res.errorMsg || 'Passcode Pentadbir tidak sah.');
    }
  };

  const isNightBooking = isTimeRangeNight(selectedStartTime, selectedEndTime);
  const startMinutes = parseTimeMinutes(selectedStartTime);
  const maxEndMinutes = room.allowNightBooking === false ? 1110 : 1380; // 23:00 max ceiling

  // Check availability across all active dates
  const datesStatus = activeDates.map(d => {
    const check = checkRoomAvailability(
      room,
      d,
      selectedStartTime,
      selectedEndTime,
      academicSchedule,
      adhocBookings,
      institutionalBlocks,
      exemptions
    );
    return {
      date: d,
      day: getMalayDayOfWeek(d),
      isAvailable: check.status === 'AVAILABLE',
      conflictReason: check.conflictReason,
      academicExemption: check.academicExemption
    };
  });
  const allDatesAvailable = datesStatus.every(d => d.isAvailable);

  // Pre-calculate 1 to 4 hour duration options, plus 7 hours for 16:00 -> 23:00
  const durationHoursToTest = [1, 2, 3, 4];
  if (startMinutes === 960) { // 16:00 (4:00 PM) -> add 7 hours (up to 23:00)
    durationHoursToTest.push(7);
  } else if (startMinutes + 7 * 60 <= maxEndMinutes) {
    durationHoursToTest.push(7);
  }

  const durationOptions = durationHoursToTest
    .map(hours => {
      const endMin = startMinutes + hours * 60;
      if (endMin > maxEndMinutes) return null;
      const endStr = minutesToTimeString(endMin);
      
      let isAvailable = true;
      let conflictReason: string | undefined;

      for (const d of activeDates) {
        if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
          const check = checkRoomAvailability(
            room,
            d,
            selectedStartTime,
            endStr,
            academicSchedule,
            adhocBookings,
            institutionalBlocks,
            exemptions
          );
          if (check.status !== 'AVAILABLE') {
            isAvailable = false;
            conflictReason = `${getMalayDayOfWeek(d)}: ${check.conflictReason}`;
            break;
          }
        }
      }

      return {
        hours,
        endTime: endStr,
        isPopular: hours === 1,
        isAvailable,
        conflictReason
      };
    })
    .filter(Boolean) as {
      hours: number;
      endTime: string;
      isPopular: boolean;
      isAvailable: boolean;
      conflictReason?: string;
    }[];

  // All potential valid end times for dropdown (up to 23:00)
  const candidateEndTimes = [
    '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', 
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', 
    '19:00', '20:00', '21:00', '22:00', '23:00'
  ];

  const allValidEndTimes = candidateEndTimes
    .filter(t => parseTimeMinutes(t) > startMinutes && parseTimeMinutes(t) <= maxEndMinutes)
    .map(t => {
      let isAvailable = true;
      for (const d of activeDates) {
        if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
          const check = checkRoomAvailability(
            room,
            d,
            selectedStartTime,
            t,
            academicSchedule,
            adhocBookings,
            institutionalBlocks,
            exemptions
          );
          if (check.status !== 'AVAILABLE') {
            isAvailable = false;
            break;
          }
        }
      }
      return { value: t, isAvailable };
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    // Validate booking time with centralized SES v4.4 engine
    const timeValidation = validateBookingTime(selectedStartTime, selectedEndTime);
    if (!timeValidation.isValid) {
      setVerificationError(timeValidation.errorMsg || 'Masa tempahan tidak sah.');
      return;
    }

    if (isNightBooking && room.allowNightBooking === false) {
      setVerificationError(`Ruang ${room.code} tidak dibenarkan untuk tempahan waktu malam.`);
      return;
    }

    // Availability validation across all active dates
    for (const d of activeDates) {
      if (academicSchedule.length > 0 || adhocBookings.length > 0 || institutionalBlocks.length > 0) {
        const availCheck = checkRoomAvailability(
          room,
          d,
          selectedStartTime,
          selectedEndTime,
          academicSchedule,
          adhocBookings,
          institutionalBlocks,
          exemptions
        );
        if (availCheck.status !== 'AVAILABLE') {
          setVerificationError(`Pertembungan pada ${formatDateMalay(d)} (${getMalayDayOfWeek(d)}): ${availCheck.conflictReason || 'Slot tidak tersedia.'}`);
          return;
        }
      }
    }

    let finalApplicantName = applicantName.trim();
    let finalApplicantEmail = applicantEmail.trim();
    let finalApplicantPhone = applicantPhone.trim();
    let finalApplicantRole = applicantRole.trim() || 'Pensyarah';
    let finalDepartment = department.trim() || 'Pengajian Am';

    if (isAdminBooking) {
      // 1. Verify Admin Access
      if (!isAdminAuthenticated) {
        const verifyRes = await verifyAdminPin(adminPasscodeInput.trim());
        if (verifyRes.success) {
          setIsAdminAuthenticated(true);
        } else {
          setVerificationError(verifyRes.errorMsg || 'Sila masukkan Passcode Pentadbir yang sah untuk mengesahkan tempahan.');
          return;
        }
      }

      if (!finalApplicantName) {
        setVerificationError('Sila masukkan nama pensyarah / staf yang ingin ditempah (contoh: Tahira).');
        return;
      }

      if (!finalApplicantEmail) {
        finalApplicantEmail = `${finalApplicantName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'staf'}@mara.gov.my`;
      }
    } else {
      // 2. Standard Staff PIN Verification via Secure Server API
      const verifyResult = await verifyStaffCredentials(applicantEmail, pinInput, staffList);

      if (!verifyResult.success || !verifyResult.staff) {
        setVerificationError(
          verifyResult.errorMsg || 
          'Email atau PIN tidak sah.'
        );
        return;
      }

      const verifiedStaff = verifyResult.staff;

      // Check mandatory PIN change if still on default PIN 1234
      if (verifiedStaff.pinStatus === 'DEFAULT') {
        if (onRequirePinChange) {
          onRequirePinChange(verifiedStaff);
        }
        return;
      }

      finalApplicantName = verifiedStaff.name;
      finalApplicantEmail = verifiedStaff.email;
      finalApplicantPhone = verifiedStaff.phone;
      finalApplicantRole = verifiedStaff.role;
      finalDepartment = verifiedStaff.department;

      // Save session pin & active user profile
      setStaffSessionPin(verifiedStaff.id, pinInput);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('kpmbp_active_user_pin', pinInput);
      }
      saveActiveUser({
        staffId: verifiedStaff.id,
        applicantName: verifiedStaff.name,
        applicantEmail: verifiedStaff.email,
        applicantPhone: verifiedStaff.phone,
        applicantRole: verifiedStaff.role,
        department: verifiedStaff.department,
        pinStatus: verifiedStaff.pinStatus
      });
    }

    const effectivePurpose = purposeCategory.trim() || 'Kelas';
    const adminTag = isAdminBooking ? '[Ditempah oleh Pentadbir]' : '';
    const consolidatedNotes = [notes.trim(), adminTag].filter(Boolean).join(' ');

    if (isMultiDay && activeDates.length > 1) {
      const seriesBookings = activeDates.map((d, index) => {
        const activeEx = findActiveExemption(room, d, exemptions);
        const itemParams = {
          roomId: room.id,
          roomName: room.name,
          date: d,
          startTime: selectedStartTime,
          endTime: selectedEndTime,
          applicantName: finalApplicantName,
          applicantEmail: finalApplicantEmail,
          applicantPhone: finalApplicantPhone,
          applicantRole: finalApplicantRole,
          department: finalDepartment,
          purposeCategory: effectivePurpose,
          title: `${effectivePurpose} (${room.code}) - Siri ${index + 1}/${activeDates.length}`,
          paxCount,
          notes: consolidatedNotes
            ? `${consolidatedNotes} [Siri Hari ${index + 1}/${activeDates.length}]`
            : `Siri Tempahan ${activeDates.length} Hari (${formatDateMalay(startDate)} - ${formatDateMalay(endDate)})`,
          ...(activeEx ? { academicExemptionId: activeEx.id } : {})
        };
        return {
          ...itemParams,
          idempotencyKey: generateBookingIdempotencyKey(itemParams)
        };
      });
      onSubmitBooking(seriesBookings);
    } else {
      const targetDate = activeDates[0] || date;
      const activeEx = findActiveExemption(room, targetDate, exemptions);
      const singleParams = {
        roomId: room.id,
        roomName: room.name,
        date: targetDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        applicantName: finalApplicantName,
        applicantEmail: finalApplicantEmail,
        applicantPhone: finalApplicantPhone,
        applicantRole: finalApplicantRole,
        department: finalDepartment,
        purposeCategory: effectivePurpose,
        title: `${effectivePurpose} (${room.code})`,
        paxCount,
        notes: consolidatedNotes || undefined,
        ...(activeEx ? { academicExemptionId: activeEx.id } : {})
      };
      onSubmitBooking({
        ...singleParams,
        idempotencyKey: generateBookingIdempotencyKey(singleParams)
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 overflow-y-auto overscroll-contain p-2 sm:p-4 flex flex-col items-center justify-start sm:justify-center">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col my-auto animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header (Pinned at top so title and close button are never cut off) */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 pb-3 shrink-0 bg-white rounded-t-2xl sm:rounded-t-3xl z-10">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Borang Tempahan Ruang KPMBP</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">{room.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body (Multi-Day section starts directly here, 100% visible) */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 overscroll-contain touch-pan-y">
          {/* Offline Fallback Warning Notice */}
        {isFallbackMode && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Mod Luar Talian:</strong> Tempahan ini akan disimpan di storan pelayar tempatan dan tidak dihantar ke Firestore Cloud sehingga sambungan pulih.
            </p>
          </div>
        )}

        {/* Multi-Day / Single-Day Option Card */}
        <div className={`rounded-xl p-3 space-y-2.5 text-xs transition-all duration-200 border ${
          isMultiDay 
            ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
            : 'bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/40 border-blue-200 shadow-2xs'
        }`}>
          <div className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 ${
            isMultiDay
              ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/50'
              : 'bg-white border-2 border-blue-300 hover:border-blue-500 text-slate-800 shadow-sm hover:shadow'
          }`}>
            <label className="flex items-center gap-2.5 cursor-pointer font-extrabold select-none">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                isMultiDay 
                  ? 'bg-white text-blue-600 shadow-xs' 
                  : 'bg-blue-50 border-2 border-blue-400 text-transparent'
              }`}>
                <input
                  type="checkbox"
                  checked={isMultiDay}
                  onChange={(e) => setIsMultiDay(e.target.checked)}
                  className="sr-only"
                />
                {isMultiDay ? (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                ) : (
                  <span className="w-2 h-2 rounded-xs bg-transparent" />
                )}
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                <span className={`text-xs sm:text-sm font-black tracking-tight ${isMultiDay ? 'text-white' : 'text-slate-900'}`}>
                  📅 Lebih 1 Hari
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isMultiDay ? 'bg-white/20 text-white border border-white/30' : 'bg-blue-600 text-white shadow-2xs'
                }`}>
                  Multi-Day
                </span>
              </div>
            </label>

            {isMultiDay ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="bg-white text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs">
                  {activeDates.length} Hari Aktif
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsMultiDay(true)}
                className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition cursor-pointer"
              >
                + Aktifkan Siri
              </button>
            )}
          </div>

          {isMultiDay ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Tarikh Mula:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Tarikh Tamat:</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-600 font-medium">Tarikh Tempahan:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                }}
                className="bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
              />
            </div>
          )}

          {isMultiDay && activeDates.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-600 font-bold block">Jadual Pengesahan Harian:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                {datesStatus.map(ds => (
                  <div
                    key={ds.date}
                    className={`p-2 rounded-lg border font-medium flex flex-col justify-between ${
                      ds.isAvailable
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{formatDateMalay(ds.date)}</span>
                      <span>{ds.isAvailable ? '🟢 Tersedia' : '🔴 Bertembung'}</span>
                    </div>
                    <div className="text-[9.5px] opacity-80 mt-1">
                      {ds.day}: {selectedStartTime} – {selectedEndTime}
                    </div>
                    {ds.academicExemption && ds.isAvailable && (
                      <span className="text-[9px] bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded font-bold mt-1 inline-block self-start">
                        📚 Study Week
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Slot Summary Card */}
        <div className={`rounded-xl p-3.5 space-y-2.5 text-xs border ${
          isNightBooking 
            ? 'bg-slate-900 border-indigo-500/50 text-white' 
            : 'bg-slate-900 border-slate-800 text-white'
        }`}>
          {activeDates.some(d => !!findActiveExemption(room, d, exemptions)) && (
            <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-lg p-2.5 flex items-center gap-2 text-emerald-200 text-xs">
              <span className="text-base">📚</span>
              <span>
                <strong className="font-bold text-emerald-300">Dikecualikan daripada jadual hakiki (Study Week):</strong> Slot jadual hakiki tidak menghalang tempahan pada tempoh ini.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-blue-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Ruang Disahkan Available
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isNightBooking
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}>
              {isNightBooking ? (
                <>
                  <Moon className="w-2.5 h-2.5" /> Sesi Petang / Malam (hingga 23:00)
                </>
              ) : (
                <>
                  <Sun className="w-2.5 h-2.5" /> Sesi Siang (08:30 – 17:30)
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">Tarikh:</span>
              <strong className="text-white">
                {isMultiDay && activeDates.length > 1 
                  ? `${formatDateMalay(startDate)} – ${formatDateMalay(endDate)} (${activeDates.length} Hari)`
                  : `${formatDateMalay(startDate || date)} (${getMalayDayOfWeek(startDate || date)})`
                }
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Masa Tempahan Setiap Hari:</span>
              <strong className={isNightBooking ? "text-indigo-300" : "text-blue-300"}>
                {selectedStartTime} – {selectedEndTime} ({calculateDurationText(selectedStartTime, selectedEndTime)})
              </strong>
            </div>
          </div>

          {/* Time Picker Controls: Start Time & End Time */}
          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/80">
            <div>
              <label htmlFor="modal-start-time" className="text-slate-400 block text-[10px] mb-1 font-semibold">
                Masa Mula:
              </label>
              <select
                id="modal-start-time"
                value={selectedStartTime}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setSelectedStartTime(newStart);
                  setVerificationError(null);
                  const newStartMin = parseTimeMinutes(newStart);
                  const oneHourEndMin = newStartMin + 60;
                  const maxCeil = room.allowNightBooking === false ? 1110 : 1380;
                  if (oneHourEndMin <= maxCeil) {
                    setSelectedEndTime(minutesToTimeString(oneHourEndMin));
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {BOOKING_START_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="modal-custom-end-time" className="text-slate-400 block text-[10px] mb-1 font-semibold">
                Masa Tamat:
              </label>
              <select
                id="modal-custom-end-time"
                value={selectedEndTime}
                onChange={(e) => {
                  setSelectedEndTime(e.target.value);
                  setVerificationError(null);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {allValidEndTimes.map(t => (
                  <option key={t.value} value={t.value} disabled={!t.isAvailable}>
                    {t.value} ({calculateDurationText(selectedStartTime, t.value)}) {!t.isAvailable ? '— Bertembung' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Duration Selection */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Pilihan Tempoh Pantas:
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
              {durationOptions.map(opt => {
                const isSelected = selectedEndTime === opt.endTime;
                const isAvail = opt.isAvailable;
                return (
                  <button
                    key={opt.hours}
                    type="button"
                    disabled={!isAvail}
                    onClick={() => {
                      setSelectedEndTime(opt.endTime);
                      setVerificationError(null);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-center transition font-bold text-[11px] cursor-pointer flex flex-col items-center justify-center relative ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/60'
                        : isAvail
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95'
                        : 'bg-slate-900/60 text-slate-500 border border-slate-800/80 cursor-not-allowed opacity-40'
                    }`}
                    title={isAvail ? `${opt.hours} Jam (${selectedStartTime} – ${opt.endTime})` : (opt.conflictReason || 'Slot bertembung')}
                  >
                    <span className="flex items-center gap-0.5 leading-tight">
                      {opt.hours} Jam
                      {opt.isPopular && <span className="text-amber-300 text-[10px]">★</span>}
                      {opt.hours === 7 && <span className="text-amber-300 text-[10px]">🌙</span>}
                    </span>
                    <span className="text-[9.5px] font-normal opacity-80 leading-tight">
                      hingga {opt.endTime}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isNightBooking && (
            <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-indigo-200/90 flex items-center gap-1.5">
              <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Peringatan Sesi Malam / Lanjutan: Had maksimum sehingga 23:00 (11:00 PM). Sila pastikan dewan dikunci dan suis ditutup selepas sesi tamat.</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          
          {/* Authentication Block: Log Masuk & Mod Admin */}
          <div className={`rounded-xl p-3 space-y-2.5 transition-all border ${
            isAdminBooking 
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
              <span className="flex items-center gap-1.5 text-slate-900 text-xs font-bold">
                {isAdminBooking ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Mod Tempahan Admin</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Log Masuk Staf</span>
                  </>
                )}
              </span>

              {/* Admin Booking Checkbox Button */}
              <label 
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition select-none ${
                  isAdminBooking 
                    ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs ring-1 ring-amber-300' 
                    : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                }`}
                title="Pilih untuk membuat tempahan sebagai Pentadbir bagi pihak staf/pensyarah"
              >
                <input
                  type="checkbox"
                  checked={isAdminBooking}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsAdminBooking(checked);
                    setVerificationError(null);
                    if (checked && !isAdmin) {
                      setIsAdminAuthenticated(false);
                      setAdminPasscodeInput('');
                    } else if (checked && isAdmin) {
                      setIsAdminAuthenticated(true);
                    }
                  }}
                  className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer w-3.5 h-3.5"
                />
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Tempah sebagai Admin</span>
              </label>
            </div>

            {isAdminBooking ? (
              // Admin Access Verification or Verified Status
              !isAdminAuthenticated ? (
                <div className="bg-amber-100/70 border border-amber-300 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    <span>Sila Masukkan Passcode Akses Pentadbir</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Masukkan PIN/Passcode keselamatan Pentadbir untuk mengesahkan hak tempahan bagi pihak pensyarah.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="password"
                        inputMode="numeric"
                        placeholder="••••"
                        value={adminPasscodeInput}
                        onChange={(e) => {
                          setAdminPasscodeInput(e.target.value);
                          setVerificationError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyAdminPasscode();
                          }
                        }}
                        className="w-full bg-white border border-amber-400 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyAdminPasscode}
                      className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition cursor-pointer shrink-0"
                    >
                      Sahkan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2 flex items-center justify-between text-emerald-900 text-[11px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Akses Pentadbir Disahkan. Taip atau pilih pensyarah yang dikehendaki di bawah.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdminAuthenticated(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline font-normal cursor-pointer ml-2"
                  >
                    Kunci Semula
                  </button>
                </div>
              )
            ) : (
              // Standard Staff User Login
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    E-mel
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="nama@mara.gov.my atau e-mel CSV berdaftar"
                      value={applicantEmail}
                      onChange={(e) => handleEmailInputChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      PIN
                    </label>
                    <ForgotPinHelp />
                  </div>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoComplete="one-time-code"
                      required
                      placeholder="••••"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setVerificationError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 font-mono font-bold tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {verificationError && (
              <div className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 font-semibold space-y-1.5 animate-fadeIn">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{verificationError}</span>
                </div>
                {!isAdminBooking && (
                  <div className="pt-1 border-t border-red-200/60">
                    <ForgotPinHelp />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details Pemohon / Pensyarah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isAdminBooking ? 'Nama Pensyarah / Staf:' : 'Nama Pemohon / Staff:'}
              </label>
              {isAdminBooking ? (
                <>
                  <input
                    type="text"
                    required
                    list="staff-name-datalist"
                    placeholder="cth: Tahira / En. Ahmad Khairi (taip nama)"
                    value={applicantName}
                    onChange={(e) => handleStaffNameChange(e.target.value)}
                    className="w-full bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-amber-400/30 shadow-2xs"
                  />
                  <datalist id="staff-name-datalist">
                    {staffList.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.department} — {s.role})
                      </option>
                    ))}
                  </datalist>
                </>
              ) : (
                <input
                  type="text"
                  required
                  readOnly
                  value={applicantName}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold outline-none cursor-not-allowed"
                />
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">No. Telefon / WhatsApp:</label>
              {isAdminBooking ? (
                <input
                  type="text"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  placeholder="cth: 014-5313756"
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-1 focus:ring-amber-500"
                />
              ) : (
                <input
                  type="text"
                  readOnly
                  value={applicantPhone}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none cursor-not-allowed"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jawatan / Peranan:</label>
              {isAdminBooking ? (
                <input
                  type="text"
                  value={applicantRole}
                  onChange={(e) => setApplicantRole(e.target.value)}
                  placeholder="cth: Pensyarah DIA"
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-1 focus:ring-amber-500"
                />
              ) : (
                <input
                  type="text"
                  readOnly
                  value={applicantRole}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none cursor-not-allowed"
                />
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Jabatan / Unit:</label>
              {isAdminBooking ? (
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="cth: Jabatan Perdagangan"
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:ring-1 focus:ring-amber-500"
                />
              ) : (
                <input
                  type="text"
                  readOnly
                  value={department}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none cursor-not-allowed"
                />
              )}
            </div>
          </div>

          <div>
            <label htmlFor="modal-purpose-input" className="block font-bold text-slate-700 mb-1">
              Tujuan Tempahan:
            </label>
            <div className="relative">
              <input
                id="modal-purpose-input"
                type="text"
                list="purpose-category-suggestions"
                value={purposeCategory}
                onChange={(e) => setPurposeCategory(e.target.value)}
                placeholder="Kelas"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <datalist id="purpose-category-suggestions">
                <option value="Kelas" />
                <option value="Kelas Ganti" />
                <option value="Konsultasi" />
                <option value="Mesyuarat" />
                <option value="Aktiviti Pelajar" />
                <option value="Bengkel / Kursus" />
                <option value="Taklimat / Program" />
                <option value="Lain-lain" />
              </datalist>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Sila Isi secara ringkas sahaja
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Catatan:
            </label>
            <input
              type="text"
              placeholder="(jika ada)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-md shadow-blue-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>HANTAR TEMPAHAN SEKARANG</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

