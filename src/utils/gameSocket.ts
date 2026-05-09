import { io, Socket } from 'socket.io-client'

interface GameSocketConfig {
  roomId: string
  memberId: string
  memberName: string
  userId: string
}

type MessageHandler = (data: any) => void

// 获取域名
function getDomain(): string {
  // @ts-ignore
  if (typeof PROJECT_DOMAIN !== 'undefined') {
    // @ts-ignore
    return PROJECT_DOMAIN
  }
  return 'localhost:3000'
}

class GameSocket {
  private socket: Socket | null = null
  private messageHandlers: Map<string, MessageHandler[]> = new Map()
  private config: GameSocketConfig | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isManualDisconnect = false
  private eventsBound = false

  // 获取 WebSocket URL
  private getWsUrl(): string {
    const domain = getDomain()
    
    // H5 环境
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${domain}/game`
    }
    
    // 小程序环境使用 wss
    return `wss://${domain}/game`
  }

  // 绑定所有事件监听器
  private bindEvents() {
    if (!this.socket || this.eventsBound) return
    
    const events = ['roomState', 'memberJoined', 'memberLeft', 'pointsUpdated', 'roundCompleted', 'gameEnded']
    events.forEach(event => {
      this.socket?.on(event, (data: any) => {
        console.log(`[GameSocket] 收到事件: ${event}`, data)
        const handlers = this.messageHandlers.get(event) || []
        handlers.forEach(handler => handler(data))
      })
    })
    
    this.eventsBound = true
  }

  // 连接
  connect(config: GameSocketConfig) {
    this.config = config
    this.isManualDisconnect = false
    this.disconnect()

    try {
      const url = this.getWsUrl()
      console.log('[GameSocket] 正在连接:', url)

      this.socket = io(url, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        query: {
          roomId: config.roomId,
          memberId: config.memberId,
          memberName: config.memberName,
          userId: config.userId
        }
      })

      this.socket.on('connect', () => {
        console.log('[GameSocket] 连接成功')
        this.eventsBound = false
        this.bindEvents()
        this.joinRoom()
      })

      this.socket.on('disconnect', (reason) => {
        console.log('[GameSocket] 连接断开:', reason)
        if (!this.isManualDisconnect) {
          console.log('[GameSocket] 将尝试重新连接...')
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('[GameSocket] 连接错误:', error)
      })
      
      // 连接时立即绑定事件
      if (this.socket.connected) {
        this.bindEvents()
      }

    } catch (err) {
      console.error('[GameSocket] 创建连接失败:', err)
    }
  }

  // 加入房间
  private joinRoom() {
    if (!this.socket || !this.config) return
    
    this.socket.emit('joinRoom', {
      roomId: this.config.roomId,
      memberId: this.config.memberId,
      memberName: this.config.memberName,
      userId: this.config.userId
    }, (response: any) => {
      console.log('[GameSocket] joinRoom 响应:', response)
    })
  }

  // 发送消息
  send(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('[GameSocket] 未连接，无法发送消息')
      return
    }

    console.log(`[GameSocket] 发送事件: ${event}`, data)
    this.socket.emit(event, data, (response: any) => {
      console.log(`[GameSocket] ${event} 响应:`, response)
    })
  }

  // 注册消息处理器
  on(event: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }
    this.messageHandlers.get(event)!.push(handler)
    
    // 如果 socket 已连接，立即绑定事件
    if (this.socket?.connected) {
      this.socket.on(event, (data: any) => {
        console.log(`[GameSocket] 收到事件: ${event}`, data)
        const handlers = this.messageHandlers.get(event) || []
        handlers.forEach(h => h(data))
      })
    }
  }

  // 移除消息处理器
  off(event: string, handler?: MessageHandler) {
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
    this.isManualDisconnect = true
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      try {
        this.socket.emit('leaveRoom', { roomId: this.config?.roomId })
      } catch (e) {
        // 忽略错误
      }
      this.socket.disconnect()
      this.socket = null
    }
    
    this.eventsBound = false
  }

  // 是否已连接
  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

// 导出单例
export const gameSocket = new GameSocket()
export default gameSocket
