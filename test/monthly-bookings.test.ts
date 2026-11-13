import assert from 'node:assert/strict';
import { AdHocBooking } from '../src/types';
import {
  getMalaysiaDateParts,
  getCalendarMonthBounds,
  isDateInCalendarMonth,
  getBookingsForMonth,
  getConfirmedBookingsForMonth,
  countConfirmedBookingsForMonth,
  getEffectiveBookingLookbackCutoff,
} from '../src/utils/monthlyBookings';

function makeBooking(overrides: Partial<AdHocBooking> & { id: string; date: string }): AdHocBooking {
  return {
    roomId: 'BK01',
    roomName: 'BK01',
    startTime: '09:00',
    endTime: '11:00',
    applicantName: 'Pensyarah Uji',
    applicantEmail: 'uji@mara.gov.my',
    applicantRole: 'Pensyarah',
    department: 'Jabatan Perdagangan',
    purposeCategory: 'Kelas',
    title: 'Kuliah Gantian',
    paxCount: 25,
    status: 'CONFIRMED',
    createdAt: `${overrides.date}T01:00:00.000Z`,
    ...overrides,
  };
}

function runMonthlyBookingTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: Monthly Booking KPI Counter (Asia/Kuala_Lumpur)');
  console.log('========================================================================\n');

  const sampleBookings: AdHocBooking[] = [
    makeBooking({ id: 'OCT-31', date: '2026-10-31', status: 'CONFIRMED' }),
    makeBooking({ id: 'NOV-01', date: '2026-11-01', status: 'CONFIRMED' }),
    makeBooking({ id: 'NOV-13', date: '2026-11-13', status: 'CONFIRMED' }),
    makeBooking({ id: 'NOV-30', date: '2026-11-30', status: 'CONFIRMED' }),
    makeBooking({ id: 'NOV-CANCELLED', date: '2026-11-15', status: 'CANCELLED' }),
    makeBooking({ id: 'NOV-REJECTED', date: '2026-11-16', status: 'REJECTED' }),
    makeBooking({ id: 'NOV-PENDING', date: '2026-11-17', status: 'PENDING' }),
  ];

  // 1. Multiple confirmed bookings in November accumulate correctly
  const novRef = new Date('2026-11-13T04:00:00.000Z'); // 12:00 MYT on 2026-11-13
  const novBounds = getCalendarMonthBounds(novRef);
  assert.equal(novBounds.startDate, '2026-11-01');
  assert.equal(novBounds.endDateExclusive, '2026-12-01');
  assert.equal(novBounds.monthYearLabel, 'November 2026');
  assert.equal(countConfirmedBookingsForMonth(sampleBookings, novRef), 3, 'Only 3 confirmed November bookings counted');
  console.log('✔ Test 1 PASSED: Multiple confirmed bookings in November accumulate correctly (Oct 31 excluded).');

  // 2. Cancelled, Rejected, and Pending bookings are excluded; status updates reflect immediately
  const withStatusChanged = sampleBookings.map((b) =>
    b.id === 'NOV-PENDING' ? { ...b, status: 'CONFIRMED' as const } : b
  );
  assert.equal(countConfirmedBookingsForMonth(withStatusChanged, novRef), 4, 'Confirming a PENDING booking increments counter');
  const withCancelled = withStatusChanged.map((b) =>
    b.id === 'NOV-13' ? { ...b, status: 'CANCELLED' as const } : b
  );
  assert.equal(countConfirmedBookingsForMonth(withCancelled, novRef), 3, 'Cancelling a CONFIRMED booking decrements counter');
  console.log('✔ Test 2 PASSED: Cancelled/Rejected/Pending bookings excluded and live status changes reflected.');

  // 3. On 1 December (MYT), December counter starts at zero if no December bookings exist
  // 2026-11-30T15:59:59Z = 2026-11-30 23:59:59 MYT (still November)
  const beforeMidnightMyt = new Date('2026-11-30T15:59:59.000Z');
  assert.equal(getMalaysiaDateParts(beforeMidnightMyt).dateStr, '2026-11-30');
  assert.equal(countConfirmedBookingsForMonth(sampleBookings, beforeMidnightMyt), 3);

  // 2026-11-30T16:00:00Z = 2026-12-01 00:00:00 MYT (1 December!)
  const decMidnightMyt = new Date('2026-11-30T16:00:00.000Z');
  const decBounds = getCalendarMonthBounds(decMidnightMyt);
  assert.equal(getMalaysiaDateParts(decMidnightMyt).dateStr, '2026-12-01');
  assert.equal(decBounds.startDate, '2026-12-01');
  assert.equal(decBounds.endDateExclusive, '2027-01-01');
  assert.equal(decBounds.monthYearLabel, 'Disember 2026');
  assert.equal(countConfirmedBookingsForMonth(sampleBookings, decMidnightMyt), 0, 'December counter starts at 0 when no Dec bookings exist');
  console.log('✔ Test 3 PASSED: On 1 December 00:00 MYT, December counter resets to 0 automatically.');

  // 4 & 5. December bookings increment December counter; year boundary respected
  const withDecBookings: AdHocBooking[] = [
    ...sampleBookings,
    makeBooking({ id: 'DEC-01', date: '2026-12-01', status: 'CONFIRMED' }),
    makeBooking({ id: 'DEC-31', date: '2026-12-31', status: 'CONFIRMED' }),
    makeBooking({ id: 'JAN-01', date: '2027-01-01', status: 'CONFIRMED' }),
    makeBooking({ id: 'DEC-CAN', date: '2026-12-15', status: 'CANCELLED' }),
  ];
  assert.equal(countConfirmedBookingsForMonth(withDecBookings, decMidnightMyt), 2, 'Only Dec 1 and Dec 31 confirmed bookings counted for Dec 2026');
  assert.equal(isDateInCalendarMonth('2026-12-01', decBounds), true);
  assert.equal(isDateInCalendarMonth('2027-01-01', decBounds), false, 'End boundary (first day of next month) is exclusive');
  console.log('✔ Test 4 PASSED: December bookings increment December counter and exclude Jan 1.');

  // 6. Historical records remain intact and queryable
  assert.equal(sampleBookings.filter((b) => b.date.startsWith('2026-10')).length, 1);
  assert.equal(getConfirmedBookingsForMonth(withDecBookings, '2026-10-15').length, 1, 'October historical records remain intact and accessible');
  assert.equal(getConfirmedBookingsForMonth(withDecBookings, '2026-11-15').length, 3, 'November historical records remain intact and accessible');
  console.log('✔ Test 5 PASSED: Historical records remain completely intact and accessible.');

  // 7. Firestore cutoff aligns strictly to the 1st of the current MYT calendar month
  const cutoffNov13 = getEffectiveBookingLookbackCutoff(30, novRef);
  assert.equal(cutoffNov13, '2026-11-01', 'Nov 13 cutoff aligns to 2026-11-01 (excluding Oct records from live count)');
  const dec31Myt = new Date('2026-12-31T08:00:00.000Z'); // 2026-12-31 16:00 MYT
  const cutoffDec31 = getEffectiveBookingLookbackCutoff(30, dec31Myt);
  assert.equal(cutoffDec31, '2026-12-01', `Cutoff ${cutoffDec31} must align to 2026-12-01`);
  assert.equal(getBookingsForMonth(withDecBookings, novRef).length, 6, 'getBookingsForMonth returns all statuses within November');
  console.log('✔ Test 6 PASSED: Effective Firestore cutoff aligns to 1st of current MYT calendar month.\n');

  console.log('========================================================================');
  console.log('ALL MONTHLY BOOKING COUNTER TESTS PASSED!');
  console.log('========================================================================');
}

runMonthlyBookingTests();
