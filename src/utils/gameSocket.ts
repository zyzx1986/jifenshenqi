import { io, Socket } from 'socket.io-client'

interface GameSocketConfig {
  roomId: string
  memberId: string
  memberName: string
  userId: string
  avatarUrl?: string
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

  private emitToHandlers(event: string, data: any) {
    console.log(`[GameSocket] received event: ${event}`, data)
    const handlers = this.messageHandlers.get(event) || []
    handlers.forEach((handler) => handler(data))
  }

  private bindEvents() {
    if (!this.socket || this.eventsBound) {
      return
    }

    const events = [
      'roomState',
      'memberJoined',
      'memberLeft',
      'pointsUpdated',
      'roundCompleted',
      'gameEnded',
      'gameSessionUpdated',
      'hostTransferred',
      'gameAbandoned',
    ]

    events.forEach((event) => {
      this.socket?.on(event, (data: any) => {
        this.emitToHandlers(event, data)
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
      console.log('[GameSocket] connecting:', url)

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
          avatarUrl: config.avatarUrl || '',
        },
      })

      this.socket.on('connect', () => {
        console.log('[GameSocket] connected')
        this.eventsBound = false
        this.bindEvents()
        this.joinRoom()
      })

      this.socket.on('disconnect', (reason) => {
        console.log('[GameSocket] disconnected:', reason)
        if (!this.isManualDisconnect) {
          console.log('[GameSocket] will try reconnect automatically')
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('[GameSocket] connect error:', error)
      })

      if (this.socket.connected) {
        this.bindEvents()
      }
    } catch (err) {
      console.error('[GameSocket] create connection failed:', err)
    }
  }

  private joinRoom() {
    if (!this.socket || !this.config) {
      return
    }

    this.socket.emit(
      'joinRoom',
      {
        roomId: this.config.roomId,
        memberId: this.config.memberId,
        memberName: this.config.memberName,
        userId: this.config.userId,
        avatarUrl: this.config.avatarUrl || '',
      },
      (response: any) => {
        console.log('[GameSocket] joinRoom response:', response)
      }
    )
  }

  send(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('[GameSocket] socket is not connected')
      return
    }

    console.log(`[GameSocket] emit event: ${event}`, data)
    this.socket.emit(event, data, (response: any) => {
      console.log(`[GameSocket] ${event} response:`, response)
    })
  }

  on(event: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }

    this.messageHandlers.get(event)!.push(handler)
  }

  off(event: string, handler?: MessageHandler) {
    if (handler) {
      const handlers = this.messageHandlers.get(event) || []
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
      return
    }

    this.messageHandlers.delete(event)
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
