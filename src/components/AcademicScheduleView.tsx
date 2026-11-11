import React, { useState } from 'react';
import { AcademicScheduleSlot, Room, DayOfWeek, AcademicExemption } from '../types';
import { MALAY_DAYS, formatDateMalay } from '../utils/availabilityEngine';
import { exportTimetableToStandardGridCSV } from '../utils/timetableCsvParser';
import { parseTimeMinutes } from '../utils/timeSlots';
import { ensureBookbkPrefix } from '../utils/downloadHelper';
import { formatCleanDateRange } from '../utils/exemptionDates';
import { 
  BookOpen, 
  Search, 
  Building, 
  Clock, 
  Lock,
  Download,
  AlertCircle
} from 'lucide-react';

const DAY_ORDER: Record<string, number> = {
  'Isnin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Khamis': 4,
  'Jumaat': 5,
  'Sabtu': 6,
  'Ahad': 7,
};

interface AcademicScheduleViewProps {
  schedule: AcademicScheduleSlot[];
  rooms: Room[];
  exemptions?: AcademicExemption[];
  onAddScheduleSlot?: (slot: Omit<AcademicScheduleSlot, 'id'>) => void;
}

export const AcademicScheduleView: React.FC<AcademicScheduleViewProps> = ({
  schedule,
  rooms,
  exemptions = [],
  onAddScheduleSlot
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'Semua'>('Khamis');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('Semua');

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const activeNow = exemptions.find(ex => ex.active && todayStr >= ex.startDate && todayStr <= ex.endDate);
  const upcoming = !activeNow ? exemptions.find(ex => ex.active && ex.startDate > todayStr) : undefined;

  const handleExportCSV = () => {
    const csvContent = exportTimetableToStandardGridCSV(schedule, rooms, { includeNightSlots: true });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', ensureBookbkPrefix(`jadual_akademik_rasmi_${new Date().toISOString().slice(0, 10)}.csv`));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and sort schedule slots chronologically (pagi -> tengahari -> malam)
  // Yang paling awal dipaparkan sebelah kiri, slot paling lewat di sebelah kanan
  const filteredSlots = schedule
    .filter(slot => {
      if (selectedDay !== 'Semua' && slot.dayOfWeek !== selectedDay) return false;
      if (roomFilter !== 'Semua' && slot.roomId !== roomFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          slot.courseCode.toLowerCase().includes(q) ||
          slot.courseName.toLowerCase().includes(q) ||
          slot.className.toLowerCase().includes(q) ||
          slot.lecturerName.toLowerCase().includes(q) ||
          slot.department.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // 1. Sekiranya pilihan adalah 'Semua Hari', susun mengikut turutan hari dahulu
      if (selectedDay === 'Semua' && a.dayOfWeek !== b.dayOfWeek) {
        const orderA = DAY_ORDER[a.dayOfWeek] || 99;
        const orderB = DAY_ORDER[b.dayOfWeek] || 99;
        if (orderA !== orderB) return orderA - orderB;
      }

      // 2. Susun mengikut masa mula menaik (pagi -> tengahari -> petang -> malam)
      const startA = parseTimeMinutes(a.startTime);
      const startB = parseTimeMinutes(b.startTime);
      if (startA !== startB) {
        return startA - startB;
      }

      // 3. Sekiranya masa mula sama, susun mengikut masa tamat menaik
      const endA = parseTimeMinutes(a.endTime);
      const endB = parseTimeMinutes(b.endTime);
      if (endA !== endB) {
        return endA - endB;
      }

      // 4. Susunan sekunder mengikut kod ruang
      return (a.roomId || '').localeCompare(b.roomId || '');
    });

  return (
    <div className="space-y-6">
      {/* STUDY WEEK NOTICE BANNER - MINIMAL & SHARP */}
      {activeNow && (
        <div className="bg-emerald-600 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl shadow-xs border border-emerald-500 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-700/80 border border-emerald-400/40 text-emerald-100 flex items-center justify-center shrink-0 text-sm shadow-xs font-bold">
              📚
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wide border border-emerald-400/40 shadow-xs">
                  SEDANG BERKUATKUASA
                </span>
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate">
                  Study Week | {formatCleanDateRange(activeNow.startDate, activeNow.endDate)}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 mt-0.5 truncate">
                Jadual tidak aktif. Tempahan adhoc dibenarkan.
              </p>
            </div>
          </div>
          {activeNow.scope && (
            <div className="hidden sm:inline-flex text-[11px] text-emerald-100 bg-emerald-700/60 px-2.5 py-1 rounded-lg border border-emerald-400/30 shrink-0 font-medium">
              Skop: {activeNow.scope === 'ALL_ROOMS' ? 'Semua Ruang' : activeNow.scope === 'BILIK_KULIAH' ? 'Bilik Kuliah Sahaja' : 'Ruang Terpilih'}
            </div>
          )}
        </div>
      )}

      {!activeNow && upcoming && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0 text-sm shadow-xs font-bold">
              📚
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-300">
                  AKAN DATANG
                </span>
                <h3 className="text-xs sm:text-sm font-extrabold text-emerald-950 tracking-tight truncate">
                  Study Week | {formatCleanDateRange(upcoming.startDate, upcoming.endDate)}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-800/90 mt-0.5 truncate">
                Jadual tidak aktif bermula {formatCleanDateRange(upcoming.startDate, upcoming.startDate)}. Tempahan adhoc dibenarkan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              Layer 1: Existing Occupancy
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Jadual Akademik Rasmi KPMBP
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
              Sesi kuliah rasmi yang telah ditetapkan dalam jadual mingguan. Penggunaan ini tidak memerlukan tempahan ad-hoc tambahan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold py-2.5 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer h-full"
              title="Eksport jadual akademik ke fail CSV format standard (Perkara/Hari)"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Eksport CSV</span>
            </button>
            <div className="bg-blue-900 text-white p-3 rounded-xl text-center min-w-[150px] shadow-sm">
              <div className="text-[11px] text-blue-200 font-medium">Jumlah Slot Rasmi</div>
              <div className="text-xl font-bold text-blue-300 mt-0.5">{schedule.length} Slot</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Day Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setSelectedDay('Semua')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedDay === 'Semua' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Hari
              </button>
              {['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'].map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d as DayOfWeek)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    selectedDay === d ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Room Filter */}
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Semua">Tapis Ruang: Semua Ruang</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Pensyarah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSlots.length > 0 ? (
          filteredSlots.map(slot => {
            const room = rooms.find(r => r.id === slot.roomId);
            const isLocked = slot.courseCode === 'LOCKED' || 
                             slot.courseCode === 'TERKUNCI' || 
                             slot.courseName?.toLowerCase().includes('terkunci') || 
                             slot.className === 'Ketetapan Pentadbiran';

            // Booker / Primary identity (displayed only once)
            const bookerName = (() => {
              let name = slot.className;
              if (!name || name === 'Pengajian / Aktiviti' || name === 'TERKUNCI' || name === 'Ketetapan Pentadbiran') {
                name = slot.lecturerName || '';
              }
              if (!name || name === 'Pentadbir KPMBP' || name === 'Pensyarah KPMBP') {
                return 'Pentadbir';
              }
              if (name.startsWith('Pensyarah (')) {
                name = name.replace(/^Pensyarah\s*\((.*)\)$/, '$1').trim();
              }
              if (/^[A-Z]{3,}$/.test(name)) {
                return name.charAt(0) + name.slice(1).toLowerCase();
              }
              return name;
            })();

            const roomCode = room ? (room.code || room.name) : slot.roomId;

            return (
              <div
                key={slot.id}
                className="bg-white rounded-xl p-3 sm:p-3.5 shadow-xs border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all space-y-2 flex flex-col justify-between"
              >
                {/* 1. Booker Identity & Day + Lock Icon (Header) */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
                    {bookerName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {slot.dayOfWeek}
                    </span>
                    {isLocked && (
                      <div className="inline-flex items-center justify-center p-1 rounded-md bg-amber-50 border border-amber-200/80 text-amber-600 shadow-2xs" title="Slot Terkunci">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Course Details (for non-locked academic classes) */}
                {!isLocked && (
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={`${slot.courseCode} — ${slot.courseName}`}>
                      {slot.courseCode} — {slot.courseName}
                    </div>
                  </div>
                )}

                {/* 3. Room & Time */}
                <div className="bg-slate-50 rounded-xl px-2.5 py-1.5 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 truncate">
                    <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate text-blue-700">{roomCode}</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-mono text-xs">{slot.startTime} – {slot.endTime}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-base text-slate-700">Tiada Jadual Akademik Dijumpai</p>
            <p className="text-xs text-slate-500 mt-1">Cuba tukar tapisan hari, ruang, atau kata kunci carian.</p>
          </div>
        )}
      </div>
    </div>
  );
};
