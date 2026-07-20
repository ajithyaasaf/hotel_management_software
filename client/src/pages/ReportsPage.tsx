import { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import type { ReportSummary, AuditLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { DollarSign, BedDouble, Utensils, TrendingUp, TrendingDown } from 'lucide-react';

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailyData, setDailyData] = useState<{ date: string; revenue: number; expense: number; profit: number }[]>([]);
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
      setDailyData(dRes.data);
    } catch {} finally { setLoading(false); }
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500 text-sm mt-1">Financial performance & occupancy</p></div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="date" className="input flex-1 sm:max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-gray-400">to</span>
          <input type="date" className="input flex-1 sm:max-w-[160px]" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-8 animate-pulse">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-5 border border-gray-150/60 space-y-3">
                <div className="h-10 w-10 bg-gray-200 rounded-xl" />
                <div className="h-6 w-20 bg-gray-200 rounded-md" />
                <div className="h-3.5 w-16 bg-gray-150 rounded-md" />
              </div>
            ))}
          </div>

          {/* Revenue vs Expense Chart */}
          <div className="card p-6 border border-gray-150/60 space-y-6">
            <div className="h-5 w-40 bg-gray-200 rounded-md" />
            <div className="h-72 bg-gray-50 rounded-xl flex items-end justify-around p-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="flex gap-1 items-end">
                  <div className="h-44 w-4 bg-gray-200 rounded-t" />
                  <div className="h-28 w-4 bg-gray-150 rounded-t" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 border border-gray-150/60 space-y-2">
                <div className="h-8 w-12 bg-gray-200 rounded-md" />
                <div className="h-4 w-28 bg-gray-150 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {[
                { label: 'Room Revenue', value: `₹${summary.roomRevenue.toLocaleString()}`, icon: BedDouble, color: 'bg-emerald-50 text-emerald-600' },
                { label: 'Restaurant Rev.', value: `₹${summary.restaurantRevenue.toLocaleString()}`, icon: Utensils, color: 'bg-amber-50 text-amber-600' },
                { label: 'Banquet Rev.', value: `₹${(summary.banquetRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-indigo-50 text-indigo-600' },
                { label: 'Total Revenue', value: `₹${summary.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-primary-50 text-primary-600' },
                {
                  label: 'Total Expenses', 
                  value: `₹${(summary.totalExpenses ?? 0).toLocaleString()}`,
                  subtext: `H: ₹${summary.hotelExpenses || 0} | R: ₹${summary.restaurantExpenses || 0} | B: ₹${summary.banquetExpenses || 0}`,
                  icon: TrendingDown, 
                  color: 'bg-red-50 text-red-600' 
                }
              ].map((s, i) => (
                <div key={i} className="card p-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color} mb-3`}><s.icon size={20} /></div>
                  <p className="text-xl font-bold text-gray-900">{(s as any).prefix || ''}{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  {s.subtext && <p className="text-[10px] text-gray-400 mt-2 font-medium">{s.subtext}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Revenue vs Expense Chart */}
          <div className="card p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-6">Revenue vs Expenses</h3>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => format(new Date(v), 'dd MMM')} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${v}`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`]}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#4c6ef5" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" name="Expense" fill="#fa5252" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-12">No data for this period</p>}
          </div>

          {/* Quick Stats */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
