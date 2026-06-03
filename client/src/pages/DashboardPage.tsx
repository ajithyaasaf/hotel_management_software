import { useEffect, useState } from 'react';
import { reportsApi, bookingsApi, ordersApi, nightAuditApi } from '../api';
import type { ReportSummary, Booking, Order } from '../types';
import { useAuthStore } from '../store/authStore';
import {
  BedDouble, TrendingUp, Utensils, Users, ArrowUpRight,
  CalendarCheck, Clock, DollarSign, Calendar, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [businessDate, setBusinessDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [sumRes, bookRes, ordRes, statusRes] = await Promise.all([
        reportsApi.summary(),
        bookingsApi.getActive(),
        ordersApi.getActive(),
        nightAuditApi.getStatus(),
      ]);
      setSummary(sumRes.data);
      setRecentBookings(bookRes.data.slice(0, 5));
      setActiveOrders(ordRes.data.slice(0, 5));
      setBusinessDate(statusRes.data.businessDate);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
    </div>
  );

  const stats = summary ? [
    { label: 'Total Revenue', value: `₹${summary.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-status-info-bg text-status-info-text', trend: '+12%' },
    { label: 'Room Revenue', value: `₹${summary.roomRevenue.toLocaleString()}`, icon: BedDouble, color: 'bg-status-available-bg text-status-available-text' },
    { label: 'Restaurant Revenue', value: `₹${summary.restaurantRevenue.toLocaleString()}`, icon: Utensils, color: 'bg-status-cleaning-bg text-status-cleaning-text' },
    { label: 'Occupancy', value: `${summary.occupancyPercent}%`, icon: TrendingUp, color: 'bg-status-occupied-bg text-status-occupied-text', sub: `${summary.occupiedRooms}/${summary.totalRooms} rooms` },
  ] : [];

  const statusConfig: Record<string, { label: string; badge: string; bg: string }> = {
    AVAILABLE: { label: 'Available', badge: 'badge-green', bg: 'bg-status-available-bg border-status-available-text/20' },
    OCCUPIED: { label: 'Occupied', badge: 'badge-blue', bg: 'bg-status-occupied-bg border-status-occupied-text/20' },
    CLEANING: { label: 'Cleaning', badge: 'badge-yellow', bg: 'bg-status-cleaning-bg border-status-cleaning-text/20' },
    BLOCKED: { label: 'Blocked', badge: 'badge-red', bg: 'bg-status-blocked-bg border-status-blocked-text/20' },
  };

  const quickStats = summary ? [
    { label: 'Current Check-ins', value: summary.currentCheckins, icon: CalendarCheck },
    { label: 'Upcoming Bookings', value: summary.confirmedBookings, icon: Clock },
    { label: 'Active Orders', value: activeOrders.length, icon: Utensils },
  ] : [];

  const isAuditPending = () => {
    if (!businessDate) return false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return businessDate < todayStr;
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name}
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening at your hotel today</p>
        </div>

        {businessDate && (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm shadow-gray-100/50 shrink-0">
            <Calendar size={18} className="text-primary-600" />
            <div>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">Business Date</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-extrabold text-gray-900">
                  {format(new Date(businessDate + 'T00:00:00'), 'dd MMM yyyy')}
                </span>
                {isAuditPending() && (
                  <span className="inline-flex items-center gap-1 bg-yellow-50 border border-yellow-100 text-yellow-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                    <AlertTriangle size={10} /> Pending Close
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="card p-5 animate-fadeIn" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              {stat.trend && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ArrowUpRight size={12} /> {stat.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            {stat.sub && <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {quickStats.map((s, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
              <s.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Check-ins */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Active Check-ins</h3>
            <span className="badge badge-blue">{recentBookings.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-8 text-center">No active check-ins</p>
            ) : recentBookings.map((b: Booking) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 font-semibold text-sm">
                    {b.room.roomNumber}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.guest.name}</p>
                    <p className="text-xs text-gray-400">{b.guest.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge ${b.status === 'CHECKED_IN' ? 'badge-green' : 'badge-blue'}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">Out: {format(new Date(b.expectedCheckout), 'dd MMM')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Orders */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Active Orders</h3>
            <span className="badge badge-yellow">{activeOrders.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {activeOrders.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-8 text-center">No active orders</p>
            ) : activeOrders.map((o: Order) => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">
                    {o.type === 'ROOM' ? `Room ${o.room?.roomNumber}` : o.type.replace('_', ' ')}
                    {' · '}{o.items.length} items
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">₹{Number(o.total).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{format(new Date(o.createdAt), 'hh:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
