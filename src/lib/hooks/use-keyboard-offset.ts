import * as React from 'react'
import Taro from '@tarojs/taro'

// Global state to track keyboard height across the app
let globalKeyboardHeight = 0
const listeners = new Set<(height: number) => void>()

// 延迟初始化，避免在 Taro 未完全初始化时调用
let keyboardListenerInitialized = false

const initKeyboardListener = () => {
  if (keyboardListenerInitialized) return
  keyboardListenerInitialized = true
  
  // 只有在非 H5 环境下才监听键盘高度变化
  if (typeof Taro !== 'undefined' && Taro.getEnv && Taro.getEnv() !== 'WEB' && typeof Taro.onKeyboardHeightChange === 'function') {
    Taro.onKeyboardHeightChange(res => {
      globalKeyboardHeight = res.height || 0
      listeners.forEach(listener => listener(globalKeyboardHeight))
    })
  }
}

export function useKeyboardOffset() {
  // 确保键盘监听器已初始化
  initKeyboardListener()
  
  const [offset, setOffset] = React.useState(globalKeyboardHeight)

  React.useEffect(() => {
    const handler = (height: number) => {
      setOffset(height)
    }

    listeners.add(handler)
    // Update immediately with current global value in case it changed
    setOffset(globalKeyboardHeight)

    return () => {
      listeners.delete(handler)
    }
  }, [])

  return offset
}
