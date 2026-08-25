import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/task.dto';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.userId, dto);
  }

  @Get()
  listByProject(@CurrentUser() user: AuthUser, @Query('projectId') projectId: string) {
    return this.tasksService.listByProject(user.userId, projectId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.getWithLogs(user.userId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.cancel(user.userId, id);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.pause(user.userId, id);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.resume(user.userId, id);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.retry(user.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.remove(user.userId, id);
  }
}
