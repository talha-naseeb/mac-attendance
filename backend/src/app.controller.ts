import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health & Discovery')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API Root Health & System Discovery' })
  @ApiResponse({ status: 200, description: 'Shiftly / MacqHR Backend is operational.' })
  getRoot() {
    return {
      status: 'ok',
      service: 'Shiftly / MacqHR Enterprise API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      docs: '/api/docs',
    };
  }
}
