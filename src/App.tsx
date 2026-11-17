import { useEffect, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, setAuthToken } from './lib/api';
import type { PermissionCode, User } from './types';
import { LogoSlot } from './components/LogoSlot';
import { LoginPage } from './components/LoginPage';
import { DashboardView } from './components/DashboardView';
import { ProfileView } from './components/ProfileView';
import { ActivitiesView } from './components/ActivitiesView';
import { BudgetView } from './components/BudgetView';
import { DataManagementView } from './components/DataManagementView';
import { UsersView } from './components/UsersView';
import { SettingsView } from './components/SettingsView';

interface Branding {
  app_name: string;
  app_subtitle: string;
  org_name: string;
  logo_url: string | null;
  active_budget_year: number;
}

type MenuKey =
  | 'dashboard'
  | 'profile'
  | 'activities'
  | 'budget'
  | 'data-management'
  | 'users'
  | 'settings';

interface NavItem {
  key: MenuKey;
  label: string;
  icon: typeof LayoutDashboard;
  requiredPermission?: PermissionCode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPermission: 'dashboard:view' },
  { key: 'profile', label: 'Profil BAPPEDA', icon: Building2, requiredPermission: 'profile:view' },
  {
    key: 'activities',
    label: 'Kegiatan Bulanan',
    icon: CalendarDays,
    requiredPermission: 'activities:view',
  },
  {
    key: 'budget',
    label: 'Penyerapan Anggaran',
    icon: PieChart,
    requiredPermission: 'budget:view',
  },
  {
    key: 'data-management',
    label: 'Manajemen Data',
    icon: Database,
    requiredPermission: 'data:manage',
  },
  {
    key: 'users',
    label: 'Manajemen Pengguna',
    icon: Users,
    requiredPermission: 'users:manage',
  },
  { key: 'settings', label: 'Pengaturan', icon: Settings },
];

export default function App() {
  const [branding, setBranding] = useState<Branding>({
    app_name: 'SMART BAPPEDA',
    app_subtitle: 'KABUPATEN SIDOARJO',
    org_name: 'Badan Perencanaan Pembangunan Daerah Kabupaten Sidoarjo',
    logo_url: null,
    active_budget_year: 2026,
  });

  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function loadBranding() {
    try {
      const b = await apiFetch<Branding>('/api/public/branding');
      setBranding(b);
    } catch {
      // keep default branding
    }
  }

  async function refreshCurrentUser() {
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    Promise.all([loadBranding(), refreshCurrentUser()]).finally(() => {
      setCheckingSession(false);
    });
  }, []);

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setAuthToken(null);
      setUser(null);
      setActiveMenu('dashboard');
    }
  }

  function handleNavigate(menu: string, activityId?: number) {
    const target = menu as MenuKey;
    const item = NAV_ITEMS.find((n) => n.key === target);
    if (item && item.requiredPermission && user && !user.permissions.includes(item.requiredPermission)) {
      return;
    }
    if (activityId) {
      setSelectedActivityId(activityId);
    }
    setActiveMenu(target);
    setMobileMenuOpen(false);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memuat SMART BAPPEDA...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        branding={branding}
        onLoginSuccess={(loggedUser) => {
          setUser(loggedUser);
          setActiveMenu('dashboard');
        }}
      />
    );
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.requiredPermission || user.permissions.includes(item.requiredPermission)
  );

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.key === activeMenu)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-blue-950 text-white border-r border-blue-900 z-30">
        <div className="px-5 py-5 border-b border-blue-900/90 flex items-center gap-3">
          <LogoSlot logoUrl={branding.logo_url} size="md" variant="navy" />
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-white truncate">
              {branding.app_name}
            </div>
            <div className="text-[11px] font-semibold tracking-wider text-amber-300 truncate">
              {branding.app_subtitle}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeMenu === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-blue-100/85 hover:bg-blue-900/70 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-300' : 'text-blue-300'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-900/90 bg-blue-950/60">
          <div className="text-xs font-semibold text-white truncate">{user.full_name}</div>
          <div className="text-[11px] text-amber-300 font-medium mt-0.5 truncate">
            {user.role_name}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full py-2 px-3 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-xs font-semibold text-blue-100 flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-blue-950 text-white flex flex-col h-full z-10">
            <div className="px-5 py-4 border-b border-blue-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogoSlot logoUrl={branding.logo_url} size="sm" variant="navy" />
                <div>
                  <div className="text-sm font-extrabold text-white">{branding.app_name}</div>
                  <div className="text-[10px] font-semibold text-amber-300">
                    {branding.app_subtitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeMenu === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavigate(item.key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-left ${
                      active ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-blue-900">
              <div className="text-xs font-semibold text-white">{user.full_name}</div>
              <div className="text-[11px] text-amber-300">{user.role_name}</div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 w-full py-2 px-3 rounded-lg bg-blue-900 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="font-bold text-blue-950 whitespace-nowrap">
                  {branding.app_name} {branding.app_subtitle}
                </span>
                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="text-slate-600 font-medium truncate hidden sm:inline">
                  {currentNavLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:block text-right">
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {user.full_name}
                </div>
                <div className="text-[11px] text-amber-700 font-medium">
                  {user.role_name}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
          {activeMenu === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
          {activeMenu === 'profile' && (
            <ProfileView currentUser={user} onBrandingUpdated={loadBranding} />
          )}
          {activeMenu === 'activities' && (
            <ActivitiesView
              currentUser={user}
              initialActivityId={selectedActivityId}
              onClearInitialActivity={() => setSelectedActivityId(null)}
            />
          )}
          {activeMenu === 'budget' && <BudgetView currentUser={user} />}
          {activeMenu === 'data-management' && (
            <DataManagementView
              currentUser={user}
              onOpenActivity={(id) => handleNavigate('activities', id)}
              onNavigate={(m) => handleNavigate(m)}
            />
          )}
          {activeMenu === 'users' && <UsersView currentUser={user} />}
          {activeMenu === 'settings' && (
            <SettingsView
              currentUser={user}
              onUserUpdated={refreshCurrentUser}
              onBrandingUpdated={loadBranding}
            />
          )}
        </main>

        {/* Quiet Institutional Footer */}
        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              {branding.app_name} {branding.app_subtitle} · {branding.org_name}
            </span>
            <span>Lingkungan Pengujian Data DEMO</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
