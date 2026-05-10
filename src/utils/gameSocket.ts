import { io, Socket } from 'socket.io-client'

interface GameSocketConfig {
  roomId: string
  memberId: string
  memberName: string
  userId: string
}

type MessageHandler = (data: any) => void

function getDomain(): string {
  // @ts-ignore
  if (typeof PROJECT_WS_BASE !== 'undefined' && PROJECT_WS_BASE) {
    // @ts-ignore
    return PROJECT_WS_BASE
  }
  return 'ws://localhost:3000'
}

class GameSocket {
  private socket: Socket | null = null
  private messageHandlers: Map<string, MessageHandler[]> = new Map()
  private config: GameSocketConfig | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isManualDisconnect = false
  private eventsBound = false

  private getWsUrl(): string {
    const wsBase = getDomain().replace(/\/$/, '')
    if (wsBase.startsWith('ws://') || wsBase.startsWith('wss://')) {
      return `${wsBase}/game`
    }

    if (wsBase.startsWith('http://')) {
      return `${wsBase.replace('http://', 'ws://')}/game`
    }

    if (wsBase.startsWith('https://')) {
      return `${wsBase.replace('https://', 'wss://')}/game`
    }

    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
      return `${protocol}${wsBase}/game`
    }

    return `wss://${wsBase}/game`
  }

  private bindEvents() {
    if (!this.socket || this.eventsBound) return

    const events = ['roomState', 'memberJoined', 'memberLeft', 'pointsUpdated', 'roundCompleted', 'gameEnded', 'gameSessionUpdated', 'hostTransferred', 'gameAbandoned']
    events.forEach((event) => {
      this.socket?.on(event, (data: any) => {
        console.log(`[GameSocket] 收到事件: ${event}`, data)
        const handlers = this.messageHandlers.get(event) || []
        handlers.forEach((handler) => handler(data))
      })
    })

    this.eventsBound = true
  }

  connect(config: GameSocketConfig) {
    this.disconnect()
    this.config = config
    this.isManualDisconnect = false

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
          userId: config.userId,
        },
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

      if (this.socket.connected) {
        this.bindEvents()
      }
    } catch (err) {
      console.error('[GameSocket] 创建连接失败:', err)
    }
  }

  private joinRoom() {
    if (!this.socket || !this.config) return

    this.socket.emit(
      'joinRoom',
      {
        roomId: this.config.roomId,
        memberId: this.config.memberId,
        memberName: this.config.memberName,
        userId: this.config.userId,
      },
      (response: any) => {
        console.log('[GameSocket] joinRoom 响应:', response)
      }
    )
  }

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

  on(event: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }
    this.messageHandlers.get(event)!.push(handler)

    if (this.socket?.connected) {
      this.socket.on(event, (data: any) => {
        console.log(`[GameSocket] 收到事件: ${event}`, data)
        const handlers = this.messageHandlers.get(event) || []
        handlers.forEach((registeredHandler) => registeredHandler(data))
      })
    }
  }

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

  disconnect() {
    this.isManualDisconnect = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.eventsBound = false
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const gameSocket = new GameSocket()
export default gameSocket
