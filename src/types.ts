export type RoomCategory = 'Bilik Kuliah' | 'Dewan Kuliah' | 'Makmal Komputer' | 'Ruang Khas' | 'Surau';

export interface Room {
  id: string;             // e.g. 'BK01', 'DKA', 'DEWAN_BESAR'
  code: string;           // e.g. 'BK01', 'DKA', 'Dewan Besar'
  name: string;           // e.g. 'Bilik Kuliah 01', 'Dewan Kuliah A'
  category: RoomCategory;
  capacity: number;
  block: string;          // e.g. 'Blok A', 'Blok B', 'Bangunan Pentadbiran'
  level: number | string; // e.g. 1, 2, 'G'
  facilities: string[];   // e.g. ['Papan Pintar (Smartboard)', 'Projektor LCD', 'Pendingin Hawa', 'Sistem Audio']
  hasAircond?: boolean;
  isSmartClassroom?: boolean;
  allowNightBooking?: boolean; // Default true (dibenarkan tempahan malam 20:00 - 23:00)
  imageUrl?: string;
  notes?: string;
}

export type DayOfWeek = 'Isnin' | 'Selasa' | 'Rabu' | 'Khamis' | 'Jumaat' | 'Sabtu' | 'Ahad';

export interface AcademicScheduleSlot {
  id: string;
  roomId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;      // e.g. '08:30'
  endTime: string;        // e.g. '10:30'
  courseCode: string;     // e.g. 'DIA 1023'
  courseName: string;     // e.g. 'Perakaunan Kewangan 1'
  className: string;      // e.g. 'DIA 4C'
  lecturerName: string;   // e.g. 'Pn. Tahira Mohamed'
  department: string;     // e.g. 'Jabatan Perdagangan'
  remark?: string;        // Custom Admin Remark / Label Paparan Selaras
}

export type PurposeCategory = 
  | 'Kelas'
  | 'Kelas Ganti'
  | 'Konsultasi'
  | 'Mesyuarat'
  | 'Aktiviti Pelajar'
  | 'Lain-lain'
  | (string & {});

export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'REJECTED' | 'CANCELLED';

export type BookingSyncStatus = 'synced' | 'pending_sync' | 'sync_failed';

export interface AdHocBooking {
  id: string;             // e.g. 'BK-2026-000124'
  roomId: string;
  roomName: string;
  date: string;           // YYYY-MM-DD e.g. '2026-08-06'
  startTime: string;      // e.g. '11:30'
  endTime: string;        // e.g. '12:30'
  applicantName: string;  // e.g. 'En. Ahmad Khairi'
  applicantEmail?: string;// e.g. 'khairi.mohd@mara.gov.my'
  applicantPhone?: string;// e.g. '012-3456789'
  applicantRole: string;  // e.g. 'Pensyarah DIA' | 'Pegawai Akademik'
  department: string;     // e.g. 'Jabatan Sains Komputer'
  purposeCategory: PurposeCategory;
  title: string;          // e.g. 'Bengkel Khas Coding React'
  paxCount: number;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
  syncStatus?: BookingSyncStatus;
  syncError?: string;
  syncedAt?: string;
  idempotencyKey?: string;
  academicExemptionId?: string;
}

export interface AcademicExemption {
  id: string;                 // e.g. 'EX-20261109-001'
  title: string;              // e.g. 'Study Week Semester Nov 2026'
  startDate: string;          // YYYY-MM-DD (inklusif)
  endDate: string;            // YYYY-MM-DD (inklusif)
  scope: 'ALL_ROOMS' | 'BILIK_KULIAH' | 'SELECTED';
  roomIds?: string[];         // hanya untuk scope 'SELECTED'
  reason?: string;
  active: boolean;            // admin boleh matikan tanpa memadam
  createdBy: string;
  createdAt: string;
}

export interface InstitutionalBlock {
  id: string;
  roomId: string;
  date: string;           // YYYY-MM-DD (Tarikh Mula)
  endDate?: string;       // YYYY-MM-DD (Tarikh Tamat untuk julat multi-tarikh)
  startTime: string;      // e.g. '08:00'
  endTime: string;        // e.g. '24:00'
  title: string;          // e.g. 'Peperiksaan Akhir Semester Nov 2026'
  reason: string;         // e.g. 'Penggunaan Rasmi Peperiksaan Kolej'
  createdBy: string;      // e.g. 'Unit Peperiksaan & Penilaian Kolej'
  category?: 'EXAM' | 'INSTITUTIONAL' | 'MAINTENANCE';
  batchId?: string;       // ID kelompok untuk sekatan berbilang bilik/hari
  isAllDay?: boolean;
}

export type AvailabilityStatus = 'AVAILABLE' | 'OCCUPIED_ACADEMIC' | 'OCCUPIED_BOOKING' | 'PENDING_BOOKING' | 'BLOCKED';

export interface RoomAvailabilityCheck {
  roomId: string;
  room: Room;
  status: AvailabilityStatus;
  academicSlot?: AcademicScheduleSlot;
  existingBooking?: AdHocBooking;
  institutionalBlock?: InstitutionalBlock;
  academicExemption?: AcademicExemption;
  conflictReason?: string;
}

export interface SearchFilterParams {
  date: string;
  startTime: string;
  endTime: string;
  minCapacity: number;
  category: RoomCategory | 'Semua';
  purpose: PurposeCategory;
  isAircondOnly?: boolean;
  isSmartClassroomOnly?: boolean;
}

export interface StaffUser {
  id: string;
  department: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  aliases?: string[];
  pinStatus: 'DEFAULT' | 'CUSTOM';
  pinChangedAt?: string;
  pinHash?: string;
}

