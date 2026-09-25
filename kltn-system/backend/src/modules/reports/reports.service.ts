import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoresService } from '../scores/scores.service';
import * as fs from 'node:fs';
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function stripVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoresService: ScoresService,
  ) {}

  async resolveSemester(semesterId?: string) {
    if (semesterId) {
      const semester = await this.prisma.semester.findUnique({
        where: { id: semesterId },
        include: { department: true },
      });
      if (!semester) throw new NotFoundException('Không tìm thấy đợt KLTN yêu cầu');
      return semester;
    }

    const activeSemester = await this.prisma.semester.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (activeSemester) return activeSemester;

    const latest = await this.prisma.semester.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    if (!latest) throw new NotFoundException('Chưa có đợt KLTN nào trong hệ thống');
    return latest;
  }

  async dashboard(semesterId?: string) {
    const semester = semesterId ? { semesterId } : {};
    const [students, topics, registrations, groups, submissions, defenses] = await Promise.all([
      this.prisma.studentProfile.count(),
      this.prisma.topic.count({ where: semester }),
      this.prisma.registration.groupBy({ by: ['status'], where: semester, _count: { _all: true } }),
      this.prisma.group.count({ where: semester }),
      this.prisma.submission.count({ where: semesterId ? { group: { semesterId } } : undefined }),
      this.prisma.defenseSchedule.count({ where: semester }),
    ]);
    return {
      semesterId,
      students,
      topics,
      groups,
      submissions,
      defenses,
      registrations: Object.fromEntries(registrations.map((item) => [item.status, item._count._all])),
    };
  }

  async registrationRows(semesterId?: string) {
    return this.prisma.registration.findMany({
      where: semesterId ? { semesterId } : undefined,
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
            department: { select: { name: true } },
          },
        },
        topic: {
          include: {
            owner: { select: { fullName: true, email: true } },
          },
        },
        semester: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async workload(semesterId?: string) {
    const semester = await this.resolveSemester(semesterId);

    const lecturers = await this.prisma.lecturerProfile.findMany({
      where: semester.departmentId ? { departmentId: semester.departmentId } : undefined,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        department: true,
        reviewerAssignments: {
          where: { group: { semesterId: semester.id } },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    const stats = await Promise.all(
      lecturers.map(async (lecturer) => {
        const guidedGroupsCount = await this.prisma.group.count({
          where: {
            topic: { ownerId: lecturer.userId },
            semesterId: semester.id,
            status: { not: 'CANCELLED' },
          },
        });

        const topicsCount = await this.prisma.topic.count({
          where: {
            ownerId: lecturer.userId,
            semesterId: semester.id,
          },
        });

        const committeesCount = await this.prisma.defenseCommitteeMember.count({
          where: {
            userId: lecturer.userId,
            committee: { schedules: { some: { semesterId: semester.id } } },
          },
        });

        const maxGroups = lecturer.maxGroups || 5;

        return {
          id: lecturer.id,
          userId: lecturer.userId,
          fullName: lecturer.user?.fullName || 'Chưa cập nhật',
          email: lecturer.user?.email,
          phone: lecturer.user?.phone,
          lecturerCode: lecturer.lecturerCode,
          title: lecturer.title ?? 'Giảng viên',
          departmentName: lecturer.department?.name,
          specialization: lecturer.specialization,
          maxGroups,
          guidedGroupsCount,
          reviewedGroupsCount: lecturer.reviewerAssignments.length,
          committeesCount,
          topicsCount,
          remainingSlots: Math.max(0, maxGroups - guidedGroupsCount),
          isOverloaded: guidedGroupsCount >= maxGroups,
        };
      }),
    );

    return stats;
  }

  /**
   * GET /reports/export-excel?type=&semesterId=
   * Stream file Excel (.xlsx) chuẩn hóa theo nhiều loại báo cáo
   */
  async exportExcel(type = 'registrations', semesterId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const semester = await this.resolveSemester(semesterId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KLTN Management System';
    workbook.created = new Date();

    const normalizedType = type.toLowerCase().trim();

    if (normalizedType === 'scores' || normalizedType === 'bang-diem') {
      const sheet = workbook.addWorksheet('BangDiemKLTN');
      sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã nhóm', key: 'code', width: 16 },
        { header: 'Tên đề tài KLTN', key: 'title', width: 42 },
        { header: 'Sinh viên thực hiện', key: 'students', width: 32 },
        { header: 'Cán bộ Hướng dẫn', key: 'gvhd', width: 24 },
        { header: 'Điểm GVHD (30%)', key: 'scoreGvhd', width: 18 },
        { header: 'Cán bộ Phản biện', key: 'gvpb', width: 24 },
        { header: 'Điểm GVPB (30%)', key: 'scoreGvpb', width: 18 },
        { header: 'Điểm Hội đồng (40%)', key: 'scoreCouncil', width: 20 },
        { header: 'Thưởng NCKH', key: 'bonus', width: 16 },
        { header: 'Điểm Tổng kết', key: 'finalScore', width: 18 },
        { header: 'Xếp loại', key: 'rating', width: 16 },
        { header: 'Kết quả', key: 'result', width: 14 },
        { header: 'Tình trạng điểm', key: 'completeness', width: 22 },
      ];

      const scoresData = await this.scoresService.findSemesterScores({ semesterId: semester.id });
      scoresData.items.forEach((item: any, idx: number) => {
        const students = item.members || item.students || [];
        const studentStr = students.map((s: any) => `${s.fullName || s.user?.fullName} (${s.studentCode || s.user?.studentCode || ''})`).join(', ');

        sheet.addRow({
          stt: idx + 1,
          code: item.code,
          title: item.topic?.title || item.name,
          students: studentStr,
          gvhd: item.topic?.owner?.fullName || 'Chưa cập nhật',
          scoreGvhd: item.scores?.gvhd !== null && item.scores?.gvhd !== undefined ? item.scores.gvhd : 'Chưa có',
          gvpb: item.reviewer?.fullName || 'Chưa phân công',
          scoreGvpb: item.scores?.gvpb !== null && item.scores?.gvpb !== undefined ? item.scores.gvpb : 'Chưa có',
          scoreCouncil: item.scores?.council !== null && item.scores?.council !== undefined ? item.scores.council : 'Chưa có',
          bonus: item.scores?.bonusPoints > 0 ? `+${item.scores.bonusPoints}đ` : '0đ',
          finalScore: item.finalScore !== null && item.finalScore !== undefined ? item.finalScore : 'Chưa xong',
          rating: item.xepLoai || '—',
          result: item.ketQua || '—',
          completeness: item.scoreCompleteness?.isComplete ? 'Đầy đủ điểm' : `Cảnh báo (${item.scoreCompleteness?.warnings?.length || 0})`,
        });
      });

      this.styleHeaderRow(sheet);
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer: Buffer.from(buffer), filename: `bang-diem-kltn-${semester.code}.xlsx` };
    }

    if (normalizedType === 'workload' || normalizedType === 'tai-giang-vien') {
      const sheet = workbook.addWorksheet('KhoiLuongGiangVien');
      sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã GV', key: 'code', width: 16 },
        { header: 'Họ và tên Giảng viên', key: 'fullName', width: 26 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Số điện thoại', key: 'phone', width: 16 },
        { header: 'Học vị / Chức danh', key: 'title', width: 20 },
        { header: 'Bộ môn', key: 'department', width: 25 },
        { header: 'Định mức tối đa (nhóm)', key: 'max', width: 24 },
        { header: 'Số nhóm hướng dẫn', key: 'guided', width: 20 },
        { header: 'Số nhóm phản biện', key: 'reviewed', width: 20 },
        { header: 'Số HĐ tham gia', key: 'committees', width: 18 },
        { header: 'Số chỗ còn lại', key: 'remaining', width: 18 },
        { header: 'Tình trạng quá tải', key: 'overloaded', width: 20 },
      ];

      const stats = await this.workload(semester.id);
      stats.forEach((item, idx) => {
        sheet.addRow({
          stt: idx + 1,
          code: item.lecturerCode,
          fullName: item.fullName,
          email: item.email,
          phone: item.phone || '—',
          title: item.title,
          department: item.departmentName || 'Bộ môn',
          max: item.maxGroups,
          guided: item.guidedGroupsCount,
          reviewed: item.reviewedGroupsCount,
          committees: item.committeesCount,
          remaining: item.remainingSlots,
          overloaded: item.isOverloaded ? 'QUÁ TẢI' : 'Bình thường',
        });
      });

      this.styleHeaderRow(sheet);
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer: Buffer.from(buffer), filename: `khoi-luong-giang-vien-${semester.code}.xlsx` };
    }

    if (normalizedType === 'topics' || normalizedType === 'de-tai') {
      const sheet = workbook.addWorksheet('DanhSachDeTai');
      sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã đề tài', key: 'code', width: 16 },
        { header: 'Tên đề tài tiếng Việt', key: 'title', width: 45 },
        { header: 'Tên tiếng Anh', key: 'titleEn', width: 40 },
        { header: 'Cán bộ đề xuất (GVHD)', key: 'owner', width: 26 },
        { header: 'Email GV', key: 'email', width: 30 },
        { header: 'Bộ môn', key: 'department', width: 25 },
        { header: 'Số SV tối đa', key: 'capacity', width: 16 },
        { header: 'Học kỳ', key: 'semester', width: 16 },
        { header: 'Trạng thái xét duyệt', key: 'status', width: 22 },
      ];

      const topics = await this.prisma.topic.findMany({
        where: { semesterId: semester.id },
        include: {
          owner: { select: { fullName: true, email: true } },
          department: { select: { name: true } },
          semester: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      topics.forEach((t: any, idx: number) => {
        sheet.addRow({
          stt: idx + 1,
          code: t.code || t.id.slice(0, 8).toUpperCase(),
          title: t.title,
          titleEn: t.titleEn || '—',
          owner: t.owner?.fullName || 'Chưa cập nhật',
          email: t.owner?.email || '—',
          department: t.department?.name || 'Chuyên ngành',
          capacity: t.capacity,
          semester: t.semester?.code || semester.code,
          status: t.status,
        });
      });

      this.styleHeaderRow(sheet);
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer: Buffer.from(buffer), filename: `danh-sach-de-tai-${semester.code}.xlsx` };
    }

    if (normalizedType === 'defense-schedules' || normalizedType === 'lich-bao-ve') {
      const sheet = workbook.addWorksheet('LichBaoVeKLTN');
      sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã nhóm', key: 'code', width: 16 },
        { header: 'Tên đề tài KLTN', key: 'title', width: 42 },
        { header: 'Sinh viên thực hiện', key: 'students', width: 32 },
        { header: 'GV Hướng dẫn', key: 'advisor', width: 24 },
        { header: 'Hội đồng chấm', key: 'committee', width: 28 },
        { header: 'Phòng bảo vệ', key: 'room', width: 18 },
        { header: 'Thời gian bắt đầu', key: 'startsAt', width: 22 },
        { header: 'Thời gian kết thúc', key: 'endsAt', width: 22 },
        { header: 'Trạng thái', key: 'status', width: 16 },
      ];

      const schedules = await this.prisma.defenseSchedule.findMany({
        where: { semesterId: semester.id },
        include: {
          group: {
            include: {
              topic: { include: { owner: true } },
              members: { include: { student: { include: { user: true } } } },
            },
          },
          committee: true,
        },
        orderBy: { startsAt: 'asc' },
      });

      schedules.forEach((sch, idx) => {
        const students = sch.group?.members?.map((m) => m.student.user.fullName).join(', ') || 'Chưa có';
        sheet.addRow({
          stt: idx + 1,
          code: sch.group?.code || '—',
          title: sch.group?.topic?.title || sch.group?.name || '—',
          students,
          advisor: sch.group?.topic?.owner?.fullName || '—',
          committee: sch.committee?.name || 'Chưa xếp HĐ',
          room: sch.room || 'Chưa xếp',
          startsAt: new Date(sch.startsAt).toLocaleString('vi-VN'),
          endsAt: new Date(sch.endsAt).toLocaleString('vi-VN'),
          status: sch.status,
        });
      });

      this.styleHeaderRow(sheet);
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer: Buffer.from(buffer), filename: `lich-bao-ve-kltn-${semester.code}.xlsx` };
    }

    // Default: 'registrations'
    const sheet = workbook.addWorksheet('DanhSachDangKyKLTN');
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Họ và tên sinh viên', key: 'name', width: 28 },
      { header: 'Mã số sinh viên (MSSV)', key: 'code', width: 22 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Số điện thoại', key: 'phone', width: 18 },
      { header: 'Chuyên ngành', key: 'major', width: 24 },
      { header: 'Tên đề tài KLTN', key: 'topic', width: 45 },
      { header: 'Cán bộ Hướng dẫn', key: 'advisor', width: 26 },
      { header: 'Đợt KLTN', key: 'semester', width: 18 },
      { header: 'Trạng thái đơn', key: 'status', width: 18 },
      { header: 'Ngày đăng ký', key: 'createdAt', width: 22 },
    ];

    const rows = await this.registrationRows(semester.id);
    rows.forEach((row, idx) =>
      sheet.addRow({
        stt: idx + 1,
        name: row.student.user.fullName,
        code: row.student.studentCode,
        email: row.student.user.email,
        phone: row.student.user.phone || '—',
        major: row.student.department?.name || 'Công nghệ thông tin',
        topic: row.topic?.title ?? 'Đề xuất riêng',
        advisor: row.topic?.owner?.fullName || 'Chưa phân công',
        semester: row.semester.code,
        status: row.status,
        createdAt: new Date(row.createdAt).toLocaleString('vi-VN'),
      }),
    );

    this.styleHeaderRow(sheet);
    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename: `danh-sach-dang-ky-kltn-${semester.code}.xlsx` };
  }

  private styleHeaderRow(sheet: any) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Navy Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Viền khung
    sheet.eachRow((row: any) => {
      row.eachCell((cell: any) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });
    });
  }

  /**
   * GET /reports/score-sheet-pdf?groupIds=&semesterId=
   * Stream PDF phiếu điểm tổng hợp chính thức cho một hoặc nhiều nhóm (hỗ trợ in hàng loạt)
   */
  async exportScoreSheetPdf(groupIds?: string, semesterId?: string): Promise<Buffer> {
    const semester = await this.resolveSemester(semesterId);

    let targetGroupIds: string[] = [];
    if (groupIds && groupIds.trim()) {
      targetGroupIds = groupIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    } else {
      // Lấy các nhóm trong học kỳ đủ điều kiện bảo vệ
      const groups = await this.prisma.group.findMany({
        where: {
          semesterId: semester.id,
          status: { not: 'CANCELLED' },
        },
        select: { id: true },
      });
      targetGroupIds = groups.map((g) => g.id);
    }

    if (targetGroupIds.length === 0) {
      throw new NotFoundException('Không tìm thấy nhóm KLTN nào để kết xuất phiếu điểm PDF');
    }

    // Lấy dữ liệu điểm của tất cả các nhóm cần xuất
    const allSemesterScores = await this.scoresService.findSemesterScores({ semesterId: semester.id });
    const scoreMap = new Map<string, any>();
    allSemesterScores.items.forEach((s: any) => scoreMap.set(s.id, s));

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: any) => reject(err));

        // Kiểm tra font Times New Roman trên Windows
        const timesRegular = 'C:/Windows/Fonts/times.ttf';
        const timesBold = 'C:/Windows/Fonts/timesbd.ttf';
        const timesItalic = 'C:/Windows/Fonts/timesi.ttf';
        const hasTimes = fs.existsSync(timesRegular);

        let fontRegular = 'Helvetica';
        let fontBold = 'Helvetica-Bold';
        let fontItalic = 'Helvetica-Oblique';

        if (hasTimes) {
          doc.registerFont('Times-Roman', timesRegular);
          if (fs.existsSync(timesBold)) doc.registerFont('Times-Bold', timesBold);
          if (fs.existsSync(timesItalic)) doc.registerFont('Times-Italic', timesItalic);
          fontRegular = 'Times-Roman';
          fontBold = fs.existsSync(timesBold) ? 'Times-Bold' : 'Times-Roman';
          fontItalic = fs.existsSync(timesItalic) ? 'Times-Italic' : 'Times-Roman';
        }

        const safeText = (txt: string) => {
          if (!hasTimes) return stripVietnameseDiacritics(txt);
          return txt;
        };

        targetGroupIds.forEach((groupId, pageIdx) => {
          if (pageIdx > 0) {
            doc.addPage();
          }

          const scoreItem = scoreMap.get(groupId);
          const groupName = scoreItem?.name || scoreItem?.code || `Nhóm ${groupId.slice(0, 8)}`;
          const topicTitle = scoreItem?.topic?.title || 'Chưa cập nhật tên đề tài';
          const advisorName = scoreItem?.topic?.owner?.fullName || 'Chưa cập nhật';
          const reviewerName = scoreItem?.reviewer?.fullName || 'Chưa phân công';
          const students = scoreItem?.members || scoreItem?.students || [];

          // 1. Header Quốc gia & Cơ quan
          doc.font(fontRegular).fontSize(9).text(safeText('BỘ GIÁO DỤC VÀ ĐÀO TẠO'), 40, 40, { align: 'left' });
          doc.font(fontBold).fontSize(9).text(safeText('TRƯỜNG ĐẠI HỌC KHOA HỌC TỰ NHIÊN'), 40, 52, { align: 'left' });
          doc.font(fontRegular).fontSize(9).text(safeText('KHOA CÔNG NGHỆ THÔNG TIN'), 40, 64, { align: 'left' });

          doc.font(fontBold).fontSize(9).text(safeText('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'), 300, 40, { align: 'center' });
          doc.font(fontRegular).fontSize(9).text(safeText('Độc lập - Tự do - Hạnh phúc'), 300, 52, { align: 'center' });
          doc.moveTo(370, 65).lineTo(470, 65).stroke('#333333');

          // 2. Tiêu đề
          doc.font(fontBold).fontSize(14).text(safeText('PHIẾU ĐIỂM TỔNG HỢP KHÓA LUẬN TỐT NGHIỆP'), 40, 95, { align: 'center' });
          doc.font(fontItalic).fontSize(10).text(safeText(`Đợt KLTN: ${semester.name} (${semester.code})`), 40, 115, { align: 'center' });

          // 3. Thông tin đề tài & nhóm
          doc.rect(40, 135, 515, 80).fillAndStroke('#F8FAFC', '#E2E8F0');
          doc.fillColor('#000000');

          doc.font(fontBold).fontSize(9.5).text(safeText('Mã nhóm:'), 50, 145);
          doc.font(fontRegular).fontSize(9.5).text(safeText(scoreItem?.code || '—'), 110, 145);

          doc.font(fontBold).fontSize(9.5).text(safeText('Tên đề tài:'), 50, 160);
          doc.font(fontRegular).fontSize(9.5).text(safeText(topicTitle), 110, 160, { width: 435, height: 28 });

          doc.font(fontBold).fontSize(9.5).text(safeText('GV Hướng dẫn:'), 50, 192);
          doc.font(fontRegular).fontSize(9.5).text(safeText(advisorName), 130, 192);

          doc.font(fontBold).fontSize(9.5).text(safeText('GV Phản biện:'), 320, 192);
          doc.font(fontRegular).fontSize(9.5).text(safeText(reviewerName), 395, 192);

          // 4. Danh sách sinh viên thực hiện
          let currentY = 225;
          doc.font(fontBold).fontSize(10).text(safeText('Sinh viên thực hiện:'), 40, currentY);
          currentY += 15;

          students.forEach((st: any, sIdx: number) => {
            const stName = st.fullName || st.user?.fullName || 'Sinh viên';
            const stCode = st.studentCode || st.user?.studentCode || '—';
            doc.font(fontRegular).fontSize(9.5).text(safeText(`${sIdx + 1}. ${stName} - MSSV: ${stCode}`), 55, currentY);
            currentY += 14;
          });

          // 5. Bảng điểm thành phần
          currentY += 10;
          doc.font(fontBold).fontSize(10.5).text(safeText('BẢNG ĐIỂM THÀNH PHẦN & TỔNG KẾT:'), 40, currentY);
          currentY += 18;

          // Header bảng điểm
          doc.rect(40, currentY, 515, 20).fillAndStroke('#1E3A8A', '#1E3A8A');
          doc.fillColor('#FFFFFF');
          doc.font(fontBold).fontSize(9);
          doc.text(safeText('STT'), 45, currentY + 5);
          doc.text(safeText('Thành phần chấm điểm'), 75, currentY + 5);
          doc.text(safeText('Trọng số'), 300, currentY + 5, { align: 'center', width: 60 });
          doc.text(safeText('Người chấm / Hội đồng'), 370, currentY + 5);
          doc.text(safeText('Điểm số (thang 10)'), 475, currentY + 5, { align: 'right', width: 70 });
          doc.fillColor('#000000');
          currentY += 20;

          const gvhdScore = scoreItem?.scores?.gvhd !== null && scoreItem?.scores?.gvhd !== undefined ? `${scoreItem.scores.gvhd}` : 'Chưa có';
          const gvpbScore = scoreItem?.scores?.gvpb !== null && scoreItem?.scores?.gvpb !== undefined ? `${scoreItem.scores.gvpb}` : 'Chưa có';
          const councilScore = scoreItem?.scores?.council !== null && scoreItem?.scores?.council !== undefined ? `${scoreItem.scores.council}` : 'Chưa có';
          const bonusScore = scoreItem?.scores?.bonusPoints > 0 ? `+${scoreItem.scores.bonusPoints}đ` : '0.0';

          const rows = [
            { stt: '1', name: 'Điểm Cán bộ Hướng dẫn (GVHD)', weight: '30%', scorer: advisorName, score: gvhdScore },
            { stt: '2', name: 'Điểm Cán bộ Phản biện (GVPB)', weight: '30%', scorer: reviewerName, score: gvpbScore },
            {
              stt: '3',
              name: 'Điểm Hội đồng Bảo vệ KLTN',
              weight: '40%',
              scorer: scoreItem?.defenseSchedule?.committee?.name || 'Hội đồng chấm',
              score: councilScore,
            },
            { stt: '4', name: 'Điểm thưởng NCKH (bài báo, giải thưởng)', weight: 'Cộng thêm', scorer: 'Bộ môn phê duyệt', score: bonusScore },
          ];

          rows.forEach((r, rIdx) => {
            const bg = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            doc.rect(40, currentY, 515, 20).fillAndStroke(bg, '#E2E8F0');
            doc.font(fontRegular).fontSize(9);
            doc.text(r.stt, 45, currentY + 5);
            doc.text(safeText(r.name), 75, currentY + 5);
            doc.text(safeText(r.weight), 300, currentY + 5, { align: 'center', width: 60 });
            doc.text(safeText(r.scorer), 370, currentY + 5, { width: 100, height: 15 });
            doc.font(fontBold).text(r.score, 475, currentY + 5, { align: 'right', width: 70 });
            currentY += 20;
          });

          // 6. Điểm tổng kết & Xếp loại
          currentY += 12;
          doc.rect(40, currentY, 515, 48).fillAndStroke('#EFF6FF', '#BFDBFE');
          doc.font(fontBold).fontSize(11).text(safeText('KẾT QUẢ TỔNG KẾT:'), 50, currentY + 8);

          const finalScoreStr = scoreItem?.finalScore !== null && scoreItem?.finalScore !== undefined ? `${scoreItem.finalScore} / 10` : 'Chưa hoàn tất';
          const xepLoaiStr = scoreItem?.xepLoai || '—';
          const ketQuaStr = scoreItem?.ketQua === 'DAT' ? 'ĐẠT YÊU CẦU' : scoreItem?.ketQua === 'KHÔNG ĐẠT' ? 'KHÔNG ĐẠT' : '—';

          doc.font(fontRegular).fontSize(9.5).text(
            safeText(`Điểm tổng kết: `),
            50,
            currentY + 28,
            { continued: true },
          );
          doc.font(fontBold).text(`${finalScoreStr}     `);
          doc.font(fontRegular).text(safeText(`Xếp loại: `), { continued: true });
          doc.font(fontBold).text(`${safeText(xepLoaiStr)}     `);
          doc.font(fontRegular).text(safeText(`Kết quả: `), { continued: true });
          doc.font(fontBold).text(`${safeText(ketQuaStr)}`);

          // 7. Chữ ký xác nhận
          currentY += 65;
          doc.font(fontItalic).fontSize(9).text(safeText(`TP. Hồ Chí Minh, ngày ...... tháng ...... năm 20......`), 40, currentY, { align: 'right' });
          currentY += 15;

          const colW = 125;
          doc.font(fontBold).fontSize(9.5);
          doc.text(safeText('CB HƯỚNG DẪN'), 40, currentY, { width: colW, align: 'center' });
          doc.text(safeText('CB PHẢN BIỆN'), 40 + colW, currentY, { width: colW, align: 'center' });
          doc.text(safeText('THƯ KÝ HỘI ĐỒNG'), 40 + colW * 2, currentY, { width: colW, align: 'center' });
          doc.text(safeText('CHỦ TỊCH HỘI ĐỒNG'), 40 + colW * 3, currentY, { width: colW, align: 'center' });

          currentY += 12;
          doc.font(fontItalic).fontSize(8);
          doc.text(safeText('(Ký và ghi rõ họ tên)'), 40, currentY, { width: colW, align: 'center' });
          doc.text(safeText('(Ký và ghi rõ họ tên)'), 40 + colW, currentY, { width: colW, align: 'center' });
          doc.text(safeText('(Ký và ghi rõ họ tên)'), 40 + colW * 2, currentY, { width: colW, align: 'center' });
          doc.text(safeText('(Ký và ghi rõ họ tên)'), 40 + colW * 3, currentY, { width: colW, align: 'center' });
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
