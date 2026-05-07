import { useEffect, useState } from 'react';
import { roomsApi, menuApi } from '../api';
import type { Room, RoomType } from '../types';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, BedDouble, Ban, Sparkles, Lock, Search, Filter } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

const statusConfig: Record<string, { label: string; badge: string; bg: string }> = {
  AVAILABLE: { label: 'Available', badge: 'badge-green', bg: 'bg-status-available-bg border-status-available-text/20' },
  OCCUPIED: { label: 'Occupied', badge: 'badge-blue', bg: 'bg-status-occupied-bg border-status-occupied-text/20' },
  CLEANING: { label: 'Cleaning', badge: 'badge-yellow', bg: 'bg-status-cleaning-bg border-status-cleaning-text/20' },
  BLOCKED: { label: 'Blocked', badge: 'badge-red', bg: 'bg-status-blocked-bg border-status-blocked-text/20' },
};

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
  const [blockReason, setBlockReason] = useState('');

  // Add room form state
  const [newRoom, setNewRoom] = useState({ roomNumber: '', floor: 1, roomTypeId: '' });

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
    if (!newRoom.roomNumber) { toast.error('Room number required'); return; }
    try {
      await roomsApi.create(newRoom);
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
    if (!blockReason) { toast.error('Reason required'); return; }
    try {
      await roomsApi.block(id, { reason: blockReason });
      toast.success('Room blocked');
      setShowBlock(null);
      setBlockReason('');
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

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your {rooms.length} rooms</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus size={18} /> Add Room
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search rooms..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(counts).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
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
                    if (room.status === 'AVAILABLE') navigate('/bookings/new', { state: { roomId: room.id, roomNumber: room.roomNumber, roomPrice: Number(room.roomType.basePrice) } });
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
                <input type="number" min={1} className="input" value={newRoom.floor} onChange={e => setNewRoom(p => ({ ...p, floor: parseInt(e.target.value) || 1 }))} />
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

      {/* Block Modal */}
      {showBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBlock(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Block Room</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input className="input" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Maintenance, reserved, etc." />
            </div>
            <div className="flex gap-3 pt-4">
              <button className="btn btn-outline flex-1" onClick={() => setShowBlock(null)}>Cancel</button>
              <button className="btn btn-danger flex-1" onClick={() => handleBlock(showBlock)}>Block Room</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
