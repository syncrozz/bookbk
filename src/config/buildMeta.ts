/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MANUAL_VERSION_REMARK } from './version';

/**
 * SYNCROZZ DEPLOYMENT RELIABILITY (SDR) — RUNTIME BUILD IDENTITY
 *
 * Nilai pemalar ini disuntik semasa kompilasi Vite (build-time) atau
 * dijana secara autoritatif oleh pelayan semasa sesi pembangunan.
 */
declare const __APP_BUILD_ID__: string | undefined;
declare const __APP_BUILD_TIME__: string | undefined;
declare const __APP_MVR__: string | undefined;

export const RUNTIME_BUILD_ID: string = 
  typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__ 
    ? __APP_BUILD_ID__ 
    : 'dev-runtime-active';

export const RUNTIME_BUILD_TIME: string = 
  typeof __APP_BUILD_TIME__ !== 'undefined' && __APP_BUILD_TIME__ 
    ? __APP_BUILD_TIME__ 
    : new Date().toISOString();

export const RUNTIME_MVR: string = 
  typeof __APP_MVR__ !== 'undefined' && __APP_MVR__ 
    ? __APP_MVR__ 
    : MANUAL_VERSION_REMARK;

export interface AppDeploymentMeta {
  buildId: string;
  buildTime: string;
  mvr: string;
  schema: string;
}

export function getRuntimeDeploymentMeta(): AppDeploymentMeta {
  return {
    buildId: RUNTIME_BUILD_ID,
    buildTime: RUNTIME_BUILD_TIME,
    mvr: RUNTIME_MVR,
    schema: 'syncrozz.sdr.v1',
  };
}
