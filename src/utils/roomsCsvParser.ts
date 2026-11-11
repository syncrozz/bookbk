import { Room, RoomCategory } from '../types';
import { formatLevel } from './storage';
import { ensureBookbkPrefix } from './downloadHelper';

export const ROOMS_CSV_HEADERS = [
  'id',
  'code',
  'name',
  'category',
  'capacity',
  'block',
  'level',
  'facilities',
  'hasAircond',
  'isSmartClassroom',
  'notes'
];

export const SAMPLE_ROOMS_CSV_TEMPLATE = `id,code,name,category,capacity,block,level,facilities,hasAircond,isSmartClassroom,notes
DEWAN_BESAR,DEWAN BESAR,Dewan Besar (Dewan Utama),Ruang Khas,500,Bangunan Pentadbiran & Dewan Utama,Ground Floor,Pentas Utama & Tirai Bermotor; Sistem PA Audio Profesional; Dual Skrin Projektor LED; Pendingin Hawa Pusat; Kapasiti 500 Kerusi,true,false,Dewan Utama serbaguna untuk majlis rasmi seminar kebangsaan dan program petang & malam (4pm-11pm)
MAKMAL_GAMMA,LAB GAMMA,LAB GAMMA,Makmal Komputer,35,Pusat Komputer & IT,1st Floor,35x PC Komputer; Projektor HD; Pendingin Hawa Pusat; Rangkaian Gigabit LAN; Papan Putih,true,false,Makmal komputer untuk pembangunan perisian dan reka bentuk
MAKMAL_ALFA,LAB ALFA,LAB ALFA,Makmal Komputer,35,Pusat Komputer & IT,1st Floor,35x PC Komputer Berprestasi Tinggi; Projektor HD & Skrin Bermotor; Pendingin Hawa Pusat; Rangkaian Gigabit LAN,true,false,Makmal komputer utama untuk praktikal pengaturcaraan
MAKMAL_SIGMA,LAB SIGMA,LAB SIGMA,Makmal Komputer,35,Pusat Komputer & IT,Ground Floor,35x PC Komputer; Projektor HD; Pendingin Hawa Pusat; Rangkaian Gigabit LAN; Papan Putih,true,false,Makmal komputer multimedia dan sistem maklumat perniagaan
MAKMAL_BETA,LAB BETA,LAB BETA,Makmal Komputer,35,Pusat Komputer & IT,Ground Floor,35x PC Komputer; Projektor HD; Pendingin Hawa Pusat; Rangkaian Gigabit LAN; Papan Putih,true,false,Makmal komputer untuk kelas pengkomputeran dan latihan staf
BK01,S. CLASSROOM,Smart Classroom,Bilik Kuliah,35,Bangunan Akademik Utama,Ground Floor,Papan Pintar (Smartboard); Projektor HD; Pendingin Hawa; Sistem Audio Hibrid,true,true,Bilik kuliah pintar dengan fasiliti hibrid dan skrin interaktif
BILIK_INKUBATOR,BLK. INKUBATOR,Bilik Inkubator,Ruang Khas,25,Bangunan Pentadbiran & Inovasi,Ground Floor,Meja Perbincangan Kumpulan; Pendingin Hawa; Papan Putih Kaca; Wi-Fi Kelajuan Tinggi; Palam Kuasa,true,false,Pusat inkubator keusahawanan dan inovasi pelajar/staf
DKA,DKA,DKA,Ruang Khas,120,Bangunan Akademik Utama,2nd Floor,Dual Projektor HD; Kerusi Bertingkat (Auditorium); Sistem Audio Dewan; Pendingin Hawa Pusat; Papan Pintar,true,false,Sesuai untuk kuliah gabungan kelas besar dan taklimat program
BK02,BK02,Bilik Kuliah 02,Bilik Kuliah,35,Bangunan Akademik Utama,1st Floor,Projektor HD; Pendingin Hawa; Papan Putih,true,false,Bilik kuliah standard`;

/**
 * Split CSV text into rows, handling multiline quoted cells.
 */
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
        i++; // skip \n
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

/**
 * Split a single CSV row into columns respecting quotes.
 */
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

/**
 * Export rooms list to standard CSV file and trigger download.
 */
export function exportRoomsToCSV(rooms: Room[]): { success: boolean; filename: string; count: number } {
  if (!rooms || rooms.length === 0) {
    return { success: false, filename: '', count: 0 };
  }

  const header = 'id,code,name,category,capacity,block,level,facilities,hasAircond,isSmartClassroom,notes';

  const rows = rooms.map(r => {
    const facilitiesStr = (r.facilities || []).join('; ');
    return [
      `"${r.id}"`,
      `"${(r.code || '').replace(/"/g, '""')}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.category || 'Bilik Kuliah'}"`,
      r.capacity || 30,
      `"${(r.block || '').replace(/"/g, '""')}"`,
      `"${formatLevel(r.level)}"`,
      `"${facilitiesStr.replace(/"/g, '""')}"`,
      r.hasAircond ? 'true' : 'false',
      r.isSmartClassroom ? 'true' : 'false',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = ensureBookbkPrefix(`kpmbp_direktori_ruang_${dateStr}.csv`);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename, count: rooms.length };
}

/**
 * Download sample rooms CSV template.
 */
export function downloadRoomsCSVTemplate(): void {
  const blob = new Blob(['\uFEFF' + SAMPLE_ROOMS_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', ensureBookbkPrefix('kpmbp_direktori_ruang_template.csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParseRoomsResult {
  rooms: Room[];
  summary: {
    total: number;
    updated: number;
    added: number;
    roomsAffected: string[];
  };
  errors: string[];
}

/**
 * Parse an uploaded CSV text containing room details.
 */
export function parseRoomsCSV(csvText: string, currentRooms: Room[] = []): ParseRoomsResult {
  const errors: string[] = [];
  const rows = splitCSVRows(csvText);

  if (rows.length < 2) {
    return {
      rooms: [],
      summary: { total: 0, updated: 0, added: 0, roomsAffected: [] },
      errors: ['Fail CSV kosong atau tiada baris data selepas tajuk (header).']
    };
  }

  // Parse header
  const headerCols = parseCSVRow(rows[0]).map(h => h.toLowerCase().trim().replace(/^"/, '').replace(/"$/, ''));

  // Find column indices
  const getColIndex = (names: string[]): number => {
    for (let i = 0; i < headerCols.length; i++) {
      const col = headerCols[i];
      if (names.some(n => col === n || col.includes(n))) {
        return i;
      }
    }
    return -1;
  };

  const idIdx = getColIndex(['id', 'kod_id', 'id_ruang', 'ruang_id']);
  const codeIdx = getColIndex(['code', 'kod', 'kod_ruang', 'ruang']);
  const nameIdx = getColIndex(['name', 'nama', 'nama_ruang', 'bilik']);
  const catIdx = getColIndex(['category', 'kategori', 'jenis']);
  const capIdx = getColIndex(['capacity', 'kapasiti', 'pax', 'muatan']);
  const blockIdx = getColIndex(['block', 'blok', 'bangunan']);
  const levelIdx = getColIndex(['level', 'aras', 'tingkat', 'floor']);
  const facIdx = getColIndex(['facilities', 'kemudahan', 'fasiliti']);
  const aircondIdx = getColIndex(['aircond', 'hasaircond', 'pendingin_hawa']);
  const smartIdx = getColIndex(['smart', 'issmartclassroom', 'pintar']);
  const notesIdx = getColIndex(['notes', 'catatan', 'keterangan']);

  if (idIdx === -1 && codeIdx === -1) {
    return {
      rooms: [],
      summary: { total: 0, updated: 0, added: 0, roomsAffected: [] },
      errors: ['Kolum ID atau Kod Ruang tidak dijumpai dalam baris tajuk CSV.']
    };
  }

  const parsedRooms: Room[] = [];
  const roomsAffected: string[] = [];
  let updatedCount = 0;
  let addedCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const rawCols = parseCSVRow(rows[r]);
    if (rawCols.length === 0 || rawCols.every(c => !c.trim())) continue;

    const rawId = (idIdx !== -1 ? rawCols[idIdx] : '')?.trim() || '';
    const rawCode = (codeIdx !== -1 ? rawCols[codeIdx] : '')?.trim() || '';
    const rawName = (nameIdx !== -1 ? rawCols[nameIdx] : '')?.trim() || '';

    // ID fallback
    const id = rawId || rawCode.toUpperCase().replace(/\s+/g, '_');
    const code = rawCode || rawId || 'RUANG';
    const name = rawName || code;

    if (!id) {
      errors.push(`Baris ${r + 1}: Tiada ID atau Kod Ruang yang sah.`);
      continue;
    }

    // Check if updating existing with flexible matching
    const norm = (s: string) => s.toLowerCase().replace(/^(lab|makmal|bilik|blk\.)\s*/, '').trim();
    const existingIndex = currentRooms.findIndex(
      rm => rm.id.toLowerCase() === id.toLowerCase() ||
            rm.code.toLowerCase() === code.toLowerCase() ||
            rm.name.toLowerCase() === name.toLowerCase() ||
            (norm(rm.code) && norm(rm.code) === norm(code)) ||
            (norm(rm.name) && norm(rm.name) === norm(name))
    );

    const existingRoom = existingIndex !== -1 ? currentRooms[existingIndex] : null;

    // Use existing values as fallback if cell is blank in CSV
    const finalId = existingRoom ? existingRoom.id : id;
    const finalCode = rawCode ? rawCode : (existingRoom ? existingRoom.code : code);
    const finalName = rawName ? rawName : (existingRoom ? existingRoom.name : name);

    // Category normalization (Dewan Kuliah diselaraskan di bawah Ruang Khas)
    let category: RoomCategory = existingRoom ? existingRoom.category : 'Bilik Kuliah';
    if (catIdx !== -1 && rawCols[catIdx]?.trim()) {
      const catStr = rawCols[catIdx].toLowerCase().trim();
      if (catStr.includes('dewan') || catStr.includes('khas') || catStr.includes('special')) category = 'Ruang Khas';
      else if (catStr.includes('makmal') || catStr.includes('lab')) category = 'Makmal Komputer';
      else if (catStr.includes('surau')) category = 'Surau';
      else category = 'Bilik Kuliah';
    }

    // Capacity
    let capacity = existingRoom ? existingRoom.capacity : 35;
    if (capIdx !== -1 && rawCols[capIdx]?.trim()) {
      const capStr = rawCols[capIdx].replace(/\D/g, '');
      if (capStr) capacity = parseInt(capStr, 10);
    }

    // Block & Level
    const block = (blockIdx !== -1 && rawCols[blockIdx]?.trim())
      ? rawCols[blockIdx].trim()
      : (existingRoom ? existingRoom.block : 'Bangunan Akademik Utama');

    const level = (levelIdx !== -1 && rawCols[levelIdx]?.trim())
      ? formatLevel(rawCols[levelIdx].trim())
      : (existingRoom ? existingRoom.level : 'Ground Floor');

    // Facilities
    let facilities = existingRoom ? existingRoom.facilities : ['Pendingin Hawa', 'Projektor HD'];
    if (facIdx !== -1 && rawCols[facIdx]?.trim()) {
      facilities = rawCols[facIdx].split(/[;,]/).map(f => f.trim()).filter(Boolean);
    }

    // Booleans
    let hasAircond = existingRoom ? existingRoom.hasAircond : true;
    if (aircondIdx !== -1 && rawCols[aircondIdx]?.trim()) {
      const aircondStr = rawCols[aircondIdx].toLowerCase().trim();
      hasAircond = aircondStr === 'true' || aircondStr === 'ya' || aircondStr === '1' || aircondStr === 'yes' || facilities.some(f => f.toLowerCase().includes('pendingin hawa') || f.toLowerCase().includes('aircond'));
    }

    let isSmartClassroom = existingRoom ? existingRoom.isSmartClassroom : false;
    if (smartIdx !== -1 && rawCols[smartIdx]?.trim()) {
      const smartStr = rawCols[smartIdx].toLowerCase().trim();
      isSmartClassroom = smartStr === 'true' || smartStr === 'ya' || smartStr === '1' || smartStr === 'yes' || finalCode.toUpperCase().includes('SMART') || finalName.toUpperCase().includes('SMART');
    }

    const notes = (notesIdx !== -1 && rawCols[notesIdx]?.trim())
      ? rawCols[notesIdx].trim()
      : (existingRoom ? existingRoom.notes : undefined);

    const roomObj: Room = {
      id: finalId,
      code: finalCode,
      name: finalName,
      category,
      capacity,
      block,
      level,
      facilities,
      hasAircond,
      isSmartClassroom,
      allowNightBooking: existingRoom ? existingRoom.allowNightBooking : true,
      notes
    };

    if (existingRoom) {
      updatedCount++;
    } else {
      addedCount++;
    }

    parsedRooms.push(roomObj);
    roomsAffected.push(finalCode);
  }

  return {
    rooms: parsedRooms,
    summary: {
      total: parsedRooms.length,
      updated: updatedCount,
      added: addedCount,
      roomsAffected
    },
    errors
  };
}
