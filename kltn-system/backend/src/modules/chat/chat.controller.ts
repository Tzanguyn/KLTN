import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('messages') list(@CurrentUser() user: { id: string }, @Query('groupId') groupId: string) { return this.service.list(user.id, groupId); }
  @Post('messages') send(@CurrentUser() user: { id: string }, @Body() dto: SendMessageDto) { return this.service.send(user.id, dto); }
}
