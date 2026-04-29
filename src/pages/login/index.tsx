import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const LoginPage = () => {
  const [loading, setLoading] = useState(false)

  // 快速进入
  const handleEnter = () => {
    setLoading(true)
    setTimeout(() => {
      Taro.redirectTo({
        url: '/pages/join/index'
      })
    }, 300)
  }

  useLoad(() => {
    console.log('Login page loaded')
  })

  return (
    <View className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-6">
      <View className="w-full max-w-sm">
        {/* Logo 区域 */}
        <View className="flex flex-col items-center mb-8">
          <View className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-4">
            <Text className="block text-3xl font-bold text-white">积</Text>
          </View>
          <Text className="block text-2xl font-bold text-gray-900">
            积分管理
          </Text>
          <Text className="block text-sm text-gray-500 mt-2">
            团队积分协作工具
          </Text>
        </View>

        {/* 登录卡片 */}
        <Card className="bg-white shadow-lg">
          <CardContent className="p-6">
            <View className="text-center mb-6">
              <Text className="block text-lg font-semibold text-gray-900 mb-2">
                欢迎使用
              </Text>
              <Text className="block text-sm text-gray-500">
                快速开始使用积分管理
              </Text>
            </View>

            <Button
              className="w-full bg-blue-500 hover:bg-blue-600"
              onClick={handleEnter}
              disabled={loading}
            >
              <Text className="text-white font-medium">
                {loading ? '进入中...' : '进入应用'}
              </Text>
            </Button>

            <View className="mt-4 text-center">
              <Text className="block text-xs text-gray-400">
                简单、快捷、高效的积分管理工具
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* 说明 */}
        <View className="mt-8 text-center">
          <Text className="block text-xs text-gray-400">
            积分管理系统 v1.0
          </Text>
        </View>
      </View>
    </View>
  )
}

export default LoginPage
