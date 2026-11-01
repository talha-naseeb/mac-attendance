import { SetMetadata } from '@nestjs/common';

export const PASSWORD_CHANGE_PENDING_KEY = 'passwordChangePending';
export const PasswordChangePending = () =>
  SetMetadata(PASSWORD_CHANGE_PENDING_KEY, true);
