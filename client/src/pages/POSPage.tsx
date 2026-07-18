import { useEffect, useState } from 'react';
import { menuApi, ordersApi, roomsApi } from '../api';
import type { MenuCategory, Room, Order } from '../types';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, Trash2, X, UtensilsCrossed, Send } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';

interface CartItem { menuItemId: string; name: string; price: number; quantity: number; }

export default function POSPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<'WALK_IN' | 'ROOM' | 'TAKEAWAY'>('WALK_IN');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [taxRate, setTaxRate] = useState(0.05);

  useEffect(() => {
    Promise.all([menuApi.getCategories(), roomsApi.getAll(), menuApi.getTaxConfig()])
      .then(([cRes, rRes, tRes]) => {
        setCategories(cRes.data);
        if (cRes.data.length > 0) setActiveCat(cRes.data[0].id);
        setRooms(rRes.data.filter((r: Room) => r.status === 'OCCUPIED'));
        const cgstConfig = tRes.data.find((t: any) => t.name === 'CGST');
        const sgstConfig = tRes.data.find((t: any) => t.name === 'SGST');
        const cgst = cgstConfig ? Number(cgstConfig.rate) / 100 : 0.025;
        const sgst = sgstConfig ? Number(sgstConfig.rate) / 100 : 0.025;
        setTaxRate(cgst + sgst);
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  function addToCart(item: { id: string; name: string; price: number }) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setCart(prev => prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  }

  function removeItem(menuItemId: string) { setCart(prev => prev.filter(c => c.menuItemId !== menuItemId)); }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const tax = parseFloat((subtotal * taxRate).toFixed(2));
  const total = subtotal + tax;

  async function submitOrder() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (orderType === 'ROOM' && !selectedRoom) { toast.error('Select a room'); return; }
    if (customerName && (customerName.length < 3 || /^\d+$/.test(customerName))) {
      toast.error('Enter a valid customer name (min 3 characters, no pure numbers)'); return;
    }
    setSubmitting(true);
    try {
      const { data } = await ordersApi.create({
        type: orderType,
        roomId: orderType === 'ROOM' ? selectedRoom : null,
        customerName: customerName || null,
        items: cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
      });
      toast.success(`Order ${data.orderNumber} placed!`);
      setCart([]);
      setCustomerName('');
    } catch (e: any) { toast.error(e.response?.data?.error || 'Order failed'); }
    finally { setSubmitting(false); }
  }

  const activeCategory = categories.find(c => c.id === activeCat);

  // Search: filter all menu items across all categories when a query exists
  const searchResults = search.trim()
    ? categories.flatMap(cat => (cat.items || []).filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase().trim()) && item.isAvailable
      ))
    : null;

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-100px)] p-1">
        {/* Menu Section Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 space-y-5">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-gray-200 rounded-lg" />
            <div className="h-4 w-48 bg-gray-150 rounded-md" />
          </div>
          {/* Order Types */}
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          {/* Category Tabs */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 bg-gray-50 rounded-xl p-4 border border-gray-150/60 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-4 bg-gray-200 rounded-sm" />
                    <div className="h-4 w-4 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-4 w-28 bg-gray-200 rounded-md" />
                  <div className="h-4 w-12 bg-gray-200 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Cart Section Skeleton */}
        <div className="w-full lg:w-[380px] flex flex-col card border border-gray-150/60 p-5 justify-between min-h-[400px]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="h-5 w-5 bg-gray-200 rounded-full" />
              <div className="h-5 w-28 bg-gray-200 rounded-md" />
              <div className="h-5 w-8 bg-gray-200 rounded-full ml-auto" />
            </div>
            {/* Cart Items List */}
            <div className="space-y-4 pt-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-gray-200 rounded-md" />
                    <div className="h-3 w-16 bg-gray-150 rounded-md" />
                  </div>
                  <div className="h-7 w-20 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          {/* Footer computation */}
          <div className="border-t border-gray-200 pt-5 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between"><div className="h-4 w-16 bg-gray-200 rounded-md" /><div className="h-4 w-12 bg-gray-200 rounded-md" /></div>
              <div className="flex justify-between"><div className="h-4 w-16 bg-gray-200 rounded-md" /><div className="h-4 w-10 bg-gray-200 rounded-md" /></div>
              <div className="flex justify-between border-t border-gray-100 pt-2"><div className="h-5 w-20 bg-gray-200 rounded-md font-bold" /><div className="h-5 w-16 bg-gray-200 rounded-md" /></div>
            </div>
            <div className="h-11 bg-gray-200 rounded-xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-100px)]">
      {/* Menu Section */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Restaurant POS</h1>
          <p className="text-gray-500 text-sm">Create and manage food orders</p>
        </div>

        {/* Order Type */}
        <div className="flex gap-2 mb-4">
          {(['WALK_IN', 'ROOM', 'TAKEAWAY'] as const).map(t => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${orderType === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        {orderType === 'ROOM' && (
          <div className="mb-4 max-w-xs">
            <SearchableSelect
              options={rooms.map(r => ({ id: r.id, label: `Room ${r.roomNumber}`, sublabel: r.roomType.name }))}
              value={selectedRoom}
              onChange={setSelectedRoom}
              placeholder="Search room..."
            />
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            className="input pl-9"
            placeholder="Search menu items across all categories..."
            value={search}
            onChange={e => { setSearch(e.target.value); }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>

        {/* Category tabs — hidden when searching */}
        {!search && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeCat === cat.id ? 'bg-primary-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto mb-6 lg:mb-0">
          {search && searchResults !== null && (
            <p className="text-xs text-gray-400 mb-3 font-medium">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(searchResults ?? activeCategory?.items ?? []).map(item => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="card p-4 text-left hover:scale-[1.02] transition-transform active:scale-95"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`w-3 h-3 rounded-sm ${item.isVeg ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}>
                    <span className={`block w-1.5 h-1.5 rounded-full m-[1px] ${item.isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
                  </span>
                  <Plus size={16} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">{item.name}</p>
                {searchResults && (
                  <p className="text-[10px] text-gray-400 mb-0.5">{categories.find(c => c.items?.some(i => i.id === item.id))?.name}</p>
                )}
                <p className="text-sm font-bold text-primary-600">₹{Number(item.price)}</p>
              </button>
            ))}
            {(searchResults?.length === 0) && (
              <div className="col-span-full text-center py-12 text-gray-400">
                <p className="text-sm">No items match "{search}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-[380px] flex flex-col card max-h-[600px] lg:max-h-none">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Current Order</h3>
          <span className="badge badge-blue ml-auto">{cart.length}</span>
        </div>

        {orderType !== 'ROOM' && (
          <div className="px-5 py-3 border-b border-gray-50">
            <input className="input" placeholder="Customer name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <UtensilsCrossed size={40} />
              <p className="text-sm mt-2">No items yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cart.map(item => (
                <div key={item.menuItemId} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">₹{item.price} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.menuItemId, -1)} className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.menuItemId, 1)} className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"><Plus size={14} /></button>
                  </div>
                  <p className="text-sm font-semibold w-16 text-right">₹{(item.price * item.quantity).toLocaleString()}</p>
                  <button onClick={() => removeItem(item.menuItemId)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-gray-200 p-5">
          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">GST ({(taxRate * 100).toFixed(1)}%)</span><span>₹{tax.toLocaleString()}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100"><span>Total</span><span>₹{total.toLocaleString()}</span></div>
          </div>
          <button
            onClick={submitOrder}
            disabled={cart.length === 0 || submitting}
            className="btn btn-primary w-full btn-lg"
          >
            <Send size={18} /> {submitting ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
