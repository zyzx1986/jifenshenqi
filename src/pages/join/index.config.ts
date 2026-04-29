export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '加入/创建群组' })
  : { navigationBarTitleText: '加入/创建群组' }
