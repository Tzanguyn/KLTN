import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { QuerySubmissionsDto } from './dto/query-submissions.dto';
import { SendFeedbackDto } from './dto/send-feedback.dto';
import { ProgressService } from './progress.service';

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.drawio',
  '.txt',
  '.md',
];

@ApiTags('submissions')
@ApiBearerAuth()
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly service: ProgressService) {}

  @ApiOperation({
    summary: 'Nộp báo cáo / tài liệu / mã nguồn / link KLTN',
    description:
      'Cho phép sinh viên nộp nhiều loại tài liệu (Word, PDF, ZIP, code) hoặc link GitHub/Drive/Demo (hỗ trợ file max 50MB, lưu version và trạng thái CHUA_XEM)',
  })
  @ApiResponse({ status: 201, description: 'Nộp bài thành công' })
  @Post()
  @Roles(RoleCode.SINH_VIEN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, callback) =>
          callback(
            null,
            `${Date.now()}-${Math.random().toString(16).slice(2)}${extname(file.originalname).toLowerCase()}`,
          ),
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (_, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Định dạng tệp không được hỗ trợ (${ext}). Chỉ chấp nhận: ${ALLOWED_EXTENSIONS.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  submit(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSubmissionDto,
    @UploadedFile() file?: any,
  ) {
    return this.service.createSubmission(user.id, dto, file);
  }

  @ApiOperation({
    summary: 'Xem lịch sử nộp bài của sinh viên hiện tại',
    description: 'Trả về toàn bộ danh sách các lần nộp bài, phiên bản (version), file/link và phản hồi từ GVHD',
  })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử nộp bài thành công' })
  @Get('me')
  @Roles(RoleCode.SINH_VIEN)
  getMySubmissions(
    @CurrentUser() user: { id: string },
    @Query('topicId') topicId?: string,
  ) {
    return this.service.getMySubmissions(user.id, topicId);
  }

  @ApiOperation({
    summary: 'Xem danh sách bài nộp (hỗ trợ lọc theo topicId, groupId, thời gian từ - đến, trạng thái)',
    description: 'Giảng viên xem các bài nộp của nhóm mình hướng dẫn/phản biện; Trưởng bộ môn xem toàn bộ; Hỗ trợ lọc theo nhóm và thời gian',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách bài nộp thành công' })
  @Get()
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.SINH_VIEN)
  getSubmissions(
    @CurrentUser() user: { id: string },
    @Query() query: QuerySubmissionsDto,
  ) {
    return this.service.findSubmissions(user.id, query);
  }

  @ApiOperation({
    summary: 'Tải tệp tin bài nộp hoặc xem thông tin chi tiết bài nộp',
    description: 'Thực hiện tải file đính kèm với tên gốc (Content-Disposition: attachment). Nếu truyền ?info=true sẽ trả về JSON chi tiết.',
  })
  @ApiResponse({ status: 200, description: 'Tải file thành công hoặc trả về thông tin chi tiết' })
  @Get(':id')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, RoleCode.SINH_VIEN)
  downloadSubmission(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Res() res: Response,
    @Query('download') download?: string,
    @Query('info') info?: string,
  ) {
    return this.service.downloadSubmission(user.id, id, res, { download, info });
  }

  @ApiOperation({
    summary: 'Gửi nhận xét bài nộp và đánh dấu đã xem',
    description: 'Lưu feedback gắn với bài nộp, cập nhật trạng thái đã xem (hoặc yêu cầu chỉnh sửa), và gửi thông báo Realtime/Email cho SV',
  })
  @ApiResponse({ status: 201, description: 'Gửi phản hồi thành công' })
  @Post(':id/feedback')
  @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON)
  sendFeedback(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SendFeedbackDto,
  ) {
    return this.service.feedback(user.id, id, dto.content, dto.yeuCauChinhSua);
  }
}

