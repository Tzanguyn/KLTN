import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Calendar,
  ArrowRight,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  UserCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { api } from '../../api';

export interface TimelineStepItem {
  number: number;
  title: string;
  subtitle: string;
  phase: string;
  startDate?: string | null;
  endDate?: string | null;
  dateLabel?: string;
}

export interface SemesterTimelineInfo {
  id?: string;
  code?: string;
  name?: string;
  academicYear?: string;
  status?: string;
  registrationFrom?: string | null;
  registrationTo?: string | null;
  submissionTo?: string | null;
  defenseFrom?: string | null;
  defenseTo?: string | null;
  currentStep?: number;
  currentStage?: string;
  timelineSteps?: TimelineStepItem[];
}

export interface WelcomeTimelineProps {
  currentStep?: number; // 1-5 (nếu truyền vào sẽ ưu tiên)
  semesterInfo?: SemesterTimelineInfo;
  className?: string;
  isOverdue?: boolean;
  role?: string; // SINH_VIEN | GIANG_VIEN | TRUONG_BO_MON | QUAN_LY_BO_MON | ADMIN
  onNavigate?: (tab: string) => void;
  onStepClick?: (stepNumber: number) => void;
  canManageTimeline?: boolean;
  onTimelineStepChange?: (newStep: number) => void;
  showRoleGuidance?: boolean;
}

const defaultSteps: TimelineStepItem[] = [
  {
    number: 1,
    title: 'Đăng ký đề tài',
    subtitle: 'Mở đợt, chọn hoặc đề xuất đề tài mới',
    phase: 'Tuần 1 - 3',
  },
  {
    number: 2,
    title: 'Duyệt & Ghép nhóm',
    subtitle: 'GVHD duyệt, thành lập nhóm KLTN',
    phase: 'Tuần 3 - 4',
  },
  {
    number: 3,
    title: 'Thực hiện & Giữa kỳ',
    subtitle: 'Báo cáo tiến độ, đánh giá giữa kỳ',
    phase: 'Tuần 5 - 10',
  },
  {
    number: 4,
    title: 'Báo cáo & Phản biện',
    subtitle: 'Nộp báo cáo hoàn chỉnh, GV phản biện',
    phase: 'Tuần 11 - 13',
  },
  {
    number: 5,
    title: 'Bảo vệ & Tổng kết',
    subtitle: 'Hội đồng chấm điểm 10 tiêu chí, NCKH',
    phase: 'Tuần 14 - 15',
  },
];

const roleStepGuidance: Record<string, Record<number, string>> = {
  SINH_VIEN: {
    1: 'Chọn nguyện vọng đề tài từ danh sách công bố hoặc nộp đề xuất đề tài riêng cho GVHD.',
    2: 'Tìm bạn ghép nhóm (2-3 sinh viên), phân công nhóm trưởng và chờ GVHD phê duyệt chính thức.',
    3: 'Triển khai nghiên cứu, nộp báo cáo tiến độ định kỳ và hoàn thành đánh giá giữa kỳ.',
    4: 'Nộp quyển báo cáo hoàn chỉnh và mã nguồn/sản phẩm lên hệ thống cho Giảng viên phản biện.',
    5: 'Xem lịch bảo vệ chính thức, phòng thi và trình bày báo cáo trước Hội đồng chấm điểm 10 tiêu chí.',
  },
  GIANG_VIEN: {
    1: 'Đăng ký danh mục đề tài mới cho đợt KLTN và duyệt nguyện vọng đăng ký của sinh viên.',
    2: 'Xác nhận danh sách thành viên các nhóm KLTN đăng ký và gửi danh sách lên Bộ môn.',
    3: 'Đánh giá tiến độ giữa kỳ cho các nhóm hướng dẫn (TIẾP TỤC / DỪNG) và ghi nhận xét.',
    4: 'Thẩm định quyển báo cáo và chấm điểm phản biện cho các nhóm được Trưởng bộ môn phân công.',
    5: 'Tham gia Hội đồng chấm bảo vệ KLTN, chấm điểm 10 tiêu chí và đánh giá kết quả tổng kết.',
  },
  TRUONG_BO_MON: {
    1: 'Rà soát và phê duyệt danh mục đề tài KLTN của tất cả giảng viên trong bộ môn.',
    2: 'Phê duyệt danh sách nhóm KLTN chính thức và giám sát định mức hướng dẫn của giảng viên.',
    3: 'Giám sát tiến độ giữa kỳ toàn bộ môn, xử lý các nhóm bị cảnh báo dừng đề tài.',
    4: 'Phân công Giảng viên phản biện chéo và thẩm định các hồ sơ minh chứng NCKH cộng điểm.',
    5: 'Thành lập Hội đồng chấm bảo vệ, phê duyệt lịch bảo vệ và ký khóa bảng điểm đợt KLTN.',
  },
  QUAN_LY_BO_MON: {
    1: 'Cấu hình đợt KLTN, thiết lập các mốc thời gian và kiểm tra điều kiện tín chỉ sinh viên.',
    2: 'Cấp mã nhóm KLTN, giám sát quá trình lập nhóm và hỗ trợ giải quyết thắc mắc sinh viên.',
    3: 'Thống kê tình hình nộp báo cáo giữa kỳ và tổng hợp danh sách đủ điều kiện làm tiếp.',
    4: 'Kiểm tra hồ sơ nộp báo cáo cuối kỳ, chuẩn bị danh sách phân công phản biện.',
    5: 'Xếp phòng thi, điều phối lịch Hội đồng và xuất báo cáo tổng hợp bảng điểm toàn khoa.',
  },
  ADMIN: {
    1: 'Giám sát đợt KLTN mở đăng ký, kiểm tra tài khoản và phân quyền người dùng.',
    2: 'Kiểm tra hoạt động lập nhóm và cấu hình các tham số hạn mức nhóm.',
    3: 'Theo dõi lưu lượng nộp báo cáo và nhật ký hoạt động hệ thống.',
    4: 'Giám sát tiến độ phản biện và phân quyền mở khóa điểm khi có yêu cầu.',
    5: 'Theo dõi các phiên bảo vệ, xuất báo cáo kiểm toán và lưu trữ dữ liệu đợt KLTN.',
  },
};

const roleLabels: Record<string, string> = {
  SINH_VIEN: 'Sinh viên',
  GIANG_VIEN: 'Giảng viên',
  TRUONG_BO_MON: 'Trưởng bộ môn',
  QUAN_LY_BO_MON: 'Quản lý bộ môn',
  ADMIN: 'Quản trị viên',
};

const stepTabMapping: Record<string, Record<number, string>> = {
  SINH_VIEN: { 1: 'topics', 2: 'group', 3: 'progress', 4: 'progress', 5: 'scores' },
  GIANG_VIEN: { 1: 'topics', 2: 'groups', 3: 'submissions', 4: 'scores', 5: 'defense' },
  TRUONG_BO_MON: { 1: 'approvals', 2: 'workload', 3: 'reports', 4: 'reviewers', 5: 'committees' },
  QUAN_LY_BO_MON: { 1: 'semesters', 2: 'students', 3: 'progress', 4: 'progress', 5: 'defenses' },
  ADMIN: { 1: 'semesters', 2: 'users', 3: 'overview', 4: 'audit', 5: 'semesters' },
};

function formatDateShort(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return '';
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

export const WelcomeTimeline: React.FC<WelcomeTimelineProps> = ({
  currentStep: propCurrentStep,
  semesterInfo,
  className = '',
  isOverdue = false,
  role = 'SINH_VIEN',
  onNavigate,
  onStepClick,
  canManageTimeline = false,
  onTimelineStepChange,
  showRoleGuidance = true,
}) => {
  const [showStepModal, setShowStepModal] = useState(false);
  const [selectedStepOption, setSelectedStepOption] = useState<number>(0);
  const [savingStep, setSavingStep] = useState(false);

  // 1. Tự động xác định bước hiện tại (đồng bộ từ semesterInfo nếu không truyền prop cứng)
  let effectiveStep = 1;

  if (typeof propCurrentStep === 'number' && propCurrentStep >= 1 && propCurrentStep <= 5) {
    effectiveStep = propCurrentStep;
  } else if (
    typeof semesterInfo?.currentStep === 'number' &&
    semesterInfo.currentStep >= 1 &&
    semesterInfo.currentStep <= 5
  ) {
    effectiveStep = semesterInfo.currentStep;
  } else if (semesterInfo) {
    // Tự động tính từ thời gian thực so với mốc học kỳ
    const now = new Date();
    const regTo = semesterInfo.registrationTo ? new Date(semesterInfo.registrationTo) : null;
    const subTo = semesterInfo.submissionTo ? new Date(semesterInfo.submissionTo) : null;
    const defFrom = semesterInfo.defenseFrom ? new Date(semesterInfo.defenseFrom) : null;

    let midTo: Date | null = null;
    if (regTo && subTo) {
      midTo = new Date((regTo.getTime() + subTo.getTime()) / 2);
    }

    if (semesterInfo.status === 'ARCHIVED' || semesterInfo.status === 'CLOSED') {
      effectiveStep = 5;
    } else if (defFrom && now >= defFrom) {
      effectiveStep = 5;
    } else if (subTo && now >= subTo) {
      effectiveStep = 4;
    } else if (midTo && now >= midTo) {
      effectiveStep = 3;
    } else if (regTo && now > regTo) {
      effectiveStep = 2;
    } else {
      effectiveStep = 1;
    }
  }

  // 2. Tính toán ngày hiển thị cho từng bước dựa vào dữ liệu semesterInfo
  const resolvedSteps: TimelineStepItem[] = defaultSteps.map((step) => {
    let dateLabel = '';

    if (semesterInfo) {
      if (step.number === 1) {
        const from = formatDateShort(semesterInfo.registrationFrom);
        const to = formatDateShort(semesterInfo.registrationTo);
        if (from && to) dateLabel = `${from} - ${to}`;
        else if (to) dateLabel = `Đến ${to}`;
        else dateLabel = 'Giai đoạn mở đợt';
      } else if (step.number === 2) {
        const regTo = formatDateShort(semesterInfo.registrationTo);
        if (regTo) dateLabel = `Sau ${regTo}`;
        else dateLabel = 'Sau đợt đăng ký';
      } else if (step.number === 3) {
        const subTo = formatDateShort(semesterInfo.submissionTo);
        if (subTo) dateLabel = `Hạn nộp: ${subTo}`;
        else dateLabel = 'Báo cáo tiến độ';
      } else if (step.number === 4) {
        const subTo = formatDateShort(semesterInfo.submissionTo);
        const defFrom = formatDateShort(semesterInfo.defenseFrom);
        if (subTo && defFrom) dateLabel = `${subTo} - ${defFrom}`;
        else if (subTo) dateLabel = `Từ ${subTo}`;
        else dateLabel = 'Chấm phản biện';
      } else if (step.number === 5) {
        const defFrom = formatDateShort(semesterInfo.defenseFrom);
        const defTo = formatDateShort(semesterInfo.defenseTo);
        if (defFrom && defTo) dateLabel = `${defFrom} - ${defTo}`;
        else if (defFrom) dateLabel = `Từ ${defFrom}`;
        else dateLabel = 'Hội đồng bảo vệ';
      }
    }

    return {
      ...step,
      dateLabel,
    };
  });

  const currentStepTitle =
    resolvedSteps.find((s) => s.number === effectiveStep)?.title || 'Đang thực hiện';

  const roleKey = role || 'SINH_VIEN';
  const roleLabel = roleLabels[roleKey] || 'Người dùng';
  const currentGuidance =
    roleStepGuidance[roleKey]?.[effectiveStep] ||
    'Thực hiện các nhiệm vụ chuyên môn theo phân công trong đợt KLTN.';

  const handleStepClick = (stepNumber: number) => {
    if (onStepClick) {
      onStepClick(stepNumber);
      return;
    }
    if (onNavigate) {
      const targetTab = stepTabMapping[roleKey]?.[stepNumber];
      if (targetTab) {
        onNavigate(targetTab);
      }
    }
  };

  const handleSaveTimelineStep = async () => {
    if (!semesterInfo?.id) return;
    try {
      setSavingStep(true);
      if (selectedStepOption === 0) {
        // Tự động đồng bộ
        await api.put(`/semesters/${semesterInfo.id}/timeline-step`, { autoSync: true });
      } else {
        await api.put(`/semesters/${semesterInfo.id}/timeline-step`, { step: selectedStepOption });
      }
      setShowStepModal(false);
      if (onTimelineStepChange) {
        onTimelineStepChange(selectedStepOption);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật giai đoạn lộ trình');
    } finally {
      setSavingStep(false);
    }
  };

  const handleResetTestData = async () => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn đặt lại toàn bộ dữ liệu về trạng thái "Mới mở học kỳ" (Bước 1/5: Đăng ký đề tài)?\n\nHành động này sẽ xóa các đăng ký, nhóm, bài nộp, kết quả giữa kỳ, phản biện, hội đồng và điểm số cũ, đồng thời giữ nguyên 88 đề tài và các tài khoản để kiểm thử lại từ đầu.',
      )
    ) {
      return;
    }
    try {
      setSavingStep(true);
      await api.post('/semesters/reset-test-data', { semesterId: semesterInfo?.id });
      alert('Đã đặt lại dữ liệu về trạng thái Mới mở học kỳ (Bước 1/5) thành công!');
      if (onTimelineStepChange) {
        onTimelineStepChange(1);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi đặt lại dữ liệu kiểm thử');
    } finally {
      setSavingStep(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs ${className}`}>
      {/* HEADER LỘ TRÌNH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Lộ trình Học kỳ Khóa luận Tốt nghiệp</span>
            </h3>
            {semesterInfo?.name && (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {semesterInfo.name} {semesterInfo.academicYear ? `(${semesterInfo.academicYear})` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình chuẩn 5 giai đoạn đồng bộ từ đăng ký nguyện vọng đến bảo vệ trước hội đồng
          </p>
        </div>

        {/* BADGES & QUẢN LÝ GIAI ĐOẠN */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <span
            className={`text-[11px] px-3 py-1 font-semibold rounded-lg border flex items-center gap-2 shadow-2xs ${
              isOverdue
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isOverdue ? 'bg-rose-600' : 'bg-indigo-600'
              }`}
            />
            <span>
              Giai đoạn hiện tại: Bước {effectiveStep}/5 • <strong className="font-bold">{currentStepTitle}</strong>
              {isOverdue && ' (Có mốc trễ hạn)'}
            </span>
          </span>

          {canManageTimeline && semesterInfo?.id && (
            <button
              onClick={() => {
                setSelectedStepOption(effectiveStep);
                setShowStepModal(true);
              }}
              className="text-[11px] px-2.5 py-1 font-semibold rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Trưởng BM / Quản lý điều chỉnh giai đoạn lộ trình đợt KLTN"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chuyển bước</span>
            </button>
          )}

          {roleKey === 'TRUONG_BO_MON' && (
            <button
              onClick={handleResetTestData}
              disabled={savingStep}
              className="text-[11px] px-2.5 py-1 font-semibold rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Đặt lại toàn bộ dữ liệu về lúc mới mở học kỳ (Bước 1: Đăng ký đề tài) để kiểm thử (Chỉ Trưởng bộ môn)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${savingStep ? 'animate-spin' : ''}`} />
              <span>Reset dữ liệu đầu kỳ</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER NHIỆM VỤ THEO VAI TRÒ (ROLE-SPECIFIC GUIDANCE) */}
      {showRoleGuidance && (
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-slate-50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider bg-indigo-600 text-white shrink-0 mt-0.5 sm:mt-0">
              {roleLabel}
            </span>
            <span className="text-slate-700 font-medium leading-relaxed">
              <strong className="text-indigo-950">Nhiệm vụ Bước {effectiveStep} ({currentStepTitle}):</strong>{' '}
              {currentGuidance}
            </span>
          </div>

          {(onNavigate || onStepClick) && (
            <button
              onClick={() => handleStepClick(effectiveStep)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 shrink-0 self-end sm:self-center cursor-pointer transition-colors"
            >
              <span>Vào tab tác vụ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 5 BƯỚC LỘ TRÌNH (RESPONSIVE STEP CHAIN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {resolvedSteps.map((step) => {
          const isDone = step.number < effectiveStep;
          const isCurrent = step.number === effectiveStep;
          const isUpcoming = step.number > effectiveStep;
          const isClickable = Boolean(onNavigate || onStepClick);

          return (
            <div
              key={step.number}
              onClick={() => isClickable && handleStepClick(step.number)}
              className={`relative p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isClickable ? 'cursor-pointer hover:border-indigo-400 hover:shadow-xs group' : ''
              } ${
                isCurrent
                  ? isOverdue
                    ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                  : isDone
                  ? 'bg-slate-50/80 border-emerald-200/90 text-slate-700'
                  : 'bg-white border-slate-200/70 opacity-60 hover:opacity-90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? isOverdue
                          ? 'bg-rose-600 text-white ring-2 ring-rose-300'
                          : 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {step.phase}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 transition-colors">
                  {step.title}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {step.subtitle}
                </p>
              </div>

              {/* THÔNG TIN NGÀY THỰC TẾ & TRẠNG THÁI */}
              <div className="mt-3 pt-2 border-t border-slate-200/50 flex flex-col gap-1">
                {step.dateLabel && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{step.dateLabel}</span>
                  </div>
                )}

                {isCurrent && (
                  <div
                    className={`text-[10px] font-bold flex items-center justify-between mt-0.5 ${
                      isOverdue ? 'text-rose-600' : 'text-indigo-700'
                    }`}
                  >
                    <span>{isOverdue ? 'Đang diễn ra (Quá hạn)' : 'Đang diễn ra'}</span>
                    <ArrowRight className="w-3 h-3 animate-pulse" />
                  </div>
                )}
                {isDone && (
                  <div className="text-[10px] font-medium text-emerald-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Đã hoàn thành</span>
                    </span>
                    {isClickable && <span className="text-[9px] text-slate-400">Xem lại</span>}
                  </div>
                )}
                {isUpcoming && (
                  <div className="text-[10px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Sắp diễn ra</span>
                    {isClickable && <span className="text-[9px] text-slate-400">Xem trước</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL ĐIỀU CHỈNH GIAI ĐOẠN (CHỈ DÀNH CHO MANAGER / HEAD) */}
      {showStepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>Điều chỉnh Giai đoạn Lộ trình KLTN</span>
              </h4>
              <button
                onClick={() => setShowStepModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Thiết lập giai đoạn hiện tại của Đợt KLTN. Khi thay đổi, tất cả các vai trò (Sinh viên, Giảng viên, Trưởng bộ môn, Quản lý) sẽ được đồng bộ ngay lập tức.
            </p>

            <div className="space-y-2">
              <label
                onClick={() => setSelectedStepOption(0)}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                  selectedStepOption === 0
                    ? 'border-indigo-600 bg-indigo-50/60 font-bold text-indigo-950'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div>Tự động đồng bộ theo tiến độ thực tế</div>
                    <div className="text-[11px] font-normal text-slate-500">
                      Tự động xác định từ mốc thời gian và dữ liệu bảo vệ / nộp bài
                    </div>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={selectedStepOption === 0}
                  onChange={() => setSelectedStepOption(0)}
                  className="accent-indigo-600"
                />
              </label>

              {defaultSteps.map((s) => (
                <label
                  key={s.number}
                  onClick={() => setSelectedStepOption(s.number)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                    selectedStepOption === s.number
                      ? 'border-indigo-600 bg-indigo-50/60 font-bold text-indigo-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {s.number}
                    </span>
                    <div>
                      <div>Bước {s.number}: {s.title}</div>
                      <div className="text-[11px] font-normal text-slate-500">{s.subtitle}</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={selectedStepOption === s.number}
                    onChange={() => setSelectedStepOption(s.number)}
                    className="accent-indigo-600"
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowStepModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={savingStep}
                onClick={handleSaveTimelineStep}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingStep && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Lưu & Đồng bộ ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
