import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupBookingsApi } from '../api';
import type { GroupBooking, MasterInvoice } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft, Users, Eye, LogOut, FileText, Unlink, AlertCircle } from 'lucide-react';

const statusColors: Record<string, string> = {
  ACTIVE: 'badge-green',
  PARTIALLY_CHECKED_OUT: 'badge-yellow',
  COMPLETED: 'badge-gray',
  CANCELLED: 'badge-red',
};

const bookingStatusColors: Record<string, string> = {
  CONFIRMED: 'badge-blue',
  CHECKED_IN: 'badge-green',
  CHECKED_OUT: 'badge-gray',
  CANCELLED: 'badge-red',
  NO_SHOW: 'badge-yellow',
};

export default function GroupBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupBooking | null>(null);
  const [masterInvoice, setMasterInvoice] = useState<MasterInvoice | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoice'>('overview');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => { loadGroup(); }, [id]);

  async function loadGroup() {
    if (!id) return;
    try {
      const [gRes, miRes] = await Promise.all([
        groupBookingsApi.getById(id),
        groupBookingsApi.getMasterInvoice(id),
      ]);
      setGroup(gRes.data);
      setMasterInvoice(miRes.data);
    } catch { toast.error('Failed to load group booking'); }
    finally { setLoading(false); }
  }

  async function handleCheckoutAll() {
    const activeRooms = group?.bookings.filter(b => b.status === 'CHECKED_IN') ?? [];
    if (activeRooms.length === 0) { toast.error('No checked-in rooms to checkout'); return; }

    const pendingRooms = activeRooms.filter(b => Number(b.invoice?.pendingAmount ?? 0) > 0);
    if (pendingRooms.length > 0) {
      const names = pendingRooms.map(b => `Room ${b.room.roomNumber} (₹${Number(b.invoice?.pendingAmount ?? 0).toLocaleString()} pending)`).join(', ');
      if (!confirm(`Warning: The following rooms have pending balances:\n${names}\n\nProceed with checkout?`)) return;
    } else {
      if (!confirm(`Checkout all ${activeRooms.length} rooms in this group?`)) return;
    }

    setCheckingOut(true);
    try {
      const { data } = await groupBookingsApi.checkoutAll(id!);
      if (data.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast(w, { icon: '⚠️', duration: 5000 }));
      }
      toast.success('All rooms checked out');
      loadGroup();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Checkout failed');
    } finally { setCheckingOut(false); }
  }

  async function handleUnlink(bookingId: string, roomNumber: string) {
    if (!confirm(`Unlink Room ${roomNumber} from this group? The booking will remain as a standalone booking.`)) return;
    try {
      await groupBookingsApi.unlinkBooking(id!, bookingId);
      toast.success(`Room ${roomNumber} unlinked from group`);
      loadGroup();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to unlink'); }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
    </div>
  );

  if (!group) return <p className="text-gray-500">Group booking not found</p>;

  const activeBookings = group.bookings.filter(b => b.status === 'CHECKED_IN');
  const canCheckoutAll = activeBookings.length > 0;

  return (
    <div className="animate-fadeIn max-w-5xl">
      <button onClick={() => navigate('/bookings')} className="btn btn-ghost mb-4">
        <ArrowLeft size={18} /> Bookings
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users size={22} className="text-primary-600" />
            {group.groupNumber}
            <span className={`badge ${statusColors[group.status]}`}>{group.status.replace(/_/g, ' ')}</span>
          </h1>
          <p className="text-gray-500 mt-1">
            Lead Guest: <span className="font-medium text-gray-800">{group.leadGuest.name}</span> ·{' '}
            {group.leadGuest.phone} · {group.bookings.length} rooms
          </p>
          {group.notes && <p className="text-xs text-gray-400 mt-1 italic">{group.notes}</p>}
        </div>
        <div className="flex gap-2">
          {canCheckoutAll && (
            <button onClick={handleCheckoutAll} disabled={checkingOut} className="btn btn-danger btn-sm">
              <LogOut size={16} /> {checkingOut ? 'Checking Out...' : 'Checkout All Rooms'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit print:hidden">
        {(['overview', 'invoice'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'overview' ? 'Room Overview' : 'Master Invoice'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {group.bookings.map(booking => (
            <div key={booking.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-primary-600">{booking.bookingNumber}</span>
                    <span className="font-semibold text-gray-900">Room {booking.room.roomNumber}</span>
                    <span className="text-xs text-gray-400">{booking.room.roomType.name}</span>
                    <span className={`badge ${bookingStatusColors[booking.status]}`}>{booking.status.replace('_', ' ')}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm text-gray-600 mt-2">
                    <div>
                      <span className="text-gray-400 text-xs block">Check-in</span>
                      {format(new Date(booking.checkInDate), 'dd MMM yyyy')}
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Checkout</span>
                      {format(new Date(booking.expectedCheckout), 'dd MMM yyyy')}
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Rate / Night</span>
                      ₹{Number(booking.roomPrice).toLocaleString()}
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Guests</span>
                      {booking.numberOfGuests}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {booking.invoice && (
                    <div className="text-right text-sm mr-4">
                      <p className="font-semibold text-gray-900">₹{Number(booking.invoice.grandTotal).toLocaleString()}</p>
                      {Number(booking.invoice.pendingAmount) > 0 && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle size={10} /> ₹{Number(booking.invoice.pendingAmount).toLocaleString()} pending
                        </p>
                      )}
                    </div>
                  )}
                  <button onClick={() => navigate(`/bookings/${booking.id}`)} className="btn btn-outline btn-sm">
                    <Eye size={14} /> View
                  </button>
                  {booking.status !== 'CHECKED_IN' && (
                    <button onClick={() => handleUnlink(booking.id, booking.room.roomNumber)} className="btn btn-ghost btn-sm text-gray-400">
                      <Unlink size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Master Invoice Tab */}
      {activeTab === 'invoice' && masterInvoice && (
        <div className="card p-6">
          {/* Print Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Group Master Invoice</h2>
              <p className="text-sm text-gray-500">{masterInvoice.groupNumber}</p>
              <p className="text-sm text-gray-500">Lead Guest: {masterInvoice.leadGuest.name} — {masterInvoice.leadGuest.phone}</p>
            </div>
            <button onClick={() => window.print()} className="btn btn-primary btn-sm print:hidden">
              <FileText size={14} /> Print
            </button>
          </div>

          {/* Per-room breakdown */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-3 text-left font-semibold text-gray-600">Room</th>
                <th className="py-3 text-left font-semibold text-gray-600">Period</th>
                <th className="py-3 text-right font-semibold text-gray-600">Room Charges</th>
                <th className="py-3 text-right font-semibold text-gray-600">Food</th>
                <th className="py-3 text-right font-semibold text-gray-600">Extra</th>
                <th className="py-3 text-right font-semibold text-gray-600">Discount</th>
                <th className="py-3 text-right font-semibold text-gray-600">Total</th>
                <th className="py-3 text-right font-semibold text-gray-600">Paid</th>
                <th className="py-3 text-right font-semibold text-gray-600">Pending</th>
              </tr>
            </thead>
            <tbody>
              {masterInvoice.rooms.map(r => (
                <tr key={r.bookingId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3">
                    <p className="font-medium">Room {r.roomNumber}</p>
                    <p className="text-xs text-gray-400">{r.roomType}</p>
                  </td>
                  <td className="py-3 text-gray-500">
                    {format(new Date(r.checkInDate), 'dd MMM')} — {format(new Date(r.expectedCheckout), 'dd MMM yyyy')}
                  </td>
                  <td className="py-3 text-right">₹{r.roomCharges.toLocaleString()}</td>
                  <td className="py-3 text-right">{r.foodCharges > 0 ? `₹${r.foodCharges.toLocaleString()}` : '—'}</td>
                  <td className="py-3 text-right">{r.extraCharges > 0 ? `₹${r.extraCharges.toLocaleString()}` : '—'}</td>
                  <td className="py-3 text-right text-emerald-600">{r.discountAmount > 0 ? `-₹${r.discountAmount.toLocaleString()}` : '—'}</td>
                  <td className="py-3 text-right font-semibold">₹{r.grandTotal.toLocaleString()}</td>
                  <td className="py-3 text-right text-emerald-600">₹{r.amountPaid.toLocaleString()}</td>
                  <td className="py-3 text-right">
                    {r.pendingAmount > 0
                      ? <span className="text-red-600 font-semibold">₹{r.pendingAmount.toLocaleString()}</span>
                      : <span className="text-emerald-500">✓ Paid</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Room Charges</span><span>₹{masterInvoice.totalRoomCharges.toLocaleString()}</span></div>
            {masterInvoice.totalFoodCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Food & Beverages</span><span>₹{masterInvoice.totalFoodCharges.toLocaleString()}</span></div>}
            {masterInvoice.totalExtraCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Extra Charges</span><span>₹{masterInvoice.totalExtraCharges.toLocaleString()}</span></div>}
            {masterInvoice.totalDiscounts > 0 && <div className="flex justify-between text-emerald-600"><span>Discounts</span><span>-₹{masterInvoice.totalDiscounts.toLocaleString()}</span></div>}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
              <span>Grand Total</span><span>₹{masterInvoice.totalGrandTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-600"><span>Amount Paid</span><span>₹{masterInvoice.totalAmountPaid.toLocaleString()}</span></div>
            {masterInvoice.totalPending > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Total Pending</span><span>₹{masterInvoice.totalPending.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
