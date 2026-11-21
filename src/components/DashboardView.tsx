import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  IndianRupee,
  Printer,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import type { Bill, CompanySettings, DashboardSummary, InventoryItem, UserRole } from '../types.ts';
import { ProductImage } from './BarcodeSvg.tsx';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  company: CompanySettings;
  userRole: UserRole;
  onQuickStockUpdate: (item: InventoryItem, setQty: number) => Promise<void>;
  onPrintBill: (bill: Bill) => void;
  onNavigate: (tab: 'inventory' | 'pos' | 'reports') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  loading,
  company,
  userRole,
  onQuickStockUpdate,
  onPrintBill,
  onNavigate,
}) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [restockInputs, setRestockInputs] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const currency = company.currency_symbol || '₹';

  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(100, ...summary.daily_series.map((d) => d.revenue));
  const activePoint =
    summary.daily_series.find((d) => d.date === hoveredDay) ||
    summary.daily_series[summary.daily_series.length - 1];

  const handleRestock = async (item: InventoryItem) => {
    const val = Number(restockInputs[item.id] ?? item.low_stock_threshold + 15);
    if (Number.isNaN(val) || val < 0) return;
    setUpdatingId(item.id);
    try {
      await onQuickStockUpdate(item, Math.floor(val));
      setRestockInputs((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Low Stock Alert Strip */}
      {summary.low_stock_items.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Low Stock Alert — {summary.low_stock_count} item
                {summary.low_stock_count > 1 ? 's' : ''} need restocking
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {summary.out_of_stock_count > 0
                  ? `${summary.out_of_stock_count} out of stock and ${
                      summary.low_stock_count - summary.out_of_stock_count
                    } below threshold.`
                  : 'All flagged items are at or below their minimum stock threshold.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-white border border-amber-300 hover:bg-amber-100/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Inspect Inventory
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Stock Units</span>
            <Boxes className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.total_stock_units.toLocaleString()}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono tabular-nums text-slate-700">{summary.total_skus} SKUs</span>
            <span aria-hidden="true">·</span>
            <span>Active catalog</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Stock Valuation (Retail)</span>
            <IndianRupee className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {currency}
            {summary.inventory_selling_value.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {summary.inventory_buying_value !== null ? (
              <span className="font-mono tabular-nums">
                Cost: {currency}
                {summary.inventory_buying_value.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            ) : (
              <span>Current shelf retail value</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Today&apos;s Sales</span>
            <TrendingUp className="w-4 h-4 text-teal-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {currency}
            {summary.today_revenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono tabular-nums text-slate-700">
              {summary.today_bills_count} bills
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{summary.today_units_sold} units sold</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>
              {summary.today_profit !== null ? "Today's Gross Profit" : 'Low Stock Alerts'}
            </span>
            {summary.today_profit !== null ? (
              <Receipt className="w-4 h-4 text-emerald-700" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          {summary.today_profit !== null ? (
            <>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {currency}
                {summary.today_profit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
                <span
                  className={
                    summary.low_stock_count > 0
                      ? 'text-amber-700 font-medium'
                      : 'text-emerald-700 font-medium'
                  }
                >
                  {summary.low_stock_count} low stock
                </span>
                <span aria-hidden="true">·</span>
                <span>{summary.out_of_stock_count} empty</span>
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
                {summary.low_stock_count}
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                {summary.out_of_stock_count} out of stock
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Analytics Split: 7-Day Daily Sales Report + Low Stock Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Daily Sales Report (Last 7 Days)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hover any day column to inspect revenue, bills, and profit margin
              </p>
            </div>
            {activePoint && (
              <div className="text-right font-mono tabular-nums">
                <div className="text-xs text-slate-500">{activePoint.date}</div>
                <div className="text-sm font-bold text-slate-900">
                  {currency}
                  {activePoint.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {activePoint.profit !== null && (
                    <span className="text-emerald-700 font-medium ml-2">
                      (+{currency}
                      {activePoint.profit.toFixed(0)} profit)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activePoint.bills_count} invoice{activePoint.bills_count === 1 ? '' : 's'}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 pb-2">
            <div className="grid grid-cols-7 gap-3 items-end h-52">
              {summary.daily_series.map((point) => {
                const heightPct = Math.max(6, Math.round((point.revenue / maxRevenue) * 100));
                const profitPct =
                  point.profit !== null && point.revenue > 0
                    ? Math.max(0, Math.min(100, Math.round((point.profit / point.revenue) * 100)))
                    : 0;
                const isSelected = activePoint?.date === point.date;
                const shortLabel = new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                });

                return (
                  <button
                    key={point.date}
                    type="button"
                    onMouseEnter={() => setHoveredDay(point.date)}
                    onFocus={() => setHoveredDay(point.date)}
                    onClick={() => onNavigate('reports')}
                    className="flex flex-col items-center h-full justify-end group focus:outline-none"
                  >
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {currency}
                      {Math.round(point.revenue)}
                    </span>
                    <div
                      className={`w-full max-w-[44px] rounded-t-md relative overflow-hidden transition-colors ${
                        isSelected
                          ? 'bg-teal-700'
                          : 'bg-slate-200 group-hover:bg-teal-600/80'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    >
                      {point.profit !== null && profitPct > 0 && (
                        <div
                          className="absolute bottom-0 inset-x-0 bg-emerald-500/40"
                          style={{ height: `${profitPct}%` }}
                        />
                      )}
                    </div>
                    <span className="mt-2 text-xs font-medium text-slate-700">{shortLabel}</span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {point.date.slice(5)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Click any bar to open full Daily Sales Ledger</span>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              View Full Sales Report
            </button>
          </div>
        </div>

        {/* Low Stock Action Queue */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Restock Watchlist</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Items at or below minimum threshold
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
              {summary.low_stock_items.length} items
            </span>
          </div>

          {summary.low_stock_items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-slate-500">
              <Boxes className="w-8 h-8 text-emerald-600 mb-2" />
              <p className="text-sm font-medium text-slate-800">All stock levels healthy</p>
              <p className="text-xs text-slate-500 mt-1">
                No items are currently below their alert threshold.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-72 mt-1">
              {summary.low_stock_items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductImage src={item.image_url} alt={item.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs font-mono tabular-nums flex items-center gap-1.5">
                        <span
                          className={
                            item.stock_qty === 0
                              ? 'text-red-600 font-semibold'
                              : 'text-amber-700 font-semibold'
                          }
                        >
                          {item.stock_qty === 0 ? 'Out of stock' : `${item.stock_qty} left`}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">
                          /
                        </span>
                        <span className="text-slate-500">Min {item.low_stock_threshold}</span>
                      </div>
                    </div>
                  </div>

                  {userRole !== 'cashier' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        value={restockInputs[item.id] ?? item.low_stock_threshold + 15}
                        onChange={(e) =>
                          setRestockInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        aria-label={`New stock quantity for ${item.name}`}
                        className="w-14 px-2 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                      />
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleRestock(item)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors whitespace-nowrap"
                      >
                        {updatingId === item.id ? '...' : 'Restock'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Invoices</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest completed POS bills with 1-click receipt printing
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Open POS Billing
          </button>
        </div>

        {summary.recent_bills.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No bills recorded yet. Create your first invoice in POS Billing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">Bill No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-6 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {summary.recent_bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 font-mono font-semibold text-slate-900 tabular-nums">
                      {bill.bill_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{bill.customer_name}</div>
                      {bill.customer_phone && (
                        <div className="text-xs font-mono text-slate-500">{bill.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-600">
                      {new Date(bill.created_at.replace(' ', 'T')).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {bill.payment_method}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {currency}
                      {bill.total_amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-6 text-right">
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
