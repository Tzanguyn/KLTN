import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type AuthUser = { id: string; email: string; roles: string[] };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-change-this-32-chars' });
  }
  validate(payload: { sub: string; email: string; roles: string[] }): AuthUser { return { id: payload.sub, email: payload.email, roles: payload.roles }; }
}
