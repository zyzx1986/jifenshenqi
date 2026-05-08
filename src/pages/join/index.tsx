import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGroupStore } from '@/stores/group'
import { Network } from '@/network'
import { Users, Copy, Check, RefreshCw } from 'lucide-react-taro'

const JoinPage = () => {
  const { setCurrentGroup, setCurrentMember, setMembers } = useGroupStore()
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('create')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  // 获取微信昵称作为默认昵称
  const fetchWechatNickname = async (): Promise<string> => {
    return new Promise<string>((resolve) => {
      const cachedNickname = Taro.getStorageSync('wechatNickname')
      if (cachedNickname) {
        resolve(cachedNickname)
        return
      }

      if (Taro.getEnv() === 'WEAPP' && Taro.canIUse('getUserProfile')) {
        Taro.getUserProfile({
          desc: '用于设置房间昵称',
          success: (res) => {
            const nickname = res.userInfo?.nickName || ''
            if (nickname) {
              Taro.setStorageSync('wechatNickname', nickname)
            }
            resolve(nickname)
          },
          fail: () => resolve('')
        })
      } else {
        resolve('')
      }
    })
  }

  // 页面加载时获取昵称
  useEffect(() => {
    const cachedNickname = Taro.getStorageSync('wechatNickname')
    if (cachedNickname) {
      setMemberName(cachedNickname)
    }
  }, [])

  // 开房
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Taro.showToast({ title: '请输入房间名称', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      let nickname = memberName.trim()
      if (!nickname) {
        nickname = await fetchWechatNickname()
        if (!nickname) {
          Taro.showToast({ title: '请输入您的昵称', icon: 'none' })
          setLoading(false)
          return
        }
        setMemberName(nickname)
      }

      const token = Taro.getStorageSync('token')
      let userId = Taro.getStorageSync('userId')
      if (!userId) {
        userId = `user_${Date.now()}`
        Taro.setStorageSync('userId', userId)
      }

      const res = await Network.request({
        url: '/api/groups/create',
        method: 'POST',
        data: {
          name: groupName,
          member_name: nickname,
          user_id: userId
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      console.log('开房响应:', res.data)

      const result = res.data as any
      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        setCurrentGroup(group)
        setCurrentMember(member)
        setMembers([member])
        Taro.setStorageSync('currentGroup', group)
        Taro.setStorageSync('currentMember', member)
        
        setCreatedGroup(group)
        Taro.showToast({ title: '创建成功', icon: 'success' })
      } else {
        Taro.showToast({ title: result.msg || '创建失败', icon: 'none' })
      }
    } catch (error) {
      console.error('开房失败:', error)
      Taro.showToast({ title: '创建失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 加入房间
  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Taro.showToast({ title: '请输入房间号', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      let nickname = memberName.trim()
      if (!nickname) {
        nickname = await fetchWechatNickname()
        if (!nickname) {
          Taro.showToast({ title: '请输入您的昵称', icon: 'none' })
          setLoading(false)
          return
        }
        setMemberName(nickname)
      }

      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/join',
        method: 'POST',
        data: {
          invite_code: inviteCode.trim().toUpperCase(),
          member_name: nickname
        },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })

      console.log('加入房间响应:', res.data)

      const result = res.data as any
      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        setCurrentGroup(group)
        setCurrentMember(member)
        setMembers(group.members || [member])
        Taro.setStorageSync('currentGroup', group)
        Taro.setStorageSync('currentMember', member)
        
        Taro.showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }, 1000)
      } else {
        Taro.showToast({ title: result.msg || '加入失败，请检查房间号', icon: 'none' })
      }
    } catch (error: any) {
      console.error('加入房间失败:', error)
      Taro.showToast({ title: '加入失败，请检查房间号', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 复制邀请码
  const copyInviteCode = () => {
    if (!createdGroup?.invite_code) return
    Taro.setClipboardData({
      data: createdGroup.invite_code,
      success: () => {
        setCopied(true)
        Taro.showToast({ title: '已复制', icon: 'none' })
        setTimeout(() => setCopied(false), 2000)
      }
    })
  }

  // 返回首页
  const goToHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  // 检测分享链接进入
  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params || {}
    
    console.log('[Join] useDidShow - params:', params)
    
    if (params.invite_code && params.invite_code !== 'undefined') {
      const code = params.invite_code.toUpperCase()
      console.log('[Join] 检测到邀请码:', code)
      setInviteCode(code)
      setActiveTab('join')
    }
  })

  // 配置分享信息
  useShareAppMessage(() => {
    if (createdGroup) {
      return {
        title: `邀请你加入「${createdGroup.name}」`,
        path: `/pages/join/index?invite_code=${createdGroup.invite_code}`,
        imageUrl: ''
      }
    }
    return {
      title: '积分互赠小程序',
      path: '/pages/join/index',
      imageUrl: ''
    }
  })

  // 渲染创建房间成功后的分享界面
  const renderSharePanel = () => (
    <View className="flex flex-col items-center px-4 py-8">
      <View className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <Users size={40} color="#22c55e" />
      </View>
      <Text className="block text-xl font-semibold text-gray-800 mb-2">
        房间已创建
      </Text>
      <Text className="block text-sm text-gray-500 mb-6">
        {createdGroup?.name}
      </Text>
      
      {/* 邀请码 */}
      <Card className="w-full mb-6">
        <CardContent className="p-4">
          <Text className="block text-xs text-gray-400 mb-2">邀请码</Text>
          <View className="flex items-center justify-between">
            <Text className="block text-2xl font-bold text-blue-600 tracking-wider">
              {createdGroup?.invite_code}
            </Text>
            <Button variant="ghost" size="sm" onClick={copyInviteCode}>
              {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} color="#666" />}
            </Button>
          </View>
        </CardContent>
      </Card>

      {/* 分享按钮 */}
      {/* 分享按钮 - 使用原生 Button 实现 open-type="share" */}
      <Button
        className="w-full mb-3"
        open-type="share"
      >
        <Text className="block">邀请好友加入</Text>
      </Button>

      {/* 返回首页 */}
      <Button variant="outline" className="w-full" onClick={goToHome}>
        <Text className="block">进入房间</Text>
      </Button>
    </View>
  )

  // 渲染加入/创建房间表单
  const renderJoinForm = () => (
    <>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'join' | 'create')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="join">加入房间</TabsTrigger>
          <TabsTrigger value="create">创建房间</TabsTrigger>
        </TabsList>

        {/* 加入房间 */}
        <TabsContent value="join">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">输入房间号加入</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <View>
                <Label className="mb-2 block">房间号</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    placeholder="请输入房间号"
                    value={inviteCode}
                    onInput={(e: any) => setInviteCode(e.detail.value?.toUpperCase() || '')}
                    className="w-full bg-transparent"
                  />
                </View>
              </View>
              
              <View>
                <Label className="mb-2 block">您的昵称</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    placeholder="请输入昵称（可选）"
                    value={memberName}
                    onInput={(e: any) => setMemberName(e.detail.value || '')}
                    className="w-full bg-transparent"
                  />
                </View>
                <Text className="block text-xs text-gray-400 mt-1">
                  不填则使用微信昵称
                </Text>
              </View>

              <Button 
                className="w-full" 
                onClick={handleJoinGroup}
                disabled={loading || !inviteCode.trim()}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} color="#fff" className="mr-2" />
                    <Text className="block">加入中...</Text>
                  </>
                ) : (
                  <Text className="block">加入房间</Text>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 创建房间 */}
        <TabsContent value="create">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">创建新房间</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <View>
                <Label className="mb-2 block">房间名称</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    placeholder="给房间起个名字"
                    value={groupName}
                    onInput={(e: any) => setGroupName(e.detail.value || '')}
                    className="w-full bg-transparent"
                  />
                </View>
              </View>
              
              <View>
                <Label className="mb-2 block">您的昵称</Label>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    placeholder="请输入昵称（可选）"
                    value={memberName}
                    onInput={(e: any) => setMemberName(e.detail.value || '')}
                    className="w-full bg-transparent"
                  />
                </View>
                <Text className="block text-xs text-gray-400 mt-1">
                  不填则使用微信昵称
                </Text>
              </View>

              <Button 
                className="w-full" 
                onClick={handleCreateGroup}
                disabled={loading || !groupName.trim()}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} color="#fff" className="mr-2" />
                    <Text className="block">创建中...</Text>
                  </>
                ) : (
                  <Text className="block">创建房间</Text>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6">
      <Text className="block text-xl font-semibold text-gray-900 mb-6">
        {createdGroup ? '房间创建成功' : '加入或创建房间'}
      </Text>

      {createdGroup ? renderSharePanel() : renderJoinForm()}
    </View>
  )
}

export default JoinPage
