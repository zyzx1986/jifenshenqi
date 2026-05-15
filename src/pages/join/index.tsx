import { useEffect, useRef, useState } from 'react'
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
  ensureWechatPrivacyAuthorization,
  fetchWechatProfileWithPrompt,
  getCachedWechatAvatarUrl,
  getCachedWechatNickname,
  resolveNickname,
} from '@/utils/wechatNickname'

const ROOM_NAME_PREFIXES = ['东风', '南风', '红中', '发财', '白板', '雀神', '牌友', '和牌']
const ROOM_NAME_SUFFIXES = ['牌局', '麻将房', '欢乐局', '朋友局', '对战房', '练手房']
const LOG_PREFIX = '[join-wechat-profile]'

function createRandomRoomName() {
  const prefix = ROOM_NAME_PREFIXES[Math.floor(Math.random() * ROOM_NAME_PREFIXES.length)]
  const suffix = ROOM_NAME_SUFFIXES[Math.floor(Math.random() * ROOM_NAME_SUFFIXES.length)]
  const code = Math.floor(100 + Math.random() * 900)
  return `${prefix}${suffix}${code}`
}

function getWechatProfileFailureMessage(errorMessage: string) {
  if (errorMessage.includes('privacy')) {
    return '请先同意隐私授权，再获取微信资料'
  }

  if (errorMessage.includes('deny') || errorMessage.includes('cancel')) {
    return '你取消了微信资料授权，请手动填写昵称或重试'
  }

  return '未获取到微信资料，请手动填写昵称'
}

export default function JoinPage() {
  const { setCurrentGroup, setCurrentMember, setMembers } = useGroupStore()
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('create')
  const [groupName, setGroupName] = useState(() => createRandomRoomName())
  const [inviteCode, setInviteCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncingWechatProfile, setSyncingWechatProfile] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [choosingAvatar, setChoosingAvatar] = useState(false)
  const chooseAvatarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  const logWechatProfile = (step: string, detail?: unknown) => {
    if (detail === undefined) {
      console.log(LOG_PREFIX, step)
      return
    }

    console.log(LOG_PREFIX, step, detail)
  }

  useEffect(() => {
    const cachedNickname = getCachedWechatNickname()
    const cachedAvatarUrl = getCachedWechatAvatarUrl()

    if (cachedNickname) {
      setMemberName(cachedNickname)
    }

    if (cachedAvatarUrl) {
      setAvatarUrl(cachedAvatarUrl)
    }

    return () => {
      if (chooseAvatarTimerRef.current) {
        clearTimeout(chooseAvatarTimerRef.current)
        chooseAvatarTimerRef.current = null
      }
    }
  }, [])

  const applyLocalWechatProfile = (profile: { nickname?: string; avatarUrl?: string }) => {
    if (profile.nickname) {
      setMemberName(profile.nickname)
    }

    if (profile.avatarUrl) {
      setAvatarUrl(profile.avatarUrl)
    }

    cacheWechatProfile({
      nickname: profile.nickname ?? memberName,
      avatarUrl: profile.avatarUrl ?? avatarUrl,
    })
  }

  const resetChooseAvatarLock = () => {
    if (chooseAvatarTimerRef.current) {
      clearTimeout(chooseAvatarTimerRef.current)
      chooseAvatarTimerRef.current = null
    }
    setChoosingAvatar(false)
  }

  const handleChooseAvatarStart = async () => {
    if (choosingAvatar) {
      Taro.showToast({ title: '正在准备头像选择，请稍候', icon: 'none' })
      return
    }

    logWechatProfile('chooseAvatar:start')
    const privacyResult = await ensureWechatPrivacyAuthorization('join:choose-avatar')
    logWechatProfile('chooseAvatar:privacyResult', privacyResult)

    if (!privacyResult.authorized) {
      Taro.showToast({
        title: getWechatProfileFailureMessage(privacyResult.errorMessage),
        icon: 'none',
      })
      return
    }

    setChoosingAvatar(true)
    chooseAvatarTimerRef.current = setTimeout(() => {
      resetChooseAvatarLock()
    }, 3000)

    if (privacyResult.needAuthorization) {
      Taro.showToast({ title: '隐私已授权，请再点一次选择头像', icon: 'none' })
    }
  }

  const handleChooseAvatar = (event: any) => {
    resetChooseAvatarLock()
    logWechatProfile('chooseAvatar:result', event?.detail)

    const nextAvatarUrl = event?.detail?.avatarUrl || ''
    if (!nextAvatarUrl) {
      Taro.showToast({ title: '没有拿到微信头像，请重试', icon: 'none' })
      return
    }

    applyLocalWechatProfile({ avatarUrl: nextAvatarUrl })
    Taro.showToast({ title: '微信头像已更新', icon: 'success' })
  }

  const handleSyncWechatProfile = async () => {
    if (!isWeapp || syncingWechatProfile) {
      return
    }

    setSyncingWechatProfile(true)
    logWechatProfile('sync:start', { memberName, hasAvatar: Boolean(avatarUrl) })

    try {
      const result = await fetchWechatProfileWithPrompt({
        force: true,
        trigger: 'join:manual-sync',
      })

      logWechatProfile('sync:result', result)

      if (result.nickname || result.avatarUrl) {
        applyLocalWechatProfile(result)
        Taro.showToast({
          title: result.avatarUrl ? '已同步微信昵称和头像' : '已同步微信昵称',
          icon: 'success',
        })
        return
      }

      Taro.showToast({
        title: getWechatProfileFailureMessage(result.errorMessage),
        icon: 'none',
      })
    } finally {
      setSyncingWechatProfile(false)
    }
  }

  const handleNameInput = (value: string) => {
    setMemberName(value)
    cacheWechatProfile({ nickname: value, avatarUrl })
  }

  const handleNicknameReview = (event: any) => {
    logWechatProfile('nickname:review', event?.detail)
    if (event?.detail?.pass === false) {
      Taro.showToast({ title: '昵称未通过微信校验，请手动调整', icon: 'none' })
    }
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

  const resolveSubmitNickname = async (trigger: 'join' | 'create') => {
    const nickname = await resolveNickname(memberName, {
      trigger: `join:${trigger}:submit`,
    })

    logWechatProfile(`${trigger}:resolvedNickname`, { nickname })

    if (!nickname) {
      Taro.showToast({
        title: isWeapp ? '请手动填写昵称，或点“使用微信资料”' : '请先填写昵称',
        icon: 'none',
      })
      return ''
    }

    setMemberName(nickname)
    cacheWechatProfile({ nickname, avatarUrl })
    return nickname
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Taro.showToast({ title: '请输入房间名称', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const nickname = await resolveSubmitNickname('create')
      if (!nickname) {
        return
      }

      const token = Taro.getStorageSync('token')
      const userId = getOrCreateUserId()
      logWechatProfile('create:request', {
        name: groupName.trim(),
        nickname,
        hasAvatar: Boolean(avatarUrl),
      })

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
      logWechatProfile('create:response', result)

      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        applyCurrentMember(group, member)
        setCreatedGroup(group)
        Taro.showToast({ title: '创建房间成功', icon: 'success' })
        return
      }

      Taro.showToast({ title: result.msg || '创建房间失败', icon: 'none' })
    } catch (error) {
      console.error('create group failed:', error)
      Taro.showToast({ title: '创建房间失败，请稍后重试', icon: 'none' })
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
      const nickname = await resolveSubmitNickname('join')
      if (!nickname) {
        return
      }

      const token = Taro.getStorageSync('token')
      const userId = getOrCreateUserId()
      logWechatProfile('join:request', {
        inviteCode: inviteCode.trim().toUpperCase(),
        nickname,
        hasAvatar: Boolean(avatarUrl),
      })

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
      logWechatProfile('join:response', result)

      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        applyCurrentMember(group, member)
        Taro.showToast({ title: '加入房间成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }, 600)
        return
      }

      Taro.showToast({ title: result.msg || '加入房间失败，请检查房间号', icon: 'none' })
    } catch (error) {
      console.error('join group failed:', error)
      Taro.showToast({ title: '加入房间失败，请检查房间号', icon: 'none' })
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
        Taro.showToast({ title: '邀请码已复制', icon: 'none' })
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
    <View className="space-y-3">
      <Label className="block">你的昵称</Label>

      <View className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-blue-100 text-blue-600">
            <Text className="block text-sm font-semibold">{memberName.slice(0, 1) || '我'}</Text>
          </AvatarFallback>
        </Avatar>

        {isWeapp ? (
          <View className="flex flex-1 gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSyncWechatProfile}
              disabled={syncingWechatProfile}
            >
              <Text className="block">
                {syncingWechatProfile ? '同步中...' : '使用微信资料'}
              </Text>
            </Button>
            <NativeButton
              openType={choosingAvatar ? undefined : ('chooseAvatar' as any)}
              className="flex-1 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-600"
              onClick={handleChooseAvatarStart}
              onChooseAvatar={handleChooseAvatar}
            >
              选择微信头像
            </NativeButton>
          </View>
        ) : (
          <Text className="block text-xs text-gray-400">头像优先使用微信小程序头像</Text>
        )}
      </View>

      <View className="rounded-xl bg-gray-50 px-4 py-3">
        <Input
          type={isWeapp ? ('nickname' as any) : 'text'}
          placeholder="请输入昵称"
          value={memberName}
          onInput={(event: any) => handleNameInput(event.detail.value || '')}
          onNickNameReview={handleNicknameReview}
          className="w-full bg-transparent"
        />
      </View>

      <Text className="block text-xs leading-5 text-gray-400">
        现在创建房间页不会自动拉取微信昵称。推荐先点“使用微信资料”，如果微信只返回“微信用户”，请再手动改一下昵称。
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
          <NativeButton openType="share" className="w-full rounded-xl bg-primary py-3 text-center text-primary-foreground">
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
