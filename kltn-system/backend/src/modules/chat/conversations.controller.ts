import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { QueryConversationMessagesDto, SendConversationMessageDto } from './dto/conversations.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly service: ChatService) {}

  @ApiOperation({
    summary: 'Lấy danh sách tin nhắn theo đề tài (hỗ trợ phân trang và timeline)',
  })
  @ApiResponse({ status: 200, description: 'Lấy tin nhắn thành công' })
  @Get(':topicId/messages')
  listMessages(
    @CurrentUser() user: { id: string },
    @Param('topicId') topicId: string,
    @Query() query: QueryConversationMessagesDto,
  ) {
    return this.service.listByTopic(user.id, topicId, query.page, query.limit);
  }

  @ApiOperation({
    summary: 'Gửi tin nhắn mới vào cuộc trò chuyện của đề tài (hỗ trợ file đính kèm)',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiResponse({ status: 201, description: 'Gửi tin nhắn thành công' })
  @Post(':topicId/messages')
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
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('topicId') topicId: string,
    @Body() dto: SendConversationMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.sendToTopic(user.id, topicId, dto, file);
  }
}

