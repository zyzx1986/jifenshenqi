import { useEffect, useState } from 'react'
import Taro, { useDidHide, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { Button as NativeButton, ScrollView, Text, View } from '@tarojs/components'
import { Crown, Gift, LogIn, Play, Plus, RefreshCcw, RefreshCw, Square, Users } from 'lucide-react-taro'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { type GameSession, type Member, type Participant, useGroupStore } from '@/stores/group'
import { gameSocket } from '@/utils/gameSocket'
import { getCachedWechatAvatarUrl } from '@/utils/wechatNickname'
import { buildScoreBroadcastText, speakScoreBroadcast } from '@/utils/voice'
import './index.scss'

type RecoverySession = GameSession | null
const MAX_SESSION_ROUNDS = 200

function createGameId(groupId: string) {
  return `${groupId}_${Date.now()}`
}

function buildInitialParticipants(members: Member[]): Participant[] {
  return members.map((member) => ({
    member_id: member.id,
    name: member.name,
    score: 0,
  }))
}

function applyRoundToParticipants(
  participants: Participant[],
  fromMemberId: string,
  toMemberId: string,
  points: number
) {
  return participants.map((participant) => {
    if (participant.member_id === fromMemberId) {
      return { ...participant, score: (participant.score || 0) - points }
    }

    if (participant.member_id === toMemberId) {
      return { ...participant, score: (participant.score || 0) + points }
    }

    return participant
  })
}

function normalizeGameSession(session: any): GameSession {
  return {
    ...session,
    participants: Array.isArray(session?.participants)
      ? session.participants
      : JSON.parse(session?.participants || '[]'),
    rounds: Array.isArray(session?.rounds)
      ? session.rounds
      : JSON.parse(session?.rounds || '[]'),
  }
}

function trimSessionRounds<T>(rounds: T[]): T[] {
  if (rounds.length <= MAX_SESSION_ROUNDS) {
    return rounds
  }

  return rounds.slice(-MAX_SESSION_ROUNDS)
}

function resetMemberScores(nextMembers: Member[]): Member[] {
  return nextMembers.map((member) => ({
    ...member,
    total_points: 0,
  }))
}

function mergeMemberAvatar(
  nextMembers: Member[],
  currentMembers: Member[],
  currentMember: Member | null
): Member[] {
  const avatarMap = new Map<string, string>()

  currentMembers.forEach((member) => {
    if (member.avatar_url) {
      avatarMap.set(member.id, member.avatar_url)
    }
  })

  if (currentMember?.avatar_url) {
    avatarMap.set(currentMember.id, currentMember.avatar_url)
  }

  return nextMembers.map((member) => ({
    ...member,
    avatar_url: member.avatar_url || avatarMap.get(member.id) || '',
  }))
}

export default function Index() {
  const {
    currentGame,
    currentGroup,
    currentMember,
    members,
    setCurrentGame,
    setCurrentGroup,
    setCurrentMember,
    setMembers,
    clearGame,
  } = useGroupStore()

  const [givePoints, setGivePoints] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showGivePanel, setShowGivePanel] = useState(false)
  const [giving, setGiving] = useState(false)
  const [connected, setConnected] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [recoverySession, setRecoverySession] = useState<RecoverySession>(null)
  const [savingGame, setSavingGame] = useState(false)
  const [finishingGame, setFinishingGame] = useState(false)
  const [undoing, setUndoing] = useState(false)

  const hasRoom = Boolean(currentGroup)
  const isRoomHost = Boolean(currentGroup && currentMember && currentGroup.creator_id === currentMember.user_id)

  const getCurrentTokenHeader = () => {
    const token = Taro.getStorageSync('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const syncMembersState = (nextMembers: Member[]) => {
    const mergedMembers = mergeMemberAvatar(nextMembers, members, currentMember)
    setMembers(mergedMembers)

    if (!currentMember) {
      return
    }

    const nextCurrentMember = mergedMembers.find((member) => member.id === currentMember.id)
    if (nextCurrentMember) {
      setCurrentMember({
        ...currentMember,
        ...nextCurrentMember,
      })
    }
  }

  const ensureActiveGameSession = async (options?: { silent?: boolean }) => {
    if (!currentGroup) {
      return false
    }

    try {
      const res = await Network.request({
        url: '/api/groups/game/current',
        method: 'GET',
        data: { invite_code: currentGroup.invite_code },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      if (result?.code === 200 && result?.data) {
        const nextSession = normalizeGameSession(result.data)
        setCurrentGame(nextSession)
        setShowRecovery(false)
        setRecoverySession(null)
        return true
      }
    } catch (error) {
      console.error('confirm active game session failed:', error)
    }

    syncMembersState(resetMemberScores(members))
    clearGame()
    setShowRecovery(false)
    setRecoverySession(null)

    if (!options?.silent) {
      Taro.showToast({ title: '当前对局已结束', icon: 'none' })
    }

    return false
  }

  const saveGameSession = async (session: GameSession) => {
    const res = await Network.request({
      url: '/api/groups/game/save',
      method: 'POST',
      data: {
        group_id: session.group_id,
        room_name: session.room_name,
        invite_code: session.invite_code,
        participants: session.participants,
        rounds: trimSessionRounds(session.rounds),
        user_id: currentMember?.user_id,
      },
      header: getCurrentTokenHeader(),
    })

    const result = res.data as any
    console.log('[index] saveGameSession:response', {
      code: result?.code,
      message: result?.message,
      hasSession: Boolean(result?.data),
      sessionId: result?.data?.id,
    })

    if (result?.code !== 200 || !result?.data) {
      throw new Error(result?.message || 'save game session failed')
    }
  }

  const loadMembers = async () => {
    if (!currentGroup) {
      return
    }

    try {
      const res = await Network.request({
        url: '/api/groups/members',
        method: 'GET',
        data: { group_id: currentGroup.id },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      if (result.code === 200 && Array.isArray(result.data)) {
        syncMembersState(result.data)
      }
    } catch (error) {
      console.error('加载成员失败:', error)
    }
  }

  const syncCurrentSessionState = async (options?: { skipWhenCurrentGameReady?: boolean }) => {
    if (!currentGroup) {
      return
    }

    if (options?.skipWhenCurrentGameReady && currentGame?.invite_code === currentGroup.invite_code) {
      return
    }

    try {
      console.log('[index] syncCurrentSessionState:start', {
        inviteCode: currentGroup.invite_code,
        isRoomHost,
        hasCurrentGame: Boolean(currentGame),
        skipWhenCurrentGameReady: Boolean(options?.skipWhenCurrentGameReady),
      })

      const res = await Network.request({
        url: '/api/groups/game/current',
        method: 'GET',
        data: { invite_code: currentGroup.invite_code },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      console.log('[index] syncCurrentSessionState:result', {
        code: result?.code,
        hasSession: Boolean(result?.data),
        sessionId: result?.data?.id,
      })
      if (result.code === 200 && result.data) {
        const nextSession = normalizeGameSession(result.data)
        if (isRoomHost) {
          if (!currentGame || currentGame.invite_code !== currentGroup.invite_code) {
            console.log('[index] syncCurrentSessionState:host-recovery', {
              sessionId: nextSession.id,
            })
            setRecoverySession(nextSession)
            setShowRecovery(true)
          }
        } else {
          console.log('[index] syncCurrentSessionState:setCurrentGame', {
            sessionId: nextSession.id,
            rounds: nextSession.rounds.length,
          })
          setCurrentGame(nextSession)
          setRecoverySession(null)
          setShowRecovery(false)
        }
      } else {
        if (isRoomHost) {
          console.log('[index] syncCurrentSessionState:host-no-session')
          setRecoverySession(null)
          setShowRecovery(false)
        } else if (currentGame?.invite_code === currentGroup.invite_code) {
          console.log('[index] syncCurrentSessionState:clearCurrentGame')
          syncMembersState(resetMemberScores(members))
          clearGame()
        }
      }
    } catch (error) {
      console.error('检查恢复对局失败:', error)
    }
  }

  const connectWebSocket = () => {
    if (!currentGroup || !currentMember || gameSocket.isConnected()) {
      return
    }

    gameSocket.connect({
      roomId: currentGroup.invite_code,
      memberId: currentMember.id,
      memberName: currentMember.name,
      userId: Taro.getStorageSync('userId') || '',
      avatarUrl: currentMember.avatar_url || getCachedWechatAvatarUrl(),
    })
    setConnected(true)
  }

  useEffect(() => {
    const savedGroup = Taro.getStorageSync('currentGroup')
    const savedMember = Taro.getStorageSync('currentMember') as Member | null

    if (savedGroup && !currentGroup) {
      setCurrentGroup(savedGroup)
    }

    if (savedMember && !currentMember) {
      setCurrentMember(savedMember)
    }
  }, [])

  useEffect(() => {
    if (!currentGroup || !currentMember) {
      return
    }

    const handleRoomState = (data: any) => {
      console.log('[index] roomState', {
        memberCount: Array.isArray(data?.members) ? data.members.length : -1,
        hasCurrentGame: Boolean(data?.currentGame),
        sessionId: data?.currentGame?.id,
      })
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      }

      if (data?.currentGame) {
        setCurrentGame(normalizeGameSession(data.currentGame))
        setShowRecovery(false)
        setRecoverySession(null)
      } else if (currentGame) {
        const nextMembers: Member[] = Array.isArray(data?.members) ? data.members : members
        syncMembersState(resetMemberScores(nextMembers))
        clearGame()
      }
    }

    const handleMemberJoined = (data: any) => {
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      }
    }

    const handleMemberLeft = (data: any) => {
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      }
    }

    const handlePointsUpdated = (data: any) => {
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      }

      if (data?.reversed) {
        return
      }

      const latestMembers: Member[] = Array.isArray(data?.members) ? data.members : members
      const fromMember = latestMembers.find((member) => member.id === data?.fromMemberId)
      const toMember = latestMembers.find((member) => member.id === data?.toMemberId)
      const points = Number(data?.points || 0)

      if (!fromMember?.name || !toMember?.name || points <= 0) {
        return
      }

      void speakScoreBroadcast(buildScoreBroadcastText(fromMember.name, toMember.name, points))
    }

    const handleGameSessionUpdated = (data: any) => {
      console.log('[index] gameSessionUpdated', {
        hasSession: Boolean(data?.session),
        sessionId: data?.session?.id,
        started: Boolean(data?.started),
      })
      if (!data?.session) {
        return
      }

      const nextSession = normalizeGameSession(data.session)
      setCurrentGame(nextSession)
      setShowRecovery(false)
      setRecoverySession(null)

      if (data.started) {
        Taro.showToast({ title: '房主已经开始对局', icon: 'none' })
      }
    }

    const handleGameEnded = (data: any) => {
      const nextMembers: Member[] = Array.isArray(data?.members) ? data.members : members
      syncMembersState(resetMemberScores(nextMembers))
      clearGame()
      setShowRecovery(false)
      setRecoverySession(null)
      Taro.showToast({ title: '对局已结束', icon: 'none' })
    }

    const handleHostTransferred = (data: any) => {
      if (currentGroup && data?.creatorId) {
        const nextGroup = {
          ...currentGroup,
          creator_id: data.creatorId,
        }
        setCurrentGroup(nextGroup)
      }

      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      }

      Taro.showToast({ title: '房主已自动转移', icon: 'none' })
    }

    const handleGameAbandoned = (data: any) => {
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      }

      clearGame()
      setShowRecovery(false)
      setRecoverySession(null)
      Taro.showToast({ title: '人数不足，对局已中止', icon: 'none' })
    }

    gameSocket.on('roomState', handleRoomState)
    gameSocket.on('memberJoined', handleMemberJoined)
    gameSocket.on('memberLeft', handleMemberLeft)
    gameSocket.on('pointsUpdated', handlePointsUpdated)
    gameSocket.on('gameSessionUpdated', handleGameSessionUpdated)
    gameSocket.on('gameEnded', handleGameEnded)
    gameSocket.on('hostTransferred', handleHostTransferred)
    gameSocket.on('gameAbandoned', handleGameAbandoned)

    return () => {
      gameSocket.off('roomState', handleRoomState)
      gameSocket.off('memberJoined', handleMemberJoined)
      gameSocket.off('memberLeft', handleMemberLeft)
      gameSocket.off('pointsUpdated', handlePointsUpdated)
      gameSocket.off('gameSessionUpdated', handleGameSessionUpdated)
      gameSocket.off('gameEnded', handleGameEnded)
      gameSocket.off('hostTransferred', handleHostTransferred)
      gameSocket.off('gameAbandoned', handleGameAbandoned)
    }
  }, [clearGame, currentGame, currentGroup, currentMember, members, setCurrentGame, setCurrentGroup])

  useDidShow(() => {
    if (!currentGroup) {
      return
    }

    connectWebSocket()
    loadMembers()
    syncCurrentSessionState()
  })

  useEffect(() => {
    if (!currentGroup || !currentMember) {
      return
    }

    connectWebSocket()
    void loadMembers()
    void syncCurrentSessionState({ skipWhenCurrentGameReady: true })
  }, [currentGroup?.invite_code, currentMember?.id])

  useEffect(() => {
    if (!currentGroup || !currentMember || !connected) {
      return
    }

    const timer = setInterval(() => {
      void loadMembers()
      void syncCurrentSessionState({ skipWhenCurrentGameReady: true })
    }, 2000)

    return () => clearInterval(timer)
  }, [connected, currentGroup?.invite_code, currentMember?.id])

  useDidHide(() => {
    gameSocket.disconnect()
    setConnected(false)
  })

  useShareAppMessage(() => {
    if (!currentGroup) {
      return {
        title: '积分互赠小程序',
        path: '/pages/join/index',
        imageUrl: '',
      }
    }

    return {
      title: `${currentMember?.name || '我'}邀请你加入「${currentGroup.name}」`,
      path: `/pages/join/index?invite_code=${currentGroup.invite_code}`,
      imageUrl: '',
    }
  })

  const startGame = async () => {
    if (!isRoomHost) {
      Taro.showToast({ title: '只有房主可以开始对局', icon: 'none' })
      return
    }

    if (!currentGroup || !currentMember || members.length === 0) {
      Taro.showToast({ title: '当前房间暂无可开局成员', icon: 'none' })
      return
    }

    setSavingGame(true)
    try {
      const session: GameSession = {
        id: createGameId(currentGroup.id),
        group_id: currentGroup.id,
        room_name: currentGroup.name,
        invite_code: currentGroup.invite_code,
        participants: buildInitialParticipants(members),
        rounds: [],
        host_id: currentMember.user_id,
        status: 'playing',
      }

      console.log('[index] startGame:submit', {
        inviteCode: currentGroup.invite_code,
        participants: session.participants.length,
      })
      await saveGameSession(session)
      console.log('[index] startGame:saveGameSession-done', {
        inviteCode: currentGroup.invite_code,
      })
      setCurrentGame(session)
      setShowRecovery(false)
      setRecoverySession(null)
      Taro.showToast({ title: '对局已开始', icon: 'success' })
    } catch (error) {
      console.error('开始对局失败:', error)
      Taro.showToast({ title: '开始对局失败', icon: 'none' })
    } finally {
      setSavingGame(false)
    }
  }

  const handleRecoverSession = async () => {
    if (!isRoomHost) {
      Taro.showToast({ title: '只有房主可以恢复对局', icon: 'none' })
      return
    }

    if (!currentGroup) {
      return
    }

    setRecovering(true)
    try {
      const res = await Network.request({
        url: '/api/groups/game/current',
        method: 'GET',
        data: { invite_code: currentGroup.invite_code },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      if (result.code === 200 && result.data) {
        setCurrentGame(result.data)
        setRecoverySession(result.data)
        setShowRecovery(false)
        Taro.showToast({ title: '已恢复对局', icon: 'success' })
      } else {
        Taro.showToast({ title: '未找到进行中的对局', icon: 'none' })
      }
    } catch (error) {
      console.error('恢复对局失败:', error)
      Taro.showToast({ title: '恢复失败', icon: 'none' })
    } finally {
      setRecovering(false)
    }
  }

  const finishGame = async () => {
    if (!isRoomHost) {
      Taro.showToast({ title: '只有房主可以结束对局', icon: 'none' })
      return
    }

    if (!currentGame || !currentGroup) {
      return
    }

    setFinishingGame(true)
    try {
      const res = await Network.request({
        url: '/api/groups/game/finish',
        method: 'POST',
        data: {
          group_id: currentGame.group_id,
          invite_code: currentGame.invite_code,
          participants: currentGame.participants,
          rounds: currentGame.rounds,
          total_rounds: currentGame.rounds.length,
          room_name: currentGame.room_name,
          user_id: currentMember?.user_id,
        },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      if (result.code !== 200 || !result.data) {
        throw new Error(result.message || 'finish game failed')
      }

      syncMembersState(resetMemberScores(members))
      clearGame()
      setShowRecovery(false)
      setRecoverySession(null)
      Taro.showToast({ title: '对局已结束', icon: 'success' })
    } catch (error) {
      console.error('结束对局失败:', error)
      Taro.showToast({ title: '结束对局失败', icon: 'none' })
    } finally {
      setFinishingGame(false)
    }
  }

  const handleUndoLastRound = async () => {
    if (!isRoomHost) {
      Taro.showToast({ title: '只有房主可以撤销上一手', icon: 'none' })
      return
    }

    if (!currentGame || currentGame.rounds.length === 0 || !currentGroup) {
      Taro.showToast({ title: '当前没有可撤销的记录', icon: 'none' })
      return
    }

    const lastRound = currentGame.rounds[currentGame.rounds.length - 1]
    if (!lastRound.record_id) {
      Taro.showToast({ title: '这条记录暂不支持撤销', icon: 'none' })
      return
    }

    setUndoing(true)
    try {
      const res = await Network.request({
        url: '/api/points/revoke',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          record_id: lastRound.record_id,
        },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      if (result.code !== 200) {
        throw new Error(result.message || 'revoke points failed')
      }

      const latestMembers: Member[] = Array.isArray(result.data?.members) ? result.data.members : members
      syncMembersState(latestMembers)

      const nextSession: GameSession = {
        ...currentGame,
        participants: applyRoundToParticipants(
          currentGame.participants,
          lastRound.to_id,
          lastRound.from_id,
          lastRound.points
        ),
        rounds: currentGame.rounds.slice(0, -1),
      }

      setCurrentGame(nextSession)
      try {
        await saveGameSession(nextSession)
      } catch (saveError) {
        console.error('保存对局快照失败，但撤销已成功:', saveError)
      }
      Taro.showToast({ title: '已撤销上一手', icon: 'success' })
    } catch (error) {
      console.error('撤销上一手失败:', error)
      Taro.showToast({ title: '撤销失败', icon: 'none' })
    } finally {
      setUndoing(false)
    }
  }

  const copyInviteCode = () => {
    if (!currentGroup?.invite_code) {
      return
    }

    Taro.setClipboardData({
      data: currentGroup.invite_code,
      success: () => {
        Taro.showToast({ title: '邀请码已复制', icon: 'success' })
      },
    })
  }

  const handleGivePoints = async (member: Member) => {
    if (member.id === currentMember?.id) {
      Taro.showToast({ title: '不能给自己赠分', icon: 'none' })
      return
    }

    if (!currentGame) {
      Taro.showToast({ title: '请先开始对局', icon: 'none' })
      return
    }

    const hasActiveSession = await ensureActiveGameSession()
    if (!hasActiveSession) {
      return
    }

    setSelectedMember(member)
    setShowGivePanel(true)
  }

  const handleConfirmGive = async () => {
    if (!selectedMember || !currentGroup || !currentMember || !currentGame) {
      Taro.showToast({ title: '请先开始对局', icon: 'none' })
      return
    }

    const hasActiveSession = await ensureActiveGameSession({ silent: true })
    if (!hasActiveSession) {
      Taro.showToast({ title: '当前对局已结束', icon: 'none' })
      return
    }

    const points = Number.parseInt(givePoints, 10)
    if (Number.isNaN(points) || points <= 0) {
      Taro.showToast({ title: '请输入有效积分', icon: 'none' })
      return
    }

    setGiving(true)
    try {
      const res = await Network.request({
        url: '/api/points/give',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          from_member_id: currentMember.id,
          to_member_id: selectedMember.id,
          points,
          reason: '积分赠送',
        },
        header: getCurrentTokenHeader(),
      })

      const result = res.data as any
      if (result.code !== 200) {
        throw new Error(result.message || 'give points failed')
      }

      const latestMembers: Member[] = Array.isArray(result.data?.members) ? result.data.members : members
      syncMembersState(latestMembers)

      const nextSession: GameSession = {
        ...currentGame,
        participants: applyRoundToParticipants(
          currentGame.participants,
          currentMember.id,
          selectedMember.id,
          points
        ),
        rounds: [
          ...currentGame.rounds,
          {
            record_id: result.data?.record?.id,
            from: currentMember.name,
            from_id: currentMember.id,
            to: selectedMember.name,
            to_id: selectedMember.id,
            points,
            reason: '积分赠送',
            timestamp: Date.now(),
          },
        ],
      }

      setCurrentGame(nextSession)
      try {
        await saveGameSession(nextSession)
      } catch (saveError) {
        console.error('保存对局快照失败，但送分已成功:', saveError)
      }
      setShowGivePanel(false)
      setSelectedMember(null)
      setGivePoints('')
      Taro.showToast({ title: `已赠送 ${points} 积分`, icon: 'none' })
    } catch (error) {
      console.error('给分失败:', error)
      Taro.showToast({ title: '给分失败', icon: 'none' })
    } finally {
      setGiving(false)
    }
  }

  const renderEmptyState = () => (
    <View className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <View className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
        <Users size={48} color="#1890ff" />
      </View>
      <Text className="mb-2 block text-xl font-semibold text-gray-800">还没有房间</Text>
      <Text className="mb-8 block text-center text-sm text-gray-500">
        创建房间或加入好友的房间{'\n'}开始积分互赠
      </Text>
      <View className="w-full max-w-xs">
        <View className="mb-3">
          <Button className="w-full" onClick={() => Taro.navigateTo({ url: '/pages/join/index' })}>
            <Plus size={18} color="#fff" className="mr-2" />
            <Text className="block">创建房间</Text>
          </Button>
        </View>
        <Button variant="outline" className="w-full" onClick={() => Taro.navigateTo({ url: '/pages/join/index' })}>
          <LogIn size={18} color="#1890ff" className="mr-2" />
          <Text className="block">加入房间</Text>
        </Button>
      </View>
    </View>
  )

  const renderGameBanner = () => (
    <Card className="mb-4 border-blue-100 bg-blue-50">
      <CardContent className="p-4">
        <View className="flex items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="block text-sm font-semibold text-blue-700">
              {currentGame ? '当前有进行中的对局' : '当前还没有开始对局'}
            </Text>
            <Text className="mt-1 block text-xs text-blue-600">
              {currentGame ? `当前已记录 ${currentGame.rounds.length} 次给分` : '开始后大家就可以互相给分'}
            </Text>
            {!isRoomHost && (
              <Text className="mt-2 block text-xs text-amber-600">只有房主可以开始、结束和撤销上一手</Text>
            )}
          </View>
          {isRoomHost && currentGame ? (
            <View className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndoLastRound}
                disabled={undoing || currentGame.rounds.length === 0}
              >
                <RefreshCcw size={14} color="#1890ff" className="mr-1" />
                <Text className="block">{undoing ? '撤销中...' : '撤销上一手'}</Text>
              </Button>
              <Button size="sm" onClick={finishGame} disabled={finishingGame}>
                <Square size={14} color="#fff" className="mr-1" />
                <Text className="block">{finishingGame ? '结束中...' : '结束对局'}</Text>
              </Button>
            </View>
          ) : isRoomHost ? (
            <Button size="sm" onClick={startGame} disabled={savingGame}>
              <Play size={14} color="#fff" className="mr-1" />
              <Text className="block">{savingGame ? '创建中...' : '开始对局'}</Text>
            </Button>
          ) : null}
        </View>
      </CardContent>
    </Card>
  )

  const renderRecoveryBanner = () => {
    if (!showRecovery || !recoverySession) {
      return null
    }

    return (
      <View className="fixed bottom-20 left-4 right-4 z-50 rounded-xl bg-white p-4 shadow-lg">
        <Text className="block text-sm font-medium text-gray-800">检测到未结束的对局</Text>
        <Text className="mt-1 block text-xs text-gray-500">
          已记录 {recoverySession.rounds?.length || 0} 次给分
        </Text>
        {isRoomHost ? (
          <View className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={startGame} disabled={savingGame}>
              <Text className="block">{savingGame ? '重开中...' : '重新开局'}</Text>
            </Button>
            <Button size="sm" className="flex-1" onClick={handleRecoverSession} disabled={recovering}>
              <RefreshCw size={14} color="#fff" className="mr-1" />
              <Text className="block">{recovering ? '恢复中...' : '恢复对局'}</Text>
            </Button>
          </View>
        ) : (
          <Text className="mt-3 block text-xs text-amber-600">等待房主决定是否恢复这局对局</Text>
        )}
      </View>
    )
  }

  const renderGivePanel = () => {
    if (!showGivePanel || !selectedMember) {
      return null
    }

    return (
      <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <View className="w-full max-w-sm rounded-2xl bg-white p-6">
          <Text className="mb-1 block text-center text-lg font-semibold text-gray-800">赠送积分</Text>
          <Text className="mb-6 block text-center text-sm text-gray-500">送给 {selectedMember.name}</Text>

          <View className="mb-4 rounded-xl bg-gray-50 px-4 py-3">
            <Text className="mb-1 block text-xs text-gray-400">积分</Text>
            <Text className="block text-3xl font-bold text-blue-600">{givePoints || '0'}</Text>
            <Text className="mt-2 block text-xs text-gray-400">我的总积分: {currentMember?.total_points || 0}</Text>
          </View>

          <View className="mb-4 rounded-xl bg-gray-50 px-4 py-3">
            <Input
              type="number"
              placeholder="输入积分"
              value={givePoints}
              onInput={(event: any) => setGivePoints(event.detail.value || '')}
              className="w-full bg-transparent text-lg"
            />
          </View>

          <View className="mb-4 flex flex-row gap-2">
            {[1, 5, 10, 20].map((amount) => (
              <View key={amount} className="flex-1">
                <Button variant="outline" size="sm" className="w-full" onClick={() => setGivePoints(String(amount))}>
                  <Text className="block">{amount}</Text>
                </Button>
              </View>
            ))}
          </View>

          <View className="flex flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowGivePanel(false)
                setSelectedMember(null)
                setGivePoints('')
              }}
            >
              <Text className="block">取消</Text>
            </Button>
            <Button className="flex-1" onClick={handleConfirmGive} disabled={giving || !givePoints}>
              <Text className="block">{giving ? '赠送中...' : '确认赠送'}</Text>
            </Button>
          </View>
        </View>
      </View>
    )
  }

  const renderRoomContent = () => (
    <View className="flex min-h-screen flex-col bg-gray-50 pb-20">
      <View className="border-b border-gray-100 bg-white p-4">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <View className="mr-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500">
              <Text className="block text-lg font-bold text-white">{currentGroup?.name?.charAt(0) || '房'}</Text>
            </View>
            <View>
              <Text className="block text-lg font-semibold text-gray-800">{currentGroup?.name || '房间'}</Text>
              <Text className="block text-xs text-gray-400">邀请码: {currentGroup?.invite_code || '-'}</Text>
            </View>
          </View>
          <View className="flex items-center">
            <View className={`mr-2 h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Text className="block text-xs text-gray-400">{connected ? '已连接' : '未连接'}</Text>
          </View>
        </View>
        <View className="mt-4 w-full">
          {Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? (
            <NativeButton openType="share" className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
              <View className="flex items-center justify-center">
                <Users size={20} color="#1890ff" className="mr-2" />
                <Text className="block text-base font-semibold text-blue-600">邀请好友加入</Text>
              </View>
              <Text className="mt-1 block text-center text-xs text-blue-500">
                分享房间邀请码给朋友，一起开始对局
              </Text>
            </NativeButton>
          ) : (
            <Button className="w-full rounded-2xl border border-blue-200 bg-blue-50 py-4" onClick={copyInviteCode}>
              <View className="flex items-center justify-center">
                <Users size={20} color="#1890ff" className="mr-2" />
                <Text className="block text-base font-semibold text-blue-600">复制邀请码</Text>
              </View>
              <Text className="mt-1 block text-center text-xs text-blue-500">
                当前邀请码：{currentGroup?.invite_code}
              </Text>
            </Button>
          )}
        </View>
      </View>

      <ScrollView scrollY className="flex-1 px-4 py-4">
        {renderGameBanner()}
        <View className="space-y-3">
          {members.map((member) => {
            const memberIsHost = currentGroup?.creator_id === member.user_id

            return (
              <Card key={member.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <View className="flex items-center">
                    <Avatar className="mr-3 h-12 w-12">
                      <AvatarImage src={member.avatar_url || ''} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Text className="block text-lg font-semibold">
                          {member.name?.charAt(0) || member.name?.slice(0, 2) || '?'}
                        </Text>
                      </AvatarFallback>
                    </Avatar>

                    <View className="flex-1">
                      <View className="flex items-center">
                        <Text className="block text-base font-medium text-gray-800">{member.name}</Text>
                        {member.id === currentMember?.id && (
                          <View className="ml-2 rounded bg-blue-100 px-2 py-1">
                            <Text className="block text-xs text-blue-600">我</Text>
                          </View>
                        )}
                        {memberIsHost && <Crown size={14} color="#f59e0b" className="ml-1" />}
                      </View>
                      <Text className="mt-2 block text-xs text-gray-400">累计总积分</Text>
                      <Text
                        className={`block text-2xl font-bold ${
                          member.total_points > 0
                            ? 'text-green-600'
                            : member.total_points < 0
                              ? 'text-red-500'
                              : 'text-blue-600'
                        }`}
                      >
                        {member.total_points > 0 ? '+' : ''}
                        {member.total_points || 0}
                      </Text>
                    </View>

                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center"
                      onClick={() => handleGivePoints(member)}
                      disabled={member.id === currentMember?.id || !currentGame}
                    >
                      <Gift size={14} color="#1890ff" className="mr-1" />
                      <Text className="block text-sm">送积分</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            )
          })}
        </View>
      </ScrollView>

      {renderRecoveryBanner()}
      {renderGivePanel()}
    </View>
  )

  return hasRoom ? renderRoomContent() : renderEmptyState()
}
