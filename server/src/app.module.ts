import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { GroupsModule } from '@/groups/groups.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [GroupsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
