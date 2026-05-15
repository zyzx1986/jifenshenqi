import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { Button as NativeButton, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const AGREE_BUTTON_ID = 'privacy-agree-button'
const DEFAULT_CONTRACT_NAME = '用户隐私保护指引'
const LOG_PREFIX = '[privacy-auth]'

type PrivacyResolve = (option: {
  event: 'exposureAuthorization' | 'agree' | 'disagree'
  buttonId?: string
}) => void

function logPrivacy(step: string, detail?: unknown) {
  if (detail === undefined) {
    console.log(LOG_PREFIX, step)
    return
  }

  console.log(LOG_PREFIX, step, detail)
}

export function PrivacyAuthorizationProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false)
  const [contractName, setContractName] = useState(DEFAULT_CONTRACT_NAME)
  const resolveRef = useRef<PrivacyResolve | null>(null)
  const isResolvingRef = useRef(false)
  const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP

  const finishRequest = (option: { event: 'agree' | 'disagree'; buttonId?: string }) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    isResolvingRef.current = true
    setOpen(false)
    logPrivacy('finishRequest', option)
    resolve?.(option)
    setTimeout(() => {
      isResolvingRef.current = false
    }, 0)
  }

  const handleDisagree = () => {
    if (!resolveRef.current || isResolvingRef.current) {
      setOpen(false)
      logPrivacy('handleDisagree:ignored')
      return
    }

    finishRequest({ event: 'disagree' })
  }

  const loadPrivacySetting = () => {
    if (!isWeapp || typeof Taro.getPrivacySetting !== 'function') {
      logPrivacy('loadPrivacySetting:unsupported', {
        isWeapp,
        hasApi: typeof Taro.getPrivacySetting === 'function',
      })
      return
    }

    Taro.getPrivacySetting({
      success: (result) => {
        logPrivacy('getPrivacySetting:success', {
          needAuthorization: result.needAuthorization,
          contractName: result.privacyContractName,
        })
        if (result.privacyContractName) {
          setContractName(result.privacyContractName)
        }
      },
      fail: (error) => {
        logPrivacy('getPrivacySetting:fail', error)
      },
    })
  }

  useEffect(() => {
    if (!isWeapp || typeof Taro.onNeedPrivacyAuthorization !== 'function') {
      logPrivacy('onNeedPrivacyAuthorization:unsupported', {
        isWeapp,
        hasApi: typeof Taro.onNeedPrivacyAuthorization === 'function',
      })
      return
    }

    loadPrivacySetting()

    Taro.onNeedPrivacyAuthorization((resolve, eventInfo) => {
      logPrivacy('onNeedPrivacyAuthorization:triggered', eventInfo)
      resolveRef.current = resolve
      loadPrivacySetting()
      setOpen(true)
      resolve({ event: 'exposureAuthorization' })
    })
  }, [isWeapp])

  return (
    <>
      {children}
      {isWeapp ? (
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setOpen(true)
              return
            }

            handleDisagree()
          }}
        >
          <DialogContent closeClassName="hidden" className="max-w-md rounded-2xl px-5 py-6">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-center text-lg">隐私授权说明</DialogTitle>
              <DialogDescription className="text-center text-sm leading-6 text-gray-500">
                为了使用微信头像、昵称和邀请码复制等功能，我们需要先向你展示并征得你对
                《{contractName || DEFAULT_CONTRACT_NAME}》的同意。
              </DialogDescription>
            </DialogHeader>

            <View className="mt-2 rounded-xl bg-gray-50 p-4">
              <Text className="block text-sm leading-6 text-gray-600">
                同意后，小程序会按照《{contractName || DEFAULT_CONTRACT_NAME}》说明处理相关信息。
                如果暂不同意，涉及隐私信息的功能将无法继续使用。
              </Text>
            </View>

            <View className="mt-4 flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  logPrivacy('openPrivacyContract:click')
                  Taro.openPrivacyContract?.({
                    success: (result) => logPrivacy('openPrivacyContract:success', result),
                    fail: (error) => logPrivacy('openPrivacyContract:fail', error),
                  })
                }}
              >
                <Text className="block">查看《{contractName || DEFAULT_CONTRACT_NAME}》</Text>
              </Button>

              <NativeButton
                id={AGREE_BUTTON_ID}
                openType="agreePrivacyAuthorization"
                className="w-full rounded-md bg-primary px-4 py-3 text-center text-sm text-primary-foreground"
                onAgreePrivacyAuthorization={() => {
                  logPrivacy('agreePrivacyAuthorization:click')
                  if (!resolveRef.current) {
                    setOpen(false)
                    return
                  }

                  finishRequest({ event: 'agree', buttonId: AGREE_BUTTON_ID })
                }}
              >
                同意并继续
              </NativeButton>

              <Button variant="ghost" className="w-full" onClick={handleDisagree}>
                <Text className="block text-gray-500">暂不同意</Text>
              </Button>
            </View>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
