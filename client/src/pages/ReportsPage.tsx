import { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import type { ReportSummary, AuditLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { DollarSign, BedDouble, Utensils, TrendingUp, TrendingDown } from 'lucide-react';

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailyData, setDailyData] = useState<{ date: string; revenue: number; expense: number; profit: number }[]>([]);
  const [policeData, setPoliceData] = useState<any[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'FINANCIALS' | 'POLICE_REPORT'>('FINANCIALS');

  useEffect(() => { load(); }, [from, to, activeTab]);

  const exportToExcel = () => {
    const headers = ['Room', 'Guest Name', 'Phone', 'Nationality', 'Passport No', 'ID Proof Type', 'ID Number', 'Check-in Date', 'Guest Type'];
    
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    
    const rows = policeData.map(g => [
      escapeCsv(g.roomNumber),
      escapeCsv(g.name),
      escapeCsv(g.phone),
      escapeCsv(g.isForeigner ? (g.country || 'Foreigner') : 'Indian'),
      escapeCsv(g.passportNo),
      escapeCsv(g.idProofType || 'Missing ID'),
      escapeCsv(g.idProofNumber),
      escapeCsv(format(new Date(g.checkInDate), 'dd MMM yyyy')),
      escapeCsv(g.type)
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Police_Report_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function load() {
    setLoading(true);
    try {
      if (activeTab === 'FINANCIALS') {
        const [sRes, dRes] = await Promise.all([
          reportsApi.summary({ from, to }),
          reportsApi.revenueDaily({ from, to }),
        ]);
        setSummary(sRes.data);
        setDailyData(dRes.data);
      } else {
        const pRes = await reportsApi.policeCheckins({ from, to });
        
        // Flatten primary and accompanying guests into a single list
        const flattened: any[] = [];
        pRes.data.forEach((booking: any) => {
          flattened.push({
            type: 'Primary',
            bookingNumber: booking.bookingNumber,
            roomNumber: booking.room?.roomNumber || 'N/A',
            checkInDate: booking.checkInDate,
            expectedCheckout: booking.expectedCheckout,
            name: booking.guest?.name,
            phone: booking.guest?.phone,
            idProofType: booking.guest?.idProofType,
            idProofNumber: booking.guest?.idProofNumber,
            isForeigner: booking.guest?.isForeigner,
            passportNo: booking.guest?.passportNo,
            country: booking.guest?.country
          });
          
          if (booking.accompanyingGuests) {
            booking.accompanyingGuests.forEach((ag: any) => {
              flattened.push({
                type: 'Accompanying',
                bookingNumber: booking.bookingNumber,
                roomNumber: booking.room?.roomNumber || 'N/A',
                checkInDate: booking.checkInDate,
                expectedCheckout: booking.expectedCheckout,
                name: ag.name,
                phone: `w/ ${booking.guest?.phone}`,
                idProofType: ag.idProofType,
                idProofNumber: ag.idProofNumber,
                isForeigner: ag.isForeigner,
                passportNo: ag.passportNo,
                country: ag.country
              });
            });
          }
        });
        setPoliceData(flattened);
      }
    } catch {} finally { setLoading(false); }
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500 text-sm mt-1">Analytics and compliance reporting</p></div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="date" className="input flex-1 sm:max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-gray-400">to</span>
          <input type="date" className="input flex-1 sm:max-w-[160px]" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>
      
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'FINANCIALS' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('FINANCIALS')}
        >
          Financial Summary
        </button>
        <button
          className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'POLICE_REPORT' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => {
            setActiveTab('POLICE_REPORT');
            if (from !== to) {
              const today = new Date().toISOString().split('T')[0];
              setFrom(today);
              setTo(today);
            }
          }}
        >
          Police Report
        </button>
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
          {activeTab === 'FINANCIALS' ? (
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
          ) : (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-gray-150/60 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Check-in Register</h3>
                  <p className="text-xs text-gray-500 mt-1">Daily guest arrival and documentation report</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={exportToExcel} className="btn btn-secondary text-sm">Export to Excel</button>
                  <button onClick={() => window.print()} className="btn btn-secondary text-sm">Print Report</button>
                </div>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Guest Name</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nationality</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID Proof</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Check-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150/60">
                    {policeData.map((g, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{g.roomNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {g.name}
                          {g.type === 'Accompanying' && <span className="ml-2 text-[10px] text-gray-400 uppercase">Secondary</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.phone}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {g.isForeigner ? (
                            <div>
                              <span className="font-semibold text-primary-700">{g.country || 'Foreigner'}</span>
                              {g.passportNo && <div className="text-xs text-gray-500">P.P: {g.passportNo}</div>}
                            </div>
                          ) : 'Indian'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {g.idProofType ? (
                            <div>
                              <span className="font-medium text-gray-800">{g.idProofType}</span>
                              <div className="text-xs text-gray-500">{g.idProofNumber || 'Missing No.'}</div>
                            </div>
                          ) : <span className="text-red-500 font-semibold text-xs">Missing ID</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {format(new Date(g.checkInDate), 'dd MMM yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {policeData.length === 0 && <p className="text-center text-gray-400 py-12">No check-ins found for the selected dates</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
