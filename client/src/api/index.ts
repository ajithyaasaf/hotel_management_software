import axios from 'axios';

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || '/api' 
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── AUTH ─────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  getUsersByDepartment: () => api.get('/auth/users-by-department'),
};

// ─── ROOMS ────────────────────────────────────────
export const roomsApi = {
  getAll: () => api.get('/rooms'),
  getAvailable: () => api.get('/rooms/available'),
  getById: (id: string) => api.get(`/rooms/${id}`),
  create: (data: any) => api.post('/rooms', data),
  update: (id: string, data: any) => api.put(`/rooms/${id}`, data),
  updateStatus: (id: string, status: string) => api.put(`/rooms/${id}/status`, { status }),
  block: (id: string, data: any) => api.put(`/rooms/${id}/block`, data),
  unblock: (id: string) => api.put(`/rooms/${id}/unblock`),
  delete: (id: string) => api.delete(`/rooms/${id}`),
};

// ─── GUESTS ───────────────────────────────────────
export const guestsApi = {
  getAll: (search?: string) => api.get('/guests', { params: { search } }),
  search: (phone: string) => api.get('/guests/search', { params: { phone } }),
  getById: (id: string) => api.get(`/guests/${id}`),
  update: (id: string, data: any) => api.put(`/guests/${id}`, data),
};

// ─── BOOKINGS ─────────────────────────────────────
export const bookingsApi = {
  getAll: (params?: any) => api.get('/bookings', { params }),
  getActive: () => api.get('/bookings/active'),
  getById: (id: string) => api.get(`/bookings/${id}`),
  create: (data: any) => api.post('/bookings', data),
  extend: (id: string, data: any) => api.put(`/bookings/${id}/extend`, data),
  transfer: (id: string, data: any) => api.put(`/bookings/${id}/transfer`, data),
  checkin: (id: string) => api.put(`/bookings/${id}/checkin`),
  checkout: (id: string) => api.put(`/bookings/${id}/checkout`),
  cancel: (id: string, reason?: string) => api.put(`/bookings/${id}/cancel`, { reason }),
  noShow: (id: string) => api.put(`/bookings/${id}/noshow`),
};

// ─── ORDERS ───────────────────────────────────────
export const ordersApi = {
  getAll: (params?: any) => api.get('/orders', { params }),
  getActive: () => api.get('/orders/active'),
  getById: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  addItem: (id: string, data: any) => api.post(`/orders/${id}/items`, data),
  cancelItem: (id: string, itemId: string, reason?: string) => api.delete(`/orders/${id}/items/${itemId}`, { data: { reason } }),
  complete: (id: string) => api.put(`/orders/${id}/complete`),
  cancel: (id: string, reason?: string) => api.put(`/orders/${id}/cancel`, { reason }),
};

// ─── INVOICES ─────────────────────────────────────
export const invoicesApi = {
  getById: (id: string) => api.get(`/invoices/${id}`),
  getByBooking: (bookingId: string) => api.get(`/invoices/booking/${bookingId}`),
  addAdjustment: (id: string, data: any) => api.post(`/invoices/${id}/adjustments`, data),
  recalculate: (id: string) => api.post(`/invoices/${id}/recalculate`),
};

// ─── PAYMENTS ─────────────────────────────────────
export const paymentsApi = {
  getByBooking: (bookingId: string) => api.get(`/payments/booking/${bookingId}`),
  create: (data: any) => api.post('/payments', data),
};

// ─── MENU & SETTINGS ─────────────────────────────
export const menuApi = {
  getCategories: () => api.get('/menu/categories'),
  createCategory: (data: any) => api.post('/menu/categories', data),
  updateCategory: (id: string, data: any) => api.put(`/menu/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/menu/categories/${id}`),
  getItems: (params?: any) => api.get('/menu/items', { params }),
  createItem: (data: any) => api.post('/menu/items', data),
  updateItem: (id: string, data: any) => api.put(`/menu/items/${id}`, data),
  deleteItem: (id: string) => api.delete(`/menu/items/${id}`),
  getRoomTypes: () => api.get('/menu/room-types'),
  createRoomType: (data: any) => api.post('/menu/room-types', data),
  updateRoomType: (id: string, data: any) => api.put(`/menu/room-types/${id}`, data),
  deleteRoomType: (id: string) => api.delete(`/menu/room-types/${id}`),
  getTaxConfig: () => api.get('/menu/tax-config'),
};

// ─── USERS ────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// ─── REPORTS ──────────────────────────────────────────
export const reportsApi = {
  summary: (params?: any) => api.get('/reports/summary', { params }),
  revenueDaily: (params?: any) => api.get('/reports/revenue-daily', { params }),
  policeCheckins: (params: any) => api.get('/reports/police-checkins', { params }),
  occupancy: () => api.get('/reports/occupancy'),
};

// ─── AUDIT ────────────────────────────────────────────
export const auditApi = {
  getAll: (params?: any) => api.get('/audit', { params }),
  getActions: (params?: any) => api.get('/audit/actions', { params }),
  getEntities: () => api.get('/audit/entities'),
};

// ─── PERMISSIONS ──────────────────────────────────────
export const permissionsApi = {
  getAll: () => api.get('/permissions'),
  getMatrix: () => api.get('/permissions/matrix'),
  grant: (role: string, permissionCode: string) => api.put('/permissions/grant', { role, permissionCode }),
  revoke: (role: string, permissionCode: string) => api.put('/permissions/revoke', { role, permissionCode }),
};

// ─── CANCELLATIONS ────────────────────────────────────
export const cancellationsApi = {
  getAll: (params?: any) => api.get('/cancellations', { params }),
  getPendingCount: () => api.get('/cancellations/pending/count'),
  approve: (id: string, note?: string) => api.put(`/cancellations/${id}/approve`, { note }),
  reject: (id: string, note?: string) => api.put(`/cancellations/${id}/reject`, { note }),
};

// ─── EXPENSES ─────────────────────────────────────────
export const expensesApi = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  getSummary: (params?: any) => api.get('/expenses/summary', { params }),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
};

// ─── GROUP BOOKINGS ───────────────────────────────────
export const groupBookingsApi = {
  getAll: (params?: any) => api.get('/group-bookings', { params }),
  getById: (id: string) => api.get(`/group-bookings/${id}`),
  getMasterInvoice: (id: string) => api.get(`/group-bookings/${id}/master-invoice`),
  create: (data: any) => api.post('/group-bookings', data),
  checkoutAll: (id: string) => api.post(`/group-bookings/${id}/checkout-all`),
  unlinkBooking: (groupId: string, bookingId: string) => api.delete(`/group-bookings/${groupId}/unlink/${bookingId}`),
};

// ─── NIGHT AUDIT ──────────────────────────────────────
export const nightAuditApi = {
  getStatus: () => api.get('/night-audit/status'),
  getPreCheck: () => api.get('/night-audit/pre-check'),
  run: (data: { notes?: string; password?: string }) => api.post('/night-audit/run', data),
  getHistory: () => api.get('/night-audit/history'),
  getById: (id: string) => api.get(`/night-audit/${id}`),
};

// ─── COMPANIES ────────────────────────────────────────
export const companiesApi = {
  getAll: () => api.get('/companies'),
  getById: (id: string) => api.get(`/companies/${id}`),
  create: (data: any) => api.post('/companies', data),
  update: (id: string, data: any) => api.put(`/companies/${id}`, data),
  recordPayment: (id: string, data: { amount: number; method: string; referenceNo: string }) => 
    api.post(`/companies/${id}/payments`, data),
};

// ─── BANQUETS ─────────────────────────────────────────
export const banquetsApi = {
  getHalls: (params?: any) => api.get('/banquets/halls', { params }),
  getHallById: (id: string) => api.get(`/banquets/halls/${id}`),
  createHall: (data: any) => api.post('/banquets/halls', data),
  updateHall: (id: string, data: any) => api.put(`/banquets/halls/${id}`, data),
  // Availability
  checkAvailability: (hallId: string, date: string) =>
    api.get('/banquets/bookings/availability', { params: { hallId, date } }),
  // Bookings
  getBookings: (params?: any) => api.get('/banquets', { params }),
  getBookingById: (id: string) => api.get(`/banquets/${id}`),
  createBooking: (data: any) => api.post('/banquets', data),
  confirmBooking: (id: string) => api.put(`/banquets/${id}/confirm`),
  completeBooking: (id: string) => api.put(`/banquets/${id}/complete`),
  cancelBooking: (id: string, reason?: string) => api.put(`/banquets/${id}/cancel`, { reason }),
  // Payments
  recordPayment: (id: string, data: any) => api.post(`/banquets/${id}/payments`, data),
};
