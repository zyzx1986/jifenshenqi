import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import * as jwt from 'jsonwebtoken'
import * as QRCode from 'qrcode'
import { Group, Member, PointsRecord } from './types'

@Injectable()
export class GroupsService {
  private client = getSupabaseClient()
  private jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
  private revokedReasonPrefix = '[REVOKED]'

  private isMissingAvatarColumnError(error: any) {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
    return message.includes('avatar_url') && (message.includes('column') || message.includes('schema cache'))
  }

  private async insertMemberRecord(payload: Record<string, any>) {
    const memberInsert = async (nextPayload: Record<string, any>) =>
      this.client
        .from('members')
        .insert(nextPayload)
        .select()
        .single()

    let result = await memberInsert(payload)
    if (result.error && payload.avatar_url && this.isMissingAvatarColumnError(result.error)) {
      const { avatar_url: _avatarUrl, ...fallbackPayload } = payload
      result = await memberInsert(fallbackPayload)
    }

    return result
  }

  private async updateMemberProfile(memberId: string, payload: Record<string, any>) {
    const updateMember = async (nextPayload: Record<string, any>) =>
      this.client
        .from('members')
        .update(nextPayload)
        .eq('id', memberId)
        .select()
        .single()

    let result = await updateMember(payload)
    if (result.error && payload.avatar_url && this.isMissingAvatarColumnError(result.error)) {
      const { avatar_url: _avatarUrl, ...fallbackPayload } = payload
      result = await updateMember(fallbackPayload)
    }

    return result
  }

  private parseJsonArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value as T[]
    }

    if (typeof value !== 'string' || !value) {
      return []
    }

    try {
      return JSON.parse(value) as T[]
    } catch (error) {
      console.error('parseJsonArray failed:', error)
      return []
    }
  }

  // 验证 token 并返回用户 ID
  private verifyToken(token: string): string {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any
      return decoded.userId
    } catch (error) {
      throw new Error('无效的认证令牌')
    }
  }

  async createGroup(
    name: string,
    memberName: string,
    userId: string,
    avatarUrl?: string
  ): Promise<{ group: Group; member: Member }> {
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
    const { data: memberData, error: memberError } = await this.insertMemberRecord({
      group_id: group.id,
      user_id: userId,
      name: memberName,
      avatar_url: avatarUrl || null,
      total_points: 0
    })

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

  async joinGroup(
    inviteCode: string,
    memberName: string,
    token?: string,
    fallbackUserId?: string,
    avatarUrl?: string
  ): Promise<{ group: Group; member: Member; isNewMember: boolean }> {
    // 如果有 token，从 token 中获取 userId；否则生成临时 userId
    let userId: string;
    if (token) {
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any
        userId = decoded.userId || fallbackUserId || `user_${Date.now()}`
      } catch (error) {
        // token 无效时生成临时 userId
        userId = fallbackUserId || `user_${Date.now()}`
      }
    } else {
      userId = fallbackUserId || `user_${Date.now()}`
    }

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
      const shouldUpdateAvatar = Boolean(avatarUrl) && (existingMember as any).avatar_url !== avatarUrl
      const shouldUpdateName = Boolean(memberName) && (existingMember as any).name !== memberName

      if (!shouldUpdateAvatar && !shouldUpdateName) {
        return { group, member: existingMember as Member, isNewMember: false }
      }

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }

      if (shouldUpdateName) {
        payload.name = memberName
      }

      if (shouldUpdateAvatar) {
        payload.avatar_url = avatarUrl
      }

      const { data: updatedMember, error: updateMemberError } = await this.updateMemberProfile(
        (existingMember as any).id,
        payload
      )

      if (updateMemberError) {
        console.error('更新房间成员资料失败:', updateMemberError)
        throw new Error(`更新房间成员资料失败: ${updateMemberError.message}`)
      }

      return { group, member: updatedMember as Member, isNewMember: false }
    }

    // 创建成员
    const { data: memberData, error: memberError } = await this.insertMemberRecord({
      group_id: group.id,
      user_id: userId,
      name: memberName,
      avatar_url: avatarUrl || null,
      total_points: 0
    })

    if (memberError) {
      console.error('加入群组失败:', memberError)
      throw new Error(`加入群组失败: ${memberError.message}`)
    }
    const member = memberData as Member

    return { group, member, isNewMember: true }
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
    return this.attachRoomTotalPoints(groupId, (data || []) as Member[])
  }

  async getGroupInviteCode(groupId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('groups')
      .select('invite_code')
      .eq('id', groupId)
      .maybeSingle()

    if (error) {
      console.error('查询房间邀请码失败:', error)
      return null
    }

    return data?.invite_code || null
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
  ): Promise<{ members: Member[]; record: PointsRecord | null }> {
    // 获取发送者和接收者的当前积分
    const { data: membersData, error: fetchError } = await this.client
      .from('members')
      .select('id, total_points, total_given')
      .in('id', [fromMemberId, toMemberId])

    if (fetchError) {
      console.error('查询成员失败:', fetchError)
      throw new Error(`查询成员失败: ${fetchError.message}`)
    }

    const fromMember = membersData?.find((m: any) => m.id === fromMemberId)
    const toMember = membersData?.find((m: any) => m.id === toMemberId)

    if (!fromMember || !toMember) {
      throw new Error('成员不存在')
    }

    const fromPoints = (fromMember as any).total_points || 0
    const fromGiven = (fromMember as any).total_given || 0
    const toPoints = (toMember as any).total_points || 0

    // 零和博弈规则：不需要检查发送者积分是否足够，直接扣减即可
    // 积分可以为负数

    // 创建积分记录
    const { data: recordData, error: recordError } = await this.client
      .from('points_records')
      .insert({
        group_id: groupId,
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        points,
        reason
      })
      .select()
      .single()

    if (recordError) {
      console.error('创建积分记录失败:', recordError)
      throw new Error(`创建积分记录失败: ${recordError.message}`)
    }

    // 更新接收者积分 (增加)
    const { error: updateToError } = await this.client
      .from('members')
      .update({ 
        total_points: toPoints + points,
        total_received: (toMember as any).total_received + points || points
      })
      .eq('id', toMemberId)

    if (updateToError) {
      console.error('更新接收者积分失败:', updateToError)
      throw new Error(`更新接收者积分失败: ${updateToError.message}`)
    }

    // 更新发送者积分 (扣减)
    const { error: updateFromError } = await this.client
      .from('members')
      .update({ 
        total_points: fromPoints - points,
        total_given: fromGiven + points
      })
      .eq('id', fromMemberId)

    if (updateFromError) {
      console.error('更新发送者积分失败:', updateFromError)
      throw new Error(`更新发送者积分失败: ${updateFromError.message}`)
    }

    // 返回更新后的所有成员
    const { data: members } = await this.client
      .from('members')
      .select('*')
      .eq('group_id', groupId)

    return {
      members: await this.attachRoomTotalPoints(groupId, (members || []) as Member[]),
      record: (recordData || null) as PointsRecord | null
    }
  }

  private async attachRoomTotalPoints(groupId: string, members: Member[]): Promise<Member[]> {
    if (!members.length) {
      return members
    }

    const { data: records, error } = await this.client
      .from('points_records')
      .select('from_member_id, to_member_id, points, reason')
      .eq('group_id', groupId)

    if (error) {
      console.error('query room total points failed:', error)
      return members.map((member) => ({
        ...member,
        room_total_points: 0,
      }))
    }

    const totalMap = new Map<string, number>()
    members.forEach((member) => totalMap.set(member.id, 0))

    ;(records || []).forEach((record: any) => {
      const reason = record?.reason || ''
      if (reason.startsWith(this.revokedReasonPrefix)) {
        return
      }

      const points = Number(record?.points || 0)
      if (!points) {
        return
      }

      if (record?.from_member_id && totalMap.has(record.from_member_id)) {
        totalMap.set(record.from_member_id, (totalMap.get(record.from_member_id) || 0) - points)
      }

      if (record?.to_member_id && totalMap.has(record.to_member_id)) {
        totalMap.set(record.to_member_id, (totalMap.get(record.to_member_id) || 0) + points)
      }
    })

    return members.map((member) => ({
      ...member,
      room_total_points: totalMap.get(member.id) || 0,
    }))
  }

  async revokePointsRecord(groupId: string, recordId: string): Promise<{ members: Member[]; recordId: string }> {
    const { data: record, error: recordError } = await this.client
      .from('points_records')
      .select('*')
      .eq('group_id', groupId)
      .eq('id', recordId)
      .single()

    if (recordError || !record) {
      throw new Error(`未找到积分记录: ${recordError?.message || recordId}`)
    }

    if ((record.reason || '').startsWith(this.revokedReasonPrefix)) {
      throw new Error('这条积分记录已经撤销过了')
    }

    const { data: membersData, error: fetchError } = await this.client
      .from('members')
      .select('id, total_points, total_given, total_received')
      .in('id', [record.from_member_id, record.to_member_id])

    if (fetchError) {
      throw new Error(`查询成员失败: ${fetchError.message}`)
    }

    const fromMember = membersData?.find((member: any) => member.id === record.from_member_id)
    const toMember = membersData?.find((member: any) => member.id === record.to_member_id)

    if (!fromMember || !toMember) {
      throw new Error('成员不存在')
    }

    const fromUpdate = await this.client
      .from('members')
      .update({
        total_points: ((fromMember as any).total_points || 0) + (record.points || 0),
        total_given: Math.max(0, ((fromMember as any).total_given || 0) - (record.points || 0))
      })
      .eq('id', record.from_member_id)

    if (fromUpdate.error) {
      throw new Error(`回滚赠送方积分失败: ${fromUpdate.error.message}`)
    }

    const toUpdate = await this.client
      .from('members')
      .update({
        total_points: ((toMember as any).total_points || 0) - (record.points || 0),
        total_received: Math.max(0, ((toMember as any).total_received || 0) - (record.points || 0))
      })
      .eq('id', record.to_member_id)

    if (toUpdate.error) {
      throw new Error(`回滚接收方积分失败: ${toUpdate.error.message}`)
    }

    const { error: updateRecordError } = await this.client
      .from('points_records')
      .update({
        reason: `${this.revokedReasonPrefix}${record.reason || ''}`
      })
      .eq('id', recordId)

    const deleteError = updateRecordError!
    if (updateRecordError) {
      throw new Error(`删除积分记录失败: ${deleteError.message}`)
    }

    const { data: members } = await this.client
      .from('members')
      .select('*')
      .eq('group_id', groupId)

    return {
      members: await this.attachRoomTotalPoints(groupId, (members || []) as Member[]),
      recordId
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

  // 保存开房历史记录
  async saveUserRoomHistory(token: string, data: { room_name: string; invite_code: string; user_id: string }): Promise<boolean> {
    try {
      // 获取用户ID
      let userId = data.user_id
      if (token) {
        try {
          const decoded = jwt.verify(token, this.jwtSecret) as { userId: string }
          userId = decoded.userId
        } catch (e) {
          // 使用传入的 user_id
        }
      }

      // 查询房间ID
      const { data: groupData, error: groupError } = await this.client
        .from('groups')
        .select('id')
        .eq('invite_code', data.invite_code)
        .single()

      if (groupError || !groupData) {
        console.error('查询房间失败:', groupError)
        return false
      }

      // 插入历史记录
      const { error: insertError } = await this.client
        .from('user_rooms')
        .insert({
          user_id: userId,
          group_id: groupData.id,
          room_name: data.room_name,
          invite_code: data.invite_code
        })

      if (insertError) {
        console.error('保存开房历史失败:', insertError)
        return false
      }

      return true
    } catch (error) {
      console.error('保存开房历史异常:', error)
      return false
    }
  }

  private generateInviteCode(): string {
    // 生成6位纯数字房号
    const code = Math.floor(100000 + Math.random() * 900000).toString()
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

  // 保存或更新对局状态
  async saveGameSession(token: string, data: {
    group_id: string
    room_name: string
    invite_code: string
    participants: any[]
    rounds: any[]
    user_id?: string
  }) {
    try {
      let userId = data.user_id || ''
      if (!userId && token) {
        userId = this.verifyToken(token)
      }
      if (!userId) return null

      const { data: group, error: groupError } = await this.client
        .from('groups')
        .select('creator_id')
        .eq('id', data.group_id)
        .maybeSingle()

      if (groupError || !group) {
        console.error('saveGameSession load group failed:', groupError)
        return null
      }

      const { data: member, error: memberError } = await this.client
        .from('members')
        .select('id')
        .eq('group_id', data.group_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (memberError || !member) {
        console.error('saveGameSession forbidden: user is not group member', {
          group_id: data.group_id,
          invite_code: data.invite_code,
          user_id: userId,
          memberError,
        })
        return null
      }

      // 先查找是否有正在进行中的对局
      const { data: existing, error: existingError } = await this.client
        .from('game_sessions')
        .select('*')
        .eq('group_id', data.group_id)
        .eq('status', 'playing')
        .maybeSingle()

      if (existingError) {
        console.error('saveGameSession query existing session failed:', existingError)
        return null
      }

      const sessionData = {
        group_id: data.group_id,
        room_name: data.room_name,
        invite_code: data.invite_code,
        participants: JSON.stringify(data.participants),
        rounds: JSON.stringify(data.rounds),
        host_id: existing?.host_id || (group as any).creator_id,
        status: 'playing',
        updated_at: new Date().toISOString()
      }

      if (existing) {
        // 更新现有对局
        const { data: updated, error: updateError } = await this.client
          .from('game_sessions')
          .update(sessionData)
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) {
          console.error('saveGameSession update session failed:', updateError)
          return null
        }

        return updated
      } else {
        // 创建新对局
        const { data: created, error: createError } = await this.client
          .from('game_sessions')
          .insert(sessionData)
          .select()
          .single()

        if (createError) {
          console.error('saveGameSession create session failed:', createError)
          return null
        }

        return created
      }
    } catch (error) {
      console.error('保存对局失败:', error)
      return null
    }
  }

  // 获取当前对局状态
  async getCurrentGameSession(token: string, inviteCode: string) {
    try {
      const { data } = await this.client
        .from('game_sessions')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'playing')
        .single()

      if (!data) return null

      return {
        ...data,
        participants: JSON.parse(data.participants || '[]'),
        rounds: JSON.parse(data.rounds || '[]')
      }
    } catch (error) {
      console.error('获取当前对局失败:', error)
      return null
    }
  }

  // 通过房号获取当前对局（无需认证）
  async getCurrentSession(token: string, inviteCode: string) {
    try {
      const { data } = await this.client
        .from('game_sessions')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'playing')
        .single()

      if (!data) return null

      return {
        ...data,
        participants: JSON.parse(data.participants || '[]'),
        rounds: JSON.parse(data.rounds || '[]')
      }
    } catch (error) {
      console.error('获取当前对局失败:', error)
      return null
    }
  }

  // 结束对局并保存到历史
  async finishGame(token: string, data: {
    group_id: string
    invite_code: string
    participants: any[]
    rounds: any[]
    total_rounds: number
  }) {
    try {
      const userId = this.verifyToken(token)
      if (!userId) return null

      // 获取房间信息
      const { data: group } = await this.client
        .from('groups')
        .select('name')
        .eq('id', data.group_id)
        .single()

      // 更新对局状态为已结束
      await this.client
        .from('game_sessions')
        .update({ status: 'finished' })
        .eq('group_id', data.group_id)
        .eq('status', 'playing')

      // 保存到历史记录
      const { data: history } = await this.client
        .from('game_history')
        .insert({
          group_id: data.group_id,
          room_name: group?.name || '房间',
          invite_code: data.invite_code,
          participants: JSON.stringify(data.participants),
          rounds: JSON.stringify(data.rounds),
          total_rounds: data.total_rounds,
          start_time: new Date(Date.now() - data.total_rounds * 60000).toISOString(), // 估算开始时间
          end_time: new Date().toISOString()
        })
        .select()
        .single()

      // 更新成员的累计积分
      for (const p of data.participants) {
        try {
          await this.client.rpc('update_member_total', {
            p_member_id: p.member_id,
            p_points: p.score
          })
        } catch {
          // 如果存储过程不存在，手动更新
          await this.client
            .from('members')
            .update({
              total_points: (p.score || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', p.member_id)
        }
      }

      return history
    } catch (error) {
      console.error('结束对局失败:', error)
      return null
    }
  }

  // 获取对局历史记录
  async getGameHistory(token: string, inviteCode: string) {
    try {
      const { data: history } = await this.client
        .from('game_history')
        .select('*')
        .eq('invite_code', inviteCode)
        .order('created_at', { ascending: false })
        .limit(10)

      return (history || []).map(h => ({
        ...h,
        participants: JSON.parse(h.participants || '[]'),
        rounds: JSON.parse(h.rounds || '[]')
      }))
    } catch (error) {
      console.error('获取对局历史失败:', error)
      return []
    }
  }

  // 获取战绩统计
  async getGameStats(token: string, inviteCode: string) {
    try {
      // 获取最近10局历史
      const { data: history } = await this.client
        .from('game_history')
        .select('*')
        .eq('invite_code', inviteCode)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!history || history.length === 0) {
        return {
          total_games: 0,
          total_rounds: 0,
          participants: [],
          rankings: [],
          fun_facts: []
        }
      }

      // 统计每个玩家的数据
      const statsMap = new Map()
      
      for (const game of history) {
        const participants = JSON.parse(game.participants || '[]')
        for (const p of participants) {
          if (!statsMap.has(p.member_id)) {
            statsMap.set(p.member_id, {
              member_id: p.member_id,
              name: p.name,
              total_score: 0,
              game_count: 0,
              win_count: 0,
              lose_count: 0,
              give_count: 0,
              receive_count: 0
            })
          }
          const stats = statsMap.get(p.member_id)
          stats.total_score += (p.score || 0)
          stats.game_count++
          
          // 判断输赢（分数最高的为赢家）
          const maxScore = Math.max(...participants.map(x => x.score || 0))
          if (p.score === maxScore && maxScore > 0) {
            stats.win_count++
          } else if (p.score < 0) {
            stats.lose_count++
          }
        }
      }

      const participants = Array.from(statsMap.values())
      
      // 按分数排序
      const rankings = [...participants].sort((a, b) => b.total_score - a.total_score)

      // 生成趣味数据
      const funFacts: string[] = []
      if (rankings.length > 0) {
        const topPlayer = rankings[0]
        funFacts.push(`${topPlayer.name}是今晚的大赢家，总积分${topPlayer.total_score > 0 ? '+' : ''}${topPlayer.total_score}分`)
      }
      
      const mostActive = participants.reduce((max, p) => 
        p.game_count > max.game_count ? p : max, participants[0])
      if (mostActive) {
        funFacts.push(`${mostActive.name}最活跃，参与了${mostActive.game_count}局对局`)
      }

      const totalGames = history.length
      const totalRounds = history.reduce((sum, h) => sum + (h.total_rounds || 0), 0)

      return {
        total_games: totalGames,
        total_rounds: totalRounds,
        participants,
        rankings,
        fun_facts: funFacts,
        recent_games: history.map(h => ({
          id: h.id,
          room_name: h.room_name,
          participants: JSON.parse(h.participants || '[]'),
          rounds: JSON.parse(h.rounds || '[]'),
          total_rounds: h.total_rounds,
          created_at: h.created_at
        }))
      }
    } catch (error) {
      console.error('获取战绩统计失败:', error)
      return {
        total_games: 0,
        total_rounds: 0,
        participants: [],
        rankings: [],
        fun_facts: []
      }
    }
  }

  // 删除成员
  async removeMember(groupId: string, memberId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('members')
        .delete()
        .eq('group_id', groupId)
        .eq('id', memberId)

      if (error) {
        console.error('删除成员失败:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('删除成员失败:', error)
      return false
    }
  }
  async finishGameSession(token: string, data: {
    group_id: string
    invite_code: string
    participants: any[]
    rounds: any[]
    total_rounds: number
  }) {
    try {
      const userId = this.verifyToken(token)
      if (!userId) return null

      const { data: group } = await this.client
        .from('groups')
        .select('name')
        .eq('id', data.group_id)
        .single()

      await this.client
        .from('game_sessions')
        .update({
          status: 'finished',
          updated_at: new Date().toISOString()
        })
        .eq('group_id', data.group_id)
        .eq('status', 'playing')

      const { data: history } = await this.client
        .from('game_history')
        .insert({
          group_id: data.group_id,
          room_name: group?.name || '鎴块棿',
          invite_code: data.invite_code,
          participants: JSON.stringify(data.participants),
          rounds: JSON.stringify(data.rounds),
          total_rounds: data.total_rounds,
          start_time: new Date(Date.now() - data.total_rounds * 60000).toISOString(),
          end_time: new Date().toISOString()
        })
        .select()
        .single()

      return history
    } catch (error) {
      console.error('缁撴潫瀵瑰眬澶辫触:', error)
      return null
    }
  }
  async getPointsHistoryView(groupId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('points_records')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询积分记录失败:', error)
      throw new Error(`查询积分记录失败: ${error.message}`)
    }

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

    return (data || []).map((record: any) => {
      const reason = record.reason || ''
      const isRevoked = reason.startsWith(this.revokedReasonPrefix)

      return {
        ...record,
        reason: isRevoked ? reason.replace(this.revokedReasonPrefix, '').trim() : reason,
        is_revoked: isRevoked,
        from_member_name: memberMap.get(record.from_member_id) || '未知',
        to_member_name: memberMap.get(record.to_member_id) || '未知'
      }
    })
  }

  async resetGroupMemberPoints(groupId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('members')
        .update({
          total_points: 0,
          updated_at: new Date().toISOString()
        })
        .eq('group_id', groupId)

      if (error) {
        console.error('resetGroupMemberPoints failed:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('resetGroupMemberPoints exception:', error)
      return false
    }
  }

  async finishGameSessionV2(token: string, data: {
    group_id: string
    invite_code: string
    participants: any[]
    rounds: any[]
    total_rounds: number
    user_id?: string
  }) {
    try {
      let userId = data.user_id || ''
      if (token) {
        try {
          userId = this.verifyToken(token)
        } catch (error) {
          if (!userId) {
            throw error
          }
        }
      }

      if (!userId) {
        return null
      }

      const { data: group, error: groupError } = await this.client
        .from('groups')
        .select('name, creator_id')
        .eq('id', data.group_id)
        .single()

      if (groupError || !group) {
        console.error('查询房间失败:', groupError)
        return null
      }

      if (group.creator_id !== userId) {
        throw new Error('只有房主可以结束对局')
      }

      const { error: sessionError } = await this.client
        .from('game_sessions')
        .update({
          status: 'finished',
          updated_at: new Date().toISOString()
        })
        .eq('group_id', data.group_id)
        .eq('status', 'playing')

      if (sessionError) {
        console.error('更新对局状态失败:', sessionError)
        return null
      }

      const { data: history, error: historyError } = await this.client
        .from('game_history')
        .insert({
          group_id: data.group_id,
          room_name: group.name || '房间',
          invite_code: data.invite_code,
          participants: JSON.stringify(data.participants || []),
          rounds: JSON.stringify(data.rounds || []),
          total_rounds: data.total_rounds,
          start_time: new Date(Date.now() - data.total_rounds * 60000).toISOString(),
          end_time: new Date().toISOString()
        })
        .select()
        .single()

      if (historyError || !history) {
        console.error('写入战绩失败:', historyError)
        return null
      }

      return history
    } catch (error) {
      console.error('结束对局失败:', error)
      return null
    }
  }

  async handleMemberLeave(groupId: string, memberId: string) {
    try {
      const { data: member, error: memberError } = await this.client
        .from('members')
        .select('*')
        .eq('group_id', groupId)
        .eq('id', memberId)
        .single()

      if (memberError || !member) {
        console.error('查询退出成员失败:', memberError)
        return { success: false }
      }

      const { data: group, error: groupError } = await this.client
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (groupError || !group) {
        console.error('查询房间失败:', groupError)
        return { success: false }
      }

      const { data: currentSession } = await this.client
        .from('game_sessions')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'playing')
        .maybeSingle()

      const { error: deleteError } = await this.client
        .from('members')
        .delete()
        .eq('group_id', groupId)
        .eq('id', memberId)

      if (deleteError) {
        console.error('删除成员失败:', deleteError)
        return { success: false }
      }

      const { data: remainingMembers } = await this.client
        .from('members')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })

      const members = (remainingMembers || []) as Member[]
      let nextCreatorId: string | null = null

      if (group.creator_id === member.user_id && members.length > 0) {
        nextCreatorId = members[0].user_id
        await this.client
          .from('groups')
          .update({
            creator_id: nextCreatorId,
            updated_at: new Date().toISOString()
          })
          .eq('id', groupId)
      }

      let updatedSession: any = null
      let abandoned = false

      if (currentSession) {
        const nextParticipants = JSON.parse((currentSession as any).participants || '[]')
          .filter((participant: any) => participant.member_id !== memberId)

        if (nextParticipants.length < 2) {
          abandoned = true
          await this.client
            .from('game_sessions')
            .update({
              status: 'abandoned',
              updated_at: new Date().toISOString()
            })
            .eq('id', (currentSession as any).id)
        } else {
          const nextHostId = nextCreatorId || (currentSession as any).host_id
          const { data: sessionAfterUpdate } = await this.client
            .from('game_sessions')
            .update({
              participants: JSON.stringify(nextParticipants),
              host_id: nextHostId,
              updated_at: new Date().toISOString()
            })
            .eq('id', (currentSession as any).id)
            .select()
            .single()

          if (sessionAfterUpdate) {
            updatedSession = {
              ...sessionAfterUpdate,
              participants: JSON.parse((sessionAfterUpdate as any).participants || '[]'),
              rounds: JSON.parse((sessionAfterUpdate as any).rounds || '[]')
            }
          }
        }
      }

      return {
        success: true,
        members,
        leavingMember: member,
        nextCreatorId,
        abandoned,
        updatedSession
      }
    } catch (error) {
      console.error('处理成员退出失败:', error)
      return { success: false }
    }
  }
}
