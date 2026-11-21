import React, { useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import {
  downloadInventoryImportTemplate,
  parseImportSpreadsheetText,
  type ParsedImportItem,
} from '../utils/excel.ts';

interface ExcelImportModalProps {
  open: boolean;
  currencySymbol: string;
  onClose: () => void;
  onImportItems: (items: ParsedImportItem[]) => Promise<{ imported: number }>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  open,
  currencySymbol,
  onClose,
  onImportItems,
}) => {
  const [rawText, setRawText] = useState('');
  const [previewItems, setPreviewItems] = useState<ParsedImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleTextParse = (text: string) => {
    setRawText(text);
    setError('');
    try {
      const parsed = parseImportSpreadsheetText(text);
      setPreviewItems(parsed);
    } catch {
      setError('Could not parse pasted spreadsheet data.');
      setPreviewItems([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleTextParse(String(reader.result || ''));
    };
    reader.onerror = () => setError('Failed to read selected file.');
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (previewItems.length === 0) return;
    setImporting(true);
    setError('');
    try {
      await onImportItems(previewItems);
      setRawText('');
      setPreviewItems([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl shadow-lg overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-teal-700" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Import Items from Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Upload a CSV / Excel XML (.xls) file or copy-paste rows directly from Excel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Close Excel import modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Choose CSV / Excel (.xls) File
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,.xls,.xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={downloadInventoryImportTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Sample Template
              </button>
            </div>
            <span className="text-[11px] text-slate-500">
              Missing barcodes auto-generate from 1st 3 chars + digits
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Or Paste Excel Rows / CSV Data Below
            </label>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => handleTextParse(e.target.value)}
              placeholder={`name,category,unit,mrp,selling_price,buying_price,tax_rate,stock_qty,low_stock_threshold\nOrganic Honey 500g,Oils & Condiments,bottle,450,395,290,5,20,8`}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          {previewItems.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Preview ({previewItems.length} items ready to import)</span>
                <span className="font-mono text-teal-700">Auto-barcodes assigned</span>
              </div>
              <div className="overflow-x-auto max-h-52">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Item Name</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Barcode</th>
                      <th className="py-2 px-3 text-right">MRP</th>
                      <th className="py-2 px-3 text-right">Selling</th>
                      <th className="py-2 px-3 text-right">Buying</th>
                      <th className="py-2 px-3 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                        <td className="py-2 px-3 text-slate-600">{item.category}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{item.barcode}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {currencySymbol}
                          {item.mrp}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {currencySymbol}
                          {item.selling_price}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {currencySymbol}
                          {item.buying_price}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {item.stock_qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={previewItems.length === 0 || importing}
              onClick={handleConfirmImport}
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
            >
              {importing ? 'Importing...' : `Import ${previewItems.length} Items`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
