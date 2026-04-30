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
  }) {
    try {
      const userId = this.verifyToken(token)
      if (!userId) return null

      // 先查找是否有正在进行中的对局
      const { data: existing } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('group_id', data.group_id)
        .eq('status', 'playing')
        .single()

      const sessionData = {
        group_id: data.group_id,
        room_name: data.room_name,
        invite_code: data.invite_code,
        participants: JSON.stringify(data.participants),
        rounds: JSON.stringify(data.rounds),
        host_id: userId,
        status: 'playing',
        updated_at: new Date().toISOString()
      }

      if (existing) {
        // 更新现有对局
        const { data: updated } = await supabase
          .from('game_sessions')
          .update(sessionData)
          .eq('id', existing.id)
          .select()
          .single()
        return updated
      } else {
        // 创建新对局
        const { data: created } = await supabase
          .from('game_sessions')
          .insert(sessionData)
          .select()
          .single()
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
      const { data } = await supabase
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
      const { data } = await supabase
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
      const { data: group } = await supabase
        .from('groups')
        .select('name')
        .eq('id', data.group_id)
        .single()

      // 更新对局状态为已结束
      await supabase
        .from('game_sessions')
        .update({ status: 'finished' })
        .eq('group_id', data.group_id)
        .eq('status', 'playing')

      // 保存到历史记录
      const { data: history } = await supabase
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
        await supabase.rpc('update_member_total', {
          p_member_id: p.member_id,
          p_points: p.score
        }).catch(() => {
          // 如果存储过程不存在，手动更新
          supabase
            .from('members')
            .update({
              total_points: (p.score || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', p.member_id)
        })
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
      const { data: history } = await supabase
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
      const { data: history } = await supabase
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
      const funFacts = []
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
}
