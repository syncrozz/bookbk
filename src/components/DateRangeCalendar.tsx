import React, { useState, useMemo } from 'react';
import { AcademicExemption, InstitutionalBlock } from '../types';
import {
  parseDateParts,
  formatDateParts,
  addDays,
  getIsoDayOfWeek,
  getMalayDayName,
  getTodayMalaysia,
  MALAY_MONTHS_FULL,
  MALAY_DAYS_SHORT
} from '../utils/exemptionDates';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';

export interface DateRangeCalendarProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  existingExemptions?: AcademicExemption[];
  blocks?: InstitutionalBlock[];
  minDate?: string;
}

export const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  startDate,
  endDate,
  onChange,
  existingExemptions = [],
  blocks = [],
  minDate,
}) => {
  const todayStr = useMemo(() => getTodayMalaysia(), []);

  // Paparan bulan semasa (default kepada bulan startDate jika ada, jika tidak bulan semasa)
  const [viewYearMonth, setViewYearMonth] = useState<{ year: number; month: number }>(() => {
    const ref = startDate || todayStr;
    const { year, month } = parseDateParts(ref);
    return { year, month };
  });

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Navigasi Bulan
  const handlePrevMonth = () => {
    setViewYearMonth(prev => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setViewYearMonth(prev => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleGoToday = () => {
    const { year, month } = parseDateParts(todayStr);
    setViewYearMonth({ year, month });
  };

  // Logik pemilihan tarikh julat:
  // 1. Jika tiada startDate atau kedua-dua startDate & endDate sudah ada -> set startDate baharu, kosongkan endDate
  // 2. Jika ada startDate dan tiada endDate:
  //    - Jika klik tarikh >= startDate -> set endDate
  //    - Jika klik tarikh < startDate -> tukar ganti (tarikh baharu jadi startDate)
  const handleDateClick = (dateStr: string) => {
    if (minDate && dateStr < minDate) return;

    if (!startDate || (startDate && endDate)) {
      // Ketukan pertama atau ketukan ketiga (mulakan semula)
      onChange(dateStr, '');
    } else {
      // Ada startDate tapi tiada endDate (ketukan kedua)
      if (dateStr < startDate) {
        // Klik tarikh lebih awal: tukar ganti
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
    }
  };

  // Jana hari-hari untuk grid bulan (Isnin = 1 .. Ahad = 7)
  const calendarDays = useMemo(() => {
    const { year, month } = viewYearMonth;
    // Bilangan hari dalam bulan ini
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstDayStr = formatDateParts(year, month, 1);
    const firstDayIso = getIsoDayOfWeek(firstDayStr); // 1 = Isnin .. 7 = Ahad

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Hari dari bulan sebelumnya untuk padding
    const prevMonthDaysCount = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
    const leadingPadding = firstDayIso - 1; // 0 jika Isnin, 6 jika Ahad

    for (let i = leadingPadding - 1; i >= 0; i--) {
      const prevD = prevMonthDaysCount - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      days.push({
        dateStr: formatDateParts(prevY, prevM, prevD),
        dayNum: prevD,
        isCurrentMonth: false,
      });
    }

    // Hari dalam bulan semasa
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        dateStr: formatDateParts(year, month, d),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Padding hari bulan depan untuk melengkapkan baris (gandaan 7)
    const trailingPadding = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= trailingPadding; d++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      days.push({
        dateStr: formatDateParts(nextY, nextM, d),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYearMonth]);

  // Carian penanda pengecualian & peperiksaan
  const activeExemptionDatesMap = useMemo(() => {
    const map = new Map<string, string>(); // dateStr -> title
    existingExemptions
      .filter(ex => ex.active)
      .forEach(ex => {
        let cur = ex.startDate;
        let count = 0;
        while (cur <= ex.endDate && count < 60) {
          if (!map.has(cur)) {
            map.set(cur, ex.title);
          }
          cur = addDays(cur, 1);
          count++;
        }
      });
    return map;
  }, [existingExemptions]);

  const examBlockDatesSet = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach(b => {
      if (b.category === 'EXAM' || b.reason?.toLowerCase().includes('peperiksaan')) {
        set.add(b.date);
      }
    });
    return set;
  }, [blocks]);

  const currentMonthName = MALAY_MONTHS_FULL[viewYearMonth.month - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs select-none max-w-full">
      {/* 1. Header Kalendar */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-amber-600" />
          <h4 className="text-sm font-bold text-slate-800">
            {currentMonthName} {viewYearMonth.year}
          </h4>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGoToday}
            className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Kembali ke Bulan Semasa"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span className="hidden xs:inline">Hari Ini</span>
          </button>

          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Bulan Sebelum"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Bulan Seterusnya"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Nama Hari (Isn, Sel, Rab, Kha, Jum, Sab, Aha) */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-extrabold text-slate-500">
        {MALAY_DAYS_SHORT.map((dayName, idx) => {
          const isWeekend = idx >= 5; // Sab & Aha
          return (
            <div
              key={dayName}
              className={`py-1 rounded-sm uppercase tracking-wider ${
                isWeekend ? 'bg-slate-50 text-slate-400 font-semibold' : 'text-slate-600'
              }`}
            >
              {dayName}
            </div>
          );
        })}
      </div>

      {/* 3. Grid Hari (40x40px min, muat 360px tanpa skrol mendatar) */}
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Kalendar ${currentMonthName} ${viewYearMonth.year}`}>
        {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
          const isoDay = getIsoDayOfWeek(dateStr);
          const isWeekend = isoDay >= 6;
          const isToday = dateStr === todayStr;
          const isPast = minDate ? dateStr < minDate : false;

          // Status pemilihan
          const isStart = dateStr === startDate;
          const isEnd = dateStr === endDate;
          const isSingle = isStart && (!endDate || startDate === endDate);

          const inRange = Boolean(
            startDate &&
            endDate &&
            dateStr > startDate &&
            dateStr < endDate
          );

          // Status hover preview
          const inHoverRange = Boolean(
            startDate &&
            !endDate &&
            hoveredDate &&
            hoveredDate > startDate &&
            dateStr > startDate &&
            dateStr <= hoveredDate
          );

          const hasExemption = activeExemptionDatesMap.has(dateStr);
          const exemptionTitle = activeExemptionDatesMap.get(dateStr);
          const hasExam = examBlockDatesSet.has(dateStr);

          // Label aksesibiliti
          const ariaLabel = `${getMalayDayName(dateStr)}, ${dayNum} ${MALAY_MONTHS_FULL[parseDateParts(dateStr).month - 1]} ${parseDateParts(dateStr).year}${
            isStart ? ' (Tarikh Mula)' : ''
          }${isEnd ? ' (Tarikh Tamat)' : ''}${hasExemption ? ` - Pengecualian: ${exemptionTitle}` : ''}${
            hasExam ? ' - Sekatan Peperiksaan' : ''
          }`;

          let bgClass = 'bg-white hover:bg-amber-50 text-slate-800';
          if (!isCurrentMonth) {
            bgClass = 'bg-slate-50/50 text-slate-400 opacity-50 hover:bg-slate-100';
          } else if (isWeekend && !inRange && !isStart && !isEnd) {
            bgClass = 'bg-slate-50 text-slate-600 hover:bg-amber-50';
          }

          if (isStart || isEnd) {
            bgClass = 'bg-amber-500 text-white font-extrabold shadow-sm';
          } else if (inRange) {
            bgClass = 'bg-amber-100 text-amber-900 font-bold';
          } else if (inHoverRange) {
            bgClass = 'bg-amber-50 border border-dashed border-amber-300 text-amber-900';
          }

          if (isPast) {
            bgClass = 'bg-slate-100 text-slate-300 cursor-not-allowed';
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => handleDateClick(dateStr)}
              onMouseEnter={() => setHoveredDate(dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
              aria-label={ariaLabel}
              tabIndex={isCurrentMonth ? 0 : -1}
              className={`relative min-h-[40px] h-10 w-full rounded-lg text-xs transition flex flex-col items-center justify-center cursor-pointer ${
                isStart && !isSingle ? 'rounded-r-none' : ''
              } ${isEnd && !isSingle ? 'rounded-l-none' : ''} ${
                inRange ? 'rounded-none' : ''
              } ${isToday && !isStart && !isEnd ? 'ring-2 ring-blue-500 font-bold' : ''} ${bgClass}`}
            >
              <span className="leading-none">{dayNum}</span>

              {/* Titik Penanda (Pengecualian / Peperiksaan) */}
              <div className="flex items-center justify-center gap-1 mt-0.5 h-1.5">
                {hasExemption && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isStart || isEnd ? 'bg-white' : 'bg-emerald-500'
                    }`}
                    title={`Pengecualian: ${exemptionTitle}`}
                  />
                )}
                {hasExam && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isStart || isEnd ? 'bg-rose-200' : 'bg-rose-500'
                    }`}
                    title="Sekatan Peperiksaan / Institusi"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Legenda Kalendar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[10.5px] text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Pengecualian sedia ada</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span>Blok peperiksaan</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-amber-700 font-semibold">
          <span className="w-3.5 h-2 rounded-sm bg-amber-400 inline-block" />
          <span>Julat dipilih</span>
        </div>
      </div>
    </div>
  );
};
