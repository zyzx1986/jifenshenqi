export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '积分排行' })
  : { navigationBarTitleText: '积分排行' }
