export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '战绩统计' })
  : { navigationBarTitleText: '战绩统计' }
