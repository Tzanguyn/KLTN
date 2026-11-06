import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray((detail as any)?.message)
        ? (detail as any).message.join('; ')
        : (detail as any)?.message || 'Internal server error';
    response.status(status).json({ success: false, message, error: detail, path: request.url, timestamp: new Date().toISOString() });
  }
}
