import Taro from '@tarojs/taro'

type WechatSiPlugin = {
  getRecorderManager?: () => unknown
  textToSpeech?: (options: {
    lang?: string
    tts?: boolean
    content: string
    success?: (result: { filename?: string }) => void
    fail?: (error: unknown) => void
  }) => void
}

let audioContext: Taro.InnerAudioContext | null = null
let h5Utterance: SpeechSynthesisUtterance | null = null

function getAudioContext() {
  if (!audioContext) {
    audioContext = Taro.createInnerAudioContext()
  }

  return audioContext
}

function getWechatSiPlugin(): WechatSiPlugin | null {
  try {
    const requirePlugin = (globalThis as any).requirePlugin
    if (typeof requirePlugin !== 'function') {
      return null
    }

    return requirePlugin('WechatSI') as WechatSiPlugin
  } catch (error) {
    console.error('load WechatSI plugin failed:', error)
    return null
  }
}

async function playWeappVoice(text: string) {
  const plugin = getWechatSiPlugin()
  if (!plugin?.textToSpeech) {
    return false
  }

  return new Promise<boolean>((resolve) => {
    plugin.textToSpeech?.({
      lang: 'zh_CN',
      tts: true,
      content: text,
      success: (result) => {
        const filePath = result?.filename || ''
        if (!filePath) {
          resolve(false)
          return
        }

        const audio = getAudioContext()
        audio.stop()
        audio.src = filePath
        audio.play()
        resolve(true)
      },
      fail: (error) => {
        console.error('WechatSI textToSpeech failed:', error)
        resolve(false)
      },
    })
  })
}

function playH5Voice(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false
  }

  if (h5Utterance) {
    window.speechSynthesis.cancel()
  }

  h5Utterance = new SpeechSynthesisUtterance(text)
  h5Utterance.lang = 'zh-CN'
  h5Utterance.rate = 1
  h5Utterance.pitch = 1
  window.speechSynthesis.speak(h5Utterance)
  return true
}

export async function speakScoreBroadcast(text: string) {
  if (!text.trim()) {
    return
  }

  const env = Taro.getEnv()
  if (env === Taro.ENV_TYPE.WEAPP) {
    await playWeappVoice(text)
    return
  }

  playH5Voice(text)
}

export function buildScoreBroadcastText(fromName: string, toName: string, points: number) {
  return `${fromName}给${toName}${points}分`
}
