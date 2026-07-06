import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';
import React, { Suspense, useState } from 'react';
import { Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const InnerPageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh] w-full">
    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface-secondary">
      {/* Mobile Top Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl text-primary-600">✦</span>
          <span className="font-bold text-gray-900 tracking-tight">Godiva</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
      </header>

      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[260px] min-h-screen pt-16 lg:pt-0 print:ml-0">
        <div className="p-4 sm:p-8 max-w-[1400px] mx-auto print:p-0">
          <Suspense fallback={<InnerPageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            padding: '16px 24px',
            fontSize: '15px',
            fontWeight: '500',
            color: '#1f2937',
            background: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #f3f4f6',
          },
        }}
      />
    </div>
  );
}
