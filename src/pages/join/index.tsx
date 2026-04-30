import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad, showToast, switchTab, useShareAppMessage, getUserProfile } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ShareButton } from '@/components/ui/share-button'
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
  const [userId, setUserId] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [currentGroup, setCurrentGroupLocal] = useState<any>(null)
  const [autoJoinLoading, setAutoJoinLoading] = useState(false)
  const [showAutoJoin, setShowAutoJoin] = useState(false)

  // 获取微信昵称作为默认昵称
  const fetchWechatNickname = async (autoJoin = false) => {
    return new Promise<string>((resolve) => {
      // 尝试从本地存储获取缓存的昵称
      const cachedNickname = Taro.getStorageSync('wechatNickname')
      if (cachedNickname) {
        resolve(cachedNickname)
        return
      }

      // 如果没有 wx.getUserProfile，使用 wx.getUserInfo（旧API）
      if (typeof wx !== 'undefined') {
        // 优先使用 getUserProfile（新API）
        if (wx.getUserProfile) {
          wx.getUserProfile({
            desc: '用于快速加入房间或开房',
            success: (userRes) => {
              const nickname = userRes.userInfo?.nickName || ''
              if (nickname) {
                Taro.setStorageSync('wechatNickname', nickname)
                resolve(nickname)
              } else {
                resolve('')
              }
            },
            fail: () => {
              resolve('')
            }
          })
        } else if (wx.getUserInfo) {
          // 旧版 API 作为降级
          wx.getUserInfo({
            success: (userRes) => {
              const nickname = userRes.userInfo?.nickName || ''
              if (nickname) {
                Taro.setStorageSync('wechatNickname', nickname)
                resolve(nickname)
              } else {
                resolve('')
              }
            },
            fail: () => {
              resolve('')
            }
          })
        } else {
          resolve('')
        }
      } else {
        resolve('')
      }
    })
  }

  // 页面加载时获取微信昵称和初始化用户ID
  useEffect(() => {
    // 初始化或获取用户ID
    let storedUserId = Taro.getStorageSync('userId')
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      Taro.setStorageSync('userId', storedUserId)
    }
    setUserId(storedUserId)

    // 页面加载时尝试获取昵称
    const cachedNickname = Taro.getStorageSync('wechatNickname')
    if (cachedNickname) {
      setMemberName(cachedNickname)
    } else {
      // 静默获取昵称，不弹窗
      fetchWechatNickname().then((nickname) => {
        if (nickname) {
          setMemberName(nickname)
        }
      })
    }
  }, [])

  // 开房
  const createGroup = async () => {
    if (!groupName.trim()) {
      showToast({ title: '请输入房间名称', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 如果没有输入昵称，自动获取微信昵称
      let nickname = memberName.trim()
      if (!nickname) {
        nickname = await fetchWechatNickname()
        if (!nickname) {
          showToast({ title: '请输入您的昵称', icon: 'none' })
          setLoading(false)
          return
        }
        setMemberName(nickname)
      }

      const res = await Network.request({
        url: '/api/groups/create',
        method: 'POST',
        data: {
          name: groupName,
          member_name: memberName,
          user_id: userId
        }
      })

      console.log('开房响应:', res.data)

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
      console.error('开房失败:', error)
      showToast({ title: '创建失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 加入房间
  const joinGroup = async () => {
    if (!inviteCode.trim()) {
      showToast({ title: '请输入房号', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 如果没有输入昵称，自动获取微信昵称
      let nickname = memberName.trim()
      if (!nickname) {
        nickname = await fetchWechatNickname()
        if (!nickname) {
          showToast({ title: '请输入您的昵称', icon: 'none' })
          setLoading(false)
          return
        }
        setMemberName(nickname)
      }

      const res = await Network.request({
        url: '/api/groups/join',
        method: 'POST',
        data: {
          invite_code: inviteCode,
          member_name: memberName
        }
      })

      console.log('加入房间响应:', res.data)

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
        showToast({ title: '加入失败，请检查房号', icon: 'none' })
      }
    } catch (error: any) {
      console.error('加入房间失败:', error)
      const errorMsg = error?.errMsg || error?.message || ''
      if (errorMsg.includes('已经是成员')) {
        showToast({ title: '您已经是该房间成员', icon: 'none' })
        setTimeout(() => {
          switchTab({ url: '/pages/index/index' })
        }, 1000)
      } else {
        showToast({ title: '加入失败，请检查房号', icon: 'none' })
      }
    } finally {
      setLoading(false)
    }
  }

  // 一键快速加入（使用微信昵称）
  const quickJoin = async () => {
    if (!inviteCode.trim()) {
      showToast({ title: '房号无效', icon: 'none' })
      return
    }

    setAutoJoinLoading(true)

    // 先获取微信昵称
    const nickname = await new Promise<string>((resolve) => {
      if (typeof wx !== 'undefined' && wx.getUserProfile) {
        wx.getUserProfile({
          desc: '用于快速加入房间',
          success: (res) => {
            const nick = res.userInfo?.nickName || ''
            if (nick) {
              Taro.setStorageSync('wechatNickname', nick)
            }
            resolve(nick)
          },
          fail: () => {
            resolve('')
          }
        })
      } else {
        resolve('')
      }
    })

    if (!nickname) {
      setAutoJoinLoading(false)
      showToast({ title: '请授权获取昵称', icon: 'none' })
      return
    }

    setMemberName(nickname)

    try {
      const res = await Network.request({
        url: '/api/groups/join',
        method: 'POST',
        data: {
          invite_code: inviteCode,
          member_name: nickname
        }
      })

      console.log('快速加入响应:', res.data)

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
        showToast({ title: '加入失败，请检查房号', icon: 'none' })
      }
    } catch (error: any) {
      console.error('快速加入失败:', error)
      const errorMsg = error?.errMsg || error?.message || ''
      if (errorMsg.includes('已经是成员')) {
        showToast({ title: '您已经是该房间成员', icon: 'none' })
        setTimeout(() => {
          switchTab({ url: '/pages/index/index' })
        }, 1000)
      } else {
        showToast({ title: '加入失败，请检查房号', icon: 'none' })
      }
    } finally {
      setAutoJoinLoading(false)
    }
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
      const code = params.invite_code.toUpperCase()
      setInviteCode(code)
      setActiveTab('join')
      setShowAutoJoin(true) // 显示一键加入按钮
      console.log('检测到房号:', code)
    }

    console.log('Join page loaded, params:', params)
  })

  // 配置分享信息
  useShareAppMessage(() => {
    const groupToShare = currentGroup || Taro.getStorageSync('currentGroup')
    return {
      title: `邀请你加入房间「${groupToShare?.name || '积分管理'}」`,
      path: `/pages/join/index?invite_code=${groupToShare?.invite_code || ''}`,
      imageUrl: ''
    }
  })

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6">
      <Text className="block text-lg font-semibold text-gray-900 mb-6">
        加入/开房
      </Text>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'join' | 'create')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="join">加入房间</TabsTrigger>
          <TabsTrigger value="create">开房</TabsTrigger>
        </TabsList>

        <TabsContent value="join">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">加入房间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <View>
                <Label>房号</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入房号"
                    value={inviteCode}
                    onInput={(e) => setInviteCode(e.detail.value.toUpperCase())}
                    maxlength={6}
                  />
                </View>
              </View>

              {/* 快速加入按钮（从分享链接进入时显示） */}
              {showAutoJoin && inviteCode && (
                <Button
                  className="w-full bg-green-500 hover:bg-green-600"
                  onClick={quickJoin}
                  disabled={autoJoinLoading}
                >
                  {autoJoinLoading ? '正在加入...' : '一键使用微信昵称加入'}
                </Button>
              )}

              <View className="flex items-center">
                <View className="flex-1 h-px bg-gray-200" />
                <Text className="block text-xs text-gray-400 px-4">或</Text>
                <View className="flex-1 h-px bg-gray-200" />
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
              <CardTitle className="text-base">开房</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <View>
                <Label>房间名称</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3 mt-1">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入房间名称"
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
                房间创建成功
              </Text>
              <Text className="block text-sm text-gray-500 mb-4">
                分享给好友邀请加入
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
                <Text className="block text-xs text-gray-500 mb-1">房号</Text>
                <Text className="block text-lg font-bold text-gray-900">
                  {currentGroup?.invite_code}
                </Text>
              </View>
            </View>

            <View className="space-y-3">
              <ShareButton className="w-full">
                分享给好友
              </ShareButton>
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
