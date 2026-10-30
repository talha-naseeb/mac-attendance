import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DirectoryService } from './directory.service';

@ApiTags('Colleague Directory')
@Controller('directory')
@ApiBearerAuth()
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('whos-off')
  @ApiOperation({ summary: "Get list of team members on approved leave today ('Who's Off Today')" })
  async getWhosOff() {
    return this.directoryService.getWhosOffToday();
  }

  @Get()
  @ApiOperation({ summary: 'Colleague directory with live presence & reachability status' })
  async getDirectory() {
    return this.directoryService.getDirectory();
  }
}
