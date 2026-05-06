import { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import type { ReportSummary, AuditLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { DollarSign, BedDouble, Utensils, TrendingUp } from 'lucide-react';

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; amount: number }[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [from, to]);

  async function load() {
    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        reportsApi.summary({ from, to }),
        reportsApi.revenueDaily({ from, to }),
      ]);
      setSummary(sRes.data);
      setDailyRevenue(dRes.data);
    } catch {} finally { setLoading(false); }
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500 text-sm mt-1">Revenue & occupancy analytics</p></div>
        <div className="flex items-center gap-3">
          <input type="date" className="input max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-gray-400">to</span>
          <input type="date" className="input max-w-[160px]" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div> : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
              {[
                { label: 'Total Revenue', value: `₹${summary.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-primary-50 text-primary-600' },
                { label: 'Room Revenue', value: `₹${summary.roomRevenue.toLocaleString()}`, icon: BedDouble, color: 'bg-emerald-50 text-emerald-600' },
                { label: 'Restaurant Revenue', value: `₹${summary.restaurantRevenue.toLocaleString()}`, icon: Utensils, color: 'bg-amber-50 text-amber-600' },
                { label: 'Occupancy', value: `${summary.occupancyPercent}%`, icon: TrendingUp, color: 'bg-violet-50 text-violet-600' },
              ].map((s, i) => (
                <div key={i} className="card p-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color} mb-3`}><s.icon size={20} /></div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Revenue Chart */}
          <div className="card p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Daily Revenue</h3>
            {dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={v => format(new Date(v), 'dd MMM')} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="amount" fill="#4c6ef5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-12">No revenue data for this period</p>}
          </div>

          {/* Quick Stats */}
          {summary && (
            <div className="grid grid-cols-3 gap-5">
              <div className="card p-5"><p className="text-3xl font-bold text-gray-900">{summary.currentCheckins}</p><p className="text-sm text-gray-500 mt-1">Current Check-ins</p></div>
              <div className="card p-5"><p className="text-3xl font-bold text-gray-900">{summary.checkoutsInPeriod}</p><p className="text-sm text-gray-500 mt-1">Checkouts (Period)</p></div>
              <div className="card p-5"><p className="text-3xl font-bold text-gray-900">{summary.confirmedBookings}</p><p className="text-sm text-gray-500 mt-1">Pending Bookings</p></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
