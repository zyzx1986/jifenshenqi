import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Injectable, Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { getSupabaseClient } from '../storage/database/supabase-client'

interface RoomClient {
  socketId: string
  memberId: string
  memberName: string
  userId: string
  avatarUrl?: string
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private logger = new Logger('GameGateway')
  private roomClients: Map<string, Map<string, RoomClient>> = new Map()
  private supabase = getSupabaseClient()

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)

    for (const [roomId, clients] of this.roomClients.entries()) {
      if (!clients.has(client.id)) {
        continue
      }

      clients.delete(client.id)
      if (clients.size === 0) {
        this.roomClients.delete(roomId)
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; memberId: string; memberName: string; userId: string; avatarUrl?: string },
  ) {
    const { roomId, memberId, memberName, userId, avatarUrl } = data

    this.logger.log(`Member ${memberName} joining room ${roomId}`)
    client.join(roomId)

    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Map())
    }

    const roomMap = this.roomClients.get(roomId)!
    roomMap.set(client.id, {
      socketId: client.id,
      memberId,
      memberName,
      userId,
      avatarUrl,
    })

    const members = await this.getRoomMembers(roomId)
    const currentGame = await this.getRoomCurrentSession(roomId)
    this.logger.log(`roomState -> ${memberName} room=${roomId} members=${members.length} hasCurrentGame=${Boolean(currentGame)}`)
    const roomState = {
      members,
      currentGame,
      memberCount: roomMap.size,
    }
    client.emit('roomState', roomState)
    this.server.to(roomId).emit('roomState', roomState)

    return { success: true, members }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data

    client.leave(roomId)

    const clients = this.roomClients.get(roomId)
    if (clients) {
      clients.delete(client.id)
      if (clients.size === 0) {
        this.roomClients.delete(roomId)
      }
    }

    return { success: true }
  }

  @SubscribeMessage('pointUpdate')
  async handlePointUpdate(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: {
      roomId: string
      fromMemberId: string
      toMemberId: string
      points: number
      fromMemberName: string
      toMemberName: string
      currentMembers: any[]
    },
  ) {
    const { roomId, fromMemberId, toMemberId, points, fromMemberName, toMemberName, currentMembers } = data

    this.logger.log(`Point update: ${fromMemberName} gave ${points} to ${toMemberName}`)

    this.server.to(roomId).emit('pointsUpdated', {
      fromMemberId,
      toMemberId,
      points,
      fromMemberName,
      toMemberName,
      members: currentMembers,
      timestamp: new Date().toISOString(),
    })

    return { success: true }
  }

  @SubscribeMessage('roundComplete')
  async handleRoundComplete(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: {
      roomId: string
      members: any[]
      roundNumber: number
    },
  ) {
    const { roomId, members, roundNumber } = data

    this.server.to(roomId).emit('roundCompleted', {
      members,
      roundNumber,
      timestamp: new Date().toISOString(),
    })

    return { success: true }
  }

  @SubscribeMessage('gameEnd')
  async handleGameEnd(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { roomId: string; finalMembers: any[]; roomName: string },
  ) {
    const { roomId, finalMembers, roomName } = data

    this.server.to(roomId).emit('gameEnded', {
      members: finalMembers,
      roomName,
      timestamp: new Date().toISOString(),
    })

    return { success: true }
  }

  async broadcastToRoom(roomId: string, event: string, data: any) {
    this.logger.log(`broadcast ${event} room=${roomId} hasSession=${Boolean(data?.session)} started=${String(data?.started ?? '')}`)
    this.server.to(roomId).emit(event, data)
  }

  decorateRoomMembers(roomId: string, members: any[]) {
    const clients = this.roomClients.get(roomId)
    if (!clients || !Array.isArray(members)) {
      return members
    }

    const avatarMap = new Map<string, string>()
    clients.forEach((client) => {
      if (client.userId && client.avatarUrl) {
        avatarMap.set(client.userId, client.avatarUrl)
      }
    })

    return members.map((member: any) => ({
      ...member,
      avatar_url: member?.avatar_url || avatarMap.get(member.user_id) || '',
    }))
  }

  private async getRoomMembers(roomId: string) {
    try {
      const { data: group } = await this.supabase
        .from('groups')
        .select('id')
        .eq('invite_code', roomId)
        .single()

      if (!group) {
        return []
      }

      const { data: members } = await this.supabase
        .from('members')
        .select('id, name, avatar_url, total_points, user_id, is_host')
        .eq('group_id', group.id)

      return this.decorateRoomMembers(roomId, members || [])
    } catch (error) {
      this.logger.error('Failed to get room members:', error)
      return []
    }
  }

  private async getRoomCurrentSession(roomId: string) {
    try {
      const { data } = await this.supabase
        .from('game_sessions')
        .select('*')
        .eq('invite_code', roomId)
        .eq('status', 'playing')
        .single()

      if (!data) {
        return null
      }

      return {
        ...data,
        participants: JSON.parse((data as any).participants || '[]'),
        rounds: JSON.parse((data as any).rounds || '[]')
      }
    } catch (error) {
      this.logger.error('Failed to get room current session:', error)
      return null
    }
  }
}
