import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common'
import { GroupsService } from './groups.service'
import { Member, PointsRecord } from './types'

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('create')
  async createGroup(
    @Body() body: { name: string; member_name: string; user_id?: string },
    @Headers('authorization') authHeader?: string
  ) {
    const { name, member_name } = body
    // 如果有 token，使用 token 中的 userId；否则使用传入的 user_id 或生成新的
    let userId = body.user_id
    if (authHeader) {
      try {
        const { GroupsService } = await import('./groups.service')
        // 从 token 解析（这里简化处理）
      } catch (e) {}
    }
    if (!userId) {
      userId = `user_${Date.now()}`
    }
    const result = await this.groupsService.createGroup(name, member_name, userId)
    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Post('join')
  async joinGroup(
    @Body() body: { invite_code: string; member_name: string }
  ) {
    const { invite_code, member_name } = body
    const result = await this.groupsService.joinGroup(invite_code, member_name)
    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Get('members')
  async getGroupMembers(@Query('group_id') groupId: string) {
    const members = await this.groupsService.getGroupMembers(groupId)
    return {
      code: 200,
      message: 'success',
      data: members
    }
  }

  @Get('my-group')
  async getMyGroup(@Headers('authorization') authHeader?: string) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const result = await this.groupsService.getMyGroup(token)
    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Get('qrcode')
  async generateQRCode(@Query('invite_code') inviteCode: string) {
    const qrDataUrl = await this.groupsService.generateQRCode(inviteCode)
    return {
      code: 200,
      message: 'success',
      data: {
        qr_code: qrDataUrl
      }
    }
  }

  @Get('room-history')
  async getUserRoomHistory(@Headers('authorization') authHeader?: string) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const history = await this.groupsService.getUserRoomHistory(token)
    return {
      code: 200,
      message: 'success',
      data: history
    }
  }

  @Post('room-history/delete')
  async deleteUserRoomHistory(
    @Body() body: { room_id: string },
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const success = await this.groupsService.deleteUserRoomHistory(token, body.room_id)
    return {
      code: 200,
      message: success ? 'success' : 'failed',
      data: success
    }
  }
}

@Controller('members')
export class MembersController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('update')
  async updateMember(
    @Body() body: { member_id: string; name: string }
  ) {
    const member = await this.groupsService.updateMemberName(body.member_id, body.name)
    return {
      code: 200,
      message: 'success',
      data: member
    }
  }
}

@Controller('points')
export class PointsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('give')
  async givePoints(
    @Body() body: {
      group_id: string
      from_member_id: string
      to_member_id: string
      points: number
      reason: string
    }
  ) {
    await this.groupsService.givePoints(
      body.group_id,
      body.from_member_id,
      body.to_member_id,
      body.points,
      body.reason
    )
    return {
      code: 200,
      message: 'success',
      data: null
    }
  }

  @Get('history')
  async getHistory(@Query('group_id') groupId: string) {
    const records = await this.groupsService.getPointsHistory(groupId)
    return {
      code: 200,
      message: 'success',
      data: records
    }
  }
}
