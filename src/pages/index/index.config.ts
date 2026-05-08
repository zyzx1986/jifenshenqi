export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '首页',
      enableShareAppMessage: true
    })
  : {
      navigationBarTitleText: '首页',
      enableShareAppMessage: true
    }
