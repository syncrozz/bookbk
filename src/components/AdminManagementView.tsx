import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  AdHocBooking, 
  Room, 
  AcademicScheduleSlot,
  StaffUser,
  InstitutionalBlock,
  AcademicExemption
} from '../types';
import { 
  formatDateMalay, 
  getMalayDayOfWeek,
  exportBookingsToCSV,
  findActiveExemption,
  countAffectedAcademicSlots,
  validateExemptionInput
} from '../utils/availabilityEngine';
import {
  getTodayMalaysia,
  getThisWeekRange,
  getNextWeekRange,
  getTwoWeeksFromNextWeekRange,
  getNextMonday,
  snapToMonday,
  addDays,
  summarizeRange,
  buildAutoTitle,
  getIsoDayOfWeek,
  getMalayDayName,
  formatDateMalayShort,
  formatRangeMalay,
} from '../utils/exemptionDates';
import { DateRangeCalendar } from './DateRangeCalendar';
import { parseTimetableCSV, exportTimetableToStandardGridCSV } from '../utils/timetableCsvParser';
import { MASTER_TIMETABLE_CSV, STANDARD_GRID_TEMPLATE_CSV, INITIAL_ROOMS } from '../data/initialData';
import { CloudSyncModal } from './CloudSyncModal';
import { 
  updateStaffPinInCloud, 
  resetStaffPinInCloud, 
  getDirectFirestoreRoomsCount,
  saveAcademicExemptionsToCloud
} from '../lib/firebase';
import { getStoredRooms } from '../utils/storage';
import { ensureBookbkPrefix } from '../utils/downloadHelper';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  ShieldCheck, 
  Lock, 
  Unlock,
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  AlertCircle,
  Building,
  Calendar,
  CalendarRange,
  Clock,
  User,
  FileSpreadsheet,
  Download,
  UploadCloud,
  RefreshCw,
  Users,
  Mail,
  Phone,
  Search,
  Check,
  BookOpen,
  Sparkles,
  Layers,
  Cloud,
  LogOut,
  MapPin,
  GraduationCap,
  ShieldAlert,
  Edit2,
  Copy
} from 'lucide-react';
import { 
  ROOMS_CSV_HEADERS, 
  SAMPLE_ROOMS_CSV_TEMPLATE, 
  exportRoomsToCSV, 
  downloadRoomsCSVTemplate, 
  parseRoomsCSV 
} from '../utils/roomsCsvParser';
import { formatLevel, saveStoredStaffUsers } from '../utils/storage';

interface AdminManagementViewProps {
  bookings: AdHocBooking[];
  rooms: Room[];
  staffList?: StaffUser[];
  academicSchedule?: AcademicScheduleSlot[];
  institutionalBlocks?: InstitutionalBlock[];
  academicExemptions?: AcademicExemption[];
  onApproveBooking: (id: string) => void;
  onRejectBooking: (id: string) => void;
  onResetData: () => void;
  onSyncStaffUsers?: (staff: StaffUser[], mode?: 'merge' | 'replace', resetAllPins?: boolean) => Promise<{ written: number; deleted: number } | void>;
  onSyncAcademicSchedule?: (schedule: AcademicScheduleSlot[], mode?: 'merge' | 'replace') => Promise<void> | void;
  onClearAcademicSchedule?: () => Promise<void> | void;
  onSyncRooms?: (rooms: Room[], mode?: 'merge' | 'replace') => Promise<void> | void;
  onSeedRoomsToCloud?: (rooms: Room[]) => Promise<{ count: number }>;
  onRefreshRoomsFromCloud?: () => Promise<void>;
  onAddBlock?: (block: Omit<InstitutionalBlock, 'id'>) => Promise<void> | void;
  onBatchAddBlocks?: (blocks: Omit<InstitutionalBlock, 'id'>[]) => Promise<void> | void;
  onDeleteBlock?: (id: string) => Promise<void> | void;
  onDeleteBatchBlocks?: (batchIdOrIds: string[]) => Promise<void> | void;
  onLogoutAdmin?: () => void;
  onSyncBookings?: (bookings: AdHocBooking[], mode?: 'merge' | 'replace') => Promise<void> | void;
  onNavigateTab?: (tab: any) => void;
  onRefreshStaffFromCloud?: () => Promise<void>;
  onSaveAcademicExemptions?: (exemptions: AcademicExemption[]) => Promise<void> | void;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  bookings,
  rooms,
  staffList = [],
  academicSchedule = [],
  institutionalBlocks = [],
  academicExemptions = [],
  onApproveBooking,
  onRejectBooking,
  onResetData,
  onSyncStaffUsers,
  onSyncAcademicSchedule,
  onClearAcademicSchedule,
  onSyncRooms,
  onSeedRoomsToCloud,
  onRefreshRoomsFromCloud,
  onAddBlock,
  onBatchAddBlocks,
  onDeleteBlock,
  onDeleteBatchBlocks,
  onLogoutAdmin,
  onSyncBookings,
  onNavigateTab,
  onRefreshStaffFromCloud,
  onSaveAcademicExemptions
}) => {
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');

  // Institutional & Exam Blocks State (Dynamic Default View: Nov 2026 as initial view, auto-switches to current/upcoming date once Nov 2026 passes)
  const todayDateStr = new Date().toISOString().split('T')[0];
  const isNov2026Passed = todayDateStr > '2026-11-16';

  const [selectedBlockRooms, setSelectedBlockRooms] = useState<string[]>([
    'DEWAN_BESAR',
    'SRI_PENAWAR',
    'DEWAN_SEMINAR',
    'MINI_SEMINAR'
  ]);
  const [blockStartDate, setBlockStartDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [blockEndDate, setBlockEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isAllDayBlock, setIsAllDayBlock] = useState<boolean>(true);
  const [blockStartTime, setBlockStartTime] = useState<string>('08:00');
  const [blockEndTime, setBlockEndTime] = useState<string>('24:00');
  const [blockTitle, setBlockTitle] = useState<string>('Exam');
  const [blockCategory, setBlockCategory] = useState<'EXAM' | 'INSTITUTIONAL' | 'MAINTENANCE'>('EXAM');
  const [blockCreatedBy, setBlockCreatedBy] = useState<string>('UPPK');
  const [blockReason, setBlockReason] = useState<string>('Sekatan rasmi kolej / peperiksaan bagi dewan terpilih.');
  const [isSubmittingBlock, setIsSubmittingBlock] = useState<boolean>(false);
  const [blockSuccessMsg, setBlockSuccessMsg] = useState<string | null>(null);
  const [blockSearchTerm, setBlockSearchTerm] = useState<string>('');
  const [blockFilterCategory, setBlockFilterCategory] = useState<'ALL' | 'EXAM' | 'INSTITUTIONAL' | 'MAINTENANCE'>('ALL');
  const [isRefreshingStaff, setIsRefreshingStaff] = useState<boolean>(false);

  // Study Week Academic Exemptions State
  const [exemptionList, setExemptionList] = useState<AcademicExemption[]>(academicExemptions);
  useEffect(() => {
    setExemptionList(academicExemptions);
  }, [academicExemptions]);

  const todayMalaysia = useMemo(() => getTodayMalaysia(), []);
  const initialTwoWeeksRange = useMemo(() => getTwoWeeksFromNextWeekRange(getTodayMalaysia()), []);

  const [exemptionIdToEdit, setExemptionIdToEdit] = useState<string | null>(null);
  const [exemptionStartDate, setExemptionStartDate] = useState<string>(initialTwoWeeksRange.start);
  const [exemptionEndDate, setExemptionEndDate] = useState<string>(initialTwoWeeksRange.end);
  const [exemptionTitle, setExemptionTitle] = useState<string>(() => buildAutoTitle(initialTwoWeeksRange.start, initialTwoWeeksRange.end));
  const [isUserEditedTitle, setIsUserEditedTitle] = useState<boolean>(false);
  const [autoCalcEndDate, setAutoCalcEndDate] = useState<boolean>(true);
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  const triggerDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    try {
      ref.current?.showPicker?.();
    } catch {
      ref.current?.focus();
    }
  };

  const resetExemptionForm = () => {
    const defaultRange = getTwoWeeksFromNextWeekRange(todayMalaysia);
    setExemptionIdToEdit(null);
    setExemptionStartDate(defaultRange.start);
    setExemptionEndDate(defaultRange.end);
    setExemptionTitle(buildAutoTitle(defaultRange.start, defaultRange.end));
    setIsUserEditedTitle(false);
    setAutoCalcEndDate(true);
    setExemptionScope('BILIK_KULIAH');
    setSelectedExemptionRooms([]);
    setExemptionReason('');
    setExemptionMsg(null);
  };

  const handleStartDateChange = (newStart: string) => {
    setExemptionStartDate(newStart);
    if (!newStart) return;

    if (autoCalcEndDate) {
      let durationDays = 14;
      if (exemptionStartDate && exemptionEndDate && exemptionEndDate >= exemptionStartDate) {
        durationDays = summarizeRange(exemptionStartDate, exemptionEndDate).totalDays;
      }
      const newEnd = addDays(newStart, durationDays - 1);
      setExemptionEndDate(newEnd);
      if (!isUserEditedTitle) {
        setExemptionTitle(buildAutoTitle(newStart, newEnd));
      }
    } else {
      if (!isUserEditedTitle && exemptionEndDate && exemptionEndDate >= newStart) {
        setExemptionTitle(buildAutoTitle(newStart, exemptionEndDate));
      }
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setExemptionEndDate(newEnd);
    setAutoCalcEndDate(false);
    if (!isUserEditedTitle && exemptionStartDate && newEnd >= exemptionStartDate) {
      setExemptionTitle(buildAutoTitle(exemptionStartDate, newEnd));
    }
  };

  const handleCalendarRangeChange = (start: string, end: string) => {
    setExemptionStartDate(start);
    setExemptionEndDate(end);
    if (start && end && end >= start) {
      if (!isUserEditedTitle) {
        setExemptionTitle(buildAutoTitle(start, end));
      }
    }
  };

  const applyQuickRange = (start: string, end: string) => {
    setExemptionStartDate(start);
    setExemptionEndDate(end);
    setAutoCalcEndDate(true);
    if (!isUserEditedTitle) {
      setExemptionTitle(buildAutoTitle(start, end));
    }
  };

  const handleQuickDuration = (daysToAdd: number) => {
    let start = exemptionStartDate;
    if (!start) {
      start = getNextMonday(todayMalaysia);
      setExemptionStartDate(start);
    }
    const end = addDays(start, daysToAdd);
    setExemptionEndDate(end);
    setAutoCalcEndDate(true);
    if (!isUserEditedTitle) {
      setExemptionTitle(buildAutoTitle(start, end));
    }
  };

  const handleAdjustToMonday = () => {
    if (!exemptionStartDate) return;
    const monday = snapToMonday(exemptionStartDate);
    handleStartDateChange(monday);
  };

  const rangeSummary = useMemo(() => {
    return summarizeRange(exemptionStartDate, exemptionEndDate);
  }, [exemptionStartDate, exemptionEndDate]);

  const lectureRoomScopeText = useMemo(() => {
    const lectureRooms = rooms.filter(r => r.category === 'Bilik Kuliah');
    const count = lectureRooms.length;
    const bkNumbers = lectureRooms
      .map(r => {
        const m = r.code.match(/^BK(\d+)$/i);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    if (bkNumbers.length === count && count > 1) {
      const min = bkNumbers[0];
      const max = bkNumbers[bkNumbers.length - 1];
      const minCode = `BK${String(min).padStart(2, '0')}`;
      const maxCode = `BK${String(max).padStart(2, '0')}`;
      return `Disyorkan (${count} Bilik Kuliah: ${minCode}–${maxCode})`;
    }
    return `Disyorkan (${count} Bilik Kuliah)`;
  }, [rooms]);

  const [exemptionScope, setExemptionScope] = useState<'ALL_ROOMS' | 'BILIK_KULIAH' | 'SELECTED'>('BILIK_KULIAH');
  const [selectedExemptionRooms, setSelectedExemptionRooms] = useState<string[]>([]);
  const [exemptionReason, setExemptionReason] = useState<string>('');
  const [isSavingExemption, setIsSavingExemption] = useState<boolean>(false);
  const [exemptionMsg, setExemptionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingExemptionToSave, setPendingExemptionToSave] = useState<AcademicExemption | null>(null);
  const [deleteConfirmExemptionId, setDeleteConfirmExemptionId] = useState<string | null>(null);

  const handleInitiateSaveExemption = (e: React.FormEvent) => {
    e.preventDefault();
    setExemptionMsg(null);

    const draft: Partial<AcademicExemption> = {
      id: exemptionIdToEdit || undefined,
      title: exemptionTitle,
      startDate: exemptionStartDate,
      endDate: exemptionEndDate,
      scope: exemptionScope,
      roomIds: selectedExemptionRooms,
      reason: exemptionReason,
      active: true,
    };

    const val = validateExemptionInput(draft, exemptionList);
    if (!val.isValid) {
      setExemptionMsg({ text: val.errors.join(' '), type: 'error' });
      return;
    }

    const finalItem: AcademicExemption = {
      id: exemptionIdToEdit || `EX-${exemptionStartDate.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
      title: exemptionTitle.trim(),
      startDate: exemptionStartDate,
      endDate: exemptionEndDate,
      scope: exemptionScope,
      active: true,
      createdBy: 'Admin KPMBP',
      createdAt: exemptionIdToEdit
        ? (exemptionList.find(e => e.id === exemptionIdToEdit)?.createdAt || new Date().toISOString())
        : new Date().toISOString()
    };

    if (exemptionScope === 'SELECTED' && selectedExemptionRooms.length > 0) {
      finalItem.roomIds = selectedExemptionRooms;
    }
    if (exemptionReason.trim()) {
      finalItem.reason = exemptionReason.trim();
    }

    setPendingExemptionToSave(finalItem);
    setShowConfirmModal(true);
  };

  const handleConfirmSaveExemption = async () => {
    if (!pendingExemptionToSave) return;
    setIsSavingExemption(true);
    setShowConfirmModal(false);

    let updatedList: AcademicExemption[];
    if (exemptionIdToEdit) {
      updatedList = exemptionList.map(e => e.id === exemptionIdToEdit ? pendingExemptionToSave : e);
    } else {
      updatedList = [pendingExemptionToSave, ...exemptionList];
    }

    setExemptionList(updatedList);
    try {
      if (onSaveAcademicExemptions) {
        await onSaveAcademicExemptions(updatedList);
      } else {
        await saveAcademicExemptionsToCloud(updatedList);
      }
      setExemptionMsg({ text: '🟢 Pengecualian jadual hakiki berjaya disimpan ke Cloud.', type: 'success' });
      resetExemptionForm();
      setPendingExemptionToSave(null);
    } catch (err: any) {
      setExemptionMsg({ text: `🟡 Disimpan setempat: ${err?.message || 'Ralat sambungan Cloud'}`, type: 'error' });
    } finally {
      setIsSavingExemption(false);
    }
  };

  const handleToggleExemptionActive = async (id: string) => {
    const updatedList = exemptionList.map(e => e.id === id ? { ...e, active: !e.active } : e);
    setExemptionList(updatedList);
    try {
      if (onSaveAcademicExemptions) {
        await onSaveAcademicExemptions(updatedList);
      } else {
        await saveAcademicExemptionsToCloud(updatedList);
      }
      setExemptionMsg({ text: 'Status pengecualian dikemas kini.', type: 'success' });
    } catch (err: any) {
      setExemptionMsg({ text: `Disimpan setempat: ${err?.message || 'Ralat sambungan Cloud'}`, type: 'error' });
    }
  };

  const handleDeleteExemption = async (id: string) => {
    const updatedList = exemptionList.filter(e => e.id !== id);
    setExemptionList(updatedList);
    setDeleteConfirmExemptionId(null);
    try {
      if (onSaveAcademicExemptions) {
        await onSaveAcademicExemptions(updatedList);
      } else {
        await saveAcademicExemptionsToCloud(updatedList);
      }
      setExemptionMsg({ text: 'Pengecualian telah dipadamkan.', type: 'success' });
    } catch (err: any) {
      setExemptionMsg({ text: `Disimpan setempat: ${err?.message || 'Ralat sambungan Cloud'}`, type: 'error' });
    }
  };

  const handleEditExemption = (ex: AcademicExemption) => {
    setExemptionIdToEdit(ex.id);
    setExemptionTitle(ex.title);
    setIsUserEditedTitle(true);
    setExemptionStartDate(ex.startDate);
    setExemptionEndDate(ex.endDate);
    setAutoCalcEndDate(false);
    setExemptionScope(ex.scope);
    setSelectedExemptionRooms(ex.roomIds || []);
    setExemptionReason(ex.reason || '');
    setExemptionMsg(null);
  };

  const handleDuplicateExemption = (ex: AcademicExemption) => {
    const defaultRange = getTwoWeeksFromNextWeekRange(todayMalaysia);
    setExemptionIdToEdit(null);
    setExemptionTitle(`${ex.title} (Salinan)`);
    setIsUserEditedTitle(true);
    setExemptionStartDate(defaultRange.start);
    setExemptionEndDate(defaultRange.end);
    setAutoCalcEndDate(true);
    setExemptionScope(ex.scope);
    setSelectedExemptionRooms(ex.roomIds || []);
    setExemptionReason(ex.reason || '');
    setExemptionMsg({ text: 'Tetapan disalin. Sila pilih tarikh mula & tamat baharu.', type: 'success' });
  };

  // Timetable CSV Sync State
  const [scheduleCsvFile, setScheduleCsvFile] = useState<File | null>(null);
  const [parsedScheduleSlots, setParsedScheduleSlots] = useState<AcademicScheduleSlot[]>([]);
  const [scheduleParseSummary, setScheduleParseSummary] = useState<{ totalRowsProcessed: number; validSlotsCount: number; roomsAffected: string[] } | null>(null);
  const [scheduleParseErrors, setScheduleParseErrors] = useState<string[]>([]);
  const [isSyncingSchedule, setIsSyncingSchedule] = useState<boolean>(false);
  const [scheduleSyncSuccessMsg, setScheduleSyncSuccessMsg] = useState<string | null>(null);
  const [scheduleSyncMode, setScheduleSyncMode] = useState<'merge' | 'replace'>('replace');
  const [showClearScheduleModal, setShowClearScheduleModal] = useState<boolean>(false);
  const [isClearingSchedule, setIsClearingSchedule] = useState<boolean>(false);
  const [showConfirmTotalOverwriteModal, setShowConfirmTotalOverwriteModal] = useState<boolean>(false);

  // Staff CSV Sync State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedStaffList, setParsedStaffList] = useState<StaffUser[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [staffSearchTerm, setStaffSearchTerm] = useState<string>('');
  const [showCloudSyncModal, setShowCloudSyncModal] = useState<boolean>(false);
  const [staffSyncMode, setStaffSyncMode] = useState<'merge' | 'replace'>('merge');
  const [resetAllPinsOnSync, setResetAllPinsOnSync] = useState<boolean>(false);

  // Rooms CSV Sync State
  const [roomCsvFile, setRoomCsvFile] = useState<File | null>(null);
  const [parsedRoomsList, setParsedRoomsList] = useState<Room[]>([]);
  const [roomParseSummary, setRoomParseSummary] = useState<{ total: number; updated: number; added: number; roomsAffected: string[] } | null>(null);
  const [roomParseErrors, setRoomParseErrors] = useState<string[]>([]);
  const [isSyncingRooms, setIsSyncingRooms] = useState<boolean>(false);
  const [roomSyncSuccessMsg, setRoomSyncSuccessMsg] = useState<string | null>(null);
  const [roomSyncMode, setRoomSyncMode] = useState<'merge' | 'replace'>('merge');
  const [roomSearchTerm, setRoomSearchTerm] = useState<string>('');

  // Room Seeding, Diagnostics & Cloud Sync State
  const [showSeedModal, setShowSeedModal] = useState<boolean>(false);
  const [seedRoomsList, setSeedRoomsList] = useState<Room[]>([]);
  const [isSeedingRooms, setIsSeedingRooms] = useState<boolean>(false);
  const [seedErrorMsg, setSeedErrorMsg] = useState<string | null>(null);

  const [showDiagModal, setShowDiagModal] = useState<boolean>(false);
  const [isDiagLoading, setIsDiagLoading] = useState<boolean>(false);
  const [diagInfo, setDiagInfo] = useState<{
    localCount: number;
    cloudCount: number;
    initialCount: number;
    cacheTs: string | null;
    diffs: { id: string; name: string; inLocal: boolean; inCloud: boolean; inInitial: boolean }[];
    error?: string;
  } | null>(null);

  const [isRefreshingRooms, setIsRefreshingRooms] = useState<boolean>(false);

  // Ad-Hoc Bookings CSV & Restoration State
  const bookingCsvInputRef = useRef<HTMLInputElement>(null);
  const [bookingSearchTerm, setBookingSearchTerm] = useState<string>('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [isRestoringBookings, setIsRestoringBookings] = useState<boolean>(false);
  const [bookingRestoreSuccessMsg, setBookingRestoreSuccessMsg] = useState<string | null>(null);
  const [bookingRestoreErrorMsg, setBookingRestoreErrorMsg] = useState<string | null>(null);

  const handleUploadBookingsCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoringBookings(true);
    setBookingRestoreSuccessMsg(null);
    setBookingRestoreErrorMsg(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setBookingRestoreErrorMsg('Fail CSV kosong atau tiada baris rekod tempahan.');
        setIsRestoringBookings(false);
        return;
      }

      const parseCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const parsed: AdHocBooking[] = [];
      for (let idx = 1; idx < lines.length; idx++) {
        const cols = parseCsvLine(lines[idx]);
        if (cols.length < 7) continue;

        const id = cols[0] || `BK-${Date.now()}-${idx}`;
        const roomId = cols[1];
        const roomName = cols[2] || cols[1];
        const date = cols[3];
        const startTime = cols[5];
        const endTime = cols[6];
        const applicantName = cols[7] || 'Staf KPMBP';
        const applicantEmail = cols[8] || 'staf@mara.gov.my';
        const applicantPhone = cols[9] || '';
        const applicantRole = cols[10] || 'Pensyarah';
        const department = cols[11] || 'Jabatan Akademik';
        const purposeCategory = (cols[12] || 'Kelas') as any;
        const title = cols[13] || 'Aktiviti Kuliah';
        const paxCount = Number(cols[14]) || 20;
        const status = (cols[15] || 'CONFIRMED') as any;
        const createdAt = cols[16] || new Date().toISOString();
        const notes = cols[17] || '';

        if (!roomId || !date || !startTime || !endTime) continue;

        parsed.push({
          id,
          roomId,
          roomName,
          date,
          startTime,
          endTime,
          applicantName,
          applicantEmail,
          applicantPhone,
          applicantRole,
          department,
          purposeCategory,
          title,
          paxCount,
          status: (status === 'CONFIRMED' || status === 'PENDING' || status === 'REJECTED' || status === 'CANCELLED') ? status : 'CONFIRMED',
          createdAt,
          notes,
          syncStatus: 'synced'
        });
      }

      if (parsed.length === 0) {
        setBookingRestoreErrorMsg('Tiada rekod tempahan yang sah ditemui dalam fail CSV tersebut.');
        setIsRestoringBookings(false);
        return;
      }

      if (onSyncBookings) {
        await onSyncBookings(parsed, 'merge');
      }
      setBookingRestoreSuccessMsg(`Berjaya memulihkan ${parsed.length} rekod tempahan ad-hoc daripada fail sandaran CSV!`);
      if (bookingCsvInputRef.current) {
        bookingCsvInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error parsing bookings CSV:', err);
      setBookingRestoreErrorMsg('Ralat semasa membaca fail CSV sandaran.');
    } finally {
      setIsRestoringBookings(false);
    }
  };

  const handleRestoreSampleBookings = async () => {
    setIsRestoringBookings(true);
    setBookingRestoreSuccessMsg(null);
    setBookingRestoreErrorMsg(null);

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today.getTime() + 86400000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const dayAfter = new Date(today.getTime() + 86400000 * 2);
      const dayAfterStr = dayAfter.toISOString().split('T')[0];

      const staff1 = staffList.find(s => s.role === 'Pensyarah') || staffList[0] || { name: 'Ustaz Ahmad', email: 'ahmad@mara.gov.my', department: 'Jabatan Pengajian Islam', role: 'Pensyarah', phone: '0191234567' };
      const staff2 = staffList[1] || { name: 'Dr. Noraini', email: 'noraini@mara.gov.my', department: 'Jabatan Perdagangan', role: 'Pensyarah', phone: '0192345678' };
      const staff3 = staffList[2] || { name: 'En. Razak', email: 'razak@mara.gov.my', department: 'Jabatan Sains Komputer', role: 'Pensyarah', phone: '0193456789' };
      const staff4 = staffList[3] || { name: 'Pn. Salmah', email: 'salmah@kpmbp.edu.my', department: 'Unit Hal Ehwal Pelajar', role: 'Pegawai', phone: '0194567890' };
      const staff5 = staffList[4] || { name: 'En. Hafiz', email: 'hafiz@mara.gov.my', department: 'Unit Sukan & Kokurikulum', role: 'Pegawai', phone: '0195678901' };
      const staff6 = staffList[5] || { name: 'Pn. Nurlaili', email: 'nurlaili@mara.gov.my', department: 'Jabatan Bahasa & Komunikasi', role: 'Pensyarah', phone: '0196789012' };

      const sampleBookings: AdHocBooking[] = [
        {
          id: `BK-KPMBP-001-${Date.now().toString().slice(-4)}`,
          roomId: 'BK01',
          roomName: 'Bilik Kuliah 01',
          date: todayStr,
          startTime: '10:30',
          endTime: '12:30',
          applicantName: staff1.name,
          applicantEmail: staff1.email,
          applicantPhone: staff1.phone || '0191234567',
          applicantRole: staff1.role || 'Pensyarah',
          department: staff1.department || 'Jabatan Pengajian Islam',
          purposeCategory: 'Kelas',
          title: 'Kelas Gantian Fiqh & Muamalat',
          paxCount: 28,
          status: 'CONFIRMED',
          createdAt: new Date().toISOString(),
          notes: 'Kelas gantian rasmi sesi pagi.'
        },
        {
          id: `BK-KPMBP-002-${Date.now().toString().slice(-4)}`,
          roomId: 'BK02',
          roomName: 'Bilik Kuliah 02',
          date: todayStr,
          startTime: '14:00',
          endTime: '16:00',
          applicantName: staff2.name,
          applicantEmail: staff2.email,
          applicantPhone: staff2.phone || '0192345678',
          applicantRole: staff2.role || 'Pensyarah',
          department: staff2.department || 'Jabatan Perdagangan',
          purposeCategory: 'Bengkel',
          title: 'Bengkel Analisis Data Perakaunan',
          paxCount: 25,
          status: 'CONFIRMED',
          createdAt: new Date().toISOString(),
          notes: 'Latihan amali perakaunan kewangan.'
        },
        {
          id: `BK-KPMBP-003-${Date.now().toString().slice(-4)}`,
          roomId: 'MAKMAL_ALFA',
          roomName: 'Makmal Komputer Alfa',
          date: tomorrowStr,
          startTime: '09:00',
          endTime: '11:00',
          applicantName: staff3.name,
          applicantEmail: staff3.email,
          applicantPhone: staff3.phone || '0193456789',
          applicantRole: staff3.role || 'Pensyarah',
          department: staff3.department || 'Jabatan Sains Komputer',
          purposeCategory: 'Aktiviti Pelajar',
          title: 'Bengkel Kod & Pembangunan Web',
          paxCount: 30,
          status: 'CONFIRMED',
          createdAt: new Date().toISOString(),
          notes: 'Penyediaan projek akhir pelajar Diploma.'
        },
        {
          id: `BK-KPMBP-004-${Date.now().toString().slice(-4)}`,
          roomId: 'DEWAN_SEMINAR',
          roomName: 'Dewan Seminar KPMBP',
          date: tomorrowStr,
          startTime: '14:30',
          endTime: '16:30',
          applicantName: staff4.name,
          applicantEmail: staff4.email,
          applicantPhone: staff4.phone || '0194567890',
          applicantRole: staff4.role || 'Pegawai',
          department: staff4.department || 'Unit Hal Ehwal Pelajar',
          purposeCategory: 'Mesyuarat',
          title: 'Mesyuarat Jawatankuasa Kebajikan Pelajar',
          paxCount: 18,
          status: 'CONFIRMED',
          createdAt: new Date().toISOString(),
          notes: 'Perbincangan kebajikan dan penginapan kolej.'
        },
        {
          id: `BK-KPMBP-005-${Date.now().toString().slice(-4)}`,
          roomId: 'DEWAN_BESAR',
          roomName: 'Dewan Besar Seri Gemilang',
          date: dayAfterStr,
          startTime: '09:00',
          endTime: '12:00',
          applicantName: staff5.name,
          applicantEmail: staff5.email,
          applicantPhone: staff5.phone || '0195678901',
          applicantRole: staff5.role || 'Pegawai',
          department: staff5.department || 'Unit Sukan & Kokurikulum',
          purposeCategory: 'Aktiviti Pelajar',
          title: 'Taklimat Kejohanan Sukan Antara Jabatan',
          paxCount: 75,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          notes: 'Memerlukan sistem audio dan mikrofon dewan.'
        },
        {
          id: `BK-KPMBP-006-${Date.now().toString().slice(-4)}`,
          roomId: 'BK05',
          roomName: 'Bilik Kuliah 05',
          date: dayAfterStr,
          startTime: '14:00',
          endTime: '16:00',
          applicantName: staff6.name,
          applicantEmail: staff6.email,
          applicantPhone: staff6.phone || '0196789012',
          applicantRole: staff6.role || 'Pensyarah',
          department: staff6.department || 'Jabatan Bahasa & Komunikasi',
          purposeCategory: 'Kelas',
          title: 'Bengkel Kemahiran Komunikasi Profesional',
          paxCount: 22,
          status: 'CONFIRMED',
          createdAt: new Date().toISOString(),
          notes: 'Kelas persediaan temuduga pelajar semester akhir.'
        }
      ];

      if (onSyncBookings) {
        await onSyncBookings(sampleBookings, 'merge');
      }
      setBookingRestoreSuccessMsg('Berjaya memuatkan 6 rekod tempahan contoh rasmi KPMBP!');
    } catch (err) {
      console.error('Error restoring sample bookings:', err);
      setBookingRestoreErrorMsg('Ralat semasa menjana rekod contoh tempahan.');
    } finally {
      setIsRestoringBookings(false);
    }
  };

  // Download Standard Timetable CSV Template (Format Perkara/Hari yang diselaraskan)
  const handleDownloadStandardGridTemplate = () => {
    const csvContent = STANDARD_GRID_TEMPLATE_CSV;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', ensureBookbkPrefix('kpmbp_jadual_perkara_hari_template.csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Full Master Timetable CSV (Format FET / Unit Jadual Waktu)
  const handleDownloadTimetableCSVTemplate = () => {
    const csvContent = MASTER_TIMETABLE_CSV;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', ensureBookbkPrefix('jadual_waktu_kolej_master_template.csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export current active schedule to standard grid CSV
  const handleExportCurrentScheduleCSV = () => {
    if (!academicSchedule || academicSchedule.length === 0) {
      alert('Tiada slot jadual waktu semasa untuk dieksport.');
      return;
    }
    const csvContent = exportTimetableToStandardGridCSV(academicSchedule, rooms, { includeNightSlots: true });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', ensureBookbkPrefix(`kpmbp_jadual_rasmi_terkini_${new Date().toISOString().slice(0, 10)}.csv`));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Timetable CSV File Handler with Auto-Sync to Firebase
  const handleScheduleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScheduleCsvFile(file);
    setScheduleSyncSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const res = parseTimetableCSV(text, rooms);
      setParsedScheduleSlots(res.slots);
      setScheduleParseSummary(res.summary);
      setScheduleParseErrors(res.errors);

      // Auto-sync immediately to Firebase Cloud when slots are successfully parsed
      if (res.slots.length > 0 && onSyncAcademicSchedule) {
        setIsSyncingSchedule(true);
        try {
          await onSyncAcademicSchedule(res.slots, scheduleSyncMode);
          if (scheduleSyncMode === 'replace') {
            setScheduleSyncSuccessMsg(
              `🟢 Berjaya auto-sync & MENGUNCI ${res.slots.length} slot baharu merentasi ${res.summary.roomsAffected.length} ruang ke Cloud Firebase (Mod Ganti Sepenuhnya)!`
            );
          } else {
            setScheduleSyncSuccessMsg(
              `🟢 Berjaya auto-sync & menggabungkan ${res.slots.length} slot jadual di ${res.summary.roomsAffected.length} ruang ke Cloud Firebase!`
            );
          }
        } catch (err) {
          console.error('Schedule auto sync error:', err);
        } finally {
          setIsSyncingSchedule(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleTriggerScheduleSync = () => {
    if (parsedScheduleSlots.length === 0) {
      alert('Tiada slot jadual waktu CSV yang sah untuk disinkronkan.');
      return;
    }

    if (scheduleSyncMode === 'replace') {
      setShowConfirmTotalOverwriteModal(true);
    } else {
      executeActualSync('merge');
    }
  };

  const executeActualSync = async (mode: 'merge' | 'replace') => {
    if (onSyncAcademicSchedule) {
      setIsSyncingSchedule(true);
      try {
        await onSyncAcademicSchedule(parsedScheduleSlots, mode);
        setShowConfirmTotalOverwriteModal(false);
        if (mode === 'replace') {
          setScheduleSyncSuccessMsg(
            `🟢 Berjaya membersihkan jadual terdahulu dan MENGUNCI ${parsedScheduleSlots.length} slot baharu merentasi ${scheduleParseSummary?.roomsAffected.length || 0} ruang (Mod Ganti Sepenuhnya)!`
          );
        } else {
          setScheduleSyncSuccessMsg(
            `🟢 Berjaya menggabungkan dan mengemas kini ${parsedScheduleSlots.length} slot di ${scheduleParseSummary?.roomsAffected.length || 0} ruang!`
          );
        }
      } catch (err) {
        alert('Gagal menyinkronkan data jadual waktu.');
      } finally {
        setIsSyncingSchedule(false);
      }
    } else {
      setShowConfirmTotalOverwriteModal(false);
      setScheduleSyncSuccessMsg(`🟢 Berjaya memproses ${parsedScheduleSlots.length} slot jadual secara tempatan!`);
    }
  };

  const handleExecuteClearSchedule = async () => {
    if (!onClearAcademicSchedule) {
      alert('Fungsi pembersihan jadual tidak tersedia.');
      return;
    }
    setIsClearingSchedule(true);
    try {
      await onClearAcademicSchedule();
      setShowClearScheduleModal(false);
      setParsedScheduleSlots([]);
      setScheduleCsvFile(null);
      setScheduleParseSummary(null);
      setScheduleSyncSuccessMsg(
        `🟢 Semua data jadual akademik telah berjaya dibersihkan sepenuhnya (0 slot aktif). Semua bilik kini berstatus kosong dan sedia ditempah secara ad-hoc.`
      );
    } catch (err) {
      alert('Ralat semasa membersihkan data jadual akademik.');
    } finally {
      setIsClearingSchedule(false);
    }
  };

  // Download Example CSV Template (6 official profile fields only - NO credentials)
  const handleDownloadCSVTemplate = () => {
    const csvContent = 
`id,department,name,role,phone,email
ST001,Pengurusan,Pn. Maznah Binti Ismail,Pensyarah,019-1234567,maznah.ismail@kpmbp.edu.my
ST002,Perakaunan,En. Rosli Bin Ahmad,Pensyarah,012-9876543,rosli.ahmad@kpmbp.edu.my
ST003,Pengajian Am,Cik Siti Sarah Binti Razak,Pensyarah,013-5558899,siti.sarah@kpmbp.edu.my`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', ensureBookbkPrefix('kpmbp_staf_template.csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Registered Staff Profiles to CSV (Standard Profile Export - NO PIN credentials)
  const handleExportStaffListCSV = () => {
    const header = 'id,department,name,role,phone,email';
    const rows = staffList.map(s => 
      `"${s.id}","${(s.department || '').replace(/"/g, '""')}","${(s.name || '').replace(/"/g, '""')}","${(s.role || '').replace(/"/g, '""')}","${s.phone || ''}","${s.email || ''}"`
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', ensureBookbkPrefix(`kpmbp_senarai_staf_${new Date().toISOString().split('T')[0]}.csv`));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Ad-Hoc Bookings to CSV (Full Backup with all 17 fields & UTF-8 BOM)
  const handleExportBookingsCSV = (filterStatus: 'ALL' | 'CONFIRMED' | 'PENDING' = 'ALL') => {
    let toExport = bookings;
    let label = 'semua';
    if (filterStatus === 'CONFIRMED') {
      toExport = bookings.filter(b => b.status === 'CONFIRMED');
      label = 'disahkan';
    } else if (filterStatus === 'PENDING') {
      toExport = bookings.filter(b => b.status === 'PENDING');
      label = 'menunggu';
    }

    if (toExport.length === 0) {
      alert(`Tiada rekod tempahan ad-hoc (${label}) untuk dieksport.`);
      return;
    }

    const res = exportBookingsToCSV(toExport, `kpmbp_tempahan_adhoc_${label}_backup`);
    if (res.success) {
      alert(`✅ Berjaya memuat turun fail sandaran: ${res.filename} (${res.count} rekod tempahan).`);
    }
  };

  // Export current rooms list to CSV
  const handleExportRoomsListCSV = () => {
    if (!rooms || rooms.length === 0) {
      alert('Tiada maklumat ruang untuk dieksport.');
      return;
    }
    const res = exportRoomsToCSV(rooms);
    if (res.success) {
      alert(`✅ Berjaya mengeksport ${res.count} ruang ke ${res.filename}`);
    }
  };

  // Download sample rooms CSV template
  const handleDownloadRoomsCSVTemplate = () => {
    downloadRoomsCSVTemplate();
  };

  // Handle uploaded rooms CSV file
  const handleRoomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRoomCsvFile(file);
    setRoomParseErrors([]);
    setRoomSyncSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setRoomParseErrors(['Fail CSV kosong atau tidak dapat dibaca.']);
        return;
      }

      const result = parseRoomsCSV(text, rooms);
      setParsedRoomsList(result.rooms);
      setRoomParseSummary(result.summary);
      setRoomParseErrors(result.errors);
    };

    reader.onerror = () => {
      setRoomParseErrors(['Ralat semasa membaca fail CSV.']);
    };

    reader.readAsText(file);
  };

  // Execute sync rooms to system and cloud
  const handleSyncRoomsToSystem = async () => {
    if (parsedRoomsList.length === 0) {
      alert('Tiada data ruang yang sah untuk disinkronkan.');
      return;
    }

    if (roomSyncMode === 'replace') {
      const confirmed = window.confirm(
        `⚠️ AMARAN: Mod 'Ganti Semua' dipilih!\n\nSemua ${rooms.length} ruang sedia ada akan digantikan sepenuhnya dengan ${parsedRoomsList.length} ruang daripada fail CSV.\n\nAdakah anda pasti mahu meneruskan?`
      );
      if (!confirmed) return;
    }

    setIsSyncingRooms(true);
    setRoomSyncSuccessMsg(null);

    try {
      if (onSyncRooms) {
        await onSyncRooms(parsedRoomsList, roomSyncMode);
      }
      setRoomSyncSuccessMsg(
        `✅ Berjaya menyinkronkan ${parsedRoomsList.length} ruang (${roomParseSummary?.updated || 0} dikemaskini, ${roomParseSummary?.added || 0} ditambah) ke sistem!`
      );
      setRoomCsvFile(null);
      setParsedRoomsList([]);
      setRoomParseSummary(null);
    } catch (err) {
      setRoomParseErrors(['Gagal menyinkronkan data ruang ke pangkalan data.']);
    } finally {
      setIsSyncingRooms(false);
    }
  };

  // Open Room Seeding Modal from Admin's LocalStorage
  const handleOpenSeedModal = () => {
    setSeedErrorMsg(null);
    let list: Room[] = [];
    try {
      const raw = localStorage.getItem('kpmbp_rooms_v4');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch {}
    if (list.length === 0) {
      list = rooms.length > 0 ? rooms : getStoredRooms();
    }
    setSeedRoomsList(list);
    setShowSeedModal(true);
  };

  // Confirm and Execute Room Seeding to Cloud Firestore with verification
  const handleConfirmSeedRooms = async () => {
    if (seedRoomsList.length === 0) return;
    setIsSeedingRooms(true);
    setSeedErrorMsg(null);
    try {
      if (onSeedRoomsToCloud) {
        await onSeedRoomsToCloud(seedRoomsList);
      }
      setShowSeedModal(false);
    } catch (err: any) {
      setSeedErrorMsg(err?.message || 'Ralat semasa memuat naik data ke Cloud Firestore.');
    } finally {
      setIsSeedingRooms(false);
    }
  };

  // Run Real-Time Room Diagnostics across LocalStorage, Cloud Firestore, and Initial Data
  const handleRunDiagnosis = async () => {
    setIsDiagLoading(true);
    setShowDiagModal(true);
    try {
      let localList: Room[] = [];
      try {
        const raw = localStorage.getItem('kpmbp_rooms_v4');
        if (raw) localList = JSON.parse(raw);
      } catch {}
      if (localList.length === 0) localList = rooms;

      const directRes = await getDirectFirestoreRoomsCount();
      const initialRooms = INITIAL_ROOMS;
      const cacheTs = localStorage.getItem('kpmbp_cloud_cache_ts_rooms');

      const localMap = new Map(localList.map(r => [r.id.toUpperCase(), r]));
      const cloudSet = new Set(directRes.ids.map(id => id.toUpperCase()));
      const initialMap = new Map(initialRooms.map(r => [r.id.toUpperCase(), r]));

      const allIds = new Set([
        ...localList.map(r => r.id.toUpperCase()),
        ...directRes.ids.map(id => id.toUpperCase()),
        ...initialRooms.map(r => r.id.toUpperCase())
      ]);

      const diffs: { id: string; name: string; inLocal: boolean; inCloud: boolean; inInitial: boolean }[] = [];
      allIds.forEach(id => {
        const inLocal = localMap.has(id);
        const inCloud = cloudSet.has(id);
        const inInitial = initialMap.has(id);
        if (!inLocal || !inCloud || !inInitial) {
          const roomObj = localMap.get(id) || initialMap.get(id);
          diffs.push({
            id,
            name: roomObj?.name || id,
            inLocal,
            inCloud,
            inInitial
          });
        }
      });

      setDiagInfo({
        localCount: localList.length,
        cloudCount: directRes.count,
        initialCount: initialRooms.length,
        cacheTs: cacheTs ? new Date(Number(cacheTs)).toLocaleString() : null,
        diffs,
        error: directRes.error
      });
    } catch (e: any) {
      console.error('Diagnosis error:', e);
    } finally {
      setIsDiagLoading(false);
    }
  };

  // Re-sync Room Directory Fresh from Cloud
  const handleRefreshFromCloudClick = async () => {
    setIsRefreshingRooms(true);
    try {
      if (onRefreshRoomsFromCloud) {
        await onRefreshRoomsFromCloud();
      }
    } finally {
      setIsRefreshingRooms(false);
    }
  };

  // CSV File Handler with Auto-Sync to Firebase
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setSyncSuccessMsg(null);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSVText(text);

      // Auto-sync immediately to Firebase Cloud when staff records are parsed
      if (parsed && parsed.length > 0) {
        if (staffSyncMode === 'replace') {
          const confirmProceed = window.confirm(
            'PERHATIAN: Anda memilih mod "Ganti Semua (padam data lama)". Semua rekod staf di Cloud Firestore yang tiada di dalam fail CSV ini akan DIPADAMKAN secara kekal.\n\nAdakah anda pasti mahu meneruskan?'
          );
          if (!confirmProceed) {
            setCsvFile(null);
            setParsedStaffList([]);
            return;
          }
        }

        if (onSyncStaffUsers) {
          setIsSyncing(true);
          try {
            const res = await onSyncStaffUsers(parsed, staffSyncMode, resetAllPinsOnSync);
            const written = res && 'written' in res ? res.written : parsed.length;
            const deleted = res && 'deleted' in res ? res.deleted : 0;
            if (staffSyncMode === 'replace') {
              setSyncSuccessMsg(
                `🟢 Mod Ganti Semua berjaya! ${written} rekod staf disimpan, ${deleted} rekod lama telah dipadamkan dari Cloud Firebase.`
              );
            } else {
              setSyncSuccessMsg(`🟢 Berjaya auto-sync ${written} rekod staf ke Cloud Firebase secara automatik!`);
            }
          } catch (err) {
            console.warn('Auto sync warning (saved locally):', err);
            setSyncSuccessMsg(`🟢 ${parsed.length} rekod staf berjaya diproses dan disimpan secara tempatan.`);
          } finally {
            setIsSyncing(false);
          }
        } else {
          setSyncSuccessMsg(`🟢 Berjaya memproses ${parsed.length} rekod staf secara tempatan.`);
        }
      }
    };
    reader.readAsText(file);
  };

  const parseCSVText = (text: string): StaffUser[] => {
    // 1. Tolerate UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setParseErrors(['Fail CSV kosong atau tiada baris data selepas tajuk (header).']);
      setParsedStaffList([]);
      return [];
    }

    // Detect delimiter
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, '').trim());
    
    const findIndex = (keys: string[]) => {
      return headers.findIndex(h => keys.some(k => h.includes(k)));
    };

    const idIdx = findIndex(['id', 'staf']);
    const deptIdx = findIndex(['department', 'jabatan']);
    const nameIdx = findIndex(['name', 'nama']);
    const roleIdx = findIndex(['role', 'jawatan']);
    const phoneIdx = findIndex(['phone', 'telefon', 'tel']);
    const emailIdx = findIndex(['email', 'emel', 'e-mel']);
    const passcodeIdx = findIndex(['passcode', 'pin', 'code']);

    const parsed: StaffUser[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;

      // 2. Trim every value and remove surrounding quotes
      const cols = rawLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '').trim());
      
      const email = (emailIdx !== -1 ? cols[emailIdx] : cols[5] || '').trim();
      const name = (nameIdx !== -1 ? cols[nameIdx] : cols[2] || '').trim();
      const dept = (deptIdx !== -1 ? cols[deptIdx] : cols[1] || 'Umum').trim();
      const role = (roleIdx !== -1 ? cols[roleIdx] : cols[3] || 'Pensyarah').trim();
      const phone = (phoneIdx !== -1 ? cols[phoneIdx] : cols[4] || '').trim();
      const customId = (idIdx !== -1 ? cols[idIdx] : cols[0] || '').trim();
      const customPin = (passcodeIdx !== -1 ? cols[passcodeIdx] : '').trim();

      if (!email || !email.includes('@')) {
        errors.push(`Baris ${i + 1}: E-mel tidak sah ("${email}")`);
        continue;
      }

      if (!name) {
        errors.push(`Baris ${i + 1}: Nama tidak dinyatakan.`);
        continue;
      }

      // 3. Lowercase emails
      const cleanEmail = email.toLowerCase();
      const id = (customId || `ST-${String(parsed.length + 100).padStart(3, '0')}`).trim();

      // SES v4.4: Staff ID is PRIMARY IDENTITY. Email is an editable attribute.
      const existing = staffList.find(
        s => s.id && s.id.trim().toLowerCase() === id.toLowerCase()
      );

      let pinStatus: 'DEFAULT' | 'CUSTOM' = 'DEFAULT';
      let pinChangedAt: string | undefined = undefined;

      if (existing) {
        // EXISTING STAFF: Update profile fields ONLY, MUST PRESERVE existing credentials!
        const isCustom = existing.pinStatus === 'CUSTOM' && !!existing.pinChangedAt;
        pinStatus = isCustom ? 'CUSTOM' : 'DEFAULT';
        pinChangedAt = isCustom ? existing.pinChangedAt : undefined;
      } else {
        // NEW STAFF: System automatically assigns default PIN 1234 & DEFAULT status
        pinStatus = 'DEFAULT';
      }

      parsed.push({
        id,
        department: dept,
        name,
        role,
        phone,
        email: cleanEmail,
        pinStatus,
        pinChangedAt
      });
    }

    setParseErrors(errors);
    setParsedStaffList(parsed);
    return parsed;
  };

  const handleExecuteSync = async () => {
    if (parsedStaffList.length === 0) {
      alert('Tiada data CSV yang sah untuk disinkronkan.');
      return;
    }

    if (staffSyncMode === 'replace') {
      const confirmProceed = window.confirm(
        'PERHATIAN: Anda memilih mod "Ganti Semua (padam data lama)". Semua rekod staf di Cloud Firestore yang tiada di dalam fail CSV ini akan DIPADAMKAN secara kekal.\n\nAdakah anda pasti mahu meneruskan?'
      );
      if (!confirmProceed) return;
    }

    const count = parsedStaffList.length;

    if (onSyncStaffUsers) {
      setIsSyncing(true);
      try {
        const res = await onSyncStaffUsers(parsedStaffList, staffSyncMode, resetAllPinsOnSync);
        const written = res && 'written' in res ? res.written : count;
        const deleted = res && 'deleted' in res ? res.deleted : 0;
        if (staffSyncMode === 'replace') {
          setSyncSuccessMsg(
            `🟢 Mod Ganti Semua berjaya! ${written} rekod staf disimpan, ${deleted} rekod lama telah dipadamkan dari Cloud Firebase.`
          );
        } else {
          setSyncSuccessMsg(`🟢 Berjaya menyinkronkan ${written} rekod staf ke Cloud Firebase!`);
        }
        setIsSyncing(false);
        // SES v4.4: CSV Preview workspace is temporary. Clear it after successful sync!
        setParsedStaffList([]);
        setCsvFile(null);
      } catch (err) {
        setIsSyncing(false);
        setSyncSuccessMsg(`🟢 Berjaya memproses ${count} rekod staf secara tempatan.`);
        setParsedStaffList([]);
        setCsvFile(null);
      }
    } else {
      setSyncSuccessMsg(`🟢 Berjaya memproses ${count} rekod staf secara tempatan!`);
      setParsedStaffList([]);
      setCsvFile(null);
    }
  };

  const [resettingPinStaffId, setResettingPinStaffId] = useState<string | null>(null);

  const handleResetStaffPin = async (st: StaffUser) => {
    const confirmReset = window.confirm(
      `Adakah anda pasti ingin menetapkan semula PIN untuk ${st.name} kepada PIN lalai (1234)?\n\nStaf akan diminta menetapkan PIN 4-digit baharu semasa log masuk seterusnya.`
    );
    if (!confirmReset) return;

    setResettingPinStaffId(st.id);
    try {
      const res = await resetStaffPinInCloud(st.id, '5313');
      if (!res.success) {
        throw new Error(res.errorMsg || 'Gagal menetapkan semula PIN staf.');
      }
      const updated = staffList.map(item =>
        item.id === st.id ? { ...item, pinStatus: 'DEFAULT' as const, pinChangedAt: undefined } : item
      );
      saveStoredStaffUsers(updated);
      alert(`PIN untuk ${st.name} telah berjaya diset semula kepada 1234 (Lalai).`);
    } catch (err: any) {
      alert(`Ralat semasa menetapkan semula PIN staf: ${err.message || 'Ralat sambungan.'}`);
    } finally {
      setResettingPinStaffId(null);
    }
  };

  const [isResettingAllPins, setIsResettingAllPins] = useState<boolean>(false);

  const handleResetAllPinsToDefault = async () => {
    const confirmReset = window.confirm(
      'Adakah anda pasti ingin menetapkan semula SEMUA staf kepada PIN lalai (1234)?\n\nSemua akaun akan berstatus lalai dan diminta menetapkan PIN keselamatan sendiri semasa log masuk kali pertama.'
    );
    if (!confirmReset) return;

    setIsResettingAllPins(true);
    try {
      const resetList: StaffUser[] = staffList.map(item => ({
        ...item,
        pinStatus: 'DEFAULT' as const,
        pinChangedAt: undefined
      }));
      if (onSyncStaffUsers) {
        await onSyncStaffUsers(resetList, 'merge', true);
      } else {
        saveStoredStaffUsers(resetList);
      }
      alert('🟢 Berjaya! Semua PIN staf telah ditetapkan semula kepada 1234 (Lalai) dan disinkronkan ke Cloud Firebase.');
    } catch (err: any) {
      alert(`Ralat semasa menetapkan semula semua PIN staf: ${err.message || 'Ralat sambungan.'}`);
    } finally {
      setIsResettingAllPins(false);
    }
  };

  const filteredStaffList = staffList.filter(s => 
    s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearchTerm.toLowerCase())
  );

  // Targeted 4 Exam Venues for Nov 2026
  const TARGET_EXAM_ROOM_IDS = ['DEWAN_BESAR', 'SRI_PENAWAR', 'DEWAN_SEMINAR', 'MINI_SEMINAR'];

  // Check if November 2026 exam block is active for all 4 rooms
  const isExamNovLocked = TARGET_EXAM_ROOM_IDS.every(roomId =>
    institutionalBlocks.some(b =>
      b.roomId === roomId &&
      (b.date === '2026-11-02' || (b.endDate && '2026-11-02' >= b.date && '2026-11-16' <= b.endDate) || b.batchId === 'BATCH-EXAM-NOV-2026')
    )
  );

  // Quick 1-Click Lock for 2 Nov - 16 Nov 2026 (08:00 AM - 12:00 AM)
  const handleQuickLockExamNovember = async () => {
    if (!onBatchAddBlocks) {
      alert('Fungsi sekatan institusi tidak tersedia.');
      return;
    }

    const confirmLock = window.confirm(
      'PENGESAHAN KUNCI PEPERIKSAAN AKHIR:\n\nAdakah anda pasti ingin mengunci 4 dewan utama:\n1. Dewan Besar\n2. Dewan Sri Penawar\n3. Dewan Seminar\n4. Mini Seminar\n\nTarikh: 2 Nov 2026 – 16 Nov 2026 (15 Hari Berturut-turut)\nWaktu: 08:00 AM – 12:00 AM (Sepanjang Hari / 24 Jam)\nTujuan: Peperiksaan Akhir Semester Nov 2026\n\nSemua slot dewan ini akan disekat sepenuhnya daripada sebarang tempahan biasa dalam sistem.'
    );
    if (!confirmLock) return;

    setIsSubmittingBlock(true);
    setBlockSuccessMsg(null);

    const blocksToCreate: Omit<InstitutionalBlock, 'id'>[] = TARGET_EXAM_ROOM_IDS.map(roomId => ({
      roomId,
      date: '2026-11-02',
      endDate: '2026-11-16',
      startTime: '08:00',
      endTime: '24:00',
      title: 'Peperiksaan Akhir Semester Nov 2026',
      reason: 'Penggunaan Rasmi Peperiksaan Akhir Semester KPM Bandar Penawar',
      createdBy: 'UPPK',
      category: 'EXAM',
      batchId: 'BATCH-EXAM-NOV-2026'
    }));

    try {
      await onBatchAddBlocks(blocksToCreate);
      setBlockSuccessMsg(
        '🔒 Berjaya Mengunci 4 Dewan Peperiksaan (2 Nov – 16 Nov 2026, 08:00 AM – 12:00 AM) ke Cloud Firestore!'
      );
    } catch (err) {
      alert('Ralat semasa mengunci dewan peperiksaan.');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  // Quick 1-Click Unlock for Nov 2026 Exam
  const handleQuickUnlockExamNovember = async () => {
    if (!onDeleteBatchBlocks) return;

    const confirmUnlock = window.confirm(
      'Adakah anda pasti mahu membuka kunci (nyahkunci) sekatan Peperiksaan Akhir bagi 4 dewan tersebut?\n\nRuang akan dibuka semula untuk tempahan pensyarah.'
    );
    if (!confirmUnlock) return;

    const matchingIds = institutionalBlocks
      .filter(b => 
        b.batchId === 'BATCH-EXAM-NOV-2026' ||
        (TARGET_EXAM_ROOM_IDS.includes(b.roomId) && (b.category === 'EXAM' || b.title.toLowerCase().includes('peperiksaan')) && (b.date === '2026-11-02' || b.endDate === '2026-11-16'))
      )
      .map(b => b.id);

    if (matchingIds.length === 0) {
      alert('Tiada sekatan peperiksaan ditemui.');
      return;
    }

    try {
      await onDeleteBatchBlocks(matchingIds);
      setBlockSuccessMsg('🔓 Sekatan Peperiksaan Akhir telah berjaya dibuka semula.');
    } catch (err) {
      alert('Ralat semasa membuka kunci ruang.');
    }
  };

  // Custom Multi-Room / Multi-Day Block creation
  const handleCustomCreateBlocks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBlockRooms.length === 0) {
      alert('Sila pilih sekurang-kurangnya satu bilik/dewan.');
      return;
    }
    if (!blockStartDate || !blockEndDate) {
      alert('Sila pilih tarikh mula dan tarikh tamat.');
      return;
    }
    if (blockStartDate > blockEndDate) {
      alert('Tarikh mula mestilah sebelum atau sama dengan tarikh tamat.');
      return;
    }
    if (!blockTitle.trim()) {
      alert('Sila masukkan tajuk sekatan.');
      return;
    }

    if (!onBatchAddBlocks) return;

    setIsSubmittingBlock(true);
    setBlockSuccessMsg(null);

    const actualStart = isAllDayBlock ? '08:00' : blockStartTime;
    const actualEnd = isAllDayBlock ? '24:00' : blockEndTime;
    const batchId = `BATCH-${Date.now()}`;

    const newBlocks: Omit<InstitutionalBlock, 'id'>[] = selectedBlockRooms.map(roomId => ({
      roomId,
      date: blockStartDate,
      endDate: blockEndDate,
      startTime: actualStart,
      endTime: actualEnd,
      title: blockTitle.trim(),
      reason: blockReason.trim(),
      createdBy: blockCreatedBy.trim() || 'UPPK',
      category: blockCategory,
      batchId
    }));

    try {
      await onBatchAddBlocks(newBlocks);
      setBlockSuccessMsg(
        `🔒 Berjaya menambah ${newBlocks.length} sekatan ruang bagi tarikh ${blockStartDate} hingga ${blockEndDate}!`
      );
    } catch (err) {
      alert('Ralat semasa menyimpan sekatan.');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  // Delete single block
  const handleDeleteSingleBlock = async (id: string, title: string, roomCode: string) => {
    if (!onDeleteBlock) return;
    const ok = window.confirm(`Padam sekatan "${title}" untuk ruang ${roomCode}?`);
    if (!ok) return;

    try {
      await onDeleteBlock(id);
    } catch (err) {
      alert('Ralat memadam sekatan.');
    }
  };

  // Filtered institutional blocks
  const filteredBlocks = institutionalBlocks.filter(b => {
    const matchesSearch = 
      b.title.toLowerCase().includes(blockSearchTerm.toLowerCase()) ||
      b.roomId.toLowerCase().includes(blockSearchTerm.toLowerCase()) ||
      b.createdBy.toLowerCase().includes(blockSearchTerm.toLowerCase()) ||
      (b.reason && b.reason.toLowerCase().includes(blockSearchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (blockFilterCategory === 'EXAM') {
      return b.category === 'EXAM' || b.title.toLowerCase().includes('peperiksaan');
    }
    if (blockFilterCategory === 'INSTITUTIONAL') {
      return b.category === 'INSTITUTIONAL' || (!b.category && !b.title.toLowerCase().includes('peperiksaan'));
    }
    if (blockFilterCategory === 'MAINTENANCE') {
      return b.category === 'MAINTENANCE' || b.title.toLowerCase().includes('penyenggaraan');
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Mod Pentadbir KPMBP
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Kawalan Pentadbir
            </h2>

          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCloudSyncModal(true)}
              className="bg-blue-900/80 hover:bg-blue-800 text-blue-100 border border-blue-700/80 text-xs font-semibold py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
              title="Status Firebase Cloud Firestore Multi-Device"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cloud className="w-3.5 h-3.5 text-blue-300" />
              <span>Status Cloud Sync</span>
            </button>

            {onLogoutAdmin && (
              <button
                id="btn-admin-panel-logout"
                onClick={onLogoutAdmin}
                className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold border border-amber-400 text-xs py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-950/20"
                title="Log keluar dari mod admin dan kembali ke paparan utama"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-950" />
                <span>Log Keluar Admin</span>
              </button>
            )}

            <button
              onClick={() => {
                if (confirm('Adakah anda pasti mahu menetapkan semula (reset) semua data ke nilai asal KPMBP (Zero Demo Data)?')) {
                  onResetData();
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold py-2 px-3.5 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Data Asal</span>
            </button>


          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Tempahan Ad-Hoc:</span>
              <strong className="text-xl font-bold text-emerald-400">{bookings.length} Rekod</strong>
            </div>
            <button
              type="button"
              onClick={() => handleExportBookingsCSV('ALL')}
              className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Muat turun sandaran CSV semua tempahan adhoc masuk"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Eksport Sandaran CSV</span>
            </button>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Direktori Ruang Kuliah:</span>
              <strong className="text-xl font-bold text-cyan-400">{rooms.length} Ruang &amp; Fasiliti</strong>
            </div>
            <button
              type="button"
              onClick={handleExportRoomsListCSV}
              className="mt-2 w-full bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Muat turun data direktori ruang semasa ke fail CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Eksport CSV Ruang</span>
            </button>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Jadual Akademik Aktif:</span>
              <strong className="text-xl font-bold text-blue-400">{academicSchedule.length} Slot Terkunci</strong>
            </div>
            <div className="mt-2 py-1 text-[11px] text-slate-300 font-medium">
              Sesi Rasmi Kolej
            </div>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-medium">Sekatan Peperiksaan &amp; Institusi:</span>
              <strong className="text-xl font-bold text-rose-400">{institutionalBlocks.length} Sekatan Ruang</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: TIMETABLE CSV UPLOAD & AUTOMATIC ROOM LOCKING */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full text-xs font-bold mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Unit Jadual Waktu &amp; Penguncian Slot Kolej</span>
            </div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <h3>Slot Jadual Pensyarah</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Admin boleh menetapkan dan menyinkronkan slot yang akan dikunci (locked) menggunakan fail CSV mengikut format standard <code>Perkara, Hari, [Slot Masa...]</code>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadStandardGridTemplate}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Muat turun templat CSV format standard matriks jadual"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Templat Standard (Perkara/Hari)</span>
            </button>

            <button
              onClick={handleExportCurrentScheduleCSV}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Eksport jadual waktu aktif semasa ke fail CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Eksport CSV Semasa</span>
            </button>

            <button
              onClick={() => setShowClearScheduleModal(true)}
              disabled={academicSchedule.length === 0}
              className="bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-800 border border-rose-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Kosongkan dan padamkan semua rekod jadual kuliah sedia ada dari sistem"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Kosongkan Semua ({academicSchedule.length} Slot)</span>
            </button>
          </div>
        </div>

        {/* Upload Zone & Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Ketetapan Susunan CSV (Locked Slots)</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Format ini bertindak sebagai <em>source of truth</em> rasmi. Admin menyusun baris mengikut ruang dan hari:
            </p>
            <div className="bg-slate-900 text-indigo-300 p-2.5 rounded-lg font-mono text-[10.5px] overflow-x-auto border border-slate-800 leading-tight">
              Perkara,Hari,8:30 - 9:30,9:30 - 10:30,...<br />
              SURAU 1,MON,AFIF,AFIF,,...<br />
              SURAU 2,MON,NIZAM,NIZAM,,...
            </div>
            <ul className="space-y-1.5 text-slate-600 text-[11px]">
              <li className="flex items-start gap-1.5">
                <span className="text-indigo-600 font-bold">•</span>
                <span><strong>Ruang (Perkara)</strong>: Kod atau nama ruang (cth: <code>SURAU 1</code>, <code>SURAU 2</code>, <code>BK01</code>, <code>DEWAN MAKAN</code>).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-indigo-600 font-bold">•</span>
                <span><strong>Hari</strong>: <code>MON</code>, <code>TUE</code>, <code>WED</code>, <code>THU</code>, <code>FRI</code> atau ejaan Bahasa Melayu.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-rose-600 font-bold">•</span>
                <span><strong>Slot Bernilai (Locked)</strong>: Sebarang nama (cth: <code>AFIF</code>, <code>NIZAM</code>, atau subjek) akan <strong>mengunci slot</strong> secara automatik dari tempahan umum.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span><strong>Slot Kosong (Available)</strong>: Biarkan sel kosong untuk membiarkan slot dibuka untuk tempahan ad-hoc.</span>
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={handleDownloadTimetableCSVTemplate}
                className="text-[11px] text-slate-500 hover:text-indigo-600 underline cursor-pointer"
              >
                Muat turun templat format penuh FET/Unit Jadual
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Sync Mode Selection Cards */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Pilihan Mod Penyelarasan Jadual Waktu:
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Jadual aktif semasa di sistem: <strong className="text-indigo-900 font-bold">{academicSchedule.length} slot</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Total Overwrite */}
                <div 
                  onClick={() => setScheduleSyncMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    scheduleSyncMode === 'replace'
                      ? 'bg-amber-50/80 border-amber-500 shadow-sm ring-2 ring-amber-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scheduleSyncMode"
                        value="replace"
                        checked={scheduleSyncMode === 'replace'}
                        onChange={() => setScheduleSyncMode('replace')}
                        className="text-amber-600 focus:ring-amber-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Ganti Sepenuhnya (Total Overwrite)
                        </span>
                        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">
                          Bersihkan Lama &amp; Ganti Baharu
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 shrink-0">
                      Disyorkan
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Memadamkan kesemua <strong>{academicSchedule.length} slot sedia ada</strong> secara bersih dari Cloud Firestore dan menggantikannya 100% dengan fail jadual baharu ini (Sesuai semester baharu).
                  </p>
                </div>

                {/* Option 2: Merge Mode */}
                <div 
                  onClick={() => setScheduleSyncMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    scheduleSyncMode === 'merge'
                      ? 'bg-indigo-50/80 border-indigo-500 shadow-sm ring-2 ring-indigo-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scheduleSyncMode"
                        value="merge"
                        checked={scheduleSyncMode === 'merge'}
                        onChange={() => setScheduleSyncMode('merge')}
                        className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Gabung &amp; Kemas Kini (Merge)
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide">
                          Kemas Kini Bilik Terlibat Sahaja
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 shrink-0">
                      Kemas Kini Terhad
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Hanya mengemas kini bilik-bilik yang disenaraikan dalam fail CSV ini. Bilik-bilik lain yang tidak terdapat dalam fail dikekalkan.
                  </p>
                </div>
              </div>
            </div>

            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer relative ${
              isSyncingSchedule
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-indigo-200 hover:border-indigo-500 bg-indigo-50/20 hover:bg-indigo-50/50'
            }`}>
              <input
                type="file"
                accept=".csv"
                onChange={handleScheduleFileUpload}
                disabled={isSyncingSchedule}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Pilih fail CSV jadual waktu untuk auto-sync ke Firebase"
              />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-300 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Auto-Sync ke Firebase Aktif</span>
              </div>
              <UploadCloud className={`w-10 h-10 mx-auto mb-2 ${isSyncingSchedule ? 'text-indigo-600 animate-bounce' : 'text-indigo-600'}`} />
              <div className="font-bold text-slate-800 text-sm">
                {isSyncingSchedule ? (
                  <span className="text-indigo-700 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    Sedang auto-sync jadual ke Firebase Cloud...
                  </span>
                ) : scheduleCsvFile ? (
                  `Fail dipilih: ${scheduleCsvFile.name}`
                ) : (
                  'Pilih atau Tarik Fail CSV Jadual Waktu di Sini'
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isSyncingSchedule
                  ? 'Slot jadual sedang disinkronkan dan dikunci secara langsung ke Cloud Firestore...'
                  : 'Slot jadual akan auto-sync dan dikunci ke Firebase sebaik sahaja fail CSV dimasukkan (format Perkara/Hari atau fail FET).'}
              </p>
            </div>

            {/* Parse Errors */}
            {scheduleParseErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Ralat pembacaan CSV:</span>
                </div>
                {scheduleParseErrors.map((err, idx) => (
                  <div key={idx} className="pl-5 text-[11px]">• {err}</div>
                ))}
              </div>
            )}

            {/* Sync Success Message */}
            {scheduleSyncSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs font-bold text-emerald-800 flex items-start gap-2.5 shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{scheduleSyncSuccessMsg}</span>
              </div>
            )}

            {/* Parsed Schedule Summary & Table Preview */}
            {parsedScheduleSlots.length > 0 && (
              <div className="space-y-3 pt-2">
                {scheduleSyncMode === 'replace' && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Pengesanan Mod Ganti Sepenuhnya (Clean Overwrite):</strong>
                      <span className="text-[11px] text-amber-900 leading-relaxed block mt-0.5">
                        Sistem akan <strong>membersihkan kesemua {academicSchedule.length} slot lama</strong> dan menggantikannya dengan <strong>{parsedScheduleSlots.length} slot baharu</strong> di Cloud Firestore.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-200">
                  <div className="text-xs">
                    <span className="font-bold text-indigo-950 block text-sm">Ringkasan Imbasan Jadual Waktu:</span>
                    <span className="text-indigo-800 text-[11px] mt-0.5 block">
                      <strong>{scheduleParseSummary?.validSlotsCount} slot terkunci</strong> dikesan merentasi <strong>{scheduleParseSummary?.roomsAffected.join(', ')}</strong> ({scheduleParseSummary?.roomsAffected.length} ruang).
                    </span>
                  </div>

                  <button
                    onClick={handleTriggerScheduleSync}
                    disabled={isSyncingSchedule}
                    className={`font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shrink-0 active:scale-95 cursor-pointer text-white ${
                      scheduleSyncMode === 'replace'
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingSchedule ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncingSchedule 
                        ? 'Sedang Memproses...' 
                        : scheduleSyncMode === 'replace' 
                          ? `GANTIKAN SEMUA (${parsedScheduleSlots.length} SLOT)` 
                          : `GABUNGKAN ${parsedScheduleSlots.length} SLOT`}
                    </span>
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Ruang / BK</th>
                        <th className="p-2">Hari</th>
                        <th className="p-2">Masa</th>
                        <th className="p-2">Kod Subjek</th>
                        <th className="p-2">Kelas</th>
                        <th className="p-2">Pensyarah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedScheduleSlots.slice(0, 50).map((slot, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-indigo-700">{slot.roomId}</td>
                          <td className="p-2 font-medium">{slot.dayOfWeek}</td>
                          <td className="p-2 text-slate-600 font-mono text-[11px]">{slot.startTime} - {slot.endTime}</td>
                          <td className="p-2 font-bold">{slot.courseCode === 'TERKUNCI' ? 'LOCKED' : slot.courseCode}</td>
                          <td className="p-2 text-slate-700">{slot.className}</td>
                          <td className="p-2 text-slate-600 truncate max-w-[150px]">{slot.lecturerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedScheduleSlots.length > 50 && (
                    <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                      ... dan {parsedScheduleSlots.length - 50} slot lagi.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION: BUNDLE CSV IMPORT & SYNCHRONIZATION */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3>Staf & Pensyarah</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Muat naik fail CSV untuk menambah atau mengemaskini senarai e-mel staf berdaftar bagi pengesahan automatik tempahan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportStaffListCSV}
              className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
              title="Eksport senarai profil staf ke CSV (tanpa PIN credential)"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              <span>Eksport Profil Staf (.csv)</span>
            </button>

            <button
              onClick={handleDownloadCSVTemplate}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
              title="Muat turun templat CSV rasmi (6 medan asas tanpa PIN)"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Muat Turun Template CSV (.csv)</span>
            </button>
          </div>
        </div>

        {/* Upload Zone & Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Panduan Format Header CSV</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Muat naik fail CSV yang mengandungi 6 maklumat asas profil staf:
            </p>
            <div className="bg-slate-900 text-amber-300 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800">
              id,department,name,role,phone,email
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-blue-900 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1 text-blue-950">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>PIN tidak perlu dimasukkan.</span>
              </p>
              <p className="text-blue-800/90 leading-relaxed text-[10.5px]">
                Sistem akan menetapkan PIN lalai <strong className="font-mono font-bold">1234</strong> secara automatik untuk staf baharu. Staf akan diminta menukar PIN tersebut semasa log masuk kali pertama. Bagi staf sedia ada, PIN tersendiri akan dikekalkan.
              </p>
            </div>

            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
              <li><strong>email</strong>: Alamat e-mel rasmi kolej (@kpmbp.edu.my)</li>
              <li><strong>phone</strong>: Nombor telefon bimbit untuk urusan WhatsApp</li>
              <li><strong>department / role</strong>: Jabatan dan jawatan pensyarah/staf</li>
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Staff Sync Mode Selection Cards */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Pilihan Mod Penyelarasan E-mel &amp; Profil Staf:
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Staf berdaftar semasa di sistem: <strong className="text-emerald-900 font-bold">{staffList.length} orang</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Gabung (kemaskini & tambah) */}
                <div 
                  onClick={() => setStaffSyncMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    staffSyncMode === 'merge'
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-2 ring-emerald-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="staffSyncMode"
                        value="merge"
                        checked={staffSyncMode === 'merge'}
                        onChange={() => setStaffSyncMode('merge')}
                        className="text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Gabung (kemaskini &amp; tambah)
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wide">
                          Kemas Kini Staf Terlibat
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      Lalai (Default)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Hanya mengemas kini atau menambah staf yang terdapat dalam fail CSV. Staf lain yang sedia ada dalam sistem akan dikekalkan.
                  </p>
                </div>

                {/* Option 2: Ganti Semua (padam data lama) */}
                <div 
                  onClick={() => setStaffSyncMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    staffSyncMode === 'replace'
                      ? 'bg-rose-50/80 border-rose-500 shadow-sm ring-2 ring-rose-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="staffSyncMode"
                        value="replace"
                        checked={staffSyncMode === 'replace'}
                        onChange={() => setStaffSyncMode('replace')}
                        className="text-rose-600 focus:ring-rose-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Ganti Semua (padam data lama)
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">
                          Padam Rekod Tiada Dalam CSV
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 shrink-0">
                      Pembersihan Penuh
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Memadamkan kesemua rekod staf lama di Cloud Firestore yang tiada di dalam fail CSV ini dan hanya mengekalkan senarai baharu (contoh: 75 staf rasmi).
                  </p>
                </div>
              </div>

              {/* Reset semua PIN kepada 1234 Checkbox */}
              {staffSyncMode === 'replace' && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={resetAllPinsOnSync}
                      onChange={(e) => setResetAllPinsOnSync(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-amber-400"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Reset semua PIN kepada 1234</span>
                      <span className="text-[11px] text-slate-600">
                        Jika ditandakan, semua staf akan ditetapkan semula kepada PIN lalai 1234 (status DEFAULT). Jika tidak ditandakan, PIN tersendiri staf sedia ada akan dikekalkan.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer relative ${
              isSyncing
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30'
            }`}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isSyncing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Pilih fail CSV profil staf untuk auto-sync ke Firebase"
              />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Auto-Sync ke Firebase Aktif</span>
              </div>
              <UploadCloud className={`w-10 h-10 mx-auto mb-2 ${isSyncing ? 'text-blue-600 animate-bounce' : 'text-emerald-600'}`} />
              <div className="font-bold text-slate-800 text-sm">
                {isSyncing ? (
                  <span className="text-blue-700 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    Sedang auto-sync ke Firebase Cloud...
                  </span>
                ) : csvFile ? (
                  `Fail dipilih: ${csvFile.name}`
                ) : (
                  'Pilih atau Tarik Fail CSV ke Sini'
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isSyncing
                  ? 'Data sedang disinkronkan secara langsung ke Firebase Cloud Firestore...'
                  : 'Data akan auto-sync ke Firebase secara automatik sebaik sahaja fail CSV dimasukkan.'}
              </p>
            </div>

            {/* Parse Error Messages */}
            {parseErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Beberapa baris CSV tidak lengkap atau mengandungi ralat:</span>
                </div>
                {parseErrors.map((err, idx) => (
                  <div key={idx} className="pl-5 text-[11px]">• {err}</div>
                ))}
              </div>
            )}

            {/* Sync Status Banner */}
            {syncSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{syncSuccessMsg}</span>
              </div>
            )}

            {/* Parsed Preview Table & Sync Trigger */}
            {parsedStaffList.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Pratonton Rekod CSV Ditemui ({parsedStaffList.length} rekod):
                  </span>

                  <button
                    onClick={handleExecuteSync}
                    disabled={isSyncing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : `SINKRONISASI ${parsedStaffList.length} REKOD KE FIREBASE`}</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Nama</th>
                        <th className="p-2">E-mel</th>
                        <th className="p-2">Jabatan</th>
                        <th className="p-2">Telefon</th>
                        <th className="p-2">Status Akaun &amp; PIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedStaffList.map((st, idx) => {
                        const existing = staffList.find(
                          s => s.id && s.id.trim().toLowerCase() === st.id.trim().toLowerCase()
                        );
                        const isNew = !existing;
                        const isEmailChanged = existing && existing.email.toLowerCase() !== st.email.toLowerCase();
                        const isProfileChanged = existing && (
                          isEmailChanged ||
                          existing.name.trim() !== st.name.trim() ||
                          existing.department.trim() !== st.department.trim() ||
                          existing.phone.trim() !== st.phone.trim()
                        );

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-[11px] font-bold">{st.id}</td>
                            <td className="p-2 font-semibold">{st.name}</td>
                            <td className="p-2 text-blue-600 font-medium">
                              <div>{st.email}</div>
                              {isEmailChanged && (
                                <div className="text-[10px] text-amber-700 line-through">
                                  {existing.email}
                                </div>
                              )}
                            </td>
                            <td className="p-2">{st.department}</td>
                            <td className="p-2 font-mono">{st.phone}</td>
                            <td className="p-2 whitespace-nowrap">
                              {isNew ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  STAF BAHARU (PIN LALAI 1234)
                                </span>
                              ) : isProfileChanged ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1" title={isEmailChanged ? `Email dikemas kini dari ${existing.email}` : 'Maklumat profil dikemas kini'}>
                                  <Check className="w-3 h-3 text-blue-600" />
                                  KEMAS KINI PROFIL (PIN DIKEKALKAN)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                  TIADA PERUBAHAN
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Existing Registered Staff List Search */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Senarai Staf & E-mel Berdaftar Sedia Ada ({staffList.length})</span>
            </h4>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetAllPinsToDefault}
                disabled={isResettingAllPins}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                title="Setkan semula semua user kepada PIN lalai (1234)"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-amber-600 ${isResettingAllPins ? 'animate-spin' : ''}`} />
                <span>{isResettingAllPins ? 'Sedang Memproses...' : 'Set Semua PIN Lalai (1234)'}</span>
              </button>

              {onRefreshStaffFromCloud && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshingStaff(true);
                    try {
                      await onRefreshStaffFromCloud();
                    } finally {
                      setIsRefreshingStaff(false);
                    }
                  }}
                  disabled={isRefreshingStaff}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Segarkan data staf dan status keselamatan PIN terkini dari Cloud Firestore"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshingStaff ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingStaff ? 'Menyegerakkan...' : 'Segarkan dari Cloud'}</span>
                </button>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau e-mel..."
                  value={staffSearchTerm}
                  onChange={(e) => setStaffSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white font-bold sticky top-0">
                <tr>
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">Nama Staf</th>
                  <th className="p-2.5">E-mel</th>
                  <th className="p-2.5">Status Keselamatan PIN</th>
                  <th className="p-2.5">Tindakan Pentadbir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
                {filteredStaffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-slate-500 whitespace-nowrap">{s.id}</td>
                    <td className="p-2.5 font-bold text-slate-900">{s.name}</td>
                    <td className="p-2.5 text-blue-600 font-medium">{s.email}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      {s.pinStatus === 'CUSTOM' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          PIN Tersuai (Disulitkan SHA-256)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Lock className="w-3 h-3 text-amber-600" />
                          PIN Lalai (Perlu Tukar)
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {s.pinStatus === 'CUSTOM' && (
                          <button
                            type="button"
                            disabled={resettingPinStaffId === s.id}
                            onClick={() => handleResetStaffPin(s)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-bold rounded-lg text-[10px] transition cursor-pointer disabled:opacity-50"
                            title="Set semula PIN ke Lalai (1234) jika staf terlupa"
                          >
                            {resettingPinStaffId === s.id ? 'Memproses...' : 'Reset ke Lalai'}
                          </button>
                        )}
                        {s.phone && (
                          <a
                            href={`https://wasap.my/6${s.phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`Salam ${s.name}, untuk keselamatan akaun BookBK KPMBP anda, sila log masuk ke sistem dan kemas kini PIN keselamatan anda.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 bg-[#25D366]/10 hover:bg-[#25D366]/25 text-[#25D366] rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold"
                            title={`Hantar Peringatan ke WhatsApp ${s.name}`}
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION: ROOMS & DIRECTORY CSV TEMPLATE, EXPORT & IMPORT */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-0.5 rounded-full text-xs font-bold mb-1">
              <Building className="w-3.5 h-3.5 text-cyan-600" />
              <span>Unit Pengurusan Fasiliti &amp; Ruang KPMBP</span>
            </div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
              <h3>Pengurusan Ruang Fasiliti</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ubah suai perincian aras/tingkat (contoh: <strong>Gamma &amp; Alfa - 1st Floor</strong>, <strong>Sigma, Beta &amp; S. Classroom - Ground Floor</strong>, <strong>Bilik Inkubator - Ground Floor</strong>), blok bangunan, kapasiti, dan kemudahan melalui templat CSV atau muat naik fail CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleRunDiagnosis}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Periksa integriti data bilik antara LocalStorage, Firestore Cloud, dan Kod Asal"
            >
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span>Diagnostik Ruang</span>
            </button>

            <button
              onClick={handleOpenSeedModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              title="Seed 47 ruang dari pelayar ini ke Cloud Firestore sekali sahaja"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Seed Ruang ke Cloud</span>
            </button>

            <button
              onClick={handleRefreshFromCloudClick}
              disabled={isRefreshingRooms}
              className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Kosongkan cache pelayar dan segerak semula senarai ruang terus dari Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isRefreshingRooms ? 'animate-spin' : ''}`} />
              <span>Segerak Semula dari Cloud</span>
            </button>

            <button
              onClick={handleExportRoomsListCSV}
              className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
              title="Eksport senarai penuh ruang semasa ke fail CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
              <span>Eksport CSV</span>
            </button>

            <button
              onClick={handleDownloadRoomsCSVTemplate}
              className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-cyan-600/20 shrink-0 cursor-pointer"
              title="Muat turun templat CSV piawai dengan contoh penetapan aras"
            >
              <Download className="w-4 h-4" />
              <span>Templat CSV</span>
            </button>
          </div>
        </div>

        {/* Upload Zone & Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <Building className="w-4 h-4 text-cyan-600" />
              <span>Panduan Format Header CSV Ruang</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Fail CSV mengandungi maklumat direktori ruang bilik kuliah &amp; fasiliti:
            </p>
            <div className="bg-slate-900 text-cyan-300 p-2.5 rounded-lg font-mono text-[10.5px] overflow-x-auto border border-slate-800 leading-relaxed">
              id,code,name,category,capacity,block,level,facilities,hasAircond,isSmartClassroom,notes
            </div>

            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2.5 text-cyan-950 text-[11px] space-y-1.5">
              <p className="font-bold flex items-center gap-1 text-cyan-900">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                <span>Contoh Penetapan Aras (Level / Floor):</span>
              </p>
              <div className="space-y-1 pl-1 text-[11px]">
                <div className="flex items-center justify-between border-b border-cyan-200/60 pb-1">
                  <span className="font-semibold text-slate-800">Gamma, Alfa:</span>
                  <span className="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">1st Floor</span>
                </div>
                <div className="flex items-center justify-between border-b border-cyan-200/60 pb-1">
                  <span className="font-semibold text-slate-800">Sigma, Beta, S. Classroom:</span>
                  <span className="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">Ground Floor</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Bilik Inkubator:</span>
                  <span className="bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">Ground Floor</span>
                </div>
              </div>
            </div>

            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
              <li><strong>level</strong>: Menerima <code>Ground Floor</code>, <code>1st Floor</code>, <code>2nd Floor</code>, <code>3rd Floor</code>.</li>
              <li><strong>code / name</strong>: Kod bilik (cth: <code>LAB GAMMA</code>, <code>BK01</code>, <code>BLK. INKUBATOR</code>).</li>
              <li><strong>facilities</strong>: Kemudahan dipisahkan dengan tanda titik bertindih (<code>;</code>).</li>
              <li><strong>Tip Admin</strong>: Anda boleh muat turun senarai sedia ada melalui <em>Eksport CSV Ruang Semasa</em>, edit detail aras/tingkat di Excel, dan import semula.</li>
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Sync Mode Selection */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-600" />
                  Pilihan Mod Penyelarasan Ruang:
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Ruang sedia ada di sistem: <strong className="text-cyan-900 font-bold">{rooms.length} ruang</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Gabung / Kemaskini */}
                <div
                  onClick={() => setRoomSyncMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    roomSyncMode === 'merge'
                      ? 'bg-cyan-50/80 border-cyan-500 shadow-sm ring-2 ring-cyan-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="roomSyncMode"
                        value="merge"
                        checked={roomSyncMode === 'merge'}
                        onChange={() => setRoomSyncMode('merge')}
                        className="text-cyan-600 focus:ring-cyan-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Gabung &amp; Kemas Kini (Disyorkan)
                        </span>
                        <span className="text-[10px] text-cyan-700 font-bold uppercase tracking-wide">
                          Kemas Kini Ruang Padanan
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 shrink-0">
                      Lalai (Default)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Hanya mengemas kini aras atau perincian bilik yang dinyatakan dalam fail CSV. Ruang lain yang sedia ada akan kekal tidak terjejas.
                  </p>
                </div>

                {/* Option 2: Ganti Semua */}
                <div
                  onClick={() => setRoomSyncMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-2.5 ${
                    roomSyncMode === 'replace'
                      ? 'bg-rose-50/80 border-rose-500 shadow-sm ring-2 ring-rose-400/20'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="roomSyncMode"
                        value="replace"
                        checked={roomSyncMode === 'replace'}
                        onChange={() => setRoomSyncMode('replace')}
                        className="text-rose-600 focus:ring-rose-500 mt-0.5"
                      />
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block leading-tight">
                          Ganti Semua (Total Replace)
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">
                          Format Semula Direktori
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                    Menggantikan keseluruhan senarai direktori ruang dengan data daripada fail CSV yang dimuat naik.
                  </p>
                </div>
              </div>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-2xl p-5 text-center transition bg-slate-50/50 hover:bg-cyan-50/20 group">
              <input
                id="rooms-csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleRoomFileChange}
                className="hidden"
              />
              <label htmlFor="rooms-csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    {roomCsvFile ? roomCsvFile.name : 'Pilih atau Seret Fail CSV Maklumat Ruang'}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Format: <code>.csv</code> (UTF-8) mengandungi maklumat ID/Kod, Nama, Aras (Level), Blok &amp; Kapasiti
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-lg mt-1 group-hover:bg-cyan-600 group-hover:text-white transition">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {roomCsvFile ? 'Tukar Fail CSV' : 'Semak & Muat Naik Fail CSV'}
                </span>
              </label>
            </div>

            {/* Success Notification */}
            {roomSyncSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{roomSyncSuccessMsg}</span>
              </div>
            )}

            {/* Parse Errors */}
            {roomParseErrors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Ralat memproses fail CSV:</span>
                </div>
                <ul className="list-disc list-inside text-rose-700 pl-2 space-y-0.5">
                  {roomParseErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Parsed Preview Table & Confirmation */}
            {parsedRoomsList.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-600" />
                      Pratonton Perubahan ({parsedRoomsList.length} ruang dijumpai):
                    </h5>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                      <span className="bg-cyan-100 text-cyan-900 font-bold px-2 py-0.5 rounded">
                        {roomParseSummary?.updated || 0} dikemaskini
                      </span>
                      <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                        {roomParseSummary?.added || 0} bilik baharu
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRoomCsvFile(null);
                        setParsedRoomsList([]);
                        setRoomParseSummary(null);
                        setRoomParseErrors([]);
                      }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingRooms}
                      onClick={handleSyncRoomsToSystem}
                      className="px-4 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSyncingRooms ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan ke Cloud...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Sahkan &amp; Sinkronkan ({parsedRoomsList.length} Ruang)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                  <table className="w-full text-left divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-700 sticky top-0 text-[11px]">
                      <tr>
                        <th className="p-2">Kod Ruang</th>
                        <th className="p-2">Nama Ruang</th>
                        <th className="p-2">Aras / Tingkat (Level)</th>
                        <th className="p-2">Blok / Bangunan</th>
                        <th className="p-2">Kapasiti</th>
                        <th className="p-2">Kategori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {parsedRoomsList.slice(0, 15).map((rm, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{rm.code}</td>
                          <td className="p-2 text-slate-700">{rm.name}</td>
                          <td className="p-2">
                            <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 font-bold px-2 py-0.5 rounded text-[10.5px]">
                              {formatLevel(rm.level)}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600">{rm.block}</td>
                          <td className="p-2 text-slate-700 font-mono">{rm.capacity} pax</td>
                          <td className="p-2 text-slate-500">{rm.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRoomsList.length > 15 && (
                    <div className="p-2 text-center text-slate-400 text-[11px] bg-slate-50 border-t border-slate-200">
                      ... dan {parsedRoomsList.length - 15} ruang lagi
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Searchable Room Directory Inspection Table */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <Building className="w-4 h-4 text-cyan-600" />
                Senarai Direktori {rooms.length} Ruang Semasa dalam Sistem:
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Semak aras, blok, dan kapasiti semasa bagi setiap bilik di sini.
              </p>
            </div>
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari cth: Gamma, Alfa, Sigma, BK01..."
                value={roomSearchTerm}
                onChange={(e) => setRoomSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="p-2.5">Kod Ruang</th>
                  <th className="p-2.5">Nama Ruang</th>
                  <th className="p-2.5">Aras / Tingkat</th>
                  <th className="p-2.5">Blok / Bangunan</th>
                  <th className="p-2.5">Kategori</th>
                  <th className="p-2.5 text-center">Kapasiti</th>
                  <th className="p-2.5 text-center">Aircond</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {rooms
                  .filter(r => {
                    if (!roomSearchTerm.trim()) return true;
                    const q = roomSearchTerm.toLowerCase();
                    return (
                      r.code.toLowerCase().includes(q) ||
                      r.name.toLowerCase().includes(q) ||
                      r.block.toLowerCase().includes(q) ||
                      formatLevel(r.level).toLowerCase().includes(q) ||
                      r.category.toLowerCase().includes(q)
                    );
                  })
                  .map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-bold text-slate-900">{r.code}</td>
                      <td className="p-2.5 text-slate-700">{r.name}</td>
                      <td className="p-2.5">
                        <span className="bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold px-2 py-0.5 rounded text-[10.5px]">
                          {formatLevel(r.level)}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600">{r.block}</td>
                      <td className="p-2.5 text-slate-500">{r.category}</td>
                      <td className="p-2.5 text-center font-mono text-slate-700">{r.capacity} pax</td>
                      <td className="p-2.5 text-center">
                        {r.hasAircond ? (
                          <span className="text-cyan-700 font-bold text-[10.5px]">Ya 💠</span>
                        ) : (
                          <span className="text-slate-400 text-[10.5px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: SEED RUANG KE CLOUD FIRESTORE */}
      {showSeedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Seed Direktori Ruang ke Cloud Firestore
                  </h4>
                  <p className="text-xs text-slate-500">
                    Muat naik {seedRoomsList.length} ruang dari pelayar ini terus ke Cloud koleksi <code className="text-emerald-700 font-bold">rooms</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSeedModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pengesahan Senarai Ruang Pelayar Ini ({seedRoomsList.length} Ruang Dikesan)</span>
              </p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Tindakan ini dijalankan sekali sahaja oleh Pentadbir Kolej untuk membina asas koleksi rasmi di Firestore. Selepas penulisan berjaya, sistem akan terus menyemak bilangan dokumen dari Cloud (<code className="font-mono">getDocs</code>) sebelum mengesahkan kejayaan.
              </p>
            </div>

            {seedErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{seedErrorMsg}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl max-h-64">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 sticky top-0 text-[11px]">
                  <tr>
                    <th className="p-2 text-center w-10">No</th>
                    <th className="p-2">Kod Ruang</th>
                    <th className="p-2">Nama Ruang</th>
                    <th className="p-2">Kategori</th>
                    <th className="p-2">Aras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {seedRoomsList.map((rm, idx) => (
                    <tr key={rm.id || idx} className="hover:bg-slate-50/80">
                      <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-bold text-cyan-950">{rm.code}</td>
                      <td className="p-2 text-slate-800 font-sans">{rm.name}</td>
                      <td className="p-2 text-slate-600 font-sans">{rm.category}</td>
                      <td className="p-2 text-slate-500 font-sans">{formatLevel(rm.level)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSeedModal(false)}
                disabled={isSeedingRooms}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSeedingRooms}
                onClick={handleConfirmSeedRooms}
                className="px-5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                {isSeedingRooms ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menulis &amp; Mengesahkan Dokumen...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Sahkan &amp; Seed {seedRoomsList.length} Ruang ke Cloud</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIAGNOSTIK RUANG */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Diagnostik Integriti Data Ruang
                  </h4>
                  <p className="text-xs text-slate-500">
                    Perbandingan langsung antara LocalStorage, Cloud Firestore, dan Initial Data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {isDiagLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <span>Membuat semakan query langsung ke Firestore Cloud...</span>
              </div>
            ) : diagInfo ? (
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* 4 Status Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">(a) LocalStorage</span>
                    <strong className="text-xl font-extrabold text-slate-900">{diagInfo.localCount}</strong>
                    <span className="text-[10px] text-slate-500 block">kpmbp_rooms_v4</span>
                  </div>

                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase block">(b) Cloud Firestore</span>
                    <strong className="text-xl font-extrabold text-cyan-950">
                      {diagInfo.cloudCount === -1 ? 'Ralat' : diagInfo.cloudCount}
                    </strong>
                    <span className="text-[10px] text-cyan-700 block">koleksi 'rooms'</span>
                  </div>

                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase block">(c) INITIAL_ROOMS</span>
                    <strong className="text-xl font-extrabold text-indigo-950">{diagInfo.initialCount}</strong>
                    <span className="text-[10px] text-indigo-700 block">kod rasmi</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">(e) Cache TS</span>
                    <span className="text-[11px] font-bold text-amber-950 block truncate" title={diagInfo.cacheTs || 'Tiada'}>
                      {diagInfo.cacheTs ? 'Aktif' : 'Tiada'}
                    </span>
                    <span className="text-[9.5px] text-amber-700 block truncate">{diagInfo.cacheTs || 'Luput'}</span>
                  </div>
                </div>

                {diagInfo.error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
                    <strong>Ralat Firestore:</strong> {diagInfo.error}
                  </div>
                )}

                {/* Differences Table (d) */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <h5 className="font-extrabold text-xs text-slate-900 flex items-center justify-between">
                    <span>(d) Senarai Perbezaan ID Antara Ketiga-Tiga Sumber:</span>
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-200 text-slate-800">
                      {diagInfo.diffs.length} perbezaan dikesan
                    </span>
                  </h5>

                  {diagInfo.diffs.length === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Semua sumber data selaras sepenuhnya! Tiada perbezaan ID dikesan.</span>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead className="bg-slate-100 text-slate-700 text-[10.5px] sticky top-0">
                          <tr>
                            <th className="p-2">ID Ruang</th>
                            <th className="p-2">Nama</th>
                            <th className="p-2 text-center">LocalStorage</th>
                            <th className="p-2 text-center">Firestore Cloud</th>
                            <th className="p-2 text-center">INITIAL_ROOMS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {diagInfo.diffs.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-900">{d.id}</td>
                              <td className="p-2 text-slate-700">{d.name}</td>
                              <td className="p-2 text-center font-bold">
                                {d.inLocal ? <span className="text-emerald-600">YA</span> : <span className="text-slate-400">TIDAK</span>}
                              </td>
                              <td className="p-2 text-center font-bold">
                                {d.inCloud ? <span className="text-emerald-600">YA</span> : <span className="text-rose-600">TIDAK</span>}
                              </td>
                              <td className="p-2 text-center font-bold">
                                {d.inInitial ? <span className="text-emerald-600">YA</span> : <span className="text-slate-400">TIDAK</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleRunDiagnosis}
                disabled={isDiagLoading}
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDiagLoading ? 'animate-spin' : ''}`} />
                <span>Muat Semula Semakan</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDiagModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: PENGURUSAN SEKATAN INSTITUSI & PEPERIKSAAN AKHIR (CADANGAN 1) */}
      <div id="section-admin-blocks" className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-rose-600" />
              Sekatan Rasmi Kolej &amp; Peperiksaan
            </div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xl">
              <Lock className="w-5 h-5 text-rose-600" />
              <h3>Pengurusan Sekatan Institusi &amp; Peperiksaan Akhir</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
          </div>
        </div>

        {/* FEEDBACK SUCCESS MESSAGE */}
        {blockSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold text-emerald-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{blockSuccessMsg}</span>
            </div>
            <button
              onClick={() => setBlockSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold p-1"
            >
              ✕
            </button>
          </div>
        )}



        {/* CUSTOM MULTI-DAY / MULTI-ROOM BLOCK FORM */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">Borang Tersuai: Sekatan Multi-Tarikh &amp; Berbilang Ruang</h4>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Sesuai untuk sebarang tarikh atau bilik tambahan
            </span>
          </div>

          <form onSubmit={handleCustomCreateBlocks} className="space-y-4">
            {/* 1. Room Multi-Selection */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-600" />
                  <span>Pilih Ruang / Dewan ({selectedBlockRooms.length} dipilih):</span>
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedBlockRooms(rooms.filter(r => r.category === 'Dewan Kuliah' || r.category === 'Ruang Khas').map(r => r.id))}
                    className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-medium transition cursor-pointer"
                  >
                    Semua Dewan
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBlockRooms([])}
                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>

              {/* Scrollable Room Checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200 text-xs">
                {rooms.map(room => {
                  const isChecked = selectedBlockRooms.includes(room.id);
                  return (
                    <label
                      key={room.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition cursor-pointer ${
                        isChecked
                          ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
                          : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBlockRooms(prev => [...prev, room.id]);
                          } else {
                            setSelectedBlockRooms(prev => prev.filter(id => id !== room.id));
                          }
                        }}
                        className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                      />
                      <span className="truncate" title={`${room.code} - ${room.name}`}>
                        {room.code}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. Date Range & Time Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tarikh Mula:</label>
                <input
                  type="date"
                  value={blockStartDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBlockStartDate(val);
                    if (val && blockEndDate && blockEndDate < val) {
                      setBlockEndDate(val);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 transition shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tarikh Tamat:</label>
                <input
                  type="date"
                  value={blockEndDate}
                  min={blockStartDate || undefined}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 transition shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori Sekatan:</label>
                <select
                  value={blockCategory}
                  onChange={(e) => setBlockCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="EXAM">🔒 Peperiksaan Akhir (EXAM)</option>
                  <option value="INSTITUTIONAL">⚫ Program Institusi / MMS / Kolej</option>
                  <option value="MAINTENANCE">🔧 Penyenggaraan / Penambahbaikan</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mod Waktu Kunci:</label>
                <div className="flex items-center h-[34px]">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-900">
                    <input
                      type="checkbox"
                      checked={isAllDayBlock}
                      onChange={(e) => setIsAllDayBlock(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span>Sepanjang Hari (08:00 – 24:00)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Custom Hours when isAllDayBlock is false */}
            {!isAllDayBlock && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3 bg-white rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Waktu Mula:</label>
                  <select
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="08:00">08:00 AM (Awal Pagi)</option>
                    <option value="08:30">08:30 AM</option>
                    <option value="09:00">09:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="20:00">08:00 PM (Malam)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Waktu Tamat:</label>
                  <select
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="12:00">12:00 PM</option>
                    <option value="17:00">05:00 PM</option>
                    <option value="18:00">06:00 PM</option>
                    <option value="22:00">10:00 PM</option>
                    <option value="23:00">11:00 PM</option>
                    <option value="24:00">12:00 AM (Tengah Malam)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 3. Event Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tajuk Sekatan / Acara:</label>
                <input
                  type="text"
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Cth: Peperiksaan Akhir Semester Nov 2026"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Unit / Disediakan Oleh:</label>
                <input
                  type="text"
                  value={blockCreatedBy}
                  onChange={(e) => setBlockCreatedBy(e.target.value)}
                  placeholder="Cth: UPPK"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                Sebab / Catatan Tambahan <span className="text-slate-400 font-normal">(Pilihan / Tidak wajib)</span>:
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Cth: Dewan ditutup bagi persediaan dan pelaksanaan peperiksaan akhir (pilihan)."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmittingBlock || selectedBlockRooms.length === 0}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>Kunci Ruang Terpilih Sekarang ({selectedBlockRooms.length} Ruang)</span>
              </button>
            </div>
          </form>
        </div>

        {/* ACTIVE INSTITUTIONAL BLOCKS TABLE */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Senarai Sekatan Institusi &amp; Peperiksaan Aktif ({filteredBlocks.length} Rekod)
              </h4>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setBlockFilterCategory('ALL')}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    blockFilterCategory === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({institutionalBlocks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBlockFilterCategory('EXAM')}
                  className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                    blockFilterCategory === 'EXAM' ? 'bg-rose-100 text-rose-900 shadow-2xs border border-rose-300' : 'text-slate-600 hover:text-rose-900'
                  }`}
                >
                  <Lock className="w-3 h-3 text-rose-600" />
                  Peperiksaan ({institutionalBlocks.filter(b => b.category === 'EXAM' || b.title.toLowerCase().includes('peperiksaan')).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBlockFilterCategory('INSTITUTIONAL')}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    blockFilterCategory === 'INSTITUTIONAL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Institusi
                </button>
              </div>

              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari sekatan..."
                  value={blockSearchTerm}
                  onChange={(e) => setBlockSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>

          {filteredBlocks.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
              <Lock className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
              <div className="font-semibold text-slate-700">Tiada sekatan institusi atau peperiksaan yang sepadan.</div>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Gunakan butang 1-Klik di atas untuk mengunci dewan bagi Peperiksaan Akhir (2 Nov – 16 Nov 2026) atau cipta sekatan baharu melalui borang tersuai.
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="p-2.5">Ruang / Dewan</th>
                    <th className="p-2.5">Tajuk Sekatan</th>
                    <th className="p-2.5">Kategori</th>
                    <th className="p-2.5">Tarikh</th>
                    <th className="p-2.5">Waktu</th>
                    <th className="p-2.5">Disediakan Oleh</th>
                    <th className="p-2.5 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {filteredBlocks.map(b => {
                    const roomObj = rooms.find(r => r.id === b.roomId || r.code === b.roomId);
                    const roomLabel = roomObj ? `${roomObj.code} (${roomObj.name})` : b.roomId;
                    const isExam = b.category === 'EXAM' || b.title.toLowerCase().includes('peperiksaan');

                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{roomLabel}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-slate-800 font-medium">
                          {b.title}
                          {b.reason && (
                            <div className="text-[10px] text-slate-400 font-normal">{b.reason}</div>
                          )}
                        </td>
                        <td className="p-2.5">
                          {isExam ? (
                            <span className="bg-rose-100 border border-rose-300 text-rose-900 font-extrabold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5 text-rose-700" />
                              PEPERIKSAAN
                            </span>
                          ) : (
                            <span className="bg-slate-100 border border-slate-300 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px]">
                              {b.category || 'INSTITUSI'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-700">
                          {b.endDate && b.endDate !== b.date ? (
                            <span className="font-semibold text-slate-900">
                              {b.date} &rarr; {b.endDate}
                            </span>
                          ) : (
                            <span>{b.date}</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {b.startTime === '08:00' && (b.endTime === '24:00' || b.endTime === '23:59') ? (
                            <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              Sepanjang Hari (24 Jam)
                            </span>
                          ) : (
                            <span>{b.startTime} – {b.endTime}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-500">{b.createdBy}</td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleBlock(b.id, b.title, roomLabel)}
                            className="bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 font-bold py-1 px-2 rounded-lg text-[10.5px] transition inline-flex items-center gap-1 cursor-pointer"
                            title="Padam / Nyahkunci sekatan ini"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Nyahkunci</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: ACADEMIC EXEMPTIONS (STUDY WEEK) */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <span className="text-xl">📚</span>
              <h3>Pengecualian Jadual Hakiki (Study Week)</h3>
              {exemptionList.filter(e => e.active).length > 0 && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {exemptionList.filter(e => e.active).length} Aktif
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tetapkan tempoh di mana jadual waktu akademik tidak menghalang tempahan. Tempahan adhoc pensyarah dibenarkan seperti biasa.
            </p>
          </div>
          {exemptionIdToEdit && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-amber-900">Sedang Mengedit:</span>
              <button
                type="button"
                onClick={resetExemptionForm}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Batal Edit
              </button>
            </div>
          )}
        </div>

        {exemptionMsg && (
          <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            exemptionMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {exemptionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{exemptionMsg.text}</span>
          </div>
        )}

        {/* Form Tambah / Edit Pengecualian */}
        <form onSubmit={handleInitiateSaveExemption} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-amber-600" />
              <span>{exemptionIdToEdit ? 'Kemaskini Tempoh Pengecualian' : 'Tetapkan Tempoh Pengecualian Baharu'}</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">Data disimpan ke Cloud Firestore</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tajuk Pengecualian */}
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Tajuk Pengecualian</span>
                  <span className="text-rose-500">*</span>
                </label>
                {!isUserEditedTitle && (
                  <span className="text-[10px] text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded font-semibold">
                    Tajuk dijana secara automatik
                  </span>
                )}
              </div>
              <input
                type="text"
                value={exemptionTitle}
                onChange={e => {
                  setExemptionTitle(e.target.value);
                  setIsUserEditedTitle(true);
                }}
                placeholder="Contoh: Study Week Semester Nov 2026"
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                required
              />
            </div>

            {/* BAHAGIAN 1: Kumpulan Butang Pintas Tempoh */}
            <div className="md:col-span-2 space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pilihan Pantas Tempoh:</span>
                </span>
                {exemptionStartDate && exemptionEndDate && (
                  <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
                    {formatRangeMalay(exemptionStartDate, exemptionEndDate)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Minggu Ini */}
                {(() => {
                  const thisW = getThisWeekRange(todayMalaysia);
                  const isActive = exemptionStartDate === thisW.start && exemptionEndDate === thisW.end;
                  return (
                    <button
                      type="button"
                      onClick={() => applyQuickRange(thisW.start, thisW.end)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      Minggu Ini
                    </button>
                  );
                })()}

                {/* 2. Minggu Depan */}
                {(() => {
                  const nextW = getNextWeekRange(todayMalaysia);
                  const isActive = exemptionStartDate === nextW.start && exemptionEndDate === nextW.end;
                  return (
                    <button
                      type="button"
                      onClick={() => applyQuickRange(nextW.start, nextW.end)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      Minggu Depan
                    </button>
                  );
                })()}

                {/* 3. 2 Minggu Bermula Minggu Depan (Diserlahkan / Pilihan Utama) */}
                {(() => {
                  const twoW = getTwoWeeksFromNextWeekRange(todayMalaysia);
                  const isActive = exemptionStartDate === twoW.start && exemptionEndDate === twoW.end;
                  return (
                    <button
                      type="button"
                      onClick={() => applyQuickRange(twoW.start, twoW.end)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300'
                          : 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                      }`}
                    >
                      <span>⭐ 2 Minggu Bermula Minggu Depan</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-amber-200/80 text-amber-900 font-extrabold uppercase">
                        Disyorkan
                      </span>
                    </button>
                  );
                })()}

                {/* 4. + 1 Minggu */}
                <button
                  type="button"
                  onClick={() => handleQuickDuration(6)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                >
                  + 1 Minggu
                </button>

                {/* 5. + 2 Minggu */}
                <button
                  type="button"
                  onClick={() => handleQuickDuration(13)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
                >
                  + 2 Minggu
                </button>
              </div>
            </div>

            {/* Tarikh Mula */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Tarikh Mula (Inklusif)</span>
                  <span className="text-rose-500">*</span>
                </label>
                {exemptionStartDate && (
                  <span className="text-[11px] font-semibold text-amber-800">
                    {getMalayDayName(exemptionStartDate)}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  ref={startDateInputRef}
                  type="date"
                  min={!exemptionIdToEdit ? todayMalaysia : undefined}
                  value={exemptionStartDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 pr-9 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => triggerDatePicker(startDateInputRef)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                  title="Buka pemilih tarikh"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>

              {/* Amaran Bukan Isnin */}
              {exemptionStartDate && getIsoDayOfWeek(exemptionStartDate) !== 1 && (
                <div className="flex items-center justify-between gap-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 animate-in fade-in">
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">
                      Tarikh mula ialah hari {getMalayDayName(exemptionStartDate)}. Laraskan ke Isnin {formatDateMalayShort(snapToMonday(exemptionStartDate))}?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdjustToMonday}
                    className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] shrink-0 transition cursor-pointer"
                  >
                    Ya, laraskan
                  </button>
                </div>
              )}
            </div>

            {/* Tarikh Tamat */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Tarikh Tamat (Inklusif)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCalcEndDate}
                    onChange={e => setAutoCalcEndDate(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Kira tarikh tamat automatik</span>
                </label>
              </div>
              <div className="relative">
                <input
                  ref={endDateInputRef}
                  type="date"
                  min={exemptionStartDate || (!exemptionIdToEdit ? todayMalaysia : undefined)}
                  value={exemptionEndDate}
                  onChange={e => handleEndDateChange(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 pr-9 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => triggerDatePicker(endDateInputRef)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                  title="Buka pemilih tarikh"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>

              {exemptionStartDate && exemptionEndDate && exemptionEndDate < exemptionStartDate && (
                <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Tarikh tamat tidak boleh lebih awal daripada tarikh mula.</span>
                </p>
              )}
            </div>

            {/* BAHAGIAN 3: Komponen Kalendar Julat Tersuai */}
            <div className="md:col-span-2 space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCalendarPicker(prev => !prev)}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                >
                  <CalendarRange className="w-4 h-4 text-amber-600" />
                  <span>{showCalendarPicker ? '📅 Sembunyikan kalendar' : '📅 Pilih daripada kalendar'}</span>
                </button>
                <span className="text-[11px] text-slate-400">
                  Ketuk tarikh mula kemudian tarikh tamat
                </span>
              </div>

              {showCalendarPicker && (
                <div className="pt-1 animate-in fade-in duration-200">
                  <DateRangeCalendar
                    startDate={exemptionStartDate}
                    endDate={exemptionEndDate}
                    onChange={handleCalendarRangeChange}
                    existingExemptions={exemptionList}
                    blocks={institutionalBlocks}
                    minDate={!exemptionIdToEdit ? todayMalaysia : undefined}
                  />
                </div>
              )}

              {/* BAHAGIAN 4: Ringkasan Julat Tarikh */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 text-xs text-amber-950 flex items-center justify-between gap-2 shadow-2xs">
                {exemptionStartDate && exemptionEndDate && exemptionEndDate >= exemptionStartDate ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold text-slate-800">
                      📅 {formatRangeMalay(exemptionStartDate, exemptionEndDate)} —{' '}
                      <strong className="text-amber-900 font-extrabold">{rangeSummary.totalDays} hari</strong>{' '}
                      <span className="text-amber-800">({rangeSummary.weekdays} hari bekerja, {rangeSummary.weekendDays} hari hujung minggu)</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Pilih tarikh mula dan tamat</span>
                  </span>
                )}
              </div>
            </div>

            {/* BAHAGIAN 5: Skop Bilik (Dinamik mengikut data bilik sebenar) */}
            <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 block">
                Skop Pengecualian Bilik
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                  exemptionScope === 'BILIK_KULIAH' 
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300' 
                    : 'bg-white border-slate-200 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="exemptionScope"
                    value="BILIK_KULIAH"
                    checked={exemptionScope === 'BILIK_KULIAH'}
                    onChange={() => setExemptionScope('BILIK_KULIAH')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Bilik Kuliah Sahaja</span>
                    <span className="text-[10.5px] text-slate-500">
                      {lectureRoomScopeText}
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                  exemptionScope === 'ALL_ROOMS' 
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300' 
                    : 'bg-white border-slate-200 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="exemptionScope"
                    value="ALL_ROOMS"
                    checked={exemptionScope === 'ALL_ROOMS'}
                    onChange={() => setExemptionScope('ALL_ROOMS')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Semua Bilik</span>
                    <span className="text-[10.5px] text-slate-500">
                      Termasuk makmal &amp; dewan ({rooms.length} bilik)
                    </span>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                  exemptionScope === 'SELECTED' 
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300' 
                    : 'bg-white border-slate-200 hover:bg-slate-100'
                }`}>
                  <input
                    type="radio"
                    name="exemptionScope"
                    value="SELECTED"
                    checked={exemptionScope === 'SELECTED'}
                    onChange={() => setExemptionScope('SELECTED')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Bilik Tertentu</span>
                    <span className="text-[10.5px] text-slate-500">
                      Pilih dari senarai bilik ({selectedExemptionRooms.length} dipilih)
                    </span>
                  </div>
                </label>
              </div>

              {/* Checklist jika Skop = SELECTED */}
              {exemptionScope === 'SELECTED' && (
                <div className="bg-white border border-slate-300 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-700">Pilih Bilik Terlibat:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedExemptionRooms(rooms.map(r => r.id))}
                        className="text-[11px] text-amber-700 hover:underline font-semibold cursor-pointer"
                      >
                        Pilih Semua ({rooms.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedExemptionRooms([])}
                        className="text-[11px] text-slate-500 hover:underline font-semibold cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    {rooms.map(room => {
                      const isChecked = selectedExemptionRooms.includes(room.id);
                      return (
                        <label
                          key={room.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked ? 'bg-amber-50 border-amber-300 font-bold text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedExemptionRooms(prev => [...prev, room.id]);
                              } else {
                                setSelectedExemptionRooms(prev => prev.filter(id => id !== room.id));
                              }
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="truncate" title={room.name}>{room.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Catatan / Sebab */}
            <div className="md:col-span-2 space-y-1.5 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Catatan / Sebab (Pilihan)</span>
                <span className="text-[10px] text-slate-400">Dipaparkan kepada pentadbir</span>
              </label>
              <textarea
                value={exemptionReason}
                onChange={e => setExemptionReason(e.target.value)}
                placeholder="Contoh: Minggu ulangkaji akhir semester, tiada kelas berjadual hakiki. Tempahan adhoc dibuka."
                rows={2}
                className="w-full text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          </div>

          {/* Pratonton Impak (Impact Preview) */}
          {(() => {
            const draft: Partial<AcademicExemption> = {
              id: exemptionIdToEdit || 'draft',
              title: exemptionTitle,
              startDate: exemptionStartDate,
              endDate: exemptionEndDate,
              scope: exemptionScope,
              roomIds: selectedExemptionRooms,
              active: true
            };
            const val = validateExemptionInput(draft, exemptionList);

            let durationDays = 0;
            if (exemptionStartDate && exemptionEndDate && exemptionEndDate >= exemptionStartDate) {
              const [sy, sm, sd] = exemptionStartDate.split('-').map(Number);
              const [ey, em, ed] = exemptionEndDate.split('-').map(Number);
              durationDays = Math.round((new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }

            const affectedRooms = rooms.filter(r => {
              if (exemptionScope === 'ALL_ROOMS') return true;
              if (exemptionScope === 'BILIK_KULIAH') return r.category === 'Bilik Kuliah';
              if (exemptionScope === 'SELECTED') return selectedExemptionRooms.includes(r.id);
              return false;
            });

            const affectedSlots = (exemptionStartDate && exemptionEndDate && exemptionEndDate >= exemptionStartDate)
              ? countAffectedAcademicSlots(
                  {
                    id: 'preview',
                    title: exemptionTitle,
                    startDate: exemptionStartDate,
                    endDate: exemptionEndDate,
                    scope: exemptionScope,
                    roomIds: selectedExemptionRooms,
                    active: true,
                    createdBy: 'admin',
                    createdAt: ''
                  },
                  rooms,
                  academicSchedule
                )
              : 0;

            const overlappingExamBlocks = institutionalBlocks.filter(b => {
              if (!exemptionStartDate || !exemptionEndDate) return false;
              if (b.date < exemptionStartDate || b.date > exemptionEndDate) return false;
              const r = rooms.find(room => room.id === b.roomId);
              if (exemptionScope === 'ALL_ROOMS') return true;
              if (exemptionScope === 'BILIK_KULIAH') return r?.category === 'Bilik Kuliah';
              if (exemptionScope === 'SELECTED') return selectedExemptionRooms.includes(b.roomId);
              return false;
            });
            const overlappingRoomIds = Array.from(new Set(overlappingExamBlocks.map(b => b.roomId)));

            return (
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pratonton Impak Pengecualian</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Pengiraan langsung</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Tempoh</span>
                    <strong className="text-base font-extrabold text-amber-900">
                      {durationDays > 0 ? `${durationDays} Hari` : '–'}
                    </strong>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Bilik Terlibat</span>
                    <strong className="text-base font-extrabold text-amber-900">
                      {affectedRooms.length} Bilik
                    </strong>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5">
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Slot Hakiki Dilangkau</span>
                    <strong className="text-base font-extrabold text-amber-900">
                      {affectedSlots} Slot
                    </strong>
                  </div>
                </div>

                {overlappingExamBlocks.length > 0 && (
                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-800">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Pertindihan Sekatan Peperiksaan (Layer 3)</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed">
                      ⚠️ Terdapat {overlappingRoomIds.length} bilik ({overlappingExamBlocks.length} sekatan) yang mempunyai sekatan peperiksaan/institusi pada tarikh ini. <strong>Peperiksaan TETAP BERKUATKUASA</strong> dan bilik ini tidak boleh ditempah adhoc pada waktu peperiksaan.
                    </p>
                  </div>
                )}

                {val.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Peringatan Tarikh</span>
                    </div>
                    {val.warnings.map((w, idx) => (
                      <p key={idx} className="text-[11.5px]">{w}</p>
                    ))}
                  </div>
                )}

                {!val.isValid && val.errors.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Ralat Pengesahan</span>
                    </div>
                    {val.errors.map((err, idx) => (
                      <p key={idx} className="text-[11.5px]">• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Form Submit & Cancel Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {exemptionIdToEdit && (
              <button
                type="button"
                onClick={resetExemptionForm}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
            )}

            <button
              type="submit"
              disabled={isSavingExemption || Boolean(exemptionStartDate && exemptionEndDate && exemptionEndDate < exemptionStartDate)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-amber-600/20 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>{exemptionIdToEdit ? 'Kemaskini Pengecualian' : 'Simpan Pengecualian'}</span>
            </button>
          </div>
        </form>

        {/* Senarai Pengecualian Sedia Ada */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Rekod Pengecualian Sedia Ada ({exemptionList.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              {exemptionList.filter(e => e.active).length} Aktif / {exemptionList.filter(e => !e.active).length} Dinyahaktifkan
            </span>
          </div>

          {exemptionList.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">Tiada Pengecualian Jadual Hakiki Ditetapkan</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Borang di atas boleh digunakan untuk menetapkan tempoh Study Week supaya pensyarah boleh menempah bilik kuliah.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {exemptionList.map(ex => {
                const today = new Date().toISOString().slice(0, 10);
                const isCurrentlyActive = ex.active && today >= ex.startDate && today <= ex.endDate;
                const isUpcoming = ex.active && today < ex.startDate;
                const isExpired = ex.active && today > ex.endDate;
                const slotsCount = countAffectedAcademicSlots(ex, rooms, academicSchedule);

                let scopeLabel = 'Semua Bilik';
                if (ex.scope === 'BILIK_KULIAH') {
                  scopeLabel = `Bilik Kuliah (${rooms.filter(r => r.category === 'Bilik Kuliah').length} Bilik)`;
                } else if (ex.scope === 'SELECTED') {
                  scopeLabel = `${ex.roomIds?.length || 0} Bilik Tertentu`;
                }

                return (
                  <div
                    key={ex.id}
                    className={`rounded-2xl p-4 border transition-all space-y-3 relative ${
                      !ex.active
                        ? 'bg-slate-50 border-slate-200 opacity-75'
                        : isCurrentlyActive
                        ? 'bg-amber-50/40 border-amber-300 shadow-sm ring-1 ring-amber-300'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Header: Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="font-extrabold text-sm text-slate-900 leading-snug">
                          {ex.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {ex.startDate} hingga {ex.endDate}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {!ex.active ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Dinyahaktifkan
                          </span>
                        ) : isCurrentlyActive ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Aktif
                          </span>
                        ) : isUpcoming ? (
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Akan Datang
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            Tamat
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Skop Bilik</span>
                        <span className="font-semibold text-slate-800 text-[11px]">{scopeLabel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Slot Hakiki Dilangkau</span>
                        <span className="font-bold text-amber-700 text-[11px]">{slotsCount} Slot</span>
                      </div>
                    </div>

                    {ex.reason && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                        "{ex.reason}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10.5px] text-slate-400 border-t border-slate-100 pt-2">
                      <span>Dicipta oleh {ex.createdBy}</span>
                      <span>{ex.createdAt ? ex.createdAt.slice(0, 10) : '–'}</span>
                    </div>

                    {/* Actions bar */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleExemptionActive(ex.id)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                          ex.active
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                        title={ex.active ? 'Nyahaktifkan sementara' : 'Aktifkan semula'}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{ex.active ? 'Nyahaktif' : 'Aktifkan'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditExemption(ex)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Edit tetapan pengecualian ini"
                      >
                        <Edit2 className="w-3 h-3 text-slate-600" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateExemption(ex)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Salin tetapan untuk semester seterusnya"
                      >
                        <Copy className="w-3 h-3 text-amber-600" />
                        <span>Gandakan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmExemptionId(ex.id)}
                        className="bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Padam rekod pengecualian ini"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Padam</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Pengesahan Simpan Pengecualian */}
        {showConfirmModal && pendingExemptionToSave && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <CalendarRange className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pengesahan Pengecualian Jadual</h3>
                  <span className="text-xs text-amber-700 font-semibold">{pendingExemptionToSave.title}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
                <p className="font-semibold leading-relaxed">
                  Pensyarah akan dapat menempah bilik pada <strong>{pendingExemptionToSave.startDate}</strong> hingga <strong>{pendingExemptionToSave.endDate}</strong> walaupun ada jadual hakiki. Teruskan?
                </p>
                <div className="text-[11px] text-amber-800 space-y-0.5 pt-1 border-t border-amber-200">
                  <p>• Skop: <strong>{pendingExemptionToSave.scope}</strong></p>
                  <p>• Sekatan Peperiksaan (Layer 3) dan tempahan lain kekal dikuatkuasakan.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSavingExemption}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveExemption}
                  disabled={isSavingExemption}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center gap-2 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingExemption ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isSavingExemption ? 'Menyimpan...' : 'Sahkan & Simpan'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Pengesahan Padam Pengecualian */}
        {deleteConfirmExemptionId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Padam Pengecualian?</h3>
                  <span className="text-xs text-rose-600 font-semibold">Tindakan ini tidak boleh diundur</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Adakah anda pasti ingin memadamkan rekod pengecualian ini? Jadual hakiki akan mula berkuatkuasa semula serta-merta pada tarikh tersebut.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmExemptionId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteExemption(deleteConfirmExemptionId)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  Padam Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION: AD-HOC BOOKINGS BACKUP & CSV EXPORT */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 space-y-4">
        {/* Hidden File Input for Bookings CSV Restoration */}
        <input 
          type="file" 
          ref={bookingCsvInputRef} 
          accept=".csv" 
          onChange={handleUploadBookingsCSV} 
          className="hidden" 
        />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3>Tempahan Ad-hoc</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Simpan, muat turun, pulihkan, dan uruskan rekod tempahan ad-hoc yang didaftarkan ke dalam fail spreadsheet CSV bagi tujuan sandaran offline, pelan kontigensi, atau audit institusi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleExportBookingsCSV('ALL')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              title="Muat turun semua rekod tempahan ke fail CSV"
            >
              <Download className="w-4 h-4" />
              <span>Muat Turun Sandaran Semua ({bookings.length} Rekod)</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportBookingsCSV('CONFIRMED')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-300 cursor-pointer"
              title="Eksport rekod tempahan yang disahkan sahaja"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Disahkan ({bookings.filter(b => b.status === 'CONFIRMED').length})</span>
            </button>

            <button
              type="button"
              onClick={() => bookingCsvInputRef.current?.click()}
              disabled={isRestoringBookings}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold py-2.5 px-3.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Muat naik fail sandaran CSV untuk mengembalikan tempahan"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pulihkan Fail CSV</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreSampleBookings}
              disabled={isRestoringBookings}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold py-2.5 px-3.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Muat 6 rekod tempahan contoh kolej untuk demonstrasi & ujian sistem"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Muat 6 Rekod Contoh</span>
            </button>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('matrix')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold py-2.5 px-3.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                title="Buka Matriks Ketersediaan untuk membuat tempahan bilik baharu"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Buka Matriks</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alerts */}
        {bookingRestoreSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bookingRestoreSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setBookingRestoreSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer text-xs"
            >
              Tutup
            </button>
          </div>
        )}

        {bookingRestoreErrorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{bookingRestoreErrorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setBookingRestoreErrorMsg(null)}
              className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer text-xs"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Empty State vs Table Display */}
        {bookings.length === 0 ? (
          <div className="bg-gradient-to-br from-amber-50/70 via-white to-orange-50/60 border border-amber-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 shadow-2xs">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Rekod Tempahan Ad-hoc Semasa: Kosong (0 Rekod)</h4>
                  <p className="text-[11.5px] text-slate-600">
                    Sistem kini berada dalam status bersih (mod Sifar Data Demo aktif). Pangkalan data sedia menerima rekod baharu atau dipulihkan.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                0 Rekod Aktif
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Bagaimana Cara Mengembalikan Semula Rekod Tempahan Ad-hoc?</span>
              </div>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                Anda mempunyai <strong>3 pilihan mudah</strong> mengikut keperluan institusi anda:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {/* Option 1: Restore CSV Backup */}
              <div className="bg-white border border-slate-200 hover:border-emerald-400 rounded-xl p-4 flex flex-col justify-between transition shadow-2xs">
                <div className="space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                    1
                  </div>
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    <span>Pulihkan Sandaran Fail CSV</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Jika anda pernah memuat turun sandaran CSV sebelum ini, klik di sini untuk memuat naik fail tersebut dan mengembalikan rekod secara tepat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => bookingCsvInputRef.current?.click()}
                  disabled={isRestoringBookings}
                  className="mt-3.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isRestoringBookings ? 'Memproses...' : 'Pilih Fail CSV Sandaran'}</span>
                </button>
              </div>

              {/* Option 2: Load College Sample Data */}
              <div className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col justify-between transition shadow-2xs">
                <div className="space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                    2
                  </div>
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Muat 6 Rekod Contoh Kolej</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Muat set data contoh rasmi kolej (Kelas Tambahan, Bengkel Makmal, Mesyuarat Jabatan) untuk semakan matriks, pengesahan, dan ujian sistem serta-merta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreSampleBookings}
                  disabled={isRestoringBookings}
                  className="mt-3.5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRestoringBookings ? 'Menjana...' : 'Muat 6 Rekod Contoh'}</span>
                </button>
              </div>

              {/* Option 3: Book via Matrix */}
              <div className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 flex flex-col justify-between transition shadow-2xs">
                <div className="space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                    3
                  </div>
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Buat Tempahan di Matriks</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Pergi ke paparan Matriks Ketersediaan Ruang Kuliah dan klik mana-mana slot hijau kosong untuk menghantar tempahan ad-hoc baharu mengikut waktu pilihan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('matrix') : null}
                  className="mt-3.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Buka Matriks Ketersediaan</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* When Bookings Exist: Interactive Search, Filter & Management Table */
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setBookingStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    bookingStatusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({bookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBookingStatusFilter('CONFIRMED')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    bookingStatusFilter === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-900 shadow-2xs border border-emerald-300' : 'text-slate-600 hover:text-emerald-900'
                  }`}
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  Disahkan ({bookings.filter(b => b.status === 'CONFIRMED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setBookingStatusFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    bookingStatusFilter === 'PENDING' ? 'bg-amber-100 text-amber-900 shadow-2xs border border-amber-300' : 'text-slate-600 hover:text-amber-900'
                  }`}
                >
                  <Clock className="w-3 h-3 text-amber-600" />
                  Menunggu ({bookings.filter(b => b.status === 'PENDING').length})
                </button>
                <button
                  type="button"
                  onClick={() => setBookingStatusFilter('REJECTED')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    bookingStatusFilter === 'REJECTED' ? 'bg-rose-100 text-rose-900 shadow-2xs border border-rose-300' : 'text-slate-600 hover:text-rose-900'
                  }`}
                >
                  <XCircle className="w-3 h-3 text-rose-600" />
                  Ditolak ({bookings.filter(b => b.status === 'REJECTED').length})
                </button>
              </div>

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari bilik, pemohon, tajuk..."
                  value={bookingSearchTerm}
                  onChange={(e) => setBookingSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Bookings List Table */}
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="p-2.5">ID &amp; Ruang</th>
                    <th className="p-2.5">Tarikh &amp; Masa</th>
                    <th className="p-2.5">Pemohon</th>
                    <th className="p-2.5">Tajuk &amp; Tujuan</th>
                    <th className="p-2.5">Pax</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-center">Tindakan Pentadbir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {bookings
                    .filter(b => {
                      if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
                      if (!bookingSearchTerm.trim()) return true;
                      const term = bookingSearchTerm.toLowerCase();
                      return (
                        b.id.toLowerCase().includes(term) ||
                        b.roomId.toLowerCase().includes(term) ||
                        (b.roomName && b.roomName.toLowerCase().includes(term)) ||
                        b.applicantName.toLowerCase().includes(term) ||
                        b.applicantEmail.toLowerCase().includes(term) ||
                        b.title.toLowerCase().includes(term) ||
                        b.purposeCategory.toLowerCase().includes(term)
                      );
                    })
                    .map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 font-semibold text-slate-900 whitespace-nowrap">
                          <span className="font-mono text-[10px] text-slate-500 block">{b.id}</span>
                          <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10.5px]">
                            {b.roomName || b.roomId}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-slate-700">
                          <div className="font-semibold text-slate-900">{b.date}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{b.startTime} – {b.endTime}</div>
                        </td>
                        <td className="p-2.5 text-slate-800">
                          <div className="font-bold text-slate-900">{b.applicantName}</div>
                          <div className="text-[10px] text-slate-500">{b.applicantEmail}</div>
                          {b.department && <div className="text-[9.5px] text-slate-400">{b.department}</div>}
                        </td>
                        <td className="p-2.5 text-slate-700 max-w-[200px]">
                          <div className="font-medium text-slate-900 truncate" title={b.title}>{b.title}</div>
                          <span className="inline-block text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded font-medium border border-emerald-200">
                            {b.purposeCategory}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700 font-bold whitespace-nowrap">
                          {b.paxCount || '-'}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {b.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Disahkan
                            </span>
                          )}
                          {b.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Menunggu
                            </span>
                          )}
                          {b.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Ditolak
                            </span>
                          )}
                          {b.status === 'CANCELLED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              Dibatalkan
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {b.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onApproveBooking(b.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2 rounded-lg text-[10.5px] transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Sahkan tempahan ini"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Sahkan</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectBooking(b.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-1 px-2 rounded-lg text-[10.5px] transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Tolak tempahan ini"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Tolak</span>
                                </button>
                              </>
                            )}
                            {b.status === 'CONFIRMED' && (
                              <button
                                type="button"
                                onClick={() => onRejectBooking(b.id)}
                                className="bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 font-bold py-1 px-2 rounded-lg text-[10.5px] transition inline-flex items-center gap-1 cursor-pointer"
                                title="Batalkan pengesahan tempahan ini"
                              >
                                <span>Batal</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Informative Security & Contingency Callout */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Fungsi Perlindungan &amp; Kesinambungan Data (Business Continuity):</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Fail sandaran CSV ini merekodkan 17 medan data penting (ID Tempahan, Kod &amp; Nama Bilik Kuliah, Tarikh, Hari, Slot Masa Mula &amp; Tamat, Nama &amp; E-mel Pemohon, No Telefon Rasmi, Jawatan, Jabatan, Kategori Tujuan, Tajuk Aktiviti, Bilangan Hadirin, Status, Tarikh Dicipta, dan Catatan). Format ini mengandungi pengekodan UTF-8 BOM yang serasi dengan <strong>Microsoft Excel</strong> dan <strong>Google Sheets</strong> untuk kegunaan kecemasan sekiranya berlaku masalah talian atau pelayan awan.
          </p>
        </div>
      </div>

      {/* Cloud Sync Status & Multi-Device Details Modal */}
      <CloudSyncModal 
        isOpen={showCloudSyncModal} 
        onClose={() => setShowCloudSyncModal(false)} 
      />

      {/* CONFIRMATION MODAL: CLEAR ALL ACADEMIC SCHEDULE */}
      {showClearScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-1">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">Kosongkan Keseluruhan Jadual Waktu?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tindakan ini akan memadamkan secara kekal kesemua <strong className="text-rose-600 font-bold">{academicSchedule.length} slot</strong> jadual waktu kuliah sedia ada dari sistem dan pangkalan data awan Cloud Firestore.
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
              <span className="font-bold block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Kesan Pembersihan:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800">
                <li>Semua bilik akan dibuka tanpa sebarang slot kuliah terkunci (0 slot).</li>
                <li>Staf boleh menempah bilik secara bebas pada mana-mana slot.</li>
                <li>Anda boleh memuat naik jadual baharu pada bila-bila masa melalui fail CSV.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearScheduleModal(false)}
                disabled={isClearingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteClearSchedule}
                disabled={isClearingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isClearingSchedule ? 'Sedang Memadamkan...' : `Ya, Kosongkan Semua (${academicSchedule.length} Slot)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: TOTAL OVERWRITE (REPLACE MODE) */}
      {showConfirmTotalOverwriteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pengesahan Ganti Sepenuhnya (Total Overwrite)</h3>
                <span className="text-xs text-amber-700 font-medium">Pembersihan Bersih Semula Pangkalan Data Jadual</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda memilih <strong>Mod Ganti Sepenuhnya</strong>. Sistem akan membersihkan kesemua slot terdahulu di Cloud Firestore dan menggantikannya secara total dengan kandungan fail CSV baharu ini.
            </p>

            {/* Comparison Box */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-rose-600 block">Jadual Lama Dipadamkan</span>
                <strong className="text-lg font-extrabold text-rose-900">{academicSchedule.length} Slot</strong>
                <p className="text-[10px] text-rose-700 mt-1">Dibersihkan dari Firestore &amp; memori</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Jadual Baharu Dimasukkan</span>
                <strong className="text-lg font-extrabold text-emerald-900">{parsedScheduleSlots.length} Slot</strong>
                <p className="text-[10px] text-emerald-700 mt-1">{scheduleParseSummary?.roomsAffected.length} ruang bilik terlibat</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">Ruang Terlibat dalam CSV Baharu:</span>
              <p className="font-mono text-slate-700 break-words">
                {scheduleParseSummary?.roomsAffected.join(', ') || 'Tiada'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmTotalOverwriteModal(false)}
                disabled={isSyncingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeActualSync('replace')}
                disabled={isSyncingSchedule}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center gap-2 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingSchedule ? 'animate-spin' : ''}`} />
                <span>{isSyncingSchedule ? 'Sedang Menggantikan...' : `Sahkan & Gantikan (${parsedScheduleSlots.length} Slot)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
