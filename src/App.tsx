import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  X,
} from 'lucide-react';
import { apiRequest, setAuthToken } from './api/client.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { CategoryManagerModal } from './components/CategoryManagerModal.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ExcelImportModal } from './components/ExcelImportModal.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { ItemFormModal } from './components/ItemFormModal.tsx';
import { PosBillingView } from './components/PosBillingView.tsx';
import { PrintBarcodeModal, PrintInvoiceModal } from './components/PrintInvoiceModal.tsx';
import { SalesReportView, type DaybookFilterState } from './components/SalesReportView.tsx';
import { SettingsSecurityView } from './components/SettingsSecurityView.tsx';
import type {
  AuthUser,
  Bill,
  Category,
  CompanySettings,
  DashboardSummary,
  InventoryItem,
  UserRole,
} from './types.ts';
import type { ParsedImportItem } from './utils/excel.ts';

type ActiveTab = 'dashboard' | 'inventory' | 'pos' | 'reports' | 'settings';

function buildBillsQueryString(filters: DaybookFilterState): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.payment) params.set('payment', filters.payment);
  if (filters.cashier) params.set('cashier', filters.cashier);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  const qs = params.toString();
  return qs ? `/api/bills?${qs}` : '/api/bills';
}

export default function App() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [authStatus, setAuthStatus] = useState<{
    loaded: boolean;
    initialized: boolean;
    companyName: string;
    companyLogo: string;
  }>({
    loaded: false,
    initialized: false,
    companyName: 'Kesar Retail & Provisions',
    companyLogo: '',
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [company, setCompany] = useState<CompanySettings>({
    id: 1,
    company_name: 'Kesar Retail & Provisions',
    tagline: '',
    gst_number: '',
    address: '',
    phone: '',
    email: '',
    currency_symbol: '₹',
    invoice_footer: 'Thank you for your business.',
    logo_data: '',
    bill_template: 'classic',
    bill_accent_color: '#0F766E',
    bill_show_gst: 1,
    bill_show_mrp: 1,
    barcode_template: 'standard',
    barcode_show_company: 1,
    barcode_show_mrp: 1,
    barcode_height: 34,
    updated_at: '',
  });

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [daybookFilters, setDaybookFilters] = useState<DaybookFilterState>({
    from: todayStr,
    to: todayStr,
    payment: '',
    cashier: '',
    q: '',
  });
  const [loadingData, setLoadingData] = useState(false);

  // Modals & Alerts
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [printBill, setPrintBill] = useState<Bill | null>(null);
  const [printBarcodeItem, setPrintBarcodeItem] = useState<InventoryItem | null>(null);
  const [alertNotice, setAlertNotice] = useState<{ type: 'warning' | 'info'; message: string } | null>(
    null
  );

  const fetchAuthStatus = useCallback(async () => {
    try {
      const status = await apiRequest<{
        initialized: boolean;
        companyName: string;
        companyLogo: string;
      }>('/api/auth/status');
      setAuthStatus({
        loaded: true,
        initialized: status.initialized,
        companyName: status.companyName,
        companyLogo: status.companyLogo,
      });
    } catch {
      setAuthStatus((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  const loadWorkspaceData = useCallback(
    async (user: AuthUser, filtersForDaybook = daybookFilters) => {
      setLoadingData(true);
      try {
        const [compRes, itemsRes, catsRes, dashRes, billsRes] = await Promise.all([
          apiRequest<CompanySettings>('/api/company'),
          apiRequest<InventoryItem[]>('/api/items'),
          apiRequest<Category[]>('/api/categories'),
          apiRequest<DashboardSummary>('/api/dashboard/summary'),
          apiRequest<Bill[]>(buildBillsQueryString(filtersForDaybook)),
        ]);
        setCompany(compRes);
        setItems(itemsRes);
        setCategories(catsRes);
        setSummary(dashRes);
        setBills(billsRes);

        if (user.role === 'admin') {
          const usersRes = await apiRequest<AuthUser[]>('/api/users');
          setUsers(usersRes);
        } else {
          setUsers([]);
        }
      } finally {
        setLoadingData(false);
      }
    },
    [daybookFilters]
  );

  const handleBootstrap = async (payload: {
    company_name: string;
    full_name: string;
    username: string;
    password: string;
  }): Promise<AuthUser> => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    setCurrentUser(res.user);
    setAuthStatus((prev) => ({
      ...prev,
      initialized: true,
      companyName: payload.company_name,
    }));
    await loadWorkspaceData(res.user);
    return res.user;
  };

  const handleLogin = async (payload: { username: string; password: string }): Promise<AuthUser> => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    setCurrentUser(res.user);
    await loadWorkspaceData(res.user);
    return res.user;
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network error
    }
    setAuthToken(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
    await fetchAuthStatus();
  };

  const showNotice = (type: 'warning' | 'info', message: string) => {
    setAlertNotice({ type, message });
    setTimeout(() => {
      setAlertNotice((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleSaveItem = async (payload: Record<string, unknown>, id?: number) => {
    if (!currentUser) return;
    if (id) {
      await apiRequest(`/api/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showNotice('info', `Updated "${String(payload.name)}" in inventory.`);
    } else {
      await apiRequest('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showNotice('info', `Added "${String(payload.name)}" with barcode ${String(payload.barcode)}.`);
    }
    await loadWorkspaceData(currentUser);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!currentUser) return;
    await apiRequest(`/api/items/${item.id}`, { method: 'DELETE' });
    showNotice('info', `Removed "${item.name}" from catalog.`);
    await loadWorkspaceData(currentUser);
  };

  const handleCreateCategory = async (name: string, description: string) => {
    if (!currentUser) return;
    await apiRequest('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    const catsRes = await apiRequest<Category[]>('/api/categories');
    setCategories(catsRes);
    showNotice('info', `Category "${name}" created.`);
  };

  const handleDeleteCategory = async (id: number) => {
    if (!currentUser) return;
    await apiRequest(`/api/categories/${id}`, { method: 'DELETE' });
    await loadWorkspaceData(currentUser);
    showNotice('info', 'Category deleted.');
  };

  const handleImportItems = async (parsedItems: ParsedImportItem[]) => {
    if (!currentUser) return { imported: 0 };
    const res = await apiRequest<{ imported: number }>('/api/items/import', {
      method: 'POST',
      body: JSON.stringify({ items: parsedItems }),
    });
    await loadWorkspaceData(currentUser);
    showNotice('info', `Imported ${res.imported} items into inventory with auto-barcodes.`);
    return res;
  };

  const handleAdjustStock = async (item: InventoryItem, delta: number) => {
    if (!currentUser) return;
    const res = await apiRequest<{ item: InventoryItem; low_stock_triggered: boolean }>(
      `/api/items/${item.id}/stock`,
      {
        method: 'PATCH',
        body: JSON.stringify({ delta, reason: 'Quick inventory adjustment' }),
      }
    );
    if (res.low_stock_triggered) {
      showNotice(
        'warning',
        `Low Stock Alert: "${res.item.name}" has ${res.item.stock_qty} left (min ${res.item.low_stock_threshold}).`
      );
    }
    await loadWorkspaceData(currentUser);
  };

  const handleSetStock = async (item: InventoryItem, setQty: number) => {
    if (!currentUser) return;
    const res = await apiRequest<{ item: InventoryItem; low_stock_triggered: boolean }>(
      `/api/items/${item.id}/stock`,
      {
        method: 'PATCH',
        body: JSON.stringify({ set_qty: setQty, reason: 'Dashboard restock update' }),
      }
    );
    if (res.low_stock_triggered) {
      showNotice(
        'warning',
        `Low Stock Alert: "${res.item.name}" is still low (${res.item.stock_qty} left).`
      );
    } else {
      showNotice('info', `Restocked "${res.item.name}" to ${res.item.stock_qty} units.`);
    }
    await loadWorkspaceData(currentUser);
  };

  const handleCreateBill = async (payload: {
    customer_name: string;
    customer_phone: string;
    payment_method: 'Cash' | 'UPI' | 'Card';
    discount_amount: number;
    items: Array<{ item_id: number; qty: number }>;
  }): Promise<Bill> => {
    const created = await apiRequest<Bill>('/api/bills', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (currentUser) {
      await loadWorkspaceData(currentUser);
    }
    return created;
  };

  const handleDaybookFiltersChange = async (nextFilters: DaybookFilterState) => {
    setDaybookFilters(nextFilters);
    if (!currentUser) return;
    const billsRes = await apiRequest<Bill[]>(buildBillsQueryString(nextFilters));
    setBills(billsRes);
  };

  const handleSaveCompany = async (payload: Partial<CompanySettings>) => {
    const updated = await apiRequest<CompanySettings>('/api/company', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setCompany(updated);
    setAuthStatus((prev) => ({
      ...prev,
      companyName: updated.company_name,
      companyLogo: updated.logo_data,
    }));
  };

  const handleChangeMyPassword = async (currentPassword: string, newPassword: string) => {
    await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  };

  const handleCreateUser = async (payload: {
    username: string;
    full_name: string;
    role: UserRole;
    password: string;
  }) => {
    await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (currentUser) {
      const usersRes = await apiRequest<AuthUser[]>('/api/users');
      setUsers(usersRes);
    }
  };

  const handleUpdateUser = async (
    userId: number,
    payload: { role?: UserRole; is_active?: number; new_password?: string }
  ) => {
    await apiRequest(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (currentUser) {
      const usersRes = await apiRequest<AuthUser[]>('/api/users');
      setUsers(usersRes);
    }
  };

  if (!authStatus.loaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        initialized={authStatus.initialized}
        companyName={authStatus.companyName}
        companyLogo={authStatus.companyLogo}
        onBootstrap={handleBootstrap}
        onLogin={handleLogin}
      />
    );
  }

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory & Barcodes', icon: Boxes },
    { id: 'pos', label: 'POS Billing', icon: Receipt },
    { id: 'reports', label: 'Sales Daybook & Report', icon: BarChart3 },
    { id: 'settings', label: 'Company & Security', icon: Settings },
  ];

  const tabTitles: Record<ActiveTab, string> = {
    dashboard: 'Dashboard Overview',
    inventory: 'Inventory, Categories & Barcodes',
    pos: 'POS Billing & Print',
    reports: 'Sales Daybook & Daily Report',
    settings: 'Company, Design & Security',
  };

  const lowStockCount = summary?.low_stock_count ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden no-print"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar (256px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {company.logo_data ? (
                <img
                  src={company.logo_data}
                  alt={company.company_name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-md object-contain bg-white p-0.5 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-md bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-white truncate">
                  {company.company_name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {company.gst_number || 'Inventory & POS'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'inventory' && lowStockCount > 0 && (
                    <span className="font-mono text-[11px] font-semibold text-amber-400 tabular-nums">
                      {lowStockCount} low
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account & Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-1">
            <div className="text-xs font-semibold text-white truncate">{currentUser.full_name}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="font-mono">@{currentUser.username}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize text-teal-400 font-medium">{currentUser.role}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1-2 primary actions on right */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-6 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 truncate hidden sm:inline">{company.company_name}</span>
              <span className="text-slate-400 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="text-base font-bold tracking-tight text-slate-900 truncate">
                {tabTitles[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {currentUser.role !== 'cashier' && activeTab !== 'pos' && (
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setItemModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            )}
            {activeTab !== 'pos' && (
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Receipt className="w-3.5 h-3.5" />
                New Bill
              </button>
            )}
          </div>
        </header>

        {/* Live Action Alert Toast */}
        {alertNotice && (
          <div className="px-6 pt-4 no-print">
            <div
              className={`px-4 py-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
                alertNotice.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {alertNotice.type === 'warning' && (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                )}
                <span>{alertNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setAlertNotice(null)}
                className="text-slate-500 hover:text-slate-900"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto no-print">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              loading={loadingData}
              company={company}
              userRole={currentUser.role}
              onQuickStockUpdate={handleSetStock}
              onPrintBill={(bill) => setPrintBill(bill)}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              items={items}
              categories={categories}
              loading={loadingData}
              company={company}
              userRole={currentUser.role}
              onAddItem={() => {
                setEditingItem(null);
                setItemModalOpen(true);
              }}
              onEditItem={(item) => {
                setEditingItem(item);
                setItemModalOpen(true);
              }}
              onDeleteItem={handleDeleteItem}
              onAdjustStock={handleAdjustStock}
              onPrintBarcode={(item) => setPrintBarcodeItem(item)}
              onOpenCategories={() => setCategoryModalOpen(true)}
              onOpenExcelImport={() => setImportModalOpen(true)}
            />
          )}

          {activeTab === 'pos' && (
            <PosBillingView
              items={items}
              company={company}
              onCreateBill={handleCreateBill}
              onPrintBill={(bill) => setPrintBill(bill)}
            />
          )}

          {activeTab === 'reports' && (
            <SalesReportView
              bills={bills}
              loading={loadingData}
              company={company}
              userRole={currentUser.role}
              filters={daybookFilters}
              onFiltersChange={handleDaybookFiltersChange}
              onPrintBill={(bill) => setPrintBill(bill)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsSecurityView
              company={company}
              currentUser={currentUser}
              users={users}
              onSaveCompany={handleSaveCompany}
              onChangeMyPassword={handleChangeMyPassword}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <ItemFormModal
        open={itemModalOpen}
        editingItem={editingItem}
        categories={categories}
        userRole={currentUser.role}
        currencySymbol={company.currency_symbol}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
        onCreateCategory={handleCreateCategory}
        onSave={handleSaveItem}
      />

      <CategoryManagerModal
        open={categoryModalOpen}
        categories={categories}
        onClose={() => setCategoryModalOpen(false)}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      <ExcelImportModal
        open={importModalOpen}
        currencySymbol={company.currency_symbol}
        onClose={() => setImportModalOpen(false)}
        onImportItems={handleImportItems}
      />

      <PrintInvoiceModal
        bill={printBill}
        company={company}
        onClose={() => setPrintBill(null)}
      />

      <PrintBarcodeModal
        item={printBarcodeItem}
        company={company}
        onClose={() => setPrintBarcodeItem(null)}
      />
    </div>
  );
}
