import { Module } from '@nestjs/common'
import { GroupsController, MembersController, PointsController } from './groups.controller'
import { GroupsService } from './groups.service'
import { WebsocketModule } from '@/websocket/websocket.module'

@Module({
  imports: [WebsocketModule],
  controllers: [GroupsController, MembersController, PointsController],
  providers: [GroupsService],
  exports: [GroupsService]
})
export class GroupsModule {}
