import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { banquetsApi } from '../api';
import type { BanquetBooking, BanquetHall } from '../types';
import { format } from 'date-fns';
import { Wine, Plus, Calendar, Users, IndianRupee, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, string> = {
  PROVISIONAL: 'bg-amber-50 text-amber-700 border border-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  COMPLETED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CANCELLED: 'bg-red-50 text-red-600 border border-red-200',
};

const SLOT_LABELS: Record<string, string> = {
  MORNING: '🌅 Morning (Breakfast)',
  AFTERNOON: '☀️ Afternoon (Lunch)',
  EVENING: '🌙 Evening (Dinner)',
  CUSTOM: '🕐 Custom Hours',
};

export default function BanquetsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BanquetBooking[]>([]);
  const [halls, setHalls] = useState<BanquetHall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHall, setFilterHall] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bRes, hRes] = await Promise.all([
        banquetsApi.getBookings(),
        banquetsApi.getHalls(),
      ]);
      setBookings(bRes.data);
      setHalls(hRes.data);
    } catch {
      toast.error('Failed to load banquet data');
    } finally {
      setLoading(false);
    }
  }

  const filtered = bookings.filter(b => {
    const matchSearch =
      !search ||
      b.guest.name.toLowerCase().includes(search.toLowerCase()) ||
      b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.guest.phone.includes(search);
    const matchStatus = !filterStatus || b.status === filterStatus;
    const matchHall = !filterHall || b.hallId === filterHall;
    return matchSearch && matchStatus && matchHall;
  });

  const totalPending = filtered.reduce((sum, b) => sum + Number(b.pendingAmount), 0);
  const totalRevenue = filtered.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const activeCount = filtered.filter(b => b.status === 'CONFIRMED' || b.status === 'PROVISIONAL').length;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-1">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-44 bg-gray-200 rounded-lg" />
            </div>
            <div className="h-4 w-72 bg-gray-150 rounded-md" />
          </div>
          <div className="h-10 w-44 bg-gray-200 rounded-xl" />
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 border border-gray-150/60 flex items-center gap-4">
              <div className="h-12 w-12 bg-gray-200 rounded-xl" />
              <div className="space-y-2">
                <div className="h-6 w-16 bg-gray-200 rounded-md" />
                <div className="h-3 w-28 bg-gray-150 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="card p-4 border border-gray-150/60 flex gap-3">
          <div className="h-9 bg-gray-200 rounded-lg flex-1" />
          <div className="h-9 bg-gray-200 rounded-lg w-40" />
          <div className="h-9 bg-gray-200 rounded-lg w-44" />
        </div>

        {/* Bookings cards list */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 border border-gray-150/60 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gray-200 rounded-xl" />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="h-4 w-24 bg-gray-200 rounded-md" />
                    <div className="h-4 w-16 bg-gray-205 rounded-full" />
                  </div>
                  <div className="h-4 w-32 bg-gray-200 rounded-md" />
                  <div className="h-3 w-40 bg-gray-150 rounded-md" />
                </div>
              </div>
              <div className="flex gap-8">
                {[1, 2, 3].map(j => (
                  <div key={j} className="space-y-1.5 text-center">
                    <div className="h-3 w-12 bg-gray-150 rounded-sm" />
                    <div className="h-4 w-16 bg-gray-200 rounded-md" />
                  </div>
                ))}
                <div className="space-y-1.5 text-right">
                  <div className="h-3 w-16 bg-gray-150 rounded-sm" />
                  <div className="h-5 w-20 bg-gray-200 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-xl">
              <Wine size={22} className="text-primary-600" />
            </div>
            Banquet & Events
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage hall bookings, events, and catering</p>
        </div>
        <button
          onClick={() => navigate('/banquets/new')}
          className="btn btn-primary gap-2"
        >
          <Plus size={18} /> New Event Booking
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-primary-50 rounded-xl">
            <Calendar size={22} className="text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-xs text-gray-500 font-medium">Active Events</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <IndianRupee size={22} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">₹{Number(totalRevenue).toLocaleString()}</p>
            <p className="text-xs text-gray-500 font-medium">Total Revenue (filtered)</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <IndianRupee size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">₹{Number(totalPending).toLocaleString()}</p>
            <p className="text-xs text-gray-500 font-medium">Pending Collection</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search by guest name, booking number, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Filter size={16} className="text-gray-400" />
            <div className="w-40">
              <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="PROVISIONAL">Provisional</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="w-44 shrink-0">
            <select className="input text-sm" value={filterHall} onChange={e => setFilterHall(e.target.value)}>
              <option value="">All Halls</option>
              {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Wine size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No banquet bookings found</p>
          <p className="text-sm text-gray-400 mt-1">Create a new event booking to get started</p>
          <button onClick={() => navigate('/banquets/new')} className="btn btn-primary mt-4">
            New Event Booking
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(booking => (
            <div
              key={booking.id}
              onClick={() => navigate(`/banquets/${booking.id}`)}
              className="card p-5 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="p-2.5 bg-primary-50 rounded-xl shrink-0">
                    <Wine size={18} className="text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-primary-600">{booking.bookingNumber}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{booking.guest.name}</p>
                    <p className="text-sm text-gray-500">{booking.guest.phone} · {booking.eventType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm shrink-0">
                  <div className="text-center">
                    <p className="text-[11px] text-gray-400 mb-0.5">Hall</p>
                    <p className="font-semibold text-gray-800 text-xs">{booking.hall.name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-gray-400 mb-0.5">Event Date</p>
                    <p className="font-semibold text-gray-800 text-xs">{format(new Date(booking.eventDate), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-gray-400 mb-0.5">Slot</p>
                    <p className="font-semibold text-gray-800 text-xs">{SLOT_LABELS[booking.slot]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 mb-0.5">Total / Pending</p>
                    <p className="font-bold text-gray-900 text-sm">₹{Number(booking.totalAmount).toLocaleString()}</p>
                    {Number(booking.pendingAmount) > 0 && (
                      <p className="text-[11px] text-red-600 font-semibold">₹{Number(booking.pendingAmount).toLocaleString()} pending</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
