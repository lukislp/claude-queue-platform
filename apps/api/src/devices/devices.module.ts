import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';

@Module({
  imports: [JwtModule.register({})],
  providers: [DevicesService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}
