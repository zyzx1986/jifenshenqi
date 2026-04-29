export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '积分明细' })
  : { navigationBarTitleText: '积分明细' }
