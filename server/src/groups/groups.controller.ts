import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common'
import { GameGateway } from '@/websocket/game.gateway'
import { GroupsService } from './groups.service'

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly gameGateway: GameGateway
  ) {}

  @Post('create')
  async createGroup(
    @Body() body: { name: string; member_name: string; user_id?: string },
    @Headers('authorization') _authHeader?: string
  ) {
    const { name, member_name } = body
    const userId = body.user_id || `user_${Date.now()}`
    const result = await this.groupsService.createGroup(name, member_name, userId)

    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Post('join')
  async joinGroup(
    @Body() body: { invite_code: string; member_name: string; user_id?: string },
    @Headers('authorization') authHeader?: string
  ) {
    const { invite_code, member_name } = body
    const token = authHeader?.replace('Bearer ', '') || ''
    const result = await this.groupsService.joinGroup(invite_code, member_name, token, body.user_id)

    if (result.isNewMember) {
      const members = this.gameGateway.decorateRoomMembers(
        invite_code,
        await this.groupsService.getGroupMembers(result.group.id)
      )
      await this.gameGateway.broadcastToRoom(invite_code, 'memberJoined', {
        memberId: result.member.id,
        memberName: result.member.name,
        members
      })
    }

    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Post('leave')
  async leaveGroup(
    @Body() body: { group_id: string; member_id: string; invite_code: string; member_name?: string }
  ) {
    const result = await this.groupsService.handleMemberLeave(body.group_id, body.member_id)

    if (result.success) {
      const members = this.gameGateway.decorateRoomMembers(body.invite_code, result.members || [])
      await this.gameGateway.broadcastToRoom(body.invite_code, 'memberLeft', {
        memberId: body.member_id,
        memberName: body.member_name,
        members
      })

      if (result.nextCreatorId) {
        await this.gameGateway.broadcastToRoom(body.invite_code, 'hostTransferred', {
          creatorId: result.nextCreatorId,
          members
        })
      }

      if (result.abandoned) {
        await this.gameGateway.broadcastToRoom(body.invite_code, 'gameAbandoned', {
          reason: 'members_insufficient',
          members
        })
      } else if (result.updatedSession) {
        await this.gameGateway.broadcastToRoom(body.invite_code, 'gameSessionUpdated', {
          session: result.updatedSession,
          started: false
        })
      }
    }

    return {
      code: 200,
      message: result.success ? 'success' : 'failed',
      data: result.success
    }
  }

  @Get('members')
  async getGroupMembers(@Query('group_id') groupId: string) {
    const members = await this.groupsService.getGroupMembers(groupId)
    const inviteCode = await this.groupsService.getGroupInviteCode(groupId)
    return {
      code: 200,
      message: 'success',
      data: inviteCode ? this.gameGateway.decorateRoomMembers(inviteCode, members) : members
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

  @Post('save-history')
  async saveUserRoomHistory(
    @Body() body: { room_name: string; invite_code: string; user_id: string },
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const success = await this.groupsService.saveUserRoomHistory(token, body)
    return {
      code: 200,
      message: success ? 'success' : 'failed',
      data: success
    }
  }

  @Get('session')
  async getCurrentSession(
    @Query('inviteCode') inviteCode: string,
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const session = await this.groupsService.getCurrentSession(token, inviteCode)
    return {
      code: session ? 200 : 500,
      message: session ? 'success' : 'failed',
      data: session
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

  @Post('game/save')
  async saveGameSession(
    @Body() body: {
      group_id: string
      room_name: string
      invite_code: string
      participants: any[]
      rounds: any[]
      user_id?: string
    },
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    console.log('[game/save] request', {
      invite_code: body.invite_code,
      group_id: body.group_id,
      participants: Array.isArray(body.participants) ? body.participants.length : -1,
      rounds: Array.isArray(body.rounds) ? body.rounds.length : -1,
    })
    const session = await this.groupsService.saveGameSession(token, body)

    if (session) {
      const latestSession = await this.groupsService.getCurrentGameSession(token, body.invite_code)
      console.log('[game/save] broadcasting gameSessionUpdated', {
        invite_code: body.invite_code,
        session_id: (latestSession || session as any)?.id,
        started: body.rounds.length === 0,
      })
      await this.gameGateway.broadcastToRoom(body.invite_code, 'gameSessionUpdated', {
        session: latestSession || session,
        started: body.rounds.length === 0
      })
    } else {
      console.log('[game/save] saveGameSession returned null', {
        invite_code: body.invite_code,
      })
    }

    return {
      code: 200,
      message: 'success',
      data: session
    }
  }

  @Get('game/current')
  async getCurrentGameSession(
    @Query('invite_code') inviteCode: string,
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const session = await this.groupsService.getCurrentGameSession(token, inviteCode)
    return {
      code: 200,
      message: 'success',
      data: session
    }
  }

  @Post('game/finish')
  async finishGame(
    @Body() body: {
      group_id: string
      invite_code: string
      participants: any[]
      rounds: any[]
      total_rounds: number
      room_name?: string
      user_id?: string
    },
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const history = await this.groupsService.finishGameSessionV2(token, body)

    if (history) {
      await this.groupsService.resetGroupMemberPoints(body.group_id)
      const members = await this.groupsService.getGroupMembers(body.group_id)
      await this.gameGateway.broadcastToRoom(body.invite_code, 'gameEnded', {
        members,
        roomName: body.room_name || (history as any).room_name || '鎴块棿',
        timestamp: new Date().toISOString()
      })
    }

    return {
      code: history ? 200 : 500,
      message: history ? 'success' : 'failed',
      data: history
    }
  }

  @Get('game/history')
  async getGameHistory(
    @Query('invite_code') inviteCode: string,
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const history = await this.groupsService.getGameHistory(token, inviteCode)
    return {
      code: 200,
      message: 'success',
      data: history
    }
  }

  @Get('game/stats')
  async getGameStats(
    @Query('invite_code') inviteCode: string,
    @Headers('authorization') authHeader?: string
  ) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const stats = await this.groupsService.getGameStats(token, inviteCode)
    return {
      code: 200,
      message: 'success',
      data: stats
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
  constructor(
    private readonly groupsService: GroupsService,
    private readonly gameGateway: GameGateway
  ) {}

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
    const result = await this.groupsService.givePoints(
      body.group_id,
      body.from_member_id,
      body.to_member_id,
      body.points,
      body.reason
    )

    const inviteCode = await this.groupsService.getGroupInviteCode(body.group_id)

    if (inviteCode) {
      const members = this.gameGateway.decorateRoomMembers(inviteCode, result.members)
      await this.gameGateway.broadcastToRoom(inviteCode, 'pointsUpdated', {
        fromMemberId: body.from_member_id,
        toMemberId: body.to_member_id,
        points: body.points,
        members,
        timestamp: new Date().toISOString()
      })
    }

    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Post('revoke')
  async revokePoints(
    @Body() body: {
      group_id: string
      record_id: string
    }
  ) {
    const result = await this.groupsService.revokePointsRecord(body.group_id, body.record_id)
    const inviteCode = await this.groupsService.getGroupInviteCode(body.group_id)

    if (inviteCode) {
      const members = this.gameGateway.decorateRoomMembers(inviteCode, result.members)
      await this.gameGateway.broadcastToRoom(inviteCode, 'pointsUpdated', {
        recordId: body.record_id,
        members,
        reversed: true,
        timestamp: new Date().toISOString()
      })
    }

    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Get('history')
  async getHistory(@Query('group_id') groupId: string) {
    const records = await this.groupsService.getPointsHistoryView(groupId)
    return {
      code: 200,
      message: 'success',
      data: records
    }
  }
}
