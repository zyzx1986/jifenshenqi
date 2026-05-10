import Taro from '@tarojs/taro'

export function getCachedWechatNickname(): string {
  return Taro.getStorageSync('wechatNickname') || ''
}

export async function fetchWechatNicknameWithPrompt(): Promise<string> {
  const cachedNickname = getCachedWechatNickname()
  if (cachedNickname) {
    return cachedNickname
  }

  return new Promise<string>((resolve) => {
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP && Taro.canIUse('getUserProfile')) {
      Taro.getUserProfile({
        desc: '用于设置昵称',
        success: (res) => {
          const nickname = res.userInfo?.nickName || ''
          if (nickname) {
            Taro.setStorageSync('wechatNickname', nickname)
          }
          resolve(nickname)
        },
        fail: () => resolve(''),
      })
      return
    }

    resolve('')
  })
}

export async function resolveNickname(inputNickname: string): Promise<string> {
  const trimmedNickname = inputNickname.trim()
  if (trimmedNickname) {
    return trimmedNickname
  }

  return fetchWechatNicknameWithPrompt()
}
