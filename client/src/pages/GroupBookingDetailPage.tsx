import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupBookingsApi, nightAuditApi } from '../api';
import type { GroupBooking, MasterInvoice } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useDialog } from '../contexts/DialogContext';
import { ArrowLeft, Users, Eye, LogOut, FileText, Unlink, AlertCircle, AlertTriangle, X } from 'lucide-react';

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
  const { confirm } = useDialog();
  const [group, setGroup] = useState<GroupBooking | null>(null);
  const [masterInvoice, setMasterInvoice] = useState<MasterInvoice | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoice'>('overview');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [businessDate, setBusinessDate] = useState<string>('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  useEffect(() => { loadGroup(); }, [id]);

  async function loadGroup() {
    if (!id) return;
    try {
      const [gRes, miRes, auditRes] = await Promise.all([
        groupBookingsApi.getById(id),
        groupBookingsApi.getMasterInvoice(id),
        nightAuditApi.getStatus().catch(() => null),
      ]);
      setGroup(gRes.data);
      setMasterInvoice(miRes.data);
      if (auditRes) {
        setBusinessDate(auditRes.data.businessDate);
      } else {
        setBusinessDate(format(new Date(), 'yyyy-MM-dd'));
      }
    } catch { toast.error('Failed to load group booking'); }
    finally { setLoading(false); }
  }

  function handleCheckoutClick() {
    const activeRooms = group?.bookings.filter(b => b.status === 'CHECKED_IN') ?? [];
    if (activeRooms.length === 0) { toast.error('No checked-in rooms to checkout'); return; }
    setShowCheckoutModal(true);
  }

  async function executeCheckoutAll() {
    setShowCheckoutModal(false);
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
    const isConfirmed = await confirm({
      title: 'Unlink Room',
      message: `Unlink Room ${roomNumber} from this group? The booking will remain as a standalone booking.`,
      confirmText: 'Unlink Room',
      variant: 'warning'
    });
    if (!isConfirmed) return;
    try {
      await groupBookingsApi.unlinkBooking(id!, bookingId);
      toast.success(`Room ${roomNumber} unlinked from group`);
      loadGroup();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to unlink'); }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-1 max-w-5xl">
        {/* Back Button */}
        <div className="h-9 w-24 bg-gray-200 rounded-lg" />

        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-44 bg-gray-200 rounded-lg" />
              <div className="h-5 w-20 bg-gray-250 rounded-full" />
            </div>
            <div className="h-4 w-72 bg-gray-150 rounded-md" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <div className="h-9 w-32 bg-white rounded-lg shadow-sm" />
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
        </div>

        {/* Rooms List Skeletons */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 border border-gray-150/60 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-24 bg-gray-200 rounded-md" />
                    <div className="h-4 w-20 bg-gray-200 rounded-md" />
                    <div className="h-4 w-16 bg-gray-150 rounded-md" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-4 w-32 bg-gray-200 rounded-md" />
                    <div className="h-4 w-28 bg-gray-200 rounded-md" />
                  </div>
                </div>
                <div className="h-8 w-16 bg-gray-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!group) return <p className="text-gray-500">Group booking not found</p>;

  const activeBookings = group.bookings.filter(b => b.status === 'CHECKED_IN');
  const canCheckoutAll = activeBookings.length > 0;

  return (
    <div className="animate-fadeIn max-w-5xl">
      <button onClick={() => navigate('/bookings')} className="btn btn-ghost mb-4">
        <ArrowLeft size={18} /> Bookings
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 print:hidden">
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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {canCheckoutAll && (
            <button onClick={handleCheckoutClick} disabled={checkingOut} className="btn btn-danger btn-sm flex-1 sm:flex-none justify-center">
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
          {group.bookings.map(booking => {
            const realToday = new Date().toISOString().split('T')[0];
            const checkoutStr = new Date(booking.expectedCheckout).toISOString().split('T')[0];
            const isOverdue = booking.status === 'CHECKED_IN' && checkoutStr < realToday;
            return (
              <div key={booking.id} className={`card p-5 transition-colors ${isOverdue ? 'bg-red-50/20 border-l-4 border-l-red-500' : ''}`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-primary-600">{booking.bookingNumber}</span>
                      <span className="font-semibold text-gray-900">Room {booking.room.roomNumber}</span>
                      <span className="text-xs text-gray-400">{booking.room.roomType.name}</span>
                      <span className={`badge ${bookingStatusColors[booking.status]}`}>{booking.status.replace('_', ' ')}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600 mt-2">
                      <div>
                        <span className="text-gray-400 text-xs block">Check-in</span>
                        {format(new Date(booking.checkInDate), 'dd MMM yyyy')}
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs block">Checkout</span>
                        <span className={`font-medium flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                          {isOverdue && <AlertCircle size={12} className="text-red-500 animate-pulse" />}
                          {format(new Date(booking.expectedCheckout), 'dd MMM yyyy')}
                        </span>
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
                    <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
                      <div>
                        <span className="font-medium text-gray-400">Occupant: </span>
                        <span className="font-semibold text-gray-700">{booking.guest.name}</span>
                        <span className="text-gray-400 mx-1.5">·</span>
                        <span className="text-gray-600">{booking.guest.phone}</span>
                      </div>
                      {(booking.guest as any).idProofUrl && (
                        <a
                          href={(booking.guest as any).idProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
                        >
                          <FileText size={12} /> View ID Document
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                    {booking.invoice && (
                      <div className="text-left md:text-right text-sm mr-4">
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
            );
          })}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b-2 border-gray-200 whitespace-nowrap">
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
              <tbody className="whitespace-nowrap">
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
          </div>

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

      {/* Checkout Modal */}
      {showCheckoutModal && (() => {
        const activeRooms = group?.bookings.filter(b => b.status === 'CHECKED_IN') ?? [];
        const pendingRooms = activeRooms.filter(b => Number(b.invoice?.pendingAmount ?? 0) > 0);

        return (
          <Modal onClose={() => setShowCheckoutModal(false)} title="Confirm Group Checkout">
            <div className="p-2 space-y-4">
              {pendingRooms.length > 0 ? (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-bold text-red-900">Pending Balances Warning</h4>
                    <p className="text-sm text-red-700 mt-1 mb-2">
                      The following rooms still have pending balances. Are you sure you want to proceed with checking out all rooms?
                    </p>
                    <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                      {pendingRooms.map(b => (
                        <li key={b.id}>
                          Room {b.room.roomNumber} <span className="font-semibold text-red-900">— ₹{Number(b.invoice?.pendingAmount ?? 0).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">Are you sure you want to check out all {activeRooms.length} rooms in this group? This will finalize all invoices.</p>
              )}
              <div className="flex gap-3 pt-4 border-t">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowCheckoutModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger flex-1" onClick={executeCheckoutAll}>
                  Confirm Checkout
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
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
