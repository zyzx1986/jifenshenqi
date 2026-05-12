import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { Crown, Gamepad2, Trophy, Users } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { useGroupStore } from '@/stores/group'
import './index.scss'

interface GameRound {
  from: string
  to: string
  points: number
  reason?: string
  timestamp: number
}

interface GameParticipant {
  member_id: string
  name: string
  score: number
}

interface GameHistory {
  id: string
  room_name: string
  participants: GameParticipant[]
  rounds: GameRound[]
  total_rounds: number
  created_at: string
  end_time?: string
}

interface GameStats {
  total_games: number
  total_rounds: number
  participants: Array<{
    member_id: string
    name: string
    total_score: number
    game_count: number
  }>
  rankings: Array<{
    member_id: string
    name: string
    total_score: number
    game_count: number
  }>
  fun_facts: string[]
  recent_games: GameHistory[]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)))

  if (minutes < 60) {
    return `${minutes} 分钟前`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} 小时前`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return `${days} 天前`
  }

  return formatDate(dateStr)
}

function sortParticipants(participants: GameParticipant[]) {
  return [...participants].sort((a, b) => (b.score || 0) - (a.score || 0))
}

function getWinner(participants: GameParticipant[]) {
  return sortParticipants(participants)[0] || null
}

function getParticipantPreview(participants: GameParticipant[]) {
  return participants.map((participant) => participant.name).join('、')
}

function getScoreText(score: number) {
  if (score > 0) {
    return `+${score}`
  }

  return `${score || 0}`
}

function getScoreClassName(score: number) {
  if (score > 0) {
    return 'text-green-600'
  }

  if (score < 0) {
    return 'text-red-500'
  }

  return 'text-blue-600'
}

export default function Stats() {
  const { currentGroup } = useGroupStore()
  const [stats, setStats] = useState<GameStats | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentGroup?.invite_code) {
      void loadStats()
      return
    }

    setStats(null)
    setLoading(false)
  }, [currentGroup?.invite_code])

  useDidShow(() => {
    if (currentGroup?.invite_code) {
      void loadStats()
    }
  })

  const loadStats = async () => {
    if (!currentGroup?.invite_code) {
      return
    }

    setLoading(true)
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/game/stats',
        method: 'GET',
        data: { invite_code: currentGroup.invite_code },
        header: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if ((res.data as any)?.code === 200) {
        setStats((res.data as any).data)
      }
    } catch (error) {
      console.error('load stats failed:', error)
      Taro.showToast({ title: '加载战绩失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (!currentGroup) {
    return (
      <View className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
        <Gamepad2 size={64} color="#cbd5e1" />
        <Text className="mt-4 block text-sm text-gray-500">请先加入房间</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="flex min-h-screen items-center justify-center bg-gray-50">
        <Text className="block text-sm text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (!stats || stats.total_games === 0) {
    return (
      <View className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
        <Trophy size={64} color="#cbd5e1" />
        <Text className="mt-4 block text-sm text-gray-500">这个房间还没有已结束的对局</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="h-screen px-4 py-4">
        {stats.fun_facts?.length > 0 ? (
          <Card className="mb-4 border-amber-100 bg-amber-50">
            <CardContent className="p-4">
              {stats.fun_facts.map((fact, index) => (
                <View key={`${fact}_${index}`} className={`${index === 0 ? '' : 'mt-2'} flex items-center`}>
                  <Crown size={16} color="#f59e0b" />
                  <Text className="ml-2 block text-sm text-amber-700">{fact}</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <View className="flex-1 items-center">
                <Text className="block text-2xl font-bold text-blue-600">{stats.total_games}</Text>
                <Text className="mt-1 block text-xs text-gray-400">已结束对局</Text>
              </View>
              <View className="h-10 w-px bg-gray-100" />
              <View className="flex-1 items-center">
                <Text className="block text-2xl font-bold text-blue-600">{stats.total_rounds}</Text>
                <Text className="mt-1 block text-xs text-gray-400">总送分轮次</Text>
              </View>
              <View className="h-10 w-px bg-gray-100" />
              <View className="flex-1 items-center">
                <Text className="block text-2xl font-bold text-blue-600">{stats.participants.length}</Text>
                <Text className="mt-1 block text-xs text-gray-400">参与成员</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="mb-3 flex items-center">
              <Trophy size={18} color="#f59e0b" />
              <Text className="ml-2 block text-sm font-semibold text-gray-800">房间累计战绩</Text>
            </View>

            {stats.rankings.map((player, index) => (
              <View
                key={player.member_id}
                className={`${index === 0 ? '' : 'mt-3 border-t border-gray-100 pt-3'} flex items-center`}
              >
                <View className="w-8 items-center">
                  <Text className="block text-sm text-gray-400">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="block text-sm font-medium text-gray-800">{player.name}</Text>
                  <Text className="mt-1 block text-xs text-gray-400">{player.game_count} 局</Text>
                </View>
                <Text className={`block text-sm font-semibold ${getScoreClassName(player.total_score)}`}>
                  {getScoreText(player.total_score)}
                </Text>
              </View>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <View className="mb-3 flex items-center">
              <Users size={18} color="#3b82f6" />
              <Text className="ml-2 block text-sm font-semibold text-gray-800">最近对局</Text>
            </View>

            {stats.recent_games.map((game, index) => {
              const winner = getWinner(game.participants)

              return (
                <View
                  key={game.id}
                  className={`${index === 0 ? '' : 'mt-3 border-t border-gray-100 pt-3'}`}
                  onClick={() => setSelectedGame(game)}
                >
                  <View className="flex items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="block text-sm font-medium text-gray-800">
                        {game.room_name || currentGroup.name}
                      </Text>
                      <Text className="mt-1 block text-xs text-gray-400">
                        {formatRelativeTime(game.created_at)} · {game.participants.length} 人局 · {game.total_rounds} 轮
                      </Text>
                      <Text className="mt-2 block text-xs text-gray-500">
                        参与成员：{getParticipantPreview(game.participants)}
                      </Text>
                      <Text className="mt-1 block text-xs text-blue-600">
                        第一名：{winner?.name || '未知'} {winner ? `(${getScoreText(winner.score)})` : ''}
                      </Text>
                    </View>
                    <Text className="block text-xs text-blue-600">查看详情</Text>
                  </View>
                </View>
              )
            })}
          </CardContent>
        </Card>
      </ScrollView>

      {selectedGame ? (
        <View
          className="fixed inset-0 z-50 flex items-end px-4 pb-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setSelectedGame(null)}
        >
          <View className="max-h-[80vh] w-full rounded-3xl bg-white" onClick={(event) => event.stopPropagation()}>
            <ScrollView scrollY className="max-h-[80vh]">
              <View className="p-5">
                <Text className="block text-lg font-semibold text-gray-900">
                  {selectedGame.room_name || currentGroup.name}
                </Text>
                <Text className="mt-1 block text-xs text-gray-400">
                  {formatDate(selectedGame.created_at)} · {selectedGame.participants.length} 人局 · {selectedGame.total_rounds} 轮
                </Text>

                <View className="mt-5">
                  <Text className="block text-sm font-semibold text-gray-800">最终排名</Text>
                  <View className="mt-3">
                    {sortParticipants(selectedGame.participants).map((player, index) => (
                      <View
                        key={`${player.member_id}_${index}`}
                        className={`${index === 0 ? '' : 'mt-3 border-t border-gray-100 pt-3'} flex items-center`}
                      >
                        <View className="w-8 items-center">
                          <Text className="block text-sm text-gray-400">{index + 1}</Text>
                        </View>
                        <Text className="block flex-1 text-sm text-gray-800">{player.name}</Text>
                        <Text className={`block text-sm font-semibold ${getScoreClassName(player.score)}`}>
                          {getScoreText(player.score)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className="mt-6">
                  <Text className="block text-sm font-semibold text-gray-800">回合明细</Text>
                  <View className="mt-3">
                    {selectedGame.rounds?.length ? (
                      [...selectedGame.rounds].reverse().map((round, index) => (
                        <View
                          key={`${round.timestamp}_${index}`}
                          className={`${index === 0 ? '' : 'mt-3 border-t border-gray-100 pt-3'}`}
                        >
                          <Text className="block text-sm text-gray-800">
                            {round.from} 给了 {round.to} {round.points} 分
                          </Text>
                          {round.reason ? (
                            <Text className="mt-1 block text-xs text-gray-500">{round.reason}</Text>
                          ) : null}
                          <Text className="mt-1 block text-xs text-gray-400">
                            {new Date(round.timestamp).toLocaleTimeString()}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="block text-sm text-gray-400">这局还没有记录到回合明细</Text>
                    )}
                  </View>
                </View>

                <View className="mt-6">
                  <Button className="w-full" onClick={() => setSelectedGame(null)}>
                    <Text className="block">关闭</Text>
                  </Button>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  )
}
