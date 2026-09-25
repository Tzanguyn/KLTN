import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { api } from '../api';
import { io } from 'socket.io-client';
import { GraduationCap, Bell, LogOut, CheckCircle2, User as UserIcon, ChevronDown } from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

const roleLabels: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'purple' }> = {
  SINH_VIEN: { label: 'Sinh viên', variant: 'primary' },
  GIANG_VIEN: { label: 'Giảng viên', variant: 'success' },
  TRUONG_BO_MON: { label: 'Trưởng bộ môn', variant: 'purple' },
  QUAN_LY_BO_MON: { label: 'Quản lý bộ môn', variant: 'warning' },
};

export const Navbar: React.FC = () => {
  const { user, accessToken, unreadCount, setUnreadCount, logout, setSession } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotiDropdown, setShowNotiDropdown] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const role = user?.role || user?.roles?.[0] || 'SINH_VIEN';
  const roleConfig = roleLabels[role] ?? { label: role, variant: 'primary' };

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

  // Realtime Socket.io notifications
  useEffect(() => {
    if (!accessToken || !user?.id) return;
    const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') ?? 'http://localhost:3000';
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

  // Quick switch role demo helper
  const switchAccount = async (identifier: string) => {
    try {
      const res = await api.post('/auth/login', { identifier, password: 'Password@123' });
      const payload = res.data?.data ?? res.data;
      setSession(payload.accessToken, payload.user);
      setShowRoleMenu(false);
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Đổi tài khoản thất bại');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">KLTN Portal</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Khoa Công nghệ Thông tin</p>
            </div>
          </div>

          {/* Center / Role Switcher Demo */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs">
            <span className="px-2 font-medium text-slate-500">Chuyển vai trò:</span>
            <button
              onClick={() => switchAccount('sinhvien@kltn.edu.vn')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'SINH_VIEN' && user?.duDieuKienDangKyKLTN !== false ? 'bg-white shadow-xs text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sinh viên (Đủ ĐK)
            </button>
            <button
              onClick={() => switchAccount('sinhvien2@kltn.edu.vn')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'SINH_VIEN' && user?.duDieuKienDangKyKLTN === false ? 'bg-white shadow-xs text-rose-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sinh viên (Chưa đủ ĐK)
            </button>
            <button
              onClick={() => switchAccount('giangvien@kltn.edu.vn')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'GIANG_VIEN' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Giảng viên
            </button>
            <button
              onClick={() => switchAccount('truongbomon@kltn.edu.vn')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'TRUONG_BO_MON' ? 'bg-white shadow-xs text-purple-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trưởng bộ môn
            </button>
            <button
              onClick={() => switchAccount('quanly@kltn.edu.vn')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === 'QUAN_LY_BO_MON' ? 'bg-white shadow-xs text-amber-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quản lý bộ môn
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotiDropdown(!showNotiDropdown)}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Thông báo"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {/* Notification dropdown */}
              {showNotiDropdown && (
                <div className="absolute right-0 mt-2 w-84 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-800">Thông báo ({unreadCount} mới)</h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">Không có thông báo nào.</div>
                    ) : (
                      notifications.slice(0, 8).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => !item.readAt && markAsRead(item.id)}
                          className={`p-3 text-xs transition-colors cursor-pointer hover:bg-slate-50 ${
                            item.readAt ? 'opacity-70' : 'bg-indigo-50/40 font-medium'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-900 font-semibold">{item.title}</span>
                            {!item.readAt && <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />}
                          </div>
                          <p className="text-slate-600 mt-1 line-clamp-2">{item.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile info */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm border border-slate-200">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-slate-800 leading-none truncate max-w-[140px]">
                  {user?.fullName ?? 'Người dùng'}
                </div>
                <div className="mt-1">
                  <Badge variant={roleConfig.variant} size="sm">
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
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

