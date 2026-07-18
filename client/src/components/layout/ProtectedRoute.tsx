import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  permissions?: string[];
  children?: React.ReactNode;
}

export default function ProtectedRoute({ permissions, children }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permissions && permissions.length > 0 && !hasPermission(permissions)) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
