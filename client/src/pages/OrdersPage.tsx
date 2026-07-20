import { useEffect, useState } from 'react';
import { ordersApi, menuApi } from '../api';
import type { Order, MenuCategory } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useDialog } from '../contexts/DialogContext';
import { Search, CheckCircle, XCircle, Plus, Minus, Trash2, X, PlusCircle, ShoppingBag, Edit } from 'lucide-react';

const statusBadge: Record<string, string> = { 
  ACTIVE: 'badge-green', 
  COMPLETED: 'badge-gray', 
  CANCELLED: 'badge-red' 
};

export default function OrdersPage() {
  const { prompt } = useDialog();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Modal States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showAddItems, setShowAddItems] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [addQuantities, setAddQuantities] = useState<Record<string, number>>({});
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => { load(); }, [filter]);

  async function load() {
    try {
      const params: any = {};
      if (filter) params.status = filter;
      const { data } = await ordersApi.getAll(params);
      setOrders(data);
    } catch {} finally { setLoading(false); }
  }

  async function openOrderDetails(order: Order) {
    setSelectedOrder(order);
    setShowAddItems(false);
    setMenuSearch('');
    if (categories.length === 0) {
      try {
        const { data } = await menuApi.getCategories();
        setCategories(data);
        if (data.length > 0) setActiveCat(data[0].id);
      } catch {
        toast.error('Failed to load menu catalog');
      }
    }
  }

  async function refreshSelectedOrder(orderId: string) {
    try {
      const { data } = await ordersApi.getById(orderId);
      setSelectedOrder(data);
      load(); // Reload background list
    } catch {
      toast.error('Failed to refresh order details');
    }
  }

  async function completeOrder(id: string) {
    try { 
      await ordersApi.complete(id); 
      toast.success('Order completed'); 
      if (selectedOrder?.id === id) {
        setSelectedOrder(null);
      }
      load(); 
    } catch (e: any) { 
      toast.error(e.response?.data?.error || 'Failed to complete order'); 
    }
  }

  async function cancelOrder(id: string) {
    const reason = await prompt({
      title: 'Cancel Order',
      message: 'Please enter a cancellation reason (optional).',
      placeholder: 'Cancellation reason',
      confirmText: 'Cancel Order',
      variant: 'danger'
    });
    if (reason === null) return;
    try { 
      await ordersApi.cancel(id, reason || undefined); 
      toast.success('Order cancelled'); 
      if (selectedOrder?.id === id) {
        setSelectedOrder(null);
      }
      load(); 
    } catch (e: any) { 
      toast.error(e.response?.data?.error || 'Failed to cancel order'); 
    }
  }

  async function handleAddItem(menuItemId: string) {
    if (!selectedOrder) return;
    const qty = addQuantities[menuItemId] || 1;
    try {
      await ordersApi.addItem(selectedOrder.id, { menuItemId, quantity: qty });
      toast.success('Item added to order');
      setAddQuantities(prev => ({ ...prev, [menuItemId]: 1 }));
      await refreshSelectedOrder(selectedOrder.id);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to add item');
    }
  }

  async function handleCancelItem(itemId: string) {
    if (!selectedOrder) return;
    const reason = await prompt({
      title: 'Void/Cancel Item',
      message: 'Please enter a reason for voiding or cancelling this item.',
      placeholder: 'Cancellation reason',
      required: true,
      confirmText: 'Cancel Item',
      variant: 'danger'
    });
    if (reason === null) return;
    try {
      await ordersApi.cancelItem(selectedOrder.id, itemId, reason);
      toast.success('Item cancelled successfully');
      await refreshSelectedOrder(selectedOrder.id);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to cancel item');
    }
  }

  function updateAddQty(menuItemId: string, delta: number) {
    setAddQuantities(prev => {
      const current = prev[menuItemId] || 1;
      return { ...prev, [menuItemId]: Math.max(1, current + delta) };
    });
  }

  const filtered = orders.filter(o => !search || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || (o.room?.roomNumber || '').includes(search));

  const activeCategory = categories.find(c => c.id === activeCat);
  const filteredMenuItems = activeCategory?.items.filter(item => 
    !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase())
  ) || [];

  return (
    <div className="animate-fadeIn">
      <div className="print:hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">Manage restaurant orders and room service billing</p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search order no. or room..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {['', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filter === s ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>{s || 'All Statuses'}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card overflow-hidden border border-gray-150/60 animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-14" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-12" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-10" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-24" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-14" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-12" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-16" /></th>
                  <th className="px-5 py-3.5"><div className="h-3 bg-gray-200 rounded-md w-28" /></th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, rIdx) => (
                  <tr key={rIdx} className="h-16">
                    <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-16" /></td>
                    <td className="px-5 py-4"><div className="h-5 bg-gray-200 rounded-full w-14" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-10" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-28" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-12" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-16" /></td>
                    <td className="px-5 py-4"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                    <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded-md w-32" /></td>
                    <td className="px-5 py-4"><div className="h-8 bg-gray-100 rounded-lg w-16" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Order</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Room</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Customer</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Items</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50/55 transition-colors cursor-pointer" onClick={() => openOrderDetails(o)}>
                    <td className="px-5 py-4 text-sm font-mono text-primary-600 font-semibold whitespace-nowrap">{o.orderNumber}</td>
                    <td className="px-5 py-4 whitespace-nowrap"><span className="badge badge-blue">{o.type.replace('_', ' ')}</span></td>
                    <td className="px-5 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">{o.room?.roomNumber || '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{o.customerName || '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{o.items.filter(i => !i.isCancelled).length} active</td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">₹{Number(o.total).toLocaleString()}</td>
                    <td className="px-5 py-4 whitespace-nowrap"><span className={`badge ${statusBadge[o.status]}`}>{o.status}</span></td>
                    <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{format(new Date(o.createdAt), 'dd MMM, hh:mm a')}</td>
                    <td className="px-5 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openOrderDetails(o)} className="btn btn-ghost btn-sm text-primary-600" title="View & Edit"><Edit size={16} /></button>
                        {o.status === 'ACTIVE' && (
                          <>
                            <button onClick={() => completeOrder(o.id)} className="btn btn-ghost btn-sm text-emerald-600" title="Complete"><CheckCircle size={16} /></button>
                            <button onClick={() => cancelOrder(o.id)} className="btn btn-ghost btn-sm text-red-500" title="Cancel"><XCircle size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-12">No orders found</p>}
        </div>
      )}

      {/* Details & Live Modification Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div 
            className={`bg-white rounded-3xl p-6 w-full shadow-2xl transition-all duration-300 ${showAddItems ? 'max-w-4xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3.5">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Order {selectedOrder.orderNumber}
                  <span className={`badge ${statusBadge[selectedOrder.status]}`}>{selectedOrder.status}</span>
                </h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  {selectedOrder.type.replace('_', ' ')} order 
                  {selectedOrder.room ? ` for Room ${selectedOrder.room.roomNumber}` : selectedOrder.customerName ? ` for ${selectedOrder.customerName}` : ''}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Left Column: Order Bill Summary & Modification */}
              <div className="flex-1 space-y-4">
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/30">
                  <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-1.5">
                    <ShoppingBag size={15} /> Order Items
                  </h4>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {selectedOrder.items.map(item => (
                      <div key={item.id} className={`flex items-start justify-between text-sm py-2 border-b border-gray-50 last:border-0 ${item.isCancelled ? 'opacity-55' : ''}`}>
                        <div className="min-w-0 flex-1 pr-3">
                          <p className={`font-semibold text-gray-800 truncate ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                            {item.menuItem.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            ₹{Number(item.unitPrice)} × {item.quantity}
                          </p>
                          {item.isCancelled && (
                            <p className="text-[11px] font-medium text-red-500 mt-1 italic">
                              Voided: "{item.cancelReason}"
                            </p>
                          )}
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className={`font-bold text-gray-900 ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                            ₹{Number(item.totalPrice).toLocaleString()}
                          </span>
                          {!item.isCancelled && selectedOrder.status === 'ACTIVE' && (
                            <button 
                              onClick={() => handleCancelItem(item.id)}
                              className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-colors"
                              title="Void Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Computations */}
                <div className="border border-gray-100 rounded-2xl p-4 space-y-2 bg-gray-50/10">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>₹{Number(selectedOrder.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>GST (5%)</span>
                    <span>₹{Number(selectedOrder.tax).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2">
                    <span>Total Bill</span>
                    <span>₹{Number(selectedOrder.total).toLocaleString()}</span>
                  </div>
                </div>

                {/* Operations */}
                <div className="flex gap-2">
                  {selectedOrder.status === 'ACTIVE' && (
                    <>
                      <button 
                        onClick={() => setShowAddItems(!showAddItems)}
                        className="btn btn-outline btn-sm flex-1 flex items-center justify-center gap-1.5"
                      >
                        <PlusCircle size={15} /> {showAddItems ? 'Hide Menu' : 'Add Items'}
                      </button>
                      <button 
                        onClick={() => completeOrder(selectedOrder.id)}
                        className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle size={15} /> Complete
                      </button>
                      <button 
                        onClick={() => cancelOrder(selectedOrder.id)}
                        className="btn btn-danger btn-sm text-white flex items-center justify-center gap-1"
                        title="Cancel Order"
                      >
                        <XCircle size={15} /> Cancel Bill
                      </button>
                    </>
                  )}
                  {selectedOrder.status !== 'ACTIVE' && (
                    <>
                      <button 
                        onClick={() => window.print()} 
                        className="btn btn-primary btn-sm flex-1"
                      >
                        Print Bill / Receipt
                      </button>
                      <button 
                        onClick={() => setSelectedOrder(null)} 
                        className="btn btn-outline btn-sm flex-1"
                      >
                        Close Details
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Menu Catalog for adding items */}
              {showAddItems && selectedOrder.status === 'ACTIVE' && (
                <div className="w-full md:w-[420px] border-t md:border-t-0 md:border-l border-gray-100 pt-5 md:pt-0 md:pl-6 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-sm text-gray-900">Add Menu Items</h4>
                    <div className="relative max-w-[180px]">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        className="input pl-8 py-1 text-xs" 
                        placeholder="Search menu..." 
                        value={menuSearch} 
                        onChange={e => setMenuSearch(e.target.value)} 
                      />
                    </div>
                  </div>

                  {/* Category tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {categories.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => setActiveCat(cat.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeCat === cat.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {/* Item Grid */}
                  <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                    {filteredMenuItems.map(item => {
                      const qty = addQuantities[item.id] || 1;
                      return (
                        <div key={item.id} className="p-3 border border-gray-100 rounded-xl flex items-center justify-between hover:border-primary-100 transition-colors bg-white">
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-sm inline-block ${item.isVeg ? 'border border-green-500' : 'border border-red-500'}`}>
                                <span className={`block w-1 h-1 rounded-full m-[1px] ${item.isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
                              </span>
                              <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                            </div>
                            <p className="text-xs font-semibold text-primary-600 mt-0.5">₹{Number(item.price)}</p>
                          </div>
                          
                          {/* Quantity Selector + Add Button */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg p-0.5">
                              <button 
                                onClick={() => updateAddQty(item.id, -1)}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-white transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="w-5 text-center text-xs font-bold">{qty}</span>
                              <button 
                                onClick={() => updateAddQty(item.id, 1)}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-white transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                            <button 
                              onClick={() => handleAddItem(item.id)}
                              className="btn btn-primary py-1 px-2.5 text-xs rounded-lg flex items-center gap-1"
                              title="Add to Order"
                            >
                              <Plus size={12} /> Add
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredMenuItems.length === 0 && (
                      <p className="text-center text-xs text-gray-400 py-6">No items found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      {/* Hidden Print Layout for Receipt */}
      {selectedOrder && (
        <div className="hidden print:block bg-white p-6 absolute top-0 left-0 w-full min-h-screen text-black font-sans">
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">GODIVA RESTAURANT</h1>
            <p className="text-xs text-gray-500">Unit of Godiva Rooms</p>
            <p className="text-xs text-gray-500 mt-1">Receipt / Tax Invoice</p>
          </div>
          
          <div className="space-y-1 text-xs mb-4">
            <div className="flex justify-between"><span>Bill No:</span><span className="font-semibold">{selectedOrder.orderNumber}</span></div>
            <div className="flex justify-between"><span>Date:</span><span>{format(new Date(selectedOrder.createdAt), 'dd MMM yyyy, hh:mm a')}</span></div>
            <div className="flex justify-between"><span>Type:</span><span className="font-semibold">{selectedOrder.type}</span></div>
            {selectedOrder.room && <div className="flex justify-between"><span>Room:</span><span className="font-semibold">Room {selectedOrder.room.roomNumber}</span></div>}
            {selectedOrder.customerName && <div className="flex justify-between"><span>Customer:</span><span>{selectedOrder.customerName}</span></div>}
            {selectedOrder.createdBy && <div className="flex justify-between"><span>Cashier:</span><span>{selectedOrder.createdBy.name}</span></div>}
          </div>

          <table className="w-full text-xs border-t border-b border-dashed border-gray-400 py-2 my-2">
            <thead>
              <tr className="border-b border-dashed border-gray-300">
                <th className="text-left py-1">Item Description</th>
                <th className="text-center py-1">Qty</th>
                <th className="text-right py-1">Rate (₹)</th>
                <th className="text-right py-1">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.items.map(item => !item.isCancelled && (
                <tr key={item.id}>
                  <td className="py-1">{item.menuItem.name}</td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-right py-1">{Number(item.unitPrice).toFixed(2)}</td>
                  <td className="text-right py-1">{Number(item.totalPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-xs border-b border-dashed border-gray-400 pb-2 mb-2">
            <div className="flex justify-between"><span>Subtotal:</span><span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>CGST (2.5%):</span><span>₹{(Number(selectedOrder.tax) / 2).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>SGST (2.5%):</span><span>₹{(Number(selectedOrder.tax) / 2).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-300">
              <span>Grand Total:</span>
              <span>₹{Number(selectedOrder.total).toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-500 mt-6 pt-4 border-t border-dashed">
            <p>Thank you for dining with us!</p>
            <p>Please visit again.</p>
          </div>
        </div>
      )}
    </div>
  );
}
