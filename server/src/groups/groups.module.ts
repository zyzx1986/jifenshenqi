import { Module } from '@nestjs/common'
import { GroupsController, MembersController, PointsController } from './groups.controller'
import { GroupsService } from './groups.service'

@Module({
  controllers: [GroupsController, MembersController, PointsController],
  providers: [GroupsService],
  exports: [GroupsService]
})
export class GroupsModule {}
