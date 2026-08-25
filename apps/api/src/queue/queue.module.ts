import { Module } from '@nestjs/common';
import { QueueManagerService } from './queue-manager.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [QueueManagerService],
  exports: [QueueManagerService],
})
export class QueueModule {}
