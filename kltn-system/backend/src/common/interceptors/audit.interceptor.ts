import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    return next.handle().pipe(tap(() => {
      if (request.method === 'GET' || !request.user?.id) return;
      const entityId = typeof request.params?.id === 'string' ? request.params.id : undefined;
      void this.prisma.auditLog.create({ data: { userId: request.user.id, action: request.method, entity: request.route?.path ?? request.url, entityId, metadata: { bodyKeys: Object.keys(request.body ?? {}) }, ipAddress: request.ip, userAgent: request.get('user-agent') } }).catch(() => undefined);
    }));
  }
}
