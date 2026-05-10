import Taro from '@tarojs/taro'

const WECHAT_NICKNAME_KEY = 'wechatNickname'
const WECHAT_AVATAR_KEY = 'wechatAvatarUrl'

export interface WechatProfile {
  nickname: string
  avatarUrl: string
}

function normalizeWechatNickname(nickname: string): string {
  const trimmedNickname = nickname.trim()
  if (!trimmedNickname || trimmedNickname === '微信用户') {
    return ''
  }

  return trimmedNickname
}

export function getCachedWechatNickname(): string {
  return normalizeWechatNickname(Taro.getStorageSync(WECHAT_NICKNAME_KEY) || '')
}

export function getCachedWechatAvatarUrl(): string {
  return Taro.getStorageSync(WECHAT_AVATAR_KEY) || ''
}

export function getCachedWechatProfile(): WechatProfile {
  return {
    nickname: getCachedWechatNickname(),
    avatarUrl: getCachedWechatAvatarUrl(),
  }
}

export function cacheWechatProfile(profile: Partial<WechatProfile>) {
  const nickname = normalizeWechatNickname(profile.nickname || '')
  const avatarUrl = profile.avatarUrl || ''

  if (nickname) {
    Taro.setStorageSync(WECHAT_NICKNAME_KEY, nickname)
  }

  if (avatarUrl) {
    Taro.setStorageSync(WECHAT_AVATAR_KEY, avatarUrl)
  }
}

export async function fetchWechatNicknameWithPrompt(): Promise<string> {
  const cachedNickname = getCachedWechatNickname()
  if (cachedNickname) {
    return cachedNickname
  }

  return new Promise<string>((resolve) => {
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP && Taro.canIUse('getUserProfile')) {
      Taro.getUserProfile({
        desc: '用于设置昵称和头像',
        success: (res) => {
          const nickname = normalizeWechatNickname(res.userInfo?.nickName || '')
          const avatarUrl = res.userInfo?.avatarUrl || ''
          cacheWechatProfile({ nickname, avatarUrl })
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
  const trimmedNickname = normalizeWechatNickname(inputNickname)
  if (trimmedNickname) {
    cacheWechatProfile({ nickname: trimmedNickname })
    return trimmedNickname
  }

  return fetchWechatNicknameWithPrompt()
}
