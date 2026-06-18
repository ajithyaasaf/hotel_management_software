import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsApi, groupBookingsApi, nightAuditApi } from '../api';
import type { Booking, GroupBooking } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Plus, Search, CalendarCheck, Eye, Users, AlertTriangle } from 'lucide-react';

const statusBadge: Record<string, string> = {
  CONFIRMED: 'badge-blue', CHECKED_IN: 'badge-green', CHECKED_OUT: 'badge-gray',
  CANCELLED: 'badge-red', NO_SHOW: 'badge-yellow',
};

const groupStatusBadge: Record<string, string> = {
  ACTIVE: 'badge-green', PARTIALLY_CHECKED_OUT: 'badge-yellow',
  COMPLETED: 'badge-gray', CANCELLED: 'badge-red',
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'individual' | 'group'>('individual');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [groups, setGroups] = useState<GroupBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [businessDate, setBusinessDate] = useState<string>('');

  useEffect(() => {
    nightAuditApi.getStatus().then(res => {
      setBusinessDate(res.data.businessDate);
    }).catch(() => {
      setBusinessDate(format(new Date(), 'yyyy-MM-dd'));
    });
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const params: { status?: string } = {};
      if (filter) params.status = filter;
      const { data } = await bookingsApi.getAll(params);
      setBookings(data);
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data } = await groupBookingsApi.getAll();
      setGroups(data);
    } catch { toast.error('Failed to load group bookings'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tab === 'individual') {
        loadBookings();
      } else {
        loadGroups();
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter]);

  const filtered = bookings.filter(b =>
    !search || b.guest.name.toLowerCase().includes(search.toLowerCase()) ||
    b.guest.phone.includes(search) || b.bookingNumber.includes(search) ||
    b.room.roomNumber.includes(search)
  );

  const filteredGroups = groups.filter(g =>
    !search ||
    g.leadGuest.name.toLowerCase().includes(search.toLowerCase()) ||
    g.leadGuest.phone.includes(search) ||
    g.groupNumber.includes(search)
  );

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tab === 'individual' ? `${bookings.length} total bookings` : `${groups.length} group bookings`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/bookings/group/new')} className="btn btn-outline">
            <Users size={18} /> Group Check-in
          </button>
          <button onClick={() => navigate('/bookings/new')} className="btn btn-primary">
            <Plus size={18} /> New Check-in
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setTab('individual'); setFilter(''); setSearch(''); }}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'individual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Individual
        </button>
        <button
          onClick={() => { setTab('group'); setFilter(''); setSearch(''); }}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'group' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Users size={14} /> Groups</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder={tab === 'individual' ? 'Search by name, phone, room...' : 'Search by guest, phone, group no...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {tab === 'individual' && (
          <div className="flex gap-2">
            {['', 'CHECKED_IN', 'CONFIRMED', 'CHECKED_OUT', 'CANCELLED'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
              >
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card overflow-hidden border border-gray-150/60 animate-pulse">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-14" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-20" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-12" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-10" /></th>
                <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Array.from({ length: 6 }).map((_, rIdx) => (
                <tr key={rIdx} className="h-16">
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-16" /></td>
                  <td className="px-5 py-3 space-y-1.5">
                    <div className="h-4 bg-gray-200 rounded-md w-28" />
                    <div className="h-3 bg-gray-150 rounded-md w-20" />
                  </td>
                  <td className="px-5 py-3 space-y-1.5">
                    <div className="h-4 bg-gray-200 rounded-md w-12" />
                    <div className="h-3 bg-gray-150 rounded-md w-24" />
                  </td>
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-20" /></td>
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-20" /></td>
                  <td className="px-5 py-3"><div className="h-4 bg-gray-200 rounded-md w-12" /></td>
                  <td className="px-5 py-3"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
                  <td className="px-5 py-3"><div className="h-8 bg-gray-100 rounded-lg w-8" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'individual' ? (
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
              {filtered.map(b => {
                const referenceDate = businessDate || new Date().toISOString().split('T')[0];
                const checkoutStr = new Date(b.expectedCheckout).toISOString().split('T')[0];
                const isOverdue = b.status === 'CHECKED_IN' && checkoutStr < referenceDate;
                return (
                  <tr key={b.id} className={`transition-colors ${isOverdue ? 'bg-red-50/30 hover:bg-red-50/40' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-5 py-3">
                      <span className="text-sm font-mono text-primary-600">{b.bookingNumber}</span>
                      {b.groupBookingId && (
                        <span className="ml-2 text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded font-medium">Group</span>
                      )}
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
                    <td className="px-5 py-3 text-sm">
                      <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}>
                        {format(new Date(b.expectedCheckout), 'dd MMM yyyy')}
                      </span>
                      {isOverdue && (
                        <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mt-0.5 flex items-center gap-0.5 animate-pulse">
                          <AlertTriangle size={10} /> Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">₹{Number(b.roomPrice).toLocaleString()}</td>
                    <td className="px-5 py-3"><span className={`badge ${statusBadge[b.status]}`}>{b.status.replace('_', ' ')}</span></td>
                    <td className="px-5 py-3">
                      <button onClick={() => navigate(`/bookings/${b.id}`)} className="btn btn-ghost btn-sm"><Eye size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-12">No bookings found</p>}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Group No.</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead Guest</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rooms</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredGroups.map(g => {
                const totalAmount = g.bookings.reduce((s, b) => s + Number(b.invoice?.grandTotal ?? 0), 0);
                const totalPending = g.bookings.reduce((s, b) => s + Number(b.invoice?.pendingAmount ?? 0), 0);
                return (
                  <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-mono text-primary-600">{g.groupNumber}</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{g.leadGuest.name}</p>
                      <p className="text-xs text-gray-400">{g.leadGuest.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-900">
                        <Users size={14} className="text-gray-400" /> {g.bookings.length} rooms
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">₹{totalAmount.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      {totalPending > 0
                        ? <span className="text-sm font-medium text-red-600">₹{totalPending.toLocaleString()}</span>
                        : <span className="text-sm text-emerald-500">Paid</span>
                      }
                    </td>
                    <td className="px-5 py-3"><span className={`badge ${groupStatusBadge[g.status]}`}>{g.status.replace(/_/g, ' ')}</span></td>
                    <td className="px-5 py-3">
                      <button onClick={() => navigate(`/bookings/group/${g.id}`)} className="btn btn-ghost btn-sm"><Eye size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredGroups.length === 0 && <p className="text-center text-gray-400 py-12">No group bookings found</p>}
        </div>
      )}
    </div>
  );
}
