import { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import type { AuditLog } from '../types';
import { format } from 'date-fns';
import { Shield, Filter } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

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
    CHECKIN: 'text-status-available-text bg-status-available-bg',
    CHECKOUT: 'text-status-occupied-text bg-status-occupied-bg',
    CANCEL_BOOKING: 'text-status-blocked-text bg-status-blocked-bg',
    ROOM_TRANSFER: 'text-status-info-text bg-status-info-bg',
    INVOICE_ADJUSTMENT: 'text-status-cleaning-text bg-status-cleaning-bg',
    CANCEL_ORDER: 'text-status-blocked-text bg-status-blocked-bg',
    CANCEL_ITEM: 'text-status-blocked-text bg-status-blocked-bg',
    EXTEND_STAY: 'text-status-info-text bg-status-info-bg',
    PAYMENT_ADVANCE: 'text-status-available-text bg-status-available-bg',
    PAYMENT_PARTIAL: 'text-status-available-text bg-status-available-bg',
    PAYMENT_FULL: 'text-status-available-text bg-status-available-bg',
    PAYMENT_REFUND: 'text-status-blocked-text bg-status-blocked-bg',
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
        <SearchableSelect
          className="w-[220px]"
          options={[
            { id: 'booking', label: 'Bookings' },
            { id: 'order', label: 'Orders' },
            { id: 'order_item', label: 'Order Items' },
            { id: 'invoice', label: 'Invoices' },
            { id: 'payment', label: 'Payments' },
          ]}
          value={entity}
          onChange={setEntity}
          placeholder="All Entities"
        />
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
