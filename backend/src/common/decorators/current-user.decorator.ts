import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  email: string;
  role: string;
  branchId?: string | null;
  department?: string | null;
  name: string;
  canAccessWebAdmin?: boolean;
  sessionId?: string;
  mustChangePassword?: boolean;
  workspaceId?: string | null;
  membershipId?: string | null;
  workspaceRole?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    return data && user ? user[data] : user;
  },
);
