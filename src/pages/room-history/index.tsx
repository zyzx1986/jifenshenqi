import { useState, useEffect } from 'react'
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

export default function RoomHistory() {
  const [history, setHistory] = useState<RoomHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/groups/room-history'
      })
      console.log('获取开房历史:', res.data)
      if (res.data.code === 200) {
        setHistory(res.data.data || [])
      }
    } catch (err) {
      console.error('获取开房历史失败:', err)
      Taro.showToast({ title: '获取历史失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (roomId: string) => {
    try {
      setDeletingId(roomId)
      const res = await Network.request({
        url: '/api/groups/room-history/delete',
        method: 'POST',
        data: { room_id: roomId }
      })
      if (res.data.code === 200) {
        setHistory(history.filter(item => item.id !== roomId))
        Taro.showToast({ title: '删除成功', icon: 'success' })
      }
    } catch (err) {
      console.error('删除失败:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleRejoin = async (room: RoomHistory) => {
    // 先检查是否已经是该房间成员
    try {
      Taro.showLoading({ title: '检查中...' })
      const res = await Network.request({
        url: '/api/groups/my-group'
      })
      Taro.hideLoading()
      
      if (res.data.code === 200 && res.data.data) {
        const currentGroup = res.data.data.group
        if (currentGroup.invite_code === room.invite_code) {
          Taro.showToast({ title: '您已在该房间', icon: 'none' })
          return
        }
      }
      
      // 加入房间
      Taro.navigateTo({
        url: `/pages/join/index?invite_code=${room.invite_code}`
      })
    } catch (err) {
      Taro.hideLoading()
      Taro.navigateTo({
        url: `/pages/join/index?invite_code=${room.invite_code}`
      })
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return (
    <View className="room-history-page">
      <View className="page-header">
        <Text className="block text-lg font-semibold mb-2">我的开房记录</Text>
        <Text className="block text-sm text-gray-500">查看您曾经创建的房间</Text>
      </View>

      {loading ? (
        <View className="loading-state">
          <Text className="block text-gray-500 text-center">加载中...</Text>
        </View>
      ) : history.length === 0 ? (
        <View className="empty-state">
          <Text className="block text-gray-400 text-center mb-4">暂无开房记录</Text>
          <Button onClick={() => Taro.navigateTo({ url: '/pages/join/index' })}>
            <Text className="block">去开房</Text>
          </Button>
        </View>
      ) : (
        <View className="history-list">
          {history.map((room) => (
            <Card key={room.id} className="mb-3">
              <CardContent className="p-4">
                <View className="flex justify-between items-start">
                  <View className="flex-1">
                    <Text className="block text-base font-medium mb-1">
                      {room.room_name}
                    </Text>
                    <View className="flex items-center gap-2 mb-2">
                      <Text className="block text-xs text-gray-500">
                        房号: {room.invite_code}
                      </Text>
                      <Text className="block text-xs text-gray-400">
                        {formatDate(room.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleRejoin(room)}
                  >
                    <Text className="block text-sm">重新进入</Text>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="px-3"
                    loading={deletingId === room.id}
                    onClick={() => handleDelete(room.id)}
                  >
                    <Text className="block text-sm text-gray-500">删除</Text>
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
