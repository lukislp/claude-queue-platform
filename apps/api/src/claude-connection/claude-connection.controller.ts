import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { ClaudeConnectionService } from './claude-connection.service';
import { UpdateConnectionDto } from './dto/connection.dto';

@UseGuards(JwtAuthGuard)
@Controller('connection')
export class ClaudeConnectionController {
  constructor(private readonly service: ClaudeConnectionService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.userId);
  }

  @Get('models')
  listModels(@CurrentUser() user: AuthUser) {
    return this.service.listModels(user.userId);
  }

  @Put()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateConnectionDto) {
    return this.service.update(user.userId, dto);
  }
}
