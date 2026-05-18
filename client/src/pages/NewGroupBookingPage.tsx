import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { groupBookingsApi, roomsApi, guestsApi } from '../api';
import type { Room } from '../types';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Search, Users, UserCheck } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

interface RoomEntry {
  roomId: string;
  checkInDate: string;
  expectedCheckout: string;
  roomPrice: number | string;
  numberOfGuests: number | string;
  specialRequests: string;
  advanceAmount: number | string;
  advanceMethod: 'CASH' | 'UPI' | 'CARD';
}

const emptyRoomEntry = (): RoomEntry => ({
  roomId: '',
  checkInDate: new Date().toISOString().split('T')[0],
  expectedCheckout: '',
  roomPrice: 0,
  numberOfGuests: 1,
  specialRequests: '',
  advanceAmount: 0,
  advanceMethod: 'CASH',
});

export default function NewGroupBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  // Lead guest
  const [guestPhone, setGuestPhone] = useState('');
  const [leadGuestName, setLeadGuestName] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [searching, setSearching] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // Room entries (minimum 2)
  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([emptyRoomEntry(), emptyRoomEntry()]);

  useEffect(() => {
    roomsApi.getAvailable().then(r => {
      setRooms(r.data);

      // If coming from Rooms page with a pre-selected room
      const stateRoomId = location.state?.roomId;
      if (stateRoomId) {
        const room = r.data.find((rm: Room) => rm.id === stateRoomId);
        if (room) {
          setRoomEntries(prev => {
            const updated = [...prev];
            updated[0] = {
              ...updated[0],
              roomId: room.id,
              roomPrice: Number(room.roomType.basePrice)
            };
            return updated;
          });
        }
      }
    });
  }, [location.state]);

  // Auto-lookup guest when phone reaches 10 digits
  useEffect(() => {
    if (guestPhone.length === 10) {
      autoLookup(guestPhone);
    } else {
      setIsReturning(false);
    }
  }, [guestPhone]);

  async function autoLookup(phone: string) {
    setSearching(true);
    try {
      const { data } = await guestsApi.search(phone);
      if (data) {
        setLeadGuestName(data.name);
        setIsReturning(true);
        toast.success(`Returning guest found: ${data.name}`, { icon: '👋', duration: 2000 });
      }
    } catch {
      // Fail silently for auto-lookup to not disturb UX
    } finally {
      setSearching(false);
    }
  }

  function handleRoomChange(index: number, roomId: string) {
    const room = rooms.find(r => r.id === roomId);
    updateEntry(index, { roomId, roomPrice: room ? Number(room.roomType.basePrice) : 0 });
  }

  function updateEntry(index: number, patch: Partial<RoomEntry>) {
    setRoomEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
  }

  function addRoom() {
    setRoomEntries(prev => [...prev, emptyRoomEntry()]);
  }

  function removeRoom(index: number) {
    if (roomEntries.length <= 2) { toast.error('A group booking requires at least 2 rooms'); return; }
    setRoomEntries(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!guestPhone || guestPhone.length < 10) { toast.error('Valid phone number is required'); return; }
    if (!leadGuestName || leadGuestName.length < 3) { toast.error('Lead guest name is required'); return; }

    // Validate all room entries
    for (let i = 0; i < roomEntries.length; i++) {
      const entry = roomEntries[i];
      if (!entry.roomId) { toast.error(`Please select a room for entry ${i + 1}`); return; }
      if (!entry.expectedCheckout) { toast.error(`Please set a checkout date for room ${i + 1}`); return; }
      if (new Date(entry.expectedCheckout) <= new Date(entry.checkInDate)) {
        toast.error(`Room ${i + 1}: Checkout must be after check-in`); return;
      }
      if (Number(entry.roomPrice) <= 0) { toast.error(`Room ${i + 1}: Price must be positive`); return; }
    }

    // Guard: duplicate room selection
    const selectedRoomIds = roomEntries.map(e => e.roomId);
    if (new Set(selectedRoomIds).size !== selectedRoomIds.length) {
      toast.error('You have selected the same room twice. Each room must be unique.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        leadGuestPhone: guestPhone,
        leadGuestName: isReturning ? undefined : leadGuestName,
        notes: notes || undefined,
        rooms: roomEntries.map(entry => ({
          roomId: entry.roomId,
          checkInDate: new Date(entry.checkInDate).toISOString(),
          expectedCheckout: new Date(entry.expectedCheckout).toISOString(),
          roomPrice: Number(entry.roomPrice),
          numberOfGuests: Number(entry.numberOfGuests) || 1,
          specialRequests: entry.specialRequests || undefined,
          advanceAmount: Number(entry.advanceAmount) || 0,
          advanceMethod: entry.advanceMethod,
        })),
      };

      const { data } = await groupBookingsApi.create(payload);
      toast.success(`Group booking ${data.groupNumber} created with ${roomEntries.length} rooms!`);
      navigate(`/bookings/group/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create group booking');
    } finally { setLoading(false); }
  }

  const selectedRoomIds = roomEntries.map(e => e.roomId);
  const availableRoomsFor = (index: number) =>
    rooms.filter(r => !selectedRoomIds.includes(r.id) || selectedRoomIds[index] === r.id);

  return (
    <div className="animate-fadeIn max-w-4xl">
      <button onClick={() => navigate(-1)} className="btn btn-ghost mb-4"><ArrowLeft size={18} /> Back</button>
      <div className="flex items-center gap-3 mb-1">
        <Users size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">New Group Check-in</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6 ml-9">Book multiple rooms under one lead guest</p>

      <form onSubmit={handleSubmit}>
        {/* Lead Guest */}
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Lead Guest (Payer)</h3>
            {isReturning && <span className="text-emerald-600 text-xs font-medium flex items-center gap-1"><UserCheck size={14} /> Returning Guest</span>}
            {searching && <div className="animate-spin h-3 w-3 border-2 border-primary-600 border-t-transparent rounded-full ml-2" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number *</label>
              <input
                className="input"
                placeholder="Enter 10-digit number..."
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                className="input"
                placeholder="Guest's full name"
                value={leadGuestName}
                onChange={e => {
                  setLeadGuestName(e.target.value);
                  if (isReturning) setIsReturning(false);
                }}
                required
              />
            </div>
          </div>
        </div>

        {/* Room Entries */}
        <div className="space-y-4 mb-6">
          {roomEntries.map((entry, index) => (
            <div key={index} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Room {index + 1}</h3>
                {roomEntries.length > 2 && (
                  <button type="button" onClick={() => removeRoom(index)} className="btn btn-ghost btn-sm text-red-500">
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Room *</label>
                  <SearchableSelect
                    options={availableRoomsFor(index).map(r => ({
                      id: r.id,
                      label: `Room ${r.roomNumber}`,
                      sublabel: `${r.roomType.name} (₹${Number(r.roomType.basePrice)}/night)`,
                    }))}
                    value={entry.roomId}
                    onChange={roomId => handleRoomChange(index, roomId)}
                    placeholder="Select room..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Rate / Night (₹) *</label>
                  <input
                    className="input" type="number" value={entry.roomPrice}
                    onChange={e => updateEntry(index, { roomPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Check-in Date *</label>
                  <input
                    className="input" type="date" value={entry.checkInDate}
                    onChange={e => updateEntry(index, { checkInDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Checkout Date *</label>
                  <input
                    className="input" type="date" value={entry.expectedCheckout}
                    onChange={e => updateEntry(index, { expectedCheckout: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Guests in Room</label>
                  <input
                    className="input" type="number" min={1} value={entry.numberOfGuests}
                    onChange={e => updateEntry(index, { numberOfGuests: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Advance Payment (₹)</label>
                  <input
                    className="input" type="number" min={0} value={entry.advanceAmount}
                    onChange={e => updateEntry(index, { advanceAmount: e.target.value })}
                  />
                </div>
              </div>
              {entry.advanceAmount && Number(entry.advanceAmount) > 0 ? (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Advance Method</label>
                  <select
                    className="input max-w-[200px]"
                    value={entry.advanceMethod}
                    onChange={e => updateEntry(index, { advanceMethod: e.target.value as any })}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              ) : null}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">Special Requests</label>
                <input
                  className="input" value={entry.specialRequests}
                  placeholder="Any special requirements for this room..."
                  onChange={e => updateEntry(index, { specialRequests: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Room Button */}
        <button type="button" onClick={addRoom} className="btn btn-outline w-full mb-6">
          <Plus size={16} /> Add Another Room
        </button>

        {/* Notes */}
        <div className="card p-5 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Group Notes (Optional)</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Family of 8 — anniversary stay, extra towels needed..." />
        </div>

        {/* Summary Bar */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{roomEntries.length} rooms</span> selected ·{' '}
            Total estimate: <span className="font-semibold text-primary-600">
              ₹{roomEntries.reduce((s, e) => {
                if (!e.checkInDate || !e.expectedCheckout) return s;
                const nights = Math.max(1, Math.ceil((new Date(e.expectedCheckout).getTime() - new Date(e.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
                return s + (Number(e.roomPrice) * nights);
              }, 0).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-gray-400">Taxes not included</p>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1 btn-lg">
            {loading ? 'Creating Group...' : 'Create Group Check-in'}
          </button>
        </div>
      </form>
    </div>
  );
}