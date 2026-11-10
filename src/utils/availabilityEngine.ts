import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  RoomAvailabilityCheck, 
  DayOfWeek,
  SearchFilterParams,
  AcademicExemption
} from '../types';
import {
  parseTimeMinutes,
  isTimeRangeNight,
  ALL_BOOKING_TIME_SLOTS,
  DAY_TIME_SLOTS,
  NIGHT_TIME_SLOTS,
  TimeSlotPeriod,
  validateBookingTime
} from './timeSlots';
import { ensureBookbkPrefix } from './downloadHelper';

export { parseTimeMinutes };

export const MALAY_DAYS: DayOfWeek[] = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

export function getMalayDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Isnin';
  return MALAY_DAYS[d.getDay()];
}

export function calculateDurationText(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  
  const startMin = parseTimeMinutes(startTime);
  const endMin = parseTimeMinutes(endTime);

  if (endMin <= startMin) {
    return '0 jam';
  }

  const diffMin = endMin - startMin;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} jam ${minutes} minit`;
  } else if (hours > 0) {
    return `${hours} jam`;
  } else if (minutes > 0) {
    return `${minutes} minit`;
  }
  return '0 jam';
}

export function isTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const minStartA = parseTimeMinutes(startA);
  const minEndA = parseTimeMinutes(endA);
  const minStartB = parseTimeMinutes(startB);
  const minEndB = parseTimeMinutes(endB);

  return minStartA < minEndB && minEndA > minStartB;
}

/**
 * Mencari pengecualian akademik aktif yang berkuatkuasa untuk bilik dan tarikh yang diberikan.
 * Syarat padanan:
 * - ex.active === true
 * - date >= ex.startDate && date <= ex.endDate
 * - skop sepadan: ALL_ROOMS / BILIK_KULIAH / SELECTED
 */
export function findActiveExemption(
  room: Room,
  date: string,
  exemptions: AcademicExemption[] = []
): AcademicExemption | undefined {
  if (!exemptions || exemptions.length === 0 || !date) return undefined;
  return exemptions.find(ex => {
    if (!ex.active) return false;
    if (date < ex.startDate || date > ex.endDate) return false;
    if (ex.scope === 'ALL_ROOMS') return true;
    if (ex.scope === 'BILIK_KULIAH') return room.category === 'Bilik Kuliah';
    if (ex.scope === 'SELECTED') return !!(ex.roomIds && ex.roomIds.includes(room.id));
    return false;
  });
}

/**
 * Mengembalikan pengecualian aktif pertama untuk tarikh tertentu (tanpa mengira bilik).
 * Digunakan untuk paparan sepanduk maklumat am.
 */
export function getExemptionForDate(
  date: string,
  exemptions: AcademicExemption[] = []
): AcademicExemption | undefined {
  if (!exemptions || exemptions.length === 0 || !date) return undefined;
  return exemptions.find(ex => ex.active && date >= ex.startDate && date <= ex.endDate);
}

/**
 * Mengira bilangan slot jadual hakiki yang terjejas/dilangkau oleh pengecualian.
 */
export function countAffectedAcademicSlots(
  exemption: AcademicExemption,
  rooms: Room[],
  schedule: AcademicScheduleSlot[]
): number {
  if (!exemption.startDate || !exemption.endDate || exemption.endDate < exemption.startDate) return 0;
  
  const targetRoomIds = new Set<string>();
  for (const r of rooms) {
    if (exemption.scope === 'ALL_ROOMS') {
      targetRoomIds.add(r.id);
    } else if (exemption.scope === 'BILIK_KULIAH') {
      if (r.category === 'Bilik Kuliah') targetRoomIds.add(r.id);
    } else if (exemption.scope === 'SELECTED') {
      if (exemption.roomIds && exemption.roomIds.includes(r.id)) targetRoomIds.add(r.id);
    }
  }

  if (targetRoomIds.size === 0) return 0;

  let totalSlots = 0;
  const start = new Date(exemption.startDate);
  const end = new Date(exemption.endDate);

  const curr = new Date(start);
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dayOfWeek = getMalayDayOfWeek(dateStr);

    const slotsForDay = schedule.filter(s => s.dayOfWeek === dayOfWeek && targetRoomIds.has(s.roomId));
    totalSlots += slotsForDay.length;

    curr.setDate(curr.getDate() + 1);
  }

  return totalSlots;
}

/**
 * Validasi input pengecualian akademik untuk borang pentadbir.
 */
export function validateExemptionInput(
  input: Partial<AcademicExemption>,
  existing: AcademicExemption[] = []
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = (input.title || '').trim();
  if (!title) {
    errors.push('Tajuk pengecualian diperlukan.');
  }

  const startDate = input.startDate || '';
  const endDate = input.endDate || '';

  if (!startDate || !endDate) {
    errors.push('Tarikh mula dan tarikh tamat diperlukan.');
  } else if (endDate < startDate) {
    errors.push('Tarikh tamat tidak boleh mendahului tarikh mula.');
  } else {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 31) {
      errors.push('Tempoh pengecualian tidak boleh melebihi 31 hari.');
    }
  }

  if (input.scope === 'SELECTED' && (!input.roomIds || input.roomIds.length === 0)) {
    errors.push('Sila pilih sekurang-kurangnya satu bilik/ruang untuk skop bilik tertentu.');
  }

  // Warnings
  if (startDate && endDate && endDate >= startDate) {
    for (const ex of existing) {
      if (input.id && ex.id === input.id) continue;
      if (!ex.active) continue;
      if (startDate <= ex.endDate && endDate >= ex.startDate) {
        warnings.push(`Tempoh ini bertindih dengan pengecualian aktif sedia ada: "${ex.title}" (${ex.startDate} hingga ${ex.endDate}).`);
      }
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (startDate < todayStr) {
      warnings.push(`Tarikh mula (${startDate}) adalah tarikh yang sudah berlalu.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function checkRoomAvailability(
  room: Room,
  date: string,
  startTime: string,
  endTime: string,
  academicSchedule: AcademicScheduleSlot[],
  adhocBookings: AdHocBooking[],
  institutionalBlocks: InstitutionalBlock[],
  exemptions: AcademicExemption[] = []
): RoomAvailabilityCheck {
  const activeExemption = findActiveExemption(room, date, exemptions);

  // Layer 0: Check Time Range Validation & Night Limit (hard ceiling 23:00)
  const timeVal = validateBookingTime(startTime, endTime);
  if (!timeVal.isValid) {
    return {
      roomId: room.id,
      room,
      status: 'BLOCKED',
      academicExemption: activeExemption,
      conflictReason: timeVal.errorMsg || 'Waktu tempahan tidak sah.'
    };
  }

  // Layer 0.5: Check Room Night Booking Capability
  if (isTimeRangeNight(startTime, endTime) && room.allowNightBooking === false) {
    return {
      roomId: room.id,
      room,
      status: 'BLOCKED',
      academicExemption: activeExemption,
      conflictReason: `Ruang ${room.code} (${room.name}) tidak dibuka untuk tempahan waktu malam.`
    };
  }

  // Layer 3: Check Institutional Block (Supports single-date and multi-day date ranges e.g. 2 Nov - 16 Nov 2026)
  const block = institutionalBlocks.find(b => {
    if (b.roomId !== room.id) return false;
    // Check if query date falls on single date or within multi-day range
    const isDateMatch = b.endDate
      ? (date >= b.date && date <= b.endDate)
      : (b.date === date);
    if (!isDateMatch) return false;

    return isTimeOverlap(startTime, endTime, b.startTime, b.endTime);
  });

  if (block) {
    const isExam = block.category === 'EXAM' || block.title.toLowerCase().includes('peperiksaan');
    const rangeText = block.endDate && block.endDate !== block.date ? ` [${block.date} – ${block.endDate}]` : '';
    return {
      roomId: room.id,
      room,
      status: 'BLOCKED',
      institutionalBlock: block,
      academicExemption: activeExemption,
      conflictReason: isExam
        ? `🔒 Peperiksaan Akhir Rasmi Kolej: ${block.title}${rangeText} (${block.createdBy})`
        : `⚫ Sekatan Acara Institusi: ${block.title}${rangeText} (${block.createdBy})`
    };
  }

  // Layer 1: Check Academic Schedule Timetable (Dilangkau sekiranya pengecualian aktif berkuatkuasa)
  if (!activeExemption) {
    const dayOfWeek = getMalayDayOfWeek(date);
    const acadSlot = academicSchedule.find(s => 
      s.roomId === room.id && 
      s.dayOfWeek === dayOfWeek && 
      isTimeOverlap(startTime, endTime, s.startTime, s.endTime)
    );

    if (acadSlot) {
      return {
        roomId: room.id,
        room,
        status: 'OCCUPIED_ACADEMIC',
        academicSlot: acadSlot,
        conflictReason: `Jadual Akademik: ${acadSlot.courseCode} ${acadSlot.courseName} [${acadSlot.className}] oleh ${acadSlot.lecturerName}`
      };
    }
  }

  // Layer 2: Check Existing Ad-hoc Bookings
  const existingBooking = adhocBookings.find(b => 
    b.roomId === room.id && 
    b.date === date && 
    (b.status === 'CONFIRMED' || b.status === 'PENDING') &&
    isTimeOverlap(startTime, endTime, b.startTime, b.endTime)
  );

  if (existingBooking) {
    const isPending = existingBooking.status === 'PENDING';
    return {
      roomId: room.id,
      room,
      status: isPending ? 'PENDING_BOOKING' : 'OCCUPIED_BOOKING',
      existingBooking,
      academicExemption: activeExemption,
      conflictReason: isPending 
        ? `Permohonan Menunggu Kelulusan: ${existingBooking.title} (${existingBooking.applicantName})`
        : `Tempahan Disahkan: ${existingBooking.title} (${existingBooking.applicantName})`
    };
  }

  // Layer 4: Clear -> AVAILABLE
  return {
    roomId: room.id,
    room,
    status: 'AVAILABLE',
    academicExemption: activeExemption
  };
}

export function findSmartAlternatives(
  targetRoomId: string,
  params: SearchFilterParams,
  rooms: Room[],
  academicSchedule: AcademicScheduleSlot[],
  adhocBookings: AdHocBooking[],
  institutionalBlocks: InstitutionalBlock[],
  exemptions: AcademicExemption[] = []
): {
  alternativeRooms: RoomAvailabilityCheck[];
  alternativeSlots: { startTime: string; endTime: string; status: 'AVAILABLE'; period: TimeSlotPeriod }[];
} {
  const { date, startTime, endTime, minCapacity, category, isAircondOnly, isSmartClassroomOnly } = params;
  const isNightSearch = isTimeRangeNight(startTime, endTime);

  // 1. Find other rooms available at the exact same time slot
  const candidateRooms = rooms.filter(r => {
    if (r.id === targetRoomId) return false; // exclude original conflicted room
    if (category !== 'Semua' && r.category !== category) return false;
    if (minCapacity > 0 && r.capacity < minCapacity) return false;
    if (isAircondOnly && !r.hasAircond) return false;
    if (isSmartClassroomOnly && !r.hasAircond && !r.isSmartClassroom) return false;
    // If night search, only include rooms that allow night booking
    if (isNightSearch && r.allowNightBooking === false) return false;
    return true;
  });

  const availableAlternatives: RoomAvailabilityCheck[] = [];

  for (const r of candidateRooms) {
    const check = checkRoomAvailability(r, date, startTime, endTime, academicSchedule, adhocBookings, institutionalBlocks, exemptions);
    if (check.status === 'AVAILABLE') {
      availableAlternatives.push(check);
    }
  }

  // Sort alternatives by closest capacity and aircond status
  availableAlternatives.sort((a, b) => {
    if (a.room.hasAircond && !b.room.hasAircond) return -1;
    if (!a.room.hasAircond && b.room.hasAircond) return 1;
    return Math.abs(a.room.capacity - minCapacity) - Math.abs(b.room.capacity - minCapacity);
  });

  // 2. Find alternative time slots on the SAME target room if user wants to adjust time
  const targetRoom = rooms.find(r => r.id === targetRoomId);
  const alternativeSlots: { startTime: string; endTime: string; status: 'AVAILABLE'; period: TimeSlotPeriod }[] = [];

  if (targetRoom) {
    const candidateSlots = isNightSearch
      ? [...NIGHT_TIME_SLOTS, ...(targetRoom.allowNightBooking === false ? [] : DAY_TIME_SLOTS)]
      : [...DAY_TIME_SLOTS, ...(targetRoom.allowNightBooking === false ? [] : NIGHT_TIME_SLOTS)];

    for (const slot of candidateSlots) {
      if (slot.start === startTime && slot.end === endTime) continue;
      const slotCheck = checkRoomAvailability(
        targetRoom, 
        date, 
        slot.start, 
        slot.end, 
        academicSchedule, 
        adhocBookings, 
        institutionalBlocks,
        exemptions
      );
      if (slotCheck.status === 'AVAILABLE') {
        alternativeSlots.push({
          startTime: slot.start,
          endTime: slot.end,
          status: 'AVAILABLE',
          period: slot.period
        });
      }
    }
  }

  return {
    alternativeRooms: availableAlternatives.slice(0, 5), // top 5
    alternativeSlots
  };
}

export function formatWhatsAppMessage(booking: AdHocBooking): string {
  const statusEmoji = booking.status === 'CONFIRMED' ? '🟢 CONFIRMED' : booking.status === 'REJECTED' ? '🔴 REJECTED' : '🟡 PENDING';
  const exemptionLine = booking.academicExemptionId ? '\n📚 *Nota:* Jadual hakiki dikecualikan (Study Week)' : '';
  const text = `*TEMPAHAN RUANG*
━━━━━━━━━━━━━━━━━━━━━
📌 *ID Tempahan:* ${booking.id}
🏫 *Ruang:* ${booking.roomName} (${booking.roomId})
📅 *Tarikh:* ${booking.date} (${getMalayDayOfWeek(booking.date)})
🕐 *Masa:* ${booking.startTime} - ${booking.endTime}
👤 *Pemohon:* ${booking.applicantName} (${booking.applicantRole})
🎯 *Tujuan:* ${booking.purposeCategory} - ${booking.title}
⚡ *Status:* ${statusEmoji}${exemptionLine}
━━━━━━━━━━━━━━━━━━━━━
_Mesej ini dijana secara automatik_`;

  return text;
}

export function generateWhatsAppLink(booking: AdHocBooking): string {
  const msg = formatWhatsAppMessage(booking);
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function formatDateMalay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayName = getMalayDayOfWeek(dateStr);
  const day = d.getDate();
  const months = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * Export Ad-Hoc Bookings to standard CSV format with UTF-8 BOM for Excel compatibility.
 */
export function exportBookingsToCSV(
  bookings: AdHocBooking[],
  filenamePrefix: string = 'kpmbp_tempahan_adhoc_backup'
): { success: boolean; count: number; filename: string } {
  if (!bookings || bookings.length === 0) {
    return { success: false, count: 0, filename: '' };
  }

  const header = [
    'ID Tempahan',
    'Kod Ruang',
    'Nama Ruang',
    'Tarikh',
    'Hari',
    'Masa Mula',
    'Masa Tamat',
    'Nama Pemohon',
    'E-mel Pemohon',
    'No Telefon',
    'Jawatan',
    'Jabatan',
    'Kategori Tujuan',
    'Tajuk Aktiviti',
    'Bilangan Hadirin (Pax)',
    'Status Tempahan',
    'Tarikh Dicipta',
    'Catatan'
  ].join(',');

  const rows = bookings.map(b => {
    const day = getMalayDayOfWeek(b.date);
    return [
      `"${b.id}"`,
      `"${b.roomId}"`,
      `"${(b.roomName || '').replace(/"/g, '""')}"`,
      `"${b.date}"`,
      `"${day}"`,
      `"${b.startTime}"`,
      `"${b.endTime}"`,
      `"${(b.applicantName || '').replace(/"/g, '""')}"`,
      `"${(b.applicantEmail || '').replace(/"/g, '""')}"`,
      `"${(b.applicantPhone || '').replace(/"/g, '""')}"`,
      `"${(b.applicantRole || '').replace(/"/g, '""')}"`,
      `"${(b.department || '').replace(/"/g, '""')}"`,
      `"${(b.purposeCategory || '').replace(/"/g, '""')}"`,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      b.paxCount || 0,
      `"${b.status}"`,
      `"${b.createdAt || ''}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  // Include UTF-8 BOM (\uFEFF) so Excel displays Malay characters correctly
  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = ensureBookbkPrefix(`${filenamePrefix}_${dateStr}.csv`);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: bookings.length, filename };
}
