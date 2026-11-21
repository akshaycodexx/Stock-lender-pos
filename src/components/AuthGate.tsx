import React, { useState } from 'react';
import {
  Barcode,
  Building2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import type { AuthUser } from '../types.ts';

interface AuthGateProps {
  initialized: boolean;
  companyName: string;
  companyLogo: string;
  onBootstrap: (payload: {
    company_name: string;
    full_name: string;
    username: string;
    password: string;
  }) => Promise<AuthUser>;
  onLogin: (payload: { username: string; password: string }) => Promise<AuthUser>;
}

const LOGIN_STUDIO_IMAGE = '/src/assets/images/login_retail_studio_1795267527569.jpg';

export const AuthGate: React.FC<AuthGateProps> = ({
  initialized,
  companyName,
  companyLogo,
  onBootstrap,
  onLogin,
}) => {
  const [setupCompany, setSetupCompany] = useState(companyName || 'Kesar Retail & Provisions');
  const [fullName, setFullName] = useState('Store Administrator');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!initialized) {
      if (password.length < 6) {
        setError('Please choose a password of at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setBusy(true);
      try {
        await onBootstrap({
          company_name: setupCompany.trim() || companyName,
          full_name: fullName.trim() || 'Store Administrator',
          username: username.trim().toLowerCase() || 'admin',
          password,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Setup failed.');
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        await onLogin({ username: username.trim().toLowerCase(), password });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed.');
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-stretch">
      {/* Left Architectural Storefront Showcase (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[54%] relative bg-slate-900 text-white overflow-hidden">
        <img
          src={LOGIN_STUDIO_IMAGE}
          alt="Retail store counter and organized inventory shelves"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-900/35" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-contain bg-white p-1"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="text-base font-bold tracking-tight text-white">
                {companyName}
              </div>
              <div className="text-xs text-slate-300">Inventory, Barcodes &amp; POS Billing</div>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
                Every barcode, shelf unit, and daily invoice in one ledger.
              </h2>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                Manage stock quantities with automatic low-stock alerts, print custom thermal or A4 bills, and export your daily sales daybook directly to Excel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/15 text-xs text-slate-200">
              <div className="flex items-start gap-2.5">
                <Barcode className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Auto-Prefix Barcodes</div>
                  <div className="text-slate-300 mt-0.5">First 3 chars + unique digits with custom label templates</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Printer className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Custom Bill Designs</div>
                  <div className="text-slate-300 mt-0.5">Classic A4, Modern Accent, and 80mm Thermal receipts</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Daybook &amp; Excel</div>
                  <div className="text-slate-300 mt-0.5">Bulk item import and multi-sheet Excel daybook exports</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Access Level Control</div>
                  <div className="text-slate-300 mt-0.5">Separate Admin, Manager, and Cashier permissions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sign-In / Setup Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-200">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-lg object-contain border border-slate-200 p-1"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate">
                {initialized ? 'Sign In to Store Console' : 'Initial Store Setup'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {initialized
                  ? companyName
                  : 'Set your company name and create the Admin password'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            {!initialized && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Company / Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={setupCompany}
                    onChange={(e) => setSetupCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Admin Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {initialized ? 'Password *' : 'Create Admin Password (min 6 chars) *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={initialized ? 1 : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!initialized && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirm Admin Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors"
            >
              {initialized ? <Lock className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              {busy
                ? 'Verifying...'
                : initialized
                  ? 'Sign In to Workspace'
                  : 'Create Admin & Launch Store'}
            </button>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                Secured with salted scrypt password hashing and role-based route verification.
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
