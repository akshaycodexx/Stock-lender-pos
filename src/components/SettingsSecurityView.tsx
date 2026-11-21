import React, { useEffect, useState } from 'react';
import {
  Barcode,
  Building2,
  Check,
  Copy,
  Database,
  KeyRound,
  Palette,
  ShieldCheck,
  Upload,
  UserPlus,
} from 'lucide-react';
import type {
  AuthUser,
  BarcodeTemplateStyle,
  BillTemplateStyle,
  CompanySettings,
  UserRole,
} from '../types.ts';
import { BarcodeSvg } from './BarcodeSvg.tsx';

interface SettingsSecurityViewProps {
  company: CompanySettings;
  currentUser: AuthUser;
  users: AuthUser[];
  onSaveCompany: (payload: Partial<CompanySettings>) => Promise<void>;
  onChangeMyPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onCreateUser: (payload: {
    username: string;
    full_name: string;
    role: UserRole;
    password: string;
  }) => Promise<void>;
  onUpdateUser: (
    userId: number,
    payload: { role?: UserRole; is_active?: number; new_password?: string }
  ) => Promise<void>;
}

const ACCENT_PRESETS = [
  { label: 'Emerald Teal', color: '#0F766E' },
  { label: 'Deep Slate', color: '#0F172A' },
  { label: 'Royal Indigo', color: '#1D4ED8' },
  { label: 'Warm Amber', color: '#B45309' },
];

const MYSQL_SCHEMA_SNIPPET = `-- MySQL 8.0+ Schema (php-mysql-backend/schema.sql)
CREATE TABLE company_settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  company_name VARCHAR(160) NOT NULL,
  gst_number VARCHAR(40) NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  currency_symbol VARCHAR(8) NOT NULL DEFAULT '₹'
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(200) NOT NULL DEFAULT ''
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('admin', 'manager', 'cashier') NOT NULL DEFAULT 'cashier',
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  barcode VARCHAR(64) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL DEFAULT 'General',
  mrp DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2) NOT NULL,
  buying_price DECIMAL(10, 2) NOT NULL,
  stock_qty INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  image_url MEDIUMTEXT
);`;

export const SettingsSecurityView: React.FC<SettingsSecurityViewProps> = ({
  company,
  currentUser,
  users,
  onSaveCompany,
  onChangeMyPassword,
  onCreateUser,
  onUpdateUser,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [section, setSection] = useState<'company' | 'design' | 'password' | 'users' | 'php'>(
    isAdmin ? 'company' : 'password'
  );

  // Company form state
  const [companyName, setCompanyName] = useState(company.company_name);
  const [tagline, setTagline] = useState(company.tagline);
  const [gstNumber, setGstNumber] = useState(company.gst_number);
  const [address, setAddress] = useState(company.address);
  const [phone, setPhone] = useState(company.phone);
  const [email, setEmail] = useState(company.email);
  const [currencySymbol, setCurrencySymbol] = useState(company.currency_symbol);
  const [invoiceFooter, setInvoiceFooter] = useState(company.invoice_footer);
  const [logoData, setLogoData] = useState(company.logo_data);
  const [companyNotice, setCompanyNotice] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Bill & Barcode Design state
  const [billTemplate, setBillTemplate] = useState<BillTemplateStyle>(
    company.bill_template || 'classic'
  );
  const [billAccentColor, setBillAccentColor] = useState(company.bill_accent_color || '#0F766E');
  const [billShowGst, setBillShowGst] = useState(company.bill_show_gst !== 0);
  const [billShowMrp, setBillShowMrp] = useState(company.bill_show_mrp !== 0);
  const [barcodeTemplate, setBarcodeTemplate] = useState<BarcodeTemplateStyle>(
    company.barcode_template || 'standard'
  );
  const [barcodeShowCompany, setBarcodeShowCompany] = useState(
    company.barcode_show_company !== 0
  );
  const [barcodeShowMrp, setBarcodeShowMrp] = useState(company.barcode_show_mrp !== 0);
  const [barcodeHeight, setBarcodeHeight] = useState(company.barcode_height || 34);
  const [designNotice, setDesignNotice] = useState('');
  const [designError, setDesignError] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);

  // My Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwNotice, setPwNotice] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  const [newUserPw, setNewUserPw] = useState('');
  const [userError, setUserError] = useState('');
  const [userNotice, setUserNotice] = useState('');
  const [resetPwMap, setResetPwMap] = useState<Record<number, string>>({});
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    setCompanyName(company.company_name);
    setTagline(company.tagline);
    setGstNumber(company.gst_number);
    setAddress(company.address);
    setPhone(company.phone);
    setEmail(company.email);
    setCurrencySymbol(company.currency_symbol);
    setInvoiceFooter(company.invoice_footer);
    setLogoData(company.logo_data);
    setBillTemplate(company.bill_template || 'classic');
    setBillAccentColor(company.bill_accent_color || '#0F766E');
    setBillShowGst(company.bill_show_gst !== 0);
    setBillShowMrp(company.bill_show_mrp !== 0);
    setBarcodeTemplate(company.barcode_template || 'standard');
    setBarcodeShowCompany(company.barcode_show_company !== 0);
    setBarcodeShowMrp(company.barcode_show_mrp !== 0);
    setBarcodeHeight(company.barcode_height || 34);
  }, [company]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 240 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setLogoData(canvas.toDataURL('image/png'));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError('');
    setCompanyNotice('');
    setSavingCompany(true);
    try {
      await onSaveCompany({
        ...company,
        company_name: companyName,
        tagline,
        gst_number: gstNumber,
        address,
        phone,
        email,
        currency_symbol: currencySymbol,
        invoice_footer: invoiceFooter,
        logo_data: logoData,
      });
      setCompanyNotice('Company profile updated and applied across invoices.');
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : 'Failed to update company details.');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveDesignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDesignError('');
    setDesignNotice('');
    setSavingDesign(true);
    try {
      await onSaveCompany({
        ...company,
        bill_template: billTemplate,
        bill_accent_color: billAccentColor,
        bill_show_gst: billShowGst ? 1 : 0,
        bill_show_mrp: billShowMrp ? 1 : 0,
        barcode_template: barcodeTemplate,
        barcode_show_company: barcodeShowCompany ? 1 : 0,
        barcode_show_mrp: barcodeShowMrp ? 1 : 0,
        barcode_height: barcodeHeight,
      });
      setDesignNotice('Default Bill & Barcode design preferences saved.');
    } catch (err) {
      setDesignError(err instanceof Error ? err.message : 'Failed to save design settings.');
    } finally {
      setSavingDesign(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwNotice('');
    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await onChangeMyPassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwNotice('Your password has been updated securely.');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setSavingPw(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserNotice('');
    try {
      await onCreateUser({
        username: newUsername,
        full_name: newFullName,
        role: newUserRole,
        password: newUserPw,
      });
      setNewUsername('');
      setNewFullName('');
      setNewUserRole('cashier');
      setNewUserPw('');
      setUserNotice('Team account created.');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to create user.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setSection('company')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                section === 'company'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Company Details
            </button>
            <button
              type="button"
              onClick={() => setSection('design')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                section === 'design'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              Bill &amp; Barcode Design
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setSection('password')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            section === 'password'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          Set Password
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setSection('users')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              section === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            User Access Levels
          </button>
        )}
        <button
          type="button"
          onClick={() => setSection('php')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            section === 'php'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          PHP &amp; MySQL Export
        </button>
      </div>

      {/* Company Details Form */}
      {section === 'company' && isAdmin && (
        <form
          onSubmit={handleSaveCompanySubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl space-y-5"
        >
          <div>
            <h3 className="text-base font-semibold text-slate-900">Company &amp; Invoice Profile</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Details configured here appear in the workspace header, barcode stickers, and printed bills.
            </p>
          </div>

          {companyError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {companyError}
            </div>
          )}
          {companyNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {companyNotice}
            </div>
          )}

          <div className="flex items-center gap-4">
            {logoData ? (
              <img
                src={logoData}
                alt="Company Logo"
                referrerPolicy="no-referrer"
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Company Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {logoData && (
                  <button
                    type="button"
                    onClick={() => setLogoData('')}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Shown on printed tax invoices.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                GST / Tax ID
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                maxLength={4}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Store Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Invoice Footer Note
            </label>
            <input
              type="text"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingCompany}
              className="px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors"
            >
              {savingCompany ? 'Saving...' : 'Save Company Details'}
            </button>
          </div>
        </form>
      )}

      {/* Bill & Barcode Design Tab */}
      {section === 'design' && isAdmin && (
        <form onSubmit={handleSaveDesignSubmit} className="space-y-6 max-w-4xl">
          {designError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {designError}
            </div>
          )}
          {designNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {designNotice}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bill / Invoice Design Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Bill &amp; Invoice Design
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose your default print layout, accent color, and visible fields
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Default Invoice Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'classic', title: 'Classic A4', desc: 'Clean corporate sheet' },
                    { id: 'modern', title: 'Modern Banner', desc: 'Colored top header' },
                    { id: 'thermal', title: 'Thermal 80mm', desc: 'Compact POS slip' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setBillTemplate(tpl.id as BillTemplateStyle)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        billTemplate === tpl.id
                          ? 'border-teal-700 bg-teal-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{tpl.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Invoice Accent Color
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => setBillAccentColor(preset.color)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        billAccentColor === preset.color
                          ? 'border-slate-900 bg-slate-100 text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-sm"
                        style={{ backgroundColor: preset.color }}
                      />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billShowMrp}
                    onChange={(e) => setBillShowMrp(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Show MRP column and customer MRP savings on printed bills
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billShowGst}
                    onChange={(e) => setBillShowGst(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Show GSTIN and item-wise tax breakdown
                </label>
              </div>
            </div>

            {/* Barcode Sticker Design Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Barcode Label Design
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure sticker layout and bar height for printed labels
                  </p>
                </div>
                <Barcode className="w-5 h-5 text-slate-400" />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Sticker Style
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'standard', title: 'Standard', desc: 'Balanced 3-col' },
                    { id: 'compact', title: 'Compact', desc: 'Mini 4-col tag' },
                    { id: 'detailed', title: 'Shelf Tag', desc: 'SKU & Discount %' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setBarcodeTemplate(tpl.id as BarcodeTemplateStyle)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        barcodeTemplate === tpl.id
                          ? 'border-teal-700 bg-teal-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{tpl.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={barcodeShowCompany}
                    onChange={(e) => setBarcodeShowCompany(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Show Company Name
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={barcodeShowMrp}
                    onChange={(e) => setBarcodeShowMrp(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Show MRP Strikethrough
                </label>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Barcode Bar Height</span>
                  <span className="font-mono tabular-nums">{barcodeHeight}px</span>
                </div>
                <input
                  type="range"
                  min={24}
                  max={50}
                  value={barcodeHeight}
                  onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                  className="w-full accent-teal-700"
                />
              </div>

              {/* Live Sticker Preview */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center">
                <div className="text-[11px] font-medium text-slate-500 mb-2">
                  Live Label Preview
                </div>
                <div className="border border-dashed border-slate-300 rounded-lg px-4 py-3 bg-white text-center max-w-xs w-full">
                  {barcodeShowCompany && (
                    <div className="text-[10px] font-semibold text-slate-500 truncate">
                      {company.company_name}
                    </div>
                  )}
                  <div className="text-xs font-semibold text-slate-900 mt-0.5">
                    Royal Basmati Rice 2kg
                  </div>
                  <div className="my-1.5 flex justify-center">
                    <BarcodeSvg value="ROY482910" height={barcodeHeight} />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs font-mono tabular-nums">
                    {barcodeShowMrp && (
                      <span className="text-slate-400 line-through">
                        MRP {company.currency_symbol}340
                      </span>
                    )}
                    <span className="font-bold text-slate-900">
                      {company.currency_symbol}295.00
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingDesign}
            className="px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors"
          >
            {savingDesign ? 'Saving Design...' : 'Save Default Bill & Barcode Design'}
          </button>
        </form>
      )}

      {/* Set / Change My Password */}
      {section === 'password' && (
        <form
          onSubmit={handlePasswordSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg space-y-4"
        >
          <div>
            <h3 className="text-base font-semibold text-slate-900">Set or Update Your Password</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Signed in as <strong className="text-slate-800">{currentUser.full_name}</strong> (@
              {currentUser.username}) · Access Level:{' '}
              <span className="capitalize font-semibold">{currentUser.role}</span>
            </p>
          </div>

          {pwError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {pwError}
            </div>
          )}
          {pwNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              {pwNotice}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Password (min 6 characters) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <button
            type="submit"
            disabled={savingPw}
            className="px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors"
          >
            {savingPw ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      {/* User Access Levels & Team Security */}
      {section === 'users' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900">
              Role-Based Access Level Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Server-enforced permissions protect buying prices, stock edits, company settings, and user credentials.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="font-semibold text-slate-900 text-sm">Admin</div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Full control: Company profile, Bill &amp; Barcode design, user passwords &amp; access levels, delete items, view buying prices &amp; net profit, POS billing, and Excel daybook.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="font-semibold text-slate-900 text-sm">Manager</div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Add/edit items, manage categories, import Excel items, update stock, print barcodes, POS billing, view buying prices &amp; daily profit reports.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="font-semibold text-slate-900 text-sm">Cashier</div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  POS billing &amp; invoice printing, view shelf prices &amp; stock levels, print barcode labels. Buying prices, profits, and item deletion are hidden.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleAddUser}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-700" />
                <h4 className="text-sm font-semibold text-slate-900">Create Staff Account</h4>
              </div>

              {userError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {userError}
                </div>
              )}
              {userNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  {userNotice}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Amit Verma"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. amit_pos"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Access Level *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="cashier">Cashier (POS &amp; Billing)</option>
                  <option value="manager">Manager (Stock &amp; Reports)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserPw}
                  onChange={(e) => setNewUserPw(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Add Team User
              </button>
            </form>

            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900">Active Accounts &amp; Passwords</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Access Level</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reset Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{u.full_name}</div>
                          <div className="text-xs font-mono text-slate-500">@{u.username}</div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            disabled={u.id === currentUser.id}
                            onChange={(e) =>
                              onUpdateUser(u.id, { role: e.target.value as UserRole })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white disabled:opacity-60"
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="cashier">Cashier</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            disabled={u.id === currentUser.id}
                            onClick={() =>
                              onUpdateUser(u.id, { is_active: u.is_active === 1 ? 0 : 1 })
                            }
                            className={`text-xs font-semibold disabled:opacity-50 ${
                              u.is_active === 1 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {u.is_active === 1 ? 'Active (Click to Disable)' : 'Disabled (Enable)'}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="password"
                              placeholder="New password"
                              value={resetPwMap[u.id] || ''}
                              onChange={(e) =>
                                setResetPwMap((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              className="w-32 px-2 py-1 text-xs border border-slate-300 rounded-md"
                            />
                            <button
                              type="button"
                              disabled={(resetPwMap[u.id] || '').length < 6}
                              onClick={async () => {
                                await onUpdateUser(u.id, { new_password: resetPwMap[u.id] });
                                setResetPwMap((prev) => ({ ...prev, [u.id]: '' }));
                                setUserNotice(`Password updated for @${u.username}.`);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-md"
                            >
                              Set
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHP + MySQL Backend Export Info */}
      {section === 'php' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                PHP &amp; MySQL Deployment Pack
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ready-to-host PDO PHP API &amp; MySQL schema files are included in{' '}
                <code className="font-mono text-slate-800">php-mysql-backend/</code> alongside the live SQLite server.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(MYSQL_SCHEMA_SNIPPET);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              {copiedSql ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedSql ? 'Copied SQL' : 'Copy MySQL Schema'}
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
            {MYSQL_SCHEMA_SNIPPET}
          </pre>
        </div>
      )}
    </div>
  );
};
