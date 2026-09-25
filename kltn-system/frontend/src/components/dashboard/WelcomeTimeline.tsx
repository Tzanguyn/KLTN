import React from 'react';
import { CheckCircle2, Clock, Calendar, ArrowRight } from 'lucide-react';

interface TimelineStep {
  number: number;
  title: string;
  subtitle: string;
  phase: string;
}

const steps: TimelineStep[] = [
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

interface WelcomeTimelineProps {
  currentStep?: number; // 1-5
  semesterInfo?: {
    code?: string;
    name?: string;
    registrationTo?: string;
    submissionTo?: string;
    defenseFrom?: string;
  };
}

export const WelcomeTimeline: React.FC<WelcomeTimelineProps> = ({ currentStep = 3, semesterInfo }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Lộ trình Học kỳ Khóa luận Tốt nghiệp</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Quy trình chuẩn 5 giai đoạn từ đăng ký nguyện vọng đến bảo vệ trước hội đồng
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Giai đoạn hiện tại: Bước {currentStep}/5</span>
          </span>
        </div>
      </div>

      {/* Responsive Step Chain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step) => {
          const isDone = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isUpcoming = step.number > currentStep;

          return (
            <div
              key={step.number}
              className={`relative p-3.5 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                  : isDone
                  ? 'bg-slate-50/80 border-emerald-200/90 text-slate-700'
                  : 'bg-white border-slate-200/70 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {step.phase}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-800 leading-tight mb-1">
                {step.title}
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {step.subtitle}
              </p>

              {isCurrent && (
                <div className="mt-2 text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                  <span>Đang diễn ra</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

