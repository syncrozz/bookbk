import { InstitutionalBlock, Room } from '../types';
import { ensureBookbkPrefix, triggerFileDownload } from './downloadHelper';

export const BLOCKS_CSV_HEADERS = [
  'ID Sekatan',
  'Kod Ruang',
  'Nama Ruang',
  'Tarikh Mula',
  'Tarikh Tamat',
  'Masa Mula',
  'Masa Tamat',
  'Sepanjang Hari',
  'Kategori',
  'Tajuk Sekatan',
  'Sebab / Keterangan',
  'Dicipta Oleh',
  'ID Kelompok',
];

function escapeCsvCell(val: unknown): string {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

/**
 * Export institutional & exam blocks to UTF-8 BOM CSV file and trigger download.
 */
export function exportBlocksToCSV(
  blocks: InstitutionalBlock[],
  rooms: Room[] = []
): { success: boolean; filename: string; count: number } {
  if (!blocks || blocks.length === 0) {
    return { success: false, filename: '', count: 0 };
  }

  const roomNameById = new Map<string, string>(
    rooms.map((r) => [r.id.toUpperCase(), r.name || r.code || r.id])
  );

  const header = BLOCKS_CSV_HEADERS.join(',');
  const rows = blocks.map((b) => {
    const resolvedRoomName = roomNameById.get((b.roomId || '').toUpperCase()) || b.roomId;
    return [
      escapeCsvCell(b.id),
      escapeCsvCell(b.roomId),
      escapeCsvCell(resolvedRoomName),
      escapeCsvCell(b.date),
      escapeCsvCell(b.endDate || b.date),
      escapeCsvCell(b.startTime),
      escapeCsvCell(b.endTime),
      escapeCsvCell(b.isAllDay ? 'Ya' : 'Tidak'),
      escapeCsvCell(b.category || 'INSTITUTIONAL'),
      escapeCsvCell(b.title),
      escapeCsvCell(b.reason),
      escapeCsvCell(b.createdBy),
      escapeCsvCell(b.batchId || ''),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = ensureBookbkPrefix(`kpmbp_sekatan_ruang_${dateStr}.csv`);
  triggerFileDownload(blob, filename);

  return { success: true, filename, count: blocks.length };
}

/**
 * Download sample CSV template for institutional & exam blocks.
 */
export function downloadBlocksCSVTemplate(rooms: Room[] = []): void {
  const sampleRoom1 = rooms.find((r) => r.id === 'DEWAN_BESAR') || rooms[0];
  const sampleRoom2 = rooms.find((r) => r.id === 'SRI_PENAWAR') || rooms[1] || sampleRoom1;

  const header = BLOCKS_CSV_HEADERS.join(',');
  const sampleRows = [
    [
      '',
      sampleRoom1?.id || 'DEWAN_BESAR',
      sampleRoom1?.name || 'Dewan Besar (Dewan Utama)',
      '2026-11-16',
      '2026-11-20',
      '08:00',
      '24:00',
      'Ya',
      'EXAM',
      'Peperiksaan Akhir Semester',
      'Sekatan rasmi dewan peperiksaan',
      'UPPK',
      '',
    ].map(escapeCsvCell).join(','),
    [
      '',
      sampleRoom2?.id || 'SRI_PENAWAR',
      sampleRoom2?.name || 'Dewan Sri Penawar',
      '2026-11-23',
      '2026-11-23',
      '08:30',
      '17:00',
      'Tidak',
      'INSTITUTIONAL',
      'Majlis Perhimpunan Rasmi Kolej',
      'Program rasmi pengurusan kolej',
      'Pentadbiran',
      '',
    ].map(escapeCsvCell).join(','),
  ];

  const csvContent = '\uFEFF' + [header, ...sampleRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, ensureBookbkPrefix('kpmbp_templat_sekatan_ruang.csv'));
}

function splitCSVRows(csvText: string): string[] {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentRow += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && clean[i + 1] === '\n') {
        i++;
      }
      if (currentRow.trim()) {
        rows.push(currentRow.trim());
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }
  if (currentRow.trim()) {
    rows.push(currentRow.trim());
  }
  return rows;
}

function parseCSVRow(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeDateInput(raw: string): string | null {
  const val = raw.trim();
  if (!val) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }

  // DD/MM/YYYY or DD-MM-YYYY (common Excel export format)
  const dmyMatch = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function normalizeTimeInput(raw: string, fallback: string): string {
  const val = raw.trim();
  if (!val) return fallback;
  const match = val.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 24 || m < 0 || m > 59) {
    return fallback;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeCategory(raw: string): 'EXAM' | 'INSTITUTIONAL' | 'MAINTENANCE' {
  const upper = raw.trim().toUpperCase();
  if (upper === 'EXAM' || upper.includes('PEPERIKSAAN')) return 'EXAM';
  if (upper === 'MAINTENANCE' || upper.includes('PENYENGGARAAN') || upper.includes('SELENGGARA')) {
    return 'MAINTENANCE';
  }
  return 'INSTITUTIONAL';
}

function parseBoolMalay(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return lower === 'ya' || lower === 'yes' || lower === 'true' || lower === '1';
}

/**
 * Parse uploaded CSV text into validated InstitutionalBlock objects.
 * Supports both exported Malay headers and standard camelCase headers.
 */
export function parseBlocksCSV(
  csvText: string,
  existingRooms: Room[] = []
): {
  blocks: InstitutionalBlock[];
  errors: string[];
  warnings: string[];
} {
  const rows = splitCSVRows(csvText);
  if (rows.length < 2) {
    return {
      blocks: [],
      errors: ['Fail CSV kosong atau hanya mengandungi baris tajuk tanpa rekod sekatan.'],
      warnings: [],
    };
  }

  const rawHeaders = parseCSVRow(rows[0]).map((h) => h.trim().toLowerCase());
  const findColIndex = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = rawHeaders.indexOf(alias.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxId = findColIndex(['id sekatan', 'id']);
  const idxRoomId = findColIndex(['kod ruang', 'roomid', 'room_id', 'kod bilik']);
  const idxRoomName = findColIndex(['nama ruang', 'roomname', 'room_name']);
  const idxDate = findColIndex(['tarikh mula', 'date', 'startdate', 'tarikh']);
  const idxEndDate = findColIndex(['tarikh tamat', 'enddate', 'end_date']);
  const idxStartTime = findColIndex(['masa mula', 'starttime', 'start_time', 'waktu mula']);
  const idxEndTime = findColIndex(['masa tamat', 'endtime', 'end_time', 'waktu tamat']);
  const idxIsAllDay = findColIndex(['sepanjang hari', 'isallday', 'is_all_day']);
  const idxCategory = findColIndex(['kategori', 'category']);
  const idxTitle = findColIndex(['tajuk sekatan', 'tajuk', 'title']);
  const idxReason = findColIndex(['sebab / keterangan', 'sebab', 'reason', 'catatan']);
  const idxCreatedBy = findColIndex(['dicipta oleh', 'disediakan oleh', 'createdby', 'created_by']);
  const idxBatchId = findColIndex(['id kelompok', 'batchid', 'batch_id']);

  if (idxRoomId === -1 && idxRoomName === -1) {
    return {
      blocks: [],
      errors: ['Lajur wajib "Kod Ruang" (atau "roomId") tidak dijumpai dalam fail CSV.'],
      warnings: [],
    };
  }
  if (idxDate === -1) {
    return {
      blocks: [],
      errors: ['Lajur wajib "Tarikh Mula" (atau "date") tidak dijumpai dalam fail CSV.'],
      warnings: [],
    };
  }
  if (idxTitle === -1) {
    return {
      blocks: [],
      errors: ['Lajur wajib "Tajuk Sekatan" (atau "title") tidak dijumpai dalam fail CSV.'],
      warnings: [],
    };
  }

  const roomLookup = new Map<string, Room>();
  for (const r of existingRooms) {
    roomLookup.set(r.id.trim().toLowerCase(), r);
    if (r.code) roomLookup.set(r.code.trim().toLowerCase(), r);
    if (r.name) roomLookup.set(r.name.trim().toLowerCase(), r);
  }

  const blocks: InstitutionalBlock[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const batchTimestamp = Date.now();
  const defaultBatchId = `BATCH-CSV-${batchTimestamp}`;

  for (let i = 1; i < rows.length; i++) {
    const cells = parseCSVRow(rows[i]);
    if (cells.every((c) => !c.trim())) continue;

    const getCell = (idx: number): string => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');

    const rawRoomId = getCell(idxRoomId);
    const rawRoomName = getCell(idxRoomName);
    const rawDate = getCell(idxDate);
    const rawEndDate = getCell(idxEndDate);
    const rawTitle = getCell(idxTitle);

    if (!rawRoomId && !rawRoomName) {
      errors.push(`Baris ${i + 1}: Kod Ruang / Nama Ruang kosong.`);
      continue;
    }

    const parsedDate = normalizeDateInput(rawDate);
    if (!parsedDate) {
      errors.push(`Baris ${i + 1}: Format Tarikh Mula "${rawDate}" tidak sah (gunakan YYYY-MM-DD atau DD/MM/YYYY).`);
      continue;
    }

    let parsedEndDate = parsedDate;
    if (rawEndDate) {
      const normalizedEnd = normalizeDateInput(rawEndDate);
      if (!normalizedEnd) {
        errors.push(`Baris ${i + 1}: Format Tarikh Tamat "${rawEndDate}" tidak sah.`);
        continue;
      }
      if (normalizedEnd < parsedDate) {
        errors.push(`Baris ${i + 1}: Tarikh Tamat (${normalizedEnd}) tidak boleh sebelum Tarikh Mula (${parsedDate}).`);
        continue;
      }
      parsedEndDate = normalizedEnd;
    }

    if (!rawTitle) {
      errors.push(`Baris ${i + 1}: Tajuk Sekatan kosong.`);
      continue;
    }

    const matchedRoom =
      roomLookup.get(rawRoomId.toLowerCase()) ||
      (rawRoomName ? roomLookup.get(rawRoomName.toLowerCase()) : undefined);

    const resolvedRoomId = matchedRoom ? matchedRoom.id : rawRoomId.toUpperCase();
    if (!matchedRoom && existingRooms.length > 0) {
      warnings.push(`Baris ${i + 1}: Kod ruang "${rawRoomId || rawRoomName}" tidak ditemui dalam direktori ruang; disimpan sebagai "${resolvedRoomId}".`);
    }

    const rawAllDay = getCell(idxIsAllDay);
    const rawStartTime = getCell(idxStartTime);
    const rawEndTime = getCell(idxEndTime);
    const isAllDay = rawAllDay
      ? parseBoolMalay(rawAllDay)
      : (!rawStartTime && !rawEndTime) || (rawStartTime === '08:00' && (rawEndTime === '24:00' || rawEndTime === '23:59'));

    const startTime = isAllDay && !rawStartTime ? '08:00' : normalizeTimeInput(rawStartTime, '08:00');
    const endTime = isAllDay && !rawEndTime ? '24:00' : normalizeTimeInput(rawEndTime, '24:00');

    const rawId = getCell(idxId);
    const rawCategory = getCell(idxCategory);
    const rawReason = getCell(idxReason);
    const rawCreatedBy = getCell(idxCreatedBy);
    const rawBatchId = getCell(idxBatchId);

    blocks.push({
      id: rawId || `BLK-CSV-${batchTimestamp}-${i}`,
      roomId: resolvedRoomId,
      date: parsedDate,
      endDate: parsedEndDate,
      startTime,
      endTime,
      isAllDay,
      category: normalizeCategory(rawCategory),
      title: rawTitle,
      reason: rawReason || '',
      createdBy: rawCreatedBy || 'Admin KPMBP',
      batchId: rawBatchId || defaultBatchId,
    });
  }

  return { blocks, errors, warnings };
}
