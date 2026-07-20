import { useEffect, useState } from 'react';
import { menuApi, banquetsApi, permissionsApi } from '../api';
import type { RoomType, MenuCategory, MenuItem, BanquetHall } from '../types';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Save, Shield } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuthStore } from '../store/authStore';
import { useDialog } from '../contexts/DialogContext';

interface RoomTypeForm {
  name: string;
  basePrice: number | string;
  description: string;
}

interface CategoryForm {
  name: string;
  sortOrder: number | string;
}

interface ItemForm {
  name: string;
  price: number | string;
  categoryId: string;
  isVeg: boolean;
  description: string;
}

interface BanquetHallForm {
  name: string;
  maxCapacity: number | string;
  baseRental: number | string;
  description: string;
}

export default function SettingsPage() {
  const { hasPermission } = useAuthStore();
  const { confirm } = useDialog();
  const [tab, setTab] = useState<'roomTypes' | 'menu' | 'banquetHalls' | 'permissions'>('roomTypes');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [banquetHalls, setBanquetHalls] = useState<BanquetHall[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);

  // Forms
  const [showRtForm, setShowRtForm] = useState(false);
  const [editRt, setEditRt] = useState<RoomType | null>(null);
  const [rtForm, setRtForm] = useState<RoomTypeForm>({ name: '', basePrice: 0, description: '' });

  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState<CategoryForm>({ name: '', sortOrder: 0 });

  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>({ name: '', price: 0, categoryId: '', isVeg: true, description: '' });
  const [editItem, setEditItem] = useState<MenuItem | null>(null);

  const [showHallForm, setShowHallForm] = useState(false);
  const [editHall, setEditHall] = useState<BanquetHall | null>(null);
  const [hallForm, setHallForm] = useState<BanquetHallForm>({ name: '', maxCapacity: '', baseRental: '', description: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [rt, cats, hallsRes] = await Promise.all([
        menuApi.getRoomTypes(),
        menuApi.getCategories(),
        banquetsApi.getHalls({ all: true })
      ]);
      setRoomTypes(rt.data);
      setCategories(cats.data);
      setBanquetHalls(hallsRes.data);

      if (hasPermission(['permission.manage'])) {
        const matrixRes = await permissionsApi.getMatrix();
        setPermissionsMatrix(matrixRes.data.permissions);
        setAvailableRoles(matrixRes.data.roles);
        setMatrix(matrixRes.data.matrix);
      }
    } catch { } finally { setLoading(false); }
  }

  async function togglePermission(role: string, permissionCode: string, currentlyGranted: boolean) {
    try {
      if (currentlyGranted) {
        await permissionsApi.revoke(role, permissionCode);
        toast.success(`Permission revoked from ${role}`);
      } else {
        await permissionsApi.grant(role, permissionCode);
        toast.success(`Permission granted to ${role}`);
      }
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update permission');
    }
  }

  // Room Type handlers
  async function saveRoomType() {
    if (!rtForm.name) { toast.error('Room type name is required'); return; }
    if (Number(rtForm.basePrice) <= 0) { toast.error('Base price must be a positive amount'); return; }
    try {
      const payload = { ...rtForm, basePrice: Number(rtForm.basePrice) || 0 };
      if (editRt) { await menuApi.updateRoomType(editRt.id, payload); toast.success('Updated'); }
      else { await menuApi.createRoomType(payload); toast.success('Created'); }
      setShowRtForm(false); setEditRt(null); setRtForm({ name: '', basePrice: 0, description: '' }); load();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function deleteRoomType(id: string) {
    const isConfirmed = await confirm({ title: 'Delete Room Type', message: 'Are you sure you want to delete this room type?', confirmText: 'Delete', variant: 'danger' });
    if (!isConfirmed) return;
    try { await menuApi.deleteRoomType(id); toast.success('Deleted'); load(); }
    catch { toast.error('Cannot delete — rooms may be using it'); }
  }

  // Category handlers
  async function saveCategory() {
    if (!catForm.name) { toast.error('Category name is required'); return; }
    if (Number(catForm.sortOrder) < 0) { toast.error('Sort order cannot be negative'); return; }
    try {
      const payload = { ...catForm, sortOrder: Number(catForm.sortOrder) || 0 };
      await menuApi.createCategory(payload);
      toast.success('Created'); setShowCatForm(false); setCatForm({ name: '', sortOrder: 0 }); load();
    }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function deleteCategory(id: string) {
    const isConfirmed = await confirm({ title: 'Delete Category', message: 'Are you sure you want to delete this category?', confirmText: 'Delete', variant: 'danger' });
    if (!isConfirmed) return;
    try { await menuApi.deleteCategory(id); toast.success('Deleted'); load(); }
    catch { toast.error('Cannot delete — items may exist'); }
  }

  // Menu Item handlers
  async function saveItem() {
    if (!itemForm.name || !itemForm.categoryId) { toast.error('Name and Category are required'); return; }
    if (Number(itemForm.price) <= 0) { toast.error('Price must be a positive amount'); return; }
    try {
      const payload = { ...itemForm, price: Number(itemForm.price) || 0 };
      if (editItem) { await menuApi.updateItem(editItem.id, payload); toast.success('Updated'); }
      else { await menuApi.createItem(payload); toast.success('Created'); }
      setShowItemForm(false); setEditItem(null); setItemForm({ name: '', price: 0, categoryId: '', isVeg: true, description: '' }); load();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function deleteItem(id: string) {
    const isConfirmed = await confirm({ title: 'Delete Menu Item', message: 'Are you sure you want to delete this item?', confirmText: 'Delete', variant: 'danger' });
    if (!isConfirmed) return;
    try { await menuApi.deleteItem(id); toast.success('Deleted'); load(); }
    catch { toast.error('Cannot delete — may be in active orders'); }
  }

  async function toggleItemAvailability(item: MenuItem) {
    try { await menuApi.updateItem(item.id, { isAvailable: !item.isAvailable }); load(); }
    catch { toast.error('Failed'); }
  }

  // Banquet Hall handlers
  async function saveBanquetHall() {
    if (!hallForm.name) { toast.error('Hall name is required'); return; }
    if (Number(hallForm.maxCapacity) <= 0) { toast.error('Max capacity must be a positive number'); return; }
    if (Number(hallForm.baseRental) < 0) { toast.error('Base rental cannot be negative'); return; }
    try {
      const payload = {
        name: hallForm.name,
        maxCapacity: Number(hallForm.maxCapacity),
        baseRental: Number(hallForm.baseRental),
        description: hallForm.description || null,
      };
      if (editHall) {
        await banquetsApi.updateHall(editHall.id, payload);
        toast.success('Banquet hall updated');
      } else {
        await banquetsApi.createHall(payload);
        toast.success('Banquet hall created');
      }
      setShowHallForm(false);
      setEditHall(null);
      setHallForm({ name: '', maxCapacity: '', baseRental: '', description: '' });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save banquet hall');
    }
  }

  async function toggleHallAvailability(hall: BanquetHall) {
    try {
      await banquetsApi.updateHall(hall.id, { isActive: !hall.isActive });
      toast.success(`${hall.name} status updated`);
      load();
    } catch {
      toast.error('Failed to update status');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-1">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-8 w-32 bg-gray-200 rounded-lg" />
          <div className="h-4 w-72 bg-gray-150 rounded-md" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-9 w-36 bg-gray-200 rounded-lg" />
          ))}
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <div className="h-8 w-24 bg-gray-200 rounded-lg" />
        </div>

        {/* Settings Table Card */}
        <div className="card overflow-hidden border border-gray-150/60 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-20" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-24" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-32" /></th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={rIdx} className="h-14">
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-28" /></td>
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-20" /></td>
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-40" /></td>
                  <td className="px-5 py-3 flex gap-2 justify-end items-center h-14">
                    <div className="h-7 w-7 bg-gray-100 rounded-md" />
                    <div className="h-7 w-7 bg-gray-100 rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage rooms, pricing, menus, and event halls</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button onClick={() => setTab('roomTypes')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === 'roomTypes' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>Room Types & Pricing</button>
        <button onClick={() => setTab('menu')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === 'menu' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>Menu Items</button>
        <button onClick={() => setTab('banquetHalls')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === 'banquetHalls' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>Banquet Halls</button>
        {/* Temporarily hidden: hasPermission(['permission.manage']) && (
          <button onClick={() => setTab('permissions')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${tab === 'permissions' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            <Shield size={16} /> Roles & Permissions
          </button>
        ) */}
      </div>

      {/* Room Types Tab */}
      {tab === 'roomTypes' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditRt(null); setRtForm({ name: '', basePrice: 0, description: '' }); setShowRtForm(true); }} className="btn btn-primary btn-sm"><Plus size={16} /> Add Type</button>
          </div>
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full"><thead><tr className="bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Base Price</th>
              <th className="text-left px-5 py-3">Description</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
              <tbody className="divide-y divide-gray-50 whitespace-nowrap">
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
              <div className="card overflow-hidden overflow-x-auto">
                <table className="w-full"><thead><tr className="bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                  <th className="text-left px-5 py-2">Item</th>
                  <th className="text-left px-5 py-2">Price</th>
                  <th className="text-left px-5 py-2">Type</th>
                  <th className="text-left px-5 py-2">Available</th>
                  <th className="px-5 py-2"></th>
                </tr></thead>
                  <tbody className="divide-y divide-gray-50 whitespace-nowrap">
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

      {/* Banquet Halls Tab */}
      {tab === 'banquetHalls' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setEditHall(null);
                setHallForm({ name: '', maxCapacity: '', baseRental: '', description: '' });
                setShowHallForm(true);
              }}
              className="btn btn-primary btn-sm"
            >
              <Plus size={16} /> Add Banquet Hall
            </button>
          </div>
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                  <th className="text-left px-5 py-3">Hall Name</th>
                  <th className="text-left px-5 py-3">Max Capacity</th>
                  <th className="text-left px-5 py-3">Base Rental</th>
                  <th className="text-left px-5 py-3">Description</th>
                  <th className="text-left px-5 py-3">Active</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 whitespace-nowrap">
                {banquetHalls.map(hall => (
                  <tr key={hall.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{hall.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{hall.maxCapacity} Guests</td>
                    <td className="px-5 py-3 text-sm font-semibold text-primary-600">₹{Number(hall.baseRental).toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{hall.description || '—'}</td>
                    <td className="px-5 py-3 text-sm">
                      <button
                        onClick={() => toggleHallAvailability(hall)}
                        className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${
                          hall.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            hall.isActive ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3 flex gap-1 justify-end">
                      <button
                        onClick={() => {
                          setEditHall(hall);
                          setHallForm({
                            name: hall.name,
                            maxCapacity: hall.maxCapacity,
                            baseRental: Number(hall.baseRental),
                            description: hall.description || '',
                          });
                          setShowHallForm(true);
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {banquetHalls.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8 text-sm">
                      No banquet halls configured. Add one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {tab === 'permissions' && hasPermission(['permission.manage']) && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
            <Shield className="text-indigo-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-indigo-900">Role-Based Access Control</h4>
              <p className="text-sm text-indigo-700 mt-1">Manage what each role can access across the system. Changes take effect immediately on next user action. MD role always has full access.</p>
            </div>
          </div>

          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-[250px]">Permission</th>
                  {availableRoles.filter(r => r !== 'MD').map(role => (
                    <th key={role} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                      {role.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {permissionsMatrix.map(perm => (
                  <tr key={perm.code} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                      <p className="text-sm font-semibold text-gray-900">{perm.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{perm.description}</p>
                    </td>
                    {availableRoles.filter(r => r !== 'MD').map(role => {
                      const isGranted = matrix[perm.code]?.[role] || false;
                      return (
                        <td key={role} className="px-5 py-3 text-center">
                          <button
                            onClick={() => togglePermission(role, perm.code, isGranted)}
                            className={`w-10 h-5 rounded-full transition-colors relative inline-flex items-center ${
                              isGranted ? 'bg-indigo-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                isGranted ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Room Type Modal */}
      {showRtForm && (
        <Modal onClose={() => setShowRtForm(false)} title={editRt ? 'Edit Room Type' : 'Add Room Type'}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className="input" value={rtForm.name} onChange={e => setRtForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Base Price (₹/night)</label><input className="input" type="number" value={rtForm.basePrice} onChange={e => setRtForm(p => ({ ...p, basePrice: e.target.value }))} /></div>
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
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Sort Order</label><input className="input" type="number" value={catForm.sortOrder} onChange={e => setCatForm(p => ({ ...p, sortOrder: e.target.value }))} /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowCatForm(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={saveCategory}>Create</button></div>
          </div>
        </Modal>
      )}

      {/* Menu Item Modal */}
      {showItemForm && (
        <Modal onClose={() => setShowItemForm(false)} title={editItem ? 'Edit Item' : 'Add Item'}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className="input" value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Price (₹)</label><input className="input" type="number" value={itemForm.price} onChange={e => setItemForm(p => ({ ...p, price: e.target.value }))} /></div>
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

      {/* Banquet Hall Modal */}
      {showHallForm && (
        <Modal onClose={() => setShowHallForm(false)} title={editHall ? 'Edit Banquet Hall' : 'Add Banquet Hall'}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Hall Name *</label>
              <input
                className="input"
                value={hallForm.name}
                onChange={e => setHallForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Grand Ballroom"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Max Capacity (Guests) *</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={hallForm.maxCapacity}
                  onChange={e => setHallForm(p => ({ ...p, maxCapacity: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Base Rental (₹) *</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={hallForm.baseRental}
                  onChange={e => setHallForm(p => ({ ...p, baseRental: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
              <input
                className="input"
                value={hallForm.description}
                onChange={e => setHallForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Ground floor event hall with stage"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-outline flex-1" onClick={() => setShowHallForm(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={saveBanquetHall}>
                <Save size={16} /> Save
              </button>
            </div>
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
