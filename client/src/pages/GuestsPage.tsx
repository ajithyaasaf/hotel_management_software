import { useEffect, useState } from 'react';
import { guestsApi } from '../api';
import type { Guest } from '../types';
import { Search, Users, FileText } from 'lucide-react';

export default function GuestsPage() {
  const [guests, setGuests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'MISSING_ID' | 'FOREIGNER'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load(s?: string) {
    try { const { data } = await guestsApi.getAll(s); setGuests(data); } catch { }
    finally { setLoading(false); }
  }

  function handleSearch(val: string) {
    setSearch(val);
    if (val.length >= 3 || val.length === 0) load(val || undefined);
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Guests</h1><p className="text-gray-500 text-sm mt-1">Guest directory & history</p></div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search by name or phone..." value={search} onChange={e => handleSearch(e.target.value)} />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto border border-gray-200">
          <button onClick={() => setFilter('ALL')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>All Guests</button>
          <button onClick={() => setFilter('FOREIGNER')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === 'FOREIGNER' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Foreign Nationals</button>
          <button onClick={() => setFilter('MISSING_ID')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === 'MISSING_ID' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Missing IDs</button>
        </div>
      </div>
      {loading ? (
        <div className="card overflow-hidden border border-gray-150/60 animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-24" /></th>
                  <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-20" /></th>
                  <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-28" /></th>
                  <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-12" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, rIdx) => (
                  <tr key={rIdx} className="h-14">
                    <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-32" /></td>
                    <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-24" /></td>
                    <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-40" /></td>
                    <td className="px-5 py-3"><div className="h-5 bg-gray-200 rounded-full w-8" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">ID Proof</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Visits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guests
                  .filter(g => {
                    if (filter === 'FOREIGNER') return g.isForeigner;
                    if (filter === 'MISSING_ID') return !g.idProofUrl && !g.idProofBackUrl;
                    return true;
                  })
                  .map(g => (
                    <tr key={g.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            {g.name}
                            {g.isForeigner && <span className="bg-primary-50 text-primary-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border border-primary-100">Foreigner</span>}
                          </span>
                          {g.isForeigner && g.country && <span className="text-xs text-gray-500 font-medium mt-0.5">Passport: {g.passportNo || 'N/A'} ({g.country})</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                        {g.phone}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          {!g.idProofType ? (
                            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md inline-flex w-fit">MISSING ID</span>
                          ) : (
                            <span className="text-sm text-gray-800 font-semibold">
                              {g.idProofType} {g.idProofNumber ? <span className="text-gray-400 text-xs ml-1 font-mono font-medium">({g.idProofNumber})</span> : <span className="text-amber-500 text-xs ml-1 font-bold">— Missing No.</span>}
                            </span>
                          )}
                          {(g.idProofUrl || g.idProofBackUrl) && (
                            <div className="flex gap-1.5 mt-0.5">
                              {g.idProofUrl && <a href={g.idProofUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-sm" title="View Front"><FileText size={10} /> Front</a>}
                              {g.idProofBackUrl && <a href={g.idProofBackUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-sm" title="View Back"><FileText size={10} /> Back</a>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`badge ${g.visitCount > 1 ? 'badge-primary' : 'badge-gray'} shadow-sm`}>{g.visitCount} {g.visitCount === 1 ? 'Visit' : 'Visits'}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {guests.length === 0 && <p className="text-center text-gray-400 py-12">No guests found</p>}
          {guests.length > 0 && guests.filter(g => filter === 'FOREIGNER' ? g.isForeigner : filter === 'MISSING_ID' ? (!g.idProofUrl && !g.idProofBackUrl) : true).length === 0 && (
            <p className="text-center text-gray-400 py-12">No guests match this filter</p>
          )}
        </div>
      )}
    </div>
  );
}
