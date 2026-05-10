import { View, Text } from '@tarojs/components'
import Taro, { useLoad, useDidHide, useDidShow, showToast } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useGroupStore, PointsRecord } from '@/stores/group'
import { Network } from '@/network'
import { gameSocket } from '@/utils/gameSocket'

const HistoryPage = () => {
  const { currentGroup, currentMember } = useGroupStore()
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<PointsRecord[]>([])
  const [showRevoked, setShowRevoked] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  const loadRecords = async () => {
    if (!currentGroup || !currentMember) return

    setLoading(true)
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/points/history',
        method: 'GET',
        data: { group_id: currentGroup.id },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      console.log('加载积分记录:', res.data)
      setRecords(res.data?.data || [])
    } catch (error) {
      console.error('加载积分记录失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return '今天'
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  useLoad(() => {
    console.log('History page loaded.')
  })

  useDidShow(() => {
    if (currentGroup && currentMember) {
      loadRecords()
      gameSocket.connect({
        roomId: currentGroup.invite_code,
        memberId: currentMember.id,
        memberName: currentMember.name,
        userId: Taro.getStorageSync('userId') || '',
      })
    }
  })

  useDidHide(() => {
    gameSocket.disconnect()
    setSyncMessage('')
  })

  useEffect(() => {
    if (!currentGroup || !currentMember) {
      return
    }

    const handlePointsUpdated = async (data: any) => {
      await loadRecords()
      setSyncMessage(data?.reversed ? '刚刚同步了一条撤销记录' : '刚刚同步了一条积分变更')
    }

    const handleGameEnded = async () => {
      await loadRecords()
      setSyncMessage('对局已结束，明细已刷新')
    }

    gameSocket.on('pointsUpdated', handlePointsUpdated)
    gameSocket.on('gameEnded', handleGameEnded)

    return () => {
      gameSocket.off('pointsUpdated', handlePointsUpdated)
      gameSocket.off('gameEnded', handleGameEnded)
    }
  }, [currentGroup, currentMember])

  useEffect(() => {
    if (!syncMessage) {
      return
    }

    const timer = setTimeout(() => {
      setSyncMessage('')
    }, 2500)

    return () => clearTimeout(timer)
  }, [syncMessage])

  const activeRecords = records.filter((record) => !record.is_revoked)
  const revokedRecords = records.filter((record) => record.is_revoked)
  const displayRecords = showRevoked ? records : activeRecords

  if (!currentGroup || !currentMember) {
    return (
      <View className="min-h-screen bg-gray-50 px-4 py-6">
        <View className="flex flex-col items-center justify-center h-full">
          <Text className="block text-lg font-semibold text-gray-900 mb-4">
            还未加入房间
          </Text>
          <Text className="block text-sm text-gray-500 mb-8">
            加入房间后查看积分明细
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部房间信息 */}
      <View className="bg-white px-4 py-4 mb-4">
        <Text className="block text-lg font-semibold text-gray-900 mb-1">
          {currentGroup.name} - 积分明细
        </Text>
        {syncMessage && (
          <View className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
            <Text className="block text-xs text-blue-600">{syncMessage}</Text>
          </View>
        )}
        {revokedRecords.length > 0 && (
          <View className="mt-3 flex items-center justify-between">
            <Text className="block text-xs text-gray-400">
              已自动隐藏 {revokedRecords.length} 条已撤销记录
            </Text>
            <Button variant="outline" size="sm" onClick={() => setShowRevoked((prev) => !prev)}>
              <Text className="block">{showRevoked ? '隐藏已撤销' : '查看已撤销'}</Text>
            </Button>
          </View>
        )}
      </View>

      {/* 积分记录 */}
      <View className="px-4">
        {loading ? (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">加载中...</Text>
          </View>
        ) : displayRecords.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">
              {records.length === 0 ? '暂无积分记录' : '当前没有可展示的未撤销记录'}
            </Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {displayRecords.map((record, index) => (
              <View key={record.id}>
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <View className="flex items-center justify-between mb-2">
                      <View className="flex-1">
                        <Text className="block text-sm text-gray-500 mb-1">
                          {formatDate(record.created_at)} {formatTime(record.created_at)}
                        </Text>
                        <Text className="block text-base font-semibold text-gray-900">
                          {record.from_member_name || '未知'} → {record.to_member_name || '未知'}
                        </Text>
                        {record.reason && (
                          <Text className="block text-sm text-gray-500 mt-1">
                            {record.reason}
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        {record.is_revoked && (
                          <Badge variant="outline" className="mb-2 border-amber-200 text-amber-600">
                            已撤销
                          </Badge>
                        )}
                        <Badge
                          variant={record.points >= 0 ? "default" : "destructive"}
                          className={record.points >= 0 ? "bg-green-500" : "bg-red-500"}
                        >
                          {record.points > 0 ? '+' : ''}{record.points}
                        </Badge>
                      </View>
                    </View>
                  </CardContent>
                </Card>
                {index < displayRecords.length - 1 && <Separator className="my-3" />}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

export default HistoryPage
