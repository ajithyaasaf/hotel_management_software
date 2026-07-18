import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, BedDouble, CalendarCheck, Users, Utensils,
  FileText, CreditCard, Settings, Shield, LogOut, UserCog, TrendingDown, Moon, Building, Wine, X
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', permissions: [] }, // Dashboard always visible
  { to: '/rooms', icon: BedDouble, label: 'Rooms', permissions: ['room.view'] },
  { to: '/bookings', icon: CalendarCheck, label: 'Bookings', permissions: ['booking.view'] },
  { to: '/guests', icon: Users, label: 'Guests', permissions: ['guest.view'] },
  { to: '/corporate', icon: Building, label: 'Corporate Ledger', permissions: ['corporate.view'] },
  { to: '/pos', icon: Utensils, label: 'Restaurant POS', permissions: ['pos.access'] },
  { to: '/orders', icon: FileText, label: 'Orders', permissions: ['order.view'] },
  { to: '/reports', icon: CreditCard, label: 'Reports', permissions: ['report.view'] },
  { to: '/expenses', icon: TrendingDown, label: 'Expenses', permissions: ['expense.view'] },
  { to: '/banquets', icon: Wine, label: 'Banquets', permissions: ['banquet.view'] },
  { to: '/night-audit', icon: Moon, label: 'Night Audit', permissions: ['nightaudit.view'] },
  { to: '/staff', icon: UserCog, label: 'Staff', permissions: ['staff.manage'] },
  { to: '/settings', icon: Settings, label: 'Settings', permissions: ['settings.manage'] },
  { to: '/audit', icon: Shield, label: 'Audit Log', permissions: ['audit.view'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); onClose(); };

  const filtered = navItems.filter(item => item.permissions.length === 0 || hasPermission(item.permissions));

  return (
    <aside className={`fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50 print:hidden transition-transform duration-300 ease-in-out lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ background: 'var(--color-sidebar)' }}>

      {/* Brand */}
      <div className="px-6 py-8 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-600 tracking-tighter flex items-center gap-2">
            <span className="text-3xl">✦</span> Godiva
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 ml-1">Hotel Management</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-xl text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <div className="space-y-2">
          {filtered.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] transition-all duration-200 group
                ${isActive
                  ? 'text-primary-600 font-semibold'
                  : 'text-gray-600 hover:text-black hover:bg-gray-50'}`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--color-sidebar-active)' : 'transparent',
              })}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="px-4 py-6 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 font-medium">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-black hover:bg-gray-100 transition-all"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
