import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow, showToast, navigateTo } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGroupStore } from '@/stores/group'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import { Users, Share2, Gamepad2, History, ArrowLeft, Trophy } from 'lucide-react-taro'
import './index.scss'

interface Member {
  id: string
  name: string
  total_points: number
  group_id: string
  user_id: string
}

const IndexPage = () => {
  const { 
    currentGroup, 
    currentMember, 
    members, 
    currentGame,
    setMembers, 
    updateMember,
    setCurrentGame,
    updateGameParticipant,
    addGameRound,
    clearGame
  } = useGroupStore()
  
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [showEndGameDialog, setShowEndGameDialog] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [savedGame, setSavedGame] = useState<any>(null)

  // 加载成员列表
  const loadMembers = async () => {
    if (!currentGroup) return

    setLoading(true)
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/members',
        method: 'GET',
        data: { group_id: currentGroup.id },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      console.log('加载成员列表:', res.data)
      const memberList = res.data?.data || []
      setMembers(memberList)
      
      // 检查是否有未保存的对局
      if (memberList.length > 0 && !currentGame) {
        checkForSavedGame()
      }
    } catch (error) {
      console.error('加载成员失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 检查是否有未保存的对局
  const checkForSavedGame = async () => {
    if (!currentGroup) return
    
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/game/current',
        method: 'GET',
        data: { invite_code: currentGroup.invite_code },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (res.data?.data) {
        const gameData = res.data.data
        if (gameData.participants && gameData.participants.length > 0) {
          setSavedGame(gameData)
          setShowRestoreDialog(true)
        }
      }
    } catch (error) {
      console.error('检查未保存对局失败:', error)
    }
  }

  // 恢复对局
  const restoreGame = () => {
    if (savedGame) {
      setCurrentGame(savedGame)
      setShowRestoreDialog(false)
      showToast({ title: '已恢复上局对局', icon: 'success' })
    }
  }

  // 开始新对局
  const startNewGame = () => {
    // 初始化对局参与者（基于当前成员）
    const participants = members.map(m => ({
      member_id: m.id,
      name: m.name,
      score: 0
    }))
    
    setCurrentGame({
      id: '',
      group_id: currentGroup?.id || '',
      room_name: currentGroup?.name || '',
      invite_code: currentGroup?.invite_code || '',
      participants,
      rounds: [],
      host_id: currentMember?.id || '',
      status: 'playing'
    })
    setShowRestoreDialog(false)
    showToast({ title: '开始新对局', icon: 'success' })
  }

  // 保存当前对局状态
  const saveGameState = async () => {
    if (!currentGroup || !currentGame) return
    
    try {
      const token = Taro.getStorageSync('token')
      await Network.request({
        url: '/api/groups/game/save',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          room_name: currentGroup.name,
          invite_code: currentGroup.invite_code,
          participants: currentGame.participants,
          rounds: currentGame.rounds
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
    } catch (error) {
      console.error('保存对局状态失败:', error)
    }
  }

  // 给分
  const handleGivePoints = () => {
    if (!selectedMember) return

    const pointsNum = parseInt(points)
    if (!pointsNum || pointsNum === 0) {
      showToast({ title: '请输入有效积分', icon: 'none' })
      return
    }

    if (!reason.trim()) {
      showToast({ title: '请输入原因', icon: 'none' })
      return
    }

    givePoints(selectedMember.id, pointsNum, reason)
  }

  const givePoints = async (toMemberId: string, pointsNum: number, reasonText: string) => {
    if (!currentGroup || !currentMember) return

    try {
      const token = Taro.getStorageSync('token')
      await Network.request({
        url: '/api/points/give',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          from_member_id: currentMember.id,
          to_member_id: toMemberId,
          points: pointsNum,
          reason: reasonText
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      // 更新本地状态
      updateMember(toMemberId, pointsNum)
      
      // 如果有进行中的对局，更新对局状态
      if (currentGame) {
        // 更新参与者分数
        updateGameParticipant(toMemberId, pointsNum)
        
        // 添加对局记录
        const toMember = members.find(m => m.id === toMemberId)
        addGameRound({
          from: currentMember.name,
          from_id: currentMember.id,
          to: toMember?.name || '',
          to_id: toMemberId,
          points: pointsNum,
          reason: reasonText,
          timestamp: Date.now()
        })
        
        // 保存对局状态
        saveGameState()
      }

      showToast({ title: '给分成功', icon: 'success' })
      setShowDialog(false)
      setPoints('')
      setReason('')
      setSelectedMember(null)
    } catch (error) {
      console.error('给分失败:', error)
      showToast({ title: '给分失败', icon: 'none' })
    }
  }

  // 结束对局
  const endGame = async () => {
    if (!currentGroup || !currentGame) return

    try {
      const token = Taro.getStorageSync('token')
      await Network.request({
        url: '/api/groups/game/finish',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          invite_code: currentGroup.invite_code,
          participants: currentGame.participants,
          rounds: currentGame.rounds,
          total_rounds: currentGame.rounds.length
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      // 重新加载成员积分
      loadMembers()
      clearGame()
      
      showToast({ title: '对局已保存到战绩', icon: 'success' })
      setShowEndGameDialog(false)
    } catch (error) {
      console.error('结束对局失败:', error)
      showToast({ title: '结束对局失败', icon: 'none' })
    }
  }

  // 分享战绩海报
  const shareGameResult = () => {
    if (!currentGame) return
    
    // 生成战绩文本
    const sortedParticipants = [...currentGame.participants].sort((a, b) => (b.score || 0) - (a.score || 0))
    const topPlayer = sortedParticipants[0]
    
    let shareText = `🏆 ${currentGroup?.name || '房间'} 战绩\n\n`
    shareText += `📊 总给分次数: ${currentGame.rounds.length}\n`
    shareText += `👥 参与人数: ${currentGame.participants.length}\n\n`
    
    sortedParticipants.forEach((p, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
      const score = p.score > 0 ? `+${p.score}` : `${p.score}`
      shareText += `${medal} ${p.name}: ${score}\n`
    })
    
    shareText += `\n🎮 来自积分小程序`
    
    // 使用微信分享
    Taro.setClipboardData({
      data: shareText,
      success: () => {
        showToast({ title: '战绩已复制，快去分享吧', icon: 'success' })
      }
    })
  }

  const openGiveDialog = (member: Member) => {
    if (!currentMember) {
      showToast({ title: '请先设置您的昵称', icon: 'none' })
      return
    }

    if (member.id === currentMember.id) {
      showToast({ title: '不能给自己评分', icon: 'none' })
      return
    }

    setSelectedMember(member)
    setShowDialog(true)
  }

  const handleJoinGroup = () => {
    if (!currentGroup) {
      navigateTo({ url: '/pages/join/index' })
    } else {
      navigateTo({ url: '/pages/profile/index' })
    }
  }

  useDidShow(() => {
    if (currentGroup) {
      loadMembers()
    }
  })

  if (!currentGroup) {
    return (
      <View className='page-container'>
        <View className='empty-state'>
          <Users size={64} color='#ccc' />
          <Text className='block text-lg font-semibold text-gray-900 mt-4 mb-2'>
            还未加入房间
          </Text>
          <Text className='block text-sm text-gray-500 mb-6'>
            加入或开房后开始积分管理
          </Text>
          <Button onClick={handleJoinGroup}>
            加入/开房
          </Button>
        </View>
      </View>
    )
  }

  // 计算当前对局排名
  const sortedParticipants = currentGame 
    ? [...currentGame.participants].sort((a, b) => (b.score || 0) - (a.score || 0))
    : []

  return (
    <ScrollView className='page-container' scrollY>
      {/* 顶部房间信息和对局状态 */}
      <View className='room-header'>
        <View className='room-info'>
          <Text className='block text-lg font-semibold text-gray-900'>
            {currentGroup.name}
          </Text>
          <Text className='block text-sm text-gray-500'>
            房号: {currentGroup.invite_code}
          </Text>
        </View>
        
        {currentGame && (
          <View className='game-actions'>
            <Button 
              size='sm' 
              variant='outline'
              onClick={() => setShowEndGameDialog(true)}
            >
              <Gamepad2 size={16} />
              <Text className='ml-1'>结束</Text>
            </Button>
          </View>
        )}
      </View>

      {/* 对局概览 */}
      {currentGame && (
        <View className='game-overview'>
          <View className='overview-stat'>
            <Text className='block text-xl font-bold text-primary'>
              {currentGame.rounds.length}
            </Text>
            <Text className='block text-xs text-gray-500'>给分次数</Text>
          </View>
          <View className='overview-divider' />
          <View className='overview-stat'>
            <Text className='block text-xl font-bold text-primary'>
              {currentGame.participants.length}
            </Text>
            <Text className='block text-xs text-gray-500'>参与人数</Text>
          </View>
          <View className='overview-divider' />
          <View className='overview-stat'>
            <Trophy size={24} color='#f59e0b' />
            <Text className='block text-sm mt-1'>
              {sortedParticipants[0]?.name || '-'}
            </Text>
          </View>
        </View>
      )}

      {/* 快速开始对局 */}
      {!currentGame && members.length > 0 && (
        <View className='start-game-card'>
          <Text className='block text-base font-semibold mb-3'>开始对局</Text>
          <Text className='block text-sm text-gray-500 mb-4'>
            点击下方按钮开始记录对局，离开后可自动恢复
          </Text>
          <Button onClick={startNewGame}>
            <Gamepad2 size={18} />
            <Text className='ml-2'>开始对局</Text>
          </Button>
        </View>
      )}

      {/* 成员列表 */}
      <View className='section'>
        <Text className='block text-base font-semibold text-gray-900 mb-4'>
          成员列表
        </Text>

        {loading ? (
          <View className='flex items-center justify-center py-12'>
            <Text className='block text-sm text-gray-500'>加载中...</Text>
          </View>
        ) : members.length === 0 ? (
          <View className='flex flex-col items-center justify-center py-12'>
            <Text className='block text-sm text-gray-500'>暂无成员</Text>
          </View>
        ) : (
          <View className='flex flex-col gap-3'>
            {members.map((member) => {
              // 如果有对局，显示对局分数
              const gameParticipant = currentGame?.participants.find(
                p => p.member_id === member.id
              )
              const gameScore = gameParticipant?.score || 0
              
              return (
                <Card key={member.id} className='bg-white'>
                  <CardHeader className='pb-3'>
                    <View className='flex items-center justify-between'>
                      <View className='flex items-center gap-3'>
                        <View className='flex-1'>
                          <CardTitle className='text-base'>{member.name}</CardTitle>
                          {currentMember && member.id === currentMember.id && (
                            <Badge variant='secondary' className='mt-1'>
                              我
                            </Badge>
                          )}
                        </View>
                      </View>
                      <View className='text-right'>
                        {currentGame && gameScore !== 0 && (
                          <Text className={`block text-sm font-medium ${gameScore > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {gameScore > 0 ? '+' : ''}{gameScore}
                          </Text>
                        )}
                        <Badge
                          variant={member.total_points >= 0 ? "default" : "destructive"}
                          className={member.total_points >= 0 ? "bg-blue-500" : "bg-red-500"}
                        >
                          {member.total_points > 0 ? '+' : ''}{member.total_points} 分
                        </Badge>
                      </View>
                    </View>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size='sm'
                      variant='outline'
                      className='w-full'
                      onClick={() => openGiveDialog(member)}
                    >
                      给分
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </View>
        )}
      </View>

      {/* 给分弹窗 */}
      {selectedMember && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <View className='dialog-overlay'>
            <View className='dialog-content'>
              <View className='mb-4'>
                <Text className='block text-lg font-semibold text-gray-900 mb-2'>
                  给 {selectedMember.name} 评分
                </Text>
              </View>

              <View className='mb-4'>
                <Label>积分</Label>
                <Input
                  className='mt-1'
                  type='number'
                  placeholder='输入积分（正数加分，负数减分）'
                  value={points}
                  onInput={(e) => setPoints(e.detail.value)}
                />
              </View>

              <View className='mb-6'>
                <Label>原因</Label>
                <Input
                  className='mt-1'
                  placeholder='输入评分原因'
                  value={reason}
                  onInput={(e) => setReason(e.detail.value)}
                />
              </View>

              <View className='flex gap-3'>
                <Button
                  variant='outline'
                  className='flex-1'
                  onClick={() => setShowDialog(false)}
                >
                  取消
                </Button>
                <Button className='flex-1' onClick={handleGivePoints}>
                  确认
                </Button>
              </View>
            </View>
          </View>
        </Dialog>
      )}

      {/* 结束对局弹窗 */}
      {currentGame && (
        <Dialog open={showEndGameDialog} onOpenChange={setShowEndGameDialog}>
          <View className='dialog-overlay'>
            <View className='dialog-content'>
              <View className='mb-4'>
                <Text className='block text-lg font-semibold text-gray-900 mb-2'>
                  结束对局
                </Text>
                <Text className='block text-sm text-gray-500'>
                  对局结束后将保存到战绩记录
                </Text>
              </View>

              {/* 简要排名 */}
              <View className='game-result-preview mb-4'>
                {sortedParticipants.slice(0, 3).map((p, idx) => (
                  <View key={idx} className='result-item'>
                    <Text className='medal'>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </Text>
                    <Text className='block text-sm ml-2'>{p.name}</Text>
                    <Text className={`score ${(p.score || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {(p.score || 0) > 0 ? '+' : ''}{p.score || 0}
                    </Text>
                  </View>
                ))}
              </View>

              <View className='flex gap-3'>
                <Button
                  variant='outline'
                  className='flex-1'
                  onClick={() => setShowEndGameDialog(false)}
                >
                  继续
                </Button>
                <Button className='flex-1' onClick={endGame}>
                  保存战绩
                </Button>
              </View>
              <Button
                variant='ghost'
                className='w-full mt-2'
                onClick={shareGameResult}
              >
                <Share2 size={16} />
                <Text className='ml-2'>分享战绩</Text>
              </Button>
            </View>
          </View>
        </Dialog>
      )}

      {/* 恢复对局弹窗 */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <View className='dialog-overlay'>
          <View className='dialog-content'>
            <View className='mb-4'>
              <Text className='block text-lg font-semibold text-gray-900 mb-2'>
                发现未结束的对局
              </Text>
              <Text className='block text-sm text-gray-500'>
                是否要恢复上次的对局？
              </Text>
            </View>

            {savedGame && (
              <View className='restore-info mb-4'>
                <Text className='block text-sm text-gray-600'>
                  上局已有 {savedGame.participants?.length || 0} 人参与
                </Text>
                <Text className='block text-sm text-gray-600'>
                  给分记录 {savedGame.rounds?.length || 0} 次
                </Text>
              </View>
            )}

            <View className='flex gap-3'>
              <Button
                variant='outline'
                className='flex-1'
                onClick={startNewGame}
              >
                新对局
              </Button>
              <Button className='flex-1' onClick={restoreGame}>
                恢复对局
              </Button>
            </View>
          </View>
        </View>
      </Dialog>
    </ScrollView>
  )
}

export default IndexPage
