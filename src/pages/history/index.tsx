import { View, Text } from '@tarojs/components'
import { useLoad, useDidShow, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useGroupStore, PointsRecord } from '@/stores/group'
import { Network } from '@/network'

const HistoryPage = () => {
  const { currentGroup, currentMember } = useGroupStore()
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<PointsRecord[]>([])

  const loadRecords = async () => {
    if (!currentGroup || !currentMember) return

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/points/history',
        method: 'GET',
        data: { group_id: currentGroup.id }
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
    }
  })

  if (!currentGroup || !currentMember) {
    return (
      <View className="min-h-screen bg-gray-50 px-4 py-6">
        <View className="flex flex-col items-center justify-center h-full">
          <Text className="block text-lg font-semibold text-gray-900 mb-4">
            还未加入群组
          </Text>
          <Text className="block text-sm text-gray-500 mb-8">
            加入群组后查看积分明细
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部群组信息 */}
      <View className="bg-white px-4 py-4 mb-4">
        <Text className="block text-lg font-semibold text-gray-900 mb-1">
          {currentGroup.name} - 积分明细
        </Text>
      </View>

      {/* 积分记录 */}
      <View className="px-4">
        {loading ? (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">加载中...</Text>
          </View>
        ) : records.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">暂无积分记录</Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {records.map((record, index) => (
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
                      <Badge
                        variant={record.points >= 0 ? "default" : "destructive"}
                        className={record.points >= 0 ? "bg-green-500" : "bg-red-500"}
                      >
                        {record.points > 0 ? '+' : ''}{record.points}
                      </Badge>
                    </View>
                  </CardContent>
                </Card>
                {index < records.length - 1 && <Separator className="my-3" />}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

export default HistoryPage
