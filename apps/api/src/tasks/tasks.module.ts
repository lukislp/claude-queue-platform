import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [JwtModule.register({}), QueueModule, RealtimeModule],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
