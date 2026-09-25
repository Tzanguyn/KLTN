import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { WelcomeTimeline } from './WelcomeTimeline';
import {
  GraduationCap,
  BookOpen,
  ClipboardList,
  UploadCloud,
  MessageSquare,
  Calendar,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Users,
  Mail,
  Phone,
  UserCheck,
  Sparkles,
  ShieldAlert,
  FileText,
} from 'lucide-react';

interface StudentWelcomeViewProps {
  onNavigate: (tab: string) => void;
  workspaceData?: any;
}

export const StudentWelcomeView: React.FC<StudentWelcomeViewProps> = ({ onNavigate, workspaceData }) => {
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
        // graceful fallback to workspaceData
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

  // Extract student attributes
  const studentCode =
    dashboardData?.studentProfile?.studentCode ||
    user?.mssv ||
    user?.studentProfile?.studentCode ||
    'SV2026001';

  const fullName = user?.fullName || dashboardData?.user?.fullName || 'Sinh viên';
  const credits =
    dashboardData?.studentProfile?.credits ??
    user?.studentProfile?.creditsEarned ??
    125;
  const gpa = dashboardData?.studentProfile?.gpa ?? user?.studentProfile?.gpa ?? 3.2;

  const isEligible =
    dashboardData?.studentProfile?.eligible ??
    (user?.duDieuKienDangKyKLTN !== undefined
      ? user.duDieuKienDangKyKLTN
      : credits >= 110);

  const group = dashboardData?.group || workspaceData?.myGroup;
  const registration = dashboardData?.registration || workspaceData?.registrations?.[0];
  const defenseSchedule = dashboardData?.defenseSchedule || workspaceData?.defenseSchedules?.[0];
  const submissionsCount =
    dashboardData?.group?.submissions?.length ?? workspaceData?.submissions?.length ?? 0;
  const appointmentsCount = workspaceData?.appointments?.length ?? 0;

  // Determine current timeline step
  let currentStep = 1;
  if (defenseSchedule) {
    currentStep = 5;
  } else if (group?.midtermStatus === 'CONTINUE' || group?.midtermStatus === 'CHO_LAM_TIEP') {
    currentStep = 4;
  } else if (group) {
    currentStep = 3;
  } else if (registration) {
    currentStep = 2;
  }

  // Action items
  const actionItems: string[] = dashboardData?.actionItems?.length
    ? dashboardData.actionItems
    : [];

  if (!actionItems.length) {
    if (!isEligible) {
      actionItems.push('Hồ sơ học tập hiện tại chưa đủ 110 tín chỉ để đăng ký KLTN');
    } else if (!group && !registration) {
      actionItems.push('Bạn chưa đăng ký đề tài KLTN. Hãy xem danh mục đề tài hoặc đề xuất đề tài mới');
    } else if (registration && !group) {
      actionItems.push('Đơn đăng ký đề tài đang chờ Giảng viên hướng dẫn xét duyệt');
    } else if (group) {
      actionItems.push('Nhớ cập nhật báo cáo tiến độ tuần và họp trao đổi với GVHD định kỳ');
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER CHÀO MỪNG */}
      <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full border border-white/20 text-xs font-semibold text-indigo-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Hệ thống Quản lý Khóa luận Tốt nghiệp CNTT</span>
              <span>•</span>
              <span>Học kỳ 1 (2026-2027)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {timeGreeting}, {fullName}! 👋
            </h1>

            <p className="text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Chào mừng bạn đến với Cổng thông tin điều phối và báo cáo KLTN. Theo dõi tình trạng điều kiện,
              tiến độ thực hiện đề tài và chuẩn bị cho phiên bảo vệ trước hội đồng.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                MSSV: <strong>{studentCode}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Ngành: <strong>Kỹ thuật Phần mềm / CNTT</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur font-medium">
                Tín chỉ: <strong>{credits} TC</strong>
              </span>
            </div>
          </div>

          {/* Status Box */}
          <div className="shrink-0 bg-white/10 backdrop-blur border border-white/20 p-5 rounded-2xl flex flex-col gap-2 min-w-[240px]">
            <span className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">
              Tình trạng xét điều kiện
            </span>
            <div className="flex items-center gap-2">
              {isEligible ? (
                <Badge variant="success" size="md">
                  <CheckCircle2 className="w-4 h-4 mr-1 inline" /> Đủ ĐK làm KLTN
                </Badge>
              ) : (
                <Badge variant="danger" size="md">
                  <AlertTriangle className="w-4 h-4 mr-1 inline" /> Chưa đủ điều kiện
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-indigo-200">
              {isEligible
                ? `Đạt ${credits}/110 tín chỉ quy định`
                : `Thiếu ${110 - credits} tín chỉ so với chuẩn`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CẢNH BÁO & VIỆC CẦN LÀM (ACTION ITEMS) */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Việc cần lưu ý & Cần làm ngay ({actionItems.length})</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
            Ưu tiên xử lý
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {actionItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200/60 shadow-xs text-xs text-slate-700"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <span className="leading-relaxed font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 4 THẺ KPI CHỈ SỐ TRỌNG YẾU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Điều kiện KLTN */}
        <Card
          className="p-4.5 bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('profile')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tín chỉ & Học tập
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{credits} TC</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Điểm GPA: <strong>{gpa} / 4.0</strong></span>
              <span className="text-indigo-600 font-bold group-hover:underline">Chi tiết →</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Đề tài & Nhóm */}
        <Card
          className="p-4.5 bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate(group ? 'kltn-profile' : 'topics')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đề tài KLTN
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-slate-900 truncate">
              {group?.topic?.title || registration?.topic?.title || 'Chưa đăng ký'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{group ? `Nhóm: ${group.code}` : registration ? 'Đang xét duyệt' : 'Chọn đề tài'}</span>
              <span className="text-sky-600 font-bold group-hover:underline">Xem ngay →</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Tiến độ & Bài nộp */}
        <Card
          className="p-4.5 bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate('progress')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Báo cáo tiến độ
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UploadCloud className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{submissionsCount} bản nộp</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Nộp tài liệu & source</span>
              <span className="text-emerald-600 font-bold group-hover:underline">Nộp bài →</span>
            </div>
          </div>
        </Card>

        {/* Card 4: Lịch bảo vệ & Hẹn */}
        <Card
          className="p-4.5 bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onNavigate(defenseSchedule ? 'defense' : 'appointments')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lịch bảo vệ / Hẹn
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-slate-900 truncate">
              {defenseSchedule ? `Phòng ${defenseSchedule.room || 'Chưa xếp'}` : `${appointmentsCount} Lịch hẹn`}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{defenseSchedule ? 'Hội đồng chính thức' : 'Trao đổi với GVHD'}</span>
              <span className="text-purple-600 font-bold group-hover:underline">Xem lịch →</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. LỐI TẮT THAO TÁC NHANH (QUICK ACTION SHORTCUTS) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Thao tác Nhanh cho Sinh viên</span>
          </h3>
          <span className="text-xs text-slate-400">1-Click chuyển tab</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('topics')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
              Đăng ký đề tài
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Danh mục khoa</span>
          </button>

          <button
            onClick={() => onNavigate('my-reg')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-sky-600">
              Đơn đăng ký
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Trạng thái duyệt</span>
          </button>

          <button
            onClick={() => onNavigate('progress')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-600">
              Nộp báo cáo
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Tiến độ tuần</span>
          </button>

          <button
            onClick={() => onNavigate('chat')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-amber-600">
              Trao đổi GVHD
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Chat nhóm realtime</span>
          </button>

          <button
            onClick={() => onNavigate('appointments')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-purple-600">
              Lịch hẹn gặp
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Đặt lịch GVHD</span>
          </button>

          <button
            onClick={() => onNavigate('scores')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-600">
              Điểm & NCKH
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Phiếu điểm PDF</span>
          </button>
        </div>
      </div>

      {/* 5. LỘ TRÌNH KLTN 5 BƯỚC */}
      <WelcomeTimeline currentStep={currentStep} />

      {/* 6. THÔNG TIN ĐỀ TÀI & NHÓM KLTN CỦA TÔI */}
      {group ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Thông tin Nhóm & Đề tài chính thức
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {group.topic?.title || group.name || 'Khóa luận Tốt nghiệp'}
              </h3>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
              Mã nhóm: {group.code}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="text-xs text-slate-400 font-semibold uppercase">Giảng viên hướng dẫn</div>
              <div className="text-sm font-bold text-slate-800">
                {group.topic?.advisorName || group.topic?.owner?.fullName || 'Chưa cập nhật'}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{group.topic?.advisorEmail || 'gvhd@kltn.edu.vn'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="text-xs text-slate-400 font-semibold uppercase">Đánh giá giữa kỳ</div>
              <div className="text-sm font-bold text-slate-800">
                {group.midtermStatus === 'CONTINUE' || group.midtermStatus === 'CHO_LAM_TIEP'
                  ? 'Được tiếp tục thực hiện'
                  : group.midtermStatus === 'STOPPED'
                  ? 'Tạm dừng đề tài'
                  : 'Đang thực hiện / Chờ đánh giá'}
              </div>
              <div className="text-xs text-slate-500">
                {group.midtermNote || 'Theo dõi lịch đánh giá định kỳ của Bộ môn'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="text-xs text-slate-400 font-semibold uppercase">Thành viên nhóm</div>
              <div className="text-sm font-bold text-slate-800">
                {group.members?.length || 1} Sinh viên
              </div>
              <div className="text-xs text-slate-500 truncate">
                {group.members?.map((m: any) => m?.fullName || m?.student?.user?.fullName || m?.user?.fullName || m?.studentCode || 'Sinh viên').filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100/90 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            Bạn chưa có Đề tài và Nhóm KLTN chính thức
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Vào mục Đề tài & Đăng ký để duyệt danh mục các đề tài được Bộ môn phê duyệt hoặc gửi đề xuất
            đề tài tự do sau khi liên hệ trước với Giảng viên hướng dẫn.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => onNavigate('topics')}>
              Xem danh mục đề tài mở đăng ký <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

