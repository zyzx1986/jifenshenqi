import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { Crown, Gamepad2, Trophy } from 'lucide-react-taro'
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

export default function Stats() {
  const { currentGroup } = useGroupStore()
  const [stats, setStats] = useState<GameStats | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameHistory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentGroup?.invite_code) {
      loadStats()
      return
    }

    setStats(null)
    setLoading(false)
  }, [currentGroup?.invite_code])

  useDidShow(() => {
    if (currentGroup?.invite_code) {
      loadStats()
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
      console.error('加载战绩失败:', error)
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
        <Text className="mt-4 block text-sm text-gray-500">暂时还没有已结束的对局</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="h-screen px-4 py-4">
        {stats.fun_facts?.length > 0 && (
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
        )}

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
                <Text className="mt-1 block text-xs text-gray-400">总给分次数</Text>
              </View>
              <View className="h-10 w-px bg-gray-100" />
              <View className="flex-1 items-center">
                <Text className="block text-2xl font-bold text-blue-600">{stats.participants.length}</Text>
                <Text className="mt-1 block text-xs text-gray-400">参与玩家</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="mb-3 flex items-center">
              <Trophy size={18} color="#f59e0b" />
              <Text className="ml-2 block text-sm font-semibold text-gray-800">本局分排行榜</Text>
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
                <Text
                  className={`block text-sm font-semibold ${
                    player.total_score > 0 ? 'text-green-600' : player.total_score < 0 ? 'text-red-500' : 'text-blue-600'
                  }`}
                >
                  {player.total_score > 0 ? '+' : ''}
                  {player.total_score}
                </Text>
              </View>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <View className="mb-3 flex items-center">
              <Gamepad2 size={18} color="#3b82f6" />
              <Text className="ml-2 block text-sm font-semibold text-gray-800">最近对局</Text>
            </View>

            {stats.recent_games.map((game, index) => (
              <View
                key={game.id}
                className={`${index === 0 ? '' : 'mt-3 border-t border-gray-100 pt-3'}`}
                onClick={() => setSelectedGame(game)}
              >
                <View className="flex items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="block text-sm font-medium text-gray-800">{game.room_name}</Text>
                    <Text className="mt-1 block text-xs text-gray-400">
                      {formatDate(game.created_at)} · {game.total_rounds} 次给分
                    </Text>
                  </View>
                  <Text className="block text-xs text-blue-600">查看详情</Text>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      </ScrollView>

      {selectedGame && (
        <View
          className="fixed inset-0 z-50 flex items-end px-4 pb-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setSelectedGame(null)}
        >
          <View className="max-h-[80vh] w-full rounded-3xl bg-white" onClick={(event) => event.stopPropagation()}>
            <ScrollView scrollY className="max-h-[80vh]">
              <View className="p-5">
                <Text className="block text-lg font-semibold text-gray-900">{selectedGame.room_name}</Text>
                <Text className="mt-1 block text-xs text-gray-400">{formatDate(selectedGame.created_at)}</Text>

                <View className="mt-5">
                  <Text className="block text-sm font-semibold text-gray-800">最终排名</Text>
                  <View className="mt-3">
                    {[...selectedGame.participants]
                      .sort((a, b) => (b.score || 0) - (a.score || 0))
                      .map((player, index) => (
                        <View
                          key={`${player.member_id}_${index}`}
                          className={`${index === 0 ? '' : 'mt-3 border-t border-gray-100 pt-3'} flex items-center`}
                        >
                          <View className="w-8 items-center">
                            <Text className="block text-sm text-gray-400">{index + 1}</Text>
                          </View>
                          <Text className="block flex-1 text-sm text-gray-800">{player.name}</Text>
                          <Text
                            className={`block text-sm font-semibold ${
                              player.score > 0 ? 'text-green-600' : player.score < 0 ? 'text-red-500' : 'text-blue-600'
                            }`}
                          >
                            {player.score > 0 ? '+' : ''}
                            {player.score || 0}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>

                <View className="mt-6">
                  <Text className="block text-sm font-semibold text-gray-800">回合详情</Text>
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
                          <Text className="mt-1 block text-xs text-gray-400">
                            {new Date(round.timestamp).toLocaleTimeString()}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="block text-sm text-gray-400">没有记录到回合详情</Text>
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
      )}
    </View>
  )
}
