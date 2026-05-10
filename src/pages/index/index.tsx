import { useEffect, useState } from 'react'
import Taro, { useDidHide, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { Button as NativeButton, ScrollView, Text, View } from '@tarojs/components'
import { Crown, Gift, LogIn, Plus, RefreshCw, Users } from 'lucide-react-taro'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useGroupStore } from '@/stores/group'
import { gameSocket } from '@/utils/gameSocket'
import './index.scss'

export default function Index() {
  const {
    currentGroup,
    currentMember,
    members,
    setCurrentGroup,
    setCurrentMember,
    setMembers,
  } = useGroupStore()

  const [givePoints, setGivePoints] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [showGivePanel, setShowGivePanel] = useState(false)
  const [giving, setGiving] = useState(false)
  const [connected, setConnected] = useState(false)
  const [wsInitialized, setWsInitialized] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recovering, setRecovering] = useState(false)

  const hasRoom = !!currentGroup

  const syncMembersState = (nextMembers: any[]) => {
    setMembers(nextMembers)

    if (!currentMember) {
      return
    }

    const nextCurrentMember = nextMembers.find((member: any) => member.id === currentMember.id)
    if (nextCurrentMember) {
      setCurrentMember({
        ...currentMember,
        ...nextCurrentMember,
      })
    }
  }

  const loadMembers = async () => {
    if (!currentGroup) return

    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/members',
        method: 'GET',
        data: { group_id: currentGroup.id },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      console.log('加载成员响应:', result)
      if (result.code === 200 && result.data) {
        syncMembersState(result.data)
      }
    } catch (err) {
      console.error('加载成员失败:', err)
    }
  }

  useEffect(() => {
    const savedGroup = Taro.getStorageSync('currentGroup')
    const savedMember = Taro.getStorageSync('currentMember') as any

    if (savedGroup && !currentGroup) {
      setCurrentGroup(savedGroup)
    }
    if (savedMember && !currentMember) {
      setCurrentMember(savedMember)
    }
  }, [])

  useDidShow(() => {
    const savedGroup = Taro.getStorageSync('currentGroup')

    if (!savedGroup) {
      return
    }

    if (!currentGroup) {
      setCurrentGroup(savedGroup)
    }

    loadMembers()
    checkRecovery()

    if (!wsInitialized) {
      console.log('[Index] 初始化 WebSocket...')
      connectWebSocket()
      setupWebSocketHandlers()
      setWsInitialized(true)
    }
  })

  useDidHide(() => {
    console.log('[Index] 页面隐藏，断开 WebSocket')
    gameSocket.disconnect()
    setWsInitialized(false)
    setConnected(false)
  })

  const setupWebSocketHandlers = () => {
    gameSocket.on('roomState', (data: any) => {
      console.log('[Index] 收到房间状态:', data)
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      } else {
        loadMembers()
      }
    })

    gameSocket.on('memberJoined', (data: any) => {
      console.log('[Index] 收到成员加入通知:', data)
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      } else {
        loadMembers()
      }
      if (data.memberName) {
        Taro.showToast({ title: `${data.memberName} 加入了房间`, icon: 'none' })
      }
    })

    gameSocket.on('memberLeft', (data: any) => {
      console.log('[Index] 收到成员离开通知:', data)
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      } else {
        loadMembers()
      }
      if (data.memberName) {
        Taro.showToast({ title: `${data.memberName} 离开了房间`, icon: 'none' })
      }
    })

    gameSocket.on('pointsUpdated', (data: any) => {
      console.log('[Index] 收到积分更新通知:', data)
      if (Array.isArray(data?.members)) {
        syncMembersState(data.members)
      } else {
        loadMembers()
      }
    })
  }

  const checkRecovery = async () => {
    if (!currentGroup) return

    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/session',
        method: 'GET',
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      if (result.code === 200 && result.data && currentGroup.invite_code === result.data.inviteCode) {
        setShowRecovery(true)
      }
    } catch (err) {
      console.log('检查恢复对局失败:', err)
    }
  }

  const handleRecoverSession = async () => {
    if (!currentGroup) return

    setRecovering(true)
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: `/api/groups/session?inviteCode=${currentGroup.invite_code}`,
        method: 'GET',
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      if (result.code === 200 && result.data) {
        syncMembersState(result.data.members || [])
        connectWebSocket()
      } else {
        Taro.showToast({ title: '未找到进行中的对局', icon: 'none' })
      }
    } catch (err) {
      console.error('恢复对局失败:', err)
      Taro.showToast({ title: '恢复失败', icon: 'none' })
    } finally {
      setRecovering(false)
      setShowRecovery(false)
    }
  }

  const handleNewGame = () => {
    setShowRecovery(false)
  }

  const goToJoinPage = () => {
    Taro.navigateTo({ url: '/pages/join/index' })
  }

  const copyInviteCode = () => {
    if (!currentGroup?.invite_code) return

    Taro.setClipboardData({
      data: currentGroup.invite_code,
      success: () => {
        Taro.showToast({ title: '邀请码已复制', icon: 'success' })
      },
    })
  }

  const connectWebSocket = () => {
    if (!currentGroup || !currentMember) return

    setConnected(true)
    gameSocket.connect({
      roomId: currentGroup.invite_code,
      memberId: currentMember.id,
      memberName: currentMember.name,
      userId: Taro.getStorageSync('userId') || '',
    })
  }

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

  const handleGivePoints = async (member: any) => {
    if (member.id === currentMember?.id) {
      Taro.showToast({ title: '不能给自己给分', icon: 'none' })
      return
    }

    setSelectedMember(member)
    setShowGivePanel(true)
  }

  const handleConfirmGive = async () => {
    if (!selectedMember || !givePoints || !currentGroup) {
      Taro.showToast({ title: '参数不完整', icon: 'none' })
      return
    }

    if (!currentMember) {
      Taro.showToast({ title: '用户未登录', icon: 'none' })
      return
    }

    const points = parseInt(givePoints, 10)
    if (Number.isNaN(points) || points <= 0) {
      Taro.showToast({ title: '请输入有效的积分', icon: 'none' })
      return
    }

    setGiving(true)
    try {
      const token = Taro.getStorageSync('token')
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
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      console.log('给分响应:', result)

      if (result.code === 200) {
        Taro.showToast({ title: `已赠送${points}积分`, icon: 'none' })
        setShowGivePanel(false)
        setGivePoints('')
        setSelectedMember(null)

        if (result.data?.members) {
          syncMembersState(result.data.members)
        } else if (Array.isArray(result.data)) {
          syncMembersState(result.data)
        }
      } else {
        Taro.showToast({ title: result.msg || '给分失败', icon: 'none' })
      }
    } catch (err) {
      console.error('给分失败:', err)
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
      <View className="w-full max-w-xs space-y-3">
        <Button className="w-full" onClick={goToJoinPage}>
          <Plus size={18} color="#fff" className="mr-2" />
          <Text className="block">创建房间</Text>
        </Button>
        <Button variant="outline" className="w-full" onClick={goToJoinPage}>
          <LogIn size={18} color="#1890ff" className="mr-2" />
          <Text className="block">加入房间</Text>
        </Button>
      </View>
    </View>
  )

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
            <NativeButton openType="share" className="w-full rounded border border-gray-300 bg-white text-sm">
              <Text className="block">邀请好友加入</Text>
            </NativeButton>
          ) : (
            <Button className="w-full rounded border border-gray-300 bg-white text-sm" onClick={copyInviteCode}>
              <Text className="block">复制邀请码: {currentGroup?.invite_code}</Text>
            </Button>
          )}
        </View>
      </View>

      <ScrollView scrollY className="flex-1 px-4 py-4">
        <View className="space-y-3">
          {members.map((member: any) => (
            <Card key={member.id} className="overflow-hidden">
              <CardContent className="p-4">
                <View className="flex items-center">
                  <Avatar className="mr-3 h-12 w-12">
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
                        <View className="ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-600">我</View>
                      )}
                      {member.is_creator && <Crown size={14} color="#f59e0b" className="ml-1" />}
                    </View>
                    <Text className="mt-1 block text-sm text-gray-400">积分: {member.total_points || 0}</Text>
                  </View>

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center"
                    onClick={() => handleGivePoints(member)}
                    disabled={member.id === currentMember?.id}
                  >
                    <Gift size={14} color="#1890ff" className="mr-1" />
                    <Text className="block text-sm">送积分</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>

      {showRecovery && (
        <View className="fixed bottom-20 left-4 right-4 z-50 rounded-xl bg-white p-4 shadow-lg">
          <Text className="mb-3 block text-sm text-gray-600">检测到有进行中的对局，是否恢复？</Text>
          <View className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleNewGame}>
              <Text className="block">新对局</Text>
            </Button>
            <Button size="sm" className="flex-1" onClick={handleRecoverSession} disabled={recovering}>
              <RefreshCw size={14} color="#fff" className="mr-1" />
              <Text className="block">{recovering ? '恢复中...' : '恢复对局'}</Text>
            </Button>
          </View>
        </View>
      )}

      {showGivePanel && selectedMember && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <View className="w-full max-w-sm rounded-2xl bg-white p-6">
            <Text className="mb-1 block text-center text-lg font-semibold text-gray-800">赠送积分</Text>
            <Text className="mb-6 block text-center text-sm text-gray-500">送给 {selectedMember.name}</Text>

            <View className="mb-4 rounded-xl bg-gray-50 px-4 py-3">
              <Text className="mb-1 block text-xs text-gray-400">积分</Text>
              <Text className="block text-3xl font-bold text-blue-600">{givePoints || '0'}</Text>
              <Text className="mt-2 block text-xs text-gray-400">当前积分: {currentMember?.total_points || 0}</Text>
            </View>

            <View className="mb-4 rounded-xl bg-gray-50 px-4 py-3">
              <Input
                type="number"
                placeholder="输入积分"
                value={givePoints}
                onInput={(e: any) => setGivePoints(e.detail.value || '')}
                className="w-full bg-transparent text-lg"
              />
            </View>

            <View className="mb-4 flex flex-row gap-2">
              {[1, 5, 10, 20].map((amount) => (
                <View key={amount} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setGivePoints(amount.toString())}>
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
                  setGivePoints('')
                  setSelectedMember(null)
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
      )}
    </View>
  )

  return hasRoom ? renderRoomContent() : renderEmptyState()
}
