import { useEffect, useState } from 'react';
import { guestsApi } from '../api';
import type { Guest } from '../types';
import { Search, Users } from 'lucide-react';

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
      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">ID Proof</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Visits</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {guests.map(g => (
                <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{g.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{g.phone}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{g.idProofType ? `${g.idProofType} — ${g.idProofNumber}` : '—'}</td>
                  <td className="px-5 py-3"><span className="badge badge-blue">{g.visitCount}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {guests.length === 0 && <p className="text-center text-gray-400 py-12">No guests found</p>}
        </div>
      )}
    </div>
  );
}
