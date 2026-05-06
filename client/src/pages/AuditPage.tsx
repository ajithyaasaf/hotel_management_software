import { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import type { AuditLog } from '../types';
import { format } from 'date-fns';
import { Shield, Filter } from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [entity, from, to]);

  async function load() {
    try {
      const params: any = {};
      if (entity) params.entity = entity;
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await reportsApi.audit(params);
      setLogs(data);
    } catch {} finally { setLoading(false); }
  }

  const actionColor: Record<string, string> = {
    CHECKIN: 'text-emerald-600 bg-emerald-50',
    CHECKOUT: 'text-blue-600 bg-blue-50',
    CANCEL_BOOKING: 'text-red-600 bg-red-50',
    ROOM_TRANSFER: 'text-violet-600 bg-violet-50',
    INVOICE_ADJUSTMENT: 'text-amber-600 bg-amber-50',
    CANCEL_ORDER: 'text-red-600 bg-red-50',
    CANCEL_ITEM: 'text-orange-600 bg-orange-50',
    EXTEND_STAY: 'text-blue-600 bg-blue-50',
    PAYMENT_ADVANCE: 'text-emerald-600 bg-emerald-50',
    PAYMENT_PARTIAL: 'text-emerald-600 bg-emerald-50',
    PAYMENT_FULL: 'text-emerald-600 bg-emerald-50',
    PAYMENT_REFUND: 'text-red-600 bg-red-50',
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield size={24} /> Audit Log</h1>
          <p className="text-gray-500 text-sm mt-1">Track all system changes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <select className="input max-w-[180px]" value={entity} onChange={e => setEntity(e.target.value)}>
          <option value="">All Entities</option>
          <option value="booking">Bookings</option>
          <option value="order">Orders</option>
          <option value="order_item">Order Items</option>
          <option value="invoice">Invoices</option>
          <option value="payment">Payments</option>
        </select>
        <input type="date" className="input max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)} placeholder="From" />
        <input type="date" className="input max-w-[160px]" value={to} onChange={e => setTo(e.target.value)} placeholder="To" />
        {(entity || from || to) && (
          <button onClick={() => { setEntity(''); setFrom(''); setTo(''); }} className="btn btn-ghost btn-sm text-red-500">Clear</button>
        )}
      </div>

      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div> : (
        <div className="card overflow-hidden">
          <table className="w-full"><thead><tr className="bg-gray-50/50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{format(new Date(log.createdAt), 'dd MMM yyyy, hh:mm a')}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${actionColor[log.action] || 'text-gray-600 bg-gray-50'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-600 capitalize">{log.entity}</td>
                <td className="px-5 py-3 text-sm text-gray-500 max-w-xs truncate">{log.details || '—'}</td>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900">{log.user.name}</p>
                  <p className="text-xs text-gray-400">{log.user.role}</p>
                </td>
              </tr>
            ))}
          </tbody></table>
          {logs.length === 0 && <p className="text-center text-gray-400 py-12">No audit logs found</p>}
        </div>
      )}
    </div>
  );
}
