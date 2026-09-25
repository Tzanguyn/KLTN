import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../modules/auth/strategies/jwt.strategy';
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest().user as AuthUser);
