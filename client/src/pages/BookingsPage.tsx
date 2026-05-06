import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsApi } from '../api';
import type { Booking } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus, Search, CalendarCheck, Eye } from 'lucide-react';

const statusBadge: Record<string, string> = {
  CONFIRMED: 'badge-blue', CHECKED_IN: 'badge-green', CHECKED_OUT: 'badge-gray',
  CANCELLED: 'badge-red', NO_SHOW: 'badge-yellow',
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [filter]);

  async function load() {
    try {
      const params: any = {};
      if (filter) params.status = filter;
      const { data } = await bookingsApi.getAll(params);
      setBookings(data);
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }

  const filtered = bookings.filter(b =>
    !search || b.guest.name.toLowerCase().includes(search.toLowerCase()) ||
    b.guest.phone.includes(search) || b.bookingNumber.includes(search) ||
    b.room.roomNumber.includes(search)
  );

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 text-sm mt-1">{bookings.length} total bookings</p>
        </div>
        <button onClick={() => navigate('/bookings/new')} className="btn btn-primary">
          <Plus size={18} /> New Check-in
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, phone, room..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'CHECKED_IN', 'CONFIRMED', 'CHECKED_OUT', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Booking</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Room</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Checkout</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-sm font-mono text-primary-600">{b.bookingNumber}</span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-900">{b.guest.name}</p>
                    <p className="text-xs text-gray-400">{b.guest.phone}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-900">
                      <CalendarCheck size={14} className="text-gray-400" /> {b.room.roomNumber}
                    </span>
                    <p className="text-xs text-gray-400">{b.room.roomType.name}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{format(new Date(b.checkInDate), 'dd MMM yyyy')}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{format(new Date(b.expectedCheckout), 'dd MMM yyyy')}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">₹{Number(b.roomPrice).toLocaleString()}</td>
                  <td className="px-5 py-3"><span className={`badge ${statusBadge[b.status]}`}>{b.status.replace('_', ' ')}</span></td>
                  <td className="px-5 py-3">
                    <button onClick={() => navigate(`/bookings/${b.id}`)} className="btn btn-ghost btn-sm">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-12">No bookings found</p>}
        </div>
      )}
    </div>
  );
}
