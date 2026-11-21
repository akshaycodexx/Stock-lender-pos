import React, { useMemo, useState } from 'react';
import {
  Barcode,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type { Bill, CompanySettings, InventoryItem } from '../types.ts';
import { ProductImage } from './BarcodeSvg.tsx';

interface CartLine {
  item: InventoryItem;
  qty: number;
}

interface PosBillingViewProps {
  items: InventoryItem[];
  company: CompanySettings;
  onCreateBill: (payload: {
    customer_name: string;
    customer_phone: string;
    payment_method: 'Cash' | 'UPI' | 'Card';
    discount_amount: number;
    items: Array<{ item_id: number; qty: number }>;
  }) => Promise<Bill>;
  onPrintBill: (bill: Bill) => void;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({
  items,
  company,
  onCreateBill,
  onPrintBill,
}) => {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [discountInput, setDiscountInput] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scanNotice, setScanNotice] = useState('');

  const currency = company.currency_symbol || '₹';

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  const addToCart = (item: InventoryItem) => {
    setError('');
    if (item.stock_qty <= 0) {
      setError(`"${item.name}" is out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.stock_qty) {
          setError(`Only ${item.stock_qty} units of "${item.name}" available in stock.`);
          return prev;
        }
        return prev.map((c) => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const handleBarcodeEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim().toUpperCase();
    if (!clean) return;
    const exactMatch = items.find(
      (i) => i.barcode.toUpperCase() === clean || i.sku.toUpperCase() === clean
    );
    if (exactMatch) {
      addToCart(exactMatch);
      setScanNotice(`Added ${exactMatch.name} (${exactMatch.barcode})`);
      setQuery('');
      setTimeout(() => setScanNotice(''), 2500);
    } else if (filteredCatalog.length === 1) {
      addToCart(filteredCatalog[0]);
      setScanNotice(`Added ${filteredCatalog[0].name}`);
      setQuery('');
      setTimeout(() => setScanNotice(''), 2500);
    }
  };

  const updateCartQty = (itemId: number, delta: number) => {
    setError('');
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id !== itemId) return c;
          const nextQty = c.qty + delta;
          if (nextQty <= 0) return null;
          if (nextQty > c.item.stock_qty) {
            setError(`Maximum available stock for "${c.item.name}" is ${c.item.stock_qty}.`);
            return c;
          }
          return { ...c, qty: nextQty };
        })
        .filter((c): c is CartLine => c !== null)
    );
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let mrpTotal = 0;
    for (const line of cart) {
      const base = line.item.selling_price * line.qty;
      const lineTax = (base * line.item.tax_rate) / 100;
      subtotal += base;
      tax += lineTax;
      mrpTotal += line.item.mrp * line.qty;
    }
    const discount = Math.max(0, Math.min(subtotal + tax, Number(discountInput) || 0));
    const grandTotal = Math.max(0, subtotal + tax - discount);
    const mrpSavings = Math.max(0, mrpTotal - subtotal + discount);
    return { subtotal, tax, discount, grandTotal, mrpSavings };
  }, [cart, discountInput]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const created = await onCreateBill({
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        payment_method: paymentMethod,
        discount_amount: totals.discount,
        items: cart.map((c) => ({ item_id: c.item.id, qty: c.qty })),
      });
      setCart([]);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setDiscountInput('0');
      onPrintBill(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Barcode Scanner & Catalog Grid */}
      <div className="xl:col-span-7 space-y-4">
        <form
          onSubmit={handleBarcodeEnter}
          className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-teal-700 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan or type barcode (e.g. ROY482910) or search item name..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Add Barcode
            </button>
          </div>
          {scanNotice && (
            <p className="text-xs font-medium text-emerald-700">{scanNotice}</p>
          )}
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCatalog.map((item) => {
            const out = item.stock_qty <= 0;
            const low = !out && item.stock_qty <= item.low_stock_threshold;
            return (
              <button
                key={item.id}
                type="button"
                disabled={out}
                onClick={() => addToCart(item)}
                className={`text-left bg-white border rounded-xl p-3.5 transition-colors flex flex-col justify-between ${
                  out
                    ? 'border-slate-200 opacity-55 cursor-not-allowed'
                    : 'border-slate-200 hover:border-teal-600 hover:bg-teal-50/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <ProductImage src={item.image_url} alt={item.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {item.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {item.barcode}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                      {currency}
                      {item.selling_price.toFixed(2)}
                    </div>
                    {item.mrp > item.selling_price && (
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 line-through">
                        MRP {currency}
                        {item.mrp.toFixed(0)}
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-[11px] font-mono font-semibold tabular-nums ${
                      out
                        ? 'text-red-600'
                        : low
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {out ? 'Out of stock' : `${item.stock_qty} ${item.unit}`}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredCatalog.length === 0 && (
            <div className="col-span-full bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              <Search className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              No items found matching &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </div>

      {/* Right: Active Bill Cart & Checkout */}
      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden xl:sticky xl:top-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-teal-700" />
            <h3 className="text-base font-semibold text-slate-900">Current Bill</h3>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {cart.reduce((s, l) => s + l.qty, 0)} items
          </span>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Customer & Payment Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Phone (Optional)
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          {/* Cart Items List */}
          {cart.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm font-medium text-slate-700">Bill cart is empty</p>
              <p className="text-xs text-slate-500 mt-1">
                Scan a barcode or click any item on the left to add it to the invoice.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {cart.map(({ item, qty }) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                    <div className="text-xs font-mono text-slate-500 tabular-nums">
                      {currency}
                      {item.selling_price.toFixed(2)} × {qty} (+{item.tax_rate}% tax)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, -1)}
                      className="w-7 h-7 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                      aria-label={`Decrease quantity for ${item.name}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-mono text-sm font-semibold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, 1)}
                      className="w-7 h-7 inline-flex items-center justify-center border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                      aria-label={`Increase quantity for ${item.name}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, -qty)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Discount & Payment Mode */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Discount ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {(['Cash', 'UPI', 'Card'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1 text-xs font-medium rounded transition-colors ${
                      paymentMethod === method
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bill Totals Summary */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">
                {currency}
                {totals.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST / Tax</span>
              <span className="font-mono tabular-nums">
                {currency}
                {totals.tax.toFixed(2)}
              </span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Bill Discount</span>
                <span className="font-mono tabular-nums">
                  -{currency}
                  {totals.discount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 text-lg font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="font-mono tabular-nums">
                {currency}
                {totals.grandTotal.toFixed(2)}
              </span>
            </div>
            {totals.mrpSavings > 0 && (
              <div className="text-xs text-emerald-700 font-medium text-right font-mono tabular-nums">
                Customer saves {currency}
                {totals.mrpSavings.toFixed(2)} off MRP
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckout}
            className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            {submitting ? 'Generating Invoice...' : 'Complete & Print Bill'}
          </button>
        </div>
      </div>
    </div>
  );
};
