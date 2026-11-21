import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { Bill, CompanySettings, UserRole } from '../types.ts';
import { exportDaybookToExcel } from '../utils/excel.ts';

export interface DaybookFilterState {
  from: string;
  to: string;
  payment: '' | 'Cash' | 'UPI' | 'Card';
  cashier: string;
  q: string;
}

interface SalesReportViewProps {
  bills: Bill[];
  loading: boolean;
  company: CompanySettings;
  userRole: UserRole;
  filters: DaybookFilterState;
  onFiltersChange: (next: DaybookFilterState) => void;
  onPrintBill: (bill: Bill) => void;
}

export const SalesReportView: React.FC<SalesReportViewProps> = ({
  bills,
  loading,
  company,
  userRole,
  filters,
  onFiltersChange,
  onPrintBill,
}) => {
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);
  const currency = company.currency_symbol || '₹';

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysStr = sevenDaysAgo.toISOString().slice(0, 10);
  const monthStartStr = `${todayStr.slice(0, 8)}01`;

  const cashierOptions = useMemo(() => {
    const names = new Set(bills.map((b) => b.created_by_name).filter(Boolean));
    if (filters.cashier) names.add(filters.cashier);
    return Array.from(names).sort();
  }, [bills, filters.cashier]);

  const metrics = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let tax = 0;
    let discount = 0;
    let units = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let hasCost = userRole !== 'cashier';

    for (const b of bills) {
      revenue += b.total_amount;
      tax += b.tax_amount;
      discount += b.discount_amount;
      if (b.payment_method === 'Cash') cashTotal += b.total_amount;
      if (b.payment_method === 'UPI') upiTotal += b.total_amount;
      if (b.payment_method === 'Card') cardTotal += b.total_amount;

      if (b.total_cost !== null) {
        cost += b.total_cost;
      } else {
        hasCost = false;
      }
      for (const item of b.items || []) {
        units += item.qty;
      }
    }

    return {
      count: bills.length,
      revenue,
      tax,
      discount,
      cost: hasCost ? cost : null,
      profit: hasCost ? revenue - cost : null,
      units,
      cashTotal,
      upiTotal,
      cardTotal,
    };
  }, [bills, userRole]);

  const rangeLabel =
    filters.from && filters.to
      ? filters.from === filters.to
        ? filters.from
        : `${filters.from} to ${filters.to}`
      : filters.from
        ? `From ${filters.from}`
        : filters.to
          ? `Until ${filters.to}`
          : 'All Records';

  const handleExportCsv = () => {
    const headers = [
      'Bill Number',
      'Date Time',
      'Customer',
      'Phone',
      'Payment Method',
      'Subtotal',
      'Tax',
      'Discount',
      'Total Amount',
      ...(userRole !== 'cashier' ? ['Total Cost', 'Profit'] : []),
      'Cashier',
    ];
    const rows = bills.map((b) => [
      b.bill_number,
      b.created_at,
      `"${(b.customer_name || '').replace(/"/g, '""')}"`,
      b.customer_phone,
      b.payment_method,
      b.subtotal.toFixed(2),
      b.tax_amount.toFixed(2),
      b.discount_amount.toFixed(2),
      b.total_amount.toFixed(2),
      ...(userRole !== 'cashier'
        ? [
            (b.total_cost ?? 0).toFixed(2),
            (b.total_amount - (b.total_cost ?? 0)).toFixed(2),
          ]
        : []),
      `"${b.created_by_name.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-daybook-${filters.from || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activePreset =
    filters.from === todayStr && filters.to === todayStr
      ? 'today'
      : filters.from === yesterdayStr && filters.to === yesterdayStr
        ? 'yesterday'
        : filters.from === sevenDaysStr && filters.to === todayStr
          ? '7days'
          : filters.from === monthStartStr && filters.to === todayStr
            ? 'month'
            : !filters.from && !filters.to
              ? 'all'
              : 'custom';

  return (
    <div className="space-y-5">
      {/* Daybook Filters & Excel Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'today', label: 'Today', from: todayStr, to: todayStr },
              { id: 'yesterday', label: 'Yesterday', from: yesterdayStr, to: yesterdayStr },
              { id: '7days', label: 'Last 7 Days', from: sevenDaysStr, to: todayStr },
              { id: 'month', label: 'This Month', from: monthStartStr, to: todayStr },
              { id: 'all', label: 'All Bills', from: '', to: '' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onFiltersChange({ ...filters, from: preset.from, to: preset.to })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activePreset === preset.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportDaybookToExcel(bills, company, userRole, rangeLabel)}
              disabled={bills.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel Daybook
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={bills.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Advanced Daybook Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
              placeholder="Search bill no, customer, phone, or item..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div className="lg:col-span-2 relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
              aria-label="From date"
              className="w-full pl-8 pr-2 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div className="lg:col-span-2 relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
              aria-label="To date"
              className="w-full pl-8 pr-2 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={filters.payment}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  payment: e.target.value as DaybookFilterState['payment'],
                })
              }
              aria-label="Filter by payment method"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center gap-1.5">
            <select
              value={filters.cashier}
              onChange={(e) => onFiltersChange({ ...filters, cashier: e.target.value })}
              aria-label="Filter by cashier"
              className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Staff</option>
              {cashierOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {(filters.q || filters.payment || filters.cashier || activePreset === 'custom') && (
              <button
                type="button"
                onClick={() =>
                  onFiltersChange({
                    from: todayStr,
                    to: todayStr,
                    payment: '',
                    cashier: '',
                    q: '',
                  })
                }
                title="Reset filters"
                className="p-2 text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg bg-white shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Daybook Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Invoices</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {metrics.count}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
            {metrics.units} units sold
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Gross Sales</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {currency}
            {metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
            GST: {currency}
            {metrics.tax.toFixed(2)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Cash / UPI / Card</div>
          <div className="text-xs font-mono tabular-nums text-slate-800 mt-2 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Cash</span>
              <span className="font-semibold">
                {currency}
                {metrics.cashTotal.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">UPI / Card</span>
              <span className="font-semibold">
                {currency}
                {(metrics.upiTotal + metrics.cardTotal).toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">Discounts</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {currency}
            {metrics.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">{rangeLabel}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-medium">
            {metrics.profit !== null ? 'Net Gross Profit' : 'Daybook Period'}
          </div>
          {metrics.profit !== null ? (
            <>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {currency}
                {metrics.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                Cost: {currency}
                {(metrics.cost ?? 0).toFixed(2)}
              </div>
            </>
          ) : (
            <div className="text-sm font-semibold text-slate-800 mt-2">{rangeLabel}</div>
          )}
        </div>
      </div>

      {/* Detailed Daybook Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-900">
              No daybook entries match your current filters
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try expanding the date range, clearing the search query, or switching payment mode.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Invoice</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  {userRole !== 'cashier' && <th className="py-3 px-4 text-right">Profit</th>}
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {bills.map((bill) => {
                  const isOpen = expandedBillId === bill.id;
                  const billProfit =
                    bill.total_cost !== null ? bill.total_amount - bill.total_cost : null;
                  return (
                    <React.Fragment key={bill.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-5">
                          <button
                            type="button"
                            onClick={() => setExpandedBillId(isOpen ? null : bill.id)}
                            className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 hover:text-teal-700"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            {bill.bill_number}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-600">
                          {new Date(bill.created_at.replace(' ', 'T')).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{bill.customer_name}</div>
                          <div className="text-xs text-slate-500">By {bill.created_by_name}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">
                          {bill.payment_method}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {currency}
                          {bill.total_amount.toFixed(2)}
                        </td>
                        {userRole !== 'cashier' && (
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                            {billProfit !== null ? `+${currency}${billProfit.toFixed(2)}` : '—'}
                          </td>
                        )}
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onPrintBill(bill)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={userRole !== 'cashier' ? 7 : 6} className="px-10 py-3">
                            <div className="text-xs font-semibold text-slate-600 mb-2">
                              Line Items ({bill.items?.length || 0})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {(bill.items || []).map((line) => (
                                <div
                                  key={line.id}
                                  className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-2 text-xs"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-medium text-slate-900 truncate">
                                      {line.item_name}
                                    </div>
                                    <div className="font-mono text-slate-500">
                                      {line.qty} × {currency}
                                      {line.unit_price.toFixed(2)}
                                    </div>
                                  </div>
                                  <div className="font-mono font-semibold text-slate-900 tabular-nums">
                                    {currency}
                                    {line.line_total.toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
