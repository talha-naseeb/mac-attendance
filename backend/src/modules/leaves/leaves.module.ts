import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
