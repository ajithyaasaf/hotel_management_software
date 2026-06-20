import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';
import React, { Suspense } from 'react';

const InnerPageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh] w-full">
    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function AppLayout() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 ml-[260px] min-h-screen print:ml-0">
        <div className="p-8 max-w-[1400px] mx-auto print:p-0">
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
