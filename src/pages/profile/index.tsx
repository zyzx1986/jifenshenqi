import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { navigateTo, setClipboardData, showModal, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { ChartBarBig, History } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Network } from '@/network'
import { useGroupStore } from '@/stores/group'
import { gameSocket } from '@/utils/gameSocket'

const ProfilePage = () => {
  const { currentGroup, currentMember, setCurrentMember, clear } = useGroupStore()
  const [editNicknameOpen, setEditNicknameOpen] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')

  const leaveGroup = () => {
    showModal({
      title: '退出房间',
      content: '确定要退出当前房间吗？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        void (async () => {
          try {
            if (currentGroup && currentMember) {
              await Network.request({
                url: '/api/groups/leave',
                method: 'POST',
                data: {
                  group_id: currentGroup.id,
                  member_id: currentMember.id,
                  invite_code: currentGroup.invite_code,
                  member_name: currentMember.name,
                },
              })
            }
          } catch (err) {
            console.error('退出房间失败:', err)
          } finally {
            gameSocket.disconnect()
            clear()
            Taro.reLaunch({ url: '/pages/join/index' })
            showToast({ title: '已退出房间', icon: 'success' })
          }
        })()
      },
    })
  }

  const copyInviteCode = () => {
    if (!currentGroup) return

    setClipboardData({
      data: currentGroup.invite_code,
      success: () => {
        showToast({ title: '房号已复制', icon: 'success' })
      },
    })
  }

  const openEditNickname = () => {
    if (!currentMember) return
    setNicknameInput(currentMember.name || '')
    setEditNicknameOpen(true)
  }

  const handleSaveNickname = async () => {
    if (!currentMember || !nicknameInput.trim()) {
      showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/members/update',
        method: 'POST',
        data: {
          member_id: currentMember.id,
          name: nicknameInput.trim(),
        },
      })

      const result = res.data as any
      if (result && result.code === 200) {
        const updatedMember = { ...currentMember, name: nicknameInput.trim() }
        setCurrentMember(updatedMember)
        Taro.setStorageSync('currentMember', updatedMember)

        showToast({ title: '昵称修改成功', icon: 'success' })
        setEditNicknameOpen(false)
      } else {
        showToast({ title: result?.msg || '修改失败', icon: 'none' })
      }
    } catch (err) {
      console.error('修改昵称失败:', err)
      showToast({ title: '修改失败', icon: 'none' })
    }
  }

  useDidShow(() => {
    // refresh data if needed
  })

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6 pb-20">
      <Text className="mb-4 block text-lg font-semibold text-gray-900">我的</Text>

      {currentGroup ? (
        <View className="flex flex-col gap-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">当前房间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <View>
                <Label>房间名称</Label>
                <Text className="mt-1 block text-sm text-gray-700">{currentGroup.name}</Text>
              </View>

              <View>
                <Label>房号</Label>
                <View className="mt-1 flex items-center gap-2">
                  <Text className="block flex-1 text-sm text-gray-700">{currentGroup.invite_code}</Text>
                  <Button size="sm" variant="outline" onClick={copyInviteCode}>
                    复制
                  </Button>
                </View>
              </View>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">我的信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <View>
                <Label>我的昵称</Label>
                <View className="mt-1 flex items-center gap-2">
                  <Text className="block flex-1 text-sm text-gray-700">{currentMember?.name || '未设置'}</Text>
                  <Button size="sm" variant="outline" onClick={openEditNickname}>
                    修改
                  </Button>
                </View>
              </View>

              <View>
                <Label>我的积分</Label>
                <Text className="mt-1 block text-2xl font-bold text-blue-500">{currentMember?.total_points || 0}</Text>
              </View>
            </CardContent>
          </Card>

          <Button variant="destructive" className="w-full" onClick={leaveGroup}>
            退出房间
          </Button>

          <Button variant="outline" className="w-full" onClick={() => navigateTo({ url: '/pages/room-history/index' })}>
            <History size={18} color="#666" />
            <Text className="ml-2">查看开房历史</Text>
          </Button>

          <Button variant="outline" className="w-full" onClick={() => switchTab({ url: '/pages/stats/index' })}>
            <ChartBarBig size={18} color="#666" />
            <Text className="ml-2">战绩统计</Text>
          </Button>
        </View>
      ) : (
        <View className="flex flex-col gap-4">
          <Card className="bg-white">
            <CardContent className="p-6">
              <View className="flex flex-col items-center">
                <Text className="mb-4 block text-center text-base text-gray-700">还未加入房间</Text>
                <Button onClick={() => navigateTo({ url: '/pages/join/index' })}>加入/开房</Button>
              </View>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => navigateTo({ url: '/pages/room-history/index' })}>
            查看开房历史
          </Button>
        </View>
      )}

      <Dialog open={editNicknameOpen} onOpenChange={(open) => setEditNicknameOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
          </DialogHeader>
          <View className="py-4">
            <View className="mb-4">
              <Input
                placeholder="请输入昵称"
                value={nicknameInput}
                onInput={(e: any) => setNicknameInput(e.detail.value)}
                maxlength={20}
              />
            </View>
            <View className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditNicknameOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSaveNickname}>
                保存
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}

export default ProfilePage
