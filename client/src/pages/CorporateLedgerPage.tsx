import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { companiesApi, paymentsApi } from '../api';
import { 
  Building2, Plus, Search, DollarSign, Clock, CheckCircle2,
  CreditCard, Calendar, FileText, AlertTriangle, Printer, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface Company {
  id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  state: string;
  creditLimit: number;
  outstandingBalance: number;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

export default function CorporateLedgerPage() {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    address: '',
    state: 'Tamil Nadu',
    email: '',
    phone: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'UPI',
    referenceNo: '',
  });

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await companiesApi.getAll();
      setCompanies(res.data);
      if (selectedCompanyId) {
        fetchCompanyDetails(selectedCompanyId);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch corporate accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyDetails = async (id: string) => {
    try {
      const res = await companiesApi.getById(id);
      setSelectedCompany(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch company details');
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleSelectCompany = (id: string) => {
    setSelectedCompanyId(id);
    fetchCompanyDetails(id);
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await companiesApi.create({
        ...formData,
        creditLimit: 100000, // default placeholder
      });
      setSuccess('Corporate account registered successfully');
      setShowAddModal(false);
      setFormData({
        name: '',
        gstin: '',
        address: '',
        state: 'Tamil Nadu',
        email: '',
        phone: '',
      });
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create company');
    }
  };

  const handleOpenPaymentModal = (invoice: any) => {
    const unpaidAmount = Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid));
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: unpaidAmount.toString(),
      method: 'UPI',
      referenceNo: '',
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setError('');
    setSuccess('');
    try {
      await paymentsApi.create({
        bookingId: selectedInvoice.bookingId,
        amount: Number(paymentData.amount),
        method: paymentData.method,
        type: 'FULL',
        reference: paymentData.referenceNo,
        notes: 'Corporate Account Settlement',
      });
      setSuccess('Payment recorded and invoice settled successfully');
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      if (selectedCompanyId) {
        fetchCompanyDetails(selectedCompanyId);
      }
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record payment');
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  // Helper to determine invoice status
  const getInvoiceStatus = (booking: any) => {
    if (booking.status === 'CHECKED_IN') {
      return { label: 'In-House', color: 'bg-blue-50 text-blue-700 border-blue-150' };
    }
    const isPaid = Number(booking.invoice?.amountPaid) >= Number(booking.invoice?.grandTotal) - 1;
    if (isPaid) {
      return { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-150' };
    }
    return { label: 'Pending Payment', color: 'bg-amber-50 text-amber-700 border-amber-150' };
  };

  // Calculate stats for current selected company
  const getCompanyStats = () => {
    if (!selectedCompany || !selectedCompany.bookings) {
      return { totalBilled: 0, totalPending: 0, totalPaid: 0 };
    }
    let totalBilled = 0;
    let totalPending = 0;
    let totalPaid = 0;

    selectedCompany.bookings.forEach((b: any) => {
      if (!b.invoice) return;
      const billed = Number(b.invoice.companyAmount);
      const isPaid = Number(b.invoice.amountPaid) >= Number(b.invoice.grandTotal) - 1;
      
      totalBilled += billed;
      if (b.status === 'CHECKED_OUT') {
        if (isPaid) {
          totalPaid += billed;
        } else {
          totalPending += billed;
        }
      }
    });

    return { totalBilled, totalPending, totalPaid };
  };

  const stats = getCompanyStats();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="text-primary-600" size={32} /> Corporate Accounts
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Manage billing, print invoices, and settle post-checkout payments for corporate clients.</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 justify-center px-5 py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-100 hover:shadow-lg transition-all w-full md:w-auto"
          >
            <Plus size={18} /> Add Company
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Company Directory */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-150 shadow-sm flex flex-col overflow-hidden h-[300px] lg:h-[650px]">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-900 text-lg">Companies Directory</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or GSTIN..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border.5 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="space-y-4 p-4 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50">
                    <div className="space-y-2 flex-1 pr-4">
                      <div className="h-4 bg-gray-200 rounded-md w-32" />
                      <div className="h-3.5 bg-gray-150 rounded-md w-24" />
                      <div className="h-3 bg-gray-100 rounded-md w-20" />
                    </div>
                    <div className="h-8 w-8 bg-gray-100 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No corporate accounts found.</div>
            ) : (
              filteredCompanies.map(comp => {
                const isSelected = selectedCompanyId === comp.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => handleSelectCompany(comp.id)}
                    className={`p-4 cursor-pointer transition-all duration-150 flex items-center justify-between border-l-4 ${
                      isSelected 
                        ? 'bg-primary-50/50 border-primary-600' 
                        : 'hover:bg-gray-50/50 border-transparent'
                    }`}
                  >
                    <div className="space-y-1 pr-2 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{comp.name}</p>
                      <p className="text-xs text-gray-400 font-medium">GSTIN: {comp.gstin || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{comp.phone || 'No phone'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Building2 className={`opacity-40 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} size={20} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Corporate Invoice Settlement */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-150 shadow-sm flex flex-col h-[550px] lg:h-[650px] overflow-hidden">
          {!selectedCompany ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <Building2 size={48} className="text-gray-300 mb-2" />
              <p className="font-semibold text-lg text-gray-600">No Company Selected</p>
              <p className="text-sm max-w-sm mt-1">Select a company from the directory to review, print, and settle outstanding corporate invoices.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Company Header */}
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                    <span>GSTIN: <strong className="text-gray-700">{selectedCompany.gstin || 'N/A'}</strong></span>
                    <span>State: <strong className="text-gray-700">{selectedCompany.state}</strong></span>
                    {selectedCompany.email && <span>Email: <strong className="text-gray-700">{selectedCompany.email}</strong></span>}
                    {selectedCompany.phone && <span>Phone: <strong className="text-gray-700">{selectedCompany.phone}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Stats Cards for Company */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0 overflow-y-auto sm:overflow-visible max-h-[160px] sm:max-h-none">
                <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-xs flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                    <FileText size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Invoiced</span>
                    <p className="text-md font-bold text-gray-800">₹{stats.totalBilled.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-xs flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pending Due</span>
                    <p className="text-md font-bold text-amber-700">₹{stats.totalPending.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-xs flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Settled</span>
                    <p className="text-md font-bold text-emerald-700">₹{stats.totalPaid.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {/* Invoices List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-1.5 text-sm uppercase tracking-wider text-gray-400">
                  Linked Corporate Invoices
                </h4>
                
                {selectedCompany.bookings?.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed border-gray-150 rounded-2xl">
                    <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-semibold">No Invoices Registered</p>
                    <p className="text-xs text-gray-400 mt-0.5">Stay bills will show up here once checked in under this corporate contract.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCompany.bookings?.map((b: any) => {
                      if (!b.invoice) return null;
                      const status = getInvoiceStatus(b);
                      const isSettled = status.label === 'Paid' || status.label === 'In-House';

                      return (
                        <div key={b.id} className="p-4 bg-white rounded-xl border border-gray-150 shadow-xs hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-800 text-sm">{b.invoice.invoiceNumber}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(b.checkInDate).toLocaleDateString('en-IN')} - {new Date(b.expectedCheckout).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">
                              Guest: <strong className="text-gray-700">{b.guest?.name}</strong> • Room: <strong className="text-gray-700">{b.room?.roomNumber} ({b.room?.roomType?.name})</strong>
                            </p>
                            <div className="flex gap-4 text-xs text-gray-400">
                              <span>Total Bill: <strong className="text-gray-700">₹{Number(b.invoice.grandTotal).toLocaleString('en-IN')}</strong></span>
                              <span>Company Portion: <strong className="text-primary-700">₹{Number(b.invoice.companyAmount).toLocaleString('en-IN')}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <Link
                              to={`/bookings/${b.id}`}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 transition-colors"
                            >
                              <Printer size={13} /> Print/View
                            </Link>
                            {!isSettled && (
                              <button
                                onClick={() => handleOpenPaymentModal(b.invoice)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                              >
                                <CreditCard size={13} /> Settle Bill
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: REGISTER NEW COMPANY */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="text-primary-600" size={22} /> Add Corporate Account
              </h3>
            </div>
            <form onSubmit={handleAddCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={e => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">State Registry</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Registered Address</label>
                <textarea
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-16 resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-md shadow-primary-50"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD COMPANY PAYMENT FOR INDIVIDUAL INVOICE */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="text-emerald-600" size={22} /> Settle Corporate Invoice
              </h3>
              <p className="text-xs text-gray-400 mt-1">Record payment details to mark corporate invoice <strong>{selectedInvoice.invoiceNumber}</strong> as paid.</p>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={paymentData.amount}
                  onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Channel *</label>
                <select
                  value={paymentData.method}
                  onChange={e => setPaymentData({ ...paymentData, method: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="UPI">Bank Transfer / UPI</option>
                  <option value="CARD">Corporate Card</option>
                  <option value="CASH">Cash Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transaction Ref. No (NEFT/RTGS/UPI) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TXN10293847"
                  value={paymentData.referenceNo}
                  onChange={e => setPaymentData({ ...paymentData, referenceNo: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-50"
                >
                  Confirm Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
