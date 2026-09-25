import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Users,
  Award,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  Download,
  Unlock,
  AlertTriangle,
  PlusCircle,
  Clock,
  Layers,
  Search,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  ShieldAlert,
  RotateCw,
  ExternalLink,
  Eye,
  LayoutDashboard,
} from 'lucide-react';
import { HeadWelcomeView } from '../dashboard/HeadWelcomeView';

export const HeadWorkspace: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('welcome');

  // State
  const [currentSemester, setCurrentSemester] = useState<any>(null);
  const [pendingTopics, setPendingTopics] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scoreRequests, setScoreRequests] = useState<any[]>([]);
  const [pendingEvidence, setPendingEvidence] = useState<any[]>([]);

  // Scores Management & Incomplete Warnings
  const [semesterScores, setSemesterScores] = useState<any[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoreSearch, setScoreSearch] = useState('');
  const [scoreIncompleteOnly, setScoreIncompleteOnly] = useState(false);
  const [selectedScoreDetails, setSelectedScoreDetails] = useState<any>(null);

  // Defense Eligibility Tracking
  const [filterReadyForDefenseOnly, setFilterReadyForDefenseOnly] = useState(false);
  const [eligibleGroupsList, setEligibleGroupsList] = useState<any[]>([]);
  const [loadingEligibleGroups, setLoadingEligibleGroups] = useState(false);
  const [committeeSubTab, setCommitteeSubTab] = useState<'committees-schedules' | 'eligibility'>('committees-schedules');

  // Modals & form state
  const [showReviewTopicModal, setShowReviewTopicModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<any>(null);
  const [newQuota, setNewQuota] = useState(5);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignGroupId, setAssignGroupId] = useState('');
  const [assignReviewer1Id, setAssignReviewer1Id] = useState('');
  const [assignReviewer2Id, setAssignReviewer2Id] = useState('');
  const [selectedPairId, setSelectedPairId] = useState('');
  const [assignMode, setAssignMode] = useState<'pair' | 'custom'>('pair');
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [availableReviewerData, setAvailableReviewerData] = useState<any>(null);
  const [filterReadyForReview, setFilterReadyForReview] = useState(false);

  const [showCommitteeModal, setShowCommitteeModal] = useState(false);
  const [committeeName, setCommitteeName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedCommitteeGroupIds, setSelectedCommitteeGroupIds] = useState<string[]>([]);

  const eligibleCommitteeGroups = useMemo(() => {
    return allGroups.filter((grp: any) => grp.midtermStatus === 'CONTINUE' || grp.midtermStatus === 'CHO_LAM_TIEP');
  }, [allGroups]);

  const selectedGroupAdvisors = useMemo(() => {
    const advisors = new Set<string>();
    for (const gId of selectedCommitteeGroupIds) {
      const g = allGroups.find((item: any) => item.id === gId);
      const ownerId = g?.topic?.ownerId || g?.topic?.owner?.id || g?.gvhd?.id || g?.gvhd?.userId;
      if (ownerId) advisors.add(ownerId);
    }
    return advisors;
  }, [selectedCommitteeGroupIds, allGroups]);

  const toggleCommitteeGroup = (groupId: string) => {
    if (selectedCommitteeGroupIds.includes(groupId)) {
      setSelectedCommitteeGroupIds(selectedCommitteeGroupIds.filter((id) => id !== groupId));
    } else {
      const g = allGroups.find((item: any) => item.id === groupId);
      const ownerId = g?.topic?.ownerId || g?.topic?.owner?.id || g?.gvhd?.id || g?.gvhd?.userId;
      if (ownerId && selectedMemberIds.includes(ownerId)) {
        const conflictLec = lecturers.find((l: any) => (l.user?.id || l.userId || l.id) === ownerId);
        const lecName = conflictLec?.user?.fullName || conflictLec?.fullName || 'Giảng viên hướng dẫn';
        notify(`Không thể chọn nhóm này: ${lecName} đang là thành viên Hội đồng được chọn (Xung đột vai trò GVHD). Vui lòng bỏ chọn GV này trước!`, 'error');
        return;
      }
      setSelectedCommitteeGroupIds([...selectedCommitteeGroupIds, groupId]);
    }
  };

  const toggleCommitteeMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      if (selectedGroupAdvisors.has(userId)) {
        notify('Giảng viên này đang là GVHD của nhóm được chọn vào hội đồng (Xung đột vai trò)', 'error');
        return;
      }
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleGroupId, setScheduleGroupId] = useState('');
  const [scheduleCommitteeId, setScheduleCommitteeId] = useState('');
  const [scheduleRoom, setScheduleRoom] = useState('');
  const [scheduleStartsAt, setScheduleStartsAt] = useState('');
  const [scheduleEndsAt, setScheduleEndsAt] = useState('');

  const [showEvidenceReviewModal, setShowEvidenceReviewModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [evidencePoints, setEvidencePoints] = useState('0.5');
  const [evidenceNote, setEvidenceNote] = useState('');

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [pendingTopRes, topRes, quotaRes, lecRes, comRes, schRes, scrRes, eviRes] = await Promise.all([
        api.get('/topics?status=CHO_DUYET').catch(() => null),
        api.get('/topics?limit=100'),
        api.get('/quotas').catch(() => null),
        api.get('/users/lecturers'),
        api.get('/defense-committees').catch(() => api.get('/defense/committees')),
        api.get('/defense-schedules').catch(() => api.get('/defense/schedules')),
        api.get('/score-unlock-requests').catch(() => api.get('/scores/change-requests')),
        api.get('/evidences?status=PENDING').catch(() => api.get('/evidence/pending')),
      ]);

      const tList = topRes.data.data.items ?? [];
      setAllTopics(tList);

      if (pendingTopRes?.data?.data) {
        const pItems = pendingTopRes.data.data.items ?? pendingTopRes.data.data;
        const canCapNhat = tList.filter(
          (t: any) => t.status === 'CAN_CAP_NHAT' && !pItems.some((p: any) => p.id === t.id),
        );
        setPendingTopics([...pItems, ...canCapNhat]);
      } else {
        setPendingTopics(
          tList.filter(
            (t: any) =>
              ['PENDING_APPROVAL', 'CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'CAN_CAP_NHAT'].includes(t.status) ||
              ['CHO_DUYET', 'CHO_TRUONG_BM_DUYET', 'CAN_CAP_NHAT'].includes(t.trangThai),
          ),
        );
      }

      if (quotaRes?.data?.data) {
        setCurrentSemester(quotaRes.data.data.semester);
        setWorkload(quotaRes.data.data.items ?? quotaRes.data.data);
      } else {
        const wlRes = await api.get('/reports/workload').catch(() => null);
        setWorkload(wlRes?.data?.data ?? []);
      }

      setLecturers(lecRes.data.data ?? []);
      setCommittees(comRes.data.data ?? []);
      setSchedules(schRes.data.data ?? []);
      setScoreRequests(scrRes.data.data ?? []);
      setPendingEvidence(eviRes.data.data ?? []);

      // Load all groups
      try {
        const gRes = await api.get('/groups');
        setAllGroups(gRes.data?.data?.items ?? gRes.data?.data ?? []);
      } catch {
        const fallbackRes = await api.get('/groups/mine').catch(() => null);
        setAllGroups(fallbackRes?.data?.data ?? []);
      }

      // Load initial scores & eligible groups
      try {
        const [scoreRes, eligRes] = await Promise.all([
          api.get('/scores').catch(() => null),
          api.get('/groups?readyForDefense=false').catch(() => null),
        ]);
        if (scoreRes?.data?.data) {
          const sData = scoreRes.data.data;
          setSemesterScores(Array.isArray(sData) ? sData : (sData.items ?? []));
        }
        if (eligRes?.data?.data) {
          setEligibleGroupsList(eligRes.data.data.items ?? eligRes.data.data ?? []);
        }
      } catch (err) {
        console.error('Error loading initial scores/eligibility:', err);
      }
    } catch (err: any) {
      console.error('Error loading head data:', err);
    }
  };

  const fetchSemesterScores = async (incompleteOnly = scoreIncompleteOnly, search = scoreSearch) => {
    setLoadingScores(true);
    try {
      const params: any = {};
      if (currentSemester?.id) params.semesterId = currentSemester.id;
      if (incompleteOnly) params.incompleteOnly = 'true';
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/scores', { params });
      const sData = res.data?.data;
      setSemesterScores(Array.isArray(sData) ? sData : (sData?.items ?? []));
    } catch (err) {
      console.error('Error fetching semester scores:', err);
    } finally {
      setLoadingScores(false);
    }
  };

  const fetchEligibleGroups = async (readyOnly: boolean = filterReadyForDefenseOnly) => {
    setLoadingEligibleGroups(true);
    try {
      const semParam = currentSemester?.id ? `&semesterId=${currentSemester.id}` : '';
      const res = await api.get(`/groups?readyForDefense=${readyOnly}${semParam}`);
      setEligibleGroupsList(res.data?.data?.items ?? res.data?.data ?? []);
    } catch (err) {
      console.error('Error fetching defense eligible groups:', err);
    } finally {
      setLoadingEligibleGroups(false);
    }
  };

  const incompleteScoresCount = useMemo(() => {
    const list = Array.isArray(semesterScores) ? semesterScores : [];
    return list.filter((s: any) => s.scoreCompleteness?.hasWarning).length;
  }, [semesterScores]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'scores') {
      fetchSemesterScores(scoreIncompleteOnly, scoreSearch);
    }
  }, [activeTab, scoreIncompleteOnly]);

  // Review topic (Approve / Reject / Request changes)
  const handleReviewTopic = async (approved: boolean) => {
    if (!selectedTopic) return;
    try {
      if (approved) {
        await api.post(`/topics/${selectedTopic.id}/approve`, {
          note: reviewNote,
        });
        notify('Đã phê duyệt đề tài thành công!');
      } else {
        if (!reviewNote.trim()) {
          notify('Vui lòng nhập lý do từ chối đề tài', 'error');
          return;
        }
        await api.post(`/topics/${selectedTopic.id}/reject`, {
          lyDo: reviewNote,
        });
        notify('Đã từ chối đề tài thành công!');
      }
      setShowReviewTopicModal(false);
      setSelectedTopic(null);
      setReviewNote('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xét duyệt đề tài', 'error');
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedTopic) return;
    if (!reviewNote.trim()) {
      notify('Vui lòng nhập nội dung yêu cầu chỉnh sửa', 'error');
      return;
    }
    try {
      await api.post(`/topics/${selectedTopic.id}/request-changes`, {
        lyDo: reviewNote,
      });
      notify('Đã gửi yêu cầu chỉnh sửa đề tài cho Giảng viên!');
      setShowReviewTopicModal(false);
      setSelectedTopic(null);
      setReviewNote('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi gửi yêu cầu chỉnh sửa', 'error');
    }
  };

  // Update lecturer quota
  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturer) return;
    try {
      if (currentSemester?.id) {
        await api.put('/quotas', {
          semesterId: currentSemester.id,
          quotas: [
            {
              lecturerId: selectedLecturer.lecturerId || selectedLecturer.id,
              maxGroups: Number(newQuota),
            },
          ],
        });
      } else {
        await api.patch(`/users/lecturers/${selectedLecturer.id}/quota`, { maxGroups: Number(newQuota) });
      }
      notify('Đã cập nhật hạn mức hướng dẫn cho giảng viên thành công!');
      setShowQuotaModal(false);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi cập nhật hạn mức', 'error');
    }
  };

  // Open 2-Reviewer assign modal and load available reviewers & pairs
  const handleOpenAssignModal = async (group: any) => {
    setAssignGroupId(group.id);
    setAssignReviewer1Id('');
    setAssignReviewer2Id('');
    setSelectedPairId('');
    setAssignMode('pair');
    setAvailableReviewerData(null);
    setShowAssignModal(true);
    setLoadingAvailable(true);

    try {
      const res = await api.get(`/lecturers/available-reviewers?groupId=${group.id}`);
      const data = res.data?.data;
      setAvailableReviewerData(data);

      if (data?.suggestedPairs && data.suggestedPairs.length > 0) {
        const firstPair = data.suggestedPairs[0];
        setSelectedPairId(firstPair.pairId);
        setAssignReviewer1Id(firstPair.reviewerIds[0]);
        setAssignReviewer2Id(firstPair.reviewerIds[1]);
        setAssignMode('pair');
      } else if (data?.availableReviewers && data.availableReviewers.length >= 2) {
        setAssignReviewer1Id(data.availableReviewers[0].id);
        setAssignReviewer2Id(data.availableReviewers[1].id);
        setAssignMode('custom');
      }
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi tải danh sách giảng viên khả dụng', 'error');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleSelectPair = (pairId: string) => {
    setSelectedPairId(pairId);
    const pair = availableReviewerData?.suggestedPairs?.find((p: any) => p.pairId === pairId);
    if (pair) {
      setAssignReviewer1Id(pair.reviewerIds[0]);
      setAssignReviewer2Id(pair.reviewerIds[1]);
    }
  };

  // Assign 2 reviewers (Checks no advisor conflict, load capacity, etc.)
  const handleAssignReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignGroupId || !assignReviewer1Id || !assignReviewer2Id) {
      notify('Vui lòng chọn đầy đủ 2 giảng viên phản biện', 'error');
      return;
    }
    if (assignReviewer1Id === assignReviewer2Id) {
      notify('Hai giảng viên phản biện không được trùng nhau', 'error');
      return;
    }
    try {
      await api.post('/review-assignments', {
        groupId: assignGroupId,
        reviewerIds: [assignReviewer1Id, assignReviewer2Id],
      });
      notify('Phân công 2 Giảng viên phản biện thành công!');
      setShowAssignModal(false);
      setAssignGroupId('');
      setAssignReviewer1Id('');
      setAssignReviewer2Id('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi phân công phản biện', 'error');
    }
  };

  // Create Defense Committee (with min members check and anti-conflict check)
  const handleCreateCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length < 3) {
      notify('Hội đồng bảo vệ phải có tối thiểu 3 thành viên (Chủ tịch, Thư ký, Ủy viên)', 'error');
      return;
    }
    try {
      let semId = currentSemester?.id || allGroups[0]?.semesterId;
      if (!semId) {
        const semRes = await api.get('/config/semesters');
        semId = semRes.data?.data?.[0]?.id;
        if (!semId) return notify('Không tìm thấy thông tin học kỳ', 'error');
      }

      await api.post('/defense-committees', {
        semesterId: semId,
        groupIds: selectedCommitteeGroupIds,
        memberIds: selectedMemberIds,
        tenHoiDong: committeeName.trim() || undefined,
      });
      notify('Thành lập Hội đồng bảo vệ KLTN thành công!');
      setShowCommitteeModal(false);
      setCommitteeName('');
      setSelectedMemberIds([]);
      setSelectedCommitteeGroupIds([]);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi lập hội đồng bảo vệ', 'error');
    }
  };

  const handleSelectScheduleGroup = (groupId: string) => {
    setScheduleGroupId(groupId);
    if (!groupId) return;
    const com = committees.find((c: any) =>
      c.assignedGroups?.some((g: any) => g.id === groupId) ||
      c.schedules?.some((s: any) => s.groupId === groupId || s.group?.id === groupId),
    );
    if (com) {
      setScheduleCommitteeId(com.id);
    }
  };

  const setScheduleDurationMins = (mins: number) => {
    if (scheduleStartsAt) {
      const start = new Date(scheduleStartsAt);
      const end = new Date(start.getTime() + mins * 60000);
      const pad = (n: number) => (n < 10 ? '0' + n : n);
      const localIso = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
      setScheduleEndsAt(localIso);
    }
  };

  // Schedule Defense
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!scheduleGroupId && !scheduleCommitteeId) || !scheduleStartsAt || !scheduleRoom) {
      notify('Vui lòng cung cấp nhóm hoặc hội đồng, phòng và thời gian bảo vệ', 'error');
      return;
    }
    try {
      let semId = currentSemester?.id || allGroups[0]?.semesterId;
      if (!semId) {
        const semRes = await api.get('/config/semesters');
        semId = semRes.data.data?.[0]?.id;
        if (!semId) return notify('Chưa có học kỳ mở', 'error');
      }

      const calculatedEndsAt = scheduleEndsAt
        ? new Date(scheduleEndsAt).toISOString()
        : new Date(new Date(scheduleStartsAt).getTime() + 60 * 60000).toISOString();

      await api.post('/defense-schedules', {
        groupId: scheduleGroupId || undefined,
        committeeId: scheduleCommitteeId || undefined,
        semesterId: semId,
        room: scheduleRoom.trim(),
        startsAt: new Date(scheduleStartsAt).toISOString(),
        endsAt: calculatedEndsAt,
      }).catch(() => {
        return api.post('/defense/schedules', {
          groupId: scheduleGroupId || undefined,
          committeeId: scheduleCommitteeId || undefined,
          semesterId: semId,
          room: scheduleRoom.trim(),
          startsAt: new Date(scheduleStartsAt).toISOString(),
          endsAt: calculatedEndsAt,
        });
      });

      notify('Xếp lịch và phòng bảo vệ thành công! Đã công bố và gửi thông báo đến các bên liên quan.');
      setShowScheduleModal(false);
      setScheduleGroupId('');
      setScheduleCommitteeId('');
      setScheduleRoom('');
      setScheduleStartsAt('');
      setScheduleEndsAt('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xếp lịch bảo vệ', 'error');
    }
  };

  // Unlock score request review
  const handleReviewScoreRequest = async (requestId: string, approved: boolean) => {
    try {
      if (approved) {
        const hoursStr = window.prompt('Nhập thời hạn cho phép sửa điểm (số giờ tính từ lúc duyệt, mặc định 24h):', '24');
        const thoiHanChoPhepSua = hoursStr ? Number(hoursStr) || 24 : 24;
        await api.post(`/score-unlock-requests/${requestId}/approve`, { thoiHanChoPhepSua });
      } else {
        const lyDo = window.prompt('Nhập lý do từ chối yêu cầu mở khóa điểm:');
        if (lyDo === null) return; // Người dùng bấm Hủy
        if (!lyDo.trim()) {
          notify('Vui lòng nhập lý do từ chối!', 'error');
          return;
        }
        await api.post(`/score-unlock-requests/${requestId}/reject`, { lyDo: lyDo.trim() });
      }
      notify(`Đã ${approved ? 'phê duyệt mở khóa' : 'từ chối'} yêu cầu sửa điểm!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xử lý yêu cầu', 'error');
    }
  };

  // Review Evidence
  const handleReviewEvidence = async (action: 'approve' | 'reject' | 'request_more_info') => {
    if (!selectedEvidence) return;
    try {
      if (action === 'approve') {
        const payload: any = {};
        if (evidencePoints && !isNaN(Number(evidencePoints))) {
          payload.points = Number(evidencePoints);
        }
        if (evidenceNote) payload.note = evidenceNote;
        await api.post(`/evidences/${selectedEvidence.id}/approve`, payload);
        notify('Đã phê duyệt minh chứng NCKH và cộng điểm thưởng thành công!');
      } else if (action === 'reject') {
        const lyDo = evidenceNote || window.prompt('Nhập lý do từ chối minh chứng NCKH:');
        if (!lyDo || !lyDo.trim()) {
          notify('Vui lòng nhập lý do từ chối!', 'error');
          return;
        }
        await api.post(`/evidences/${selectedEvidence.id}/reject`, { lyDo: lyDo.trim() });
        notify('Đã từ chối minh chứng NCKH!');
      } else if (action === 'request_more_info') {
        const note = evidenceNote || window.prompt('Nhập nội dung yêu cầu sinh viên bổ sung:');
        if (!note || !note.trim()) {
          notify('Vui lòng nhập nội dung yêu cầu bổ sung!', 'error');
          return;
        }
        await api.post(`/evidences/${selectedEvidence.id}/request-more-info`, { note: note.trim() });
        notify('Đã gửi yêu cầu bổ sung minh chứng tới sinh viên!');
      }
      setShowEvidenceReviewModal(false);
      setSelectedEvidence(null);
      setEvidenceNote('');
      setEvidencePoints('');
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi xét duyệt minh chứng', 'error');
    }
  };

  // Export Excel
  const handleExportExcel = async (type = 'registrations') => {
    try {
      const semParam = currentSemester?.id ? `&semesterId=${currentSemester.id}` : '';
      const res = await api.get(`/reports/export-excel?type=${type}${semParam}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-${currentSemester?.code || 'kltn'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`Đã tải file Excel [${type}] thành công!`);
    } catch {
      notify('Lỗi xuất file Excel', 'error');
    }
  };

  // Export Score Sheet PDF (Single or Batch)
  const handleExportScoreSheetPdf = async (groupId?: string) => {
    try {
      const semParam = currentSemester?.id ? `semesterId=${currentSemester.id}` : '';
      const groupParam = groupId ? `groupIds=${groupId}` : '';
      const query = [semParam, groupParam].filter(Boolean).join('&');
      const res = await api.get(`/reports/score-sheet-pdf${query ? `?${query}` : ''}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = groupId ? `phieu-diem-nhom-${groupId.slice(0, 8)}.pdf` : `phieu-diem-kltn-${currentSemester?.code || 'toan-khoa'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Đã tải phiếu điểm KLTN định dạng PDF thành công!');
    } catch {
      notify('Lỗi xuất file PDF phiếu điểm', 'error');
    }
  };

  const navItems = [
    { id: 'welcome', label: 'Tổng quan & Chào mừng', icon: LayoutDashboard },
    { id: 'approvals', label: 'Xét duyệt đề tài', icon: ShieldCheck, count: pendingTopics.length },
    { id: 'workload', label: 'Hạn mức & Tải GV', icon: BarChart3 },
    { id: 'reviewers', label: 'Phân công phản biện', icon: Users },
    { id: 'committees', label: 'Hội đồng & Lịch bảo vệ', icon: Calendar },
    { id: 'scores', label: 'Quản lý điểm KLTN', icon: Award, count: incompleteScoresCount },
    { id: 'score-locks', label: 'Mở khóa điểm', icon: Unlock, count: scoreRequests.filter((r) => r.status === 'PENDING').length },
    { id: 'evidence', label: 'Duyệt NCKH', icon: Award, count: pendingEvidence.length },
    { id: 'reports', label: 'Báo cáo & Xuất dữ liệu', icon: FileSpreadsheet },
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
              <span>Điều hành Chuyên môn</span>
              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold">
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
                        ? 'bg-purple-700 text-white shadow-sm shadow-purple-200 font-bold'
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

          {/* Mini Tasks Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/50 border border-purple-100/80 text-xs text-purple-950 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-purple-800">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Chờ xử lý chuyên môn</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Đề tài chờ duyệt:</span>
                <strong className="text-purple-700 font-bold">{pendingTopics.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Yêu cầu sửa điểm:</span>
                <strong className="text-purple-700 font-bold">{scoreRequests.filter((r) => r.status === 'PENDING').length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Minh chứng NCKH:</span>
                <strong className="text-purple-700 font-bold">{pendingEvidence.length}</strong>
              </div>
            </div>
          </div>
        </aside>

        {/* NỘI DUNG CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tab 0: Welcome Dashboard */}
          {activeTab === 'welcome' && (
            <HeadWelcomeView
              onNavigate={(tab) => setActiveTab(tab)}
              workspaceData={{
                currentSemester,
                pendingTopics,
                allTopics,
                workload,
                allGroups,
                lecturers,
                committees,
                schedules,
                scoreRequests,
                pendingEvidence,
              }}
            />
          )}

          {activeTab !== 'welcome' && (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-purple-200 text-xs font-semibold uppercase tracking-wider">
                      <span>Trưởng bộ môn</span>
                      <span>•</span>
                      <span>Điều hành chuyên môn KLTN</span>
                    </div>
                    <h2 className="text-2xl font-bold mt-1 text-white">{user?.fullName}</h2>
                    <p className="text-purple-100 text-sm mt-1">
                      Quản lý đề tài, phân công phản biện, thành lập hội đồng và giám sát chất lượng khóa luận
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 p-3 rounded-xl text-xs">
                    <div className="text-center px-2">
                      <div className="text-purple-200">Đề tài chờ duyệt</div>
                      <div className="text-lg font-bold text-white">{pendingTopics.length}</div>
                    </div>
                    <div className="text-center px-2 border-l border-white/20">
                      <div className="text-purple-200">Yêu cầu sửa điểm</div>
                      <div className="text-lg font-bold text-white">{scoreRequests.filter((r) => r.status === 'PENDING').length}</div>
                    </div>
                    <div className="text-center px-2 border-l border-white/20">
                      <div className="text-purple-200">Minh chứng NCKH</div>
                      <div className="text-lg font-bold text-white">{pendingEvidence.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

      {/* TAB 1: Topic Approvals */}
      {activeTab === 'approvals' && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              Hàng đợi phê duyệt đề tài KLTN ({pendingTopics.length} chờ duyệt)
            </h3>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {pendingTopics.map((topic) => (
                <div key={topic.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <Badge variant={topic.status === 'CAN_CAP_NHAT' ? 'warning' : 'primary'}>
                        {topic.status === 'CAN_CAP_NHAT' ? 'Cần cập nhật' : 'Chờ duyệt'}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-700">
                        Đề xuất bởi: {topic.owner?.fullName ?? 'Giảng viên/Sinh viên'} ({topic.owner?.email})
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900">{topic.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{topic.summary || 'Chưa có tóm tắt'}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span>Mục tiêu: {topic.objectives || 'Chưa cập nhật'}</span>
                      <span>•</span>
                      <span>Công nghệ: <b className="text-indigo-600">{topic.technologies || 'Tùy chọn'}</b></span>
                      <span>•</span>
                      <span>Chỉ tiêu: {topic.capacity} sinh viên</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-purple-700 hover:bg-purple-800"
                      onClick={async () => {
                        try {
                          const res = await api.get(`/topics/${topic.id}`);
                          setSelectedTopic(res.data.data ?? topic);
                        } catch {
                          setSelectedTopic(topic);
                        }
                        setShowReviewTopicModal(true);
                      }}
                    >
                      Xét duyệt
                    </Button>
                  </div>
                </div>
              ))}

              {pendingTopics.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Tất cả các đề tài đã được xử lý. Không có đề tài nào đang chờ duyệt.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Lecturer Quota & Workload */}
      {activeTab === 'workload' && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Thống kê khối lượng & Quản lý hạn mức hướng dẫn giảng viên {currentSemester ? `(${currentSemester.name})` : ''}
            </h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Giảng viên</th>
                    <th className="p-3">Học vị / Mã GV</th>
                    <th className="p-3">Số nhóm HD</th>
                    <th className="p-3">Hạn mức (Max)</th>
                    <th className="p-3">Số nhóm PB</th>
                    <th className="p-3">Hội đồng</th>
                    <th className="p-3">Tình trạng</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workload.map((lec) => (
                    <tr key={lec.id}>
                      <td className="p-3 font-semibold text-slate-900">
                        {lec.fullName}
                        <div className="text-[11px] text-slate-400 font-normal">{lec.email}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-700">{lec.title}</span>
                        <div className="text-[10px] text-slate-400">{lec.lecturerCode}</div>
                      </td>
                      <td className="p-3 font-bold text-indigo-600 text-sm">{lec.guidedGroupsCount}</td>
                      <td className="p-3 font-bold text-slate-800 text-sm">{lec.maxGroups}</td>
                      <td className="p-3 text-slate-600">{lec.reviewedGroupsCount}</td>
                      <td className="p-3 text-slate-600">{lec.committeesCount}</td>
                      <td className="p-3">
                        {lec.isOverloaded ? (
                          <Badge variant="danger" size="sm">Đã đạt tối đa</Badge>
                        ) : (
                          <Badge variant="success" size="sm">Còn {lec.remainingSlots} chỗ</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedLecturer(lec);
                            setNewQuota(lec.maxGroups);
                            setShowQuotaModal(true);
                          }}
                        >
                          Chỉnh hạn mức
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

      {/* TAB 3: Assign Reviewers */}
      {activeTab === 'reviewers' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Phân công 2 Giảng viên phản biện (GVPB)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ phân công cho các nhóm đã được xác nhận CHO LÀM TIẾP ở giữa kỳ. Tự động loại trừ GVHD và hỗ trợ ghép cặp.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={filterReadyForReview}
                  onChange={(e) => setFilterReadyForReview(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Chỉ hiện nhóm đủ điều kiện (CHO LÀM TIẾP)</span>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Mã nhóm</th>
                    <th className="p-3">Tên đề tài</th>
                    <th className="p-3">GVHD</th>
                    <th className="p-3">Đánh giá giữa kỳ</th>
                    <th className="p-3">GVPB 1 (Chính)</th>
                    <th className="p-3">GVPB 2 (Phụ)</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allGroups
                    .filter((grp) => !filterReadyForReview || grp.midtermStatus === 'CONTINUE')
                    .map((grp) => {
                      const isContinue = grp.midtermStatus === 'CONTINUE';
                      const assignments = grp.reviewerAssignments || [];
                      const rev1 = assignments.find((r: any) => r.type === 'PRIMARY') || assignments[0];
                      const rev2 =
                        assignments.find((r: any) => r.type === 'ADDITIONAL') ||
                        (assignments.length > 1 ? assignments[1] : null);
                      const hasTwo = assignments.length >= 2;

                      return (
                        <tr key={grp.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-800">{grp.code}</td>
                          <td className="p-3 font-medium text-slate-800 max-w-xs truncate" title={grp.topic?.title ?? grp.name}>
                            {grp.topic?.title ?? grp.name}
                          </td>
                          <td className="p-3 text-slate-600">
                            {grp.topic?.owner?.fullName ?? grp.gvhd?.fullName ?? 'Chưa xác định'}
                          </td>
                          <td className="p-3">
                            {isContinue ? (
                              <Badge variant="success" size="sm">CHO LÀM TIẾP</Badge>
                            ) : grp.midtermStatus === 'STOPPED' ? (
                              <Badge variant="danger" size="sm">DỪNG ĐỀ TÀI</Badge>
                            ) : (
                              <Badge variant="warning" size="sm">Chưa đánh giá</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {rev1 ? (
                              <div>
                                <span className="font-semibold text-purple-700">
                                  {rev1.lecturer?.user?.fullName || rev1.fullName || rev1.lecturerName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa gán</span>
                            )}
                          </td>
                          <td className="p-3">
                            {rev2 ? (
                              <div>
                                <span className="font-semibold text-indigo-700">
                                  {rev2.lecturer?.user?.fullName || rev2.fullName || rev2.lecturerName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa gán</span>
                            )}
                          </td>
                          <td className="p-3">
                            {hasTwo ? (
                              <Badge variant="success" size="sm">Đủ 2 GVPB</Badge>
                            ) : assignments.length === 1 ? (
                              <Badge variant="warning" size="sm">Thiếu 1 GVPB</Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">Chưa phân công</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {isContinue ? (
                              <Button
                                size="sm"
                                variant={hasTwo ? 'outline' : 'primary'}
                                onClick={() => handleOpenAssignModal(grp)}
                              >
                                {hasTwo ? 'Đổi 2 GVPB' : 'Phân công 2 GVPB'}
                              </Button>
                            ) : (
                              <span
                                className="text-xs text-slate-400 cursor-not-allowed italic"
                                title="Chỉ phân công cho nhóm đã CHO LÀM TIẾP ở giữa kỳ"
                              >
                                Chưa đủ ĐK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {allGroups.filter((grp) => !filterReadyForReview || grp.midtermStatus === 'CONTINUE').length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        {filterReadyForReview
                          ? 'Không có nhóm nào đủ điều kiện (CHO LÀM TIẾP) cần phân công phản biện.'
                          : 'Chưa có nhóm KLTN nào trong hệ thống.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Committees & Schedules & Defense Eligibility */}
      {activeTab === 'committees' && (
        <div className="space-y-4">
          {/* Sub Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCommitteeSubTab('committees-schedules')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  committeeSubTab === 'committees-schedules'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Hội đồng & Lịch bảo vệ ({committees.length} HĐ / {schedules.length} lịch)
              </button>
              <button
                onClick={() => {
                  setCommitteeSubTab('eligibility');
                  fetchEligibleGroups(filterReadyForDefenseOnly);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  committeeSubTab === 'eligibility'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Theo dõi Đủ điều kiện bảo vệ
              </button>
            </div>

            {committeeSubTab === 'eligibility' && (
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={filterReadyForDefenseOnly}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setFilterReadyForDefenseOnly(nextVal);
                      fetchEligibleGroups(nextVal);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Chỉ hiện nhóm đủ điều kiện bảo vệ (readyForDefense=true)</span>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchEligibleGroups(filterReadyForDefenseOnly)}
                  disabled={loadingEligibleGroups}
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1 ${loadingEligibleGroups ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>
              </div>
            )}
          </div>

          {committeeSubTab === 'committees-schedules' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    Hội đồng bảo vệ ({committees.length})
                  </h3>
                  <Button size="sm" variant="primary" onClick={() => setShowCommitteeModal(true)}>
                    Thành lập hội đồng
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {committees.map((com) => {
                      const assigned = com.assignedGroups || com.schedules?.map((s: any) => s.group).filter(Boolean) || [];
                      return (
                        <div key={com.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-slate-900">{com.name}</h4>
                            <Badge variant="primary" size="sm">{assigned.length} nhóm chấm</Badge>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Thành viên hội đồng:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                              {com.members?.map((m: any) => (
                                <div key={m.userId} className="flex justify-between bg-white px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700">
                                  <span className="font-medium truncate">{m.user?.fullName || m.fullName}</span>
                                  <Badge variant={m.role === 'Chủ tịch' ? 'purple' : m.role === 'Thư ký' ? 'primary' : 'neutral'} size="sm">{m.role}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          {assigned.length > 0 && (
                            <div className="space-y-1 text-xs pt-1 border-t border-slate-200">
                              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Nhóm bảo vệ:</span>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {assigned.map((g: any) => (
                                  <span key={g.id || g.code} className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-medium" title={g.topicTitle || g.topic?.title || g.name}>
                                    {g.code} {g.advisorName ? `(GVHD: ${g.advisorName})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {committees.length === 0 && (
                      <p className="text-xs text-slate-400 italic p-4 text-center">Chưa có Hội đồng bảo vệ nào được thành lập.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    Lịch bảo vệ & Phòng thi ({schedules.length})
                  </h3>
                  <Button size="sm" variant="secondary" onClick={() => setShowScheduleModal(true)}>
                    Xếp lịch bảo vệ
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {schedules.map((sch) => {
                      const startTime = new Date(sch.startsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const endTime = new Date(sch.endsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = new Date(sch.startsAt).toLocaleDateString('vi-VN');
                      return (
                        <div key={sch.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm text-xs space-y-2 hover:border-indigo-300 transition-colors">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] mr-1.5">
                                {sch.group?.code || 'Chưa có mã'}
                              </span>
                              <span className="font-bold text-slate-800">
                                {sch.group?.topic?.title || sch.group?.name}
                              </span>
                            </div>
                            <Badge variant={sch.status === 'SCHEDULED' ? 'success' : 'neutral'} size="sm">
                              {sch.status === 'SCHEDULED' ? 'Đã công bố' : 'Bản nháp'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-slate-400 font-medium block text-[10px] uppercase">Phòng bảo vệ:</span>
                              <span className="font-bold text-indigo-900 text-xs">{sch.room || 'Chưa xếp phòng'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium block text-[10px] uppercase">Thời gian:</span>
                              <span className="font-semibold text-slate-800 text-xs">
                                {startTime} - {endTime} ({dateStr})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <div>
                              <span>Hội đồng: </span>
                              <span className="font-medium text-slate-800">{sch.committee?.name ?? 'Chưa gán'}</span>
                            </div>
                            {sch.group?.topic?.owner?.fullName && (
                              <div>
                                <span>GVHD: </span>
                                <span className="font-medium text-purple-700">{sch.group.topic.owner.fullName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {schedules.length === 0 && (
                      <p className="text-xs text-slate-400 italic p-4 text-center">Chưa có lịch bảo vệ nào được xếp.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Danh sách Theo dõi Điều kiện Bảo vệ KLTN ({eligibleGroupsList.length} nhóm)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Điều kiện đủ bảo vệ: Sinh viên đạt kết quả đánh giá giữa kỳ (CHO LÀM TIẾP) và nhóm không bị hủy.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Eligibility Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số nhóm</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{eligibleGroupsList.length}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[11px] font-semibold text-emerald-700 uppercase">Đủ điều kiện bảo vệ</div>
                    <div className="text-xl font-bold text-emerald-800 mt-1">
                      {eligibleGroupsList.filter((g: any) => g.isReadyForDefense || g.defenseEligibility?.eligible).length}
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <div className="text-[11px] font-semibold text-indigo-700 uppercase">Đã có lịch bảo vệ</div>
                    <div className="text-xl font-bold text-indigo-800 mt-1">
                      {eligibleGroupsList.filter((g: any) => g.hasDefenseSchedule || g.defenseSchedule).length}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[11px] font-semibold text-amber-700 uppercase">Cần xếp lịch bảo vệ</div>
                    <div className="text-xl font-bold text-amber-800 mt-1">
                      {eligibleGroupsList.filter((g: any) => (g.isReadyForDefense || g.defenseEligibility?.eligible) && !g.hasDefenseSchedule && !g.defenseSchedule).length}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="p-3">Mã nhóm / Đề tài</th>
                        <th className="p-3">Sinh viên thực hiện</th>
                        <th className="p-3">GV Hướng dẫn</th>
                        <th className="p-3">Đánh giá giữa kỳ</th>
                        <th className="p-3">Điều kiện bảo vệ</th>
                        <th className="p-3">Lịch bảo vệ</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {eligibleGroupsList.map((grp: any) => {
                        const isEligible = grp.isReadyForDefense ?? grp.defenseEligibility?.eligible ?? (grp.midtermStatus === 'CONTINUE' || grp.midtermStatus === 'CHO_LAM_TIEP');
                        const hasSchedule = grp.hasDefenseSchedule || !!grp.defenseSchedule;
                        const sch = grp.defenseSchedule;
                        const students = grp.students || grp.members || [];

                        return (
                          <tr key={grp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
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
                              <div className="font-medium text-purple-700">
                                {grp.topic?.owner?.fullName || grp.gvhd?.fullName || 'Chưa phân công'}
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
                            <td className="p-3 text-right">
                              {isEligible && !hasSchedule && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setScheduleGroupId(grp.id);
                                    setShowScheduleModal(true);
                                  }}
                                >
                                  Xếp lịch bảo vệ
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {eligibleGroupsList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                            Không tìm thấy nhóm nào phù hợp tiêu chí lọc.
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

      {/* TAB: Scores Management & Incomplete Warnings */}
      {activeTab === 'scores' && (
        <div className="space-y-4">
          {/* Header Card */}
          <Card>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  Quản lý Điểm & Bảng Điểm Tổng kết KLTN
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điểm tổng kết = (GVHD × 30%) + (GVPB × 30%) + (Hội đồng × 40%) + Thưởng NCKH (tối đa 2.0đ). Cảnh báo kịp thời khi điểm thành phần chưa đầy đủ.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm nhóm, đề tài, sinh viên..."
                    value={scoreSearch}
                    onChange={(e) => {
                      setScoreSearch(e.target.value);
                      fetchSemesterScores(scoreIncompleteOnly, e.target.value);
                    }}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                {/* Filter Incomplete Only */}
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scoreIncompleteOnly}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setScoreIncompleteOnly(checked);
                      fetchSemesterScores(checked, scoreSearch);
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Chỉ hiện nhóm thiếu điểm / Có cảnh báo
                  </span>
                </label>

                {/* Refresh */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchSemesterScores(scoreIncompleteOnly, scoreSearch)}
                  disabled={loadingScores}
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1 ${loadingScores ? 'animate-spin' : ''}`} />
                  Làm mới
                </Button>

                {/* Export Excel Scores */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportExcel('scores')}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  title="Xuất toàn bộ bảng điểm KLTN dạng Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Xuất Excel
                </Button>

                {/* Export PDF Score Sheets */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportScoreSheetPdf()}
                  className="text-rose-700 border-rose-300 hover:bg-rose-50"
                  title="Xuất phiếu điểm KLTN chính thức toàn bộ các nhóm dạng PDF để ký duyệt"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Xuất PDF Phiếu điểm
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Score KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Tổng số nhóm</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{(Array.isArray(semesterScores) ? semesterScores : []).length}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Đầy đủ điểm</div>
                  <div className="text-xl font-bold text-emerald-800 mt-1">
                    {(Array.isArray(semesterScores) ? semesterScores : []).filter((s: any) => s.scoreCompleteness?.isComplete).length}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Có cảnh báo thiếu điểm
                  </div>
                  <div className="text-xl font-bold text-amber-800 mt-1">
                    {incompleteScoresCount}
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase">Điểm TB toàn khóa</div>
                  <div className="text-xl font-bold text-purple-800 mt-1">
                    {(() => {
                      const validScores = (Array.isArray(semesterScores) ? semesterScores : []).filter((s: any) => typeof s.finalScore === 'number');
                      if (validScores.length === 0) return '—';
                      const avg = validScores.reduce((sum: number, s: any) => sum + s.finalScore, 0) / validScores.length;
                      return `${avg.toFixed(2)} / 10`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-3">Nhóm / Đề tài</th>
                      <th className="p-3 text-center">Điểm GVHD (30%)</th>
                      <th className="p-3 text-center">Điểm GVPB (30%)</th>
                      <th className="p-3 text-center">Điểm Hội đồng (40%)</th>
                      <th className="p-3 text-center">Thưởng NCKH</th>
                      <th className="p-3 text-center">Điểm Tổng kết</th>
                      <th className="p-3">Tình trạng & Cảnh báo</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(Array.isArray(semesterScores) ? semesterScores : []).map((item: any) => {
                      const sc = item.scoreCompleteness || {};
                      const isComplete = sc.isComplete;
                      const hasWarning = sc.hasWarning;
                      const warnings = sc.warnings || [];
                      const students = item.members || item.students || [];

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Nhóm / Đề tài */}
                          <td className="p-3 min-w-[220px]">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                              {item.code}
                            </span>
                            <div className="font-semibold text-slate-800 mt-1 line-clamp-2">
                              {item.topic?.title || item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              GVHD: <span className="font-medium text-purple-700">{item.topic?.owner?.fullName || 'Chưa cập nhật'}</span>
                            </div>
                            {students.length > 0 && (
                              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                SV: {students.map((st: any) => st.fullName || st.user?.fullName).join(', ')}
                              </div>
                            )}
                          </td>

                          {/* GVHD Score */}
                          <td className="p-3 text-center min-w-[130px]">
                            {item.scores?.gvhd !== null && item.scores?.gvhd !== undefined ? (
                              <div className="space-y-0.5">
                                <span className="text-sm font-bold text-slate-900">{item.scores.gvhd} / 10</span>
                                <div>
                                  {item.scoreBreakdown?.gvhd?.isDraft ? (
                                    <Badge variant="warning" size="sm">Bản nháp</Badge>
                                  ) : (
                                    <Badge variant="success" size="sm">Đã khóa</Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Badge variant="danger" size="sm">Chưa có điểm</Badge>
                            )}
                          </td>

                          {/* GVPB Score */}
                          <td className="p-3 text-center min-w-[130px]">
                            {item.reviewer ? (
                              item.scores?.gvpb !== null && item.scores?.gvpb !== undefined ? (
                                <div className="space-y-0.5">
                                  <span className="text-sm font-bold text-slate-900">{item.scores.gvpb} / 10</span>
                                  <div>
                                    {item.scoreBreakdown?.gvpb?.isDraft ? (
                                      <Badge variant="warning" size="sm">Bản nháp</Badge>
                                    ) : (
                                      <Badge variant="success" size="sm">Đã khóa</Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto">
                                    {item.reviewer.fullName}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <Badge variant="warning" size="sm">Chưa nhập</Badge>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto">
                                    {item.reviewer.fullName}
                                  </div>
                                </div>
                              )
                            ) : (
                              <Badge variant="neutral" size="sm">Chưa phân công</Badge>
                            )}
                          </td>

                          {/* Hội đồng Score */}
                          <td className="p-3 text-center min-w-[140px]">
                            {item.scores?.council !== null && item.scores?.council !== undefined ? (
                              <div className="space-y-0.5">
                                <span className="text-sm font-bold text-slate-900">{item.scores.council} / 10</span>
                                <div>
                                  <Badge variant="primary" size="sm">
                                    {item.scores.councilEvaluationsCount || 0}/{item.scores.councilMembersCount || 0} thành viên
                                  </Badge>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge variant="neutral" size="sm">
                                  {item.defenseSchedule ? 'Chưa chấm' : 'Chưa xếp lịch'}
                                </Badge>
                                {item.scores?.councilMembersCount > 0 && (
                                  <div className="text-[10px] text-slate-400">
                                    {item.scores.councilEvaluationsCount || 0}/{item.scores.councilMembersCount} thành viên
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* NCKH Bonus */}
                          <td className="p-3 text-center min-w-[90px]">
                            {item.scores?.bonusPoints > 0 ? (
                              <Badge variant="purple" size="sm" className="font-bold">
                                +{item.scores.bonusPoints}đ
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Điểm tổng kết */}
                          <td className="p-3 text-center min-w-[120px]">
                            {item.finalScore !== null && item.finalScore !== undefined ? (
                              <div className="space-y-1">
                                <div className="text-base font-extrabold text-indigo-900">
                                  {item.finalScore} / 10
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                  <Badge
                                    size="sm"
                                    variant={
                                      item.ketQua === 'DAT'
                                        ? item.xepLoai === 'Xuất sắc'
                                          ? 'purple'
                                          : 'success'
                                        : 'danger'
                                    }
                                  >
                                    {item.xepLoai || (item.ketQua === 'DAT' ? 'ĐẠT' : 'KHÔNG ĐẠT')}
                                  </Badge>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium">Chưa hoàn tất</span>
                            )}
                          </td>

                          {/* Tình trạng & Cảnh báo */}
                          <td className="p-3 min-w-[240px]">
                            {isComplete ? (
                              <Badge variant="success" size="sm" className="gap-1 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đầy đủ điểm
                              </Badge>
                            ) : hasWarning ? (
                              <div className="space-y-1">
                                <Badge variant="warning" size="sm" className="gap-1 font-semibold text-amber-800 bg-amber-100 border-amber-300">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  {warnings.length} Cảnh báo thiếu điểm
                                </Badge>
                                <ul className="space-y-0.5 text-[11px] text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
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

                          {/* Thao tác */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExportScoreSheetPdf(item.id)}
                                title="Xuất phiếu điểm PDF chính thức cho nhóm này"
                                className="text-rose-700 border-rose-200 hover:bg-rose-50 px-2"
                              >
                                <Download className="w-3.5 h-3.5 mr-1 text-rose-600" />
                                PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedScoreDetails(item)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Chi tiết
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!Array.isArray(semesterScores) || semesterScores.length === 0) && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                          Không có dữ liệu điểm nào phù hợp tiêu chuẩn tìm kiếm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: Score Unlocking Requests */}
      {activeTab === 'score-locks' && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-amber-600" />
              Yêu cầu mở khóa chỉnh sửa điểm từ Giảng viên ({scoreRequests.length})
            </h3>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {scoreRequests.map((req) => (
                <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          req.status === 'APPROVED' ? 'success' : req.status === 'REJECTED' ? 'danger' : 'warning'
                        }
                      >
                        {req.status}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-700">
                        Giảng viên: {req.requester?.fullName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800">
                      Nhóm: <b>{req.group?.name ?? req.group?.code}</b>
                      {req.group?.topic?.title && (
                        <span className="text-slate-500 block text-[11px] mt-0.5 font-medium">
                          Đề tài: {req.group.topic.title}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      Lý do giải trình: {req.reason}
                    </p>
                    {req.expiresAt && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 mt-1.5 font-medium">
                        Thời hạn cho phép sửa: {new Date(req.expiresAt).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {req.rejectReason && (
                      <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-100 mt-1.5 font-medium">
                        Lý do từ chối: {req.rejectReason}
                      </p>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="success" onClick={() => handleReviewScoreRequest(req.id, true)}>
                        Duyệt mở khóa
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleReviewScoreRequest(req.id, false)}>
                        Từ chối
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {scoreRequests.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">Không có yêu cầu sửa điểm nào.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: Review NCKH Evidence */}
      {activeTab === 'evidence' && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Xét duyệt Minh chứng NCKH & Cộng điểm thưởng ({pendingEvidence.length})
            </h3>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {pendingEvidence.map((ev) => (
                <div key={ev.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">{ev.status}</Badge>
                      <span className="text-xs font-semibold text-slate-700">
                        Sinh viên: {ev.user?.fullName} ({ev.user?.email})
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                    <p className="text-xs text-slate-600">{ev.description || 'Không có mô tả'}</p>
                    {ev.fileName && (
                      <span className="text-xs text-indigo-600 font-medium">Tệp đính kèm: {ev.fileName}</span>
                    )}
                    {ev.reviewNote && (
                      <span className="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded block mt-1 font-medium">
                        Phản hồi: {ev.reviewNote}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedEvidence(ev);
                      setShowEvidenceReviewModal(true);
                    }}
                  >
                    Duyệt & Cộng điểm
                  </Button>
                </div>
              ))}
              {pendingEvidence.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">Không có hồ sơ NCKH nào đang chờ duyệt.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 7: Reports & Export */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Kết xuất Dữ liệu & Báo cáo Bộ môn
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống hỗ trợ kết xuất báo cáo chuẩn định dạng Excel (.xlsx) có tiêu đề navy blue in đậm và kết xuất Phiếu điểm KLTN chính thức định dạng PDF kèm đầy đủ điểm thành phần, xếp loại và 4 chữ ký (GVHD, GVPB, Thư ký, Chủ tịch Hội đồng).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* 1. Bảng điểm & Phiếu điểm */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Award className="w-4 h-4 text-purple-600" />
                      Điểm Khóa Luận Tốt Nghiệp
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Bảng điểm tổng hợp 10 tiêu chí (GVHD 30%, GVPB 30%, HĐ 40%, thưởng NCKH) và phiếu điểm chính thức chuẩn mẫu.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel('scores')} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Xuất Excel (.xlsx)
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleExportScoreSheetPdf()} className="bg-purple-700 hover:bg-purple-800">
                      <Download className="w-3.5 h-3.5 mr-1" /> Xuất PDF Phiếu điểm
                    </Button>
                  </div>
                </div>

                {/* 2. Khối lượng công việc Giảng viên */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      Khối lượng công việc Giảng viên (Workload)
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Thống kê số nhóm hướng dẫn, phản biện, hội đồng tham gia, hạn mức và cảnh báo quá tải của từng cán bộ.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel('workload')} className="text-indigo-700 border-indigo-300 hover:bg-indigo-50">
                      <Download className="w-3.5 h-3.5 mr-1" /> Xuất Tải Giảng viên (.xlsx)
                    </Button>
                  </div>
                </div>

                {/* 3. Danh sách Đăng ký */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Users className="w-4 h-4 text-blue-600" />
                      Danh sách Đăng ký KLTN
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Tổng hợp toàn bộ danh sách đăng ký đề tài của sinh viên trong đợt, trạng thái duyệt đơn và GVHD.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel('registrations')} className="text-blue-700 border-blue-300 hover:bg-blue-50">
                      <Download className="w-3.5 h-3.5 mr-1" /> Xuất DS Đăng ký (.xlsx)
                    </Button>
                  </div>
                </div>

                {/* 4. Danh mục Đề tài */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Layers className="w-4 h-4 text-teal-600" />
                      Danh mục Đề tài KLTN
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Toàn bộ danh mục đề tài được GV đề xuất và đã xét duyệt, chỉ tiêu sinh viên và chuyên ngành.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel('topics')} className="text-teal-700 border-teal-300 hover:bg-teal-50">
                      <Download className="w-3.5 h-3.5 mr-1" /> Xuất DS Đề tài (.xlsx)
                    </Button>
                  </div>
                </div>

                {/* 5. Lịch & Hội đồng Bảo vệ */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3 md:col-span-2">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      Lịch Bảo vệ & Phân công Hội đồng
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Danh sách lịch bảo vệ chính thức của các nhóm KLTN, phòng thi, thời gian và thành viên Hội đồng chấm.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel('defense-schedules')} className="text-amber-700 border-amber-300 hover:bg-amber-50">
                      <Download className="w-3.5 h-3.5 mr-1" /> Xuất Lịch Bảo vệ (.xlsx)
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

        </div>
      </div>

      {/* MODAL: Review Topic */}
      <Modal isOpen={showReviewTopicModal} onClose={() => setShowReviewTopicModal(false)} title="Xét duyệt Đề tài KLTN">
        <div className="space-y-4 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200">
            <div>
              <div className="font-bold text-slate-900 text-base">{selectedTopic?.title}</div>
              {selectedTopic?.titleEn && (
                <div className="text-xs text-slate-500 italic mt-0.5">{selectedTopic.titleEn}</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
              <div>
                <span className="font-semibold text-slate-700">GV đề xuất:</span>{' '}
                {selectedTopic?.owner?.fullName ?? selectedTopic?.gvhd?.hoTen ?? 'Chưa cập nhật'}
                <div className="text-[11px] text-slate-400">{selectedTopic?.owner?.email ?? selectedTopic?.gvhd?.email}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Bộ môn / Ngành:</span>{' '}
                {selectedTopic?.department?.name ?? selectedTopic?.chuyenNganh?.ten ?? 'Tùy chọn'}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Học kỳ:</span>{' '}
                {selectedTopic?.semester?.name ?? selectedTopic?.hocKy?.ten ?? 'Hiện tại'}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Chỉ tiêu tối đa:</span>{' '}
                <span className="font-bold text-indigo-600">{selectedTopic?.capacity ?? selectedTopic?.soLuongToiDa ?? 2} sinh viên</span>
              </div>
            </div>
            {(selectedTopic?.description || selectedTopic?.moTa || selectedTopic?.summary) && (
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Mô tả / Tóm tắt:</span>
                <p className="mt-0.5 whitespace-pre-line text-slate-600 leading-relaxed">
                  {selectedTopic?.description || selectedTopic?.moTa || selectedTopic?.summary}
                </p>
              </div>
            )}
            {(selectedTopic?.requirements || selectedTopic?.yeuCauSinhVien) && (
              <div className="text-xs text-slate-600 pt-1">
                <span className="font-semibold text-slate-700">Yêu cầu sinh viên:</span>
                <p className="mt-0.5 whitespace-pre-line text-slate-600 leading-relaxed">
                  {selectedTopic?.requirements || selectedTopic?.yeuCauSinhVien}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ghi chú / Nhận xét (Bắt buộc nếu từ chối hoặc yêu cầu chỉnh sửa)
            </label>
            <textarea
              rows={3}
              placeholder="Nhập nhận xét, lý do từ chối hoặc nội dung cần chỉnh sửa..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3 pt-3">
            <Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={handleRequestChanges}>
              <AlertTriangle className="w-4 h-4 mr-1.5" /> Yêu cầu chỉnh sửa
            </Button>
            <Button variant="danger" onClick={() => handleReviewTopic(false)}>
              <XCircle className="w-4 h-4 mr-1.5" /> Từ chối
            </Button>
            <Button variant="success" onClick={() => handleReviewTopic(true)}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Phê duyệt
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Quota */}
      <Modal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} title="Điều chỉnh Hạn mức Hướng dẫn Giảng viên">
        <form onSubmit={handleUpdateQuota} className="space-y-4 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800 text-base">{selectedLecturer?.fullName}</div>
            <div className="text-xs text-slate-500">{selectedLecturer?.title} - {selectedLecturer?.email}</div>
            {currentSemester && (
              <div className="text-xs text-indigo-600 font-medium pt-1">
                Áp dụng cho học kỳ: <span className="font-bold">{currentSemester.name}</span> ({currentSemester.code})
              </div>
            )}
            <div className="text-xs text-slate-600 pt-1">
              Số nhóm đang hướng dẫn: <span className="font-bold text-slate-800">{selectedLecturer?.currentGroups ?? selectedLecturer?.guidedGroupsCount ?? 0}</span>
            </div>
          </div>
          <Input
            type="number"
            min={1}
            max={20}
            label="Số nhóm hướng dẫn tối đa trong học kỳ"
            value={newQuota}
            onChange={(e) => setNewQuota(Number(e.target.value))}
            required
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowQuotaModal(false)}>Hủy</Button>
            <Button type="submit" variant="primary">Lưu hạn mức</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Assign 2 Reviewers */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Phân công 2 Giảng viên phản biện (GVPB)"
      >
        <form onSubmit={handleAssignReviewer} className="space-y-4 text-sm">
          {/* Thông tin nhóm KLTN */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                {availableReviewerData?.groupCode || allGroups.find((g) => g.id === assignGroupId)?.code}
              </span>
              {availableReviewerData?.isReadyForReview ? (
                <Badge variant="success" size="sm">Đã CHO_LAM_TIEP</Badge>
              ) : (
                <Badge variant="warning" size="sm">Chưa CHO_LAM_TIEP</Badge>
              )}
            </div>
            <div className="font-semibold text-slate-800 text-sm">
              {availableReviewerData?.topicTitle ||
                allGroups.find((g) => g.id === assignGroupId)?.topic?.title ||
                allGroups.find((g) => g.id === assignGroupId)?.name}
            </div>
            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="font-medium text-slate-500">Giảng viên hướng dẫn (GVHD):</span>
              <span className="font-semibold text-purple-700">
                {availableReviewerData?.gvhd?.fullName ||
                  allGroups.find((g) => g.id === assignGroupId)?.topic?.owner?.fullName ||
                  'Chưa xác định'}
              </span>
              <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                (Tự động loại trừ khỏi GVPB)
              </span>
            </div>
          </div>

          {loadingAvailable && (
            <div className="p-4 text-center text-xs text-indigo-600 animate-pulse bg-indigo-50/50 rounded-lg border border-indigo-100">
              Đang kiểm tra chỉ tiêu phản biện và đề xuất cặp giảng viên phù hợp...
            </div>
          )}

          {!loadingAvailable && availableReviewerData && !availableReviewerData.hasEnoughReviewers && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cảnh báo: Không đủ giảng viên phù hợp!</p>
                <p className="mt-0.5">{availableReviewerData.message}</p>
              </div>
            </div>
          )}

          {!loadingAvailable && availableReviewerData && (
            <>
              {/* Chế độ chọn: Theo Cặp hoặc Thủ công */}
              <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAssignMode('pair')}
                  className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                    assignMode === 'pair'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👥 Chọn theo cặp GVPB (Khuyên dùng)
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('custom')}
                  className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all ${
                    assignMode === 'custom'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👤 Chọn riêng từng giảng viên
                </button>
              </div>

              {/* Mode: Pair */}
              {assignMode === 'pair' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Danh sách cặp GVPB đề xuất (Thuận tiện xếp phòng & khung giờ)
                    </label>
                    {availableReviewerData.suggestedPairs?.length > 0 ? (
                      <select
                        value={selectedPairId}
                        onChange={(e) => handleSelectPair(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        required
                      >
                        <option value="">-- Chọn cặp Giảng viên phản biện --</option>
                        {availableReviewerData.suggestedPairs.map((p: any) => (
                          <option key={p.pairId} value={p.pairId}>
                            {p.name} (Chỉ tiêu chung còn: {p.remainingSlots} nhóm)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-amber-600 italic">
                        Chưa có cặp giảng viên tạo sẵn. Vui lòng chuyển sang tab &quot;Chọn riêng từng giảng viên&quot;.
                      </p>
                    )}
                  </div>

                  {/* Hiển thị chi tiết 2 giảng viên của cặp đã chọn */}
                  {selectedPairId && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/60 rounded-lg border border-purple-100 text-xs">
                      <div>
                        <span className="font-semibold text-purple-900">GVPB 1 (Chính):</span>
                        <div className="font-medium text-slate-800 mt-0.5">
                          {availableReviewerData.suggestedPairs.find((p: any) => p.pairId === selectedPairId)?.reviewer1?.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {availableReviewerData.suggestedPairs.find((p: any) => p.pairId === selectedPairId)?.reviewer1?.email}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-900">GVPB 2 (Phụ):</span>
                        <div className="font-medium text-slate-800 mt-0.5">
                          {availableReviewerData.suggestedPairs.find((p: any) => p.pairId === selectedPairId)?.reviewer2?.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {availableReviewerData.suggestedPairs.find((p: any) => p.pairId === selectedPairId)?.reviewer2?.email}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode: Custom */}
              {assignMode === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Giảng viên phản biện 1 (Phản biện chính - PRIMARY)
                    </label>
                    <select
                      value={assignReviewer1Id}
                      onChange={(e) => setAssignReviewer1Id(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      required
                    >
                      <option value="">-- Chọn GVPB 1 --</option>
                      {availableReviewerData.allReviewers?.map((l: any) => {
                        const disabled = !l.isAvailable || l.id === assignReviewer2Id;
                        return (
                          <option key={l.id} value={l.id} disabled={disabled}>
                            {l.fullName} ({l.lecturerCode}) {l.isAdvisor ? ' [GVHD - Không thể chọn]' : l.isOverloaded ? ` [Đã đủ tải ${l.currentReviewCount}/${l.maxReviews}]` : ` (Còn ${l.remainingSlots} lượt)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Giảng viên phản biện 2 (Phản biện phụ - ADDITIONAL)
                    </label>
                    <select
                      value={assignReviewer2Id}
                      onChange={(e) => setAssignReviewer2Id(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    >
                      <option value="">-- Chọn GVPB 2 --</option>
                      {availableReviewerData.allReviewers?.map((l: any) => {
                        const disabled = !l.isAvailable || l.id === assignReviewer1Id;
                        return (
                          <option key={l.id} value={l.id} disabled={disabled}>
                            {l.fullName} ({l.lecturerCode}) {l.isAdvisor ? ' [GVHD - Không thể chọn]' : l.isOverloaded ? ` [Đã đủ tải ${l.currentReviewCount}/${l.maxReviews}]` : ` (Còn ${l.remainingSlots} lượt)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowAssignModal(false)}>Hủy</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loadingAvailable || !assignReviewer1Id || !assignReviewer2Id || assignReviewer1Id === assignReviewer2Id}
            >
              Lưu phân công 2 GVPB
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Create Committee */}
      <Modal
        isOpen={showCommitteeModal}
        onClose={() => {
          setShowCommitteeModal(false);
          setSelectedMemberIds([]);
          setSelectedCommitteeGroupIds([]);
          setCommitteeName('');
        }}
        title="Thành lập Hội đồng bảo vệ KLTN"
      >
        <form onSubmit={handleCreateCommittee} className="space-y-4 text-sm">
          <Input
            label="Tên hội đồng (Tùy chọn)"
            placeholder="VD: Hội đồng Chấm KLTN số 01 (Để trống sẽ tự động tạo)"
            value={committeeName}
            onChange={(e) => setCommitteeName(e.target.value)}
          />

          {/* Chọn nhóm bảo vệ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                1. Chọn nhóm bảo vệ (Đã CHO LÀM TIẾP)
              </label>
              <span className="text-xs font-medium text-indigo-600">
                Đã chọn: <b>{selectedCommitteeGroupIds.length}</b> nhóm
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 p-2.5 rounded-lg bg-slate-50">
              {eligibleCommitteeGroups.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-2 text-center">
                  Không có nhóm nào đủ điều kiện bảo vệ (Cần kết quả giữa kỳ: CHO LÀM TIẾP).
                </div>
              ) : (
                eligibleCommitteeGroups.map((grp: any) => {
                  const isChecked = selectedCommitteeGroupIds.includes(grp.id);
                  const advisorName = grp.topic?.owner?.fullName || grp.gvhd?.fullName || 'Chưa xác định';
                  return (
                    <div
                      key={grp.id}
                      onClick={() => toggleCommitteeGroup(grp.id)}
                      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors text-xs ${
                        isChecked
                          ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 font-medium shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="font-mono font-bold mr-1.5">{grp.code}</span>
                          <span>{grp.topic?.title || grp.name}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0 ml-2">
                        GVHD: <span className="font-semibold text-purple-700">{advisorName}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chọn thành viên hội đồng */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                2. Chọn thành viên Hội đồng (Tối thiểu 3)
              </label>
              <Badge
                variant={selectedMemberIds.length >= 3 ? 'success' : 'warning'}
                size="sm"
              >
                Đã chọn: {selectedMemberIds.length}/3 tối thiểu
              </Badge>
            </div>
            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 bg-purple-50/50 p-2 rounded border border-purple-100">
              <span className="font-medium text-slate-600">💡 Thứ tự chọn:</span>
              <span className="font-semibold text-purple-700">1. Chủ tịch</span> •
              <span className="font-semibold text-blue-700">2. Thư ký</span> •
              <span className="font-semibold text-indigo-700">3. UV Phản biện</span> •
              <span className="font-semibold text-slate-600">4+. Ủy viên</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 p-2.5 rounded-lg bg-slate-50">
              {lecturers.map((l: any) => {
                const lecUserId = l.user?.id || l.userId || l.id;
                const isChecked = selectedMemberIds.includes(lecUserId);
                const isConflict = selectedGroupAdvisors.has(lecUserId);
                const memberIdx = selectedMemberIds.indexOf(lecUserId);
                const roleLabel =
                  memberIdx === 0
                    ? 'Chủ tịch'
                    : memberIdx === 1
                    ? 'Thư ký'
                    : memberIdx === 2
                    ? 'UV Phản biện'
                    : memberIdx > 2
                    ? 'Ủy viên'
                    : null;

                return (
                  <div
                    key={l.id || lecUserId}
                    onClick={() => {
                      if (!isConflict) toggleCommitteeMember(lecUserId);
                    }}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
                      isConflict
                        ? 'bg-red-50/60 border-red-200 opacity-70 cursor-not-allowed'
                        : isChecked
                        ? 'bg-purple-50/90 border-purple-300 text-purple-950 font-medium shadow-sm cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isConflict}
                        onChange={() => {}}
                        className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-40"
                      />
                      <div>
                        <span className="font-semibold">{l.user?.fullName || l.fullName}</span>
                        <span className="text-slate-500 text-[11px] ml-1.5">
                          ({l.lecturerCode || l.code || l.department?.name || 'Giảng viên'})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isConflict && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                          Xung đột: GVHD nhóm đã chọn
                        </span>
                      )}
                      {isChecked && roleLabel && (
                        <Badge
                          variant={
                            memberIdx === 0 ? 'purple' : memberIdx === 1 ? 'primary' : 'neutral'
                          }
                          size="sm"
                        >
                          {roleLabel}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="text-xs">
              {selectedMemberIds.length < 3 ? (
                <span className="text-amber-600 font-medium">⚠️ Cần chọn thêm tối thiểu {3 - selectedMemberIds.length} thành viên</span>
              ) : (
                <span className="text-emerald-600 font-medium">✓ Đủ điều kiện thành lập hội đồng</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCommitteeModal(false);
                  setSelectedMemberIds([]);
                  setSelectedCommitteeGroupIds([]);
                  setCommitteeName('');
                }}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={selectedMemberIds.length < 3}
              >
                Tạo hội đồng
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Schedule Defense */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setScheduleGroupId('');
          setScheduleCommitteeId('');
          setScheduleRoom('');
          setScheduleStartsAt('');
          setScheduleEndsAt('');
        }}
        title="Xếp Lịch & Chỉ định Phòng bảo vệ KLTN"
      >
        <form onSubmit={handleCreateSchedule} className="space-y-4 text-sm">
          {/* Nhóm bảo vệ */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Nhóm bảo vệ (Đã CHO LÀM TIẾP)
              </label>
              {scheduleGroupId && (
                <span className="text-[11px] text-indigo-600 font-medium">
                  {allGroups.find((g) => g.id === scheduleGroupId)?.topic?.owner?.fullName ? `GVHD: ${allGroups.find((g) => g.id === scheduleGroupId)?.topic?.owner?.fullName}` : ''}
                </span>
              )}
            </div>
            <select
              value={scheduleGroupId}
              onChange={(e) => handleSelectScheduleGroup(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="">-- Chọn nhóm bảo vệ (Hoặc để trống nếu xếp cho cả Hội đồng) --</option>
              {allGroups
                .filter((g) => g.midtermStatus === 'CONTINUE' || g.midtermStatus === 'CHO_LAM_TIEP')
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} - {g.topic?.title || g.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Hội đồng chấm */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Hội đồng chấm bảo vệ
            </label>
            <select
              value={scheduleCommitteeId}
              onChange={(e) => setScheduleCommitteeId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="">-- Chọn hội đồng chấm --</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.members?.length || 0} thành viên)
                </option>
              ))}
            </select>
          </div>

          {/* Phòng bảo vệ */}
          <div>
            <Input
              label="Phòng bảo vệ"
              placeholder="VD: Phòng B102 hoặc Hội trường A"
              value={scheduleRoom}
              onChange={(e) => setScheduleRoom(e.target.value)}
              required
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 font-medium">Gợi ý phòng:</span>
              {['B101', 'B102', 'B103', 'Hội trường A', 'Hội trường B', 'Phòng Hội thảo'].map((rm) => (
                <button
                  key={rm}
                  type="button"
                  onClick={() => setScheduleRoom(rm)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    scheduleRoom === rm
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {rm}
                </button>
              ))}
            </div>
          </div>

          {/* Thời gian */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="datetime-local"
                label="Thời gian bắt đầu"
                value={scheduleStartsAt}
                onChange={(e) => {
                  setScheduleStartsAt(e.target.value);
                  if (e.target.value) {
                    const start = new Date(e.target.value);
                    const end = new Date(start.getTime() + 60 * 60000);
                    const pad = (n: number) => (n < 10 ? '0' + n : n);
                    setScheduleEndsAt(
                      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`,
                    );
                  }
                }}
                required
              />
              <Input
                type="datetime-local"
                label="Thời gian kết thúc"
                value={scheduleEndsAt}
                onChange={(e) => setScheduleEndsAt(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Thời lượng nhanh:</span>
              {[45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setScheduleDurationMins(mins)}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 transition-colors"
                >
                  {mins} phút
                </button>
              ))}
            </div>
          </div>

          {/* Quy tắc bảo vệ & cảnh báo */}
          <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <span>🛡️ Kiểm tra chống xung đột tự động:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
              <li><b>Trùng phòng:</b> Không thể xếp 2 nhóm/hội đồng cùng 1 phòng tại thời điểm giao nhau.</li>
              <li><b>Trùng thành viên:</b> Giảng viên trong hội đồng không thể tham gia 2 hội đồng cùng thời điểm.</li>
              <li><b>Thông báo tức thì:</b> Sinh viên, Hội đồng, GVHD và GVPB sẽ nhận được thông báo ngay khi lịch được lưu.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowScheduleModal(false);
                setScheduleGroupId('');
                setScheduleCommitteeId('');
                setScheduleRoom('');
                setScheduleStartsAt('');
                setScheduleEndsAt('');
              }}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={(!scheduleGroupId && !scheduleCommitteeId) || !scheduleStartsAt || !scheduleRoom}
            >
              Lưu & Công bố lịch bảo vệ
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Evidence Review */}
      <Modal isOpen={showEvidenceReviewModal} onClose={() => setShowEvidenceReviewModal(false)} title="Xét duyệt Minh chứng NCKH">
        <div className="space-y-4 text-sm">
          <div>
            <div className="font-bold text-slate-900">{selectedEvidence?.title}</div>
            <div className="text-xs text-slate-500">Sinh viên: {selectedEvidence?.user?.fullName}</div>
            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              {selectedEvidence?.description || 'Không có mô tả'}
            </p>
          </div>

          <Input
            type="number"
            step="0.1"
            min="0"
            max="2"
            label="Điểm thưởng NCKH cộng thêm (Tối đa 2.0)"
            value={evidencePoints}
            onChange={(e) => setEvidencePoints(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Ghi chú duyệt</label>
            <textarea
              rows={2}
              placeholder="Ghi chú đánh giá bài báo/giải thưởng..."
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => handleReviewEvidence('request_more_info')}>Yêu cầu bổ sung</Button>
            <Button variant="danger" onClick={() => handleReviewEvidence('reject')}>Từ chối</Button>
            <Button variant="success" onClick={() => handleReviewEvidence('approve')}>Phê duyệt & Cộng điểm</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Score Details & Breakdown */}
      <Modal
        isOpen={!!selectedScoreDetails}
        onClose={() => setSelectedScoreDetails(null)}
        title={`Chi tiết Bảng điểm: ${selectedScoreDetails?.code || ''}`}
      >
        {selectedScoreDetails && (
          <div className="space-y-4 text-xs">
            {/* Header Summary */}
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

            {/* Formula */}
            <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                Công thức & Trọng số tính điểm
              </div>
              <p className="text-xs text-purple-950 font-mono">
                {selectedScoreDetails.congThucTinh || 'Chưa có công thức'}
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-purple-800">
                <span>Điểm tổng kết: <b className="text-sm">{selectedScoreDetails.finalScore ?? '—'} / 10</b></span>
                <span>• Xếp loại: <b>{selectedScoreDetails.xepLoai || '—'}</b></span>
                <span>• Kết quả: <b>{selectedScoreDetails.ketQua || '—'}</b></span>
              </div>
            </div>

            {/* Council breakdown */}
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

            {/* Incomplete Warnings List */}
            {selectedScoreDetails.scoreCompleteness?.warnings?.length > 0 && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-1">
                <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Cảnh báo điểm chưa hoàn tất ({selectedScoreDetails.scoreCompleteness.warnings.length})
                </div>
                <ul className="space-y-1 text-xs text-amber-900 pt-1">
                  {selectedScoreDetails.scoreCompleteness.warnings.map((w: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
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

