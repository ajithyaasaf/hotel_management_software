import { useEffect, useState } from 'react';
import { ordersApi } from '../api';
import type { Order } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Search, CheckCircle, XCircle } from 'lucide-react';

const statusBadge: Record<string, string> = { ACTIVE: 'badge-green', COMPLETED: 'badge-gray', CANCELLED: 'badge-red' };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    try {
      const params: any = {};
      if (filter) params.status = filter;
      const { data } = await ordersApi.getAll(params);
      setOrders(data);
    } catch {} finally { setLoading(false); }
  }

  async function completeOrder(id: string) {
    try { await ordersApi.complete(id); toast.success('Order completed'); load(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function cancelOrder(id: string) {
    if (!confirm('Cancel this order?')) return;
    try { await ordersApi.cancel(id); toast.success('Order cancelled'); load(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  const filtered = orders.filter(o => !search || o.orderNumber.includes(search) || (o.room?.roomNumber || '').includes(search));

  return (
    <div className="animate-fadeIn">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Orders</h1><p className="text-gray-500 text-sm mt-1">Manage restaurant orders</p></div>
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input pl-9" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="flex gap-2">
          {['', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>{s || 'All'}</button>
          ))}
        </div>
      </div>
      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div> : (
        <div className="card overflow-hidden">
          <table className="w-full"><thead><tr className="bg-gray-50/50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Room</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Items</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(o => (
              <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 text-sm font-mono text-primary-600">{o.orderNumber}</td>
                <td className="px-5 py-3"><span className="badge badge-blue">{o.type.replace('_', ' ')}</span></td>
                <td className="px-5 py-3 text-sm text-gray-600">{o.room?.roomNumber || '—'}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{o.items.filter(i => !i.isCancelled).length} items</td>
                <td className="px-5 py-3 text-sm font-semibold">₹{Number(o.total).toLocaleString()}</td>
                <td className="px-5 py-3"><span className={`badge ${statusBadge[o.status]}`}>{o.status}</span></td>
                <td className="px-5 py-3 text-sm text-gray-400">{format(new Date(o.createdAt), 'dd MMM, hh:mm a')}</td>
                <td className="px-5 py-3">
                  {o.status === 'ACTIVE' && (
                    <div className="flex gap-1">
                      <button onClick={() => completeOrder(o.id)} className="btn btn-ghost btn-sm text-emerald-600" title="Complete"><CheckCircle size={16} /></button>
                      <button onClick={() => cancelOrder(o.id)} className="btn btn-ghost btn-sm text-red-500" title="Cancel"><XCircle size={16} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody></table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-12">No orders found</p>}
        </div>
      )}
    </div>
  );
}
