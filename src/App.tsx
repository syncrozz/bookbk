/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Room, 
  AcademicScheduleSlot, 
  AdHocBooking, 
  InstitutionalBlock, 
  PurposeCategory,
  StaffUser,
  AcademicExemption
} from './types';
import { 
  getStoredRooms, 
  saveStoredRooms,
  getStoredAcademicSchedule, 
  saveStoredAcademicSchedule,
  getStoredAdHocBookings, 
  saveStoredAdHocBookings, 
  getStoredInstitutionalBlocks, 
  saveStoredInstitutionalBlocks, 
  getStoredAcademicExemptions,
  saveStoredAcademicExemptions,
  resetToDefaults, 
  purgeAllDemoDataLocal,
  generateBookingId,
  saveUserProfile,
  getStoredActiveUser,
  subscribeToActiveUser,
  UserProfileHistory,
  getStoredStaffUsers,
  saveStoredStaffUsers,
  deduplicateStaffById,
  getStoredPendingBookingQueue,
  subscribeToPendingBookingQueue,
  enqueuePendingBooking,
  dequeuePendingBooking,
  updateStoredBooking,
  mergeCloudBookingsWithPendingQueue
} from './utils/storage';
import { matchStaffByEmail } from './utils/staff-matcher';
import { findActiveExemption } from './utils/availabilityEngine';
import { 
  subscribeToBookings, 
  subscribeToBlocks, 
  subscribeToStaffUsers,
  subscribeToSchedule,
  subscribeToRooms,
  bulkSaveRoomsToCloud,
  seedRoomsToCloud,
  deleteRoomsFromCloud,
  fetchRoomsOnceWithCache,
  seedInitialStaffUsers,
  bulkSaveStaffUsersToCloud,
  bulkSaveScheduleToCloud,
  clearAllScheduleFromCloud,
  saveBookingToCloud, 
  bulkSaveBookingsToCloud,
  deleteBookingFromCloud, 
  saveBlockToCloud, 
  deleteBlockFromCloud,
  bulkSaveBlocksToCloud,
  bulkDeleteBlocksFromCloud,
  cleanObsoleteDemoRecordsFromCloud,
  subscribeToConnectionStatus,
  invalidateStaticCache,
  getConnectionStatus,
  testFirebaseConnection,
  ConnectionStatusState,
  syncPendingBookingsQueue,
  saveScheduleSlotToCloud,
  refreshStaffUsersFromCloud,
  verifyAdminPin,
  subscribeToAcademicExemptions,
  saveAcademicExemptionsToCloud
} from './lib/firebase';
import { INITIAL_STAFF_DATA } from './data/staffData';

import { Header, ActiveTab } from './components/Header';
import { QuickNavGrid } from './components/QuickNavGrid';
import { DashboardOverview } from './components/DashboardOverview';
import { RoomAvailabilityMatrix } from './components/RoomAvailabilityMatrix';
import { AcademicScheduleView } from './components/AcademicScheduleView';
import { MyBookingsView } from './components/MyBookingsView';
import { RoomDirectoryView } from './components/RoomDirectoryView';
import { AdminManagementView } from './components/AdminManagementView';
import { BookingModal } from './components/BookingModal';
import { QRCodeModal } from './components/QRCodeModal';
import { SupportModal } from './components/SupportModal';
import { SetPinModal } from './components/SetPinModal';
import { OfflineFallbackBanner } from './components/OfflineFallbackBanner';

import { Building2, Shield, Heart, Sparkles, CheckCircle2, Lock, X, KeyRound, ShieldCheck, AlertCircle, AlertTriangle } from 'lucide-react';

export default function App() {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('kpmbp_admin_unlocked') === 'true';
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      const validTabs: ActiveTab[] = ['dashboard', 'matrix', 'academic', 'mybookings', 'directory', 'admin'];
      if (validTabs.includes(hash)) {
        if (hash === 'admin' && sessionStorage.getItem('kpmbp_admin_unlocked') !== 'true') {
          return 'matrix';
        }
        return hash;
      }
      const saved = localStorage.getItem('kpmbp_active_tab') as ActiveTab;
      if (validTabs.includes(saved)) {
        if (saved === 'admin' && sessionStorage.getItem('kpmbp_admin_unlocked') !== 'true') {
          return 'matrix';
        }
        return saved;
      }
    }
    return 'matrix';
  });

  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);

  // Admin PIN verification state
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);
  const [isVerifyingAdminPin, setIsVerifyingAdminPin] = useState<boolean>(false);

  const handleSelectTab = (tab: ActiveTab) => {
    if (tab === 'admin' && !isAdminUnlocked) {
      setShowAdminPinModal(true);
      setAdminPinError(null);
      setAdminPinInput('');
    } else {
      setActiveTab(tab);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('kpmbp_active_tab', tab);
        } catch {}
        window.location.hash = tab;
      }
    }
  };

  const handleVerifyAdminPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = adminPinInput.trim();
    if (!cleanPin) {
      setAdminPinError('Sila masukkan PIN / Passcode Pentadbir.');
      return;
    }
    setIsVerifyingAdminPin(true);
    setAdminPinError(null);
    try {
      const res = await verifyAdminPin(cleanPin);
      if (res.success) {
        setIsAdminUnlocked(true);
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('kpmbp_admin_unlocked', 'true');
          } catch {}
          try {
            localStorage.setItem('kpmbp_active_tab', 'admin');
          } catch {}
          window.location.hash = 'admin';
        }
        setActiveTab('admin');
        setShowAdminPinModal(false);
        setAdminPinInput('');
        setAdminPinError(null);
        showToast('🟢 Akses Pentadbir Disahkan.');
      } else {
        setAdminPinError(res.errorMsg || 'PIN / Passcode Keselamatan Pentadbir Tidak Sah.');
      }
    } catch {
      setAdminPinError('Ralat semasa pengesahan pentadbir.');
    } finally {
      setIsVerifyingAdminPin(false);
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdminUnlocked(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kpmbp_admin_unlocked');
      localStorage.setItem('kpmbp_active_tab', 'matrix');
      window.location.hash = 'matrix';
    }
    setActiveTab('matrix');
    setShowAdminPinModal(false);
    setAdminPinInput('');
    setAdminPinError(null);
    showToast('🔒 Sesi Admin telah dilog keluar. Akses Pentadbir dikunci semula.');
  };

  // State loaded from local storage persistence
  const [rooms, setRooms] = useState<Room[]>([]);
  const [academicSchedule, setAcademicSchedule] = useState<AcademicScheduleSlot[]>([]);
  const [adhocBookings, setAdhocBookings] = useState<AdHocBooking[]>([]);
  const [institutionalBlocks, setInstitutionalBlocks] = useState<InstitutionalBlock[]>([]);
  const [academicExemptions, setAcademicExemptions] = useState<AcademicExemption[]>(() => getStoredAcademicExemptions());
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => {
    const cached = getStoredStaffUsers();
    if (cached && cached.length > 0) {
      return deduplicateStaffById(cached);
    }
    return deduplicateStaffById(INITIAL_STAFF_DATA);
  });

  // Modals state
  const [bookingModalInfo, setBookingModalInfo] = useState<{
    room: Room;
    date: string;
    startTime: string;
    endTime: string;
    purpose: PurposeCategory;
  } | null>(null);

  const [qrModalBooking, setQrModalBooking] = useState<AdHocBooking | null>(null);

  // Mandatory PIN Change modal state for staff/owner on default PIN (1234)
  const [mandatoryPinChangeStaff, setMandatoryPinChangeStaff] = useState<StaffUser | null>(null);

  // Connection Status (Online vs Fallback) & Retry State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusState>(() => getConnectionStatus());
  const [isRetryingConnection, setIsRetryingConnection] = useState<boolean>(false);
  const [retryListenerTrigger, setRetryListenerTrigger] = useState<number>(0);

  // SES v4.5: Offline Pending Booking Queue state
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(() => getStoredPendingBookingQueue().length);
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);

  // Amaran Sebelum Tempahan - Pending Offline Booking state
  const [offlineBookingPending, setOfflineBookingPending] = useState<{
    room: Room;
    date: string;
    startTime: string;
    endTime: string;
    purpose: PurposeCategory;
  } | null>(null);

  // Subscribe to Global Connection Status
  useEffect(() => {
    const unsubStatus = subscribeToConnectionStatus((status) => {
      setConnectionStatus(status);
    });
    return () => {
      unsubStatus();
    };
  }, []);

  // Subscribe to Pending Queue updates
  useEffect(() => {
    const unsubQueue = subscribeToPendingBookingQueue((queue) => {
      setPendingQueueCount(queue.length);
    });
    return () => {
      unsubQueue();
    };
  }, []);


  // Process offline pending bookings queue
  const handleSyncPendingQueue = React.useCallback(async (isAuto: boolean = false) => {
    if (isSyncingQueue) return;
    const queue = getStoredPendingBookingQueue();
    if (queue.length === 0) return;

    setIsSyncingQueue(true);
    if (!isAuto) {
      showToast('🔄 Menyelaraskan tempahan luar talian ke Cloud...');
    }

    try {
      const res = await syncPendingBookingsQueue();
      if (res.syncedCount > 0) {
        // Refresh local bookings state to reflect confirmed status
        const latestBookings = getStoredAdHocBookings();
        setAdhocBookings(latestBookings);
        showToast(`🟢 ${res.syncedCount} tempahan luar talian berjaya DISAHKAN & disinkronkan ke Cloud!`);
      } else if (res.failedCount > 0 && !isAuto) {
        showToast(`🟡 ${res.failedCount} tempahan gagal disinkronkan. Sila semak sambungan internet.`);
      }
    } catch (err) {
      console.error('Error during queue sync:', err);
    } finally {
      setIsSyncingQueue(false);
    }
  }, [isSyncingQueue]);

  // Automatic retry synchronization when connectivity returns to 'online'
  useEffect(() => {
    if (connectionStatus.status === 'online' && pendingQueueCount > 0) {
      handleSyncPendingQueue(true);
    }
  }, [connectionStatus.status, pendingQueueCount, handleSyncPendingQueue]);

  // Browser window online event listener
  useEffect(() => {
    const handleBrowserOnline = () => {
      if (getStoredPendingBookingQueue().length > 0) {
        handleSyncPendingQueue(true);
      }
    };
    window.addEventListener('online', handleBrowserOnline);
    return () => window.removeEventListener('online', handleBrowserOnline);
  }, [handleSyncPendingQueue]);

  const handleRetryConnection = async () => {
    invalidateStaticCache();
    setIsRetryingConnection(true);
    showToast('🔄 Menghubungkan semula ke Cloud Firestore...');
    try {
      const res = await testFirebaseConnection();
      if (res.connected) {
        showToast('🟢 Berjaya disambung semula ke Cloud Firestore!');
        setRetryListenerTrigger((prev) => prev + 1);
        await handleSyncPendingQueue(false);
      } else {
        showToast(`🟡 Masih di luar talian: ${res.error || 'Tiada sambungan'}`);
        setRetryListenerTrigger((prev) => prev + 1);
      }
    } catch {
      showToast('🔴 Gagal menyambung ke Firestore.');
      setRetryListenerTrigger((prev) => prev + 1);
    } finally {
      setTimeout(() => {
        setIsRetryingConnection(false);
      }, 1000);
    }
  };

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Automatically check if stored active user is still using default PIN 1234
  useEffect(() => {
    const checkMandatoryPin = (active: UserProfileHistory | null) => {
      if (!active || !active.applicantEmail) {
        setMandatoryPinChangeStaff(null);
        return;
      }
      if (staffUsers.length > 0) {
        const match = matchStaffByEmail(active.applicantEmail, staffUsers);
        if (match && match.pinStatus === 'DEFAULT') {
          setMandatoryPinChangeStaff(match);
        } else {
          setMandatoryPinChangeStaff(null);
        }
      }
    };

    checkMandatoryPin(getStoredActiveUser());
    const unsubscribe = subscribeToActiveUser(checkMandatoryPin);
    return () => {
      unsubscribe();
    };
  }, [staffUsers]);

  const handlePinChangeSuccess = (updatedStaff: StaffUser) => {
    setStaffUsers((prev) => {
      const updated = prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s));
      saveStoredStaffUsers(updated);
      return updated;
    });
    setMandatoryPinChangeStaff(null);
    showToast(`✅ PIN keselamatan berjaya ditetapkan untuk ${updatedStaff.name}.`);
  };

  // Handle ESC key to close popups/modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAdminPinModal) {
          setShowAdminPinModal(false);
        } else if (offlineBookingPending) {
          setOfflineBookingPending(null);
        } else if (bookingModalInfo) {
          setBookingModalInfo(null);
        } else if (qrModalBooking) {
          setQrModalBooking(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminPinModal, offlineBookingPending, bookingModalInfo, qrModalBooking]);

  useEffect(() => {
    let isCancelled = false;

    setRooms(getStoredRooms());
    setAcademicSchedule(getStoredAcademicSchedule());
    setAdhocBookings(getStoredAdHocBookings());
    setInstitutionalBlocks(getStoredInstitutionalBlocks());

    // Clean any obsolete demo records from Cloud Firestore (Strict Zero Demo Data)
    cleanObsoleteDemoRecordsFromCloud().catch(() => {});

    // Subscribe to Firestore staff users (SES v4.4: Authoritative Staff List)
    const unsubStaff = subscribeToStaffUsers((cloudStaff) => {
      if (isCancelled) return;
      if (cloudStaff && cloudStaff.length > 0) {
        const deduplicated = deduplicateStaffById(cloudStaff);
        setStaffUsers(deduplicated);
        saveStoredStaffUsers(deduplicated);
      }
    });

    // Subscribe to Firestore for real-time multi-device booking synchronization
    const unsubBookings = subscribeToBookings((cloudBookings) => {
      if (isCancelled) return;
      setAdhocBookings(cloudBookings);
      saveStoredAdHocBookings(cloudBookings);
    });

    const unsubBlocks = subscribeToBlocks((cloudBlocks) => {
      if (isCancelled) return;
      setInstitutionalBlocks(cloudBlocks);
      saveStoredInstitutionalBlocks(cloudBlocks);
    });

    const unsubSchedule = subscribeToSchedule((cloudSchedule) => {
      if (isCancelled) return;
      if (cloudSchedule && cloudSchedule.length > 0) {
        setAcademicSchedule(cloudSchedule);
        saveStoredAcademicSchedule(cloudSchedule);
      }
    });

    const unsubRooms = subscribeToRooms((cloudRooms) => {
      if (isCancelled) return;
      if (cloudRooms && cloudRooms.length > 0) {
        setRooms(cloudRooms);
        saveStoredRooms(cloudRooms);
      }
    });

    const unsubExemptions = subscribeToAcademicExemptions((cloudExemptions) => {
      if (isCancelled) return;
      setAcademicExemptions(cloudExemptions);
      saveStoredAcademicExemptions(cloudExemptions);
    });

    return () => {
      isCancelled = true;
      unsubStaff();
      unsubBookings();
      unsubBlocks();
      unsubSchedule();
      unsubRooms();
      unsubExemptions();
    };
  }, [retryListenerTrigger]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Open booking modal - Checks if offline fallback is active
  const handleOpenBookingModal = (
    room: Room,
    date: string,
    startTime: string,
    endTime: string,
    purpose: PurposeCategory
  ) => {
    if (connectionStatus.status === 'fallback') {
      // Display confirmation warning dialog first before proceeding
      setOfflineBookingPending({ room, date, startTime, endTime, purpose });
      return;
    }
    setBookingModalInfo({ room, date, startTime, endTime, purpose });
  };

  // Submit new booking (Supports single booking or multi-day series)
  const handleSubmitBooking = async (
    data: Omit<AdHocBooking, 'id' | 'status' | 'createdAt'> | Omit<AdHocBooking, 'id' | 'status' | 'createdAt'>[]
  ) => {
    const dataList = Array.isArray(data) ? data : [data];
    const newBookings: AdHocBooking[] = [];

    // Check overlaps for all items in the submission
    for (const item of dataList) {
      const isOverlapping = adhocBookings.some(
        b => b.roomId === item.roomId &&
             b.date === item.date &&
             b.status !== 'REJECTED' &&
             b.status !== 'CANCELLED' &&
             ((item.startTime >= b.startTime && item.startTime < b.endTime) ||
              (item.endTime > b.startTime && item.endTime <= b.endTime) ||
              (item.startTime <= b.startTime && item.endTime >= b.endTime))
      );

      if (isOverlapping) {
        showToast(`⚠️ Ralat: Ruang tersebut telah mempunyai tempahan disahkan pada tarikh ${item.date}!`);
        return;
      }
    }

    const isCurrentlyOffline = connectionStatus.status === 'fallback';
    const nowIso = new Date().toISOString();

    for (let i = 0; i < dataList.length; i++) {
      const item = dataList[i];
      const baseId = generateBookingId();
      const newId = dataList.length > 1 ? `${baseId}-D${i + 1}` : baseId;
      const targetRoom = rooms.find(r => r.id === item.roomId);
      const activeEx = targetRoom ? findActiveExemption(targetRoom, item.date, academicExemptions) : undefined;
      const exemptionId = item.academicExemptionId || activeEx?.id;

      if (isCurrentlyOffline) {
        // SES v4.5: Offline bookings MUST remain PENDING until Firestore confirms the write
        const pendingBooking: AdHocBooking = {
          ...item,
          id: newId,
          ...(exemptionId ? { academicExemptionId: exemptionId } : {}),
          status: 'PENDING',
          syncStatus: 'pending_sync',
          createdAt: nowIso
        };
        enqueuePendingBooking(pendingBooking);
        newBookings.push(pendingBooking);
      } else {
        // Online: Attempt immediate save to Firestore
        const candidateBooking: AdHocBooking = {
          ...item,
          id: newId,
          ...(exemptionId ? { academicExemptionId: exemptionId } : {}),
          status: 'CONFIRMED',
          syncStatus: 'synced',
          syncedAt: nowIso,
          createdAt: nowIso
        };
        try {
          const res = await saveBookingToCloud(candidateBooking, adhocBookings);
          if (res.success) {
            newBookings.push(candidateBooking);
          } else if (res.error && res.error.includes('SLOT_CONFLICT')) {
            showToast(`⚠️ ${res.error.replace('SLOT_CONFLICT: ', '')}`);
            return;
          } else {
            // Save failed -> fallback to PENDING in offline queue
            const failedBooking: AdHocBooking = {
              ...item,
              id: newId,
              ...(exemptionId ? { academicExemptionId: exemptionId } : {}),
              status: 'PENDING',
              syncStatus: 'sync_failed',
              syncError: res.error || 'Gagal menyimpan ke Cloud Firestore',
              createdAt: nowIso
            };
            enqueuePendingBooking(failedBooking);
            newBookings.push(failedBooking);
          }
        } catch (err: any) {
          const failedBooking: AdHocBooking = {
            ...item,
            id: newId,
            ...(exemptionId ? { academicExemptionId: exemptionId } : {}),
            status: 'PENDING',
            syncStatus: 'sync_failed',
            syncError: err?.message || 'Ralat sambungan Cloud',
            createdAt: nowIso
          };
          enqueuePendingBooking(failedBooking);
          newBookings.push(failedBooking);
        }
      }
    }

    if (newBookings.length > 0 && newBookings[0].applicantEmail) {
      saveUserProfile({
        applicantName: newBookings[0].applicantName,
        applicantEmail: newBookings[0].applicantEmail,
        applicantRole: newBookings[0].applicantRole,
        department: newBookings[0].department,
        applicantPhone: newBookings[0].applicantPhone
      });
    }

    const updated = [...newBookings, ...adhocBookings];
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    setBookingModalInfo(null);
    setQrModalBooking(newBookings[0]);

    const hasPending = newBookings.some(b => b.status === 'PENDING');
    if (hasPending) {
      if (newBookings.length > 1) {
        showToast(`⚠️ ${newBookings.length} siri tempahan disimpan secara LUAR TALIAN (PENDING). Akan disinkronkan secara automatik apabila sambungan pulih.`);
      } else {
        showToast(`⚠️ Tempahan ${newBookings[0].id} disimpan secara LUAR TALIAN (PENDING). Akan disinkronkan sebaik sahaja Cloud pulih.`);
      }
    } else {
      if (newBookings.length > 1) {
        showToast(`🟢 Berjaya! ${newBookings.length} siri tempahan di ${newBookings[0].roomName} (11–13 Okt 2026, 4pm–11pm) telah disahkan!`);
      } else {
        showToast(`🟢 Tempahan ${newBookings[0].id} di ${newBookings[0].roomName} berjaya disahkan & disimpan ke Cloud!`);
      }
    }
  };

  // Cancel booking
  const handleCancelBooking = async (bookingId: string) => {
    dequeuePendingBooking(bookingId);
    const updated = adhocBookings.filter(b => b.id !== bookingId);
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    try {
      await deleteBookingFromCloud(bookingId);
    } catch (err) {
      console.error('Cloud sync error on cancel booking:', err);
    }

    showToast(`Tempahan ID ${bookingId} telah dibatalkan.`);
  };

  // Admin approvals
  const handleApproveBooking = async (id: string) => {
    const target = adhocBookings.find(b => b.id === id);
    const updated = adhocBookings.map(b => b.id === id ? { ...b, status: 'CONFIRMED' as const } : b);
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    if (target) {
      try {
        await saveBookingToCloud({ ...target, status: 'CONFIRMED' });
      } catch (err) {
        console.error('Cloud sync error on approve:', err);
      }
    }

    showToast(`🟢 Tempahan ${id} telah diluluskan oleh Admin.`);
  };

  const handleRejectBooking = async (id: string) => {
    const target = adhocBookings.find(b => b.id === id);
    const updated = adhocBookings.map(b => b.id === id ? { ...b, status: 'REJECTED' as const } : b);
    setAdhocBookings(updated);
    saveStoredAdHocBookings(updated);

    if (target) {
      try {
        await saveBookingToCloud({ ...target, status: 'REJECTED' });
      } catch (err) {
        console.error('Cloud sync error on reject:', err);
      }
    }

    showToast(`🔴 Tempahan ${id} telah ditolak.`);
  };

  // Institutional block management
  const handleAddBlock = async (blockData: Omit<InstitutionalBlock, 'id'>) => {
    const newBlock: InstitutionalBlock = {
      ...blockData,
      id: `BLK-${Date.now()}`
    };
    const updated = [newBlock, ...institutionalBlocks];
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);

    try {
      await saveBlockToCloud(newBlock);
    } catch (err) {
      console.error('Cloud sync error on block:', err);
    }

    showToast(`⚫ Lock Ruang ${blockData.roomId} berjaya ditambah.`);
  };

  const handleBatchAddBlocks = async (blocksData: Omit<InstitutionalBlock, 'id'>[]) => {
    const timestamp = Date.now();
    const batchId = `BATCH-${timestamp}`;
    const newBlocks: InstitutionalBlock[] = blocksData.map((b, index) => ({
      ...b,
      id: `BLK-${timestamp}-${index + 1}`,
      batchId: b.batchId || batchId
    }));

    const updated = [...newBlocks, ...institutionalBlocks];
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);

    try {
      await bulkSaveBlocksToCloud(newBlocks);
    } catch (err) {
      console.error('Cloud sync error on batch blocks:', err);
    }

    showToast(`🔒 ${newBlocks.length} Sekatan Ruang Peperiksaan/Institusi berjaya dikunci & disimpan.`);
  };

  const handleDeleteBlock = async (id: string) => {
    const updated = institutionalBlocks.filter(b => b.id !== id);
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);

    try {
      await deleteBlockFromCloud(id);
    } catch (err) {
      console.error('Cloud sync error on delete block:', err);
    }

    showToast(`Lock Ruang telah dipadam.`);
  };

  const handleDeleteBatchBlocks = async (batchIdOrIds: string[]) => {
    const idSet = new Set(batchIdOrIds);
    const updated = institutionalBlocks.filter(b => !idSet.has(b.id) && (!b.batchId || !idSet.has(b.batchId)));
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);

    try {
      await bulkDeleteBlocksFromCloud(batchIdOrIds);
    } catch (err) {
      console.error('Cloud sync error on batch delete blocks:', err);
    }

    showToast(`🔓 Sekatan Ruang telah dinyahkunci.`);
  };

  // Staff sync (Supports 'merge' and 'replace' mode)
  const handleSyncStaffUsers = async (
    newStaffList: StaffUser[],
    mode: 'merge' | 'replace' = 'merge',
    resetAllPins: boolean = false
  ): Promise<{ written: number; deleted: number }> => {
    try {
      // 1. In 'replace' mode:
      // Remove localStorage key kpmbp_staff_cache_v1 first as specified
      if (mode === 'replace') {
        localStorage.removeItem('kpmbp_staff_cache_v1');
      }

      // 2. Persist to Cloud Firestore with replace or merge logic
      let result = { written: newStaffList.length, deleted: 0, updatedList: newStaffList };
      try {
        result = await bulkSaveStaffUsersToCloud(newStaffList, mode, resetAllPins);
      } catch (cloudErr) {
        console.warn('Direct Firestore staff write fallback to local & server storage:', cloudErr);
      }
      const finalStaffList = result.updatedList || newStaffList;

      // 3. Save new list to localStorage & React state
      setStaffUsers(finalStaffList);
      saveStoredStaffUsers(finalStaffList);

      // Also sync to server-side credential vault if server API is reachable
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        fetch('/api/auth/staff-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffList: finalStaffList, mode }),
        }).catch(() => {});
      }

      if (mode === 'replace') {
        showToast(`🟢 Mod Ganti Semua: ${result.written} rekod staf disimpan, ${result.deleted} rekod lama dipadamkan dari Cloud.`);
      } else {
        showToast(`🟢 ${result.written} rekod staf berjaya disinkronkan ke Cloud Firebase!`);
      }

      return { written: result.written, deleted: result.deleted };
    } catch (err) {
      console.error('Error syncing staff users:', err);
      showToast(`🔴 Ralat semasa menyinkronkan data staf.`);
      throw err;
    }
  };

  // Academic schedule sync (Supports Merge and Replace mode)
  const handleSyncAcademicSchedule = async (newSchedule: AcademicScheduleSlot[], mode: 'replace' | 'merge' = 'merge') => {
    let finalSchedule: AcademicScheduleSlot[];

    if (mode === 'merge') {
      const affectedRooms = new Set(newSchedule.map(s => s.roomId.toUpperCase()));
      const untouchedSlots = academicSchedule.filter(s => !affectedRooms.has(s.roomId.toUpperCase()));
      finalSchedule = [...untouchedSlots, ...newSchedule];
    } else {
      // Total replace: completely overwrite existing schedule
      finalSchedule = newSchedule;
    }

    setAcademicSchedule(finalSchedule);
    saveStoredAcademicSchedule(finalSchedule);
    try {
      await bulkSaveScheduleToCloud(finalSchedule, mode);
      if (mode === 'replace') {
        showToast(`🟢 Jadual lama dibersihkan dan digantikan secara TOTAL dengan ${newSchedule.length} slot baharu!`);
      } else {
        showToast(`🟢 ${newSchedule.length} slot jadual berjaya disinkronkan & bilik berkaitan dikunci (Mod Gabung)!`);
      }
    } catch (err) {
      console.error('Error syncing academic schedule:', err);
      showToast(`🟡 Slot jadual disimpan secara tempatan.`);
    }
  };

  // Clear / Purge all academic schedule slots
  const handleClearAcademicSchedule = async () => {
    setAcademicSchedule([]);
    saveStoredAcademicSchedule([]);
    try {
      await clearAllScheduleFromCloud();
      showToast(`🟢 Semua data jadual akademik telah dibersihkan sepenuhnya (0 slot aktif).`);
    } catch (err) {
      console.error('Error clearing schedule from cloud:', err);
      showToast(`🟢 Data jadual dibersihkan secara tempatan.`);
    }
  };

  // Save / Update Academic Exemptions (Study Week)
  const handleSaveAcademicExemptions = async (newExemptions: AcademicExemption[]) => {
    setAcademicExemptions(newExemptions);
    saveStoredAcademicExemptions(newExemptions);
    try {
      await saveAcademicExemptionsToCloud(newExemptions);
      showToast('🟢 Pengecualian jadual hakiki berjaya diselaraskan ke Cloud.');
    } catch (err: any) {
      console.error('Error saving exemptions to cloud:', err);
      showToast('🟡 Pengecualian jadual hakiki disimpan secara tempatan.');
    }
  };

  // Sync Rooms Directory (Supports 'merge' and 'replace' mode)
  const handleSyncRooms = async (newRooms: Room[], mode: 'merge' | 'replace' = 'merge') => {
    let finalRooms: Room[];

    if (mode === 'merge') {
      const newRoomsMap = new Map<string, Room>();
      newRooms.forEach(r => {
        newRoomsMap.set(r.id.toUpperCase(), r);
        newRoomsMap.set(r.code.toUpperCase(), r);
      });

      const updatedExisting = rooms.map(existing => {
        const match = newRoomsMap.get(existing.id.toUpperCase()) || newRoomsMap.get(existing.code.toUpperCase());
        return match ? { ...existing, ...match } : existing;
      });

      const existingIds = new Set(rooms.map(r => r.id.toUpperCase()));
      const existingCodes = new Set(rooms.map(r => r.code.toUpperCase()));
      const brandNew = newRooms.filter(r => !existingIds.has(r.id.toUpperCase()) && !existingCodes.has(r.code.toUpperCase()));

      finalRooms = [...updatedExisting, ...brandNew];
    } else {
      // In replace mode, check if any deleted rooms are referenced by active bookings or schedule
      const newRoomIds = new Set(newRooms.map(r => r.id.toUpperCase()));
      const newRoomCodes = new Set(newRooms.map(r => r.code.toUpperCase()));
      const roomsToDelete = rooms.filter(r => !newRoomIds.has(r.id.toUpperCase()) && !newRoomCodes.has(r.code.toUpperCase()));

      if (roomsToDelete.length > 0) {
        const conflicts: string[] = [];
        roomsToDelete.forEach(deletedRoom => {
          const bookingCount = adhocBookings.filter(b => 
            (b.roomId && b.roomId.toUpperCase() === deletedRoom.id.toUpperCase()) ||
            (b.roomName && b.roomName.toUpperCase() === deletedRoom.name.toUpperCase())
          ).length;
          const scheduleCount = academicSchedule.filter(s =>
            (s.roomId && s.roomId.toUpperCase() === deletedRoom.id.toUpperCase())
          ).length;

          if (bookingCount > 0 || scheduleCount > 0) {
            conflicts.push(`• ${deletedRoom.name} (${deletedRoom.id}): ${bookingCount} tempahan, ${scheduleCount} slot jadual`);
          }
        });

        if (conflicts.length > 0) {
          const proceed = window.confirm(
            `⚠️ AMARAN: RUANG MEMPUNYAI RUJUKAN AKTIF!\n\nRuang berikut akan dipadamkan dalam mod 'Ganti Semua' tetapi masih mempunyai rekod berkaitan:\n\n${conflicts.join('\n')}\n\nMemadamkan ruang ini boleh menyebabkan tempahan/jadual kehilangan maklumat bilik.\n\nAdakah anda pasti mahu memadamkan ruang ini daripada Cloud?`
          );
          if (!proceed) {
            showToast('ℹ️ Operasi ganti ruang dibatalkan untuk melindungi integriti tempahan.');
            return;
          }
        }

        try {
          await deleteRoomsFromCloud(roomsToDelete.map(r => r.id));
        } catch (delErr: any) {
          console.warn('Gagal memadam dokumen ruang lama dari Cloud:', delErr);
        }
      }

      finalRooms = newRooms;
    }

    setRooms(finalRooms);
    saveStoredRooms(finalRooms);

    try {
      await bulkSaveRoomsToCloud(finalRooms);
      showToast(`🟢 ${finalRooms.length} maklumat ruang kuliah berjaya disinkronkan & disimpan ke Cloud!`);
    } catch (err: any) {
      console.error('Error syncing rooms to cloud:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast(`🔴 Ralat Cloud: ${errorMsg}. Maklumat ruang disimpan secara tempatan.`);
      throw err;
    }
  };

  // Seed actual rooms list to Cloud Firestore (with verification)
  const handleSeedRoomsToCloud = async (roomsToSeed: Room[]): Promise<{ count: number }> => {
    try {
      const res = await seedRoomsToCloud(roomsToSeed);
      setRooms(roomsToSeed);
      saveStoredRooms(roomsToSeed);
      showToast(`🟢 Berjaya! ${res.count} ruang telah disahkan disimpan dalam Cloud Firestore.`);
      return res;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Ralat seed ruang ke cloud:', err);
      showToast(`🔴 Gagal Seed: ${msg}`);
      throw err;
    }
  };

  // Resync fresh rooms list from Cloud Firestore
  const handleRefreshRoomsFromCloud = async (): Promise<void> => {
    try {
      invalidateStaticCache('rooms');
      const cloudRooms = await fetchRoomsOnceWithCache();
      if (cloudRooms && cloudRooms.length > 0) {
        setRooms(cloudRooms);
        saveStoredRooms(cloudRooms);
        showToast(`🟢 Direktori ruang berjaya disegerakkan semula dari Cloud (${cloudRooms.length} ruang).`);
      } else {
        showToast(`ℹ️ Tiada data ruang ditemui di Cloud.`);
      }
    } catch (err: any) {
      console.error('Ralat refresh rooms dari cloud:', err);
      showToast(`🔴 Gagal menyegerakkan semula dari Cloud.`);
    }
  };

  // Resync fresh staff list from Cloud Firestore
  const handleRefreshStaffFromCloud = async (): Promise<void> => {
    try {
      const refreshed = await refreshStaffUsersFromCloud();
      if (refreshed && refreshed.length > 0) {
        const deduplicated = deduplicateStaffById(refreshed);
        setStaffUsers(deduplicated);
        saveStoredStaffUsers(deduplicated);
        showToast(`🟢 Data staf dan status PIN terkini telah disegerakkan dari Cloud (${deduplicated.length} rekod).`);
      } else {
        showToast(`ℹ️ Tiada rekod staf ditemui di Cloud.`);
      }
    } catch (err: any) {
      console.error('Ralat refresh staf dari cloud:', err);
      showToast(`🔴 Gagal menyegerakkan staf dari Cloud.`);
    }
  };

  // Reset to defaults (Strict Zero Demo Data)
  const handleResetData = async () => {
    resetToDefaults();
    purgeAllDemoDataLocal();
    await cleanObsoleteDemoRecordsFromCloud();
    setRooms(getStoredRooms());
    setAcademicSchedule(getStoredAcademicSchedule());
    setAdhocBookings([]);
    setInstitutionalBlocks([]);
    showToast(`🟢 Data sistem ditetapkan ke Master Data rasmi (Sifar Data Demo).`);
  };

  const handleSyncBookings = async (newBookings: AdHocBooking[], mode: 'merge' | 'replace' = 'replace') => {
    let finalBookings: AdHocBooking[];
    if (mode === 'merge') {
      const existingMap = new Map<string, AdHocBooking>();
      adhocBookings.forEach(b => existingMap.set(b.id, b));
      newBookings.forEach(b => existingMap.set(b.id, b));
      finalBookings = Array.from(existingMap.values());
    } else {
      finalBookings = newBookings;
    }
    setAdhocBookings(finalBookings);
    saveStoredAdHocBookings(finalBookings);

    try {
      await bulkSaveBookingsToCloud(finalBookings);
      showToast(`🟢 ${newBookings.length} rekod tempahan ad-hoc berjaya dikembalikan & disimpan!`);
    } catch (err) {
      console.warn('Error syncing bookings to cloud:', err);
      showToast(`🟢 ${newBookings.length} rekod tempahan ad-hoc disimpan secara tempatan.`);
    }
  };

  // Admin Remark & Slot Alignment Handlers
  const handleUpdateAcademicSlot = async (updatedSlot: AcademicScheduleSlot) => {
    const updated = academicSchedule.map(s => s.id === updatedSlot.id ? updatedSlot : s);
    setAcademicSchedule(updated);
    saveStoredAcademicSchedule(updated);
    try {
      await saveScheduleSlotToCloud(updatedSlot);
    } catch (err) {
      console.warn('Error saving schedule slot to cloud:', err);
    }
    showToast(`🟢 Remark slot jadual (${updatedSlot.roomId} ${updatedSlot.startTime}–${updatedSlot.endTime}) telah dikemas kini.`);
  };

  const handleUpdateBooking = async (updatedBooking: AdHocBooking) => {
    updateStoredBooking(updatedBooking);
    const updated = adhocBookings.map(b => b.id === updatedBooking.id ? updatedBooking : b);
    setAdhocBookings(updated);
    try {
      await saveBookingToCloud(updatedBooking);
    } catch (err) {
      console.warn('Error saving booking to cloud:', err);
    }
    showToast(`🟢 Maklumat tempahan (${updatedBooking.roomName}) telah dikemas kini.`);
  };

  const handleUpdateBlock = async (updatedBlock: InstitutionalBlock) => {
    const updated = institutionalBlocks.map(b => b.id === updatedBlock.id ? updatedBlock : b);
    setInstitutionalBlocks(updated);
    saveStoredInstitutionalBlocks(updated);
    try {
      await saveBlockToCloud(updatedBlock);
    } catch (err) {
      console.warn('Error saving block to cloud:', err);
    }
    showToast(`🟢 Remark sekatan (${updatedBlock.title}) telah dikemas kini.`);
  };

  const pendingCount = adhocBookings.filter(b => b.status === 'PENDING').length;

  const getTabBreadcrumb = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard & Ringkasan Utama';
      case 'matrix': return 'Lihat Ketersediaan Ruang';
      case 'academic': return 'Locked (Jadual Rasmi)';
      case 'mybookings': return 'My Booking & Pas QR';
      case 'directory': return 'Direktori 42 Ruang KPMBP';
      case 'admin': return 'Admin Access & Kawalan Pentadbir';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-blue-500 flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Horizontal Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        pendingCount={pendingCount}
        staffList={staffUsers}
        isAdmin={isAdminUnlocked}
        onLogoutAdmin={handleLogoutAdmin}
        onRequirePinChange={(st) => setMandatoryPinChangeStaff(st)}
      />

      {/* Offline Fallback Alert Banner */}
      <OfflineFallbackBanner
        connectionStatus={connectionStatus}
        onRetry={handleRetryConnection}
        isRetrying={isRetryingConnection}
        pendingQueueCount={pendingQueueCount}
        isSyncingQueue={isSyncingQueue}
        onSyncQueue={() => handleSyncPendingQueue(false)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View Section */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 lg:p-6 space-y-4">
          {/* Quick Action Navigation Grid (Paparan Pantas untuk setiap seksyen) */}
          <QuickNavGrid
            activeTab={activeTab}
            onNavigateTab={handleSelectTab}
            pendingCount={pendingCount}
          />

          {activeTab === 'dashboard' && (
            <DashboardOverview
              rooms={rooms}
              academicSchedule={academicSchedule}
              adhocBookings={adhocBookings}
              institutionalBlocks={institutionalBlocks}
              staffList={staffUsers}
              exemptions={academicExemptions}
              onNavigateTab={handleSelectTab}
              onOpenBookingModal={handleOpenBookingModal}
            />
          )}

          {activeTab === 'matrix' && (
            <RoomAvailabilityMatrix
              rooms={rooms}
              academicSchedule={academicSchedule}
              adhocBookings={adhocBookings}
              institutionalBlocks={institutionalBlocks}
              exemptions={academicExemptions}
              onOpenBookingModal={handleOpenBookingModal}
              onViewRoomDetails={(room) => {
                setActiveTab('directory');
              }}
              isAdmin={isAdminUnlocked}
              onAdminUnlock={() => {
                setIsAdminUnlocked(true);
                sessionStorage.setItem('kpmbp_admin_unlocked', 'true');
              }}
              onUpdateAcademicSlot={handleUpdateAcademicSlot}
              onUpdateBooking={handleUpdateBooking}
              onUpdateBlock={handleUpdateBlock}
            />
          )}

          {activeTab === 'academic' && (
            <AcademicScheduleView
              schedule={academicSchedule}
              rooms={rooms}
              exemptions={academicExemptions}
            />
          )}

          {activeTab === 'mybookings' && (
            <MyBookingsView
              bookings={adhocBookings}
              staffList={staffUsers}
              isAdmin={isAdminUnlocked}
              onOpenQRModal={(b) => setQrModalBooking(b)}
              onCancelBooking={handleCancelBooking}
              onRequirePinChange={(st) => setMandatoryPinChangeStaff(st)}
            />
          )}

          {activeTab === 'directory' && (
            <RoomDirectoryView
              rooms={rooms}
              onOpenBookingModal={handleOpenBookingModal}
            />
          )}

          {activeTab === 'admin' && (
            <AdminManagementView
              bookings={adhocBookings}
              rooms={rooms}
              staffList={staffUsers}
              academicSchedule={academicSchedule}
              institutionalBlocks={institutionalBlocks}
              academicExemptions={academicExemptions}
              onApproveBooking={handleApproveBooking}
              onRejectBooking={handleRejectBooking}
              onResetData={handleResetData}
              onSyncStaffUsers={handleSyncStaffUsers}
              onSyncAcademicSchedule={handleSyncAcademicSchedule}
              onClearAcademicSchedule={handleClearAcademicSchedule}
              onSyncRooms={handleSyncRooms}
              onSeedRoomsToCloud={handleSeedRoomsToCloud}
              onRefreshRoomsFromCloud={handleRefreshRoomsFromCloud}
              onAddBlock={handleAddBlock}
              onBatchAddBlocks={handleBatchAddBlocks}
              onDeleteBlock={handleDeleteBlock}
              onDeleteBatchBlocks={handleDeleteBatchBlocks}
              onLogoutAdmin={handleLogoutAdmin}
              onSyncBookings={handleSyncBookings}
              onNavigateTab={handleSelectTab}
              onRefreshStaffFromCloud={handleRefreshStaffFromCloud}
              onSaveAcademicExemptions={handleSaveAcademicExemptions}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-xs text-slate-400 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <p className="text-slate-400 text-xs">
                Developed by{' '}
                <a
                  href="https://www.syncrozz.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline font-semibold transition"
                >
                  Syncrozz
                </a>
              </p>
              <a
                href="https://wa.me/60145313756"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center opacity-90 hover:opacity-100 hover:scale-105 transition-all"
                title="Hubungi melalui WhatsApp"
                aria-label="WhatsApp Syncrozz"
              >
                <img
                  src="https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/MAIN/Logo%20Whatapp%20v2.png"
                  alt="WhatsApp"
                  className="w-5 h-5 object-contain block"
                  referrerPolicy="no-referrer"
                />
              </a>
            </div>

            <div>
              <button
                type="button"
                id="footer-support-cta"
                onClick={() => setIsSupportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/5 hover:border-white/10 text-white/50 hover:text-white/80 text-[11px] font-normal transition cursor-pointer"
                title="Support ❤️"
              >
                <span>Support</span>
                <span className="text-rose-400/60 text-[11px]">❤️</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Support Experience Popup Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Booking Dialog Modal */}
      {bookingModalInfo && (
        <BookingModal
          room={bookingModalInfo.room}
          date={bookingModalInfo.date}
          startTime={bookingModalInfo.startTime}
          endTime={bookingModalInfo.endTime}
          initialPurpose={bookingModalInfo.purpose}
          staffList={staffUsers}
          academicSchedule={academicSchedule}
          adhocBookings={adhocBookings}
          institutionalBlocks={institutionalBlocks}
          exemptions={academicExemptions}
          isAdmin={isAdminUnlocked}
          isFallbackMode={connectionStatus.status === 'fallback'}
          onClose={() => setBookingModalInfo(null)}
          onSubmitBooking={handleSubmitBooking}
          onRequirePinChange={(st) => setMandatoryPinChangeStaff(st)}
        />
      )}

      {/* MANDATORY OWNER PIN CHANGE MODAL */}
      {mandatoryPinChangeStaff && (
        <SetPinModal
          staff={mandatoryPinChangeStaff}
          isOpen={true}
          onSuccess={handlePinChangeSuccess}
        />
      )}

      {/* QR Access Pass Modal */}
      {qrModalBooking && (
        <QRCodeModal
          booking={qrModalBooking}
          onClose={() => setQrModalBooking(null)}
        />
      )}

      {/* ADMIN PIN ACCESS MODAL */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAdminPinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Pengesahan Admin Access
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pentadbir Ruang & Sistem KPMBP
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Sila masukkan <strong>Passcode / PIN Keselamatan Master Admin</strong> untuk membuka akses ruang pentadbir:
            </p>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  <span>Passcode / PIN Admin:</span>
                </label>
                <input
                  type="password"
                  autoFocus
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    if (adminPinError) setAdminPinError(null);
                  }}
                  placeholder="Masukkan PIN Keselamatan"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
                />
              </div>

              {adminPinError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{adminPinError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminPinModal(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingAdminPin}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isVerifyingAdminPin ? 'Mengesahkan...' : 'Akses Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offline Booking Warning Confirmation Dialog */}
      {offlineBookingPending && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-amber-400 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Pengesahan Tempahan Luar Talian
                </h3>
                <p className="text-xs text-amber-700 font-semibold mt-0.5">
                  Pangkalan data dalam mod luar talian
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4">
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                Anda sedang dalam mod luar talian. Tempahan ini TIDAK akan dilihat oleh staf lain dan boleh bertindih dengan tempahan mereka. Teruskan?
              </p>
            </div>

            <div className="text-xs text-slate-500 space-y-1 mb-5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Ruang Dipilih:</span>
                <span className="font-bold text-slate-900">{offlineBookingPending.room.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Tarikh & Masa:</span>
                <span className="font-mono text-slate-800">{offlineBookingPending.date} ({offlineBookingPending.startTime} - {offlineBookingPending.endTime})</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setOfflineBookingPending(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const pending = offlineBookingPending;
                  setOfflineBookingPending(null);
                  setBookingModalInfo(pending);
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-amber-600/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Teruskan</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
