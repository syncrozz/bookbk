import React from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  StaffUser,
  PurposeCategory,
  AcademicExemption
} from '../types';
import { formatDateMalay } from '../utils/availabilityEngine';
import { ActiveTab } from './Header';
import { 
  CalendarDays, 
  BookOpen, 
  QrCode, 
  SlidersHorizontal, 
  Building2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Calendar, 
  Layers, 
  MapPin, 
  Laptop, 
  GraduationCap, 
  Lock 
} from 'lucide-react';

interface DashboardOverviewProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  staffList: StaffUser[];
  exemptions?: AcademicExemption[];
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  staffList,
  exemptions = [],
  onNavigateTab,
  onOpenBookingModal,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Real Database Stats (No mock or hardcoded numbers)
  const totalRooms = rooms.length;
  const confirmedBookings = adhocBookings.filter(b => b.status === 'CONFIRMED');
  const pendingBookings = adhocBookings.filter(b => b.status === 'PENDING');
  const todayBookings = adhocBookings.filter(b => b.date === todayStr && b.status === 'CONFIRMED');
  const totalStaff = staffList.length;
  
  // Room category distribution dynamically from database
  const lectureRoomsCount = rooms.filter(r => r.category === 'Bilik Kuliah').length;
  const labsCount = rooms.filter(r => r.category === 'Makmal Komputer').length;
  const hallsCount = rooms.filter(r => r.category === 'Dewan Kuliah').length;
  const specialCount = rooms.filter(r => r.category === 'Ruang Khas' || r.category === 'Surau').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. Compact Header Bar with Metrics */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Hab Pengurusan Ruang KPMBP
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20">
                Sesi 2 2026/2027
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {totalRooms} ruang rasmi terurus (Bilik Kuliah, Makmal Komputer, Dewan &amp; Ruang Khas).
            </p>
          </div>
        </div>

        {/* Dense Key Stats */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700">
          <div className="text-center px-2 border-r border-slate-700">
            <div className="text-sm sm:text-base font-bold text-white leading-none">{totalRooms}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Ruang</div>
          </div>
          <div className="text-center px-2 border-r border-slate-700">
            <div className="text-sm sm:text-base font-bold text-emerald-400 leading-none">{confirmedBookings.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Disahkan</div>
          </div>
          <div className="text-center px-2 border-r border-slate-700">
            <div className="text-sm sm:text-base font-bold text-amber-400 leading-none">{academicSchedule.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Kuliah</div>
          </div>
          <div className="text-center px-2">
            <div className="text-sm sm:text-base font-bold text-blue-400 leading-none">{totalStaff}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Staf Rasmi</div>
          </div>
        </div>
      </div>

      {/* STUDY WEEK EXEMPTION CARD */}
      {(() => {
        if (!exemptions || exemptions.length === 0) return null;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const active = exemptions.find(ex => ex.active && today >= ex.startDate && today <= ex.endDate);
        if (active) {
          return (
            <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-xl p-4 border border-emerald-600 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 bg-emerald-600 rounded-lg text-white shrink-0 mt-0.5 sm:mt-0 shadow-sm text-lg font-bold">
                  📚
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wide">
                      Study Week
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-white">
                      Sedang Berkuatkuasa
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">
                    {active.title}: {formatDateMalay(active.startDate)} hingga {formatDateMalay(active.endDate)}
                  </h3>
                  <p className="text-xs text-emerald-200/90 mt-0.5">
                    Jadual hakiki tidak menghalang tempahan. Pensyarah bebas membuat tempahan adhoc pada tempoh ini.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigateTab('matrix')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>Semak Matriks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
            return (
              <div className="bg-gradient-to-r from-emerald-950/70 via-teal-950/70 to-slate-900 text-white rounded-xl p-4 border border-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-emerald-700/60 rounded-lg text-white shrink-0 mt-0.5 sm:mt-0 shadow-sm text-lg font-bold">
                    📚
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 text-[10px] font-extrabold uppercase tracking-wide">
                        Study Week
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                        {diffDays} hari lagi
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">
                      {nextEx.title}: {formatDateMalay(nextEx.startDate)} hingga {formatDateMalay(nextEx.endDate)}
                    </h3>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      Pengecualian jadual hakiki akan bermula tidak lama lagi. Tempahan adhoc akan dibuka sepenuhnya.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onNavigateTab('matrix')}
                    className="px-3.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Lihat Jadual</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }
        }

        return null;
      })()}

      {/* Official Exam / Institutional Lock Announcement Banner */}
      {institutionalBlocks.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white rounded-xl p-4 border border-rose-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-rose-600 rounded-lg text-white shrink-0 mt-0.5 sm:mt-0 shadow-sm">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-400/30 text-[10px] font-extrabold uppercase tracking-wide">
                  Peperiksaan Akhir Kolej
                </span>
                <span className="text-xs text-rose-300 font-medium">
                  {institutionalBlocks.length} ruang dikunci
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Peperiksaan Akhir: 2 Nov – 16 Nov 2026 (08:00 AM – 12:00 AM)
              </h3>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Dewan Besar, Sri Penawar, Dewan Seminar &amp; Mini Seminar ditutup untuk tempahan biasa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('matrix')}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>Semak di Jadual</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigateTab('admin')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Urus Sekatan
            </button>
          </div>
        </div>
      )}

      {/* 2. Compact 2-Column Split: Ruang Ringkas & Tempahan Pantas Hari Ini */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column (5 cols): Kategori & Statistik Ruang */}
        <div className="lg:col-span-5 bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kategori Ruang</h2>
            </div>
            <button
              onClick={() => onNavigateTab('directory')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
            >
              Direktori Penuh →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium text-slate-700">Bilik Kuliah</span>
              </div>
              <span className="font-bold text-slate-900">{lectureRoomsCount} unit</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium text-slate-700">Makmal Komputer</span>
              </div>
              <span className="font-bold text-slate-900">{labsCount} unit</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-medium text-slate-700">Dewan Kuliah</span>
              </div>
              <span className="font-bold text-slate-900">{hallsCount} unit</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-medium text-slate-700">Ruang Khas &amp; Surau</span>
              </div>
              <span className="font-bold text-slate-900">{specialCount} unit</span>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
            <span>Sistem mengesan pertembungan jadual kuliah rasmi &amp; tempahan secara automatik.</span>
          </div>
        </div>

        {/* Right Column (7 cols): Tempahan Segera Ruang Utama */}
        <div className="lg:col-span-7 bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tempahan Pantas ({todayStr})</h2>
            </div>
            <button
              onClick={() => onNavigateTab('matrix')}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              Lihat Kalendar Ruang →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rooms.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/40 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">{r.name}</span>
                    {r.name !== r.code && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 font-semibold text-slate-700">
                        {r.code}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {r.block} • {r.capacity} pax
                  </div>
                </div>

                <button
                  onClick={() => onOpenBookingModal(r, todayStr, '08:30', '10:30', 'Kelas')}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                >
                  Tempah
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
            <span>Perlu semakan ketersediaan visual?</span>
            <button
              onClick={() => onNavigateTab('matrix')}
              className="font-bold text-blue-600 hover:underline"
            >
              Buka Matriks Kalendar →
            </button>
          </div>
        </div>

      </div>

      {/* 4. Real Operational Booking Records & Empty State */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-800" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Aktiviti &amp; Status Tempahan Semasa</h2>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {adhocBookings.length} Rekod
          </span>
        </div>

        {adhocBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {adhocBookings.slice(0, 6).map((b) => (
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
