import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';
import ExcelJS = require('exceljs');

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @ApiOperation({ summary: 'Xem dashboard tổng quan thống kê đợt KLTN' })
  @Get('dashboard')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  dashboard(@Query('semesterId') semesterId?: string) {
    return this.service.dashboard(semesterId);
  }

  @ApiOperation({ summary: 'Xem thống kê khối lượng công việc của giảng viên' })
  @Get('workload')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  workload(@Query('semesterId') semesterId?: string) {
    return this.service.workload(semesterId);
  }

  @ApiOperation({ summary: 'Xuất danh sách đăng ký dạng CSV (UTF-8 BOM)' })
  @Get('registrations.csv')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  async registrationsCsv(@Query('semesterId') semesterId: string | undefined, @Res() response: Response) {
    const rows = await this.service.registrationRows(semesterId);
    const csv = [
      'Họ tên,Email,MSSV,Đề tài,Học kỳ,Trạng thái',
      ...rows.map((row) =>
        [row.student.user.fullName, row.student.user.email, row.student.studentCode, row.topic?.title ?? 'Đề xuất riêng', row.semester.code, row.status]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      ),
    ].join('\n');
    response
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="registrations.csv"')
      .send(`\ufeff${csv}`);
  }

  @ApiOperation({ summary: 'Xuất danh sách đăng ký dạng Excel (.xlsx)' })
  @Get('registrations.xlsx')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  async registrationsExcel(@Query('semesterId') semesterId: string | undefined, @Res() response: Response) {
    try {
      const rows = await this.service.registrationRows(semesterId);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh sách đăng ký KLTN');
      sheet.columns = [
        { header: 'Họ tên', key: 'name', width: 28 },
        { header: 'Email', key: 'email', width: 32 },
        { header: 'MSSV', key: 'code', width: 18 },
        { header: 'Đề tài', key: 'topic', width: 45 },
        { header: 'Học kỳ', key: 'semester', width: 18 },
        { header: 'Trạng thái', key: 'status', width: 18 },
      ];
      rows.forEach((row) =>
        sheet.addRow({
          name: row.student.user.fullName,
          email: row.student.user.email,
          code: row.student.studentCode,
          topic: row.topic?.title ?? 'Đề xuất riêng',
          semester: row.semester.code,
          status: row.status,
        }),
      );
      sheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      response.header('Content-Disposition', 'attachment; filename="registrations.xlsx"');
      response.send(Buffer.from(buffer));
    } catch (err) {
      console.error('EXCEL EXPORT CAUGHT ERROR:', err);
      throw err;
    }
  }

  @ApiOperation({ summary: 'Xuất báo cáo Excel theo phân loại (scores, workload, registrations, topics, defense-schedules)' })
  @Get('export-excel')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN)
  async exportExcel(
    @Query('type') type: string | undefined,
    @Query('semesterId') semesterId: string | undefined,
    @Res() response: Response,
  ) {
    const { buffer, filename } = await this.service.exportExcel(type || 'registrations', semesterId);
    response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    response.send(buffer);
  }

  @ApiOperation({ summary: 'Xuất phiếu điểm KLTN chính thức định dạng PDF' })
  @Get('score-sheet-pdf')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN, RoleCode.SINH_VIEN)
  async exportScoreSheetPdf(
    @Query('groupIds') groupIds: string | undefined,
    @Query('semesterId') semesterId: string | undefined,
    @Res() response: Response,
  ) {
    const pdfBuffer = await this.service.exportScoreSheetPdf(groupIds, semesterId);
    response.header('Content-Type', 'application/pdf');
    response.header('Content-Disposition', 'attachment; filename="phieu-diem-kltn.pdf"');
    response.send(pdfBuffer);
  }
}
