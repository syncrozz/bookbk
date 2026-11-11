import { AcademicScheduleSlot, DayOfWeek, Room } from '../types';

export interface ParseTimetableResult {
  slots: AcademicScheduleSlot[];
  errors: string[];
  summary: {
    totalRowsProcessed: number;
    validSlotsCount: number;
    roomsAffected: string[];
  };
}

// Convert day string to valid DayOfWeek
export function mapToDayOfWeek(rawDay: string): DayOfWeek | null {
  if (!rawDay) return null;
  const clean = rawDay.trim().toUpperCase();
  if (clean.includes('MON') || clean.includes('ISNIN') || clean === '1') return 'Isnin';
  if (clean.includes('TUE') || clean.includes('SELASA') || clean === '2') return 'Selasa';
  if (clean.includes('WED') || clean.includes('RABU') || clean === '3') return 'Rabu';
  if (clean.includes('THU') || clean.includes('KHAMIS') || clean === '4') return 'Khamis';
  if (clean.includes('FRI') || clean.includes('JUMAAT') || clean === '5') return 'Jumaat';
  if (clean.includes('SAT') || clean.includes('SABTU') || clean === '6') return 'Sabtu';
  if (clean.includes('SUN') || clean.includes('AHAD') || clean === '7') return 'Ahad';
  return null;
}

// Format time HH:MM (e.g. "8:30" -> "08:30")
export function formatTimeStr(tStr: string): string {
  const clean = tStr.trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  const hour = parts[0].padStart(2, '0');
  const min = parts[1].padStart(2, '0');
  return `${hour}:${min}`;
}

// Parse header time string (e.g. "1\n8:30 - 9:30", "8:30AM", "12:30AM", "1:30PM", "5:30 PM", "8:30") into { start, end }
export function parseHeaderTimeSlot(headerStr: string): { startTime: string; endTime: string } | null {
  if (!headerStr) return null;
  const clean = headerStr.trim();

  // 1. Regex to extract time range anywhere in the header (e.g. "8:30 - 9:30", "13:30 - 14:30", "20:00 - 21:00", "08:30-09:30")
  const rangeMatch = clean.match(/(\d{1,2}[:.]\d{2})\s*[-–至to]\s*(\d{1,2}[:.]\d{2})/i);
  if (rangeMatch) {
    const s = rangeMatch[1].replace('.', ':');
    const e = rangeMatch[2].replace('.', ':');
    return { startTime: formatTimeStr(s), endTime: formatTimeStr(e) };
  }

  const upper = clean.toUpperCase();
  
  // Explicit matches for standard master columns
  if (upper.includes('8:30') || upper.includes('08:30')) return { startTime: '08:30', endTime: '09:30' };
  if (upper.includes('9:30') || upper.includes('09:30')) return { startTime: '09:30', endTime: '10:30' };
  if (upper.includes('10:30')) return { startTime: '10:30', endTime: '11:30' };
  if (upper.includes('11:30')) return { startTime: '11:30', endTime: '12:30' };
  if (upper.includes('12:30')) return { startTime: '12:30', endTime: '13:30' };
  if (upper.includes('1:30') || upper.includes('13:30')) return { startTime: '13:30', endTime: '14:30' };
  if (upper.includes('2:30') || upper.includes('14:30')) return { startTime: '14:30', endTime: '15:30' };
  if (upper.includes('3:30') || upper.includes('15:30')) return { startTime: '15:30', endTime: '16:30' };
  if (upper.includes('4:30') || upper.includes('16:30')) return { startTime: '16:30', endTime: '17:30' };
  if (upper.includes('5:30') || upper.includes('17:30')) return { startTime: '17:30', endTime: '18:30' };

  // Night slots (SES v4.4)
  if (upper.includes('20:00') || upper.includes('8:00 PM')) return { startTime: '20:00', endTime: '21:00' };
  if (upper.includes('21:00') || upper.includes('9:00 PM')) return { startTime: '21:00', endTime: '22:00' };
  if (upper.includes('22:00') || upper.includes('10:00 PM')) return { startTime: '22:00', endTime: '23:00' };

  return null;
}

// Smart extractor for cell contents: e.g. "LAW 2523 DLM 4B ADAM" or "LOG 3533 DLM 4E NOR LIZA BINTI RAMLIY CMILT"
export function parseCellAcademicDetails(rawContent: string): {
  courseCode: string;
  courseName: string;
  className: string;
  lecturerName: string;
} {
  const text = rawContent.trim();
  if (!text) {
    return { courseCode: 'AKADEMIK', courseName: 'Sesi Kuliah', className: '', lecturerName: 'Pensyarah KPMBP' };
  }

  // Handle multiline
  const lines = text.split(/\r\n|\n|\\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length >= 2) {
    const courseCode = lines[0];
    const className = lines[1] || '';
    const lecturerName = lines.slice(2).join(' ') || 'Pensyarah KPMBP';
    return {
      courseCode,
      courseName: courseCode,
      className,
      lecturerName
    };
  }

  // Single line with spaces
  // Regex 1: Matches pattern like "LAW 2523 DLM 4B ADAM" or "COM 2512 DIA 4B SOLAHUDDIN" or "LOG 2063 DLM 3C SYAKIRAH"
  const standardPattern = /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z0-9\/\s\-]+?)\s+([A-Z@\.\s\']+)$/i;
  const match = text.match(standardPattern);
  if (match) {
    const courseCode = match[1].trim();
    const className = match[2].trim();
    const lecturerName = match[3].trim();
    return {
      courseCode,
      courseName: courseCode,
      className,
      lecturerName
    };
  }

  // Regex 2: Matches "COM 2512 DIA 4C"
  const courseClassPattern = /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z0-9\/\s\-]+)$/i;
  const match2 = text.match(courseClassPattern);
  if (match2) {
    const courseCode = match2[1].trim();
    const className = match2[2].trim();
    return {
      courseCode,
      courseName: courseCode,
      className,
      lecturerName: 'Pensyarah KPMBP'
    };
  }

  // Regex 3: Matches course code only "MGT 1013" or "LOG 1053"
  const courseOnlyPattern = /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)$/i;
  if (courseOnlyPattern.test(text)) {
    return {
      courseCode: text,
      courseName: text,
      className: '',
      lecturerName: 'Pensyarah KPMBP'
    };
  }

  // Regex 4: Matches class code only like "DIA 4C" or "DLM 3B" or "DCAT 7C"
  const classOnlyPattern = /^([A-Z]{2,4}\s*\d[A-Z0-9]?(\/[A-Z0-9\s]+)?)$/i;
  if (classOnlyPattern.test(text)) {
    return {
      courseCode: 'KULIAH',
      courseName: `Kelas ${text}`,
      className: text,
      lecturerName: 'Pensyarah KPMBP'
    };
  }

  const upper = text.toUpperCase();
  if (upper === 'LOCKED' || upper === 'DIKUNCI' || upper === 'TERKUNCI' || upper === 'LOCK' || upper === 'BLOCK') {
    return {
      courseCode: 'LOCKED',
      courseName: 'Slot Terkunci Pentadbir',
      className: 'Ketetapan Pentadbiran',
      lecturerName: 'Pentadbir KPMBP'
    };
  }

  // Fallback: Lecturer name, Staff name, or Custom Activity (e.g. "IBRAHIM", "AFIF", "NIZAM")
  const cleanName = text.trim();
  const formattedName = /^[A-Z]{3,}$/.test(cleanName)
    ? cleanName.charAt(0) + cleanName.slice(1).toLowerCase()
    : cleanName;

  return {
    courseCode: 'LOCKED',
    courseName: `Slot Terkunci: ${formattedName}`,
    className: formattedName,
    lecturerName: formattedName
  };
}

// Split CSV text into logical rows/records handling multiline values inside quotes
export function splitCSVIntoRecords(csvText: string): string[] {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  const records: string[] = [];
  let currentRecord = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      currentRecord += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && cleanText[i + 1] === '\n') {
        i++; // skip \n in \r\n
      }
      if (currentRecord.trim().length > 0) {
        records.push(currentRecord.trim());
      }
      currentRecord = '';
    } else {
      currentRecord += char;
    }
  }
  if (currentRecord.trim().length > 0) {
    records.push(currentRecord.trim());
  }
  return records;
}

// Parse CSV line considering quotes and delimiters
export function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(cur.trim().replace(/^["']|["']$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim().replace(/^["']|["']$/g, ''));
  return result;
}

// Find matching Room ID in existing rooms
export function resolveRoomId(rawVenue: string, tableId: string, existingRooms: Room[]): string {
  const venueUpper = rawVenue.trim().toUpperCase();
  const tableUpper = tableId.trim().toUpperCase();

  // Alias lookup for renamed and alternate room labels
  const ALIAS_MAP: Record<string, string> = {
    'SMART CLASSROOM': 'SMART_CLASSROOM',
    'S. CLASSROOM': 'SMART_CLASSROOM',
    'S CLASSROOM': 'SMART_CLASSROOM',
    'MAKMAL ALFA': 'MAKMAL_ALFA',
    'LAB ALFA': 'MAKMAL_ALFA',
    'MAKMAL BETA': 'MAKMAL_BETA',
    'LAB BETA': 'MAKMAL_BETA',
    'MAKMAL SIGMA': 'MAKMAL_SIGMA',
    'LAB SIGMA': 'MAKMAL_SIGMA',
    'MAKMAL GAMMA': 'MAKMAL_GAMMA',
    'LAB GAMMA': 'MAKMAL_GAMMA',
    'MAKMAL DELTA': 'MAKMAL_DELTA',
    'LAB DELTA': 'MAKMAL_DELTA',
    'ARAS 1 PERPUSTAKAAN': 'ARAS_1_PERPUSTAKAAN',
    'L1 LIBRARY': 'ARAS_1_PERPUSTAKAAN',
    'BILIK KOTA TINGGI': 'BILIK_KOTA_TINGGI',
    'BLK. KOTA TINGGI': 'BILIK_KOTA_TINGGI',
    'BLK KOTA TINGGI': 'BILIK_KOTA_TINGGI',
  };

  if (ALIAS_MAP[venueUpper]) {
    const aliasedId = ALIAS_MAP[venueUpper];
    const match = existingRooms.find(r => r.id === aliasedId);
    if (match) return match.id;
  }

  // Try matching rawVenue with room code, id or name
  for (const r of existingRooms) {
    if (
      venueUpper === r.code.toUpperCase() ||
      venueUpper === r.id.toUpperCase() ||
      venueUpper === r.name.toUpperCase()
    ) {
      return r.id;
    }
  }

  // Normalized search (e.g. "MAKMAL ALFA", "SURAU 1", "ARAS 1 PERPUSTAKAAN", "DEWAN SEMINAR")
  for (const r of existingRooms) {
    const cleanR = r.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const cleanV = venueUpper.replace(/[^A-Z0-9]/gi, '');
    if (cleanR === cleanV && cleanR.length > 0) {
      return r.id;
    }
  }

  // Try Table mapping
  if (tableUpper) {
    const numMatch = tableUpper.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      const bkCode = `BK${num < 10 ? '0' + num : num}`;
      const bkRoom = existingRooms.find(r => r.id === bkCode || r.code === bkCode);
      if (bkRoom) return bkRoom.id;
    }
  }

  // If room is something like "SURAU 1" -> "SURAU_1"
  const fallbackId = venueUpper.replace(/\s+/g, '_');
  const fallbackRoom = existingRooms.find(r => r.id === fallbackId);
  if (fallbackRoom) return fallbackRoom.id;

  return venueUpper || 'BK01';
}

export function parseTimetableCSV(csvText: string, existingRooms: Room[]): ParseTimetableResult {
  const errors: string[] = [];
  const validSlots: AcademicScheduleSlot[] = [];
  const affectedRoomIds = new Set<string>();

  const lines = splitCSVIntoRecords(csvText);
  if (lines.length < 2) {
    return {
      slots: [],
      errors: ['Fail CSV kosong atau tiada baris data selepas pengepala (header).'],
      summary: { totalRowsProcessed: 0, validSlotsCount: 0, roomsAffected: [] }
    };
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const rawHeaders = parseCSVLine(headerLine, delimiter);
  const headers = rawHeaders.map(h => h.toLowerCase().trim());

  // Check Format 1: Master Matrix Format (Perkara / Hari / Petempatan / Ruang / Bilik / Table)
  const hasRoomCol = headers.some(h => 
    h.includes('perkara') || 
    h.includes('ruang') || 
    h.includes('bilik') || 
    h.includes('petempatan') || 
    h.includes('venue') || 
    h.includes('tempat') ||
    h.includes('table')
  );
  const hasDayCol = headers.some(h => h.includes('hari') || h.includes('day'));
  const hasTimeCol = rawHeaders.some(h => parseHeaderTimeSlot(h) !== null);

  const isMasterMatrixFormat = (hasRoomCol && hasDayCol && hasTimeCol) || 
    (hasRoomCol && hasDayCol) ||
    headers.some(h => h.includes('petempatan') || h.includes('ruang') || h.includes('bilik')) ||
    headers[0]?.includes('table') || 
    headers[0]?.includes('perkara');

  if (isMasterMatrixFormat) {
    // Find column indexes
    let tableColIdx = headers.findIndex(h => h.includes('table'));
    let roomColIdx = headers.findIndex(h => 
      h.includes('perkara') || 
      h.includes('ruang') || 
      h.includes('bilik') || 
      h.includes('petempatan') || 
      h.includes('venue') || 
      h.includes('tempat')
    );
    if (roomColIdx === -1 && tableColIdx !== -1) roomColIdx = tableColIdx + 1;
    if (roomColIdx === -1) roomColIdx = 0;

    let dayColIdx = headers.findIndex(h => h.includes('hari') || h.includes('day'));
    if (dayColIdx === -1) dayColIdx = 1;

    // Identify time slot columns from headers
    const timeSlotCols: { colIdx: number; startTime: string; endTime: string }[] = [];
    for (let col = 0; col < rawHeaders.length; col++) {
      if (col === tableColIdx || col === roomColIdx || col === dayColIdx) continue;
      const parsedSlot = parseHeaderTimeSlot(rawHeaders[col]);
      if (parsedSlot) {
        timeSlotCols.push({ colIdx: col, startTime: parsedSlot.startTime, endTime: parsedSlot.endTime });
      }
    }

    let slotCounter = 1;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const rawTable = tableColIdx >= 0 ? cols[tableColIdx] || '' : '';
      const rawRoom = roomColIdx >= 0 ? cols[roomColIdx] || '' : '';
      const rawDay = dayColIdx >= 0 ? cols[dayColIdx] || '' : '';

      if (!rawRoom && !rawTable) continue;
      const dayOfWeek = mapToDayOfWeek(rawDay);
      if (!dayOfWeek) continue;

      const roomId = resolveRoomId(rawRoom, rawTable, existingRooms);

      // Iterate each time slot column in this row
      for (const timeSlot of timeSlotCols) {
        const cellValue = cols[timeSlot.colIdx]?.trim();
        if (!cellValue) continue;

        // Filter out non-academic or pure day label entries
        const upperVal = cellValue.toUpperCase();
        if (
          upperVal === 'MON' || upperVal === 'TUE' || upperVal === 'WED' || upperVal === 'THU' || upperVal === 'FRI' ||
          upperVal.includes('KOLEJ PROFESIONAL MARA') ||
          upperVal.includes('ASSEMBLY')
        ) {
          continue;
        }

        const parsedDetails = parseCellAcademicDetails(cellValue);
        const cleanRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanStart = timeSlot.startTime.replace(/[^a-zA-Z0-9]/g, '');
        const cleanEnd = timeSlot.endTime.replace(/[^a-zA-Z0-9]/g, '');

        validSlots.push({
          id: `SCH-${cleanRoom}-${dayOfWeek}-${cleanStart}-${cleanEnd}`,
          roomId,
          dayOfWeek,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          courseCode: parsedDetails.courseCode,
          courseName: parsedDetails.courseName,
          className: parsedDetails.className,
          lecturerName: parsedDetails.lecturerName,
          department: (parsedDetails.courseCode === 'LOCKED' || parsedDetails.courseCode === 'TERKUNCI') ? 'Unit Pengurusan Ruang & Jadual KPMBP' : 'Jabatan Akademik KPMBP'
        });

        affectedRoomIds.add(roomId);
      }
    }
  } else if (headers.includes('table_id') || headers.includes('nilai_asal')) {
    // Format 2: College Timetable Unit (table_id, hari, slot, masa, cell, merged_range, header_asal, nilai_asal)
    const tableIdIdx = headers.indexOf('table_id');
    const hariIdx = headers.indexOf('hari');
    const masaIdx = headers.indexOf('masa');
    const mergedIdx = headers.indexOf('merged_range');
    const nilaiIdx = headers.indexOf('nilai_asal');

    const tableToRoomMap = new Map<string, string>();
    for (let i = 1; i <= 28; i++) {
      const code = `BK${i < 10 ? '0' + i : i}`;
      tableToRoomMap.set(`Table ${i}`, code);
      tableToRoomMap.set(`Table${i}`, code);
    }
    tableToRoomMap.set('Table 29', 'MAKMAL_ALFA');
    tableToRoomMap.set('Table 30', 'MAKMAL_BETA');
    tableToRoomMap.set('Table 31', 'MAKMAL_SIGMA');
    tableToRoomMap.set('Table 32', 'MAKMAL_GAMMA');
    tableToRoomMap.set('Table 33', 'MAKMAL_DELTA');
    tableToRoomMap.set('Table 34', 'DKA');
    tableToRoomMap.set('Table 35', 'DKB');
    tableToRoomMap.set('Table 36', 'ARAS_1_PERPUSTAKAAN');
    tableToRoomMap.set('Table 37', 'BILIK_KOTA_TINGGI');
    tableToRoomMap.set('Table 38', 'DEWAN_SEMINAR');
    tableToRoomMap.set('Table 39', 'MINI_SEMINAR');
    tableToRoomMap.set('Table 40', 'SURAU_1');
    tableToRoomMap.set('Table 41', 'SURAU_2');

    let slotCounter = 1;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const tableId = cols[tableIdIdx] || '';
      const rawHari = cols[hariIdx] || '';
      const rawMasa = cols[masaIdx] || '';
      const mergedRange = cols[mergedIdx] || '';
      const nilaiAsal = cols[nilaiIdx] || '';

      if (!tableId || !rawHari || !nilaiAsal) continue;

      const dayOfWeek = mapToDayOfWeek(rawHari);
      if (!dayOfWeek) continue;

      const upperNilai = nilaiAsal.toUpperCase();
      if (
        upperNilai.includes('ASSEMBLY') || 
        upperNilai.includes('LUNCH') ||
        upperNilai.includes('KOLEJ PROFESIONAL MARA')
      ) {
        continue;
      }

      const roomId = tableToRoomMap.get(tableId) || resolveRoomId(tableId, tableId, existingRooms);
      const targetRoom = existingRooms.find(r => r.id.toUpperCase() === roomId.toUpperCase() || r.code.toUpperCase() === roomId.toUpperCase());
      const finalRoomId = targetRoom ? targetRoom.id : roomId;

      let startTime = '08:30';
      let endTime = '09:30';

      if (rawMasa.includes('-')) {
        const timeParts = rawMasa.split('-').map(t => t.trim());
        startTime = formatTimeStr(timeParts[0]);
        endTime = formatTimeStr(timeParts[1]);
      } else if (rawMasa) {
        startTime = formatTimeStr(rawMasa);
        if (mergedRange && mergedRange.includes(':')) {
          const rangeParts = mergedRange.split(':');
          const startCol = rangeParts[0].charAt(0);
          const endCol = rangeParts[1].charAt(0);
          const colSpan = Math.max(1, endCol.charCodeAt(0) - startCol.charCodeAt(0) + 1);
          const [sH, sM] = startTime.split(':').map(Number);
          const durationHours = Math.max(1, Math.min(3, Math.floor(colSpan / 2)));
          const eH = sH + durationHours;
          endTime = `${String(eH).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}`;
        } else {
          const [sH, sM] = startTime.split(':').map(Number);
          endTime = `${String(sH + 1).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}`;
        }
      }

      const parsedDetails = parseCellAcademicDetails(nilaiAsal);
      const cleanRoom = finalRoomId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanStart = startTime.replace(/[^a-zA-Z0-9]/g, '');
      const cleanEnd = endTime.replace(/[^a-zA-Z0-9]/g, '');

      validSlots.push({
        id: `SCH-${cleanRoom}-${dayOfWeek}-${cleanStart}-${cleanEnd}`,
        roomId: finalRoomId,
        dayOfWeek,
        startTime,
        endTime,
        courseCode: parsedDetails.courseCode,
        courseName: parsedDetails.courseName,
        className: parsedDetails.className,
        lecturerName: parsedDetails.lecturerName,
        department: 'Jabatan Akademik KPMBP'
      });

      affectedRoomIds.add(finalRoomId);
    }
  } else {
    // Format 3: Standard list (roomId, dayOfWeek, startTime, endTime, courseCode, className, lecturerName)
    const findIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
    const roomIdx = findIndex(['room', 'bilik', 'dewan', 'petempatan']);
    const dayIdx = findIndex(['day', 'hari']);
    const startIdx = findIndex(['start', 'mula']);
    const endIdx = findIndex(['end', 'tamat']);
    const courseIdx = findIndex(['course', 'kursus', 'kod']);
    const classIdx = findIndex(['class', 'kelas']);
    const lecturerIdx = findIndex(['lecturer', 'pensyarah', 'nama']);

    let slotCounter = 1;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const rawRoom = roomIdx !== -1 ? cols[roomIdx] : cols[0];
      const rawDay = dayIdx !== -1 ? cols[dayIdx] : cols[1];
      const rawStart = startIdx !== -1 ? cols[startIdx] : cols[2];
      const rawEnd = endIdx !== -1 ? cols[endIdx] : cols[3];
      const courseCode = courseIdx !== -1 ? cols[courseIdx] : cols[4] || 'AKADEMIK';
      const className = classIdx !== -1 ? cols[classIdx] : cols[5] || '';
      const lecturerName = lecturerIdx !== -1 ? cols[lecturerIdx] : cols[6] || 'Pensyarah KPMBP';

      if (!rawRoom || !rawDay || !rawStart) continue;

      const dayOfWeek = mapToDayOfWeek(rawDay);
      if (!dayOfWeek) {
        errors.push(`Baris ${i + 1}: Hari "${rawDay}" tidak sah.`);
        continue;
      }

      const startTime = formatTimeStr(rawStart);
      const endTime = rawEnd ? formatTimeStr(rawEnd) : `${String(parseInt(startTime.split(':')[0], 10) + 1).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
      const roomId = resolveRoomId(rawRoom, '', existingRooms);
      const cleanRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanStart = startTime.replace(/[^a-zA-Z0-9]/g, '');
      const cleanEnd = endTime.replace(/[^a-zA-Z0-9]/g, '');

      validSlots.push({
        id: `SCH-${cleanRoom}-${dayOfWeek}-${cleanStart}-${cleanEnd}`,
        roomId,
        dayOfWeek,
        startTime,
        endTime,
        courseCode,
        courseName: courseCode,
        className,
        lecturerName,
        department: 'Jabatan Akademik KPMBP'
      });

      affectedRoomIds.add(roomId);
    }
  }

  return {
    slots: validSlots,
    errors,
    summary: {
      totalRowsProcessed: lines.length - 1,
      validSlotsCount: validSlots.length,
      roomsAffected: Array.from(affectedRoomIds)
    }
  };
}

// Export Academic Schedule to Standard Grid CSV (Perkara, Hari, 8:30-9:30, ...)
// Aligned strictly with KPMBP Official Admin Timetable & Locked Slot Matrix format
export function exportTimetableToStandardGridCSV(
  schedule: AcademicScheduleSlot[],
  rooms: Room[],
  options?: {
    includeNightSlots?: boolean;
    onlyRoomsWithSlots?: boolean;
    targetRoomIds?: string[];
  }
): string {
  const includeNightSlots = options?.includeNightSlots ?? false;
  const onlyRoomsWithSlots = options?.onlyRoomsWithSlots ?? false;
  const targetRoomIds = options?.targetRoomIds;

  const headers = [
    'Perkara',
    'Hari',
    '"1\n8:30 - 9:30"',
    '"2\n9:30 - 10:30"',
    '"3\n10:30 - 11:30"',
    '"4\n11:30 - 12:30"',
    '"5\n12:30 - 13:30"',
    '"LUNCH\n13:30 - 14:30"',
    '"6\n14:30 - 15:30"',
    '"7\n15:30 - 16:30"',
    '"8\n16:30 - 17:30"'
  ];

  if (includeNightSlots) {
    headers.push('"MALAM 1\n20:00 - 21:00"');
    headers.push('"MALAM 2\n21:00 - 22:00"');
    headers.push('"MALAM 3\n22:00 - 23:00"');
  }

  const slotTimes = [
    { start: '08:30', end: '09:30' },
    { start: '09:30', end: '10:30' },
    { start: '10:30', end: '11:30' },
    { start: '11:30', end: '12:30' },
    { start: '12:30', end: '13:30' },
    { start: '13:30', end: '14:30' },
    { start: '14:30', end: '15:30' },
    { start: '15:30', end: '16:30' },
    { start: '16:30', end: '17:30' }
  ];

  if (includeNightSlots) {
    slotTimes.push({ start: '20:00', end: '21:00' });
    slotTimes.push({ start: '21:00', end: '22:00' });
    slotTimes.push({ start: '22:00', end: '23:00' });
  }

  const days: { malay: DayOfWeek; code: string }[] = [
    { malay: 'Isnin', code: 'MON' },
    { malay: 'Selasa', code: 'TUE' },
    { malay: 'Rabu', code: 'WED' },
    { malay: 'Khamis', code: 'THU' },
    { malay: 'Jumaat', code: 'FRI' }
  ];

  // Filter rooms
  let selectedRooms = rooms;
  if (targetRoomIds && targetRoomIds.length > 0) {
    selectedRooms = rooms.filter(r => targetRoomIds.includes(r.id) || targetRoomIds.includes(r.code));
  } else if (onlyRoomsWithSlots) {
    selectedRooms = rooms.filter(r => schedule.some(s => s.roomId === r.id || s.roomId === r.code));
  }

  const rows: string[] = [headers.join(',')];

  for (const room of selectedRooms) {
    for (const day of days) {
      const cellValues: string[] = [room.code, day.code];

      for (const slot of slotTimes) {
        const matched = schedule.find(s => 
          (s.roomId === room.id || s.roomId === room.code) &&
          s.dayOfWeek === day.malay &&
          s.startTime === slot.start
        );

        if (matched) {
          let val = '';
          if (matched.lecturerName && matched.lecturerName !== 'Pensyarah KPMBP') {
            val = matched.lecturerName;
          } else if (matched.courseCode && matched.courseCode !== 'AKADEMIK' && matched.courseCode !== 'LOCKED' && matched.courseCode !== 'TERKUNCI') {
            val = `${matched.courseCode} ${matched.className || ''}`.trim();
          } else {
            val = matched.courseName || 'LOCKED';
          }

          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          cellValues.push(val);
        } else {
          cellValues.push('');
        }
      }

      rows.push(cellValues.join(','));
    }
  }

  return rows.join('\r\n');
}


