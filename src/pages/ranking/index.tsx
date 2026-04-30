import { View, Text } from '@tarojs/components'
import { useLoad, useDidShow, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useGroupStore } from '@/stores/group'
import { Network } from '@/network'

interface Member {
  id: string
  name: string
  total_points: number
  group_id: string
  user_id: string
}

const RankingPage = () => {
  const { currentGroup, setMembers } = useGroupStore()
  const [loading, setLoading] = useState(false)
  const [sortedMembers, setSortedMembers] = useState<Member[]>([])

  const loadMembers = async () => {
    if (!currentGroup) return

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/groups/members',
        method: 'GET',
        data: { group_id: currentGroup.id }
      })

      console.log('加载成员列表:', res.data)
      const memberList = res.data?.data || []
      setMembers(memberList)
      setSortedMembers(memberList.sort((a, b) => b.total_points - a.total_points))
    } catch (error) {
      console.error('加载成员失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useLoad(() => {
    console.log('Ranking page loaded.')
  })

  useDidShow(() => {
    if (currentGroup) {
      loadMembers()
    }
  })

  if (!currentGroup) {
    return (
      <View className="min-h-screen bg-gray-50 px-4 py-6">
        <View className="flex flex-col items-center justify-center h-full">
          <Text className="block text-lg font-semibold text-gray-900 mb-4">
            还未加入房间
          </Text>
          <Text className="block text-sm text-gray-500 mb-8">
            加入房间后查看积分排行榜
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
          {currentGroup.name} - 积分排行
        </Text>
      </View>

      {/* 排行榜 */}
      <View className="px-4">
        {loading ? (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">加载中...</Text>
          </View>
        ) : sortedMembers.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">暂无成员</Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {sortedMembers.map((member, index) => (
              <Card key={member.id} className="bg-white">
                <CardContent className="p-4">
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-3 flex-1">
                      {/* 排名 */}
                      <View
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          index === 0 ? 'bg-yellow-500'
                            : index === 1 ? 'bg-gray-400'
                            : index === 2 ? 'bg-orange-500'
                            : 'bg-gray-200'
                        }`}
                      >
                        <Text className="text-sm font-semibold text-white">
                          {index + 1}
                        </Text>
                      </View>

                      {/* 成员信息 */}
                      <View className="flex-1">
                        <Text className="block text-base font-semibold text-gray-900">
                          {member.name}
                        </Text>
                      </View>
                    </View>

                    {/* 积分 */}
                    <Badge
                      variant={member.total_points >= 0 ? "default" : "destructive"}
                      className={member.total_points >= 0 ? "bg-blue-500" : "bg-red-500"}
                    >
                      {member.total_points > 0 ? '+' : ''}{member.total_points}
                    </Badge>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

export default RankingPage
