import { useEffect, useState } from 'react';
import { roomsApi, menuApi } from '../api';
import type { Room, RoomType } from '../types';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, BedDouble, Ban, Sparkles, Lock, Search, Filter, Users } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { localDateTimeToIST } from '../utils/dateTime';

const statusConfig: Record<string, { label: string; badge: string; bg: string }> = {
  AVAILABLE: { label: 'Available', badge: 'badge-green', bg: 'bg-status-available-bg border-status-available-text/20' },
  OCCUPIED: { label: 'Occupied', badge: 'badge-blue', bg: 'bg-status-occupied-bg border-status-occupied-text/20' },
  CLEANING: { label: 'Cleaning', badge: 'badge-yellow', bg: 'bg-status-cleaning-bg border-status-cleaning-text/20' },
  BLOCKED: { label: 'Blocked', badge: 'badge-red', bg: 'bg-status-blocked-bg border-status-blocked-text/20' },
};

interface NewRoomForm {
  roomNumber: string;
  floor: number | string;
  roomTypeId: string;
}

export default function RoomsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showBlock, setShowBlock] = useState<string | null>(null);
  const [showCheckInOptions, setShowCheckInOptions] = useState<Room | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');

  // Add room form state
  const [newRoom, setNewRoom] = useState<NewRoomForm>({ roomNumber: '', floor: 1, roomTypeId: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [r, rt] = await Promise.all([roomsApi.getAll(), menuApi.getRoomTypes()]);
      setRooms(r.data);
      setRoomTypes(rt.data);
      if (rt.data.length > 0 && !newRoom.roomTypeId) setNewRoom(p => ({ ...p, roomTypeId: rt.data[0].id }));
    } catch { toast.error('Failed to load rooms'); }
    finally { setLoading(false); }
  }

  async function handleAddRoom() {
    if (!newRoom.roomNumber) { toast.error('Room number is required'); return; }
    if (Number(newRoom.floor) <= 0) { toast.error('Please enter a valid floor number'); return; }
    try {
      const payload = { ...newRoom, floor: Number(newRoom.floor) || 1 };
      await roomsApi.create(payload);
      toast.success('Room created');
      setShowAdd(false);
      setNewRoom({ roomNumber: '', floor: 1, roomTypeId: roomTypes[0]?.id || '' });
      loadData();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await roomsApi.updateStatus(id, status);
      toast.success('Status updated');
      loadData();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function handleBlock(id: string) {
    if (!blockReason || blockReason.length < 5) { toast.error('Please provide a descriptive reason (min 5 characters)'); return; }
    try {
      const payload: any = { reason: blockReason };
      // Attach IST offset to datetime-local strings so cloud UTC server stores the
      // correct block times (Section 12 fix — prevents 5.5-hour forward shift)
      if (blockStart) payload.blockStart = localDateTimeToIST(blockStart);
      if (blockEnd) payload.blockEnd = localDateTimeToIST(blockEnd);
      await roomsApi.block(id, payload);
      toast.success('Room blocked');
      setShowBlock(null);
      setBlockReason('');
      setBlockStart('');
      setBlockEnd('');
      loadData();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  async function handleUnblock(id: string) {
    try {
      await roomsApi.unblock(id);
      toast.success('Room unblocked');
      loadData();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  }

  const filtered = rooms
    .filter(r => filter === 'ALL' || r.status === filter)
    .filter(r => !search || r.roomNumber.includes(search) || r.roomType.name.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    ALL: rooms.length,
    AVAILABLE: rooms.filter(r => r.status === 'AVAILABLE').length,
    OCCUPIED: rooms.filter(r => r.status === 'OCCUPIED').length,
    CLEANING: rooms.filter(r => r.status === 'CLEANING').length,
    BLOCKED: rooms.filter(r => r.status === 'BLOCKED').length,
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse p-1">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-28 bg-gray-200 rounded-lg" />
            <div className="h-4 w-40 bg-gray-150 rounded-md" />
          </div>
          <div className="h-10 w-28 bg-gray-200 rounded-xl" />
        </div>

        {/* Filters Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-64 bg-gray-200 rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Floor Sections Skeletons */}
        {[1, 2].map(floor => (
          <div key={floor} className="space-y-4">
            <div className="h-4 w-24 bg-gray-200 rounded-md" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {Array.from({ length: floor === 1 ? 7 : 5 }).map((_, idx) => (
                <div key={idx} className="h-28 bg-gray-50/80 rounded-xl p-4 border border-gray-150/60 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-12 bg-gray-200 rounded-md" />
                    <div className="h-4 w-4 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-3 w-16 bg-gray-200 rounded-md" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your {rooms.length} rooms</p>
        </div>
        {user?.role === 'MD' && (
          <button onClick={() => setShowAdd(true)} className="btn btn-primary justify-center">
            <Plus size={18} /> Add Room
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search rooms..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0">
          {Object.entries(counts).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === key ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
            >
              {key === 'ALL' ? 'All' : statusConfig[key]?.label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Floor sections */}
      {[1, 2, 3, 4].map(floor => {
        const floorRooms = filtered.filter(r => r.floor === floor);
        if (floorRooms.length === 0) return null;
        return (
          <div key={floor} className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Floor {floor}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {floorRooms.map(room => (
                <div
                  key={room.id}
                  className={`card p-4 cursor-pointer border-l-4 transition-all hover:scale-[1.02] ${statusConfig[room.status]?.bg || ''}`}
                  onClick={() => {
                    if (room.status === 'AVAILABLE') setShowCheckInOptions(room);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-gray-900">{room.roomNumber}</span>
                    {room.status === 'OCCUPIED' && <BedDouble size={16} className="text-primary-600" />}
                    {room.status === 'CLEANING' && <Sparkles size={16} className="text-amber-500" />}
                    {room.status === 'BLOCKED' && <Lock size={16} className="text-red-500" />}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{room.roomType.name}</p>
                  <span className={`badge ${statusConfig[room.status]?.badge}`}>
                    {statusConfig[room.status]?.label}
                  </span>

                  {/* Actions */}
                  {room.status !== 'OCCUPIED' && (
                    <div className="flex gap-1 mt-3 pt-2 border-t border-gray-100">
                      {room.status === 'CLEANING' && (
                        <button className="btn btn-sm btn-ghost text-xs flex-1" onClick={e => { e.stopPropagation(); handleStatusChange(room.id, 'AVAILABLE'); }}>
                          Mark Ready
                        </button>
                      )}
                      {room.status === 'AVAILABLE' && (
                        <button className="btn btn-sm btn-ghost text-xs flex-1 text-red-500" onClick={e => { e.stopPropagation(); setShowBlock(room.id); }}>
                          <Ban size={12} /> Block
                        </button>
                      )}
                      {room.status === 'BLOCKED' && (
                        <button className="btn btn-sm btn-ghost text-xs flex-1 text-emerald-600" onClick={e => { e.stopPropagation(); handleUnblock(room.id); }}>
                          Unblock
                        </button>
                      )}
                    </div>
                  )}
                  {room.status === 'BLOCKED' && room.blockReason && (
                    <p className="text-xs text-red-400 mt-1 truncate">{room.blockReason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add Room Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Add New Room</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                <input className="input" value={newRoom.roomNumber} onChange={e => setNewRoom(p => ({ ...p, roomNumber: e.target.value }))} placeholder="e.g., 101" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input type="number" min={1} className="input" value={newRoom.floor} onChange={e => setNewRoom(p => ({ ...p, floor: e.target.value }))} />
              </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
              <SearchableSelect
                options={roomTypes.map(rt => ({ id: rt.id, label: rt.name, sublabel: `₹${Number(rt.basePrice).toLocaleString()}/night` }))}
                value={newRoom.roomTypeId}
                onChange={val => setNewRoom(p => ({ ...p, roomTypeId: val }))}
                placeholder="Select type..."
              />
            </div>
              <div className="flex gap-3 pt-2">
                <button className="btn btn-outline flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary flex-1" onClick={handleAddRoom}>Create Room</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Options Modal */}
      {showCheckInOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCheckInOptions(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xl">
                {showCheckInOptions.roomNumber}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Check-in Room {showCheckInOptions.roomNumber}</h3>
                <p className="text-sm text-gray-500">{showCheckInOptions.roomType.name}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button 
                className="btn btn-primary w-full justify-start gap-3 py-4 h-auto"
                onClick={() => navigate('/bookings/new', { state: { roomId: showCheckInOptions.id, roomNumber: showCheckInOptions.roomNumber, roomPrice: Number(showCheckInOptions.roomType.basePrice) } })}
              >
                <BedDouble size={20} />
                <div className="text-left">
                  <div className="font-bold">Single Booking</div>
                  <div className="text-[11px] font-normal opacity-80 text-primary-100">Quick check-in for one room</div>
                </div>
              </button>
              
              <button 
                className="btn btn-outline w-full justify-start gap-3 py-4 h-auto border-gray-200"
                onClick={() => navigate('/bookings/group/new', { state: { roomId: showCheckInOptions.id } })}
              >
                <Users size={20} className="text-primary-600" />
                <div className="text-left">
                  <div className="font-bold text-gray-900">Group Booking</div>
                  <div className="text-[11px] font-normal text-gray-500">Add multiple rooms to one bill</div>
                </div>
              </button>
              
              <button className="btn btn-ghost w-full text-gray-400 text-sm" onClick={() => setShowCheckInOptions(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Block Room Modal */}
      {showBlock && (() => {
        const roomToBlock = rooms.find(r => r.id === showBlock);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => {
            setShowBlock(null);
            setBlockReason('');
            setBlockStart('');
            setBlockEnd('');
          }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xl">
                  {roomToBlock?.roomNumber || ''}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Block Room {roomToBlock?.roomNumber}</h3>
                  <p className="text-sm text-gray-500">{roomToBlock?.roomType.name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block Reason <span className="text-red-500">*</span></label>
                  <textarea 
                    className="input min-h-[80px] py-2" 
                    value={blockReason} 
                    onChange={e => setBlockReason(e.target.value)} 
                    placeholder="e.g., Maintenance, deep cleaning, or guest issue (min 5 characters)"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time (Optional)</label>
                    <input 
                      type="datetime-local" 
                      className="input py-2 text-sm text-gray-700" 
                      value={blockStart} 
                      onChange={e => setBlockStart(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time (Optional)</label>
                    <input 
                      type="datetime-local" 
                      className="input py-2 text-sm text-gray-700" 
                      value={blockEnd} 
                      onChange={e => setBlockEnd(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="btn btn-outline flex-1" onClick={() => {
                    setShowBlock(null);
                    setBlockReason('');
                    setBlockStart('');
                    setBlockEnd('');
                  }}>
                    Cancel
                  </button>
                  <button className="btn btn-danger flex-1" onClick={() => handleBlock(showBlock)}>
                    Block Room
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
