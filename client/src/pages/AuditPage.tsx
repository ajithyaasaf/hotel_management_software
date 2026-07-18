import { useEffect, useState } from 'react';
import { auditApi } from '../api';
import { format } from 'date-fns';
import { Shield, Filter, Eye, Activity, Database, Key } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import toast from 'react-hot-toast';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([
    'booking', 'order', 'invoice', 'payment', 'roomType', 'permission', 'taxConfig', 'night_audit'
  ]);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    auditApi.getEntities().then(res => {
      if (res.data && res.data.length > 0) setAvailableEntities(res.data);
    }).catch();
  }, []);

  useEffect(() => {
    auditApi.getActions(entity ? { entity } : undefined).then(res => {
      setAvailableActions(res.data);
      if (actionFilter && !res.data.includes(actionFilter)) {
        setActionFilter('');
      }
    }).catch();
  }, [entity]);

  useEffect(() => { load(); }, [entity, from, to, actionFilter]);

  async function load() {
    setLoading(true);
    try {
      const params: any = {};
      if (entity) params.entity = entity;
      if (from) params.from = from;
      if (to) params.to = to;
      if (actionFilter) params.action = actionFilter;
      const { data } = await auditApi.getAll(params);
      setLogs(data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally { setLoading(false); }
  }

  const actionColor: Record<string, string> = {
    CHECKIN: 'text-emerald-700 bg-emerald-50',
    CHECKOUT: 'text-blue-700 bg-blue-50',
    CANCEL_BOOKING: 'text-rose-700 bg-rose-50',
    ROOM_TRANSFER: 'text-violet-700 bg-violet-50',
    INVOICE_ADJUSTMENT: 'text-orange-700 bg-orange-50',
    CANCEL_ORDER: 'text-rose-700 bg-rose-50',
    CANCEL_ITEM: 'text-rose-700 bg-rose-50',
    EXTEND_STAY: 'text-cyan-700 bg-cyan-50',
    PAYMENT_ADVANCE: 'text-emerald-700 bg-emerald-50',
    UPDATE_TARIFF: 'text-purple-700 bg-purple-50',
    CREATE_USER: 'text-indigo-700 bg-indigo-50',
  };

  function renderJsonDiff(oldVal: any, newVal: any) {
    if (!oldVal && !newVal) return null;
    
    return (
      <div className="grid grid-cols-2 gap-4 mt-4">
        {oldVal && (
          <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 overflow-auto">
            <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest mb-2 border-b border-red-100 pb-2">Previous Values</h4>
            <pre className="text-[11px] text-red-900 leading-relaxed font-mono">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          </div>
        )}
        {newVal && (
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 overflow-auto">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-2 border-b border-emerald-100 pb-2">New Values</h4>
            <pre className="text-[11px] text-emerald-900 leading-relaxed font-mono">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Shield size={24} /></div>
            Audit & Compliance Log
          </h1>
          <p className="text-gray-500 text-sm mt-1 ml-12">Track all critical system changes, permissions, and financial adjustments.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center gap-2 text-gray-700 text-sm font-bold mb-4">
          <Filter size={16} className="text-indigo-600" /> Filter Logs
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Entity Type</label>
            <select className="input text-sm w-full" value={entity} onChange={e => setEntity(e.target.value)}>
              <option value="">All Entities</option>
              {availableEntities.map(e => (
                <option key={e} value={e}>
                  {e.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Action</label>
            <select className="input text-sm w-full" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              {availableActions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Start Date</label>
            <input type="date" className="input text-sm w-full" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">End Date</label>
            <input type="date" className="input text-sm w-full" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        {(entity || from || to || actionFilter) && (
          <div className="mt-4 flex justify-end">
            <button onClick={() => { setEntity(''); setFrom(''); setTo(''); setActionFilter(''); }} className="text-sm font-medium text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="max-w-4xl">
          {logs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
              <Database size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Audit Logs Found</h3>
              <p className="text-gray-500">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-100 ml-4 md:ml-8 space-y-8 pb-8">
              {logs.map((log, i) => (
                <div key={log.id} className="relative pl-6 md:pl-8 group">
                  {/* Timeline dot */}
                  <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-1 border-2 border-white ring-4 ring-white shadow-sm ${
                    ['UPDATE_TARIFF', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'UPDATE_TAX_CONFIG'].includes(log.action) ? 'bg-purple-500' :
                    ['CANCEL_BOOKING', 'CANCELLATION_REJECTED', 'DELETE_EXPENSE'].includes(log.action) ? 'bg-red-500' :
                    'bg-indigo-400'
                  }`} />
                  
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer" onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}>
                    
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{format(new Date(log.createdAt), 'MMM dd, yyyy • hh:mm a')}</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          {log.action.replace(/_/g, ' ')}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 capitalize">
                          <Database size={12} /> {log.entity}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="text-sm text-gray-600 mb-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                      {log.details || 'No additional details provided.'}
                    </div>

                    {/* Footer - User */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {log.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 leading-none">{log.user.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{log.user.role.replace(/_/g, ' ')}</p>
                        </div>
                      </div>

                      {(log.oldValue || log.newValue) && (
                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                          <Eye size={14} /> {selectedLog?.id === log.id ? 'Hide Data' : 'View Data Changes'}
                        </button>
                      )}
                    </div>

                    {/* Diff Viewer */}
                    {selectedLog?.id === log.id && (log.oldValue || log.newValue) && (
                      <div className="mt-4 animate-fadeIn" onClick={e => e.stopPropagation()}>
                        {renderJsonDiff(log.oldValue, log.newValue)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
