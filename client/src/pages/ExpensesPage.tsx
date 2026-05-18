import { useEffect, useState } from 'react';
import { expensesApi } from '../api';
import type { Expense, ExpenseCategory } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, X, TrendingDown, Filter } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
  { value: 'STAFF_SALARY', label: 'Staff Salary' },
  { value: 'KITCHEN_SUPPLIES', label: 'Kitchen Supplies' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
];

const CATEGORY_COLORS: Record<string, string> = {
  ELECTRICITY: 'bg-yellow-50 text-yellow-700',
  WATER: 'bg-blue-50 text-blue-700',
  STAFF_SALARY: 'bg-violet-50 text-violet-700',
  KITCHEN_SUPPLIES: 'bg-orange-50 text-orange-700',
  LAUNDRY: 'bg-cyan-50 text-cyan-700',
  MAINTENANCE: 'bg-rose-50 text-rose-700',
  HOUSEKEEPING: 'bg-emerald-50 text-emerald-700',
  MARKETING: 'bg-pink-50 text-pink-700',
  MISCELLANEOUS: 'bg-gray-100 text-gray-700',
};

const emptyForm = {
  title: '',
  category: 'ELECTRICITY' as ExpenseCategory,
  amount: '' as number | string,
  paidDate: new Date().toISOString().split('T')[0],
  method: 'CASH' as 'CASH' | 'UPI' | 'CARD',
  notes: '',
};

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [from, to, categoryFilter]);

  async function load() {
    setLoading(true);
    try {
      const params: any = { from, to };
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await expensesApi.getAll(params);
      setExpenses(data);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditExpense(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(expense: Expense) {
    setEditExpense(expense);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: Number(expense.amount),
      paidDate: expense.paidDate.split('T')[0],
      method: expense.method,
      notes: expense.notes || '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title || !form.amount || !form.paidDate) {
      toast.error('Please fill all required fields');
      return;
    }
    if (Number(form.amount) <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        paidDate: new Date(form.paidDate).toISOString(),
      };
      if (editExpense) {
        await expensesApi.update(editExpense.id, payload);
        toast.success('Expense updated');
      } else {
        await expensesApi.create(payload);
        toast.success('Expense recorded');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save expense');
    } finally { setSaving(false); }
  }

  async function handleDelete(expense: Expense) {
    if (!confirm(`Delete expense "${expense.title}"? This cannot be undone.`)) return;
    try {
      await expensesApi.delete(expense.id);
      toast.success('Expense deleted');
      load();
    } catch { toast.error('Failed to delete expense'); }
  }

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Group by category for summary
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown size={24} className="text-red-500" /> Expenses
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track hotel operating costs</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <input type="date" className="input max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-400">to</span>
        <input type="date" className="input max-w-[160px]" value={to} onChange={e => setTo(e.target.value)} />
        <select
          className="input max-w-[200px]"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {categoryFilter && (
          <button onClick={() => setCategoryFilter('')} className="btn btn-ghost btn-sm text-red-500">
            <Filter size={14} /> Clear
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="card p-5">
          <p className="text-sm text-gray-500 mb-1">Total Expenses</p>
          <p className="text-3xl font-bold text-red-600">₹{totalAmount.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{expenses.length} entries</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 mb-1">Top Category</p>
          <p className="text-2xl font-bold text-gray-900">
            {topCategory ? CATEGORIES.find(c => c.value === topCategory[0])?.label || topCategory[0] : '—'}
          </p>
          {topCategory && <p className="text-xs text-gray-400 mt-1">₹{topCategory[1].toLocaleString()}</p>}
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 mb-2">By Category</p>
          <div className="space-y-1">
            {Object.entries(byCategory).slice(0, 3).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-xs">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-700'}`}>
                  {CATEGORIES.find(c => c.value === cat)?.label || cat}
                </span>
                <span className="text-gray-600 font-medium">₹{amt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recorded By</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {format(new Date(e.paidDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-900">{e.title}</p>
                    {e.notes && <p className="text-xs text-gray-400 truncate max-w-[200px]">{e.notes}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${CATEGORY_COLORS[e.category] || 'bg-gray-100 text-gray-700'}`}>
                      {CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{e.method}</td>
                  <td className="px-5 py-3 text-sm font-bold text-red-600">₹{Number(e.amount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{e.createdBy?.name || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && (
            <p className="text-center text-gray-400 py-12">No expenses recorded for this period</p>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Title *</label>
                <input className="input" placeholder="e.g. Electricity Bill - May" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Amount (₹) *</label>
                  <input className="input" type="number" min={1} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Paid Date *</label>
                  <input className="input" type="date" value={form.paidDate} onChange={e => setForm(p => ({ ...p, paidDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
                  <select className="input" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value as any }))}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes (Optional)</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional details..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn btn-outline flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editExpense ? 'Update' : 'Add Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
