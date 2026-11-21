import React, { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import type {
  BarcodeTemplateStyle,
  Bill,
  BillTemplateStyle,
  CompanySettings,
  InventoryItem,
} from '../types.ts';
import { BarcodeSvg } from './BarcodeSvg.tsx';

interface PrintInvoiceModalProps {
  bill: Bill | null;
  company: CompanySettings;
  onClose: () => void;
}

const ACCENT_OPTIONS = [
  { label: 'Teal', color: '#0F766E' },
  { label: 'Slate', color: '#0F172A' },
  { label: 'Indigo', color: '#1D4ED8' },
  { label: 'Amber', color: '#B45309' },
];

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  bill,
  company,
  onClose,
}) => {
  const [template, setTemplate] = useState<BillTemplateStyle>(company.bill_template || 'classic');
  const [accentColor, setAccentColor] = useState<string>(company.bill_accent_color || '#0F766E');
  const [showGst, setShowGst] = useState<boolean>(company.bill_show_gst !== 0);
  const [showMrp, setShowMrp] = useState<boolean>(company.bill_show_mrp !== 0);

  useEffect(() => {
    setTemplate(company.bill_template || 'classic');
    setAccentColor(company.bill_accent_color || '#0F766E');
    setShowGst(company.bill_show_gst !== 0);
    setShowMrp(company.bill_show_mrp !== 0);
  }, [company, bill]);

  if (!bill) return null;
  const currency = company.currency_symbol || '₹';
  const items = bill.items || [];
  const totalMrpSavings = items.reduce(
    (acc, line) => acc + Math.max(0, (line.mrp - line.unit_price) * line.qty),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto print-backdrop">
      <div
        className={`bg-white border border-slate-200 rounded-xl w-full shadow-lg overflow-hidden print-only-container ${
          template === 'thermal' ? 'max-w-md' : 'max-w-3xl'
        }`}
      >
        {/* Bill Design Toolbar (Hidden in print) */}
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 no-print bg-slate-50/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              Invoice Preview — {bill.bill_number}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close invoice preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {[
                { id: 'classic', label: 'Classic A4' },
                { id: 'modern', label: 'Modern Header' },
                { id: 'thermal', label: 'Thermal 80mm' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTemplate(opt.id as BillTemplateStyle)}
                  className={`px-2.5 py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
                    template === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {template !== 'thermal' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Accent:</span>
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.color}
                      type="button"
                      onClick={() => setAccentColor(opt.color)}
                      title={opt.label}
                      className={`w-5 h-5 rounded-md border transition-transform ${
                        accentColor === opt.color
                          ? 'border-slate-900 scale-110'
                          : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: opt.color }}
                    />
                  ))}
                </div>
              )}

              <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMrp}
                  onChange={(e) => setShowMrp(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Show MRP
              </label>
              <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGst}
                  onChange={(e) => setShowGst(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Show Tax %
              </label>
            </div>
          </div>
        </div>

        {/* Thermal 80mm Receipt Layout */}
        {template === 'thermal' ? (
          <div className="p-6 bg-white text-slate-900 font-mono text-xs max-w-[360px] mx-auto">
            <div className="text-center pb-3 border-b border-dashed border-slate-400">
              {company.logo_data && (
                <img
                  src={company.logo_data}
                  alt={company.company_name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 object-contain mx-auto mb-1.5"
                />
              )}
              <div className="text-sm font-bold uppercase tracking-wide">
                {company.company_name}
              </div>
              {company.address && <div className="text-[11px] text-slate-600 mt-0.5">{company.address}</div>}
              {company.phone && <div className="text-[11px] text-slate-600">Tel: {company.phone}</div>}
              {showGst && company.gst_number && (
                <div className="text-[11px] text-slate-600">GSTIN: {company.gst_number}</div>
              )}
            </div>

            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Bill: {bill.bill_number}</span>
                <span>{bill.payment_method}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{new Date(bill.created_at.replace(' ', 'T')).toLocaleString()}</span>
              </div>
              <div>Customer: {bill.customer_name}</div>
            </div>

            <table className="w-full text-left border-collapse my-2 text-[11px]">
              <thead>
                <tr className="border-b border-dashed border-slate-400">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Rate</th>
                  <th className="py-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-200">
                {items.map((line) => (
                  <tr key={line.id}>
                    <td className="py-1.5 pr-1">
                      <div className="font-semibold text-slate-900">{line.item_name}</div>
                      {showMrp && line.mrp > line.unit_price && (
                        <div className="text-[10px] text-slate-500">
                          MRP {currency}
                          {line.mrp.toFixed(0)}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{line.qty}</td>
                    <td className="py-1.5 text-right tabular-nums">{line.unit_price.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {line.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-2 border-t border-dashed border-slate-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {currency}
                  {bill.subtotal.toFixed(2)}
                </span>
              </div>
              {showGst && (
                <div className="flex justify-between">
                  <span>GST / Tax</span>
                  <span className="tabular-nums">
                    {currency}
                    {bill.tax_amount.toFixed(2)}
                  </span>
                </div>
              )}
              {bill.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{currency}
                    {bill.discount_amount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-400 text-sm font-bold">
                <span>TOTAL</span>
                <span className="tabular-nums">
                  {currency}
                  {bill.total_amount.toFixed(2)}
                </span>
              </div>
              {showMrp && totalMrpSavings > 0 && (
                <div className="text-center font-semibold pt-1">
                  Saved {currency}
                  {totalMrpSavings.toFixed(2)} on MRP
                </div>
              )}
            </div>

            <div className="mt-4 pt-2 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-600">
              {company.invoice_footer}
            </div>
          </div>
        ) : (
          /* Classic A4 or Modern Accent Layout */
          <div className="bg-white text-slate-900">
            {template === 'modern' ? (
              <div
                className="px-8 py-6 text-white flex items-start justify-between gap-6"
                style={{ backgroundColor: accentColor }}
              >
                <div className="flex items-start gap-4">
                  {company.logo_data && (
                    <img
                      src={company.logo_data}
                      alt={company.company_name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-contain rounded-lg bg-white p-1"
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      {company.company_name}
                    </h2>
                    {company.tagline && (
                      <p className="text-xs text-white/80 mt-0.5">{company.tagline}</p>
                    )}
                    {company.address && (
                      <p className="text-xs text-white/85 mt-1.5 max-w-sm">{company.address}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/85 mt-1">
                      {company.phone && <span>Tel: {company.phone}</span>}
                      {company.phone && showGst && company.gst_number && (
                        <span aria-hidden="true">·</span>
                      )}
                      {showGst && company.gst_number && (
                        <span className="font-mono">GSTIN: {company.gst_number}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/75">
                    Tax Invoice
                  </div>
                  <div className="font-mono text-lg font-bold text-white mt-0.5 tabular-nums">
                    {bill.bill_number}
                  </div>
                  <div className="text-xs text-white/80 mt-1 tabular-nums">
                    {new Date(bill.created_at.replace(' ', 'T')).toLocaleString()}
                  </div>
                  <div className="text-xs text-white/90 mt-1">
                    Mode: <span className="font-semibold">{bill.payment_method}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-8 pt-8 pb-6 border-b border-slate-200 flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  {company.logo_data && (
                    <img
                      src={company.logo_data}
                      alt={company.company_name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-contain rounded border border-slate-200"
                    />
                  )}
                  <div>
                    <h2
                      className="text-xl font-bold tracking-tight"
                      style={{ color: accentColor }}
                    >
                      {company.company_name}
                    </h2>
                    {company.tagline && (
                      <p className="text-xs text-slate-500 mt-0.5">{company.tagline}</p>
                    )}
                    {company.address && (
                      <p className="text-xs text-slate-600 mt-1.5 max-w-sm">{company.address}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
                      {company.phone && <span>Tel: {company.phone}</span>}
                      {company.phone && showGst && company.gst_number && (
                        <span aria-hidden="true">·</span>
                      )}
                      {showGst && company.gst_number && (
                        <span className="font-mono">GSTIN: {company.gst_number}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tax Invoice
                  </div>
                  <div className="font-mono text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                    {bill.bill_number}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 tabular-nums">
                    {new Date(bill.created_at.replace(' ', 'T')).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Payment: <span className="font-semibold text-slate-900">{bill.payment_method}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="px-8 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs bg-slate-50/40">
              <div>
                <span className="text-slate-500">Billed To: </span>
                <span className="font-semibold text-slate-900">{bill.customer_name}</span>
                {bill.customer_phone && (
                  <span className="text-slate-600 ml-2 font-mono">({bill.customer_phone})</span>
                )}
              </div>
              <div className="text-slate-500">
                Cashier: <span className="text-slate-800 font-medium">{bill.created_by_name}</span>
              </div>
            </div>

            <div className="px-8 py-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b-2 text-xs font-semibold text-slate-600"
                    style={{ borderColor: accentColor }}
                  >
                    <th className="py-2 pr-3">Item Description</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    {showMrp && <th className="py-2 px-2 text-right">MRP</th>}
                    <th className="py-2 px-2 text-right">Rate</th>
                    {showGst && <th className="py-2 px-2 text-right">Tax</th>}
                    <th className="py-2 pl-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {items.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">{line.item_name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{line.barcode}</div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">{line.qty}</td>
                      {showMrp && (
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-400">
                          {currency}
                          {line.mrp.toFixed(2)}
                        </td>
                      )}
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                        {currency}
                        {line.unit_price.toFixed(2)}
                      </td>
                      {showGst && (
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-500">
                          {line.tax_rate}%
                        </td>
                      )}
                      <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums">
                        {currency}
                        {line.line_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="text-xs text-slate-500 max-w-sm">
                  {showMrp && totalMrpSavings > 0 && (
                    <p className="font-semibold text-emerald-700 mb-1.5 tabular-nums">
                      You saved {currency}
                      {totalMrpSavings.toFixed(2)} on MRP today.
                    </p>
                  )}
                  <p>{company.invoice_footer}</p>
                </div>

                <div className="w-full sm:w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {currency}
                      {bill.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {showGst && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST / Tax</span>
                      <span className="font-mono tabular-nums">
                        {currency}
                        {bill.tax_amount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {bill.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span className="font-mono tabular-nums">
                        -{currency}
                        {bill.discount_amount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div
                    className="flex justify-between pt-2 border-t text-base font-bold"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    <span>Grand Total</span>
                    <span className="font-mono tabular-nums">
                      {currency}
                      {bill.total_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PrintBarcodeModalProps {
  item: InventoryItem | null;
  company: CompanySettings;
  onClose: () => void;
}

export const PrintBarcodeModal: React.FC<PrintBarcodeModalProps> = ({
  item,
  company,
  onClose,
}) => {
  const [copies, setCopies] = useState(6);
  const [labelStyle, setLabelStyle] = useState<BarcodeTemplateStyle>(
    company.barcode_template || 'standard'
  );
  const [showCompany, setShowCompany] = useState<boolean>(company.barcode_show_company !== 0);
  const [showMrp, setShowMrp] = useState<boolean>(company.barcode_show_mrp !== 0);
  const [barHeight, setBarHeight] = useState<number>(company.barcode_height || 34);

  useEffect(() => {
    setLabelStyle(company.barcode_template || 'standard');
    setShowCompany(company.barcode_show_company !== 0);
    setShowMrp(company.barcode_show_mrp !== 0);
    setBarHeight(company.barcode_height || 34);
  }, [company, item]);

  if (!item) return null;
  const currency = company.currency_symbol || '₹';
  const discountPct =
    item.mrp > item.selling_price && item.mrp > 0
      ? Math.round(((item.mrp - item.selling_price) / item.mrp) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto print-backdrop">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl shadow-lg overflow-hidden print-only-container">
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 no-print bg-slate-50/70">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Barcode Sticker Designer — {item.name}
              </h3>
              <p className="text-xs text-slate-500">
                Customize sticker style, bar height, and printed details before printing
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                Copies
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                  className="w-16 px-2 py-1.5 border border-slate-300 rounded-md text-sm font-mono tabular-nums bg-white"
                />
              </label>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                Print Labels
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close barcode preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {[
                { id: 'standard', label: 'Standard Sticker' },
                { id: 'compact', label: 'Compact Tag' },
                { id: 'detailed', label: 'Shelf Tag' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLabelStyle(opt.id as BarcodeTemplateStyle)}
                  className={`px-2.5 py-1 font-medium rounded-md transition-colors whitespace-nowrap ${
                    labelStyle === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompany}
                  onChange={(e) => setShowCompany(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Company Name
              </label>
              <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMrp}
                  onChange={(e) => setShowMrp(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Show MRP
              </label>
              <label className="inline-flex items-center gap-2 text-slate-700">
                <span>Height</span>
                <input
                  type="range"
                  min={24}
                  max={50}
                  value={barHeight}
                  onChange={(e) => setBarHeight(Number(e.target.value))}
                  className="w-20 accent-teal-700"
                />
              </label>
            </div>
          </div>
        </div>

        <div
          className={`p-6 grid gap-4 bg-white ${
            labelStyle === 'compact'
              ? 'grid-cols-2 sm:grid-cols-4'
              : labelStyle === 'detailed'
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {Array.from({ length: copies }).map((_, idx) =>
            labelStyle === 'detailed' ? (
              <div
                key={idx}
                className="border border-slate-300 rounded-lg p-3.5 bg-white break-inside-avoid flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  {showCompany && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      {company.company_name}
                    </div>
                  )}
                  <div className="text-sm font-bold text-slate-900 truncate mt-0.5">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {item.category} · {item.unit} · {item.sku}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
                    <span className="text-base font-bold text-slate-900">
                      {currency}
                      {item.selling_price.toFixed(2)}
                    </span>
                    {showMrp && item.mrp > item.selling_price && (
                      <span className="text-xs text-slate-400 line-through">
                        MRP {currency}
                        {item.mrp.toFixed(0)}
                      </span>
                    )}
                    {discountPct > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        {discountPct}% OFF
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <BarcodeSvg value={item.barcode} height={barHeight} />
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className={`border border-dashed border-slate-300 rounded-lg flex flex-col items-center text-center bg-white break-inside-avoid ${
                  labelStyle === 'compact' ? 'p-2' : 'p-3'
                }`}
              >
                {showCompany && (
                  <div className="text-[10px] font-semibold text-slate-500 truncate max-w-full">
                    {company.company_name}
                  </div>
                )}
                <div
                  className={`font-semibold text-slate-900 truncate max-w-full mt-0.5 ${
                    labelStyle === 'compact' ? 'text-[11px]' : 'text-xs'
                  }`}
                >
                  {item.name}
                </div>
                <div className="my-1.5">
                  <BarcodeSvg
                    value={item.barcode}
                    height={labelStyle === 'compact' ? Math.max(22, barHeight - 8) : barHeight}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  {showMrp && item.mrp > item.selling_price && (
                    <span className="text-slate-400 line-through">
                      MRP {currency}
                      {item.mrp.toFixed(0)}
                    </span>
                  )}
                  <span className="font-bold text-slate-900">
                    {currency}
                    {item.selling_price.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
