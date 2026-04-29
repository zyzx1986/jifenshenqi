import { Injectable } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as jwt from 'jsonwebtoken'

export interface WechatLoginResponse {
  openid: string
  session_key: string
  unionid?: string
}

export interface UserInfo {
  id: string
  openid: string
  nickname: string
  avatar_url?: string
  created_at: string
}

@Injectable()
export class AuthService {
  private supabase: SupabaseClient
  private jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'

    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  // 微信登录
  async wechatLogin(code: string): Promise<{ token: string; user: UserInfo }> {
    try {
      // 在实际项目中，这里应该调用微信服务器接口，用 code 换取 openid 和 session_key
      // 暂时模拟生成一个 openid
      const openid = `wx_user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

      // 查询或创建用户
      const { data: existingUser, error: queryError } = await this.supabase
        .from('users')
        .select('*')
        .eq('openid', openid)
        .single()

      if (queryError && queryError.code !== 'PGRST116') {
        throw new Error('查询用户失败')
      }

      let user: any

      if (existingUser) {
        user = existingUser
      } else {
        // 创建新用户
        const { data: newUser, error: createError } = await this.supabase
          .from('users')
          .insert({
            openid,
            nickname: `用户${openid.substring(-4)}`,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          throw new Error('创建用户失败')
        }
        user = newUser
      }

      // 生成 JWT token
      const token = jwt.sign(
        { userId: user.id, openid: user.openid },
        this.jwtSecret,
        { expiresIn: '30d' }
      )

      return {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          created_at: user.created_at
        }
      }
    } catch (error) {
      console.error('微信登录失败:', error)
      throw new Error('登录失败')
    }
  }

  // 验证 token
  async verifyToken(token: string): Promise<UserInfo> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any

      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single()

      if (error || !user) {
        throw new Error('用户不存在')
      }

      return {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      }
    } catch (error) {
      console.error('验证 token 失败:', error)
      throw new Error('验证失败')
    }
  }
}
