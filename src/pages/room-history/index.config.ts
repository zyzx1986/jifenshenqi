export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '开房历史' })
  : { navigationBarTitleText: '开房历史' }
