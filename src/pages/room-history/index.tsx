import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import './index.scss'

interface RoomHistory {
  id: string
  group_id: string
  room_name: string
  invite_code: string
  created_at: string
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return '今天'
  }

  if (days === 1) {
    return '昨天'
  }

  if (days < 7) {
    return `${days} 天前`
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export default function RoomHistory() {
  const [history, setHistory] = useState<RoomHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    void fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const token = Taro.getStorageSync('token')
      const userId = Taro.getStorageSync('userId') || ''
      const res = await Network.request({
        url: '/api/groups/room-history',
        data: { user_id: userId },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if ((res.data as any)?.code === 200) {
        setHistory((res.data as any).data || [])
      }
    } catch (err) {
      console.error('fetch room history failed:', err)
      Taro.showToast({ title: '获取历史失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (roomId: string) => {
    try {
      setDeletingId(roomId)
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/room-history/delete',
        method: 'POST',
        data: { room_id: roomId },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if ((res.data as any)?.code === 200) {
        setHistory((prev) => prev.filter((item) => item.id !== roomId))
        Taro.showToast({ title: '删除成功', icon: 'success' })
      }
    } catch (err) {
      console.error('delete room history failed:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleRejoin = async (room: RoomHistory) => {
    try {
      Taro.showLoading({ title: '检查中...' })
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/my-group',
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })
      Taro.hideLoading()

      if ((res.data as any)?.code === 200 && (res.data as any)?.data?.group) {
        const currentGroup = (res.data as any).data.group
        if (currentGroup.invite_code === room.invite_code) {
          Taro.showToast({ title: '你已经在这个房间里', icon: 'none' })
          return
        }
      }

      Taro.navigateTo({
        url: `/pages/join/index?invite_code=${room.invite_code}`,
      })
    } catch (err) {
      Taro.hideLoading()
      Taro.navigateTo({
        url: `/pages/join/index?invite_code=${room.invite_code}`,
      })
    }
  }

  return (
    <View className="room-history-page">
      <View className="page-header">
        <Text className="mb-2 block text-lg font-semibold">我的房间记录</Text>
        <Text className="block text-sm text-gray-500">查看你创建过或加入过的房间</Text>
      </View>

      {loading ? (
        <View className="loading-state">
          <Text className="block text-center text-gray-500">加载中...</Text>
        </View>
      ) : history.length === 0 ? (
        <View className="empty-state">
          <Text className="mb-4 block text-center text-gray-400">暂时还没有房间记录</Text>
          <Button onClick={() => Taro.navigateTo({ url: '/pages/join/index' })}>
            <Text className="block">去开房</Text>
          </Button>
        </View>
      ) : (
        <View className="history-list">
          {history.map((room) => (
            <Card key={room.id} className="mb-3">
              <CardContent className="p-4">
                <View className="flex items-start justify-between">
                  <View className="flex-1">
                    <Text className="mb-1 block text-base font-medium">{room.room_name}</Text>
                    <View className="mb-2 flex items-center gap-2">
                      <Text className="block text-xs text-gray-500">房号: {room.invite_code}</Text>
                      <Text className="block text-xs text-gray-400">{formatDate(room.created_at)}</Text>
                    </View>
                  </View>
                </View>
                <View className="mt-3 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleRejoin(room)}>
                    <Text className="block text-sm">重新进入</Text>
                  </Button>
                  <Button variant="ghost" className="px-3" onClick={() => handleDelete(room.id)}>
                    <Text className="block text-sm text-gray-500">
                      {deletingId === room.id ? '删除中...' : '删除'}
                    </Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </View>
  )
}
