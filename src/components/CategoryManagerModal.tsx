import React, { useState } from 'react';
import { FolderPlus, Trash2, X } from 'lucide-react';
import type { Category } from '../types.ts';

interface CategoryManagerModalProps {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreateCategory: (name: string, description: string) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  open,
  categories,
  onClose,
  onCreateCategory,
  onDeleteCategory,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreateCategory(name.trim(), description.trim());
      setName('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    setError('');
    try {
      await onDeleteCategory(cat.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Manage Item Categories</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Categories created here appear in the Item Form dropdown
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Close category manager"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Snacks & Bakery"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                <FolderPlus className="w-4 h-4" />
                {busy ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="truncate">{cat.name}</span>
                    <span className="font-mono text-xs font-normal text-slate-500 tabular-nums">
                      ({cat.item_count ?? 0} items)
                    </span>
                  </div>
                  {cat.description && (
                    <div className="text-xs text-slate-500 truncate mt-0.5">{cat.description}</div>
                  )}
                </div>
                {cat.name.toLowerCase() !== 'general' && (
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
