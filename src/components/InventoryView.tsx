import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  FileSpreadsheet,
  FolderKanban,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import type { Category, CompanySettings, InventoryItem, UserRole } from '../types.ts';
import { exportInventoryToExcel } from '../utils/excel.ts';
import { BarcodeSvg, ProductImage } from './BarcodeSvg.tsx';

interface InventoryViewProps {
  items: InventoryItem[];
  categories: Category[];
  loading: boolean;
  company: CompanySettings;
  userRole: UserRole;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => Promise<void>;
  onAdjustStock: (item: InventoryItem, delta: number) => Promise<void>;
  onPrintBarcode: (item: InventoryItem) => void;
  onOpenCategories: () => void;
  onOpenExcelImport: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  categories,
  loading,
  company,
  userRole,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAdjustStock,
  onPrintBarcode,
  onOpenCategories,
  onOpenExcelImport,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'nominal'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const currency = company.currency_symbol || '₹';

  const categoryOptions = useMemo(() => {
    const set = new Set([
      ...categories.map((c) => c.name),
      ...items.map((i) => i.category).filter(Boolean),
    ]);
    return ['all', ...Array.from(set).sort()];
  }, [categories, items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      const isOut = item.stock_qty === 0;
      const isLow = item.stock_qty > 0 && item.stock_qty <= item.low_stock_threshold;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'out' && isOut) ||
        (statusFilter === 'low' && (isLow || isOut)) ||
        (statusFilter === 'nominal' && item.stock_qty > item.low_stock_threshold);

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [items, search, statusFilter, categoryFilter]);

  const lowCount = items.filter((i) => i.stock_qty <= i.low_stock_threshold).length;

  const handleDelta = async (item: InventoryItem, delta: number) => {
    setBusyId(item.id);
    try {
      await onAdjustStock(item, delta);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Low Stock Warning Summary */}
      {lowCount > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong className="font-mono tabular-nums">{lowCount}</strong> item
              {lowCount > 1 ? 's' : ''} currently at or below low-stock threshold.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')}
            className="text-xs font-semibold text-amber-900 underline underline-offset-4 hover:text-amber-700 whitespace-nowrap"
          >
            {statusFilter === 'low' ? 'Show All Items' : 'Filter Low Stock Items'}
          </button>
        </div>
      )}

      {/* Search, Category & Excel Actions Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[230px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by item name, barcode, or SKU..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userRole !== 'cashier' && (
              <>
                <button
                  type="button"
                  onClick={onOpenCategories}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  Categories
                </button>
                <button
                  type="button"
                  onClick={onOpenExcelImport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
                  Import Excel
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => exportInventoryToExcel(filteredItems, company, userRole)}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
            {userRole !== 'cashier' && (
              <button
                type="button"
                onClick={onAddItem}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'nominal', label: 'In Stock' },
              { id: 'low', label: 'Low Stock' },
              { id: 'out', label: 'Out of Stock' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Showing {filteredItems.length} of {items.length}
          </span>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-900">No inventory items match your filters</p>
            <p className="text-xs text-slate-500 mt-1">
              Clear your search filter, import items from Excel, or add a new item.
            </p>
            {userRole !== 'cashier' && (
              <button
                type="button"
                onClick={onAddItem}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Item
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Item &amp; Details</th>
                  <th className="py-3 px-4">Barcode (Auto)</th>
                  <th className="py-3 px-4 text-right">MRP</th>
                  <th className="py-3 px-4 text-right">Selling</th>
                  {userRole !== 'cashier' && <th className="py-3 px-4 text-right">Buying</th>}
                  <th className="py-3 px-4 text-right">Stock Level</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map((item) => {
                  const isOut = item.stock_qty === 0;
                  const isLow = item.stock_qty > 0 && item.stock_qty <= item.low_stock_threshold;
                  const profit =
                    item.buying_price !== null ? item.selling_price - item.buying_price : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3.5">
                          <ProductImage src={item.image_url} alt={item.name} size="md" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[230px]">
                              {item.name}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{item.category}</span>
                              <span aria-hidden="true">·</span>
                              <span>{item.unit}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{item.sku}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <BarcodeSvg value={item.barcode} height={28} />
                          <button
                            type="button"
                            onClick={() => onPrintBarcode(item)}
                            title="Design & print barcode labels"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                        {currency}
                        {item.mrp.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-semibold tabular-nums text-slate-900">
                          {currency}
                          {item.selling_price.toFixed(2)}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          GST {item.tax_rate}%
                        </div>
                      </td>

                      {userRole !== 'cashier' && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono tabular-nums text-slate-700">
                            {currency}
                            {(item.buying_price ?? 0).toFixed(2)}
                          </div>
                          {profit !== null && (
                            <div
                              className={`text-[11px] font-mono tabular-nums ${
                                profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              +{currency}
                              {profit.toFixed(2)}
                            </div>
                          )}
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            {userRole !== 'cashier' && (
                              <button
                                type="button"
                                disabled={busyId === item.id || item.stock_qty <= 0}
                                onClick={() => handleDelta(item, -1)}
                                className="w-6 h-6 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                                title="Decrease stock by 1"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            )}
                            <span
                              className={`font-mono font-bold tabular-nums min-w-[2.2rem] text-center ${
                                isOut
                                  ? 'text-red-600'
                                  : isLow
                                    ? 'text-amber-700'
                                    : 'text-slate-900'
                              }`}
                            >
                              {item.stock_qty}
                            </span>
                            {userRole !== 'cashier' && (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => handleDelta(item, 1)}
                                className="w-6 h-6 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                                title="Increase stock by 1"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] font-medium">
                            {isOut ? (
                              <span className="text-red-600">Out of Stock</span>
                            ) : isLow ? (
                              <span className="text-amber-700">
                                Low Stock (Min {item.low_stock_threshold})
                              </span>
                            ) : (
                              <span className="text-emerald-700">Nominal</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {userRole !== 'cashier' && (
                            <button
                              type="button"
                              onClick={() => onEditItem(item)}
                              className="p-2 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                              title="Edit item"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {userRole === 'admin' && (
                            <button
                              type="button"
                              onClick={() => onDeleteItem(item)}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {userRole === 'cashier' && (
                            <button
                              type="button"
                              onClick={() => onPrintBarcode(item)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                            >
                              Label
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
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
