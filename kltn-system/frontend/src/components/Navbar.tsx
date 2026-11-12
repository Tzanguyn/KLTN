import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store';
import { api } from '../api';
import { io } from 'socket.io-client';
import {
  GraduationCap,
  Bell,
  LogOut,
  User as UserIcon,
  Building2,
  CheckCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

const roleLabels: Record<
  string,
  { label: string; variant: 'primary' | 'success' | 'warning' | 'purple' | 'danger' }
> = {
  ADMIN: { label: 'Quản trị viên', variant: 'danger' },
  SINH_VIEN: { label: 'Sinh viên', variant: 'primary' },
  GIANG_VIEN: { label: 'Giảng viên', variant: 'success' },
  TRUONG_BO_MON: { label: 'Trưởng bộ môn', variant: 'purple' },
  QUAN_LY_BO_MON: { label: 'Quản lý bộ môn', variant: 'warning' },
};

export const Navbar: React.FC = () => {
  const { user, accessToken, unreadCount, setUnreadCount, logout, activeRole, setActiveRole } =
    useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotiDropdown, setShowNotiDropdown] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);

  const isHead = user?.roles?.includes('TRUONG_BO_MON') || user?.role === 'TRUONG_BO_MON';
  const isManager = user?.roles?.includes('QUAN_LY_BO_MON') || user?.role === 'QUAN_LY_BO_MON';
  const effectiveRole = activeRole || user?.role || user?.roles?.[0] || 'SINH_VIEN';
  const roleConfig =
    isHead && effectiveRole === 'GIANG_VIEN'
      ? { label: 'Trưởng BM (Chế độ GV)', variant: 'success' as const }
      : isManager && effectiveRole === 'GIANG_VIEN'
      ? { label: 'Quản lý BM (Chế độ GV)', variant: 'success' as const }
      : roleLabels[effectiveRole] ?? { label: effectiveRole, variant: 'primary' as const };

  // Fetch initial notifications
  const fetchNotifications = async () => {
    if (!accessToken) return;
    try {
      const res = await api.get('/notifications');
      const items = res.data?.data?.items ?? res.data?.data ?? res.data;
      if (Array.isArray(items)) {
        setNotifications(items);
        const unread = items.filter((n) => !n.readAt).length;
        setUnreadCount(unread);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [accessToken]);

  // Click outside to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setShowNotiDropdown(false);
      }
    };
    if (showNotiDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotiDropdown]);

  // Realtime Socket.io notifications
  useEffect(() => {
    if (!accessToken || !user?.id) return;
    const socketUrl =
      import.meta.env.VITE_API_URL?.replace(/\/api$/, '') ?? 'http://localhost:3000';
    const socket = io(`${socketUrl}/notifications`, { withCredentials: true });

    socket.emit('join', user.id);
    socket.on('notification', (newNoti: any) => {
      setNotifications((prev) => [newNoti, ...prev.filter((item) => item.id !== newNoti.id)]);
      setUnreadCount(unreadCount + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    for (const noti of notifications.filter((n) => !n.readAt)) {
      await markAsRead(noti.id);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & University Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-10 px-2.5 py-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-center">
              <img
                src="/iuh-logo.png"
                alt="IUH Logo"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 leading-none">
                  KLTN Portal
                </h1>
                <span className="hidden sm:inline-flex px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded-md border border-indigo-200/60 uppercase">
                  FIT
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 hidden xs:block">
                Khoa Công nghệ Thông tin
              </p>
            </div>
          </div>

          {/* Middle: Role Switcher for Head & Manager */}
          {(isHead || isManager) && (
            <div className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner">
              {isHead && (
                <button
                  type="button"
                  onClick={() => setActiveRole('TRUONG_BO_MON')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                    effectiveRole === 'TRUONG_BO_MON'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Không gian Điều hành Chuyên môn (Trưởng bộ môn)"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Trưởng Bộ môn</span>
                </button>
              )}
              {isManager && (
                <button
                  type="button"
                  onClick={() => setActiveRole('QUAN_LY_BO_MON')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                    effectiveRole === 'QUAN_LY_BO_MON'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Không gian Quản lý Vận hành & Giáo vụ Bộ môn"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Quản lý Bộ môn</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveRole('GIANG_VIEN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  effectiveRole === 'GIANG_VIEN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title="Không gian Nghiệp vụ Giảng viên (Hướng dẫn KLTN, Đề tài, Chấm điểm)"
              >
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>Nghiệp vụ Hướng dẫn (GVHD)</span>
              </button>
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={notiRef}>
              <button
                onClick={() => setShowNotiDropdown(!showNotiDropdown)}
                className={`relative p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                  showNotiDropdown
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Thông báo"
                aria-label="Xem thông báo"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white"></span>
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotiDropdown && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 py-3 z-50 animate-fade-in overflow-hidden">
                  <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Thông báo</h4>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-[11px] font-bold text-rose-700 bg-rose-50 rounded-full border border-rose-200/60">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Đọc tất cả</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-84 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-600">Bạn đã xem hết thông báo!</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Không có thông báo mới nào cần xử lý</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => !item.readAt && markAsRead(item.id)}
                          className={`p-3.5 text-xs transition-colors cursor-pointer hover:bg-slate-50/80 ${
                            item.readAt ? 'opacity-75' : 'bg-indigo-50/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-900 font-bold leading-tight">{item.title}</span>
                            {!item.readAt && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />
                            )}
                          </div>
                          <p className="text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>
                          <span className="text-[10px] font-medium text-slate-400 mt-1.5 block">
                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200/80">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-slate-800 font-bold text-xs border border-slate-300/80 shadow-2xs shrink-0">
                {user?.fullName ? (
                  user.fullName.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-none truncate max-w-[130px]">
                  {user?.fullName ?? 'Người dùng'}
                </div>
                <div className="mt-1">
                  <Badge variant={roleConfig.variant} size="xs" dot>
                    {roleConfig.label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Logout button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
              title="Đăng xuất"
              aria-label="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
