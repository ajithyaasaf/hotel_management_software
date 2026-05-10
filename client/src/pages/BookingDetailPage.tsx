import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingsApi, invoicesApi, paymentsApi, roomsApi } from '../api';
import type { Booking, Invoice, Room } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRightLeft, CalendarPlus, LogOut as CheckOutIcon, CreditCard, Receipt, X, Ban } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);

  // Transfer state
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [transferRoom, setTransferRoom] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Payment state
  const [payAmount, setPayAmount] = useState<number | string>(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [payType, setPayType] = useState<'PARTIAL' | 'FULL'>('FULL');
  const [payNotes, setPayNotes] = useState('');
  const [payRef, setPayRef] = useState('');

  // Extend state
  const [newCheckout, setNewCheckout] = useState('');

  // Adjustment state
  const [adjType, setAdjType] = useState<'DISCOUNT_FLAT' | 'DISCOUNT_PERCENT' | 'EXTRA_CHARGE'>('DISCOUNT_FLAT');
  const [adjAmount, setAdjAmount] = useState<number | string>(0);
  const [adjReason, setAdjReason] = useState('');

  useEffect(() => { loadBooking(); }, [id]);

  async function loadBooking() {
    if (!id) return;
    try {
      const [bRes, iRes] = await Promise.all([
        bookingsApi.getById(id),
        invoicesApi.getByBooking(id).catch(() => null),
      ]);
      setBooking(bRes.data);
      if (iRes) setInvoice(iRes.data);
    } catch { toast.error('Failed to load booking'); }
    finally { setLoading(false); }
  }

  async function handleCheckout() {
    if (Number(invoice?.pendingAmount) > 0) {
      if (!confirm(`Warning: Guest still has a pending balance of ₹${invoice?.pendingAmount}. Are you sure you want to checkout?`)) return;
    } else {
      if (!confirm('Confirm checkout? This will finalize the invoice.')) return;
    }
    try {
      await bookingsApi.checkout(id!);
      toast.success('Guest checked out successfully');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Checkout failed'); }
  }

  async function handleAdvanceCheckin() {
    try {
      await bookingsApi.checkin(id!);
      toast.success('Guest checked in successfully');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Check-in failed'); }
  }

  async function handleNoShow() {
    if (!confirm('Mark guest as No Show? This will release the room reservation.')) return;
    try {
      await bookingsApi.noShow(id!);
      toast.success('Marked as No Show');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function handleCancel() {
    const reason = prompt('Cancellation reason (optional):');
    if (reason === null) return;
    try {
      await bookingsApi.cancel(id!, reason);
      toast.success('Booking cancelled');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Cancellation failed'); }
  }

  async function handlePayment() {
    if (payAmount <= 0) { toast.error('Enter valid amount'); return; }
    try {
      await paymentsApi.create({ bookingId: id, amount: Number(payAmount), method: payMethod, type: payType, notes: payNotes, reference: payRef });
      toast.success('Payment recorded');
      setShowPayment(false);
      setPayNotes('');
      setPayRef('');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Payment failed'); }
  }

  async function handleTransfer() {
    if (!transferRoom) { toast.error('Select a room'); return; }
    try {
      await bookingsApi.transfer(id!, { toRoomId: transferRoom, reason: transferReason });
      toast.success('Room transfer successful');
      setShowTransfer(false);
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Transfer failed'); }
  }

  async function handleExtend() {
    if (!newCheckout) { toast.error('Select new checkout date'); return; }
    try {
      await bookingsApi.extend(id!, { newCheckout: new Date(newCheckout).toISOString() });
      toast.success('Stay extended');
      setShowExtend(false);
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Extension failed'); }
  }

  async function handleAdjustment() {
    if (adjAmount <= 0 || !adjReason) { toast.error('Fill all fields'); return; }
    try {
      await invoicesApi.addAdjustment(invoice!.id, { type: adjType, amount: Number(adjAmount), reason: adjReason });
      toast.success('Adjustment added');
      setShowAdjustment(false);
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function openTransferModal() {
    const { data } = await roomsApi.getAvailable();
    setAvailableRooms(data);
    setShowTransfer(true);
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>;
  if (!booking) return <p className="text-gray-500">Booking not found</p>;

  const isActive = booking.status === 'CHECKED_IN';

  return (
    <div className="animate-fadeIn max-w-5xl">
      <button onClick={() => navigate('/bookings')} className="btn btn-ghost mb-4"><ArrowLeft size={18} /> Bookings</button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {booking.bookingNumber}
            <span className={`badge ${booking.status === 'CHECKED_IN' ? 'badge-green' : booking.status === 'CHECKED_OUT' ? 'badge-gray' : 'badge-red'}`}>{booking.status.replace('_', ' ')}</span>
          </h1>
          <p className="text-gray-500 mt-1">Room {booking.room.roomNumber} · {booking.room.roomType.name}</p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <button onClick={() => setShowExtend(true)} className="btn btn-outline btn-sm"><CalendarPlus size={16} /> Extend</button>
            <button onClick={openTransferModal} className="btn btn-outline btn-sm"><ArrowRightLeft size={16} /> Transfer</button>
            <button onClick={() => { setPayAmount(Number(invoice?.pendingAmount || 0)); setShowPayment(true); }} className="btn btn-outline btn-sm"><CreditCard size={16} /> Payment</button>
            <button onClick={handleCheckout} className="btn btn-danger btn-sm"><CheckOutIcon size={16} /> Checkout</button>
          </div>
        )}
        {booking.status === 'CONFIRMED' && (
          <div className="flex gap-2">
            <button onClick={() => { setPayAmount(Number(invoice?.pendingAmount || 0)); setShowPayment(true); }} className="btn btn-outline btn-sm"><CreditCard size={16} /> Advance Payment</button>
            <button onClick={handleCancel} className="btn btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50"><Ban size={16} /> Cancel</button>
            <button onClick={handleNoShow} className="btn btn-outline btn-sm text-amber-600 border-amber-200 hover:bg-amber-50">No Show</button>
            <button onClick={handleAdvanceCheckin} className="btn btn-primary btn-sm"><CheckOutIcon size={16} className="transform rotate-180" /> Check In Now</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Guest + Stay Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Guest Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Name</span><p className="font-medium">{booking.guest.name}</p></div>
              <div><span className="text-gray-400">Phone</span><p className="font-medium">{booking.guest.phone}</p></div>
              <div><span className="text-gray-400">ID Proof</span><p className="font-medium">{booking.guest.idProofType} — {booking.guest.idProofNumber || 'N/A'}</p></div>
              <div><span className="text-gray-400">Visit Count</span><p className="font-medium">{booking.guest.visitCount}</p></div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Stay Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Check-in</span><p className="font-medium">{format(new Date(booking.checkInDate), 'dd MMM yyyy')}</p></div>
              <div><span className="text-gray-400">Expected Checkout</span><p className="font-medium">{format(new Date(booking.expectedCheckout), 'dd MMM yyyy')}</p></div>
              <div><span className="text-gray-400">Room Rate</span><p className="font-medium">₹{Number(booking.roomPrice).toLocaleString()}/night</p></div>
              <div><span className="text-gray-400">Guests</span><p className="font-medium">{booking.numberOfGuests}</p></div>
            </div>
            {booking.transfers && booking.transfers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Room Transfers</h4>
                {booking.transfers.map(t => (
                  <p key={t.id} className="text-sm text-gray-500">
                    {t.fromRoom.roomNumber} → {t.toRoom.roomNumber} — {format(new Date(t.transferredAt), 'dd MMM, hh:mm a')}
                    {t.reason && ` (${t.reason})`}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Payment History</h3>
              <div className="space-y-2">
                {booking.payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50">
                    <div>
                      <span className={`badge ${p.type === 'REFUND' ? 'badge-red' : 'badge-green'} mr-2`}>{p.type}</span>
                      <span className="text-gray-500">{p.method}</span>
                      {p.reference && <span className="text-xs text-gray-400 ml-2">Ref: {p.reference}</span>}
                      {p.notes && <p className="text-xs text-gray-500 mt-1 italic">{p.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{p.type === 'REFUND' ? '-' : ''}₹{Number(p.amount).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{format(new Date(p.createdAt), 'dd MMM, hh:mm a')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Invoice Sidebar */}
        <div>
          {invoice ? (
            <div className="card p-5 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900"><Receipt size={16} className="inline mr-1" /> Invoice</h3>
                <span className="text-xs font-mono text-gray-400">{invoice.invoiceNumber}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Room Charges</span><span>₹{Number(invoice.roomCharges).toLocaleString()}</span></div>
                {Number(invoice.foodCharges) > 0 && <div className="flex justify-between"><span className="text-gray-500">Food & Beverages</span><span>₹{Number(invoice.foodCharges).toLocaleString()}</span></div>}
                {Number(invoice.extraCharges) > 0 && <div className="flex justify-between"><span className="text-gray-500">Extra Charges</span><span>₹{Number(invoice.extraCharges).toLocaleString()}</span></div>}
                {Number(invoice.discountAmount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-₹{Number(invoice.discountAmount).toLocaleString()}</span></div>}
                <div className="border-t border-gray-100 pt-2 flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{Number(invoice.subtotal).toLocaleString()}</span></div>
                {Number(invoice.cgst) > 0 && <div className="flex justify-between text-gray-400 text-xs"><span>CGST (6%)</span><span>₹{Number(invoice.cgst).toLocaleString()}</span></div>}
                {Number(invoice.sgst) > 0 && <div className="flex justify-between text-gray-400 text-xs"><span>SGST (6%)</span><span>₹{Number(invoice.sgst).toLocaleString()}</span></div>}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg"><span>Total</span><span>₹{Number(invoice.grandTotal).toLocaleString()}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Paid</span><span>₹{Number(invoice.amountPaid).toLocaleString()}</span></div>
                {Number(invoice.pendingAmount) > 0 && <div className="flex justify-between text-red-600 font-semibold"><span>Pending</span><span>₹{Number(invoice.pendingAmount).toLocaleString()}</span></div>}
              </div>

              {invoice.adjustments && invoice.adjustments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Adjustments History</h4>
                  <div className="space-y-2">
                    {invoice.adjustments.map(adj => (
                      <div key={adj.id} className="text-xs flex justify-between">
                        <div>
                          <span className={adj.type === 'EXTRA_CHARGE' ? 'text-amber-600' : 'text-emerald-600'}>{adj.type.replace('_', ' ')}</span>
                          <p className="text-gray-400 truncate max-w-[150px]">{adj.reason}</p>
                        </div>
                        <span className="font-medium">
                          {adj.type === 'EXTRA_CHARGE' ? '+' : '-'}₹{Number(adj.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {isActive && (
                  <button onClick={() => setShowAdjustment(true)} className="btn btn-outline btn-sm flex-1">Adjustment</button>
                )}
                <button onClick={() => window.print()} className="btn btn-primary btn-sm flex-1">Print PDF</button>
              </div>
            </div>
          ) : (
            <div className="card p-5 text-center text-gray-400">No invoice generated yet</div>
          )}
        </div>
      </div>

      {/* Hidden Print Layout */}
      <div className="hidden print:block bg-white p-8 absolute top-0 left-0 w-full min-h-screen z-50">
        <div className="flex justify-between items-start mb-8 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Godiva Rooms</h1>
            <p className="text-sm text-gray-500 mt-1">Tax Invoice / Bill of Supply</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-900">INVOICE</h2>
            <p className="text-sm text-gray-500">{invoice?.invoiceNumber}</p>
            <p className="text-sm text-gray-500">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Guest Details</h3>
            <p className="font-medium text-gray-800">{booking.guest.name}</p>
            <p className="text-gray-600 text-sm">Phone: {booking.guest.phone}</p>
            {booking.guest.email && <p className="text-gray-600 text-sm">Email: {booking.guest.email}</p>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2">Stay Details</h3>
            <p className="text-gray-600 text-sm">Room: <span className="font-medium">{booking.room.roomNumber}</span> ({booking.room.roomType.name})</p>
            <p className="text-gray-600 text-sm">Check-in: <span className="font-medium">{format(new Date(booking.checkInDate), 'dd MMM yyyy')}</span></p>
            <p className="text-gray-600 text-sm">Check-out: <span className="font-medium">{format(new Date(booking.actualCheckout || booking.expectedCheckout), 'dd MMM yyyy')}</span></p>
            <p className="text-gray-600 text-sm">Guests: {booking.numberOfGuests}</p>
          </div>
        </div>

        {invoice && (
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-2 text-left">Description</th>
                <th className="py-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-3">Room Charges ({Math.max(1, Math.ceil((new Date(booking.actualCheckout || booking.expectedCheckout).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))} nights x ₹{booking.roomPrice})</td>
                <td className="py-3 text-right">{Number(invoice.roomCharges).toLocaleString()}</td>
              </tr>
              {invoice.roomOrders && invoice.roomOrders.length > 0 && invoice.roomOrders.map(order => (
                order.items.map(item => !item.isCancelled && (
                  <tr key={item.id} className="border-b border-gray-100 text-gray-700">
                    <td className="py-2 pl-4 text-xs">
                      Restaurant: {item.menuItem.name} x {item.quantity} 
                    </td>
                    <td className="py-2 text-right text-xs">{Number(item.totalPrice).toLocaleString()}</td>
                  </tr>
                ))
              ))}
              {invoice.adjustments && invoice.adjustments.map(adj => (
                <tr key={adj.id} className="border-b border-gray-100 text-gray-700">
                  <td className="py-2 pl-4 text-xs">
                    Adjustment ({adj.type.replace('_', ' ')}): {adj.reason}
                  </td>
                  <td className="py-2 text-right text-xs">
                    {adj.type === 'EXTRA_CHARGE' ? '' : '-'}{Number(adj.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-900 font-semibold mt-4">
                <td className="py-3">Subtotal</td>
                <td className="py-3 text-right">{Number(invoice.subtotal).toLocaleString()}</td>
              </tr>
              <tr className="text-gray-600">
                <td className="py-1">CGST (6%)</td>
                <td className="py-1 text-right">{Number(invoice.cgst).toLocaleString()}</td>
              </tr>
              <tr className="text-gray-600 border-b border-gray-200">
                <td className="py-1 pb-3">SGST (6%)</td>
                <td className="py-1 pb-3 text-right">{Number(invoice.sgst).toLocaleString()}</td>
              </tr>
              <tr className="font-bold text-lg">
                <td className="py-4">Grand Total</td>
                <td className="py-4 text-right">₹{Number(invoice.grandTotal).toLocaleString()}</td>
              </tr>
              <tr className="text-emerald-600">
                <td className="py-2">Amount Paid</td>
                <td className="py-2 text-right">₹{Number(invoice.amountPaid).toLocaleString()}</td>
              </tr>
              {Number(invoice.pendingAmount) > 0 && (
                <tr className="text-red-600 font-bold">
                  <td className="py-2">Pending Balance</td>
                  <td className="py-2 text-right">₹{Number(invoice.pendingAmount).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {booking.payments && booking.payments.length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-2 text-sm">Payment History</h3>
            <table className="w-full text-sm">
              <tbody>
                {booking.payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1">{format(new Date(p.createdAt), 'dd MMM yyyy')}</td>
                    <td className="py-1">{p.method}</td>
                    <td className="py-1">{p.type} {p.reference ? `(${p.reference})` : ''}</td>
                    <td className="py-1 text-right">₹{Number(p.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center text-xs text-gray-500 mt-12 pt-4 border-t">
          <p>Thank you for choosing Godiva Rooms!</p>
          <p>This is a computer-generated invoice.</p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <Modal onClose={() => setShowPayment(false)} title="Record Payment">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Amount (₹)</label><input className="input" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Method</label><select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value as any)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">Type</label><select className="input" value={payType} onChange={e => setPayType(e.target.value as any)}><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Reference No (Optional)</label><input className="input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Transaction ID, Cheque No, etc." /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Notes</label><textarea className="input" rows={2} value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Any specific reason or note for this payment..." /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowPayment(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={handlePayment}>Record Payment</button></div>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <Modal onClose={() => setShowTransfer(false)} title="Room Transfer">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">New Room</label>
              <SearchableSelect
                options={availableRooms.map(r => ({ id: r.id, label: `Room ${r.roomNumber}`, sublabel: r.roomType.name }))}
                value={transferRoom}
                onChange={setTransferRoom}
                placeholder="Select room..."
              />
            </div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Reason</label><input className="input" value={transferReason} onChange={e => setTransferReason(e.target.value)} /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowTransfer(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={handleTransfer}>Transfer</button></div>
          </div>
        </Modal>
      )}

      {/* Extend Modal */}
      {showExtend && (
        <Modal onClose={() => setShowExtend(false)} title="Extend Stay">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">New Checkout Date</label><input className="input" type="date" value={newCheckout} onChange={e => setNewCheckout(e.target.value)} /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowExtend(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={handleExtend}>Extend</button></div>
          </div>
        </Modal>
      )}

      {/* Adjustment Modal */}
      {showAdjustment && (
        <Modal onClose={() => setShowAdjustment(false)} title="Add Adjustment">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
              <select className="input" value={adjType} onChange={e => setAdjType(e.target.value as any)}>
                <option value="DISCOUNT_FLAT">Discount (₹)</option><option value="DISCOUNT_PERCENT">Discount (%)</option><option value="EXTRA_CHARGE">Extra Charge</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Amount</label><input className="input" type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Reason</label><input className="input" value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Late checkout, extra bed, etc." /></div>
            <div className="flex gap-3 pt-2"><button className="btn btn-outline flex-1" onClick={() => setShowAdjustment(false)}>Cancel</button><button className="btn btn-primary flex-1" onClick={handleAdjustment}>Add</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
