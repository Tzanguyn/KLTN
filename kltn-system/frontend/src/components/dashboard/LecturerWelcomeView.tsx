import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { WelcomeTimeline } from './WelcomeTimeline';
import {
  Users,
  BookOpen,
  FileText,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Sparkles,
  PlusCircle,
  MessageSquare,
  Edit3,
  Mail,
  ShieldCheck,
} from 'lucide-react';

interface LecturerWelcomeViewProps {
  onNavigate: (tab: string) => void;
  workspaceData?: any;
}

export const LecturerWelcomeView: React.FC<LecturerWelcomeViewProps> = ({ onNavigate, workspaceData }) => {
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
        // fallback to workspaceData
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  // Time greeting
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const title = user?.lecturerProfile?.title || 'ThS.';
  const fullName = user?.fullName || dashboardData?.user?.fullName || 'Giảng viên';
  const specialization = user?.lecturerProfile?.specialization || 'Công nghệ thông tin';

  const maxGroups = dashboardData?.summary?.maxGuidingGroups ?? user?.lecturerProfile?.maxGroups ?? 5;
  const guidedCount =
    dashboardData?.summary?.guidedGroupsCount ?? workspaceData?.myGroups?.length ?? 0;
  const remainingSlots = Math.max(0, maxGroups - guidedCount);
  const isOverloaded = guidedCount >= maxGroups;

  const topicsCount =
    dashboardData?.summary?.topicsCount ?? workspaceData?.myTopics?.length ?? 0;
  const approvedTopicsCount = dashboardData?.summary?.approvedTopicsCount ?? 0;
  const submissionsCount = workspaceData?.submissions?.length ?? 0;
  const reviewedCount =
    dashboardData?.summary?.reviewedGroupsCount ?? workspaceData?.reviewerAssignments?.length ?? 0;
  const committeesCount =
    dashboardData?.summary?.committeesCount ?? workspaceData?.committees?.length ?? 0;

  const actionItems: string[] = dashboardData?.actionItems?.length
    ? dashboardData.actionItems
    : [];

  if (!actionItems.length) {
    if (workspaceData?.proposals?.length) {
      actionItems.push(`Có ${workspaceData.proposals.length} đề xuất đề tài từ sinh viên cần xem xét`);
    }
    if (submissionsCount > 0) {
      actionItems.push(`Có ${submissionsCount} báo cáo tiến độ mới từ các nhóm sinh viên`);
    }
    if (reviewedCount > 0) {
      actionItems.push(`Đang được phân công phản biện cho ${reviewedCount} nhóm KLTN`);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER CHÀO MỪNG */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full border border-white/20 text-xs font-semibold text-emerald-100">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Cổng Giảng dạy & Hướng dẫn Khóa luận Tốt nghiệp</span>
              <span>•</span>
              <span>Học kỳ 1 (2026-2027)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {timeGreeting}, Thầy/Cô {title} {fullName}! 👋
            </h1>

            <p className="text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Quản lý danh sách nhóm hướng dẫn, theo dõi báo cáo định kỳ, nhận xét bài nộp và thực hiện
              chấm điểm đánh giá KLTN theo bộ 10 tiêu chí chuẩn.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Chuyên ngành: <strong>{specialization}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Bộ môn: <strong>Công nghệ phần mềm & Hệ thống</strong>
              </span>
            </div>
          </div>

          {/* Quota Tracker Box */}
          <div className="shrink-0 bg-white/10 backdrop-blur border border-white/20 p-5 rounded-2xl flex flex-col gap-2 min-w-[240px]">
            <span className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
              Hạn mức nhóm hướng dẫn
            </span>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-white">
                {guidedCount} / {maxGroups}
              </div>
              <Badge variant={isOverloaded ? 'danger' : 'success'} size="md">
                {isOverloaded ? 'Đạt hạn mức' : `Còn ${remainingSlots} chỗ`}
              </Badge>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 mt-1">
              <div
                className="bg-emerald-400 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (guidedCount / maxGroups) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. CẢNH BÁO & VIỆC CẦN XỬ LÝ (ACTION ITEMS) */}
      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-700" />
            <span>Việc cần xử lý & Cảnh báo chuyên môn ({actionItems.length})</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            Cần lưu ý
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {actionItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-emerald-200/60 shadow-xs text-xs text-slate-700"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
              <span className="leading-relaxed font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 5 THẺ KPI CHỈ SỐ TRỌNG YẾU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('groups')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nhóm hướng dẫn
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{guidedCount} nhóm</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Định mức: {maxGroups} nhóm</span>
              <span className="text-emerald-700 font-bold group-hover:underline">Chi tiết →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('topics')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đề tài của tôi
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{topicsCount} đề tài</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{approvedTopicsCount} đã phê duyệt</span>
              <span className="text-sky-600 font-bold group-hover:underline">Quản lý →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('submissions')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Báo cáo SV nộp
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{submissionsCount} bài nộp</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Nhận xét & phản hồi</span>
              <span className="text-amber-700 font-bold group-hover:underline">Xem ngay →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('defense')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nhóm phản biện
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{reviewedCount} nhóm</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Chấm điểm phản biện</span>
              <span className="text-purple-600 font-bold group-hover:underline">Xem DS →</span>
            </div>
          </div>
        </Card>

        <Card
          className="p-4 bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('scores')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chấm điểm 10 TC
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Edit3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">10 Tiêu chí</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Phiếu điểm PDF chuẩn</span>
              <span className="text-teal-700 font-bold group-hover:underline">Nhập điểm →</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. LỐI TẮT THAO TÁC NHANH (QUICK ACTION SHORTCUTS) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Thao tác Nhanh cho Giảng viên</span>
          </h3>
          <span className="text-xs text-slate-400">1-Click chuyển tab</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('topics')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
              Tạo đề tài mới
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Gửi duyệt Trưởng BM</span>
          </button>

          <button
            onClick={() => onNavigate('groups')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
              Nhóm hướng dẫn
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Đánh giá giữa kỳ</span>
          </button>

          <button
            onClick={() => onNavigate('submissions')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-amber-600">
              Nhận xét bài nộp
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Phản hồi báo cáo</span>
          </button>

          <button
            onClick={() => onNavigate('scores')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Edit3 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-600">
              Chấm điểm KLTN
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Lưu nháp / Khóa điểm</span>
          </button>

          <button
            onClick={() => onNavigate('appointments')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-purple-600">
              Họp định kỳ
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Đặt lịch với SV</span>
          </button>

          <button
            onClick={() => onNavigate('chat')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-rose-600">
              Trao đổi nhóm
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Tin nhắn tức thời</span>
          </button>
        </div>
      </div>

      {/* 5. LỘ TRÌNH KLTN 5 BƯỚC */}
      <WelcomeTimeline currentStep={3} />
    </div>
  );
};

