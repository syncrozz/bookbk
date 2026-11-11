/**
 * Helper pengiraan tarikh selamat (timezone-immune) untuk modul Pengecualian Jadual Hakiki (Study Week).
 * Semua pengiraan menggunakan komponen tarikh tempatan atau UTC date parts tanpa risiko anjakan zon waktu.
 */

export const MALAY_DAYS_FULL = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'] as const;
export const MALAY_DAYS_SHORT = ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Aha'] as const;

export const MALAY_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Des'
] as const;

export const MALAY_MONTHS_FULL = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
] as const;

/**
 * Mendapatkan tarikh semasa di Malaysia (UTC+8) dalam format YYYY-MM-DD.
 */
export function getTodayMalaysia(baseDate: Date = new Date()): string {
  // Tambah offset UTC+8 (8 jam = 28,800,000 ms)
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  const myDate = new Date(utc + 8 * 3600000);
  const y = myDate.getFullYear();
  const m = String(myDate.getMonth() + 1).padStart(2, '0');
  const d = String(myDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Tambah/tolak bilangan hari pada string YYYY-MM-DD secara tepat merentasi bulan dan tahun.
 */
export function addDays(dateStr: string, n: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(year, month - 1, day + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Mengembalikan indeks hari ISO di mana 1 = Isnin, 2 = Selasa, ..., 7 = Ahad.
 */
export function getIsoDayOfWeek(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(year, month - 1, day));
  const d = dt.getUTCDay(); // 0 = Ahad, 1 = Isnin, ..., 6 = Sabtu
  return d === 0 ? 7 : d;
}

/**
 * Nama hari dalam Bahasa Melayu (contoh: "Isnin" atau "Isn").
 */
export function getMalayDayName(dateStr: string, short = false): string {
  const iso = getIsoDayOfWeek(dateStr);
  const idx = iso - 1; // 0..6
  return short ? MALAY_DAYS_SHORT[idx] : MALAY_DAYS_FULL[idx];
}

/**
 * Dapatkan tarikh Isnin seterusnya (Isnin minggu hadapan).
 * Jika hari ini ialah Isnin, ia akan memulangkan Isnin MINGGU DEPAN (bukan hari yang sama).
 */
export function getNextMonday(today: string): string {
  const iso = getIsoDayOfWeek(today); // 1 = Isnin .. 7 = Ahad
  const daysToAdd = 8 - iso; // Isnin (1) -> +7; Selasa (2) -> +6; Ahad (7) -> +1
  return addDays(today, daysToAdd);
}

/**
 * Julat Minggu Semasa: Isnin minggu ini hingga Ahad minggu ini (7 hari).
 */
export function getThisWeekRange(today: string): { start: string; end: string } {
  const iso = getIsoDayOfWeek(today);
  const monday = addDays(today, -(iso - 1));
  const sunday = addDays(monday, 6);
  return { start: monday, end: sunday };
}

/**
 * Julat Minggu Hadapan: Isnin minggu depan hingga Ahad minggu depan (7 hari).
 */
export function getNextWeekRange(today: string): { start: string; end: string } {
  const nextMon = getNextMonday(today);
  const nextSun = addDays(nextMon, 6);
  return { start: nextMon, end: nextSun };
}

/**
 * Julat 2 Minggu Bermula Minggu Hadapan: Isnin depan hingga Ahad 2 minggu berikutnya (14 hari).
 */
export function getTwoWeeksFromNextWeekRange(today: string): { start: string; end: string } {
  const nextMon = getNextMonday(today);
  const endSun = addDays(nextMon, 13);
  return { start: nextMon, end: endSun };
}

/**
 * Alihkan tarikh ke hari Isnin pada minggu yang sama (jika Isnin, kekal Isnin).
 */
export function snapToMonday(dateStr: string): string {
  const iso = getIsoDayOfWeek(dateStr);
  return addDays(dateStr, -(iso - 1));
}

/**
 * Ringkasan julat tarikh: bilangan keseluruhan hari, hari bekerja (Isnin–Jumaat), dan hari hujung minggu (Sabtu–Ahad).
 */
export function summarizeRange(
  start: string,
  end: string
): { totalDays: number; weekdays: number; weekendDays: number } {
  if (!start || !end || end < start) {
    return { totalDays: 0, weekdays: 0, weekendDays: 0 };
  }

  let cur = start;
  let totalDays = 0;
  let weekdays = 0;
  let weekendDays = 0;

  // Had keselamatan untuk mengelakkan gelung tidak terhingga jika tarikh luar batasan
  const MAX_DAYS = 365;
  while (cur <= end && totalDays < MAX_DAYS) {
    totalDays++;
    const iso = getIsoDayOfWeek(cur);
    if (iso <= 5) {
      weekdays++;
    } else {
      weekendDays++;
    }
    cur = addDays(cur, 1);
  }

  return { totalDays, weekdays, weekendDays };
}

/**
 * Menjana tajuk automatik:
 * Contoh sama bulan: "Study Week 9-22 Nov 2026"
 * Contoh merentasi bulan: "Study Week 30 Nov - 6 Des 2026"
 * Contoh merentasi tahun: "Study Week 28 Des 2026 - 10 Jan 2027"
 */
export function buildAutoTitle(start: string, end: string): string {
  if (!start || !end || end < start) {
    return 'Study Week';
  }
  const s = parseDateParts(start);
  const e = parseDateParts(end);

  const sMonth = MALAY_MONTHS_SHORT[s.month - 1];
  const eMonth = MALAY_MONTHS_SHORT[e.month - 1];

  if (s.year === e.year) {
    if (s.month === e.month) {
      return `Study Week ${s.day}-${e.day} ${sMonth} ${s.year}`;
    }
    return `Study Week ${s.day} ${sMonth} - ${e.day} ${eMonth} ${s.year}`;
  }
  return `Study Week ${s.day} ${sMonth} ${s.year} - ${e.day} ${eMonth} ${e.year}`;
}

/**
 * Format paparan ringkas tarikh Melayu: contoh "Isnin 9 Nov 2026".
 */
export function formatDateMalayShort(dateStr: string): string {
  if (!dateStr) return '';
  const { year, month, day } = parseDateParts(dateStr);
  const dayName = getMalayDayName(dateStr);
  const mName = MALAY_MONTHS_SHORT[month - 1];
  return `${dayName} ${day} ${mName} ${year}`;
}

/**
 * Format paparan julat Melayu: contoh "Isnin 9 Nov 2026 hingga Ahad 22 Nov 2026".
 */
export function formatRangeMalay(start: string, end: string): string {
  if (!start || !end) return '';
  return `${formatDateMalayShort(start)} hingga ${formatDateMalayShort(end)}`;
}
