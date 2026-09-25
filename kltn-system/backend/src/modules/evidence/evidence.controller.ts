import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ReviewEvidenceDto } from './dto/review-evidence.dto';
import { ApproveEvidenceDto } from './dto/approve-evidence.dto';
import { RejectEvidenceDto } from './dto/reject-evidence.dto';
import { RequestMoreInfoEvidenceDto } from './dto/request-more-info-evidence.dto';
import { EvidenceService } from './evidence.service';

@ApiTags('evidence')
@ApiBearerAuth()
@Controller(['evidences', 'evidence'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách minh chứng NCKH (hỗ trợ lọc status=PENDING)' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (PENDING, APPROVED, REJECTED, REQUEST_MORE_INFO)' })
  list(
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('status') status?: string,
  ) {
    return this.service.list(user, status);
  }

  @Get('pending')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Lấy danh sách minh chứng NCKH đang chờ duyệt' })
  pending(@CurrentUser() user: { id: string; roles?: string[] }) {
    return this.service.list(user, 'PENDING', true);
  }

  @Post()
  @Roles(RoleCode.SINH_VIEN)
  @ApiOperation({ summary: 'Sinh viên nộp hồ sơ minh chứng NCKH' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, callback) =>
          callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEvidenceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.create(user.id, dto, file);
  }

  @Post(':id/approve')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Phê duyệt minh chứng NCKH và tự động cộng điểm theo quy định cấu hình' })
  approve(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ApproveEvidenceDto,
    @Req() req: Request,
  ) {
    return this.service.approve(id, user.id, dto, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Post(':id/reject')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Từ chối minh chứng NCKH kèm lý do' })
  reject(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RejectEvidenceDto,
    @Req() req: Request,
  ) {
    return this.service.reject(id, user.id, dto, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Post(':id/request-more-info')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Yêu cầu sinh viên bổ sung thêm thông tin/minh chứng' })
  requestMoreInfo(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: RequestMoreInfoEvidenceDto,
    @Req() req: Request,
  ) {
    return this.service.requestMoreInfo(id, user.id, dto, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Post(':id/review')
  @Roles(RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  @ApiOperation({ summary: 'Xét duyệt minh chứng NCKH (endpoint tương thích ngược)' })
  review(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReviewEvidenceDto,
    @Req() req: Request,
  ) {
    if (dto.approved) {
      return this.service.approve(id, user.id, { points: dto.points, note: dto.note }, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } else {
      return this.service.reject(id, user.id, { lyDo: dto.note || 'Minh chứng NCKH chưa đạt yêu cầu' }, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
  }
}
