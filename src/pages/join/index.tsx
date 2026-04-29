import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad, showToast, switchTab, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog } from '@/components/ui/dialog'
import { useGroupStore } from '@/stores/group'
import { Network } from '@/network'
import QRCode from 'qrcode'

const JoinPage = () => {
  const { setCurrentGroup, setCurrentMember } = useGroupStore()
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [currentGroup, setCurrentGroupLocal] = useState<any>(null)

  const createGroup = async () => {
    if (!groupName.trim()) {
      showToast({ title: '请输入群组名称', icon: 'none' })
      return
    }

    if (!memberName.trim()) {
      showToast({ title: '请输入您的昵称', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/groups/create',
        method: 'POST',
        data: {
          name: groupName,
          member_name: memberName
        }
      })

      console.log('创建群组结果:', res.data)

      const { group, member } = res.data?.data || {}
      if (group && member) {
        setCurrentGroup(group)
        setCurrentMember(member)
        setCurrentGroupLocal(group)

        // 生成二维码
        const qrData = `invite_code=${group.invite_code}`
        const qrImage = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2
        })
        setQrCodeUrl(qrImage)
        setShowQRCode(true)

        showToast({ title: '创建成功', icon: 'success' })
      }
    } catch (error) {
      console.error('创建群组失败:', error)
      showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const joinGroup = async () => {
    if (!inviteCode.trim()) {
      showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }

    if (!memberName.trim()) {
      showToast({ title: '请输入您的昵称', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/groups/join',
        method: 'POST',
        data: {
          invite_code: inviteCode,
          member_name: memberName
        }
      })

      console.log('加入群组结果:', res.data)

      const { group, member } = res.data?.data || {}
      if (group && member) {
        setCurrentGroup(group)
        setCurrentMember(member)
        showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/index/index' })
        }, 500)
      }
    } catch (error) {
      console.error('加入群组失败:', error)
      showToast({ title: '加入失败，请检查邀请码', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleShare = () => {
    showToast({ title: '点击右上角菜单分享', icon: 'none' })
  }

  const handleCloseQRCode = () => {
    setShowQRCode(false)
    setTimeout(() => {
      switchTab({ url: '/pages/index/index' })
    }, 300)
  }

  // 分享配置
  useShareAppMessage(() => {
    return {
      title: `邀请你加入群组「${currentGroup?.name || '积分管理'}」`,
      path: `/pages/join/index?invite_code=${currentGroup?.invite_code || ''}`,
      imageUrl: ''
    }
  })

  // 检查是否从分享链接进入
  useLoad(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params || {}

    if (params.invite_code) {
      setInviteCode(params.invite_code)
      setActiveTab('join')
      showToast({
        title: '已自动填写邀请码',
        icon: 'none'
      })
    }

    console.log('Join page loaded.')
  })

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6">
      <Text className="block text-lg font-semibold text-gray-900 mb-6">
        加入/创建群组
      </Text>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'join' | 'create')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="join">加入群组</TabsTrigger>
          <TabsTrigger value="create">创建群组</TabsTrigger>
        </TabsList>

        <TabsContent value="join">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">加入群组</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <View>
                <Label>邀请码</Label>
                <Input
                  className="mt-1"
                  placeholder="请输入邀请码"
                  value={inviteCode}
                  onInput={(e) => setInviteCode(e.detail.value.toUpperCase())}
                />
              </View>

              <View>
                <Label>您的昵称</Label>
                <Input
                  className="mt-1"
                  placeholder="请输入昵称"
                  value={memberName}
                  onInput={(e) => setMemberName(e.detail.value)}
                />
              </View>

              <Button
                className="w-full"
                onClick={joinGroup}
                disabled={loading}
              >
                {loading ? '加入中...' : '加入'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">创建群组</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <View>
                <Label>群组名称</Label>
                <Input
                  className="mt-1"
                  placeholder="请输入群组名称"
                  value={groupName}
                  onInput={(e) => setGroupName(e.detail.value)}
                />
              </View>

              <View>
                <Label>您的昵称</Label>
                <Input
                  className="mt-1"
                  placeholder="请输入昵称"
                  value={memberName}
                  onInput={(e) => setMemberName(e.detail.value)}
                />
              </View>

              <Button
                className="w-full"
                onClick={createGroup}
                disabled={loading}
              >
                {loading ? '创建中...' : '创建'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 二维码弹框 */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <View className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <View className="bg-white rounded-xl w-full max-w-sm p-6">
            <View className="text-center mb-6">
              <Text className="block text-lg font-semibold text-gray-900 mb-2">
                群组二维码
              </Text>
              <Text className="block text-sm text-gray-500 mb-4">
                扫码即可加入群组
              </Text>

              {qrCodeUrl && (
                <View className="flex justify-center mb-4">
                  <Image
                    src={qrCodeUrl}
                    className="w-48 h-48"
                    mode="aspectFit"
                  />
                </View>
              )}

              <View className="bg-gray-50 rounded-lg p-3 mb-2">
                <Text className="block text-xs text-gray-500 mb-1">邀请码</Text>
                <Text className="block text-lg font-bold text-gray-900">
                  {currentGroup?.invite_code}
                </Text>
              </View>
            </View>

            <View className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleShare}
              >
                分享给好友
              </Button>
              <Button
                className="w-full"
                onClick={handleCloseQRCode}
              >
                完成
              </Button>
            </View>
          </View>
        </View>
      </Dialog>
    </View>
  )
}

export default JoinPage
