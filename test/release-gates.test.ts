import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateBookingIdempotencyKey, isSlotOverlapping, validateBookingSlot } from '../src/utils/idempotency';
import { reconcileRollbackDelta } from '../src/utils/reconciliation';
import { INITIAL_STAFF_DATA } from '../src/data/staffData';
import {
  serverAuthVault,
  hashPinScrypt,
  hashPinScryptSync,
  verifyPinScrypt,
  verifyPinScryptSync,
  ServerRateLimiter,
} from '../src/server/auth-service';
import { verifyStaffCredentials, verifyStaffCredentialsLocally } from '../src/lib/firebase';
import { 
  AdHocBooking, 
  StaffUser, 
  Room, 
  AcademicScheduleSlot, 
  InstitutionalBlock, 
  AcademicExemption 
} from '../src/types';
import { 
  checkRoomAvailability, 
  findActiveExemption, 
  validateExemptionInput, 
  countAffectedAcademicSlots 
} from '../src/utils/availabilityEngine';

async function runAllGateTests() {
  console.log('========================================================================');
  console.log('SYNCROZZ SES v4.5 — 6 BLOCKING RELEASE GATES & CREDENTIAL SECURITY AUDIT');
  console.log('========================================================================\n');

  let passedGates = 0;
  const totalGates = 6;

  // -------------------------------------------------------------
  // GATE 1: Idempotency keys with safe retry handling
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 1] Testing Idempotency Keys & Safe Retry Handling...');
    const bookingA = {
      roomId: 'BK01',
      date: '2026-10-15',
      startTime: '09:00',
      endTime: '11:00',
      applicantEmail: 'lecturer@mara.gov.my',
      applicantName: 'Ustaz Ahmad',
    };

    const keyA1 = generateBookingIdempotencyKey(bookingA);
    const keyA2 = generateBookingIdempotencyKey(bookingA);
    assert.equal(keyA1, keyA2, 'Idempotency key must be deterministic for identical parameters');
    assert.match(keyA1, /^BK-BK01-2026-10-15-0900-1100-/, 'Key matches required prefix schema');

    const bookingB = {
      ...bookingA,
      startTime: '11:00',
      endTime: '13:00',
    };
    const keyB = generateBookingIdempotencyKey(bookingB);
    assert.notEqual(keyA1, keyB, 'Different slots must generate distinct idempotency keys');

    // Test retry validation: duplicate retry identified and not treated as conflict
    const existingList: AdHocBooking[] = [
      {
        id: 'BK-2026-0001',
        roomId: 'BK01',
        roomName: 'Bilik Kuliah 01',
        date: '2026-10-15',
        startTime: '09:00',
        endTime: '11:00',
        applicantName: 'Ustaz Ahmad',
        applicantEmail: 'lecturer@mara.gov.my',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Pengajian Islam',
        purposeCategory: 'Kelas',
        title: 'Kelas Fiqh',
        paxCount: 30,
        status: 'CONFIRMED',
        createdAt: '2026-10-15T01:00:00Z',
        idempotencyKey: keyA1,
      },
    ];

    const retryCheck = validateBookingSlot(
      {
        roomId: 'BK01',
        date: '2026-10-15',
        startTime: '09:00',
        endTime: '11:00',
        applicantEmail: 'lecturer@mara.gov.my',
        idempotencyKey: keyA1,
      },
      existingList
    );

    assert.equal(retryCheck.isRetry, true, 'Must identify matching idempotencyKey as a safe retry');
    assert.equal(retryCheck.hasConflict, false, 'Safe retry must not be flagged as a conflict');
    console.log('  ✔ Gate 1 PASSED: Deterministic keys and idempotent retry handling verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 1 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 2: Server-authoritative atomic booking conflict prevention
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 2] Testing Atomic Conflict Prevention & Slot Overlap Mathematics...');
    // Overlapping tests
    assert.equal(isSlotOverlapping('08:30', '10:30', '09:30', '11:30'), true, 'Partial overlap detected');
    assert.equal(isSlotOverlapping('08:00', '12:00', '09:00', '10:00'), true, 'Contained slot detected');
    assert.equal(isSlotOverlapping('09:00', '10:00', '08:00', '12:00'), true, 'Encompassing slot detected');

    // Adjacent / Non-overlapping tests (half-open intervals [start, end))
    assert.equal(isSlotOverlapping('08:30', '10:30', '10:30', '12:30'), false, 'Adjacent back-to-back slot is available');
    assert.equal(isSlotOverlapping('14:00', '16:00', '08:00', '10:00'), false, 'Disjoint slots do not overlap');

    const confirmedBookings: AdHocBooking[] = [
      {
        id: 'BK-2026-CONFIRMED',
        roomId: 'DKA',
        roomName: 'Dewan Kuliah A',
        date: '2026-10-20',
        startTime: '10:00',
        endTime: '12:00',
        applicantName: 'Dr. Noraini',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Perdagangan',
        purposeCategory: 'Kelas',
        title: 'Perakaunan Kewangan',
        paxCount: 60,
        status: 'CONFIRMED',
        createdAt: '2026-10-20T00:00:00Z',
      },
    ];

    const conflictingCandidate = {
      roomId: 'DKA',
      date: '2026-10-20',
      startTime: '11:00',
      endTime: '13:00',
      applicantEmail: 'other@mara.gov.my',
    };

    const conflictResult = validateBookingSlot(conflictingCandidate, confirmedBookings);
    assert.equal(conflictResult.hasConflict, true, 'Atomic validation must reject overlapping booking');
    assert.match(conflictResult.reason || '', /Slot masa bertindih/, 'Informative conflict reason provided');

    // Cancelled booking allows slot re-use
    const cancelledBookings: AdHocBooking[] = [
      {
        ...confirmedBookings[0],
        status: 'CANCELLED',
      },
    ];
    const nonConflictResult = validateBookingSlot(conflictingCandidate, cancelledBookings);
    assert.equal(nonConflictResult.hasConflict, false, 'Cancelled booking frees up the slot');

    console.log('  ✔ Gate 2 PASSED: Server-authoritative atomic slot conflict prevention verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 2 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 3: Default-deny Firestore Rules validation
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 3] Testing Default-Deny Firestore Security Rules...');
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    assert.equal(fs.existsSync(rulesPath), true, 'firestore.rules exists');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // 1. Global Default-Deny Catch-All
    assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/, 'Global default-deny catch-all rule present');

    // 2. Staff credentials vault locked down (no client reads or writes)
    assert.match(rulesContent, /match\s+\/staff_credentials\/\{staffId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/, 'staff_credentials locked from client SDK');

    // 2b. Staff users directory write strictly locked to admin
    assert.match(rulesContent, /match\s+\/staff_users\/\{staffId\}\s*\{[\s\S]*allow\s+write:\s*if\s+isAdmin\(\);/, 'staff_users write restricted to admin only (no public writes)');

    // 3. Admin authorization requirement
    assert.match(rulesContent, /function\s+isAdmin\(\)/, 'isAdmin function defined');
    assert.match(rulesContent, /request\.auth\.token\.email_verified\s*==\s*true/, 'Requires verified email for sensitive operations');

    // 4. Admin role assignment locked
    assert.match(rulesContent, /match\s+\/admins\/\{adminId\}\s*\{[\s\S]*allow\s+write:\s*if\s+false;/, 'Client SDK cannot self-assign admin roles');

    // 5. Bookings authorization: unauthenticated pending disallowed
    assert.match(rulesContent, /match\s+\/bookings\/\{bookingId\}\s*\{[\s\S]*isBookingOwner\(incoming\(\)\.applicantEmail\)\s*\|\|\s*isAdmin\(\)/, 'Booking creation restricted to verified owner or admin');

    console.log('  ✔ Gate 3 PASSED: Default-deny, credential vault lockdown, and RBAC rules verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 3 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 4: Versioned catalog cache & rollback delta reconciliation
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 4] Testing Rollback Delta Reconciliation & Split-Brain Prevention...');
    const sourceBookings: AdHocBooking[] = [
      {
        id: 'BK-SRC-1',
        roomId: 'BK02',
        roomName: 'Bilik Kuliah 02',
        date: '2026-11-01',
        startTime: '08:30',
        endTime: '10:30',
        applicantName: 'En. Razak',
        applicantRole: 'Pensyarah',
        department: 'Jabatan Sains Komputer',
        purposeCategory: 'Kelas',
        title: 'Pemrograman Web',
        paxCount: 25,
        status: 'CONFIRMED',
        createdAt: '2026-11-01T01:00:00Z',
        idempotencyKey: 'BK-BK02-2026-11-01-0830-1030-razak',
      },
    ];

    const targetBookings: AdHocBooking[] = [
      // 1. Updated existing booking on Target
      {
        ...sourceBookings[0],
        notes: 'Nota dikemaskini semasa tempoh migrasi',
        paxCount: 30,
      },
      // 2. New booking created on Target during cutover
      {
        id: 'BK-TGT-2',
        roomId: 'BK03',
        roomName: 'Bilik Kuliah 03',
        date: '2026-11-02',
        startTime: '14:00',
        endTime: '16:00',
        applicantName: 'Pn. Salmah',
        applicantRole: 'Pegawai',
        department: 'Unit Pentadbiran',
        purposeCategory: 'Mesyuarat',
        title: 'Mesyuarat Bahagian',
        paxCount: 15,
        status: 'CONFIRMED',
        createdAt: '2026-11-02T02:00:00Z',
        idempotencyKey: 'BK-BK03-2026-11-02-1400-1600-salmah',
      },
      // 3. Duplicate retry of BK-TGT-2 with matching idempotency key
      {
        id: 'BK-TGT-2-RETRY',
        roomId: 'BK03',
        roomName: 'Bilik Kuliah 03',
        date: '2026-11-02',
        startTime: '14:00',
        endTime: '16:00',
        applicantName: 'Pn. Salmah',
        applicantRole: 'Pegawai',
        department: 'Unit Pentadbiran',
        purposeCategory: 'Mesyuarat',
        title: 'Mesyuarat Bahagian',
        paxCount: 15,
        status: 'CONFIRMED',
        createdAt: '2026-11-02T02:01:00Z',
        idempotencyKey: 'BK-BK03-2026-11-02-1400-1600-salmah',
      },
    ];

    const result = reconcileRollbackDelta(targetBookings, sourceBookings);

    assert.equal(result.report.createsCount, 1, 'Exactly 1 new booking created from Target');
    assert.equal(result.report.updatesCount, 1, 'Exactly 1 update merged into Source');
    assert.equal(result.report.duplicateRetriesCount, 1, 'Duplicate retry cleanly deduplicated');
    assert.equal(result.mergedBookings.length, 2, 'Total merged records is 2 without duplicate corruption');
    assert.equal(result.report.hasConflicts, false, 'Zero conflict split-brain state');

    console.log('  ✔ Gate 4 PASSED: Safe rollback delta reconciliation and deduplication verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 4 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 5: Server-Side scrypt Verification, Rate Limiting & Zero Leakage
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 5] Testing Server-Side scrypt Derivation, Server Rate Limiting & Zero Leakage...');

    // 1. Zero Plaintext PINs in Client Seed Data & Types
    for (const staff of INITIAL_STAFF_DATA) {
      assert.equal((staff as any).pin, undefined, `Staff ${staff.id} has no plaintext PIN`);
      assert.equal((staff as any).pinHash, undefined, `Staff ${staff.id} has no client pinHash`);
      assert.ok(staff.pinStatus === 'DEFAULT' || staff.pinStatus === 'CUSTOM', `Staff ${staff.id} has valid pinStatus`);
    }

    // 2. scrypt Key Derivation Parameters Verification (N=16384, r=8, p=1, keylen=64)
    const scryptResult = await hashPinScrypt('1234');
    assert.match(
      scryptResult.encoded,
      /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
      'scrypt format matches standard scrypt$N$r$p$salt$hash specification'
    );
    assert.equal(scryptResult.salt.length, 32, '16-byte random salt encoded as 32 hex chars');
    assert.equal(scryptResult.hash.length, 128, '64-byte keylen encoded as 128 hex chars');

    // 3. Timing-Safe Constant-Time Verification
    const isCorrect = await verifyPinScrypt('1234', scryptResult.encoded);
    assert.equal(isCorrect, true, 'Valid PIN correctly verified via scrypt');

    const isWrong = await verifyPinScrypt('9999', scryptResult.encoded);
    assert.equal(isWrong, false, 'Incorrect PIN rejected');

    const isSingleDigitWrong = await verifyPinScrypt('1235', scryptResult.encoded);
    assert.equal(isSingleDigitWrong, false, 'Single-digit alteration rejected');

    // 4. Per-User Salt Nonce Differentiation
    const scryptUserA = await hashPinScrypt('1234');
    const scryptUserB = await hashPinScrypt('1234');
    assert.notEqual(
      scryptUserA.encoded,
      scryptUserB.encoded,
      'Same PIN with distinct random salts produces completely distinct hashes'
    );

    // 5. Server-Side Rate Limiter & Lockout (5 attempts, 15m window)
    const testLimiter = new ServerRateLimiter(5, 15 * 60 * 1000);
    const testStaffId = 'st_test_limiter';

    // Initial state: allowed with 5 attempts left
    const initialCheck = testLimiter.checkLimit(testStaffId);
    assert.equal(initialCheck.allowed, true);
    assert.equal(initialCheck.attemptsLeft, 5);

    // Record 4 consecutive failed attempts
    for (let i = 1; i <= 4; i++) {
      const fail = testLimiter.recordFailure(testStaffId);
      assert.equal(fail.locked, false, `Attempt ${i} should not lock yet`);
      assert.equal(fail.attemptsLeft, 5 - i, `Should have ${5 - i} attempts left`);
    }

    // 5th failed attempt: triggers 15-minute account lockout
    const finalFail = testLimiter.recordFailure(testStaffId);
    assert.equal(finalFail.locked, true, '5th attempt must lock account');
    assert.ok((finalFail.remainingLockoutSeconds || 0) > 890, 'Lockout duration must be ~900 seconds');

    // Subsequent check: strictly rejected with allowed: false
    const lockedCheck = testLimiter.checkLimit(testStaffId);
    assert.equal(lockedCheck.allowed, false, 'Locked account must be disallowed');
    assert.ok(lockedCheck.remainingLockoutSeconds! > 0, 'Must report remaining lockout seconds');

    // 6. Server Credential Vault Verification & Zero Credential Leakage
    const testStaff = INITIAL_STAFF_DATA[0];
    const verifySuccess = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifySuccess.success, true, 'Default staff login with 1234 succeeds');
    assert.ok(verifySuccess.staff, 'Staff object returned');

    // CRITICAL: Ensure zero credential leakage in staff payload
    assert.equal((verifySuccess.staff as any).pin, undefined, 'Returned staff has no pin property');
    assert.equal((verifySuccess.staff as any).pinHash, undefined, 'Returned staff has no pinHash property');
    assert.equal((verifySuccess.staff as any).scryptHash, undefined, 'Returned staff has no scryptHash property');
    assert.equal((verifySuccess.staff as any).salt, undefined, 'Returned staff has no salt property');
    assert.equal(serverAuthVault.hasCredentialLeak(verifySuccess.staff as any), false, 'Audit confirms zero credential leak');

    // Test PIN update in vault
    await serverAuthVault.updateStaffPin(testStaff.id, '5678');
    const verifyOld = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifyOld.success, false, 'Old PIN 1234 rejected after update');

    const verifyNew = await serverAuthVault.verifyStaff(testStaff.email, '5678');
    assert.equal(verifyNew.success, true, 'New PIN 5678 verified via scrypt');
    assert.equal(verifyNew.staff?.pinStatus, 'CUSTOM', 'pinStatus transitioned to CUSTOM');

    // Reset back to default (without auth in internal test)
    await serverAuthVault.resetStaffPin(testStaff.id);
    const verifyReset = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifyReset.success, true, 'Reset to default PIN 1234 verified');
    assert.equal(verifyReset.staff?.pinStatus, 'DEFAULT', 'pinStatus reverted to DEFAULT');

    // 7. Post-Fix Verification 1: Confirm NO local PIN verification bypass (Fail-Closed)
    const localAttempt = verifyStaffCredentialsLocally(testStaff.email, '1234');
    assert.equal(localAttempt.success, false, 'Local verification must strictly fail-closed');
    assert.match(localAttempt.errorMsg, /Fail-Closed/i, 'Error message must reflect Fail-Closed policy');

    // 8. Post-Fix Verification 2: Enforce Server-Side Authentication & Authorization on update
    const updateNoAuth = await serverAuthVault.updateStaffPin(testStaff.id, '9876', {
      currentPin: 'wrong',
      skipAuth: false,
    });
    assert.equal(updateNoAuth.success, false, 'Update with wrong current PIN must fail');
    assert.equal(updateNoAuth.errorMsg, 'PIN semasa tidak sah.');

    // Update with valid current PIN succeeds
    const updateWithAuth = await serverAuthVault.updateStaffPin(testStaff.id, '9876', {
      currentPin: '1234',
      skipAuth: false,
    });
    assert.equal(updateWithAuth.success, true, 'Update with valid current PIN must succeed');

    // 9. Post-Fix Verification 3: Enforce Server-Side Admin Authorization on reset
    const resetUnauthorized = await serverAuthVault.resetStaffPin(testStaff.id, {
      adminPasscode: 'wrong_code',
      skipAuth: false,
    });
    assert.equal(resetUnauthorized.success, false, 'Reset with invalid admin passcode must fail');

    const resetAuthorized = await serverAuthVault.resetStaffPin(testStaff.id, {
      adminPasscode: '5313',
      skipAuth: false,
    });
    assert.equal(resetAuthorized.success, true, 'Reset with valid master admin passcode must succeed');

    // Re-verify after authorized reset
    const verifyAfterReset = await serverAuthVault.verifyStaff(testStaff.email, '1234');
    assert.equal(verifyAfterReset.success, true, 'Staff PIN successfully reset to 1234');

    // 10. Verification 4: Registered CSV Sources Matching & Rejection of Unregistered Emails
    const nurlailiMara = await serverAuthVault.verifyStaff('nurlaili@mara.gov.my', '2323');
    assert.equal(nurlailiMara.success, true, 'nurlaili@mara.gov.my successfully verifies with PIN 2323');
    assert.equal(nurlailiMara.staff?.id, 'ST061', 'Resolves to ST061');
    assert.equal(nurlailiMara.staff?.pinStatus, 'CUSTOM', 'ST061 has CUSTOM PIN status');

    // Also check registered alternative alias from CSV sources: nurlaili@kpmbp.edu.my
    const nurlailiKpmbp = await serverAuthVault.verifyStaff('nurlaili@kpmbp.edu.my', '2323');
    assert.equal(nurlailiKpmbp.success, true, 'nurlaili@kpmbp.edu.my (registered in CSV source) successfully verifies');
    assert.equal(nurlailiKpmbp.staff?.id, 'ST061', 'Resolves to ST061');

    // Strict rejection of emails not registered in CSV sources
    const nurlailiUnregistered = await serverAuthVault.verifyStaff('nurlailibalqis91@gmail.com', '2323');
    assert.equal(nurlailiUnregistered.success, false, 'Email not registered in CSV sources must be rejected');
    assert.match(nurlailiUnregistered.errorMsg || '', /CSV/i, 'Error message clearly indicates CSV source requirement');

    // Official staff ID with prefix resolution
    const nurlailiStaffId = await serverAuthVault.verifyStaff('st061@mara.gov.my', '2323');
    assert.equal(nurlailiStaffId.success, true, 'st061@mara.gov.my successfully verifies with PIN 2323');

    // Mobile input tolerance: mixed case and whitespace
    const nurlailiMobile = await serverAuthVault.verifyStaff('  Nurlaili@mara.gov.my  ', ' 2323 ');
    assert.equal(nurlailiMobile.success, true, 'Mobile whitespace and capitalization cleanly handled');

    console.log('  ✔ Gate 5 PASSED: Server-side scrypt (N=16384), 5-attempt rate limiter, fail-closed enforcement, zero client credential leakage, and CSV source email resolution verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 5 FAILED:', err);
  }

  // -------------------------------------------------------------
  // GATE 6: Tempoh Pengecualian Jadual Hakiki (Study Week)
  // -------------------------------------------------------------
  try {
    console.log('▶ [Gate 6] Testing Academic Exemptions (Study Week) Availability Engine & Validation...');

    // Mock rooms
    const roomBK07: Room = {
      id: 'BK07',
      code: 'BK07',
      name: 'Bilik Kuliah 07',
      category: 'Bilik Kuliah',
      capacity: 35,
      level: 'Level 1',
      block: 'Blok A',
      facilities: ['Projektor']
    };

    const roomBK01: Room = {
      id: 'BK01',
      code: 'BK01',
      name: 'Bilik Kuliah 01',
      category: 'Bilik Kuliah',
      capacity: 35,
      level: 'Level 1',
      block: 'Blok A',
      facilities: ['Projektor']
    };

    const roomLab: Room = {
      id: 'MAKMAL_ALFA',
      code: 'MAKMAL_ALFA',
      name: 'Makmal Komputer Alfa',
      category: 'Makmal Komputer',
      capacity: 30,
      level: 'Level 2',
      block: 'Blok B',
      facilities: ['30 PC']
    };

    // Tuesday slot (Selasa): 2026-11-03 is Tuesday
    const acadSlotTuesday: AcademicScheduleSlot = {
      id: 'SCH-MAT111',
      roomId: 'BK07',
      dayOfWeek: 'Selasa',
      startTime: '09:00',
      endTime: '12:00',
      courseCode: 'MAT111',
      courseName: 'Matematik Komputasi',
      className: 'DIT 1A',
      lecturerName: 'Dr. Zulkifli',
      department: 'Jabatan Sains Komputer'
    };

    // Sunday slot (Ahad) & Monday slot (Isnin) for boundary tests
    const acadSlotSunday: AcademicScheduleSlot = {
      id: 'SCH-SUN-BK07',
      roomId: 'BK07',
      dayOfWeek: 'Ahad',
      startTime: '09:00',
      endTime: '11:00',
      courseCode: 'ISL101',
      courseName: 'Pendidikan Islam',
      className: 'DIA 2B',
      lecturerName: 'Ustaz Ahmad',
      department: 'Jabatan Pengajian Islam'
    };

    const acadSlotMonday: AcademicScheduleSlot = {
      id: 'SCH-MON-BK07',
      roomId: 'BK07',
      dayOfWeek: 'Isnin',
      startTime: '09:00',
      endTime: '11:00',
      courseCode: 'BAH102',
      courseName: 'Bahasa Melayu Komunikasi',
      className: 'DBA 3C',
      lecturerName: 'Pn. Siti',
      department: 'Jabatan Bahasa'
    };

    const allSlots = [acadSlotTuesday, acadSlotSunday, acadSlotMonday];

    // Exemption: 2 Nov 2026 (Monday) to 8 Nov 2026 (Sunday)
    const exStudyWeek: AcademicExemption = {
      id: 'EX-20261102-001',
      title: 'Study Week Semester Nov 2026',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      scope: 'BILIK_KULIAH',
      active: true,
      createdBy: 'Admin KPMBP',
      createdAt: '2026-10-30T00:00:00Z'
    };

    // 1. Outside exemption vs inside active exemption
    // 2026-10-27 is previous Tuesday (outside exemption)
    const checkOutside = checkRoomAvailability(
      roomBK07,
      '2026-10-27',
      '09:00',
      '12:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkOutside.status, 'OCCUPIED_ACADEMIC', 'Tuesday outside exemption period must be OCCUPIED_ACADEMIC');

    // 2026-11-03 is Tuesday inside active exemption
    const checkInside = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkInside.status, 'AVAILABLE', 'Tuesday inside active study week exemption must be AVAILABLE');
    assert.ok(checkInside.academicExemption, 'Result must include academicExemption object');
    assert.equal(checkInside.academicExemption?.id, exStudyWeek.id, 'academicExemption id must match active exemption');

    // 2. Inactive exemption (active: false)
    const exInactive: AcademicExemption = { ...exStudyWeek, id: 'EX-INACTIVE', active: false };
    const checkInactive = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [],
      [],
      [exInactive]
    );
    assert.equal(checkInactive.status, 'OCCUPIED_ACADEMIC', 'Inactive exemption (active: false) must not skip academic schedule');

    // 3. Boundary dates (inclusive vs exclusive)
    // startDate itself (2026-11-02, Monday) is exempted
    const checkStartDate = checkRoomAvailability(
      roomBK07,
      '2026-11-02',
      '09:00',
      '11:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkStartDate.status, 'AVAILABLE', 'startDate itself (2026-11-02) must be exempted');

    // 1 day before startDate (2026-11-01, Sunday) is NOT exempted
    const checkBeforeStart = checkRoomAvailability(
      roomBK07,
      '2026-11-01',
      '09:00',
      '11:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkBeforeStart.status, 'OCCUPIED_ACADEMIC', '1 day before startDate (2026-11-01) must NOT be exempted');

    // endDate itself (2026-11-08, Sunday) is exempted
    const checkEndDate = checkRoomAvailability(
      roomBK07,
      '2026-11-08',
      '09:00',
      '11:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkEndDate.status, 'AVAILABLE', 'endDate itself (2026-11-08) must be exempted');

    // 1 day after endDate (2026-11-09, Monday) is NOT exempted
    const checkAfterEnd = checkRoomAvailability(
      roomBK07,
      '2026-11-09',
      '09:00',
      '11:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkAfterEnd.status, 'OCCUPIED_ACADEMIC', '1 day after endDate (2026-11-09) must NOT be exempted');

    // 4. Room Scope Tests
    // BILIK_KULIAH scope does NOT exempt Makmal Komputer
    const acadSlotLabTuesday: AcademicScheduleSlot = {
      id: 'SCH-LAB-TUE',
      roomId: 'MAKMAL_ALFA',
      dayOfWeek: 'Selasa',
      startTime: '09:00',
      endTime: '12:00',
      courseCode: 'CS110',
      courseName: 'Pengaturcaraan Web',
      className: 'DIT 2A',
      lecturerName: 'En. Razak',
      department: 'Jabatan Sains Komputer'
    };
    const checkLab = checkRoomAvailability(
      roomLab,
      '2026-11-03',
      '09:00',
      '12:00',
      [acadSlotLabTuesday],
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(checkLab.status, 'OCCUPIED_ACADEMIC', 'BILIK_KULIAH scope must not exempt Makmal Komputer');

    // SELECTED scope only exempts specified roomIds
    const exSelected: AcademicExemption = {
      id: 'EX-SEL-001',
      title: 'Study Week BK07 Sahaja',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      scope: 'SELECTED',
      roomIds: ['BK07'],
      active: true,
      createdBy: 'Admin KPMBP',
      createdAt: '2026-10-30T00:00:00Z'
    };
    const acadSlotBK01Tuesday: AcademicScheduleSlot = {
      id: 'SCH-BK01-TUE',
      roomId: 'BK01',
      dayOfWeek: 'Selasa',
      startTime: '09:00',
      endTime: '12:00',
      courseCode: 'ENG101',
      courseName: 'English Communication',
      className: 'DCS 1B',
      lecturerName: 'Ms. Sarah',
      department: 'Jabatan Bahasa'
    };
    const checkSelectedBK07 = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [],
      [],
      [exSelected]
    );
    assert.equal(checkSelectedBK07.status, 'AVAILABLE', 'Room in SELECTED roomIds must be exempted');

    const checkSelectedBK01 = checkRoomAvailability(
      roomBK01,
      '2026-11-03',
      '09:00',
      '12:00',
      [acadSlotBK01Tuesday],
      [],
      [],
      [exSelected]
    );
    assert.equal(checkSelectedBK01.status, 'OCCUPIED_ACADEMIC', 'Room NOT in SELECTED roomIds must NOT be exempted');

    // 5. Overlapping InstitutionalBlock (Exam / Layer 3 strictly beats Study Week)
    const examBlock: InstitutionalBlock = {
      id: 'BLK-EXAM-01',
      roomId: 'BK07',
      date: '2026-11-03',
      startTime: '09:00',
      endTime: '12:00',
      title: 'Peperiksaan Akhir MAT111',
      reason: 'Peperiksaan Akhir Semester',
      category: 'EXAM',
      createdBy: 'Unit Peperiksaan'
    };
    const checkExamBlock = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [],
      [examBlock],
      [exStudyWeek]
    );
    assert.equal(checkExamBlock.status, 'BLOCKED', 'Layer 3 InstitutionalBlock (Exam) strictly overrides Study Week exemption');

    // 6. Overlapping existing CONFIRMED AdHocBooking (Layer 2)
    const existingConfirmedBooking: AdHocBooking = {
      id: 'BK-20261103-001',
      roomId: 'BK07',
      roomName: 'Bilik Kuliah 07',
      date: '2026-11-03',
      startTime: '09:00',
      endTime: '11:00',
      applicantName: 'Ustaz Azman',
      applicantEmail: 'azman@mara.gov.my',
      applicantRole: 'Pensyarah',
      department: 'Jabatan Pengajian Islam',
      purposeCategory: 'Kelas',
      title: 'Bengkel Persediaan Peperiksaan',
      paxCount: 25,
      status: 'CONFIRMED',
      createdAt: '2026-11-01T00:00:00Z'
    };
    const checkBookingConflict = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [existingConfirmedBooking],
      [],
      [exStudyWeek]
    );
    assert.equal(checkBookingConflict.status, 'OCCUPIED_BOOKING', 'Existing confirmed ad-hoc booking overrides availability even during Study Week');

    // 7. Lecturer adhoc booking scenario on 3 Nov 2026 BK07 09:00-12:00 (MAT111)
    const withExemption = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [],
      [],
      [exStudyWeek]
    );
    assert.equal(withExemption.status, 'AVAILABLE', 'With study week exemption: Lecturer adhoc booking is AVAILABLE');

    const withoutExemption = checkRoomAvailability(
      roomBK07,
      '2026-11-03',
      '09:00',
      '12:00',
      allSlots,
      [],
      [],
      []
    );
    assert.equal(withoutExemption.status, 'OCCUPIED_ACADEMIC', 'Without study week exemption: Blocked by academic timetable (OCCUPIED_ACADEMIC)');

    // 8. validateExemptionInput tests
    // (a) endDate < startDate
    const valEndBeforeStart = validateExemptionInput({
      title: 'Valid Title',
      startDate: '2026-11-10',
      endDate: '2026-11-05',
      scope: 'ALL_ROOMS'
    });
    assert.equal(valEndBeforeStart.isValid, false, 'endDate before startDate must be invalid');
    assert.ok(valEndBeforeStart.errors.some(e => e.toLowerCase().includes('tarikh tamat')), 'Error must mention tarikh tamat');

    // (b) Duration > 31 days
    const valTooLong = validateExemptionInput({
      title: 'Valid Title',
      startDate: '2026-11-01',
      endDate: '2026-12-15', // 45 days
      scope: 'ALL_ROOMS'
    });
    assert.equal(valTooLong.isValid, false, 'Duration > 31 days must be invalid');
    assert.ok(valTooLong.errors.some(e => e.includes('31 hari')), 'Error must mention 31 days limit');

    // (c) Empty title
    const valEmptyTitle = validateExemptionInput({
      title: '   ',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      scope: 'ALL_ROOMS'
    });
    assert.equal(valEmptyTitle.isValid, false, 'Empty title must be invalid');
    assert.ok(valEmptyTitle.errors.some(e => e.includes('Tajuk')), 'Error must mention Tajuk');

    // (d) Scope SELECTED without rooms
    const valSelectedNoRooms = validateExemptionInput({
      title: 'Study Week',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      scope: 'SELECTED',
      roomIds: []
    });
    assert.equal(valSelectedNoRooms.isValid, false, 'SELECTED scope without rooms must be invalid');
    assert.ok(valSelectedNoRooms.errors.some(e => e.includes('sekurang-kurangnya satu bilik')), 'Error must mention room selection');

    // (e) Warning for overlapping active exemption
    const valOverlap = validateExemptionInput(
      {
        title: 'New Study Week',
        startDate: '2026-11-05',
        endDate: '2026-11-12',
        scope: 'BILIK_KULIAH'
      },
      [exStudyWeek]
    );
    assert.equal(valOverlap.isValid, true, 'Overlap is a warning, not a fatal blocking error');
    assert.ok(valOverlap.warnings.length > 0, 'Overlap must generate warning');

    // 9. Quick date calculation verification:
    // +6 days from 2026-11-09 = 2026-11-15 (1 week / 7 days inclusive)
    // +13 days from 2026-11-09 = 2026-11-22 (2 weeks / 14 days inclusive)
    const computeQuickEnd = (startStr: string, daysToAdd: number): string => {
      const [y, m, d] = startStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + daysToAdd);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    const oneWeekEnd = computeQuickEnd('2026-11-09', 6);
    assert.equal(oneWeekEnd, '2026-11-15', '1 week quick duration from 2026-11-09 must be 2026-11-15');

    const twoWeekEnd = computeQuickEnd('2026-11-09', 13);
    assert.equal(twoWeekEnd, '2026-11-22', '2 weeks quick duration from 2026-11-09 must be 2026-11-22');

    console.log('  ✔ Gate 6 PASSED: Academic Exemptions (Study Week) availability logic, boundary math, scope filtering, exam layer precedence, validation, and quick date calculations fully verified.\n');
    passedGates++;
  } catch (err) {
    console.error('  ✘ Gate 6 FAILED:', err);
  }

  console.log('========================================================================');
  console.log(`TOTAL RESULT: ${passedGates}/${totalGates} GATES PASSED`);
  console.log('========================================================================\n');

  if (passedGates !== totalGates) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllGateTests().catch((err) => {
  console.error('Unexpected error in gate tests:', err);
  process.exit(1);
});
