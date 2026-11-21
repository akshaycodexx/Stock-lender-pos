import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/database.ts';
import type { AuthUser, UserRole } from './src/types.ts';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '6mb' }));

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derivedBuf.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, keyBuf);
}

function isSafeImageUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/src/assets/')) return true;
  if (url.startsWith('data:image/')) {
    return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url);
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

interface AuthedRequest extends Request {
  user?: AuthUser;
}

function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return token;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const row = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  if (new Date(row.expires_at).getTime() < Date.now() || row.is_active !== 1) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.status(401).json({ error: 'Session expired or account disabled' });
    return;
  }

  req.user = {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
  };
  next();
}

function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient access level for this action' });
      return;
    }
    next();
  };
}

function sanitizeItemForRole(item: Record<string, unknown>, role: UserRole) {
  if (role === 'cashier') {
    return { ...item, buying_price: null };
  }
  return item;
}

function sanitizeBillForRole(bill: Record<string, unknown>, role: UserRole) {
  if (role === 'cashier') {
    const items = Array.isArray(bill.items)
      ? bill.items.map((bi: Record<string, unknown>) => ({ ...bi, buying_price: null }))
      : undefined;
    return { ...bill, total_cost: null, ...(items ? { items } : {}) };
  }
  return bill;
}

// --- Public Auth Status & Bootstrap ---
app.get('/api/auth/status', (_req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  const company = db.prepare('SELECT company_name, logo_data FROM company_settings WHERE id = 1').get() as
    | { company_name: string; logo_data: string }
    | undefined;
  const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
  res.json({
    initialized: userCount.cnt > 0,
    envPasscodeConfigured,
    companyName: company?.company_name || 'StockLedger POS',
    companyLogo: company?.logo_data || '',
  });
});

app.post('/api/auth/bootstrap', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (userCount.cnt > 0) {
    res.status(409).json({ error: 'System already initialized. Please sign in.' });
    return;
  }

  const { full_name, username, password, company_name } = req.body as {
    full_name?: string;
    username?: string;
    password?: string;
    company_name?: string;
  };

  const cleanUsername = (username || 'admin').trim().toLowerCase();
  const cleanFullName = (full_name || 'Store Administrator').trim();
  const cleanPassword = (password || '').trim();

  if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUsername)) {
    res.status(400).json({ error: 'Username must be 3-32 characters (letters, numbers, _, ., -).' });
    return;
  }
  if (cleanPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  if (company_name && company_name.trim().length > 0) {
    db.prepare('UPDATE company_settings SET company_name = ?, updated_at = datetime(\'now\') WHERE id = 1').run(
      company_name.trim()
    );
  }

  const hash = hashPassword(cleanPassword);
  const result = db
    .prepare('INSERT INTO users (username, full_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, 1)')
    .run(cleanUsername, cleanFullName, 'admin', hash);

  const user = db
    .prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as AuthUser;

  const token = createSession(user.id);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanPassword = password || '';

  if (!cleanUsername || !cleanPassword) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  const userRow = db
    .prepare('SELECT id, username, full_name, role, password_hash, is_active, created_at FROM users WHERE username = ?')
    .get(cleanUsername) as (AuthUser & { password_hash: string }) | undefined;

  if (cleanUsername === 'admin' && envPasscode && cleanPassword === envPasscode) {
    if (!userRow) {
      const hash = hashPassword(envPasscode);
      const inserted = db
        .prepare('INSERT INTO users (username, full_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, 1)')
        .run('admin', 'Store Administrator', 'admin', hash);
      const created = db
        .prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?')
        .get(Number(inserted.lastInsertRowid)) as unknown as AuthUser;
      const token = createSession(created.id);
      res.json({ token, user: created });
      return;
    }
    const token = createSession(userRow.id);
    res.json({
      token,
      user: {
        id: userRow.id,
        username: userRow.username,
        full_name: userRow.full_name,
        role: userRow.role,
        is_active: userRow.is_active,
        created_at: userRow.created_at,
      },
    });
    return;
  }

  if (!userRow || userRow.is_active !== 1 || !verifyPassword(cleanPassword, userRow.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const token = createSession(userRow.id);
  res.json({
    token,
    user: {
      id: userRow.id,
      username: userRow.username,
      full_name: userRow.full_name,
      role: userRow.role,
      is_active: userRow.is_active,
      created_at: userRow.created_at,
    },
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  const token = (req.headers.authorization || '').slice(7).trim();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res) => {
  const { current_password, new_password } = req.body as {
    current_password?: string;
    new_password?: string;
  };
  if (!current_password || !new_password || new_password.trim().length < 6) {
    res.status(400).json({ error: 'Current password and new password (min 6 chars) are required.' });
    return;
  }

  const row = db
    .prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .get(req.user!.id) as { id: number; password_hash: string } | undefined;

  if (!row || !verifyPassword(current_password, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = hashPassword(new_password.trim());
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, req.user!.id);
  res.json({ ok: true });
});

// --- Company Settings ---
app.get('/api/company', requireAuth, (_req, res) => {
  const settings = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
  res.json(settings);
});

app.put('/api/company', requireAuth, requireRoles('admin'), (req, res) => {
  const {
    company_name,
    tagline,
    gst_number,
    address,
    phone,
    email,
    currency_symbol,
    invoice_footer,
    logo_data,
    bill_template,
    bill_accent_color,
    bill_show_gst,
    bill_show_mrp,
    barcode_template,
    barcode_show_company,
    barcode_show_mrp,
    barcode_height,
  } = req.body as Record<string, unknown>;

  const cleanCompany = String(company_name || '').trim();
  if (!cleanCompany) {
    res.status(400).json({ error: 'Company name is required.' });
    return;
  }

  const cleanLogo = String(logo_data || '');
  if (cleanLogo && !isSafeImageUrl(cleanLogo)) {
    res.status(400).json({ error: 'Invalid logo image format.' });
    return;
  }

  const validBillTpl =
    bill_template === 'modern' || bill_template === 'thermal' || bill_template === 'classic'
      ? bill_template
      : 'classic';
  const validAccent = /^#[0-9A-Fa-f]{6}$/.test(String(bill_accent_color || ''))
    ? String(bill_accent_color)
    : '#0F766E';
  const validBarcodeTpl =
    barcode_template === 'compact' || barcode_template === 'detailed' || barcode_template === 'standard'
      ? barcode_template
      : 'standard';
  const validBarcodeHeight = Math.max(22, Math.min(54, Math.floor(Number(barcode_height) || 34)));

  db.prepare(`
    UPDATE company_settings
    SET company_name = ?, tagline = ?, gst_number = ?, address = ?, phone = ?, email = ?,
        currency_symbol = ?, invoice_footer = ?, logo_data = ?,
        bill_template = ?, bill_accent_color = ?, bill_show_gst = ?, bill_show_mrp = ?,
        barcode_template = ?, barcode_show_company = ?, barcode_show_mrp = ?, barcode_height = ?,
        updated_at = datetime('now')
    WHERE id = 1
  `).run(
    cleanCompany,
    String(tagline || '').trim(),
    String(gst_number || '').trim(),
    String(address || '').trim(),
    String(phone || '').trim(),
    String(email || '').trim(),
    (String(currency_symbol || '₹').trim() || '₹').slice(0, 4),
    String(invoice_footer || '').trim(),
    cleanLogo,
    validBillTpl,
    validAccent,
    bill_show_gst === 0 || bill_show_gst === false ? 0 : 1,
    bill_show_mrp === 0 || bill_show_mrp === false ? 0 : 1,
    validBarcodeTpl,
    barcode_show_company === 0 || barcode_show_company === false ? 0 : 1,
    barcode_show_mrp === 0 || barcode_show_mrp === false ? 0 : 1,
    validBarcodeHeight
  );

  const updated = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
  res.json(updated);
});

// --- Categories Management ---
app.get('/api/categories', requireAuth, (_req, res) => {
  const rows = db
    .prepare(`
      SELECT c.id, c.name, c.description, c.created_at, COUNT(i.id) AS item_count
      FROM categories c
      LEFT JOIN items i ON LOWER(i.category) = LOWER(c.name)
      GROUP BY c.id
      ORDER BY c.name ASC
    `)
    .all();
  res.json(rows);
});

app.post('/api/categories', requireAuth, requireRoles('admin', 'manager'), (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  const cleanName = (name || '').trim();
  if (!cleanName) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  const dup = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(cleanName);
  if (dup) {
    res.status(409).json({ error: 'Category already exists.' });
    return;
  }

  const result = db
    .prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
    .run(cleanName, (description || '').trim());

  const created = db
    .prepare('SELECT id, name, description, 0 AS item_count, created_at FROM categories WHERE id = ?')
    .get(Number(result.lastInsertRowid));
  res.status(201).json(created);
});

app.delete('/api/categories/:id', requireAuth, requireRoles('admin', 'manager'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id) as
    | { id: number; name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }
  if (existing.name.toLowerCase() === 'general') {
    res.status(400).json({ error: 'Default General category cannot be deleted.' });
    return;
  }

  db.prepare("UPDATE items SET category = 'General' WHERE LOWER(category) = LOWER(?)").run(existing.name);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- User Access Levels & Security (Admin Only) ---
app.get('/api/users', requireAuth, requireRoles('admin'), (_req, res) => {
  const users = db
    .prepare('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id ASC')
    .all();
  res.json(users);
});

app.post('/api/users', requireAuth, requireRoles('admin'), (req, res) => {
  const { username, full_name, role, password } = req.body as {
    username?: string;
    full_name?: string;
    role?: UserRole;
    password?: string;
  };

  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanName = (full_name || '').trim();
  const validRole: UserRole = role === 'admin' || role === 'manager' || role === 'cashier' ? role : 'cashier';

  if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUsername)) {
    res.status(400).json({ error: 'Username must be 3-32 alphanumeric/dot/underscore characters.' });
    return;
  }
  if (!cleanName) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!password || password.trim().length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (exists) {
    res.status(409).json({ error: 'Username already exists.' });
    return;
  }

  const hash = hashPassword(password.trim());
  const result = db
    .prepare('INSERT INTO users (username, full_name, role, password_hash, is_active) VALUES (?, ?, ?, ?, 1)')
    .run(cleanUsername, cleanName, validRole, hash);

  const created = db
    .prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?')
    .get(Number(result.lastInsertRowid));
  res.status(201).json(created);
});

app.patch('/api/users/:id', requireAuth, requireRoles('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { role, is_active, new_password, full_name } = req.body as {
    role?: UserRole;
    is_active?: number;
    new_password?: string;
    full_name?: string;
  };

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as AuthUser | undefined;
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (id === req.user!.id && is_active === 0) {
    res.status(400).json({ error: 'You cannot deactivate your own active admin account.' });
    return;
  }

  const nextRole = role && ['admin', 'manager', 'cashier'].includes(role) ? role : existing.role;
  const nextActive = typeof is_active === 'number' ? (is_active ? 1 : 0) : existing.is_active;
  const nextName = full_name && full_name.trim() ? full_name.trim() : existing.full_name;

  db.prepare('UPDATE users SET role = ?, is_active = ?, full_name = ? WHERE id = ?').run(
    nextRole,
    nextActive,
    nextName,
    id
  );

  if (new_password && new_password.trim().length > 0) {
    if (new_password.trim().length < 6) {
      res.status(400).json({ error: 'Reset password must be at least 6 characters.' });
      return;
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password.trim()), id);
  }

  if (nextActive === 0) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }

  const updated = db
    .prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?')
    .get(id);
  res.json(updated);
});

// --- Inventory Items & Barcodes ---
app.get('/api/items', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM items ORDER BY updated_at DESC, id DESC').all() as Array<Record<string, unknown>>;
  res.json(rows.map((r) => sanitizeItemForRole(r, req.user!.role)));
});

app.post('/api/items', requireAuth, requireRoles('admin', 'manager'), (req: AuthedRequest, res) => {
  const {
    name,
    sku,
    barcode,
    category,
    unit,
    mrp,
    selling_price,
    buying_price,
    tax_rate,
    stock_qty,
    low_stock_threshold,
    image_url,
  } = req.body as Record<string, unknown>;

  const cleanName = String(name || '').trim();
  const cleanBarcode = String(barcode || '').trim().toUpperCase();
  const cleanSku = String(sku || '').trim().toUpperCase() || `SKU-${cleanBarcode}`;

  if (!cleanName || !cleanBarcode) {
    res.status(400).json({ error: 'Item name and barcode are required.' });
    return;
  }

  const img = String(image_url || '');
  if (img && !isSafeImageUrl(img)) {
    res.status(400).json({ error: 'Invalid item image URL or format.' });
    return;
  }

  const dupBarcode = db.prepare('SELECT id FROM items WHERE barcode = ?').get(cleanBarcode);
  if (dupBarcode) {
    res.status(409).json({ error: 'Barcode already exists. Please regenerate a unique barcode.' });
    return;
  }

  const dupSku = db.prepare('SELECT id FROM items WHERE sku = ?').get(cleanSku);
  const finalSku = dupSku ? `${cleanSku}-${Math.floor(100 + Math.random() * 900)}` : cleanSku;

  const numMrp = Math.max(0, Number(mrp) || 0);
  const numSelling = Math.max(0, Number(selling_price) || 0);
  const numBuying = Math.max(0, Number(buying_price) || 0);
  const numTax = Math.max(0, Math.min(100, Number(tax_rate) || 0));
  const numStock = Math.max(0, Math.floor(Number(stock_qty) || 0));
  const numThreshold = Math.max(0, Math.floor(Number(low_stock_threshold) || 10));

  const cleanCategory = String(category || 'General').trim() || 'General';
  db.prepare("INSERT OR IGNORE INTO categories (name, description) VALUES (?, '')").run(cleanCategory);

  const result = db
    .prepare(`
      INSERT INTO items (
        name, sku, barcode, category, unit, mrp, selling_price, buying_price, tax_rate, stock_qty, low_stock_threshold, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      cleanName,
      finalSku,
      cleanBarcode,
      cleanCategory,
      String(unit || 'pcs').trim() || 'pcs',
      numMrp,
      numSelling,
      numBuying,
      numTax,
      numStock,
      numThreshold,
      img
    );

  const itemId = Number(result.lastInsertRowid);
  db.prepare(
    'INSERT INTO stock_logs (item_id, item_name, change_qty, previous_qty, new_qty, reason, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(itemId, cleanName, numStock, 0, numStock, 'Initial stock added', req.user!.full_name);

  const created = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Record<string, unknown>;
  res.status(201).json(sanitizeItemForRole(created, req.user!.role));
});

app.put('/api/items/:id', requireAuth, requireRoles('admin', 'manager'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  const {
    name,
    sku,
    barcode,
    category,
    unit,
    mrp,
    selling_price,
    buying_price,
    tax_rate,
    stock_qty,
    low_stock_threshold,
    image_url,
  } = req.body as Record<string, unknown>;

  const cleanName = String(name || existing.name).trim();
  const cleanBarcode = String(barcode || existing.barcode).trim().toUpperCase();
  const cleanSku = String(sku || existing.sku).trim().toUpperCase();
  const img = image_url !== undefined ? String(image_url) : String(existing.image_url || '');

  if (img && !isSafeImageUrl(img)) {
    res.status(400).json({ error: 'Invalid item image format.' });
    return;
  }

  const dupBarcode = db.prepare('SELECT id FROM items WHERE barcode = ? AND id != ?').get(cleanBarcode, id);
  if (dupBarcode) {
    res.status(409).json({ error: 'Another item already uses this barcode.' });
    return;
  }

  const numStock = Math.max(0, Math.floor(Number(stock_qty ?? existing.stock_qty)));
  const prevStock = Number(existing.stock_qty);

  db.prepare(`
    UPDATE items
    SET name = ?, sku = ?, barcode = ?, category = ?, unit = ?, mrp = ?, selling_price = ?,
        buying_price = ?, tax_rate = ?, stock_qty = ?, low_stock_threshold = ?, image_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    cleanName,
    cleanSku,
    cleanBarcode,
    String(category ?? existing.category).trim(),
    String(unit ?? existing.unit).trim(),
    Math.max(0, Number(mrp ?? existing.mrp)),
    Math.max(0, Number(selling_price ?? existing.selling_price)),
    Math.max(0, Number(buying_price ?? existing.buying_price)),
    Math.max(0, Math.min(100, Number(tax_rate ?? existing.tax_rate))),
    numStock,
    Math.max(0, Math.floor(Number(low_stock_threshold ?? existing.low_stock_threshold))),
    img,
    id
  );

  if (numStock !== prevStock) {
    db.prepare(
      'INSERT INTO stock_logs (item_id, item_name, change_qty, previous_qty, new_qty, reason, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, cleanName, numStock - prevStock, prevStock, numStock, 'Item edit stock adjustment', req.user!.full_name);
  }

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(sanitizeItemForRole(updated, req.user!.role));
});

app.patch('/api/items/:id/stock', requireAuth, requireRoles('admin', 'manager'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { delta, set_qty, reason } = req.body as { delta?: number; set_qty?: number; reason?: string };

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as
    | { id: number; name: string; stock_qty: number; low_stock_threshold: number }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  const prevQty = existing.stock_qty;
  const nextQty =
    typeof set_qty === 'number'
      ? Math.max(0, Math.floor(set_qty))
      : Math.max(0, prevQty + Math.floor(Number(delta) || 0));

  db.prepare('UPDATE items SET stock_qty = ?, updated_at = datetime(\'now\') WHERE id = ?').run(nextQty, id);
  db.prepare(
    'INSERT INTO stock_logs (item_id, item_name, change_qty, previous_qty, new_qty, reason, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    existing.name,
    nextQty - prevQty,
    prevQty,
    nextQty,
    (reason || 'Manual stock update').trim(),
    req.user!.full_name
  );

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({
    item: sanitizeItemForRole(updated, req.user!.role),
    low_stock_triggered: nextQty <= existing.low_stock_threshold,
  });
});

app.post('/api/items/import', requireAuth, requireRoles('admin', 'manager'), (req: AuthedRequest, res) => {
  const { items: rawItems } = req.body as {
    items?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    res.status(400).json({ error: 'No items provided for import.' });
    return;
  }

  let insertedCount = 0;
  try {
    db.exec('BEGIN IMMEDIATE;');
    const insertCat = db.prepare("INSERT OR IGNORE INTO categories (name, description) VALUES (?, '')");
    const checkBarcode = db.prepare('SELECT id FROM items WHERE barcode = ?');
    const checkSku = db.prepare('SELECT id FROM items WHERE sku = ?');
    const insertItem = db.prepare(`
      INSERT INTO items (
        name, sku, barcode, category, unit, mrp, selling_price, buying_price, tax_rate, stock_qty, low_stock_threshold, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
    `);
    const insertLog = db.prepare(
      'INSERT INTO stock_logs (item_id, item_name, change_qty, previous_qty, new_qty, reason, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const entry of rawItems) {
      const cleanName = String(entry.name || '').trim();
      if (!cleanName) continue;

      const cleanCat = String(entry.category || 'General').trim() || 'General';
      insertCat.run(cleanCat);

      const prefix =
        cleanName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 3)
          .padEnd(3, 'X') || 'ITM';

      let barcode = String(entry.barcode || '').trim().toUpperCase();
      if (!barcode || checkBarcode.get(barcode)) {
        barcode = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
        while (checkBarcode.get(barcode)) {
          barcode = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
        }
      }

      let sku = `SKU-${barcode}`;
      if (checkSku.get(sku)) {
        sku = `${sku}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const numStock = Math.max(0, Math.floor(Number(entry.stock_qty) || 0));
      const result = insertItem.run(
        cleanName,
        sku,
        barcode,
        cleanCat,
        String(entry.unit || 'pcs').trim() || 'pcs',
        Math.max(0, Number(entry.mrp) || 0),
        Math.max(0, Number(entry.selling_price) || 0),
        Math.max(0, Number(entry.buying_price) || 0),
        Math.max(0, Math.min(100, Number(entry.tax_rate) || 0)),
        numStock,
        Math.max(0, Math.floor(Number(entry.low_stock_threshold) || 10))
      );

      const itemId = Number(result.lastInsertRowid);
      insertLog.run(itemId, cleanName, numStock, 0, numStock, 'Bulk Excel/CSV import', req.user!.full_name);
      insertedCount++;
    }

    db.exec('COMMIT;');
    res.status(201).json({ imported: insertedCount });
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback errors
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to import items.' });
  }
});

app.delete('/api/items/:id', requireAuth, requireRoles('admin'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/stock-logs', requireAuth, requireRoles('admin', 'manager'), (_req, res) => {
  const logs = db.prepare('SELECT * FROM stock_logs ORDER BY id DESC LIMIT 40').all();
  res.json(logs);
});

// --- POS Billing & Daybook Invoices ---
app.get('/api/bills', requireAuth, (req: AuthedRequest, res) => {
  const dateFilter = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const fromDate = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const toDate = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const payment = typeof req.query.payment === 'string' ? req.query.payment.trim() : '';
  const cashier = typeof req.query.cashier === 'string' ? req.query.cashier.trim() : '';
  const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (dateFilter) {
    whereClauses.push('substr(created_at, 1, 10) = ?');
    params.push(dateFilter);
  } else {
    if (fromDate) {
      whereClauses.push('substr(created_at, 1, 10) >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      whereClauses.push('substr(created_at, 1, 10) <= ?');
      params.push(toDate);
    }
  }

  if (payment && ['Cash', 'UPI', 'Card'].includes(payment)) {
    whereClauses.push('payment_method = ?');
    params.push(payment);
  }

  if (cashier) {
    whereClauses.push('LOWER(created_by_name) = LOWER(?)');
    params.push(cashier);
  }

  if (search) {
    const like = `%${search}%`;
    whereClauses.push(
      `(LOWER(bill_number) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_phone) LIKE ? OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = bills.id AND (LOWER(bi.item_name) LIKE ? OR LOWER(bi.barcode) LIKE ?)))`
    );
    params.push(like, like, like, like, like);
  }

  const sql = `SELECT * FROM bills ${whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 250`;
  const bills = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  const getItemsStmt = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?');
  const enriched = bills.map((bill) => {
    const billItems = getItemsStmt.all(Number(bill.id)) as Array<Record<string, unknown>>;
    return sanitizeBillForRole({ ...bill, items: billItems }, req.user!.role);
  });

  res.json(enriched);
});

app.post('/api/bills', requireAuth, (req: AuthedRequest, res) => {
  const { customer_name, customer_phone, payment_method, discount_amount, items } = req.body as {
    customer_name?: string;
    customer_phone?: string;
    payment_method?: 'Cash' | 'UPI' | 'Card';
    discount_amount?: number;
    items?: Array<{ item_id: number; qty: number }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one item is required to create a bill.' });
    return;
  }

  const validMethod =
    payment_method === 'UPI' || payment_method === 'Card' || payment_method === 'Cash'
      ? payment_method
      : 'Cash';

  try {
    db.exec('BEGIN IMMEDIATE;');

    const getItemStmt = db.prepare('SELECT * FROM items WHERE id = ?');
    const updateStockStmt = db.prepare('UPDATE items SET stock_qty = ?, updated_at = datetime(\'now\') WHERE id = ?');
    const insertLogStmt = db.prepare(
      'INSERT INTO stock_logs (item_id, item_name, change_qty, previous_qty, new_qty, reason, user_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    let subtotal = 0;
    let taxAmount = 0;
    let totalCost = 0;

    const preparedLines: Array<{
      item_id: number;
      item_name: string;
      barcode: string;
      qty: number;
      mrp: number;
      unit_price: number;
      buying_price: number;
      tax_rate: number;
      line_total: number;
      prev_stock: number;
      new_stock: number;
    }> = [];

    for (const entry of items) {
      const qty = Math.floor(Number(entry.qty) || 0);
      if (qty <= 0) {
        throw new Error('Item quantity must be at least 1.');
      }

      const itemRow = getItemStmt.get(Number(entry.item_id)) as
        | {
            id: number;
            name: string;
            barcode: string;
            mrp: number;
            selling_price: number;
            buying_price: number;
            tax_rate: number;
            stock_qty: number;
          }
        | undefined;

      if (!itemRow) {
        throw new Error('One of the selected items no longer exists.');
      }
      if (itemRow.stock_qty < qty) {
        throw new Error(`Insufficient stock for "${itemRow.name}" (available: ${itemRow.stock_qty}).`);
      }

      const lineBase = itemRow.selling_price * qty;
      const lineTax = Number(((lineBase * itemRow.tax_rate) / 100).toFixed(2));
      const lineTotal = Number((lineBase + lineTax).toFixed(2));

      subtotal += lineBase;
      taxAmount += lineTax;
      totalCost += itemRow.buying_price * qty;

      preparedLines.push({
        item_id: itemRow.id,
        item_name: itemRow.name,
        barcode: itemRow.barcode,
        qty,
        mrp: itemRow.mrp,
        unit_price: itemRow.selling_price,
        buying_price: itemRow.buying_price,
        tax_rate: itemRow.tax_rate,
        line_total: lineTotal,
        prev_stock: itemRow.stock_qty,
        new_stock: itemRow.stock_qty - qty,
      });
    }

    const discount = Math.max(0, Math.min(subtotal + taxAmount, Number(discount_amount) || 0));
    const totalAmount = Number((subtotal + taxAmount - discount).toFixed(2));
    const billNumber = `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const billRes = db
      .prepare(`
        INSERT INTO bills (
          bill_number, customer_name, customer_phone, payment_method, subtotal, discount_amount, tax_amount, total_amount, total_cost, created_by_id, created_by_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        billNumber,
        (customer_name || 'Walk-in Customer').trim() || 'Walk-in Customer',
        (customer_phone || '').trim(),
        validMethod,
        Number(subtotal.toFixed(2)),
        Number(discount.toFixed(2)),
        Number(taxAmount.toFixed(2)),
        totalAmount,
        Number(totalCost.toFixed(2)),
        req.user!.id,
        req.user!.full_name,
        nowSql
      );

    const billId = Number(billRes.lastInsertRowid);
    const insertBillItemStmt = db.prepare(`
      INSERT INTO bill_items (
        bill_id, item_id, item_name, barcode, qty, mrp, unit_price, buying_price, tax_rate, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of preparedLines) {
      insertBillItemStmt.run(
        billId,
        line.item_id,
        line.item_name,
        line.barcode,
        line.qty,
        line.mrp,
        line.unit_price,
        line.buying_price,
        line.tax_rate,
        line.line_total
      );
      updateStockStmt.run(line.new_stock, line.item_id);
      insertLogStmt.run(
        line.item_id,
        line.item_name,
        -line.qty,
        line.prev_stock,
        line.new_stock,
        `Sold via ${billNumber}`,
        req.user!.full_name
      );
    }

    db.exec('COMMIT;');

    const createdBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as Record<string, unknown>;
    const createdItems = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(billId) as Array<
      Record<string, unknown>
    >;

    res.status(201).json(sanitizeBillForRole({ ...createdBill, items: createdItems }, req.user!.role));
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback error if transaction wasn't active
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create bill.' });
  }
});

// --- Dashboard Analytics & Daily Sales Report ---
app.get('/api/dashboard/summary', requireAuth, (req: AuthedRequest, res) => {
  const role = req.user!.role;
  const items = db.prepare('SELECT * FROM items').all() as Array<{
    id: number;
    name: string;
    stock_qty: number;
    low_stock_threshold: number;
    selling_price: number;
    buying_price: number;
  }>;

  let totalStockUnits = 0;
  let inventorySellingValue = 0;
  let inventoryBuyingValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of items) {
    totalStockUnits += item.stock_qty;
    inventorySellingValue += item.stock_qty * item.selling_price;
    inventoryBuyingValue += item.stock_qty * item.buying_price;
    if (item.stock_qty <= item.low_stock_threshold) {
      lowStockCount += 1;
    }
    if (item.stock_qty === 0) {
      outOfStockCount += 1;
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAgg = db
    .prepare(
      `SELECT COUNT(*) AS bills_count, COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(total_cost), 0) AS cost
       FROM bills WHERE substr(created_at, 1, 10) = ?`
    )
    .get(todayStr) as { bills_count: number; revenue: number; cost: number };

  const todayUnitsRow = db
    .prepare(
      `SELECT COALESCE(SUM(bi.qty), 0) AS units
       FROM bill_items bi
       JOIN bills b ON b.id = bi.bill_id
       WHERE substr(b.created_at, 1, 10) = ?`
    )
    .get(todayStr) as { units: number };

  const dailySeries: Array<{
    date: string;
    bills_count: number;
    revenue: number;
    cost: number | null;
    profit: number | null;
  }> = [];

  for (let offset = 6; offset >= 0; offset--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - offset);
    const dayStr = dt.toISOString().slice(0, 10);
    const row = db
      .prepare(
        `SELECT COUNT(*) AS bills_count, COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(total_cost), 0) AS cost
         FROM bills WHERE substr(created_at, 1, 10) = ?`
      )
      .get(dayStr) as { bills_count: number; revenue: number; cost: number };

    dailySeries.push({
      date: dayStr,
      bills_count: row.bills_count,
      revenue: Number(row.revenue.toFixed(2)),
      cost: role === 'cashier' ? null : Number(row.cost.toFixed(2)),
      profit: role === 'cashier' ? null : Number((row.revenue - row.cost).toFixed(2)),
    });
  }

  const lowStockRows = db
    .prepare('SELECT * FROM items WHERE stock_qty <= low_stock_threshold ORDER BY stock_qty ASC, id ASC')
    .all() as Array<Record<string, unknown>>;

  const recentBillsRows = db.prepare('SELECT * FROM bills ORDER BY id DESC LIMIT 6').all() as Array<
    Record<string, unknown>
  >;
  const getItemsStmt = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?');
  const recentBills = recentBillsRows.map((b) =>
    sanitizeBillForRole({ ...b, items: getItemsStmt.all(Number(b.id)) }, role)
  );

  res.json({
    total_skus: items.length,
    total_stock_units: totalStockUnits,
    inventory_selling_value: Number(inventorySellingValue.toFixed(2)),
    inventory_buying_value: role === 'cashier' ? null : Number(inventoryBuyingValue.toFixed(2)),
    low_stock_count: lowStockCount,
    out_of_stock_count: outOfStockCount,
    today_revenue: Number(todayAgg.revenue.toFixed(2)),
    today_bills_count: todayAgg.bills_count,
    today_profit: role === 'cashier' ? null : Number((todayAgg.revenue - todayAgg.cost).toFixed(2)),
    today_units_sold: todayUnitsRow.units,
    daily_series: dailySeries,
    low_stock_items: lowStockRows.map((r) => sanitizeItemForRole(r, role)),
    recent_bills: recentBills,
  });
});

// --- Server & Vite Middleware Startup ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockLedger server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
