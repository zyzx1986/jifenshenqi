import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../storage/supabase.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface RoomClient {
  socketId: string;
  memberId: string;
  memberName: string;
  userId: string;
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
  server: Server;

  private logger = new Logger('GameGateway');
  
  // 存储房间内的客户端信息
  private roomClients: Map<string, Map<string, RoomClient>> = new Map();

  constructor(private supabaseService: SupabaseService) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // 从所有房间移除该客户端
    for (const [roomId, clients] of this.roomClients.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        
        // 通知房间内其他成员有人离开
        const member = clients.get(client.id);
        if (member) {
          this.server.to(roomId).emit('memberLeft', {
            memberId: member.memberId,
            memberName: member.memberName,
          });
        }
        
        // 如果房间没人了，清理数据
        if (clients.size === 0) {
          this.roomClients.delete(roomId);
        }
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; memberId: string; memberName: string; userId: string },
  ) {
    const { roomId, memberId, memberName, userId } = data;
    
    this.logger.log(`Member ${memberName} joining room ${roomId}`);
    
    // 加入 Socket 房间
    client.join(roomId);
    
    // 记录客户端信息
    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Map());
    }
    
    this.roomClients.get(roomId).set(client.id, {
      socketId: client.id,
      memberId,
      memberName,
      userId,
    });
    
    // 获取当前房间的所有成员
    const members = await this.getRoomMembers(roomId);
    
    // 通知新加入的成员当前房间状态
    client.emit('roomState', {
      members,
      memberCount: this.roomClients.get(roomId).size,
    });
    
    // 通知房间内其他成员有人加入
    client.to(roomId).emit('memberJoined', {
      memberId,
      memberName,
      members,
    });
    
    return { success: true, members };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data;
    
    client.leave(roomId);
    
    const clients = this.roomClients.get(roomId);
    if (clients) {
      const member = clients.get(client.id);
      clients.delete(client.id);
      
      if (member) {
        this.server.to(roomId).emit('memberLeft', {
          memberId: member.memberId,
          memberName: member.memberName,
        });
      }
      
      if (clients.size === 0) {
        this.roomClients.delete(roomId);
      }
    }
    
    return { success: true };
  }

  @SubscribeMessage('pointUpdate')
  async handlePointUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      roomId: string; 
      fromMemberId: string; 
      toMemberId: string; 
      points: number;
      fromMemberName: string;
      toMemberName: string;
      currentMembers: any[];
    },
  ) {
    const { roomId, fromMemberId, toMemberId, points, fromMemberName, toMemberName, currentMembers } = data;
    
    this.logger.log(`Point update: ${fromMemberName} gave ${points} to ${toMemberName}`);
    
    // 广播给房间内所有成员（包括发送者）
    this.server.to(roomId).emit('pointsUpdated', {
      fromMemberId,
      toMemberId,
      points,
      fromMemberName,
      toMemberName,
      members: currentMembers,
      timestamp: new Date().toISOString(),
    });
    
    return { success: true };
  }

  @SubscribeMessage('roundComplete')
  async handleRoundComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      roomId: string; 
      members: any[];
      roundNumber: number;
    },
  ) {
    const { roomId, members, roundNumber } = data;
    
    // 广播回合完成
    this.server.to(roomId).emit('roundCompleted', {
      members,
      roundNumber,
      timestamp: new Date().toISOString(),
    });
    
    return { success: true };
  }

  @SubscribeMessage('gameEnd')
  async handleGameEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; finalMembers: any[]; roomName: string },
  ) {
    const { roomId, finalMembers, roomName } = data;
    
    // 广播游戏结束
    this.server.to(roomId).emit('gameEnded', {
      members: finalMembers,
      roomName,
      timestamp: new Date().toISOString(),
    });
    
    return { success: true };
  }

  // 公开方法，用于 HTTP 接口触发广播
  async broadcastToRoom(roomId: string, event: string, data: any) {
    this.server.to(roomId).emit(event, data);
  }

  private async getRoomMembers(roomId: string) {
    try {
      // 通过 invite_code 查找成员
      const { data: group } = await this.supabaseService.getClient()
        .from('groups')
        .select('id')
        .eq('invite_code', roomId)
        .single();
      
      if (!group) {
        return [];
      }
      
      const { data: members } = await this.supabaseService.getClient()
        .from('members')
        .select('id, name, points, user_id, is_host')
        .eq('group_id', group.id);
      
      return members || [];
    } catch (error) {
      this.logger.error('Failed to get room members:', error);
      return [];
    }
  }
}
