import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { serverAuthVault, createStaffFirebaseCustomToken } from './src/server/auth-service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // In AI Studio development, dev server must run on port 3000 (container port 8080 is reserved for proxy)
  const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000;
  const HOST = '0.0.0.0';

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'UP',
      service: 'KPMBP SmartHub API Engine',
      security: 'scrypt-N16384-r8-p1',
      timestamp: new Date().toISOString(),
    });
  });

  // Secure Server-Side Staff Verification Endpoint (scrypt + rate limiting + Firebase Custom Token Bridge)
  app.post('/api/auth/staff-verify', async (req, res) => {
    try {
      const { email, pin } = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      const result = await serverAuthVault.verifyStaff(email, pin, clientIp);

      if (result.isLocked) {
        return res.status(429).json(result);
      }

      if (!result.success) {
        return res.status(401).json(result);
      }

      // Phase 2: Authentication Bridge — Issue Firebase Custom Token if signing credentials exist
      let customToken: string | undefined;
      let tokenBridgeStatus: 'issued' | 'prerequisite_missing' | 'skipped' = 'skipped';

      if (result.staff) {
        const tokenRes = await createStaffFirebaseCustomToken(result.staff);
        if (tokenRes.customToken) {
          customToken = tokenRes.customToken;
          tokenBridgeStatus = 'issued';
        } else if (tokenRes.prerequisiteMissing) {
          tokenBridgeStatus = 'prerequisite_missing';
        }
      }

      return res.status(200).json({
        ...result,
        customToken,
        tokenBridgeStatus,
      });
    } catch (err) {
      console.error('Error during staff verification:', err);
      return res.status(500).json({ success: false, errorMsg: 'Ralat pelayan dalaman.' });
    }
  });

  // Secure Server-Side Staff PIN Update Endpoint (Authentication, Authorization & Rate Limiting)
  app.post('/api/auth/staff-update-pin', async (req, res) => {
    try {
      const { staffId, newPin, currentPin, adminPasscode } = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const headerPasscode = req.headers['x-admin-passcode'] as string | undefined;

      if (!staffId || !newPin) {
        return res.status(400).json({ success: false, errorMsg: 'staffId dan newPin diperlukan.' });
      }

      const result = await serverAuthVault.updateStaffPin(staffId, newPin, {
        clientIp,
        currentPin,
        adminPasscode: adminPasscode || headerPasscode,
        skipAuth: false,
      });

      if (result.isLocked) {
        return res.status(429).json(result);
      }

      if (!result.success) {
        return res.status(401).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('Error during staff PIN update:', err);
      return res.status(500).json({ success: false, errorMsg: 'Ralat pelayan dalaman.' });
    }
  });

  // Secure Server-Side Staff PIN Reset (Default 1234 - Requires Master Admin Authorization)
  app.post('/api/auth/staff-reset-pin', async (req, res) => {
    try {
      const { staffId, adminPasscode } = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const headerPasscode = req.headers['x-admin-passcode'] as string | undefined;

      if (!staffId) {
        return res.status(400).json({ success: false, errorMsg: 'staffId diperlukan.' });
      }

      const result = await serverAuthVault.resetStaffPin(staffId, {
        clientIp,
        adminPasscode: adminPasscode || headerPasscode,
        skipAuth: false,
      });

      if (result.isLocked) {
        return res.status(429).json(result);
      }

      if (!result.success) {
        return res.status(403).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('Error during staff PIN reset:', err);
      return res.status(500).json({ success: false, errorMsg: 'Ralat pelayan dalaman.' });
    }
  });

  // Secure Server-Side Admin PIN Verification Endpoint (Protected by Server-Side Rate Limiter)
  app.post('/api/auth/admin-verify', async (req, res) => {
    try {
      const { pin } = req.body || {};
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const cleanPin = typeof pin === 'string' ? pin.trim() : '';

      if (!cleanPin) {
        return res.status(400).json({ success: false, errorMsg: 'PIN Pentadbir diperlukan.' });
      }

      const MASTER_ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || process.env.ADMIN_PIN || '5313';
      const rateKey = `admin_verify_${clientIp}`;

      // 1. Correct master admin passcode always succeeds and unlocks any previous rate lockouts
      if (cleanPin === MASTER_ADMIN_PASSCODE) {
        serverAuthVault.rateLimiter.reset(rateKey);
        return res.status(200).json({ success: true, message: 'Akses Pentadbir disahkan.' });
      }

      // 2. For incorrect attempts, check and record rate limits
      const rateLimitCheck = serverAuthVault.rateLimiter.checkLimit(rateKey);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          success: false,
          isLocked: true,
          errorMsg: `Akses pentadbir dikunci sementara kerana melebihi had cubaan. Sila cuba lagi selepas ${rateLimitCheck.remainingLockoutSeconds} saat.`,
        });
      }

      const fail = serverAuthVault.rateLimiter.recordFailure(rateKey);
      if (fail.locked) {
        return res.status(429).json({
          success: false,
          isLocked: true,
          errorMsg: `Akses pentadbir dikunci sementara kerana melebihi had cubaan. Sila cuba lagi selepas ${fail.remainingLockoutSeconds} saat.`,
        });
      }

      return res.status(401).json({
        success: false,
        errorMsg: 'PIN / Passcode Keselamatan Pentadbir Tidak Sah.',
        remainingAttempts: fail.attemptsLeft,
      });
    } catch (err) {
      console.error('Error during admin PIN verification:', err);
      return res.status(500).json({ success: false, errorMsg: 'Ralat pelayan dalaman.' });
    }
  });

  // Secure Server-Side Staff Unlock Endpoint (Unlocks 15-min rate limit lock)
  app.post('/api/auth/staff-unlock', async (req, res) => {
    try {
      const { staffId, adminPasscode } = req.body || {};
      const headerPasscode = req.headers['x-admin-passcode'] as string | undefined;

      if (!staffId) {
        return res.status(400).json({ success: false, errorMsg: 'staffId diperlukan.' });
      }

      const MASTER_ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || process.env.ADMIN_PIN || '5313';
      if ((adminPasscode || headerPasscode) !== MASTER_ADMIN_PASSCODE) {
        return res.status(403).json({ success: false, errorMsg: 'Passcode Pentadbir diperlukan.' });
      }

      serverAuthVault.unlockStaff(staffId);
      return res.status(200).json({ success: true, message: `Sekatan akaun ${staffId} telah dinyahkunci.` });
    } catch (err) {
      console.error('Error during staff unlock:', err);
      return res.status(500).json({ success: false, errorMsg: 'Ralat pelayan dalaman.' });
    }
  });

  // Secure Server-Side Staff Sync Endpoint (Syncs staff list imported from CSV)
  app.post('/api/auth/staff-sync', async (req, res) => {
    try {
      const { staffList, mode } = req.body || {};
      if (Array.isArray(staffList)) {
        serverAuthVault.syncStaffFromList(staffList, mode);
        return res.status(200).json({ success: true, count: staffList.length });
      }
      return res.status(400).json({ success: false, errorMsg: 'staffList array diperlukan.' });
    } catch (err) {
      console.error('Error during staff sync:', err);
      return res.status(500).json({ success: false, errorMsg: 'Ralat pelayan dalaman.' });
    }
  });

  // Development: Mount Vite middlewares for SPA HMR & bundle serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static assets built by Vite
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[KPMBP SmartHub] Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[KPMBP SmartHub] Failed to start server:', err);
  process.exit(1);
});
