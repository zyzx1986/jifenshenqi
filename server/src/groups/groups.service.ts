import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { Group, Member, PointsRecord } from './types'
import * as jwt from 'jsonwebtoken'
import * as QRCode from 'qrcode'

@Injectable()
export class GroupsService {
  private client = getSupabaseClient()
  private jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

  async createGroup(name: string, memberName: string, userId: string): Promise<{ group: Group; member: Member }> {
    // const userId = `user_${Date.now()}` // 改为传入 userId
    const inviteCode = this.generateInviteCode()

    // 创建群组
    const { data: groupData, error: groupError } = await this.client
      .from('groups')
      .insert({
        name,
        invite_code: inviteCode,
        creator_id: userId
      })
      .select()
      .single()

    if (groupError) {
      console.error('创建群组失败:', groupError)
      throw new Error(`创建群组失败: ${groupError.message}`)
    }
    const group = groupData as Group

    // 创建成员
    const { data: memberData, error: memberError } = await this.client
      .from('members')
      .insert({
        group_id: group.id,
        user_id: userId,
        name: memberName,
        total_points: 0
      })
      .select()
      .single()

    if (memberError) {
      console.error('创建成员失败:', memberError)
      throw new Error(`创建成员失败: ${memberError.message}`)
    }
    const member = memberData as Member

    // 记录到用户房间历史
    await this.client
      .from('user_rooms')
      .insert({
        user_id: userId,
        group_id: group.id,
        room_name: name,
        invite_code: inviteCode
      })

    return { group, member }
  }

  async joinGroup(inviteCode: string, memberName: string): Promise<{ group: Group; member: Member }> {
    const userId = `user_${Date.now()}`

    // 查找群组
    const { data: groupData, error: groupError } = await this.client
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (groupError) {
      console.error('查询群组失败:', groupError)
      throw new Error(`查询群组失败: ${groupError.message}`)
    }
    if (!groupData) throw new Error('邀请码无效')

    const group = groupData as Group

    // 检查用户是否已在群组中
    const { data: existingMember } = await this.client
      .from('members')
      .select('*')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) {
      return { group, member: existingMember as Member }
    }

    // 创建成员
    const { data: memberData, error: memberError } = await this.client
      .from('members')
      .insert({
        group_id: group.id,
        user_id: userId,
        name: memberName,
        total_points: 0
      })
      .select()
      .single()

    if (memberError) {
      console.error('加入群组失败:', memberError)
      throw new Error(`加入群组失败: ${memberError.message}`)
    }
    const member = memberData as Member

    return { group, member }
  }

  async getGroupMembers(groupId: string): Promise<Member[]> {
    const { data, error } = await this.client
      .from('members')
      .select('*')
      .eq('group_id', groupId)

    if (error) {
      console.error('查询成员失败:', error)
      throw new Error(`查询成员失败: ${error.message}`)
    }
    return (data || []) as Member[]
  }

  async updateMemberName(memberId: string, name: string): Promise<Member> {
    const { data, error } = await this.client
      .from('members')
      .update({ name })
      .eq('id', memberId)
      .select()
      .single()

    if (error) {
      console.error('更新成员失败:', error)
      throw new Error(`更新成员失败: ${error.message}`)
    }
    return data as Member
  }

  async givePoints(
    groupId: string,
    fromMemberId: string,
    toMemberId: string,
    points: number,
    reason: string
  ): Promise<void> {
    // 先获取当前积分
    const { data: currentMember, error: fetchError } = await this.client
      .from('members')
      .select('total_points')
      .eq('id', toMemberId)
      .single()

    if (fetchError) {
      console.error('查询成员失败:', fetchError)
      throw new Error(`查询成员失败: ${fetchError.message}`)
    }

    const currentPoints = (currentMember as any).total_points || 0
    const newPoints = currentPoints + points

    // 创建积分记录
    const { error: recordError } = await this.client
      .from('points_records')
      .insert({
        group_id: groupId,
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        points,
        reason
      })

    if (recordError) {
      console.error('创建积分记录失败:', recordError)
      throw new Error(`创建积分记录失败: ${recordError.message}`)
    }

    // 更新接收者积分
    const { error: updateError } = await this.client
      .from('members')
      .update({ total_points: newPoints })
      .eq('id', toMemberId)

    if (updateError) {
      console.error('更新积分失败:', updateError)
      throw new Error(`更新积分失败: ${updateError.message}`)
    }
  }

  async getPointsHistory(groupId: string): Promise<PointsRecord[]> {
    const { data, error } = await this.client
      .from('points_records')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询积分记录失败:', error)
      throw new Error(`查询积分记录失败: ${error.message}`)
    }

    // 获取成员名称
    const memberIds = new Set<string>()
    data?.forEach((record: any) => {
      memberIds.add(record.from_member_id)
      memberIds.add(record.to_member_id)
    })

    const { data: members } = await this.client
      .from('members')
      .select('id, name')
      .in('id', Array.from(memberIds))

    const memberMap = new Map<string, string>()
    members?.forEach((member: any) => {
      memberMap.set(member.id, member.name)
    })

    // 添加成员名称
    return (data || []).map((record: any) => ({
      ...record,
      from_member_name: memberMap.get(record.from_member_id) || '未知',
      to_member_name: memberMap.get(record.to_member_id) || '未知'
    })) as PointsRecord[]
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // 获取用户已加入的群组
  async getMyGroup(token: string): Promise<{ group: Group; member: Member } | null> {
    try {
      // 解析 token 获取用户信息
      const decoded = jwt.verify(token, this.jwtSecret) as any
      const userId = decoded.userId

      // 查询用户加入的群组
      const { data: memberData, error: memberError } = await this.client
        .from('members')
        .select('*, groups(*)')
        .eq('user_id', userId)
        .maybeSingle()

      if (memberError) {
        console.error('查询用户群组失败:', memberError)
        return null
      }

      if (!memberData) {
        return null
      }

      const member = memberData as any
      const group = member.groups as Group

      return {
        group,
        member: {
          id: member.id,
          group_id: member.group_id,
          user_id: member.user_id,
          name: member.name,
          total_points: member.total_points,
          created_at: member.created_at,
          updated_at: member.updated_at
        }
      }
    } catch (error) {
      console.error('获取用户群组失败:', error)
      return null
    }
  }

  // 生成二维码
  async generateQRCode(inviteCode: string): Promise<string> {
    try {
      const qrData = `invite_code=${inviteCode}`
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      return qrDataUrl
    } catch (error) {
      console.error('生成二维码失败:', error)
      throw new Error('生成二维码失败')
    }
  }

  // 获取用户房间历史记录
  async getUserRoomHistory(token: string): Promise<any[]> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any
      const userId = decoded.userId

      const { data, error } = await this.client
        .from('user_rooms')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('获取房间历史失败:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('获取房间历史失败:', error)
      return []
    }
  }

  // 删除房间历史记录
  async deleteUserRoomHistory(token: string, roomId: string): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any
      const userId = decoded.userId

      const { error } = await this.client
        .from('user_rooms')
        .delete()
        .eq('id', roomId)
        .eq('user_id', userId)

      if (error) {
        console.error('删除房间历史失败:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('删除房间历史失败:', error)
      return false
    }
  }
}
