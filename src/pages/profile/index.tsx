import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, showToast, navigateTo, showModal, setClipboardData } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useGroupStore } from '@/stores/group'
import { History, ChartBarBig } from 'lucide-react-taro'

const ProfilePage = () => {
  const { currentGroup, currentMember, clear } = useGroupStore()

  const leaveGroup = () => {
    showModal({
      title: '退出房间',
      content: '确定要退出当前房间吗？',
      success: (res) => {
        if (res.confirm) {
          clear() // 清理所有状态和本地存储
          Taro.reLaunch({ url: '/pages/join/index' })
          showToast({ title: '已退出房间', icon: 'success' })
        }
      }
    })
  }

  const copyInviteCode = () => {
    if (!currentGroup) return

    setClipboardData({
      data: currentGroup.invite_code,
      success: () => {
        showToast({ title: '房号已复制', icon: 'success' })
      }
    })
  }

  useDidShow(() => {
    // refresh data if needed
  })

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6 pb-20">
      <Text className="block text-lg font-semibold text-gray-900 mb-4">
        我的
      </Text>

      {currentGroup ? (
        <View className="flex flex-col gap-4">
          {/* 房间信息 */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">当前房间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <View>
                <Label>房间名称</Label>
                <Text className="block text-sm text-gray-700 mt-1">
                  {currentGroup.name}
                </Text>
              </View>

              <View>
                <Label>房号</Label>
                <View className="flex items-center gap-2 mt-1">
                  <Text className="block text-sm text-gray-700 flex-1">
                    {currentGroup.invite_code}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyInviteCode}
                  >
                    复制
                  </Button>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* 成员信息 */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">我的信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <View>
                <Label>我的积分</Label>
                <Text className="block text-2xl font-bold text-blue-500 mt-1">
                  {currentMember?.total_points || 0}
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* 退出房间 */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={leaveGroup}
          >
            退出房间
          </Button>

          {/* 开房历史 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigateTo({ url: '/pages/room-history/index' })}
          >
            <History size={18} color="#666" />
            <Text className="ml-2">查看开房历史</Text>
          </Button>

          {/* 战绩统计 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => switchTab({ url: '/pages/stats/index' })}
          >
            <ChartBarBig size={18} color="#666" />
            <Text className="ml-2">战绩统计</Text>
          </Button>
        </View>
      ) : (
        <View className="flex flex-col gap-4">
          <Card className="bg-white">
            <CardContent className="p-6">
              <View className="flex flex-col items-center">
                <Text className="block text-base text-gray-700 mb-4 text-center">
                  还未加入房间
                </Text>
                <Button onClick={() => navigateTo({ url: '/pages/join/index' })}>
                  加入/开房
                </Button>
              </View>
            </CardContent>
          </Card>

          {/* 开房历史 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigateTo({ url: '/pages/room-history/index' })}
          >
            查看开房历史
          </Button>
        </View>
      )}
    </View>
  )
}

export default ProfilePage
