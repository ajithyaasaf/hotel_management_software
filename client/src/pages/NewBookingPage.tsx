import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingsApi, roomsApi, guestsApi } from '../api';
import type { Room } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, UserCheck } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function NewBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselected = location.state as { roomId?: string; roomNumber?: string; roomPrice?: number } | null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [guestFound, setGuestFound] = useState(false);

  const [form, setForm] = useState<any>({
    guestName: '', guestPhone: '', guestEmail: '',
    idProofType: 'Aadhar', idProofNumber: '',
    roomId: preselected?.roomId || '',
    checkInDate: new Date().toISOString().split('T')[0],
    expectedCheckout: '', roomPrice: preselected?.roomPrice || 0,
    numberOfGuests: 1, specialRequests: '',
    advanceAmount: 0, advanceMethod: 'CASH' as 'CASH' | 'UPI' | 'CARD',
  });

  useEffect(() => {
    roomsApi.getAvailable().then(r => {
      setRooms(r.data);
      if (!form.roomId && r.data.length > 0) {
        setForm(p => ({ ...p, roomId: r.data[0].id, roomPrice: Number(r.data[0].roomType.basePrice) }));
      }
    });
  }, []);

  async function lookupGuest() {
    if (searchPhone.length < 10) { toast.error('Enter valid phone number'); return; }
    try {
      const { data } = await guestsApi.search(searchPhone);
      if (data) {
        setForm(p => ({
          ...p, guestName: data.name, guestPhone: data.phone,
          guestEmail: data.email || '', idProofType: data.idProofType || 'Aadhar',
          idProofNumber: data.idProofNumber || '',
        }));
        setGuestFound(true);
        toast.success(`Returning guest found! Visit #${data.visitCount + 1}`);
      } else {
        setForm(p => ({ ...p, guestPhone: searchPhone }));
        setGuestFound(false);
        toast('New guest — please fill in details', { icon: '👤' });
      }
    } catch { toast.error('Search failed'); }
  }

  function handleRoomChange(roomId: string) {
    const room = rooms.find(r => r.id === roomId);
    setForm(p => ({ ...p, roomId, roomPrice: room ? Number(room.roomType.basePrice) : 0 }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.guestName || !form.guestPhone || !form.roomId || !form.expectedCheckout) {
      toast.error('Please fill all required fields'); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        roomPrice: Number(form.roomPrice) || 0,
        numberOfGuests: Number(form.numberOfGuests) || 1,
        advanceAmount: Number(form.advanceAmount) || 0,
        checkInDate: new Date(form.checkInDate).toISOString(),
        expectedCheckout: new Date(form.expectedCheckout).toISOString(),
        guestEmail: form.guestEmail || null,
      };
      const { data } = await bookingsApi.create(payload);
      toast.success(`Guest checked into Room ${data.room.roomNumber}!`);
      navigate(`/bookings/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Booking failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="animate-fadeIn max-w-3xl">
      <button onClick={() => navigate(-1)} className="btn btn-ghost mb-4"><ArrowLeft size={18} /> Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Check-in</h1>
      <p className="text-gray-500 text-sm mb-6">Register guest and assign room</p>

      {/* Guest Lookup */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Guest Lookup</h3>
        <div className="flex gap-3">
          <input className="input flex-1" placeholder="Enter phone number..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
          <button onClick={lookupGuest} className="btn btn-outline"><Search size={16} /> Search</button>
        </div>
        {guestFound && <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1"><UserCheck size={14} /> Returning guest found</p>}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Guest Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name *</label>
              <input className="input" value={form.guestName} onChange={e => setForm(p => ({ ...p, guestName: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone *</label>
              <input className="input" value={form.guestPhone} onChange={e => setForm(p => ({ ...p, guestPhone: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <input className="input" type="email" value={form.guestEmail} onChange={e => setForm(p => ({ ...p, guestEmail: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Number of Guests</label>
              <input className="input" type="number" min={1} value={form.numberOfGuests} onChange={e => setForm(p => ({ ...p, numberOfGuests: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ID Proof Type</label>
              <select className="input" value={form.idProofType} onChange={e => setForm(p => ({ ...p, idProofType: e.target.value }))}>
                <option>Aadhar</option><option>Passport</option><option>Driving License</option><option>Voter ID</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ID Number</label>
              <input className="input" value={form.idProofNumber} onChange={e => setForm(p => ({ ...p, idProofNumber: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Room & Stay</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Room *</label>
              <SearchableSelect
                options={rooms.map(r => ({ id: r.id, label: `Room ${r.roomNumber}`, sublabel: `${r.roomType.name} (₹${Number(r.roomType.basePrice)})` }))}
                value={form.roomId}
                onChange={handleRoomChange}
                placeholder="Select room..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Rate / Night (₹) *</label>
              <input className="input" type="number" value={form.roomPrice} onChange={e => setForm(p => ({ ...p, roomPrice: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Check-in Date *</label>
              <input className="input" type="date" value={form.checkInDate} onChange={e => setForm(p => ({ ...p, checkInDate: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Expected Checkout *</label>
              <input className="input" type="date" value={form.expectedCheckout} onChange={e => setForm(p => ({ ...p, expectedCheckout: e.target.value }))} required />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">Special Requests</label>
            <textarea className="input" rows={2} value={form.specialRequests} onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))} />
          </div>
        </div>

        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Advance Payment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Advance Amount (₹)</label>
              <input className="input" type="number" min={0} value={form.advanceAmount} onChange={e => setForm(p => ({ ...p, advanceAmount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
              <select className="input" value={form.advanceMethod} onChange={e => setForm(p => ({ ...p, advanceMethod: e.target.value as any }))}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1 btn-lg">
            {loading ? 'Processing...' : 'Check In Guest'}
          </button>
        </div>
      </form>
    </div>
  );
}
