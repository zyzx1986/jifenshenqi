export default typeof definePageConfig === 'function'
  ? definePageConfig({ 
      navigationBarTitleText: '加入/创建房间',
      enableShareAppMessage: true 
    })
  : { 
      navigationBarTitleText: '加入/创建房间',
      enableShareAppMessage: true
    }
