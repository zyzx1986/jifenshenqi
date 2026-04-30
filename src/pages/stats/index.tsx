import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Network } from '@/network'
import { useGroupStore } from '@/stores/group'
import Taro from '@tarojs/taro'
import { Trophy, TrendingUp, Users, Gamepad2, Crown, Target, ArrowLeft } from 'lucide-react-taro'
import './index.scss'

interface GameStats {
  total_games: number
  total_rounds: number
  participants: any[]
  rankings: any[]
  fun_facts: string[]
  recent_games: any[]
}

interface GameHistory {
  id: string
  room_name: string
  participants: any[]
  total_rounds: number
  created_at: string
}

export default function Stats() {
  const [stats, setStats] = useState<GameStats | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const { currentGroup } = useGroupStore()

  useEffect(() => {
    if (currentGroup?.invite_code) {
      loadStats()
    }
  }, [currentGroup])

  const loadStats = async () => {
    if (!currentGroup?.invite_code) return
    
    try {
      const token = Taro.getStorageSync('token')
      const res = await Network.request({
        url: '/api/groups/game/stats',
        method: 'GET',
        data: { invite_code: currentGroup.invite_code },
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (err) {
      console.error('加载战绩失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const min = date.getMinutes()
    return `${month}月${day}日 ${hour}:${min.toString().padStart(2, '0')}`
  }

  if (!currentGroup) {
    return (
      <View className='stats-empty'>
        <Gamepad2 size={64} color='#ccc' />
        <Text className='block mt-4 text-gray-500'>请先加入房间</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View className='stats-loading'>
        <Text className='block text-gray-500'>加载中...</Text>
      </View>
    )
  }

  if (!stats || stats.total_games === 0) {
    return (
      <View className='stats-empty'>
        <Trophy size={64} color='#ccc' />
        <Text className='block mt-4 text-gray-500'>暂无战绩</Text>
        <Text className='block mt-2 text-gray-400 text-sm'>开始对局后，这里会显示统计数据</Text>
      </View>
    )
  }

  return (
    <ScrollView className='stats-container' scrollY>
      {/* 趣味数据 */}
      {stats.fun_facts && stats.fun_facts.length > 0 && (
        <View className='stats-fun-facts'>
          {stats.fun_facts.map((fact, idx) => (
            <View key={idx} className='fun-fact-item'>
              <Crown size={16} color='#f59e0b' />
              <Text className='block text-sm ml-2'>{fact}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 总览数据 */}
      <View className='stats-overview'>
        <View className='overview-item'>
          <Text className='block text-2xl font-bold text-primary'>{stats.total_games}</Text>
          <Text className='block text-xs text-gray-500 mt-1'>总对局</Text>
        </View>
        <View className='overview-divider' />
        <View className='overview-item'>
          <Text className='block text-2xl font-bold text-primary'>{stats.total_rounds}</Text>
          <Text className='block text-xs text-gray-500 mt-1'>总给分</Text>
        </View>
        <View className='overview-divider' />
        <View className='overview-item'>
          <Text className='block text-2xl font-bold text-primary'>{stats.participants?.length || 0}</Text>
          <Text className='block text-xs text-gray-500 mt-1'>玩家数</Text>
        </View>
      </View>

      {/* 排行榜 */}
      <View className='stats-section'>
        <View className='section-header'>
          <Trophy size={18} color='#f59e0b' />
          <Text className='block text-base font-semibold ml-2'>积分排行榜</Text>
        </View>
        
        {stats.rankings?.map((player: any, idx: number) => (
          <View key={player.member_id} className={`ranking-item ${idx < 3 ? 'top-three' : ''}`}>
            <View className='ranking-position'>
              {idx === 0 && <Crown size={20} color='#f59e0b' />}
              {idx === 1 && <Text className='text-lg'>🥈</Text>}
              {idx === 2 && <Text className='text-lg'>🥉</Text>}
              {idx > 2 && <Text className='text-gray-400'>{idx + 1}</Text>}
            </View>
            <View className='ranking-info'>
              <Text className='block font-medium'>{player.name}</Text>
              <Text className='block text-xs text-gray-500'>{player.game_count}局</Text>
            </View>
            <View className='ranking-score'>
              <Text className={`block font-bold ${player.total_score >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {player.total_score > 0 ? '+' : ''}{player.total_score}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 最近对局 */}
      <View className='stats-section'>
        <View className='section-header'>
          <Gamepad2 size={18} color='#3b82f6' />
          <Text className='block text-base font-semibold ml-2'>最近对局</Text>
        </View>

        {stats.recent_games?.map((game) => (
          <View 
            key={game.id} 
            className='game-item'
            onClick={() => setSelectedGame(game)}
          >
            <View className='game-info'>
              <Text className='block font-medium'>{game.room_name}</Text>
              <Text className='block text-xs text-gray-500 mt-1'>
                {formatDate(game.created_at)} · {game.total_rounds}次给分
              </Text>
            </View>
            <View className='game-players'>
              <Text className='text-xs text-gray-500'>
                {game.participants?.length || 0}人
              </Text>
            </View>
            <View className='game-arrow'>
              <Text className='text-gray-400'>›</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 对局详情弹框 */}
      {selectedGame && (
        <View className='game-detail-overlay' onClick={() => setSelectedGame(null)}>
          <View className='game-detail-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='block text-lg font-semibold'>{selectedGame.room_name}</Text>
              <Text 
                className='block text-gray-500 text-sm mt-1'
                onClick={() => setSelectedGame(null)}
              >
                {formatDate(selectedGame.created_at)}
              </Text>
            </View>
            
            <View className='modal-content'>
              <Text className='block text-sm text-gray-500 mb-3'>最终排名</Text>
              
              {[...selectedGame.participants]
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((player, idx) => (
                  <View key={idx} className='detail-player'>
                    <Text className={`rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>
                      {idx + 1}
                    </Text>
                    <Text className='block flex-1 ml-3'>{player.name}</Text>
                    <Text className={`score ${player.score >= 0 ? 'positive' : 'negative'}`}>
                      {player.score > 0 ? '+' : ''}{player.score || 0}
                    </Text>
                  </View>
                ))
              }
            </View>

            <View className='modal-footer'>
              <Text className='block text-gray-400 text-sm'>
                共 {selectedGame.total_rounds} 次给分
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}
