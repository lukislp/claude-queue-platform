import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClaudeConnectionService } from './claude-connection.service';
import { ClaudeConnectionController } from './claude-connection.controller';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [JwtModule.register({}), QueueModule, RealtimeModule],
  providers: [ClaudeConnectionService],
  controllers: [ClaudeConnectionController],
  exports: [ClaudeConnectionService],
})
export class ClaudeConnectionModule {}
