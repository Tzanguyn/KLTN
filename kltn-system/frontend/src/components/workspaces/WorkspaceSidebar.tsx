import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, Menu, X, ChevronRight, Layers } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export interface WorkspaceSidebarProps {
  title: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  themeColor?: 'indigo' | 'emerald' | 'purple' | 'amber' | 'rose';
  infoCard?: React.ReactNode;
}

const colorMap = {
  indigo: {
    activeBg: 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 font-bold',
    badge: 'bg-indigo-50 text-indigo-700',
    mobilePillActive: 'bg-indigo-600 text-white shadow-sm font-bold',
    accentText: 'text-indigo-600',
  },
  emerald: {
    activeBg: 'bg-emerald-700 text-white shadow-sm shadow-emerald-200 font-bold',
    badge: 'bg-emerald-50 text-emerald-700',
    mobilePillActive: 'bg-emerald-700 text-white shadow-sm font-bold',
    accentText: 'text-emerald-700',
  },
  purple: {
    activeBg: 'bg-purple-700 text-white shadow-sm shadow-purple-200 font-bold',
    badge: 'bg-purple-50 text-purple-700',
    mobilePillActive: 'bg-purple-700 text-white shadow-sm font-bold',
    accentText: 'text-purple-700',
  },
  amber: {
    activeBg: 'bg-amber-600 text-white shadow-sm shadow-amber-200 font-bold',
    badge: 'bg-amber-50 text-amber-700',
    mobilePillActive: 'bg-amber-600 text-white shadow-sm font-bold',
    accentText: 'text-amber-700',
  },
  rose: {
    activeBg: 'bg-rose-600 text-white shadow-sm shadow-rose-200 font-bold',
    badge: 'bg-rose-50 text-rose-700',
    mobilePillActive: 'bg-rose-600 text-white shadow-sm font-bold',
    accentText: 'text-rose-700',
  },
};

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  title,
  navItems,
  activeTab,
  onTabChange,
  themeColor = 'indigo',
  infoCard,
}) => {
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const theme = colorMap[themeColor] || colorMap.indigo;
  const activeItem = navItems.find((item) => item.id === activeTab) || navItems[0];
  const ActiveIcon = activeItem?.icon || Layers;
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active pill into view in the horizontal mobile bar
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

  return (
    <>
      {/* 1. MOBILE & TABLET NAVIGATION (< lg) */}
      <div className="block lg:hidden w-full sticky top-16 z-30 bg-slate-50/95 backdrop-blur-md pt-2 pb-2.5 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-slate-200/80 shadow-xs mb-4">
        {/* Mobile Header Bar: Active tab indicator + Menu expander */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 truncate">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              {title}:
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <ActiveIcon className={`w-3.5 h-3.5 shrink-0 ${theme.accentText}`} />
              <span className="text-xs font-bold text-slate-900 truncate">
                {activeItem?.label}
              </span>
              {activeItem?.count !== undefined && activeItem.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded-full font-bold shrink-0">
                  {activeItem.count}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMobileDrawer(!showMobileDrawer)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 shadow-xs hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            aria-expanded={showMobileDrawer}
          >
            {showMobileDrawer ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
            <span>{showMobileDrawer ? 'Đóng' : 'Tất cả mục'}</span>
          </button>
        </div>

        {/* Mobile Horizontal Scrollable Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={isActive ? activeTabRef : null}
                onClick={() => {
                  onTabChange(item.id);
                  setShowMobileDrawer(false);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? theme.mobilePillActive
                    : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile Full Dropdown Menu (When user clicks 'Tất cả mục') */}
        {showMobileDrawer && (
          <div className="mt-2.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-700">
              <span>{title} ({navItems.length} mục)</span>
              <button
                type="button"
                onClick={() => setShowMobileDrawer(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[60vh] overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setShowMobileDrawer(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      isActive
                        ? theme.activeBg
                        : 'text-slate-700 bg-slate-50/70 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1.5 shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {infoCard && (
              <div className="pt-2 border-t border-slate-100">
                {infoCard}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. DESKTOP STICKY SIDEBAR (>= lg) */}
      <aside className="hidden lg:block lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
            <span>{title}</span>
            <span className={`text-[10px] ${theme.badge} px-1.5 py-0.5 rounded font-bold`}>
              {navItems.length} mục
            </span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isActive
                      ? theme.activeBg
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1.5 shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {infoCard && infoCard}
      </aside>
    </>
  );
};

