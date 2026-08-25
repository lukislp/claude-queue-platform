import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ClaudeConnectionModule } from './claude-connection/claude-connection.module';
import { DevicesModule } from './devices/devices.module';
import { TasksModule } from './tasks/tasks.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    ClaudeConnectionModule,
    DevicesModule,
    TasksModule,
    QueueModule,
    RealtimeModule,
  ],
})
export class AppModule {}
