import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { GroupsModule } from '@/groups/groups.module';
import { AuthModule } from '@/auth/auth.module';
import { WebsocketModule } from '@/websocket/websocket.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    GroupsModule,
    AuthModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
