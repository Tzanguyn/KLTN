import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @ApiOperation({ summary: 'Lấy danh sách thông báo của tôi (phân trang và lọc theo type)' })
  @ApiResponse({ status: 200, description: 'Danh sách thông báo kèm meta và unreadCount' })
  @Get('me')
  listMe(
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: NotificationType,
  ) {
    return this.service.list(user.id, page, limit, type);
  }

  @ApiOperation({ summary: 'Lấy danh sách thông báo (tương thích ngược)' })
  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: NotificationType,
  ) {
    return this.service.list(user.id, page, limit, type);
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu tất cả đã đọc' })
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: { id: string }) {
    return this.service.markReadAll(user.id);
  }

  @ApiOperation({ summary: 'Đánh dấu một thông báo là đã đọc' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu thông báo đã đọc' })
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }

  @ApiOperation({ summary: 'Kích hoạt quét và gửi cảnh báo deadline còn 3-7 ngày' })
  @Post('check-deadlines')
  @HttpCode(HttpStatus.OK)
  checkDeadlines() {
    return this.service.checkAndSendDeadlineWarnings();
  }
}
