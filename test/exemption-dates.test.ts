import assert from 'node:assert/strict';
import {
  getNextMonday,
  getThisWeekRange,
  getNextWeekRange,
  getTwoWeeksFromNextWeekRange,
  addDays,
  snapToMonday,
  summarizeRange,
  buildAutoTitle,
  getIsoDayOfWeek,
  getMalayDayName
} from '../src/utils/exemptionDates';
import { sanitizeAcademicExemption, sanitizeForFirestore } from '../src/lib/firebase';

function runExemptionDateTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: Academic Exemption Date Helpers (BAHAGIAN 6)');
  console.log('========================================================================\n');

  // 1. today = 2026-11-10 (Selasa)
  const todayTuesday = '2026-11-10';
  assert.equal(getIsoDayOfWeek(todayTuesday), 2, '2026-11-10 is Tuesday (iso=2)');
  assert.equal(getMalayDayName(todayTuesday), 'Selasa', 'Day name is Selasa');

  const nextMonFromTue = getNextMonday(todayTuesday);
  assert.equal(nextMonFromTue, '2026-11-16', 'Next Monday from 2026-11-10 is 2026-11-16');

  const nextWeekRange = getNextWeekRange(todayTuesday);
  assert.deepEqual(nextWeekRange, { start: '2026-11-16', end: '2026-11-22' }, 'Next week range is 2026-11-16 to 2026-11-22');

  const twoWeeksNextRange = getTwoWeeksFromNextWeekRange(todayTuesday);
  assert.deepEqual(twoWeeksNextRange, { start: '2026-11-16', end: '2026-11-29' }, '2 weeks from next week is 2026-11-16 to 2026-11-29');

  const thisWeekRange = getThisWeekRange(todayTuesday);
  assert.deepEqual(thisWeekRange, { start: '2026-11-09', end: '2026-11-15' }, 'This week range is 2026-11-09 to 2026-11-15');
  console.log('✔ Test 1 PASSED: today = 2026-11-10 (Selasa) computations verified.');

  // 2. today = Isnin 2026-11-09 => getNextMonday = 2026-11-16 (bukan hari yang sama)
  const todayMonday = '2026-11-09';
  assert.equal(getNextMonday(todayMonday), '2026-11-16', 'Next Monday from Monday 2026-11-09 must be next week 2026-11-16');
  console.log('✔ Test 2 PASSED: today = Isnin 2026-11-09 -> getNextMonday = 2026-11-16 (not same day).');

  // 3. today = Ahad 2026-11-15 => getNextMonday = 2026-11-16
  const todaySunday = '2026-11-15';
  assert.equal(getNextMonday(todaySunday), '2026-11-16', 'Next Monday from Sunday 2026-11-15 must be tomorrow 2026-11-16');
  console.log('✔ Test 3 PASSED: today = Ahad 2026-11-15 -> getNextMonday = 2026-11-16.');

  // 4. addDays merentasi bulan dan tahun: 2026-12-28 + 6 = 2027-01-03
  const crossYearResult = addDays('2026-12-28', 6);
  assert.equal(crossYearResult, '2027-01-03', '2026-12-28 + 6 days across year boundary is 2027-01-03');
  console.log('✔ Test 4 PASSED: addDays across year boundary (2026-12-28 + 6 = 2027-01-03).');

  // 5. snapToMonday('2026-11-12') = '2026-11-09'; Isnin kekal Isnin
  assert.equal(snapToMonday('2026-11-12'), '2026-11-09', 'Wednesday 2026-11-12 snaps to Monday 2026-11-09');
  assert.equal(snapToMonday('2026-11-09'), '2026-11-09', 'Monday 2026-11-09 stays Monday 2026-11-09');
  console.log('✔ Test 5 PASSED: snapToMonday logic verified.');

  // 6. summarizeRange('2026-11-09','2026-11-22') => totalDays 14, weekdays 10, weekendDays 4
  const summary = summarizeRange('2026-11-09', '2026-11-22');
  assert.deepEqual(summary, { totalDays: 14, weekdays: 10, weekendDays: 4 }, '14 days range has 10 weekdays and 4 weekend days');
  console.log('✔ Test 6 PASSED: summarizeRange verified.');

  // 7. buildAutoTitle merentasi bulan: '2026-11-30' hingga '2026-12-06' => "Study Week 30 Nov - 6 Des 2026"
  const titleCrossMonth = buildAutoTitle('2026-11-30', '2026-12-06');
  assert.equal(titleCrossMonth, 'Study Week 30 Nov - 6 Des 2026', 'Auto title cross month matches required format');

  const titleSameMonth = buildAutoTitle('2026-11-09', '2026-11-22');
  assert.equal(titleSameMonth, 'Study Week 9-22 Nov 2026', 'Auto title same month matches required format');
  console.log('✔ Test 7 PASSED: buildAutoTitle formatting verified.');

  // 8. Sanitize AcademicExemption for Firestore (must NEVER contain undefined fields)
  const dirtyExemption: any = {
    id: 'EX-20261116-0001',
    title: 'Study Week 16-29 Nov 2026',
    startDate: '2026-11-16',
    endDate: '2026-11-29',
    scope: 'BILIK_KULIAH',
    roomIds: undefined, // Must be stripped
    reason: undefined,  // Must be stripped
    active: true,
    createdBy: 'Admin KPMBP',
    createdAt: '2026-11-10T16:00:00.000Z'
  };

  const cleanEx = sanitizeAcademicExemption(dirtyExemption);
  assert.equal('roomIds' in cleanEx, false, 'Cleaned exemption must NOT contain roomIds property');
  assert.equal('reason' in cleanEx, false, 'Cleaned exemption must NOT contain reason property');
  assert.equal(Object.values(cleanEx).includes(undefined), false, 'No undefined value allowed');

  const nestedPayload = {
    items: [dirtyExemption],
    metadata: { note: undefined, version: 1 }
  };
  const sanitizedDeep = sanitizeForFirestore(nestedPayload);
  assert.equal('note' in sanitizedDeep.metadata, false, 'sanitizeForFirestore strips nested undefined keys');
  assert.equal('roomIds' in sanitizedDeep.items[0], false, 'sanitizeForFirestore strips array object undefined keys');
  console.log('✔ Test 8 PASSED: sanitizeAcademicExemption & sanitizeForFirestore zero-undefined verified.\n');

  console.log('========================================================================');
  console.log('ALL 8 EXEMPTION DATE & FIRESTORE SANITIZATION TESTS PASSED!');
  console.log('========================================================================');
}

runExemptionDateTests();
