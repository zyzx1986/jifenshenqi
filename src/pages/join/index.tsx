import { useEffect, useState } from 'react'
import { Button as NativeButton, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { Check, Copy, RefreshCw, Users } from 'lucide-react-taro'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Network } from '@/network'
import { useGroupStore } from '@/stores/group'
import {
  cacheWechatProfile,
  getCachedWechatAvatarUrl,
  getCachedWechatNickname,
  resolveNickname,
} from '@/utils/wechatNickname'

const ROOM_NAME_PREFIXES = ['东风', '南风', '红中', '发财', '白板', '雀神', '牌友', '和牌']
const ROOM_NAME_SUFFIXES = ['牌局', '麻将房', '搓麻局', '友人局', '对战房', '练手局']

function createRandomRoomName() {
  const prefix = ROOM_NAME_PREFIXES[Math.floor(Math.random() * ROOM_NAME_PREFIXES.length)]
  const suffix = ROOM_NAME_SUFFIXES[Math.floor(Math.random() * ROOM_NAME_SUFFIXES.length)]
  const code = Math.floor(100 + Math.random() * 900)
  return `${prefix}${suffix}${code}`
}

export default function JoinPage() {
  const { setCurrentGroup, setCurrentMember, setMembers } = useGroupStore()
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('create')
  const [groupName, setGroupName] = useState(() => createRandomRoomName())
  const [inviteCode, setInviteCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  useEffect(() => {
    const cachedNickname = getCachedWechatNickname()
    const cachedAvatarUrl = getCachedWechatAvatarUrl()

    if (cachedNickname) {
      setMemberName(cachedNickname)
    }

    if (cachedAvatarUrl) {
      setAvatarUrl(cachedAvatarUrl)
    }
  }, [])

  const handleChooseAvatar = (event: any) => {
    const nextAvatarUrl = event?.detail?.avatarUrl || ''
    if (!nextAvatarUrl) {
      return
    }

    setAvatarUrl(nextAvatarUrl)
    cacheWechatProfile({ nickname: memberName, avatarUrl: nextAvatarUrl })
  }

  const handleNameInput = (value: string) => {
    setMemberName(value)
    cacheWechatProfile({ nickname: value, avatarUrl })
  }

  const getOrCreateUserId = () => {
    let userId = Taro.getStorageSync('userId')
    if (!userId) {
      userId = `user_${Date.now()}`
      Taro.setStorageSync('userId', userId)
    }
    return userId
  }

  const applyCurrentMember = (group: any, member: any) => {
    const nextMember = {
      ...member,
      avatar_url: avatarUrl || member.avatar_url || '',
    }

    setCurrentGroup(group)
    setCurrentMember(nextMember)
    setMembers([nextMember])
    Taro.setStorageSync('currentGroup', group)
    Taro.setStorageSync('currentMember', nextMember)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Taro.showToast({ title: '请输入房间名称', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const nickname = await resolveNickname(memberName)
      if (!nickname) {
        Taro.showToast({ title: '请先填写昵称', icon: 'none' })
        return
      }

      setMemberName(nickname)
      cacheWechatProfile({ nickname, avatarUrl })

      const token = Taro.getStorageSync('token')
      const userId = getOrCreateUserId()
      const res = await Network.request({
        url: '/api/groups/create',
        method: 'POST',
        data: {
          name: groupName.trim(),
          member_name: nickname,
          user_id: userId,
          avatar_url: avatarUrl,
        },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        applyCurrentMember(group, member)
        setCreatedGroup(group)
        Taro.showToast({ title: '创建成功', icon: 'success' })
        return
      }

      Taro.showToast({ title: result.msg || '创建失败', icon: 'none' })
    } catch (error) {
      console.error('create group failed:', error)
      Taro.showToast({ title: '创建失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Taro.showToast({ title: '请输入房间号', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const nickname = await resolveNickname(memberName)
      if (!nickname) {
        Taro.showToast({ title: '请先填写昵称', icon: 'none' })
        return
      }

      setMemberName(nickname)
      cacheWechatProfile({ nickname, avatarUrl })

      const token = Taro.getStorageSync('token')
      const userId = getOrCreateUserId()
      const res = await Network.request({
        url: '/api/groups/join',
        method: 'POST',
        data: {
          invite_code: inviteCode.trim().toUpperCase(),
          member_name: nickname,
          user_id: userId,
          avatar_url: avatarUrl,
        },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        applyCurrentMember(group, member)
        Taro.showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }, 600)
        return
      }

      Taro.showToast({ title: result.msg || '加入失败，请检查房间号', icon: 'none' })
    } catch (error) {
      console.error('join group failed:', error)
      Taro.showToast({ title: '加入失败，请检查房间号', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const copyInviteCode = () => {
    if (!createdGroup?.invite_code) {
      return
    }

    Taro.setClipboardData({
      data: createdGroup.invite_code,
      success: () => {
        setCopied(true)
        Taro.showToast({ title: '已复制', icon: 'none' })
        setTimeout(() => setCopied(false), 2000)
      },
    })
  }

  const goToHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const params = instance.router?.params || {}

    if (params.invite_code && params.invite_code !== 'undefined') {
      setInviteCode(String(params.invite_code).toUpperCase())
      setActiveTab('join')
    }
  })

  useShareAppMessage(() => {
    if (createdGroup) {
      return {
        title: `邀请你加入「${createdGroup.name}」`,
        path: `/pages/join/index?invite_code=${createdGroup.invite_code}`,
        imageUrl: '',
      }
    }

    return {
      title: '积分互赠小程序',
      path: '/pages/join/index',
      imageUrl: '',
    }
  })

  const renderProfileEditor = () => (
    <View>
      <Label className="mb-2 block">你的昵称</Label>
      <View className="mb-3 flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-blue-100 text-blue-600">
            <Text className="block text-sm font-semibold">{memberName.slice(0, 1) || '我'}</Text>
          </AvatarFallback>
        </Avatar>
        {isWeapp ? (
          <NativeButton
            openType="chooseAvatar"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-600"
            onChooseAvatar={handleChooseAvatar}
          >
            选择微信头像
          </NativeButton>
        ) : (
          <Text className="block text-xs text-gray-400">头像会优先使用微信小程序头像</Text>
        )}
      </View>
      <View className="rounded-xl bg-gray-50 px-4 py-3">
        <Input
          type={isWeapp ? ('nickname' as any) : 'text'}
          placeholder="请输入昵称"
          value={memberName}
          onInput={(event: any) => handleNameInput(event.detail.value || '')}
          className="w-full bg-transparent"
        />
      </View>
      <Text className="mt-1 block text-xs text-gray-400">
        微信里如果直接返回“微信用户”，需要你手动确认昵称，这是微信侧的隐私限制
      </Text>
    </View>
  )

  const renderSharePanel = () => (
    <View className="flex flex-col items-center px-4 py-8">
      <View className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <Users size={40} color="#22c55e" />
      </View>
      <Text className="mb-2 block text-xl font-semibold text-gray-800">房间已创建</Text>
      <Text className="mb-6 block text-sm text-gray-500">{createdGroup?.name}</Text>

      <Card className="mb-6 w-full">
        <CardContent className="p-4">
          <Text className="mb-2 block text-xs text-gray-400">邀请码</Text>
          <View className="flex items-center justify-between">
            <Text className="block text-2xl font-bold tracking-wider text-blue-600">
              {createdGroup?.invite_code}
            </Text>
            <Button variant="ghost" size="sm" onClick={copyInviteCode}>
              {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} color="#666" />}
            </Button>
          </View>
        </CardContent>
      </Card>

      <View className="mb-3 w-full">
        {isWeapp ? (
          <NativeButton openType="share" className="w-full rounded-xl bg-primary text-primary-foreground">
            <Text className="block">邀请好友加入</Text>
          </NativeButton>
        ) : (
          <Button className="w-full" onClick={copyInviteCode}>
            <Text className="block">复制邀请码</Text>
          </Button>
        )}
      </View>

      <Button variant="outline" className="w-full" onClick={goToHome}>
        <Text className="block">进入房间</Text>
      </Button>
    </View>
  )

  const renderJoinForm = () => (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'join' | 'create')}>
      <TabsList className="mb-4 grid w-full grid-cols-2">
        <TabsTrigger value="join">加入房间</TabsTrigger>
        <TabsTrigger value="create">创建房间</TabsTrigger>
      </TabsList>

      <TabsContent value="join">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base">输入房间号加入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Label className="mb-2 block">房间号</Label>
              <View className="rounded-xl bg-gray-50 px-4 py-3">
                <Input
                  placeholder="请输入房间号"
                  value={inviteCode}
                  onInput={(event: any) => setInviteCode((event.detail.value || '').toUpperCase())}
                  className="w-full bg-transparent"
                />
              </View>
            </View>

            {renderProfileEditor()}

            <Button className="w-full" onClick={handleJoinGroup} disabled={loading || !inviteCode.trim()}>
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

      <TabsContent value="create">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base">创建新房间</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Label className="mb-2 block">房间名称</Label>
              <View className="rounded-xl bg-gray-50 px-4 py-3">
                <Input
                  placeholder="给房间起个名字"
                  value={groupName}
                  onInput={(event: any) => setGroupName(event.detail.value || '')}
                  className="w-full bg-transparent"
                />
              </View>
            </View>

            {renderProfileEditor()}

            <Button className="w-full" onClick={handleCreateGroup} disabled={loading || !groupName.trim()}>
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
  )

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-6">
      <Text className="mb-6 block text-xl font-semibold text-gray-900">
        {createdGroup ? '房间创建成功' : '加入或创建房间'}
      </Text>
      {createdGroup ? renderSharePanel() : renderJoinForm()}
    </View>
  )
}
