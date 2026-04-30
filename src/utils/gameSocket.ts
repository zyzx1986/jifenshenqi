import Taro from '@tarojs/taro'
import { useGroupStore } from '@/stores/group'

// WebSocket 连接管理
class GameSocket {
  private socket: any = null
  private isConnected = false
  private roomId = ''
  private memberId = ''
  private memberName = ''
  private userId = ''
  private reconnectTimer: number | null = null
  private messageHandlers: Map<string, Function[]> = new Map()

  // 获取 WebSocket URL
  private getWsUrl() {
    // 在开发环境和生产环境使用不同的 URL
    const env = Taro.getEnv()
    if (env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT) {
      // 小程序环境使用 wss
      return `wss://${process.env.PROJECT_DOMAIN || window.location.host}/game`
    }
    // H5 环境
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/game`
  }

  // 连接房间
  connect(options: {
    roomId: string
    memberId: string
    memberName: string
    userId: string
  }) {
    this.roomId = options.roomId
    this.memberId = options.memberId
    this.memberName = options.memberName
    this.userId = options.userId

    // 如果已经连接，先断开
    if (this.socket) {
      this.disconnect()
    }

    const env = Taro.getEnv()
    
    // H5 环境使用原生 WebSocket
    if (env === Taro.ENV_TYPE.WEB) {
      this.connectH5()
    } else {
      // 小程序环境使用 socketTask
      this.connectMiniApp()
    }
  }

  // H5 环境连接
  private connectH5() {
    try {
      this.socket = Taro.connectSocket({
        url: this.getWsUrl(),
        success: () => {
          console.log('[WebSocket] 连接请求已发送')
        },
        fail: (err) => {
          console.error('[WebSocket] 连接失败:', err)
        }
      } as any)

      this.socket.onOpen(() => {
        console.log('[WebSocket] 连接成功')
        this.isConnected = true
        this.joinRoom()
      })

      this.socket.onMessage((res) => {
        this.handleMessage(res.data)
      })

      this.socket.onError((err) => {
        console.error('[WebSocket] 错误:', err)
      })

      this.socket.onClose(() => {
        console.log('[WebSocket] 连接关闭')
        this.isConnected = false
        this.scheduleReconnect()
      })
    } catch (err) {
      console.error('[WebSocket] 创建连接失败:', err)
    }
  }

  // 小程序环境连接
  private connectMiniApp() {
    try {
      const env = Taro.getEnv()
      let url = this.getWsUrl()
      
      // 小程序环境直接使用相对路径
      url = `/game`

      this.socket = Taro.connectSocket({
        url,
        success: () => {
          console.log('[WebSocket] 连接请求已发送')
        },
        fail: (err) => {
          console.error('[WebSocket] 连接失败:', err)
        }
      } as any)

      this.socket.onOpen(() => {
        console.log('[WebSocket] 连接成功')
        this.isConnected = true
        this.joinRoom()
      })

      this.socket.onMessage((res: any) => {
        this.handleMessage(res.data)
      })

      this.socket.onError((err: any) => {
        console.error('[WebSocket] 错误:', err)
      })

      this.socket.onClose(() => {
        console.log('[WebSocket] 连接关闭')
        this.isConnected = false
        this.scheduleReconnect()
      })
    } catch (err) {
      console.error('[WebSocket] 创建连接失败:', err)
    }
  }

  // 加入房间
  private joinRoom() {
    this.send('joinRoom', {
      roomId: this.roomId,
      memberId: this.memberId,
      memberName: this.memberName,
      userId: this.userId
    })
  }

  // 发送消息
  send(event: string, data: any) {
    if (this.socket && this.isConnected) {
      const message = JSON.stringify({ event, data })
      this.socket.send({
        data: message,
        fail: (err: any) => {
          console.error('[WebSocket] 发送消息失败:', err)
        }
      })
    } else {
      console.warn('[WebSocket] 未连接，无法发送消息')
    }
  }

  // 处理消息
  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data)
      console.log('[WebSocket] 收到消息:', message.type, message.data)
      
      const handlers = this.messageHandlers.get(message.type) || []
      handlers.forEach(handler => handler(message.data))
    } catch (err) {
      console.error('[WebSocket] 解析消息失败:', err)
    }
  }

  // 注册消息处理器
  on(event: string, handler: Function) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }
    this.messageHandlers.get(event)!.push(handler)
  }

  // 移除消息处理器
  off(event: string, handler?: Function) {
    if (handler) {
      const handlers = this.messageHandlers.get(event) || []
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    } else {
      this.messageHandlers.delete(event)
    }
  }

  // 断开连接
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.send('leaveRoom', { roomId: this.roomId })
      
      try {
        Taro.closeSocket({
          success: () => {
            console.log('[WebSocket] 主动关闭连接')
          }
        })
      } catch (err) {
        console.error('[WebSocket] 关闭连接失败:', err)
      }
      
      this.socket = null
      this.isConnected = false
    }
  }

  // 发送积分更新
  emitPointUpdate(data: {
    roomId: string
    fromMemberId: string
    toMemberId: string
    points: number
    fromMemberName: string
    toMemberName: string
    currentMembers: any[]
  }) {
    this.send('pointUpdate', data)
  }

  // 发送回合完成
  emitRoundComplete(data: {
    roomId: string
    members: any[]
    roundNumber: number
  }) {
    this.send('roundComplete', data)
  }

  // 发送游戏结束
  emitGameEnd(data: {
    roomId: string
    finalMembers: any[]
    roomName: string
  }) {
    this.send('gameEnd', data)
  }

  // 定时重连
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.roomId && this.memberId) {
        console.log('[WebSocket] 尝试重连...')
        this.connect({
          roomId: this.roomId,
          memberId: this.memberId,
          memberName: this.memberName,
          userId: this.userId
        })
      }
    }, 3000)
  }

  // 检查是否已连接
  isSocketConnected() {
    return this.isConnected
  }
}

// 导出单例
export const gameSocket = new GameSocket()
