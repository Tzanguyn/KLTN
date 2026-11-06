import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { WorkspaceSidebar, NavItem } from './WorkspaceSidebar';
import { WelcomeTimeline } from '../dashboard/WelcomeTimeline';
import {
  LayoutDashboard,
  Users,
  Power,
  Calendar,
  ShieldCheck,
  Search,
  Filter,
  PlusCircle,
  FileSpreadsheet,
  RotateCw,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Server,
  UserCheck,
  UserX,
  GraduationCap,
  Building2,
  Award,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react';

export const AdminWorkspace: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Stats state
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Users Management state
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // System Status state
  const [systemStatus, setSystemStatus] = useState<any>({
    status: 'OPEN',
    message: '',
    maintenanceUntil: '',
    allowAdminOnly: true,
  });
  const [savingStatus, setSavingStatus] = useState(false);

  // Module switches state
  const [modules, setModules] = useState<any>({
    registrationOpen: true,
    registrationNote: '',
    proposalOpen: true,
    proposalNote: '',
    submissionOpen: true,
    submissionNote: '',
    scoringOpen: true,
    scoringNote: '',
    scoreAppealOpen: true,
    scoreAppealNote: '',
  });
  const [savingModules, setSavingModules] = useState(false);

  // Semesters state
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Transfer Leadership state
  const [transferTargetRole, setTransferTargetRole] = useState<'TRUONG_BO_MON' | 'QUAN_LY_BO_MON'>('TRUONG_BO_MON');
  const [transferSuccessorId, setTransferSuccessorId] = useState('');
  const [lecturersList, setLecturersList] = useState<any[]>([]);
  const [savingTransfer, setSavingTransfer] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form states for Single Create
  const [createForm, setCreateForm] = useState<any>({
    email: '',
    fullName: '',
    password: 'Password@123',
    phone: '',
    role: 'SINH_VIEN',
    status: 'ACTIVE',
    // Student
    studentCode: '',
    className: 'CNTT K2026',
    cohort: 2026,
    creditsEarned: 120,
    gpa: 3.2,
    eligible: true,
    // Lecturer
    lecturerCode: '',
    title: 'ThS.',
    specialization: 'Khoa học máy tính',
    maxGroups: 5,
  });

  // Form states for Edit
  const [editForm, setEditForm] = useState<any>({});

  // Reset password form
  const [newPassword, setNewPassword] = useState('Password@123');

  // Lock reason
  const [lockReason, setLockReason] = useState('');

  // Batch create text / items
  const [batchJson, setBatchJson] = useState('');
  const [batchResults, setBatchResults] = useState<any>(null);

  const notify = (text: any, type: 'success' | 'error' = 'success') => {
    const message = Array.isArray(text)
      ? text.join(', ')
      : typeof text === 'string'
      ? text
      : JSON.stringify(text || '');
    setFeedbackMsg({ text: message, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Fetch Dashboard Stats
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data?.data ?? res.data);
      if (res.data?.data?.system?.status) {
        setSystemStatus(res.data.data.system.status);
      }
      if (res.data?.data?.system?.modules) {
        setModules(res.data.data.system.modules);
      }
    } catch {
      notify('Không thể tải dữ liệu thống kê quản trị', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Users
  const fetchUsers = async (targetPage = page) => {
    setLoadingUsers(true);
    try {
      const params: any = { page: targetPage, limit: 15 };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/admin/users', { params });
      const data = res.data?.data ?? res.data;
      setUsers(data.items ?? []);
      setPage(data.meta?.page ?? targetPage);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotalCount(data.meta?.total ?? 0);
    } catch {
      notify('Không thể tải danh sách người dùng', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Semesters
  const fetchSemesters = async () => {
    setLoadingSemesters(true);
    try {
      const res = await api.get('/semesters');
      const items = res.data?.data?.items ?? res.data?.data ?? res.data;
      setSemesters(Array.isArray(items) ? items : []);
    } catch {
      // ignore
    } finally {
      setLoadingSemesters(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.get('/audit', { params: { limit: 25 } });
      const items = res.data?.data?.items ?? res.data?.data ?? res.data;
      setAuditLogs(Array.isArray(items) ? items : []);
    } catch {
      // ignore
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchLecturers = async () => {
    try {
      const res = await api.get('/users/lecturers');
      const items = res.data?.data ?? res.data;
      setLecturersList(Array.isArray(items) ? items : []);
    } catch {}
  };

  const openTransferModal = (role: 'TRUONG_BO_MON' | 'QUAN_LY_BO_MON') => {
    setTransferTargetRole(role);
    setTransferSuccessorId('');
    fetchLecturers();
    setShowTransferModal(true);
  };

  const handleTransferLeadership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSuccessorId) {
      notify('Vui lòng chọn nhân sự được bổ nhiệm kế nhiệm', 'error');
      return;
    }
    setSavingTransfer(true);
    try {
      const res = await api.post('/admin/transfer-leadership', {
        role: transferTargetRole,
        successorUserId: transferSuccessorId,
      });
      const data = res.data?.data ?? res.data;
      notify(data.message || 'Bổ nhiệm chuyển giao chức vụ thành công!');
      setShowTransferModal(false);
      setTransferSuccessorId('');
      fetchStats();
      fetchUsers(page);
      fetchLecturers();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Lỗi khi chuyển giao chức vụ';
      notify(msg, 'error');
    } finally {
      setSavingTransfer(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUsers(1);
    fetchSemesters();
    fetchLecturers();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(page);
    } else if (activeTab === 'semesters') {
      fetchSemesters();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Handle Save Global System Status
  const handleSaveSystemStatus = async () => {
    setSavingStatus(true);
    try {
      const { updatedAt, ...payload } = systemStatus || {};
      const res = await api.put('/admin/system-status', payload);
      const data = res.data?.data ?? res.data;
      setSystemStatus(data);
      notify('Đã cập nhật trạng thái hoạt động toàn hệ thống!');
      fetchStats();
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi cập nhật trạng thái hệ thống', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  // Handle Save Module Switches
  const handleSaveModules = async () => {
    setSavingModules(true);
    try {
      const { updatedAt, ...payload } = modules || {};
      const res = await api.put('/admin/modules-status', payload);
      const data = res.data?.data ?? res.data;
      setModules(data);
      notify('Đã cập nhật cấu hình đóng/mở các cổng chức năng KLTN!');
      fetchStats();
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi cập nhật cổng chức năng', 'error');
    } finally {
      setSavingModules(false);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', createForm);
      notify(`Đã tạo tài khoản '${createForm.email}' thành công!`);
      setShowCreateModal(false);
      fetchUsers(1);
      fetchStats();
      // Reset form
      setCreateForm({
        email: '',
        fullName: '',
        password: 'Password@123',
        phone: '',
        role: 'SINH_VIEN',
        status: 'ACTIVE',
        studentCode: '',
        className: 'CNTT K2026',
        cohort: 2026,
        creditsEarned: 120,
        gpa: 3.2,
        eligible: true,
        lecturerCode: '',
        title: 'ThS.',
        specialization: 'Khoa học máy tính',
        maxGroups: 5,
      });
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi khi tạo tài khoản', 'error');
    }
  };

  // Handle Batch Create
  const handleBatchCreate = async () => {
    try {
      const parsed = JSON.parse(batchJson);
      const usersList = Array.isArray(parsed) ? parsed : parsed.users;
      if (!Array.isArray(usersList) || usersList.length === 0) {
        notify('Dữ liệu JSON phải là mảng danh sách người dùng hợp lệ', 'error');
        return;
      }
      const res = await api.post('/admin/users/batch', { users: usersList });
      const data = res.data?.data ?? res.data;
      setBatchResults(data);
      notify(`Hoàn tất tạo hàng loạt: ${data.successCount} thành công, ${data.failureCount} thất bại!`);
      fetchUsers(1);
      fetchStats();
    } catch (err: any) {
      notify(err.response?.data?.message || 'JSON không hợp lệ hoặc lỗi xử lý', 'error');
    }
  };

  // Open Edit User Modal
  const openEditModal = (u: any) => {
    setSelectedUser(u);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone || '',
      role: u.roles?.[0] || 'SINH_VIEN',
      status: u.status,
      studentCode: u.studentProfile?.studentCode || '',
      className: u.studentProfile?.className || '',
      cohort: u.studentProfile?.cohort || 2026,
      creditsEarned: u.studentProfile?.creditsEarned ?? 0,
      gpa: u.studentProfile?.gpa ?? 0,
      eligible: u.studentProfile?.eligible ?? true,
      lecturerCode: u.lecturerProfile?.lecturerCode || '',
      title: u.lecturerProfile?.title || '',
      specialization: u.lecturerProfile?.specialization || '',
      maxGroups: u.lecturerProfile?.maxGroups ?? 5,
    });
    setShowEditModal(true);
  };

  // Handle Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.patch(`/admin/users/${selectedUser.id}`, editForm);
      notify(`Đã cập nhật thông tin tài khoản ${selectedUser.email}!`);
      setShowEditModal(false);
      fetchUsers(page);
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi cập nhật tài khoản', 'error');
    }
  };

  // Handle Quick Toggle Status
  const handleToggleStatus = async (u: any) => {
    const newStatus = u.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
    try {
      await api.patch(`/admin/users/${u.id}/status`, {
        status: newStatus,
        reason: newStatus === 'LOCKED' ? 'Khóa bởi Quản trị viên' : 'Mở khóa bởi Quản trị viên',
      });
      notify(
        newStatus === 'LOCKED'
          ? `Đã khóa tài khoản '${u.email}' thành công!`
          : `Đã mở khóa tài khoản '${u.email}' thành công!`,
      );
      fetchUsers(page);
      fetchStats();
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi thay đổi trạng thái tài khoản', 'error');
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await api.post(`/admin/users/${selectedUser.id}/reset-password`, {
        newPassword,
      });
      notify(`Mật khẩu của tài khoản '${selectedUser.email}' đã được đổi thành công!`);
      setShowResetPasswordModal(false);
      setNewPassword('Password@123');
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi đặt lại mật khẩu', 'error');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await api.delete(`/admin/users/${selectedUser.id}`);
      notify(`Đã xóa tài khoản '${selectedUser.email}' thành công!`);
      setShowDeleteModal(false);
      fetchUsers(page);
      fetchStats();
    } catch (err: any) {
      notify(err.response?.data?.message || 'Lỗi xóa tài khoản', 'error');
    }
  };

  // Nav Items for WorkspaceSidebar
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Tổng quan hệ thống', icon: LayoutDashboard },
    { id: 'users', label: 'Quản lý tài khoản', icon: Users, count: totalCount || stats?.users?.total },
    { id: 'system_control', label: 'Đóng/Mở hệ thống', icon: Power },
    { id: 'semesters', label: 'Đợt KLTN & Thời hạn', icon: Calendar, count: stats?.semesters?.total },
    { id: 'audit', label: 'Nhật ký kiểm toán', icon: ShieldCheck },
  ];

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Workspace Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar */}
        <WorkspaceSidebar
          title="Quản trị hệ thống"
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          themeColor="rose"
          infoCard={
            <div className="p-3 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm text-xs space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Quyền Quản Trị Cao Cấp</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Tài khoản Admin có toàn quyền cấp tài khoản, khóa truy cập và kiểm soát các cổng chức năng toàn hệ thống.
              </p>
              <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                <span>Hệ thống:</span>
                <span className="font-bold text-white uppercase">{systemStatus.status}</span>
              </div>
            </div>
          }
        />

        {/* Main Content Area */}
        <div className="flex-1 w-full min-w-0 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* System Status Banner */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  systemStatus.status === 'MAINTENANCE'
                    ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                    : systemStatus.status === 'READ_ONLY'
                    ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                    : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 ${
                      systemStatus.status === 'MAINTENANCE'
                        ? 'bg-rose-600'
                        : systemStatus.status === 'READ_ONLY'
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base">
                        Trạng thái toàn hệ thống: {systemStatus.status}
                      </h3>
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            systemStatus.status === 'MAINTENANCE'
                              ? 'bg-rose-400'
                              : systemStatus.status === 'READ_ONLY'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            systemStatus.status === 'MAINTENANCE'
                              ? 'bg-rose-600'
                              : systemStatus.status === 'READ_ONLY'
                              ? 'bg-amber-600'
                              : 'bg-emerald-600'
                          }`}
                        />
                      </span>
                    </div>
                    <p className="text-xs opacity-90 mt-1">
                      {systemStatus.message ||
                        (systemStatus.status === 'OPEN'
                          ? 'Cổng KLTN đang mở và hoạt động bình thường cho mọi đối tượng.'
                          : 'Hệ thống đang được giới hạn truy cập.')}
                    </p>
                    {systemStatus.maintenanceUntil && (
                      <p className="text-[11px] font-semibold mt-1 flex items-center gap-1 opacity-80">
                        <Clock className="w-3 h-3" /> Dự kiến hoàn tất:{' '}
                        {new Date(systemStatus.maintenanceUntil).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('system_control')}
                  className="shrink-0 bg-white hover:bg-slate-50 border shadow-xs"
                >
                  <Power className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Đổi trạng thái hệ thống
                </Button>
              </div>

              {/* LỘ TRÌNH KLTN ĐỒNG BỘ TOÀN HỆ THỐNG */}
              {semesters.length > 0 && (
                <WelcomeTimeline
                  semesterInfo={semesters.find((s) => s.status === 'OPEN') || semesters[0]}
                  role="ADMIN"
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Tổng người dùng</span>
                    <Users className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{stats?.users?.total ?? 0}</div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span className="text-emerald-600 font-bold">{stats?.users?.active ?? 0} hoạt động</span>
                    <span>·</span>
                    <span className="text-rose-600 font-bold">{stats?.users?.locked ?? 0} bị khóa</span>
                  </div>
                </Card>

                <Card className="p-4 border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Sinh viên</span>
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{stats?.users?.byRole?.SINH_VIEN ?? 0}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Đủ điều kiện & đang học vụ</div>
                </Card>

                <Card className="p-4 border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Cán bộ & Giảng viên</span>
                    <Building2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {(stats?.users?.byRole?.GIANG_VIEN ?? 0) +
                      (stats?.users?.byRole?.TRUONG_BO_MON ?? 0) +
                      (stats?.users?.byRole?.QUAN_LY_BO_MON ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {stats?.users?.byRole?.TRUONG_BO_MON ?? 0} Trưởng BM · {stats?.users?.byRole?.QUAN_LY_BO_MON ?? 0} Quản lý
                  </div>
                </Card>

                <Card className="p-4 border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Đợt KLTN & Đề tài</span>
                    <Calendar className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{stats?.semesters?.total ?? 0} đợt</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {stats?.topics?.total ?? 0} đề tài trong hệ thống
                  </div>
                </Card>
              </div>

              {/* Leadership Personnel Section (1 Trưởng BM, 1 Quản lý BM) */}
              <Card className="border-slate-200/80 shadow-xs overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <h3 className="text-sm font-bold text-slate-800">
                        Cơ cấu Lãnh đạo Bộ môn (Quy định: Duy nhất 1 Trưởng bộ môn & 1 Quản lý bộ môn)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hệ thống tự động kiểm soát và ngăn chặn việc bổ nhiệm thừa chức vụ
                    </p>
                  </div>
                  <Badge variant="purple" size="sm">
                    Quy chuẩn 1-1
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Trưởng bộ môn */}
                    <div className="p-4 rounded-2xl border-2 border-purple-100 bg-purple-50/20 hover:border-purple-200 transition-all space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                              Vị trí: Trưởng bộ môn (Duy nhất 1)
                            </span>
                            <div className="text-sm font-bold text-slate-900">
                              {stats?.leadership?.head?.fullName || 'Chưa có Trưởng bộ môn'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {stats?.leadership?.head?.email || 'Chưa thiết lập'}
                            </div>
                          </div>
                        </div>
                        <Badge variant="purple" size="sm">TRƯỞNG BM</Badge>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-purple-100/80 flex items-center justify-between">
                        <span>Mã GV: <strong>{stats?.leadership?.head?.lecturerCode || 'TBM001'}</strong></span>
                        <span>Học vị: <strong>{stats?.leadership?.head?.title || 'PGS. TS.'}</strong></span>
                        <span>SĐT: <strong>{stats?.leadership?.head?.phone || 'Chưa cập nhật'}</strong></span>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openTransferModal('TRUONG_BO_MON')}
                        className="w-full text-purple-700 hover:bg-purple-100/70 border-purple-200 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                        Chuyển giao vị trí Trưởng bộ môn
                      </Button>
                    </div>

                    {/* Quản lý bộ môn */}
                    <div className="p-4 rounded-2xl border-2 border-amber-100 bg-amber-50/20 hover:border-amber-200 transition-all space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                              Vị trí: Quản lý bộ môn (Duy nhất 1)
                            </span>
                            <div className="text-sm font-bold text-slate-900">
                              {stats?.leadership?.manager?.fullName || 'Chưa có Quản lý bộ môn'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {stats?.leadership?.manager?.email || 'Chưa thiết lập'}
                            </div>
                          </div>
                        </div>
                        <Badge variant="warning" size="sm">QUẢN LÝ BM</Badge>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-amber-100/80 flex items-center justify-between">
                        <span>Mã GV: <strong>{stats?.leadership?.manager?.lecturerCode || 'QL001'}</strong></span>
                        <span>Học vị: <strong>{stats?.leadership?.manager?.title || 'ThS.'}</strong></span>
                        <span>SĐT: <strong>{stats?.leadership?.manager?.phone || 'Chưa cập nhật'}</strong></span>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openTransferModal('QUAN_LY_BO_MON')}
                        className="w-full text-amber-800 hover:bg-amber-100/70 border-amber-200 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                        Chuyển giao vị trí Quản lý bộ môn
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Module Switches Overview */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between py-3.5 px-4 sm:px-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Trạng thái các Cổng Nghiệp vụ KLTN</h3>
                    <p className="text-xs text-slate-400">Kiểm soát đóng/mở quyền tương tác của sinh viên và giảng viên</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('system_control')}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                  >
                    Cấu hình chi tiết &rarr;
                  </Button>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Cổng đăng ký đề tài</div>
                        <div className="text-[11px] text-slate-500 truncate">{modules.registrationNote || 'Đăng ký nguyện vọng KLTN'}</div>
                      </div>
                      <Badge variant={modules.registrationOpen ? 'success' : 'danger'}>
                        {modules.registrationOpen ? 'Đang Mở' : 'Đã Đóng'}
                      </Badge>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Cổng đề xuất đề tài</div>
                        <div className="text-[11px] text-slate-500 truncate">{modules.proposalNote || 'Đề xuất mới từ SV & GV'}</div>
                      </div>
                      <Badge variant={modules.proposalOpen ? 'success' : 'danger'}>
                        {modules.proposalOpen ? 'Đang Mở' : 'Đã Đóng'}
                      </Badge>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Cổng nộp báo cáo tiến độ</div>
                        <div className="text-[11px] text-slate-500 truncate">{modules.submissionNote || 'Nộp báo cáo tuần/khóa luận'}</div>
                      </div>
                      <Badge variant={modules.submissionOpen ? 'success' : 'danger'}>
                        {modules.submissionOpen ? 'Đang Mở' : 'Đã Đóng'}
                      </Badge>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Cổng chấm điểm & phản biện</div>
                        <div className="text-[11px] text-slate-500 truncate">{modules.scoringNote || 'Hội đồng & GV nhập điểm'}</div>
                      </div>
                      <Badge variant={modules.scoringOpen ? 'success' : 'danger'}>
                        {modules.scoringOpen ? 'Đang Mở' : 'Đã Đóng'}
                      </Badge>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Cổng phúc khảo & sửa điểm</div>
                        <div className="text-[11px] text-slate-500 truncate">{modules.scoreAppealNote || 'Yêu cầu mở khóa / phúc khảo'}</div>
                      </div>
                      <Badge variant={modules.scoreAppealOpen ? 'success' : 'danger'}>
                        {modules.scoreAppealOpen ? 'Đang Mở' : 'Đã Đóng'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-5 border-slate-200/80 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Tạo tài khoản người dùng</h4>
                      <p className="text-xs text-slate-500">Cấp tài khoản sinh viên, giảng viên hoặc cán bộ bộ môn</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                      Thêm tài khoản đơn
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowBatchModal(true)}>
                      Thêm hàng loạt (JSON)
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 border-slate-200/80 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <Power className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Bảo trì & Đóng mở hệ thống</h4>
                      <p className="text-xs text-slate-500">Chuyển đổi trạng thái hoạt động hoặc thông báo bảo trì</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab('system_control')}>
                    Mở bảng điều khiển đóng/mở &rarr;
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: USERS MANAGEMENT */}
          {/* ========================================================= */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Personnel Regulation Banner */}
              <div className="p-3.5 bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-amber-50/70 rounded-2xl border border-purple-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-800">
                <div className="flex items-start sm:items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold text-slate-900">Quy chế định biên nhân sự: </span>
                    <span>
                      Hệ thống quy định <strong>duy nhất 1 Trưởng bộ môn</strong> (Hiện tại:{' '}
                      <strong className="text-purple-700">{stats?.leadership?.head?.fullName || 'Chưa bổ nhiệm'}</strong>) và{' '}
                      <strong>duy nhất 1 Quản lý bộ môn</strong> (Hiện tại:{' '}
                      <strong className="text-amber-800">{stats?.leadership?.manager?.fullName || 'Chưa bổ nhiệm'}</strong>).
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openTransferModal('TRUONG_BO_MON')}
                    className="text-purple-700 hover:bg-purple-100 text-[11px] h-7 px-2.5 border-purple-200 cursor-pointer"
                  >
                    Bổ nhiệm Trưởng BM
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openTransferModal('QUAN_LY_BO_MON')}
                    className="text-amber-800 hover:bg-amber-100 text-[11px] h-7 px-2.5 border-amber-200 cursor-pointer"
                  >
                    Bổ nhiệm Quản lý BM
                  </Button>
                </div>
              </div>

              {/* Header & Controls */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Danh sách tài khoản hệ thống</h3>
                      <p className="text-xs text-slate-500">
                        Tổng cộng {totalCount} tài khoản người dùng trong cơ sở dữ liệu
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                        <PlusCircle className="w-4 h-4 mr-1.5" />
                        Tạo tài khoản
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setShowBatchModal(true)}>
                        <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                        Hàng loạt
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => fetchUsers(page)} title="Làm mới">
                        <RotateCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Filters bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                    <div className="sm:col-span-2 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Tìm theo Tên, Email, MSSV, MSGV, SĐT..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <select
                        value={roleFilter}
                        onChange={(e) => {
                          setRoleFilter(e.target.value);
                          setTimeout(() => fetchUsers(1), 0);
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        <option value="">Tất cả vai trò</option>
                        <option value="SINH_VIEN">Sinh viên</option>
                        <option value="GIANG_VIEN">Giảng viên</option>
                        <option value="TRUONG_BO_MON">Trưởng bộ môn</option>
                        <option value="QUAN_LY_BO_MON">Quản lý bộ môn</option>
                        <option value="ADMIN">Quản trị viên (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setTimeout(() => fetchUsers(1), 0);
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                        <option value="LOCKED">Bị khóa (LOCKED)</option>
                        <option value="INACTIVE">Chưa kích hoạt (INACTIVE)</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Người dùng</th>
                        <th className="py-3 px-3">Mã định danh</th>
                        <th className="py-3 px-3">Vai trò</th>
                        <th className="py-3 px-3">Trạng thái</th>
                        <th className="py-3 px-3 hidden md:table-cell">Lần đăng nhập</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {loadingUsers ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Đang tải danh sách người dùng...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Không tìm thấy tài khoản người dùng phù hợp.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => {
                          const primaryRole = u.roles?.[0] || 'SINH_VIEN';
                          const isLocked = u.status === 'LOCKED';
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{u.fullName}</div>
                                <div className="text-[11px] text-slate-400">{u.email}</div>
                                {u.phone && <div className="text-[10px] text-slate-400">{u.phone}</div>}
                              </td>

                              <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                                {u.studentProfile?.studentCode ||
                                  u.lecturerProfile?.lecturerCode ||
                                  (primaryRole === 'ADMIN' ? 'ADMIN' : '—')}
                              </td>

                              <td className="py-3 px-3">
                                {primaryRole === 'ADMIN' && (
                                  <Badge variant="danger" size="sm">Admin</Badge>
                                )}
                                {primaryRole === 'SINH_VIEN' && (
                                  <Badge variant="primary" size="sm">Sinh viên</Badge>
                                )}
                                {primaryRole === 'GIANG_VIEN' && (
                                  <Badge variant="success" size="sm">Giảng viên</Badge>
                                )}
                                {primaryRole === 'TRUONG_BO_MON' && (
                                  <Badge variant="purple" size="sm">Trưởng BM</Badge>
                                )}
                                {primaryRole === 'QUAN_LY_BO_MON' && (
                                  <Badge variant="warning" size="sm">Quản lý BM</Badge>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                {u.status === 'ACTIVE' && (
                                  <Badge variant="success" size="sm">Hoạt động</Badge>
                                )}
                                {u.status === 'LOCKED' && (
                                  <Badge variant="danger" size="sm">Đã khóa</Badge>
                                )}
                                {u.status === 'INACTIVE' && (
                                  <Badge variant="neutral" size="sm">Chưa kích hoạt</Badge>
                                )}
                              </td>

                              <td className="py-3 px-3 hidden md:table-cell text-[11px] text-slate-500">
                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {/* Sửa thông tin */}
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(u)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    title="Sửa thông tin"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Khóa / Mở khóa */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(u)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isLocked
                                        ? 'text-emerald-600 hover:bg-emerald-50'
                                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                    }`}
                                    title={isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                                  >
                                    {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* Đổi mật khẩu */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setNewPassword('Password@123');
                                      setShowResetPasswordModal(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                    title="Đặt lại mật khẩu"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Xóa tài khoản */}
                                  {primaryRole !== 'ADMIN' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedUser(u);
                                        setShowDeleteModal(true);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Xóa tài khoản"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <div>
                      Trang {page} / {totalPages} (Tổng {totalCount} tài khoản)
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => fetchUsers(page - 1)}
                      >
                        Trước
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => fetchUsers(page + 1)}
                      >
                        Tiếp theo
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SYSTEM CONTROL & FEATURE GATES */}
          {/* ========================================================= */}
          {activeTab === 'system_control' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Master System Switch Card */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="border-b border-slate-100 py-4 px-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <Power className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Đóng / Mở Toàn Hệ Thống (Master System Switch)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Thiết lập chế độ hoạt động toàn bộ trang web và cổng đăng nhập KLTN
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Chọn trạng thái hoạt động:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* OPEN */}
                      <label
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          systemStatus.status === 'OPEN'
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-emerald-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                            OPEN (Mở hoạt động)
                          </span>
                          <input
                            type="radio"
                            name="system_status"
                            checked={systemStatus.status === 'OPEN'}
                            onChange={() => setSystemStatus({ ...systemStatus, status: 'OPEN' })}
                            className="text-emerald-600"
                          />
                        </div>
                        <p className="text-xs text-slate-600">
                          Hệ thống hoạt động bình thường cho mọi đối tượng (Sinh viên, Giảng viên, Quản lý).
                        </p>
                      </label>

                      {/* MAINTENANCE */}
                      <label
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          systemStatus.status === 'MAINTENANCE'
                            ? 'border-rose-600 bg-rose-50/50 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-rose-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                            MAINTENANCE (Bảo trì)
                          </span>
                          <input
                            type="radio"
                            name="system_status"
                            checked={systemStatus.status === 'MAINTENANCE'}
                            onChange={() => setSystemStatus({ ...systemStatus, status: 'MAINTENANCE' })}
                            className="text-rose-600"
                          />
                        </div>
                        <p className="text-xs text-slate-600">
                          Tạm đóng hệ thống. Hiển thị thông báo bảo trì. Chỉ Admin có quyền truy cập.
                        </p>
                      </label>

                      {/* READ_ONLY */}
                      <label
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          systemStatus.status === 'READ_ONLY'
                            ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-amber-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                            READ_ONLY (Chỉ xem)
                          </span>
                          <input
                            type="radio"
                            name="system_status"
                            checked={systemStatus.status === 'READ_ONLY'}
                            onChange={() => setSystemStatus({ ...systemStatus, status: 'READ_ONLY' })}
                            className="text-amber-600"
                          />
                        </div>
                        <p className="text-xs text-slate-600">
                          Cho phép tra cứu dữ liệu. Khóa các thao tác nộp bài, đăng ký hoặc chấm điểm mới.
                        </p>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Thông báo hiển thị cho người dùng:
                    </label>
                    <textarea
                      rows={2}
                      value={systemStatus.message || ''}
                      onChange={(e) => setSystemStatus({ ...systemStatus, message: e.target.value })}
                      placeholder="Ví dụ: Hệ thống KLTN đang tạm đóng để bảo trì cơ sở dữ liệu đợt 1..."
                      className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Thời gian dự kiến hoàn thành bảo trì (tùy chọn):
                      </label>
                      <input
                        type="datetime-local"
                        value={systemStatus.maintenanceUntil ? systemStatus.maintenanceUntil.slice(0, 16) : ''}
                        onChange={(e) =>
                          setSystemStatus({
                            ...systemStatus,
                            maintenanceUntil: e.target.value ? new Date(e.target.value).toISOString() : null,
                          })
                        }
                        className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>

                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={systemStatus.allowAdminOnly ?? true}
                          onChange={(e) =>
                            setSystemStatus({ ...systemStatus, allowAdminOnly: e.target.checked })
                          }
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>Chỉ cho phép tài khoản Admin đăng nhập khi bảo trì</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      onClick={handleSaveSystemStatus}
                      isLoading={savingStatus}
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      Lưu trạng thái hệ thống
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Module Switches Card */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="border-b border-slate-100 py-4 px-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Đóng / Mở Các Cổng Nghiệp Vụ KLTN (Feature Gates)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Bật/tắt linh hoạt các cổng đăng ký, nộp bài, chấm điểm độc lập theo từng giai đoạn học kỳ
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* Switch 1: Registration */}
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">1. Cổng đăng ký đề tài KLTN</span>
                        <Badge variant={modules.registrationOpen ? 'success' : 'danger'} size="sm">
                          {modules.registrationOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cho phép sinh viên đăng ký đề tài vào danh sách nguyện vọng hoặc nhóm KLTN
                      </p>
                      <input
                        type="text"
                        value={modules.registrationNote || ''}
                        onChange={(e) => setModules({ ...modules, registrationNote: e.target.value })}
                        placeholder="Ghi chú cổng đăng ký..."
                        className="mt-1 w-full sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModules({ ...modules, registrationOpen: !modules.registrationOpen })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modules.registrationOpen
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {modules.registrationOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{modules.registrationOpen ? 'Đang mở (Bấm để Đóng)' : 'Đã đóng (Bấm để Mở)'}</span>
                    </button>
                  </div>

                  {/* Switch 2: Proposal */}
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">2. Cổng đề xuất đề tài mới</span>
                        <Badge variant={modules.proposalOpen ? 'success' : 'danger'} size="sm">
                          {modules.proposalOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cho phép sinh viên & giảng viên gửi phiếu đề xuất đề tài mới để Trưởng BM duyệt
                      </p>
                      <input
                        type="text"
                        value={modules.proposalNote || ''}
                        onChange={(e) => setModules({ ...modules, proposalNote: e.target.value })}
                        placeholder="Ghi chú cổng đề xuất..."
                        className="mt-1 w-full sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModules({ ...modules, proposalOpen: !modules.proposalOpen })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modules.proposalOpen
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {modules.proposalOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{modules.proposalOpen ? 'Đang mở (Bấm để Đóng)' : 'Đã đóng (Bấm để Mở)'}</span>
                    </button>
                  </div>

                  {/* Switch 3: Submission */}
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">3. Cổng nộp báo cáo tiến độ</span>
                        <Badge variant={modules.submissionOpen ? 'success' : 'danger'} size="sm">
                          {modules.submissionOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cho phép các nhóm KLTN upload báo cáo tuần, báo cáo giữa kỳ và bản thảo khóa luận
                      </p>
                      <input
                        type="text"
                        value={modules.submissionNote || ''}
                        onChange={(e) => setModules({ ...modules, submissionNote: e.target.value })}
                        placeholder="Ghi chú cổng nộp bài..."
                        className="mt-1 w-full sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModules({ ...modules, submissionOpen: !modules.submissionOpen })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modules.submissionOpen
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {modules.submissionOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{modules.submissionOpen ? 'Đang mở (Bấm để Đóng)' : 'Đã đóng (Bấm để Mở)'}</span>
                    </button>
                  </div>

                  {/* Switch 4: Scoring */}
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">4. Cổng chấm điểm & phản biện</span>
                        <Badge variant={modules.scoringOpen ? 'success' : 'danger'} size="sm">
                          {modules.scoringOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cho phép Giảng viên hướng dẫn, GVPB và Hội đồng chấm điểm theo phiếu tiêu chí
                      </p>
                      <input
                        type="text"
                        value={modules.scoringNote || ''}
                        onChange={(e) => setModules({ ...modules, scoringNote: e.target.value })}
                        placeholder="Ghi chú cổng chấm điểm..."
                        className="mt-1 w-full sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModules({ ...modules, scoringOpen: !modules.scoringOpen })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modules.scoringOpen
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {modules.scoringOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{modules.scoringOpen ? 'Đang mở (Bấm để Đóng)' : 'Đã đóng (Bấm để Mở)'}</span>
                    </button>
                  </div>

                  {/* Switch 5: Score Appeal */}
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">5. Cổng phúc khảo & sửa điểm</span>
                        <Badge variant={modules.scoreAppealOpen ? 'success' : 'danger'} size="sm">
                          {modules.scoreAppealOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Cho phép giảng viên gửi yêu cầu mở khóa sửa điểm sau khi đã chốt điểm
                      </p>
                      <input
                        type="text"
                        value={modules.scoreAppealNote || ''}
                        onChange={(e) => setModules({ ...modules, scoreAppealNote: e.target.value })}
                        placeholder="Ghi chú cổng phúc khảo..."
                        className="mt-1 w-full sm:w-80 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModules({ ...modules, scoreAppealOpen: !modules.scoreAppealOpen })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        modules.scoreAppealOpen
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {modules.scoreAppealOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{modules.scoreAppealOpen ? 'Đang mở (Bấm để Đóng)' : 'Đã đóng (Bấm để Mở)'}</span>
                    </button>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      onClick={handleSaveModules}
                      isLoading={savingModules}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Lưu cấu hình các cổng nghiệp vụ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: SEMESTERS */}
          {/* ========================================================= */}
          {activeTab === 'semesters' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* LỘ TRÌNH TỔNG QUAN HỌC KỲ */}
              {semesters.length > 0 && (
                <WelcomeTimeline
                  semesterInfo={semesters.find((s) => s.status === 'OPEN') || semesters[0]}
                  role="ADMIN"
                  canManageTimeline={true}
                  onTimelineStepChange={fetchSemesters}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Quản lý Đợt Khóa Luận Tốt Nghiệp</h3>
                    <p className="text-xs text-slate-500">Danh sách các đợt KLTN và trạng thái mở/đóng đăng ký</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchSemesters}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3">
                    {semesters.map((sem) => (
                      <div
                        key={sem.id}
                        className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{sem.name || sem.tenHocKy}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 font-mono rounded">
                              {sem.code}
                            </span>
                            <Badge
                              variant={
                                sem.status === 'OPEN'
                                  ? 'success'
                                  : sem.status === 'CLOSED'
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {sem.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Năm học: {sem.academicYear || sem.namHoc} · Khoa CNTT
                          </div>
                          {sem.registrationFrom && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Thời gian mở đăng ký:{' '}
                              {new Date(sem.registrationFrom).toLocaleDateString('vi-VN')} -{' '}
                              {sem.registrationTo ? new Date(sem.registrationTo).toLocaleDateString('vi-VN') : 'Không giới hạn'}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {sem.status !== 'OPEN' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await api.patch(`/semesters/${sem.id}`, { status: 'OPEN' });
                                  notify(`Đã mở hoạt động đợt KLTN '${sem.code}'!`);
                                  fetchSemesters();
                                } catch (e: any) {
                                  notify(e.response?.data?.message || 'Lỗi cập nhật', 'error');
                                }
                              }}
                              className="text-emerald-700 hover:bg-emerald-50"
                            >
                              Mở đợt (OPEN)
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await api.patch(`/semesters/${sem.id}`, { status: 'CLOSED' });
                                  notify(`Đã đóng đợt KLTN '${sem.code}'!`);
                                  fetchSemesters();
                                } catch (e: any) {
                                  notify(e.response?.data?.message || 'Lỗi cập nhật', 'error');
                                }
                              }}
                              className="text-rose-700 hover:bg-rose-50"
                            >
                              Đóng đợt (CLOSED)
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: AUDIT LOGS */}
          {/* ========================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Nhật ký hoạt động hệ thống (Audit Logs)</h3>
                    <p className="text-xs text-slate-500">Theo dõi các hành động quản trị, thay đổi cấu hình và đăng nhập</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchAuditLogs}>
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Thời gian</th>
                        <th className="py-3 px-3">Người thực hiện</th>
                        <th className="py-3 px-3">Hành động</th>
                        <th className="py-3 px-3">Đối tượng</th>
                        <th className="py-3 px-4">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {loadingAudit ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Đang tải nhật ký kiểm toán...
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Chưa có nhật ký hoạt động nào.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                              {new Date(log.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-900">
                                {log.user?.fullName || 'Hệ thống'}
                              </span>
                              <div className="text-[10px] text-slate-400">{log.user?.email || 'System'}</div>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                              {log.action}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {log.entity}
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-500">
                              {log.metadata ? JSON.stringify(log.metadata) : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: TẠO TÀI KHOẢN ĐƠN LẺ */}
      {/* ========================================================= */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Tạo tài khoản người dùng mới">
        <form onSubmit={handleCreateUser} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Họ và tên"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              placeholder="Nguyễn Văn A"
              required
            />

            <Input
              label="Email trường cấp"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="nguyenvana@kltn.edu.vn"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Mật khẩu khởi tạo"
              type="text"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Mặc định: Password@123"
              required
            />

            <Input
              label="Số điện thoại"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              placeholder="0987654321"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Vai trò chính (Role)
              </label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="SINH_VIEN">Sinh viên</option>
                <option value="GIANG_VIEN">Giảng viên</option>
                <option value="TRUONG_BO_MON">Trưởng bộ môn</option>
                <option value="QUAN_LY_BO_MON">Quản lý bộ môn</option>
                <option value="ADMIN">Quản trị viên (Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Trạng thái tài khoản
              </label>
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="LOCKED">Bị khóa (LOCKED)</option>
                <option value="INACTIVE">Chưa kích hoạt (INACTIVE)</option>
              </select>
            </div>
          </div>

          {/* Cảnh báo đặc thù khi chọn Trưởng bộ môn hoặc Quản lý bộ môn */}
          {(createForm.role === 'TRUONG_BO_MON' || createForm.role === 'QUAN_LY_BO_MON') && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Quy tắc Lãnh đạo bộ môn (1-1):</span> Toàn bộ môn chỉ được phép có <strong>duy nhất 1 Trưởng bộ môn</strong> và <strong>1 Quản lý bộ môn</strong>. Nếu hệ thống đã có nhân sự giữ vai trò này, thao tác tạo mới sẽ bị từ chối. Hãy sử dụng chức năng <strong>Chuyển giao vị trí</strong> tại tab Tổng quan nếu muốn thay thế nhân sự.
              </div>
            </div>
          )}

          {/* Trường dành riêng cho Sinh viên */}
          {createForm.role === 'SINH_VIEN' && (
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Hồ sơ sinh viên (Student Profile)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  label="Mã số SV (MSSV)"
                  value={createForm.studentCode}
                  onChange={(e) => setCreateForm({ ...createForm, studentCode: e.target.value })}
                  placeholder="SV2026999"
                  required
                />
                <Input
                  label="Lớp sinh hoạt"
                  value={createForm.className}
                  onChange={(e) => setCreateForm({ ...createForm, className: e.target.value })}
                  placeholder="CNTT K2026"
                />
                <Input
                  label="Khóa tuyển sinh"
                  type="number"
                  value={createForm.cohort}
                  onChange={(e) => setCreateForm({ ...createForm, cohort: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  label="Tín chỉ tích lũy"
                  type="number"
                  value={createForm.creditsEarned}
                  onChange={(e) => setCreateForm({ ...createForm, creditsEarned: Number(e.target.value) })}
                />
                <Input
                  label="Điểm TB (GPA)"
                  type="number"
                  step="0.01"
                  value={createForm.gpa}
                  onChange={(e) => setCreateForm({ ...createForm, gpa: Number(e.target.value) })}
                />
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={createForm.eligible}
                      onChange={(e) => setCreateForm({ ...createForm, eligible: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Đủ điều kiện làm KLTN</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Trường dành riêng cho Giảng viên / Trưởng bộ môn */}
          {(createForm.role === 'GIANG_VIEN' ||
            createForm.role === 'TRUONG_BO_MON' ||
            createForm.role === 'QUAN_LY_BO_MON') && (
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Hồ sơ giảng viên (Lecturer Profile)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  label="Mã giảng viên (MSGV)"
                  value={createForm.lecturerCode}
                  onChange={(e) => setCreateForm({ ...createForm, lecturerCode: e.target.value })}
                  placeholder="GV999"
                  required
                />
                <Input
                  label="Học hàm / Học vị"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="TS. / PGS.TS."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  label="Hướng nghiên cứu / Chuyên môn"
                  value={createForm.specialization}
                  onChange={(e) => setCreateForm({ ...createForm, specialization: e.target.value })}
                  placeholder="Trí tuệ nhân tạo, CNPM..."
                />
                <Input
                  label="Định mức nhóm tối đa"
                  type="number"
                  value={createForm.maxGroups}
                  onChange={(e) => setCreateForm({ ...createForm, maxGroups: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" className="bg-rose-600 hover:bg-rose-700 text-white">
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: TẠO HÀNG LOẠT (BATCH CREATE) */}
      {/* ========================================================= */}
      <Modal isOpen={showBatchModal} onClose={() => setShowBatchModal(false)} title="Tạo tài khoản hàng loạt (Batch Import)">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Dán danh sách người dùng dưới dạng mảng JSON. Mỗi phần tử bao gồm: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">email, fullName, role, studentCode/lecturerCode</code>. Mật khẩu mặc định nếu không truyền là <code className="font-mono">Password@123</code>.
          </p>

          <textarea
            rows={8}
            value={batchJson}
            onChange={(e) => setBatchJson(e.target.value)}
            placeholder={`[
  {
    "email": "sv_batch1@kltn.edu.vn",
    "fullName": "Trần Văn An",
    "role": "SINH_VIEN",
    "studentCode": "SV2026801",
    "className": "CNTT K2026",
    "creditsEarned": 125,
    "gpa": 3.4
  },
  {
    "email": "gv_batch1@kltn.edu.vn",
    "fullName": "Lê Hoàng Long",
    "role": "GIANG_VIEN",
    "lecturerCode": "GV801",
    "title": "ThS."
  }
]`}
            className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />

          {batchResults && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">
                Kết quả xử lý: {batchResults.successCount} thành công, {batchResults.failureCount} thất bại
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                {batchResults.results?.map((r: any, idx: number) => (
                  <div key={idx} className="py-1 flex items-center justify-between text-[11px]">
                    <span className="font-mono">{r.email}</span>
                    <Badge variant={r.status === 'SUCCESS' ? 'success' : 'danger'} size="sm">
                      {r.status} {r.message ? `(${r.message})` : ''}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setShowBatchModal(false)}>
              Đóng
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleBatchCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Thực hiện tạo hàng loạt
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: SỬA THÔNG TIN TÀI KHOẢN */}
      {/* ========================================================= */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Cập nhật: ${selectedUser?.email}`}>
        <form onSubmit={handleUpdateUser} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Họ và tên"
              value={editForm.fullName || ''}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              required
            />

            <Input
              label="Số điện thoại"
              value={editForm.phone || ''}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Trạng thái tài khoản
              </label>
              <select
                value={editForm.status || 'ACTIVE'}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="LOCKED">Bị khóa (LOCKED)</option>
                <option value="INACTIVE">Chưa kích hoạt (INACTIVE)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Vai trò
              </label>
              <select
                value={editForm.role || 'SINH_VIEN'}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="SINH_VIEN">Sinh viên</option>
                <option value="GIANG_VIEN">Giảng viên</option>
                <option value="TRUONG_BO_MON">Trưởng bộ môn</option>
                <option value="QUAN_LY_BO_MON">Quản lý bộ môn</option>
                <option value="ADMIN">Quản trị viên (Admin)</option>
              </select>
            </div>
          </div>

          {/* Cảnh báo đặc thù khi chọn Trưởng bộ môn hoặc Quản lý bộ môn */}
          {(editForm.role === 'TRUONG_BO_MON' || editForm.role === 'QUAN_LY_BO_MON') && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Quy tắc Lãnh đạo bộ môn (1-1):</span> Hệ thống chỉ cho phép duy nhất 1 Trưởng bộ môn và 1 Quản lý bộ môn. Nếu vai trò này đã có nhân sự khác đảm nhiệm, hệ thống sẽ chặn thao tác lưu. Để bàn giao trọng trách, vui lòng dùng chức năng <strong>Chuyển giao vị trí</strong> tại tab Tổng quan.
              </div>
            </div>
          )}

          {/* Student Profile Edits */}
          {(selectedUser?.studentProfile || editForm.role === 'SINH_VIEN') && (
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Hồ sơ sinh viên
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  label="Mã sinh viên"
                  value={editForm.studentCode || ''}
                  onChange={(e) => setEditForm({ ...editForm, studentCode: e.target.value })}
                />
                <Input
                  label="Lớp"
                  value={editForm.className || ''}
                  onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  label="Tín chỉ tích lũy"
                  type="number"
                  value={editForm.creditsEarned ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, creditsEarned: Number(e.target.value) })}
                />
                <Input
                  label="Điểm TB"
                  type="number"
                  step="0.01"
                  value={editForm.gpa ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, gpa: Number(e.target.value) })}
                />
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editForm.eligible ?? true}
                      onChange={(e) => setEditForm({ ...editForm, eligible: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Đủ điều kiện KLTN</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Lecturer Profile Edits */}
          {(selectedUser?.lecturerProfile || ['GIANG_VIEN', 'TRUONG_BO_MON', 'QUAN_LY_BO_MON'].includes(editForm.role)) && (
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Hồ sơ giảng viên
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  label="Mã giảng viên"
                  value={editForm.lecturerCode || ''}
                  onChange={(e) => setEditForm({ ...editForm, lecturerCode: e.target.value })}
                />
                <Input
                  label="Học vị"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  label="Chuyên môn"
                  value={editForm.specialization || ''}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                />
                <Input
                  label="Số nhóm tối đa"
                  type="number"
                  value={editForm.maxGroups ?? 5}
                  onChange={(e) => setEditForm({ ...editForm, maxGroups: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: ĐẶT LẠI MẬT KHẨU */}
      {/* ========================================================= */}
      <Modal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        title={`Đặt lại mật khẩu: ${selectedUser?.email}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Thiết lập mật khẩu mới cho người dùng. Thao tác này sẽ đồng thời thu hồi mọi phiên đăng nhập trước đó của tài khoản.
          </p>

          <Input
            label="Mật khẩu mới (tối thiểu 8 ký tự)"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password@123"
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setShowResetPasswordModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" className="bg-amber-600 hover:bg-amber-700 text-white">
              Xác nhận đổi mật khẩu
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: XÓA TÀI KHOẢN */}
      {/* ========================================================= */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Xác nhận xóa tài khoản người dùng"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-0.5">Cảnh báo thao tác xóa</div>
              <div>
                Bạn có chắc chắn muốn xóa tài khoản <strong>{selectedUser?.fullName}</strong> ({selectedUser?.email}) khỏi hệ thống? Thao tác này không thể hoàn tác.
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Lưu ý: Nếu tài khoản đã phát sinh dữ liệu đề tài, báo cáo hoặc điểm số, hệ thống sẽ ngăn chặn việc xóa để đảm bảo toàn vẹn dữ liệu học vụ. Trong trường hợp đó, hãy chọn <strong>Khóa tài khoản</strong>.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteUser}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Xác nhận xóa vĩnh viễn
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: CHUYỂN GIAO CHỨC VỤ LÃNH ĐẠO (1 TRƯỞNG BM / 1 QUẢN LÝ BM) */}
      {/* ========================================================= */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title={`Chuyển giao vị trí: ${
          transferTargetRole === 'TRUONG_BO_MON' ? 'Trưởng bộ môn' : 'Quản lý bộ môn'
        }`}
      >
        <form onSubmit={handleTransferLeadership} className="space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-2.5 text-xs text-purple-900">
            <Building2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-0.5">Quy tắc độc quyền lãnh đạo (1-1)</div>
              <div>
                Hệ thống chỉ duy trì duy nhất <strong>1 Trưởng bộ môn</strong> và <strong>1 Quản lý bộ môn</strong>.
                Khi bổ nhiệm nhân sự mới, nhân sự đương nhiệm hiện tại sẽ được tự động chuyển về vai trò <strong>Giảng viên (GIANG_VIEN)</strong> để đảm bảo không bị trùng lặp.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Vị trí bổ nhiệm chuyển giao
            </label>
            <select
              value={transferTargetRole}
              onChange={(e) => setTransferTargetRole(e.target.value as any)}
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="TRUONG_BO_MON">Trưởng bộ môn (TRUONG_BO_MON)</option>
              <option value="QUAN_LY_BO_MON">Quản lý bộ môn (QUAN_LY_BO_MON)</option>
            </select>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="text-[11px] text-slate-500 font-bold uppercase mb-1">Đương nhiệm hiện tại:</div>
            {transferTargetRole === 'TRUONG_BO_MON' ? (
              <div className="font-semibold text-slate-800">
                {stats?.leadership?.head?.fullName || 'Chưa thiết lập'} ({stats?.leadership?.head?.email || 'N/A'})
              </div>
            ) : (
              <div className="font-semibold text-slate-800">
                {stats?.leadership?.manager?.fullName || 'Chưa thiết lập'} ({stats?.leadership?.manager?.email || 'N/A'})
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Chọn Giảng viên kế nhiệm <span className="text-rose-500">*</span>
            </label>
            <select
              value={transferSuccessorId}
              onChange={(e) => setTransferSuccessorId(e.target.value)}
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              required
            >
              <option value="">-- Chọn giảng viên tiếp quản vị trí --</option>
              {lecturersList.length === 0 && (
                <option value="" disabled>
                  Đang tải danh sách giảng viên...
                </option>
              )}
              {lecturersList.map((gv: any) => {
                const uId = gv.user?.id || gv.userId || gv.id;
                const name = gv.user?.fullName || gv.fullName || 'Giảng viên';
                const email = gv.user?.email || gv.email || '';
                const code = gv.lecturerCode || gv.lecturerProfile?.lecturerCode || '';
                const title = gv.title || gv.lecturerProfile?.title || 'GV';
                const isCurrent =
                  (transferTargetRole === 'TRUONG_BO_MON' && uId === stats?.leadership?.head?.id) ||
                  (transferTargetRole === 'QUAN_LY_BO_MON' && uId === stats?.leadership?.manager?.id);
                return (
                  <option key={uId} value={uId} disabled={isCurrent}>
                    {title} {name} ({email}){code ? ` · Mã: ${code}` : ''}{isCurrent ? ' — [Đang giữ vị trí này]' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Chỉ áp dụng cho các nhân sự là cán bộ / giảng viên trong hệ thống.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setShowTransferModal(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingTransfer || !transferSuccessorId}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {savingTransfer ? 'Đang thực hiện...' : 'Xác nhận bàn giao & bổ nhiệm'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};


