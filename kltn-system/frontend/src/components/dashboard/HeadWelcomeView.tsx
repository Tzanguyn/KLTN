import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { WelcomeTimeline } from './WelcomeTimeline';
import {
  ShieldCheck,
  Award,
  Users,
  Calendar,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  BarChart3,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface HeadWelcomeViewProps {
  onNavigate: (tab: string) => void;
  workspaceData?: any;
}

export const HeadWelcomeView: React.FC<HeadWelcomeViewProps> = ({ onNavigate, workspaceData }) => {
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

  const fullName = user?.fullName || dashboardData?.user?.fullName || 'Trưởng bộ môn';

  const pendingTopicsCount =
    dashboardData?.summary?.pendingTopicsCount ?? workspaceData?.pendingTopics?.length ?? 0;
  const totalGroupsCount =
    dashboardData?.summary?.totalGroupsCount ?? workspaceData?.allGroups?.length ?? 0;
  const unassignedReviewersCount =
    dashboardData?.summary?.unassignedReviewersCount ?? 0;
  const readyForDefenseCount =
    dashboardData?.summary?.readyForDefenseCount ?? 0;
  const pendingScoreUnlocksCount =
    dashboardData?.summary?.pendingScoreUnlocksCount ??
    workspaceData?.scoreRequests?.filter((r: any) => r.status === 'PENDING')?.length ??
    0;
  const pendingEvidenceCount =
    dashboardData?.summary?.pendingEvidenceCount ?? workspaceData?.pendingEvidence?.length ?? 0;
  const incompleteScoresCount = dashboardData?.summary?.incompleteScoresCount ?? 0;

  const actionItems: string[] = dashboardData?.actionItems?.length
    ? dashboardData.actionItems
    : [];

  if (!actionItems.length) {
    if (pendingTopicsCount > 0) {
      actionItems.push(`Có ${pendingTopicsCount} đề tài mới của Giảng viên cần phê duyệt`);
    }
    if (pendingScoreUnlocksCount > 0) {
      actionItems.push(`Có ${pendingScoreUnlocksCount} yêu cầu mở khóa sửa điểm đang chờ xử lý`);
    }
    if (pendingEvidenceCount > 0) {
      actionItems.push(`Có ${pendingEvidenceCount} hồ sơ minh chứng NCKH sinh viên cần thẩm định`);
    }
    if (unassignedReviewersCount > 0) {
      actionItems.push(`Còn ${unassignedReviewersCount} nhóm KLTN chưa được phân công CB Phản biện`);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER CHÀO MỪNG */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full border border-white/20 text-xs font-semibold text-purple-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Cổng Điều hành Chuyên môn KLTN</span>
              <span>•</span>
              <span>Bộ môn Công nghệ Phần mềm & Hệ thống</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {timeGreeting}, Thầy/Cô Trưởng bộ môn {fullName}! 👋
            </h1>

            <p className="text-sm text-purple-100 max-w-2xl leading-relaxed">
              Theo dõi và điều phối chất lượng chuyên môn toàn bộ môn: Xét duyệt đề tài, phân bổ tải hướng dẫn,
              phân công phản biện, thành lập hội đồng và giám sát tính minh bạch của bảng điểm KLTN.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Học kỳ: <strong>Học kỳ 1 (2026-2027)</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Quyền hạn: <strong>Phê duyệt Chuyên môn & Thẩm định</strong>
              </span>
            </div>
          </div>

          {/* Quick Approvals Stat Box */}
          <div className="shrink-0 bg-white/10 backdrop-blur border border-white/20 p-5 rounded-2xl flex flex-col gap-2 min-w-[240px]">
            <span className="text-xs text-purple-200 uppercase tracking-wider font-semibold">
              Hồ sơ chờ Trưởng BM duyệt
            </span>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-white">
                {pendingTopicsCount + pendingScoreUnlocksCount + pendingEvidenceCount}
              </div>
              <Badge variant={pendingTopicsCount > 0 ? 'warning' : 'success'} size="md">
                {pendingTopicsCount > 0 ? 'Cần duyệt ngay' : 'Đã xử lý hết'}
              </Badge>
            </div>
            <span className="text-[11px] text-purple-200">
              {pendingTopicsCount} đề tài • {pendingScoreUnlocksCount} yêu cầu điểm • {pendingEvidenceCount} NCKH
            </span>
          </div>
        </div>
      </div>

      {/* 2. TRUNG TÂM ĐIỀU HÀNH & CẢNH BÁO (ACTION ITEMS) */}
      <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-purple-950 font-bold text-sm">
            <ShieldCheck className="w-4.5 h-4.5 text-purple-700" />
            <span>Việc cần phê duyệt & Cảnh báo chuyên môn Bộ môn ({actionItems.length})</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
            Thẩm quyền Trưởng BM
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {actionItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-purple-200/60 shadow-xs text-xs text-slate-700"
            >
              <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 shrink-0" />
              <span className="leading-relaxed font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 6 THẺ KPI CHỈ SỐ CHUYÊN MÔN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('approvals')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đề tài chờ duyệt
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{pendingTopicsCount}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Đề tài mới gửi</span>
              <span className="text-purple-700 font-bold group-hover:underline">Duyệt →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('workload')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nhóm KLTN
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{totalGroupsCount} nhóm</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Tải giảng viên</span>
              <span className="text-blue-600 font-bold group-hover:underline">Xem tải →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('reviewers')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chưa gán phản biện
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{unassignedReviewersCount} nhóm</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Phân công CB</span>
              <span className="text-amber-700 font-bold group-hover:underline">Gán ngay →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('committees')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đủ ĐK bảo vệ
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{readyForDefenseCount} nhóm</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Hội đồng & Lịch</span>
              <span className="text-emerald-700 font-bold group-hover:underline">Lập HĐ →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('score-locks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mở khóa điểm
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Unlock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{pendingScoreUnlocksCount} yêu cầu</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Yêu cầu từ GV</span>
              <span className="text-rose-600 font-bold group-hover:underline">Xem xét →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('evidence')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Minh chứng NCKH
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900">{pendingEvidenceCount} hồ sơ</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Thẩm định điểm</span>
              <span className="text-teal-700 font-bold group-hover:underline">Thẩm định →</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. LỐI TẮT THAO TÁC NHANH (QUICK ACTION SHORTCUTS) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Thao tác Điều hành Chuyên môn</span>
          </h3>
          <span className="text-xs text-slate-400">1-Click chuyển tab</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <button
            onClick={() => onNavigate('approvals')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
              Duyệt đề tài
            </span>
            <span className="text-[10px] text-slate-400">{pendingTopicsCount} chờ duyệt</span>
          </button>

          <button
            onClick={() => onNavigate('workload')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
              Hạn mức GV
            </span>
            <span className="text-[10px] text-slate-400">Điều phối quota</span>
          </button>

          <button
            onClick={() => onNavigate('reviewers')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
              Gán phản biện
            </span>
            <span className="text-[10px] text-slate-400">Tránh trùng GVHD</span>
          </button>

          <button
            onClick={() => onNavigate('committees')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-600">
              Lập Hội đồng
            </span>
            <span className="text-[10px] text-slate-400">Xếp lịch bảo vệ</span>
          </button>

          <button
            onClick={() => onNavigate('scores')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Award className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-amber-600">
              Bảng điểm KLTN
            </span>
            <span className="text-[10px] text-slate-400">Cảnh báo thiếu</span>
          </button>

          <button
            onClick={() => onNavigate('score-locks')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Unlock className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-rose-600">
              Mở khóa điểm
            </span>
            <span className="text-[10px] text-slate-400">Xét duyệt lý do</span>
          </button>

          <button
            onClick={() => onNavigate('evidence')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Award className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-600">
              Duyệt NCKH
            </span>
            <span className="text-[10px] text-slate-400">Cộng điểm thưởng</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
              Xuất Excel
            </span>
            <span className="text-[10px] text-slate-400">Báo cáo tổng hợp</span>
          </button>
        </div>
      </div>

      {/* 5. LỘ TRÌNH KLTN 5 BƯỚC */}
      <WelcomeTimeline currentStep={4} />
    </div>
  );
};

