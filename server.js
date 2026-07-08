'use strict';
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Reuse parent database connections and query builder
const pool = require('./src/config/db');
const { queryTable } = require('./src/utils/queryBuilder');

const { normaliseRole } = require('./src/utils/roleHelper');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = parseInt(process.env.ADMIN_PORT || '8001', 10);

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessions stored in RDS Postgres (reuse user_sessions table)
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    errorLog: (err) => console.error('[pgSession Error]', err.message),
  }),
  secret: process.env.SESSION_SECRET || 'thrustvault-change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 86400000, // 24 hours
    sameSite: 'lax',
  },
}));

// Endpoint Table name mapper to query public schema
const tableMap = {
  'users': 'user_profiles',
  'user_profiles': 'user_profiles',
  'custom_specs': 'custom_specs_schema',
  'custom-specs': 'custom_specs_schema',
  'custom_specs_schema': 'custom_specs_schema',
  'categories': 'categories',
  'motors': 'motors',
  'access_requests': 'access_requests',
  'access-requests': 'access_requests',
  'motor_test_runs': 'motor_test_runs',
  'motor-test-runs': 'motor_test_runs',
  'motor_test_data_points': 'motor_test_data_points',
  'motor-test-data-points': 'motor_test_data_points',
  'draft_test_runs': 'draft_test_runs',
  'draft-test-runs': 'draft_test_runs',
  'user_onboarding': 'user_onboarding',
  'user-onboarding': 'user_onboarding',
  'system_settings': 'system_settings',
  'system-settings': 'system_settings',
  'escs': 'escs',
  'propellers': 'propellers'
};

// Route security middleware checking for active session + 'admin' role
app.use((req, res, next) => {
  const publicPaths = [
    '/login',
    '/login.html',
    '/login.js',
    '/page-loader.js',
    '/favicon_dark.png',
    '/favicon_light.png',
    '/logo_dark.png',
    '/logo_light.png',
    '/style.css'
  ];

  const isPublicFile = publicPaths.includes(req.path) ||
    req.path.startsWith('/libs/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/api/auth/') ||
    req.path.startsWith('/api/guest/') ||
    req.path.startsWith('/api/public/') ||
    req.path.startsWith('/motor/') ||
    req.path.startsWith('/esc/') ||
    req.path.startsWith('/propeller/') ||
    req.path.startsWith('/share/') ||
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp)$/i.test(req.path);

  if (isPublicFile) {
    return next();
  }

  const role = req.session ? req.session.role : null;
  const ts = req.session ? req.session.timestamp || 0 : 0;

  if (!role || role !== 'admin' || (Date.now() - ts > 86400000)) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized: Admin access required.' });
    }
    return res.redirect('/login');
  }

  next();
});

// Serve static assets from public/ folder or React dist
const ADMIN_FRONTEND_DIST = path.join(__dirname, 'frontend', 'dist');

if (require('fs').existsSync(ADMIN_FRONTEND_DIST)) {
  app.use(express.static(ADMIN_FRONTEND_DIST));
  app.use('/admin', express.static(ADMIN_FRONTEND_DIST));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(ADMIN_FRONTEND_DIST, 'index.html'));
  });
} else {
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/admin', express.static(path.join(__dirname, 'public')));

  // HTML Page Routes Redirections
  app.get('/', (req, res) => res.redirect('/admin/dashboard'));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

  app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_dashboard.html')));
  app.get('/admin/users', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_users.html')));
  app.get('/admin/access-requests', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_access_requests.html')));
  app.get('/admin/schema-customizer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_schema_customizer.html')));
  app.get('/admin/audit-logs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_audit_logs.html')));
  app.get('/admin/exports', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_exports.html')));
  app.get('/admin/imports', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin_imports.html')));
  app.get('/admin/analytics', (req, res) => res.sendFile(path.join(__dirname, 'public', 'performance_analytics.html')));
  app.get('/admin/explorer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'motor_explorer.html')));
  app.get(['/admin/escs', '/admin/escs/:model', '/admin/esc/:model'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'esc_explorer.html')));
  app.get(['/admin/propellers', '/admin/propellers/:model', '/admin/propeller/:model'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'propeller_explorer.html')));
}

// ── Authentication APIs ──────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  try {
    const profileRes = await pool.query('SELECT id, role, password_hash FROM public.user_profiles WHERE email = $1', [email]);
    const profile = profileRes.rows[0];
    if (!profile) return res.status(400).json({ error: 'Invalid email or password' });
    if (!profile.password_hash) return res.status(400).json({ error: 'Account has no password set. Contact an admin.' });

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid email or password' });

    const role = normaliseRole(profile.role);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Admin role required for the admin portal.' });
    }

    req.session.email = email;
    req.session.role = role;
    req.session.uid = profile.id;
    req.session.timestamp = Date.now();

    return res.json({ email, role: 'admin', uid: profile.id, timestamp: req.session.timestamp });

  } catch (err) {
    console.error('[Login Error]', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/session', (req, res) => {
  const role = req.session.role;
  const ts = req.session.timestamp || 0;
  if (!role || role !== 'admin' || Date.now() - ts > 86400000) {
    return res.json({ logged_in: false });
  }
  res.json({ logged_in: true, email: req.session.email, role: 'admin', uid: req.session.uid });
});

// Create User account (admin check is handled by root security middleware)
app.post('/api/user-profiles', async (req, res) => {
  const { email, role, password } = req.body || {};
  if (!email || !role || !password) {
    return res.status(400).json({ error: 'Email, role, and password are required.' });
  }
  const client = await pool.connect();
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const newUid = crypto.randomUUID();
    
    await client.query('BEGIN');
    await client.query('INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [newUid, email.trim().toLowerCase()]);
    const result = await client.query(
      'INSERT INTO public.user_profiles (id, email, role, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash RETURNING id, email, role, created_at',
      [newUid, email.trim().toLowerCase(), role, password_hash]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Create User Error]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Update User (role or password)
app.patch('/api/user-profiles/:id', async (req, res) => {
  const { id } = req.params;
  const { role, password } = req.body || {};
  
  try {
    const updates = [];
    const vals = [];
    let idx = 1;
    
    if (role) {
      updates.push(`role = $${idx++}`);
      vals.push(role);
    }
    
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      vals.push(password_hash);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No update parameters provided.' });
    }
    
    vals.push(id);
    const sql = `UPDATE public.user_profiles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, role, created_at`;
    const result = await pool.query(sql, vals);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json(result.rows[0]);
  } catch (e) {
    console.error('[Update User Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Delete User account
app.delete('/api/user-profiles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM public.user_profiles WHERE id = $1 RETURNING id, email', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true, message: `Account for ${result.rows[0].email} deleted successfully.` });
  } catch (e) {
    console.error('[Delete User Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Process access requests action (approve/reject, create user profile and trigger email)
app.post('/api/admin/access-requests/:id/action', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body || {};
  
  if (action !== 'approved' && action !== 'rejected') {
    return res.status(400).json({ error: "Invalid action. Must be 'approved' or 'rejected'." });
  }
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const reqRes = await client.query('SELECT full_name, email, justification, status FROM public.access_requests WHERE id = $1', [id]);
      const accessReq = reqRes.rows[0];
      if (!accessReq) {
        throw new Error('Access request not found');
      }
      
      if (accessReq.status !== 'pending') {
        throw new Error('Request has already been processed');
      }
      
      await client.query('UPDATE public.access_requests SET status = $1 WHERE id = $2', [action, id]);
      
      let tempPassword = null;
      if (action === 'approved') {
        tempPassword = crypto.randomBytes(6).toString('hex') + 'V@' + Math.floor(Math.random() * 100);
        const password_hash = await bcrypt.hash(tempPassword, 10);
        const newUid = crypto.randomUUID();
        
        await client.query('INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [newUid, accessReq.email]);
        await client.query(
          `INSERT INTO public.user_profiles (id, email, role, password_hash)
           VALUES ($1, $2, 'user', $3)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
          [newUid, accessReq.email, password_hash]
        );
      }
      
      await client.query('COMMIT');
      
      sendResendEmailHelper({
        type: action,
        to: accessReq.email,
        full_name: accessReq.full_name,
        temp_password: tempPassword,
        requested_role: 'user'
      }).catch(err => console.error('[Action Email Error]', err));
      
      res.json({ success: true, status: action });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[Access Request Action Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Change Password for currently logged in admin user
app.post('/api/auth/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!req.session.uid) {
    return res.status(401).json({ error: 'Unauthorized: Session not active.' });
  }
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  try {
    const userRes = await pool.query('SELECT password_hash FROM public.user_profiles WHERE id = $1', [req.session.uid]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Incorrect current password.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE public.user_profiles SET password_hash = $1 WHERE id = $2', [newHash, req.session.uid]);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (e) {
    console.error('[Change Password Error]', e.message);
    res.status(500).json({ error: e.message });
  }
});


// Send OTP email via Resend API
async function sendOtpEmail(email, otp) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const https = require('https');
  const body = JSON.stringify({
    from:    'ThrustVault <noreply@thrustvault.bharani-01.xyz>',
    to:      [email],
    subject: 'ThrustVault — Password Reset Code',
    html:    `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:12px;">
        <h2 style="color:#001e40;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#475569;font-size:14px;">Use the code below to reset your ThrustVault password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#001e40;color:#fff;font-size:32px;font-weight:800;letter-spacing:12px;text-align:center;padding:24px;border-radius:8px;margin:24px 0;">${otp}</div>
        <p style="color:#94a3b8;font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers:  { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        const parsed = JSON.parse(data);
        if (resp.statusCode >= 400) reject(new Error(parsed.message || 'Resend API error'));
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const profileRes = await pool.query('SELECT id FROM public.user_profiles WHERE email = $1', [email]);
    if (!profileRes.rows.length) return res.json({ success: true }); // Silent success

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await pool.query(
      `INSERT INTO public.password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)`,
      [email, otp, expiresAt]
    );

    await sendOtpEmail(email, otp);
    res.json({ success: true });
  } catch (e) {
    console.error('[ForgotPassword Error]', e.message);
    res.status(500).json({ error: 'Failed to send reset code. Try again.' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, token } = req.body || {};
  if (!email || !token) return res.status(400).json({ error: 'Email and token required' });
  req.session.reset_email = email;
  req.session.reset_code = token;
  req.session.reset_ts = Date.now();
  res.json({ success: true });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { reset_email, reset_code, reset_ts } = req.session;
  if (!reset_email || !reset_code || Date.now() - (reset_ts || 0) > 600000) {
    return res.status(400).json({ error: 'Password reset session expired. Please start again.' });
  }
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const tokenRes = await pool.query(
      `SELECT id FROM public.password_reset_tokens
       WHERE email = $1 AND token = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [reset_email, reset_code]
    );
    if (!tokenRes.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE public.user_profiles SET password_hash = $1 WHERE email = $2', [hash, reset_email]);
    await pool.query('UPDATE public.password_reset_tokens SET used = TRUE WHERE id = $1', [tokenRes.rows[0].id]);

    req.session.destroy(() => { });
    res.json({ success: true });
  } catch (e) {
    console.error('[ResetPassword Error]', e.message);
    res.status(500).json({ error: 'Failed to reset password. Try again.' });
  }
});

// ── Admin-Only System Actions APIs ──────────────────────────────────────────────

// Dynamic settings (Auto-Approve configuration)
app.get('/api/admin/settings', async (req, res) => {
  try {
    const settingsRes = await pool.query("SELECT value FROM public.system_settings WHERE key = 'auto_approve'");
    const autoApproveVal = settingsRes.rows[0]?.value;
    res.json({ auto_approve: autoApproveVal === true || autoApproveVal === 'true' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  const { key, value } = req.body || {};
  if (key !== 'auto_approve') return res.status(400).json({ error: 'Invalid setting key' });
  try {
    await pool.query(
      `INSERT INTO public.system_settings (key, value) 
       VALUES ($1, $2::jsonb) 
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// RPC wrapper to create a new vault user securely (directly in the database)
app.post('/api/admin/rpc/create_vault_user', async (req, res) => {
  const { email_val, password_val, role_val } = req.body || {};
  if (!email_val || !password_val || !role_val) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    const newUid = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password_val, 12);

    await client.query('BEGIN');
    await client.query('INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING', [newUid, email_val]);
    await client.query(`
      INSERT INTO public.user_profiles (id, email, role, password_hash)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
    `, [newUid, email_val, role_val, passwordHash]);
    await client.query('COMMIT');

    res.json(newUid);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[create_vault_user RPC] error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// RPC wrapper to delete/ban a vault user securely (directly in the database)
app.post('/api/admin/rpc/delete_vault_user', async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete user onboarding data
    await client.query('DELETE FROM public.user_onboarding WHERE user_id = $1', [user_id]);

    // 2. Delete public profile records
    await client.query('DELETE FROM public.user_profiles WHERE id = $1', [user_id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[delete_vault_user RPC] error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Recovery Action Link Generator Mock Endpoint
app.post('/api/admin/auth/generate-link', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const origin = `${req.protocol}://${req.get('host')}`;
  const actionLink = `${origin}/login?reset_email=${encodeURIComponent(email)}`;
  res.json({
    properties: {
      action_link: actionLink
    }
  });
});

// Audit Logs fetch endpoint
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logsRes = await pool.query('SELECT * FROM public.audit_logs ORDER BY timestamp DESC LIMIT 500');
    res.json(logsRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System Activity Log submission
app.post('/api/log-activity', async (req, res) => {
  const { email, role, action, details } = req.body || {};
  try {
    await pool.query(
      `INSERT INTO public.audit_logs (email, role, route, method, status, ip_address, user_agent, risk_level, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      [
        email || req.session.email || 'Anonymous',
        role || req.session.role || 'Anonymous',
        action || 'API-Activity',
        req.method || 'POST',
        200,
        req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        req.headers['user-agent'] || 'Node Client',
        'info',
        details || ''
      ]
    );
    res.json({ success: true });
  } catch (e) {
    console.warn('[log-activity] Warning:', e.message);
    res.json({ success: false });
  }
});

// Helper function for Resend email dispatch
async function sendResendEmailHelper({ type, to, full_name, temp_password, reset_link, requested_role }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 're_placeholder_key') {
    console.warn('EMAIL SYSTEM WARNING: RESEND_API_KEY is not configured. Email dispatch skipped.');
    return { success: true, warning: 'Email dispatch skipped: API key unconfigured' };
  }

  const appUrl = process.env.APP_BASE_URL || 'https://thrustvault.bharani-01.xyz';
  let subject = '';
  let html = '';

  if (type === 'received') {
    subject = 'ThrustVault Access Request Received';
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #2563eb; margin: 0; font-family: sans-serif;">ThrustVault Access Request</h2>
          </div>
          <p>Hello ${full_name || 'Applicant'},</p>
          <p>Thank you for requesting access to the <strong>ThrustVault UAV Motor Database Console</strong>. We have received your request.</p>
          <p>Our administrators are currently reviewing your application. You will receive an email notification once a decision has been made.</p>
          <p>You can visit the console home page here: <a href="${appUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${appUrl}</a></p>
          <p style="margin-top: 30px; font-size: 0.82rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an automated notification from ThrustVault. Please do not reply directly to this email.
          </p>
      </div>
    `;
  } else if (type === 'approved' || type === 'created') {
    const roleName = (requested_role || 'user').toUpperCase();
    subject = type === 'approved' ? 'ThrustVault Access Approved' : 'ThrustVault Account Created';

    let credentialsTable = `
      <table style="background-color: #f8fafc; padding: 15px; border-radius: 8px; width: 100%; border: 1px solid #e2e8f0; font-family: monospace; margin: 15px 0;">
          <tr><td style="padding: 5px;"><strong>Email:</strong></td><td style="padding: 5px;">${to}</td></tr>
          <tr><td style="padding: 5px;"><strong>Role:</strong></td><td style="padding: 5px;">${roleName}</td></tr>
    `;

    if (temp_password) {
      credentialsTable += `<tr><td style="padding: 5px;"><strong>Default Password:</strong></td><td style="padding: 5px;"><code>${temp_password}</code></td></tr>`;
    }
    credentialsTable += `</table>`;

    let linkSection = '';
    if (reset_link) {
      linkSection = `
        <p>You can use the recovery link below to set your password:</p>
        <p><a href="${reset_link}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Set Your Password</a></p>
      `;
    } else {
      linkSection = `
        <p>You can log in to the console here:</p>
        <p><a href="${appUrl}/login" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: sans-serif;">Log In to ThrustVault</a></p>
      `;
    }

    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #059669; margin: 0; font-family: sans-serif;">ThrustVault Access Granted</h2>
          </div>
          <p>Hello ${full_name || 'User'},</p>
          <p>Your account access to the <strong>ThrustVault UAV Motor Database Console</strong> has been configured.</p>
          ${credentialsTable}
          ${linkSection}
          <p style="margin-top: 30px; font-size: 0.82rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an automated notification from ThrustVault. Please do not reply directly to this email.
          </p>
      </div>
    `;
  } else if (type === 'rejected') {
    subject = 'ThrustVault Access Request Update';
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #e11d48; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #e11d48; margin: 0; font-family: sans-serif;">Access Request Declined</h2>
          </div>
          <p>Hello ${full_name || 'Applicant'},</p>
          <p>Thank you for your interest in the <strong>ThrustVault UAV Motor Database Console</strong>.</p>
          <p>We regret to inform you that your request for credentials has been declined at this time by our administrators.</p>
          <p style="margin-top: 30px; font-size: 0.82rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an automated notification from ThrustVault. Please do not reply directly to this email.
          </p>
      </div>
    `;
  } else {
    throw new Error('Invalid email notification type');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'ThrustVault <onboarding@bharani-01.xyz>',
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Resend API returned status ${response.status}: ${errBody}`);
  }
  return { success: true };
}

// Email dispatch API route
app.post('/api/send-email', async (req, res) => {
  try {
    const result = await sendResendEmailHelper(req.body || {});
    res.json(result);
  } catch (err) {
    console.error('Failed to send email via Resend:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// System performance and database stats endpoint
app.get('/api/admin/statistics', async (req, res) => {
  try {
    const [motorsCount, categoriesCount, requestsCount, usersCount] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM public.motors'),
      pool.query('SELECT COUNT(*)::int AS count FROM public.categories'),
      pool.query("SELECT COUNT(*)::int AS count FROM public.access_requests WHERE status = 'pending'"),
      pool.query('SELECT COUNT(*)::int AS count FROM public.user_profiles')
    ]);

    const cpuLoad = os.loadavg();
    const cpuCores = os.cpus().length;
    const cpuPercent = Math.min(100, (cpuLoad[0] / cpuCores) * 100);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = (usedMem / totalMem) * 100;

    res.json({
      cpu_load: cpuLoad,
      cpu_load_percent: cpuPercent,
      ram_total_gb: totalMem / (1024 * 1024 * 1024),
      ram_used_gb: usedMem / (1024 * 1024 * 1024),
      ram_free_gb: freeMem / (1024 * 1024 * 1024),
      ram_percent: ramPercent,
      total_motors: motorsCount.rows[0].count,
      total_categories: categoriesCount.rows[0].count,
      pending_requests: requestsCount.rows[0].count,
      total_users: usersCount.rows[0].count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User onboarding fetch & save overrides
app.get('/api/admin/onboarding', async (req, res) => {
  const uid = req.session.uid;
  try {
    const r = await pool.query('SELECT * FROM public.user_onboarding WHERE user_id = $1', [uid]);
    res.json(r.rows[0] || { user_id: uid, pages_progress: {}, tour_completed: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/onboarding', async (req, res) => {
  const uid = req.session.uid;
  const payload = { ...req.body, user_id: uid };
  try {
    const ex = await pool.query('SELECT id FROM public.user_onboarding WHERE user_id = $1', [uid]);
    if (ex.rows.length > 0) {
      const data = await queryTable('user_onboarding', 'PATCH', payload, { user_id: `eq.${uid}` });
      res.json(data);
    } else {
      const data = await queryTable('user_onboarding', 'POST', payload, null);
      res.json(data);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Override: patch user profiles endpoint to sync with auth.users metadata
app.patch('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!role) return res.status(400).json({ error: 'Role is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u1 = await client.query(
      `UPDATE public.user_profiles SET role = $1 WHERE id = $2 RETURNING *`,
      [role, id]
    );

    await client.query(
      `UPDATE auth.users SET raw_user_meta_data = json_build_object('role', $1::text)::jsonb WHERE id = $2`,
      [role, id]
    );

    await client.query('COMMIT');
    res.json(u1.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Custom handler for motor test data points to support relation join select queries
app.get(['/api/admin/motor-test-data-points', '/api/admin/motor_test_data_points'], async (req, res) => {
  try {
    const { test_run_id, select, order } = req.query;

    // Check if we need the join
    const hasJoin = select && select.includes('motor_test_runs');

    let sql = '';
    let vals = [];

    if (hasJoin) {
      sql = `
        SELECT dp.*, row_to_json(r.*) as motor_test_runs
        FROM public.motor_test_data_points dp
        JOIN public.motor_test_runs r ON dp.test_run_id = r.id
      `;

      const whereParts = [];
      if (test_run_id) {
        if (test_run_id.startsWith('eq.')) {
          const val = test_run_id.slice(3);
          whereParts.push(`dp.test_run_id = $${vals.length + 1}`);
          vals.push(val);
        } else if (test_run_id.startsWith('in.(')) {
          const valStr = test_run_id.slice(4, -1);
          const ids = valStr.split(',').map(id => id.trim());
          whereParts.push(`dp.test_run_id = ANY($${vals.length + 1})`);
          vals.push(ids);
        }
      }

      if (whereParts.length) {
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }

      if (order) {
        const orderParts = order.split(',');
        const orderClauses = orderParts.map(item => {
          const parts = item.trim().split('.');
          const col = parts[0];
          const dir = parts[1] === 'desc' ? 'DESC' : 'ASC';
          if (!/^[a-zA-Z0-9_]+$/.test(col)) throw new Error('Invalid order column');
          return `dp."${col}" ${dir}`;
        });
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      } else {
        sql += ` ORDER BY dp.throttle ASC`;
      }

      const dbRes = await pool.query(sql, vals);
      res.json(dbRes.rows);
    } else {
      // Fallback to the generic queryTable logic
      const data = await queryTable('motor_test_data_points', 'GET', null, req.query);
      res.json(data);
    }
  } catch (err) {
    console.error('[Custom data-points handler error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Override users GET endpoint to list accounts directly from public.user_profiles with strictly no fallback
app.get('/api/admin/users', async (req, res) => {
  try {
    const usersRes = await pool.query('SELECT id, email, role, created_at FROM public.user_profiles');
    let users = usersRes.rows.map(r => ({
      id: r.id,
      email: r.email,
      created_at: r.created_at,
      role: r.role
    }));

    // Sort by email.asc if requested
    if (req.query.order === 'email.asc') {
      users.sort((a, b) => a.email.localeCompare(b.email));
    }

    return res.json(users);

  } catch (err) {
    console.error('[GET /api/admin/users Error]:', err.message);
    return res.status(500).json({ error: `Failed to fetch users: ${err.message}` });
  }
});

// ── Catalog Init-Data API Endpoint ──────────────────────────────────────────────

let cachedDashboardStats = null;

// Call this whenever motors are inserted/updated/deleted to bust the cache
function bustStatsCache() {
  cachedDashboardStats = null;
}

async function getOrCalculateStats() {
  if (cachedDashboardStats) return cachedDashboardStats;
  try {
    const res = await pool.query('SELECT max_thrust, recommended_esc, motor_name, custom_parameters FROM public.motors');
    const allMotors = res.rows;
    const totalMotors = allMotors.length;

    // Handles: "1.202", "1.202kg", "1202g", "1202.0g", pure number
    function parseThrustToKg(thrustStr) {
      if (!thrustStr || String(thrustStr).trim().toLowerCase() === 'n/a') return 0;
      const normalized = String(thrustStr).trim().toLowerCase().replace(/\s+/g, '');
      // Plain number (already in kg, as seeded)
      const pureNum = normalized.match(/^([0-9.]+)$/);
      if (pureNum) return parseFloat(pureNum[1]);
      // Number with unit suffix
      const withUnit = normalized.match(/^([0-9.]+)(kg|g)$/);
      if (withUnit) {
        const val = parseFloat(withUnit[1]);
        return withUnit[2] === 'g' ? val / 1000 : val;
      }
      // Fallback: grab first number
      const numbers = normalized.match(/[0-9.]+/);
      if (numbers) {
        const val = parseFloat(numbers[0]);
        return (normalized.includes('g') && !normalized.includes('kg')) ? val / 1000 : val;
      }
      return 0;
    }

    let minThrust = Infinity;
    let maxThrust = -Infinity;
    allMotors.forEach(m => {
      const parsed = parseThrustToKg(m.max_thrust);
      if (parsed > 0) {
        if (parsed < minThrust) minThrust = parsed;
        if (parsed > maxThrust) maxThrust = parsed;
      }
    });

    let minThrustVal = 0;
    let maxThrustVal = 0;
    let thrustRangeStr = 'N/A';
    let maxThrustStr = 'N/A';

    if (minThrust !== Infinity && maxThrust !== -Infinity) {
      minThrustVal = minThrust;
      maxThrustVal = maxThrust;
      thrustRangeStr = minThrust === maxThrust
        ? `${minThrust.toFixed(2)} kg`
        : `${minThrust.toFixed(2)} – ${maxThrust.toFixed(2)} kg`;
      maxThrustStr = `${maxThrust.toFixed(2)} kg`;
    }

    // Extract all S-cell ratings from ESC names, motor names, and custom_parameters
    let sRatings = [];
    allMotors.forEach(m => {
      const customParams = m.custom_parameters || {};
      const v = (customParams.voltage || customParams.voltage_v || customParams.operating_voltage)
        ? String(customParams.voltage || customParams.voltage_v || customParams.operating_voltage)
        : '';
      const esc = m.recommended_esc || '';
      const name = m.motor_name || '';

      // Find ALL S-rating occurrences in each field (e.g. "6S", "12S", "24S")
      const allSources = `${v} ${esc} ${name}`;
      const matches = allSources.match(/(\d{1,2})s/gi) || [];
      matches.forEach(match => {
        const val = parseInt(match, 10);
        if (val >= 1 && val <= 24) sRatings.push(val);
      });
    });

    let voltageRangeStr = 'N/A';
    if (sRatings.length > 0) {
      const minS = Math.min(...sRatings);
      const maxS = Math.max(...sRatings);
      voltageRangeStr = minS === maxS ? `${minS}S` : `${minS}S – ${maxS}S`;
    }

    cachedDashboardStats = {
      total_motors: totalMotors,
      min_thrust: minThrustVal,
      max_thrust: maxThrustVal,
      thrust_range: thrustRangeStr,
      max_thrust_str: maxThrustStr,
      voltage_range: voltageRangeStr
    };

    return cachedDashboardStats;
  } catch (err) {
    console.error('Error calculating stats:', err);
    return {
      total_motors: 0,
      min_thrust: 0,
      max_thrust: 0,
      thrust_range: 'N/A',
      max_thrust_str: 'N/A',
      voltage_range: 'N/A'
    };
  }
}

app.get('/api/init-data', async (req, res) => {
  const LIMIT = 15;
  try {
    const [cats, counts, schema, motors, kpis, brandsQuery] = await Promise.all([
      pool.query('SELECT id, name, description FROM public.categories ORDER BY name'),
      pool.query('SELECT category_id, COUNT(*)::int AS cnt FROM public.motors GROUP BY category_id'),
      pool.query('SELECT * FROM public.custom_specs_schema ORDER BY created_at'),
      pool.query(`SELECT id, category_id, motor_name, company, max_thrust,
                         recommended_esc, recommended_propeller,
                         link_motor, link_esc, link_propeller, custom_parameters, uploaded_by,
                         main_image, gallery_images
                  FROM public.motors
                  ORDER BY CASE WHEN max_thrust ~ '^[0-9]+(\\.[0-9]+)?$' THEN max_thrust::numeric ELSE 0 END ASC
                  LIMIT $1`, [LIMIT]),
      getOrCalculateStats(),
      pool.query("SELECT DISTINCT company FROM public.motors WHERE company IS NOT NULL AND company != '' ORDER BY company")
    ]);

    const categoryCounts = {};
    counts.rows.forEach(r => {
      if (r.category_id) categoryCounts[String(r.category_id)] = r.cnt;
    });

    res.json({
      categories: cats.rows,
      category_counts: categoryCounts,
      custom_schema: schema.rows,
      first_motors: motors.rows,
      has_more: motors.rows.length >= LIMIT,
      dashboard_stats: kpis,
      brands: brandsQuery.rows.map(r => r.company).filter(Boolean)
    });
  } catch (e) {
    console.error('[admin init-data error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Standalone Guest & Public Specification Share Handlers ──────────────────────
app.get('/api/guest/share/:type/:name', async (req, res) => {
  const { type, name } = req.params;
  if (!type || !name) return res.status(400).json({ error: 'Type and name required' });
  
  const decodedName = decodeURIComponent(name).trim();
  const lowerType = type.toLowerCase();
  
  try {
    let queryResult;
    if (lowerType === 'motor') {
      let sql = `
        SELECT m.*, c.name AS category_name
        FROM public.motors m
        LEFT JOIN public.categories c ON m.category_id = c.id
        WHERE LOWER(m.motor_name) = LOWER($1) OR LOWER(m.id::text) = LOWER($1)
      `;
      queryResult = await pool.query(sql, [decodedName]);
      if (!queryResult.rows.length) {
        queryResult = await pool.query(`
          SELECT m.*, c.name AS category_name
          FROM public.motors m
          LEFT JOIN public.categories c ON m.category_id = c.id
          WHERE m.motor_name ILIKE $1
          LIMIT 1
        `, [`%${decodedName}%`]);
      }
    } else if (lowerType === 'esc') {
      let sql = `SELECT * FROM public.escs WHERE LOWER(name) = LOWER($1) OR LOWER(id::text) = LOWER($1)`;
      queryResult = await pool.query(sql, [decodedName]);
      if (!queryResult.rows.length) {
        queryResult = await pool.query(`SELECT * FROM public.escs WHERE name ILIKE $1 LIMIT 1`, [`%${decodedName}%`]);
      }
    } else if (lowerType === 'propeller') {
      let sql = `SELECT * FROM public.propellers WHERE LOWER(name) = LOWER($1) OR LOWER(id::text) = LOWER($1)`;
      queryResult = await pool.query(sql, [decodedName]);
      if (!queryResult.rows.length) {
        queryResult = await pool.query(`SELECT * FROM public.propellers WHERE name ILIKE $1 LIMIT 1`, [`%${decodedName}%`]);
      }
    }

    if (!queryResult || !queryResult.rows.length) {
      return res.status(404).json({ error: `${type} "${decodedName}" not found.` });
    }

    const item = queryResult.rows[0];
    item.name = item.name || item.motor_name || item.motor;
    item.motor_name = item.motor_name || item.name;
    item.motor = item.motor || item.motor_name || item.name;
    item.brand = item.brand || item.company;
    item.company = item.company || item.brand;
    item.main_image = item.main_image || item.mainImage;
    item.mainImage = item.mainImage || item.main_image;
    item.gallery_images = item.gallery_images || item.galleryImages;
    item.galleryImages = item.galleryImages || item.gallery_images;

    if (item.custom_parameters && typeof item.custom_parameters === 'string') {
      try { item.custom_parameters = JSON.parse(item.custom_parameters); } catch (e) {}
    }
    if (item.gallery_images && typeof item.gallery_images === 'string') {
      try { item.gallery_images = JSON.parse(item.gallery_images); } catch (e) {}
    }

    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/public/find-item/:name', async (req, res) => {
  const { name } = req.params;
  if (!name) return res.status(400).json({ error: 'Missing name parameter' });
  const decodedName = decodeURIComponent(name).trim();
  
  try {
    let motorRes = await pool.query(`SELECT id, motor_name AS name FROM public.motors WHERE LOWER(motor_name) = LOWER($1) LIMIT 1`, [decodedName]);
    if (!motorRes.rows.length) {
      motorRes = await pool.query(`SELECT id, motor_name AS name FROM public.motors WHERE motor_name ILIKE $1 LIMIT 1`, [`%${decodedName}%`]);
    }
    if (motorRes.rows.length) return res.json({ type: 'motor', id: motorRes.rows[0].id, name: motorRes.rows[0].name });

    let escRes = await pool.query(`SELECT id, name FROM public.escs WHERE LOWER(name) = LOWER($1) LIMIT 1`, [decodedName]);
    if (!escRes.rows.length) {
      escRes = await pool.query(`SELECT id, name FROM public.escs WHERE name ILIKE $1 LIMIT 1`, [`%${decodedName}%`]);
    }
    if (escRes.rows.length) return res.json({ type: 'esc', id: escRes.rows[0].id, name: escRes.rows[0].name });

    let propRes = await pool.query(`SELECT id, name FROM public.propellers WHERE LOWER(name) = LOWER($1) LIMIT 1`, [decodedName]);
    if (!propRes.rows.length) {
      propRes = await pool.query(`SELECT id, name FROM public.propellers WHERE name ILIKE $1 LIMIT 1`, [`%${decodedName}%`]);
    }
    if (propRes.rows.length) return res.json({ type: 'propeller', id: propRes.rows[0].id, name: propRes.rows[0].name });

    return res.status(404).json({ error: 'Item not found' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Generic Table proxy endpoints (enforces tableMap routing constraints)
app.all(['/api/admin/:table', '/api/db/:table', '/api/:table'], async (req, res) => {
  const clientTable = req.params.table;
  const dbTable = tableMap[clientTable] || clientTable.replace(/-/g, '_');

  let method = req.method.toUpperCase();
  if (method === 'PUT') method = 'PATCH';

  try {
    if (method === 'GET') {
      const qp = { ...req.query };
      delete qp.limit;
      delete qp.offset;
      delete qp.order;
      qp.select = 'id';
      const allMatching = await queryTable(dbTable, 'GET', null, qp);
      const totalCount = allMatching.length;

      const data = await queryTable(dbTable, 'GET', null, req.query);
      res.setHeader('X-Total-Count', totalCount);
      res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
      res.json(data);
    } else {
      const payload = ['POST', 'PATCH'].includes(method) ? req.body : null;
      const data = await queryTable(dbTable, method, payload, req.query);
      if (dbTable === 'motors' && ['POST', 'PATCH', 'DELETE'].includes(method)) {
        cachedDashboardStats = null;
      }
      res.json(data);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.all(['/api/admin/:table/:id', '/api/db/:table/:id', '/api/:table/:id'], async (req, res) => {
  const clientTable = req.params.table;
  const dbTable = tableMap[clientTable] || clientTable.replace(/-/g, '_');
  req.query.id = `eq.${req.params.id}`;

  let method = req.method.toUpperCase();
  if (method === 'PUT') method = 'PATCH';

  try {
    const payload = ['POST', 'PATCH'].includes(method) ? req.body : null;
    const data = await queryTable(dbTable, method, payload, req.query);
    if (dbTable === 'motors' && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      cachedDashboardStats = null;
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// fallback 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Standalone Admin Portal running on http://localhost:${PORT}`);
});
