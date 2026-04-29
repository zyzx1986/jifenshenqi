import { Controller, Post, Body, Get, Headers } from '@nestjs/common'
import { AuthService, UserInfo } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  async wechatLogin(@Body() body: { code: string }) {
    const { code } = body
    const result = await this.authService.wechatLogin(code)
    return {
      code: 200,
      message: 'success',
      data: result
    }
  }

  @Get('verify')
  async verifyToken(@Headers('authorization') authHeader?: string) {
    const token = authHeader?.replace('Bearer ', '') || ''
    const user: UserInfo = await this.authService.verifyToken(token)
    return {
      code: 200,
      message: 'success',
      data: { user }
    }
  }
}
