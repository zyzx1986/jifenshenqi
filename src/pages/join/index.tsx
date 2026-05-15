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

const MEMBER_NAME_STORAGE_KEY = 'joinRandomMemberName'
const ROOM_NAME_STORAGE_KEY = 'joinCreativeRoomName'

const RANDOM_MEMBER_NAMES = [
  '胡了再说',
  '别点我炮',
  '这把能赢',
  '我真不贪',
  '差一张胡',
  '手牌有戏',
  '运气加载中',
  '再来一圈',
  '先苟一手',
  '牌桌观察员',
  '嘴硬手更硬',
  '今天不背锅',
  '东风不困',
  '南墙会胡',
  '红中已到',
  '白板不白',
  '今晚自摸',
  '先碰为敬',
  '杠上开花',
  '一筒选手',
  '二条很稳',
  '三万别慌',
  '摸牌小能手',
  '听牌研究员',
  '碰一下就走',
  '清一色梦想家',
  '暗杠预备役',
  '平胡保守派',
  '吃碰都很忙',
  '牌好别催',
  '只会小胡',
  '差点天胡',
  '门清小王子',
  '巡河捡灵感',
  '上桌先微笑',
  '一看就会输',
  '没胡但很稳',
  '越输越精神',
  '再摸一张嘛',
  '别慌我能送',
  '今天手感热',
  '不胡不睡觉',
  '碰碰碰专家',
  '弃胡保平安',
  '牌运体验官',
  '先看你表演',
  '这圈别算我',
  '刚刚差一点',
  '胡牌申请中',
  '马上就翻盘',
  '别催在算番',
  '稳住别拆牌',
  '这张不能打',
  '谁动我听牌',
  '一手好心态',
  '起手有点飘',
  '残局收割机',
  '放炮绝缘体',
  '碰完再思考',
  '字牌收藏家',
  '摸牌靠缘分',
  '常驻第二名',
  '这局不冒进',
  '专治不服局',
  '只差好运气',
  '牌桌段子手',
  '认真但不久',
  '发牌别针对',
  '靠直觉拆牌',
  '点炮免疫中',
  '今天就离谱',
  '巡回胡牌员',
  '慢热型选手',
  '沉着碰三家',
  '看我这手气',
  '躺赢候选人',
  '小胡也开心',
  '这次真有戏',
  '快给我来张',
  '万一就胡了',
  '稳中带皮',
  '笑着上分',
  '碰牌发言人',
  '今天不拆搭',
  '手顺爱好者',
  '不急先看看',
  '牌桌许愿池',
  '看牌不看人',
  '这手能养',
  '胡牌慢半拍',
  '今晚别演我',
  '不服再开一局',
  '一局一个奇迹',
  '小杠也精彩',
  '摸牌不眨眼',
  '能苟就能赢',
  '安静等上听',
  '运势回暖中',
  '今天该我顺',
  '别逼我清一色',
  '牌浪有点大',
  '谁还没个番',
  '打牌靠气质',
  '开局先观望',
  '这把有门道',
  '听牌小天才',
  '翻盘进行时',
  '今晚不空军',
  '专门捡好牌',
  '不胡先不走',
  '我先稳一稳',
  '别拆我搭子',
  '上听即巅峰',
  '摸牌不摸鱼',
  '手里全是戏',
  '临门差一脚',
  '只求别点炮',
  '胡牌气氛组',
  '今天有牌缘',
  '再等等就胡',
  '小输当热身',
  '这牌真会说话',
  '稳扎稳胡',
  '快乐碰碰员',
  '输得很体面',
  '低调做大番',
  '等风也等牌',
  '听牌不声张',
  '手气回来了',
  '下一张就到',
  '这把先忍住',
  '我有点门清',
  '认真摸牌中',
  '赢面研究生',
  '牌桌冷知识',
  '别急我在算',
  '稳健不放铳',
  '不急着开胡',
  '摸到就是缘',
  '今天主打陪伴',
  '番数自由人',
  '好牌正在路上',
]

const CREATIVE_ROOM_NAMES = [
  '东风小满局',
  '红中碰碰房',
  '今晚有胡局',
  '牌来运转房',
  '顺风开杠局',
  '自摸好运局',
  '一起冲分房',
  '欢乐摸牌局',
  '听牌研究所',
  '今夜上桌局',
  '手气正热房',
  '满堂开花局',
  '云上牌局',
  '星夜对战房',
  '松风听牌局',
  '满月开局房',
  '长街碰牌社',
  '半山胡牌局',
  '春风开杠房',
  '烟火冲分局',
  '晚风牌友社',
  '清一色俱乐部',
  '好运营业中',
  '今晚必胡社',
  '牌桌好运站',
  '连胡试验场',
  '摸牌气氛组',
  '不点炮联盟',
  '快乐碰牌屋',
  '今晚翻盘社',
  '稳住能胡局',
  '再来一把馆',
  '杠后见真章',
  '四圈不散场',
  '好运慢慢来',
  '摸一张就胡',
  '东风会客厅',
  '红中营业部',
  '今晚有戏房',
  '一摸就顺局',
  '清风开牌社',
  '月下听牌局',
  '山顶碰牌馆',
  '好运不散场',
  '烟火牌友局',
  '夜色冲榜房',
  '顺手来一局',
  '碰牌研究会',
  '月圆开杠社',
  '轻松上分房',
  '牌局散步社',
  '风起胡牌局',
  '热手暖场馆',
  '慢慢都能胡',
  '今晚手真顺',
  '来都来了局',
  '一坐就来牌',
  '笑着开胡房',
  '别慌能胡社',
  '满分手气局',
  '摸牌许愿屋',
  '今晚就翻盘',
  '胡牌碰碰站',
  '好运练习室',
  '深夜听牌社',
  '牌桌故事会',
  '稳稳来一圈',
  '小满开局馆',
  '春夜碰牌房',
  '慢热好运局',
  '牌缘集合点',
  '上桌别空手',
  '开胡候车室',
  '风月牌友社',
  '碰牌不打烊',
]

function getRandomItem(list: string[]) {
  return list[Math.floor(Math.random() * list.length)]
}

function createRandomNickname() {
  return getRandomItem(RANDOM_MEMBER_NAMES)
}

function createCreativeRoomName() {
  return getRandomItem(CREATIVE_ROOM_NAMES)
}

export default function JoinPage() {
  const { setCurrentGroup, setCurrentMember, setMembers } = useGroupStore()
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('create')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  useEffect(() => {
    const cachedMemberName = Taro.getStorageSync(MEMBER_NAME_STORAGE_KEY) || ''
    const cachedRoomName = Taro.getStorageSync(ROOM_NAME_STORAGE_KEY) || ''

    const nextMemberName = cachedMemberName || createRandomNickname()
    const nextRoomName = cachedRoomName || createCreativeRoomName()

    setMemberName(nextMemberName)
    setGroupName(nextRoomName)

    Taro.setStorageSync(MEMBER_NAME_STORAGE_KEY, nextMemberName)
    Taro.setStorageSync(ROOM_NAME_STORAGE_KEY, nextRoomName)
  }, [])

  const refreshRandomNickname = () => {
    const randomName = createRandomNickname()
    setMemberName(randomName)
    Taro.setStorageSync(MEMBER_NAME_STORAGE_KEY, randomName)
  }

  const refreshRoomName = () => {
    const randomRoomName = createCreativeRoomName()
    setGroupName(randomRoomName)
    Taro.setStorageSync(ROOM_NAME_STORAGE_KEY, randomRoomName)
  }

  const handleNameInput = (value: string) => {
    setMemberName(value)
    Taro.setStorageSync(MEMBER_NAME_STORAGE_KEY, value)
  }

  const handleRoomNameInput = (value: string) => {
    setGroupName(value)
    Taro.setStorageSync(ROOM_NAME_STORAGE_KEY, value)
  }

  const getOrCreateUserId = () => {
    let userId = Taro.getStorageSync('userId')
    if (!userId) {
      userId = `user_${Date.now()}`
      Taro.setStorageSync('userId', userId)
    }
    return userId
  }

  const applyCurrentMember = (group: any, member: any, nextName: string) => {
    const nextMember = {
      ...member,
      name: nextName,
      avatar_url: '',
    }

    setCurrentGroup(group)
    setCurrentMember(nextMember)
    setMembers([nextMember])
    Taro.setStorageSync('currentGroup', group)
    Taro.setStorageSync('currentMember', nextMember)
  }

  const resolveSubmitNickname = () => {
    const nextName = memberName.trim()
    if (!nextName) {
      Taro.showToast({ title: '请填写昵称', icon: 'none' })
      return ''
    }

    Taro.setStorageSync(MEMBER_NAME_STORAGE_KEY, nextName)
    return nextName
  }

  const resolveSubmitRoomName = () => {
    const nextRoomName = groupName.trim()
    if (!nextRoomName) {
      Taro.showToast({ title: '请输入房间名称', icon: 'none' })
      return ''
    }

    Taro.setStorageSync(ROOM_NAME_STORAGE_KEY, nextRoomName)
    return nextRoomName
  }

  const handleCreateGroup = async () => {
    const nextRoomName = resolveSubmitRoomName()
    if (!nextRoomName) {
      return
    }

    const nextName = resolveSubmitNickname()
    if (!nextName) {
      return
    }

    setLoading(true)
    try {
      const token = Taro.getStorageSync('token')
      const userId = getOrCreateUserId()
      const res = await Network.request({
        url: '/api/groups/create',
        method: 'POST',
        data: {
          name: nextRoomName,
          member_name: nextName,
          user_id: userId,
          avatar_url: '',
        },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        applyCurrentMember(group, member, nextName)
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

    const nextName = resolveSubmitNickname()
    if (!nextName) {
      return
    }

    setLoading(true)
    try {
      const token = Taro.getStorageSync('token')
      const userId = getOrCreateUserId()
      const res = await Network.request({
        url: '/api/groups/join',
        method: 'POST',
        data: {
          invite_code: inviteCode.trim().toUpperCase(),
          member_name: nextName,
          user_id: userId,
          avatar_url: '',
        },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const result = res.data as any
      if (result.code === 200 && result.data) {
        const { group, member } = result.data
        applyCurrentMember(group, member, nextName)
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
      <View className="flex items-center justify-between">
        <Label className="block">你的昵称</Label>
        <Button variant="outline" size="sm" onClick={refreshRandomNickname}>
          <RefreshCw size={14} color="#666" />
          <Text className="block">换个昵称</Text>
        </Button>
      </View>

      <View className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src="" />
          <AvatarFallback className="bg-blue-100 text-blue-600">
            <Text className="block text-sm font-semibold">{memberName.slice(0, 1) || '我'}</Text>
          </AvatarFallback>
        </Avatar>
        <Text className="block text-xs leading-5 text-gray-400">
          当前版本使用文字头像，不再获取微信头像和微信昵称。随机名和你手动改过的内容都会自动记住。
        </Text>
      </View>

      <View className="rounded-xl bg-gray-50 px-4 py-3">
        <Input
          type="text"
          placeholder="请输入昵称"
          value={memberName}
          onInput={(event: any) => handleNameInput(event.detail.value || '')}
          className="w-full bg-transparent"
        />
      </View>
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
            <View className="flex items-center justify-between">
              <CardTitle className="text-base">创建新房间</CardTitle>
              <Button variant="outline" size="sm" onClick={refreshRoomName}>
                <RefreshCw size={14} color="#666" />
                <Text className="block">换个房名</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Label className="mb-2 block">房间名称</Label>
              <View className="rounded-xl bg-gray-50 px-4 py-3">
                <Input
                  placeholder="给房间起个名字"
                  value={groupName}
                  onInput={(event: any) => handleRoomNameInput(event.detail.value || '')}
                  className="w-full bg-transparent"
                />
              </View>
            </View>

            <Text className="block text-xs leading-5 text-gray-400">
              默认房名会从创意库里随机生成，也会记住你上次随机到或手动改过的房间名。
            </Text>

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
