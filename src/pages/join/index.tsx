import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad, showToast, switchTab, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGroupStore } from '@/stores/group'
import { Network } from '@/network'

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

  // 创建群组
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

      console.log('创建群组响应:', res.data)

      const responseData = res.data?.data || res.data
      const group = responseData?.group
      const member = responseData?.member

      console.log('解析后的群组:', group, '成员:', member)

      if (group && member) {
        setCurrentGroup(group)
        setCurrentMember(member)
        setCurrentGroupLocal(group)

        // 保存到本地存储，用于分享配置
        Taro.setStorageSync('currentGroup', group)

        // 获取二维码
        try {
          const qrRes = await Network.request({
            url: `/api/groups/qrcode?invite_code=${group.invite_code}`,
            method: 'GET'
          })

          console.log('二维码响应:', qrRes.data)

          const qrDataUrl = qrRes.data?.data?.qr_code
          if (qrDataUrl) {
            setQrCodeUrl(qrDataUrl)
            console.log('二维码获取成功')
          } else {
            console.warn('二维码响应格式异常')
          }
        } catch (qrError) {
          console.error('获取二维码失败:', qrError)
        }

        setShowQRCode(true)
        showToast({ title: '创建成功', icon: 'success' })
      } else {
        console.error('返回数据格式错误:', res.data)
        showToast({ title: '创建失败，返回数据异常', icon: 'none' })
      }
    } catch (error) {
      console.error('创建群组失败:', error)
      showToast({ title: '创建失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 加入群组
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

      console.log('加入群组响应:', res.data)

      const responseData = res.data?.data || res.data
      const group = responseData?.group
      const member = responseData?.member

      if (group && member) {
        setCurrentGroup(group)
        setCurrentMember(member)
        showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/index/index' })
        }, 500)
      } else {
        showToast({ title: '加入失败，请检查邀请码', icon: 'none' })
      }
    } catch (error) {
      console.error('加入群组失败:', error)
      showToast({ title: '加入失败，请检查邀请码', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 调用微信分享API
  const handleShare = () => {
    if (!currentGroup) {
      showToast({ title: '群组信息不存在', icon: 'none' })
      return
    }

    // 小程序中点击右上角分享按钮会自动触发
    showToast({ title: '请点击右上角菜单分享', icon: 'none' })
  }

  // 关闭二维码弹框
  const handleCloseQRCode = () => {
    setShowQRCode(false)
    setTimeout(() => {
      switchTab({ url: '/pages/index/index' })
    }, 300)
  }

  // 检查是否从分享链接进入
  useLoad(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params || {}

    if (params.invite_code) {
      setInviteCode(params.invite_code.toUpperCase())
      setActiveTab('join')
      showToast({
        title: '已自动填写邀请码',
        icon: 'none'
      })
    }

    console.log('Join page loaded, params:', params)
  })

  // 配置分享信息
  useShareAppMessage(() => {
    const groupToShare = currentGroup || Taro.getStorageSync('currentGroup')
    return {
      title: `邀请你加入群组「${groupToShare?.name || '积分管理'}」`,
      path: `/pages/join/index?invite_code=${groupToShare?.invite_code || ''}`,
      imageUrl: ''
    }
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
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入邀请码"
                    value={inviteCode}
                    onInput={(e) => setInviteCode(e.detail.value.toUpperCase())}
                    maxlength={6}
                  />
                </View>
              </View>

              <View>
                <Label>您的昵称</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入昵称"
                    value={memberName}
                    onInput={(e) => setMemberName(e.detail.value)}
                    maxlength={20}
                  />
                </View>
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
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入群组名称"
                    value={groupName}
                    onInput={(e) => setGroupName(e.detail.value)}
                    maxlength={50}
                  />
                </View>
              </View>

              <View>
                <Label>您的昵称</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入昵称"
                    value={memberName}
                    onInput={(e) => setMemberName(e.detail.value)}
                    maxlength={20}
                  />
                </View>
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
      {showQRCode && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseQRCode}
        >
          <View
            className="bg-white rounded-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <View className="text-center mb-6">
              <Text className="block text-lg font-semibold text-gray-900 mb-2">
                群组二维码
              </Text>
              <Text className="block text-sm text-gray-500 mb-4">
                扫码即可加入群组
              </Text>

              {qrCodeUrl ? (
                <View className="flex justify-center mb-4 bg-white p-4 rounded-lg border border-gray-200">
                  <Image
                    src={qrCodeUrl}
                    className="w-48 h-48"
                    mode="aspectFit"
                  />
                </View>
              ) : (
                <View className="flex justify-center mb-4 bg-gray-100 rounded-lg p-12">
                  <Text className="block text-gray-400">二维码生成中...</Text>
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
      )}
    </View>
  )
}

export default JoinPage
