import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { WelcomeTimeline } from './WelcomeTimeline';
import {
  Calendar,
  Settings,
  Users,
  Clock,
  Award,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RotateCw,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface ManagerWelcomeViewProps {
  onNavigate: (tab: string) => void;
  workspaceData?: any;
}

export const ManagerWelcomeView: React.FC<ManagerWelcomeViewProps> = ({ onNavigate, workspaceData }) => {
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboard');
        setDashboardData(res.data?.data ?? res.data);
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const fullName = user?.fullName || dashboardData?.user?.fullName || 'Quản lý bộ môn';

  const totalStudents = dashboardData?.summary?.totalStudents ?? workspaceData?.students?.length ?? 120;
  const eligibleStudentsCount = dashboardData?.summary?.eligibleStudentsCount ?? 95;
  const totalGroupsCount = dashboardData?.summary?.totalGroupsCount ?? workspaceData?.groups?.length ?? 45;
  const activeGroupsCount = dashboardData?.summary?.activeGroupsCount ?? 40;
  const formingGroupsCount = dashboardData?.summary?.formingGroupsCount ?? 5;
  const stoppedGroupsCount = dashboardData?.summary?.stoppedGroupsCount ?? 2;
  const scheduledDefensesCount =
    dashboardData?.summary?.scheduledDefensesCount ?? workspaceData?.schedules?.length ?? 28;

  const registrationBreakdown = dashboardData?.registrationBreakdown ?? {
    APPROVED: 42,
    PENDING: 8,
    REJECTED: 3,
  };

  const actionItems: string[] = dashboardData?.actionItems?.length
    ? dashboardData.actionItems
    : [];

  if (!actionItems.length) {
    if (formingGroupsCount > 0) {
      actionItems.push(`Có ${formingGroupsCount} nhóm KLTN vẫn đang ở trạng thái lập dở dang (FORMING)`);
    }
    if (stoppedGroupsCount > 0) {
      actionItems.push(`Có ${stoppedGroupsCount} nhóm KLTN bị dừng sau đợt đánh giá giữa kỳ`);
    }
    actionItems.push('Cần kiểm tra hạn chót nộp báo cáo hoàn thiện và xếp lịch bảo vệ trước hội đồng');
  }

  const eligiblePercentage =
    totalStudents > 0 ? Math.round((eligibleStudentsCount / totalStudents) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER CHÀO MỪNG */}
      <div className="bg-gradient-to-r from-amber-800 via-orange-800 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full border border-white/20 text-xs font-semibold text-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Cổng Vận hành & Quản lý Giáo vụ KLTN</span>
              <span>•</span>
              <span>Khoa Công nghệ Thông tin</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {timeGreeting}, {fullName}! 👋
            </h1>

            <p className="text-sm text-amber-100 max-w-2xl leading-relaxed">
              Theo dõi và giám sát toàn diện các mốc thời gian của đợt KLTN, kiểm soát điều kiện tín chỉ sinh viên,
              cấu hình hệ thống, theo dõi tiến độ nộp bài và điều phối xếp lịch hội đồng bảo vệ.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Đợt hiện hành: <strong>Học kỳ 1 (2026-2027)</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Trạng thái: <strong>Đang mở đợt (OPEN)</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Vai trò: <strong>Quản lý Vận hành & Giáo vụ</strong>
              </span>
            </div>
          </div>

          {/* Quick Operations Stat Box */}
          <div className="shrink-0 bg-white/10 backdrop-blur border border-white/20 p-5 rounded-2xl flex flex-col gap-2 min-w-[240px]">
            <span className="text-xs text-amber-200 uppercase tracking-wider font-semibold">
              Sinh viên đủ điều kiện KLTN
            </span>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-white">
                {eligibleStudentsCount} / {totalStudents}
              </div>
              <Badge variant="success" size="md">
                {eligiblePercentage}%
              </Badge>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 mt-1">
              <div
                className="bg-amber-400 h-2 rounded-full transition-all"
                style={{ width: `${eligiblePercentage}%` }}
              />
            </div>
            <span className="text-[11px] text-amber-200">
              {totalStudents - eligibleStudentsCount} sinh viên chưa đủ điều kiện
            </span>
          </div>
        </div>
      </div>

      {/* 2. CẢNH BÁO & VIỆC CẦN XỬ LÝ (ACTION ITEMS) */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
            <ShieldCheck className="w-4.5 h-4.5 text-amber-700" />
            <span>Việc hành chính cần theo dõi & Đôn đốc ({actionItems.length})</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            Nhiệm vụ Giáo vụ
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {actionItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200/60 shadow-xs text-xs text-slate-700"
            >
              <div className="w-2 h-2 rounded-full bg-amber-600 mt-1.5 shrink-0" />
              <span className="leading-relaxed font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 5 THẺ KPI CHỈ SỐ VẬN HÀNH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('semesters')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đợt KLTN
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">HK1 (26-27)</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Trạng thái: Đang mở</span>
              <span className="text-amber-700 font-bold group-hover:underline">Cấu hình →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('students')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sinh viên đủ ĐK
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {eligibleStudentsCount} / {totalStudents}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Đạt chuẩn {eligiblePercentage}%</span>
              <span className="text-blue-600 font-bold group-hover:underline">Tra cứu →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('progress')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nhóm KLTN
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{totalGroupsCount} nhóm</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{activeGroupsCount} nhóm hoạt động</span>
              <span className="text-emerald-700 font-bold group-hover:underline">Theo dõi →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('defenses')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lịch bảo vệ đã xếp
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{scheduledDefensesCount} lịch</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Hội đồng & Phòng thi</span>
              <span className="text-purple-600 font-bold group-hover:underline">Xếp lịch →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('reports')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Thống kê & Báo cáo
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">100% Số liệu</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Xuất Excel & Dashboard</span>
              <span className="text-teal-700 font-bold group-hover:underline">Xem ngay →</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. LỐI TẮT THAO TÁC NHANH (QUICK ACTION SHORTCUTS) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Thao tác Nhanh Vận hành & Giáo vụ</span>
          </h3>
          <span className="text-xs text-slate-400">1-Click chuyển tab</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('semesters')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
              Đợt KLTN
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Mở đợt / Hạn chót</span>
          </button>

          <button
            onClick={() => onNavigate('configs')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
              Cấu hình hệ thống
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Quy chế & Tham số</span>
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-600">
              DS Sinh viên
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Lọc đủ / Chưa đủ ĐK</span>
          </button>

          <button
            onClick={() => onNavigate('progress')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-purple-600">
              Tiến độ & Giữa kỳ
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Giám sát báo cáo</span>
          </button>

          <button
            onClick={() => onNavigate('defenses')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
              Xếp lịch bảo vệ
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Phòng & Hội đồng</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-600">
              Xuất báo cáo
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Biểu mẫu Excel</span>
          </button>
        </div>
      </div>

      {/* 5. LỘ TRÌNH KLTN 5 BƯỚC */}
      <WelcomeTimeline currentStep={2} />
    </div>
  );
};

