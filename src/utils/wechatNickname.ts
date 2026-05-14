import Taro from '@tarojs/taro'

const WECHAT_NICKNAME_KEY = 'wechatNickname'
const WECHAT_AVATAR_KEY = 'wechatAvatarUrl'

export interface WechatProfile {
  nickname: string
  avatarUrl: string
}

function normalizeWechatNickname(nickname: string): string {
  return nickname.trim()
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
  return getCachedWechatNickname()
}

export async function resolveNickname(inputNickname: string): Promise<string> {
  const trimmedNickname = normalizeWechatNickname(inputNickname)
  if (trimmedNickname) {
    cacheWechatProfile({ nickname: trimmedNickname })
    return trimmedNickname
  }

  return fetchWechatNicknameWithPrompt()
}
