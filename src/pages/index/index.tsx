import { View, Text } from '@tarojs/components'
import { useLoad, useDidShow, showToast, navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGroupStore } from '@/stores/group'
import { Network } from '@/network'

interface Member {
  id: string
  name: string
  total_points: number
  group_id: string
  user_id: string
}

const IndexPage = () => {
  const { currentGroup, currentMember, members, setMembers, updateMember } = useGroupStore()
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [showDialog, setShowDialog] = useState(false)

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
    } catch (error) {
      console.error('加载成员失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

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
      const res = await Network.request({
        url: '/api/points/give',
        method: 'POST',
        data: {
          group_id: currentGroup.id,
          from_member_id: currentMember.id,
          to_member_id: toMemberId,
          points: pointsNum,
          reason: reasonText
        }
      })

      console.log('给分结果:', res.data)

      showToast({ title: '给分成功', icon: 'success' })
      setShowDialog(false)
      setPoints('')
      setReason('')
      setSelectedMember(null)

      // 更新本地成员积分
      updateMember(toMemberId, pointsNum)
    } catch (error) {
      console.error('给分失败:', error)
      showToast({ title: '给分失败', icon: 'none' })
    }
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

  useLoad(() => {
    console.log('Page loaded.')
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
            加入或开房后开始积分管理
          </Text>
          <Button onClick={handleJoinGroup}>
            加入/开房
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部房间信息 */}
      <View className="bg-white px-4 py-4 mb-4">
        <Text className="block text-lg font-semibold text-gray-900 mb-1">
          {currentGroup.name}
        </Text>
        <Text className="block text-sm text-gray-500">
          房号: {currentGroup.invite_code}
        </Text>
      </View>

      {/* 成员列表 */}
      <View className="px-4">
        <Text className="block text-base font-semibold text-gray-900 mb-4">
          成员列表
        </Text>

        {loading ? (
          <View className="flex items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">加载中...</Text>
          </View>
        ) : members.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <Text className="block text-sm text-gray-500">暂无成员</Text>
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {members.map((member) => (
              <Card key={member.id} className="bg-white">
                <CardHeader className="pb-3">
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-3">
                      <View className="flex-1">
                        <CardTitle className="text-base">{member.name}</CardTitle>
                        {currentMember && member.id === currentMember.id && (
                          <Badge variant="secondary" className="mt-1">
                            我
                          </Badge>
                        )}
                      </View>
                    </View>
                    <Badge
                      variant={member.total_points >= 0 ? "default" : "destructive"}
                      className={member.total_points >= 0 ? "bg-blue-500" : "bg-red-500"}
                    >
                      {member.total_points > 0 ? '+' : ''}{member.total_points} 分
                    </Badge>
                  </View>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => openGiveDialog(member)}
                  >
                    给分
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 给分弹窗 */}
      {selectedMember && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <View className="bg-white rounded-xl w-full max-w-sm p-6">
              <View className="mb-4">
                <Text className="block text-lg font-semibold text-gray-900 mb-2">
                  给 {selectedMember.name} 评分
                </Text>
              </View>

              <View className="mb-4">
                <Label>积分</Label>
                <Input
                  className="mt-1"
                  type="number"
                  placeholder="输入积分（正数加分，负数减分）"
                  value={points}
                  onInput={(e) => setPoints(e.detail.value)}
                />
              </View>

              <View className="mb-6">
                <Label>原因</Label>
                <Input
                  className="mt-1"
                  placeholder="输入评分原因"
                  value={reason}
                  onInput={(e) => setReason(e.detail.value)}
                />
              </View>

              <View className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDialog(false)}
                >
                  取消
                </Button>
                <Button className="flex-1" onClick={handleGivePoints}>
                  确认
                </Button>
              </View>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  )
}

export default IndexPage
