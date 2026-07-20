import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingsApi, invoicesApi, paymentsApi, roomsApi, nightAuditApi, guestsApi, cancellationsApi } from '../api';
import type { Booking, Invoice, Room } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRightLeft, CalendarPlus, LogOut as CheckOutIcon, CreditCard, Receipt, X, Ban, Users, AlertTriangle, FileText, Edit, Upload, UserCheck, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuthStore } from '../store/authStore';
import { useDialog } from '../contexts/DialogContext';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuthStore();
  const { confirm, prompt } = useDialog();
  const [booking, setBooking] = useState<any>(null); // using any here to simplify, or extend Booking type
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessDate, setBusinessDate] = useState<string>('');

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Transfer state
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [transferRoom, setTransferRoom] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Payment state
  const [payAmount, setPayAmount] = useState<number | string>(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BTC'>('CASH');
  const [payType, setPayType] = useState<'PARTIAL' | 'FULL'>('FULL');
  const [payNotes, setPayNotes] = useState('');
  const [payRef, setPayRef] = useState('');

  // Extend state
  const [newCheckout, setNewCheckout] = useState('');

  // Adjustment state
  const [adjType, setAdjType] = useState<'DISCOUNT_FLAT' | 'DISCOUNT_PERCENT' | 'EXTRA_CHARGE'>('DISCOUNT_FLAT');
  const [adjAmount, setAdjAmount] = useState<number | string>(0);
  const [adjReason, setAdjReason] = useState('');

  // Edit Guest state
  const [showEditGuest, setShowEditGuest] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIdType, setEditIdType] = useState('Aadhar');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editIdImage, setEditIdImage] = useState('');
  const [editExistingIdUrl, setEditExistingIdUrl] = useState('');

  useEffect(() => { loadBooking(); }, [id]);

  async function loadBooking() {
    if (!id) return;
    try {
      const [bRes, iRes, auditRes] = await Promise.all([
        bookingsApi.getById(id),
        invoicesApi.getByBooking(id).catch(() => null),
        nightAuditApi.getStatus().catch(() => null),
      ]);
      setBooking(bRes.data);
      if (iRes) setInvoice(iRes.data);
      if (auditRes) {
        setBusinessDate(auditRes.data.businessDate);
      } else {
        setBusinessDate(format(new Date(), 'yyyy-MM-dd'));
      }
    } catch { toast.error('Failed to load booking'); }
    finally { setLoading(false); }
  }

  function handleCheckout() {
    setShowCheckoutModal(true);
  }

  async function executeCheckout() {
    try {
      await bookingsApi.checkout(id!);
      toast.success('Guest checked out successfully');
      setShowCheckoutModal(false);
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

  const openEditGuestModal = () => {
    if (!booking) return;
    setEditName(booking.guest.name || '');
    setEditPhone(booking.guest.phone || '');
    setEditEmail(booking.guest.email || '');
    setEditAddress(booking.guest.address || '');
    setEditNotes(booking.guest.notes || '');
    setEditIdType(booking.guest.idProofType || 'Aadhar');
    setEditIdNumber(booking.guest.idProofNumber || '');
    setEditIdImage('');
    setEditExistingIdUrl(booking.guest.idProofUrl || '');
    setShowEditGuest(true);
  };

  function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditIdImage(reader.result as string);
      setEditExistingIdUrl('');
    };
    reader.readAsDataURL(file);
  }

  async function handleEditGuestSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editName || !editPhone) {
      toast.error('Please enter name and phone number');
      return;
    }
    if (editPhone.length < 10) {
      toast.error('Phone number must be at least 10 digits');
      return;
    }
    setLoading(true);
    try {
      await guestsApi.update(booking!.guest.id, {
        name: editName,
        phone: editPhone,
        email: editEmail || null,
        address: editAddress || null,
        notes: editNotes || null,
        idProofType: editIdType,
        idProofNumber: editIdNumber || null,
        idProofImage: editIdImage || null,
      });
      toast.success('Guest details updated successfully');
      setShowEditGuest(false);
      loadBooking();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update guest details');
    } finally {
      setLoading(false);
    }
  }

  async function handleNoShow() {
    const isConfirmed = await confirm({
      title: 'Mark as No Show',
      message: 'Mark guest as No Show? This will release the room reservation.',
      confirmText: 'Confirm',
      variant: 'warning'
    });
    if (!isConfirmed) return;
    try {
      await bookingsApi.noShow(id!);
      toast.success('Marked as No Show');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function handleCancel() {
    const reason = await prompt({
      title: 'Cancel Booking',
      message: 'Please provide a reason for cancelling this booking.',
      placeholder: 'Cancellation reason',
      required: true,
      confirmText: 'Cancel Booking',
      variant: 'danger'
    });
    if (!reason) return;
    try {
      const res = await bookingsApi.cancel(id!, reason);
      if (res.data.requiresApproval) {
        toast.success(res.data.message);
      } else {
        toast.success('Booking cancelled');
      }
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Cancellation failed'); }
  }

  async function handleApproveCancellation(reqId: string) {
    const isConfirmed = await confirm({
      title: 'Approve Cancellation',
      message: 'Are you sure you want to approve this cancellation request?',
      confirmText: 'Approve',
      variant: 'primary'
    });
    if (!isConfirmed) return;
    try {
      await cancellationsApi.approve(reqId);
      toast.success('Cancellation approved');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to approve'); }
  }

  async function handleRejectCancellation(reqId: string) {
    const note = await prompt({
      title: 'Reject Cancellation',
      message: 'Please provide a reason for rejecting this cancellation request (optional).',
      placeholder: 'Rejection reason',
      confirmText: 'Reject Request',
      variant: 'warning'
    });
    if (note === null) return;
    try {
      await cancellationsApi.reject(reqId, note);
      toast.success('Cancellation rejected');
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to reject'); }
  }

  async function handlePayment() {
    if (Number(payAmount) <= 0) { toast.error('Enter valid amount'); return; }
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
    if (!transferReason || transferReason.length < 5) { 
      toast.error('Please provide a descriptive reason (min 5 characters)'); return; 
    }
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
    
    const newCheckoutStr = newCheckout; // already in "yyyy-MM-dd" format
    const checkInStr = new Date(booking!.checkInDate).toISOString().split('T')[0];
    const referenceDate = businessDate || new Date().toISOString().split('T')[0];

    if (newCheckoutStr < checkInStr) {
      toast.error('New checkout date cannot be before check-in date'); return;
    }
    if (newCheckoutStr < referenceDate) {
      toast.error("New checkout date cannot be in the past relative to the hotel's business date"); return;
    }
    try {
      await bookingsApi.extend(id!, { newCheckout: new Date(newCheckout).toISOString() });
      toast.success('Stay extended');
      setShowExtend(false);
      loadBooking();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Extension failed'); }
  }

  async function handleAdjustment() {
    if (Number(adjAmount) <= 0 || !adjReason) { toast.error('Fill all fields'); return; }
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-1 max-w-5xl">
        {/* Back button skeleton */}
        <div className="h-9 w-24 bg-gray-200 rounded-lg" />

        {/* Header Skeleton */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-36 bg-gray-200 rounded-lg" />
              <div className="h-5 w-20 bg-gray-250 rounded-full" />
            </div>
            <div className="h-4 w-48 bg-gray-150 rounded-md" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Guest and Stay Cards */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-5 border border-gray-150/60 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="h-5 w-36 bg-gray-200 rounded-md" />
                <div className="h-8 w-24 bg-gray-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 bg-gray-150 rounded-sm" />
                    <div className="h-4 w-32 bg-gray-200 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 border border-gray-150/60 space-y-4">
              <div className="h-5 w-28 bg-gray-200 rounded-md pb-2 border-b border-gray-100" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-20 bg-gray-150 rounded-sm" />
                    <div className="h-4 w-28 bg-gray-200 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Invoice Sidebar */}
          <div className="card p-5 border border-gray-150/60 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="h-5 w-20 bg-gray-200 rounded-md" />
              <div className="h-4 w-16 bg-gray-150 rounded-md" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
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
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <div className="h-9 bg-gray-200 rounded-lg flex-1" />
              <div className="h-9 bg-gray-200 rounded-lg flex-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!booking) return <p className="text-gray-500">Booking not found</p>;

  const isActive = booking.status === 'CHECKED_IN';
  const referenceDate = businessDate || new Date().toISOString().split('T')[0];
  const checkoutStr = new Date(booking.expectedCheckout).toISOString().split('T')[0];
  const realToday = new Date().toISOString().split('T')[0];
  const isOverdue = booking.status === 'CHECKED_IN' && checkoutStr < realToday;

  const taxableStayAmount = invoice 
    ? Number(invoice.roomCharges) + Number(invoice.extraCharges) - Number(invoice.discountAmount) 
    : 0;
  const cgstPercent = invoice && taxableStayAmount > 0 && Number(invoice.cgst) > 0
    ? Math.round((Number(invoice.cgst) / taxableStayAmount) * 100 * 10) / 10 
    : 2.5;
  const sgstPercent = invoice && taxableStayAmount > 0 && Number(invoice.sgst) > 0
    ? Math.round((Number(invoice.sgst) / taxableStayAmount) * 100 * 10) / 10 
    : 2.5;

  return (
    <div className="animate-fadeIn max-w-5xl">
      <button onClick={() => navigate('/bookings')} className="btn btn-ghost mb-4"><ArrowLeft size={18} /> Bookings</button>

      {/* Pending Cancellation Alert */}
      {booking.cancellationRequests?.filter((r: any) => r.status === 'PENDING').map((req: any) => (
        <div key={req.id} className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-2xl mb-6 flex flex-col sm:flex-row items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-yellow-900">Cancellation Requested</h4>
              <p className="text-sm text-yellow-700 mt-0.5">
                Requested by <strong>{req.requestedBy?.name || 'System'}</strong> on {format(new Date(req.requestedAt), 'dd MMM hh:mm a')}.<br />
                Reason: {req.reason}
              </p>
            </div>
          </div>
          {hasPermission(['booking.cancel.approve']) && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleApproveCancellation(req.id)} className="btn btn-primary btn-sm bg-yellow-600 hover:bg-yellow-700 border-none text-white shadow-sm">
                <CheckCircle size={16} /> Approve
              </button>
              <button onClick={() => handleRejectCancellation(req.id)} className="btn btn-outline btn-sm text-yellow-700 border-yellow-300 hover:bg-yellow-100">
                <XCircle size={16} /> Reject
              </button>
            </div>
          )}
        </div>
      ))}

      {isOverdue && (
        <div className="bg-red-50 border border-red-100 text-red-800 p-4 rounded-2xl mb-6 flex items-start gap-3 shadow-sm shadow-red-100/50 animate-fadeIn print:hidden">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-red-950">Overdue Checkout</h4>
            <p className="text-sm text-red-700 mt-0.5">
              This guest was scheduled to check out on <strong>{format(new Date(booking.expectedCheckout), 'dd MMM yyyy')}</strong> but has not yet checked out. Please process their checkout or extend their stay.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {booking.bookingNumber}
            <span className={`badge ${booking.status === 'CHECKED_IN' ? 'badge-green' : booking.status === 'CHECKED_OUT' ? 'badge-gray' : 'badge-red'}`}>{booking.status.replace('_', ' ')}</span>
          </h1>
          <p className="text-gray-500 mt-1">Room {booking.room.roomNumber} · {booking.room.roomType.name}</p>
          {booking.groupBookingId && (
            <button
              onClick={() => navigate(`/bookings/group/${booking.groupBookingId}`)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-violet-50 text-violet-600 px-3 py-1 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Users size={12} /> Part of Group Booking {booking.groupBooking?.groupNumber ?? booking.groupBookingId.slice(0, 8)}
            </button>
          )}
        </div>
        {isActive && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setShowExtend(true)} className="btn btn-outline btn-sm flex-1 sm:flex-none justify-center"><CalendarPlus size={16} /> Extend</button>
            <button onClick={openTransferModal} className="btn btn-outline btn-sm flex-1 sm:flex-none justify-center"><ArrowRightLeft size={16} /> Transfer</button>
            <button onClick={() => { setPayAmount(Number(invoice?.pendingAmount || 0)); setShowPayment(true); }} className="btn btn-outline btn-sm flex-1 sm:flex-none justify-center"><CreditCard size={16} /> Payment</button>
            <button onClick={handleCheckout} className="btn btn-danger btn-sm flex-1 sm:flex-none justify-center"><CheckOutIcon size={16} /> Checkout</button>
          </div>
        )}
        {booking.status === 'CONFIRMED' && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => { setPayAmount(Number(invoice?.pendingAmount || 0)); setShowPayment(true); }} className="btn btn-outline btn-sm flex-1 sm:flex-none justify-center"><CreditCard size={16} /> Advance Payment</button>
            <button onClick={handleCancel} className="btn btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-none justify-center"><Ban size={16} /> Cancel</button>
            <button onClick={handleNoShow} className="btn btn-outline btn-sm text-amber-600 border-amber-200 hover:bg-amber-50 flex-1 sm:flex-none justify-center">No Show</button>
            <button onClick={handleAdvanceCheckin} className="btn btn-primary btn-sm flex-1 sm:flex-none justify-center"><CheckOutIcon size={16} className="transform rotate-180" /> Check In Now</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Guest + Stay Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Guest Information</h3>
              <button 
                type="button" 
                onClick={openEditGuestModal} 
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100 transition-colors"
              >
                <Edit size={12} /> Edit Details
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Name</span><p className="font-medium">{booking.guest.name}</p></div>
              <div><span className="text-gray-400">Phone</span><p className="font-medium">{booking.guest.phone}</p></div>
              <div><span className="text-gray-400">ID Proof</span><p className="font-medium">{booking.guest.idProofType} — {booking.guest.idProofNumber || 'N/A'}</p></div>
              <div><span className="text-gray-400">Visit Count</span><p className="font-medium">{booking.guest.visitCount}</p></div>
              {booking.guest.idProofUrl && (
                <div className="col-span-2 mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-gray-500 font-medium">ID Document</span>
                  <a
                    href={booking.guest.idProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1.5 bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100 transition-colors"
                  >
                    <FileText size={14} /> View Attached ID Document
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Stay Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Check-in</span><p className="font-medium">{format(new Date(booking.checkInDate), 'dd MMM yyyy')}</p></div>
              <div>
                <span className="text-gray-400">Expected Checkout</span>
                <p className={`font-medium flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                  {isOverdue && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                  {format(new Date(booking.expectedCheckout), 'dd MMM yyyy')}
                  {isOverdue && (
                    <span className="bg-red-50 text-red-700 border border-red-100 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                      Overdue
                    </span>
                  )}
                </p>
              </div>
              <div><span className="text-gray-400">Room Rate</span><p className="font-medium">₹{Number(booking.roomPrice).toLocaleString()}/night</p></div>
              <div><span className="text-gray-400">Guests</span><p className="font-medium">{booking.numberOfGuests}</p></div>
            </div>
            {booking.company && (
              <div className="mt-4 pt-4 border-t border-dashed border-gray-200 grid grid-cols-2 gap-4 text-sm bg-blue-50/20 p-3 rounded-xl">
                <div>
                  <span className="text-gray-400 font-medium">Corporate Client</span>
                  <p className="font-bold text-blue-700 mt-0.5">{booking.company.name}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Billing Instruction</span>
                  <p className="font-bold text-blue-700 mt-0.5">
                    {booking.billingRule === 'COMPANY_ALL' 
                      ? 'All Charges to Company' 
                      : booking.billingRule === 'COMPANY_ROOM_ONLY' 
                      ? 'Room Only to Company' 
                      : 'All Charges to Guest'}
                  </p>
                </div>
              </div>
            )}
            {booking.transfers && booking.transfers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Room Transfers</h4>
                {booking.transfers.map((t: any) => (
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
                {booking.payments.map((p: any) => (
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
                {Number(invoice.cgst) > 0 && <div className="flex justify-between text-gray-400 text-xs"><span>CGST ({cgstPercent}%)</span><span>₹{Number(invoice.cgst).toLocaleString()}</span></div>}
                {Number(invoice.sgst) > 0 && <div className="flex justify-between text-gray-400 text-xs"><span>SGST ({sgstPercent}%)</span><span>₹{Number(invoice.sgst).toLocaleString()}</span></div>}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg"><span>Total</span><span>₹{Number(invoice.grandTotal).toLocaleString()}</span></div>
                
                {/* Corporate routing details */}
                {booking.companyId && booking.billingRule !== 'GUEST' && (
                  <div className="mt-2 pt-2 border-t border-dashed border-gray-200 space-y-1 bg-blue-50/50 p-2.5 rounded-lg text-xs">
                    <p className="font-bold text-blue-900 mb-1">Corporate Routing ({booking.billingRule?.replace(/_/g, ' ')})</p>
                    <div className="flex justify-between text-gray-600"><span>Company Folio</span><span className="font-semibold text-gray-900">₹{Number(invoice.companyAmount).toLocaleString()}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Guest Folio</span><span className="font-semibold text-gray-900">₹{Number(invoice.guestAmount).toLocaleString()}</span></div>
                  </div>
                )}

                <div className="flex justify-between text-emerald-600"><span>Paid (Guest)</span><span>₹{Number(invoice.amountPaid).toLocaleString()}</span></div>
                {Number(invoice.pendingAmount) > 0 && <div className="flex justify-between text-red-600 font-semibold"><span>Pending (Guest)</span><span>₹{Number(invoice.pendingAmount).toLocaleString()}</span></div>}
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
                {(isActive || (user?.role === 'MD' && invoice)) && (
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
                <td className="py-1">CGST ({cgstPercent}%)</td>
                <td className="py-1 text-right">{Number(invoice.cgst).toLocaleString()}</td>
              </tr>
              <tr className="text-gray-600 border-b border-gray-200">
                <td className="py-1 pb-3">SGST ({sgstPercent}%)</td>
                <td className="py-1 pb-3 text-right">{Number(invoice.sgst).toLocaleString()}</td>
              </tr>
              <tr className="font-bold text-lg">
                <td className="py-4">Grand Total</td>
                <td className="py-4 text-right">₹{Number(invoice.grandTotal).toLocaleString()}</td>
              </tr>
              {booking.companyId && booking.billingRule !== 'GUEST' && (
                <tr className="text-xs text-blue-900 bg-blue-50/50 font-semibold border-y border-dashed border-blue-200">
                  <td className="py-2.5 px-2">Billed to Company ({booking.company?.name || 'Company'})</td>
                  <td className="py-2.5 px-2 text-right">₹{Number(invoice.companyAmount).toLocaleString()}</td>
                </tr>
              )}
              <tr className="text-emerald-600">
                <td className="py-2">Amount Paid (Guest)</td>
                <td className="py-2 text-right">₹{Number(invoice.amountPaid).toLocaleString()}</td>
              </tr>
              {Number(invoice.pendingAmount) > 0 && (
                <tr className="text-red-600 font-bold">
                  <td className="py-2">Pending Balance (Guest)</td>
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
                {booking.payments.map((p: any) => (
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
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Method</label>
                <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value as any)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  {booking.companyId && <option value="BTC">Bill to Company (BTC)</option>}
                </select>
              </div>
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
            <div><label className="block text-sm font-medium text-gray-600 mb-1">New Checkout Date</label><input className="input" type="date" min={booking ? new Date(booking.checkInDate).toISOString().split('T')[0] : undefined} value={newCheckout} onChange={e => setNewCheckout(e.target.value)} /></div>
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

      {/* Edit Guest Modal */}
      {showEditGuest && (
        <Modal onClose={() => setShowEditGuest(false)} title="Edit Guest Details">
          <form onSubmit={handleEditGuestSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 py-1">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name *</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number *</label>
              <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
              <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
              <input className="input" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input" rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">ID Proof Type</label>
                <select className="input" value={editIdType} onChange={e => setEditIdType(e.target.value)}>
                  <option>Aadhar</option><option>Passport</option><option>Driving License</option><option>Voter ID</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">ID Proof Number</label>
                <input className="input" value={editIdNumber} onChange={e => setEditIdNumber(e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">ID Proof Document (Aadhar / PAN Scan)</label>
              {editExistingIdUrl ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100/50 rounded-lg text-emerald-600">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Saved ID Found</p>
                      <p className="text-xs text-emerald-600">An ID scan is already saved.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a 
                      href={editExistingIdUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 bg-white border border-gray-200 py-1.5 px-3 rounded-lg shadow-sm"
                    >
                      View ID
                    </a>
                    <button 
                      type="button" 
                      onClick={() => setEditExistingIdUrl('')} 
                      className="text-xs font-semibold text-red-600 hover:text-red-700 bg-white border border-gray-200 py-1.5 px-3 rounded-lg shadow-sm"
                    >
                      Replace ID
                    </button>
                  </div>
                </div>
              ) : editIdImage ? (
                <div className="flex items-center justify-between p-3 bg-primary-50/50 border border-primary-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden flex items-center justify-center">
                      <img src={editIdImage} alt="Selected ID" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-800">New ID Selected</p>
                      <p className="text-xs text-primary-600">Will be uploaded on save.</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setEditIdImage('')} 
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border border-dashed border-gray-200 hover:border-primary-400 rounded-xl p-6 cursor-pointer bg-white hover:bg-primary-50/5 transition-all group">
                  <Upload size={24} className="text-gray-400 group-hover:text-primary-500 mb-2 transition-colors" />
                  <span className="text-sm font-medium text-gray-700">Click to upload photo or scan</span>
                  <span className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 5MB</span>
                  <input type="file" accept="image/*" onChange={handleEditFileChange} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button type="button" className="btn btn-outline flex-1" onClick={() => setShowEditGuest(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary flex-1" disabled={loading}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <Modal onClose={() => setShowCheckoutModal(false)} title="Confirm Checkout">
          <div className="p-2 space-y-4">
            {Number(invoice?.pendingAmount) > 0 ? (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-red-900">Pending Balance Warning</h4>
                  <p className="text-sm text-red-700 mt-1">
                    This guest still has a pending balance of <strong>₹{Number(invoice?.pendingAmount).toLocaleString()}</strong>. Are you sure you want to proceed with checkout without collecting the full payment?
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">Are you sure you want to check out this guest? This will finalize their invoice and close the room.</p>
            )}
            <div className="flex gap-2 pt-4 border-t">
              <button type="button" className="btn btn-outline flex-1" onClick={() => setShowCheckoutModal(false)}>Cancel</button>
              {Number(invoice?.pendingAmount) > 0 && (
                <button type="button" className="btn btn-primary flex-1" onClick={() => {
                  setPayAmount(Number(invoice?.pendingAmount));
                  setShowCheckoutModal(false);
                  setShowPayment(true);
                }}>
                  Settle Bill
                </button>
              )}
              <button type="button" className="btn btn-danger flex-1" onClick={executeCheckout}>
                {Number(invoice?.pendingAmount) > 0 ? 'Checkout Anyway' : 'Confirm Checkout'}
              </button>
            </div>
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
