import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'inventory.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    gst_number TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    invoice_footer TEXT NOT NULL DEFAULT 'Thank you for your business.',
    logo_data TEXT NOT NULL DEFAULT '',
    bill_template TEXT NOT NULL DEFAULT 'classic',
    bill_accent_color TEXT NOT NULL DEFAULT '#0F766E',
    bill_show_gst INTEGER NOT NULL DEFAULT 1,
    bill_show_mrp INTEGER NOT NULL DEFAULT 1,
    barcode_template TEXT NOT NULL DEFAULT 'standard',
    barcode_show_company INTEGER NOT NULL DEFAULT 1,
    barcode_show_mrp INTEGER NOT NULL DEFAULT 1,
    barcode_height INTEGER NOT NULL DEFAULT 34,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'General',
    unit TEXT NOT NULL DEFAULT 'pcs',
    mrp REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    buying_price REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
    customer_phone TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Card')),
    subtotal REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    created_by_id INTEGER NOT NULL,
    created_by_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    barcode TEXT NOT NULL,
    qty INTEGER NOT NULL,
    mrp REAL NOT NULL,
    unit_price REAL NOT NULL,
    buying_price REAL NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stock_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    change_qty INTEGER NOT NULL,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    reason TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function ensureColumnMigrations(): void {
  const cols = db.prepare('PRAGMA table_info(company_settings)').all() as Array<{ name: string }>;
  const existing = new Set(cols.map((c) => c.name));
  const migrations: Array<[string, string]> = [
    ['bill_template', "TEXT NOT NULL DEFAULT 'classic'"],
    ['bill_accent_color', "TEXT NOT NULL DEFAULT '#0F766E'"],
    ['bill_show_gst', 'INTEGER NOT NULL DEFAULT 1'],
    ['bill_show_mrp', 'INTEGER NOT NULL DEFAULT 1'],
    ['barcode_template', "TEXT NOT NULL DEFAULT 'standard'"],
    ['barcode_show_company', 'INTEGER NOT NULL DEFAULT 1'],
    ['barcode_show_mrp', 'INTEGER NOT NULL DEFAULT 1'],
    ['barcode_height', 'INTEGER NOT NULL DEFAULT 34'],
  ];

  for (const [colName, colDef] of migrations) {
    if (!existing.has(colName)) {
      db.exec(`ALTER TABLE company_settings ADD COLUMN ${colName} ${colDef};`);
    }
  }
}

ensureColumnMigrations();

export function seedInitialData(): void {
  const companyCount = db.prepare('SELECT COUNT(*) AS cnt FROM company_settings').get() as { cnt: number };
  if (companyCount.cnt === 0) {
    db.prepare(`
      INSERT INTO company_settings (
        id, company_name, tagline, gst_number, address, phone, email, currency_symbol, invoice_footer, logo_data
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, '')
    `).run(
      'Kesar Retail & Provisions',
      'Quality Groceries & Everyday Essentials',
      '27AABCK4921M1Z5',
      '14 Market Road, Sector 4, Pune 411001',
      '+91 98204 55120',
      'billing@kesarretail.in',
      '₹',
      'Thank you for shopping with us. Goods once sold can be exchanged within 7 days with original bill.'
    );
  }

  const catCount = db.prepare('SELECT COUNT(*) AS cnt FROM categories').get() as { cnt: number };
  if (catCount.cnt === 0) {
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)');
    const defaultCats: Array<[string, string]> = [
      ['Grains & Staples', 'Rice, wheat flour, lentils, and dry staples'],
      ['Oils & Condiments', 'Cooking oils, ghee, vinegar, and sauces'],
      ['Beverages', 'Tea, coffee, and packaged drinks'],
      ['Kitchenware', 'Mugs, utensils, and dining essentials'],
      ['Spices', 'Whole spices, powders, and salts'],
      ['Dairy & Bakery', 'Milk, butter, bread, and fresh bakes'],
      ['Personal Care', 'Soaps, shampoos, and hygiene goods'],
      ['General', 'Miscellaneous store items'],
    ];
    for (const [name, desc] of defaultCats) {
      insertCat.run(name, desc);
    }
  }

  const itemCount = db.prepare('SELECT COUNT(*) AS cnt FROM items').get() as { cnt: number };
  if (itemCount.cnt === 0) {
    const insertItem = db.prepare(`
      INSERT INTO items (
        name, sku, barcode, category, unit, mrp, selling_price, buying_price, tax_rate, stock_qty, low_stock_threshold, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedItems = [
      [
        'Royal Basmati Rice 2kg',
        'SKU-ROY01',
        'ROY482910',
        'Grains & Staples',
        'bag',
        340,
        295,
        235,
        5,
        42,
        12,
        '/src/assets/images/item_basmati_rice_1795266657816.jpg',
      ],
      [
        'Cold Pressed Cooking Oil 1L',
        'SKU-COL02',
        'COL739104',
        'Oils & Condiments',
        'bottle',
        420,
        375,
        310,
        5,
        7,
        10,
        '/src/assets/images/item_cooking_oil_1795266658930.jpg',
      ],
      [
        'Assam Blend Loose Tea 250g',
        'SKU-ASS03',
        'ASS194825',
        'Beverages',
        'tin',
        280,
        245,
        185,
        5,
        28,
        10,
        '/src/assets/images/item_assam_tea_1795266658658.jpg',
      ],
      [
        'Stoneware Ceramic Mug',
        'SKU-STO04',
        'STO618392',
        'Kitchenware',
        'pcs',
        399,
        320,
        210,
        12,
        4,
        8,
        '/src/assets/images/item_ceramic_mug_1795266660087.jpg',
      ],
      [
        'Organic Turmeric Powder 500g',
        'SKU-ORG05',
        'ORG520419',
        'Spices',
        'pack',
        180,
        155,
        112,
        5,
        35,
        10,
        '',
      ],
      [
        'Himalayan Pink Salt 1kg',
        'SKU-HIM06',
        'HIM903412',
        'Spices',
        'pack',
        140,
        115,
        78,
        5,
        0,
        8,
        '',
      ],
    ];

    for (const row of seedItems) {
      insertItem.run(...row);
    }
  }

  // Ensure any item categories exist in categories table
  const itemCats = db.prepare('SELECT DISTINCT category FROM items WHERE category != \'\'').all() as Array<{
    category: string;
  }>;
  const syncCat = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, \'\')');
  for (const row of itemCats) {
    syncCat.run(row.category);
  }

  const billCount = db.prepare('SELECT COUNT(*) AS cnt FROM bills').get() as { cnt: number };
  if (billCount.cnt === 0) {
    const items = db.prepare('SELECT id, name, barcode, mrp, selling_price, buying_price, tax_rate FROM items ORDER BY id ASC').all() as Array<{
      id: number;
      name: string;
      barcode: string;
      mrp: number;
      selling_price: number;
      buying_price: number;
      tax_rate: number;
    }>;

    if (items.length >= 4) {
      const insertBill = db.prepare(`
        INSERT INTO bills (
          bill_number, customer_name, customer_phone, payment_method, subtotal, discount_amount, tax_amount, total_amount, total_cost, created_by_id, created_by_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertBillItem = db.prepare(`
        INSERT INTO bill_items (
          bill_id, item_id, item_name, barcode, qty, mrp, unit_price, buying_price, tax_rate, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date();
      const formatSqlDate = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

      const sampleDays = [
        { offsetDays: 5, billNo: 'INV-1001', cust: 'Rohan Mehta', phone: '9820112233', method: 'UPI', picks: [{ idx: 0, qty: 3 }, { idx: 2, qty: 2 }] },
        { offsetDays: 4, billNo: 'INV-1002', cust: 'Priya Sharma', phone: '9820445566', method: 'Card', picks: [{ idx: 1, qty: 2 }, { idx: 3, qty: 2 }] },
        { offsetDays: 3, billNo: 'INV-1003', cust: 'Vikram Patel', phone: '9811998877', method: 'Cash', picks: [{ idx: 0, qty: 4 }, { idx: 4, qty: 3 }] },
        { offsetDays: 2, billNo: 'INV-1004', cust: 'Sneha Joshi', phone: '9876543210', method: 'UPI', picks: [{ idx: 2, qty: 4 }, { idx: 1, qty: 2 }] },
        { offsetDays: 1, billNo: 'INV-1005', cust: 'Walk-in Customer', phone: '', method: 'Cash', picks: [{ idx: 0, qty: 2 }, { idx: 3, qty: 3 }] },
        { offsetDays: 0, billNo: 'INV-1006', cust: 'Ananya Verma', phone: '9890123456', method: 'UPI', picks: [{ idx: 0, qty: 2 }, { idx: 2, qty: 1 }, { idx: 4, qty: 2 }] },
        { offsetDays: 0, billNo: 'INV-1007', cust: 'Karan Malhotra', phone: '9823001122', method: 'Card', picks: [{ idx: 1, qty: 1 }, { idx: 3, qty: 2 }] },
      ];

      for (const s of sampleDays) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - s.offsetDays);
        dt.setHours(11 + (s.offsetDays % 5), 20, 0, 0);

        let subtotal = 0;
        let taxAmount = 0;
        let totalCost = 0;

        for (const p of s.picks) {
          const item = items[p.idx];
          const base = item.selling_price * p.qty;
          const tax = Number(((base * item.tax_rate) / 100).toFixed(2));
          subtotal += base;
          taxAmount += tax;
          totalCost += item.buying_price * p.qty;
        }

        const totalAmount = Number((subtotal + taxAmount).toFixed(2));
        const res = insertBill.run(
          s.billNo,
          s.cust,
          s.phone,
          s.method,
          subtotal,
          0,
          Number(taxAmount.toFixed(2)),
          totalAmount,
          totalCost,
          1,
          'Store Admin',
          formatSqlDate(dt)
        );
        const billId = Number(res.lastInsertRowid);

        for (const p of s.picks) {
          const item = items[p.idx];
          const base = item.selling_price * p.qty;
          const tax = Number(((base * item.tax_rate) / 100).toFixed(2));
          insertBillItem.run(
            billId,
            item.id,
            item.name,
            item.barcode,
            p.qty,
            item.mrp,
            item.selling_price,
            item.buying_price,
            item.tax_rate,
            Number((base + tax).toFixed(2))
          );
        }
      }
    }
  }
}

seedInitialData();
