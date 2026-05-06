import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, BedDouble, CalendarCheck, Users, Utensils,
  FileText, CreditCard, Settings, Shield, LogOut, ChevronRight, UserCog
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'RECEPTION', 'RESTAURANT'] },
  { to: '/rooms', icon: BedDouble, label: 'Rooms', roles: ['ADMIN', 'RECEPTION'] },
  { to: '/bookings', icon: CalendarCheck, label: 'Bookings', roles: ['ADMIN', 'RECEPTION'] },
  { to: '/guests', icon: Users, label: 'Guests', roles: ['ADMIN', 'RECEPTION'] },
  { to: '/pos', icon: Utensils, label: 'Restaurant POS', roles: ['ADMIN', 'RECEPTION', 'RESTAURANT'] },
  { to: '/orders', icon: FileText, label: 'Orders', roles: ['ADMIN', 'RECEPTION', 'RESTAURANT'] },
  { to: '/reports', icon: CreditCard, label: 'Reports', roles: ['ADMIN'] },
  { to: '/staff', icon: UserCog, label: 'Staff', roles: ['ADMIN'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['ADMIN'] },
  { to: '/audit', icon: Shield, label: 'Audit Log', roles: ['ADMIN'] },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const filtered = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50"
      style={{ background: 'var(--color-sidebar)' }}>

      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white tracking-tight">
          ✦ Godiva Rooms
        </h1>
        <p className="text-xs text-white/40 mt-1">Hotel Management System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {filtered.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80'}`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--color-sidebar-active)' : 'transparent',
              })}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/40">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
