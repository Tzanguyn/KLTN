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
  ShieldCheck,
  ShieldAlert,
  Clock,
  Ban,
  RefreshCw,
  AlertCircle,
  Building2,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';

const schema = z.object({
  identifier: z.string().min(3, 'Vui lòng nhập MSSV hoặc email trường cấp'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  captchaCode: z.string().min(1, 'Vui lòng nhập mã xác nhận (CAPTCHA)'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const { accessToken, user, setSession, activeRole } = useAuthStore();
  const [serverError, setServerError] = useState<{
    message: string;
    type: 'auth' | 'locked' | 'rate_limit' | 'captcha' | 'general';
  } | null>(null);

  // Captcha state
  const [captcha, setCaptcha] = useState<{ captchaId: string; svg: string; devCode?: string } | null>(null);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  const fetchCaptcha = async () => {
    try {
      setLoadingCaptcha(true);
      const res = await api.get('/auth/captcha');
      const data = res.data?.data ?? res.data;
      if (data?.captchaId && data?.svg) {
        setCaptcha(data);
      }
    } catch (err) {
      console.error('Không thể tải mã CAPTCHA:', err);
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotMessage, setForgotMessage] = useState('');

  // System maintenance info
  const [systemInfo, setSystemInfo] = useState<{
    status: string;
    message: string;
    maintenanceUntil?: string;
  } | null>(null);

  useEffect(() => {
    api
      .get('/admin/system-status')
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
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: 'sinhvien@kltn.edu.vn',
      password: 'Password@123',
      captchaCode: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await api.post('/auth/login', {
        identifier: values.identifier,
        password: values.password,
        captchaId: captcha?.captchaId,
        captchaCode: values.captchaCode,
      });
      const data = res.data?.data ?? res.data;
      setSession(data.accessToken, data.user);
    } catch (error: any) {
      // Làm mới mã CAPTCHA và xóa ô nhập khi đăng nhập lỗi
      fetchCaptcha();
      setValue('captchaCode', '');

      const status = error.response?.status;
      const apiMessage =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        (typeof error.response?.data?.error === 'string' ? error.response.data.error : null);

      const message =
        apiMessage ||
        (error.response
          ? 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.'
          : `Đăng nhập không thành công. Hãy kiểm tra kết nối máy chủ backend (${
              import.meta.env.VITE_API_URL || 'chưa nhận VITE_API_URL'
            }).`);

      if (status === 401) {
        setServerError({ message, type: 'auth' });
      } else if (status === 403) {
        setServerError({ message, type: 'locked' });
      } else if (status === 429) {
        setServerError({ message, type: 'rate_limit' });
      } else if (status === 400 && message.toLowerCase().includes('captcha')) {
        setServerError({ message, type: 'captcha' });
      } else {
        setServerError({ message, type: 'general' });
      }
    }
  };

  const handleQuickLogin = (identifier: string) => {
    setValue('identifier', identifier);
    setValue('password', 'Password@123');
    const autoCode = captcha?.devCode || '';
    if (autoCode) {
      setValue('captchaCode', autoCode);
      onSubmit({ identifier, password: 'Password@123', captchaCode: autoCode });
    } else {
      setValue('captchaCode', '');
      setFocus('captchaCode');
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage('');
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      const token = res.data.data?.resetToken ?? res.data?.resetToken;
      setResetToken(token);
      setForgotStep('reset');
      setForgotMessage(
        res.data.data?.message ??
          res.data?.message ??
          'Mã xác thực đã được tạo. Vui lòng đặt mật khẩu mới.',
      );
    } catch (err: any) {
      setForgotMessage(err.response?.data?.message ?? 'Lỗi gửi yêu cầu khôi phục mật khẩu');
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage('');
    try {
      const res = await api.post('/auth/reset-password', {
        resetToken,
        newPassword,
      });
      alert(res.data.data?.message ?? res.data?.message ?? 'Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay.');
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
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 pb-16">
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

  // Not logged in: Render Modern Auth Portal
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-8 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center justify-center px-5 py-2.5 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl shadow-indigo-950/40 ring-1 ring-white/50 mb-3.5 transform transition-transform hover:scale-105 duration-200">
          <img
            src="/iuh-logo.png"
            alt="Trường Đại học Công nghiệp TP.HCM - IUH"
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/80 rounded-full border border-indigo-700/50 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Khoa Công nghệ Thông tin</span>
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Hệ thống Quản lý KLTN
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          Cổng thông tin điều phối đề tài, tiến độ báo cáo và bảo vệ khóa luận tốt nghiệp
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white text-slate-900 py-7 px-5 sm:py-9 sm:px-10 shadow-2xl rounded-3xl border border-slate-100/90 space-y-5">
          {/* Maintenance Notice Banner */}
          {systemInfo && systemInfo.status === 'MAINTENANCE' && (
            <div className="p-3.5 rounded-2xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-fade-in">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">HỆ THỐNG ĐANG TẠM ĐÓNG ĐỂ BẢO TRÌ</div>
                <div className="mt-0.5 leading-relaxed">
                  {systemInfo.message ||
                    'Hệ thống đang bảo trì dữ liệu. Chỉ tài khoản Quản trị viên (Admin) mới có quyền đăng nhập lúc này.'}
                </div>
                {systemInfo.maintenanceUntil && (
                  <div className="mt-1.5 font-semibold text-[11px] text-rose-700">
                    Dự kiến hoàn tất: {new Date(systemInfo.maintenanceUntil).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1.5">
                MSSV hoặc Email trường cấp
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  {...register('identifier')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
                  placeholder="Nhập MSSV (SV2026001) hoặc email..."
                />
              </div>
              {errors.identifier && (
                <p className="mt-1 text-xs font-medium text-rose-500">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 tracking-wide">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                  placeholder="••••••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs font-medium text-rose-500">{errors.password.message}</p>
              )}
            </div>

            {/* Mã xác nhận CAPTCHA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 tracking-wide">
                  Mã xác nhận (CAPTCHA)
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Không phân biệt hoa/thường</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    {...register('captchaCode')}
                    className="w-full pl-10 pr-3 py-2.5 text-sm uppercase tracking-wider font-mono font-bold bg-slate-50/50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                    placeholder="Nhập 4 ký tự..."
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>

                {/* Khung CAPTCHA SVG & Nút tải lại */}
                <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 shrink-0">
                  {captcha?.svg ? (
                    <div
                      className="cursor-pointer overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
                      title="Bấm vào hình để đổi mã khác"
                      onClick={fetchCaptcha}
                      dangerouslySetInnerHTML={{ __html: captcha.svg }}
                    />
                  ) : (
                    <div className="w-[120px] h-[36px] bg-slate-200 animate-pulse rounded-lg flex items-center justify-center text-[11px] text-slate-500 font-medium">
                      Đang tải...
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={loadingCaptcha}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Đổi mã xác nhận khác"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCaptcha ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              {errors.captchaCode && (
                <p className="mt-1 text-xs font-medium text-rose-500">{errors.captchaCode.message}</p>
              )}
            </div>

            {/* Error alerts with distinctive icons */}
            {serverError && (
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-medium animate-fade-in ${
                  serverError.type === 'locked'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : serverError.type === 'rate_limit'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : serverError.type === 'captcha'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {serverError.type === 'locked' && <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                {serverError.type === 'rate_limit' && <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                {serverError.type === 'captcha' && <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                {serverError.type === 'auth' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                {serverError.type === 'general' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold mb-0.5">
                    {serverError.type === 'locked' && 'Truy cập bị từ chối (403 Forbidden)'}
                    {serverError.type === 'rate_limit' && 'Giới hạn thử lại (429 Too Many Requests)'}
                    {serverError.type === 'captcha' && 'Mã xác nhận (CAPTCHA) không đúng'}
                    {serverError.type === 'auth' && 'Đăng nhập thất bại (401 Unauthorized)'}
                    {serverError.type === 'general' && 'Thông báo hệ thống'}
                  </div>
                  <div>{serverError.message}</div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              <span>Đăng nhập hệ thống</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Đăng nhập nhanh 1-Click
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Password@123</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('SV2026001')}
                className="p-2.5 text-left border border-slate-200/90 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/40 transition-all duration-150 group cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Sinh viên 1</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md font-bold">
                    SV2026001
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">Nguyễn Minh Sinh</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('sinhvien2@kltn.edu.vn')}
                className="p-2.5 text-left border border-slate-200/90 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/40 transition-all duration-150 group cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Sinh viên 2</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-md font-bold">
                    SV2026002
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">Trần Thị Mai</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('quang.nguyenhuu@kltn.edu.vn')}
                className="p-2.5 text-left border border-emerald-200/90 bg-emerald-50/20 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/60 transition-all duration-150 group cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-emerald-900 group-hover:text-emerald-950 flex items-center justify-between">
                  <span>GVHD (ThS. Nguyễn Hữu Quang)</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-md font-bold">
                    GVHD
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700/80 truncate mt-0.5">quang.nguyenhuu@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('truongbomon@kltn.edu.vn')}
                className="p-2.5 text-left border border-purple-200/90 bg-purple-50/20 rounded-2xl hover:border-purple-500 hover:bg-purple-50/60 transition-all duration-150 group cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-purple-900 group-hover:text-purple-950 flex items-center justify-between">
                  <span>Trưởng bộ môn</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded-md font-bold">
                    TRƯỞNG BM
                  </span>
                </div>
                <div className="text-[10px] text-purple-700/80 truncate mt-0.5">truongbomon@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('quanly@kltn.edu.vn')}
                className="p-2.5 text-left border border-amber-200/90 bg-amber-50/20 rounded-2xl hover:border-amber-500 hover:bg-amber-50/60 transition-all duration-150 group cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-amber-900 group-hover:text-amber-950 flex items-center justify-between">
                  <span>Quản lý bộ môn</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-md font-bold">
                    QUẢN LÝ BM
                  </span>
                </div>
                <div className="text-[10px] text-amber-700/80 truncate mt-0.5">quanly@kltn.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@kltn.edu.vn')}
                className="p-2.5 text-left border border-rose-200/90 bg-rose-50/30 rounded-2xl hover:border-rose-500 hover:bg-rose-50 transition-all duration-150 group cursor-pointer shadow-2xs"
              >
                <div className="text-xs font-bold text-rose-900 group-hover:text-rose-950 flex items-center justify-between">
                  <span>Quản trị viên (Admin)</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-md font-bold">
                    ADMIN
                  </span>
                </div>
                <div className="text-[10px] text-rose-700/80 truncate mt-0.5">admin@kltn.edu.vn</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security badges */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Mã hóa SSL 256-bit</span>
          </div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Bảo vệ phiên RBAC</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Khôi phục mật khẩu tài khoản"
        subtitle="Hệ thống hỗ trợ tự động xác thực và đặt lại mật khẩu"
      >
        {forgotStep === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Nhập email tài khoản trường cấp của bạn. Hệ thống sẽ cấp mã Token để bạn tiến hành thiết lập mật khẩu mới ngay lập tức.
            </p>
            <Input
              label="Email trường cấp"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@kltn.edu.vn"
              required
            />
            {forgotMessage && <p className="text-xs font-medium text-rose-500">{forgotMessage}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForgotModal(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary">
                Tạo mã khôi phục
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium">
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
              <Button type="button" variant="outline" onClick={() => setForgotStep('request')}>
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
