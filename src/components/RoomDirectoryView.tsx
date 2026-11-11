import React, { useState, useEffect } from 'react';
import { Room, RoomCategory, PurposeCategory } from '../types';
import { formatLevel, isTargetVenue } from '../utils/storage';
import { 
  Building, 
  Users, 
  Sparkles, 
  Search, 
  MapPin, 
  CheckCircle2, 
  Tv, 
  Wifi, 
  Volume2, 
  ArrowRight,
  Info,
  Moon
} from 'lucide-react';

interface RoomDirectoryViewProps {
  rooms: Room[];
  onOpenBookingModal: (room: Room, date: string, startTime: string, endTime: string, purpose: PurposeCategory) => void;
  onViewRoomMatrix?: (roomId: string) => void;
}

export const RoomDirectoryView: React.FC<RoomDirectoryViewProps> = ({
  rooms,
  onOpenBookingModal
}) => {
  const [categoryFilter, setCategoryFilter] = useState<RoomCategory | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoomModal, setSelectedRoomModal] = useState<Room | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedRoomModal) {
        setSelectedRoomModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRoomModal]);

  const filteredRooms = rooms.filter(r => {
    if (categoryFilter !== 'Semua') {
      if (categoryFilter === 'Ruang Khas') {
        if (r.category !== 'Ruang Khas' && r.category !== 'Dewan Kuliah') return false;
      } else if (r.category !== categoryFilter) {
        return false;
      }
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.block.toLowerCase().includes(q) ||
        r.facilities.some(f => f.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Directory Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
        <div className="border-b border-slate-100 pb-4">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 mb-1">
            <Building className="w-3.5 h-3.5" />
            Direktori KPMBP
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {rooms.length} Ruang Fasiliti
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Maklumat lengkap Bilik Kuliah, Smart Classroom, Makmal Komputer, Dewan Besar, Dewan Kuliah, Ruang Khas, dan Surau Kolej Profesional MARA Bandar Penawar.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="w-full sm:w-auto min-w-[280px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as RoomCategory | 'Semua')}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="Semua">Kategori: Semua ({rooms.length} Ruang)</option>
              <option value="Bilik Kuliah">🏫 Bilik Kuliah (BK01 – BK28, Smart Classroom)</option>
              <option value="Ruang Khas">🎓 Ruang Khas &amp; Dewan Kuliah (Dewan Besar, DKA, DKB, Bilik Seminar, dsb.)</option>
              <option value="Makmal Komputer">💻 Makmal Komputer (Alfa, Beta, Sigma, Gamma, Delta)</option>
              <option value="Surau">🕌 Surau (Surau 1 &amp; Surau 2)</option>
            </select>
          </div>

          <div className="relative flex-1 w-full shadow-2xs rounded-xl">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-indigo-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari bilik, kemudahan, blok (cth: BK04, Makmal, Aras 2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-indigo-200 hover:border-indigo-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-semibold outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition placeholder:text-slate-400 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Room Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRooms.map(room => (
          <div
            key={room.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-lg text-slate-900">{room.code}</span>
                  {room.hasAircond && isTargetVenue(room) && (
                    <span className="bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      💠 Aircond
                    </span>
                  )}
                  {room.allowNightBooking !== false ? (
                    <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1" title="Menyokong tempahan waktu malam sehingga 23:00">
                      <Moon className="w-2.5 h-2.5 text-indigo-500" /> Malam
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      Siang Sahaja
                    </span>
                  )}
                </div>

                <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                  {room.category}
                </span>
              </div>

              {/* Location */}
              <div>
                {room.name !== room.code && (
                  <h3 className="text-base font-bold text-slate-900 mb-1">{room.name}</h3>
                )}
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{room.block} • {formatLevel(room.level)}</span>
                </div>
              </div>

              {/* Facilities */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs text-slate-700">
                <div className="font-semibold text-slate-500 text-[11px]">Kemudahan Sedia Ada:</div>
                <div className="flex flex-wrap gap-1">
                  {room.facilities.map((fac, idx) => (
                    <span key={idx} className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                      ✓ {fac}
                    </span>
                  ))}
                </div>
              </div>

              {room.notes && (
                <p className="text-xs text-slate-500 italic line-clamp-2">
                  "{room.notes}"
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setSelectedRoomModal(room)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-2.5 px-3 rounded-xl transition"
              >
                Butiran Fasiliti
              </button>

              <button
                onClick={() => onOpenBookingModal(room, '2026-08-06', '11:30', '12:30', 'Kelas')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1"
              >
                <span>Tempah</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ROOM DETAILS POPUP MODAL */}
      {selectedRoomModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{selectedRoomModal.category}</span>
                <h3 className="text-2xl font-extrabold text-slate-900">
                  {selectedRoomModal.name === selectedRoomModal.code ? selectedRoomModal.name : `${selectedRoomModal.name} (${selectedRoomModal.code})`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRoomModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div>
                  <span className="text-slate-400 block font-medium">Lokasi Ruang:</span>
                  <strong className="text-slate-900">{selectedRoomModal.block} ({formatLevel(selectedRoomModal.level)}) • {selectedRoomModal.category}</strong>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Status Operasi Waktu Malam:</span>
                  {selectedRoomModal.allowNightBooking !== false ? (
                    <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                      <Moon className="w-3 h-3 text-indigo-600" />
                      Dibuka (20:00 – 23:00)
                    </span>
                  ) : (
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                      Tutup Waktu Malam (Siang Sahaja)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <strong className="text-slate-900 block font-semibold mb-1.5">Senarai Kemudahan Ruang:</strong>
                <div className="space-y-1.5 text-xs">
                  {selectedRoomModal.facilities.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-800 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRoomModal.notes && (
                <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 p-3 rounded-xl italic">
                  ℹ️ {selectedRoomModal.notes}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedRoomModal(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs transition"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const r = selectedRoomModal;
                  setSelectedRoomModal(null);
                  onOpenBookingModal(r, '2026-08-06', '11:30', '12:30', 'Kelas');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition shadow-md"
              >
                Tempah Ruang Ini Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
