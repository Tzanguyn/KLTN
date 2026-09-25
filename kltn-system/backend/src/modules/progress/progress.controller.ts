import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RoleCode } from '@prisma/client';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ProgressService } from './progress.service';

@ApiTags('progress') @ApiBearerAuth() @Controller('progress') @UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(private readonly service: ProgressService) {}
  @Get('groups') groups(@CurrentUser() user: { id: string }) { return this.service.groups(user.id); }
  @Get('reports') reports(@CurrentUser() user: { id: string }, @Query('groupId') groupId?: string) { return this.service.reports(user.id, groupId); }
  @Get('submissions') submissions(@CurrentUser() user: { id: string }, @Query('groupId') groupId?: string) { return this.service.submissions(user.id, groupId); }
  @Post('reports') @Roles(RoleCode.SINH_VIEN, RoleCode.GIANG_VIEN) create(@CurrentUser() user: { id: string }, @Body() dto: CreateReportDto) { return this.service.create(user.id, dto); }
  @Post('reports/:id/submissions') @Roles(RoleCode.SINH_VIEN) @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file', { storage: diskStorage({ destination: './uploads', filename: (_, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_, file, callback) => callback(null, ['.pdf', '.zip', '.docx', '.doc', '.pptx'].includes(extname(file.originalname).toLowerCase())) })) submit(@CurrentUser() user: { id: string }, @Param('id') id: string, @UploadedFile() file: any, @Body('sourceUrl') sourceUrl?: string, @Body('note') note?: string) { return this.service.submit(user.id, id, file, sourceUrl, note); }
  @Post('submissions/:id/feedback') @Roles(RoleCode.GIANG_VIEN, RoleCode.TRUONG_BO_MON) feedback(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: { content: string; yeuCauChinhSua?: boolean }) { return this.service.feedback(user.id, id, body.content, body.yeuCauChinhSua); }
}
