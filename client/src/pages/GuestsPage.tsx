import { useEffect, useState } from 'react';
import { guestsApi } from '../api';
import type { Guest } from '../types';
import { Search, Users, FileText } from 'lucide-react';

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load(s?: string) {
    try { const { data } = await guestsApi.getAll(s); setGuests(data); } catch {}
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
      <div className="relative max-w-sm mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search by name or phone..." value={search} onChange={e => handleSearch(e.target.value)} />
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
              <tbody className="divide-y divide-gray-50">
                {guests.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{g.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">{g.phone}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{g.idProofType ? `${g.idProofType} — ${g.idProofNumber || 'N/A'}` : '—'}</span>
                        {(g as any).idProofUrl && (
                          <a href={(g as any).idProofUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700" title="View ID Proof">
                            <FileText size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap"><span className="badge badge-blue">{g.visitCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {guests.length === 0 && <p className="text-center text-gray-400 py-12">No guests found</p>}
        </div>
      )}
    </div>
  );
}
