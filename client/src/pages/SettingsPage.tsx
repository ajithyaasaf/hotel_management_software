import { useEffect, useState } from 'react';
import { menuApi } from '../api';
import type { RoomType, MenuCategory, MenuItem } from '../types';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function SettingsPage() {
  const [tab, setTab] = useState<'roomTypes' | 'menu'>('roomTypes');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showRtForm, setShowRtForm] = useState(false);
  const [editRt, setEditRt] = useState<RoomType | null>(null);
  const [rtForm, setRtForm] = useState({ name: '', basePrice: 0, description: '' });

  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', sortOrder: 0 });

  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', price: 0, categoryId: '', isVeg: true, description: '' });
  const [editItem, setEditItem] = useState<MenuItem | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [rt, cats] = await Promise.all([menuApi.getRoomTypes(), menuApi.getCategories()]);
      setRoomTypes(rt.data);
      setCategories(cats.data);
    } catch {} finally { setLoading(false); }
  }

  // Room Type handlers
  async function saveRoomType() {
    if (!rtForm.name || !rtForm.basePrice) { toast.error('Fill required fields'); return; }
    try {
      if (editRt) { await menuApi.updateRoomType(editRt.id, rtForm); toast.success('Updated'); }
      else { await menuApi.createRoomType(rtForm); toast.success('Created'); }
      setShowRtForm(false); setEditRt(null); setRtForm({ name: '', basePrice: 0, description: '' }); load();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function deleteRoomType(id: string) {
    if (!confirm('Delete this room type?')) return;
    try { await menuApi.deleteRoomType(id); toast.success('Deleted'); load(); }
    catch { toast.error('Cannot delete — rooms may be using it'); }
  }

  // Category handlers
  async function saveCategory() {
    if (!catForm.name) { toast.error('Name required'); return; }
    try { await menuApi.createCategory(catForm); toast.success('Created'); setShowCatForm(false); setCatForm({ name: '', sortOrder: 0 }); load(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category?')) return;
    try { await menuApi.deleteCategory(id); toast.success('Deleted'); load(); }
    catch { toast.error('Cannot delete — items may exist'); }
  }

  // Menu Item handlers
  async function saveItem() {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) { toast.error('Fill required fields'); return; }
    try {
      if (editItem) { await menuApi.updateItem(editItem.id, itemForm); toast.success('Updated'); }
      else { await menuApi.createItem(itemForm); toast.success('Created'); }
      setShowItemForm(false); setEditItem(null); setItemForm({ name: '', price: 0, categoryId: '', isVeg: true, description: '' }); load();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return;
    try { await menuApi.deleteItem(id); toast.success('Deleted'); load(); }
    catch { toast.error('Cannot delete — may be in active orders'); }
  }

  async function toggleItemAvailability(item: MenuItem) {
    try { await menuApi.updateItem(item.id, { isAvailable: !item.isAvailable }); load(); }
    catch { toast.error('Failed'); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage room types, pricing & menu</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('roomTypes')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'roomTypes' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>Room Types & Pricing</button>
        <button onClick={() => setTab('menu')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'menu' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>Menu Items</button>
      </div>

      {/* Room Types Tab */}
      {tab === 'roomTypes' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditRt(null); setRtForm({ name: '', basePrice: 0, description: '' }); setShowRtForm(true); }} className="btn btn-primary btn-sm"><Plus size={16} /> Add Type</button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full"><thead><tr className="bg-gray-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Base Price</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {roomTypes.map(rt => (
                <tr key={rt.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{rt.name}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-primary-600">₹{Number(rt.basePrice).toLocaleString()}/night</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{rt.description || '—'}</td>
                  <td className="px-5 py-3 flex gap-1 justify-end">
                    <button onClick={() => { setEditRt(rt); setRtForm({ name: rt.name, basePrice: Number(rt.basePrice), description: rt.description || '' }); setShowRtForm(true); }} className="btn btn-ghost btn-sm"><Pencil size={14} /></button>
                    <button onClick={() => deleteRoomType(rt.id)} className="btn btn-ghost btn-sm text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}

      {/* Menu Tab */}
      {tab === 'menu' && (
        <div>
          <div className="flex justify-end gap-2 mb-4">
            <button onClick={() => { setShowCatForm(true); }} className="btn btn-outline btn-sm"><Plus size={16} /> Add Category</button>
            <button onClick={() => { setEditItem(null); setItemForm({ name: '', price: 0, categoryId: categories[0]?.id || '', isVeg: true, description: '' }); setShowItemForm(true); }} className="btn btn-primary btn-sm"><Plus size={16} /> Add Item</button>
          </div>
          {categories.map(cat => (
            <div key={cat.id} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{cat.name}</h3>
                <button onClick={() => deleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full"><thead><tr className="bg-gray-50/50">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Item</th>
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Price</th>
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">Available</th>
                  <th className="px-5 py-2"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {cat.items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-5 py-2.5 text-sm font-semibold">₹{Number(item.price)}</td>
                      <td className="px-5 py-2.5"><span className={`badge ${item.isVeg ? 'badge-green' : 'badge-red'}`}>{item.isVeg ? 'Veg' : 'Non-Veg'}</span></td>
                      <td className="px-5 py-2.5">
                        <button onClick={() => toggleItemAvailability(item)} className={`w-10 h-5 rounded-full transition-colors ${item.isAvailable ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${item.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-5 py-2.5 flex gap-1 justify-end">
                        <button onClick={() => { setEditItem(item); setItemForm({ name: item.name, price: Number(item.price), categoryId: item.categoryId, isVeg: item.isVeg, description: item.description || '' }); setShowItemForm(true); }} className="btn btn-ghost btn-sm"><Pencil size={14} /></button>
                        <button onClick={() => deleteItem(item.id)} className="btn btn-ghost btn-sm text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody></table>
                {cat.items.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No items in this category</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room Type Modal */}
      {showRtForm && (
        <Modal onClose={() => setShowRtForm(false)} title={editRt ? 'Edit Room Type' : 'Add Room Type'}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className="input" value={rtForm.name} onChange={e => setRtForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Base Price (₹/night)</label><input className="input" type="number" value={rtForm.basePrice} onChange={e => setRtForm(p => ({ ...p, basePrice: parseFloat(e.target.value) || 0 }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Description</label><input className="input" value={rtForm.description} onChange={e => setRtForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowRtForm(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={saveRoomType}><Save size={16} /> Save</button></div>
          </div>
        </Modal>
      )}

      {/* Category Modal */}
      {showCatForm && (
        <Modal onClose={() => setShowCatForm(false)} title="Add Category">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className="input" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Sort Order</label><input className="input" type="number" value={catForm.sortOrder} onChange={e => setCatForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowCatForm(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={saveCategory}>Create</button></div>
          </div>
        </Modal>
      )}

      {/* Menu Item Modal */}
      {showItemForm && (
        <Modal onClose={() => setShowItemForm(false)} title={editItem ? 'Edit Item' : 'Add Item'}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className="input" value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Price (₹)</label><input className="input" type="number" value={itemForm.price} onChange={e => setItemForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
              <SearchableSelect
                options={categories.map(c => ({ id: c.id, label: c.name }))}
                value={itemForm.categoryId}
                onChange={val => setItemForm(p => ({ ...p, categoryId: val }))}
                placeholder="Select category..."
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Vegetarian</label>
              <button onClick={() => setItemForm(p => ({ ...p, isVeg: !p.isVeg }))} className={`w-10 h-5 rounded-full transition-colors ${itemForm.isVeg ? 'bg-emerald-500' : 'bg-red-400'}`}>
                <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${itemForm.isVeg ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowItemForm(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={saveItem}><Save size={16} /> Save</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
