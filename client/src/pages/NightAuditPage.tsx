import { useEffect, useState } from 'react';
import { nightAuditApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import {
  Moon,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  DollarSign,
  TrendingUp,
  ClipboardList,
  Users,
  CheckCircle2,
  Clock,
  Printer,
  History,
  Lock,
  Eye,
  FileText,
  Utensils
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getTodayIST } from '../utils/dateTime';

interface OpenOrder {
  id: string;
  orderNumber: string;
  roomNumber: string | null;
  total: number;
}

interface ExpectedNoShow {
  id: string;
  bookingNumber: string;
  guestName: string;
  roomNumber: string;
}

interface Overstay {
  id: string;
  bookingNumber: string;
  guestName: string;
  roomNumber: string;
  expectedCheckout: string;
}

interface PreCheckData {
  businessDate: string;
  openOrdersCount: number;
  expectedNoShowsCount: number;
  overstaysCount: number;
  activeCheckinsCount: number;
  openOrders: OpenOrder[];
  expectedNoShows: ExpectedNoShow[];
  overstays: Overstay[];
}

interface AuditHistoryItem {
  id: string;
  businessDate: string;
  status: string;
  roomRevenue: string;
  foodRevenue: string;
  totalRevenue: string;
  cashCollected: string;
  cardCollected: string;
  upiCollected: string;
  roomsOccupied: number;
  totalRooms: number;
  newCheckins: number;
  checkoutsToday: number;
  noShowsMarked: number;
  runBy: { name: string; role: string };
  startedAt: string;
  completedAt: string;
  notes: string | null;
}

interface AuditChargeDetail {
  id: string;
  roomNumber: string;
  businessDate: string;
  roomRate: string;
  cgst: string;
  sgst: string;
  totalCharge: string;
  booking: {
    bookingNumber: string;
    guest: { name: string };
  };
  room: { roomNumber: string };
}

interface AuditOrderDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  orderType: 'ROOM' | 'WALK_IN' | 'TAKEAWAY';
  totalAmount: string;
  billingStatus: string;
  roomNumber: string | null;
  guestName: string | null;
  createdAt: string;
}

interface AuditDetails {
  id: string;
  businessDate: string;
  status: string;
  roomRevenue: string;
  foodRevenue: string;
  totalRevenue: string;
  cashCollected: string;
  cardCollected: string;
  upiCollected: string;
  roomsOccupied: number;
  totalRooms: number;
  noShowsMarked: number;
  newCheckins?: number;
  checkoutsToday?: number;
  runBy: { name: string; role: string };
  completedAt: string;
  notes: string | null;
  charges: AuditChargeDetail[];
  orders: AuditOrderDetail[];
}

export default function NightAuditPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'MD';

  const [activeTab, setActiveTab] = useState<'close_day' | 'history'>('close_day');

  // Close Day State
  const [loadingPreCheck, setLoadingPreCheck] = useState(true);
  const [preCheck, setPreCheck] = useState<PreCheckData | null>(null);
  const [notes, setNotes] = useState('');
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditDetails | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');

  // History State
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [auditDetails, setAuditDetails] = useState<AuditDetails | null>(null);
  const [filterDate, setFilterDate] = useState('');

  const filteredHistory = filterDate
    ? history.filter(item => item.businessDate.startsWith(filterDate))
    : history;

  const todayStr = getTodayIST();
  const isPastDate = preCheck ? preCheck.businessDate < todayStr : false;
  const currentHourIST = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false
  }).format(new Date()));
  const isTimeLockActive = preCheck ? (!isPastDate && currentHourIST < 22) : false;

  const loadPreCheck = async () => {
    setLoadingPreCheck(true);
    try {
      const { data } = await nightAuditApi.getPreCheck();
      setPreCheck(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to fetch pre-check data');
    } finally {
      setLoadingPreCheck(false);
    }
  };


  const loadHistory = async () => {
    if (!isAdmin) return;
    setLoadingHistory(true);
    try {
      const { data } = await nightAuditApi.getHistory();
      setHistory(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to fetch audit history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'close_day') {
        loadPreCheck();
      } else {
        loadHistory();
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleOpenConfirmModal = () => {
    setVerifyPassword('');
    setShowConfirmModal(true);
  };

  const handleRunAudit = async () => {
    if (!preCheck || !verifyPassword) return;

    setRunningAudit(true);
    try {
      const { data } = await nightAuditApi.run({ notes, password: verifyPassword });
      // Fetch full audit details immediately so we can show a detailed PDF-style report
      const detailsRes = await nightAuditApi.getById(data.auditId);
      setAuditResult(detailsRes.data);
      setShowConfirmModal(false);
      toast.success('Night Audit completed successfully!');
      setNotes('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Night Audit execution failed');
    } finally {
      setRunningAudit(false);
    }
  };

  const viewAuditDetails = async (id: string) => {
    setSelectedAuditId(id);
    try {
      const { data } = await nightAuditApi.getById(id);
      setAuditDetails(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Failed to load details');
      setSelectedAuditId(null);
    }
  };

  const printReport = () => {
    window.print();
  };

  const firstAuditCharge = auditResult?.charges?.[0];
  const auditResultCgstPercent = firstAuditCharge && Number(firstAuditCharge.roomRate) > 0
    ? Math.round((Number(firstAuditCharge.cgst) / Number(firstAuditCharge.roomRate)) * 100 * 10) / 10
    : 2.5;
  const auditResultSgstPercent = firstAuditCharge && Number(firstAuditCharge.roomRate) > 0
    ? Math.round((Number(firstAuditCharge.sgst) / Number(firstAuditCharge.roomRate)) * 100 * 10) / 10
    : 2.5;

  const firstDetailsCharge = auditDetails?.charges?.[0];
  const auditDetailsCgstPercent = firstDetailsCharge && Number(firstDetailsCharge.roomRate) > 0
    ? Math.round((Number(firstDetailsCharge.cgst) / Number(firstDetailsCharge.roomRate)) * 100 * 10) / 10
    : 2.5;
  const auditDetailsSgstPercent = firstDetailsCharge && Number(firstDetailsCharge.roomRate) > 0
    ? Math.round((Number(firstDetailsCharge.sgst) / Number(firstDetailsCharge.roomRate)) * 100 * 10) / 10
    : 2.5;

  return (
    <div className="animate-fadeIn p-4 md:p-6 print:p-0 print:bg-white max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-5 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
            <Moon className="text-primary-600 animate-pulse" size={32} /> Night Audit
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">
            Roll the business day forward, charge rooms, and reconcile daily revenue
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/50">
          <button
            onClick={() => { setActiveTab('close_day'); setAuditResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold tracking-tight transition-all duration-200 ${activeTab === 'close_day'
              ? 'bg-white text-primary-600 shadow-md shadow-gray-200/55 border border-gray-200/20'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Clock size={16} /> Close Day
          </button>
          <button
            onClick={() => { setActiveTab('history'); setSelectedAuditId(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold tracking-tight transition-all duration-200 ${activeTab === 'history'
              ? 'bg-white text-primary-600 shadow-md shadow-gray-200/55 border border-gray-200/20'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <History size={16} /> Audit History
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CLOSE DAY ─── */}
      {activeTab === 'close_day' && (
        <div className={!auditResult ? "print:hidden" : ""}>
          {auditResult ? (
            /* Successful Audit View */
            <div className="space-y-6 animate-scaleIn">
              {/* Success Banner Card */}
              <div className="bg-white border border-gray-200 rounded-[28px] p-6 md:p-8 shadow-xl shadow-gray-100/50 flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100 shrink-0">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Day Closed Successfully!</h2>
                    <p className="text-gray-500 text-sm font-semibold mt-1">
                      Business date <span className="text-gray-900">{format(new Date(auditResult.businessDate), 'dd MMMM yyyy')}</span> is finalized. System operating date is now <span className="text-primary-600 font-extrabold">{format(new Date(new Date(auditResult.businessDate).getTime() + 24 * 60 * 60 * 1000), 'dd MMMM yyyy')}</span>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={printReport}
                    className="btn btn-outline btn-md font-bold flex items-center gap-2"
                  >
                    <Printer size={18} /> Print Audit Report
                  </button>
                  <button
                    onClick={() => { setAuditResult(null); loadPreCheck(); }}
                    className="btn btn-primary btn-md font-bold flex items-center gap-2 shadow-lg shadow-primary-200"
                  >
                    Continue to Next Day →
                  </button>
                </div>
              </div>

              {/* Detailed Audit Journal Sheet */}
              <div className="bg-white border border-gray-200 rounded-[28px] p-6 md:p-8 shadow-xl shadow-gray-100/50">
                {/* Printable Header */}
                <div className="text-center md:text-left mb-8">
                  <div className="hidden print:block text-center border-b border-gray-200 pb-4 mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">GODIVA ROOMS</h1>
                    <p className="text-sm font-bold uppercase text-gray-500 mt-1">Daily Night Audit Report</p>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        Audit Session Summary: {format(new Date(auditResult.businessDate), 'dd MMMM yyyy')}
                      </h2>
                      <p className="text-gray-500 text-sm font-medium mt-1">
                        Completed by <span className="text-gray-900 font-bold">{auditResult.runBy?.name || 'Staff'} ({auditResult.runBy?.role || 'User'})</span> on {auditResult.completedAt ? format(new Date(auditResult.completedAt), 'dd MMM yyyy, hh:mm a') : format(new Date(), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 text-right">
                      <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest block">Total Day Revenue</span>
                      <span className="text-xl font-black text-primary-600 mt-0.5 block">₹{Number(auditResult.totalRevenue ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Snapshot Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Revenue Card */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5">
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-green-500" /> Revenue Posting
                    </h4>
                    <div className="space-y-2 text-sm font-semibold">
                      <div className="flex justify-between text-gray-600">
                        <span>Room Revenue</span>
                        <span className="text-gray-900">₹{Number(auditResult.roomRevenue ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                        <span>Restaurant Revenue</span>
                        <span className="text-gray-900">₹{Number(auditResult.foodRevenue ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Collections Card */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5">
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-primary-500" /> Payment Collections
                    </h4>
                    <div className="space-y-2 text-sm font-semibold">
                      <div className="flex justify-between text-gray-600">
                        <span>Cash Collected</span>
                        <span className="text-gray-900">₹{Number(auditResult.cashCollected ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                        <span>UPI Collected</span>
                        <span className="text-gray-900">₹{Number(auditResult.upiCollected ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                        <span>Card Collected</span>
                        <span className="text-gray-900">₹{Number(auditResult.cardCollected ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Card */}
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5">
                    <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Users size={14} className="text-gray-500" /> Operational Stats
                    </h4>
                    <div className="space-y-2 text-sm font-semibold">
                      <div className="flex justify-between text-gray-600">
                        <span>Occupied Rooms</span>
                        <span className="text-gray-900">{auditResult.roomsOccupied} / {auditResult.totalRooms}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                        <span>Occupancy Rate</span>
                        <span className="text-gray-900">
                          {auditResult.totalRooms > 0 ? ((auditResult.roomsOccupied / auditResult.totalRooms) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                        <span>No-Shows Handled</span>
                        <span className="text-gray-900">{auditResult.noShowsMarked}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {auditResult.notes && (
                  <div className="bg-yellow-50/30 border border-yellow-100 rounded-2xl p-4 mb-8">
                    <h4 className="text-xs font-extrabold text-yellow-700 uppercase tracking-widest mb-1.5">Auditor Notes</h4>
                    <p className="text-sm font-medium text-yellow-950">{auditResult.notes}</p>
                  </div>
                )}

                {/* Audit Room Charges Ledger */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                    <FileText size={20} className="text-gray-400" /> Room Charges Posted ({auditResult.charges?.length || 0})
                  </h3>

                  <div className="border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 text-left border-b border-gray-200 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                          <th className="px-5 py-3.5">Room</th>
                          <th className="px-5 py-3.5">Booking</th>
                          <th className="px-5 py-3.5">Guest</th>
                          <th className="px-5 py-3.5 text-right">Room Rate</th>
                          <th className="px-5 py-3.5 text-right">CGST ({auditResultCgstPercent}%)</th>
                          <th className="px-5 py-3.5 text-right">SGST ({auditResultSgstPercent}%)</th>
                          <th className="px-5 py-3.5 text-right">Total Charge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700 whitespace-nowrap">
                        {auditResult.charges?.map((c: AuditChargeDetail) => (
                          <tr key={c.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-5 py-3 font-bold text-gray-900">Room {c.room.roomNumber}</td>
                            <td className="px-5 py-3 text-gray-500">{c.booking.bookingNumber}</td>
                            <td className="px-5 py-3 text-gray-900">{c.booking.guest.name}</td>
                            <td className="px-5 py-3 text-right">₹{Number(c.roomRate).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-right text-gray-500">₹{Number(c.cgst).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-right text-gray-500">₹{Number(c.sgst).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-right font-bold text-primary-600">₹{Number(c.totalCharge).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        {(!auditResult.charges || auditResult.charges.length === 0) && (
                          <tr>
                            <td colSpan={7} className="text-center py-10 text-gray-400 font-bold uppercase text-xs tracking-widest">
                              No room charges posted during this audit session
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Restaurant Sales Ledger */}
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                    <Utensils size={20} className="text-gray-400" /> Restaurant POS Sales ({auditResult.orders?.length || 0})
                  </h3>

                  <div className="border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 text-left border-b border-gray-200 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                          <th className="px-5 py-3.5">Order Number</th>
                          <th className="px-5 py-3.5">Type</th>
                          <th className="px-5 py-3.5">Room</th>
                          <th className="px-5 py-3.5">Guest</th>
                          <th className="px-5 py-3.5 text-right">Total Amount</th>
                          <th className="px-5 py-3.5 text-center">Billing Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700 whitespace-nowrap">
                        {auditResult.orders?.map((o: AuditOrderDetail) => (
                          <tr key={o.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-5 py-3 font-bold text-gray-900">{o.orderNumber}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${o.orderType === 'ROOM'
                                ? 'bg-blue-50 text-blue-700'
                                : o.orderType === 'WALK_IN'
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-orange-50 text-orange-700'
                                }`}>
                                {o.orderType}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-500">{o.roomNumber ? `Room ${o.roomNumber}` : '—'}</td>
                            <td className="px-5 py-3 text-gray-900">{o.guestName || '—'}</td>
                            <td className="px-5 py-3 text-right font-bold text-gray-900">₹{Number(o.totalAmount).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${o.billingStatus === 'CHARGED_TO_ROOM'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                                }`}>
                                {o.billingStatus === 'CHARGED_TO_ROOM' ? 'Folio Charged' : 'Paid Direct'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!auditResult.orders || auditResult.orders.length === 0) && (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-gray-400 font-bold uppercase text-xs tracking-widest">
                              No restaurant orders completed during this audit session
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : loadingPreCheck ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
              {/* Left Column: Config and Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Business Date Info Banner */}
                <div className="bg-white border border-gray-150 rounded-3xl p-6 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-250" />
                    <div className="space-y-2">
                      <div className="h-5 w-44 bg-gray-200 rounded-md" />
                      <div className="h-3 w-28 bg-gray-150 rounded-sm" />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-6 w-32 bg-gray-200 rounded-md" />
                    <div className="h-3.5 w-24 bg-gray-150 rounded-sm" />
                  </div>
                </div>

                {/* Pre-Check Operational Alerts */}
                <div className="bg-white border border-gray-150 rounded-3xl p-6 space-y-5">
                  <div className="h-5 w-40 bg-gray-200 rounded-md mb-2" />
                  {[1, 2, 3].map(i => (
                    <div key={i} className="border border-gray-100 rounded-2xl p-4 flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-xl bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-52 bg-gray-200 rounded-md" />
                        <div className="h-3.5 w-80 bg-gray-150 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Execution Form Card */}
              <div>
                <div className="bg-white border border-gray-150 rounded-[24px] p-6 space-y-4">
                  <div className="h-5 w-32 bg-gray-200 rounded-md mb-2" />
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <div className="h-4 w-28 bg-gray-150 rounded-md" />
                      <div className="h-4 w-16 bg-gray-200 rounded-md" />
                    </div>
                    <div className="flex justify-between border-t pt-3">
                      <div className="h-4 w-36 bg-gray-150 rounded-md" />
                      <div className="h-4 w-16 bg-gray-200 rounded-md" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-3 w-36 bg-gray-200 rounded-sm" />
                    <div className="h-20 bg-gray-50 rounded-xl" />
                  </div>
                  <div className="h-12 bg-gray-250 rounded-xl w-full" />
                </div>
              </div>
            </div>
          ) : preCheck ? (
            /* Close Day Form Panel */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Config and Details */}
              <div className="lg:col-span-2 space-y-6">

                {/* Business Date Info Banner */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md shadow-gray-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 tracking-tight">System Business Date</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Hotel Calendar Date</p>
                    </div>
                  </div>
                  <div className="text-right sm:text-right">
                    <span className="text-2xl font-black text-primary-600 tracking-tight block">
                      {preCheck.businessDate}
                    </span>
                    <span className="text-xs font-medium text-gray-400">
                      Server Date: {format(new Date(), 'yyyy-MM-dd')}
                    </span>
                  </div>
                </div>

                {/* Pre-Check Operational Alerts */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md shadow-gray-100/50">
                  <h3 className="text-lg font-bold text-gray-900 mb-5 tracking-tight flex items-center gap-2">
                    <ClipboardList className="text-gray-400" size={20} /> Pre-Audit Checks
                  </h3>

                  <div className="space-y-4">
                    {/* POS Warning Card */}
                    <div className={`border rounded-2xl p-4 flex gap-4 items-start transition-colors ${preCheck.openOrdersCount > 0
                      ? 'bg-red-50/50 border-red-100 text-red-900'
                      : 'bg-green-50/50 border-green-100 text-green-900'
                      }`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${preCheck.openOrdersCount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                        {preCheck.openOrdersCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm leading-snug">Open Restaurant Orders ({preCheck.openOrdersCount})</h4>
                        <p className="text-xs font-medium opacity-80 mt-0.5">
                          {preCheck.openOrdersCount > 0
                            ? 'Warning: Open restaurant bills exist. Verify these can wait or close them before closing.'
                            : 'All restaurant table orders are successfully billed.'}
                        </p>

                        {preCheck.openOrdersCount > 0 && (
                          <div className="mt-3 bg-white border border-red-100 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-red-50 text-red-700 font-bold border-b border-red-100">
                                  <th className="px-3 py-1.5">Order</th>
                                  <th className="px-3 py-1.5">Room</th>
                                  <th className="px-3 py-1.5 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-red-50 text-red-950 font-medium">
                                {preCheck.openOrders.map(o => (
                                  <tr key={o.id}>
                                    <td className="px-3 py-1.5">{o.orderNumber}</td>
                                    <td className="px-3 py-1.5">{o.roomNumber ? `Room ${o.roomNumber}` : 'Walk-In'}</td>
                                    <td className="px-3 py-1.5 text-right">₹{o.total}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* No-Shows Info Card */}
                    <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                        <Users size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-gray-900 leading-snug">
                          Expected No-Shows ({preCheck.expectedNoShowsCount})
                        </h4>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                          {preCheck.expectedNoShowsCount > 0
                            ? 'These bookings will be automatically changed to NO_SHOW. Their locked rooms will be freed.'
                            : 'No pending arrivals to process as no-show.'}
                        </p>

                        {preCheck.expectedNoShowsCount > 0 && (
                          <div className="mt-3 bg-white border border-gray-100 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                  <th className="px-3 py-1.5">Booking</th>
                                  <th className="px-3 py-1.5">Guest</th>
                                  <th className="px-3 py-1.5">Room</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 text-gray-700 font-medium">
                                {preCheck.expectedNoShows.map(ns => (
                                  <tr key={ns.id}>
                                    <td className="px-3 py-1.5">{ns.bookingNumber}</td>
                                    <td className="px-3 py-1.5">{ns.guestName}</td>
                                    <td className="px-3 py-1.5">{ns.roomNumber}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Overstays Warning Card */}
                    <div className={`border rounded-2xl p-4 flex gap-4 items-start ${preCheck.overstaysCount > 0
                      ? 'bg-yellow-50/50 border-yellow-100 text-yellow-900'
                      : 'bg-green-50/50 border-green-100 text-green-900'
                      }`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${preCheck.overstaysCount > 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                        }`}>
                        {preCheck.overstaysCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm leading-snug">Expected Departures Overdue ({preCheck.overstaysCount})</h4>
                        <p className="text-xs font-medium opacity-80 mt-0.5">
                          {preCheck.overstaysCount > 0
                            ? 'Warning: The checkout time has passed for these guests. They will remain checked in, but must be checked out or extended manually by staff.'
                            : 'No active rooms are overdue for checkout.'}
                        </p>

                        {preCheck.overstaysCount > 0 && (
                          <div className="mt-3 bg-white border border-yellow-100 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-yellow-50 text-yellow-700 font-bold border-b border-yellow-100">
                                  <th className="px-3 py-1.5">Booking</th>
                                  <th className="px-3 py-1.5">Guest</th>
                                  <th className="px-3 py-1.5">Room</th>
                                  <th className="px-3 py-1.5">Checkout</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-yellow-50 text-yellow-950 font-medium">
                                {preCheck.overstays.map(ov => (
                                  <tr key={ov.id}>
                                    <td className="px-3 py-1.5">{ov.bookingNumber}</td>
                                    <td className="px-3 py-1.5">{ov.guestName}</td>
                                    <td className="px-3 py-1.5">{ov.roomNumber}</td>
                                    <td className="px-3 py-1.5">{ov.expectedCheckout}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Execution Form Card */}
              <div>
                <div className="bg-white border border-gray-200 rounded-[24px] p-6 shadow-lg shadow-gray-100/50 sticky top-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                    <ShieldCheck size={20} className="text-primary-600" /> Run Day-End Roll
                  </h3>

                  <div className="space-y-4 text-sm font-medium">
                    <div className="flex justify-between text-gray-600">
                      <span>In-House Guests</span>
                      <span className="font-bold text-gray-900">{preCheck.activeCheckinsCount} rooms</span>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-3">
                      <span>Daily Room Rates to Post</span>
                      <span className="font-bold text-gray-900">{preCheck.activeCheckinsCount} charges</span>
                    </div>

                    {/* Operational Warning Alert */}
                    {preCheck.openOrdersCount > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-800 text-xs font-medium">
                        You have open restaurant orders. Check with the kitchen before running audit.
                      </div>
                    )}

                    {/* Notes Area */}
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 ml-1">
                        Shift Manager Notes
                      </label>
                      <textarea
                        className="input min-h-[90px] text-sm resize-none rounded-xl"
                        placeholder="E.g., Cash drawer matched, 2 delayed arrivals check-in scheduled next morning."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={handleOpenConfirmModal}
                      disabled={runningAudit}
                      className="btn btn-primary w-full btn-lg mt-2 shadow-lg shadow-primary-200 font-bold flex items-center justify-center gap-2"
                    >
                      {runningAudit ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          Closing Day...
                        </>
                      ) : (
                        <>
                          <Lock size={18} />
                          Close Day ({preCheck.businessDate})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── TAB 2: AUDIT HISTORY ─── */}
      {activeTab === 'history' && (
        <div className="animate-fadeIn">
          {selectedAuditId && auditDetails ? (
            /* Audit Detail Sheet View */
            <div className="bg-white border border-gray-200 rounded-[28px] p-6 md:p-8 shadow-xl shadow-gray-100/50 animate-scaleIn">
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-5 mb-6 print:hidden">
                <button
                  onClick={() => { setSelectedAuditId(null); setAuditDetails(null); }}
                  className="btn btn-ghost btn-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1.5"
                >
                  ← Back to History
                </button>
                <button
                  onClick={printReport}
                  className="btn btn-outline btn-sm font-bold flex items-center gap-2"
                >
                  <Printer size={16} /> Print Report
                </button>
              </div>

              {/* Printable Header */}
              <div className="text-center md:text-left mb-8">
                <div className="hidden print:block text-center border-b border-gray-200 pb-4 mb-6">
                  <h1 className="text-3xl font-bold tracking-tight">GODIVA ROOMS</h1>
                  <p className="text-sm font-bold uppercase text-gray-500 mt-1">Daily Night Audit Report</p>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                      Audit Session: {format(new Date(auditDetails.businessDate), 'dd MMMM yyyy')}
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">
                      Completed by <span className="text-gray-900 font-bold">{auditDetails.runBy.name} ({auditDetails.runBy.role})</span> on {format(new Date(auditDetails.completedAt), 'dd MMM yyyy, hh:mm a')}
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3 text-right">
                    <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest block">Total Day Revenue</span>
                    <span className="text-xl font-black text-primary-600 mt-0.5 block">₹{Number(auditDetails.totalRevenue).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Revenue Card */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5">
                  <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-green-500" /> Revenue Posting
                  </h4>
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex justify-between text-gray-600">
                      <span>Room Revenue</span>
                      <span className="text-gray-900">₹{Number(auditDetails.roomRevenue).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                      <span>Restaurant Revenue</span>
                      <span className="text-gray-900">₹{Number(auditDetails.foodRevenue).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Collections Card */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5">
                  <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-primary-500" /> Payment Collections
                  </h4>
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex justify-between text-gray-600">
                      <span>Cash Collected</span>
                      <span className="text-gray-900">₹{Number(auditDetails.cashCollected).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                      <span>UPI Collected</span>
                      <span className="text-gray-900">₹{Number(auditDetails.upiCollected).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                      <span>Card Collected</span>
                      <span className="text-gray-900">₹{Number(auditDetails.cardCollected).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Stats Card */}
                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5">
                  <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Users size={14} className="text-gray-500" /> Operational Stats
                  </h4>
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex justify-between text-gray-600">
                      <span>Occupied Rooms</span>
                      <span className="text-gray-900">{auditDetails.roomsOccupied} / {auditDetails.totalRooms}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 border-t border-gray-200/50 pt-2">
                      <span>Occupancy Rate</span>
                      <span className="text-gray-900">
                        {auditDetails.totalRooms > 0 ? ((auditDetails.roomsOccupied / auditDetails.totalRooms) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {auditDetails.notes && (
                <div className="bg-yellow-50/30 border border-yellow-100 rounded-2xl p-4 mb-8">
                  <h4 className="text-xs font-extrabold text-yellow-700 uppercase tracking-widest mb-1.5">Auditor Notes</h4>
                  <p className="text-sm font-medium text-yellow-950">{auditDetails.notes}</p>
                </div>
              )}

              {/* Audit Room Charges Ledger */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                  <FileText size={20} className="text-gray-400" /> Room Charges Posted ({auditDetails.charges.length})
                </h3>

                <div className="border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-200 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                        <th className="px-5 py-3.5">Room</th>
                        <th className="px-5 py-3.5">Booking</th>
                        <th className="px-5 py-3.5">Guest</th>
                        <th className="px-5 py-3.5 text-right">Room Rate</th>
                        <th className="px-5 py-3.5 text-right">CGST ({auditDetailsCgstPercent}%)</th>
                        <th className="px-5 py-3.5 text-right">SGST ({auditDetailsSgstPercent}%)</th>
                        <th className="px-5 py-3.5 text-right">Total Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {auditDetails.charges.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-5 py-3 font-bold text-gray-900">Room {c.room.roomNumber}</td>
                          <td className="px-5 py-3 text-gray-500">{c.booking.bookingNumber}</td>
                          <td className="px-5 py-3 text-gray-900">{c.booking.guest.name}</td>
                          <td className="px-5 py-3 text-right">₹{Number(c.roomRate).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3 text-right text-gray-500">₹{Number(c.cgst).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3 text-right text-gray-500">₹{Number(c.sgst).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3 text-right font-bold text-primary-600">₹{Number(c.totalCharge).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {auditDetails.charges.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-gray-400 font-bold uppercase text-xs tracking-widest">
                            No room charges posted during this audit session
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit Restaurant Sales Ledger */}
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                  <Utensils size={20} className="text-gray-400" /> Restaurant POS Sales ({auditDetails.orders?.length || 0})
                </h3>

                <div className="border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-200 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                        <th className="px-5 py-3.5">Order Number</th>
                        <th className="px-5 py-3.5">Type</th>
                        <th className="px-5 py-3.5">Room</th>
                        <th className="px-5 py-3.5">Guest</th>
                        <th className="px-5 py-3.5 text-right">Total Amount</th>
                        <th className="px-5 py-3.5 text-center">Billing Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {auditDetails.orders?.map((o: AuditOrderDetail) => (
                        <tr key={o.id} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-5 py-3 font-bold text-gray-900">{o.orderNumber}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${o.orderType === 'ROOM'
                              ? 'bg-blue-50 text-blue-700'
                              : o.orderType === 'WALK_IN'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-orange-50 text-orange-700'
                              }`}>
                              {o.orderType}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500">{o.roomNumber ? `Room ${o.roomNumber}` : '—'}</td>
                          <td className="px-5 py-3 text-gray-900">{o.guestName || '—'}</td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">₹{Number(o.totalAmount).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${o.billingStatus === 'CHARGED_TO_ROOM'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                              }`}>
                              {o.billingStatus === 'CHARGED_TO_ROOM' ? 'Folio Charged' : 'Paid Direct'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!auditDetails.orders || auditDetails.orders.length === 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-gray-400 font-bold uppercase text-xs tracking-widest">
                            No restaurant orders completed during this audit session
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : loadingHistory ? (
            <div className="space-y-4 animate-pulse">
              {/* Date Filter Bar */}
              <div className="bg-white border border-gray-150 rounded-[20px] p-4 flex justify-between items-center">
                <div className="h-4 w-48 bg-gray-250 rounded-md" />
                <div className="h-9 w-40 bg-gray-200 rounded-xl" />
              </div>

              {/* History Table View Card */}
              <div className="card overflow-hidden border border-gray-150">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-20" /></th>
                      <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                      <th className="px-5 py-3"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                      <th className="px-5 py-3 text-right"><div className="h-3 bg-gray-200 rounded-md w-24 ml-auto" /></th>
                      <th className="px-5 py-3 text-right"><div className="h-3 bg-gray-200 rounded-md w-24 ml-auto" /></th>
                      <th className="px-5 py-3 text-right"><div className="h-3 bg-gray-200 rounded-md w-20 ml-auto" /></th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.from({ length: 5 }).map((_, rIdx) => (
                      <tr key={rIdx} className="h-16">
                        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-24" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-28" /></td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="h-4 bg-gray-200 rounded-md w-20" />
                            <div className="h-2.5 bg-gray-150 rounded-sm w-12" />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right"><div className="h-4 bg-gray-200 rounded-md w-20 ml-auto" /></td>
                        <td className="px-5 py-4 text-right"><div className="h-4 bg-gray-200 rounded-md w-20 ml-auto" /></td>
                        <td className="px-5 py-4 text-right"><div className="h-4 bg-gray-200 rounded-md w-16 ml-auto" /></td>
                        <td className="px-5 py-4 flex justify-center items-center h-16"><div className="h-8 w-24 bg-gray-100 rounded-lg" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Filter Bar */}
              <div className="bg-white border border-gray-200 rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm shadow-gray-100/50">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">Filter History by Business Date</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="input py-1.5 px-3 text-sm rounded-xl border border-gray-200"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate('')}
                      className="btn btn-ghost btn-sm font-bold text-red-500 hover:text-red-700"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>

              {/* History Table View */}
              <div className="card overflow-hidden border border-gray-200 shadow-xl shadow-gray-100/50 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="text-left px-5 py-3.5">Business Date</th>
                      <th className="text-left px-5 py-3.5">Closed At</th>
                      <th className="text-left px-5 py-3.5">Auditor</th>
                      <th className="text-right px-5 py-3.5">Total Revenue</th>
                      <th className="text-right px-5 py-3.5">Cash Collected</th>
                      <th className="text-right px-5 py-3.5">UPI / Card</th>
                      <th className="text-center px-5 py-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700 whitespace-nowrap">
                    {filteredHistory.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900">
                          {format(new Date(item.businessDate), 'dd MMM yyyy')}
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          {item.completedAt ? format(new Date(item.completedAt), 'dd MMM, hh:mm a') : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-gray-900 leading-none">{item.runBy.name}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1 inline-block">
                            {item.runBy.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-primary-600">
                          ₹{Number(item.totalRevenue).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-right text-gray-900">
                          ₹{Number(item.cashCollected).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-right text-gray-500">
                          ₹{(Number(item.upiCollected) + Number(item.cardCollected)).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => viewAuditDetails(item.id)}
                            className="btn btn-ghost btn-sm font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 mx-auto"
                          >
                            <Eye size={15} /> View details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-20 text-gray-400 font-bold uppercase text-xs tracking-widest">
                          {filterDate ? 'No audit session found for the selected date' : 'No night audit history sessions found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── CUSTOM SECURE CONFIRMATION OVERLAY MODAL ─── */}
      {showConfirmModal && preCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full mx-4 border border-gray-100 shadow-2xl animate-scaleIn">
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2 mb-4">
              <Lock className="text-primary-600" size={24} /> Confirm Day-End Close
            </h3>

            <div className="space-y-4">
              {/* Early Closure Warning / Time Guard Check */}
              {isTimeLockActive ? (
                isAdmin ? (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex gap-3 text-yellow-800 text-xs font-semibold">
                    <AlertTriangle size={18} className="shrink-0 text-yellow-600 animate-bounce" />
                    <div>
                      <p className="font-bold text-yellow-950">⚠️ Early Close Warning</p>
                      <p className="mt-0.5 leading-relaxed opacity-90">
                        It is currently before 10:00 PM. As an Administrator, you possess privilege to bypass this lock and execute this audit early.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 text-red-800 text-xs font-semibold">
                    <AlertTriangle size={18} className="shrink-0 text-red-600" />
                    <div>
                      <p className="font-bold text-red-950">❌ Execution Blocked</p>
                      <p className="mt-0.5 leading-relaxed opacity-90">
                        Early Day-End Lock is active. Receptionist staff can only execute the Night Audit after 10:00 PM (22:00) local time. Please contact an Administrator to proceed.
                      </p>
                    </div>
                  </div>
                )
              ) : null}

              {/* Warnings details */}
              {preCheck.openOrdersCount > 0 ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 text-red-800 text-xs font-semibold">
                  <AlertTriangle size={18} className="shrink-0 text-red-600" />
                  <div>
                    <p className="font-bold text-red-950">⚠️ Unbilled Restaurant Orders</p>
                    <p className="mt-0.5 leading-relaxed opacity-90">
                      There are {preCheck.openOrdersCount} open POS bills that have not been completed. Running the day close will roll the system without closing them.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium text-gray-500 leading-relaxed">
                  You are finalizing the business ledger for <span className="font-bold text-gray-900">{preCheck.businessDate}</span>. Room rates will be posted, and the system calendar will advance.
                </p>
              )}

              {/* Interactive confirmation checks if time is past 10PM or user is Admin */}
              {(!isTimeLockActive || isAdmin) && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Confirming User:
                    </label>
                    <div className="input rounded-xl text-sm font-bold bg-gray-50 text-gray-500 border border-gray-200/60 px-4 py-2.5 select-none cursor-not-allowed">
                      {user?.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Your Account Password:
                    </label>
                    <input
                      type="password"
                      className="input rounded-xl text-sm"
                      placeholder="Enter account password"
                      value={verifyPassword}
                      onChange={e => setVerifyPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="btn btn-outline flex-1 rounded-xl font-bold py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={
                    runningAudit ||
                    (isTimeLockActive && !isAdmin) ||
                    !verifyPassword
                  }
                  className="btn btn-primary flex-1 rounded-xl font-bold py-2.5 flex items-center justify-center gap-1.5"
                >
                  {runningAudit ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Running...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirm Close
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// 