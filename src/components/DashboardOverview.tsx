import React, { useState, useEffect } from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  StaffUser,
  PurposeCategory,
  AcademicExemption
} from '../types';
import { ActiveTab } from './Header';
import { 
  getCalendarMonthBounds, 
  getBookingsForMonth,
  getConfirmedBookingsForMonth,
  CalendarMonthBounds
} from '../utils/monthlyBookings';
import { 
  CalendarDays, 
  Building2, 
  ArrowRight, 
  Lock 
} from 'lucide-react';

function formatCleanDateRange(startStr: string, endStr: string): string {
  if (!startStr) return '';
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  
  const parseParts = (str: string) => {
    const parts = str.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  };

  const s = parseParts(startStr);
  if (!endStr || startStr === endStr) {
    return `${s.day} ${months[s.month - 1]} ${s.year}`;
  }
  const e = parseParts(endStr);
  const sMonth = months[s.month - 1];
  const eMonth = months[e.month - 1];

  if (s.year === e.year) {
    if (s.month === e.month) {
      return `${s.day}–${e.day} ${sMonth} ${s.year}`;
    }
    return `${s.day} ${sMonth} – ${e.day} ${eMonth} ${s.year}`;
  }
  return `${s.day} ${sMonth} ${s.year} – ${e.day} ${eMonth} ${e.year}`;
}

function formatTime12(t: string): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (h === 24 || h === 0) {
    return `12:${m} AM`;
  }
  if (h === 12) {
    return `12:${m} PM`;
  }
  const ampm = h > 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h;
  return `${displayH}:${m} ${ampm}`;
}

interface DashboardOverviewProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  staffList: StaffUser[];
  exemptions?: AcademicExemption[];
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenBookingModal?: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  staffList,
  exemptions = [],
  onNavigateTab,
  onOpenBookingModal: _onOpenBookingModal,
}) => {
  // Real Database Stats (No mock or hardcoded numbers)
  const [monthBounds, setMonthBounds] = useState<CalendarMonthBounds>(() => getCalendarMonthBounds(new Date()));

  useEffect(() => {
    const syncMonth = () => {
      const next = getCalendarMonthBounds(new Date());
      setMonthBounds((prev) => (prev.startDate === next.startDate ? prev : next));
    };
    const intervalId = window.setInterval(syncMonth, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const totalRooms = rooms.length;
  const monthlyBookings = getBookingsForMonth(adhocBookings, monthBounds.startDate);
  const monthlyConfirmedBookings = getConfirmedBookingsForMonth(adhocBookings, monthBounds.startDate);
  const totalStaff = staffList.length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. Compact Header Bar with Metrics */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                Pengurusan Ruang KPMBP
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20 shrink-0">
                Sesi 2 2026/2027
              </span>
            </div>
          </div>
        </div>

        {/* Balanced Equal-Width KPI Grid */}
        <div className="w-full sm:w-auto sm:shrink-0 sm:min-w-[344px] md:min-w-[384px] lg:min-w-[420px] bg-slate-800/75 rounded-lg border border-slate-700/80 grid grid-cols-2 sm:grid-cols-4">
          {/* KPI 1: RUANG */}
          <div className="flex flex-col items-center justify-center text-center px-2.5 md:px-3 py-2.5 border-r border-b sm:border-b-0 border-slate-700/70 min-w-0">
            <div className="text-base sm:text-lg font-bold text-white leading-none tabular-nums">
              {totalRooms}
            </div>
            <div className="text-[10px] text-slate-300 uppercase font-semibold tracking-wider leading-tight mt-1.5 whitespace-nowrap">
              RUANG
            </div>
          </div>

          {/* KPI 2: TEMPAHAN (BULAN INI) */}
          <div className="flex flex-col items-center justify-center text-center px-2.5 md:px-3 py-2.5 border-b sm:border-b-0 sm:border-r border-slate-700/70 min-w-0">
            <div className="text-base sm:text-lg font-bold text-emerald-400 leading-none tabular-nums">
              {monthlyConfirmedBookings.length}
            </div>
            <div className="text-[10px] text-slate-300 uppercase font-semibold tracking-wider leading-tight mt-1.5 whitespace-nowrap">
              TEMPAHAN
            </div>
          </div>

          {/* KPI 3: KULIAH */}
          <div className="flex flex-col items-center justify-center text-center px-2.5 md:px-3 py-2.5 border-r border-slate-700/70 min-w-0">
            <div className="text-base sm:text-lg font-bold text-amber-400 leading-none tabular-nums">
              {academicSchedule.length}
            </div>
            <div className="text-[10px] text-slate-300 uppercase font-semibold tracking-wider leading-tight mt-1.5 whitespace-nowrap">
              KULIAH
            </div>
          </div>

          {/* KPI 4: STAF RASMI */}
          <div className="flex flex-col items-center justify-center text-center px-2.5 md:px-3 py-2.5 min-w-0">
            <div className="text-base sm:text-lg font-bold text-blue-400 leading-none tabular-nums">
              {totalStaff}
            </div>
            <div className="text-[10px] text-slate-300 uppercase font-semibold tracking-wider leading-tight mt-1.5 whitespace-nowrap">
              STAF RASMI
            </div>
          </div>
        </div>
      </div>

      {/* STUDY WEEK EXEMPTION CARD — MINIMAL STATUS CARD (SIMPLE & SHARP) */}
      {(() => {
        if (!exemptions || exemptions.length === 0) return null;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const active = exemptions.find(ex => ex.active && today >= ex.startDate && today <= ex.endDate);
        if (active) {
          const dateRange = formatCleanDateRange(active.startDate, active.endDate);
          return (
            <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 text-white rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 border border-emerald-500/50 shadow-sm overflow-x-auto scrollbar-thin animate-in fade-in">
              <div className="flex items-center justify-between gap-3 whitespace-nowrap min-w-max">
                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0 text-sm shadow-xs">
                    📚
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-xs shrink-0">
                    AKTIF
                  </span>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight shrink-0">
                    Study Week | {dateRange}
                  </h3>
                  <span className="text-emerald-400/60 font-bold shrink-0">•</span>
                  <p className="text-[11px] sm:text-xs text-emerald-200/90 shrink-0">
                    Slot Available For Booking
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onNavigateTab('matrix')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Semak Matriks</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const upcomingList = exemptions
          .filter(ex => ex.active && ex.startDate > today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        
        if (upcomingList.length > 0) {
          const nextEx = upcomingList[0];
          const diffDays = Math.round((new Date(nextEx.startDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 14) {
            const dateRange = formatCleanDateRange(nextEx.startDate, nextEx.endDate);
            return (
              <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 text-white rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 border border-emerald-600/40 shadow-sm overflow-x-auto scrollbar-thin animate-in fade-in">
                <div className="flex items-center justify-between gap-3 whitespace-nowrap min-w-max">
                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700/30 border border-emerald-600/40 text-emerald-300 flex items-center justify-center shrink-0 text-sm shadow-xs">
                      📚
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                      {diffDays} HARI LAGI
                    </span>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight shrink-0">
                      Study Week | {dateRange}
                    </h3>
                    <span className="text-emerald-400/60 font-bold shrink-0">•</span>
                    <p className="text-[11px] sm:text-xs text-emerald-200/80 shrink-0">
                      Slot Available For Booking
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onNavigateTab('matrix')}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>Semak Matriks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        }

        return null;
      })()}

      {/* PEPERIKSAAN AKHIR CARD — MINIMAL STATUS CARD (SIMPLE & SHARP) */}
      {institutionalBlocks.length > 0 && (() => {
        const examBlocks = institutionalBlocks.filter(b => b.category === 'EXAM' || b.title?.toLowerCase().includes('peperiksaan') || b.reason?.toLowerCase().includes('peperiksaan'));
        const activeBlocks = examBlocks.length > 0 ? examBlocks : institutionalBlocks;
        const uniqueLockedRoomIds = Array.from(new Set(activeBlocks.map(b => b.roomId)));
        const lockedRoomsCount = uniqueLockedRoomIds.length || activeBlocks.length;

        const dates = activeBlocks.map(b => b.date).filter(Boolean).sort();
        const endDates = activeBlocks.map(b => b.endDate || b.date).filter(Boolean).sort().reverse();
        const startDate = dates[0] || '2026-11-02';
        const endDate = endDates[0] || '2026-11-16';

        const startTimes = activeBlocks.map(b => b.startTime).filter(Boolean).sort();
        const endTimes = activeBlocks.map(b => b.endTime).filter(Boolean).sort().reverse();
        const startTime = startTimes[0] || '08:00';
        const endTime = endTimes[0] || '12:00';

        const dateRangeStr = formatCleanDateRange(startDate, endDate);
        const timeRangeStr = `${formatTime12(startTime)} – ${formatTime12(endTime)}`;

        return (
          <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-900 text-white rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 border border-rose-500/50 shadow-sm overflow-x-auto scrollbar-thin animate-in fade-in">
            <div className="flex items-center justify-between gap-3 whitespace-nowrap min-w-max">
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-rose-600/30 border border-rose-500/40 text-rose-300 flex items-center justify-center shrink-0 text-sm shadow-xs">
                  <Lock className="w-4 h-4 text-rose-400" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40 text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                  AKTIF
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/60 text-[10px] font-bold uppercase tracking-wide shrink-0">
                  {lockedRoomsCount} RUANG DIKUNCI
                </span>
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight shrink-0">
                  Peperiksaan Akhir
                </h3>
                <span className="text-rose-400/60 font-bold shrink-0">•</span>
                <span className="text-[11px] sm:text-xs text-rose-200/90 font-medium shrink-0">
                  {dateRangeStr}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigateTab('matrix')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Semak Jadual</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. Real Operational Booking Records & Empty State */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-800" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Aktiviti &amp; Status Tempahan Semasa</h2>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {monthlyBookings.length} Rekod
          </span>
        </div>

        {monthlyBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyBookings.slice(0, 6).map((b) => (
              <div key={b.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold bg-slate-900 text-emerald-400 px-2 py-0.5 rounded text-[10px]">
                    {b.id}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                    b.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {b.status}
                  </span>
                </div>
                <div className="font-bold text-slate-900">{b.roomName}</div>
                <div className="text-slate-600 text-[11px]">
                  {b.date} • {b.startTime} - {b.endTime}
                </div>
                <div className="text-slate-500 text-[10px] truncate">
                  Pemohon: {b.applicantName} ({b.department})
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-bold text-slate-700 text-sm">Tiada data tempahan lagi.</p>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Data akan dipaparkan secara automatik sebaik sahaja staf mula membuat tempahan ad-hoc ke dalam sistem.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
