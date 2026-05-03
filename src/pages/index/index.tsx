import { useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ShareButton } from '@/components/ui/share-button'
import { Network } from '@/network'
import { 
  Users, ArrowLeft, Gift, Crown, RefreshCw
} from 'lucide-react-taro'
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
    clear
  } = useGroupStore()
  
  const [givePoints, setGivePoints] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [showGivePanel, setShowGivePanel] = useState(false)
  const [giving, setGiving] = useState(false)
  const [connected, setConnected] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recovering, setRecovering] = useState(false)

  // 加载成员列表
  const loadMembers = async () => {
    const savedGroup = Taro.getStorageSync('currentGroup')
    if (!savedGroup) return
    
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/members',
        method: 'GET',
        data: { group_id: savedGroup.id },
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
      // 确保当前成员也在成员列表中
      const existingMembers = useGroupStore.getState().members
      if (!existingMembers.find((m: any) => m.id === savedMember.id)) {
        setMembers([savedMember, ...existingMembers])
      }
    }
  }, [])

  // 页面显示时检查是否需要恢复对局和加载成员
  useDidShow(() => {
    // 先从本地存储获取房间信息
    const savedGroup = Taro.getStorageSync('currentGroup')
    
    // 如果有保存的房间信息，加载成员列表
    if (savedGroup) {
      if (!currentGroup) {
        setCurrentGroup(savedGroup)
      }
      loadMembers()
    }
    
    checkRecovery()
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
        // 找到进行中的对局，显示恢复提示
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
        // 恢复成功，更新成员数据
        setMembers(result.data.members || [])
        
        // 连接 WebSocket
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

  // 连接 WebSocket
  const connectWebSocket = () => {
    if (!currentGroup || !currentMember?.id) return
    
    // 获取当前用户信息
    const myMember = members.find(m => m.id === currentMember?.id)
    
    gameSocket.connect({
      roomId: currentGroup.invite_code,
      memberId: currentMember?.id,
      memberName: myMember?.name || currentMember?.name || '未知',
      userId: Taro.getStorageSync('userId') || ''
    })
    
    // 监听分数更新
    gameSocket.on('pointsUpdated', (data: any) => {
      console.log('收到分数更新:', data)
      setMembers(data.members)
      
      // 如果是自己操作的，显示提示
      if (data.fromMemberId === currentMember?.id) {
        Taro.vibrateShort?.({ type: 'light' })
      }
    })
    
    // 监听成员加入
    gameSocket.on('memberJoined', (data: any) => {
      console.log('成员加入:', data)
      setMembers(data.members)
      Taro.showToast({ 
        title: `${data.memberName} 加入了房间`, 
        icon: 'none',
        duration: 2000 
      })
    })
    
    // 监听成员离开
    gameSocket.on('memberLeft', (data: any) => {
      console.log('成员离开:', data)
      // 从列表中移除
      setMembers(members.filter(m => m.id !== data.memberId))
      Taro.showToast({ 
        title: `${data.memberName} 离开了房间`, 
        icon: 'none',
        duration: 2000 
      })
    })
    
    // 监听回合完成
    gameSocket.on('roundCompleted', (data: any) => {
      console.log('回合完成:', data)
      setMembers(data.members)
    })
    
    setConnected(true)
  }

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      if (currentGroup) {
        gameSocket.off('pointsUpdated')
        gameSocket.off('memberJoined')
        gameSocket.off('memberLeft')
        gameSocket.off('roundCompleted')
      }
    }
  }, [])

  // 页面显示时连接 WebSocket
  useEffect(() => {
    if (currentGroup && currentMember?.id && members.length > 0) {
      connectWebSocket()
    }
    
    return () => {
      if (currentGroup) {
        gameSocket.disconnect()
        setConnected(false)
      }
    }
  }, [currentGroup, currentMember?.id])



  // 初始化加载
  useEffect(() => {
    if (currentGroup) {
      loadMembers()
    }
  }, [currentGroup])

  // 选择给分对象
  const handleSelectMember = (member: any) => {
    if (member.id === currentMember?.id) {
      Taro.showToast({ title: '不能给自己给分', icon: 'none' })
      return
    }
    setSelectedMember(member)
    setShowGivePanel(true)
  }

  // 给分
  const handleGivePoints = async () => {
    if (!selectedMember || !givePoints || !currentGroup) return
    
    const points = parseInt(givePoints)
    if (Number.isNaN(points) || points <= 0) {
      Taro.showToast({ title: '请输入有效分数', icon: 'none' })
      return
    }
    
    setGiving(true)
    try {
      const token = Taro.getStorageSync('token')
      
      const res = await Network.request({
        url: '/api/points/give',
        method: 'POST',
        data: {
          groupId: currentGroup.id,
          fromMemberId: currentMember?.id,
          toMemberId: selectedMember.id,
          points: Number(points) || 0
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      const result = res.data as any
      if (result.code === 200) {
        // 通过 WebSocket 广播给所有成员
        const updatedMembers = result.data.members
        gameSocket.emitPointUpdate({
          roomId: currentGroup.invite_code,
          fromMemberId: currentMember?.id || '',
          toMemberId: selectedMember.id,
          points: points,
          fromMemberName: currentMember?.name || '',
          toMemberName: selectedMember.name,
          currentMembers: updatedMembers
        })
        
        // 更新本地数据
        setMembers(updatedMembers)
        Taro.vibrateShort?.({ type: 'medium' })
        setShowGivePanel(false)
        setGivePoints('')
        setSelectedMember(null)
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

  // 分享配置
  useShareAppMessage(() => {
    const groupToShare = currentGroup
    if (!groupToShare) return {
      title: '加入我的积分房间',
      path: '/pages/join/index'
    }
    
    return {
      title: `${groupToShare.name} - 房号 ${groupToShare.invite_code}`,
      path: `/pages/join/index?invite_code=${groupToShare.invite_code}`
    }
  })

  // 退出房间
  const handleExit = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出当前房间吗？',
      success: (res) => {
        if (res.confirm) {
          gameSocket.disconnect()
          clear()
          Taro.reLaunch({ url: '/pages/join/index' })
        }
      }
    })
  }

  // 跳转到加入/创建页面
  const handleGoJoin = () => {
    Taro.reLaunch({ url: '/pages/join/index' })
  }

  // 获取领先者
  const getLeader = () => {
    if (members.length === 0) return null
    return [...members].sort((a, b) => b.total_points - a.total_points)[0]
  }

  // 如果没有加入房间，显示加入提示
  if (!currentGroup) {
    return (
      <View className="index-page min-h-screen bg-gray-50">
        <View className="flex flex-col items-center justify-center h-screen px-6">
          <View className="text-center">
            <View className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
              <Users size={48} color="#1890ff" />
            </View>
            <Text className="block text-xl font-semibold text-gray-800 mb-2">还未加入房间</Text>
            <Text className="block text-sm text-gray-500 mb-8">加入或开房后开始积分</Text>
            <Button onClick={handleGoJoin} className="w-full max-w-xs">
              <Text className="text-white">加入/开房</Text>
            </Button>
          </View>
        </View>
      </View>
    )
  }

  const leader = getLeader()

  return (
    <View className="index-page min-h-screen bg-gray-50 pb-safe">
      {/* 顶部信息栏 */}
      <View className="bg-white px-4 py-3 shadow-sm">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Text className="text-lg font-semibold text-gray-800">{currentGroup.name}</Text>
            <View className="ml-3 px-2 py-1 bg-blue-50 rounded text-xs text-blue-600">
              房号: {currentGroup.invite_code}
            </View>
            {connected && (
              <View className="ml-2 flex items-center">
                <View className="w-2 h-2 rounded-full bg-green-500" />
                <Text className="text-xs text-green-600 ml-1">在线</Text>
              </View>
            )}
          </View>
          <Button variant="ghost" size="sm" onClick={handleExit}>
            <ArrowLeft size={16} color="#666" />
            <Text className="ml-1">退出</Text>
          </Button>
        </View>
        
        {/* 房间统计 */}
        <View className="flex items-center justify-around mt-3 pt-3 border-t border-gray-100">
          <View className="text-center">
            <Text className="block text-lg font-semibold text-blue-600">{members.length}</Text>
            <Text className="block text-xs text-gray-500">参与人数</Text>
          </View>
          <View className="text-center">
            <Text className="block text-lg font-semibold text-orange-600">
              {members.reduce((sum, m) => sum + (m.total_given || 0), 0)}
            </Text>
            <Text className="block text-xs text-gray-500">总给分数</Text>
          </View>
          <View className="text-center">
            <Text className="block text-lg font-semibold text-purple-600">
              {members.reduce((sum, m) => sum + (m.received_count || 0), 0)}
            </Text>
            <Text className="block text-xs text-gray-500">给分次数</Text>
          </View>
        </View>
      </View>

      {/* 领先者提示 */}
      {leader && leader.id === currentMember?.id && (
        <View className="mx-4 mt-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <View className="flex items-center">
            <Crown size={20} color="#f59e0b" />
            <Text className="ml-2 text-sm font-medium text-orange-700">
              你当前领先！继续保持！
            </Text>
          </View>
        </View>
      )}

      {/* 恢复对局提示 */}
      {showRecovery && (
        <View className="mx-4 mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <View className="flex items-center justify-between">
            <View className="flex items-center">
              <RefreshCw size={20} color="#1890ff" />
              <Text className="ml-2 text-sm text-blue-700">检测到未完成的对局</Text>
            </View>
            <View className="flex">
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-2"
                onClick={handleNewGame}
                disabled={recovering}
              >
                <Text className="text-sm">新对局</Text>
              </Button>
              <Button 
                size="sm" 
                onClick={handleRecoverSession}
              >
                <Text className="text-white text-sm">{recovering ? '恢复中...' : '恢复'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 成员列表 */}
      <ScrollView scrollY className="flex-1 px-4 py-3" style={{ height: 'calc(100vh - 280px)' }}>
        <View className="space-y-3">
          {members.map((member, index) => (
            <Card 
              key={member.id} 
              className={`${member.id === currentMember?.id ? 'border-blue-300 bg-blue-50' : ''}`}
            >
              <CardContent className="p-4">
                <View className="flex items-center justify-between">
                  <View className="flex items-center flex-1">
                    {/* 排名 */}
                    {index < 3 ? (
                      <View className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : 'bg-orange-100'
                      }`}
                      >
                        <Text className={`text-sm font-bold ${
                          index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : 'text-orange-600'
                        }`}
                        >
                          {index + 1}
                        </Text>
                      </View>
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                        <Text className="text-sm font-medium text-gray-500">{index + 1}</Text>
                      </View>
                    )}
                    
                    {/* 用户信息 */}
                    <Avatar className="mr-3">
                      <AvatarFallback className={`${
                        member.id === currentMember?.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}
                      >
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <View className="flex-1">
                      <View className="flex items-center">
                        <Text className="text-base font-medium text-gray-800">
                          {member.name}
                        </Text>
                        {member.id === currentMember?.id && (
                          <Text className="ml-2 text-xs text-blue-600">(我)</Text>
                        )}
                        {member.isHost && (
                          <View className="ml-2 px-2 py-1 bg-orange-100 rounded text-xs text-orange-600">
                            房主
                          </View>
                        )}
                      </View>
                      <Text className="text-xs text-gray-500 mt-1">
                        给过 {member.total_given || 0} 分 · 收到 {member.total_received || 0} 分
                      </Text>
                    </View>
                  </View>
                  
                  {/* 积分和给分按钮 */}
                  <View className="flex items-center">
                    <View className="text-right mr-3">
                      <Text className={`text-xl font-bold ${
                        member.id === currentMember?.id ? 'text-blue-600' : 'text-orange-600'
                      }`}
                      >
                        {member.total_points}
                      </Text>
                      <Text className="text-xs text-gray-500">积分</Text>
                    </View>
                    
                    {member.id !== currentMember?.id && (
                      <Button 
                        size="sm" 
                        onClick={() => handleSelectMember(member)}
                        disabled={giving}
                      >
                        <Gift size={14} color="#666" />
                        <Text className="ml-1 text-white">送分</Text>
                      </Button>
                    )}
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* 底部分享按钮 */}
      <View className="px-4 py-3 bg-white border-t border-gray-200">
        <ShareButton className="w-full">
          <Users size={18} color="#666" />
          <Text className="ml-2">邀请好友加入房间</Text>
        </ShareButton>
      </View>

      {/* 给分弹框 */}
      {showGivePanel && selectedMember && (
        <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <View className="bg-white rounded-2xl w-full max-w-sm p-6">
            <Text className="block text-lg font-semibold text-gray-800 text-center mb-4">
              给 {selectedMember.name} 送分
            </Text>
            
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
              <Input
                type="number"
                placeholder="输入积分数量"
                value={givePoints}
                onInput={(e: any) => setGivePoints(e.detail.value)}
                className="w-full text-center text-2xl font-bold"
                focus
              />
            </View>
            
            <View className="flex gap-3 mb-4">
              {[1, 5, 10, 20].map(num => (
                <View 
                  key={num}
                  className="flex-1 py-2 text-center bg-blue-50 rounded-lg"
                  onClick={() => setGivePoints(num.toString())}
                >
                  <Text className="text-blue-600 font-medium">{num}</Text>
                </View>
              ))}
            </View>
            
            <View className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowGivePanel(false)
                  setGivePoints('')
                  setSelectedMember(null)
                }}
              >
                <Text>取消</Text>
              </Button>
              <Button 
                className="flex-1"
                onClick={handleGivePoints}
                disabled={giving || !givePoints}
              >
                <Text className="text-white">{giving ? '给分中...' : '确认'}</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
