/**
 * SYNCROZZ DEPLOYMENT RELIABILITY (SDR) ENGINE
 * Application: BookBK KPMBP
 * Engineering Standard: SES v4.4
 *
 * Provides authoritative build identity verification, periodic deployment checks,
 * unsaved user operation protection, and post-reload synchronization verification.
 */

import { RUNTIME_BUILD_ID, RUNTIME_BUILD_TIME, RUNTIME_MVR, AppDeploymentMeta } from '../config/buildMeta';
import { MANUAL_VERSION_REMARK } from '../config/version';

export type DeploymentSyncStatus =
  | 'UP TO DATE'
  | 'UPDATE AVAILABLE'
  | 'UPDATING'
  | 'UPDATE VERIFIED'
  | 'UPDATE FAILED'
  | 'OFFLINE — VERSION NOT VERIFIED';

export interface DeploymentState {
  status: DeploymentSyncStatus;
  runtimeBuildId: string;
  runtimeMvr: string;
  runtimeBuildTime: string;
  productionBuildId: string | null;
  productionMvr: string | null;
  productionBuildTime: string | null;
  lastChecked: string | null;
  errorMsg: string | null;
  hasUpdate: boolean;
  isVerifying: boolean;
}

// Session Storage Keys for SDR
const STORAGE_TARGET_BUILD = 'bookbk_sdr_target_build_id';
const STORAGE_RELOAD_TIME = 'bookbk_sdr_last_reload_time';
const STORAGE_RELOAD_COUNT = 'bookbk_sdr_reload_count';

// Active Operation Guards for Unsaved User Input
const activeGuardsMap = new Map<string, () => boolean>();

/**
 * Daftarkan penjaga operasi aktif (contoh: borang sedang disunting, transaksi sedang berjalan)
 * Mengembalikan fungsi pembersihan (unregister).
 */
export function registerUnsavedOperationGuard(guardName: string, isBusyChecker: () => boolean): () => void {
  activeGuardsMap.set(guardName, isBusyChecker);
  return () => {
    activeGuardsMap.delete(guardName);
  };
}

/**
 * Semak sama ada terdapat borang atau transaksi aktif yang belum selesai.
 */
export function hasActiveUnsavedOperations(): { isBusy: boolean; activeGuards: string[] } {
  const busyGuards: string[] = [];
  activeGuardsMap.forEach((checker, name) => {
    try {
      if (checker()) {
        busyGuards.push(name);
      }
    } catch (e) {
      console.warn(`[SDR] Guard checker '${name}' error:`, e);
    }
  });
  return {
    isBusy: busyGuards.length > 0,
    activeGuards: busyGuards,
  };
}

// Global SDR State
let currentState: DeploymentState = (() => {
  // Check post-reload verification state
  let initialStatus: DeploymentSyncStatus = 'UP TO DATE';
  let initialError: string | null = null;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const targetBuild = window.sessionStorage.getItem(STORAGE_TARGET_BUILD);
      if (targetBuild) {
        if (targetBuild === RUNTIME_BUILD_ID) {
          initialStatus = 'UPDATE VERIFIED';
          window.sessionStorage.removeItem(STORAGE_TARGET_BUILD);
          window.sessionStorage.removeItem(STORAGE_RELOAD_COUNT);
        } else {
          initialStatus = 'UPDATE FAILED';
          initialError = `Versi selepas muat semula (${RUNTIME_BUILD_ID}) tidak sepadan dengan sasaran (${targetBuild}).`;
        }
      }
    } catch {
      // Ignore sessionStorage access errors
    }
  }

  return {
    status: initialStatus,
    runtimeBuildId: RUNTIME_BUILD_ID,
    runtimeMvr: MANUAL_VERSION_REMARK || RUNTIME_MVR,
    runtimeBuildTime: RUNTIME_BUILD_TIME,
    productionBuildId: null,
    productionMvr: null,
    productionBuildTime: null,
    lastChecked: null,
    errorMsg: initialError,
    hasUpdate: false,
    isVerifying: false,
  };
})();

const listeners = new Set<(state: DeploymentState) => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (e) {
      console.error('[SDR] Listener error:', e);
    }
  });
}

/**
 * Dapatkan snapshot keadaan SDR terkini.
 */
export function getDeploymentState(): DeploymentState {
  return currentState;
}

/**
 * Langgan kepada perubahan keadaan SDR.
 */
export function subscribeDeploymentStatus(listener: (state: DeploymentState) => void): () => void {
  listeners.add(listener);
  // Send current state immediately on subscription
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Semak versi terkini yang aktif di pelayan produksi melalui /version.json.
 */
export async function checkProductionDeployment(): Promise<DeploymentState> {
  if (typeof window === 'undefined') {
    return currentState;
  }

  // Handle browser offline detection
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    currentState = {
      ...currentState,
      status: 'OFFLINE — VERSION NOT VERIFIED',
      isVerifying: false,
      lastChecked: new Date().toISOString(),
      errorMsg: 'Sambungan luar talian. Tidak dapat mengesahkan versi produksi.',
    };
    notifyListeners();
    return currentState;
  }

  currentState = {
    ...currentState,
    isVerifying: true,
  };
  notifyListeners();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const timestamp = Date.now();
    const endpoint = `/version.json?_sdr_t=${timestamp}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Endpoint /version.json membalas status ${response.status} (${response.statusText})`);
    }

    const payload = (await response.json()) as AppDeploymentMeta;

    if (!payload || !payload.buildId) {
      throw new Error('Format balasan /version.json tidak sah.');
    }

    const isDifferentBuild = payload.buildId !== RUNTIME_BUILD_ID;
    let nextStatus: DeploymentSyncStatus;

    if (isDifferentBuild) {
      nextStatus = 'UPDATE AVAILABLE';
    } else if (currentState.status === 'UPDATE VERIFIED') {
      nextStatus = 'UPDATE VERIFIED';
    } else {
      nextStatus = 'UP TO DATE';
    }

    currentState = {
      ...currentState,
      status: nextStatus,
      productionBuildId: payload.buildId,
      productionMvr: payload.mvr || null,
      productionBuildTime: payload.buildTime || null,
      lastChecked: new Date().toISOString(),
      errorMsg: null,
      hasUpdate: isDifferentBuild,
      isVerifying: false,
    };

    notifyListeners();
    return currentState;
  } catch (error: any) {
    clearTimeout(timeoutId);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isAbort = error?.name === 'AbortError';

    const errorMsg = isOffline
      ? 'Sambungan luar talian.'
      : isAbort
      ? 'Masa tamat sambungan ke /version.json.'
      : error?.message || 'Gagal menghubungi /version.json.';

    currentState = {
      ...currentState,
      status: isOffline ? 'OFFLINE — VERSION NOT VERIFIED' : currentState.status,
      isVerifying: false,
      lastChecked: new Date().toISOString(),
      errorMsg,
    };

    notifyListeners();
    return currentState;
  }
}

/**
 * Laksanakan tindakan kemas kini selamat ke versi baharu.
 * Menyemak penjaga operasi, mencegah kitaran muat semula tanpa henti,
 * dan memuat semula aplikasi dengan rekod verifikasi.
 */
export async function applyDeploymentUpdate(options: { force?: boolean } = {}): Promise<{
  success: boolean;
  cancelled?: boolean;
  reason?: string;
  activeGuards?: string[];
}> {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'SSR environment' };
  }

  // 1. Guard against interrupting unsaved user input
  if (!options.force) {
    const check = hasActiveUnsavedOperations();
    if (check.isBusy) {
      return {
        success: false,
        cancelled: true,
        reason: 'unsaved_operations',
        activeGuards: check.activeGuards,
      };
    }
  }

  // 2. Prevent infinite reload loop
  try {
    const rawCount = window.sessionStorage.getItem(STORAGE_RELOAD_COUNT);
    const rawTime = window.sessionStorage.getItem(STORAGE_RELOAD_TIME);
    const count = rawCount ? parseInt(rawCount, 10) : 0;
    const lastTime = rawTime ? parseInt(rawTime, 10) : 0;
    const now = Date.now();

    // If more than 2 reloads within 15 seconds without success, trigger safety stop
    if (count >= 2 && now - lastTime < 15000) {
      currentState = {
        ...currentState,
        status: 'UPDATE FAILED',
        errorMsg: 'Kitaran muat semula dihentikan untuk mengelakkan ralat berulang. Sila buat Hard Refresh secara manual.',
      };
      notifyListeners();
      return {
        success: false,
        reason: 'infinite_loop_prevented',
      };
    }

    window.sessionStorage.setItem(STORAGE_RELOAD_COUNT, String(count + 1));
    window.sessionStorage.setItem(STORAGE_RELOAD_TIME, String(now));
    if (currentState.productionBuildId) {
      window.sessionStorage.setItem(STORAGE_TARGET_BUILD, currentState.productionBuildId);
    }
  } catch {
    // SessionStorage failure fallback
  }

  // 3. Set updating status
  currentState = {
    ...currentState,
    status: 'UPDATING',
  };
  notifyListeners();

  // 4. Send message to Service Worker to skip waiting
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {
      console.warn('[SDR] Failed to postMessage SKIP_WAITING to SW:', e);
    }
  }

  // 5. Clean shell caches safely (does NOT touch IndexedDB or user Firestore data)
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.includes('shell') || key.includes('v1') || key.includes('smarthub')) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.warn('[SDR] Cache cleanup warning:', e);
    }
  }

  // Short delay for clean state flush then reload
  setTimeout(() => {
    // Append unique cache-busting query parameter for complete browser cache bypass
    const url = new URL(window.location.href);
    url.searchParams.set('_sdr_sync', String(Date.now()));
    window.location.replace(url.toString());
  }, 100);

  return { success: true };
}

/**
 * Mulakan auto-checker kitaran hayat:
 * - Setiap 60 saat
 * - Apabila tab memperoleh fokus
 * - Apabila sambungan internet dipulihkan
 */
let isAutoCheckerInitialized = false;

export function initDeploymentAutoChecker(): () => void {
  if (typeof window === 'undefined' || isAutoCheckerInitialized) {
    return () => {};
  }

  isAutoCheckerInitialized = true;

  // 1. Initial check after app mount
  setTimeout(() => {
    checkProductionDeployment();
  }, 1500);

  // 2. Periodic check every 60 seconds
  const intervalId = setInterval(() => {
    checkProductionDeployment();
  }, 60000);

  // 3. Tab visibility / focus handlers
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkProductionDeployment();
    }
  };

  const handleFocus = () => {
    checkProductionDeployment();
  };

  // 4. Online network event handler
  const handleOnline = () => {
    checkProductionDeployment();
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('online', handleOnline);

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
    isAutoCheckerInitialized = false;
  };
}
