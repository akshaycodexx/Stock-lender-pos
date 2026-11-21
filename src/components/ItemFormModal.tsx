import React, { useEffect, useState } from 'react';
import { FolderPlus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import type { Category, InventoryItem, UserRole } from '../types.ts';
import { extractBarcodePrefix, generateItemBarcode } from '../utils/barcode.ts';
import { BarcodeSvg, ProductImage } from './BarcodeSvg.tsx';

interface ItemFormModalProps {
  open: boolean;
  editingItem: InventoryItem | null;
  categories: Category[];
  userRole: UserRole;
  currencySymbol: string;
  onClose: () => void;
  onCreateCategory: (name: string, description: string) => Promise<void>;
  onSave: (payload: Record<string, unknown>, id?: number) => Promise<void>;
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  editingItem,
  categories,
  userRole,
  currencySymbol,
  onClose,
  onCreateCategory,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [barcodeMode, setBarcodeMode] = useState<'letters' | 'words'>('letters');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('General');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [mrp, setMrp] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [buyingPrice, setBuyingPrice] = useState('0');
  const [taxRate, setTaxRate] = useState('5');
  const [stockQty, setStockQty] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setAddingCat(false);
    setNewCatName('');
    if (editingItem) {
      setName(editingItem.name);
      setBarcode(editingItem.barcode);
      setSku(editingItem.sku);
      setCategory(editingItem.category || 'General');
      setUnit(editingItem.unit);
      setMrp(String(editingItem.mrp));
      setSellingPrice(String(editingItem.selling_price));
      setBuyingPrice(String(editingItem.buying_price ?? 0));
      setTaxRate(String(editingItem.tax_rate));
      setStockQty(String(editingItem.stock_qty));
      setLowStockThreshold(String(editingItem.low_stock_threshold));
      setImageUrl(editingItem.image_url || '');
    } else {
      setName('');
      setBarcode(generateItemBarcode('Item', 'letters'));
      setSku('');
      setCategory(categories[0]?.name || 'General');
      setUnit('pcs');
      setMrp('');
      setSellingPrice('');
      setBuyingPrice('');
      setTaxRate('5');
      setStockQty('20');
      setLowStockThreshold('10');
      setImageUrl('');
    }
  }, [open, editingItem, categories]);

  if (!open) return null;

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (!editingItem) {
      const nextPrefix = extractBarcodePrefix(nextName || 'Item', barcodeMode);
      const currentDigits = barcode.replace(/^[A-Z0-9]{0,3}/, '').replace(/\D/g, '').slice(0, 6);
      const suffix =
        currentDigits.length === 6
          ? currentDigits
          : Math.floor(100000 + Math.random() * 900000).toString();
      setBarcode(`${nextPrefix}${suffix}`);
    }
  };

  const handleRegenerateBarcode = (mode = barcodeMode) => {
    setBarcode(generateItemBarcode(name || 'Item', mode));
  };

  const handleQuickAddCategory = async () => {
    const clean = newCatName.trim();
    if (!clean) return;
    setError('');
    try {
      await onCreateCategory(clean, '');
      setCategory(clean);
      setNewCatName('');
      setAddingCat(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setImageUrl(dataUrl);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    }
  };

  const numSelling = Number(sellingPrice) || 0;
  const numBuying = Number(buyingPrice) || 0;
  const numMrp = Number(mrp) || 0;
  const profit = numSelling - numBuying;
  const marginPct = numBuying > 0 ? ((profit / numBuying) * 100).toFixed(1) : '0.0';
  const discountPct =
    numMrp > 0 && numMrp >= numSelling ? (((numMrp - numSelling) / numMrp) * 100).toFixed(1) : '0.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }
    if (!barcode.trim()) {
      setError('Barcode is required.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          sku: sku.trim() || `SKU-${barcode.trim().toUpperCase()}`,
          barcode: barcode.trim().toUpperCase(),
          category: category.trim() || 'General',
          unit: unit.trim() || 'pcs',
          mrp: Number(mrp) || 0,
          selling_price: Number(sellingPrice) || 0,
          buying_price: Number(buyingPrice) || 0,
          tax_rate: Number(taxRate) || 0,
          stock_qty: Number(stockQty) || 0,
          low_stock_threshold: Number(lowStockThreshold) || 10,
          image_url: imageUrl,
        },
        editingItem?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const categoryNames = Array.from(
    new Set([...categories.map((c) => c.name), ...(category ? [category] : [])])
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a category from dropdown and auto-generate barcode from first 3 letters/words
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close item form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Product Image + Name Row */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <ProductImage src={imageUrl} alt={name || 'Item preview'} size="lg" />
              <div className="flex items-center gap-1.5">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  Set Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Royal Basmati Rice 2kg"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddingCat((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800"
                    >
                      <FolderPlus className="w-3 h-3" />
                      {addingCat ? 'Cancel' : 'New Category'}
                    </button>
                  </div>

                  {addingCat ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Category name"
                        className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddCategory}
                        className="px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                    >
                      {categoryNames.map((catName) => (
                        <option key={catName} value={catName}>
                          {catName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="bag">Bag</option>
                    <option value="bottle">Bottle</option>
                    <option value="pack">Pack</option>
                    <option value="tin">Tin</option>
                    <option value="box">Box</option>
                    <option value="ltr">Litre (ltr)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Barcode Generator Section */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Auto-Generated Barcode (First 3 Chars + Numbers)
                </div>
                <div className="text-[11px] text-slate-500">
                  Prefix updates automatically from item name or word initials
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeMode('letters');
                    setBarcode(generateItemBarcode(name || 'Item', 'letters'));
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    barcodeMode === 'letters'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1st 3 Letters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeMode('words');
                    setBarcode(generateItemBarcode(name || 'Item', 'words'));
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    barcodeMode === 'words'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3-Word Initials
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono font-semibold tracking-wider border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
                <button
                  type="button"
                  onClick={() => handleRegenerateBarcode()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              </div>
              <div className="shrink-0 flex justify-center">
                <BarcodeSvg value={barcode} height={34} />
              </div>
            </div>
          </div>

          {/* Pricing Grid: MRP, Selling, Buying, Tax */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                MRP ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="340"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Selling Price ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="295"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            {userRole !== 'cashier' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Buying Price ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={buyingPrice}
                  onChange={(e) => setBuyingPrice(e.target.value)}
                  placeholder="235"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tax / GST (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          {userRole !== 'cashier' && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 px-1">
              <span>
                Discount off MRP:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">{discountPct}%</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Profit per unit:{' '}
                <strong
                  className={`font-mono tabular-nums ${
                    profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {currencySymbol}
                  {profit.toFixed(2)} ({marginPct}%)
                </strong>
              </span>
            </div>
          )}

          {/* Stock & SKU Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current Stock Qty *
              </label>
              <input
                type="number"
                min="0"
                required
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Low Stock Alert At
              </label>
              <input
                type="number"
                min="0"
                required
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                SKU Code (Optional)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="Auto from barcode"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
