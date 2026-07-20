import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { banquetsApi } from '../api';
import type { BanquetBooking } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useDialog } from '../contexts/DialogContext';
import { ArrowLeft, Wine, Users, Calendar, CheckCircle, XCircle, CreditCard, IndianRupee, Clock, FileText, X } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  PROVISIONAL: 'bg-amber-50 text-amber-700 border border-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  COMPLETED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CANCELLED: 'bg-red-50 text-red-600 border border-red-200',
};

const SLOT_LABELS: Record<string, { label: string; icon: string }> = {
  MORNING: { label: 'Morning (Breakfast)', icon: '🌅' },
  AFTERNOON: { label: 'Afternoon (Lunch)', icon: '☀️' },
  EVENING: { label: 'Evening (Dinner)', icon: '🌙' },
  CUSTOM: { label: 'Custom Hours', icon: '🕐' },
};

const FOOD_PREF_LABELS: Record<string, string> = {
  VEG: '🥬 Pure Vegetarian',
  NON_VEG: '🍗 Non-Vegetarian',
  BOTH: '🍽️ Veg & Non-Veg (Both)',
  NONE: '❌ No Catering',
};

const PAYMENT_TYPE_STYLES: Record<string, string> = {
  ADVANCE: 'text-primary-600 font-semibold',
  SETTLEMENT: 'text-emerald-700 font-semibold',
  REFUND: 'text-red-600 font-semibold',
};

export default function BanquetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, prompt } = useDialog();
  const [booking, setBooking] = useState<BanquetBooking | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState<number | string>('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [payType, setPayType] = useState<'ADVANCE' | 'SETTLEMENT' | 'REFUND'>('SETTLEMENT');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => { loadBooking(); }, [id]);

  async function loadBooking() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await banquetsApi.getBookingById(id);
      setBooking(res.data);
    } catch {
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    const isConfirmed = await confirm({
      title: 'Confirm Booking',
      message: 'Confirm this event booking? A deposit receipt should be collected.',
      confirmText: 'Confirm Event',
      variant: 'primary'
    });
    if (!isConfirmed) return;
    try {
      await banquetsApi.confirmBooking(id!);
      toast.success('Event booking confirmed!');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to confirm booking'); }
  }

  async function handleComplete() {
    const isConfirmed = await confirm({
      title: 'Complete Event',
      message: 'Mark this event as completed? This finalises the folio.',
      confirmText: 'Complete Event',
      variant: 'primary'
    });
    if (!isConfirmed) return;
    try {
      await banquetsApi.completeBooking(id!);
      toast.success('Event marked as completed');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to complete event'); }
  }

  async function handleCancel() {
    const reason = await prompt({
      title: 'Cancel Event Booking',
      message: 'Please provide a reason for cancelling this event.',
      placeholder: 'Cancellation reason (optional)',
      confirmText: 'Cancel Event',
      variant: 'danger'
    });
    if (reason === null) return;
    try {
      await banquetsApi.cancelBooking(id!, reason || undefined);
      toast.success('Event booking cancelled');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to cancel booking'); }
  }

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setPayLoading(true);
    try {
      await banquetsApi.recordPayment(id!, {
        amount: Number(payAmount),
        method: payMethod,
        type: payType,
        reference: payRef || null,
        notes: payNotes || null,
      });
      toast.success('Payment recorded successfully');
      setShowPayment(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      loadBooking();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-1 max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="h-9 w-24 bg-gray-200 rounded-lg" />

        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-44 bg-gray-200 rounded-lg" />
              <div className="h-5 w-24 bg-gray-250 rounded-full" />
            </div>
            <div className="h-4 w-72 bg-gray-150 rounded-md" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>

        {/* 2 columns layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-5 border border-gray-150/60 space-y-4">
              <div className="h-5 w-32 bg-gray-200 rounded-md pb-2 border-b border-gray-100" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 bg-gray-150 rounded-sm" />
                    <div className="h-4 w-28 bg-gray-200 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 border border-gray-150/60 space-y-4">
              <div className="h-5 w-28 bg-gray-200 rounded-md pb-2 border-b border-gray-100" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-20 bg-gray-150 rounded-sm" />
                    <div className="h-4 w-32 bg-gray-200 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Invoice) */}
          <div className="card p-5 border border-gray-150/60 space-y-4">
            <div className="h-5 w-20 bg-gray-200 rounded-md pb-2 border-b border-gray-100" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 bg-gray-150 rounded-md" />
                  <div className="h-4 w-16 bg-gray-200 rounded-md" />
                </div>
              ))}
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <div className="h-5 w-16 bg-gray-200 rounded-md" />
                <div className="h-5 w-20 bg-gray-200 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Booking not found.</p>
        <button onClick={() => navigate('/banquets')} className="btn btn-primary mt-4">Back to Banquets</button>
      </div>
    );
  }

  const slotInfo = SLOT_LABELS[booking.slot];
  const isActive = booking.status === 'PROVISIONAL' || booking.status === 'CONFIRMED';

  const cgstPercent = booking && Number(booking.subtotal) > 0 && Number(booking.cgst) > 0
    ? Math.round((Number(booking.cgst) / Number(booking.subtotal)) * 100 * 10) / 10
    : 2.5;
  const sgstPercent = booking && Number(booking.subtotal) > 0 && Number(booking.sgst) > 0
    ? Math.round((Number(booking.sgst) / Number(booking.subtotal)) * 100 * 10) / 10
    : 2.5;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/banquets')} className="btn btn-ghost btn-sm gap-1 print:hidden">
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="font-mono text-lg font-bold text-primary-600">{booking.bookingNumber}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[booking.status]}`}>
                {booking.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{booking.hall.name} · {booking.eventType}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto print:hidden">
          {booking.status === 'PROVISIONAL' && (
            <button onClick={handleConfirm} className="btn btn-primary btn-sm gap-1 flex-1 sm:flex-none justify-center">
              <CheckCircle size={15} /> Confirm
            </button>
          )}
          {booking.status === 'CONFIRMED' && (
            <button onClick={handleComplete} className="btn btn-outline btn-sm gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 flex-1 sm:flex-none justify-center">
              <CheckCircle size={15} /> Complete
            </button>
          )}
          {isActive && (
            <button onClick={() => { setPayAmount(Number(booking.pendingAmount)); setShowPayment(true); }} className="btn btn-outline btn-sm gap-1 flex-1 sm:flex-none justify-center">
              <CreditCard size={15} /> Payment
            </button>
          )}
          <button onClick={handlePrint} className="btn btn-outline btn-sm gap-1 flex-1 sm:flex-none justify-center">
            <FileText size={15} /> Print Invoice
          </button>
          {isActive && (
            <button onClick={handleCancel} className="btn btn-outline btn-sm gap-1 text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-none justify-center">
              <XCircle size={15} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Guest Info */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={16} className="text-primary-600" /> Organiser / Guest
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400 text-xs block">Name</span><p className="font-semibold">{booking.guest.name}</p></div>
              <div><span className="text-gray-400 text-xs block">Phone</span><p className="font-semibold">{booking.guest.phone}</p></div>
              {booking.guest.email && <div><span className="text-gray-400 text-xs block">Email</span><p className="font-semibold">{booking.guest.email}</p></div>}
              <div><span className="text-gray-400 text-xs block">Visit Count</span><p className="font-semibold">{booking.guest.visitCount} bookings</p></div>
            </div>
          </div>

          {/* Event Info */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-primary-600" /> Event Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400 text-xs block">Hall</span><p className="font-semibold">{booking.hall.name}</p></div>
              <div><span className="text-gray-400 text-xs block">Event Type</span><p className="font-semibold">{booking.eventType}</p></div>
              <div>
                <span className="text-gray-400 text-xs block">Event Date</span>
                <p className="font-semibold">{format(new Date(booking.eventDate), 'dd MMMM yyyy')}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Session</span>
                <p className="font-semibold">{slotInfo.icon} {slotInfo.label}</p>
                {booking.slot === 'CUSTOM' && booking.startTime && booking.endTime && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock size={11} />
                    {format(new Date(booking.startTime), 'hh:mm a')} – {format(new Date(booking.endTime), 'hh:mm a')}
                  </p>
                )}
              </div>
              <div><span className="text-gray-400 text-xs block">Guest Count</span><p className="font-semibold">{booking.estimatedPax} guests</p></div>
              <div><span className="text-gray-400 text-xs block">Hall Capacity</span><p className="font-semibold">{booking.hall.maxCapacity} guests</p></div>
              <div>
                <span className="text-gray-400 text-xs block">Food Preference</span>
                <p className="font-semibold">{FOOD_PREF_LABELS[booking.foodPreference] || booking.foodPreference}</p>
              </div>
              {booking.notes && (
                <div className="col-span-2"><span className="text-gray-400 text-xs block">Notes</span><p className="font-semibold text-gray-700">{booking.notes}</p></div>
              )}
            </div>
          </div>

          {/* Payment Ledger */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Ledger</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b whitespace-nowrap">
                      <th className="text-left pb-2">Date</th>
                      <th className="text-left pb-2">Type</th>
                      <th className="text-left pb-2">Method</th>
                      <th className="text-left pb-2">Reference</th>
                      <th className="text-right pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="whitespace-nowrap">
                    {booking.payments.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2.5 text-gray-600">{format(new Date(p.createdAt), 'dd MMM, hh:mm a')}</td>
                        <td className={`py-2.5 ${PAYMENT_TYPE_STYLES[p.type]}`}>{p.type}</td>
                        <td className="py-2.5 text-gray-600">{p.method}</td>
                        <td className="py-2.5 text-gray-500">{p.reference || '—'}</td>
                        <td className={`py-2.5 text-right font-bold ${p.type === 'REFUND' ? 'text-red-600' : 'text-gray-900'}`}>
                          {p.type === 'REFUND' ? '−' : '+'}₹{Number(p.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: Invoice */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <IndianRupee size={16} className="text-primary-600" /> Invoice
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Hall Rental</span>
                <span>₹{Number(booking.hallRentalPrice).toLocaleString()}</span>
              </div>
              {Number(booking.perHeadFoodPrice) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Food (₹{Number(booking.perHeadFoodPrice).toLocaleString()}/head × {booking.estimatedPax})</span>
                  <span>₹{(Number(booking.perHeadFoodPrice) * booking.estimatedPax).toLocaleString()}</span>
                </div>
              )}
              {Number(booking.extraCharges) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Extra Charges</span>
                  <span>₹{Number(booking.extraCharges).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 border-t pt-2">
                <span>Subtotal</span>
                <span>₹{Number(booking.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>CGST ({cgstPercent}%)</span>
                <span>₹{Number(booking.cgst).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>SGST ({sgstPercent}%)</span>
                <span>₹{Number(booking.sgst).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2">
                <span>Total</span>
                <span>₹{Number(booking.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Paid (Advance)</span>
                <span>₹{Number(booking.advancePaid).toLocaleString()}</span>
              </div>
              <div className={`flex justify-between font-bold text-base ${Number(booking.pendingAmount) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                <span>Pending</span>
                <span>₹{Number(booking.pendingAmount).toLocaleString()}</span>
              </div>
            </div>

            {booking.status === 'CANCELLED' && booking.cancelReason && (
              <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-700">
                <p className="font-semibold">Cancellation Reason:</p>
                <p>{booking.cancelReason}</p>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="card p-4 text-xs text-gray-400 space-y-1.5">
            <p><span className="font-semibold text-gray-500">Created by:</span> {booking.createdBy?.name}</p>
            <p><span className="font-semibold text-gray-500">Created on:</span> {format(new Date(booking.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
        </div>
      </div>

      {/* Printable Invoice Section */}
      <div className="hidden print:block border-t mt-8 pt-8 text-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Event Invoice — {booking.bookingNumber}</h2>
        <p className="text-gray-500">{booking.hall.name} · {format(new Date(booking.eventDate), 'dd MMMM yyyy')} · {slotInfo.icon} {slotInfo.label}</p>
        <p className="mt-2"><strong>Organiser:</strong> {booking.guest.name} ({booking.guest.phone})</p>
        <p><strong>Event:</strong> {booking.eventType} for {booking.estimatedPax} guests</p>
        <p><strong>Catering:</strong> {FOOD_PREF_LABELS[booking.foodPreference] || booking.foodPreference}</p>
        <table className="w-full mt-6 border-collapse text-sm">
          <tbody>
            <tr className="border-b"><td className="py-1 text-gray-600">Hall Rental</td><td className="text-right">₹{Number(booking.hallRentalPrice).toLocaleString()}</td></tr>
            {Number(booking.perHeadFoodPrice) > 0 && <tr className="border-b"><td className="py-1 text-gray-600">Food & Catering</td><td className="text-right">₹{(Number(booking.perHeadFoodPrice) * booking.estimatedPax).toLocaleString()}</td></tr>}
            {Number(booking.extraCharges) > 0 && <tr className="border-b"><td className="py-1 text-gray-600">Extra Charges</td><td className="text-right">₹{Number(booking.extraCharges).toLocaleString()}</td></tr>}
            <tr className="border-b"><td className="py-1 text-gray-400">CGST ({cgstPercent}%)</td><td className="text-right text-gray-400">₹{Number(booking.cgst).toLocaleString()}</td></tr>
            <tr className="border-b"><td className="py-1 text-gray-400">SGST ({sgstPercent}%)</td><td className="text-right text-gray-400">₹{Number(booking.sgst).toLocaleString()}</td></tr>
            <tr className="border-b font-bold"><td className="py-2">Total Amount</td><td className="text-right">₹{Number(booking.totalAmount).toLocaleString()}</td></tr>
            <tr><td className="py-1 text-gray-600">Advance Paid</td><td className="text-right">₹{Number(booking.advancePaid).toLocaleString()}</td></tr>
            <tr className="font-bold"><td className="py-1">Balance Due</td><td className="text-right">₹{Number(booking.pendingAmount).toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div className="text-center text-xs text-gray-400 mt-12 pt-4 border-t">
          <p>Thank you for choosing Godiva Rooms!</p>
          <p>This is a computer-generated invoice.</p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Record Payment</h3>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (₹)</label>
                <input className="input" type="number" min="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Payment Type</label>
                  <select className="input" value={payType} onChange={e => setPayType(e.target.value as any)}>
                    <option value="ADVANCE">Advance Deposit</option>
                    <option value="SETTLEMENT">Final Settlement</option>
                    <option value="REFUND">Refund</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Method</label>
                  <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value as any)}>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Reference No</label>
                <input className="input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UPI Ref / Cheque No (optional)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                <textarea className="input" rows={2} value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Any note for this payment..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowPayment(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={payLoading}>
                  {payLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
