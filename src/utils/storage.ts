import { Room, AcademicScheduleSlot, AdHocBooking, InstitutionalBlock, StaffUser, AcademicExemption } from '../types';
import { INITIAL_ROOMS, INITIAL_ACADEMIC_SCHEDULE, INITIAL_ADHOC_BOOKINGS, INITIAL_INSTITUTIONAL_BLOCKS } from '../data/initialData';

const ROOMS_KEY = 'kpmbp_rooms_v4';
const ACADEMIC_SCHEDULE_KEY = 'kpmbp_academic_schedule_v3';
const ADHOC_BOOKINGS_KEY = 'kpmbp_adhoc_bookings_v1';
const INSTITUTIONAL_BLOCKS_KEY = 'kpmbp_institutional_blocks_v1';
const ACADEMIC_EXEMPTIONS_KEY = 'kpmbp_academic_exemptions_v1';

export function getStoredRooms(): Room[] {
  try {
    const data = localStorage.getItem(ROOMS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure key exam halls and seminar venues are present
        const requiredVenues = ['DEWAN_BESAR', 'SRI_PENAWAR', 'DEWAN_SEMINAR', 'MINI_SEMINAR', 'BILIK_MESYUARAT'];
        let hasChanges = false;
        for (const reqId of requiredVenues) {
          const exists = parsed.some(r => r.id === reqId || r.code === reqId);
          if (!exists) {
            const found = INITIAL_ROOMS.find(r => r.id === reqId);
            if (found) {
              parsed.push(found);
              hasChanges = true;
            }
          }
        }
        if (hasChanges) {
          localStorage.setItem(ROOMS_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
    localStorage.setItem(ROOMS_KEY, JSON.stringify(INITIAL_ROOMS));
    return INITIAL_ROOMS;
  } catch {
    return INITIAL_ROOMS;
  }
}

export function isTargetVenue(room: { code: string; name: string; category?: string; id?: string }): boolean {
  const codeUpper = (room.code || '').toUpperCase();
  const nameUpper = (room.name || '').toUpperCase();
  const idUpper = (room.id || '').toUpperCase();

  return (
    idUpper === 'DEWAN_BESAR' ||
    idUpper === 'SRI_PENAWAR' ||
    idUpper === 'DEWAN_SEMINAR' ||
    idUpper === 'MINI_SEMINAR' ||
    idUpper === 'DKA' ||
    idUpper === 'DKB' ||
    codeUpper === 'DKA' ||
    codeUpper === 'DKB' ||
    codeUpper.includes('DKA') ||
    codeUpper.includes('DKB') ||
    codeUpper.includes('PENAWAR') ||
    nameUpper.includes('DEWAN BESAR') ||
    nameUpper.includes('SRI PENAWAR') ||
    nameUpper.includes('DEWAN SEMINAR') ||
    nameUpper.includes('MINI SEMINAR') ||
    (nameUpper.includes('DEWAN') && nameUpper.includes('BESAR')) ||
    (nameUpper.includes('DEWAN') && nameUpper.includes('SEMINAR'))
  );
}

export function formatLevel(level: number | string): string {
  if (!level) return '';
  const lvlStr = String(level).trim();
  const lower = lvlStr.toLowerCase();
  if (lower === 'g' || lower === 'ground' || lower === 'ground floor' || lower === '0' || lower === 'aras g' || lower === 'aras bawah') {
    return 'Ground Floor';
  }
  if (lower === '1' || lower === '1st' || lower === '1st floor' || lower === 'aras 1' || lower === 'tingkat 1') {
    return '1st Floor';
  }
  if (lower === '2' || lower === '2nd' || lower === '2nd floor' || lower === 'aras 2' || lower === 'tingkat 2') {
    return '2nd Floor';
  }
  if (lower === '3' || lower === '3rd' || lower === '3rd floor' || lower === 'aras 3' || lower === 'tingkat 3') {
    return '3rd Floor';
  }
  if (lower === '4' || lower === '4th' || lower === '4th floor' || lower === 'aras 4' || lower === 'tingkat 4') {
    return '4th Floor';
  }
  return lvlStr;
}

export function saveStoredRooms(rooms: Room[]): void {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch (err) {
    console.error('Failed to save rooms to storage:', err);
  }
}

export function getStoredAcademicSchedule(): AcademicScheduleSlot[] {
  try {
    const isCustomized = localStorage.getItem('kpmbp_schedule_customized') === 'true';
    const data = localStorage.getItem(ACADEMIC_SCHEDULE_KEY);
    if (isCustomized) {
      return data ? JSON.parse(data) : [];
    }
    return data ? JSON.parse(data) : INITIAL_ACADEMIC_SCHEDULE;
  } catch {
    return INITIAL_ACADEMIC_SCHEDULE;
  }
}

export function saveStoredAcademicSchedule(schedule: AcademicScheduleSlot[]): void {
  try {
    localStorage.setItem('kpmbp_schedule_customized', 'true');
    localStorage.setItem(ACADEMIC_SCHEDULE_KEY, JSON.stringify(schedule));
  } catch (err) {
    console.error('Error storing academic schedule locally:', err);
  }
}

export function getStoredAdHocBookings(): AdHocBooking[] {
  try {
    const data = localStorage.getItem(ADHOC_BOOKINGS_KEY);
    const list: AdHocBooking[] = data ? JSON.parse(data) : INITIAL_ADHOC_BOOKINGS;
    // Strict Zero Demo Data Filter
    const clean = list.filter(b => b.id !== 'BK-2026-000101' && b.id !== 'BK-2026-000102' && b.id !== 'BK-2026-000103');
    // Ensure any queued pending bookings are merged in so they are never lost on reload
    return mergeCloudBookingsWithPendingQueue(clean);
  } catch {
    return INITIAL_ADHOC_BOOKINGS;
  }
}

export function saveStoredAdHocBookings(bookings: AdHocBooking[]): void {
  const cleanBookings = bookings.filter(b => b.id !== 'BK-2026-000101' && b.id !== 'BK-2026-000102' && b.id !== 'BK-2026-000103');
  localStorage.setItem(ADHOC_BOOKINGS_KEY, JSON.stringify(cleanBookings));
}

/**
 * SES v4.5: Reliable Offline Pending-Booking Queue in LocalStorage
 */
const PENDING_BOOKING_QUEUE_KEY = 'kpmbp_pending_booking_queue_v1';

type PendingQueueListener = (queue: AdHocBooking[]) => void;
const pendingQueueListeners = new Set<PendingQueueListener>();

/**
 * Generate a deterministic idempotency key for booking requests.
 * Distinguishes genuine retries for the same slot from new distinct bookings.
 */
export function generateBookingIdempotencyKey(data: {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  applicantEmail?: string;
  applicantName?: string;
}): string {
  const room = (data.roomId || '').trim().toUpperCase();
  const date = (data.date || '').trim();
  const start = (data.startTime || '').trim();
  const end = (data.endTime || '').trim();
  const user = (data.applicantEmail || data.applicantName || '').trim().toLowerCase();
  return `IDEM_${room}_${date}_${start}_${end}_${user}`;
}

export function getStoredPendingBookingQueue(): AdHocBooking[] {
  try {
    const data = localStorage.getItem(PENDING_BOOKING_QUEUE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredPendingBookingQueue(queue: AdHocBooking[]): void {
  try {
    localStorage.setItem(PENDING_BOOKING_QUEUE_KEY, JSON.stringify(queue));
    notifyPendingQueueListeners(queue);
  } catch (err) {
    console.error('Failed to save pending booking queue:', err);
  }
}

export function enqueuePendingBooking(booking: AdHocBooking): void {
  const current = getStoredPendingBookingQueue();
  // Safe retry handling: Prevent duplicate insertion by checking both ID and idempotency key
  const existingIndex = current.findIndex(b => 
    b.id === booking.id || 
    (Boolean(b.idempotencyKey) && Boolean(booking.idempotencyKey) && b.idempotencyKey === booking.idempotencyKey)
  );
  let updated: AdHocBooking[];
  if (existingIndex >= 0) {
    // Retry of existing booking: update record with latest payload and preserve status
    updated = current.map((b, idx) => idx === existingIndex ? { ...b, ...booking, id: b.id } : b);
  } else {
    updated = [...current, booking];
  }
  saveStoredPendingBookingQueue(updated);
}

export function dequeuePendingBooking(bookingIdOrKey: string): void {
  const current = getStoredPendingBookingQueue();
  const updated = current.filter(b => b.id !== bookingIdOrKey && b.idempotencyKey !== bookingIdOrKey);
  saveStoredPendingBookingQueue(updated);
}

export function updatePendingBookingInQueue(booking: AdHocBooking): void {
  const current = getStoredPendingBookingQueue();
  const index = current.findIndex(b => 
    b.id === booking.id || 
    (Boolean(b.idempotencyKey) && Boolean(booking.idempotencyKey) && b.idempotencyKey === booking.idempotencyKey)
  );
  if (index >= 0) {
    const updated = current.map((b, idx) => idx === index ? { ...b, ...booking, id: b.id } : b);
    saveStoredPendingBookingQueue(updated);
  } else {
    enqueuePendingBooking(booking);
  }
}

export function updateStoredBooking(updatedBooking: AdHocBooking): void {
  const all = getStoredAdHocBookings();
  const index = all.findIndex(b => 
    b.id === updatedBooking.id || 
    (Boolean(b.idempotencyKey) && Boolean(updatedBooking.idempotencyKey) && b.idempotencyKey === updatedBooking.idempotencyKey)
  );
  let updatedList: AdHocBooking[];
  if (index >= 0) {
    updatedList = all.map((b, idx) => idx === index ? { ...b, ...updatedBooking } : b);
  } else {
    updatedList = [updatedBooking, ...all];
  }
  saveStoredAdHocBookings(updatedList);
}

/**
 * Merge Cloud Firestore bookings with Local Offline Pending Queue.
 * Guarantees that pending offline bookings are never lost or overwritten across cloud snapshots or reloads.
 */
export function mergeCloudBookingsWithPendingQueue(cloudBookings: AdHocBooking[]): AdHocBooking[] {
  const queue = getStoredPendingBookingQueue();
  if (queue.length === 0) {
    return cloudBookings;
  }

  const cloudIdMap = new Map<string, AdHocBooking>();
  const cloudKeyMap = new Map<string, AdHocBooking>();
  cloudBookings.forEach(b => {
    cloudIdMap.set(b.id, b);
    if (b.idempotencyKey) {
      cloudKeyMap.set(b.idempotencyKey, b);
    }
  });

  const remainingQueue: AdHocBooking[] = [];
  const merged: AdHocBooking[] = [...cloudBookings];

  queue.forEach(pending => {
    const inCloud = cloudIdMap.get(pending.id) || (pending.idempotencyKey ? cloudKeyMap.get(pending.idempotencyKey) : undefined);
    if (inCloud && inCloud.status === 'CONFIRMED') {
      // Confirmed in cloud! Dequeue it automatically
    } else {
      // Still pending sync to cloud
      remainingQueue.push(pending);
      // If not in cloud list, add it to merged list so UI shows it with PENDING status
      const existsInMerged = merged.some(m => m.id === pending.id || (m.idempotencyKey && pending.idempotencyKey && m.idempotencyKey === pending.idempotencyKey));
      if (!existsInMerged) {
        merged.unshift({
          ...pending,
          status: 'PENDING',
          syncStatus: pending.syncStatus || 'pending_sync'
        });
      }
    }
  });

  if (remainingQueue.length !== queue.length) {
    saveStoredPendingBookingQueue(remainingQueue);
  }

  // Deduplicate
  const seenIds = new Set<string>();
  return merged.filter(b => {
    if (seenIds.has(b.id)) return false;
    seenIds.add(b.id);
    return true;
  });
}

export function subscribeToPendingBookingQueue(listener: PendingQueueListener): () => void {
  pendingQueueListeners.add(listener);
  listener(getStoredPendingBookingQueue());
  return () => {
    pendingQueueListeners.delete(listener);
  };
}

function notifyPendingQueueListeners(queue: AdHocBooking[]) {
  pendingQueueListeners.forEach(listener => {
    try {
      listener(queue);
    } catch (err) {
      console.error('Error notifying pending queue listener:', err);
    }
  });
}

export function getStoredInstitutionalBlocks(): InstitutionalBlock[] {
  try {
    const data = localStorage.getItem(INSTITUTIONAL_BLOCKS_KEY);
    let list: InstitutionalBlock[] = data ? JSON.parse(data) : [];
    // Strict Zero Demo Data Filter
    list = list.filter(b => b.id !== 'BLK-001' && b.id !== 'BLK-002');
    
    // Ensure official exam blocks for 2 Nov - 16 Nov are merged in if missing
    const hasExamNov = list.some(b => 
      b.batchId === 'BATCH-EXAM-NOV-2026' || 
      (b.title?.toLowerCase().includes('peperiksaan') && b.date === '2026-11-02')
    );
    if (!hasExamNov) {
      list = [...INITIAL_INSTITUTIONAL_BLOCKS, ...list];
      localStorage.setItem(INSTITUTIONAL_BLOCKS_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return INITIAL_INSTITUTIONAL_BLOCKS;
  }
}

export function saveStoredInstitutionalBlocks(blocks: InstitutionalBlock[]): void {
  const cleanBlocks = blocks.filter(b => b.id !== 'BLK-001' && b.id !== 'BLK-002');
  localStorage.setItem(INSTITUTIONAL_BLOCKS_KEY, JSON.stringify(cleanBlocks));
}

export interface UserProfileHistory {
  staffId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantRole: string;
  department: string;
  applicantPhone?: string;
  lastUsedAt?: string;
  pinStatus?: 'DEFAULT' | 'CUSTOM';
}

const USER_PROFILES_KEY = 'kpmbp_user_profiles_v1';
const ACTIVE_USER_KEY = 'kpmbp_active_user_v1';

// Pilot Operational: Zero Demo Profiles
export const DEFAULT_USER_PROFILES: UserProfileHistory[] = [];

export function getStoredUserProfiles(): UserProfileHistory[] {
  try {
    const data = localStorage.getItem(USER_PROFILES_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Filter out obsolete domains (@bpenawar.kpm.edu.my, @gmail.com) and null entries
      return parsed.filter(p => p && p.applicantEmail && !p.applicantEmail.toLowerCase().endsWith('@bpenawar.kpm.edu.my') && !p.applicantEmail.toLowerCase().endsWith('@gmail.com'));
    }
    return [];
  } catch {
    return [];
  }
}

export function findProfileByEmail(email: string): UserProfileHistory | null {
  if (!email || !email.trim()) return null;
  const cleanEmail = email.trim().toLowerCase();
  const profiles = getStoredUserProfiles();
  return profiles.find(p => p && p.applicantEmail && p.applicantEmail.trim().toLowerCase() === cleanEmail) || null;
}

export function getStoredActiveUser(): UserProfileHistory | null {
  try {
    const data = localStorage.getItem(ACTIVE_USER_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.applicantEmail) {
        const emailLower = parsed.applicantEmail.toLowerCase();
        if (emailLower.endsWith('@bpenawar.kpm.edu.my') || emailLower.endsWith('@gmail.com')) {
          localStorage.removeItem(ACTIVE_USER_KEY);
          return null;
        }
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export type ActiveUserListener = (profile: UserProfileHistory | null) => void;
const activeUserListeners = new Set<ActiveUserListener>();

export function subscribeToActiveUser(listener: ActiveUserListener): () => void {
  activeUserListeners.add(listener);
  return () => {
    activeUserListeners.delete(listener);
  };
}

function notifyActiveUserChanged(profile: UserProfileHistory | null): void {
  activeUserListeners.forEach(listener => {
    try {
      listener(profile);
    } catch {
      // ignore
    }
  });
}

export function saveActiveUser(profile: UserProfileHistory): void {
  try {
    if (!profile || !profile.applicantEmail) return;
    const updated = { ...profile, lastUsedAt: new Date().toISOString() };
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(updated));
    saveUserProfile(updated);
    notifyActiveUserChanged(updated);
  } catch (err) {
    console.error('Error saving active user:', err);
  }
}

export function clearActiveUser(): void {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem(USER_PROFILES_KEY);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kpmbp_active_user_pin');
    }
    notifyActiveUserChanged(null);
  } catch (err) {
    console.error('Error clearing active user:', err);
  }
}

export function saveUserProfile(profile: UserProfileHistory): void {
  try {
    if (!profile || !profile.applicantEmail) return;
    const existing = getStoredUserProfiles();
    const filtered = existing.filter(p => p && p.applicantEmail && p.applicantEmail.toLowerCase() !== profile.applicantEmail.toLowerCase());
    const updated = [
      { ...profile, lastUsedAt: new Date().toISOString() },
      ...filtered
    ].slice(0, 10);
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving user profile:', err);
  }
}

export function purgeAllDemoDataLocal(): void {
  localStorage.removeItem(ADHOC_BOOKINGS_KEY);
  localStorage.removeItem(INSTITUTIONAL_BLOCKS_KEY);
  localStorage.removeItem(USER_PROFILES_KEY);
  localStorage.removeItem(ACTIVE_USER_KEY);
}

export function resetToDefaults(): void {
  localStorage.removeItem('kpmbp_schedule_customized');
  localStorage.setItem(ROOMS_KEY, JSON.stringify(INITIAL_ROOMS));
  localStorage.setItem(ACADEMIC_SCHEDULE_KEY, JSON.stringify(INITIAL_ACADEMIC_SCHEDULE));
  localStorage.setItem(ADHOC_BOOKINGS_KEY, JSON.stringify(INITIAL_ADHOC_BOOKINGS));
  localStorage.setItem(INSTITUTIONAL_BLOCKS_KEY, JSON.stringify(INITIAL_INSTITUTIONAL_BLOCKS));
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(DEFAULT_USER_PROFILES));
}

export function generateBookingId(): string {
  const rand = Math.floor(100 + Math.random() * 900);
  const ts = Date.now().toString().slice(-4);
  return `BK-2026-${ts}${rand}`;
}

const STAFF_CACHE_KEY = 'kpmbp_staff_cache_v1';

export function deduplicateStaffById(list: StaffUser[]): StaffUser[] {
  const map = new Map<string, StaffUser>();
  list.forEach((st) => {
    const rawId = (st.id || '').trim();
    if (!rawId) return;
    const key = rawId.toLowerCase();
    const existing = map.get(key);
    
    // Sanitize and resolve duplicate record
    if (!existing) {
      map.set(key, {
        id: rawId,
        name: st.name || '',
        department: st.department || '',
        role: st.role || '',
        phone: st.phone || '',
        email: st.email || '',
        pinStatus: st.pinStatus === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT',
        pinChangedAt: st.pinStatus === 'CUSTOM' ? st.pinChangedAt : undefined,
        pinHash: st.pinStatus === 'CUSTOM' ? st.pinHash : undefined
      });
    } else {
      // Identity is Staff ID: resolve duplicate record
      // Prefer @mara.gov.my over older domains if available
      let chosenEmail = existing.email;
      if (st.email && (st.email.includes('@mara.gov.my') || !existing.email.includes('@mara.gov.my'))) {
        chosenEmail = st.email;
      }
      
      const isCustom = existing.pinStatus === 'CUSTOM' || st.pinStatus === 'CUSTOM';
      const chosenChangedAt = existing.pinChangedAt || st.pinChangedAt;

      map.set(key, {
        id: existing.id || st.id,
        name: st.name || existing.name,
        department: st.department || existing.department,
        role: st.role || existing.role,
        phone: st.phone || existing.phone,
        email: chosenEmail,
        pinStatus: isCustom ? 'CUSTOM' : 'DEFAULT',
        pinChangedAt: isCustom ? chosenChangedAt : undefined,
        pinHash: isCustom ? (st.pinHash || existing.pinHash) : undefined
      });
    }
  });
  return Array.from(map.values());
}

export function getStoredStaffUsers(): StaffUser[] | null {
  try {
    const data = localStorage.getItem(STAFF_CACHE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return deduplicateStaffById(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredStaffUsers(staffList: StaffUser[]): void {
  try {
    const clean = deduplicateStaffById(staffList);
    localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('Failed to cache staff list locally:', err);
  }
}

export function getStoredAcademicExemptions(): AcademicExemption[] {
  try {
    const data = localStorage.getItem(ACADEMIC_EXEMPTIONS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAcademicExemptions(list: AcademicExemption[]): void {
  try {
    localStorage.setItem(ACADEMIC_EXEMPTIONS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to cache academic exemptions locally:', err);
  }
}
