import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleCode } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Ánh xạ kế thừa quyền: ADMIN có toàn quyền nghiệp vụ, TRUONG_BO_MON và QUAN_LY_BO_MON kế thừa GIANG_VIEN
const ROLE_INHERITANCE: Record<string, RoleCode[]> = {
  [RoleCode.ADMIN]: [
    RoleCode.ADMIN,
    RoleCode.TRUONG_BO_MON,
    RoleCode.QUAN_LY_BO_MON,
    RoleCode.GIANG_VIEN,
  ],
  [RoleCode.TRUONG_BO_MON]: [RoleCode.TRUONG_BO_MON, RoleCode.GIANG_VIEN],
  [RoleCode.QUAN_LY_BO_MON]: [RoleCode.QUAN_LY_BO_MON, RoleCode.GIANG_VIEN],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user as { roles?: string[] } | undefined;
    const userRoles = user?.roles || [];
    if (userRoles.includes(RoleCode.ADMIN)) {
      return true;
    }
    const effectiveRoles = userRoles.flatMap((role) => ROLE_INHERITANCE[role] || [role as RoleCode]);
    if (!effectiveRoles.some((role) => required.includes(role as RoleCode))) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
