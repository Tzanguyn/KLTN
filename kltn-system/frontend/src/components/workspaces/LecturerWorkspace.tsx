import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import {
  BookOpen,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  MessageSquare,
  Calendar,
  Award,
  PlusCircle,
  Clock,
  Send,
  Download,
  AlertTriangle,
  UserPlus,
  ExternalLink,
  Edit3,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Filter,
  RotateCcw,
  Bell,
  Trash2,
  Lock,
  Unlock,
  Save,
  ShieldCheck,
  LayoutDashboard,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { LecturerWelcomeView } from '../dashboard/LecturerWelcomeView';
import { WorkspaceSidebar } from './WorkspaceSidebar';

export const LecturerWorkspace: React.FC = () => {
  const { user, setActiveRole, activeTab: storeActiveTab, setActiveTab: setStoreActiveTab } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>(storeActiveTab || 'welcome');
  const isHeadUser = user?.roles?.includes('TRUONG_BO_MON') || user?.role === 'TRUONG_BO_MON';

  useEffect(() => {
    if (storeActiveTab) {
      setActiveTab(storeActiveTab);
      setStoreActiveTab(null);
    }
  }, [storeActiveTab]);

  // State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [myTopics, setMyTopics] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reviewerAssignments, setReviewerAssignments] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [groupScores, setGroupScores] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);

  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicSummary, setTopicSummary] = useState('');
  const [topicObjectives, setTopicObjectives] = useState('');
  const [topicTech, setTopicTech] = useState('');
  const [topicCapacity, setTopicCapacity] = useState(2);

  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [editTopicId, setEditTopicId] = useState('');
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicSummary, setEditTopicSummary] = useState('');
  const [editTopicObjectives, setEditTopicObjectives] = useState('');
  const [editTopicTech, setEditTopicTech] = useState('');
  const [editTopicCapacity, setEditTopicCapacity] = useState(2);

  const [showTopicRegsModal, setShowTopicRegsModal] = useState(false);
  const [selectedTopicForRegs, setSelectedTopicForRegs] = useState<any>(null);
  const [topicRegistrations, setTopicRegistrations] = useState<any[]>([]);
  const [addStudentToTopicId, setAddStudentToTopicId] = useState('');
  const [loadingTopicRegs, setLoadingTopicRegs] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackYeuCauChinhSua, setFeedbackYeuCauChinhSua] = useState(false);

  // Bộ lọc danh sách bài nộp
  const [subFilterGroup, setSubFilterGroup] = useState('');
  const [subFilterStartDate, setSubFilterStartDate] = useState('');
  const [subFilterEndDate, setSubFilterEndDate] = useState('');
  const [subFilterStatus, setSubFilterStatus] = useState('');
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [showApptModal, setShowApptModal] = useState(false);
  const [apptTitle, setApptTitle] = useState('Họp hướng dẫn định kỳ KLTN');
  const [apptMode, setApptMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [apptStartsAt, setApptStartsAt] = useState('');
  const [apptEndsAt, setApptEndsAt] = useState('');
  const [apptLocation, setApptLocation] = useState('');

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreCriterionId, setScoreCriterionId] = useState('');
  const [scoreValue, setScoreValue] = useState('');
  const [scoreNote, setScoreNote] = useState('');

  const [showScoreChangeModal, setShowScoreChangeModal] = useState(false);
  const [scoreChangeReason, setScoreChangeReason] = useState('');

  // 10-Criteria Scoring Form State (Chấm riêng cho từng sinh viên trong nhóm)
  const [scoringFormData, setScoringFormData] = useState<any>(null);
  const [tenScores, setTenScores] = useState<
    Record<string, { value: string; note: string; studentScores?: Record<string, string> }>
  >({});
  const [scoringComment, setScoringComment] = useState('');
  const [savingScores, setSavingScores] = useState(false);

  // Danh sách sinh viên của nhóm đang chấm
  const scoringStudents = React.useMemo(() => {
    if (Array.isArray(scoringFormData?.topic?.students) && scoringFormData.topic.students.length > 0) {
      return scoringFormData.topic.students.map((st: any, idx: number) => ({
        key: st.id || st.userId || st.studentId || st.studentCode || `sv_${idx + 1}`,
        id: st.id || st.userId || st.studentId,
        studentId: st.studentId,
        userId: st.userId || st.id,
        studentCode: st.studentCode || `SV${idx + 1}`,
        fullName: st.fullName || `Sinh viên ${idx + 1}`,
        isLeader: st.isLeader,
      }));
    }
    const grp = myGroups.find((g) => g.id === selectedGroupId);
    if (Array.isArray(grp?.members) && grp.members.length > 0) {
      return grp.members.map((m: any, idx: number) => ({
        key: m.student?.user?.id || m.studentId || m.student?.studentCode || `sv_${idx + 1}`,
        id: m.student?.user?.id || m.studentId,
        studentId: m.studentId,
        userId: m.student?.user?.id,
        studentCode: m.student?.studentCode || `SV${idx + 1}`,
        fullName: m.student?.user?.fullName || `Sinh viên ${idx + 1}`,
        isLeader: m.isLeader,
      }));
    }
    return [
      {
        key: 'sv_1',
        id: 'sv_1',
        studentId: 'sv_1',
        userId: 'sv_1',
        studentCode: 'SV01',
        fullName: 'Sinh viên 1',
        isLeader: true,
      },
    ];
  }, [scoringFormData, myGroups, selectedGroupId]);

  // Tính điểm trung bình riêng cho từng sinh viên theo thời gian thực
  const liveStudentTotals = React.useMemo(() => {
    const criteria = scoringFormData?.criteria || [];
    const count = criteria.length || 10;
    const totals: Record<string, number> = {};

    for (const st of scoringStudents) {
      if (criteria.length === 0) {
        totals[st.key] = 0;
        continue;
      }
      const sum = criteria.reduce((acc: number, c: any) => {
        const row = tenScores[c.code] ?? tenScores[c.id];
        const stRaw =
          row?.studentScores?.[st.key] ??
          (st.userId ? row?.studentScores?.[st.userId] : undefined) ??
          (st.studentId ? row?.studentScores?.[st.studentId] : undefined) ??
          (st.studentCode ? row?.studentScores?.[st.studentCode] : undefined) ??
          row?.value ??
          '0';
        const val = parseFloat(String(stRaw)) || 0;
        return acc + val;
      }, 0);
      totals[st.key] = Math.round((sum / count) * 100) / 100;
    }
    return totals;
  }, [scoringFormData, tenScores, scoringStudents]);

  // Điểm trung bình chung của nhóm (dùng hiển thị tham khảo)
  const liveTotal = React.useMemo(() => {
    const vals = scoringStudents.map((st: any) => liveStudentTotals[st.key] ?? 0);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a: number, b: number) => a + b, 0);
    return Math.round((sum / vals.length) * 100) / 100;
  }, [scoringStudents, liveStudentTotals]);

  const [showMidtermModal, setShowMidtermModal] = useState(false);
  const [midtermGroup, setMidtermGroup] = useState<any>(null);
  const [midtermKetQua, setMidtermKetQua] = useState<'CHO_LAM_TIEP' | 'DUNG_DE_TAI'>('CHO_LAM_TIEP');
  const [midtermLyDo, setMidtermLyDo] = useState('');
  const [midtermSubmitting, setMidtermSubmitting] = useState(false);
  const [midtermWindowInfo, setMidtermWindowInfo] = useState<{ from: string | null; to: string | null; isOpen: boolean } | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [tRes, gRes, subRes, appRes, revRes, comRes, critRes, propRes, midRes, dashRes, officialDashRes] = await Promise.all([
        api.get('/topics/my').catch(() => api.get('/topics/mine')),
        api.get('/groups/mine'),
        api.get('/submissions'),
        api.get('/appointments'),
        api.get('/lecturers/me/review-assignments').catch(() => api.get('/defense/reviewers')),
        api.get('/lecturers/me/committee-assignments').catch(() => api.get('/defense/committees')),
        api.get('/scores/criteria'),
        api.get('/topic-proposals/lecturer').catch(() => null),
        api.get('/midterm-evaluations/my-groups').catch(() => null),
        api.get('/lecturers/me/dashboard').catch(() => null),
        api.get('/dashboard?role=GIANG_VIEN').catch(() => null),
      ]);

      setMyTopics(tRes.data.data ?? []);
      const groups = gRes.data.data ?? [];
      setMyGroups(groups);
      if (groups.length > 0 && !selectedGroupId) {
        const passedGroup = groups.find((g: any) => g.midtermStatus === 'CONTINUE');
        setSelectedGroupId((passedGroup || groups[0]).id);
      }

      const lecDashData = dashRes?.data?.data ?? {};
      const officialDashData = officialDashRes?.data?.data ?? {};
      const mergedDashboard = {
        ...lecDashData,
        ...officialDashData,
        semester: officialDashData?.semester || lecDashData?.semester || null,
        soNhomHuongDan: lecDashData?.soNhomHuongDan ?? officialDashData?.summary?.guidedGroupsCount ?? groups.length,
        maxGroupsQuota: lecDashData?.maxGroupsQuota ?? officialDashData?.summary?.maxGuidingGroups ?? 5,
        choTrong: lecDashData?.choTrong ?? officialDashData?.summary?.remainingGuidingSlots ?? 5,
        phanTramHoanThanhTrungBinh: lecDashData?.phanTramHoanThanhTrungBinh ?? 0,
        soLanNop: lecDashData?.soLanNop,
        canhBaoChamTienDo: lecDashData?.canhBaoChamTienDo ?? [],
        trangThaiGiuaKy: lecDashData?.trangThaiGiuaKy,
      };
      setDashboardData(mergedDashboard);

      if (midRes?.data?.data) {
        const evalWin = midRes.data.data.evaluationWindow;
        setMidtermWindowInfo({
          from: evalWin?.from ?? null,
          to: evalWin?.to ?? null,
          isOpen: midRes.data.data.isEvaluationWindowOpen ?? true,
        });
      }

      setSubmissions(subRes.data.data ?? []);
      setAppointments(appRes.data.data ?? []);
      setReviewerAssignments(revRes.data?.data ?? []);
      setCommittees(comRes.data?.data ?? []);
      setCriteria(critRes.data?.data ?? []);
      if (propRes?.data) {
        setProposals(propRes.data?.data ?? propRes.data ?? []);
      }

      // Load eligible students for add member modal
      try {
        const stdRes = await api.get('/users/students?limit=100&eligible=true');
        setStudentsList(stdRes.data.data.items ?? []);
      } catch {
        // ignore if forbidden
      }
    } catch (err: any) {
      console.error('Error loading lecturer data:', err);
    }
  };

  const loadSubmissions = async (filters?: {
    groupId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) => {
    setLoadingSubmissions(true);
    try {
      const gId = filters?.groupId !== undefined ? filters.groupId : subFilterGroup;
      const sDate = filters?.startDate !== undefined ? filters.startDate : subFilterStartDate;
      const eDate = filters?.endDate !== undefined ? filters.endDate : subFilterEndDate;
      const st = filters?.status !== undefined ? filters.status : subFilterStatus;

      const params: any = {};
      if (gId) params.groupId = gId;
      if (sDate) params.startDate = sDate;
      if (eDate) params.endDate = eDate;
      if (st) params.status = st;

      const res = await api.get('/submissions', { params });
      setSubmissions(res.data.data ?? []);
    } catch (err: any) {
      console.error('Error loading submissions:', err);
      notify('Không thể tải danh sách bài nộp', 'error');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleDownloadSubmission = async (sub: any) => {
    try {
      if (sub.sourceUrl && !sub.fileUrl) {
        window.open(sub.sourceUrl, '_blank');
        return;
      }
      const res = await api.get(`/submissions/${sub.id}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', sub.fileName || `submission-${sub.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      notify('Không thể tải tệp tin bài nộp', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadScoringForm = async (groupId: string) => {
    if (!groupId) return;
    try {
      const res = await api.get(`/scores/scoring-forms/${groupId}`);
      const form = res.data.data;
      setScoringFormData(form);
      if (form?.criteria) {
        const formStudents = form?.topic?.students || [];
        const initScores: Record<
          string,
          { value: string; note: string; studentScores: Record<string, string> }
        > = {};
        form.criteria.forEach((c: any) => {
          const existing = form.existingScores?.find(
            (s: any) => s.criterionId === c.id || s.criterionCode === c.code,
          );
          const stScoresMap: Record<string, string> = {};
          if (existing?.studentScores && typeof existing.studentScores === 'object') {
            for (const [k, v] of Object.entries(existing.studentScores)) {
              if (v !== undefined && v !== null) {
                stScoresMap[k] = String(v);
              }
            }
          }
          formStudents.forEach((st: any, idx: number) => {
            const stKey = st.id || st.userId || st.studentId || st.studentCode || `sv_${idx + 1}`;
            const resolvedVal =
              stScoresMap[stKey] ??
              (st.userId ? stScoresMap[st.userId] : undefined) ??
              (st.studentId ? stScoresMap[st.studentId] : undefined) ??
              (st.studentCode ? stScoresMap[st.studentCode] : undefined) ??
              (existing !== undefined && existing !== null ? String(existing.value) : '');
            stScoresMap[stKey] = resolvedVal;
            if (st.id) stScoresMap[st.id] = resolvedVal;
            if (st.userId) stScoresMap[st.userId] = resolvedVal;
            if (st.studentId) stScoresMap[st.studentId] = resolvedVal;
            if (st.studentCode) stScoresMap[st.studentCode] = resolvedVal;
          });

          initScores[c.code] = {
            value: existing ? String(existing.value) : '',
            note: existing?.note || '',
            studentScores: stScoresMap,
          };
        });
        setTenScores(initScores);
      }
    } catch {
      setScoringFormData(null);
    }
  };

  const fetchChatMessages = async (groupIdToLoad = selectedGroupId) => {
    if (!groupIdToLoad) return;
    try {
      const currentG = myGroups.find((g) => g.id === groupIdToLoad);
      const topicId = currentG?.topicId || currentG?.topic?.id;
      const res = await api.get(`/chat/messages?groupId=${groupIdToLoad}${topicId ? `&topicId=${topicId}` : ''}`);
      const data = res.data?.data ?? [];
      setChatMessages(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setChatMessages([]);
    }
  };

  // When selectedGroupId changes, load chat, scores, and scoring form
  useEffect(() => {
    if (!selectedGroupId) return;
    fetchChatMessages(selectedGroupId);

    api.get(`/scores/groups/${selectedGroupId}`)
      .then((r) => setGroupScores(r.data.data ?? null))
      .catch(() => setGroupScores(null));

    loadScoringForm(selectedGroupId);
  }, [selectedGroupId]);

  // Realtime Socket.io and Polling for Lecturer chat
  useEffect(() => {
    if (activeTab === 'chat' && selectedGroupId) {
      fetchChatMessages(selectedGroupId);

      const socketUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') ?? 'http://localhost:3000';
      const socket = io(`${socketUrl}/chat`, { withCredentials: true });

      socket.emit('joinGroup', selectedGroupId);
      const currentG = myGroups.find((g) => g.id === selectedGroupId);
      const topicId = currentG?.topicId || currentG?.topic?.id;
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

      // Polling dự phòng mỗi 4 giây
      const interval = setInterval(() => {
        fetchChatMessages(selectedGroupId);
      }, 4000);

      return () => {
        clearInterval(interval);
        socket.emit('leaveGroup', selectedGroupId);
        if (topicId) {
          socket.emit('leaveTopic', topicId);
        }
        socket.disconnect();
      };
    }
  }, [activeTab, selectedGroupId]);

  // Create topic
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Find active semester
      const semRes = await api.get('/config/semesters');
      const activeSem = semRes.data.data?.[0];
      if (!activeSem) return notify('Chưa có học kỳ nào mở trong hệ thống', 'error');

      await api.post('/topics', {
        tenDeTai: topicTitle,
        title: topicTitle,
        moTa: topicSummary,
        summary: topicSummary,
        yeuCauSinhVien: topicObjectives,
        objectives: topicObjectives,
        congNghe: topicTech,
        technologies: topicTech,
        soLuongToiDa: Number(topicCapacity),
        capacity: Number(topicCapacity),
        semesterId: activeSem.id,
      });

      notify('Đăng ký đề tài thành công! Chờ Trưởng bộ môn phê duyệt.');
      setShowCreateTopicModal(false);
      setTopicTitle('');
      setTopicSummary('');
      setTopicObjectives('');
      setTopicTech('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi tạo đề tài', 'error');
    }
  };

  // Toggle hide topic from students
  const handleToggleHideTopic = async (topicId: string, isHidden: boolean) => {
    try {
      await api.patch(`/topics/${topicId}/hide`, { isHidden });
      notify(
        isHidden
          ? 'Đã ẩn đề tài khỏi danh sách hiển thị cho sinh viên!'
          : 'Đã hiển thị lại đề tài cho sinh viên!',
      );
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi thay đổi trạng thái ẩn đề tài', 'error');
    }
  };

  // Open Edit Topic modal
  const openEditTopicModal = (topic: any) => {
    setEditTopicId(topic.id);
    setEditTopicTitle(topic.tenDeTai || topic.title || '');
    setEditTopicSummary(topic.moTa || topic.summary || '');
    setEditTopicObjectives(topic.yeuCauSinhVien || topic.yeuCau || topic.objectives || '');
    setEditTopicTech(topic.congNghe || topic.technologies || '');
    setEditTopicCapacity(topic.soLuongToiDa || topic.capacity || 2);
    setShowEditTopicModal(true);
  };

  // Submit topic update
  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTopicId) return;
    try {
      await api.patch(`/topics/${editTopicId}`, {
        tenDeTai: editTopicTitle,
        title: editTopicTitle,
        moTa: editTopicSummary,
        summary: editTopicSummary,
        yeuCauSinhVien: editTopicObjectives,
        objectives: editTopicObjectives,
        congNghe: editTopicTech,
        technologies: editTopicTech,
        soLuongToiDa: Number(editTopicCapacity),
        capacity: Number(editTopicCapacity),
      });

      notify('Cập nhật đề tài thành công! (Nếu có thay đổi nội dung, đề tài sẽ được chuyển sang Chờ duyệt lại)');
      setShowEditTopicModal(false);
      setEditTopicId('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi cập nhật đề tài', 'error');
    }
  };

  // Open Topic Registrations modal
  const openTopicRegistrationsModal = async (topic: any) => {
    setSelectedTopicForRegs(topic);
    setShowTopicRegsModal(true);
    setLoadingTopicRegs(true);
    setAddStudentToTopicId('');
    try {
      const res = await api.get(`/topics/${topic.id}/registrations`);
      setTopicRegistrations(res.data.data?.data ?? res.data.data ?? []);
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi tải danh sách sinh viên đăng ký', 'error');
      setTopicRegistrations([]);
    } finally {
      setLoadingTopicRegs(false);
    }
  };

  // Add student to topic
  const handleAddStudentToTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicForRegs || !addStudentToTopicId) return;
    try {
      await api.post(`/topics/${selectedTopicForRegs.id}/add-student`, {
        studentId: addStudentToTopicId,
      });
      notify('Đã thêm sinh viên vào đề tài thành công!');
      setAddStudentToTopicId('');
      // Reload registrations for this topic
      const res = await api.get(`/topics/${selectedTopicForRegs.id}/registrations`);
      setTopicRegistrations(res.data.data?.data ?? res.data.data ?? []);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi thêm sinh viên vào đề tài', 'error');
    }
  };

  // Midterm evaluation modal helpers
  const openMidtermModal = (group: any, defaultStatus: 'CHO_LAM_TIEP' | 'DUNG_DE_TAI' = 'CHO_LAM_TIEP') => {
    setMidtermGroup(group);
    setMidtermKetQua(defaultStatus);
    setMidtermLyDo(group.midtermNote || '');
    setShowMidtermModal(true);
  };

  const handleMidtermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!midtermGroup) return;
    const evaluatedGroupId = midtermGroup.id;
    const evaluatedGroupCode = midtermGroup.code;
    setMidtermSubmitting(true);
    try {
      await api.post('/midterm-evaluations', {
        groupId: evaluatedGroupId,
        ketQua: midtermKetQua,
        lyDo: midtermLyDo.trim() || undefined,
      });
      notify(
        midtermKetQua === 'CHO_LAM_TIEP'
          ? `Đã xác nhận qua giữa kỳ (CHO LÀM TIẾP) cho nhóm ${evaluatedGroupCode}. Hệ thống đã mở chức năng nhập điểm KLTN!`
          : `Đã xác nhận giữa kỳ cho nhóm ${evaluatedGroupCode}: DỪNG ĐỀ TÀI`,
      );
      setShowMidtermModal(false);
      setMidtermGroup(null);
      setMidtermLyDo('');
      await loadData();
      if (selectedGroupId === evaluatedGroupId) {
        await loadScoringForm(evaluatedGroupId);
      }
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi đánh giá giữa kỳ', 'error');
    } finally {
      setMidtermSubmitting(false);
    }
  };

  // Decide student proposal (GV_DA_DUYET | TU_CHOI)
  const handleDecideProposal = async (proposalId: string, status: 'GV_DA_DUYET' | 'TU_CHOI') => {
    let reason: string | undefined = undefined;
    if (status === 'TU_CHOI') {
      const inputReason = prompt('Nhập lý do từ chối đề xuất đề tài của sinh viên:');
      if (inputReason === null) return;
      reason = inputReason.trim() || 'Chưa phù hợp với định hướng nghiên cứu của GVHD';
    }
    try {
      await api.patch(`/topic-proposals/${proposalId}/decision`, { status, reason });
      notify(
        status === 'GV_DA_DUYET'
          ? 'Đã xác nhận đồng ý hướng dẫn! Đề tài đã được chuyển tới Trưởng bộ môn để phê duyệt chính thức.'
          : 'Đã từ chối đề xuất đề tài.',
      );
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xử lý đề xuất', 'error');
    }
  };

  // Add member to group
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedStudentId) return;
    try {
      await api.post(`/groups/${selectedGroupId}/members`, { studentId: selectedStudentId });
      notify('Đã thêm sinh viên vào nhóm!');
      setShowAddMemberModal(false);
      setSelectedStudentId('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể thêm thành viên', 'error');
    }
  };

  // Remove member from group
  const handleRemoveMember = async (groupId: string, studentId: string, studentName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa sinh viên "${studentName}" khỏi nhóm này?`)) return;
    try {
      await api.delete(`/groups/${groupId}/members/${studentId}`);
      notify(`Đã xóa sinh viên ${studentName} khỏi nhóm!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xóa sinh viên khỏi nhóm', 'error');
    }
  };

  // Transfer member between GVHD's groups
  const handleTransferMember = async (fromGroupId: string, studentId: string, studentName: string) => {
    const otherGroups = myGroups.filter((g) => g.id !== fromGroupId && g.status !== 'CANCELLED');
    if (otherGroups.length === 0) {
      return notify('Bạn chưa có nhóm hướng dẫn nào khác để chuyển sinh viên sang', 'error');
    }
    const optionsText = otherGroups.map((g) => `${g.code} (${g.name})`).join(', ');
    const targetCodeOrId = prompt(
      `Chuyển sinh viên "${studentName}" sang nhóm nào?\nNhập mã nhóm đích (${optionsText}):`,
      otherGroups[0].code,
    );
    if (!targetCodeOrId) return;
    const targetGroup = otherGroups.find(
      (g) => g.code.toLowerCase() === targetCodeOrId.trim().toLowerCase() || g.id === targetCodeOrId.trim(),
    );
    if (!targetGroup) {
      return notify(`Không tìm thấy nhóm có mã "${targetCodeOrId}" trong danh sách nhóm của bạn`, 'error');
    }
    try {
      await api.post(`/groups/${fromGroupId}/transfer-member`, {
        studentId,
        targetGroupId: targetGroup.id,
      });
      notify(`Đã chuyển sinh viên ${studentName} sang nhóm ${targetGroup.code} thành công!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi chuyển nhóm cho sinh viên', 'error');
    }
  };

  // Cancel / Archive topic
  const handleCancelTopic = async (topicId: string, topicTitle: string) => {
    if (!confirm(`Bạn có chắc chắn muốn hủy / lưu trữ đề tài "${topicTitle}"?`)) return;
    try {
      await api.delete(`/topics/${topicId}`);
      notify('Đã hủy đề tài thành công!');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Không thể hủy đề tài', 'error');
    }
  };

  // Send feedback
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId || !feedbackContent.trim()) return;
    try {
      await api.post(`/submissions/${selectedSubId}/feedback`, {
        content: feedbackContent.trim(),
        yeuCauChinhSua: feedbackYeuCauChinhSua,
      });
      notify(
        feedbackYeuCauChinhSua
          ? 'Đã gửi yêu cầu chỉnh sửa cho sinh viên!'
          : 'Đã gửi nhận xét cho sinh viên!',
      );
      setShowFeedbackModal(false);
      setFeedbackContent('');
      setFeedbackYeuCauChinhSua(false);
      loadSubmissions();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi gửi phản hồi', 'error');
    }
  };

  // Send chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedGroupId) return;
    try {
      const currentG = myGroups.find((g) => g.id === selectedGroupId);
      const topicId = currentG?.topicId || currentG?.topic?.id;
      const res = await api.post('/chat/messages', {
        groupId: selectedGroupId,
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
      notify(err.response?.data?.message ?? 'Lỗi gửi tin nhắn', 'error');
    }
  };

  // Create appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return notify('Vui lòng chọn nhóm trước', 'error');
    try {
      await api.post('/appointments', {
        groupId: selectedGroupId,
        title: apptTitle,
        mode: apptMode,
        startsAt: new Date(apptStartsAt).toISOString(),
        endsAt: new Date(apptEndsAt).toISOString(),
        location: apptLocation || (apptMode === 'ONLINE' ? 'Google Meet' : 'Phòng làm việc'),
      });
      notify('Đã đặt lịch hẹn với nhóm thành công!');
      setShowApptModal(false);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi đặt lịch', 'error');
    }
  };

  // Remind appointment
  const handleRemindAppointment = async (apptId: string) => {
    try {
      await api.post(`/appointments/${apptId}/remind`);
      notify('Đã gửi thông báo nhắc nhở lịch hẹn cho sinh viên!');
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi khi gửi nhắc nhở', 'error');
    }
  };

  // Cancel appointment
  const handleCancelAppointment = async (apptId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này không?')) return;
    try {
      await api.delete(`/appointments/${apptId}`);
      notify('Đã hủy lịch hẹn thành công!');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi khi hủy lịch hẹn', 'error');
    }
  };

  // Enter Score (Single Legacy)
  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !scoreCriterionId || !scoreValue) return;
    try {
      await api.post('/scores', {
        groupId: selectedGroupId,
        criterionId: scoreCriterionId,
        value: Number(scoreValue),
        note: scoreNote,
      });
      notify('Đã lưu điểm tiêu chí thành công!');
      setShowScoreModal(false);
      setScoreValue('');
      setScoreNote('');
      const res = await api.get(`/scores/groups/${selectedGroupId}`);
      setGroupScores(res.data.data);
      loadScoringForm(selectedGroupId);
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi nhập điểm', 'error');
    }
  };

  // Save 10-criteria batch scores (Draft or Lock)
  const handleSaveBatchScores = async (isDraft: boolean) => {
    if (!selectedGroupId || !scoringFormData) return;
    if (!isDraft) {
      const confirmLock = window.confirm(
        'Bạn có chắc chắn muốn KHÓA ĐIỂM chính thức không?\n\nSau khi khóa, giảng viên KHÔNG ĐƯỢC tự ý sửa điểm mà phải gửi yêu cầu mở khóa đến Trưởng bộ môn.',
      );
      if (!confirmLock) return;
    }

    try {
      setSavingScores(true);
      const scoresPayload = scoringFormData.criteria.map((c: any) => {
        const row = tenScores[c.code] ?? tenScores[c.id];
        const studentScoresPayload: Record<string, number> = {};
        const numericVals: number[] = [];

        scoringStudents.forEach((st: any) => {
          const rawStVal =
            row?.studentScores?.[st.key] ??
            (st.userId ? row?.studentScores?.[st.userId] : undefined) ??
            (st.studentId ? row?.studentScores?.[st.studentId] : undefined) ??
            (st.studentCode ? row?.studentScores?.[st.studentCode] : undefined) ??
            row?.value ??
            '0';
          const numVal = Math.min(Math.max(parseFloat(String(rawStVal)) || 0, 0), 10);
          studentScoresPayload[st.key] = numVal;
          if (st.id) studentScoresPayload[st.id] = numVal;
          if (st.userId) studentScoresPayload[st.userId] = numVal;
          if (st.studentId) studentScoresPayload[st.studentId] = numVal;
          if (st.studentCode) studentScoresPayload[st.studentCode] = numVal;
          numericVals.push(numVal);
        });

        const avgCriterionScore =
          numericVals.length > 0
            ? Math.round((numericVals.reduce((a, b) => a + b, 0) / numericVals.length) * 100) / 100
            : parseFloat(row?.value ?? '0') || 0;

        return {
          tieuChiId: c.code,
          score: avgCriterionScore,
          studentScores: studentScoresPayload,
          note: row?.note ?? '',
        };
      });

      const res = await api.post('/scores', {
        topicId: scoringFormData.topic?.id,
        groupId: selectedGroupId,
        role: scoringFormData.role || 'HUONG_DAN',
        scores: scoresPayload,
        isDraft,
        generalComment: scoringComment,
      });

      notify(res.data.message || (isDraft ? 'Đã lưu nháp điểm thành công!' : 'Đã nộp và khóa điểm chính thức!'));
      await loadScoringForm(selectedGroupId);
      const scoresRes = await api.get(`/scores/groups/${selectedGroupId}`);
      setGroupScores(scoresRes.data.data);
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi khi lưu điểm', 'error');
    } finally {
      setSavingScores(false);
    }
  };

  // Request score modification / unlock from HOD
  const handleRequestScoreChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !scoreChangeReason.trim()) return;
    try {
      const g = myGroups.find((item) => item.id === selectedGroupId);
      const rev = reviewerAssignments.find((r) => (r.groupId || r.id) === selectedGroupId);
      const topicId =
        scoringFormData?.topic?.id ||
        g?.topicId ||
        g?.topic?.id ||
        rev?.topicId ||
        selectedGroupId;

      await api.post(`/scores/${topicId}/unlock-request`, {
        reason: scoreChangeReason,
        groupId: selectedGroupId,
      });
      notify('Đã gửi đề xuất mở khóa sửa điểm đến Trưởng bộ môn!');
      setShowScoreChangeModal(false);
      setScoreChangeReason('');
      await loadScoringForm(selectedGroupId);
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi gửi đề xuất', 'error');
    }
  };

  // Download official evaluation form PDF
  const handleDownloadPdf = async () => {
    if (!selectedGroupId) return;
    try {
      const topicId = scoringFormData?.topic?.id || selectedGroupId;
      const res = await api.get(`/scores/${topicId}/export-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `phieu-danh-gia-${topicId.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Đã xuất phiếu điểm PDF thành công!');
    } catch {
      notify('Không thể tải file PDF', 'error');
    }
  };

  const maxGroupsQuota = user?.lecturerProfile?.maxGroups ?? 5;
  const currentGroupsCount = myGroups.length;
  const isOverload = currentGroupsCount >= maxGroupsQuota;

  const currentGroup = myGroups.find((g) => g.id === selectedGroupId);
  const effectiveMidtermStatus =
    currentGroup?.midtermStatus ||
    scoringFormData?.midtermStatus ||
    scoringFormData?.topic?.group?.midtermStatus ||
    (reviewerAssignments.some((r) => (r.groupId || r.id) === selectedGroupId) ||
    committees.some((c) => c.schedules?.some((s: any) => s.group?.id === selectedGroupId))
      ? 'CONTINUE'
      : 'PENDING');
  const isMidtermPassed = effectiveMidtermStatus === 'CONTINUE';

  const navItems = [
    { id: 'welcome', label: 'Tổng quan & Chào mừng', icon: LayoutDashboard },
    { id: 'groups', label: 'Nhóm hướng dẫn', icon: Users, count: myGroups.length },
    { id: 'topics', label: 'Đề tài của tôi', icon: BookOpen, count: myTopics.length },
    { id: 'submissions', label: 'Báo cáo SV & Nhận xét', icon: FileText, count: submissions.length },
    { id: 'chat', label: 'Trao đổi nhóm', icon: MessageSquare },
    { id: 'appointments', label: 'Lịch hẹn', icon: Calendar, count: appointments.length },
    { id: 'defense', label: 'Phản biện & Hội đồng', icon: Award, count: reviewerAssignments.length },
    { id: 'scores', label: 'Chấm điểm & Xuất PDF', icon: Edit3 },
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
        <WorkspaceSidebar
          title="Chức năng Giảng viên"
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId)}
          themeColor="emerald"
          infoCard={
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-100/80 text-xs text-emerald-950 space-y-2">
              <div className="font-bold flex items-center justify-between text-emerald-800">
                <span>Hạn mức Hướng dẫn</span>
                <Badge variant={isOverload ? 'danger' : 'success'} size="sm">
                  {isOverload ? 'Đạt hạn mức' : `Còn ${maxGroupsQuota - currentGroupsCount} chỗ`}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-600">
                Đang hướng dẫn: <strong className="text-emerald-700 font-bold">{currentGroupsCount}</strong> / {maxGroupsQuota} nhóm
              </div>
            </div>
          }
        />

        {/* NỘI DUNG CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* Tab 0: Welcome Dashboard */}
          {activeTab === 'welcome' && (
            <LecturerWelcomeView
              onNavigate={(tab) => setActiveTab(tab)}
              workspaceData={{
                myTopics,
                myGroups,
                submissions,
                reviewerAssignments,
                committees,
                proposals,
                dashboardData,
              }}
            />
          )}

          {activeTab !== 'welcome' && (
            <>
              {/* Header & Quota Dashboard */}
              <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                  <span>Cổng Giảng viên KLTN</span>
                  <span>•</span>
                  <span>{user?.lecturerProfile?.title ?? 'ThS.'} {user?.fullName}</span>
                </div>
                <h2 className="text-2xl font-bold mt-1 text-white">Không gian Giảng dạy & Hướng dẫn</h2>
                <p className="text-emerald-100 text-sm mt-1">
                  Chuyên ngành: {user?.lecturerProfile?.specialization ?? 'Công nghệ thông tin'}
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur border border-white/20 p-3.5 rounded-xl">
                <div>
                  <div className="text-xs text-emerald-200">Hạn mức nhóm hướng dẫn</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xl font-bold text-white">
                      {currentGroupsCount} / {maxGroupsQuota}
                    </span>
                    <span className="text-xs text-emerald-100">nhóm</span>
                  </div>
                </div>
                {isOverload ? (
                  <Badge variant="danger" size="sm">Đạt hạn mức</Badge>
                ) : (
                  <Badge variant="success" size="sm">Còn {maxGroupsQuota - currentGroupsCount} chỗ</Badge>
                )}
              </div>
            </div>
          </div>

          {/* 5 KPI DASHBOARD CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Card 1: Số nhóm hướng dẫn */}
            <Card className="p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nhóm hướng dẫn</span>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {dashboardData?.soNhomHuongDan ?? myGroups.length}
                  </span>
                  <span className="text-xs text-slate-500">
                    / {dashboardData?.maxGroupsQuota ?? maxGroupsQuota} tối đa
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant={isOverload ? 'danger' : 'success'} size="sm">
                    {isOverload ? 'Đạt hạn mức' : `Còn ${dashboardData?.choTrong ?? (maxGroupsQuota - myGroups.length)} chỗ`}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Card 2: % Tiến độ TB */}
            <Card className="p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tiến độ trung bình</span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-emerald-700">
                    {dashboardData?.phanTramHoanThanhTrungBinh ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, dashboardData?.phanTramHoanThanhTrungBinh ?? 0))}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* Card 3: Số lần nộp bài */}
            <Card className="p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lượt nộp báo cáo</span>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">
                  {dashboardData?.soLanNop?.tong ?? submissions.length}
                  <span className="text-xs font-normal text-slate-500 ml-1">lượt</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-emerald-700 font-bold">{dashboardData?.soLanNop?.daDuyet ?? 0} duyệt</span>
                  <span>•</span>
                  <span className="text-rose-600 font-semibold">{dashboardData?.soLanNop?.canChinhSua ?? 0} cần sửa</span>
                  <span>•</span>
                  <span className="text-amber-700 font-semibold">{dashboardData?.soLanNop?.dangXem ?? 0} đang xem</span>
                </div>
              </div>
            </Card>

            {/* Card 4: Cảnh báo chậm tiến độ */}
            <Card
              onClick={() => setActiveTab('groups')}
              className="p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cảnh báo chậm</span>
                <div className={`p-2 rounded-lg ${(dashboardData?.canhBaoChamTienDo?.length ?? 0) > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${(dashboardData?.canhBaoChamTienDo?.length ?? 0) > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                    {dashboardData?.canhBaoChamTienDo?.length ?? 0}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">nhóm</span>
                </div>
                <div className="mt-2">
                  <Badge variant={(dashboardData?.canhBaoChamTienDo?.length ?? 0) > 0 ? 'danger' : 'success'} size="sm">
                    {(dashboardData?.canhBaoChamTienDo?.length ?? 0) > 0 ? 'Cần chú ý' : 'An toàn'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Card 5: Trạng thái giữa kỳ */}
            <Card className="p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đánh giá giữa kỳ</span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-emerald-700">
                  {dashboardData?.trangThaiGiuaKy?.choLamTiep ?? 0}
                  <span className="text-xs font-normal text-slate-500 ml-1">tiếp tục</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  {dashboardData?.trangThaiGiuaKy?.chuaDanhGia ?? 0} chờ duyệt • {dashboardData?.trangThaiGiuaKy?.dungDeTai ?? 0} dừng
                </div>
              </div>
            </Card>
          </div>

          {/* CẢNH BÁO CHẬM TIẾN ĐỘ CHI TIẾT - CHỈ HIỂN THỊ Ở TAB NHÓM HƯỚNG DẪN */}
          {activeTab === 'groups' && dashboardData?.canhBaoChamTienDo && dashboardData.canhBaoChamTienDo.length > 0 && (
            <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Danh sách cảnh báo tiến độ nhóm KLTN ({dashboardData.canhBaoChamTienDo.length} nhóm)</span>
                </div>
                <Badge variant="danger" size="sm">Cần nhắc nhở</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dashboardData.canhBaoChamTienDo.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {item.groupCode}
                        </span>
                        <Badge variant={item.severity === 'HIGH' ? 'danger' : 'warning'} size="sm">
                          {item.severity === 'HIGH' ? 'Mức cao' : 'Mức trung bình'}
                        </Badge>
                      </div>
                      <div className="text-xs text-rose-700 font-semibold mt-1.5 flex items-start gap-1">
                        <span>•</span>
                        <span>{item.reason}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-1">
                        Đề tài: {item.topicTitle}
                      </div>
                    </div>
                    <div className="flex justify-end pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(item.groupId);
                          setActiveTab('submissions');
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <span>Xem chi tiết bài nộp</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 1: Guided Groups & Midterm Evaluation */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Midterm Evaluation Window Banner */}
          {midtermWindowInfo && (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                midtermWindowInfo.isOpen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className={`w-5 h-5 ${midtermWindowInfo.isOpen ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <div className="font-bold text-sm">Khung thời gian xác nhận giữa kỳ KLTN</div>
                  <div className="text-xs opacity-80">
                    {midtermWindowInfo.from
                      ? new Date(midtermWindowInfo.from).toLocaleDateString('vi-VN')
                      : 'Đang mở'}
                    {' — '}
                    {midtermWindowInfo.to
                      ? new Date(midtermWindowInfo.to).toLocaleDateString('vi-VN')
                      : 'Không giới hạn'}
                  </div>
                </div>
              </div>
              <Badge variant={midtermWindowInfo.isOpen ? 'success' : 'warning'}>
                {midtermWindowInfo.isOpen ? 'Đang mở xác nhận' : 'Ngoài thời hạn xác nhận'}
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Danh sách các nhóm KLTN đang hướng dẫn ({myGroups.length})
            </h3>
            {myGroups.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setShowAddMemberModal(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" /> Thêm sinh viên vào nhóm
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myGroups.map((group) => (
              <Card
                key={group.id}
                className={`p-5 flex flex-col justify-between cursor-pointer border-2 transition-all ${
                  selectedGroupId === group.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
                }`}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="primary">{group.code}</Badge>
                    <Badge
                      variant={
                        group.midtermStatus === 'CONTINUE'
                          ? 'success'
                          : group.midtermStatus === 'STOPPED'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {group.midtermStatus === 'CONTINUE'
                        ? 'Cho làm tiếp'
                        : group.midtermStatus === 'STOPPED'
                        ? 'Đã dừng'
                        : 'Chờ giữa kỳ'}
                    </Badge>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base line-clamp-1">{group.name}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    Đề tài: <b>{group.topic?.title ?? 'Chưa liên kết đề tài'}</b>
                  </p>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500">Thành viên ({group.members?.length ?? 0}):</div>
                    {group.members?.map((m: any) => (
                      <div key={m.studentId} className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-xs text-slate-700 space-y-1">
                        <div className="flex items-center justify-between font-semibold text-slate-900 gap-1 flex-wrap">
                          <span>{m.student?.user?.fullName ?? 'Sinh viên'} ({m.student?.studentCode})</span>
                          <div className="flex items-center gap-1">
                            {m.isLeader && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">Nhóm trưởng</span>}
                            {myGroups.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTransferMember(group.id, m.studentId, m.student?.user?.fullName || m.student?.studentCode);
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold"
                                title="Chuyển sinh viên sang nhóm khác của bạn"
                              >
                                Chuyển nhóm
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(group.id, m.studentId, m.student?.user?.fullName || m.student?.studentCode);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold"
                              title="Xóa sinh viên khỏi nhóm"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50">
                          <div>📞 SĐT: <b className="text-slate-800 font-medium">{m.student?.user?.phone || 'Chưa cập nhật'}</b></div>
                          <div>✉️ Email: <b className="text-slate-800 font-medium">{m.student?.personalEmail || m.student?.user?.email || 'N/A'}</b></div>
                          {m.student?.address && <div className="sm:col-span-2 truncate">📍 Đ/c: <span className="text-slate-700">{m.student.address}</span></div>}
                          {m.student?.contactInfo && <div className="sm:col-span-2 truncate text-indigo-600">💬 {m.student.contactInfo}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {group.midtermAt && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 space-y-0.5">
                      <div>
                        <b>Đã xác nhận:</b> {new Date(group.midtermAt).toLocaleString('vi-VN')}
                      </div>
                      {group.midtermNote && (
                        <div>
                          <b>Ghi chú:</b> {group.midtermNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {group.midtermStatus === 'PENDING' ? 'Đánh giá GK:' : 'Xử lý lại GK:'}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMidtermModal(group, 'CHO_LAM_TIEP');
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        title={
                          group.midtermStatus === 'STOPPED'
                            ? 'Xử lý lại giữa kỳ: Mở lại đề tài cho nhóm tiếp tục thực hiện và chấm điểm'
                            : 'Xác nhận cho nhóm tiếp tục làm KLTN'
                        }
                      >
                        {group.midtermStatus === 'STOPPED' ? 'Mở lại (Cho tiếp)' : 'Tiếp tục'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMidtermModal(group, 'DUNG_DE_TAI');
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                        title="Xác nhận hoặc xử lý lại giữa kỳ: Dừng đề tài"
                      >
                        Dừng
                      </button>
                    </div>
                  </div>

                  {group.midtermStatus === 'CONTINUE' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupId(group.id);
                          loadScoringForm(group.id);
                          setScoreChangeReason('');
                          setShowScoreChangeModal(true);
                        }}
                        className="text-xs flex items-center gap-1.5 border-amber-300 text-amber-800 hover:text-amber-900 hover:bg-amber-50 font-semibold"
                        title="Gửi yêu cầu mở khóa sửa điểm tới Trưởng bộ môn"
                      >
                        <Unlock className="w-3.5 h-3.5 text-amber-600" />
                        Yêu cầu mở khóa điểm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupId(group.id);
                          setActiveTab('scores');
                        }}
                        className="text-xs flex items-center gap-1 border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <Award className="w-3.5 h-3.5 text-emerald-600" />
                        Chấm / Xem điểm
                      </Button>
                    </div>
                  ) : group.midtermStatus === 'STOPPED' ? (
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                      Đã dừng đề tài giữa kỳ (Không chấm điểm)
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      Xác nhận qua GK (Tiếp tục) để mở nhập điểm
                    </span>
                  )}
                </div>
              </Card>
            ))}

            {myGroups.length === 0 && (
              <div className="col-span-3 p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                Chưa có nhóm KLTN nào được chỉ định cho bạn. Khi sinh viên đăng ký đề tài và được chấp thuận, nhóm sẽ xuất hiện ở đây.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Topics Management */}
      {activeTab === 'topics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Danh sách đề tài của tôi ({myTopics.length})
            </h3>
            <Button size="sm" variant="primary" onClick={() => setShowCreateTopicModal(true)}>
              <PlusCircle className="w-4 h-4 mr-1.5" /> Đăng ký đề tài mới
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {myTopics.map((topic) => {
              const capacity = topic.capacity ?? topic.soLuongToiDa ?? 0;
              const registeredCount = topic.soLuongDaDangKy ?? 0;
              const remainingSlots = topic.soChoConLai ?? Math.max(0, capacity - registeredCount);
              const officialCount = topic.soLuongChinhThuc ?? 0;
              const isEditable = topic.choPhepChinhSua ?? topic.isEditable ?? (topic.status !== 'ARCHIVED' && officialCount === 0);

              return (
                <Card key={topic.id} className="p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            topic.status === 'APPROVED'
                              ? 'success'
                              : topic.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {topic.status === 'APPROVED' ? 'Đã duyệt' : topic.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
                        </Badge>
                        {topic.isHidden && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Đã ẩn khỏi SV
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                            remainingSlots > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          Đã ĐK: <b>{registeredCount}</b>/{capacity} • Còn trống: <b>{remainingSlots}</b>
                        </span>
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-slate-900">{topic.tenDeTai || topic.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-3">{topic.moTa || topic.summary || 'Chưa có tóm tắt'}</p>

                    {(topic.yeuCauSinhVien || topic.yeuCau || topic.objectives) && (
                      <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-semibold text-slate-700">Yêu cầu SV: </span>
                        <span>{topic.yeuCauSinhVien || topic.yeuCau || topic.objectives}</span>
                      </div>
                    )}

                    {topic.rejectionReason && (
                      <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg text-xs border border-rose-200">
                        <b>Lý do từ chối:</b> {topic.rejectionReason}
                      </div>
                    )}

                    {officialCount > 0 && (
                      <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                        ✓ Đã có <b>{officialCount}</b> sinh viên đăng ký chính thức
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div>
                      <span>Công nghệ: <b className="text-slate-700">{topic.technologies || topic.congNghe || 'Tùy chọn'}</b></span>
                      {topic.semester?.code && <span className="ml-2 text-slate-400">• HK: {topic.semester.code}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTopicRegistrationsModal(topic)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 cursor-pointer transition-colors"
                        title="Xem danh sách sinh viên đăng ký & Thêm sinh viên"
                      >
                        <Users className="w-3.5 h-3.5" /> SV đăng ký ({registeredCount})
                      </button>

                      {isEditable ? (
                        <>
                          <button
                            onClick={() => openEditTopicModal(topic)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition-colors"
                            title="Chỉnh sửa thông tin đề tài"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Sửa đề tài
                          </button>
                          <button
                            onClick={() => handleCancelTopic(topic.id, topic.tenDeTai || topic.title)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-colors"
                            title="Hủy / lưu trữ đề tài (khi chưa có nhóm thực hiện)"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hủy đề tài
                          </button>
                        </>
                      ) : (
                        <span
                          className="text-[11px] text-slate-400 italic px-2 py-0.5 rounded bg-slate-50 border border-slate-200"
                          title="Không thể sửa sau khi đã có sinh viên đăng ký chính thức hoặc sau thời hạn đăng ký"
                        >
                          Đã khóa sửa
                        </span>
                      )}

                      {topic.status === 'APPROVED' && (
                        <button
                          onClick={() => handleToggleHideTopic(topic.id, !topic.isHidden)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            topic.isHidden
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                          }`}
                          title={topic.isHidden ? 'Hiển thị lại đề tài cho sinh viên' : 'Ẩn đề tài này khỏi sinh viên'}
                        >
                          {topic.isHidden ? (
                            <>
                              <Eye className="w-3.5 h-3.5" /> Hiện đề tài
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" /> Ẩn đề tài
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}

            {myTopics.length === 0 && (
              <div className="col-span-2 p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                Bạn chưa tạo đề tài KLTN nào. Nhấn "Đăng ký đề tài mới" để gửi đề xuất lên Trưởng bộ môn.
              </div>
            )}
          </div>

          {/* Student Topic Proposals Section */}
          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Đề xuất đề tài từ Sinh viên ({proposals.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sinh viên liên hệ trước và gửi ý tưởng đề tài mong muốn bạn làm Giảng viên hướng dẫn
                </p>
              </div>
              <Badge variant={proposals.filter((p) => p.status === 'CHO_GV_XAC_NHAN').length > 0 ? 'warning' : 'neutral'}>
                {proposals.filter((p) => p.status === 'CHO_GV_XAC_NHAN').length} chờ duyệt
              </Badge>
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Chưa có sinh viên nào gửi đề xuất đề tài trực tiếp cho bạn.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {proposals.map((prop) => (
                    <div key={prop.id} className="py-4 space-y-3">
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
                              ? 'GVHD đã đồng ý hướng dẫn (Trưởng BM phê duyệt đề tài)'
                              : prop.status === 'TU_CHOI'
                              ? 'Đã từ chối'
                              : 'Chờ bạn xác nhận hướng dẫn (CHO_GV_XAC_NHAN)'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(prop.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {prop.student?.user && (
                          <div className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                            Sinh viên đề xuất: <b className="text-slate-800">{prop.student.user.fullName}</b> (MSSV: {prop.student.studentCode} - {prop.student.user.email})
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{prop.tenDeTai}</h4>
                        <div className="text-xs text-slate-600 space-y-1 bg-slate-50/70 p-3 rounded-lg border border-slate-100 mt-1.5">
                          <div>
                            <span className="font-semibold text-slate-700">Mô tả: </span>
                            <span>{prop.moTa}</span>
                          </div>
                          {prop.yeuCau && (
                            <div>
                              <span className="font-semibold text-slate-700">Yêu cầu / Công nghệ: </span>
                              <span>{prop.yeuCau}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {prop.rejectionReason && (
                        <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg text-xs border border-rose-200">
                          <b>Lý do bạn từ chối:</b> {prop.rejectionReason}
                        </div>
                      )}

                      {prop.status === 'CHO_GV_XAC_NHAN' && (
                        <div className="flex items-center justify-end gap-2.5 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                            onClick={() => handleDecideProposal(prop.id, 'TU_CHOI')}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Từ chối đề xuất
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            className="text-xs flex items-center gap-1"
                            onClick={() => handleDecideProposal(prop.id, 'GV_DA_DUYET')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Chấp nhận hướng dẫn
                          </Button>
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

      {/* TAB 3: Submissions & Feedback */}
      {activeTab === 'submissions' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Bài nộp tiến độ & Tài liệu của Sinh viên
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem, tải file báo cáo, kiểm tra tiến độ và phản hồi/yêu cầu chỉnh sửa cho sinh viên.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm">
                {submissions.length} bài nộp
              </Badge>
            </div>
          </CardHeader>

          {/* Thanh bộ lọc theo Nhóm và Thời gian */}
          <div className="p-4 bg-slate-50/80 border-y border-slate-200 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              {/* Lọc theo nhóm */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nhóm KLTN
                </label>
                <select
                  value={subFilterGroup}
                  onChange={(e) => {
                    setSubFilterGroup(e.target.value);
                    loadSubmissions({ groupId: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Tất cả các nhóm</option>
                  {myGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} - {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lọc theo ngày bắt đầu */}
              <div className="w-36">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={subFilterStartDate}
                  onChange={(e) => {
                    setSubFilterStartDate(e.target.value);
                    loadSubmissions({ startDate: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Lọc theo ngày kết thúc */}
              <div className="w-36">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={subFilterEndDate}
                  onChange={(e) => {
                    setSubFilterEndDate(e.target.value);
                    loadSubmissions({ endDate: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Lọc theo trạng thái */}
              <div className="w-44">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Trạng thái
                </label>
                <select
                  value={subFilterStatus}
                  onChange={(e) => {
                    setSubFilterStatus(e.target.value);
                    loadSubmissions({ status: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="CHUA_XEM">Chưa xem (CHUA_XEM)</option>
                  <option value="UNDER_REVIEW">Đang xem xét (UNDER_REVIEW)</option>
                  <option value="REVISION_REQUIRED">Yêu cầu sửa lại (REVISION_REQUIRED)</option>
                  <option value="ACCEPTED">Đã duyệt (ACCEPTED)</option>
                </select>
              </div>

              {/* Nút đặt lại bộ lọc */}
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSubFilterGroup('');
                    setSubFilterStartDate('');
                    setSubFilterEndDate('');
                    setSubFilterStatus('');
                    loadSubmissions({ groupId: '', startDate: '', endDate: '', status: '' });
                  }}
                  className="h-[34px] px-3 text-xs text-slate-600 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Đặt lại
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="pt-4">
            {loadingSubmissions ? (
              <div className="py-12 text-center text-xs text-slate-500">Đang tải danh sách bài nộp...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <div key={sub.id} className="py-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                            v{sub.version || 1}
                          </span>
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
                              ? 'Yêu cầu sửa lại'
                              : sub.status === 'REJECTED'
                              ? 'Từ chối'
                              : sub.status}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {sub.group?.code || 'Nhóm'} • {sub.group?.topic?.title || sub.group?.name || 'Đề tài KLTN'}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({new Date(sub.submittedAt).toLocaleString('vi-VN')})
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          Người nộp: <b>{sub.submitter?.fullName ?? 'Sinh viên'}</b>
                          {sub.submitter?.email && <span className="text-slate-400"> ({sub.submitter.email})</span>}
                          {sub.type && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">{sub.type}</span>}
                        </div>

                        {/* File download button & External link */}
                        <div className="flex items-center gap-3 text-xs pt-1">
                          {sub.fileName && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSubmission(sub)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{sub.fileName}</span>
                              {sub.fileSize && (
                                <span className="text-indigo-400 font-normal">
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Link tài liệu / Demo</span>
                            </a>
                          )}
                        </div>

                        {sub.note && (
                          <div className="p-2 bg-slate-50 text-xs text-slate-600 rounded border border-slate-200/60 mt-1">
                            <span className="font-semibold text-slate-700">Ghi chú từ SV: </span>
                            {sub.note}
                          </div>
                        )}

                        {/* Phản hồi đã gửi */}
                        {sub.feedbacks?.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {sub.feedbacks.map((fb: any) => (
                              <div
                                key={fb.id}
                                className={`p-2.5 rounded-lg text-xs border ${
                                  sub.status === 'REVISION_REQUIRED'
                                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold mb-0.5">
                                  <span>{fb.author?.fullName || 'Giảng viên'}:</span>
                                  <span className="font-normal text-[11px] opacity-75">
                                    {new Date(fb.createdAt).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <p className="text-slate-800">{fb.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 self-start sm:self-center">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setSelectedSubId(sub.id);
                            setFeedbackYeuCauChinhSua(sub.status === 'REVISION_REQUIRED');
                            setShowFeedbackModal(true);
                          }}
                        >
                          Nhận xét & Phản hồi
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {submissions.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Không tìm thấy bài nộp nào phù hợp với bộ lọc.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Realtime Chat with Group */}
      {activeTab === 'chat' && (
        <Card className="h-[650px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="px-3 py-1.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
                >
                  {myGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} - {g.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">Trao đổi trực tiếp nhóm</span>
              </div>
              {currentGroup?.topic?.title && (
                <div className="text-xs text-slate-600">
                  <strong className="text-slate-800">Đề tài:</strong> {currentGroup.topic.title}
                </div>
              )}
              {currentGroup?.members && currentGroup.members.length > 0 && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-700">Sinh viên hướng dẫn ({currentGroup.members.length}):</span>
                  {currentGroup.members.map((m: any, idx: number) => (
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
                onClick={() => fetchChatMessages(selectedGroupId)}
                className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
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
              const isStudent =
                senderRoles.includes('SINH_VIEN') ||
                currentGroup?.members?.some((m: any) => m.student?.userId === msg.senderId);
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 text-[11px] mb-1 px-1">
                    <span className="font-medium text-slate-600">
                      {isMe ? 'Bạn (GVHD)' : (msg.sender?.fullName ?? 'Thành viên')}
                    </span>
                    {isMe ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-700 font-semibold">GVHD</span>
                    ) : isStudent ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 text-blue-700 font-semibold">Sinh viên</span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 font-semibold">Khác</span>
                    )}
                  </div>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-xs ${
                      isMe
                        ? 'bg-emerald-700 text-white rounded-tr-none'
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
                Chưa có tin nhắn nào trong nhóm này. Hãy bắt đầu trao đổi với sinh viên!
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex gap-3">
            <input
              type="text"
              placeholder="Nhập nội dung trao đổi hoặc hướng dẫn..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <Button type="submit" variant="primary" className="bg-emerald-700 hover:bg-emerald-800">
              <Send className="w-4 h-4 mr-1.5" /> Gửi
            </Button>
          </form>
        </Card>
      )}

      {/* TAB 5: Appointments */}
      {activeTab === 'appointments' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Lịch hẹn trao đổi với Sinh viên
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý các buổi hẹn, gửi nhắc nhở hoặc hủy lịch hẹn khi có thay đổi.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setShowApptModal(true)}>
              Đặt lịch hẹn mới
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {appointments.map((appt) => (
                <div key={appt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          appt.status === 'CONFIRMED'
                            ? 'success'
                            : appt.status === 'CANCELLED'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {appt.status === 'CONFIRMED'
                          ? 'Đã xác nhận'
                          : appt.status === 'CANCELLED'
                          ? 'Đã hủy'
                          : appt.status === 'PROPOSED'
                          ? 'Chờ xác nhận'
                          : appt.status}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {appt.mode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-700">
                        Nhóm: {appt.group?.code || ''} - {appt.group?.name}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{appt.title}</h4>
                    {appt.description && (
                      <p className="text-xs text-slate-600">{appt.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-indigo-600 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(appt.startsAt).toLocaleString('vi-VN')} -{' '}
                        {new Date(appt.endsAt).toLocaleTimeString('vi-VN')}
                      </span>
                      <span>•</span>
                      <span>
                        {appt.mode === 'ONLINE' ? (
                          appt.meetingUrl || appt.location ? (
                            <a
                              href={appt.meetingUrl || appt.location}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Link họp trực tuyến
                            </a>
                          ) : (
                            'Chưa có link họp'
                          )
                        ) : (
                          `Phòng: ${appt.location || 'Văn phòng bộ môn'}`
                        )}
                      </span>
                    </div>
                  </div>

                  {appt.status !== 'CANCELLED' && (
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemindAppointment(appt.id)}
                        className="text-xs text-indigo-600 hover:bg-indigo-50 border-indigo-200 flex items-center gap-1"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Nhắc nhở
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelAppointment(appt.id)}
                        className="text-xs text-rose-600 hover:bg-rose-50 border-rose-200 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hủy lịch
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">Chưa có lịch hẹn nào được thiết lập.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: Defense & Reviewer Assignments */}
      {activeTab === 'defense' && (
        <div className="space-y-8">
          {/* SECTION A: GVPB ASSIGNMENTS */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  Nhiệm vụ Giảng viên Phản biện (GVPB) ({reviewerAssignments.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Danh sách các nhóm KLTN được Khoa / Bộ môn phân công làm phản biện chính hoặc phản biện độc lập
                </p>
              </div>
              <Badge variant="purple" size="sm">
                Được phân công: {reviewerAssignments.length} nhóm
              </Badge>
            </div>

            {reviewerAssignments.length === 0 ? (
              <Card className="p-8 text-center bg-white border border-slate-200 text-xs text-slate-400 space-y-1">
                <Award className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <div className="font-semibold text-slate-600">Bạn chưa được phân công phản biện nhóm KLTN nào trong đợt này.</div>
                <div>Khi Trưởng bộ môn phân công phản biện, danh sách nhóm và tài liệu khóa luận sẽ xuất hiện tại đây.</div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {reviewerAssignments.map((rev) => (
                  <Card key={rev.id || rev.groupId} className="p-5 flex flex-col justify-between bg-white border border-slate-200/90 shadow-xs space-y-4">
                    <div className="space-y-3">
                      {/* Card Header: Group code, Type, Scoring status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{rev.groupCode || rev.group?.code}</span>
                          <span className="text-xs text-slate-500">• {rev.groupName || rev.group?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="purple" size="sm">
                            {rev.type === 'PRIMARY' ? 'Phản biện chính' : 'Phản biện phụ'}
                          </Badge>
                          {rev.scoring?.isLocked ? (
                            <Badge variant="neutral" size="sm" className="bg-purple-100 text-purple-800 border-purple-200">
                              <Lock className="w-3 h-3 mr-1 inline" /> Đã khóa: {rev.scoring.totalScore}đ
                            </Badge>
                          ) : rev.scoring?.hasScored ? (
                            <Badge variant="warning" size="sm">
                              Bản nháp: {rev.scoring.totalScore}đ
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Chưa chấm
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Topic Title & Tech */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đề tài KLTN</div>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {rev.topic?.title || rev.group?.topic?.title || 'Đề tài KLTN'}
                        </h4>
                        {rev.topic?.summary && (
                          <p className="text-xs text-slate-600 line-clamp-2 mt-1">{rev.topic.summary}</p>
                        )}
                        {rev.topic?.technologies && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {rev.topic.technologies.split(',').map((tech: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                                {tech.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Supervisor Info (GVHD) */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Cán bộ Hướng dẫn (GVHD):</div>
                        <div className="font-semibold text-slate-900 flex items-center justify-between">
                          <span>{rev.supervisor?.fullName || 'Chưa cập nhật'}</span>
                          <div className="flex items-center gap-3 text-slate-500 font-normal">
                            {rev.supervisor?.email && (
                              <a href={`mailto:${rev.supervisor.email}`} className="hover:text-emerald-700 flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                <span>{rev.supervisor.email}</span>
                              </a>
                            )}
                            {rev.supervisor?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{rev.supervisor.phone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Members */}
                      {rev.members && rev.members.length > 0 && (
                        <div className="text-xs space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Sinh viên thực hiện:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {rev.members.map((m: any) => (
                              <span key={m.id} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs flex items-center gap-1">
                                <b>{m.fullName}</b> ({m.studentCode}) {m.isLeader && <span className="text-emerald-700 text-[10px] font-bold">• Nhóm trưởng</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Defense Schedule (if scheduled) */}
                      {rev.defenseSchedule && (
                        <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-xs space-y-1 text-indigo-950">
                          <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Lịch bảo vệ: {new Date(rev.defenseSchedule.startsAt).toLocaleString('vi-VN')}</span>
                          </div>
                          <div className="text-[11px] text-indigo-700">
                            Phòng: <b>{rev.defenseSchedule.room || 'Văn phòng bộ môn'}</b>
                            {rev.defenseSchedule.committeeName && ` • Hội đồng: ${rev.defenseSchedule.committeeName}`}
                          </div>
                        </div>
                      )}

                      {/* Latest Submission File */}
                      {rev.latestSubmission ? (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="truncate">
                            <div className="text-[10px] font-bold uppercase text-emerald-800">Tài liệu KLTN nộp gần nhất:</div>
                            <div className="font-bold text-emerald-950 truncate">{rev.latestSubmission.fileName || 'Báo cáo KLTN'}</div>
                            <div className="text-[10px] text-emerald-700">
                              Nộp lúc: {new Date(rev.latestSubmission.submittedAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadSubmission(rev.latestSubmission)}
                            className="text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-100 shrink-0 flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Tải về đọc
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Nhóm chưa nộp bản báo cáo khóa luận.</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        Phân công lúc: {new Date(rev.assignedAt).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const gId = rev.groupId || rev.id;
                            setSelectedGroupId(gId);
                            loadScoringForm(gId);
                            setScoreChangeReason('');
                            setShowScoreChangeModal(true);
                          }}
                          className="text-xs flex items-center gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                          title="Gửi yêu cầu mở khóa sửa điểm phản biện tới Trưởng bộ môn"
                        >
                          <Unlock className="w-3.5 h-3.5 text-amber-600" />
                          Yêu cầu mở khóa
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setSelectedGroupId(rev.groupId || rev.id);
                            setActiveTab('scores');
                          }}
                          className="text-xs flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Chấm điểm Phản biện
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: DEFENSE COMMITTEES WITH STRICT ANTI-CONFLICT */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Hội đồng Bảo vệ KLTN ({committees.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Danh sách các phiên bảo vệ hội đồng được phân công đánh giá
                </p>
              </div>
              <Badge variant="primary" size="sm">
                Tham gia: {committees.length} hội đồng
              </Badge>
            </div>

            {/* Anti-Conflict Notice */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 text-xs flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-emerald-900">Quy tắc Chống xung đột lợi ích (Conflict-of-Interest Filter):</span>
                <p className="text-emerald-800">
                  Hệ thống tự động loại trừ 100% các nhóm KLTN do chính Quý Thầy/Cô làm Giảng viên hướng dẫn (GVHD) khỏi danh sách ca bảo vệ và chấm điểm của Thầy/Cô. Thầy/Cô chỉ đánh giá các nhóm độc lập do giảng viên khác hướng dẫn nhằm đảm bảo tính công bằng và minh bạch tuyệt đối.
                </p>
              </div>
            </div>

            {committees.length === 0 ? (
              <Card className="p-8 text-center bg-white border border-slate-200 text-xs text-slate-400 space-y-1">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <div className="font-semibold text-slate-600">Chưa có danh sách hội đồng bảo vệ.</div>
                <div>Khi Khoa/Bộ môn ban hành quyết định thành lập hội đồng, lịch bảo vệ sẽ hiển thị tại đây.</div>
              </Card>
            ) : (
              <div className="space-y-6">
                {committees.map((com) => (
                  <Card key={com.committeeId || com.id} className="p-5 bg-white border border-slate-200/90 shadow-xs space-y-4">
                    {/* Committee Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">{com.committeeName || com.name}</h4>
                          {com.myRole && (
                            <Badge variant="purple" size="sm">
                              Vai trò: {com.myRole}
                            </Badge>
                          )}
                        </div>
                        {com.antiConflictProtected && (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 inline" />
                            Đã bảo vệ chống xung đột: Loại trừ {com.excludedGuidedGroupsCount} nhóm tự hướng dẫn khỏi danh sách chấm
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">
                          Ca đánh giá: <b className="text-indigo-700">{com.schedules?.length ?? 0}</b>
                        </span>
                      </div>
                    </div>

                    {/* Members Chips */}
                    {com.members && com.members.length > 0 && (
                      <div className="text-xs space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Thành viên Hội đồng:</div>
                        <div className="flex flex-wrap gap-2">
                          {com.members.map((m: any, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{m.fullName || m.user?.fullName}</span>
                              <span className="text-indigo-600 font-medium">({m.role})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evaluated Schedules (Strictly Non-Guided Groups) */}
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Các ca bảo vệ thuộc Hội đồng ({com.schedules?.length ?? 0})
                      </div>

                      {(!com.schedules || com.schedules.length === 0) ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                          Chưa có lịch bảo vệ cho hội đồng này, hoặc toàn bộ nhóm thuộc ca bảo vệ đã được loại trừ do Thầy/Cô là GVHD.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {com.schedules.map((sched: any) => (
                            <div key={sched.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge variant="primary">{sched.group?.code || 'Nhóm'}</Badge>
                                  <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {new Date(sched.startsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(sched.endsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                <div>
                                  <div className="text-xs font-bold text-slate-900">
                                    {sched.group?.topic?.title || sched.group?.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    GVHD: <b>{sched.group?.supervisor?.fullName || 'Giảng viên khác'}</b>
                                  </div>
                                </div>

                                <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200/60">
                                  <span>Phòng: <b>{sched.room || 'Hội trường KLTN'}</b></span>
                                  <span>
                                    {sched.hasScored ? (
                                      <Badge variant="success" size="sm">Đã chấm điểm</Badge>
                                    ) : (
                                      <Badge variant="neutral" size="sm">Chưa chấm</Badge>
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                {sched.latestSubmission ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadSubmission(sched.latestSubmission)}
                                    className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Tải báo cáo</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Chưa nộp file</span>
                                )}

                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    if (sched.group?.id) {
                                      setSelectedGroupId(sched.group.id);
                                      setActiveTab('scores');
                                    }
                                  }}
                                  className="text-xs bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3 py-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5 mr-1" />
                                  Chấm điểm Hội đồng
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: Scoring & PDF Export (10 Tiêu chí KLTN) */}
      {activeTab === 'scores' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="p-2 bg-emerald-100/70 text-emerald-800 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Chấm điểm Khóa luận tốt nghiệp (10 Tiêu chí)
                  </h3>
                  <div className="text-xs text-slate-500">
                    Đề tài: <b className="text-slate-800">{scoringFormData?.topic?.title || currentGroup?.name || 'Chọn nhóm'}</b>
                  </div>
                </div>

                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                >
                  <optgroup label="Nhóm hướng dẫn">
                    {myGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} - {g.name} (
                        {g.midtermStatus === 'CONTINUE'
                          ? 'Đã qua GK - Cho làm tiếp'
                          : g.midtermStatus === 'STOPPED'
                          ? 'Đã dừng GK'
                          : 'Chờ xác nhận GK'}
                        )
                      </option>
                    ))}
                  </optgroup>
                  {reviewerAssignments.length > 0 && (
                    <optgroup label="Nhóm phản biện">
                      {reviewerAssignments.map((r) => (
                        <option key={r.groupId || r.id} value={r.groupId || r.id}>
                          {r.groupCode || r.group?.code || 'PB'} - {r.topicTitle || r.group?.name || 'Phản biện'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="purple" size="sm">
                  {scoringFormData?.role === 'PHAN_BIEN'
                    ? 'Cán bộ Phản biện'
                    : scoringFormData?.role === 'HOI_DONG'
                    ? 'Thành viên Hội đồng'
                    : 'Cán bộ Hướng dẫn'}
                </Badge>

                {!isMidtermPassed ? (
                  effectiveMidtermStatus === 'STOPPED' ? (
                    <Badge variant="danger" size="sm">
                      ĐÃ DỪNG ĐỀ TÀI GIỮA KỲ
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      CHƯA XÁC NHẬN QUA GIỮA KỲ
                    </Badge>
                  )
                ) : (
                  <>
                    {scoringFormData?.existingScores?.some((s: any) => s.status === 'OPENED') ? (
                      <Badge variant="success" size="sm">
                        <Unlock className="w-3.5 h-3.5 mr-1 inline" /> ĐÃ MỞ KHÓA SỬA
                        {scoringFormData?.existingScores?.find((s: any) => s.unlockedUntil)?.unlockedUntil && (
                          <span className="ml-1 text-[10px]">
                            (đến {new Date(scoringFormData.existingScores.find((s: any) => s.unlockedUntil).unlockedUntil).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </Badge>
                    ) : (scoringFormData?.isLocked || !scoringFormData?.canEdit || scoringFormData?.existingScores?.some((s: any) => s.status === 'LOCKED' || s.status === 'SUBMITTED')) ? (
                      <Badge variant="neutral" size="sm" className="bg-purple-100 text-purple-900 border-purple-200">
                        <Lock className="w-3.5 h-3.5 mr-1 inline" /> ĐÃ KHÓA ĐIỂM
                      </Badge>
                    ) : scoringFormData?.existingScores?.length > 0 ? (
                      <Badge variant="warning" size="sm">
                        BẢN NHÁP (DRAFT)
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        CHƯA CHẤM
                      </Badge>
                    )}

                    <Button size="sm" variant="outline" onClick={handleDownloadPdf} className="text-xs flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-slate-600" />
                      Xuất biểu mẫu PDF
                    </Button>

                    {/* NÚT YÊU CẦU MỞ KHÓA ĐIỂM TRÊN HEADER */}
                    {scoringFormData?.unlockRequest?.status === 'PENDING' ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="warning" size="sm" className="bg-amber-100 text-amber-900 border-amber-300">
                          <Clock className="w-3.5 h-3.5 mr-1 inline" /> Chờ TBM duyệt
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50 flex items-center gap-1 font-semibold"
                          onClick={() => {
                            setScoreChangeReason(scoringFormData?.unlockRequest?.reason || '');
                            setShowScoreChangeModal(true);
                          }}
                          title="Xem / Sửa lý do đề xuất mở khóa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Sửa lý do
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 font-bold flex items-center gap-1.5 shadow-xs"
                        onClick={() => {
                          setScoreChangeReason(scoringFormData?.unlockRequest?.reason || '');
                          setShowScoreChangeModal(true);
                        }}
                        title="Gửi yêu cầu mở khóa sửa điểm đến Trưởng bộ môn"
                      >
                        <Unlock className="w-3.5 h-3.5 text-amber-600" />
                        Yêu cầu mở khóa điểm
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {!isMidtermPassed ? (
                effectiveMidtermStatus === 'STOPPED' ? (
                  <div className="p-6 bg-rose-50/90 border border-rose-200 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-rose-950">
                          Nhóm đã dừng thực hiện đề tài ở giai đoạn Giữa kỳ (DỪNG ĐỀ TÀI)
                        </h4>
                        <p className="text-xs text-rose-800 leading-relaxed">
                          Nhóm <b>{currentGroup?.code || scoringFormData?.topic?.group?.code}</b> đã được Giảng viên hướng dẫn xác nhận{' '}
                          <b>DỪNG ĐỀ TÀI</b> ở đánh giá giữa kỳ, vì vậy hệ thống khóa biểu mẫu nhập điểm KLTN. Nếu Quý Thầy/Cô muốn cập nhật lại quyết định giữa kỳ sang{' '}
                          <b>CHO LÀM TIẾP</b> để nhóm tiếp tục thực hiện và mở nhập điểm, vui lòng xác nhận lại bên dưới.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 pl-11">
                      {currentGroup && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                          onClick={() => openMidtermModal(currentGroup, 'CHO_LAM_TIEP')}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Xác nhận lại: CHO LÀM TIẾP (Mở nhập điểm)
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => setActiveTab('groups')}
                      >
                        Quay lại Nhóm hướng dẫn
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-amber-950">
                          Chưa xác nhận kết quả Đánh giá Giữa kỳ — Chưa mở biểu mẫu nhập điểm
                        </h4>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Nhóm <b>{currentGroup?.code || scoringFormData?.topic?.group?.code || 'hiện tại'}</b> đang ở trạng thái{' '}
                          <b>Chờ đánh giá giữa kỳ</b>. Theo đúng quy trình KLTN, Giảng viên hướng dẫn cần xác nhận nhóm đạt yêu cầu qua giữa kỳ (
                          <b>CHO LÀM TIẾP</b>) trước khi hệ thống tiến hành hiển thị biểu mẫu nhập điểm 10 tiêu chí.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 pl-11">
                      {currentGroup && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            onClick={() => openMidtermModal(currentGroup, 'CHO_LAM_TIEP')}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Xác nhận qua Giữa kỳ: CHO LÀM TIẾP (Mở nhập điểm ngay)
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="text-xs font-bold flex items-center gap-1.5"
                            onClick={() => openMidtermModal(currentGroup, 'DUNG_DE_TAI')}
                          >
                            Dừng đề tài giữa kỳ
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => setActiveTab('groups')}
                      >
                        Quay lại Nhóm hướng dẫn
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className="px-3.5 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Nhóm đã được xác nhận qua Giữa kỳ (<b>CHO LÀM TIẾP</b>) — Đủ điều kiện nhập điểm đánh giá KLTN.
                      </span>
                    </div>
                    {(currentGroup?.midtermAt || scoringFormData?.topic?.group?.midtermAt) && (
                      <span className="text-[11px] text-emerald-700">
                        Xác nhận GK lúc:{' '}
                        {new Date(currentGroup?.midtermAt || scoringFormData?.topic?.group?.midtermAt).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>
              {/* Cảnh báo khi yêu cầu bị từ chối */}
              {scoringFormData?.unlockRequest?.status === 'REJECTED' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Yêu cầu mở khóa trước đó đã bị Trưởng bộ môn từ chối:</span>
                      <p className="text-rose-700 mt-0.5">
                        Lý do từ chối: "{scoringFormData.unlockRequest.rejectReason || 'Chưa cung cấp đủ minh chứng hợp lệ'}"
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
                    onClick={() => {
                      setScoreChangeReason(scoringFormData.unlockRequest?.reason || '');
                      setShowScoreChangeModal(true);
                    }}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Gửi lại yêu cầu mở khóa
                  </Button>
                </div>
              )}

              {/* Cảnh báo khi điểm đã khóa hoặc đang có yêu cầu mở khóa */}
              {(scoringFormData?.isLocked || !scoringFormData?.canEdit || scoringFormData?.existingScores?.some((s: any) => s.status === 'LOCKED' || s.status === 'SUBMITTED')) &&
                !scoringFormData?.existingScores?.some((s: any) => s.status === 'OPENED') && (
                  <div className="p-4 bg-purple-50/90 border border-purple-200 rounded-xl text-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <Lock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-purple-900">Điểm của nhóm này đã được khóa chính thức.</span>
                          <p className="text-purple-700 mt-0.5 leading-relaxed">
                            Theo quy chế đánh giá KLTN, điểm đã khóa không thể tự ý chỉnh sửa nhằm đảm bảo tính minh bạch.
                            Nếu cần điều chỉnh hoặc bổ sung điểm, Quý Thầy/Cô vui lòng gửi yêu cầu giải trình tới Trưởng bộ môn.
                          </p>
                        </div>
                      </div>

                      {scoringFormData?.unlockRequest?.status !== 'PENDING' && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
                          onClick={() => setShowScoreChangeModal(true)}
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Gửi yêu cầu mở khóa điểm
                        </Button>
                      )}
                    </div>

                    {scoringFormData?.unlockRequest && scoringFormData.unlockRequest.status === 'PENDING' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Yêu cầu mở khóa đang chờ Trưởng bộ môn phê duyệt (Gửi lúc:{' '}
                            {new Date(scoringFormData.unlockRequest.createdAt).toLocaleString('vi-VN')} - Lý do: "
                            {scoringFormData.unlockRequest.reason}")
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-amber-800 border-amber-300 hover:bg-amber-100 shrink-0 self-start sm:self-auto"
                          onClick={() => setShowScoreChangeModal(true)}
                        >
                          Sửa lý do
                        </Button>
                      </div>
                    )}
                  </div>
                )}

              {/* Thông tin Sinh viên thực hiện (Chấm riêng cho từng sinh viên) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Thông tin Sinh viên được đánh giá riêng biệt ({scoringStudents.length} sinh viên)</span>
                  </div>
                  {scoringStudents.length > 1 && !(scoringFormData?.isLocked && !scoringFormData?.canEdit) && (
                    <button
                      type="button"
                      onClick={() => {
                        const firstSt = scoringStudents[0];
                        if (!firstSt) return;
                        setTenScores((prev) => {
                          const next = { ...prev };
                          for (const code of Object.keys(next)) {
                            const row = next[code];
                            const sv1Val =
                              row?.studentScores?.[firstSt.key] ??
                              (firstSt.userId ? row?.studentScores?.[firstSt.userId] : undefined) ??
                              (firstSt.studentId ? row?.studentScores?.[firstSt.studentId] : undefined) ??
                              row?.value ??
                              '';
                            const updatedStScores: Record<string, string> = { ...(row?.studentScores || {}) };
                            scoringStudents.forEach((st: any) => {
                              updatedStScores[st.key] = String(sv1Val);
                              if (st.id) updatedStScores[st.id] = String(sv1Val);
                              if (st.userId) updatedStScores[st.userId] = String(sv1Val);
                              if (st.studentId) updatedStScores[st.studentId] = String(sv1Val);
                              if (st.studentCode) updatedStScores[st.studentCode] = String(sv1Val);
                            });
                            next[code] = {
                              ...row,
                              value: String(sv1Val),
                              studentScores: updatedStScores,
                            };
                          }
                          return next;
                        });
                        notify('Đã sao chép điểm từ Sinh viên 1 sang các sinh viên còn lại trong nhóm!');
                      }}
                      className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Sao chép nhanh điểm SV1 → SV2
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {scoringStudents.map((st: any, idx: number) => (
                    <div
                      key={st.key}
                      className="px-3.5 py-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div>
                        <div className="text-slate-500">
                          Họ tên sinh viên {idx + 1}:{' '}
                          <b className="text-slate-900 text-sm">{st.fullName}</b>
                          {st.isLeader && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              Nhóm trưởng
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Mã số sinh viên: <b className="font-mono text-slate-800">{st.studentCode}</b>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Điểm TB SV{idx + 1}</div>
                        <div className="text-base font-black text-emerald-700">
                          {(liveStudentTotals[st.key] ?? 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bảng 10 tiêu chí chấm điểm riêng cho từng sinh viên */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-emerald-600" />
                    Bảng chi tiết 10 tiêu chí đánh giá KLTN (Chấm riêng từng sinh viên)
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    Thang điểm 10 • Điểm trung bình mỗi SV = Trung bình cộng 10 tiêu chí LO của SV đó
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th rowSpan={2} className="p-3 w-14 text-center border-r border-slate-200">
                          STT
                        </th>
                        <th rowSpan={2} className="p-3 border-r border-slate-200">
                          LO
                        </th>
                        <th
                          colSpan={scoringStudents.length}
                          className="p-2 text-center border-b border-r border-slate-200 bg-emerald-50/60 text-emerald-950"
                        >
                          Kết quả đánh giá (Thang điểm 10)
                        </th>
                        <th rowSpan={2} className="p-3 w-52">
                          Ghi chú / Nhận xét
                        </th>
                      </tr>
                      <tr>
                        {scoringStudents.map((st: any, idx: number) => (
                          <th
                            key={st.key}
                            className="p-2.5 w-44 text-center border-r border-slate-200 bg-emerald-50/30"
                          >
                            <div className="text-xs font-extrabold text-slate-900">
                              Sinh viên {idx + 1}
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-800 normal-case truncate max-w-[160px] mx-auto">
                              {st.fullName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 normal-case">
                              MSSV: {st.studentCode}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scoringFormData?.criteria?.map((c: any, index: number) => {
                        const isLocked = scoringFormData?.isLocked && !scoringFormData?.canEdit;
                        const rowData = tenScores[c.code];
                        const currentNote = rowData?.note ?? '';

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 text-center font-mono font-bold text-slate-700 border-r border-slate-100">
                              {String(index + 1).padStart(2, '0')}
                            </td>
                            <td className="p-3 border-r border-slate-100">
                              <div className="font-semibold text-slate-900 leading-relaxed">{c.name}</div>
                            </td>
                            {scoringStudents.map((st: any, stIdx: number) => {
                              const stVal =
                                rowData?.studentScores?.[st.key] ??
                                (st.userId ? rowData?.studentScores?.[st.userId] : undefined) ??
                                (st.studentId ? rowData?.studentScores?.[st.studentId] : undefined) ??
                                (st.studentCode ? rowData?.studentScores?.[st.studentCode] : undefined) ??
                                rowData?.value ??
                                '';
                              return (
                                <td key={st.key} className="p-2.5 border-r border-slate-100">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder={`Điểm SV${stIdx + 1} (0-10)`}
                                    value={stVal}
                                    disabled={isLocked}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setTenScores((prev) => {
                                        const prevRow = prev[c.code] || { value: '', note: '', studentScores: {} };
                                        const nextStScores: Record<string, string> = {
                                          ...(prevRow.studentScores || {}),
                                          [st.key]: val,
                                        };
                                        if (st.id) nextStScores[st.id] = val;
                                        if (st.userId) nextStScores[st.userId] = val;
                                        if (st.studentId) nextStScores[st.studentId] = val;
                                        if (st.studentCode) nextStScores[st.studentCode] = val;

                                        const nums = scoringStudents
                                          .map((member: any) =>
                                            parseFloat(
                                              nextStScores[member.key] ??
                                                (member.userId ? nextStScores[member.userId] : undefined) ??
                                                prevRow.value ??
                                                '0',
                                            ),
                                          )
                                          .filter((n: number) => !isNaN(n));
                                        const avgStr =
                                          nums.length > 0
                                            ? String(
                                                Math.round(
                                                  (nums.reduce((a: number, b: number) => a + b, 0) / nums.length) *
                                                    100,
                                                ) / 100,
                                              )
                                            : val;

                                        return {
                                          ...prev,
                                          [c.code]: {
                                            ...prevRow,
                                            value: avgStr,
                                            note: prevRow.note || '',
                                            studentScores: nextStScores,
                                          },
                                        };
                                      });
                                    }}
                                    className={`w-full px-2.5 py-1.5 text-center font-bold text-sm rounded-lg border focus:outline-none transition-all ${
                                      isLocked
                                        ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                        : 'bg-white text-emerald-800 border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-sm'
                                    }`}
                                  />
                                </td>
                              );
                            })}
                            <td className="p-2.5">
                              <input
                                type="text"
                                placeholder="Ghi chú đánh giá..."
                                value={currentNote}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const note = e.target.value;
                                  setTenScores((prev) => ({
                                    ...prev,
                                    [c.code]: {
                                      ...prev[c.code],
                                      value: prev[c.code]?.value || '',
                                      note,
                                      studentScores: prev[c.code]?.studentScores || {},
                                    },
                                  }));
                                }}
                                className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none transition-all ${
                                  isLocked
                                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                    : 'bg-white border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-sm'
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                      <tr className="border-b border-slate-200">
                        <td colSpan={2} className="p-3 text-center uppercase tracking-wider text-sm border-r border-slate-200">
                          ĐIỂM TRUNG BÌNH
                        </td>
                        {scoringStudents.map((st: any) => {
                          const stTotal = liveStudentTotals[st.key] ?? 0;
                          return (
                            <td
                              key={st.key}
                              className="p-3 text-center text-base font-black text-emerald-700 border-r border-slate-200"
                            >
                              {stTotal.toFixed(2)} / 10
                            </td>
                          );
                        })}
                        <td className="p-3 text-xs text-slate-500 font-normal">
                          Trung bình cộng 10 LO từng SV
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="p-3 text-center uppercase tracking-wider text-sm border-r border-slate-200">
                          KẾT QUẢ
                        </td>
                        {scoringStudents.map((st: any) => {
                          const stTotal = liveStudentTotals[st.key] ?? 0;
                          const isPass = stTotal >= 5.0;
                          return (
                            <td key={st.key} className="p-3 border-r border-slate-200">
                              <div className="flex flex-col items-start gap-1.5 text-xs font-bold pl-2">
                                <label className="inline-flex items-center gap-2 text-emerald-800">
                                  <input
                                    type="checkbox"
                                    checked={isPass}
                                    readOnly
                                    className="rounded text-emerald-600 w-4 h-4"
                                  />
                                  <span>Đạt</span>
                                </label>
                                <label className="inline-flex items-center gap-2 text-rose-800">
                                  <input
                                    type="checkbox"
                                    checked={stTotal > 0 && !isPass}
                                    readOnly
                                    className="rounded text-rose-600 w-4 h-4"
                                  />
                                  <span>Không đạt</span>
                                </label>
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-3 text-xs text-slate-500 font-normal">
                          Đạt khi ĐTB ≥ 5.0
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Hộp hiển thị Điểm tổng tự động tính riêng cho từng Sinh viên */}
              <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black tracking-wider text-emerald-950 uppercase">
                      Tổng hợp kết quả đánh giá theo từng Sinh viên (Hệ 10)
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Công thức: Điểm trung bình mỗi sinh viên = (∑ Điểm 10 tiêu chí LO của sinh viên đó) / 10
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scoringStudents.map((st: any, idx: number) => {
                    const stTotal = liveStudentTotals[st.key] ?? 0;
                    const ratingLabel =
                      stTotal >= 9.0
                        ? 'XUẤT SẮC'
                        : stTotal >= 8.0
                        ? 'GIỎI'
                        : stTotal >= 6.5
                        ? 'KHÁ'
                        : stTotal >= 5.0
                        ? 'TRUNG BÌNH'
                        : 'KHÔNG ĐẠT';
                    return (
                      <div
                        key={st.key}
                        className="p-4 bg-white/90 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500 font-semibold">
                            Sinh viên {idx + 1} • MSSV: <span className="font-mono text-slate-700">{st.studentCode}</span>
                          </div>
                          <div className="text-sm font-bold text-slate-900">{st.fullName}</div>
                          <div className="flex items-center gap-2 pt-0.5">
                            <Badge
                              variant={
                                stTotal >= 9.0
                                  ? 'success'
                                  : stTotal >= 6.5
                                  ? 'primary'
                                  : stTotal >= 5.0
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                            >
                              Xếp loại: {ratingLabel}
                            </Badge>
                            <Badge variant={stTotal >= 5.0 ? 'success' : 'danger'} size="sm">
                              {stTotal >= 5.0 ? 'Đạt' : 'Không đạt'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Điểm TB</div>
                          <div className="text-3xl font-black text-emerald-700 tracking-tight">
                            {stTotal.toFixed(2)} <span className="text-sm font-bold text-slate-400">/ 10</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nhận xét tổng quát */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ý kiến nhận xét & đánh giá chung của Cán bộ đánh giá
                </label>
                <textarea
                  rows={2}
                  placeholder="Nhận xét tổng quát về tinh thần làm việc, mức độ đáp ứng mục tiêu, tính mới và tiềm năng ứng dụng..."
                  value={scoringComment}
                  disabled={scoringFormData?.isLocked && !scoringFormData?.canEdit}
                  onChange={(e) => setScoringComment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Thanh thao tác: Lưu nháp, Khóa điểm, In biểu mẫu */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  className="text-xs flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  Xuất biểu mẫu PDF (In ký)
                </Button>

                {(!scoringFormData?.isLocked || scoringFormData?.canEdit) ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setScoreChangeReason(scoringFormData?.unlockRequest?.reason || '');
                        setShowScoreChangeModal(true);
                      }}
                      className="text-xs flex items-center gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                      title="Gửi yêu cầu mở khóa sửa điểm tới Trưởng bộ môn"
                    >
                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                      Yêu cầu mở khóa điểm
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingScores}
                      onClick={() => handleSaveBatchScores(true)}
                      className="text-xs flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      <Save className="w-4 h-4 text-slate-600" />
                      Lưu bản nháp (Draft)
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      disabled={savingScores}
                      onClick={() => handleSaveBatchScores(false)}
                      className="text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2"
                    >
                      <Lock className="w-4 h-4" />
                      {savingScores ? 'Đang lưu...' : 'Khóa & Nộp điểm chính thức'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {scoringFormData?.unlockRequest?.status === 'PENDING' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning" size="sm" className="bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1 py-1.5 px-3 font-semibold text-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                          Đang chờ Trưởng bộ môn duyệt mở khóa
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50 flex items-center gap-1 font-semibold"
                          onClick={() => {
                            if (scoringFormData?.unlockRequest?.reason) {
                              setScoreChangeReason(scoringFormData.unlockRequest.reason);
                            }
                            setShowScoreChangeModal(true);
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Sửa lý do đề xuất
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xs text-slate-500 italic flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-purple-600" />
                          Điểm đã khóa chính thức. Muốn cập nhật điểm, vui lòng gửi yêu cầu mở khóa đến Trưởng bộ môn:
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm px-3.5 py-1.5"
                          onClick={() => {
                            setScoreChangeReason('');
                            setShowScoreChangeModal(true);
                          }}
                        >
                          <Unlock className="w-4 h-4" />
                          <span>Yêu cầu mở khóa điểm</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

        </div>
      </div>

      {/* MODAL: Create Topic */}
      <Modal isOpen={showCreateTopicModal} onClose={() => setShowCreateTopicModal(false)} title="Đăng ký Đề tài KLTN mới">
        <form onSubmit={handleCreateTopic} className="space-y-4 text-sm">
          <Input
            label="Tên đề tài"
            placeholder="VD: Nghiên cứu phát hiện gian lận tài chính bằng Machine Learning"
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tóm tắt đề tài
            </label>
            <textarea
              rows={3}
              placeholder="Tóm tắt bối cảnh và hướng giải quyết..."
              value={topicSummary}
              onChange={(e) => setTopicSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mục tiêu & Sản phẩm dự kiến
            </label>
            <textarea
              rows={2}
              placeholder="Mục tiêu đầu ra của đề tài..."
              value={topicObjectives}
              onChange={(e) => setTopicObjectives(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Công nghệ sử dụng"
              placeholder="Python, Scikit-learn, FastAPI"
              value={topicTech}
              onChange={(e) => setTopicTech(e.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={5}
              label="Số lượng sinh viên tối đa"
              value={topicCapacity}
              onChange={(e) => setTopicCapacity(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowCreateTopicModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Gửi đề xuất đề tài
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Topic */}
      <Modal isOpen={showEditTopicModal} onClose={() => setShowEditTopicModal(false)} title="Chỉnh sửa Đề tài KLTN">
        <form onSubmit={handleUpdateTopic} className="space-y-4 text-sm">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-200">
            <b>Lưu ý:</b> Nếu bạn chỉnh sửa các thông tin quan trọng (tên đề tài, mô tả, yêu cầu, số lượng), đề tài sẽ được tự động chuyển về trạng thái <b>Chờ duyệt</b> để Trưởng bộ môn phê duyệt lại. Không thể chỉnh sửa sau khi đã có SV đăng ký chính thức hoặc sau thời hạn đăng ký.
          </div>
          <Input
            label="Tên đề tài"
            placeholder="VD: Nghiên cứu phát hiện gian lận tài chính bằng Machine Learning"
            value={editTopicTitle}
            onChange={(e) => setEditTopicTitle(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tóm tắt / Mô tả đề tài
            </label>
            <textarea
              rows={3}
              placeholder="Tóm tắt bối cảnh và hướng giải quyết..."
              value={editTopicSummary}
              onChange={(e) => setEditTopicSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mục tiêu & Yêu cầu sinh viên
            </label>
            <textarea
              rows={2}
              placeholder="Yêu cầu năng lực sinh viên, mục tiêu đầu ra..."
              value={editTopicObjectives}
              onChange={(e) => setEditTopicObjectives(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Công nghệ sử dụng"
              placeholder="Python, Scikit-learn, FastAPI"
              value={editTopicTech}
              onChange={(e) => setEditTopicTech(e.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={10}
              label="Số lượng sinh viên tối đa"
              value={editTopicCapacity}
              onChange={(e) => setEditTopicCapacity(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowEditTopicModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: View Topic Registrations & Add Student */}
      <Modal
        isOpen={showTopicRegsModal}
        onClose={() => setShowTopicRegsModal(false)}
        title={`Sinh viên đăng ký - ${selectedTopicForRegs?.tenDeTai || selectedTopicForRegs?.title || 'Đề tài'}`}
      >
        <div className="space-y-5 text-sm">
          {/* Topic Summary banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 text-sm">{selectedTopicForRegs?.tenDeTai || selectedTopicForRegs?.title}</span>
              <Badge variant={selectedTopicForRegs?.status === 'APPROVED' ? 'success' : 'warning'}>
                {selectedTopicForRegs?.status === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>Sức chứa: <b>{selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2}</b> SV</span>
              <span>Đã đăng ký: <b className="text-emerald-700">{topicRegistrations.length}</b> SV</span>
              <span>Còn trống: <b className="text-blue-600">{Math.max(0, (selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2) - topicRegistrations.length)}</b> chỗ</span>
            </div>
          </div>

          {/* Form thêm sinh viên vào đề tài */}
          <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-700" />
                Giảng viên chủ động thêm sinh viên vào đề tài
              </div>
            </div>

            {selectedTopicForRegs?.status !== 'APPROVED' ? (
              <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ Chỉ có thể thêm sinh viên khi đề tài đã được Trưởng bộ môn phê duyệt.
              </div>
            ) : topicRegistrations.length >= (selectedTopicForRegs?.capacity || selectedTopicForRegs?.soLuongToiDa || 2) ? (
              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                ⛔ Đề tài đã đủ số lượng sinh viên tối đa ({selectedTopicForRegs?.capacity} SV). Không thể thêm thêm.
              </div>
            ) : (
              <form onSubmit={handleAddStudentToTopic} className="space-y-3">
                <p className="text-xs text-slate-600">
                  Hệ thống sẽ kiểm tra: đề tài đã duyệt, còn chỗ, sinh viên đủ điều kiện và chưa thuộc nhóm khác. Sinh viên sau khi thêm sẽ có trạng thái <b>Đã xác nhận (DA_XAC_NHAN)</b>.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <select
                    value={addStudentToTopicId}
                    onChange={(e) => setAddStudentToTopicId(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  >
                    <option value="">-- Chọn sinh viên đủ điều kiện (110+ tín chỉ) --</option>
                    {studentsList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.studentCode} - {st.user?.fullName} ({st.className || 'Chưa có lớp'})
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="primary" size="sm" className="shrink-0 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" /> Thêm vào đề tài
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Danh sách sinh viên đăng ký */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Danh sách sinh viên đăng ký ({topicRegistrations.length})</span>
            </h4>

            {loadingTopicRegs ? (
              <div className="p-6 text-center text-xs text-slate-400">Đang tải danh sách sinh viên...</div>
            ) : topicRegistrations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Chưa có sinh viên nào đăng ký đề tài này.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[500px] text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">MSSV</th>
                      <th className="p-2.5">Họ và tên</th>
                      <th className="p-2.5">Thông tin liên lạc</th>
                      <th className="p-2.5">Lớp</th>
                      <th className="p-2.5">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topicRegistrations.map((st, idx) => (
                      <tr key={st.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-2.5 font-mono font-bold text-slate-800">{st.mssv || st.studentCode}</td>
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
                          <Badge variant={st.status === 'APPROVED' ? 'success' : 'warning'} size="sm">
                            {st.status === 'APPROVED' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowTopicRegsModal(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Add Member */}
      <Modal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} title="Thêm Sinh viên vào Nhóm KLTN">
        <form onSubmit={handleAddMember} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Chọn sinh viên đủ điều kiện
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            >
              <option value="">-- Chọn sinh viên --</option>
              {studentsList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.studentCode} - {st.user?.fullName} ({st.className})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowAddMemberModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Thêm vào nhóm
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Feedback */}
      <Modal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} title="Nhận xét & Phản hồi bài nộp">
        <form onSubmit={handleSendFeedback} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nội dung nhận xét cho sinh viên
            </label>
            <textarea
              rows={4}
              placeholder="Nhập nhận xét chi tiết, nhắc nhở chỉnh sửa hoặc đánh giá..."
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <input
              type="checkbox"
              id="yeuCauChinhSua"
              checked={feedbackYeuCauChinhSua}
              onChange={(e) => setFeedbackYeuCauChinhSua(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="yeuCauChinhSua" className="text-xs text-amber-900 cursor-pointer">
              <span className="font-semibold block">Yêu cầu sinh viên chỉnh sửa lại (Revision Required)</span>
              Đánh dấu bài nộp cần được sinh viên cập nhật, chỉnh sửa và nộp lại phiên bản mới (trạng thái sẽ là <b>Yêu cầu sửa</b>).
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowFeedbackModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary">
              Gửi nhận xét
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Appointment */}
      <Modal isOpen={showApptModal} onClose={() => setShowApptModal(false)} title="Đặt lịch hẹn trao đổi với Nhóm">
        <form onSubmit={handleCreateAppointment} className="space-y-4 text-sm">
          <Input label="Tiêu đề cuộc hẹn" value={apptTitle} onChange={(e) => setApptTitle(e.target.value)} required />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Hình thức</label>
            <select
              value={apptMode}
              onChange={(e) => setApptMode(e.target.value as any)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="ONLINE">Trực tuyến (Online)</option>
              <option value="OFFLINE">Trực tiếp tại văn phòng bộ môn (Offline)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input type="datetime-local" label="Thời gian bắt đầu" value={apptStartsAt} onChange={(e) => setApptStartsAt(e.target.value)} required />
            <Input type="datetime-local" label="Thời gian kết thúc" value={apptEndsAt} onChange={(e) => setApptEndsAt(e.target.value)} required />
          </div>
          <Input label="Địa điểm / Link Google Meet" value={apptLocation} onChange={(e) => setApptLocation(e.target.value)} placeholder="Phòng BM hoặc link họp" />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowApptModal(false)}>Hủy</Button>
            <Button type="submit" variant="primary">Lưu lịch hẹn</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Score Entry */}
      <Modal isOpen={showScoreModal} onClose={() => setShowScoreModal(false)} title="Nhập điểm tiêu chí">
        <form onSubmit={handleSaveScore} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Chọn tiêu chí đánh giá</label>
            <select
              value={scoreCriterionId}
              onChange={(e) => setScoreCriterionId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            >
              <option value="">-- Chọn tiêu chí --</option>
              {criteria.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} - ` : ''}{c.name} (Thang: {c.maxScore})
                </option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="10"
            label="Điểm số (Thang 10)"
            placeholder="VD: 8.5"
            value={scoreValue}
            onChange={(e) => setScoreValue(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ghi chú / Đánh giá</label>
            <textarea
              rows={2}
              placeholder="Ghi chú đánh giá tiêu chí..."
              value={scoreNote}
              onChange={(e) => setScoreNote(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowScoreModal(false)}>Hủy</Button>
            <Button type="submit" variant="primary">Lưu điểm</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Score Change Request */}
      <Modal isOpen={showScoreChangeModal} onClose={() => setShowScoreChangeModal(false)} title="Đề xuất mở khóa sửa điểm KLTN">
        <form onSubmit={handleRequestScoreChange} className="space-y-4 text-sm">
          {/* Target Group & Topic Context */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Nhóm:{' '}
                <span className="font-mono text-indigo-700">
                  {currentGroup?.code || reviewerAssignments.find((r) => (r.groupId || r.id) === selectedGroupId)?.groupCode || scoringFormData?.topic?.group?.code || 'KLTN'}
                </span>{' '}
                - {currentGroup?.name || reviewerAssignments.find((r) => (r.groupId || r.id) === selectedGroupId)?.groupName || scoringFormData?.topic?.group?.name || 'Nhóm sinh viên'}
              </span>
              <Badge variant="purple" size="sm">
                {scoringFormData?.role === 'PHAN_BIEN'
                  ? 'Cán bộ Phản biện'
                  : scoringFormData?.role === 'HOI_DONG'
                  ? 'Hội đồng'
                  : 'Cán bộ Hướng dẫn'}
              </Badge>
            </div>
            <div className="text-slate-600 truncate">
              Đề tài: <b>{scoringFormData?.topic?.title || currentGroup?.topic?.title || 'Đề tài Khóa luận tốt nghiệp'}</b>
            </div>
            {scoringFormData?.unlockRequest?.status === 'PENDING' && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Yêu cầu trước đó đang chờ TBM duyệt. Gửi lại sẽ cập nhật lý do mới nhất.</span>
              </div>
            )}
          </div>

          {/* Quick preset reasons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Gợi ý lý do nhanh
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Cần cập nhật điểm theo báo cáo/minh chứng nghiệm thu mới của sinh viên',
                'Đính chính nhầm lẫn khi nhập điểm các tiêu chí đánh giá',
                'Điều chỉnh điểm theo biên bản kết luận thống nhất của Hội đồng',
                'Bổ sung nhận xét chi tiết và xếp loại kết quả KLTN',
              ].map((reasonItem) => (
                <button
                  key={reasonItem}
                  type="button"
                  onClick={() => setScoreChangeReason(reasonItem)}
                  className="text-left text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-slate-700 transition-colors"
                >
                  + {reasonItem}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Chi tiết lý do cần mở khóa điểm <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Nêu rõ lý do, căn cứ hoặc các tiêu chí cần điều chỉnh lại điểm..."
              value={scoreChangeReason}
              onChange={(e) => setScoreChangeReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Đề xuất sẽ được gửi trực tiếp đến Trưởng bộ môn. Sau khi phê duyệt, Thầy/Cô sẽ có thể cập nhật lại điểm trong thời gian quy định.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowScoreChangeModal(false)}>Hủy</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!scoreChangeReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Unlock className="w-4 h-4" />
              <span>Gửi đề xuất tới Trưởng bộ môn</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Midterm Evaluation */}
      <Modal
        isOpen={showMidtermModal}
        onClose={() => setShowMidtermModal(false)}
        title={`Xác nhận giữa kỳ: ${midtermGroup?.code ?? ''} - ${midtermGroup?.name ?? ''}`}
      >
        <form onSubmit={handleMidtermSubmit} className="space-y-4 text-sm">
          {midtermWindowInfo && !midtermWindowInfo.isOpen && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Hiện tại hệ thống ghi nhận ngoài khung thời gian xác nhận giữa kỳ. Thao tác có thể bị máy chủ từ chối.</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="font-semibold text-slate-700">Đề tài: {midtermGroup?.topic?.title || 'Chưa liên kết đề tài'}</div>
            <div className="text-slate-500">Số lượng thành viên: {midtermGroup?.members?.length ?? 0} sinh viên</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Kết quả đánh giá giữa kỳ <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  midtermKetQua === 'CHO_LAM_TIEP'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="midtermResult"
                  value="CHO_LAM_TIEP"
                  checked={midtermKetQua === 'CHO_LAM_TIEP'}
                  onChange={() => setMidtermKetQua('CHO_LAM_TIEP')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-sm">CHO LÀM TIẾP</div>
                  <div className="text-[11px] font-normal text-emerald-700">Đủ điều kiện phân công phản biện</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${
                  midtermKetQua === 'DUNG_DE_TAI'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold ring-2 ring-rose-200'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="midtermResult"
                  value="DUNG_DE_TAI"
                  checked={midtermKetQua === 'DUNG_DE_TAI'}
                  onChange={() => setMidtermKetQua('DUNG_DE_TAI')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-sm">DỪNG ĐỀ TÀI</div>
                  <div className="text-[11px] font-normal text-rose-700">Không được bảo vệ KLTN đợt này</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Lý do / Nhận xét chi tiết cho Sinh viên & Quản lý bộ môn
            </label>
            <textarea
              rows={3}
              placeholder="Nhập nhận xét tiến độ, khối lượng công việc hoàn thành hoặc lý do dừng đề tài..."
              value={midtermLyDo}
              onChange={(e) => setMidtermLyDo(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowMidtermModal(false)} disabled={midtermSubmitting}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant={midtermKetQua === 'CHO_LAM_TIEP' ? 'primary' : 'danger'}
              disabled={midtermSubmitting}
            >
              {midtermSubmitting ? 'Đang lưu...' : 'Xác nhận đánh giá giữa kỳ'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

