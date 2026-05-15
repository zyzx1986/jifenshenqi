import Taro from '@tarojs/taro'

const WECHAT_NICKNAME_KEY = 'wechatNickname'
const WECHAT_AVATAR_KEY = 'wechatAvatarUrl'
const LOG_PREFIX = '[wechat-profile]'
const DEFAULT_PLACEHOLDER_NICKNAME = '微信用户'

export interface WechatProfile {
  nickname: string
  avatarUrl: string
}

export interface EnsureWechatPrivacyAuthorizationResult {
  authorized: boolean
  needAuthorization: boolean
  contractName: string
  errorMessage: string
}

export interface FetchWechatProfileOptions {
  force?: boolean
  trigger?: string
}

export interface FetchWechatProfileResult extends WechatProfile {
  source:
    | 'cache'
    | 'wechat-profile'
    | 'privacy-denied'
    | 'unsupported-env'
    | 'unsupported-api'
    | 'empty'
    | 'error'
  errorMessage: string
}

function normalizeWechatNickname(nickname: string): string {
  const trimmedNickname = nickname.trim()
  if (!trimmedNickname || trimmedNickname === DEFAULT_PLACEHOLDER_NICKNAME) {
    return ''
  }

  return trimmedNickname
}

function logWechatProfile(step: string, detail?: unknown) {
  if (detail === undefined) {
    console.log(LOG_PREFIX, step)
    return
  }

  console.log(LOG_PREFIX, step, detail)
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const errMsg = (error as { errMsg?: string }).errMsg
    if (errMsg) {
      return errMsg
    }

    const message = (error as { message?: string }).message
    if (message) {
      return message
    }
  }

  return 'unknown error'
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

export async function ensureWechatPrivacyAuthorization(
  trigger = 'unknown'
): Promise<EnsureWechatPrivacyAuthorizationResult> {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
    return {
      authorized: true,
      needAuthorization: false,
      contractName: '',
      errorMessage: '',
    }
  }

  if (typeof Taro.getPrivacySetting !== 'function') {
    logWechatProfile('privacy:getPrivacySetting unsupported', { trigger })
    return {
      authorized: true,
      needAuthorization: false,
      contractName: '',
      errorMessage: '',
    }
  }

  const privacySetting = await new Promise<{
    needAuthorization: boolean
    contractName: string
    errorMessage: string
  }>((resolve) => {
    Taro.getPrivacySetting({
      success: (result) => {
        logWechatProfile('privacy:getPrivacySetting success', {
          trigger,
          needAuthorization: result.needAuthorization,
          contractName: result.privacyContractName,
        })
        resolve({
          needAuthorization: Boolean(result.needAuthorization),
          contractName: result.privacyContractName || '',
          errorMessage: '',
        })
      },
      fail: (error) => {
        const errorMessage = getErrorMessage(error)
        logWechatProfile('privacy:getPrivacySetting fail', { trigger, errorMessage, error })
        resolve({
          needAuthorization: true,
          contractName: '',
          errorMessage,
        })
      },
    })
  })

  if (!privacySetting.needAuthorization) {
    return {
      authorized: true,
      needAuthorization: false,
      contractName: privacySetting.contractName,
      errorMessage: privacySetting.errorMessage,
    }
  }

  if (typeof Taro.requirePrivacyAuthorize !== 'function') {
    logWechatProfile('privacy:requirePrivacyAuthorize unsupported', { trigger })
    return {
      authorized: false,
      needAuthorization: true,
      contractName: privacySetting.contractName,
      errorMessage: 'requirePrivacyAuthorize unsupported',
    }
  }

  return new Promise<EnsureWechatPrivacyAuthorizationResult>((resolve) => {
    Taro.requirePrivacyAuthorize({
      success: (result) => {
        logWechatProfile('privacy:requirePrivacyAuthorize success', { trigger, result })
        resolve({
          authorized: true,
          needAuthorization: true,
          contractName: privacySetting.contractName,
          errorMessage: '',
        })
      },
      fail: (error) => {
        const errorMessage = getErrorMessage(error)
        logWechatProfile('privacy:requirePrivacyAuthorize fail', { trigger, errorMessage, error })
        resolve({
          authorized: false,
          needAuthorization: true,
          contractName: privacySetting.contractName,
          errorMessage,
        })
      },
    })
  })
}

export async function fetchWechatProfileWithPrompt(
  options: FetchWechatProfileOptions = {}
): Promise<FetchWechatProfileResult> {
  const { force = false, trigger = 'unknown' } = options
  const cachedProfile = getCachedWechatProfile()

  if (!force && cachedProfile.nickname) {
    logWechatProfile('profile:use cached nickname', { trigger, cachedProfile })
    return {
      ...cachedProfile,
      source: 'cache',
      errorMessage: '',
    }
  }

  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
    logWechatProfile('profile:unsupported env', { trigger })
    return {
      nickname: '',
      avatarUrl: '',
      source: 'unsupported-env',
      errorMessage: 'current env is not weapp',
    }
  }

  const privacyResult = await ensureWechatPrivacyAuthorization(`${trigger}:profile`)
  if (!privacyResult.authorized) {
    return {
      nickname: '',
      avatarUrl: '',
      source: 'privacy-denied',
      errorMessage: privacyResult.errorMessage || 'privacy authorization denied',
    }
  }

  if (!Taro.canIUse('getUserProfile')) {
    logWechatProfile('profile:getUserProfile unsupported', { trigger })
    return {
      nickname: '',
      avatarUrl: '',
      source: 'unsupported-api',
      errorMessage: 'getUserProfile unsupported',
    }
  }

  return new Promise<FetchWechatProfileResult>((resolve) => {
    Taro.getUserProfile({
      desc: '用于完善房间昵称和头像',
      success: (res) => {
        const nickname = normalizeWechatNickname(res.userInfo?.nickName || '')
        const avatarUrl = res.userInfo?.avatarUrl || ''
        cacheWechatProfile({ nickname, avatarUrl })
        logWechatProfile('profile:getUserProfile success', {
          trigger,
          nickname,
          hasAvatar: Boolean(avatarUrl),
        })
        resolve({
          nickname,
          avatarUrl,
          source: nickname || avatarUrl ? 'wechat-profile' : 'empty',
          errorMessage: '',
        })
      },
      fail: (error) => {
        const errorMessage = getErrorMessage(error)
        logWechatProfile('profile:getUserProfile fail', { trigger, errorMessage, error })
        resolve({
          nickname: '',
          avatarUrl: '',
          source: 'error',
          errorMessage,
        })
      },
    })
  })
}

export async function resolveNickname(
  inputNickname: string,
  options: FetchWechatProfileOptions = {}
): Promise<string> {
  const trimmedNickname = normalizeWechatNickname(inputNickname)
  if (trimmedNickname) {
    cacheWechatProfile({ nickname: trimmedNickname })
    return trimmedNickname
  }

  const result = await fetchWechatProfileWithPrompt(options)
  return result.nickname
}
