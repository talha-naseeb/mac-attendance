import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import {
  NotificationQueryDto,
  RegisterDeviceTokenDto,
} from './dto/notifications.dto';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications and unread count' })
  @ApiResponse({ status: 200, description: 'Paginated user notifications' })
  async getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findForUser(user.id, query);
  }

  @Get('my')
  @ApiOperation({ summary: 'Alias for getting current user notifications' })
  async getMyNotificationsAlias(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findForUser(user.id, query);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification updated' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Post('device-token')
  @ApiOperation({ summary: 'Register a device push notification token' })
  @ApiResponse({ status: 201, description: 'Device token registered' })
  async registerDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(user.id, dto);
  }
}
