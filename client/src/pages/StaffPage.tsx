import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import type { User } from '../types';
import toast from 'react-hot-toast';
import { Plus, UserCog, X } from 'lucide-react';

export default function StaffPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RECEPTION' as User['role'] });

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const { data } = await usersApi.getAll();
      setUsers(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.name || !form.email || !form.password) { toast.error('Please fill all fields'); return; }
    if (form.name.length < 3 || /^\d+$/.test(form.name)) { toast.error('Enter a valid name (min 3 characters, no pure numbers)'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter a valid email address'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try { await usersApi.create(form); toast.success('User created'); setShowAdd(false); setForm({ name: '', email: '', password: '', role: 'RECEPTION' }); load(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try { await usersApi.update(id, { isActive: !isActive }); toast.success('Updated'); load(); }
    catch { toast.error('Failed'); }
  }

  const roleBadge: Record<string, string> = { ADMIN: 'badge-red', RECEPTION: 'badge-blue', RESTAURANT: 'badge-yellow' };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Staff</h1><p className="text-gray-500 text-sm mt-1">Manage users & roles</p></div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={18} /> Add User</button>
      </div>

      {loading ? (
        <div className="card overflow-hidden border border-gray-150/60 animate-pulse">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-24" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-12" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-14" /></th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={rIdx} className="h-14">
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-24" /></td>
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-36" /></td>
                  <td className="px-5 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                  <td className="px-5 py-3"><div className="h-5 bg-gray-200 rounded-full w-14" /></td>
                  <td className="px-5 py-3 flex justify-end items-center h-14"><div className="h-8 w-20 bg-gray-100 rounded-lg" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full"><thead><tr className="bg-gray-50/50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-5 py-3"><span className={`badge ${roleBadge[u.role]}`}>{u.role}</span></td>
                <td className="px-5 py-3"><span className={`badge ${u.isActive ? 'badge-green' : 'badge-gray'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="px-5 py-3"><button onClick={() => toggleActive(u.id, u.isActive!)} className="btn btn-ghost btn-sm">{u.isActive ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Add User</h3><button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Name</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Password</label><input className="input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Role</label><select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as any }))}><option value="RECEPTION">Reception</option><option value="RESTAURANT">Restaurant</option><option value="ADMIN">Admin</option></select></div>
              <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={handleAdd}>Create</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
