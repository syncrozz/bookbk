import React, { useState, useEffect } from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  SearchFilterParams, 
  PurposeCategory, 
  RoomCategory,
  RoomAvailabilityCheck,
  AcademicExemption
} from '../types';
import { 
  checkRoomAvailability, 
  findSmartAlternatives, 
  formatDateMalay, 
  getMalayDayOfWeek,
  calculateDurationText,
  findActiveExemption,
  getExemptionForDate
} from '../utils/availabilityEngine';
import {
  BOOKING_START_OPTIONS,
  BOOKING_END_OPTIONS,
  validateBookingTime,
  isTimeRangeNight
} from '../utils/timeSlots';
import { formatLevel, isTargetVenue } from '../utils/storage';
import { 
  Search, 
  Calendar, 
  Clock, 
  Users, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Lock, 
  ArrowRight,
  Info,
  Building,
  Check,
  ChevronRight,
  X,
  Moon,
  Sun
} from 'lucide-react';

interface QuickBookingSearchProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  exemptions?: AcademicExemption[];
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
  onViewRoomDetails: (room: Room) => void;
}

export const QuickBookingSearch: React.FC<QuickBookingSearchProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  exemptions = [],
  onOpenBookingModal,
  onViewRoomDetails
}) => {
  // Live current date (YYYY-MM-DD)
  const getTodayFormatted = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormatted);
  const [startTime, setStartTime] = useState<string>('11:30');
  const [endTime, setEndTime] = useState<string>('12:30');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('ALL'); // default ALL (Semua 33 Ruang)
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [category, setCategory] = useState<RoomCategory | 'Semua'>('Semua');
  const [purpose, setPurpose] = useState<PurposeCategory>('Kelas');
  const [hasSearched, setHasSearched] = useState<boolean>(true);
  const [selectedPopupCheck, setSelectedPopupCheck] = useState<RoomAvailabilityCheck | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPopupCheck) {
        setSelectedPopupCheck(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPopupCheck]);

  // Purpose options
  const purposeOptions: PurposeCategory[] = [
    'Kelas',
    'Kelas Ganti',
    'Konsultasi',
    'Mesyuarat',
    'Aktiviti Pelajar',
    'Lain-lain'
  ];

  // Perform availability check
  const searchParams: SearchFilterParams = {
    date: selectedDate,
    startTime,
    endTime,
    minCapacity,
    category,
    purpose,
    isAircondOnly: false,
    isSmartClassroomOnly: false
  };

  // If specific room selected
  const targetRoom = rooms.find(r => r.id === selectedRoomId);
  const singleCheck: RoomAvailabilityCheck | null = targetRoom 
    ? checkRoomAvailability(targetRoom, selectedDate, startTime, endTime, academicSchedule, adhocBookings, institutionalBlocks, exemptions)
    : null;

  // Smart alternatives if conflict occurs
  const smartAlternatives = (selectedRoomId !== 'ALL' && singleCheck && singleCheck.status !== 'AVAILABLE')
    ? findSmartAlternatives(selectedRoomId, searchParams, rooms, academicSchedule, adhocBookings, institutionalBlocks, exemptions)
    : null;

  // All rooms check if "ALL" selected or for overview list
  const allRoomsCheck: RoomAvailabilityCheck[] = rooms
    .filter(r => {
      if (category !== 'Semua' && r.category !== category) return false;
      if (minCapacity > 0 && r.capacity < minCapacity) return false;
      if (searchParams.isAircondOnly && !r.hasAircond) return false;
      return true;
    })
    .map(r => checkRoomAvailability(r, selectedDate, startTime, endTime, academicSchedule, adhocBookings, institutionalBlocks, exemptions));

  const availableCount = allRoomsCheck.filter(c => c.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/80 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Room Availability Engine KPMBP
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Cari & Tempah Ruang Kuliah
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Sistem secara automatik menyemak <span className="text-amber-300 font-semibold">Jadual Akademik Rasmi</span>, <span className="text-emerald-300 font-semibold">Tempahan Ad-Hoc</span>, dan <span className="text-indigo-300 font-semibold">Program Institusi</span> bagi mengelakkan Clash.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-xl text-center min-w-[180px] shadow-inner">
            <div className="text-xs text-slate-400 font-medium">Tarikh Terpilih</div>
            <div className="text-base font-bold text-emerald-400 mt-1">
              {formatDateMalay(selectedDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. Tarikh */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              1. Tarikh Tempahan
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setHasSearched(true);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            />
            <span className="text-[11px] text-slate-500 block">
              Hari: <strong className="text-emerald-700">{getMalayDayOfWeek(selectedDate)}</strong>
            </span>
          </div>

          {/* 2. Masa (Mula & Tamat) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                2. Slot Masa (Mula - Tamat)
              </label>
              {isTimeRangeNight(startTime, endTime) ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                  <Moon className="w-3 h-3 text-indigo-600" />
                  Sesi Malam (Had: 23:00)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  <Sun className="w-3 h-3 text-amber-600" />
                  Sesi Siang
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium text-slate-500 whitespace-nowrap">Mula:</label>
                <select
                  value={startTime}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartTime(newStart);
                    // If end time is currently earlier or equal, auto adjust to 1 hour later
                    const [h, m] = newStart.split(':').map(Number);
                    const currentEndParts = endTime.split(':').map(Number);
                    const startTotal = h * 60 + m;
                    const endTotal = currentEndParts[0] * 60 + currentEndParts[1];
                    if (endTotal <= startTotal) {
                      const nextHour = Math.min(23, h + 1);
                      const adjustedEnd = `${String(nextHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      setEndTime(adjustedEnd);
                    }
                    setHasSearched(true);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <optgroup label="☀️ Waktu Siang (Pagi & Petang)">
                    {BOOKING_START_OPTIONS.filter(o => o.period === 'DAY').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🌙 Waktu Malam (8:00 PM - 10:00 PM)">
                    {BOOKING_START_OPTIONS.filter(o => o.period === 'NIGHT').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium text-slate-500 whitespace-nowrap">Tamat:</label>
                <select
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setHasSearched(true);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <optgroup label="☀️ Waktu Siang">
                    {BOOKING_END_OPTIONS.filter(o => o.period === 'DAY').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🌙 Waktu Malam (Maksimum 11:00 PM)">
                    {BOOKING_END_OPTIONS.filter(o => o.period === 'NIGHT').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Quick Slot Selection Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-medium mr-0.5">Pantas:</span>
              <button
                type="button"
                onClick={() => { setStartTime('08:30'); setEndTime('09:30'); setHasSearched(true); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${startTime === '08:30' && endTime === '09:30' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
              >
                08:30–09:30
              </button>
              <button
                type="button"
                onClick={() => { setStartTime('11:30'); setEndTime('12:30'); setHasSearched(true); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${startTime === '11:30' && endTime === '12:30' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
              >
                11:30–12:30
              </button>
              <button
                type="button"
                onClick={() => { setStartTime('14:30'); setEndTime('15:30'); setHasSearched(true); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${startTime === '14:30' && endTime === '15:30' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
              >
                14:30–15:30
              </button>
              <button
                type="button"
                onClick={() => { setStartTime('20:00'); setEndTime('21:00'); setHasSearched(true); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition flex items-center gap-1 ${startTime === '20:00' && endTime === '21:00' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold' : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-200'}`}
              >
                <Moon className="w-2.5 h-2.5" /> 20:00–21:00
              </button>
              <button
                type="button"
                onClick={() => { setStartTime('21:00'); setEndTime('22:00'); setHasSearched(true); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition flex items-center gap-1 ${startTime === '21:00' && endTime === '22:00' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold' : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-200'}`}
              >
                <Moon className="w-2.5 h-2.5" /> 21:00–22:00
              </button>
              <button
                type="button"
                onClick={() => { setStartTime('22:00'); setEndTime('23:00'); setHasSearched(true); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition flex items-center gap-1 ${startTime === '22:00' && endTime === '23:00' ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold' : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-200'}`}
              >
                <Moon className="w-2.5 h-2.5" /> 22:00–23:00
              </button>
            </div>

            {/* Validation Message or Duration Info */}
            {(() => {
              const timeValidation = validateBookingTime(startTime, endTime);
              if (!timeValidation.isValid) {
                return (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-1.5 mt-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span>{timeValidation.errorMsg}</span>
                  </div>
                );
              }
              return (
                <span className="text-[11px] text-slate-500 block">
                  Tempoh: <strong className="text-emerald-700 font-bold">{calculateDurationText(startTime, endTime)}</strong> ({startTime} – {endTime})
                  {isTimeRangeNight(startTime, endTime) && (
                    <span className="text-indigo-600 font-semibold ml-1.5">
                      • Waktu malam maksimum: 23:00
                    </span>
                  )}
                </span>
              );
            })()}
          </div>

          {/* 3. Pilihan Ruang Specifik / Semua */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-emerald-600" />
              3. Pilihan Ruang
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => {
                setSelectedRoomId(e.target.value);
                setHasSearched(true);
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">🔍 SEMUA {rooms.length || 42} RUANG (Cari Automatik)</option>
              {[...rooms]
                .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} {r.isSmartClassroom ? '✨ Smart' : ''} {r.hasAircond ? '💠 Aircond' : ''}
                  </option>
                ))}
            </select>
            <span className="text-[11px] text-slate-500 block">
              {rooms.length || 42} ruang dalam Direktori KPMBP
            </span>
          </div>

          {/* 4. Tujuan Tempahan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-600" />
              4. Tujuan Tempahan
            </label>
            <div>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as PurposeCategory)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {purposeOptions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* Action Button */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Semakan secara masa nyata (Real-time conflict detection)
          </div>

          <button
            onClick={() => setHasSearched(true)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-3 rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>SEMAK KETERSEDIAAN RUANG</span>
          </button>
        </div>
      </div>

      {/* SINGLE ROOM RESULT SECTION */}
      {selectedRoomId !== 'ALL' && targetRoom && singleCheck && (
        <div className="space-y-4">
          {/* AVAILABLE CASE */}
          {singleCheck.status === 'AVAILABLE' && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      RUANG TERSEDIA (AVAILABLE)
                    </div>
                    {singleCheck.academicExemption && (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
                        <span>📚</span>
                        <span>Dikecualikan daripada jadual hakiki (Study Week)</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    {targetRoom.name === targetRoom.code ? targetRoom.name : `${targetRoom.name} (${targetRoom.code})`}
                    {targetRoom.hasAircond && isTargetVenue(targetRoom) && (
                      <span className="bg-cyan-100 text-cyan-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-cyan-300">
                        💠 Aircond
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-700 text-sm">
                    Ruang ini <strong className="text-emerald-800">kosong dan sedia ditempah</strong> pada{' '}
                    <strong>{formatDateMalay(selectedDate)}</strong> jam <strong>{startTime} – {endTime}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-1">
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md font-medium">
                      🏛️ {targetRoom.block} ({formatLevel(targetRoom.level)})
                    </span>
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md font-medium">
                      🛠️ {targetRoom.facilities.slice(0, 3).join(', ')}
                    </span>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-col gap-2 min-w-[220px]">
                  <button
                    onClick={() => onOpenBookingModal(targetRoom, selectedDate, startTime, endTime, purpose)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold py-3.5 px-6 rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                  >
                    <span>TEMPAH SEKARANG</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewRoomDetails(targetRoom)}
                    className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold py-2 px-4 rounded-lg transition"
                  >
                    Lihat Maklumat Ruang
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFLICT CASE (Academic Timetable, Existing Booking, or Blocked) */}
          {singleCheck.status !== 'AVAILABLE' && (
            <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-6 shadow-lg space-y-5">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    <XCircle className="w-4 h-4" />
                    RUANG TIDAK TERSEDIA (CONFLICT DETECTED)
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mt-2">
                    {targetRoom.name === targetRoom.code ? targetRoom.name : `${targetRoom.name} (${targetRoom.code})`} sedang digunakan
                  </h3>
                  <p className="text-rose-900 text-sm font-semibold mt-1">
                    ❌ Pertembungan dikesan pada {formatDateMalay(selectedDate)} (Jam {startTime} – {endTime})
                  </p>
                </div>

                <span className="bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold px-3 py-1.5 rounded-lg">
                  {singleCheck.status === 'OCCUPIED_ACADEMIC' && '📘 Jadual Akademik Rasmi'}
                  {singleCheck.status === 'OCCUPIED_BOOKING' && '🟨 Tempahan Sedia Ada'}
                  {singleCheck.status === 'PENDING_BOOKING' && '🟡 Tempahan Menunggu Kelulusan'}
                  {singleCheck.status === 'BLOCKED' && '⚫ Blocked Institusi'}
                </span>
              </div>

              {/* Conflict Detail Card */}
              <div className="bg-white border border-rose-200 rounded-xl p-4 text-slate-800 text-sm space-y-2 shadow-sm">
                <div className="font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Sebab Pertembungan:
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-slate-800 font-medium text-xs sm:text-sm border border-slate-200">
                  {singleCheck.conflictReason}
                </div>
              </div>

              {/* SMART ALTERNATIVES SUGGESTION ENGINE */}
              {smartAlternatives && (
                <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                      <Sparkles className="w-5 h-5" />
                      <span>Cadangan Ruang Alternatif (Sistem KPMBP Availability Engine)</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Tersedia pada slot {startTime} – {endTime}
                    </span>
                  </div>

                  {smartAlternatives.alternativeRooms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {smartAlternatives.alternativeRooms.map(alt => {
                        const check = checkRoomAvailability(
                          alt.room,
                          selectedDate,
                          startTime,
                          endTime,
                          academicSchedule,
                          adhocBookings,
                          institutionalBlocks,
                          exemptions
                        );
                        return (
                          <div
                            key={alt.roomId}
                            onClick={() => setSelectedPopupCheck(check)}
                            className="bg-slate-800/90 hover:bg-slate-800 hover:border-emerald-500/80 border border-slate-700/80 rounded-xl p-3.5 space-y-2 flex flex-col justify-between transition cursor-pointer hover:scale-[1.01]"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-300 text-sm">{alt.room.name}</span>
                                <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50 font-bold">
                                  🟢
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {alt.room.block} ({formatLevel(alt.room.level)})
                              </div>
                              {alt.room.hasAircond && isTargetVenue(alt.room) && (
                                <span className="inline-block mt-1 text-[10px] bg-cyan-900/60 text-cyan-300 px-2 py-0.5 rounded font-semibold border border-cyan-700/50">
                                  💠 Aircond
                                </span>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                🔍 Klik kad untuk tempah / perincian
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 italic">
                      Tiada ruang lain tersedia pada slot masa {startTime} – {endTime}. Sila cuba pilih slot masa yang lain di bawah.
                    </div>
                  )}

                  {/* Alternative Time Slots on Same Room */}
                  {smartAlternatives.alternativeSlots.length > 0 && (
                    <div className="pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-2">
                      <div className="font-medium text-slate-400">
                        Atau pilih Slot Masa Lain untuk ruang <strong className="text-white">{targetRoom.code}</strong>:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {smartAlternatives.alternativeSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setStartTime(slot.startTime);
                              setEndTime(slot.endTime);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{slot.startTime} – {slot.endTime}</span>
                            <span className="text-[10px] bg-slate-900 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700">
                              {slot.period === 'NIGHT' ? '🌙 Malam' : '☀️ Siang'}
                            </span>
                            <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-1 rounded ml-1">KOSONG</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ALL ROOMS OVERVIEW / SEARCH RESULT GRID */}
      {selectedRoomId === 'ALL' && (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Keputusan carian bagi kemudahan KPMBP</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">
                  {allRoomsCheck.length} ruang dijumpai
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tarikh: <strong>{formatDateMalay(selectedDate)}</strong> • Jam: <strong>{startTime} – {endTime}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-300">
                🟢 {availableCount} Kosong
              </span>
              <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-md border border-rose-300">
                🔴 {allRoomsCheck.length - availableCount} Digunakan / Pertembungan
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRoomsCheck.map(check => {
              const r = check.room;
              const isAvail = check.status === 'AVAILABLE';

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedPopupCheck(check)}
                  className={`rounded-xl p-4 border transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.01] hover:shadow-md ${
                    isAvail 
                      ? 'bg-slate-50/80 hover:bg-emerald-50/60 border-slate-200 hover:border-emerald-400 shadow-xs'
                      : 'bg-rose-50/30 hover:bg-rose-50/60 border-rose-200 hover:border-rose-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                        <span>{r.code}</span>
                        {r.hasAircond && isTargetVenue(r) && (
                          <span className="text-[11px] bg-cyan-50 text-cyan-800 px-1.5 py-0.5 rounded font-bold border border-cyan-200" title="Aircond">
                            💠 Aircond
                          </span>
                        )}
                      </div>
                      {isAvail ? (
                        <span className="text-sm">🟢</span>
                      ) : (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          check.status === 'OCCUPIED_ACADEMIC'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : check.status === 'BLOCKED'
                            ? 'bg-slate-800 text-white border-slate-900'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {check.status === 'OCCUPIED_ACADEMIC' ? '📘 AKADEMIK' : check.status === 'BLOCKED' ? '⚫ BLOCKED' : '🟨 TEMPAHAN'}
                        </span>
                      )}
                    </div>

                    {r.name !== r.code && (
                      <div className="text-xs text-slate-700 font-bold">
                        {r.name}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div>{r.block} • {formatLevel(r.level)}</div>
                    </div>

                    {!isAvail && check.conflictReason && (
                      <div className="text-[11px] text-rose-800 bg-rose-100/70 p-2 rounded border border-rose-200 line-clamp-2">
                        {check.conflictReason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* POP-UP MODAL UPON CARD CLICK */}
      {selectedPopupCheck && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150 my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center text-sm border border-blue-200">
                  {selectedPopupCheck.room.code}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{selectedPopupCheck.room.name}</h3>
                  <p className="text-xs text-slate-500">{selectedPopupCheck.room.block} ({formatLevel(selectedPopupCheck.room.level)}) • {selectedPopupCheck.room.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPopupCheck(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Slot Availability Status Card */}
            <div className={`rounded-xl p-3.5 space-y-2 border ${
              selectedPopupCheck.status === 'AVAILABLE'
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-rose-50/80 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  {selectedPopupCheck.status === 'AVAILABLE' ? (
                    <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ruang Tersedia</>
                  ) : (
                    <><XCircle className="w-4 h-4 text-rose-600" /> Ada Pertembungan</>
                  )}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  selectedPopupCheck.status === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-rose-600 text-white border-rose-700'
                }`}>
                  {selectedPopupCheck.status === 'AVAILABLE' ? '🟢' : '🔴 DIGUNAKAN'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-500 block text-[10px]">Tarikh:</span>
                  <strong className="text-slate-900">{formatDateMalay(selectedDate)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Masa Slot:</span>
                  <strong className="text-blue-700">{startTime} – {endTime}</strong>
                </div>
              </div>

              {selectedPopupCheck.status !== 'AVAILABLE' && selectedPopupCheck.conflictReason && (
                <div className="mt-2 text-xs bg-white/90 p-2.5 rounded-lg border border-rose-200 text-rose-900">
                  <strong>Sebab Pertembungan:</strong> {selectedPopupCheck.conflictReason}
                </div>
              )}
            </div>

            {/* Facilities & Notes */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800">Kemudahan Sedia Ada:</div>
              <div className="flex flex-wrap gap-1">
                {selectedPopupCheck.room.facilities.map((fac, idx) => (
                  <span key={idx} className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                    ✓ {fac}
                  </span>
                ))}
              </div>
              {selectedPopupCheck.room.notes && (
                <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                  {selectedPopupCheck.room.notes}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPopupCheck(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold transition text-xs cursor-pointer"
              >
                Tutup
              </button>

              {selectedPopupCheck.status === 'AVAILABLE' ? (
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedPopupCheck.room;
                    setSelectedPopupCheck(null);
                    onOpenBookingModal(r, selectedDate, startTime, endTime, purpose);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-xs flex items-center gap-1.5 shadow-md shadow-emerald-200 cursor-pointer"
                >
                  <span>TEMPAH {selectedPopupCheck.room.code} SEKARANG</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedPopupCheck.room;
                    setSelectedPopupCheck(null);
                    onViewRoomDetails(r);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition text-xs cursor-pointer"
                >
                  Lihat Jadual Ruang
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
