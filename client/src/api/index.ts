import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

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
    if (err.response?.status === 401) {
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
};

// ─── USERS ────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// ─── REPORTS ──────────────────────────────────────
export const reportsApi = {
  summary: (params?: any) => api.get('/reports/summary', { params }),
  revenueDaily: (params?: any) => api.get('/reports/revenue-daily', { params }),
  occupancy: () => api.get('/reports/occupancy'),
  audit: (params?: any) => api.get('/reports/audit', { params }),
};
