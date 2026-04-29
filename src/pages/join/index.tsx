import { View, Text } from '@tarojs/components'
import { useLoad, showToast, switchTab } from '@tarojs/taro'
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
        showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/index/index' })
        }, 500)
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

  useLoad(() => {
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
    </View>
  )
}

export default JoinPage
