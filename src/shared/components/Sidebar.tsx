import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store';
import { logoutUser } from '../../features/auth/services/authService';
import {
  FileText, Building2, Clock,
  ChevronLeft, ChevronRight, LogOut, LayoutDashboard, FileCode, FilePlus2, Sparkles, Library,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/universal-generator', label: 'Universal Populator', icon: Sparkles },
  { to: '/documents/generate', label: 'Generate', icon: FilePlus2 },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/template-variables', label: 'Variables', icon: Library },
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
    <div className={`flex flex-col bg-bg-secondary border-r border-border transition-all duration-200 shrink-0 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 border-b border-border ${sidebarOpen ? '' : 'justify-center'}`}>
        <div className="p-1.5 bg-indigo-600 rounded-lg shrink-0">
          <FileCode className="w-4 h-4 text-white" />
        </div>
        {sidebarOpen && <span className="font-bold text-text text-sm">DocCreator</span>}
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
                  : 'text-text-tertiary hover:text-text hover:bg-bg-tertiary'
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
      <div className="border-t border-border py-3">
        {sidebarOpen && currentUser && (
          <div className="px-4 py-2 mb-1">
            <p className="text-xs font-medium text-text truncate">{currentUser.displayName}</p>
            <p className="text-xs text-text-tertiary truncate">{currentUser.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-text-tertiary hover:text-red-400 hover:bg-bg-tertiary transition-colors w-[calc(100%-16px)] ${sidebarOpen ? '' : 'justify-center px-0'}`}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {sidebarOpen && 'Sign Out'}
        </button>
        <ThemeToggle />
        <button
          onClick={toggleSidebar}
          className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-xs text-text-tertiary hover:text-text-secondary transition-colors w-[calc(100%-16px)] ${sidebarOpen ? '' : 'justify-center px-0'}`}
        >
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {sidebarOpen && 'Collapse'}
        </button>
      </div>
    </div>
  );
}
