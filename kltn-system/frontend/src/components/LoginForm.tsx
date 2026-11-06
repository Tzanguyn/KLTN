import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';
import { useAuthStore } from '../store';
import { Navbar } from './Navbar';
import { StudentWorkspace } from './workspaces/StudentWorkspace';
import { LecturerWorkspace } from './workspaces/LecturerWorkspace';
import { HeadWorkspace } from './workspaces/HeadWorkspace';
import { ManagerWorkspace } from './workspaces/ManagerWorkspace';
import { AdminWorkspace } from './workspaces/AdminWorkspace';
import {
  GraduationCap,
  Lock,
  Mail,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Clock,
  Ban,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';

const schema = z.object({
  identifier: z.string().min(3, 'Vui lòng nhập MSSV hoặc email trường cấp'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const { accessToken, user, setSession, activeRole } = useAuthStore();
  const [serverError, setServerError] = useState<{ message: string; type: 'auth' | 'locked' | 'rate_limit' | 'general' } | null>(null);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotMessage, setForgotMessage] = useState('');

  // System maintenance info
  const [systemInfo, setSystemInfo] = useState<{ status: string; message: string; maintenanceUntil?: string } | null>(null);

  useEffect(() => {
    api.get('/admin/system-status')
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data && data.status && data.status !== 'OPEN') {
          setSystemInfo(data);
        }
      })
      .catch(() => undefined);
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: 'sinhvien@kltn.edu.vn', password: 'Password@123' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await api.post('/auth/login', values);
      const data = res.data?.data ?? res.data;
      setSession(data.accessToken, data.user);
    } catch (error: any) {
      const status = error.response?.status;
      const apiMessage =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        (typeof error.response?.data?.error === 'string' ? error.response.data.error : null);

      const message =
        apiMessage ||
        (error.response
          ? 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.'
          : `Đăng nhập không thành công. Hãy kiểm tra kết nối máy chủ backend (${import.meta.env.VITE_API_URL || 'chưa nhận VITE_API_URL'}).`);

      if (status === 401) {
        setServerError({ message, type: 'auth' });
      } else if (status === 403) {
        setServerError({ message, type: 'locked' });
      } else if (status === 429) {
        setServerError({ message, type: 'rate_limit' });
      } else {
        setServerError({ message, type: 'general' });
      }
    }
  };

  const handleQuickLogin = (identifier: string) => {
    setValue('identifier', identifier);
    setValue('password', 'Password@123');
    onSubmit({ identifier, password: 'Password@123' });
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage('');
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      const token = res.data.data?.resetToken ?? res.data?.resetToken;
      if (token) {
        setResetToken(token);
        setForgotStep('reset');
        setForgotMessage('Mã khôi phục đã được tạo tự động cho môi trường thử nghiệm!');
      } else {
        alert(res.data.data?.message ?? 'Đã gửi hướng dẫn khôi phục qua email');
        setShowForgotModal(false);
      }
    } catch (err: any) {
      setForgotMessage(err.response?.data?.message ?? 'Lỗi gửi yêu cầu khôi phục');
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage('');
    try {
      await api.post('/auth/reset-password', { token: resetToken, newPassword });
      alert('Đặt lại mật khẩu thành công! Hãy đăng nhập lại với mật khẩu mới.');
      setShowForgotModal(false);
      setForgotStep('request');
      setForgotEmail('');
      setResetToken('');
      setNewPassword('');
    } catch (err: any) {
      setForgotMessage(err.response?.data?.message ?? 'Lỗi đặt lại mật khẩu');
    }
  };

  // If user is already logged in, render Navbar and corresponding Role Workspace
  if (accessToken && user) {
    const rawRole = activeRole || user.role || user.roles?.[0] || 'SINH_VIEN';
    const role = String(rawRole).toUpperCase();

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="pb-16">
          {role === 'ADMIN' && <AdminWorkspace />}
          {role === 'SINH_VIEN' && <StudentWorkspace />}
          {role === 'GIANG_VIEN' && <LecturerWorkspace />}
          {role === 'TRUONG_BO_MON' && <HeadWorkspace />}
          {role === 'QUAN_LY_BO_MON' && <ManagerWorkspace />}
          {!['ADMIN', 'SINH_VIEN', 'GIANG_VIEN', 'TRUONG_BO_MON', 'QUAN_LY_BO_MON'].includes(role) && (
            <StudentWorkspace />
          )}
        </main>
      </div>
    );
  }

  // Not logged in: Render Auth Portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 mb-3">
          <GraduationCap className="w-8 h-8 sm:w-9 sm:h-9" />
        </div>
        <div className="inline-block px-3 py-1 mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-200 bg-indigo-900/60 rounded-full border border-indigo-700/50">
          Khoa Công nghệ Thông tin
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Hệ thống Quản lý KLTN
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          Cổng thông tin điều phối đề tài, tiến độ báo cáo và bảo vệ khóa luận
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-0 sm:px-0">
        <div className="bg-white py-6 px-4 sm:py-8 sm:px-10 shadow-2xl rounded-2xl border border-slate-100 space-y-4">
          {/* Maintenance Notice Banner */}
          {systemInfo && systemInfo.status === 'MAINTENANCE' && (
            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-medium flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">HỆ THỐNG ĐANG TẠM ĐÓNG ĐỂ BẢO TRÌ</div>
                <div className="mt-0.5">{systemInfo.message || 'Hệ thống đang bảo trì dữ liệu. Chỉ tài khoản Quản trị viên (Admin) mới có quyền đăng nhập lúc này.'}</div>
                {systemInfo.maintenanceUntil && (
                  <div className="mt-1 font-semibold text-[11px] text-rose-700">
                    Dự kiến hoàn tất: {new Date(systemInfo.maintenanceUntil).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                MSSV hoặc Email trường cấp
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  {...register('identifier')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  placeholder="Nhập MSSV (SV2026001) hoặc email..."
                />
              </div>
              {errors.identifier && <p className="mt-1 text-xs text-rose-500">{errors.identifier.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  placeholder="••••••••••••"
                />
              </div>
              {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
            </div>

            {/* Error alerts with distinctive icons */}
            {serverError && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
                  serverError.type === 'locked'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : serverError.type === 'rate_limit'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {serverError.type === 'locked' && <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                {serverError.type === 'rate_limit' && <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                {serverError.type === 'auth' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                {serverError.type === 'general' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold mb-0.5">
                    {serverError.type === 'locked' && 'Truy cập bị từ chối (403 Forbidden)'}
                    {serverError.type === 'rate_limit' && 'Giới hạn thử lại (429 Too Many Requests)'}
                    {serverError.type === 'auth' && 'Đăng nhập thất bại (401 Unauthorized)'}
                    {serverError.type === 'general' && 'Thông báo hệ thống'}
                  </div>
                  <div>{serverError.message}</div>
                </div>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full py-2.5" isLoading={isSubmitting}>
              Đăng nhập hệ thống <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
              Đăng nhập thử nghiệm 1-Click (Mật khẩu: Password@123)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('SV2026001')}
                className="p-2 text-left border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Sinh viên 1</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded font-semibold">SV2026001</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">sinhvien@kltn.edu.vn (Nguyễn Minh Sinh)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('sinhvien2@kltn.edu.vn')}
                className="p-2 text-left border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Sinh viên 2</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded font-semibold">SV2026002</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">sinhvien2@kltn.edu.vn (Trần Thị Mai)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('dong.buivan@kltn.edu.vn')}
                className="p-2 text-left border border-emerald-200 bg-emerald-50/30 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/60 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-emerald-800 group-hover:text-emerald-900 flex items-center justify-between">
                  <span>GVHD (ThS. Bùi Văn Đồng)</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded font-semibold">GVHD</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">dong.buivan@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('truongbomon@kltn.edu.vn')}
                className="p-2 text-left border border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50/50 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-purple-600">Trưởng bộ môn</div>
                <div className="text-[10px] text-slate-400 truncate">truongbomon@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('quanly@kltn.edu.vn')}
                className="p-2 text-left border border-slate-200 rounded-xl hover:border-amber-500 hover:bg-amber-50/50 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-amber-600">Quản lý bộ môn</div>
                <div className="text-[10px] text-slate-400 truncate">quanly@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@kltn.edu.vn')}
                className="p-2 text-left border border-rose-200 bg-rose-50/40 rounded-xl hover:border-rose-500 hover:bg-rose-50 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-rose-800 group-hover:text-rose-900 flex items-center justify-between">
                  <span>Quản trị viên (Admin)</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded font-bold">ADMIN</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">admin@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('khoataikhoan@kltn.edu.vn')}
                className="p-2 text-left border border-slate-200 bg-slate-50/60 rounded-xl hover:border-slate-400 hover:bg-slate-100 transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-700 group-hover:text-slate-900 flex items-center justify-between">
                  <span>Khóa tài khoản</span>
                  <span className="text-[9px] px-1 bg-slate-200 text-slate-800 rounded">E2: 403</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">khoataikhoan@kltn.edu.vn</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} title="Khôi phục mật khẩu tài khoản">
        {forgotStep === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Nhập email tài khoản đã được cấp. Hệ thống sẽ phát sinh mã token để bạn đặt lại mật khẩu mới.
            </p>
            <Input
              label="Email trường cấp"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@kltn.edu.vn"
              required
            />
            {forgotMessage && <p className="text-xs text-rose-500">{forgotMessage}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowForgotModal(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary">
                Tạo mã khôi phục
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              {forgotMessage}
            </div>
            <Input
              label="Mã Token xác thực"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
            />
            <Input
              label="Mật khẩu mới (tối thiểu 8 ký tự)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setForgotStep('request')}>
                Quay lại
              </Button>
              <Button type="submit" variant="primary">
                Xác nhận đổi mật khẩu
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
