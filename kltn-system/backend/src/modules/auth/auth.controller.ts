import { Body, Controller, Get, Post, Res, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Đăng nhập hệ thống (MSSV/Email + Mật khẩu)',
    description: 'Xác thực tài khoản, kiểm tra điều kiện KLTN và trả về Access Token + Refresh Token (kèm HttpOnly cookie)',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về JWT và thông tin người dùng kèm cờ duDieuKienDangKyKLTN và trangThaiKLTN',
  })
  @ApiResponse({ status: 401, description: 'MSSV/email hoặc mật khẩu không chính xác' })
  @ApiResponse({ status: 403, description: 'Tài khoản đã bị khóa hoặc chưa được kích hoạt' })
  @ApiResponse({ status: 429, description: 'Vượt quá 5 lần thử sai trong 15 phút' })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket.remoteAddress ||
      '127.0.0.1';
    const userAgent = (request.headers['user-agent'] as string) || '';

    const result = await this.authService.login(dto, ip, userAgent);

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    };
  }

  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @ApiBearerAuth()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }

  @ApiOperation({ summary: 'Làm mới Access Token từ Refresh Token cookie' })
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.refresh_token;
    const result = await this.authService.refresh(refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
      data: { accessToken: result.accessToken, user: result.user },
    };
  }

  @ApiOperation({ summary: 'Đăng xuất tài khoản' })
  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: { id: string }, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.id);
    response.clearCookie('refresh_token', { path: '/api/auth' });
    return { message: 'Đã đăng xuất' };
  }

  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu qua email' })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({ summary: 'Đặt lại mật khẩu với token một lần' })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
