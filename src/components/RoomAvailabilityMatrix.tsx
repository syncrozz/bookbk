import React, { useState, useEffect } from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  RoomCategory,
  PurposeCategory,
  AcademicExemption
} from '../types';
import { verifyAdminPin } from '../lib/firebase';
import { 
  checkRoomAvailability, 
  formatDateMalay, 
  getMalayDayOfWeek, 
  calculateDurationText,
  findActiveExemption,
  getExemptionForDate,
  isTimeOverlap
} from '../utils/availabilityEngine';
import { formatCleanDateRange } from '../utils/exemptionDates';
import {
  ALL_BOOKING_TIME_SLOTS,
  DAY_TIME_SLOTS,
  NIGHT_TIME_SLOTS,
  TimeSlot,
  isTimeRangeNight
} from '../utils/timeSlots';
import { formatLevel } from '../utils/storage';
import { getShortName } from '../utils/displayName';
import { 
  Calendar, 
  Filter, 
  Search, 
  Info, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building,
  Sparkles,
  Moon,
  Sun,
  X,
  Lock,
  Edit3,
  Save,
  RotateCcw,
  KeyRound,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';

interface RoomAvailabilityMatrixProps {
  rooms: Room[];
  academicSchedule: AcademicScheduleSlot[];
  adhocBookings: AdHocBooking[];
  institutionalBlocks: InstitutionalBlock[];
  exemptions?: AcademicExemption[];
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
  onViewRoomDetails: (room: Room) => void;
  isAdmin?: boolean;
  onAdminUnlock?: () => void;
  onUpdateAcademicSlot?: (slot: AcademicScheduleSlot) => Promise<void> | void;
  onUpdateBooking?: (booking: AdHocBooking) => Promise<void> | void;
  onUpdateBlock?: (block: InstitutionalBlock) => Promise<void> | void;
}

export const RoomAvailabilityMatrix: React.FC<RoomAvailabilityMatrixProps> = ({
  rooms,
  academicSchedule,
  adhocBookings,
  institutionalBlocks,
  exemptions = [],
  onOpenBookingModal,
  onViewRoomDetails,
  isAdmin = false,
  onAdminUnlock,
  onUpdateAcademicSlot,
  onUpdateBooking,
  onUpdateBlock
}) => {
  // Default to today's live current date in YYYY-MM-DD format
  const getTodayFormatted = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormatted);

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const handleToday = () => {
    setSelectedDate(getTodayFormatted());
  };

  const [categoryFilter, setCategoryFilter] = useState<RoomCategory | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    room: Room;
    startTime: string;
    endTime: string;
    check: ReturnType<typeof checkRoomAvailability>;
  } | null>(null);

  // Remark editing state (Admin)
  const [isEditingRemark, setIsEditingRemark] = useState<boolean>(false);
  const [editRemarkValue, setEditRemarkValue] = useState<string>('');
  const [editClassValue, setEditClassValue] = useState<string>('');
  const [editSubjectValue, setEditSubjectValue] = useState<string>('');
  const [editLecturerValue, setEditLecturerValue] = useState<string>('');
  const [editReasonValue, setEditReasonValue] = useState<string>('');
  const [isSavingRemark, setIsSavingRemark] = useState<boolean>(false);
  const [remarkSuccessMsg, setRemarkSuccessMsg] = useState<string | null>(null);
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  const handleOpenCellInspection = (info: {
    room: Room;
    startTime: string;
    endTime: string;
    check: ReturnType<typeof checkRoomAvailability>;
  }) => {
    setSelectedCellInfo(info);
    setIsEditingRemark(false);
    setRemarkSuccessMsg(null);
    setShowAdminPinPrompt(false);
    setAdminPinError(null);
    setAdminPinInput('');

    if (info.check.status === 'OCCUPIED_ACADEMIC' && info.check.academicSlot) {
      const slot = info.check.academicSlot;
      setEditRemarkValue(slot.remark || (slot.courseCode === 'TERKUNCI' ? 'LOCKED' : slot.courseCode));
      setEditClassValue(slot.className || '');
      setEditSubjectValue(slot.courseName || '');
      setEditLecturerValue(slot.lecturerName || '');
    } else if (info.check.status === 'BLOCKED' && info.check.institutionalBlock) {
      const block = info.check.institutionalBlock;
      setEditRemarkValue(block.title || '');
      setEditReasonValue(block.reason || '');
    } else if ((info.check.status === 'OCCUPIED_BOOKING' || info.check.status === 'PENDING_BOOKING') && info.check.existingBooking) {
      const b = info.check.existingBooking;
      setEditRemarkValue(b.title || '');
      setEditReasonValue(b.notes || '');
    }
  };

  const handleStartEditing = () => {
    if (!isAdmin) {
      setShowAdminPinPrompt(true);
      return;
    }
    setIsEditingRemark(true);
    setRemarkSuccessMsg(null);
  };

  const handleVerifyAdminPinForEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = adminPinInput.trim();
    if (!cleanPin) {
      setAdminPinError('Sila masukkan PIN Pentadbir.');
      return;
    }
    const res = await verifyAdminPin(cleanPin);
    if (res.success) {
      if (onAdminUnlock) {
        onAdminUnlock();
      }
      setShowAdminPinPrompt(false);
      setIsEditingRemark(true);
      setAdminPinInput('');
      setAdminPinError(null);
    } else {
      setAdminPinError(res.errorMsg || 'PIN Pentadbir tidak sah.');
    }
  };

  const handleSaveRemark = async () => {
    if (!selectedCellInfo) return;
    setIsSavingRemark(true);
    setRemarkSuccessMsg(null);

    try {
      if (selectedCellInfo.check.status === 'OCCUPIED_ACADEMIC' && selectedCellInfo.check.academicSlot) {
        const cleanRemark = editRemarkValue.trim();
        const updatedSlot: AcademicScheduleSlot = {
          ...selectedCellInfo.check.academicSlot,
          remark: cleanRemark,
          courseCode: cleanRemark || selectedCellInfo.check.academicSlot.courseCode,
          className: editClassValue.trim() || selectedCellInfo.check.academicSlot.className,
          courseName: editSubjectValue.trim() || selectedCellInfo.check.academicSlot.courseName,
          lecturerName: editLecturerValue.trim() || selectedCellInfo.check.academicSlot.lecturerName,
        };

        if (onUpdateAcademicSlot) {
          await onUpdateAcademicSlot(updatedSlot);
        }

        setSelectedCellInfo(prev => prev ? {
          ...prev,
          check: {
            ...prev.check,
            academicSlot: updatedSlot,
          }
        } : null);
      } else if (selectedCellInfo.check.status === 'BLOCKED' && selectedCellInfo.check.institutionalBlock) {
        const cleanTitle = editRemarkValue.trim();
        const updatedBlock: InstitutionalBlock = {
          ...selectedCellInfo.check.institutionalBlock,
          title: cleanTitle || selectedCellInfo.check.institutionalBlock.title,
          reason: editReasonValue.trim() || selectedCellInfo.check.institutionalBlock.reason,
        };

        if (onUpdateBlock) {
          await onUpdateBlock(updatedBlock);
        }

        setSelectedCellInfo(prev => prev ? {
          ...prev,
          check: {
            ...prev.check,
            institutionalBlock: updatedBlock,
          }
        } : null);
      } else if (
        (selectedCellInfo.check.status === 'OCCUPIED_BOOKING' || selectedCellInfo.check.status === 'PENDING_BOOKING') &&
        selectedCellInfo.check.existingBooking
      ) {
        const cleanTitle = editRemarkValue.trim();
        const updatedBooking: AdHocBooking = {
          ...selectedCellInfo.check.existingBooking,
          title: cleanTitle || selectedCellInfo.check.existingBooking.title,
          notes: editReasonValue.trim() || selectedCellInfo.check.existingBooking.notes,
        };

        if (onUpdateBooking) {
          await onUpdateBooking(updatedBooking);
        }

        setSelectedCellInfo(prev => prev ? {
          ...prev,
          check: {
            ...prev.check,
            existingBooking: updatedBooking,
          }
        } : null);
      }

      setRemarkSuccessMsg('🟢 Remark berjaya disimpan dan diselaraskan!');
      setTimeout(() => {
        setIsEditingRemark(false);
      }, 1200);
    } catch (err: any) {
      alert(`Ralat menyimpan remark: ${err?.message || 'Ralat'}`);
    } finally {
      setIsSavingRemark(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCellInfo) {
        setSelectedCellInfo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCellInfo]);

  // Keutamaan susunan kategori Matrix paparan: 1. Bilik Kuliah, 2. Ruang Khas & Dewan, 3. Makmal Komputer
  const CATEGORY_ORDER: Record<string, number> = {
    'Bilik Kuliah': 1,
    'Ruang Khas': 2,
    'Dewan Kuliah': 2,
    'Surau': 2,
    'Makmal Komputer': 3,
  };

  // Filtered and category-sorted rooms
  const filteredRooms = rooms
    .filter(r => {
      if (categoryFilter !== 'Semua') {
        if (categoryFilter === 'Bilik Kuliah' && r.category !== 'Bilik Kuliah') return false;
        if (categoryFilter === 'Ruang Khas' && r.category !== 'Ruang Khas' && r.category !== 'Dewan Kuliah' && r.category !== 'Surau') return false;
        if (categoryFilter === 'Makmal Komputer' && r.category !== 'Makmal Komputer') return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.block.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER[a.category] ?? 99;
      const orderB = CATEGORY_ORDER[b.category] ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return 0; // Kekalkan susunan asal dalam kategori yang sama
    });

  const activeSlots = ALL_BOOKING_TIME_SLOTS;

  return (
    <div className="space-y-6">

      {/* Header Banner - Responsive Unified Toolbar */}
      <div className="bg-white rounded-xl p-2 sm:p-2.5 border border-slate-200 shadow-xs">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 text-xs">
          {/* 1. Kumpulan Tarikh: < [Ikon Kalendar + Tarikh + Hari] > + Hari Ini */}
          <div className="order-1 lg:order-1 flex items-center gap-1.5 shrink-0 max-w-full">
            <div className="flex items-center h-9 bg-slate-50 border border-slate-300 hover:border-emerald-400 rounded-lg p-0.5 shadow-2xs transition-all shrink-0">
              <button
                type="button"
                onClick={handlePrevDay}
                className="h-full px-2 hover:bg-white text-slate-600 hover:text-emerald-700 rounded-md transition cursor-pointer flex items-center justify-center"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <label 
                htmlFor="matrix-date-input"
                className="h-full flex items-center gap-1.5 px-2 cursor-pointer group select-none"
                title="Klik untuk memilih tarikh"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                <input
                  id="matrix-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {}
                  }}
                  className="bg-transparent font-bold text-slate-900 text-xs outline-none cursor-pointer w-[92px] sm:w-[98px] select-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <span className="text-[10px] sm:text-[11px] bg-emerald-100 group-hover:bg-emerald-200 text-emerald-800 font-semibold px-1.5 py-0.5 rounded transition-colors select-none shrink-0">
                  {getMalayDayOfWeek(selectedDate)}
                </span>
              </label>

              <button
                type="button"
                onClick={handleNextDay}
                className="h-full px-2 hover:bg-white text-slate-600 hover:text-emerald-700 rounded-md transition cursor-pointer flex items-center justify-center"
                title="Hari Berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedDate !== getTodayFormatted() && (
              <button
                type="button"
                onClick={handleToday}
                className="h-9 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-2.5 rounded-lg transition shadow-2xs cursor-pointer shrink-0"
              >
                Hari Ini
              </button>
            )}
          </div>

          {/* 2. Dropdown Kategori (Mobile: Baris 1 bersama tarikh / Desktop: Posisi 3 selepas carian) */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="order-2 lg:order-3 h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer flex-1 sm:flex-initial lg:w-auto shrink-0 max-w-full"
          >
            <option value="Semua">Semua ({rooms.length})</option>
            <option value="Bilik Kuliah">Bilik Kuliah</option>
            <option value="Ruang Khas">Ruang Khas</option>
            <option value="Makmal Komputer">Makmal Komputer</option>
          </select>

          {/* 3. Kotak Carian Ruang (Mobile: Baris 2 lebar penuh / Desktop: Posisi 2 flex-1 max-w-[360px]) */}
          <div className="order-3 lg:order-2 w-full lg:w-auto lg:flex-1 min-w-[200px] lg:max-w-[360px] relative h-9">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Cari ruang / bilik…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg pl-8 pr-7 text-slate-900 font-medium text-xs placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                title="Kosongkan carian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 4. Petunjuk Status (Mobile: Baris 3 kecil / Desktop: Hujung Kanan ml-auto) */}
          <div className="order-4 lg:order-4 w-full lg:w-auto lg:ml-auto flex items-center gap-3 text-[11px] font-medium text-slate-700 shrink-0 pt-0.5 lg:pt-0">
            <div className="flex items-center gap-1.5" title="Ruang kosong sedia ditempah">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Kosong</span>
            </div>
            <div className="flex items-center gap-1.5" title="Jadual kuliah semester rasmi kolej">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>Jadual</span>
            </div>
            <div className="flex items-center gap-1.5" title="Tempahan ad-hoc staf">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>Ad-hoc</span>
            </div>
            {filteredRooms.length !== rooms.length && (
              <span className="hidden xl:inline-block text-[10px] text-slate-400 pl-1 border-l border-slate-200">
                {filteredRooms.length}/{rooms.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* STUDY WEEK ACTIVE EXEMPTION BANNER */}
      {(() => {
        const activeEx = getExemptionForDate(selectedDate, exemptions);
        if (!activeEx) return null;
        return (
          <div className="bg-emerald-600 text-white rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs border border-emerald-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
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
                    Study Week | {formatCleanDateRange(activeEx.startDate, activeEx.endDate)}
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-emerald-100/90 mt-0.5 truncate">
                  Jadual tidak aktif. Tempahan adhoc dibenarkan.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-emerald-100 bg-emerald-700/60 px-2.5 py-1 rounded-lg border border-emerald-400/30 self-start sm:self-auto font-medium shrink-0">
              Skop: {activeEx.scope === 'ALL_ROOMS' ? 'Semua Ruang' : activeEx.scope === 'BILIK_KULIAH' ? 'Bilik Kuliah Sahaja' : 'Ruang Terpilih'}
            </div>
          </div>
        );
      })()}

      {/* MATRIX TABLE CONTAINER */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-220px)] min-h-[460px] relative">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white">
              <tr className="border-b border-slate-200 h-9">
                <th rowSpan={2} className="py-2 px-3 sm:px-4 font-bold sticky left-0 top-0 z-30 bg-slate-100 text-slate-800 text-xs uppercase tracking-wider min-w-[120px] sm:min-w-[160px] border-r border-slate-200 shadow-sm">
                  Ruang Kuliah
                </th>
                <th colSpan={DAY_TIME_SLOTS.length} className="py-2 px-3 font-bold text-center bg-amber-100/90 text-amber-950 border-r border-slate-200 text-xs tracking-wider sticky top-0 z-20 shadow-xs">
                  ☀️ WAKTU SIANG (08:30 – 17:30)
                </th>
                <th colSpan={NIGHT_TIME_SLOTS.length} className="py-2 px-3 font-bold text-center bg-indigo-900 text-indigo-100 text-xs tracking-wider sticky top-0 z-20 shadow-xs">
                  🌙 WAKTU MALAM (20:00 – 23:00)
                </th>
              </tr>
              <tr className="bg-slate-50 text-slate-700 text-xs border-b border-slate-200 divide-x divide-slate-200 h-9">
                {DAY_TIME_SLOTS.map(slot => (
                  <th key={slot.id} className="py-2 px-2 font-bold text-center min-w-[105px] max-w-[115px] bg-amber-50 text-slate-900 sticky top-9 z-20 border-b border-slate-300 shadow-xs">
                    <div className="text-slate-900 font-mono text-[11px] font-bold">{slot.start}</div>
                  </th>
                ))}
                {NIGHT_TIME_SLOTS.map(slot => (
                  <th key={slot.id} className="py-2 px-2 font-bold text-center min-w-[105px] max-w-[115px] bg-indigo-950 text-indigo-100 sticky top-9 z-20 border-b border-indigo-900 shadow-xs">
                    <div className="text-indigo-200 font-mono text-[11px] flex items-center justify-center gap-1 font-bold">
                      <Moon className="w-2.5 h-2.5 text-indigo-300" />
                      <span>{slot.start}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRooms.map(room => {
                return (
                  <tr key={room.id} className="hover:bg-slate-50 transition divide-x divide-slate-100">
                    {/* Room Info Sticky Cell */}
                    <td className="py-2.5 px-2.5 sm:py-3 sm:px-4 sticky left-0 z-10 bg-white font-medium border-r border-slate-200 shadow-sm">
                      <div className="flex items-center w-full">
                        <button
                          onClick={() => onViewRoomDetails(room)}
                          className="w-full font-bold text-slate-900 hover:text-emerald-600 transition flex items-center justify-between gap-1.5 text-left"
                        >
                          <span className="shrink-0">{room.code}</span>
                          {room.hasAircond && (
                            <span 
                              className="text-[10px] bg-cyan-100 text-cyan-800 px-1 py-0.5 rounded font-bold border border-cyan-300 shrink-0 whitespace-nowrap ml-auto"
                              title="Aircond"
                            >
                              💠
                            </span>
                          )}
                        </button>
                      </div>
                      {/* Disembunyikan / dipadam dari paparan atas permintaan pengguna */}
                      <div className="hidden text-[10px] text-slate-400">
                        {room.block} ({formatLevel(room.level)})
                      </div>
                    </td>

                    {/* Time Slots */}
                    {activeSlots.map(slot => {
                      // Check if room disallows night booking for night slots
                      if (slot.period === 'NIGHT' && room.allowNightBooking === false) {
                        return (
                          <td key={slot.id} className="p-1.5 text-center bg-slate-50/50">
                            <div 
                              className="w-full h-11 rounded-lg bg-slate-100 border border-dashed border-slate-200 text-slate-400 text-[10px] font-medium flex flex-col items-center justify-center cursor-not-allowed"
                              title={`Ruang ${room.code} tidak dibuka untuk tempahan waktu malam.`}
                            >
                              <span className="text-slate-500 font-semibold">Tutup Malam</span>
                              <span className="text-[9px] text-slate-400">Khas Siang</span>
                            </div>
                          </td>
                        );
                      }

                      const check = checkRoomAvailability(
                        room, 
                        selectedDate, 
                        slot.start, 
                        slot.end, 
                        academicSchedule, 
                        adhocBookings, 
                        institutionalBlocks,
                        exemptions
                      );

                      const isAvail = check.status === 'AVAILABLE';
                      const isAcad = check.status === 'OCCUPIED_ACADEMIC';
                      const isAdhoc = check.status === 'OCCUPIED_BOOKING' || check.status === 'PENDING_BOOKING';
                      const isBlocked = check.status === 'BLOCKED';

                      const dayOfWeek = getMalayDayOfWeek(selectedDate);
                      const underlyingSlot = (isAvail && check.academicExemption)
                        ? academicSchedule.find(s => 
                            s.roomId === room.id && 
                            s.dayOfWeek === dayOfWeek && 
                            isTimeOverlap(slot.start, slot.end, s.startTime, s.endTime)
                          )
                        : undefined;

                      return (
                        <td key={slot.id} className={`p-1.5 text-center min-w-[105px] max-w-[115px] overflow-hidden ${slot.period === 'NIGHT' ? 'bg-indigo-50/20' : ''}`}>
                          {isAvail && underlyingSlot && (
                            <button
                              onClick={() => onOpenBookingModal(room, selectedDate, slot.start, slot.end, 'Kelas')}
                              className="w-full h-11 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/80 hover:bg-emerald-600 hover:text-white text-emerald-600 transition flex items-center justify-center group shadow-2xs cursor-pointer"
                              title="Hakiki (Dikecualikan)"
                              aria-label="Hakiki (Dikecualikan)"
                            >
                              <FileText className="w-4.5 h-4.5 text-emerald-600 group-hover:text-white transition-transform group-hover:scale-110" />
                            </button>
                          )}

                          {isAvail && !underlyingSlot && (
                            <button
                              onClick={() => onOpenBookingModal(room, selectedDate, slot.start, slot.end, 'Kelas')}
                              className={`w-full h-11 rounded-xl border font-bold transition flex flex-col items-center justify-center p-1 group shadow-2xs ${
                                slot.period === 'NIGHT'
                                  ? 'bg-indigo-50/80 hover:bg-indigo-600 hover:text-white border-indigo-200 text-indigo-900'
                                  : 'bg-emerald-50 hover:bg-emerald-500 hover:text-white border-emerald-300/80 text-emerald-800'
                              }`}
                              title={`Klik untuk Tempah ${room.code} | Slot: ${slot.start} – ${slot.end}`}
                            >
                              <span className="text-[11px] flex items-center justify-center font-bold">
                                {slot.period === 'NIGHT' ? (
                                  <Moon className="w-3.5 h-3.5 text-indigo-600 group-hover:text-white transition-transform group-hover:scale-110" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white transition-transform group-hover:scale-110" />
                                )}
                              </span>
                              <span className="text-[9px] opacity-80 font-mono group-hover:text-white font-medium">
                                {slot.start}
                              </span>
                            </button>
                          )}

                          {isAcad && (() => {
                            const acadSlot = check.academicSlot;
                            let displayClassName = acadSlot?.className || 'Slot Terkunci';
                            let isLecturerText = false;

                            // If generic or wrapped with Pensyarah (...), extract only the lecturer name
                            if (
                              displayClassName === 'Pengajian / Aktiviti' ||
                              displayClassName.startsWith('Pensyarah (') ||
                              displayClassName === 'TERKUNCI'
                            ) {
                              if (acadSlot?.lecturerName) {
                                displayClassName = acadSlot.lecturerName;
                                isLecturerText = true;
                              } else if (displayClassName.startsWith('Pensyarah (') && displayClassName.endsWith(')')) {
                                displayClassName = displayClassName.slice(11, -1).trim();
                                isLecturerText = true;
                              }
                            }

                            if (isLecturerText) {
                              displayClassName = getShortName(displayClassName);
                            } else if (/^[A-Z]{3,}$/.test(displayClassName)) {
                              // Format single-word all-caps name (e.g. IBRAHIM -> Ibrahim)
                              displayClassName = displayClassName.charAt(0) + displayClassName.slice(1).toLowerCase();
                            }

                            const rawRemark = acadSlot?.remark || (acadSlot?.courseCode === 'TERKUNCI' ? 'LOCKED' : acadSlot?.courseCode) || '';
                            const isLockedRemark = !rawRemark || 
                              rawRemark.toUpperCase() === 'LOCKED' || 
                              rawRemark.toUpperCase() === 'TERKUNCI' || 
                              rawRemark.toUpperCase() === 'LOCK' || 
                              rawRemark.toUpperCase() === 'DIKUNCI';

                            // Hadkan paparan teks kepada maksimum 20 aksara agar petak kekal kemas
                            const displayRemark = rawRemark.length > 20 ? `${rawRemark.slice(0, 19)}…` : rawRemark;

                            return (
                              <button
                                onClick={() => handleOpenCellInspection({ room, startTime: slot.start, endTime: slot.end, check })}
                                className="w-full h-11 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 font-semibold transition p-1 text-center flex flex-col items-center justify-center overflow-hidden group shadow-2xs active:scale-[0.98]"
                                title={`Jadual Kuliah Semester Rasmi KPMBP (Bukan Tempahan Ad-hoc): ${acadSlot?.className || displayClassName} - ${rawRemark} (${acadSlot?.lecturerName || displayClassName})`}
                              >
                                <div className="flex items-center justify-center gap-1 w-full text-[9px] font-bold text-rose-700 tracking-tight">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                  <span className="truncate max-w-[95px]">{displayClassName}</span>
                                </div>
                                <div className="text-[10px] truncate max-w-[95px] text-rose-950 font-extrabold flex items-center justify-center gap-1 mx-auto">
                                  <span className="truncate block max-w-full">
                                    {isLockedRemark ? (
                                      <Lock className="w-3 h-3 text-rose-600 shrink-0 inline-block" />
                                    ) : (
                                      displayRemark
                                    )}
                                  </span>
                                  {isAdmin && <span className="opacity-0 group-hover:opacity-100 text-[8px] text-rose-600 transition shrink-0" title="Admin: Klik untuk ubah remark">✏️</span>}
                                </div>
                              </button>
                            );
                          })()}

                          {isAdhoc && (
                            <button
                              onClick={() => handleOpenCellInspection({ room, startTime: slot.start, endTime: slot.end, check })}
                              className="w-full h-11 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-semibold transition p-1 text-center flex flex-col items-center justify-center overflow-hidden group"
                              title={check.conflictReason}
                            >
                              <div className="text-[10px] font-bold truncate max-w-[95px] text-amber-950 mx-auto">
                                🟨 {getShortName(check.existingBooking?.applicantName ?? '')}
                              </div>
                              <div className="text-[9px] truncate max-w-[95px] text-amber-800 flex items-center justify-center gap-1 mx-auto">
                                <span className="truncate block max-w-full">{(() => {
                                  const text = check.existingBooking?.title || check.existingBooking?.purposeCategory || '';
                                  return text.length > 20 ? `${text.slice(0, 19)}…` : text;
                                })()}</span>
                                {isAdmin && <span className="opacity-0 group-hover:opacity-100 text-[8px] text-amber-600 transition shrink-0" title="Admin: Klik untuk ubah remark">✏️</span>}
                              </div>
                            </button>
                          )}

                          {isBlocked && (() => {
                            const block = check.institutionalBlock;
                            const blockLabel = block?.title || (block?.category === 'EXAM' ? 'Peperiksaan Akhir' : 'Program Kolej');
                            const isBlockedLocked = blockLabel.toUpperCase() === 'BLOCKED' || blockLabel.toUpperCase() === 'LOCKED' || blockLabel.toUpperCase() === 'TERKUNCI';
                            const displayBlockLabel = blockLabel.length > 20 ? `${blockLabel.slice(0, 19)}…` : blockLabel;

                            return (
                              <button
                                onClick={() => handleOpenCellInspection({ room, startTime: slot.start, endTime: slot.end, check })}
                                className="w-full h-11 rounded-xl bg-[#0b1329] hover:bg-[#131d38] border border-slate-800/90 text-white font-semibold transition p-1 text-center flex flex-col items-center justify-center overflow-hidden shadow-2xs cursor-pointer group"
                                title={check.conflictReason}
                              >
                                <div className="text-[10px] font-extrabold truncate max-w-[95px] text-amber-400 flex items-center justify-center gap-1.5 leading-tight mx-auto">
                                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="text-[10px] leading-none shrink-0 select-none">⚫</span>
                                </div>
                                <div className="text-[10px] font-bold text-white truncate max-w-[95px] leading-tight mt-0.5 flex items-center justify-center gap-1 mx-auto">
                                  <span className="truncate block max-w-full">{isBlockedLocked ? '' : displayBlockLabel}</span>
                                  {isAdmin && <span className="opacity-0 group-hover:opacity-100 text-[8px] text-amber-300 transition shrink-0" title="Admin: Klik untuk ubah remark">✏️</span>}
                                </div>
                              </button>
                            );
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP MODAL FOR CELL INSPECTION */}
      {selectedCellInfo && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Maklumat Slot Ruang</span>
                <span className="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  {selectedCellInfo.room.code}
                </span>
              </h3>
              <button
                onClick={() => setSelectedCellInfo(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div>
                <strong className="text-slate-900">Ruang:</strong> {selectedCellInfo.room.name} ({selectedCellInfo.room.block})
              </div>
              <div>
                <strong className="text-slate-900">Masa:</strong> {selectedCellInfo.startTime} – {selectedCellInfo.endTime} ({calculateDurationText(selectedCellInfo.startTime, selectedCellInfo.endTime)}) • {formatDateMalay(selectedDate)}
              </div>

              {/* SUCCESS NOTICE */}
              {remarkSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{remarkSuccessMsg}</span>
                </div>
              )}

              {/* ADMIN PIN VERIFICATION PROMPT */}
              {showAdminPinPrompt && (
                <form onSubmit={handleVerifyAdminPinForEdit} className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Akses Pentadbir Diperlukan untuk Ubah Remark</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Sila masukkan PIN Pentadbir untuk mengaktifkan kebenaran menyunting catatan:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="PIN Pentadbir"
                      value={adminPinInput}
                      onChange={(e) => {
                        setAdminPinInput(e.target.value);
                        setAdminPinError(null);
                      }}
                      className="flex-1 px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-mono bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Sahkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdminPinPrompt(false)}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      Batal
                    </button>
                  </div>
                  {adminPinError && (
                    <div className="text-[11px] font-bold text-rose-600">{adminPinError}</div>
                  )}
                </form>
              )}

              {/* EDIT REMARK FORM (ADMIN) */}
              {isEditingRemark ? (
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
                      <Edit3 className="w-4 h-4 text-indigo-600" />
                      <span>Ubah Remark &amp; Selaraskan Maklumat</span>
                    </div>
                    <span className="text-[10px] font-semibold bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">
                      Mod Pentadbir
                    </span>
                  </div>

                  {/* PRESET CHIPS UNTUK KESELARASAN */}
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-900 mb-1.5">
                      Pilihan Pantas (Klik untuk Selaraskan):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['LOCKED', 'TERKUNCI', 'KELAS', 'KULIAH DIA', 'BENGKEL', 'PEPERIKSAAN', 'KONSULTASI', 'MESYUARAT'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditRemarkValue(preset)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition border ${
                            editRemarkValue === preset
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                              : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* REMARK INPUT */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Remark / Label Paparan Slot (Dipaparkan pada Grid):
                    </label>
                    <input
                      type="text"
                      value={editRemarkValue}
                      onChange={(e) => setEditRemarkValue(e.target.value)}
                      placeholder="Contoh: LOCKED, TERKUNCI, DIA 1023, dsb."
                      className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-xs bg-white text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* EXTRA ACADEMIC FIELDS */}
                  {selectedCellInfo.check.status === 'OCCUPIED_ACADEMIC' && (
                    <div className="space-y-2 pt-1 border-t border-indigo-100">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Nama Kelas / Kumpulan:
                        </label>
                        <input
                          type="text"
                          value={editClassValue}
                          onChange={(e) => setEditClassValue(e.target.value)}
                          placeholder="Contoh: DIA 4C / Pengajian"
                          className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Nama Kursus / Subjek:
                        </label>
                        <input
                          type="text"
                          value={editSubjectValue}
                          onChange={(e) => setEditSubjectValue(e.target.value)}
                          placeholder="Contoh: Perakaunan Kewangan 1"
                          className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Nama Pensyarah:
                        </label>
                        <input
                          type="text"
                          value={editLecturerValue}
                          onChange={(e) => setEditLecturerValue(e.target.value)}
                          placeholder="Contoh: Pn. Tahira Mohamed"
                          className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* EXTRA BLOCKED / BOOKING FIELDS */}
                  {(selectedCellInfo.check.status === 'BLOCKED' || selectedCellInfo.check.status === 'OCCUPIED_BOOKING' || selectedCellInfo.check.status === 'PENDING_BOOKING') && (
                    <div className="pt-1 border-t border-indigo-100">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Catatan / Penerangan Tambahan:
                      </label>
                      <input
                        type="text"
                        value={editReasonValue}
                        onChange={(e) => setEditReasonValue(e.target.value)}
                        placeholder="Catatan tujuan atau sebab sekatan"
                        className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* FORM ACTIONS */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingRemark(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition"
                      disabled={isSavingRemark}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRemark}
                      disabled={isSavingRemark}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingRemark ? 'Menyimpan...' : 'Simpan & Selaraskan'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* VIEW DETAILS SECTION */
                <>
                  {selectedCellInfo.check.status === 'OCCUPIED_ACADEMIC' && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 text-[10px] font-black uppercase tracking-wider">
                          Jadual Kuliah Semester Rasmi
                        </span>
                        {selectedCellInfo.check.academicSlot?.remark && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-extrabold border border-rose-200">
                            Remark: {selectedCellInfo.check.academicSlot.remark}
                          </span>
                        )}
                      </div>
                      <div className="pt-2 text-xs text-rose-950 space-y-1 border-t border-rose-200">
                        <div>
                          <span className="text-slate-500">Remark / Kod:</span>{' '}
                          <strong className="text-rose-900 bg-rose-100/70 px-1.5 py-0.5 rounded font-mono">
                            {selectedCellInfo.check.academicSlot?.remark || (selectedCellInfo.check.academicSlot?.courseCode === 'TERKUNCI' ? 'LOCKED' : selectedCellInfo.check.academicSlot?.courseCode)}
                          </strong>
                        </div>
                        <div><span className="text-slate-500">Subjek:</span> <strong>{selectedCellInfo.check.academicSlot?.courseCode} - {selectedCellInfo.check.academicSlot?.courseName}</strong></div>
                        <div><span className="text-slate-500">Kelas / Maklumat:</span> <strong>{(() => {
                          const cls = selectedCellInfo.check.academicSlot?.className;
                          const lec = selectedCellInfo.check.academicSlot?.lecturerName;
                          if (!cls) return 'Slot Terkunci';
                          if (cls === 'Pengajian / Aktiviti' || cls.startsWith('Pensyarah (') || cls === 'TERKUNCI') {
                            const raw = lec || cls.replace(/^Pensyarah\s*\((.*)\)$/, '$1') || cls;
                            return /^[A-Z]{3,}$/.test(raw) ? raw.charAt(0) + raw.slice(1).toLowerCase() : raw;
                          }
                          return cls;
                        })()}</strong></div>
                        <div><span className="text-slate-500">Pensyarah:</span> <strong>{selectedCellInfo.check.academicSlot?.lecturerName}</strong></div>
                      </div>
                    </div>
                  )}

                  {(selectedCellInfo.check.status === 'OCCUPIED_BOOKING' || selectedCellInfo.check.status === 'PENDING_BOOKING') && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                          Tempahan Ad-Hoc Staf
                        </span>
                        <span className="text-[11px] font-bold text-amber-700">
                          {selectedCellInfo.check.existingBooking?.status === 'CONFIRMED' ? 'Disahkan (Aktif)' : 'Menunggu Kelulusan'}
                        </span>
                      </div>
                      <div className="pt-1 text-xs text-amber-950 space-y-1">
                        <div><span className="text-slate-500">Pemohon:</span> <strong>{selectedCellInfo.check.existingBooking?.applicantName}</strong> ({selectedCellInfo.check.existingBooking?.applicantDepartment})</div>
                        <div><span className="text-slate-500">Tujuan / Remark:</span> <strong>{selectedCellInfo.check.existingBooking?.title || selectedCellInfo.check.existingBooking?.purpose}</strong></div>
                        <div><span className="text-slate-500">Kategori:</span> {selectedCellInfo.check.existingBooking?.purposeCategory}</div>
                        {selectedCellInfo.check.existingBooking?.notes && (
                          <div><span className="text-slate-500">Catatan:</span> {selectedCellInfo.check.existingBooking?.notes}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedCellInfo.check.status === 'BLOCKED' && (() => {
                    const block = selectedCellInfo.check.institutionalBlock;
                    return (
                      <div className="p-3.5 bg-[#0b1329] text-slate-100 rounded-xl space-y-2 border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <span className="text-[11px] leading-none">⚫</span>
                            Sekatan Institusi / Kolej
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">{block?.title || 'Program Kolej'}</div>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {selectedCellInfo.check.conflictReason}
                        </p>
                        {block?.reason && (
                          <div className="text-slate-400 text-[11px] leading-relaxed pt-0.5">{block.reason}</div>
                        )}
                        <div className="pt-2 text-[11px] text-slate-300 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800">
                          {block?.endDate && (
                            <div><span className="text-slate-400">Tempoh:</span> <strong>{block.date} &rarr; {block.endDate}</strong></div>
                          )}
                          <div><span className="text-slate-400">Waktu:</span> <strong>{block?.startTime} – {block?.endTime}</strong></div>
                          {block?.createdBy && (
                            <div><span className="text-slate-400">Disediakan Oleh:</span> <strong>{block.createdBy}</strong></div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {selectedCellInfo.check.status === 'AVAILABLE' && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ruang Kosong &amp; Boleh Ditempah</span>
                      </div>
                      <p className="text-emerald-700 text-xs">
                        Tiada jadual kuliah rasmi atau tempahan ad-hoc pada waktu ini.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              {/* EDIT REMARK BUTTON FOR OCCUPIED SLOTS */}
              {selectedCellInfo.check.status !== 'AVAILABLE' && !isEditingRemark && (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ubah Remark (Admin)</span>
                </button>
              )}
              <button
                onClick={() => setSelectedCellInfo(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-xl text-xs transition ml-auto"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
