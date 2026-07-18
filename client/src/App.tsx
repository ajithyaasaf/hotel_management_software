import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh] w-full">
    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RoomsPage = lazy(() => import('./pages/RoomsPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const NewBookingPage = lazy(() => import('./pages/NewBookingPage'));
const BookingDetailPage = lazy(() => import('./pages/BookingDetailPage'));
const NewGroupBookingPage = lazy(() => import('./pages/NewGroupBookingPage'));
const GroupBookingDetailPage = lazy(() => import('./pages/GroupBookingDetailPage'));
const POSPage = lazy(() => import('./pages/POSPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const GuestsPage = lazy(() => import('./pages/GuestsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const NightAuditPage = lazy(() => import('./pages/NightAuditPage'));
const CorporateLedgerPage = lazy(() => import('./pages/CorporateLedgerPage'));
const BanquetsPage = lazy(() => import('./pages/BanquetsPage'));
const NewBanquetPage = lazy(() => import('./pages/NewBanquetPage'));
const BanquetDetailPage = lazy(() => import('./pages/BanquetDetailPage'));

import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes inside Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              
              {/* Rooms & Bookings */}
              <Route element={<ProtectedRoute permissions={['booking.view', 'room.view', 'guest.view', 'banquet.view']} />}>
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/bookings/new" element={<NewBookingPage />} />
                <Route path="/bookings/group/new" element={<NewGroupBookingPage />} />
                <Route path="/bookings/group/:id" element={<GroupBookingDetailPage />} />
                <Route path="/bookings/:id" element={<BookingDetailPage />} />
                <Route path="/guests" element={<GuestsPage />} />
                <Route path="/corporate" element={<CorporateLedgerPage />} />
                <Route path="/night-audit" element={<NightAuditPage />} />
                <Route path="/banquets" element={<BanquetsPage />} />
                <Route path="/banquets/new" element={<NewBanquetPage />} />
                <Route path="/banquets/:id" element={<BanquetDetailPage />} />
              </Route>

              {/* Restaurant POS (All roles) */}
              <Route path="/pos" element={<POSPage />} />
              <Route path="/orders" element={<OrdersPage />} />

              {/* Management/Admin Routes */}
              <Route path="/reports" element={<ProtectedRoute permissions={['report.view']}><ReportsPage /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute permissions={['expense.view']}><ExpensesPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute permissions={['settings.manage']}><SettingsPage /></ProtectedRoute>} />
              <Route path="/staff" element={<ProtectedRoute permissions={['staff.manage']}><StaffPage /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute permissions={['audit.view']}><AuditPage /></ProtectedRoute>} />
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
