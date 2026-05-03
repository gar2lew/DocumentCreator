import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store';
import { logoutUser } from '../../features/auth/services/authService';
import {
  FileText, Building2, Clock,
  ChevronLeft, ChevronRight, LogOut, LayoutDashboard, FileCode,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/history', label: 'Documents', icon: Clock },
];

export function Sidebar() {
  const { currentUser, sidebarOpen, toggleSidebar, setCurrentUser } = useAppStore();

  async function handleLogout() {
    await logoutUser();
    setCurrentUser(null);
  }

  return (
    <div className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 shrink-0 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 border-b border-gray-800 ${sidebarOpen ? '' : 'justify-center'}`}>
        <div className="p-1.5 bg-indigo-600 rounded-lg shrink-0">
          <FileCode className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && <span className="font-bold text-white text-sm">DocCreator</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? 'bg-indigo-900/40 text-indigo-300'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              } ${sidebarOpen ? '' : 'justify-center px-0'}`
            }
            title={!sidebarOpen ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 py-3">
        {sidebarOpen && currentUser && (
          <div className="px-4 py-2 mb-1">
            <p className="text-xs font-medium text-white truncate">{currentUser.displayName}</p>
            <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors w-[calc(100%-16px)] ${sidebarOpen ? '' : 'justify-center px-0'}`}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {sidebarOpen && 'Sign Out'}
        </button>
        <button
          onClick={toggleSidebar}
          className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-xs text-gray-600 hover:text-gray-400 transition-colors w-[calc(100%-16px)] ${sidebarOpen ? '' : 'justify-center px-0'}`}
        >
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {sidebarOpen && 'Collapse'}
        </button>
      </div>
    </div>
  );
}
