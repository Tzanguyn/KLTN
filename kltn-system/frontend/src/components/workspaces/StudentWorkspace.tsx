import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { fixMojibake, formatLecturerName, formatGroupName } from '../../utils/format';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import {
  UserCheck,
  BookOpen,
  ClipboardList,
  UploadCloud,
  MessageSquare,
  Calendar,
  Award,
  FileCheck2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  Download,
  AlertTriangle,
  PlusCircle,
  Lock,
  GraduationCap,
  Users,
  Mail,
  Phone,
  FileText,
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Sparkles,
  LayoutDashboard,
  ArrowRight,
  Video,
  Crown,
  Trash2,
} from 'lucide-react';
import { StudentWelcomeView } from '../dashboard/StudentWelcomeView';
import { WelcomeTimeline } from '../dashboard/WelcomeTimeline';
import { WorkspaceSidebar } from './WorkspaceSidebar';

const kltnStatusMap: Record<string, { label: string; badgeClass: string; desc: string }> = {
  CHUA_DU_DIEU_KIEN: {
    label: 'Chưa đủ điều kiện KLTN',
    badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
    desc: 'Chưa đạt tối thiểu 110 tín chỉ hoặc chưa được duyệt',
  },
  CHUA_DANG_KY: {
    label: 'Chưa đăng ký đề tài',
    badgeClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
    desc: 'Vui lòng chọn đề tài trong danh mục hoặc đề xuất đề tài mới',
  },
  CHO_DUYET_DANG_KY: {
    label: 'Đang chờ duyệt đăng ký',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    desc: 'Đơn đăng ký đang chờ Giảng viên hướng dẫn xét duyệt',
  },
  DA_DUOC_DUYET_DE_TAI: {
    label: 'Đã được duyệt đề tài',
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    desc: 'Đề tài đã được chấp nhận, chuẩn bị tiến hành',
  },
  DANG_LAM_NHOM: {
    label: 'Đang thành lập nhóm',
    badgeClass: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    desc: 'Đang tiến hành ghép nhóm và phân công vai trò',
  },
  DANG_THUC_HIEN: {
    label: 'Đang thực hiện đề tài',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    desc: 'Theo dõi tiến độ, nộp báo cáo tuần và gặp GVHD',
  },
  DUNG_TIEN_DO: {
    label: 'Tạm dừng KLTN giữa kỳ',
    badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
    desc: 'Hội đồng / GVHD quyết định dừng thực hiện đề tài',
  },
  DANG_BAO_VE: {
    label: 'Chuẩn bị bảo vệ KLTN',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    desc: 'Đã có lịch và phân công Hội đồng chấm bảo vệ',
  },
  DA_BAO_VE: {
    label: 'Đã bảo vệ KLTN',
    badgeClass: 'bg-teal-500/20 text-teal-200 border-teal-400/40',
    desc: 'Đã hoàn thành phiên bảo vệ trước hội đồng',
  },
  HOAN_THANH: {
    label: 'Đã hoàn thành KLTN',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    desc: 'Đã tổng kết và hoàn thành toàn bộ khóa luận',
  },
};

export const StudentWorkspace: React.FC = () => {
  const { user, setUser, accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('welcome');

  // Data states
  const [profile, setProfile] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [myGroup, setMyGroup] = useState<any>(null);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [defenseSchedules, setDefenseSchedules] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [scores, setScores] = useState<any>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [defenseInfo, setDefenseInfo] = useState<any>(null);

  // Modal đề xuất lại thời gian cho cuộc hẹn
  const [showProposeTimeModal, setShowProposeTimeModal] = useState<boolean>(false);
  const [selectedApptForPropose, setSelectedApptForPropose] = useState<any>(null);
  const [proposeTimeInput, setProposeTimeInput] = useState<string>('');
  const [proposeNoteInput, setProposeNoteInput] = useState<string>('');

  // KLTN Profile state
  const [kltnProfile, setKltnProfile] = useState<any>(null);
  const [loadingKltnProfile, setLoadingKltnProfile] = useState<boolean>(false);
  const [kltnActiveSubTab, setKltnActiveSubTab] = useState<'submissions' | 'discussions'>('submissions');

  // Modals & form inputs
  const [searchTopic, setSearchTopic] = useState('');
  const [filterOnlyHasSlot, setFilterOnlyHasSlot] = useState<boolean>(true);
  const [filterLecturerId, setFilterLecturerId] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [topicsPage, setTopicsPage] = useState<number>(1);
  const [topicsLimit, setTopicsLimit] = useState<number>(6);
  const [topicsMeta, setTopicsMeta] = useState<any>({ total: 0, page: 1, limit: 6, totalPages: 1, registrationOpen: true });
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [loadingTopics, setLoadingTopics] = useState<boolean>(false);
  const [lecturersList, setLecturersList] = useState<any[]>([]);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeGvhdId, setProposeGvhdId] = useState('');
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeSummary, setProposeSummary] = useState('');
  const [proposeObjectives, setProposeObjectives] = useState('');
  const [proposeTech, setProposeTech] = useState('');
  const [proposeRequirements, setProposeRequirements] = useState('');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [myProposals, setMyProposals] = useState<any[]>([]);

  const [showConfirmRegisterModal, setShowConfirmRegisterModal] = useState(false);
  const [topicToRegister, setTopicToRegister] = useState<any>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);

  // Topic Registrations & Group selection modal
  const [showTopicRegsModal, setShowTopicRegsModal] = useState(false);
  const [selectedTopicForRegs, setSelectedTopicForRegs] = useState<any>(null);
  const [topicRegistrations, setTopicRegistrations] = useState<any[]>([]);
  const [topicGroups, setTopicGroups] = useState<any[]>([]);
  const [loadingTopicRegs, setLoadingTopicRegs] = useState(false);
  const [selectedTeammateId, setSelectedTeammateId] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitSourceUrl, setSubmitSourceUrl] = useState('');
  const [submitNote, setSubmitNote] = useState('');
  const [progressData, setProgressData] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [submitType, setSubmitType] = useState<string>('BAO_CAO_TIEN_DO');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  // Student Contact Profile update form
  const [studentData, setStudentData] = useState<any>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editPersonalEmail, setEditPersonalEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editContactInfo, setEditContactInfo] = useState('');
  const [profileErrors, setProfileErrors] = useState<{ phone?: string; email?: string; address?: string }>({});
  const [showFirstLoginModal, setShowFirstLoginModal] = useState<boolean>(false);
  const [isSubmittingFirstUpdate, setIsSubmittingFirstUpdate] = useState<boolean>(false);

  const validatePhone = (val: string) => {
    if (!val || !val.trim()) return '';
    const regex = /^0\d{9}$/;
    if (!regex.test(val.trim())) {
      return 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam gồm đúng 10 số và bắt đầu bằng số 0 (VD: 0987654321)';
    }
    return '';
  };

  const validateEmail = (val: string) => {
    if (!val || !val.trim()) return '';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(val.trim())) {
      return 'Email cá nhân không đúng định dạng (VD: yourname@gmail.com)';
    }
    return '';
  };

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Trạng thái nhóm KLTN và đề tài chính thức của sinh viên
  const studentHasGroup = Boolean(
    (myGroup && myGroup.status !== 'CANCELLED') ||
    myGroups.some((g: any) => g.status !== 'CANCELLED')
  );

  const officialTopicId =
    myGroup?.topicId ||
    myGroup?.topic?.id ||
    myGroups.find((g: any) => g.status !== 'CANCELLED' && (g.topicId || g.topic?.id))?.topicId ||
    myGroups.find((g: any) => g.status !== 'CANCELLED' && (g.topicId || g.topic?.id))?.topic?.id ||
    registrations.find((r: any) => ['APPROVED', 'CHO_XAC_NHAN'].includes(r.status))?.topicId ||
    registrations.find((r: any) => ['APPROVED', 'CHO_XAC_NHAN'].includes(r.status))?.topic?.id;

  const hasOfficialTopicOrGroup = Boolean(
    studentHasGroup ||
    Boolean(officialTopicId) ||
    registrations.some((r: any) => ['APPROVED', 'CHO_XAC_NHAN'].includes(r.status))
  );

  const hasActiveRegistration = Boolean(
    hasOfficialTopicOrGroup ||
    registrations.some((r: any) => ['PENDING', 'CHO_XAC_NHAN', 'APPROVED'].includes(r.status))
  );

  // Trạng thái điểm của nhóm đã được công bố chính thức hay chưa
  const isScorePublished = Boolean(
    defenseInfo?.isScorePublished ?? (
      defenseInfo?.diemChiTiet &&
      defenseInfo?.diemChiTiet?.diemTongKet !== null &&
      defenseInfo?.diemChiTiet?.diemTongKet !== undefined &&
      defenseInfo?.ketQuaCuoiCung
    )
  );

  // Load all initial data for Student
  const loadData = async () => {
    if (!accessToken) return;
    try {
      const [sRes, pRes, eRes, tRes, rRes, gRes, subRes, repRes, appRes, defRes, revRes, evRes, kltnRes, lecRes, propRes, progRes, mySubRes, defInfoRes] = await Promise.all([
        api.get('/students/me').catch(() => null),
        api.get('/users/me'),
        api.get('/users/me/eligibility'),
        api.get('/topics?limit=100'),
        api.get('/registrations/mine'),
        api.get('/groups/mine'),
        api.get('/progress/submissions'),
        api.get('/progress/reports'),
        api.get('/appointments/me').catch(() => api.get('/appointments')),
        api.get('/defense/schedules').catch(() => null),
        api.get('/defense/reviewers').catch(() => null),
        api.get('/evidence').catch(() => null),
        api.get('/students/me/kltn-profile').catch(() => null),
        api.get('/users/lecturers').catch(() => null),
        api.get('/topic-proposals/me').catch(() => null),
        api.get('/students/me/progress').catch(() => null),
        api.get('/submissions/me').catch(() => null),
        api.get('/students/me/defense-info').catch(() => null),
      ]);

      if (defInfoRes?.data) {
        setDefenseInfo(defInfoRes.data?.data ?? defInfoRes.data);
      }

      if (progRes?.data) {
        setProgressData(progRes.data?.data ?? progRes.data);
      }

      if (mySubRes?.data) {
        setMySubmissions(mySubRes.data?.data ?? mySubRes.data ?? []);
      }

      if (propRes?.data) {
        setMyProposals(propRes.data?.data ?? propRes.data ?? []);
      }

      if (lecRes?.data) {
        const rawLecs = lecRes.data?.data ?? lecRes.data ?? [];
        const cleanLecs = Array.from(
          new Map(
            rawLecs
              .filter((lec: any) => {
                const email = lec.user?.email || lec.email || '';
                return (
                  !/\d{10,}@kltn\.edu\.vn/.test(email) &&
                  !email.includes('_score_') &&
                  !email.includes('_unlock_') &&
                  !email.startsWith('gv_b_') &&
                  !email.startsWith('gv_a_') &&
                  !email.startsWith('test_')
                );
              })
              .map((lec: any) => [lec.user?.email || lec.email || lec.id, lec])
          ).values()
        );
        setLecturersList(cleanLecs);
      }

      if (kltnRes?.data) {
        setKltnProfile(kltnRes.data?.data ?? kltnRes.data);
      }

      if (sRes?.data) {
        const sData = sRes.data?.data ?? sRes.data;
        setStudentData(sData);
        setEditPhone(sData.soDienThoai || sData.phone || '');
        setEditPersonalEmail(sData.emailCaNhan || sData.personalEmail || '');
        setEditAddress(sData.diaChi || sData.address || '');
        setEditContactInfo(sData.thongTinKhac || sData.contactInfo || '');

        const phoneVal = (sData.soDienThoai || sData.phone || '').trim();
        const emailVal = (sData.emailCaNhan || sData.personalEmail || '').trim();
        const addressVal = (sData.diaChi || sData.address || '').trim();
        const isProfileMissing = !phoneVal || !emailVal || !addressVal;
        const needsUpdate = user?.isFirstLogin || user?.requireProfileUpdate || sData?.requireProfileUpdate || isProfileMissing;

        if (needsUpdate) {
          setShowFirstLoginModal(true);
        }
      } else if (user?.role === 'SINH_VIEN' || user?.roles?.includes('SINH_VIEN')) {
        const phoneVal = (user?.phone || '').trim();
        const emailVal = (user?.studentProfile?.personalEmail || '').trim();
        const addressVal = (user?.studentProfile?.address || '').trim();
        if (!phoneVal || !emailVal || !addressVal || user?.isFirstLogin || user?.requireProfileUpdate) {
          setShowFirstLoginModal(true);
        }
      }

      const prof = pRes.data.data;
      setProfile(prof);
      if (!sRes?.data) {
        setEditPhone(prof.phone || '');
      }

      setEligibility(eRes.data.data);
      const initialTopics = tRes.data.data?.data ?? tRes.data.data?.items ?? tRes.data.data ?? [];
      setTopics(initialTopics);
      if (tRes.data.data?.meta) {
        setTopicsMeta(tRes.data.data.meta);
      }
      const regs = rRes.data.data ?? [];
      setRegistrations(regs);

      const groups = gRes.data.data ?? [];
      setMyGroups(groups);

      // Ưu tiên chọn đúng nhóm KLTN có đề tài và giảng viên hướng dẫn:
      const approvedReg = regs.find((r: any) =>
        ['APPROVED', 'CHO_XAC_NHAN'].includes(r.status) && (r.groupId || r.group?.id),
      );
      const regGroupId = approvedReg ? (approvedReg.groupId || approvedReg.group?.id) : null;

      let primaryGroup = null;
      if (regGroupId) {
        primaryGroup = groups.find((g: any) => g.id === regGroupId) || approvedReg.group;
      }
      if (!primaryGroup) {
        primaryGroup = groups.find((g: any) => (g.topicId || g.topic?.id) && g.status !== 'CANCELLED');
      }
      if (!primaryGroup) {
        primaryGroup = groups.find((g: any) => g.status === 'ACTIVE');
      }
      if (!primaryGroup) {
        primaryGroup = groups[0] ?? null;
      }
      setMyGroup(primaryGroup);

      setSubmissions(subRes.data.data ?? []);
      setReports(repRes.data.data ?? []);
      setAppointments(appRes.data.data ?? []);
      setDefenseSchedules(defRes?.data?.data ?? []);
      setReviewers(revRes?.data?.data ?? []);
      setEvidenceList(evRes?.data?.data ?? []);

      if (primaryGroup) {
        try {
          const scoreRes = await api.get(`/scores/groups/${primaryGroup.id}`);
          setScores(scoreRes.data.data);
        } catch {}
        fetchChatMessages(primaryGroup);
      }
    } catch (err: any) {
      console.error('Error loading student data:', err);
    }
  };

  const fetchChatMessages = async (groupToLoad = myGroup) => {
    if (!groupToLoad) return;
    try {
      const topicId = groupToLoad.topicId || groupToLoad.topic?.id;
      const res = await api.get(`/chat/messages?groupId=${groupToLoad.id}${topicId ? `&topicId=${topicId}` : ''}`);
      const data = res.data?.data ?? [];
      setChatMessages(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      const topicId = groupToLoad.topicId || groupToLoad.topic?.id;
      if (topicId) {
        try {
          const convRes = await api.get(`/conversations/${topicId}/messages`);
          setChatMessages(convRes.data?.data?.items ?? convRes.data?.data ?? []);
        } catch {}
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'chat' && myGroup) {
      fetchChatMessages(myGroup);

      const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') ?? 'http://localhost:3000';
      const socket = io(`${socketUrl}/chat`, { withCredentials: true });

      socket.emit('joinGroup', myGroup.id);
      const topicId = myGroup.topicId || myGroup.topic?.id;
      if (topicId) {
        socket.emit('joinTopic', topicId);
      }

      const handleIncomingMessage = (newMsg: any) => {
        if (!newMsg || !newMsg.id) return;
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      };

      socket.on('message', handleIncomingMessage);
      socket.on('new_message', handleIncomingMessage);

      // Polling dự phòng mỗi 4 giây khi đang ở tab trao đổi
      const interval = setInterval(() => {
        fetchChatMessages(myGroup);
      }, 4000);

      return () => {
        clearInterval(interval);
        socket.emit('leaveGroup', myGroup.id);
        if (topicId) {
          socket.emit('leaveTopic', topicId);
        }
        socket.disconnect();
      };
    }
  }, [activeTab, myGroup?.id]);

  const fetchTopics = async (pageOverride?: number) => {
    const pageToUse = pageOverride !== undefined ? pageOverride : topicsPage;
    try {
      setLoadingTopics(true);
      const params: any = {
        status: 'APPROVED',
        page: pageToUse,
        limit: topicsLimit,
      };
      if (filterOnlyHasSlot) params.hasSlot = 'true';
      if (searchTopic.trim()) params.keyword = searchTopic.trim();
      if (filterLecturerId) params.gvId = filterLecturerId;
      if (filterDepartment) params.chuyenNganh = filterDepartment;

      const res = await api.get('/topics', { params });
      const resData = res.data?.data ?? res.data;
      const items = resData.data ?? resData.items ?? (Array.isArray(resData) ? resData : []);
      setTopics(items);
      if (resData.meta) {
        setTopicsMeta(resData.meta);
      }
    } catch (err: any) {
      console.error('Lỗi tải danh sách đề tài:', err);
    } finally {
      setLoadingTopics(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'topics') {
      fetchTopics();
    }
  }, [activeTab, topicsPage, topicsLimit, filterOnlyHasSlot, filterLecturerId, filterDepartment]);

  // Update student contact profile via PUT /students/me
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneErr = validatePhone(editPhone);
    const emailErr = validateEmail(editPersonalEmail);
    if (phoneErr || emailErr) {
      setProfileErrors({ phone: phoneErr, email: emailErr });
      return;
    }
    setProfileErrors({});
    try {
      const res = await api.put('/students/me', {
        soDienThoai: editPhone.trim() || undefined,
        emailCaNhan: editPersonalEmail.trim() || undefined,
        diaChi: editAddress.trim() || undefined,
        thongTinKhac: editContactInfo.trim() || undefined,
      });
      const updated = res.data?.data ?? res.data;
      setStudentData(updated);
      if (user) {
        setUser({
          ...user,
          phone: editPhone.trim(),
          isFirstLogin: false,
          requireProfileUpdate: false,
          hasContactInfo: true,
          studentProfile: user.studentProfile
            ? {
                ...user.studentProfile,
                personalEmail: editPersonalEmail.trim(),
                address: editAddress.trim(),
                contactInfo: editContactInfo.trim(),
              }
            : undefined,
        });
      }
      notify('Cập nhật thông tin liên lạc thành công! Giảng viên hướng dẫn sẽ thấy thông tin mới của bạn.');
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errorText = Array.isArray(msg) ? msg.join('; ') : (msg || 'Lỗi cập nhật thông tin liên lạc');
      notify(errorText, 'error');
    }
  };

  // Handle first-time compulsory profile update
  const handleFirstLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneErr = validatePhone(editPhone);
    const emailErr = validateEmail(editPersonalEmail);
    let addressErr = '';
    if (!editAddress || !editAddress.trim()) {
      addressErr = 'Vui lòng nhập địa chỉ nơi ở / thường trú hiện tại';
    }

    if (phoneErr || emailErr || addressErr) {
      setProfileErrors({
        phone: phoneErr,
        email: emailErr,
        address: addressErr,
      });
      return;
    }

    setProfileErrors({});
    try {
      setIsSubmittingFirstUpdate(true);
      const res = await api.put('/students/me', {
        soDienThoai: editPhone.trim(),
        emailCaNhan: editPersonalEmail.trim(),
        diaChi: editAddress.trim(),
        thongTinKhac: editContactInfo.trim() || undefined,
      });
      const updated = res.data?.data ?? res.data;
      setStudentData(updated);

      if (user) {
        setUser({
          ...user,
          phone: editPhone.trim(),
          isFirstLogin: false,
          requireProfileUpdate: false,
          hasContactInfo: true,
          studentProfile: user.studentProfile
            ? {
                ...user.studentProfile,
                personalEmail: editPersonalEmail.trim(),
                address: editAddress.trim(),
                contactInfo: editContactInfo.trim(),
              }
            : undefined,
        });
      }

      setShowFirstLoginModal(false);
      notify('Kích hoạt tài khoản thành công! Thông tin cá nhân của bạn đã được cập nhật.');
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errorText = Array.isArray(msg) ? msg.join('; ') : (msg || 'Lỗi lưu thông tin sinh viên');
      notify(errorText, 'error');
    } finally {
      setIsSubmittingFirstUpdate(false);
    }
  };

  // Open confirm registration modal
  const handleOpenRegisterModal = (topic: any) => {
    if (hasActiveRegistration) {
      notify(
        studentHasGroup
          ? 'Bạn đã thuộc một nhóm KLTN chính thức, không thể đăng ký thêm đề tài khác.'
          : 'Bạn đã có đề tài chính thức / đơn đăng ký đang hoạt động, không thể đăng ký thêm đề tài khác.',
        'error',
      );
      return;
    }
    if (!topicsMeta?.registrationOpen) {
      if (topicsMeta?.lecturerTopicOpen || (topicsMeta?.registrationFrom && new Date() < new Date(topicsMeta.registrationFrom))) {
        notify('Chưa đến đợt sinh viên đăng ký đề tài. Hệ thống đang trong giai đoạn Giảng viên đề xuất & thẩm định đề tài.', 'error');
      } else {
        notify('Đợt KLTN hiện đang ngoài thời gian mở đăng ký đề tài.', 'error');
      }
      return;
    }
    setTopicToRegister(topic);
    setShowConfirmRegisterModal(true);
  };

  // Confirm registration for topic (Mặc định tự động xác nhận)
  const handleConfirmRegistration = async () => {
    if (!topicToRegister) return;
    if (hasActiveRegistration) {
      notify('Bạn đã thuộc một nhóm KLTN hoặc đã có đề tài chính thức.', 'error');
      setShowConfirmRegisterModal(false);
      setTopicToRegister(null);
      return;
    }
    const targetTopic = topicToRegister;
    try {
      setIsSubmittingRegistration(true);
      await api.post('/registrations', {
        topicId: targetTopic.id,
        semesterId: targetTopic.semesterId || targetTopic.hocKy?.id,
      });
      notify('Đăng ký đề tài thành công! Đề tài đã được tự động xác nhận.', 'success');
      setShowConfirmRegisterModal(false);
      setTopicToRegister(null);
      await loadData();
      openTopicRegistrationsModal(targetTopic);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errorText = Array.isArray(msg) ? msg.join('; ') : (msg || 'Không thể đăng ký đề tài');
      notify(errorText, 'error');
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  // Open Topic Registrations & Group selection modal
  const openTopicRegistrationsModal = async (topic: any) => {
    setSelectedTopicForRegs(topic);
    setShowTopicRegsModal(true);
    setLoadingTopicRegs(true);
    setSelectedTeammateId('');
    try {
      const res = await api.get(`/topics/${topic.id}/registrations`);
      const payload = res.data?.data ?? res.data;
      setTopicRegistrations(payload?.data ?? payload?.registrations ?? []);
      setTopicGroups(payload?.groups ?? []);
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi tải danh sách sinh viên đăng ký', 'error');
      setTopicRegistrations([]);
      setTopicGroups([]);
    } finally {
      setLoadingTopicRegs(false);
    }
  };

  // Create group for topic & optionally add selected registered teammate
  const handleCreateGroupForTopic = async () => {
    if (!selectedTopicForRegs) return;
    try {
      setIsCreatingGroup(true);
      const memberIds = selectedTeammateId ? [selectedTeammateId] : [];
      await api.post('/groups', {
        topicId: selectedTopicForRegs.id,
        memberStudentIds: memberIds,
      });
      notify('Thành lập nhóm KLTN thành công!', 'success');
      await loadData();
      await openTopicRegistrationsModal(selectedTopicForRegs);
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể thành lập nhóm', 'error');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Join existing group for topic
  const handleJoinGroup = async (groupId: string) => {
    try {
      await api.post(`/groups/${groupId}/join`);
      notify('Tham gia nhóm KLTN thành công!', 'success');
      await loadData();
      if (selectedTopicForRegs) {
        await openTopicRegistrationsModal(selectedTopicForRegs);
      }
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể tham gia nhóm', 'error');
    }
  };

  // Add member to group
  const handleAddMemberToGroup = async (groupId: string, studentId: string) => {
    try {
      await api.post(`/groups/${groupId}/members`, { studentId });
      notify('Đã thêm bạn cùng đề tài vào nhóm thành công!', 'success');
      await loadData();
      if (selectedTopicForRegs) {
        await openTopicRegistrationsModal(selectedTopicForRegs);
      }
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể thêm vào nhóm', 'error');
    }
  };

  // Propose new topic (SV đã liên hệ trước với GV)
  const handleProposeTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasActiveRegistration) {
      notify('Bạn đã thuộc một nhóm KLTN hoặc đã có đề tài chính thức, không thể đề xuất đề tài mới.', 'error');
      return;
    }
    if (!proposeGvhdId) {
      notify('Vui lòng chọn Giảng viên hướng dẫn mong muốn', 'error');
      return;
    }
    if (!proposeTitle.trim()) {
      notify('Vui lòng nhập tên đề tài', 'error');
      return;
    }
    if (!proposeSummary.trim()) {
      notify('Vui lòng nhập mô tả tóm tắt đề tài', 'error');
      return;
    }
    const yeuCauText = (proposeRequirements.trim() || proposeTech.trim() || proposeObjectives.trim()) || 'Không có yêu cầu đặc biệt';
    try {
      setIsSubmittingProposal(true);
      await api.post('/topic-proposals', {
        gvhdId: proposeGvhdId,
        tenDeTai: proposeTitle.trim(),
        moTa: proposeSummary.trim(),
        yeuCau: yeuCauText,
      });
      notify('Đã gửi đề xuất đề tài đến Giảng viên hướng dẫn (Trạng thái: Chờ GV xác nhận)!', 'success');
      setShowProposeModal(false);
      setProposeTitle('');
      setProposeSummary('');
      setProposeRequirements('');
      setProposeObjectives('');
      setProposeTech('');
      setProposeGvhdId('');
      await loadData();
      setActiveTab('my-reg');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errorText = Array.isArray(msg) ? msg.join('; ') : (msg || 'Lỗi gửi đề xuất đề tài');
      notify(errorText, 'error');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  // Withdraw / Cancel registration (Chỉ được phép trong tuần 1 - 3)
  const handleWithdrawRegistration = async (regId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đề tài đã đăng ký này không?\nLưu ý theo quy chế KLTN: Sinh viên chỉ có thể hủy đề tài ở tuần 1 - 3, sau đó không thể hủy đề tài đã đăng ký.')) return;
    try {
      await api.post(`/registrations/${regId}/cancel`);
      notify('Đã hủy đề tài đã đăng ký thành công!', 'success');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể hủy đề tài đã đăng ký', 'error');
    }
  };
  const handleCancelRegistration = handleWithdrawRegistration;

  const loadProgress = async () => {
    try {
      setLoadingProgress(true);
      const res = await api.get('/students/me/progress');
      setProgressData(res.data?.data ?? res.data);
    } catch (err: any) {
      console.error('Error loading progress:', err);
    } finally {
      setLoadingProgress(false);
    }
  };

  const loadMySubmissions = async () => {
    try {
      const res = await api.get('/submissions/me');
      setMySubmissions(res.data?.data ?? res.data ?? []);
    } catch (err: any) {
      console.error('Error loading submissions:', err);
    }
  };

  // Multi-type Submit report / document / code / link
  const handleMultiTypeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!submitFile && !submitSourceUrl.trim()) {
      return notify('Vui lòng đính kèm tệp tin hoặc dán đường dẫn liên kết (GitHub/Drive/Demo)', 'error');
    }

    const formData = new FormData();
    formData.append('type', submitType);
    if (submitFile) formData.append('file', submitFile);
    if (submitSourceUrl.trim()) formData.append('link', submitSourceUrl.trim());
    if (submitNote.trim()) formData.append('note', submitNote.trim());
    if (selectedReportId) formData.append('reportId', selectedReportId);

    try {
      setIsUploading(true);
      setUploadPercent(40);
      await api.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadPercent(percent);
          }
        },
      });
      notify('Nộp tài liệu / báo cáo thành công!', 'success');
      setShowSubmitModal(false);
      setSubmitFile(null);
      setSubmitSourceUrl('');
      setSubmitNote('');
      setIsUploading(false);
      setUploadPercent(0);
      loadData();
      loadProgress();
      loadMySubmissions();
    } catch (err: any) {
      setIsUploading(false);
      notify(err.response?.data?.message ?? 'Không thể nộp bài', 'error');
    }
  };

  // Submit report for specific progress report
  const handleSubmitReport = async (e: React.FormEvent) => {
    return handleMultiTypeSubmit(e);
  };

  // Send chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !myGroup) return;
    const topicId = myGroup.topicId || myGroup.topic?.id;
    try {
      const res = await api.post('/chat/messages', {
        groupId: myGroup.id,
        topicId: topicId || undefined,
        content: chatInput,
      });
      const newMsg = res.data?.data ?? res.data;
      if (newMsg && newMsg.id) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      setChatInput('');
    } catch (err: any) {
      if (topicId) {
        try {
          const res = await api.post(`/conversations/${topicId}/messages`, {
            content: chatInput,
          });
          const newMsg = res.data?.data ?? res.data;
          if (newMsg && newMsg.id) {
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          setChatInput('');
          return;
        } catch {}
      }
      notify(err.response?.data?.message ?? 'Lỗi gửi tin nhắn', 'error');
    }
  };

  // Confirm appointment via dedicated POST /appointments/:id/confirm
  const handleConfirmAppointment = async (id: string) => {
    try {
      await api.post(`/appointments/${id}/confirm`);
      notify('Đã xác nhận lịch hẹn thành công!');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xác nhận lịch hẹn', 'error');
    }
  };

  // Propose new time via POST /appointments/:id/propose-time
  const handleProposeTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApptForPropose || !proposeTimeInput) return;
    try {
      await api.post(`/appointments/${selectedApptForPropose.id}/propose-time`, {
        proposedTime: new Date(proposeTimeInput).toISOString(),
        note: proposeNoteInput || undefined,
      });
      notify('Đã gửi đề xuất thời gian mới cho GVHD!');
      setShowProposeTimeModal(false);
      setSelectedApptForPropose(null);
      setProposeTimeInput('');
      setProposeNoteInput('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể đề xuất thời gian', 'error');
    }
  };

  // Confirm / Cancel appointment
  const handleUpdateAppointment = async (id: string, status: string) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      notify(`Đã cập nhật trạng thái lịch hẹn: ${status}`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi cập nhật', 'error');
    }
  };

  // Submit Evidence
  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEvidence) return;

    if (!evidenceTitle || !evidenceTitle.trim()) {
      notify('Vui lòng nhập tiêu đề minh chứng NCKH', 'error');
      return;
    }

    const hasFile = Boolean(evidenceFile);
    const hasDesc = Boolean(evidenceDesc && evidenceDesc.trim().length > 0);
    if (!hasFile && !hasDesc) {
      notify(
        'Bắt buộc (required) phải đính kèm tệp minh chứng (PDF/ảnh/zip) hoặc nhập liên kết / mô tả chi tiết công trình NCKH.',
        'error',
      );
      return;
    }

    try {
      setIsSubmittingEvidence(true);
      const formData = new FormData();
      formData.append('title', evidenceTitle.trim());
      if (evidenceDesc && evidenceDesc.trim()) formData.append('description', evidenceDesc.trim());
      if (evidenceFile) formData.append('file', evidenceFile);

      await api.post('/evidence', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify('Đã nộp minh chứng NCKH thành công! Hồ sơ đang chờ Quản lý bộ môn xét duyệt cộng điểm.', 'success');
      setShowEvidenceModal(false);
      setEvidenceTitle('');
      setEvidenceDesc('');
      setEvidenceFile(null);
      await loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi nộp minh chứng NCKH', 'error');
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  // Download PDF Scorecard (Chỉ khả dụng khi điểm đã được công bố chính thức)
  const handleDownloadPdf = async () => {
    if (!myGroup) return;
    if (!isScorePublished) {
      notify('Điểm của nhóm đang được khóa chờ công bố chính thức. Không thể xuất phiếu điểm lúc này.', 'error');
      return;
    }
    try {
      const res = await api.get(`/scores/groups/${myGroup.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `phieu-diem-${myGroup.code}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Đã tải phiếu điểm PDF thành công!');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notify(msg || 'Không thể tải phiếu điểm do điểm đang khóa chờ công bố', 'error');
    }
  };

  // Download Submission File
  const handleDownloadSubmission = async (sub: any) => {
    try {
      if (sub.sourceUrl && !sub.fileUrl) {
        window.open(sub.sourceUrl, '_blank');
        return;
      }
      const res = await api.get(`/submissions/${sub.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fixMojibake(sub.fileName) || `submission-${sub.id}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading submission:', err);
      notify('Không thể tải tệp tin bài nộp', 'error');
    }
  };

  const loadKltnProfile = async () => {
    try {
      setLoadingKltnProfile(true);
      const res = await api.get('/students/me/kltn-profile');
      setKltnProfile(res.data?.data ?? res.data);
    } catch (err: any) {
      console.error('Error fetching KLTN profile:', err);
    } finally {
      setLoadingKltnProfile(false);
    }
  };

  const navItems = [
    { id: 'welcome', label: 'Tổng quan & Chào mừng', icon: LayoutDashboard },
    { id: 'profile', label: 'Hồ sơ & Điều kiện', icon: UserCheck },
    { id: 'kltn-profile', label: 'Hồ sơ KLTN của mình', icon: GraduationCap },
    { id: 'topics', label: 'Đề tài & Đăng ký', icon: BookOpen },
    { id: 'my-reg', label: 'Đăng ký của tôi', icon: ClipboardList, count: registrations.length },
    { id: 'progress', label: 'Tiến độ & Nộp bài', icon: UploadCloud, count: submissions.length },
    { id: 'chat', label: 'Trao đổi GVHD', icon: MessageSquare },
    { id: 'appointments', label: 'Lịch hẹn', icon: Calendar, count: appointments.length },
    { id: 'defense', label: 'Phản biện & Bảo vệ', icon: FileCheck2 },
    { id: 'scores', label: 'Bảng điểm & NCKH', icon: Award },
  ];

  const filteredTopics = topics.filter((t) =>
    `${t.title} ${t.technologies ?? ''} ${t.owner?.fullName ?? ''}`.toLowerCase().includes(searchTopic.toLowerCase()),
  );

  const isEligible =
    user?.duDieuKienDangKyKLTN !== undefined
      ? user.duDieuKienDangKyKLTN
      : eligibility
      ? eligibility.eligible
      : (profile?.studentProfile?.eligible ?? true);

  const currentKltnStatus = user?.trangThaiKLTN ?? (isEligible ? 'CHUA_DANG_KY' : 'CHUA_DU_DIEU_KIEN');
  const statusConfig = kltnStatusMap[currentKltnStatus] || {
    label: currentKltnStatus,
    badgeClass: 'bg-white/20 text-white border-white/30',
    desc: '',
  };

  return (
    <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
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
        <WorkspaceSidebar
          title="Chức năng Sinh viên"
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={(tabId) => {
            setActiveTab(tabId);
            if (tabId === 'kltn-profile') {
              loadKltnProfile();
            }
          }}
          themeColor="indigo"
          infoCard={
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100/80 text-xs text-indigo-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>Hỗ trợ KLTN</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Khoa Công nghệ Thông tin<br />
                Phòng A1-203 • ĐT: 028.38940390<br />
                Email: kltn.fit@edu.vn
              </p>
            </div>
          }
        />

        {/* NỘI DUNG CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Workspace Subheader & Eligibility Banner */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
                  <span>Cổng Sinh viên KLTN</span>
                  <span>•</span>
                  <span>MSSV: {user?.mssv || profile?.studentProfile?.studentCode || 'N/A'}</span>
                </div>
                <h2 className="text-2xl font-bold mt-1 text-white">Xin chào, {user?.hoTen || profile?.fullName || user?.fullName}!</h2>
                <p className="text-indigo-100 text-sm mt-1">
                  Khoa Công nghệ Thông tin | Lớp: {profile?.studentProfile?.className ?? 'CNTT K2026'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* KLTN Current Status Badge */}
                <div className="bg-white/10 backdrop-blur border border-white/20 p-3 rounded-xl flex items-center gap-2.5">
                  <div className="text-xs text-indigo-200 font-medium">Trạng thái KLTN:</div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusConfig.badgeClass}`}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Eligibility & Credits */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 p-3 rounded-xl">
                  {isEligible ? (
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đủ điều kiện KLTN</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Chưa đủ điều kiện KLTN</span>
                    </div>
                  )}
                  <div className="pl-3 border-l border-white/20 text-xs">
                    <span className="text-indigo-200 block text-[10px]">Tích lũy</span>
                    <span className="text-sm font-bold text-white">{profile?.studentProfile?.creditsEarned ?? user?.studentProfile?.creditsEarned ?? 0} TC</span>
                  </div>
                </div>

                {/* Quick Link to KLTN Profile */}
                <button
                  onClick={() => {
                    setActiveTab('kltn-profile');
                    loadKltnProfile();
                  }}
                  className="bg-white/15 hover:bg-white/25 transition-all backdrop-blur border border-white/30 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-indigo-200" />
                  <span>Hồ sơ KLTN</span>
                </button>
              </div>
            </div>

            {/* Prominent Warning if Ineligible */}
            {!isEligible && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-500/25 border border-rose-300/40 text-rose-100 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">Lưu ý về quyền đăng ký đề tài:</span>
                  Tài khoản hiện tại <strong>chưa đủ điều kiện làm Khóa luận Tốt nghiệp</strong> (do chưa hoàn thành đủ 110 tín chỉ hoặc chưa được Phòng Đào tạo / Bộ môn kích hoạt).
                  Hệ thống đã <strong>tạm thời khóa chức năng Đăng ký đề tài và Đề xuất đề tài mới</strong>. Bạn vẫn có thể xem danh mục đề tài, cập nhật thông tin cá nhân hoặc liên hệ văn phòng Khoa để được giải đáp.
                </div>
              </div>
            )}
          </div>

      {/* Tab 0: Welcome Dashboard */}
      {activeTab === 'welcome' && (
        <StudentWelcomeView
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'kltn-profile') {
              loadKltnProfile();
            }
          }}
          workspaceData={{
            myGroup,
            registrations,
            submissions,
            appointments,
            defenseSchedules,
            progressData,
            scores: defenseInfo?.diemChiTiet,
            defenseInfo,
            semester: progressData?.semester,
            currentStep: progressData?.semester?.currentStep || progressData?.semester?.semesterStep || 1,
            studentStep: progressData?.studentStep || progressData?.currentStep || 1,
            isCompleted: progressData?.semester?.status === 'ARCHIVED' || progressData?.semester?.status === 'CLOSED',
            percentComplete: progressData?.percentComplete,
          }}
        />
      )}

      {/* Tab 1: Profile & Eligibility */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  Cập nhật thông tin cá nhân sinh viên
                </h3>
                <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md font-medium border border-indigo-100 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  Hồ sơ sinh viên
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* 1. Readonly Academic Identity Section */}
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Thông tin định danh do Nhà trường / Khoa quản lý (Cố định)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
                    <Input
                      label="Mã số sinh viên (MSSV)"
                      value={studentData?.mssv || profile?.studentProfile?.studentCode || 'N/A'}
                      disabled
                      helperText="Mã số do Nhà trường cấp, không thể sửa"
                    />
                    <Input
                      label="Họ và tên sinh viên"
                      value={studentData?.hoTen || profile?.fullName || user?.fullName || 'N/A'}
                      disabled
                      helperText="Họ tên theo hồ sơ đào tạo chính thức"
                    />
                    <Input
                      label="Email trường cấp"
                      value={studentData?.emailTruong || profile?.email || 'N/A'}
                      disabled
                      helperText="Email trường dùng để đăng nhập hệ thống"
                    />
                    <Input
                      label="Lớp sinh hoạt"
                      value={studentData?.lop || profile?.studentProfile?.className || 'CNTT K2026'}
                      disabled
                      helperText="Lớp sinh hoạt do Khoa cố định"
                    />
                    <Input
                      label="Khoa / Bộ môn"
                      value={studentData?.khoa || 'Khoa Công nghệ Thông tin'}
                      disabled
                    />
                    <Input
                      label="Điểm trung bình (GPA)"
                      value={studentData?.gpa ? Number(studentData.gpa).toFixed(2) : (profile?.studentProfile?.gpa ? Number(profile.studentProfile.gpa).toFixed(2) : 'N/A')}
                      disabled
                    />
                  </div>
                </div>

                {/* 2. Editable Contact Details Section */}
                <div>
                  <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2.5 pb-1 border-b border-indigo-100 flex items-center justify-between">
                    <span>Thông tin liên lạc cá nhân (Cho phép sinh viên cập nhật - Hiển thị cho GVHD)</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                      Tự động đồng bộ tới GVHD
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Số điện thoại di động (10 số, bắt đầu bằng 0) *"
                        value={editPhone}
                        onChange={(e) => {
                          setEditPhone(e.target.value);
                          setProfileErrors((prev) => ({ ...prev, phone: validatePhone(e.target.value) }));
                        }}
                        placeholder="VD: 0987654321"
                        error={profileErrors.phone}
                        helperText="Số điện thoại để GVHD liên hệ trao đổi khóa luận"
                        required
                      />
                    </div>

                    <div>
                      <Input
                        label="Email cá nhân phụ (Gmail, Outlook...)"
                        type="email"
                        value={editPersonalEmail}
                        onChange={(e) => {
                          setEditPersonalEmail(e.target.value);
                          setProfileErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                        }}
                        placeholder="VD: yourname@gmail.com"
                        error={profileErrors.email}
                        helperText="Dùng để nhận thông báo và liên hệ dự phòng"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Địa chỉ nơi ở / thường trú hiện tại"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="VD: 123 Đường Nguyễn Trãi, Phường Bến Thành, Quận 1, TP.HCM"
                        helperText="Địa chỉ cư trú hiện tại trong thời gian làm khóa luận"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Thông tin liên lạc khác (Zalo, Telegram, thời gian thuận tiện...)"
                        value={editContactInfo}
                        onChange={(e) => setEditContactInfo(e.target.value)}
                        placeholder="VD: Zalo: 0987654321, có thể trao đổi trực tuyến vào các buổi tối hoặc chiều thứ 3"
                        helperText="Thông tin phụ trợ giúp GVHD dễ dàng sắp xếp lịch gặp và phản hồi tiến độ"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    ℹ️ Mọi thay đổi được ghi nhật ký hệ thống (AuditLog) và đồng bộ trực tiếp cho Giảng viên hướng dẫn.
                  </span>
                  <Button type="submit" variant="primary">
                    Lưu thông tin liên lạc
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Kiểm tra điều kiện KLTN
              </h3>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Trạng thái:</span>
                  {eligibility?.eligible ? (
                    <Badge variant="success">Đủ điều kiện</Badge>
                  ) : (
                    <Badge variant="danger">Chưa đủ điều kiện</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Tín chỉ tích lũy:</span>
                  <span className="font-semibold">{profile?.studentProfile?.creditsEarned ?? 0} TC (tối thiểu 110)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Điểm GPA:</span>
                  <span className="font-semibold">{profile?.studentProfile?.gpa ?? 'N/A'}</span>
                </div>
              </div>

              {!eligibility?.eligible && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold">Lý do chưa đạt:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {(eligibility?.reasons ?? []).map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <span className="font-semibold block">Lưu ý đợt KLTN:</span>
                <p className="text-slate-600 leading-relaxed">
                  Sinh viên cần đủ điều kiện tín chỉ để được duyệt đăng ký đề tài chính thức. Mọi thắc mắc vui lòng liên hệ văn phòng Quản lý bộ môn.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Hồ sơ KLTN của mình */}
      {activeTab === 'kltn-profile' && (
        <div className="space-y-6">
          {loadingKltnProfile ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-medium text-slate-600">Đang tải toàn bộ hồ sơ Khóa luận Tốt nghiệp...</p>
            </div>
          ) : !kltnProfile?.hasDeTai ? (
            /* Ngoại lệ: Chưa có đề tài */
            <div className="bg-white rounded-2xl p-8 sm:p-12 border border-dashed border-slate-300 text-center max-w-2xl mx-auto space-y-5 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-inner">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Chưa có Đề tài Khóa luận Tốt nghiệp</h3>
                <p className="text-slate-600 text-sm leading-relaxed max-w-md mx-auto">
                  {kltnProfile?.message || 'Bạn chưa đăng ký hoặc được phân công đề tài nào trong đợt KLTN hiện tại.'}
                </p>
              </div>

              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 text-left space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Các bước để bắt đầu làm Khóa luận Tốt nghiệp:</span>
                </div>
                <ol className="list-decimal list-inside pl-1 text-slate-600 space-y-1">
                  <li>Khám phá danh sách các đề tài nghiên cứu do Khoa & Giảng viên công bố.</li>
                  <li>Chọn đề tài phù hợp và gửi đơn đăng ký tới Giảng viên hướng dẫn (GVHD).</li>
                  <li>Hoặc chủ động đề xuất đề tài mới phù hợp với định hướng cá nhân.</li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  onClick={() => setActiveTab('topics')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Khám phá danh mục đề tài ngay</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('my-reg')}
                  className="flex items-center gap-2"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Xem đơn đăng ký của tôi</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Luồng chính: Đã có đề tài */
            <div className="space-y-6">
              {/* Card 1: Thông tin đề tài */}
              <div className="bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-3 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs">
                        ĐỀ TÀI KLTN CHÍNH THỨC
                      </span>
                      {kltnProfile.nhom?.maNhom && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Mã nhóm: {kltnProfile.nhom.maNhom} ({kltnProfile.nhom.tenNhom})
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          kltnStatusMap[kltnProfile.trangThaiHienTai]?.badgeClass || 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {kltnStatusMap[kltnProfile.trangThaiHienTai]?.label || kltnProfile.trangThaiHienTai}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                      {kltnProfile.deTai?.tenDeTai}
                    </h2>

                    {kltnProfile.deTai?.moTa && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {kltnProfile.deTai.moTa}
                      </p>
                    )}

                    {kltnProfile.deTai?.mucTieu && (
                      <div className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-slate-200/80 space-y-1">
                        <span className="font-bold text-slate-900 block">Mục tiêu đề tài:</span>
                        <p>{kltnProfile.deTai.mucTieu}</p>
                      </div>
                    )}

                    {kltnProfile.deTai?.congNghe && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-semibold text-slate-500 mr-1">Công nghệ:</span>
                        {kltnProfile.deTai.congNghe.split(/[,;]/).map((tech: string, i: number) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70"
                          >
                            {tech.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex lg:flex-col gap-2 shrink-0">
                    <Button
                      onClick={() => setShowSubmitModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Nộp bài / Báo cáo</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('chat')}
                      className="text-xs flex items-center gap-1.5 bg-white"
                    >
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      <span>Trao đổi GVHD</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Grid 2 Cột: GVHD & Thành viên nhóm */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cột 1: Giảng viên Hướng dẫn */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-indigo-600" />
                        Giảng viên Hướng dẫn (GVHD)
                      </h3>
                      <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60">
                        {kltnProfile.gvhd?.hocHamHocVi || 'Giảng viên'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                        {kltnProfile.gvhd?.hoTen ? kltnProfile.gvhd.hoTen.charAt(0).toUpperCase() : 'G'}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 text-base">
                          {kltnProfile.gvhd?.hoTen}
                        </h4>
                        <p className="text-xs text-slate-600">
                          Khoa Công nghệ Thông tin
                          {kltnProfile.gvhd?.chuyenMon && ` • ${kltnProfile.gvhd.chuyenMon}`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          Email liên hệ:
                        </span>
                        {kltnProfile.gvhd?.email ? (
                          <a
                            href={`mailto:${kltnProfile.gvhd.email}`}
                            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {kltnProfile.gvhd.email}
                          </a>
                        ) : (
                          <span className="text-slate-400">Chưa cập nhật</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab('appointments')}
                        className="w-full text-xs flex items-center justify-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Xem lịch hẹn trao đổi</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('chat')}
                        className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Nhắn tin GVHD</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Cột 2: Thành viên Nhóm KLTN */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        Thành viên Nhóm KLTN
                      </h3>
                      <span className="text-xs text-slate-500">
                        {kltnProfile.thanhVienNhom?.length || 0} thành viên
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {kltnProfile.thanhVienNhom?.map((member: any, idx: number) => (
                      <div
                        key={member.id || idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center ${
                              member.isLeader
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {member.hoTen ? member.hoTen.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{member.hoTen}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  member.isLeader
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {member.vaiTro || (member.isLeader ? 'Trưởng nhóm' : 'Thành viên')}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              MSSV: <span className="font-medium text-slate-700">{member.mssv}</span>
                              {member.lop && ` • Lớp: ${member.lop}`}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 space-y-0.5 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          {member.email && (
                            <div className="truncate max-w-[200px]" title={member.email}>
                              {member.email}
                            </div>
                          )}
                          {member.soDienThoai && member.soDienThoai !== 'Chưa cập nhật' && (
                            <div className="text-indigo-600 font-medium">{member.soDienThoai}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Card Tabs: Lịch sử Nộp bài & Lịch sử Trao đổi */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setKltnActiveSubTab('submissions')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                          kltnActiveSubTab === 'submissions'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Lịch sử Nộp bài</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            kltnActiveSubTab === 'submissions' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {kltnProfile.lichSuNopBai?.length || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => setKltnActiveSubTab('discussions')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                          kltnActiveSubTab === 'discussions'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Lịch sử Trao đổi & Hướng dẫn</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            kltnActiveSubTab === 'discussions' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {kltnProfile.lichSuTraoDoi?.length || 0}
                        </span>
                      </button>
                    </div>

                    {kltnActiveSubTab === 'submissions' ? (
                      <Button
                        size="sm"
                        onClick={() => setShowSubmitModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Nộp báo cáo mới</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('chat')}
                        variant="outline"
                        className="text-xs flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Mở phòng trao đổi trực tuyến</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Subtab 1: Lịch sử Nộp bài */}
                  {kltnActiveSubTab === 'submissions' && (
                    <div className="space-y-4">
                      {!kltnProfile.lichSuNopBai || kltnProfile.lichSuNopBai.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                          <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="text-sm font-medium text-slate-700">Chưa có lượt nộp bài nào được ghi nhận</p>
                          <p className="text-xs text-slate-500">
                            Nhóm có thể nộp đề cương, báo cáo tiến độ tuần, báo cáo giữa kỳ hoặc mã nguồn tại đây.
                          </p>
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={() => setShowSubmitModal(true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              Nộp bài ngay
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {kltnProfile.lichSuNopBai.map((sub: any, idx: number) => (
                            <div
                              key={sub.id || idx}
                              className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-xs transition-all space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                                    #{sub.lanNop || idx + 1}
                                  </span>
                                  <div>
                                    <h4 className="font-bold text-sm text-slate-900">
                                      {sub.tieuDe || sub.tenFile || 'Báo cáo nộp bài'}
                                    </h4>
                                    <div className="text-xs text-slate-500">
                                      Người nộp: {sub.nguoiNop?.hoTen} • Ngày: {new Date(sub.ngayNop).toLocaleString('vi-VN')}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      sub.trangThai === 'ACCEPTED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : sub.trangThai === 'REVISION_REQUIRED'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {sub.trangThai === 'ACCEPTED'
                                      ? 'Đã duyệt'
                                      : sub.trangThai === 'REVISION_REQUIRED'
                                      ? 'Yêu cầu sửa'
                                      : 'Đã nộp'}
                                  </span>
                                </div>
                              </div>

                              {sub.ghiChu && (
                                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  <span className="font-semibold text-slate-700">Ghi chú sinh viên: </span>
                                  {sub.ghiChu}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 border-t border-slate-100">
                                {sub.tenFile && (
                                  <span className="font-medium text-slate-700 flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    {sub.tenFile}
                                  </span>
                                )}
                                {sub.fileUrl && (
                                  <a
                                    href={sub.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 hover:underline flex items-center gap-1"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Tải file
                                  </a>
                                )}
                                {sub.sourceUrl && (
                                  <a
                                    href={sub.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 hover:underline flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Mã nguồn (Git)
                                  </a>
                                )}
                              </div>

                              {/* Nhận xét / Phản hồi từ GVHD */}
                              {sub.phanHoi && sub.phanHoi.length > 0 && (
                                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2 mt-2">
                                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Nhận xét từ Giảng viên hướng dẫn:</span>
                                  </div>
                                  {sub.phanHoi.map((fb: any, fbIdx: number) => (
                                    <div key={fb.id || fbIdx} className="text-xs text-slate-700 space-y-0.5">
                                      <p className="bg-white/80 p-2 rounded-lg border border-amber-100 font-medium">
                                        "{fb.noiDung}"
                                      </p>
                                      <div className="text-[10px] text-amber-800/80 flex items-center justify-between px-1">
                                        <span>GV: {fb.nguoiNhanXet}</span>
                                        <span>{new Date(fb.ngayTao).toLocaleString('vi-VN')}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtab 2: Lịch sử Trao đổi & Hướng dẫn */}
                  {kltnActiveSubTab === 'discussions' && (
                    <div className="space-y-4">
                      {!kltnProfile.lichSuTraoDoi || kltnProfile.lichSuTraoDoi.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="text-sm font-medium text-slate-700">Chưa có tin nhắn trao đổi nào</p>
                          <p className="text-xs text-slate-500">
                            Sinh viên và GVHD có thể trao đổi trực tiếp trong không gian làm việc của nhóm.
                          </p>
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={() => setActiveTab('chat')}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                            >
                              Mở kênh trao đổi ngay
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-xs text-slate-500 flex items-center justify-between pb-1">
                            <span>Danh sách tin nhắn hướng dẫn và thảo luận gần nhất:</span>
                            <button
                              onClick={() => setActiveTab('chat')}
                              className="text-indigo-600 font-medium hover:underline text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <span>Vào phòng chat đầy đủ</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                            {kltnProfile.lichSuTraoDoi.map((msg: any, idx: number) => (
                              <div
                                key={msg.id || idx}
                                className={`p-3 rounded-xl border text-xs transition-all ${
                                  msg.laGVHD
                                    ? 'bg-indigo-50/70 border-indigo-200/80 text-indigo-950'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span>{msg.nguoiGui}</span>
                                    {msg.laGVHD && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-indigo-600 text-white text-[10px] font-semibold">
                                        GVHD
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(msg.thoiGian).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.noiDung}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Topics Catalog & Register */}
      {activeTab === 'topics' && (
        <div className="space-y-6">
          {/* Subheader & Quick Info Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Registration Window Badge */}
              {topicsMeta?.registrationOpen ? (
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cổng SV đăng ký đề tài: ĐANG MỞ</span>
                </span>
              ) : topicsMeta?.lecturerTopicOpen || (topicsMeta?.registrationFrom && new Date() < new Date(topicsMeta.registrationFrom)) ? (
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Giai đoạn 1: Giảng viên đề xuất & thẩm định đề tài</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Cổng đăng ký KLTN: NGOÀI THỜI GIAN ĐĂNG KÝ</span>
                </span>
              )}

              <span className="text-xs font-medium text-slate-500">
                Tìm thấy <strong className="text-slate-900 font-bold">{topicsMeta?.total ?? topics.length}</strong> đề tài (Trang {topicsPage}/{topicsMeta?.totalPages || 1})
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* View mode toggle (Cards vs Table) */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Chế độ xem dạng Thẻ"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dạng thẻ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Chế độ xem dạng Bảng"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dạng bảng</span>
                </button>
              </div>

              {/* Propose topic button */}
              {hasActiveRegistration ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled
                  className="text-xs opacity-60 cursor-not-allowed border-dashed bg-slate-100 text-slate-400 flex items-center gap-1.5"
                  title="Bạn đã thuộc một nhóm KLTN hoặc đã có đề tài chính thức"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Đề xuất đề tài (Đã có đề tài)</span>
                </Button>
              ) : isEligible ? (
                <Button size="sm" variant="secondary" onClick={() => setShowProposeModal(true)} className="text-xs flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Đề xuất đề tài mới</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled
                  className="text-xs opacity-60 cursor-not-allowed border-dashed bg-slate-100 text-slate-400 flex items-center gap-1.5"
                  title="Chức năng đề xuất đề tài đã bị khóa do bạn chưa đủ điều kiện KLTN"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Đề xuất đề tài (Đã khóa)</span>
                </Button>
              )}
            </div>
          </div>

          {/* Official Group & Topic Notice for Students */}
          {hasActiveRegistration && (
            <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 flex items-start gap-3 text-emerald-900 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                  <span>Bạn đã có nhóm & đề tài KLTN chính thức</span>
                  <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded font-semibold text-[10px]">
                    {myGroup?.code ? `Nhóm ${myGroup.code}` : 'Đã xác nhận đề tài'}
                  </span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  Theo quy chế KLTN, mỗi sinh viên chỉ được tham gia <strong>01 đề tài chính thức</strong>. Nút đăng ký trên các đề tài khác đã được chuyển sang trạng thái <strong>&quot;Đã có đề tài&quot; (vô hiệu hóa)</strong>. Bạn có thể theo dõi tiến độ nộp bài, trao đổi với nhóm &amp; GVHD tại mục Tiến độ &amp; Thảo luận.
                </p>
              </div>
            </div>
          )}

          {/* Phase 1 Informational Notice for Students */}
          {!topicsMeta?.registrationOpen && (topicsMeta?.lecturerTopicOpen || (topicsMeta?.registrationFrom && new Date() < new Date(topicsMeta.registrationFrom))) && (
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-xs animate-in fade-in">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                  <span>Học kỳ đang trong Giai đoạn 1: Giảng viên đăng ký đề tài</span>
                  <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded font-semibold text-[10px]">Chờ duyệt & mở cổng SV</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Hiện tại các Giảng viên đang gửi danh mục đề tài lên Trưởng bộ môn thẩm định và phê duyệt.
                  {topicsMeta?.registrationFrom ? (
                    <> Cổng đăng ký nguyện vọng cho Sinh viên sẽ chính thức mở vào ngày <strong>{new Date(topicsMeta.registrationFrom).toLocaleDateString('vi-VN')}</strong>.</>
                  ) : (
                    <> Cổng đăng ký nguyện vọng cho Sinh viên sẽ sớm được mở sau khi hoàn tất duyệt đề tài.</>
                  )}
                  {' '}Sinh viên chỉ được đăng ký vào các đề tài đã được Trưởng bộ môn phê duyệt chính thức (APPROVED).
                </p>
              </div>
            </div>
          )}

          {/* Main Content: Filter Sidebar + Topic List */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter Sidebar */}
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <span>Bộ lọc tìm kiếm</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTopic('');
                      setFilterOnlyHasSlot(true);
                      setFilterLecturerId('');
                      setFilterDepartment('');
                      setTopicsPage(1);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-medium cursor-pointer"
                  >
                    Đặt lại
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* 1. Keyword search */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1.5">Từ khóa tìm kiếm</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tên đề tài, công nghệ..."
                      value={searchTopic}
                      onChange={(e) => setSearchTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setTopicsPage(1);
                          fetchTopics(1);
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* 2. Slot availability toggle */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterOnlyHasSlot}
                      onChange={(e) => {
                        setFilterOnlyHasSlot(e.target.checked);
                        setTopicsPage(1);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block text-xs">Chỉ hiện đề tài còn chỗ</span>
                      <span className="text-[11px] text-slate-500 block">Đã duyệt & chưa đủ số lượng</span>
                    </div>
                  </label>
                </div>

                {/* 3. Lecturer filter */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="font-semibold text-slate-700 block mb-1.5">Giảng viên hướng dẫn</label>
                  <select
                    value={filterLecturerId}
                    onChange={(e) => {
                      setFilterLecturerId(e.target.value);
                      setTopicsPage(1);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-700"
                  >
                    <option value="">Tất cả giảng viên</option>
                    {Array.from(
                      new Map(
                        lecturersList
                          .filter((lec: any) => {
                            const email = lec.user?.email || lec.email || '';
                            return (
                              !/\d{10,}@kltn\.edu\.vn/.test(email) &&
                              !email.includes('_score_') &&
                              !email.includes('_unlock_') &&
                              !email.startsWith('gv_b_') &&
                              !email.startsWith('gv_a_') &&
                              !email.startsWith('test_')
                            );
                          })
                          .map((lec: any) => [lec.user?.email || lec.email || lec.id, lec])
                      ).values()
                    ).map((lec: any) => {
                      const name = formatLecturerName(lec.title || lec.lecturerProfile?.title, lec.user?.fullName || lec.fullName || 'Giảng viên');
                      return (
                        <option key={lec.userId || lec.id} value={lec.userId || lec.user?.id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Search action button */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setTopicsPage(1);
                      fetchTopics(1);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Áp dụng bộ lọc</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Topic List / Table (col-span-3) */}
            <div className="lg:col-span-3 space-y-4">
              {loadingTopics ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-medium text-slate-600">Đang tải danh sách đề tài...</p>
                </div>
              ) : topics.length === 0 ? (
                /* Empty state */
                <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="font-bold text-slate-800 text-base">Không tìm thấy đề tài phù hợp</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {topicsMeta?.message || 'Không có đề tài nào thỏa mãn các tiêu chí lọc hiện tại. Vui lòng thử nới lỏng từ khóa hoặc bỏ chọn bộ lọc.'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchTopic('');
                      setFilterOnlyHasSlot(false);
                      setFilterLecturerId('');
                      setFilterDepartment('');
                      setTopicsPage(1);
                    }}
                    className="text-xs"
                  >
                    Xóa bộ lọc & Tải lại
                  </Button>
                </div>
              ) : viewMode === 'cards' ? (
                /* Cards Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topics.map((topic: any) => {
                    const isApproved = topic.status === 'APPROVED' || topic.trangThai === 'APPROVED';
                    const registeredCount = topic.soLuongDaDangKy ?? (topic.registrations?.length || 0);
                    const capacity = topic.soLuongToiDa ?? topic.capacity ?? 2;
                    const availableSlots = topic.soChoConLai !== undefined ? topic.soChoConLai : Math.max(0, capacity - registeredCount);
                    const isFull = availableSlots <= 0;
                    const alreadyRegistered =
                      Boolean(topic.daDangKy) ||
                      (officialTopicId && topic.id === officialTopicId) ||
                      (myGroup && (myGroup.topicId === topic.id || myGroup.topic?.id === topic.id)) ||
                      myGroups.some((g: any) => g.status !== 'CANCELLED' && (g.topicId === topic.id || g.topic?.id === topic.id)) ||
                      registrations.some((r: any) => r.topicId === topic.id && ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'].includes(r.status));
                    const gvhdName = topic.gvhd?.hoTen || topic.owner?.fullName || 'Giảng viên';

                    return (
                      <Card key={topic.id} className="flex flex-col justify-between hover:shadow-md transition-all border-slate-200/90">
                        <div className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={isApproved ? 'success' : 'warning'}>
                                {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                              </Badge>
                              {alreadyRegistered ? (
                                <Badge variant="primary">Đã đăng ký</Badge>
                              ) : isFull ? (
                                <Badge variant="danger">Hết chỗ</Badge>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Còn {availableSlots} chỗ
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                              {registeredCount}/{capacity} SV
                            </span>
                          </div>

                          <h4
                            onClick={() => {
                              setSelectedTopicDetail(topic);
                              setShowDetailModal(true);
                            }}
                            className="text-base font-bold text-slate-900 line-clamp-2 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Bấm để xem chi tiết đề tài"
                          >
                            {topic.tenDeTai || topic.title}
                          </h4>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {topic.moTa || topic.summary || 'Chưa có mô tả chi tiết cho đề tài này.'}
                          </p>

                          {/* Technologies */}
                          {(topic.congNghe || topic.technologies) && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {(topic.congNghe || topic.technologies).split(/[,;]/).slice(0, 3).map((tech: string, i: number) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  {tech.trim()}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Lecturer line */}
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1.5 truncate">
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate font-semibold text-slate-800">{gvhdName}</span>
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {topic.boMon?.ma || topic.department?.code || 'IS'}
                            </span>
                          </div>
                        </div>

                        {/* Card footer actions */}
                        <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTopicDetail(topic);
                                setShowDetailModal(true);
                              }}
                              className="text-xs flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Chi tiết</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openTopicRegistrationsModal(topic)}
                              className="text-xs flex items-center gap-1 text-slate-700 hover:text-indigo-600"
                              title="Xem danh sách sinh viên đăng ký & chọn nhóm"
                            >
                              <Users className="w-3.5 h-3.5 text-indigo-600" />
                              <span>SV đăng ký ({registeredCount})</span>
                            </Button>
                          </div>

                          {alreadyRegistered ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                Đã xác nhận
                              </span>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => openTopicRegistrationsModal(topic)}
                                className="text-xs flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                <Users className="w-3 h-3" />
                                <span>{studentHasGroup ? 'Xem nhóm' : 'Chọn nhóm'}</span>
                              </Button>
                            </div>
                          ) : hasActiveRegistration ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled
                              className="text-xs opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border border-slate-200"
                              title={
                                studentHasGroup
                                  ? 'Bạn đã thuộc một nhóm KLTN chính thức'
                                  : 'Bạn đã có đề tài chính thức'
                              }
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1 text-slate-400" />
                              Đã có đề tài
                            </Button>
                          ) : isFull ? (
                            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                              Đã đủ số lượng
                            </span>
                          ) : !topicsMeta?.registrationOpen ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled
                              className="text-xs opacity-80 cursor-not-allowed bg-amber-100/70 text-amber-800 border border-amber-200"
                              title="Chưa đến đợt sinh viên đăng ký đề tài"
                            >
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              Chờ mở cổng SV
                            </Button>
                          ) : isEligible ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenRegisterModal(topic)}
                              className="text-xs"
                            >
                              Đăng ký đề tài
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled
                              className="text-xs opacity-60 cursor-not-allowed bg-slate-200/80 text-slate-500"
                              title="Bạn chưa đủ điều kiện đăng ký KLTN"
                            >
                              <Lock className="w-3 h-3 mr-1 text-slate-400" />
                              Khóa ĐK
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-3 px-3 w-12 text-center">STT</th>
                          <th className="py-3 px-4">Tên đề tài KLTN</th>
                          <th className="py-3 px-4">Giảng viên hướng dẫn</th>
                          <th className="py-3 px-3">Công nghệ</th>
                          <th className="py-3 px-3 text-center">Số chỗ</th>
                          <th className="py-3 px-3 text-center">Trạng thái</th>
                          <th className="py-3 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topics.map((topic: any, idx: number) => {
                          const isApproved = topic.status === 'APPROVED' || topic.trangThai === 'APPROVED';
                          const registeredCount = topic.soLuongDaDangKy ?? (topic.registrations?.length || 0);
                          const capacity = topic.soLuongToiDa ?? topic.capacity ?? 2;
                          const availableSlots = topic.soChoConLai !== undefined ? topic.soChoConLai : Math.max(0, capacity - registeredCount);
                          const isFull = availableSlots <= 0;
                          const alreadyRegistered =
                            Boolean(topic.daDangKy) ||
                            (officialTopicId && topic.id === officialTopicId) ||
                            (myGroup && (myGroup.topicId === topic.id || myGroup.topic?.id === topic.id)) ||
                            myGroups.some((g: any) => g.status !== 'CANCELLED' && (g.topicId === topic.id || g.topic?.id === topic.id)) ||
                            registrations.some((r: any) => r.topicId === topic.id && ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'].includes(r.status));
                          const gvhdName = topic.gvhd?.hoTen || topic.owner?.fullName || 'Giảng viên';

                          return (
                            <tr key={topic.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400">
                                {(topicsPage - 1) * topicsLimit + idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div
                                  onClick={() => {
                                    setSelectedTopicDetail(topic);
                                    setShowDetailModal(true);
                                  }}
                                  className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer line-clamp-2"
                                  title="Bấm để xem chi tiết"
                                >
                                  {topic.tenDeTai || topic.title}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {topic.boMon?.ten || topic.department?.name || 'Khoa Công nghệ Thông tin'}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">{gvhdName}</div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                                  {topic.gvhd?.email || topic.owner?.email}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-slate-600 truncate max-w-[120px] block" title={topic.congNghe || topic.technologies}>
                                  {topic.congNghe || topic.technologies || 'Tùy chọn'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="font-semibold text-slate-800">{registeredCount}/{capacity}</span>
                                {isFull ? (
                                  <span className="block text-[10px] text-rose-600 font-bold">Hết chỗ</span>
                                ) : (
                                  <span className="block text-[10px] text-emerald-600 font-bold">Còn {availableSlots}</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge variant={isApproved ? 'success' : 'warning'}>
                                  {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTopicDetail(topic);
                                      setShowDetailModal(true);
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer"
                                    title="Xem chi tiết"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openTopicRegistrationsModal(topic)}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer"
                                    title={`Xem danh sách ${registeredCount} sinh viên đã đăng ký & chọn nhóm`}
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                  </button>

                                  {alreadyRegistered ? (
                                    <button
                                      type="button"
                                      onClick={() => openTopicRegistrationsModal(topic)}
                                      className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                      title="Bấm để xem nhóm / chọn nhóm"
                                    >
                                      {studentHasGroup ? 'Xem nhóm' : 'Chọn nhóm'}
                                    </button>
                                  ) : hasActiveRegistration ? (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled
                                      className="text-[10px] px-2 py-1 opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border border-slate-200"
                                      title={
                                        studentHasGroup
                                          ? 'Bạn đã thuộc một nhóm KLTN chính thức'
                                          : 'Bạn đã có đề tài chính thức'
                                      }
                                    >
                                      Đã có đề tài
                                    </Button>
                                  ) : isFull ? (
                                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                      Đủ SV
                                    </span>
                                  ) : !topicsMeta?.registrationOpen ? (
                                    <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium flex items-center gap-1" title="Chưa đến đợt SV đăng ký">
                                      <Clock className="w-2.5 h-2.5 text-amber-600" /> Chờ mở
                                    </span>
                                  ) : isEligible ? (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => handleOpenRegisterModal(topic)}
                                      className="text-xs px-2.5 py-1"
                                    >
                                      Đăng ký
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                      <Lock className="w-3 h-3" /> Khóa
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              {topics.length > 0 && (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500">
                    Hiển thị <span className="font-semibold text-slate-800">{(topicsPage - 1) * topicsLimit + 1}</span> -{' '}
                    <span className="font-semibold text-slate-800">
                      {Math.min(topicsPage * topicsLimit, topicsMeta?.total || topics.length)}
                    </span>{' '}
                    của <span className="font-semibold text-slate-800">{topicsMeta?.total || topics.length}</span> đề tài
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-slate-500">Hiển thị:</span>
                      <select
                        value={topicsLimit}
                        onChange={(e) => {
                          setTopicsLimit(Number(e.target.value));
                          setTopicsPage(1);
                        }}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold focus:outline-none"
                      >
                        <option value={6}>6 đề tài</option>
                        <option value={12}>12 đề tài</option>
                        <option value={24}>24 đề tài</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={topicsPage <= 1}
                        onClick={() => setTopicsPage((p) => Math.max(1, p - 1))}
                        className={`p-1.5 rounded-lg border border-slate-200 ${
                          topicsPage <= 1 ? 'opacity-40 cursor-not-allowed text-slate-400' : 'hover:bg-slate-50 text-slate-700 cursor-pointer'
                        }`}
                        title="Trang trước"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <span className="px-3 py-1 font-bold text-slate-700 bg-slate-100 rounded-lg">
                        {topicsPage} / {topicsMeta?.totalPages || 1}
                      </span>

                      <button
                        type="button"
                        disabled={topicsPage >= (topicsMeta?.totalPages || 1)}
                        onClick={() => setTopicsPage((p) => Math.min(topicsMeta?.totalPages || 1, p + 1))}
                        className={`p-1.5 rounded-lg border border-slate-200 ${
                          topicsPage >= (topicsMeta?.totalPages || 1)
                            ? 'opacity-40 cursor-not-allowed text-slate-400'
                            : 'hover:bg-slate-50 text-slate-700 cursor-pointer'
                        }`}
                        title="Trang sau"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Xem chi tiết Đề tài */}
          {showDetailModal && selectedTopicDetail && (
            <Modal
              isOpen={showDetailModal}
              maxWidth="xl"
              title="Thông tin chi tiết Đề tài Khóa luận Tốt nghiệp"
              onClose={() => {
                setShowDetailModal(false);
                setSelectedTopicDetail(null);
              }}
            >
              <div className="space-y-4 text-xs">
                {/* Topic Header */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedTopicDetail.status === 'APPROVED' || selectedTopicDetail.trangThai === 'APPROVED' ? 'success' : 'warning'}>
                      {selectedTopicDetail.status === 'APPROVED' || selectedTopicDetail.trangThai === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}
                    </Badge>
                    <span className="px-2.5 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {selectedTopicDetail.boMon?.ten || selectedTopicDetail.department?.name || 'Khoa Công nghệ Thông tin'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      Học kỳ: {selectedTopicDetail.hocKy?.ten || selectedTopicDetail.semester?.name || '2026-KLTN-1'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {selectedTopicDetail.tenDeTai || selectedTopicDetail.title}
                  </h3>
                </div>

                {/* Summary / Description */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">1. Tóm tắt & Mô tả đề tài</h4>
                  <p className="text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTopicDetail.moTa || selectedTopicDetail.summary || 'Chưa có mô tả chi tiết cho đề tài này.'}
                  </p>
                </div>

                {/* Objectives */}
                {(selectedTopicDetail.mucTieu || selectedTopicDetail.objectives) && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">2. Mục tiêu nghiên cứu</h4>
                    <p className="text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-wrap">
                      {selectedTopicDetail.mucTieu || selectedTopicDetail.objectives}
                    </p>
                  </div>
                )}

                {/* Requirements */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">3. Yêu cầu đối với sinh viên</h4>
                  <p className="text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {selectedTopicDetail.yeuCau || 'Sinh viên có tinh thần tự học, nắm vững kiến thức chuyên ngành và hoàn thành đúng tiến độ hướng dẫn.'}
                  </p>
                </div>

                {/* Technologies */}
                {(selectedTopicDetail.congNghe || selectedTopicDetail.technologies) && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">4. Công nghệ & Kỹ thuật áp dụng</h4>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-white border border-slate-200">
                      {(selectedTopicDetail.congNghe || selectedTopicDetail.technologies).split(/[,;]/).map((tech: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {tech.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supervisor Info */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">5. Giảng viên hướng dẫn (GVHD)</h4>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">
                          {selectedTopicDetail.gvhd?.hoTen || selectedTopicDetail.owner?.fullName || 'Giảng viên'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {selectedTopicDetail.gvhd?.hocHamHocVi || 'Giảng viên'} • Khoa Công nghệ Thông tin
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5 sm:text-right">
                      <div>Email: <a href={`mailto:${selectedTopicDetail.gvhd?.email || selectedTopicDetail.owner?.email}`} className="text-indigo-600 hover:underline">{selectedTopicDetail.gvhd?.email || selectedTopicDetail.owner?.email}</a></div>
                    </div>
                  </div>
                </div>

                {/* Slot quota */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Chỉ tiêu đề tài:</span>
                  <div className="flex items-center gap-3">
                    <span>Tối đa: <b>{selectedTopicDetail.soLuongToiDa ?? selectedTopicDetail.capacity} sinh viên</b></span>
                    <span>•</span>
                    <span>Đã ĐK: <b>{selectedTopicDetail.soLuongDaDangKy ?? (selectedTopicDetail.registrations?.length || 0)}</b></span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">
                      Còn lại: {selectedTopicDetail.soChoConLai !== undefined ? selectedTopicDetail.soChoConLai : Math.max(0, (selectedTopicDetail.soLuongToiDa ?? selectedTopicDetail.capacity) - (selectedTopicDetail.soLuongDaDangKy || 0))} chỗ
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                {(() => {
                  const isDetailMyTopic =
                    (officialTopicId && selectedTopicDetail.id === officialTopicId) ||
                    Boolean(selectedTopicDetail.daDangKy) ||
                    (myGroup && (myGroup.topicId === selectedTopicDetail.id || myGroup.topic?.id === selectedTopicDetail.id)) ||
                    myGroups.some((g: any) => g.status !== 'CANCELLED' && (g.topicId === selectedTopicDetail.id || g.topic?.id === selectedTopicDetail.id)) ||
                    registrations.some((r: any) => r.topicId === selectedTopicDetail.id && ['APPROVED', 'CHO_XAC_NHAN', 'PENDING'].includes(r.status));
                  const detailRegisteredCount = selectedTopicDetail.soLuongDaDangKy ?? (selectedTopicDetail.registrations?.length || 0);
                  const detailCapacity = selectedTopicDetail.soLuongToiDa ?? selectedTopicDetail.capacity ?? 2;
                  const detailAvailableSlots = selectedTopicDetail.soChoConLai !== undefined ? selectedTopicDetail.soChoConLai : Math.max(0, detailCapacity - detailRegisteredCount);
                  const isDetailFull = detailAvailableSlots <= 0;

                  return (
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const target = selectedTopicDetail;
                          setShowDetailModal(false);
                          openTopicRegistrationsModal(target);
                        }}
                        className="flex items-center gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Xem danh sách SV đã ĐK ({detailRegisteredCount})</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDetailModal(false);
                          setSelectedTopicDetail(null);
                        }}
                      >
                        Đóng
                      </Button>

                      {isDetailMyTopic ? (
                        <Button
                          variant="primary"
                          onClick={() => {
                            const target = selectedTopicDetail;
                            setShowDetailModal(false);
                            openTopicRegistrationsModal(target);
                          }}
                          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{studentHasGroup ? 'Xem thông tin nhóm' : 'Đã xác nhận (Chọn nhóm)'}</span>
                        </Button>
                      ) : hasActiveRegistration ? (
                        <Button
                          variant="secondary"
                          disabled
                          className="text-xs opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border border-slate-200"
                          title={
                            studentHasGroup
                              ? 'Bạn đã thuộc một nhóm KLTN chính thức'
                              : 'Bạn đã có đề tài chính thức'
                          }
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          Đã có đề tài
                        </Button>
                      ) : !topicsMeta?.registrationOpen ? (
                        <Button variant="secondary" disabled className="opacity-80 cursor-not-allowed bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                          Chờ mở cổng đăng ký SV
                        </Button>
                      ) : isDetailFull ? (
                        <Button variant="secondary" disabled className="opacity-60 cursor-not-allowed bg-slate-100 text-slate-400">
                          Đề tài đã đủ số lượng
                        </Button>
                      ) : isEligible ? (
                        <Button
                          variant="primary"
                          onClick={() => {
                            const target = selectedTopicDetail;
                            setShowDetailModal(false);
                            handleOpenRegisterModal(target);
                          }}
                        >
                          Đăng ký đề tài này
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled className="opacity-60 cursor-not-allowed">
                          <Lock className="w-3.5 h-3.5 mr-1" />
                          Khóa đăng ký
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Tab 3: My Registrations */}
      {activeTab === 'my-reg' && (
        <div className="space-y-6">
          {/* Card 1: Official Registrations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Lịch sử đăng ký đề tài chính thức
              </h3>
              <Badge variant="neutral">{registrations.length} đơn</Badge>
            </CardHeader>
            <CardContent>
              <div className="mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Quy chế KLTN:</strong> Sinh viên không được chuyển nhóm trong suốt quá trình thực hiện đề tài và chỉ có thể hủy đề tài đã đăng ký ở tuần 1 - 3. Sau tuần 3 không thể hủy đề tài đã đăng ký.
                </span>
              </div>
              {registrations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Bạn chưa đăng ký đề tài nào trong đợt này. Hãy chuyển sang mục Đề tài để đăng ký.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {registrations.map((item) => (
                    <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                              item.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'CHO_XAC_NHAN'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : item.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : item.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.status === 'DA_HUY' || item.status === 'CANCELLED' || item.status === 'WITHDRAWN'
                                ? 'bg-rose-50 text-rose-600 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {item.status === 'CHO_XAC_NHAN'
                              ? 'Chờ GV xác nhận'
                              : item.status === 'PENDING'
                              ? 'Chờ hội đồng duyệt'
                              : item.status === 'APPROVED'
                              ? 'Đã xác nhận'
                              : item.status === 'REJECTED'
                              ? 'Bị từ chối'
                              : item.status === 'DA_HUY' || item.status === 'CANCELLED' || item.status === 'WITHDRAWN'
                              ? 'Đã hủy / rút'
                              : item.status}
                          </span>
                          <span className="text-xs text-slate-400">
                            Ngày nộp: {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {item.topic?.title ?? item.proposal ?? 'Đề tài Khóa luận'}
                        </h4>
                        {item.topic?.owner && (
                          <div className="text-xs text-slate-500">
                            GVHD: <span className="font-medium text-slate-700">{item.topic.owner.fullName}</span> ({item.topic.owner.email})
                          </div>
                        )}
                        {item.decisionNote && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            Ghi chú từ hội đồng/GVHD: {item.decisionNote}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
                        {item.topic && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => openTopicRegistrationsModal(item.topic)}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Xem SV cùng ĐK & Chọn nhóm</span>
                          </Button>
                        )}
                        {['CHO_XAC_NHAN', 'PENDING', 'APPROVED'].includes(item.status) && (
                          (item.canCancel ?? (topicsMeta?.registrationOpen && (item.isWeek1To3 ?? true))) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs flex items-center gap-1 font-medium"
                              onClick={() => handleWithdrawRegistration(item.id)}
                              title="Hủy đề tài đã đăng ký (khả dụng trong tuần 1 - 3)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hủy đề tài đã đăng ký
                            </Button>
                          ) : (
                            <span
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1 font-medium"
                              title="Theo quy chế KLTN, sau tuần 3 không thể hủy đề tài đã đăng ký"
                            >
                              <Clock className="w-3 h-3 text-slate-400" />
                              Sau tuần 3: Không thể hủy đề tài
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Student Topic Proposals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Đề xuất đề tài riêng (Gửi Giảng viên hướng dẫn)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các đề tài do bạn tự liên hệ và gửi GVHD xem xét trước khi đưa vào quy trình chính thức
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowProposeModal(true)} className="text-xs flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Đề xuất đề tài mới
              </Button>
            </CardHeader>
            <CardContent>
              {myProposals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  Bạn chưa gửi đề xuất đề tài nào cho Giảng viên. Nếu bạn đã thảo luận trước một ý tưởng đề tài với GVHD, hãy nhấn "Đề xuất đề tài mới".
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myProposals.map((prop) => (
                    <div key={prop.id} className="py-4 space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              prop.status === 'GV_DA_DUYET'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : prop.status === 'TU_CHOI'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {prop.status === 'GV_DA_DUYET'
                              ? 'GV đã chấp thuận'
                              : prop.status === 'TU_CHOI'
                              ? 'GV từ chối'
                              : 'Chờ GV xác nhận (CHO_GV_XAC_NHAN)'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(prop.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {prop.lecturer?.user && (
                          <div className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                            GVHD mong muốn: <b className="text-slate-800">{prop.lecturer.user.fullName}</b> ({prop.lecturer.user.email})
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{prop.tenDeTai}</h4>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-700">Mô tả tóm tắt: </span>
                          <span>{prop.moTa}</span>
                        </div>
                        {prop.yeuCau && (
                          <div>
                            <span className="font-semibold text-slate-700">Yêu cầu / Công nghệ: </span>
                            <span>{prop.yeuCau}</span>
                          </div>
                        )}
                      </div>

                      {prop.rejectionReason && (
                        <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg text-xs border border-rose-200">
                          <b>Lý do GV từ chối:</b> {prop.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Progress Milestones & Submissions */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          {/* 1. BADGES CẢNH BÁO (ALERTS) */}
          {progressData?.alerts && progressData.alerts.length > 0 && (
            <div className="space-y-3">
              {progressData.alerts.map((alert: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium ${
                    alert.type === 'danger'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : alert.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {alert.type === 'danger' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    ) : alert.type === 'warning' ? (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    <span>{alert.message}</span>
                  </div>
                  <Badge
                    variant={alert.type === 'danger' ? 'danger' : alert.type === 'warning' ? 'warning' : 'success'}
                    size="sm"
                  >
                    {alert.type === 'danger' ? 'Quá hạn' : alert.type === 'warning' ? 'Sắp đến hạn' : 'Đúng hạn'}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* 2. PROGRESS BAR & OVERALL STATUS */}
          <Card className="overflow-hidden border-indigo-100 shadow-sm">
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 p-6 text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                      Tiến độ thực hiện KLTN
                    </span>
                    <span className="text-xs text-indigo-200">
                      Học kỳ: {progressData?.semester?.name || 'Hiện tại'}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black mt-2 tracking-tight">
                    {progressData?.topic?.title || 'Đề tài Khóa luận Tốt nghiệp'}
                  </h2>
                  <p className="text-xs md:text-sm text-indigo-100/90 mt-1 flex items-center gap-2">
                    <span>Giai đoạn hiện tại:</span>
                    <span className="font-bold underline decoration-amber-400 decoration-2">
                      {progressData?.currentStage || 'Bắt đầu nghiên cứu đề tài'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-xs">
                  <div className="text-right">
                    <div className="text-xs text-indigo-200 uppercase font-semibold">Tỷ lệ hoàn thành</div>
                    <div className="text-3xl font-black text-white">{progressData?.percentComplete ?? 0}%</div>
                  </div>
                  <div className="w-14 h-14 rounded-full border-4 border-white/30 border-t-amber-400 flex items-center justify-center font-bold text-base text-white">
                    {progressData?.percentComplete ?? 0}%
                  </div>
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="mt-6">
                <div className="w-full bg-black/25 rounded-full h-3.5 p-0.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.max(5, progressData?.percentComplete ?? 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-indigo-200 mt-1.5 font-medium">
                  <span>0% Đăng ký</span>
                  <span>40% Giữa kỳ</span>
                  <span>70% Báo cáo cuối</span>
                  <span>85% Phản biện</span>
                  <span>100% Hoàn thành</span>
                </div>
              </div>
            </div>
          </Card>

          {/* LỘ TRÌNH 5 GIAI ĐOẠN ĐỒNG BỘ TOÀN DIỆN VỚI BỘ MÔN */}
          {progressData?.semester && (
            <WelcomeTimeline
              currentStep={progressData?.semester?.currentStep ?? progressData?.semester?.semesterStep ?? 1}
              semesterInfo={progressData?.semester}
              isCompleted={progressData?.semester?.status === 'ARCHIVED' || progressData?.semester?.status === 'CLOSED'}
              role="SINH_VIEN"
              onNavigate={(tab) => {
                setActiveTab(tab);
                if (tab === 'kltn-profile') loadKltnProfile();
              }}
              canManageTimeline={false}
            />
          )}

          {/* 3. TIMELINE / GANTT CHART ĐƠN GIẢN (5 MỐC QUAN TRỌNG) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  5 Mốc Deadline nộp bài & Thẩm định KLTN
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi trạng thái các mốc nộp bài và thẩm định từ Giữa kỳ đến Bảo vệ chính thức (Đồng bộ theo giai đoạn đợt KLTN)
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={loadProgress} className="flex items-center gap-1.5 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProgress ? 'animate-spin' : ''}`} />
                Làm mới tiến độ
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Timeline Container */}
              <div className="relative">
                {/* Horizontal Step Indicator (Desktop) */}
                <div className="hidden md:grid grid-cols-5 gap-3 mb-8">
                  {(progressData?.deadlines || []).map((dl: any, index: number) => {
                    const isDone = dl.status === 'HOAN_THANH';
                    const isOverdue = dl.status === 'QUA_HAN';
                    const isInProgress = dl.status === 'DANG_THUC_HIEN';

                    return (
                      <div
                        key={dl.id || index}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isDone
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : isOverdue
                            ? 'bg-rose-50/80 border-rose-300 text-rose-900 ring-2 ring-rose-200'
                            : isInProgress
                            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 ring-2 ring-indigo-200'
                            : 'bg-slate-50 border-slate-200 text-slate-600 opacity-70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isDone
                                  ? 'bg-emerald-600 text-white'
                                  : isOverdue
                                  ? 'bg-rose-600 text-white'
                                  : isInProgress
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-300 text-slate-700'
                              }`}
                            >
                              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                            </span>
                            <Badge
                              size="sm"
                              variant={isDone ? 'success' : isOverdue ? 'danger' : isInProgress ? 'primary' : 'neutral'}
                            >
                              {isDone
                                ? 'Hoàn thành'
                                : isOverdue
                                ? 'Quá hạn'
                                : isInProgress
                                ? 'Đang thực hiện'
                                : 'Chưa bắt đầu'}
                            </Badge>
                          </div>
                          <h4 className="text-xs font-bold line-clamp-2">{dl.title}</h4>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] space-y-0.5">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Hạn:</span>
                            <span className="font-semibold text-slate-700">
                              {dl.dueDate && new Date(dl.dueDate).getFullYear() > 1970
                                ? new Date(dl.dueDate).toLocaleDateString('vi-VN')
                                : 'Chưa định'}
                            </span>
                          </div>
                          {dl.daysRemaining !== null && !isDone && (
                            <div
                              className={`font-semibold ${
                                isOverdue
                                  ? 'text-rose-600'
                                  : dl.daysRemaining <= 5
                                  ? 'text-amber-600'
                                  : 'text-indigo-600'
                              }`}
                            >
                              {isOverdue
                                ? `Trễ ${Math.abs(dl.daysRemaining)} ngày`
                                : dl.daysRemaining === 0
                                ? 'Hạn hôm nay!'
                                : `Còn ${dl.daysRemaining} ngày`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vertical Detailed Timeline */}
                <div className="space-y-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Chi tiết tiến trình từng mốc
                  </div>
                  {(progressData?.deadlines || []).map((dl: any, idx: number) => {
                    const isDone = dl.status === 'HOAN_THANH';
                    const isOverdue = dl.status === 'QUA_HAN';
                    const isInProgress = dl.status === 'DANG_THUC_HIEN';

                    return (
                      <div
                        key={dl.id || idx}
                        className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-all"
                      >
                        <div className="mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : isOverdue ? (
                            <AlertTriangle className="w-5 h-5 text-rose-600" />
                          ) : isInProgress ? (
                            <Clock className="w-5 h-5 text-indigo-600 animate-pulse" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>
                                {idx + 1}. {dl.title}
                              </span>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                                  isDone
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isOverdue
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : isInProgress
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isDone
                                  ? 'HOÀN THÀNH'
                                  : dl.midtermStatus === 'STOPPED'
                                  ? 'DỪNG ĐỀ TÀI GK'
                                  : isOverdue
                                  ? 'QUÁ HẠN'
                                  : isInProgress
                                  ? 'ĐANG THỰC HIỆN'
                                  : dl.lockedByMidterm
                                  ? 'CHỜ QUA GIỮA KỲ'
                                  : 'CHƯA BẮT ĐẦU'}
                              </span>
                            </h4>

                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span>Hạn chót:</span>
                              <span className="font-bold text-slate-800">
                                {dl.dueDate && new Date(dl.dueDate).getFullYear() > 1970
                                  ? new Date(dl.dueDate).toLocaleDateString('vi-VN')
                                  : 'Đang cập nhật'}
                              </span>
                              {dl.daysRemaining !== null && !isDone && (
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                                    isOverdue
                                      ? 'bg-rose-100 text-rose-800'
                                      : dl.daysRemaining <= 5
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-indigo-50 text-indigo-700'
                                  }`}
                                >
                                  {isOverdue
                                    ? `Quá hạn ${Math.abs(dl.daysRemaining)} ngày`
                                    : `Còn ${dl.daysRemaining} ngày`}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{dl.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3B. LỊCH SỬ THAY ĐỔI TIẾN ĐỘ (PROGRESS HISTORY) */}
          {progressData?.progressHistory && progressData.progressHistory.length > 0 && (
            <Card>
              <CardHeader className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Lịch sử thay đổi tiến độ & Nhật ký KLTN ({progressData.progressHistory.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi toàn bộ lịch sử đăng ký, nộp bài, phản hồi của GVHD, đánh giá / xử lý lại giữa kỳ và lịch bảo vệ
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {progressData.progressHistory.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{item.title}</span>
                          {item.status && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.status === 'CONTINUE' || item.status === 'APPROVED' || item.status === 'ACCEPTED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.status === 'STOPPED' || item.status === 'REVISION_REQUIRED'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600">{item.description}</p>
                        {item.actor && (
                          <div className="text-[11px] text-slate-400">Thực hiện bởi: {item.actor}</div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                        {new Date(item.timestamp).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. KHU VỰC NỘP TÀI LIỆU / BÁO CÁO / MÃ NGUỒN / LINK & LỊCH SỬ NỘP */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột trái (2 cột): Form Nộp bài Đa định dạng + Upload Zone Drag & Drop */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-indigo-600" />
                    Nộp Báo cáo / Tài liệu / Mã nguồn / Link Demo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hỗ trợ tải tệp Word, PDF, ZIP, RAR, bản vẽ (tối đa 50MB) hoặc đính kèm link GitHub, Google Drive, Demo
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMultiTypeSubmit} className="space-y-4 text-sm">
                    {/* Chọn loại bài nộp */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Loại tài liệu nộp <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'BAO_CAO_TIEN_DO', label: 'Báo cáo tiến độ', requiresMidterm: false },
                          { id: 'BAO_CAO_GIUA_KY', label: 'Báo cáo giữa kỳ', requiresMidterm: false },
                          { id: 'BAO_CAO_CUOI_KY', label: 'Báo cáo cuối kỳ', requiresMidterm: true },
                          { id: 'MA_NGUON', label: 'Mã nguồn (Source code)', requiresMidterm: true },
                          { id: 'TAI_LIEU', label: 'Tài liệu / Bản vẽ', requiresMidterm: false },
                          { id: 'LINK_DEMO', label: 'Link Demo / Video', requiresMidterm: false },
                        ].map((t) => {
                          const isLockedByMidterm =
                            myGroup?.midtermStatus === 'STOPPED' ||
                            (t.requiresMidterm && myGroup?.midtermStatus !== 'CONTINUE');
                          return (
                            <button
                              type="button"
                              key={t.id}
                              disabled={isLockedByMidterm}
                              onClick={() => {
                                if (!isLockedByMidterm) setSubmitType(t.id);
                              }}
                              title={
                                isLockedByMidterm
                                  ? 'Cần GVHD xác nhận qua giữa kỳ (CHO LÀM TIẾP) trước khi nộp Báo cáo cuối kỳ'
                                  : t.label
                              }
                              className={`px-3 py-2 text-xs font-semibold rounded-xl border text-left transition-all ${
                                isLockedByMidterm
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                                  : submitType === t.id
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs ring-1 ring-indigo-500 cursor-pointer'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                              }`}
                            >
                              {t.label}
                              {isLockedByMidterm && t.requiresMidterm && (
                                <span className="block text-[10px] font-normal text-amber-700 mt-0.5">
                                  (Chờ xác nhận qua GK)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Drag & Drop Upload Zone */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Tải tệp đính kèm (Word, PDF, ZIP, RAR, sơ đồ - Tối đa 50MB)
                      </label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            if (file.size > 50 * 1024 * 1024) {
                              return notify('Tệp vượt quá kích thước tối đa 50MB', 'error');
                            }
                            setSubmitFile(file);
                          }
                        }}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                          isDragging
                            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                            : submitFile
                            ? 'border-emerald-300 bg-emerald-50/30'
                            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60'
                        }`}
                        onClick={() => document.getElementById('file-upload-input')?.click()}
                      >
                        <input
                          id="file-upload-input"
                          type="file"
                          accept=".pdf,.docx,.doc,.zip,.rar,.7z,.pptx,.png,.jpg,.drawio,.txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 50 * 1024 * 1024) {
                                return notify('Tệp vượt quá dung lượng tối đa 50MB', 'error');
                              }
                              setSubmitFile(file);
                            }
                          }}
                          className="hidden"
                        />

                        {submitFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            <div className="text-sm font-bold text-slate-900">{submitFile.name}</div>
                            <div className="text-xs text-slate-500">
                              Kích thước: {(submitFile.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubmitFile(null);
                              }}
                              className="text-xs text-rose-600 hover:underline font-semibold mt-1"
                            >
                              Xóa và chọn tệp khác
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                            <div className="text-xs text-slate-700 font-semibold">
                              Kéo thả tệp vào đây, hoặc <span className="text-indigo-600 underline">chọn từ máy tính</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Hỗ trợ: PDF, Word (.docx), Nén (.zip, .rar), Sơ đồ, Mã nguồn (Tối đa 50MB)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Đường dẫn liên kết (Link GitHub, Drive, Demo) */}
                    <div>
                      <Input
                        label="Đường dẫn liên kết (GitHub, Google Drive, Live Demo)"
                        placeholder="https://github.com/org/repo hoặc https://drive.google.com/..."
                        value={submitSourceUrl}
                        onChange={(e) => setSubmitSourceUrl(e.target.value)}
                      />
                    </div>

                    {/* Ghi chú */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Ghi chú gửi Giảng viên hướng dẫn
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ghi chú về nội dung cập nhật, các điểm cần GVHD góp ý..."
                        value={submitNote}
                        onChange={(e) => setSubmitNote(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    {/* Upload Progress Bar */}
                    {isUploading && (
                      <div className="space-y-1.5 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                        <div className="flex justify-between text-xs text-indigo-900 font-semibold">
                          <span>Đang tải lên và xử lý...</span>
                          <span>{uploadPercent}%</span>
                        </div>
                        <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isUploading}
                        className="flex items-center gap-2"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Đang xử lý nộp...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Xác nhận nộp tài liệu
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Lịch sử nộp bài (List lịch sử nộp bài) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      Lịch sử nộp bài & Các phiên bản
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Danh sách các lần nộp tài liệu, phiên bản (version) và nhận xét từ GVHD
                    </p>
                  </div>
                  <Badge variant="neutral">{(mySubmissions.length || submissions.length)} lần nộp</Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="divide-y divide-slate-100">
                    {(mySubmissions.length > 0 ? mySubmissions : submissions).map((sub: any) => (
                      <div key={sub.id} className="py-4 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                              v{sub.version || 1}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {sub.type || sub.report?.reportType || 'BAO_CAO_TIEN_DO'}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900">
                              {sub.report?.title || fixMojibake(sub.fileName) || 'Tài liệu KLTN'}
                            </h4>
                          </div>

                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                              sub.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : sub.status === 'CHUA_XEM' || sub.status === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : sub.status === 'UNDER_REVIEW'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : sub.status === 'REVISION_REQUIRED' || sub.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {sub.status === 'CHUA_XEM'
                              ? 'Chưa xem'
                              : sub.status === 'SUBMITTED'
                              ? 'Đã nộp'
                              : sub.status === 'ACCEPTED'
                              ? 'Đã duyệt'
                              : sub.status === 'UNDER_REVIEW'
                              ? 'Đang xem xét'
                              : sub.status === 'REVISION_REQUIRED'
                              ? 'Yêu cầu sửa'
                              : sub.status === 'REJECTED'
                              ? 'Từ chối'
                              : sub.status}
                          </span>
                        </div>

                        {/* File & Link metadata */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <span>
                            Thời gian nộp: {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                          </span>
                          {sub.fileName && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSubmission(sub)}
                              className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer text-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{fixMojibake(sub.fileName)}</span>
                              {sub.fileSize && (
                                <span className="text-slate-400 font-normal">
                                  ({(sub.fileSize / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                              )}
                            </button>
                          )}
                          {sub.sourceUrl && (
                            <a
                              href={sub.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Link tài liệu / Demo</span>
                            </a>
                          )}
                        </div>

                        {sub.status === 'REVISION_REQUIRED' && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block">Giảng viên yêu cầu chỉnh sửa bài nộp</span>
                              Vui lòng đọc kỹ nhận xét phản hồi bên dưới, hoàn thiện các điểm được nhắc nhở và nộp lại phiên bản tiếp theo (v{(sub.version || 1) + 1}).
                            </div>
                          </div>
                        )}

                        {sub.note && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <b>Ghi chú:</b> {sub.note}
                          </p>
                        )}

                        {/* Phản hồi từ GVHD */}
                        {sub.feedbacks && sub.feedbacks.length > 0 && (
                          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-slate-800 space-y-1">
                            <span className="font-bold text-indigo-900 block flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                              Nhận xét từ Giảng viên hướng dẫn:
                            </span>
                            {sub.feedbacks.map((f: any) => (
                              <p key={f.id} className="text-slate-700">
                                {f.content}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {(mySubmissions.length === 0 && submissions.length === 0) && (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Chưa có bài nộp nào. Hãy sử dụng biểu mẫu ở trên để nộp bài đầu tiên.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cột phải: Thông tin Nhóm KLTN & Đánh giá */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-base font-bold text-slate-900">Thông tin nhóm KLTN</h3>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <div className="text-slate-400 uppercase text-[10px] font-bold">Mã nhóm</div>
                      <div className="font-bold text-sm text-slate-800">{myGroup?.code ?? 'Chưa lập nhóm'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 uppercase text-[10px] font-bold">Tên nhóm</div>
                      <div className="font-semibold text-slate-800">{formatGroupName(myGroup?.name, myGroup?.topic?.title) ?? 'Chưa lập nhóm'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 uppercase text-[10px] font-bold">Đánh giá giữa kỳ</div>
                      <Badge
                        variant={
                          myGroup?.midtermStatus === 'CONTINUE'
                            ? 'success'
                            : myGroup?.midtermStatus === 'STOPPED'
                            ? 'danger'
                            : 'warning'
                        }
                        className="mt-1"
                      >
                        {myGroup?.midtermStatus === 'CONTINUE'
                          ? 'Được làm tiếp'
                          : myGroup?.midtermStatus === 'STOPPED'
                          ? 'Dừng KLTN'
                          : 'Chờ đánh giá'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mốc báo cáo tiến độ do bộ môn/GVHD đặt ra */}
              <Card>
                <CardHeader>
                  <h3 className="text-base font-bold text-slate-900">Các mốc được giao</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reports.map((rep) => (
                    <div key={rep.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-1">
                      <Badge variant="primary" size="sm">
                        {rep.reportType}
                      </Badge>
                      <div className="font-bold text-slate-800 mt-1">{rep.title}</div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Hạn: {rep.dueAt ? new Date(rep.dueAt).toLocaleDateString('vi-VN') : 'Không giới hạn'}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 text-xs"
                        onClick={() => {
                          setSelectedReportId(rep.id);
                          setShowSubmitModal(true);
                        }}
                      >
                        Nộp cho mốc này
                      </Button>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Chưa có mốc tiến độ cụ thể được giao.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Realtime Chat with GVHD */}
      {activeTab === 'chat' && (
        <Card className="h-[650px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  Trao đổi nhóm với Giảng viên hướng dẫn
                </h3>
                {myGroups.length > 1 && (
                  <select
                    value={myGroup?.id || ''}
                    onChange={(e) => {
                      const selected = myGroups.find((g) => g.id === e.target.value);
                      if (selected) {
                        setMyGroup(selected);
                        fetchChatMessages(selected);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
                  >
                    {myGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} - {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  <strong className="text-slate-800">Nhóm:</strong> {myGroup?.code} - {formatGroupName(myGroup?.name, myGroup?.topic?.title) ?? 'Chưa có nhóm KLTN'}
                </span>
                {myGroup?.topic?.title && (
                  <span>
                    <strong className="text-slate-800">Đề tài:</strong> {myGroup.topic.title}
                  </span>
                )}
                <span>
                  <strong className="text-emerald-700 font-semibold">GVHD:</strong> {myGroup?.topic?.owner?.fullName ?? 'Chưa phân công'}
                </span>
              </div>
              {myGroup?.members && myGroup.members.length > 0 && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-700">Thành viên ({myGroup.members.length}):</span>
                  {myGroup.members.map((m: any, idx: number) => (
                    <span key={m.studentId || idx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {m.student?.user?.fullName ?? m.student?.studentCode} {m.isLeader ? '(Trưởng nhóm)' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fetchChatMessages(myGroup)}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                title="Tải lại tin nhắn"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Tải lại
              </button>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Realtime
              </span>
            </div>
          </CardHeader>

          <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/40">
            {chatMessages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              const senderRoles = msg.sender?.roles?.map((r: any) => r.role?.code || r.role || r) || [];
              const isLecturer =
                senderRoles.includes('GIANG_VIEN') ||
                msg.senderId === myGroup?.topic?.ownerId;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 text-[11px] mb-1 px-1">
                    <span className="font-medium text-slate-600">
                      {isMe ? 'Bạn' : (msg.sender?.fullName ?? 'Thành viên')}
                    </span>
                    {isMe ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-700 font-semibold">Bạn</span>
                    ) : isLecturer ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-700 font-semibold">GVHD</span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 text-blue-700 font-semibold">Sinh viên</span>
                    )}
                  </div>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-xs ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : isLecturer
                        ? 'bg-emerald-50 text-slate-900 border border-emerald-200 rounded-tl-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            {chatMessages.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Chưa có tin nhắn nào trong nhóm. Hãy gửi câu hỏi hoặc trao đổi với GVHD bên dưới!
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex gap-3">
            <input
              type="text"
              placeholder="Nhập nội dung trao đổi..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
            <Button type="submit" variant="primary">
              <Send className="w-4 h-4 mr-1.5" /> Gửi
            </Button>
          </form>
        </Card>
      )}

      {/* Tab 6: Appointments */}
      {activeTab === 'appointments' && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Lịch hẹn trao đổi với Giảng viên
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Theo dõi lịch gặp mặt hoặc họp trực tuyến do GVHD thiết lập</p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {appointments.map((appt) => (
                <div key={appt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          appt.status === 'CONFIRMED'
                            ? 'success'
                            : appt.status === 'PROPOSED'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {appt.status}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {appt.mode}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{appt.title}</h4>
                    <p className="text-xs text-slate-500">
                      Thời gian: {new Date(appt.startsAt).toLocaleString('vi-VN')} -{' '}
                      {new Date(appt.endsAt).toLocaleTimeString('vi-VN')}
                    </p>
                    {appt.proposedTime && (
                      <div className="text-xs bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200 mt-1 space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5 text-amber-800">
                          <Clock className="w-3.5 h-3.5" />
                          Thời gian đề xuất mới: {new Date(appt.proposedTime).toLocaleString('vi-VN')}
                        </div>
                        {appt.proposeNote && (
                          <div className="text-[11px] text-amber-700">Lý do/Ghi chú: {appt.proposeNote}</div>
                        )}
                      </div>
                    )}
                    {appt.mode === 'ONLINE' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 font-medium">Họp trực tuyến:</span>
                        {appt.meetingUrl || (appt.location && (appt.location.startsWith('http://') || appt.location.startsWith('https://'))) ? (
                          <a
                            href={appt.meetingUrl || appt.location}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-medium text-xs border border-emerald-200 transition-colors"
                          >
                            <Video className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Vào phòng Google Meet</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có link họp</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 mt-1">
                        Địa điểm: <span className="font-medium text-slate-800">{appt.location || 'Văn phòng bộ môn'}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(appt.status === 'PROPOSED' || appt.status === 'RESCHEDULED') && (
                      <Button size="sm" variant="success" onClick={() => handleConfirmAppointment(appt.id)}>
                        Xác nhận
                      </Button>
                    )}
                    {appt.allowProposeTime !== false && appt.status !== 'CANCELLED' && appt.status !== 'CONFIRMED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedApptForPropose(appt);
                          setShowProposeTimeModal(true);
                        }}
                      >
                        Đề xuất lại giờ
                      </Button>
                    )}
                    {appt.status !== 'CANCELLED' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateAppointment(appt.id, 'CANCELLED')}>
                        Hủy lịch
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">Chưa có lịch hẹn nào.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 7: Defense & Reviewer View */}
      {activeTab === 'defense' && (
        <div className="space-y-6">
          {/* Defense Format Classification Banner */}
          {myGroup && (
            <div
              className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                myGroup.defenseFormat === 'HOI_DONG'
                  ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-purple-200'
                  : myGroup.defenseFormat === 'POSTER'
                  ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    myGroup.defenseFormat === 'HOI_DONG'
                      ? 'bg-purple-100 text-purple-700'
                      : myGroup.defenseFormat === 'POSTER'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {myGroup.defenseFormat === 'HOI_DONG' ? (
                    <Crown className="w-6 h-6" />
                  ) : myGroup.defenseFormat === 'POSTER' ? (
                    <FileText className="w-6 h-6" />
                  ) : (
                    <Clock className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Hình thức bảo vệ:
                    </span>
                    {myGroup.defenseFormat === 'HOI_DONG' ? (
                      <Badge variant="purple" size="sm" className="font-bold">
                        Báo cáo Hội đồng (Top 20%)
                      </Badge>
                    ) : myGroup.defenseFormat === 'POSTER' ? (
                      <Badge variant="warning" size="sm" className="font-bold">
                        Báo cáo Poster (80%)
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Chờ điểm phản biện
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {myGroup.defenseFormat === 'HOI_DONG'
                      ? `Chúc mừng! Đề tài "${myGroup.topic?.title || myGroup.name}" thuộc Top 20% điểm phản biện cao nhất (${myGroup.reviewerScore ?? 'N/A'}đ) và được phân công bảo vệ trước Hội đồng chuyên môn.`
                      : myGroup.defenseFormat === 'POSTER'
                      ? `Đề tài "${myGroup.topic?.title || myGroup.name}" được phân công báo cáo theo hình thức Poster tại sảnh/khu vực triển lãm KLTN (${myGroup.reviewerScore ?? 'N/A'}đ).`
                      : 'Đề tài đang chờ hoàn thành chấm điểm phản biện để phân luồng (Top 20% Hội đồng - 80% Poster).'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {myGroup.reviewerScore !== null && myGroup.reviewerScore !== undefined && (
                  <div className="text-right px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Điểm phản biện</div>
                    <div className="text-base font-black text-indigo-700 font-mono">
                      {Number(myGroup.reviewerScore).toFixed(2)}đ
                    </div>
                  </div>
                )}
                {myGroup.defenseFormatRank && (
                  <div className="text-right px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Xếp hạng</div>
                    <div className="text-base font-black text-purple-700 font-mono">
                      #{myGroup.defenseFormatRank}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-600" />
                Phân công Giảng viên phản biện (GVPB)
              </h3>
            </CardHeader>
            <CardContent>
              {defenseInfo?.danhSachGVPB && defenseInfo.danhSachGVPB.length > 0 ? (
                <div className="space-y-3">
                  {defenseInfo.danhSachGVPB.map((rev: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Giảng viên phản biện:</span>
                        <Badge variant="purple" size="sm">{rev.vaiTro || 'Phản biện chính'}</Badge>
                      </div>
                      <div className="font-bold text-slate-900 mt-1">{rev.hoTen}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{rev.email}</div>
                    </div>
                  ))}
                </div>
              ) : reviewers.length > 0 ? (
                <div className="space-y-3">
                  {reviewers.map((rev) => (
                    <div key={rev.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Giảng viên phản biện:</span>
                        <Badge variant="purple" size="sm">{rev.type}</Badge>
                      </div>
                      <div className="font-bold text-slate-900 mt-1">{rev.lecturer?.user?.fullName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{rev.lecturer?.specialization ?? 'Bộ môn CNTT'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Chưa có phân công phản biện chính thức từ Trưởng bộ môn.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Lịch bảo vệ Khóa luận tốt nghiệp
              </h3>
            </CardHeader>
            <CardContent>
              {defenseInfo?.lichBaoVe ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="success">ĐÃ CÔNG BỐ LỊCH</Badge>
                      <span className="text-xs font-bold text-indigo-700">Phòng: {defenseInfo.lichBaoVe.phong || 'Chưa xếp'}</span>
                    </div>
                    <div className="text-xs text-slate-700 space-y-1">
                      <div>Hình thức: <b>{defenseInfo.lichBaoVe.hinhThuc === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}</b></div>
                      <div>Bắt đầu: <b>{new Date(defenseInfo.lichBaoVe.ngayGio).toLocaleString('vi-VN')}</b></div>
                      {defenseInfo.lichBaoVe.thoiGianKetThuc && (
                        <div>Kết thúc: <b>{new Date(defenseInfo.lichBaoVe.thoiGianKetThuc).toLocaleTimeString('vi-VN')}</b></div>
                      )}
                      {defenseInfo.lichBaoVe.linkOnline && (
                        <div>Link họp: <a href={defenseInfo.lichBaoVe.linkOnline} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium">{defenseInfo.lichBaoVe.linkOnline}</a></div>
                      )}
                    </div>
                    {defenseInfo.lichBaoVe.thanhVienHoiDong?.length > 0 && (
                      <div className="pt-2 border-t border-indigo-100">
                        <div className="text-xs font-bold text-slate-800 mb-1.5">Thành viên Hội đồng chấm:</div>
                        <div className="space-y-1">
                          {defenseInfo.lichBaoVe.thanhVienHoiDong.map((tv: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs text-slate-600 bg-white/70 px-2.5 py-1.5 rounded-lg border border-indigo-50">
                              <span className="font-semibold text-slate-800">{tv.hoTen}</span>
                              <span className="text-[11px] text-indigo-700 font-medium">{tv.vaiTro}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : defenseSchedules.length > 0 ? (
                <div className="space-y-4">
                  {defenseSchedules.map((sch) => (
                    <div key={sch.id} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="primary">{sch.status}</Badge>
                        <span className="text-xs font-bold text-indigo-700">Phòng: {sch.room || 'Chưa xếp'}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        Hội đồng: {sch.committee?.name ?? 'Hội đồng chấm KLTN'}
                      </div>
                      <div className="text-xs text-slate-600">
                        Bắt đầu: <b>{new Date(sch.startsAt).toLocaleString('vi-VN')}</b>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Chưa có lịch bảo vệ được xếp cho nhóm của bạn (hoặc lịch đang ở trạng thái dự thảo).
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Tab 8: Scores & NCKH Evidence */}
      {activeTab === 'scores' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                Bảng điểm chi tiết & Kết quả cuối cùng
              </h3>
              {myGroup && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={!isScorePublished}
                  className={
                    !isScorePublished
                      ? 'opacity-60 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                      : 'text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                  }
                  title={
                    !isScorePublished
                      ? 'Điểm đang được khóa chờ công bố chính thức'
                      : 'Xuất phiếu điểm PDF'
                  }
                >
                  {!isScorePublished ? (
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  )}
                  <span>Xuất phiếu điểm PDF</span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!isScorePublished ? (
                <div className="p-12 text-center text-xs text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <div className="font-bold text-slate-800 text-sm">
                      Điểm đang được khóa chờ công bố chính thức
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      {defenseInfo?.diemChiTiet?.congThucTinh ||
                        'Hội đồng bảo vệ đang trong quá trình chấm điểm, thẩm định hoặc điểm chưa được Trưởng bộ môn phê duyệt công bố chính thức. Tính năng xuất phiếu điểm PDF sẽ được mở sau khi điểm được công bố.'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Trạng thái: Đang khóa chờ công bố
                    </span>
                  </div>
                </div>
              ) : defenseInfo?.diemChiTiet ? (
                <div className="space-y-5">
                  {/* Kết quả cuối cùng Banner */}
                  {defenseInfo.ketQuaCuoiCung && (
                    <div
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        defenseInfo.ketQuaCuoiCung === 'DAT'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {defenseInfo.ketQuaCuoiCung === 'DAT' ? (
                          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                        ) : (
                          <XCircle className="w-7 h-7 text-rose-600" />
                        )}
                        <div>
                          <div className="font-extrabold text-sm uppercase tracking-wide">
                            KẾT QUẢ KHÓA LUẬN:{' '}
                            {defenseInfo.ketQuaCuoiCung === 'DAT'
                              ? 'ĐẠT YÊU CẦU'
                              : defenseInfo.diemChiTiet?.diemHuongDan?.tong !== undefined &&
                                Number(defenseInfo.diemChiTiet.diemHuongDan.tong) < 6.0
                              ? 'KHÔNG ĐẠT (BỊ LOẠI)'
                              : 'KHÔNG ĐẠT'}
                          </div>
                          <div className="text-xs opacity-80">
                            {defenseInfo.ketQuaCuoiCung === 'DAT'
                              ? 'Chúc mừng bạn đã hoàn thành và bảo vệ thành công Khóa luận tốt nghiệp!'
                              : defenseInfo.diemChiTiet?.diemHuongDan?.tong !== undefined &&
                                Number(defenseInfo.diemChiTiet.diemHuongDan.tong) < 6.0
                              ? `Điểm trung bình của GVHD là ${defenseInfo.diemChiTiet.diemHuongDan.tong}/10 (< 6.0). Theo quy chế KLTN: Điểm GVHD phải ≥ 6.0 mới đạt. Bạn bị loại và không được đi tiếp ra các vòng tiếp theo.`
                              : 'Rất tiếc điểm tổng kết chưa đạt mức tối thiểu (>= 5.0).'}
                          </div>
                        </div>
                      </div>
                      <Badge variant={defenseInfo.ketQuaCuoiCung === 'DAT' ? 'success' : 'danger'} size="md">
                        {defenseInfo.diemChiTiet?.diemHuongDan?.tong !== undefined &&
                        Number(defenseInfo.diemChiTiet.diemHuongDan.tong) < 6.0
                          ? 'BỊ LOẠI (< 6.0)'
                          : defenseInfo.ketQuaCuoiCung}
                      </Badge>
                    </div>
                  )}

                  {/* Điểm GVHD */}
                  {defenseInfo.diemChiTiet.diemHuongDan && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-800 uppercase">1. Điểm Giảng viên hướng dẫn (GVHD)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-700">Tổng GVHD: {defenseInfo.diemChiTiet.diemHuongDan.tong}/10</span>
                          {Number(defenseInfo.diemChiTiet.diemHuongDan.tong) >= 6.0 ? (
                            <Badge variant="success" size="sm">ĐẠT (≥ 6.0)</Badge>
                          ) : (
                            <Badge variant="danger" size="sm">KHÔNG ĐẠT (&lt; 6.0 - BỊ LOẠI)</Badge>
                          )}
                        </div>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <table className="w-full min-w-[380px] text-left text-xs">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-100">
                              <th className="pb-2">Tiêu chí</th>
                              <th className="pb-2 text-right">Điểm số</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {defenseInfo.diemChiTiet.diemHuongDan.tieuChi?.map((tc: any, i: number) => (
                              <tr key={i}>
                                <td className="py-2 text-slate-700">
                                  <span className="font-semibold text-slate-900 mr-2">
                                    {tc.maTieuChi ? `${tc.maTieuChi}:` : `TC${String(i + 1).padStart(2, '0')}:`}
                                  </span>
                                  <span>{tc.tenTieuChi || tc.ten || 'Tiêu chí đánh giá'}</span>
                                </td>
                                <td className="py-2 text-right font-bold text-indigo-600">{tc.diem}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {Number(defenseInfo.diemChiTiet.diemHuongDan.tong) < 6.0 && (
                        <div className="p-3 bg-rose-50 border-t border-rose-200 text-xs text-rose-800 font-medium">
                          ⚠️ <b>Quy chế KLTN:</b> Điểm trung bình của GVHD phải ≥ 6.0 mới đạt. Do điểm GVHD của bạn dưới 6.0 ({defenseInfo.diemChiTiet.diemHuongDan.tong}/10), bạn đã bị loại và không được đi tiếp các giai đoạn phản biện hoặc hội đồng bảo vệ.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Điểm GVPB */}
                  {defenseInfo.diemChiTiet.diemPhanBien && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-800 uppercase">2. Điểm Giảng viên phản biện (GVPB)</span>
                        <span className="text-xs font-bold text-indigo-700">Tổng GVPB: {defenseInfo.diemChiTiet.diemPhanBien.tong}/10</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <table className="w-full min-w-[380px] text-left text-xs">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-100">
                              <th className="pb-2">Tiêu chí</th>
                              <th className="pb-2 text-right">Điểm số</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {defenseInfo.diemChiTiet.diemPhanBien.tieuChi?.map((tc: any, i: number) => (
                              <tr key={i}>
                                <td className="py-2 text-slate-700">
                                  <span className="font-semibold text-slate-900 mr-2">
                                    {tc.maTieuChi ? `${tc.maTieuChi}:` : `TC${String(i + 1).padStart(2, '0')}:`}
                                  </span>
                                  <span>{tc.tenTieuChi || tc.ten || 'Tiêu chí đánh giá'}</span>
                                </td>
                                <td className="py-2 text-right font-bold text-indigo-600">{tc.diem}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Điểm Hội đồng */}
                  {defenseInfo.diemChiTiet.diemHoiDong && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-800 uppercase">3. Điểm Hội đồng bảo vệ (HĐ)</span>
                        <span className="text-xs font-bold text-indigo-700">Tổng HĐ: {defenseInfo.diemChiTiet.diemHoiDong.tong}/10</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <table className="w-full min-w-[380px] text-left text-xs">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-100">
                              <th className="pb-2">Tiêu chí</th>
                              <th className="pb-2 text-right">Điểm TB Hội đồng</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {defenseInfo.diemChiTiet.diemHoiDong.tieuChi?.map((tc: any, i: number) => (
                              <tr key={i}>
                                <td className="py-2 text-slate-700">
                                  <span className="font-semibold text-slate-900 mr-2">
                                    {tc.maTieuChi ? `${tc.maTieuChi}:` : `TC${String(i + 1).padStart(2, '0')}:`}
                                  </span>
                                  <span>{tc.tenTieuChi || tc.ten || 'Tiêu chí đánh giá'}</span>
                                </td>
                                <td className="py-2 text-right font-bold text-indigo-600">{tc.diem}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tổng điểm & Công thức & Phân rã thành phần điểm */}
                  <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                      <div>
                        <div className="text-xs text-indigo-950 font-black uppercase tracking-wider">TỔNG ĐIỂM KHÓA LUẬN (HỆ 10)</div>
                        <div className="text-xs text-slate-600 mt-0.5">{defenseInfo.diemChiTiet.congThucTinh}</div>
                      </div>
                      <div className="text-2xl font-black text-indigo-700">
                        {defenseInfo.diemChiTiet.diemTongKet !== null && defenseInfo.diemChiTiet.diemTongKet !== undefined
                          ? `${defenseInfo.diemChiTiet.diemTongKet}/10`
                          : 'Chưa hoàn tất'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {defenseInfo.diemChiTiet.diemHuongDan?.tong !== undefined && defenseInfo.diemChiTiet.diemHuongDan?.tong !== null && (
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                          <span className="text-slate-500 block text-[11px]">1. Điểm GVHD</span>
                          <span className="font-bold text-slate-900 text-sm">{defenseInfo.diemChiTiet.diemHuongDan.tong} / 10</span>
                        </div>
                      )}
                      {defenseInfo.diemChiTiet.diemPhanBien?.tong !== undefined && defenseInfo.diemChiTiet.diemPhanBien?.tong !== null && (
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                          <span className="text-slate-500 block text-[11px]">2. Điểm GVPB</span>
                          <span className="font-bold text-slate-900 text-sm">{defenseInfo.diemChiTiet.diemPhanBien.tong} / 10</span>
                        </div>
                      )}
                      {defenseInfo.diemChiTiet.diemHoiDong?.tong !== undefined && defenseInfo.diemChiTiet.diemHoiDong?.tong !== null && (
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                          <span className="text-slate-500 block text-[11px]">3. Điểm Hội đồng</span>
                          <span className="font-bold text-slate-900 text-sm">{defenseInfo.diemChiTiet.diemHoiDong.tong} / 10</span>
                        </div>
                      )}
                      {defenseInfo.diemChiTiet.diemTrungBinhDanhGia !== undefined && defenseInfo.diemChiTiet.diemTrungBinhDanhGia !== null && (
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                          <span className="text-slate-500 block text-[11px]">Trung bình đánh giá</span>
                          <span className="font-bold text-indigo-700 text-sm">{defenseInfo.diemChiTiet.diemTrungBinhDanhGia} / 10</span>
                        </div>
                      )}
                      {(defenseInfo.diemChiTiet.diemThuongNckh ?? 0) > 0 && (
                        <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
                          <span className="text-emerald-700 block text-[11px]">Thưởng NCKH (Đã duyệt)</span>
                          <span className="font-bold text-emerald-800 text-sm">+{defenseInfo.diemChiTiet.diemThuongNckh}đ (max 2.0đ)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : scores?.scores?.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-3">Tiêu chí đánh giá</th>
                          <th className="p-3">Điểm số</th>
                          <th className="p-3">Người chấm</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scores.scores.map((sc: any) => (
                          <tr key={sc.id}>
                            <td className="p-3 font-semibold text-slate-800">{sc.criterion.name}</td>
                            <td className="p-3 font-bold text-indigo-600 text-sm">
                              {sc.value}/{sc.criterion.maxScore}
                            </td>
                            <td className="p-3 text-slate-600">{sc.scorer?.fullName ?? 'Giảng viên'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs text-indigo-900 font-semibold">TỔNG ĐIỂM KHÓA LUẬN (HỆ 10)</div>
                      <div className="text-xs text-slate-500">Tính theo trung bình cộng các tiêu chí và điểm thưởng NCKH (nếu có)</div>
                    </div>
                    <div className="text-2xl font-black text-indigo-700">{scores.total}/10</div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Hội đồng chưa nhập điểm hoặc điểm đang được khóa chờ công bố chính thức.
                </div>
              )}
            </CardContent>
          </Card>

          {/* NCKH Evidence Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                Minh chứng NCKH
              </h3>
              <Button size="sm" variant="secondary" onClick={() => setShowEvidenceModal(true)}>
                Nộp
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {evidenceList.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{ev.title}</span>
                      <Badge
                        variant={
                          ev.status === 'APPROVED' ? 'success' : ev.status === 'REJECTED' ? 'danger' : 'warning'
                        }
                        size="sm"
                      >
                        {ev.status === 'APPROVED'
                          ? 'Đã duyệt'
                          : ev.status === 'REJECTED'
                          ? 'Từ chối'
                          : ev.status === 'REQUEST_MORE_INFO'
                          ? 'Cần bổ sung'
                          : 'Chờ duyệt'}
                      </Badge>
                    </div>
                    {ev.points && (
                      <div className="text-emerald-600 font-semibold">Điểm cộng: +{ev.points}đ</div>
                    )}
                    {ev.description && <p className="text-slate-500 line-clamp-2">{ev.description}</p>}
                    {ev.fileName && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                        <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="truncate">{ev.fileName}</span>
                      </div>
                    )}
                  </div>
                ))}
                {evidenceList.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Chưa có minh chứng NCKH (bài báo, giải thưởng sinh viên nghiên cứu khoa học).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

        </div>
      </div>

      {/* MODAL: Xác nhận Đăng ký Đề tài */}
      <Modal
        isOpen={showConfirmRegisterModal && !hasActiveRegistration}
        onClose={() => {
          if (!isSubmittingRegistration) {
            setShowConfirmRegisterModal(false);
            setTopicToRegister(null);
          }
        }}
        title="Xác nhận Đăng ký Đề tài Khóa luận Tốt nghiệp"
      >
        {topicToRegister && (
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100/80 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                    Đề tài bạn chọn đăng ký
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {topicToRegister.tenDeTai || topicToRegister.title}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-600 border-t border-indigo-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">GVHD hướng dẫn:</span>
                  <span className="font-semibold text-slate-800">
                    {topicToRegister.gvhd?.hoTen || topicToRegister.supervisor?.fullName || topicToRegister.owner?.fullName || 'Bộ môn phân công'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Số chỗ còn lại:</span>
                  <span className="font-semibold text-emerald-600">
                    {topicToRegister.soChoConLai ?? (topicToRegister.capacity - (topicToRegister.registrations?.length || 0))} chỗ trống
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Lưu ý quan trọng về quy chế đăng ký đề tài:
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1 leading-relaxed">
                <li>
                  Đăng ký đề tài thành công.
                </li>
                <li>
                  Mỗi sinh viên chỉ được tham gia <b>01 đề tài/đơn đăng ký</b>. Bạn không thể đăng ký thêm đề tài khác khi đơn này đang chờ xử lý.
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingRegistration}
                onClick={() => {
                  setShowConfirmRegisterModal(false);
                  setTopicToRegister(null);
                }}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isSubmittingRegistration}
                onClick={handleConfirmRegistration}
                className="flex items-center gap-2"
              >
                {isSubmittingRegistration ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang gửi đơn...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Xác nhận Đăng ký
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: View Topic Registrations & Group Selection */}
      <Modal
        isOpen={showTopicRegsModal}
        onClose={() => setShowTopicRegsModal(false)}
        maxWidth="2xl"
        title={`Sinh viên đăng ký - ${selectedTopicForRegs?.tenDeTai || selectedTopicForRegs?.title || 'Đề tài'}`}
      >
        <div className="space-y-5 text-xs">
          {/* Topic Summary banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 text-sm">
                {selectedTopicForRegs?.tenDeTai || selectedTopicForRegs?.title}
              </span>
              <Badge variant={selectedTopicForRegs?.status === 'APPROVED' || selectedTopicForRegs?.trangThai === 'APPROVED' ? 'success' : 'warning'}>
                {selectedTopicForRegs?.status === 'APPROVED' || selectedTopicForRegs?.trangThai === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
              <span>Sức chứa: <b>{selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2}</b> SV</span>
              <span>Đã đăng ký: <b className="text-emerald-700">{topicRegistrations.length}</b> SV</span>
              <span>
                Còn trống:{' '}
                <b className="text-blue-600">
                  {Math.max(0, (selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2) - topicRegistrations.length)}
                </b>{' '}
                chỗ
              </span>
            </div>
          </div>

          {/* Section: DANH SÁCH SINH VIÊN ĐĂNG KÝ */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Danh sách sinh viên đăng ký ({topicRegistrations.length})</span>
            </h4>

            {loadingTopicRegs ? (
              <div className="p-6 text-center text-slate-400">Đang tải danh sách sinh viên...</div>
            ) : topicRegistrations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Chưa có sinh viên nào đăng ký đề tài này.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[550px] text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">MSSV</th>
                      <th className="p-2.5">Họ và tên</th>
                      <th className="p-2.5">Thông tin liên lạc</th>
                      <th className="p-2.5">Lớp</th>
                      <th className="p-2.5">Trạng thái</th>
                      <th className="p-2.5">Nhóm KLTN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topicRegistrations.map((st, idx) => {
                      const studentMssv = st.mssv || st.studentCode;
                      const isMe =
                        studentMssv === user?.studentProfile?.studentCode ||
                        st.userId === user?.id ||
                        st.studentId === studentData?.id;

                      const activeTopicGroup = topicGroups?.[0] || null;
                      const memberInGroup = activeTopicGroup?.members?.find(
                        (m: any) => m.studentId === st.studentId || m.studentCode === studentMssv
                      );

                      const amILeader = activeTopicGroup?.members?.some(
                        (m: any) =>
                          (m.studentId === studentData?.id || m.studentCode === user?.studentProfile?.studentCode) &&
                          m.isLeader
                      );

                      const inAnyGroup = Boolean(
                        st.groupId ||
                        st.group ||
                        memberInGroup ||
                        topicGroups?.some((g: any) =>
                          (g.members || []).some(
                            (m: any) => m.studentId === st.studentId || m.studentCode === studentMssv
                          )
                        )
                      );

                      const canAddToGroup =
                        amILeader &&
                        !inAnyGroup &&
                        activeTopicGroup &&
                        activeTopicGroup.members.length <
                          (selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2);

                      return (
                        <tr
                          key={st.id || idx}
                          className={`hover:bg-slate-50/70 transition-colors ${isMe ? 'bg-indigo-50/40' : ''}`}
                        >
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {studentMssv}
                            {isMe && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-sans font-semibold">
                                Bạn
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-medium text-slate-900">{st.hoTen || st.fullName}</td>
                          <td className="p-2.5 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{st.email || '—'}</span>
                            </div>
                            {st.phone && st.phone !== 'Chưa cập nhật' && (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{st.phone}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600">{st.lop || st.className || '—'}</td>
                          <td className="p-2.5">
                            <Badge variant="success" size="sm">
                              Đã xác nhận
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            {inAnyGroup ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {st.group?.code || activeTopicGroup?.code || 'Đã có nhóm'} {memberInGroup?.isLeader ? '(Trưởng nhóm)' : '(Thành viên)'}
                              </span>
                            ) : canAddToGroup ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                onClick={() => handleAddMemberToGroup(activeTopicGroup.id, st.studentId)}
                              >
                                + Thêm vào nhóm
                              </Button>
                            ) : !activeTopicGroup && !isMe ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2 border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 font-semibold"
                                onClick={async () => {
                                  try {
                                    setIsCreatingGroup(true);
                                    await api.post('/groups', {
                                      topicId: selectedTopicForRegs.id,
                                      memberStudentIds: [st.studentId],
                                    });
                                    notify('Thành lập nhóm và ghép cùng bạn thành công!', 'success');
                                    await loadData();
                                    await openTopicRegistrationsModal(selectedTopicForRegs);
                                  } catch (err: any) {
                                    notify(err.response?.data?.message ?? 'Lỗi tạo nhóm', 'error');
                                  } finally {
                                    setIsCreatingGroup(false);
                                  }
                                }}
                                disabled={isCreatingGroup}
                              >
                                + Ghép nhóm cùng bạn này
                              </Button>
                            ) : !activeTopicGroup && isMe ? (
                              <Button
                                size="sm"
                                variant="primary"
                                className="text-[11px] h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                onClick={async () => {
                                  try {
                                    setIsCreatingGroup(true);
                                    await api.post('/groups', {
                                      topicId: selectedTopicForRegs.id,
                                      memberStudentIds: [],
                                    });
                                    notify('Khởi tạo nhóm KLTN thành công!', 'success');
                                    await loadData();
                                    await openTopicRegistrationsModal(selectedTopicForRegs);
                                  } catch (err: any) {
                                    notify(err.response?.data?.message ?? 'Lỗi tạo nhóm', 'error');
                                  } finally {
                                    setIsCreatingGroup(false);
                                  }
                                }}
                                disabled={isCreatingGroup}
                              >
                                + Khởi tạo nhóm
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Chưa vào nhóm</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: TIẾN HÀNH CHỌN NHÓM & GHÉP NHÓM */}
          <div className="p-4 border border-indigo-100 bg-indigo-50/40 rounded-xl space-y-3">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Tiến hành chọn nhóm & Ghép nhóm KLTN</span>
            </div>

            {/* Case A: Group exists */}
            {topicGroups.length > 0 ? (
              <div className="space-y-3">
                {topicGroups.map((grp: any) => {
                  const amIMember = grp.members?.some(
                    (m: any) =>
                      m.studentId === studentData?.id ||
                      m.studentCode === user?.studentProfile?.studentCode ||
                      m.studentCode === user?.mssv
                  );
                  const isFull =
                    grp.members?.length >= (selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2);
                  const iHaveOtherGroup = myGroup && myGroup.id !== grp.id;

                  return (
                    <div
                      key={grp.id}
                      className="p-3.5 bg-white border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-900">{grp.code}</span>
                          <span className="font-semibold text-slate-800">{grp.name}</span>
                          <Badge variant={isFull ? 'neutral' : 'success'} size="sm">
                            {grp.members?.length || 0}/
                            {selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2} thành viên
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                          <span>Thành viên:</span>
                          {grp.members?.map((m: any, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]"
                            >
                              {m.fullName || m.studentCode} {m.isLeader ? '⭐ (Trưởng nhóm)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {amIMember ? (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Bạn đã trong nhóm này
                          </span>
                        ) : isFull ? (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500">
                            Nhóm đã đủ thành viên
                          </span>
                        ) : iHaveOtherGroup ? (
                          <span className="text-xs text-amber-700 font-medium">Bạn đã thuộc nhóm khác</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => handleJoinGroup(grp.id)}
                          >
                            Tham gia nhóm này
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Case B: No group exists yet */
              <div className="space-y-3 bg-white p-3.5 rounded-xl border border-indigo-100">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hiện chưa có nhóm nào được thành lập cho đề tài này. Bạn có thể khởi tạo nhóm KLTN và chọn bạn cùng nhóm từ danh sách các bạn đã đăng ký đề tài (Quy định: tối thiểu 1, tối đa 2 sinh viên/nhóm)!
                </p>

                {(selectedTopicForRegs?.capacity ?? selectedTopicForRegs?.soLuongToiDa ?? 2) > 1 && topicRegistrations.filter(
                  (st) =>
                    (st.mssv || st.studentCode) !== user?.studentProfile?.studentCode &&
                    (st.mssv || st.studentCode) !== user?.mssv &&
                    st.studentId !== studentData?.id &&
                    !st.groupId &&
                    !st.group &&
                    !topicGroups?.some((g: any) =>
                      (g.members || []).some(
                        (m: any) => m.studentId === st.studentId || m.studentCode === (st.mssv || st.studentCode)
                      )
                    )
                ).length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Chọn bạn cùng làm KLTN (Tùy chọn):
                    </label>
                    <select
                      value={selectedTeammateId}
                      onChange={(e) => setSelectedTeammateId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    >
                      <option value="">-- Chỉ tạo nhóm riêng (để các bạn khác tham gia sau) --</option>
                      {topicRegistrations
                        .filter(
                          (st) =>
                            (st.mssv || st.studentCode) !== user?.studentProfile?.studentCode &&
                            (st.mssv || st.studentCode) !== user?.mssv &&
                            st.studentId !== studentData?.id &&
                            !st.groupId &&
                            !st.group &&
                            !topicGroups?.some((g: any) =>
                              (g.members || []).some(
                                (m: any) => m.studentId === st.studentId || m.studentCode === (st.mssv || st.studentCode)
                              )
                            )
                        )
                        .map((st) => (
                          <option key={st.studentId} value={st.studentId}>
                            {st.mssv || st.studentCode} - {st.hoTen || st.fullName} ({st.lop || st.className || 'Chưa có lớp'})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="pt-1 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isCreatingGroup}
                    onClick={handleCreateGroupForTopic}
                    className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{isCreatingGroup ? 'Đang tạo nhóm...' : 'Thành lập nhóm cho đề tài này'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowTopicRegsModal(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Propose Topic (SV đã liên hệ trước với GV) */}
      <Modal isOpen={showProposeModal} onClose={() => setShowProposeModal(false)} title="Đề xuất Đề tài KLTN mới">
        <form onSubmit={handleProposeTopic} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Giảng viên hướng dẫn mong muốn (GVHD đã liên hệ trước) <span className="text-rose-500">*</span>
            </label>
            <select
              value={proposeGvhdId}
              onChange={(e) => setProposeGvhdId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="">-- Chọn Giảng viên hướng dẫn --</option>
              {Array.from(
                new Map(
                  lecturersList
                    .filter((lec) => {
                      const email = lec.user?.email || lec.email || '';
                      return (
                        !/\d{10,}@kltn\.edu\.vn/.test(email) &&
                        !email.includes('_score_') &&
                        !email.includes('_unlock_') &&
                        !email.startsWith('gv_b_') &&
                        !email.startsWith('gv_a_') &&
                        !email.startsWith('test_')
                      );
                    })
                    .map((lec) => [lec.user?.email || lec.email || lec.id, lec])
                ).values()
              ).map((lec: any) => (
                <option key={lec.id || lec.userId} value={lec.id || lec.userId}>
                  {lec.user?.fullName || lec.fullName} ({lec.user?.email || lec.email}) - {lec.department?.name || 'Khoa CNTT'}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Tên đề tài KLTN *"
            placeholder="VD: Xây dựng nền tảng IoT giám sát nông nghiệp thông minh"
            value={proposeTitle}
            onChange={(e) => setProposeTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mô tả tóm tắt nội dung đề tài <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả bối cảnh và ý tưởng chính..."
              value={proposeSummary}
              onChange={(e) => setProposeSummary(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Yêu cầu kỹ thuật & Công nghệ dự kiến <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="VD: Kiến trúc NestJS, React 18, PostgreSQL, Socket.io, Docker..."
              value={proposeRequirements}
              onChange={(e) => setProposeRequirements(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="p-3 bg-blue-50 text-blue-900 rounded-lg text-xs flex items-start gap-2 border border-blue-200">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <b>Quy trình đề xuất:</b> Đề xuất sẽ gửi đến Giảng viên hướng dẫn đã chọn với trạng thái <b>Chờ GV xác nhận (CHO_GV_XAC_NHAN)</b>. Khi GV đồng ý, đề tài sẽ tự động được tạo và ghi nhận đăng ký chính thức cho bạn.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" disabled={isSubmittingProposal} onClick={() => setShowProposeModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmittingProposal} className="flex items-center gap-2">
              {isSubmittingProposal ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Gửi đề xuất
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Submit Report */}
      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Nộp báo cáo & Tài liệu">
        <form onSubmit={handleSubmitReport} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Chọn mốc báo cáo
            </label>
            <select
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              required
            >
              <option value="">-- Chọn mốc báo cáo --</option>
              {reports.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.title} ({rep.reportType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tệp báo cáo (.pdf, .docx, .zip)
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.zip"
              onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <Input
            label="Link mã nguồn (Github / Gitlab)"
            placeholder="https://github.com/username/project"
            value={submitSourceUrl}
            onChange={(e) => setSubmitSourceUrl(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ghi chú nộp bài
            </label>
            <textarea
              rows={2}
              placeholder="Ghi chú thêm cho GVHD..."
              value={submitNote}
              onChange={(e) => setSubmitNote(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowSubmitModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Xác nhận nộp bài
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Submit Evidence */}
      <Modal
        isOpen={showEvidenceModal}
        onClose={() => {
          if (!isSubmittingEvidence) setShowEvidenceModal(false);
        }}
        title="Nộp Minh chứng NCKH cộng điểm (Tối đa +2.0đ)"
      >
        <form onSubmit={handleSubmitEvidence} className="space-y-4 text-sm">
          <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-purple-950">
              <Award className="w-4 h-4 text-purple-600" />
              <span>Quy định nộp Minh chứng NCKH</span>
            </div>
            <p className="leading-relaxed text-purple-800">
              Sinh viên có bài báo khoa học (quốc tế/trong nước) hoặc giải thưởng sinh viên NCKH sẽ được cộng điểm thưởng vào Khóa luận (tối đa 2.0đ).
            </p>
            <p className="font-semibold text-purple-950 pt-0.5">
              ⚠️ Yêu cầu bắt buộc: Phải đính kèm tệp minh chứng (PDF chứng nhận / bài báo) HOẶC nhập liên kết / mô tả chi tiết công trình NCKH để Hội đồng thẩm định xét duyệt.
            </p>
          </div>

          <Input
            label="Tiêu đề minh chứng *"
            placeholder="VD: Bài báo hội nghị quốc tế IEEE / Giải Nhất NCKH cấp Trường"
            value={evidenceTitle}
            onChange={(e) => setEvidenceTitle(e.target.value)}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Mô tả chi tiết / Link minh chứng
              </label>
              <span className={`text-[11px] font-medium ${evidenceFile ? 'text-slate-400' : 'text-amber-600'}`}>
                {evidenceFile ? '(Tùy chọn khi đã có file)' : '*(Bắt buộc nếu không có file)'}
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Nhập link bài báo online, mã DOI, tên tạp chí, giải thưởng hoặc mô tả chi tiết công trình NCKH..."
              value={evidenceDesc}
              onChange={(e) => setEvidenceDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Tệp đính kèm (Chứng nhận, Bài báo PDF)
              </label>
              <span className={`text-[11px] font-medium ${evidenceDesc.trim() ? 'text-slate-400' : 'text-amber-600'}`}>
                {evidenceDesc.trim() ? '(Tùy chọn khi đã có mô tả/link)' : '*(Bắt buộc nếu không có mô tả/link)'}
              </span>
            </div>
            <input
              type="file"
              accept=".pdf,.jpg,.png,.zip"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            {evidenceFile && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-purple-700 bg-purple-50/60 px-2.5 py-1 rounded-lg border border-purple-100">
                <span className="truncate font-medium">{evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={() => setEvidenceFile(null)}
                  className="text-rose-600 hover:underline text-[11px] font-semibold ml-2 cursor-pointer"
                >
                  Gỡ bỏ
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingEvidence}
              onClick={() => setShowEvidenceModal(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={isSubmittingEvidence || !evidenceTitle.trim() || (!evidenceFile && !evidenceDesc.trim())}
              className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmittingEvidence ? 'Đang nộp minh chứng...' : 'Nộp minh chứng'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Propose Time for Appointment */}
      <Modal
        isOpen={showProposeTimeModal}
        onClose={() => {
          setShowProposeTimeModal(false);
          setSelectedApptForPropose(null);
        }}
        title="Đề xuất thời gian hẹn mới"
      >
        <form onSubmit={handleProposeTimeSubmit} className="space-y-4 text-sm">
          <p className="text-xs text-slate-500">
            Cuộc hẹn: <b>{selectedApptForPropose?.title}</b>
          </p>
          <Input
            type="datetime-local"
            label="Thời gian đề xuất mới"
            value={proposeTimeInput}
            onChange={(e) => setProposeTimeInput(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ghi chú / Lý do đề xuất đổi giờ
            </label>
            <textarea
              rows={3}
              placeholder="VD: Em bị trùng lịch thi học phần vào khung giờ cũ, kính mong Thầy/Cô dời sang giờ này..."
              value={proposeNoteInput}
              onChange={(e) => setProposeNoteInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowProposeTimeModal(false);
                setSelectedApptForPropose(null);
              }}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Gửi đề xuất
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Bắt buộc cập nhật thông tin khi đăng nhập lần đầu */}
      <Modal
        isOpen={showFirstLoginModal}
        onClose={() => {
          // Bắt buộc, không cho phép đóng khi chưa cập nhật
        }}
        preventClose={true}
        title="CẬP NHẬT THÔNG TIN SINH VIÊN (BẮT BUỘC)"
        subtitle="Vui lòng hoàn tất thông tin cá nhân trong lần đăng nhập đầu tiên để kích hoạt tài khoản"
        maxWidth="2xl"
      >
        <form onSubmit={handleFirstLoginSubmit} className="space-y-5">
          {/* Announcement banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 text-xs text-indigo-950 flex items-start gap-3 shadow-xs">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-indigo-900 text-sm mb-0.5">
                Kích hoạt tài khoản sinh viên lần đầu đăng nhập
              </div>
              <p className="text-indigo-800 leading-relaxed">
                Chào mừng bạn đến với Cổng thông tin Khóa luận Tốt nghiệp Khoa Công nghệ Thông tin (IUH)! Theo quy định đào tạo,
                sinh viên trong lần đăng nhập đầu tiên <b>bắt buộc phải cập nhật và xác thực thông tin liên lạc cá nhân</b> (Số điện thoại, Email cá nhân, Địa chỉ thường trú) để Nhà trường, Bộ môn và Giảng viên hướng dẫn có thể phối hợp, liên hệ và quản lý hồ sơ xuyên suốt đợt khóa luận.
              </p>
            </div>
          </div>

          {/* Readonly info from school */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Thông tin định danh do Nhà trường quản lý (Cố định)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mã số sinh viên (MSSV)</label>
                <div className="text-xs font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  {studentData?.mssv || studentData?.studentCode || user?.mssv || user?.studentProfile?.studentCode || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Họ và tên</label>
                <div className="text-xs font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  {studentData?.hoTen || studentData?.fullName || user?.fullName || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lớp sinh hoạt</label>
                <div className="text-xs font-medium text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                  {studentData?.lop || studentData?.className || user?.studentProfile?.className || 'CNTT K2026'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email trường cấp</label>
                <div className="text-xs font-medium text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 truncate">
                  {studentData?.emailTruong || studentData?.email || user?.email || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Editable contact inputs */}
          <div className="space-y-3.5">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between">
              <span>Thông tin liên lạc bắt buộc cập nhật</span>
              <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-semibold border border-rose-200/60">
                * Bắt buộc điền đủ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Input
                  label="Số điện thoại di động (10 số, bắt đầu bằng 0) *"
                  value={editPhone}
                  onChange={(e) => {
                    setEditPhone(e.target.value);
                    setProfileErrors((prev) => ({ ...prev, phone: validatePhone(e.target.value) }));
                  }}
                  placeholder="VD: 0987654321"
                  error={profileErrors.phone}
                  helperText="Số điện thoại chính để GVHD và Khoa liên hệ khẩn cấp"
                  required
                />
              </div>

              <div>
                <Input
                  label="Email cá nhân phụ (Gmail, Outlook...) *"
                  type="email"
                  value={editPersonalEmail}
                  onChange={(e) => {
                    setEditPersonalEmail(e.target.value);
                    setProfileErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                  }}
                  placeholder="VD: sinhvien@gmail.com"
                  error={profileErrors.email}
                  helperText="Dùng để gửi tài liệu, thông báo đề tài và dự phòng"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Địa chỉ nơi ở / thường trú hiện tại *"
                  value={editAddress}
                  onChange={(e) => {
                    setEditAddress(e.target.value);
                    if (e.target.value.trim()) {
                      setProfileErrors((prev) => ({ ...prev, address: '' }));
                    }
                  }}
                  placeholder="VD: 12 Nguyễn Văn Bảo, Phường 4, Quận Gò Vấp, TP.HCM"
                  error={profileErrors.address}
                  helperText="Địa chỉ cư trú của bạn trong thời gian làm khóa luận"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Thông tin liên lạc khác (Zalo, Telegram, SĐT người thân...)
                </label>
                <input
                  type="text"
                  value={editContactInfo}
                  onChange={(e) => setEditContactInfo(e.target.value)}
                  placeholder="VD: Zalo: 0987654321, SĐT phụ huynh: 0912345678"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              * Bạn có thể chỉnh sửa lại thông tin này tại tab <b>Hồ sơ cá nhân</b> bất kỳ lúc nào.
            </span>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmittingFirstUpdate}
              className="w-full sm:w-auto shrink-0"
            >
              <span>Lưu thông tin & Bắt đầu sử dụng</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

