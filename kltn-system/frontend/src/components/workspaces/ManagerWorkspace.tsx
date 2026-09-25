import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import {
  Calendar,
  Settings,
  Users,
  Clock,
  Award,
  FileSpreadsheet,
  Download,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  X,
  ShieldCheck,
  XCircle,
  RotateCw,
  Eye,
  AlertCircle,
  Layers,
  Filter,
  LayoutDashboard,
} from 'lucide-react';
import { ManagerWelcomeView } from '../dashboard/ManagerWelcomeView';

export const ManagerWorkspace: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('welcome');

  // Data states
  const [semesters, setSemesters] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setMyGroups] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Statistics Dashboard states
  const [regStats, setRegStats] = useState<any>(null);
  const [progressStats, setProgressStats] = useState<any>(null);
  const [milestoneStats, setMilestoneStats] = useState<any>(null);
  const [midtermStats, setMidtermStats] = useState<any>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [progressFilter, setProgressFilter] = useState<string>('ALL');
  const [midtermFilter, setMidtermFilter] = useState<string>('ALL');

  // Search & Filter
  const [searchStudent, setSearchStudent] = useState('');
  const [filterEligible, setFilterEligible] = useState('');

  // Defense Eligibility & Scores Tracking
  const [defenseSubTab, setDefenseSubTab] = useState<'schedules' | 'eligibility' | 'scores'>('schedules');
  const [defenseEligibleGroups, setDefenseEligibleGroups] = useState<any[]>([]);
  const [filterReadyForDefense, setFilterReadyForDefense] = useState(true);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [scoresData, setScoresData] = useState<any[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoresIncompleteOnly, setScoresIncompleteOnly] = useState(false);
  const [scoresSearch, setScoresSearch] = useState('');
  const [selectedScoreDetails, setSelectedScoreDetails] = useState<any>(null);

  // Modals & form state
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [semCode, setSemCode] = useState('');
  const [semName, setSemName] = useState('');
  const [semYear, setSemYear] = useState('2026-2027');
  const [semRegFrom, setSemRegFrom] = useState('');
  const [semRegTo, setSemRegTo] = useState('');
  const [semSubTo, setSemSubTo] = useState('');
  const [semDefFrom, setSemDefFrom] = useState('');
  const [semDefTo, setSemDefTo] = useState('');

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configKey, setConfigKey] = useState('MAX_GROUP_SIZE');
  const [configValue, setConfigValue] = useState('3');
  const [configDesc, setConfigDesc] = useState('');

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const semParam = selectedSemesterId ? `?semesterId=${selectedSemesterId}` : '';
      const [
        semRes,
        cfgRes,
        stdRes,
        grpRes,
        schRes,
        dashRes,
        regStatRes,
        progStatRes,
        milesStatRes,
        midStatRes,
      ] = await Promise.all([
        api.get('/config/semesters'),
        api.get('/config'),
        api.get(
          `/users/students?limit=100&search=${encodeURIComponent(searchStudent)}&eligible=${filterEligible}`,
        ),
        api.get(`/groups${semParam}`),
        api.get('/defense/schedules'),
        api.get('/reports/dashboard'),
        api.get(`/statistics/registration-status${semParam}`).catch(() => null),
        api.get(`/statistics/progress${semParam}`).catch(() => null),
        api.get(`/statistics/milestones${semParam}`).catch(() => null),
        api.get(`/statistics/midterm-results${semParam}`).catch(() => null),
      ]);

      setSemesters(semRes.data.data ?? []);
      setConfigs(cfgRes.data.data ?? []);
      setStudents(stdRes.data.data.items ?? []);
      setMyGroups(grpRes.data.data ?? []);
      setSchedules(schRes.data.data ?? []);
      setDashboardStats(dashRes.data.data ?? null);
      setRegStats(regStatRes?.data?.data ?? null);
      setProgressStats(progStatRes?.data?.data ?? null);
      setMilestoneStats(milesStatRes?.data?.data ?? null);
      setMidtermStats(midStatRes?.data?.data ?? null);
    } catch (err: any) {
      console.error('Error loading manager data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchStudent, filterEligible, selectedSemesterId]);

  const loadDefenseEligibility = async (readyOnly = filterReadyForDefense) => {
    setLoadingEligible(true);
    try {
      const semParam = selectedSemesterId ? `&semesterId=${selectedSemesterId}` : '';
      const res = await api.get(`/groups?readyForDefense=${readyOnly}${semParam}`);
      setDefenseEligibleGroups(res.data?.data?.items ?? res.data?.data ?? []);
    } catch (err) {
      console.error('Error loading defense eligibility:', err);
    } finally {
      setLoadingEligible(false);
    }
  };

  const loadScoresData = async (incompleteOnly = scoresIncompleteOnly, search = scoresSearch) => {
    setLoadingScores(true);
    try {
      const params: any = {};
      if (selectedSemesterId) params.semesterId = selectedSemesterId;
      if (incompleteOnly) params.incompleteOnly = 'true';
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/scores', { params });
      const sData = res.data?.data;
      setScoresData(Array.isArray(sData) ? sData : (sData?.items ?? []));
    } catch (err) {
      console.error('Error loading scores:', err);
    } finally {
      setLoadingScores(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'defenses') {
      if (defenseSubTab === 'eligibility') {
        loadDefenseEligibility(filterReadyForDefense);
      } else if (defenseSubTab === 'scores') {
        loadScoresData(scoresIncompleteOnly, scoresSearch);
      }
    }
  }, [activeTab, defenseSubTab, selectedSemesterId, filterReadyForDefense, scoresIncompleteOnly]);

  // Create Semester
  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Find department
      const deptId = semesters[0]?.departmentId;
      await api.post('/config/semesters', {
        code: semCode,
        name: semName,
        academicYear: semYear,
        departmentId: deptId,
        status: 'OPEN',
        registrationFrom: semRegFrom ? new Date(semRegFrom).toISOString() : undefined,
        registrationTo: semRegTo ? new Date(semRegTo).toISOString() : undefined,
        submissionTo: semSubTo ? new Date(semSubTo).toISOString() : undefined,
        defenseFrom: semDefFrom ? new Date(semDefFrom).toISOString() : undefined,
        defenseTo: semDefTo ? new Date(semDefTo).toISOString() : undefined,
      });
      notify('Tạo đợt KLTN mới thành công!');
      setShowSemesterModal(false);
      setSemCode('');
      setSemName('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi tạo học kỳ', 'error');
    }
  };

  // Toggle Semester Status
  const handleToggleSemesterStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      await api.patch(`/config/semesters/${id}`, { status: nextStatus });
      notify(`Đã chuyển trạng thái đợt KLTN sang ${nextStatus}!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi cập nhật', 'error');
    }
  };

  // Save System Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/config/${configKey}`, {
        value: Number(configValue) || configValue,
        description: configDesc,
      });
      notify('Lưu cấu hình hệ thống thành công!');
      setShowConfigModal(false);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi lưu cấu hình', 'error');
    }
  };

  // Toggle student eligibility
  const handleToggleEligibility = async (studentId: string, currentEligible: boolean) => {
    try {
      await api.patch(`/users/students/${studentId}/eligibility`, {
        eligible: !currentEligible,
      });
      notify(`Đã cập nhật điều kiện sinh viên thành ${!currentEligible ? 'ĐỦ ĐIỀU KIỆN' : 'CHƯA ĐẠT'}!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi cập nhật', 'error');
    }
  };

  // Export Excel
  const handleExportExcel = async (type = 'registrations') => {
    try {
      const semParam = selectedSemesterId ? `&semesterId=${selectedSemesterId}` : '';
      const res = await api.get(`/reports/export-excel?type=${type}${semParam}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-${selectedSemesterId || 'toan-khoa'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`Đã tải file Excel [${type}] thành công!`);
    } catch {
      notify('Lỗi xuất file Excel', 'error');
    }
  };

  // Export Score Sheet PDF
  const handleExportScoreSheetPdf = async (groupId?: string) => {
    try {
      const semParam = selectedSemesterId ? `semesterId=${selectedSemesterId}` : '';
      const groupParam = groupId ? `groupIds=${groupId}` : '';
      const query = [semParam, groupParam].filter(Boolean).join('&');
      const res = await api.get(`/reports/score-sheet-pdf${query ? `?${query}` : ''}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = groupId ? `phieu-diem-nhom-${groupId.slice(0, 8)}.pdf` : `phieu-diem-kltn.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Đã tải phiếu điểm KLTN định dạng PDF thành công!');
    } catch {
      notify('Lỗi xuất file PDF phiếu điểm', 'error');
    }
  };

  const navItems = [
    { id: 'welcome', label: 'Tổng quan & Chào mừng', icon: LayoutDashboard },
    { id: 'semesters', label: 'Đợt KLTN & Học kỳ', icon: Calendar, count: semesters.length },
    { id: 'configs', label: 'Cấu hình hệ thống', icon: Settings },
    { id: 'students', label: 'Danh sách sinh viên', icon: Users, count: students.length },
    { id: 'progress', label: 'Tiến độ & Giữa kỳ', icon: Clock },
    { id: 'defenses', label: 'Hội đồng & Bảo vệ', icon: Award, count: schedules.length },
    { id: 'reports', label: 'Dashboard & Thống kê', icon: FileSpreadsheet },
  ];

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {statusMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium transition-all ${
            statusMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main 2-Column Layout: Left Sidebar + Right Content */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* THANH CHỨC NĂNG BÊN TRÁI (LEFT SIDEBAR) */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
              <span>Quản trị Đợt KLTN</span>
              <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                {navItems.length} mục
              </span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-200 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1.5 shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Mini System Overview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-100/80 text-xs text-amber-950 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <Settings className="w-4 h-4 text-amber-600" />
              <span>Tổng quan vận hành</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Sinh viên đợt này:</span>
                <strong className="text-amber-700 font-bold">{dashboardStats?.students ?? 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>Nhóm KLTN:</span>
                <strong className="text-amber-700 font-bold">{dashboardStats?.groups ?? 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>Đợt bảo vệ:</span>
                <strong className="text-amber-700 font-bold">{dashboardStats?.defenses ?? 0}</strong>
              </div>
            </div>
          </div>
        </aside>

        {/* NỘI DUNG CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tab 0: Welcome Dashboard */}
          {activeTab === 'welcome' && (
            <ManagerWelcomeView
              onNavigate={(tab) => setActiveTab(tab)}
              workspaceData={{
                semesters,
                configs,
                students,
                groups,
                schedules,
                dashboardStats,
              }}
            />
          )}

          {activeTab !== 'welcome' && (
            <>
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-amber-700 via-orange-800 to-amber-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold uppercase tracking-wider">
                      <span>Quản lý bộ môn</span>
                      <span>•</span>
                      <span>Vận hành & Kỹ thuật đợt KLTN</span>
                    </div>
                    <h2 className="text-2xl font-bold mt-1 text-white">{user?.fullName}</h2>
                    <p className="text-amber-100 text-sm mt-1">
                      Quản lý học kỳ, thời hạn đăng ký, điều kiện sinh viên và điều phối hệ thống
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 p-3 rounded-xl text-xs">
                    <div className="text-center px-2">
                      <div className="text-amber-200">Tổng sinh viên</div>
                      <div className="text-lg font-bold text-white">{dashboardStats?.students ?? 0}</div>
                    </div>
                    <div className="text-center px-2 border-l border-white/20">
                      <div className="text-amber-200">Nhóm KLTN</div>
                      <div className="text-lg font-bold text-white">{dashboardStats?.groups ?? 0}</div>
                    </div>
                    <div className="text-center px-2 border-l border-white/20">
                      <div className="text-amber-200">Đợt bảo vệ</div>
                      <div className="text-lg font-bold text-white">{dashboardStats?.defenses ?? 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

      {/* TAB 1: Semesters / Đợt KLTN */}
      {activeTab === 'semesters' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Danh sách Học kỳ & Đợt KLTN
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấu hình các mốc thời gian mở đăng ký, hạn nộp bài và thời gian bảo vệ
              </p>
            </div>
            <Button size="sm" variant="primary" className="bg-amber-700 hover:bg-amber-800" onClick={() => setShowSemesterModal(true)}>
              <PlusCircle className="w-4 h-4 mr-1.5" /> Thêm đợt KLTN mới
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {semesters.map((sem) => (
                <div key={sem.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={sem.status === 'OPEN' ? 'success' : 'neutral'}>
                        {sem.status}
                      </Badge>
                      <span className="font-mono font-bold text-slate-900 text-sm">{sem.code}</span>
                      <span className="text-xs text-slate-500 font-medium">({sem.academicYear})</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-800">{sem.name}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500 pt-1">
                      <div>
                        Đăng ký:{' '}
                        <b className="text-slate-700">
                          {sem.registrationFrom ? new Date(sem.registrationFrom).toLocaleDateString('vi-VN') : '—'}
                          {' đến '}
                          {sem.registrationTo ? new Date(sem.registrationTo).toLocaleDateString('vi-VN') : '—'}
                        </b>
                      </div>
                      <div>
                        Hạn nộp bài:{' '}
                        <b className="text-slate-700">
                          {sem.submissionTo ? new Date(sem.submissionTo).toLocaleDateString('vi-VN') : '—'}
                        </b>
                      </div>
                      <div>
                        Lịch bảo vệ:{' '}
                        <b className="text-slate-700">
                          {sem.defenseFrom ? new Date(sem.defenseFrom).toLocaleDateString('vi-VN') : '—'}
                        </b>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleSemesterStatus(sem.id, sem.status)}
                    >
                      {sem.status === 'OPEN' ? 'Đóng đăng ký' : 'Mở đăng ký'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: System Configs */}
      {activeTab === 'configs' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-600" />
              Cấu hình thông số hệ thống
            </h3>
            <Button size="sm" variant="secondary" onClick={() => setShowConfigModal(true)}>
              Thêm / Cập nhật cấu hình
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Mã tham số (Key)</th>
                    <th className="p-3">Giá trị cấu hình (Value)</th>
                    <th className="p-3">Mô tả ý nghĩa</th>
                    <th className="p-3">Cập nhật lần cuối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {configs.map((cfg) => (
                    <tr key={cfg.id}>
                      <td className="p-3 font-mono font-bold text-indigo-700">{cfg.key}</td>
                      <td className="p-3 font-bold text-slate-900 text-sm">{JSON.stringify(cfg.value)}</td>
                      <td className="p-3 text-slate-600">{cfg.description || '—'}</td>
                      <td className="p-3 text-slate-400">
                        {new Date(cfg.updatedAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Student Roster & Eligibility */}
      {activeTab === 'students' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Quản lý Sinh viên & Xét điều kiện KLTN ({students.length})
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm MSSV, tên, lớp..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <select
                  value={filterEligible}
                  onChange={(e) => setFilterEligible(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="true">Đủ điều kiện</option>
                  <option value="false">Chưa đủ điều kiện</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">MSSV</th>
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">Lớp sinh hoạt</th>
                    <th className="p-3">Tín chỉ tích lũy</th>
                    <th className="p-3">Điểm GPA</th>
                    <th className="p-3">Trạng thái KLTN</th>
                    <th className="p-3 text-right">Xét duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((st) => (
                    <tr key={st.id}>
                      <td className="p-3 font-mono font-bold text-slate-900">{st.studentCode}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        {st.user?.fullName}
                        <div className="text-[10px] text-slate-400 font-normal">{st.user?.email}</div>
                      </td>
                      <td className="p-3 text-slate-600">{st.className || '—'}</td>
                      <td className="p-3 font-bold text-indigo-600">{st.creditsEarned} TC</td>
                      <td className="p-3 text-slate-700">{st.gpa ?? '—'}</td>
                      <td className="p-3">
                        <Badge variant={st.eligible ? 'success' : 'danger'}>
                          {st.eligible ? 'Đủ điều kiện' : 'Chưa đạt'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant={st.eligible ? 'outline' : 'primary'}
                          onClick={() => handleToggleEligibility(st.id, st.eligible)}
                        >
                          {st.eligible ? 'Hủy duyệt' : 'Duyệt điều kiện'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Groups & Progress Monitoring */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          {/* Progress Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Tổng nhóm</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {progressStats?.summary?.totalGroups ?? groups.length}
              </div>
            </Card>
            <Card className="p-3 border-emerald-200 bg-emerald-50/40">
              <div className="text-[11px] font-semibold text-emerald-700 uppercase">Hoàn thành</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {progressStats?.summary?.completedGroupsCount ?? 0}
              </div>
            </Card>
            <Card className="p-3 border-blue-200 bg-blue-50/40">
              <div className="text-[11px] font-semibold text-blue-700 uppercase">Đang thực hiện</div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {progressStats?.summary?.inProgressGroupsCount ?? 0}
              </div>
            </Card>
            <Card className="p-3 border-rose-200 bg-rose-50/40">
              <div className="text-[11px] font-semibold text-rose-700 uppercase">Quá hạn</div>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {progressStats?.summary?.overdueGroupsCount ?? 0}
              </div>
            </Card>
            <Card className="p-3 border-slate-200 bg-slate-100/50">
              <div className="text-[11px] font-semibold text-slate-600 uppercase">Dừng / Hủy</div>
              <div className="text-2xl font-bold text-slate-700 mt-1">
                {progressStats?.summary?.stoppedGroupsCount ?? 0}
              </div>
            </Card>
            <Card className="p-3 border-indigo-200 bg-indigo-50/40">
              <div className="text-[11px] font-semibold text-indigo-700 uppercase">Tiến độ TB</div>
              <div className="text-2xl font-bold text-indigo-700 mt-1">
                {progressStats?.summary?.averageProgressPercent ?? 0}%
              </div>
            </Card>
          </div>

          {/* Groups by Progress Filter */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Theo dõi Tiến độ Thực hiện của các Nhóm KLTN
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân loại nhóm theo 4 trạng thái: Hoàn thành, Đang thực hiện, Quá hạn và Dừng
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'HOAN_THANH', label: 'Hoàn thành' },
                  { id: 'DANG_THUC_HIEN', label: 'Đang làm' },
                  { id: 'QUA_HAN', label: 'Quá hạn' },
                  { id: 'DUNG', label: 'Dừng / Hủy' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setProgressFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      progressFilter === f.id
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Mã nhóm</th>
                      <th className="p-3">Tên nhóm & Đề tài</th>
                      <th className="p-3">GVHD</th>
                      <th className="p-3">Thành viên</th>
                      <th className="p-3">Tiến độ (%)</th>
                      <th className="p-3">Trạng thái / Mốc quá hạn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const allAnalyzed = [
                        ...(progressStats?.groups?.HOAN_THANH ?? []),
                        ...(progressStats?.groups?.DANG_THUC_HIEN ?? []),
                        ...(progressStats?.groups?.QUA_HAN ?? []),
                        ...(progressStats?.groups?.DUNG ?? []),
                      ];
                      const listToDisplay =
                        progressFilter === 'ALL'
                          ? allAnalyzed.length > 0
                            ? allAnalyzed
                            : groups
                          : progressStats?.groups?.[progressFilter] ?? [];

                      if (listToDisplay.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              Không có nhóm nào ở trạng thái này.
                            </td>
                          </tr>
                        );
                      }

                      return listToDisplay.map((g: any) => (
                        <tr key={g.id}>
                          <td className="p-3 font-mono font-bold text-slate-800">{g.code}</td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{g.name}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {g.topic?.title ?? '—'}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600">
                            {g.topic?.owner?.fullName ?? 'Chưa phân công'}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold">{g.members?.length ?? 0} SV</span>
                            {g.members?.length > 0 && (
                              <div className="text-[10px] text-slate-400">
                                {g.members.map((m: any) => m.studentCode).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    (g.progressPercent ?? 0) === 100
                                      ? 'bg-emerald-500'
                                      : (g.progressPercent ?? 0) >= 50
                                      ? 'bg-blue-500'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${g.progressPercent ?? 0}%` }}
                                />
                              </div>
                              <span className="font-bold text-[11px]">{g.progressPercent ?? 0}%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {g.progressCategory === 'HOAN_THANH' ? (
                              <Badge variant="success">Hoàn thành</Badge>
                            ) : g.progressCategory === 'QUA_HAN' ? (
                              <div className="space-y-1">
                                <Badge variant="danger">Quá hạn deadline</Badge>
                                {g.overdueMilestones?.map((m: string) => (
                                  <div key={m} className="text-[10px] text-rose-600 font-medium">
                                    • {m}
                                  </div>
                                ))}
                              </div>
                            ) : g.progressCategory === 'DUNG' ? (
                              <Badge variant="neutral">Dừng KLTN</Badge>
                            ) : (
                              <Badge variant="primary">Đang thực hiện</Badge>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 5 Milestones Progress Breakdown */}
          {milestoneStats?.milestones?.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Theo dõi Chi tiết 5 Mốc Tiến độ Quan trọng
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {milestoneStats.milestones.map((m: any) => (
                    <div
                      key={m.key}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                    >
                      <div className="text-xs font-bold text-slate-800 line-clamp-1">{m.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Hạn:{' '}
                        {m.deadline
                          ? new Date(m.deadline).toLocaleDateString('vi-VN')
                          : 'Theo kế hoạch'}
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-emerald-700 font-semibold">
                          {m.summary?.completed ?? 0} hoàn thành
                        </span>
                        {m.summary?.overdue > 0 && (
                          <span className="text-rose-600 font-bold">
                            {m.summary.overdue} quá hạn
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full"
                          style={{ width: `${m.summary?.completionRate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 5: Defenses Overview & Eligibility & Scores */}
      {activeTab === 'defenses' && (
        <div className="space-y-4">
          {/* Sub Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDefenseSubTab('schedules')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  defenseSubTab === 'schedules'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Award className="w-4 h-4" />
                Lịch bảo vệ toàn đợt ({schedules.length})
              </button>
              <button
                onClick={() => {
                  setDefenseSubTab('eligibility');
                  loadDefenseEligibility(filterReadyForDefense);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  defenseSubTab === 'eligibility'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Theo dõi Đủ điều kiện bảo vệ
              </button>
              <button
                onClick={() => {
                  setDefenseSubTab('scores');
                  loadScoresData(scoresIncompleteOnly, scoresSearch);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  defenseSubTab === 'scores'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Bảng điểm KLTN & Cảnh báo thiếu điểm
              </button>
            </div>

            {defenseSubTab === 'eligibility' && (
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={filterReadyForDefense}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setFilterReadyForDefense(nextVal);
                      loadDefenseEligibility(nextVal);
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Chỉ hiện nhóm đủ điều kiện (readyForDefense=true)</span>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadDefenseEligibility(filterReadyForDefense)}
                  disabled={loadingEligible}
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1 ${loadingEligible ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>
              </div>
            )}

            {defenseSubTab === 'scores' && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm nhóm, đề tài, sinh viên..."
                    value={scoresSearch}
                    onChange={(e) => {
                      setScoresSearch(e.target.value);
                      loadScoresData(scoresIncompleteOnly, e.target.value);
                    }}
                    className="pl-7 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48 focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <input
                    type="checkbox"
                    checked={scoresIncompleteOnly}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setScoresIncompleteOnly(nextVal);
                      loadScoresData(nextVal, scoresSearch);
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Chỉ nhóm thiếu điểm
                  </span>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadScoresData(scoresIncompleteOnly, scoresSearch)}
                  disabled={loadingScores}
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1 ${loadingScores ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>
              </div>
            )}
          </div>

          {/* SUB-VIEW 1: Schedules */}
          {defenseSubTab === 'schedules' && (
            <Card>
              <CardHeader>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  Lịch bảo vệ toàn đợt KLTN ({schedules.length})
                </h3>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Nhóm bảo vệ</th>
                        <th className="p-3">Thời gian bắt đầu</th>
                        <th className="p-3">Phòng</th>
                        <th className="p-3">Hội đồng chấm</th>
                        <th className="p-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedules.map((sch) => (
                        <tr key={sch.id}>
                          <td className="p-3 font-bold text-slate-800">{sch.group?.name ?? sch.group?.code}</td>
                          <td className="p-3 font-semibold">{new Date(sch.startsAt).toLocaleString('vi-VN')}</td>
                          <td className="p-3 font-bold text-amber-800">{sch.room || 'Chưa xếp'}</td>
                          <td className="p-3 text-slate-600">{sch.committee?.name ?? '—'}</td>
                          <td className="p-3">
                            <Badge variant="primary">{sch.status}</Badge>
                          </td>
                        </tr>
                      ))}
                      {schedules.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            Chưa có lịch bảo vệ nào được xếp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SUB-VIEW 2: Defense Eligibility Tracking */}
          {defenseSubTab === 'eligibility' && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    Theo dõi Danh sách Đủ điều kiện Bảo vệ ({defenseEligibleGroups.length} nhóm)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Điều kiện: Sinh viên có kết quả giữa kỳ CHO LÀM TIẾP và đề tài không bị dừng/hủy.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số nhóm</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{defenseEligibleGroups.length}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[11px] font-semibold text-emerald-700 uppercase">Đủ điều kiện bảo vệ</div>
                    <div className="text-xl font-bold text-emerald-800 mt-1">
                      {defenseEligibleGroups.filter((g: any) => g.isReadyForDefense || g.defenseEligibility?.eligible).length}
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <div className="text-[11px] font-semibold text-indigo-700 uppercase">Đã có lịch bảo vệ</div>
                    <div className="text-xl font-bold text-indigo-800 mt-1">
                      {defenseEligibleGroups.filter((g: any) => g.hasDefenseSchedule || g.defenseSchedule).length}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[11px] font-semibold text-amber-700 uppercase">Cần xếp lịch bảo vệ</div>
                    <div className="text-xl font-bold text-amber-800 mt-1">
                      {defenseEligibleGroups.filter((g: any) => (g.isReadyForDefense || g.defenseEligibility?.eligible) && !g.hasDefenseSchedule && !g.defenseSchedule).length}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="p-3">Mã nhóm / Đề tài</th>
                        <th className="p-3">Sinh viên</th>
                        <th className="p-3">GV Hướng dẫn</th>
                        <th className="p-3">Đánh giá giữa kỳ</th>
                        <th className="p-3">Điều kiện bảo vệ</th>
                        <th className="p-3">Lịch bảo vệ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {defenseEligibleGroups.map((grp: any) => {
                        const isEligible = grp.isReadyForDefense ?? grp.defenseEligibility?.eligible ?? (grp.midtermStatus === 'CONTINUE' || grp.midtermStatus === 'CHO_LAM_TIEP');
                        const hasSchedule = grp.hasDefenseSchedule || !!grp.defenseSchedule;
                        const sch = grp.defenseSchedule;
                        const students = grp.students || grp.members || [];

                        return (
                          <tr key={grp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                                {grp.code}
                              </span>
                              <div className="font-semibold text-slate-800 mt-1 line-clamp-2">
                                {grp.topic?.title || grp.name}
                              </div>
                            </td>
                            <td className="p-3">
                              {students.length > 0 ? (
                                <div className="space-y-1">
                                  {students.map((st: any) => (
                                    <div key={st.id || st.userId} className="text-slate-700">
                                      <span className="font-medium">{st.user?.fullName || st.fullName}</span>
                                      {(st.studentCode || st.user?.studentCode) && (
                                        <span className="text-[11px] text-slate-400 ml-1 font-mono">({st.studentCode || st.user?.studentCode})</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Chưa có thành viên</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-slate-800">
                                {grp.topic?.owner?.fullName || grp.gvhd?.fullName || 'Chưa cập nhật'}
                              </div>
                            </td>
                            <td className="p-3">
                              {grp.midtermStatus === 'CONTINUE' || grp.midtermStatus === 'CHO_LAM_TIEP' ? (
                                <Badge variant="success" size="sm">CHO LÀM TIẾP</Badge>
                              ) : grp.midtermStatus === 'STOPPED' || grp.midtermStatus === 'DUNG_DE_TAI' ? (
                                <Badge variant="danger" size="sm">DỪNG ĐỀ TÀI</Badge>
                              ) : (
                                <Badge variant="neutral" size="sm">Chưa đánh giá</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              {isEligible ? (
                                <Badge variant="success" size="sm" className="gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> ĐỦ ĐIỀU KIỆN
                                </Badge>
                              ) : (
                                <div className="space-y-0.5">
                                  <Badge variant="danger" size="sm" className="gap-1">
                                    <XCircle className="w-3 h-3" /> CHƯA ĐỦ ĐIỀU KIỆN
                                  </Badge>
                                  {grp.defenseEligibility?.reason && (
                                    <div className="text-[10px] text-rose-600 font-medium">
                                      {grp.defenseEligibility.reason}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {hasSchedule && sch ? (
                                <div className="space-y-0.5">
                                  <Badge variant="primary" size="sm">
                                    Phòng {sch.room || 'Chưa xếp'}
                                  </Badge>
                                  <div className="text-[11px] text-slate-600">
                                    {new Date(sch.startsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(sch.startsAt).toLocaleDateString('vi-VN')}
                                  </div>
                                </div>
                              ) : (
                                <Badge variant="warning" size="sm">Chưa xếp lịch</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {defenseEligibleGroups.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                            Không tìm thấy nhóm nào phù hợp tiêu chí.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SUB-VIEW 3: Scores Management & Incomplete Warnings */}
          {defenseSubTab === 'scores' && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                    Bảng Điểm KLTN Toàn diện & Cảnh báo Chưa đầy đủ ({scoresData.length} nhóm)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quản lý điểm thành phần (GVHD 30%, GVPB 30%, Hội đồng 40%, NCKH) và phát hiện các nhóm còn thiếu điểm.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số nhóm</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{(Array.isArray(scoresData) ? scoresData : []).length}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[11px] font-semibold text-emerald-700 uppercase">Đầy đủ điểm</div>
                    <div className="text-xl font-bold text-emerald-800 mt-1">
                      {(Array.isArray(scoresData) ? scoresData : []).filter((s: any) => s.scoreCompleteness?.isComplete).length}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[11px] font-semibold text-amber-700 uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Cảnh báo thiếu điểm
                    </div>
                    <div className="text-xl font-bold text-amber-800 mt-1">
                      {(Array.isArray(scoresData) ? scoresData : []).filter((s: any) => s.scoreCompleteness?.hasWarning).length}
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <div className="text-[11px] font-semibold text-indigo-700 uppercase">Điểm TB toàn đợt</div>
                    <div className="text-xl font-bold text-indigo-800 mt-1">
                      {(() => {
                        const validScores = (Array.isArray(scoresData) ? scoresData : []).filter((s: any) => typeof s.finalScore === 'number');
                        if (validScores.length === 0) return '—';
                        const avg = validScores.reduce((sum: number, s: any) => sum + s.finalScore, 0) / validScores.length;
                        return `${avg.toFixed(2)} / 10`;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="p-3">Nhóm / Đề tài</th>
                        <th className="p-3 text-center">Điểm GVHD (30%)</th>
                        <th className="p-3 text-center">Điểm GVPB (30%)</th>
                        <th className="p-3 text-center">Điểm Hội đồng (40%)</th>
                        <th className="p-3 text-center">NCKH</th>
                        <th className="p-3 text-center">Tổng kết</th>
                        <th className="p-3">Tình trạng & Cảnh báo</th>
                        <th className="p-3 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(Array.isArray(scoresData) ? scoresData : []).map((item: any) => {
                        const sc = item.scoreCompleteness || {};
                        const isComplete = sc.isComplete;
                        const hasWarning = sc.hasWarning;
                        const warnings = sc.warnings || [];

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 min-w-[200px]">
                              <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                                {item.code}
                              </span>
                              <div className="font-semibold text-slate-800 mt-1 line-clamp-2">
                                {item.topic?.title || item.name}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {item.scores?.gvhd !== null && item.scores?.gvhd !== undefined ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900">{item.scores.gvhd}</span>
                                  <div>
                                    {item.scoreBreakdown?.gvhd?.isDraft ? (
                                      <Badge variant="warning" size="sm">Nháp</Badge>
                                    ) : (
                                      <Badge variant="success" size="sm">Khóa</Badge>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <Badge variant="danger" size="sm">Chưa có</Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.scores?.gvpb !== null && item.scores?.gvpb !== undefined ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900">{item.scores.gvpb}</span>
                                  <div>
                                    {item.scoreBreakdown?.gvpb?.isDraft ? (
                                      <Badge variant="warning" size="sm">Nháp</Badge>
                                    ) : (
                                      <Badge variant="success" size="sm">Khóa</Badge>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <Badge variant="neutral" size="sm">Chưa có</Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.scores?.council !== null && item.scores?.council !== undefined ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900">{item.scores.council}</span>
                                  <div>
                                    <Badge variant="primary" size="sm">
                                      {item.scores.councilEvaluationsCount || 0}/{item.scores.councilMembersCount || 0}
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <Badge variant="neutral" size="sm">Chưa chấm</Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.scores?.bonusPoints > 0 ? (
                                <Badge variant="purple" size="sm">+{item.scores.bonusPoints}</Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {item.finalScore !== null && item.finalScore !== undefined ? (
                                <div className="space-y-0.5">
                                  <div className="font-extrabold text-indigo-900">{item.finalScore}</div>
                                  <Badge size="sm" variant={item.ketQua === 'DAT' ? 'success' : 'danger'}>
                                    {item.xepLoai || item.ketQua}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-slate-400">Chưa xong</span>
                              )}
                            </td>
                            <td className="p-3 min-w-[220px]">
                              {isComplete ? (
                                <Badge variant="success" size="sm" className="gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Đầy đủ
                                </Badge>
                              ) : hasWarning ? (
                                <div className="space-y-1">
                                  <Badge variant="warning" size="sm" className="gap-1 text-amber-800 bg-amber-100 border-amber-300">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    {warnings.length} Cảnh báo
                                  </Badge>
                                  <ul className="space-y-0.5 text-[11px] text-amber-900 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200">
                                    {warnings.map((w: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-1">
                                        <span className="text-amber-500 shrink-0">•</span>
                                        <span>{w}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <Badge variant="neutral" size="sm">Đang cập nhật</Badge>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedScoreDetails(item)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!Array.isArray(scoresData) || scoresData.length === 0) && (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                            Không tìm thấy dữ liệu điểm phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 6: Dashboard & Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Semester Selector Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">Báo cáo Thống kê Toàn diện</h3>
              <p className="text-xs text-slate-500">
                Theo dõi tình hình đăng ký KLTN, tiến độ thực hiện và kết quả đánh giá giữa kỳ
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Đợt KLTN:</label>
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                <option value="">Đợt hiện tại (Mặc định)</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 1: Thống kê đăng ký đề tài & Lập nhóm */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Thống kê Tình hình Đăng ký Đề tài & Lập nhóm
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-indigo-600 uppercase">
                    Tỉ lệ đăng ký
                  </div>
                  <div className="text-2xl font-bold text-indigo-900 mt-1">
                    {regStats?.summary?.registrationRate ?? 0}%
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-600 uppercase">
                    Đã có nhóm/đề tài
                  </div>
                  <div className="text-2xl font-bold text-emerald-900 mt-1">
                    {regStats?.summary?.registeredStudents ?? 0} /{' '}
                    {regStats?.summary?.totalEligibleStudents ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-600 uppercase">
                    Chưa đăng ký
                  </div>
                  <div className="text-2xl font-bold text-amber-900 mt-1">
                    {regStats?.summary?.unregisteredStudents ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-purple-600 uppercase">
                    Chỗ trống đề tài
                  </div>
                  <div className="text-2xl font-bold text-purple-900 mt-1">
                    {regStats?.summary?.remainingSlots ?? 0} /{' '}
                    {regStats?.summary?.totalCapacity ?? 0}
                  </div>
                </div>
              </div>

              {/* Danh sách SV chưa đăng ký */}
              {regStats?.unregisteredStudents?.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    Danh sách sinh viên đủ điều kiện chưa có đề tài / nhóm (
                    {regStats.unregisteredStudents.length} SV):
                  </div>
                  <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5">MSSV</th>
                          <th className="p-2.5">Họ và tên</th>
                          <th className="p-2.5">Lớp</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Tín chỉ</th>
                          <th className="p-2.5">GPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {regStats.unregisteredStudents.map((st: any) => (
                          <tr key={st.id}>
                            <td className="p-2.5 font-mono font-bold text-slate-800">
                              {st.studentCode}
                            </td>
                            <td className="p-2.5 font-medium">{st.fullName}</td>
                            <td className="p-2.5 text-slate-600">{st.className || '—'}</td>
                            <td className="p-2.5 text-slate-500">{st.email}</td>
                            <td className="p-2.5 font-semibold">{st.creditsEarned}</td>
                            <td className="p-2.5 font-semibold">{st.gpa ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Báo cáo Kết quả Đánh giá Giữa kỳ */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Báo cáo Kết quả Đánh giá Giữa kỳ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi kết quả xác nhận của GVHD: Cho tiếp tục (CONTINUE), Dừng (STOPPED), Chờ
                  đánh giá (PENDING)
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'CONTINUE', label: 'Tiếp tục' },
                  { id: 'STOPPED', label: 'Dừng' },
                  { id: 'PENDING', label: 'Chờ đánh giá' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setMidtermFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      midtermFilter === f.id
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Tỉ lệ đánh giá
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {midtermStats?.summary?.evaluationRate ?? 0}%
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-600 uppercase">
                    Cho tiếp tục
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    {midtermStats?.summary?.continueCount ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-rose-600 uppercase">Dừng KLTN</div>
                  <div className="text-2xl font-bold text-rose-700 mt-1">
                    {midtermStats?.summary?.stoppedCount ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-600 uppercase">
                    Chờ đánh giá
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">
                    {midtermStats?.summary?.pendingCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Table of groups by midterm result */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Mã nhóm</th>
                      <th className="p-3">Tên nhóm</th>
                      <th className="p-3">Đề tài & GVHD</th>
                      <th className="p-3">Kết quả</th>
                      <th className="p-3">Nhận xét của GVHD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const allMid = [
                        ...(midtermStats?.groupsByResult?.CONTINUE ?? []),
                        ...(midtermStats?.groupsByResult?.STOPPED ?? []),
                        ...(midtermStats?.groupsByResult?.PENDING ?? []),
                      ];
                      const listToDisplay =
                        midtermFilter === 'ALL'
                          ? allMid
                          : midtermStats?.groupsByResult?.[midtermFilter] ?? [];

                      if (listToDisplay.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">
                              Không có nhóm nào trong danh mục này.
                            </td>
                          </tr>
                        );
                      }

                      return listToDisplay.map((g: any) => (
                        <tr key={g.id}>
                          <td className="p-3 font-mono font-bold text-slate-800">{g.code}</td>
                          <td className="p-3 font-semibold">{g.name}</td>
                          <td className="p-3">
                            <div className="font-medium text-slate-900 truncate max-w-xs">
                              {g.topic?.title ?? '—'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              GV: {g.topic?.advisor ?? '—'}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                g.midtermStatus === 'CONTINUE'
                                  ? 'success'
                                  : g.midtermStatus === 'STOPPED'
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {g.midtermStatus === 'CONTINUE'
                                ? 'Tiếp tục'
                                : g.midtermStatus === 'STOPPED'
                                ? 'Dừng KLTN'
                                : 'Chờ đánh giá'}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-600 max-w-sm">
                            {g.midtermNote ? (
                              <span>{g.midtermNote}</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có nhận xét</span>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Xuất dữ liệu & Báo cáo Bộ môn */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Kết xuất Dữ liệu & Báo cáo Quản lý
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xuất các báo cáo chuẩn hóa định dạng Excel (.xlsx) và Phiếu điểm tổng hợp KLTN (.pdf) chính thức
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Button variant="outline" size="sm" onClick={() => handleExportExcel('scores')} className="justify-start text-purple-700 border-purple-200 hover:bg-purple-50">
                  <Award className="w-4 h-4 mr-2 text-purple-600" /> Bảng điểm tổng kết (.xlsx)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportScoreSheetPdf()} className="justify-start text-rose-700 border-rose-200 hover:bg-rose-50">
                  <Download className="w-4 h-4 mr-2 text-rose-600" /> Phiếu điểm chính thức (.pdf)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportExcel('workload')} className="justify-start text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                  <Users className="w-4 h-4 mr-2 text-indigo-600" /> Tải & Hạn mức GV (.xlsx)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportExcel('registrations')} className="justify-start text-blue-700 border-blue-200 hover:bg-blue-50">
                  <Download className="w-4 h-4 mr-2 text-blue-600" /> Danh sách Đăng ký (.xlsx)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportExcel('topics')} className="justify-start text-teal-700 border-teal-200 hover:bg-teal-50">
                  <Download className="w-4 h-4 mr-2 text-teal-600" /> Danh mục Đề tài (.xlsx)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportExcel('defense-schedules')} className="justify-start text-amber-700 border-amber-200 hover:bg-amber-50">
                  <Calendar className="w-4 h-4 mr-2 text-amber-600" /> Lịch Bảo vệ (.xlsx)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

        </div>
      </div>

      {/* MODAL: Create Semester */}
      <Modal isOpen={showSemesterModal} onClose={() => setShowSemesterModal(false)} title="Tạo Đợt KLTN / Học kỳ mới">
        <form onSubmit={handleCreateSemester} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Mã đợt KLTN" placeholder="VD: 2026-KLTN-2" value={semCode} onChange={(e) => setSemCode(e.target.value)} required />
            <Input label="Năm học" placeholder="VD: 2026-2027" value={semYear} onChange={(e) => setSemYear(e.target.value)} required />
          </div>
          <Input label="Tên đợt KLTN" placeholder="VD: Đợt KLTN học kỳ 2 năm học 2026-2027" value={semName} onChange={(e) => setSemName(e.target.value)} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input type="datetime-local" label="Mở đăng ký từ" value={semRegFrom} onChange={(e) => setSemRegFrom(e.target.value)} />
            <Input type="datetime-local" label="Hết hạn đăng ký" value={semRegTo} onChange={(e) => setSemRegTo(e.target.value)} />
          </div>
          <Input type="datetime-local" label="Hạn nộp báo cáo hoàn thiện" value={semSubTo} onChange={(e) => setSemSubTo(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input type="datetime-local" label="Thời gian bảo vệ từ" value={semDefFrom} onChange={(e) => setSemDefFrom(e.target.value)} />
            <Input type="datetime-local" label="Thời gian bảo vệ đến" value={semDefTo} onChange={(e) => setSemDefTo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowSemesterModal(false)}>Hủy</Button>
            <Button type="submit" variant="primary">Lưu đợt KLTN</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Config */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Cập nhật tham số hệ thống">
        <form onSubmit={handleSaveConfig} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Mã tham số (Key)</label>
            <select
              value={configKey}
              onChange={(e) => setConfigKey(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none"
            >
              <option value="MAX_GROUP_SIZE">MAX_GROUP_SIZE (Số SV tối đa mỗi nhóm)</option>
              <option value="MIN_CREDITS_REQUIRED">MIN_CREDITS_REQUIRED (Số tín chỉ tối thiểu)</option>
              <option value="MAX_TOPICS_PER_LECTURER">MAX_TOPICS_PER_LECTURER (Số đề tài tối đa/GV)</option>
            </select>
          </div>
          <Input label="Giá trị cấu hình" value={configValue} onChange={(e) => setConfigValue(e.target.value)} required />
          <Input label="Mô tả cấu hình" placeholder="Mô tả ý nghĩa của tham số..." value={configDesc} onChange={(e) => setConfigDesc(e.target.value)} />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowConfigModal(false)}>Hủy</Button>
            <Button type="submit" variant="primary">Lưu cấu hình</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Score Details */}
      <Modal
        isOpen={!!selectedScoreDetails}
        onClose={() => setSelectedScoreDetails(null)}
        title={`Chi tiết Bảng điểm: ${selectedScoreDetails?.code || ''}`}
      >
        {selectedScoreDetails && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="text-sm font-bold text-slate-900">
                {selectedScoreDetails.topic?.title || selectedScoreDetails.name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200">
                <div>
                  <span className="font-semibold text-slate-700">GVHD:</span>{' '}
                  {selectedScoreDetails.topic?.owner?.fullName || 'Chưa cập nhật'}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">GVPB:</span>{' '}
                  {selectedScoreDetails.reviewer?.fullName || 'Chưa phân công'}
                </div>
              </div>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Công thức & Trọng số tính điểm
              </div>
              <p className="text-xs text-amber-950 font-mono">
                {selectedScoreDetails.congThucTinh || 'Chưa có công thức'}
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-amber-900">
                <span>Điểm tổng kết: <b className="text-sm">{selectedScoreDetails.finalScore ?? '—'} / 10</b></span>
                <span>• Xếp loại: <b>{selectedScoreDetails.xepLoai || '—'}</b></span>
                <span>• Kết quả: <b>{selectedScoreDetails.ketQua || '—'}</b></span>
              </div>
            </div>

            {selectedScoreDetails.scoreBreakdown?.council?.evaluations?.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Điểm từng Thành viên Hội đồng bảo vệ
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Thành viên</th>
                        <th className="p-2">Vai trò</th>
                        <th className="p-2 text-center">Tiêu chí</th>
                        <th className="p-2 text-center">Trạng thái</th>
                        <th className="p-2 text-right">Điểm số</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedScoreDetails.scoreBreakdown.council.evaluations.map((ev: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium text-slate-800">{ev.lecturerName}</td>
                          <td className="p-2"><Badge variant="neutral" size="sm">{ev.role}</Badge></td>
                          <td className="p-2 text-center">{ev.count}/10</td>
                          <td className="p-2 text-center">
                            {ev.isDraft ? <Badge variant="warning" size="sm">Bản nháp</Badge> : <Badge variant="success" size="sm">Đã khóa</Badge>}
                          </td>
                          <td className="p-2 text-right font-bold text-indigo-900">{ev.totalScore ?? '—'} / 10</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedScoreDetails.scoreCompleteness?.warnings?.length > 0 && (
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 space-y-1">
                <div className="text-[11px] font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Cảnh báo điểm chưa hoàn tất ({selectedScoreDetails.scoreCompleteness.warnings.length})
                </div>
                <ul className="space-y-1 text-xs text-rose-900 pt-1">
                  {selectedScoreDetails.scoreCompleteness.warnings.map((w: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setSelectedScoreDetails(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

