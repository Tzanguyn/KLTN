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
  Lock,
  RefreshCw,
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
  GraduationCap,
} from 'lucide-react';
import { HeadWelcomeView } from '../dashboard/HeadWelcomeView';
import { WorkspaceSidebar } from './WorkspaceSidebar';

export const HeadWorkspace: React.FC = () => {
  const { user, setActiveRole, activeTab: storeActiveTab, setActiveTab: setStoreActiveTab } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>(storeActiveTab || 'welcome');

  useEffect(() => {
    if (storeActiveTab) {
      setActiveTab(storeActiveTab);
      setStoreActiveTab(null);
    }
  }, [storeActiveTab]);

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

  // Score Unlock State
  const [showDirectUnlockModal, setShowDirectUnlockModal] = useState(false);
  const [directUnlockGroupId, setDirectUnlockGroupId] = useState('');
  const [directUnlockHours, setDirectUnlockHours] = useState(24);
  const [directUnlockReason, setDirectUnlockReason] = useState('');
  const [unlockFilterStatus, setUnlockFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [isUnlocking, setIsUnlocking] = useState(false);

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
  const [approvalSourceFilter, setApprovalSourceFilter] = useState<'ALL' | 'GIANG_VIEN' | 'SINH_VIEN'>('ALL');
  const [catalogSourceFilter, setCatalogSourceFilter] = useState<'ALL' | 'GIANG_VIEN' | 'SINH_VIEN'>('ALL');
  const [hasSemesterDefaultQuota, setHasSemesterDefaultQuota] = useState(false);
  const [semesterDefaultQuota, setSemesterDefaultQuota] = useState<number>(5);
  const [bulkQuotaInput, setBulkQuotaInput] = useState<number>(5);
  const [savingBulkQuota, setSavingBulkQuota] = useState(false);
  const [scoreGvhdFilter, setScoreGvhdFilter] = useState<string>('');

  const isStudentTopic = (t: any) =>
    Boolean(
      t?.isStudentProposed ||
        t?.sourceType === 'SINH_VIEN' ||
        t?.technologies?.toLowerCase()?.includes('đề xuất sinh viên'),
    );

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [pendingTopRes, topRes, quotaRes, lecRes, comRes, schRes, scrRes, eviRes, dashRes] = await Promise.all([
        api.get('/topics?status=CHO_DUYET').catch(() => null),
        api.get('/topics?limit=100'),
        api.get('/quotas').catch(() => null),
        api.get('/users/lecturers'),
        api.get('/defense-committees').catch(() => api.get('/defense/committees')),
        api.get('/defense-schedules').catch(() => api.get('/defense/schedules')),
        api.get('/score-unlock-requests').catch(() => api.get('/scores/change-requests')),
        api.get('/evidences?status=PENDING').catch(() => api.get('/evidence/pending')),
        api.get('/dashboard?role=TRUONG_BO_MON').catch(() => null),
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

      const officialSem = dashRes?.data?.data?.semester || quotaRes?.data?.data?.semester || null;
      if (officialSem) {
        setCurrentSemester(officialSem);
      }

      if (quotaRes?.data?.data) {
        const qData = quotaRes.data.data;
        setWorkload(qData.items ?? qData);
        const hasDef = Boolean(qData.hasSemesterDefaultQuota ?? qData.semester?.hasSemesterDefaultQuota);
        const defVal = qData.semesterDefaultQuota ?? qData.semester?.semesterDefaultQuota;
        setHasSemesterDefaultQuota(hasDef);
        if (defVal !== undefined && defVal !== null) {
          setSemesterDefaultQuota(Number(defVal));
          setBulkQuotaInput(Number(defVal));
        }
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

  const fetchSemesterScores = async (
    incompleteOnly = scoreIncompleteOnly,
    search = scoreSearch,
    gvhdId = scoreGvhdFilter,
  ) => {
    setLoadingScores(true);
    try {
      const params: any = {};
      if (currentSemester?.id) params.semesterId = currentSemester.id;
      if (incompleteOnly) params.incompleteOnly = 'true';
      if (search.trim()) params.search = search.trim();
      if (gvhdId) params.lecturerId = gvhdId;
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

  // Step 1: Set default quota for ALL lecturers in the semester
  const handleSetBulkQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBulkQuota(true);
    try {
      const res = await api.put('/quotas/bulk', {
        semesterId: currentSemester?.id,
        maxGroups: Number(bulkQuotaInput),
      });
      notify(
        res.data?.data?.message ||
          `Đã áp dụng hạn mức chung (${bulkQuotaInput} nhóm) cho toàn bộ giảng viên trong học kỳ!`,
      );
      setHasSemesterDefaultQuota(true);
      setSemesterDefaultQuota(Number(bulkQuotaInput));
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi thiết lập hạn mức chung cho toàn kỳ', 'error');
    } finally {
      setSavingBulkQuota(false);
    }
  };

  // Step 2: Update individual lecturer quota
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

  // Direct unlock for a group
  const handleDirectUnlockGroup = (groupId?: string) => {
    setDirectUnlockGroupId(groupId || '');
    setDirectUnlockHours(24);
    setDirectUnlockReason('');
    setShowDirectUnlockModal(true);
  };

  const handleConfirmDirectUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!directUnlockGroupId) {
      notify('Vui lòng chọn nhóm cần mở khóa điểm!', 'error');
      return;
    }
    try {
      setIsUnlocking(true);
      await api.patch(`/scores/groups/${directUnlockGroupId}/unlock`, {
        hours: directUnlockHours || 24,
        reason: directUnlockReason || 'Trưởng bộ môn trực tiếp mở khóa điểm',
      });
      notify(`Đã mở khóa điểm cho nhóm thành công (thời hạn ${directUnlockHours} giờ)!`);
      setShowDirectUnlockModal(false);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi khi mở khóa điểm', 'error');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRelockGroup = async (groupId: string, groupCode?: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn khóa lại điểm ngay lập tức cho nhóm ${groupCode || ''}?`)) {
      return;
    }
    try {
      await api.patch(`/scores/groups/${groupId}/lock`);
      notify(`Đã khóa lại điểm cho nhóm ${groupCode || ''}!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi khi khóa lại điểm', 'error');
    }
  };

  const handleExtendScoreUnlock = async (req: any) => {
    const hoursStr = window.prompt(
      `Gia hạn / Mở khóa lại điểm cho nhóm ${req.group?.code || req.group?.name || ''}.\nNhập số giờ cho phép sửa điểm tính từ thời điểm này (mặc định 24h):`,
      '24'
    );
    if (hoursStr === null) return;
    const hours = Number(hoursStr) || 24;
    try {
      if (req.id) {
        await api.post(`/score-unlock-requests/${req.id}/approve`, { thoiHanChoPhepSua: hours });
      } else if (req.groupId || req.group?.id) {
        await api.patch(`/scores/groups/${req.groupId || req.group?.id}/unlock`, { hours });
      }
      notify(`Đã gia hạn mở khóa điểm thành công thêm ${hours} giờ!`);
      loadData();
    } catch (err: any) {
      notify(err.response?.data?.message ?? 'Lỗi khi gia hạn mở khóa điểm', 'error');
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
        <WorkspaceSidebar
          title="Điều hành Chuyên môn"
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId)}
          themeColor="purple"
          infoCard={
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
              </div>
            </div>
          }
        />

        {/* NỘI DUNG CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
        <div className="flex-1 min-w-0 w-full space-y-6">
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
              }}
            />
          )}

          {activeTab !== 'welcome' && (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-purple-200 text-xs font-semibold uppercase tracking-wider">
                      <span>Trưởng bộ môn</span>
                      <span>•</span>
                      <span>Điều hành chuyên môn KLTN</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white">{user?.fullName}</h2>
                    <p className="text-purple-100 text-xs sm:text-sm mt-1">
                      Quản lý đề tài, phân công phản biện, thành lập hội đồng và giám sát chất lượng khóa luận
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full md:w-auto bg-white/10 backdrop-blur border border-white/20 p-2.5 sm:p-3 rounded-xl text-xs">
                    <div className="text-center px-2 sm:px-3">
                      <div className="text-purple-200 text-[10px] sm:text-xs">Đề tài chờ duyệt</div>
                      <div className="text-base sm:text-lg font-bold text-white">{pendingTopics.length}</div>
                    </div>
                    <div className="text-center px-2 sm:px-3 border-l border-white/20">
                      <div className="text-purple-200 text-[10px] sm:text-xs">Yêu cầu sửa điểm</div>
                      <div className="text-base sm:text-lg font-bold text-white">{scoreRequests.filter((r) => r.status === 'PENDING').length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

      {/* TAB 1: Topic Approvals */}
      {activeTab === 'approvals' && (() => {
        const lecturerPendingTopics = pendingTopics.filter((t) => !isStudentTopic(t));
        const studentPendingTopics = pendingTopics.filter((t) => isStudentTopic(t));
        const filteredPendingTopics = pendingTopics.filter((t) => {
          if (approvalSourceFilter === 'GIANG_VIEN') return !isStudentTopic(t);
          if (approvalSourceFilter === 'SINH_VIEN') return isStudentTopic(t);
          return true;
        });

        const approvedTopicsList = allTopics.filter((t) => t.status === 'APPROVED');
        const lecturerApprovedCount = approvedTopicsList.filter((t) => !isStudentTopic(t)).length;
        const studentApprovedCount = approvedTopicsList.filter((t) => isStudentTopic(t)).length;
        const filteredApprovedTopics = approvedTopicsList.filter((t) => {
          if (catalogSourceFilter === 'GIANG_VIEN') return !isStudentTopic(t);
          if (catalogSourceFilter === 'SINH_VIEN') return isStudentTopic(t);
          return true;
        });

        return (
          <div className="space-y-6">
            {/* Hàng đợi phê duyệt đề tài (chia rõ GV đề xuất vs SV đề xuất) */}
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    Hàng đợi Trưởng bộ môn phê duyệt đề tài KLTN ({pendingTopics.length} chờ duyệt)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Phân loại rõ đề tài do Giảng viên đề xuất và đề tài do Sinh viên đề xuất để Trưởng bộ môn xét duyệt chính thức.
                  </p>
                </div>

                {/* Bộ lọc chia tab: Tất cả / Do GV đề xuất / Do SV đề xuất */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setApprovalSourceFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      approvalSourceFilter === 'ALL'
                        ? 'bg-purple-700 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Tất cả chờ duyệt</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      approvalSourceFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {pendingTopics.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalSourceFilter('GIANG_VIEN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      approvalSourceFilter === 'GIANG_VIEN'
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    <span>Đề tài do GV đề xuất</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      approvalSourceFilter === 'GIANG_VIEN' ? 'bg-white/20 text-white' : 'bg-indigo-200 text-indigo-900'
                    }`}>
                      {lecturerPendingTopics.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalSourceFilter('SINH_VIEN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      approvalSourceFilter === 'SINH_VIEN'
                        ? 'bg-emerald-600 text-white shadow-xs font-bold'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>Đề tài do SV đề xuất</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      approvalSourceFilter === 'SINH_VIEN' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'
                    }`}>
                      {studentPendingTopics.length}
                    </span>
                  </button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="divide-y divide-slate-100">
                  {filteredPendingTopics.map((topic) => {
                    const isSv = isStudentTopic(topic);
                    const proposer = topic.studentProposer;
                    return (
                      <div key={topic.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={topic.status === 'CAN_CAP_NHAT' ? 'warning' : 'primary'}>
                              {topic.status === 'CAN_CAP_NHAT' ? 'Cần cập nhật' : 'Chờ Trưởng BM duyệt'}
                            </Badge>
                            {isSv ? (
                              <Badge variant="success" className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                                Đề tài do Sinh viên đề xuất
                              </Badge>
                            ) : (
                              <Badge variant="purple" className="bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold">
                                Đề tài do Giảng viên đề xuất
                              </Badge>
                            )}
                            {isSv && (
                              <Badge
                                size="sm"
                                variant={proposer?.gvConfirmed ? 'success' : 'warning'}
                              >
                                {proposer?.gvConfirmed
                                  ? 'GVHD đã đồng ý hướng dẫn'
                                  : 'Đang chờ GVHD xác nhận'}
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900">{topic.title}</h4>

                          {isSv ? (
                            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-slate-700 space-y-1">
                              <div>
                                <span className="font-bold text-emerald-900">Sinh viên đề xuất: </span>
                                <span className="font-semibold text-slate-900">
                                  {proposer
                                    ? `${proposer.fullName} (${proposer.studentCode}${proposer.className ? ` - ${proposer.className}` : ''})`
                                    : 'Sinh viên đăng ký đề xuất'}
                                </span>
                                {proposer?.email && (
                                  <span className="text-slate-500 ml-1">({proposer.email})</span>
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-indigo-900">GVHD dự kiến / xác nhận: </span>
                                <span className="font-semibold text-slate-800">
                                  {topic.owner?.fullName ?? topic.gvhd?.hoTen ?? 'Chưa phân công'} ({topic.owner?.email ?? topic.gvhd?.email})
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-slate-700">
                              Giảng viên đề xuất:{' '}
                              <span className="text-indigo-700 font-bold">
                                {topic.owner?.fullName ?? topic.gvhd?.hoTen ?? 'Giảng viên'}
                              </span>{' '}
                              ({topic.owner?.email ?? topic.gvhd?.email})
                            </div>
                          )}

                          <p className="text-xs text-slate-600 leading-relaxed">{topic.summary || 'Chưa có tóm tắt'}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                            <span>Mục tiêu / Yêu cầu: {topic.objectives || 'Chưa cập nhật'}</span>
                            <span>•</span>
                            <span>Công nghệ: <b className="text-indigo-600">{topic.technologies || 'Tùy chọn'}</b></span>
                            <span>•</span>
                            <span>Chỉ tiêu: {topic.capacity} sinh viên</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <Button
                            size="sm"
                            variant="primary"
                            className="bg-purple-700 hover:bg-purple-800"
                            disabled={isSv && proposer?.gvConfirmed === false}
                            title={
                              isSv && proposer?.gvConfirmed === false
                                ? 'Cần GVHD xác nhận đồng ý hướng dẫn trước khi Trưởng bộ môn phê duyệt'
                                : 'Xét duyệt đề tài'
                            }
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
                            Xét duyệt đề tài
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredPendingTopics.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      {approvalSourceFilter === 'SINH_VIEN'
                        ? 'Hiện không có đề tài nào do Sinh viên đề xuất đang chờ Trưởng bộ môn duyệt.'
                        : approvalSourceFilter === 'GIANG_VIEN'
                        ? 'Hiện không có đề tài nào do Giảng viên đề xuất đang chờ Trưởng bộ môn duyệt.'
                        : 'Tất cả các đề tài đã được xử lý. Không có đề tài nào đang chờ duyệt.'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Danh mục đề tài đã duyệt trong học kỳ (chia rõ GV đề xuất vs SV đề xuất) */}
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    Danh mục đề tài đã duyệt trong học kỳ ({approvedTopicsList.length} đề tài)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tra cứu nhanh các đề tài đã được Trưởng bộ môn phê duyệt theo nguồn đề xuất (Giảng viên / Sinh viên).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCatalogSourceFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      catalogSourceFilter === 'ALL'
                        ? 'bg-slate-800 text-white font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({approvedTopicsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogSourceFilter('GIANG_VIEN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      catalogSourceFilter === 'GIANG_VIEN'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    Do GV đề xuất ({lecturerApprovedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogSourceFilter('SINH_VIEN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      catalogSourceFilter === 'SINH_VIEN'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    Do SV đề xuất ({studentApprovedCount})
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Tên đề tài</th>
                        <th className="p-3">Nguồn đề xuất</th>
                        <th className="p-3">Giảng viên hướng dẫn</th>
                        <th className="p-3">Sinh viên đề xuất / Đăng ký</th>
                        <th className="p-3 text-center">Chỉ tiêu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredApprovedTopics.slice(0, 30).map((t) => {
                        const isSv = isStudentTopic(t);
                        const proposer = t.studentProposer;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70">
                            <td className="p-3 font-semibold text-slate-900 max-w-md">
                              <div className="line-clamp-2">{t.title}</div>
                            </td>
                            <td className="p-3">
                              {isSv ? (
                                <Badge variant="success" size="sm">SV đề xuất</Badge>
                              ) : (
                                <Badge variant="purple" size="sm">GV đề xuất</Badge>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 font-medium">
                              {t.owner?.fullName ?? t.gvhd?.hoTen}
                            </td>
                            <td className="p-3 text-slate-600">
                              {proposer ? (
                                <span className="font-semibold text-emerald-800">
                                  {proposer.fullName} ({proposer.studentCode})
                                </span>
                              ) : (
                                <span>{t.soLuongDaDangKy ?? 0} SV đăng ký</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-indigo-700">
                              {t.soLuongDaDangKy ?? 0}/{t.capacity ?? 2}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredApprovedTopics.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            Không có đề tài nào trong danh mục này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* TAB 2: Lecturer Quota & Workload */}
      {activeTab === 'workload' && (
        <div className="space-y-6">
          {/* BƯỚC 1: Chỉnh hạn mức chung cho TOÀN BỘ giảng viên trong học kỳ */}
          <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/40">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider">
                    Bước 1
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Thiết lập hạn mức chung cho TOÀN BỘ Giảng viên trong học kỳ {currentSemester ? `(${currentSemester.name})` : ''}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Áp dụng đồng loạt hạn mức số nhóm hướng dẫn tối đa cho toàn bộ giảng viên trong kỳ trước, sau đó mới điều chỉnh riêng cho từng giảng viên ở Bước 2 nếu có nhu cầu.
                </p>
              </div>
              <div>
                {hasSemesterDefaultQuota ? (
                  <Badge variant="success" className="font-bold">
                    Đã áp dụng toàn kỳ: {semesterDefaultQuota} nhóm / GV
                  </Badge>
                ) : (
                  <Badge variant="warning" className="font-bold">
                    Chưa thiết lập hạn mức toàn kỳ
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSetBulkQuota} className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="w-full sm:w-64">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hạn mức chung toàn bộ GV (số nhóm / kỳ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={bulkQuotaInput}
                    onChange={(e) => setBulkQuotaInput(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-bold text-indigo-900 bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingBulkQuota}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2"
                >
                  {savingBulkQuota
                    ? 'Đang áp dụng...'
                    : `Áp dụng đồng loạt (${workload.length} Giảng viên)`}
                </Button>
              </form>
              {!hasSemesterDefaultQuota && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <b>Lưu ý:</b> Bạn cần bấm <b>"Áp dụng đồng loạt"</b> ở Bước 1 để chốt hạn mức chung cho toàn bộ giảng viên trong học kỳ trước khi chỉnh riêng cho từng giảng viên ở bảng dưới.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BƯỚC 2: Danh sách Giảng viên & Chỉnh hạn mức riêng cho từng GV nếu có nhu cầu */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                    hasSemesterDefaultQuota ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    Bước 2
                  </span>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Điều chỉnh hạn mức riêng cho từng Giảng viên (nếu có nhu cầu)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {hasSemesterDefaultQuota
                    ? `Hạn mức chuẩn toàn kỳ đang là ${semesterDefaultQuota} nhóm/GV. Bạn có thể bấm "Chỉnh hạn mức riêng" ở từng giảng viên nếu muốn tăng/giảm cá biệt.`
                    : 'Vui lòng hoàn tất Bước 1 (Áp dụng hạn mức chung cho toàn bộ GV trong kỳ) để mở khóa chỉnh riêng từng giảng viên.'}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Giảng viên</th>
                      <th className="p-3">Học vị / Mã GV</th>
                      <th className="p-3">Số nhóm HD / Đề tài</th>
                      <th className="p-3">Hạn mức (Max)</th>
                      <th className="p-3">Số nhóm PB</th>
                      <th className="p-3">Hội đồng</th>
                      <th className="p-3">Tình trạng</th>
                      <th className="p-3 text-right">Thao tác (Bước 2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workload.map((lec) => {
                      const isCustom = hasSemesterDefaultQuota && lec.maxGroups !== semesterDefaultQuota;
                      return (
                        <tr key={lec.id} className={isCustom ? 'bg-purple-50/40' : ''}>
                          <td className="p-3 font-semibold text-slate-900">
                            {lec.fullName}
                            <div className="text-[11px] text-slate-400 font-normal">{lec.email}</div>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-700">{lec.title}</span>
                            <div className="text-[10px] text-slate-400">{lec.lecturerCode}</div>
                          </td>
                          <td className="p-3 font-bold text-indigo-600 text-sm">
                            {lec.currentGroups ?? lec.guidedGroupsCount ?? 0}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{lec.maxGroups}</span>
                              {hasSemesterDefaultQuota && (
                                isCustom ? (
                                  <Badge variant="purple" size="sm">Chỉnh riêng</Badge>
                                ) : (
                                  <span className="text-[10px] text-slate-400">(Theo kỳ)</span>
                                )
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600">{lec.reviewedGroupsCount ?? 0}</td>
                          <td className="p-3 text-slate-600">{lec.committeesCount ?? 0}</td>
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
                              disabled={!hasSemesterDefaultQuota}
                              title={
                                hasSemesterDefaultQuota
                                  ? 'Điều chỉnh hạn mức riêng cho giảng viên này'
                                  : 'Cần thiết lập hạn mức chung cho toàn bộ GV ở Bước 1 trước'
                              }
                              onClick={() => {
                                setSelectedLecturer(lec);
                                setNewQuota(lec.maxGroups);
                                setShowQuotaModal(true);
                              }}
                            >
                              {hasSemesterDefaultQuota ? 'Chỉnh hạn mức riêng' : 'Khóa (Chờ Bước 1)'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
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
              <table className="w-full min-w-[700px] text-left text-xs">
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
                  <table className="w-full min-w-[700px] text-left text-xs">
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
                  Điểm tổng kết = Trung bình cộng các điểm đánh giá (GVHD, GVPB, Hội đồng) + Thưởng NCKH (tối đa 2.0đ). Cảnh báo kịp thời khi điểm thành phần chưa đầy đủ.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm nhóm, đề tài, tên GVHD, SV..."
                    value={scoreSearch}
                    onChange={(e) => {
                      setScoreSearch(e.target.value);
                      fetchSemesterScores(scoreIncompleteOnly, e.target.value, scoreGvhdFilter);
                    }}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                {/* Filter by GVHD */}
                <select
                  value={scoreGvhdFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScoreGvhdFilter(val);
                    fetchSemesterScores(scoreIncompleteOnly, scoreSearch, val);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                >
                  <option value="">Tất cả Giảng viên hướng dẫn (GVHD)</option>
                  {lecturers.map((lec: any) => {
                    const lecUserId = lec.user?.id || lec.userId || lec.id;
                    const lecName = lec.user?.fullName || lec.fullName;
                    const lecTitle = lec.title || lec.lecturerProfile?.title;
                    return (
                      <option key={lecUserId} value={lecUserId}>
                        {lecTitle ? `${lecTitle}. ` : ''}{lecName}
                      </option>
                    );
                  })}
                </select>

                {/* Filter Incomplete Only */}
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scoreIncompleteOnly}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setScoreIncompleteOnly(checked);
                      fetchSemesterScores(checked, scoreSearch, scoreGvhdFilter);
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
                  onClick={() => fetchSemesterScores(scoreIncompleteOnly, scoreSearch, scoreGvhdFilter)}
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
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-3">Nhóm / Đề tài</th>
                      <th className="p-3 text-center">Điểm GVHD</th>
                      <th className="p-3 text-center">Điểm GVPB</th>
                      <th className="p-3 text-center">Điểm Hội đồng</th>
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
                       const groupMidterm = item.midtermStatus || item.group?.midtermStatus || 'PENDING';
                       const isGroupMidtermPassed = groupMidterm === 'CONTINUE' || groupMidterm === 'CHO_LAM_TIEP';

                       return (
                         <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                           {/* Nhóm / Đề tài */}
                           <td className="p-3 min-w-[220px]">
                             <div className="flex items-center gap-1.5 flex-wrap">
                               <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                                 {item.code}
                               </span>
                               <Badge
                                 size="sm"
                                 variant={
                                   isGroupMidtermPassed
                                     ? 'success'
                                     : groupMidterm === 'STOPPED' || groupMidterm === 'DUNG_DE_TAI'
                                     ? 'danger'
                                     : 'warning'
                                 }
                               >
                                 {isGroupMidtermPassed
                                   ? 'Qua GK'
                                   : groupMidterm === 'STOPPED' || groupMidterm === 'DUNG_DE_TAI'
                                   ? 'Đã dừng GK'
                                   : 'Chờ xác nhận GK'}
                               </Badge>
                             </div>
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
                           <td className="p-3 text-center min-w-[140px]">
                             {!isGroupMidtermPassed ? (
                               <Badge
                                 variant={groupMidterm === 'STOPPED' || groupMidterm === 'DUNG_DE_TAI' ? 'danger' : 'warning'}
                                 size="sm"
                               >
                                 {groupMidterm === 'STOPPED' || groupMidterm === 'DUNG_DE_TAI'
                                   ? 'Đã dừng GK'
                                   : 'Chờ qua GK'}
                               </Badge>
                             ) : item.scores?.gvhd !== null && item.scores?.gvhd !== undefined ? (
                               <div className="space-y-1">
                                 {students.length > 0 && students.some((st: any) => st.gvhd !== null && st.gvhd !== undefined) ? (
                                   <div className="space-y-0.5 text-[11px] text-left bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
                                     {students.map((st: any, sIdx: number) => (
                                       <div key={st.studentId || sIdx} className="flex items-center justify-between gap-2">
                                         <span className="text-slate-600 truncate max-w-[90px]" title={st.fullName}>
                                           {st.fullName || `SV${sIdx + 1}`}:
                                         </span>
                                         <b className="text-slate-900">{st.gvhd ?? item.scores.gvhd}</b>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <span className="text-sm font-bold text-slate-900">{item.scores.gvhd} / 10</span>
                                 )}
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
                          <td className="p-3 text-center min-w-[140px]">
                            {item.reviewer ? (
                              item.scores?.gvpb !== null && item.scores?.gvpb !== undefined ? (
                                <div className="space-y-1">
                                  {students.length > 0 && students.some((st: any) => st.gvpb !== null && st.gvpb !== undefined) ? (
                                    <div className="space-y-0.5 text-[11px] text-left bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
                                      {students.map((st: any, sIdx: number) => (
                                        <div key={st.studentId || sIdx} className="flex items-center justify-between gap-2">
                                          <span className="text-slate-600 truncate max-w-[90px]" title={st.fullName}>
                                            {st.fullName || `SV${sIdx + 1}`}:
                                          </span>
                                          <b className="text-slate-900">{st.gvpb ?? item.scores.gvpb}</b>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-sm font-bold text-slate-900">{item.scores.gvpb} / 10</span>
                                  )}
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
                              <div className="space-y-1">
                                {students.length > 0 && students.some((st: any) => st.council !== null && st.council !== undefined) ? (
                                  <div className="space-y-0.5 text-[11px] text-left bg-slate-50 px-2 py-1 rounded border border-slate-200/70">
                                    {students.map((st: any, sIdx: number) => (
                                      <div key={st.studentId || sIdx} className="flex items-center justify-between gap-2">
                                        <span className="text-slate-600 truncate max-w-[90px]" title={st.fullName}>
                                          {st.fullName || `SV${sIdx + 1}`}:
                                        </span>
                                        <b className="text-slate-900">{st.council ?? item.scores.council}</b>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm font-bold text-slate-900">{item.scores.council} / 10</span>
                                )}
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
                          <td className="p-3 text-center min-w-[150px]">
                            {item.finalScore !== null && item.finalScore !== undefined ? (
                              <div className="space-y-1">
                                {students.length > 0 && students.some((st: any) => st.finalScore !== null && st.finalScore !== undefined) ? (
                                  <div className="space-y-1 text-[11px] text-left bg-indigo-50/60 px-2 py-1.5 rounded-lg border border-indigo-200/70">
                                    {students.map((st: any, sIdx: number) => (
                                      <div key={st.studentId || sIdx} className="flex items-center justify-between gap-2">
                                        <span className="text-slate-700 font-medium truncate max-w-[90px]" title={st.fullName}>
                                          {st.fullName || `SV${sIdx + 1}`}:
                                        </span>
                                        <span className="font-extrabold text-indigo-900">
                                          {st.finalScore ?? item.finalScore}đ
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-base font-extrabold text-indigo-900">
                                    {item.finalScore} / 10
                                  </div>
                                )}
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
                               {isGroupMidtermPassed && (
                                 <>
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
                                     onClick={() => handleDirectUnlockGroup(item.id)}
                                     title="Mở khóa chỉnh sửa điểm cho nhóm này"
                                     className="text-amber-700 border-amber-300 hover:bg-amber-50 px-2 font-medium"
                                   >
                                     <Unlock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                                     Mở khóa
                                   </Button>
                                 </>
                               )}
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-amber-600" />
                Quản lý & Mở khóa Chỉnh sửa Điểm KLTN ({scoreRequests.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem xét đề xuất mở khóa của giảng viên hoặc chủ động mở khóa điểm trực tiếp cho nhóm
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-200"
                onClick={() => handleDirectUnlockGroup()}
              >
                <Unlock className="w-4 h-4" />
                <span>+ Trực tiếp mở khóa điểm</span>
              </Button>
            </div>
          </CardHeader>

          {/* Status Filter Tabs */}
          <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center gap-2 border-b border-slate-100 overflow-x-auto bg-slate-50/50">
            <button
              onClick={() => setUnlockFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                unlockFilterStatus === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả ({scoreRequests.length})
            </button>
            <button
              onClick={() => setUnlockFilterStatus('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                unlockFilterStatus === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Chờ duyệt</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                unlockFilterStatus === 'PENDING' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {scoreRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            </button>
            <button
              onClick={() => setUnlockFilterStatus('APPROVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                unlockFilterStatus === 'APPROVED'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Đã phê duyệt / Đang mở</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                unlockFilterStatus === 'APPROVED' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {scoreRequests.filter((r) => r.status === 'APPROVED').length}
              </span>
            </button>
            <button
              onClick={() => setUnlockFilterStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                unlockFilterStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Đã từ chối</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                unlockFilterStatus === 'REJECTED' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {scoreRequests.filter((r) => r.status === 'REJECTED').length}
              </span>
            </button>
          </div>

          <CardContent className="pt-4">
            <div className="divide-y divide-slate-100">
              {scoreRequests
                .filter((req) => {
                  if (unlockFilterStatus === 'ALL') return true;
                  return req.status === unlockFilterStatus;
                })
                .map((req) => {
                  const isExpired = req.expiresAt ? new Date(req.expiresAt) < new Date() : false;
                  return (
                    <div key={req.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              req.status === 'APPROVED'
                                ? isExpired
                                  ? 'warning'
                                  : 'success'
                                : req.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {req.status === 'APPROVED' && isExpired ? 'ĐÃ HẾT HẠN MỞ' : req.status}
                          </Badge>
                          <span className="text-xs font-semibold text-slate-700">
                            Giảng viên: <strong>{req.requester?.fullName || 'Chưa cập nhật'}</strong>
                          </span>
                        </div>
                        <div className="text-xs text-slate-800">
                          Nhóm: <b className="text-indigo-900 font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded text-[11px]">{req.group?.code || req.group?.name}</b>
                          {req.group?.topic?.title && (
                            <span className="text-slate-600 block text-xs mt-1 font-medium">
                              Đề tài: {req.group.topic.title}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                          <b>Lý do giải trình:</b> {req.reason}
                        </p>
                        {req.expiresAt && (
                          <div className={`text-xs p-2 rounded border mt-1.5 font-medium flex items-center gap-1.5 ${
                            isExpired
                              ? 'text-amber-800 bg-amber-50 border-amber-200'
                              : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {isExpired ? 'Đã hết hạn lúc: ' : 'Thời hạn cho phép sửa: '}
                              <strong>{new Date(req.expiresAt).toLocaleString('vi-VN')}</strong>
                            </span>
                          </div>
                        )}
                        {req.rejectReason && (
                          <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-100 mt-1.5 font-medium">
                            <b>Lý do từ chối:</b> {req.rejectReason}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 md:self-center">
                        {req.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                              onClick={() => handleReviewScoreRequest(req.id, true)}
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Duyệt mở khóa</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="flex items-center gap-1"
                              onClick={() => handleReviewScoreRequest(req.id, false)}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </Button>
                          </>
                        )}

                        {req.status === 'APPROVED' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold flex items-center gap-1"
                              onClick={() => handleExtendScoreUnlock(req)}
                              title="Gia hạn thời gian hoặc mở khóa lại cho nhóm này"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Gia hạn / Mở khóa lại</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold flex items-center gap-1"
                              onClick={() => handleRelockGroup(req.groupId || req.group?.id, req.group?.code)}
                              title="Khóa lại điểm ngay lập tức cho nhóm này"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Khóa lại ngay</span>
                            </Button>
                          </>
                        )}

                        {req.status === 'REJECTED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-semibold flex items-center gap-1"
                            onClick={() => handleDirectUnlockGroup(req.groupId || req.group?.id)}
                            title="Xem xét lại và mở khóa điểm cho nhóm này"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Mở khóa cho nhóm</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {scoreRequests.filter((req) => {
                if (unlockFilterStatus === 'ALL') return true;
                return req.status === unlockFilterStatus;
              }).length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  {unlockFilterStatus === 'PENDING'
                    ? 'Không có yêu cầu mở khóa điểm nào đang chờ duyệt.'
                    : unlockFilterStatus === 'APPROVED'
                    ? 'Không có yêu cầu mở khóa nào đã phê duyệt.'
                    : unlockFilterStatus === 'REJECTED'
                    ? 'Không có yêu cầu mở khóa nào bị từ chối.'
                    : 'Không có yêu cầu sửa điểm nào.'}
                </div>
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
                      Bảng điểm tổng hợp 10 tiêu chí (Trung bình cộng GVHD, GVPB, Hội đồng, thưởng NCKH) và phiếu điểm chính thức chuẩn mẫu.
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
      <Modal isOpen={showReviewTopicModal} onClose={() => setShowReviewTopicModal(false)} title="Trưởng Bộ Môn Xét Duyệt Đề Tài KLTN">
        <div className="space-y-4 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {isStudentTopic(selectedTopic) ? (
                <Badge variant="success" className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                  Đề tài do Sinh viên đề xuất
                </Badge>
              ) : (
                <Badge variant="purple" className="bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold">
                  Đề tài do Giảng viên đề xuất
                </Badge>
              )}
              {isStudentTopic(selectedTopic) && (
                <Badge
                  size="sm"
                  variant={selectedTopic?.studentProposer?.gvConfirmed ? 'success' : 'warning'}
                >
                  {selectedTopic?.studentProposer?.gvConfirmed
                    ? 'GVHD đã đồng ý hướng dẫn'
                    : 'Đang chờ GVHD xác nhận'}
                </Badge>
              )}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base">{selectedTopic?.title}</div>
              {selectedTopic?.titleEn && (
                <div className="text-xs text-slate-500 italic mt-0.5">{selectedTopic.titleEn}</div>
              )}
            </div>
            {isStudentTopic(selectedTopic) && selectedTopic?.studentProposer && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-slate-700 space-y-1">
                <div className="font-bold text-emerald-900">Thông tin Sinh viên đề xuất:</div>
                <div>
                  Họ tên: <strong>{selectedTopic.studentProposer.fullName}</strong> • MSSV: <strong>{selectedTopic.studentProposer.studentCode}</strong>
                  {selectedTopic.studentProposer.className ? ` • Lớp: ${selectedTopic.studentProposer.className}` : ''}
                </div>
                {selectedTopic.studentProposer.email && (
                  <div className="text-slate-500">Email: {selectedTopic.studentProposer.email}</div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
              <div>
                <span className="font-semibold text-slate-700">
                  {isStudentTopic(selectedTopic) ? 'GVHD hướng dẫn:' : 'GV đề xuất:'}
                </span>{' '}
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
            min={0}
            max={50}
            label="Số nhóm hướng dẫn tối đa riêng cho giảng viên này (0 - 50)"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-purple-50/60 rounded-lg border border-purple-100 text-xs">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200">
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
                Công thức tính điểm tổng kết từng Sinh viên
              </div>
              <p className="text-xs text-purple-950 font-mono">
                {selectedScoreDetails.congThucTinh || 'Chưa có công thức'}
              </p>
            </div>

            {/* Per-student score breakdown table */}
            {Array.isArray(selectedScoreDetails.students) && selectedScoreDetails.students.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Bảng điểm chi tiết từng Sinh viên trong nhóm
                </div>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Sinh viên</th>
                        <th className="p-2 text-center">MSSV</th>
                        <th className="p-2 text-center">GVHD</th>
                        <th className="p-2 text-center">GVPB</th>
                        <th className="p-2 text-center">Hội đồng</th>
                        <th className="p-2 text-center">Tổng kết</th>
                        <th className="p-2 text-center">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedScoreDetails.students.map((st: any, idx: number) => (
                        <tr key={st.studentId || idx}>
                          <td className="p-2 font-semibold text-slate-800">
                            {st.fullName} {st.isLeader && <span className="text-[10px] text-indigo-600">(NT)</span>}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600">{st.studentCode}</td>
                          <td className="p-2 text-center font-bold text-slate-800">{st.gvhd ?? '—'}</td>
                          <td className="p-2 text-center font-bold text-slate-800">{st.gvpb ?? '—'}</td>
                          <td className="p-2 text-center font-bold text-slate-800">{st.council ?? '—'}</td>
                          <td className="p-2 text-center font-extrabold text-indigo-900">{st.finalScore ?? '—'}</td>
                          <td className="p-2 text-center">
                            {st.finalScore !== null && st.finalScore !== undefined ? (
                              <Badge variant={st.ketQua === 'DAT' ? 'success' : 'danger'} size="sm">
                                {st.ketQua === 'DAT' ? 'Đạt' : 'Không đạt'} ({st.xepLoai})
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Council breakdown */}
            {selectedScoreDetails.scoreBreakdown?.council?.evaluations?.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Điểm từng Thành viên Hội đồng bảo vệ
                </div>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-xs">
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
              {(selectedScoreDetails.midtermStatus === 'CONTINUE' ||
                selectedScoreDetails.group?.midtermStatus === 'CONTINUE') && (
                <Button
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 font-semibold flex items-center gap-1.5"
                  onClick={() => {
                    const gId = selectedScoreDetails.id;
                    setSelectedScoreDetails(null);
                    handleDirectUnlockGroup(gId);
                  }}
                >
                  <Unlock className="w-4 h-4 text-amber-600" />
                  <span>Mở khóa điểm cho nhóm</span>
                </Button>
              )}
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

      {/* MODAL: Direct Unlock Score for Group */}
      <Modal
        isOpen={showDirectUnlockModal}
        onClose={() => setShowDirectUnlockModal(false)}
        title="Trực tiếp Mở khóa Điểm KLTN cho Nhóm"
      >
        <form onSubmit={handleConfirmDirectUnlock} className="space-y-4 text-sm">
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 mb-1">
              <Unlock className="w-4 h-4 text-amber-600" />
              <span>Chính sách mở khóa điểm</span>
            </div>
            Sau khi mở khóa, Giảng viên hướng dẫn / phản biện của nhóm có quyền cập nhật và lưu lại điểm đánh giá tiêu chí. Sau khi hết thời hạn, điểm sẽ tự động khóa lại.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn nhóm KLTN cần mở khóa <span className="text-rose-500">*</span>
            </label>
            <select
              value={directUnlockGroupId}
              onChange={(e) => setDirectUnlockGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              required
            >
              <option value="">-- Chọn nhóm KLTN (Đã xác nhận qua giữa kỳ) --</option>
              {allGroups
                .filter((grp: any) => grp.midtermStatus === 'CONTINUE' || grp.midtermStatus === 'CHO_LAM_TIEP')
                .map((grp: any) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.code} - {grp.name || grp.topic?.title || 'Đề tài'} ({grp.topic?.owner?.fullName ? `GVHD: ${grp.topic.owner.fullName}` : ''})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Thời hạn cho phép chỉnh sửa điểm <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '12 giờ', val: 12 },
                { label: '24 giờ (1 ngày)', val: 24 },
                { label: '48 giờ (2 ngày)', val: 48 },
                { label: '72 giờ (3 ngày)', val: 72 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDirectUnlockHours(opt.val)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    directUnlockHours === opt.val
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Hoặc tùy chỉnh (giờ):</span>
              <input
                type="number"
                min="1"
                max="720"
                value={directUnlockHours}
                onChange={(e) => setDirectUnlockHours(Number(e.target.value) || 24)}
                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ghi chú / Lý do mở khóa điểm (Tùy chọn)
            </label>
            <textarea
              rows={3}
              value={directUnlockReason}
              onChange={(e) => setDirectUnlockReason(e.target.value)}
              placeholder="VD: Trưởng bộ môn cho phép bổ sung điểm tiêu chí theo quyết định..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDirectUnlockModal(false)}
              disabled={isUnlocking}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5"
              disabled={isUnlocking}
            >
              <Unlock className="w-4 h-4" />
              <span>{isUnlocking ? 'Đang mở khóa...' : 'Xác nhận mở khóa điểm'}</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

