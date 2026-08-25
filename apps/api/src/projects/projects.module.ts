import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [JwtModule.register({})],
  providers: [ProjectsService],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
