import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomsPage from './pages/RoomsPage';
import BookingsPage from './pages/BookingsPage';
import NewBookingPage from './pages/NewBookingPage';
import BookingDetailPage from './pages/BookingDetailPage';
import POSPage from './pages/POSPage';
import OrdersPage from './pages/OrdersPage';
import GuestsPage from './pages/GuestsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import StaffPage from './pages/StaffPage';
import AuditPage from './pages/AuditPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes inside Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            
            {/* Rooms & Bookings (Admin & Reception) */}
            <Route element={<ProtectedRoute roles={['ADMIN', 'RECEPTION']} />}>
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/bookings/new" element={<NewBookingPage />} />
              <Route path="/bookings/:id" element={<BookingDetailPage />} />
              <Route path="/guests" element={<GuestsPage />} />
            </Route>

            {/* Restaurant POS (All roles) */}
            <Route path="/pos" element={<POSPage />} />
            <Route path="/orders" element={<OrdersPage />} />

            {/* Admin Only */}
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/audit" element={<AuditPage />} />
            </Route>
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
