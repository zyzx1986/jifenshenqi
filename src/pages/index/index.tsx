import { useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Users, Gift, Crown, RefreshCw, Plus, LogIn } from 'lucide-react-taro'
import { useGroupStore } from '@/stores/group'
import { gameSocket } from '@/utils/gameSocket'
import './index.scss'

export default function Index() {
  const { 
    currentGroup,
    currentMember,
    members, 
    setCurrentGroup,
    setMembers,
    setCurrentMember,
  } = useGroupStore()
  
  const [givePoints, setGivePoints] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [showGivePanel, setShowGivePanel] = useState(false)
  const [giving, setGiving] = useState(false)
  const [connected, setConnected] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recovering, setRecovering] = useState(false)

  // 判断是否有房间
  const hasRoom = !!currentGroup

  // 加载成员列表
  const loadMembers = async () => {
    if (!currentGroup) return
    
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/members',
        method: 'GET',
        data: { group_id: currentGroup.id },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      const result = res.data as any
      console.log('加载成员响应:', result)
      if (result.code === 200 && result.data) {
        setMembers(result.data)
      }
    } catch (err) {
      console.error('加载成员失败:', err)
    }
  }

  // 从本地存储恢复房间信息
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

  // 页面显示时检查是否有房间
  useDidShow(() => {
    const savedGroup = Taro.getStorageSync('currentGroup')
    
    if (savedGroup) {
      if (!currentGroup) {
        setCurrentGroup(savedGroup)
      }
      loadMembers()
      checkRecovery()
      connectWebSocket()
    }
  })

  // 检查是否需要恢复对局
  const checkRecovery = async () => {
    if (!currentGroup) return
    
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: `/api/groups/session`,
        method: 'GET',
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      const result = res.data as any
      if (result.code === 200 && result.data && currentGroup.invite_code === result.data.inviteCode) {
        setShowRecovery(true)
      }
    } catch (err) {
      console.log('检查恢复对局失败:', err)
    }
  }

  // 恢复对局
  const handleRecoverSession = async () => {
    if (!currentGroup) return
    
    setRecovering(true)
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: `/api/groups/session?inviteCode=${currentGroup.invite_code}`,
        method: 'GET',
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      const result = res.data as any
      if (result.code === 200 && result.data) {
        setMembers(result.data.members || [])
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

  // 开始新对局
  const handleNewGame = () => {
    setShowRecovery(false)
  }

  // 跳转去创建/加入房间
  const goToJoinPage = () => {
    Taro.navigateTo({ url: '/pages/join/index' })
  }

  // 连接 WebSocket
  const connectWebSocket = () => {
    if (!currentGroup || !currentMember) return
    
    setConnected(true)
    gameSocket.connect({
      roomId: currentGroup.invite_code,
      memberId: currentMember.id,
      memberName: currentMember.name,
      userId: Taro.getStorageSync('userId') || ''
    })
  }

  // 分享给好友
  useShareAppMessage(() => {
    if (!currentGroup) {
      return {
        title: '积分互赠小程序',
        path: '/pages/join/index',
        imageUrl: ''
      }
    }
    
    return {
      title: `${currentMember?.name || '我'}邀请你加入「${currentGroup.name}」`,
      path: `/pages/join/index?invite_code=${currentGroup.invite_code}`,
      imageUrl: ''
    }
  })

  // 给分
  const handleGivePoints = async (member: any) => {
    if (member.id === currentMember?.id) {
      Taro.showToast({ title: '不能给自己给分', icon: 'none' })
      return
    }
    
    setSelectedMember(member)
    setShowGivePanel(true)
  }

  // 确认给分
  const handleConfirmGive = async () => {
    if (!selectedMember || !givePoints || !currentGroup) return
    
    const points = parseInt(givePoints, 10)
    if (Number.isNaN(points) || points <= 0) {
      Taro.showToast({ title: '请输入有效的积分', icon: 'none' })
      return
    }
    
    setGiving(true)
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/members/points/give',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          from_member_id: currentMember?.id,
          to_member_id: selectedMember.id,
          points: points
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      const result = res.data as any
      console.log('给分响应:', result)
      
      if (result.code === 200) {
        Taro.showToast({ title: `已赠送${points}积分`, icon: 'none' })
        setShowGivePanel(false)
        setGivePoints('')
        setSelectedMember(null)
        
        if (result.data) {
          setMembers(result.data)
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

  // 渲染空状态（没有房间）
  const renderEmptyState = () => (
    <View className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
      <View className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
        <Users size={48} color="#1890ff" />
      </View>
      <Text className="block text-xl font-semibold text-gray-800 mb-2">
        还没有房间
      </Text>
      <Text className="block text-sm text-gray-500 text-center mb-8">
        创建房间或加入好友的房间{'\n'}开始积分互赠
      </Text>
      <View className="w-full max-w-xs space-y-3">
        <Button 
          className="w-full" 
          onClick={goToJoinPage}
        >
          <Plus size={18} color="#fff" className="mr-2" />
          <Text className="block">创建房间</Text>
        </Button>
        <Button 
          variant="outline" 
          className="w-full"
          onClick={goToJoinPage}
        >
          <LogIn size={18} color="#1890ff" className="mr-2" />
          <Text className="block">加入房间</Text>
        </Button>
      </View>
    </View>
  )

  // 渲染房间成员列表
  const renderRoomContent = () => (
    <View className="flex flex-col min-h-screen bg-gray-50 pb-20">
      {/* 房间信息卡片 */}
      <View className="p-4 bg-white border-b border-gray-100">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <View className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mr-3">
              <Text className="block text-white font-bold text-lg">
                {currentGroup?.name?.charAt(0) || '房'}
              </Text>
            </View>
            <View>
              <Text className="block text-lg font-semibold text-gray-800">
                {currentGroup?.name || '房间'}
              </Text>
              <Text className="block text-xs text-gray-400">
                邀请码: {currentGroup?.invite_code || '-'}
              </Text>
            </View>
          </View>
          <View className="flex items-center">
            <View className={`w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Text className="block text-xs text-gray-400">
              {connected ? '已连接' : '未连接'}
            </Text>
          </View>
        </View>
        
        {/* 分享按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          open-type="share"
        >
          <Text className="block">邀请好友加入</Text>
        </Button>
      </View>

      {/* 成员列表 */}
      <ScrollView scrollY className="flex-1 px-4 py-4">
        <View className="space-y-3">
          {members.map((member: any) => (
            <Card key={member.id} className="overflow-hidden">
              <CardContent className="p-4">
                <View className="flex items-center">
                  <Avatar className="w-12 h-12 mr-3">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      <Text className="block text-lg font-semibold">
                        {member.name?.charAt(0) || member.name?.slice(0, 2) || '?'}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  
                  <View className="flex-1">
                    <View className="flex items-center">
                      <Text className="block text-base font-medium text-gray-800">
                        {member.name}
                      </Text>
                      {member.id === currentMember?.id && (
                        <View className="ml-2 px-2 py-1 bg-blue-100 rounded text-xs text-blue-600">
                          我
                        </View>
                      )}
                      {member.is_creator && (
                        <Crown size={14} color="#f59e0b" className="ml-1" />
                      )}
                    </View>
                    <Text className="block text-sm text-gray-400 mt-1">
                      积分: {member.total_points || 0}
                    </Text>
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

      {/* 恢复对局提示 */}
      {showRecovery && (
        <View className="fixed bottom-20 left-4 right-4 bg-white rounded-xl shadow-lg p-4 z-50">
          <Text className="block text-sm text-gray-600 mb-3">
            检测到有进行中的对局，是否恢复？
          </Text>
          <View className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={handleNewGame}
            >
              <Text className="block">新对局</Text>
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={handleRecoverSession}
              disabled={recovering}
            >
              <RefreshCw size={14} color="#fff" className="mr-1" />
              <Text className="block">{recovering ? '恢复中...' : '恢复对局'}</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 给分弹窗 */}
      {showGivePanel && selectedMember && (
        <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <View className="bg-white rounded-2xl w-full max-w-sm p-6">
            <Text className="block text-lg font-semibold text-gray-800 text-center mb-1">
              赠送积分
            </Text>
            <Text className="block text-sm text-gray-500 text-center mb-6">
              送给 {selectedMember.name}
            </Text>
            
            {/* 积分输入 */}
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
              <Text className="block text-xs text-gray-400 mb-1">积分</Text>
              <Text className="block text-3xl font-bold text-blue-600">
                {givePoints || '0'}
              </Text>
              <Text className="block text-xs text-gray-400 mt-2">
                当前积分: {currentMember?.total_points || 0}
              </Text>
            </View>
            
            {/* 输入框 */}
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
              <Input
                type="number"
                placeholder="输入积分"
                value={givePoints}
                onInput={(e: any) => setGivePoints(e.detail.value || '')}
                className="w-full bg-transparent text-lg"
              />
            </View>
            
            {/* 快捷金额按钮 */}
            <View className="flex flex-row gap-2 mb-4">
              {[1, 5, 10, 20].map((amount) => (
                <View key={amount} className="flex-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={() => setGivePoints(amount.toString())}
                  >
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
              <Button 
                className="flex-1"
                onClick={handleConfirmGive}
                disabled={giving || !givePoints}
              >
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
