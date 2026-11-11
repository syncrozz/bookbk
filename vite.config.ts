import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import crypto from 'crypto';
import { defineConfig, Plugin } from 'vite';
import { MANUAL_VERSION_REMARK } from './src/config/version';

function generateBuildId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const hm = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const salt = crypto.randomBytes(3).toString('hex');
  return `build-${ymd}-${hm}-${salt}`;
}

const currentBuildId = process.env.BOOKBK_BUILD_ID || generateBuildId();
const currentBuildTime = new Date().toISOString();

function sdrDeploymentPlugin(buildId: string, buildTime: string, mvr: string): Plugin {
  const versionPayload = JSON.stringify(
    {
      buildId,
      buildTime,
      mvr,
      schema: 'syncrozz.sdr.v1',
    },
    null,
    2
  );

  return {
    name: 'syncrozz-sdr-version-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionPayload,
      });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.end(versionPayload);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      sdrDeploymentPlugin(currentBuildId, currentBuildTime, MANUAL_VERSION_REMARK)
    ],
    define: {
      __APP_BUILD_ID__: JSON.stringify(currentBuildId),
      __APP_BUILD_TIME__: JSON.stringify(currentBuildTime),
      __APP_MVR__: JSON.stringify(MANUAL_VERSION_REMARK),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
