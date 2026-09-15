import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('pair/init')
  initPairing(@CurrentUser() user: AuthUser) {
    return this.devicesService.initPairing(user.userId);
  }

  // Called by the local agent - not signed in as a user yet, authenticated by the pairing code.
  @Post('pair/confirm')
  confirmPairing(@Body() body: { code: string; deviceName: string }) {
    return this.devicesService.confirmPairing(body.code, body.deviceName);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.devicesService.list(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devicesService.remove(user.userId, id);
  }
}
