export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/login/index',
    'pages/ranking/index',
    'pages/history/index',
    'pages/stats/index',
    'pages/profile/index',
    'pages/join/index',
    'pages/room-history/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '积分管理',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#1890ff',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '成员',
        iconPath: './assets/tabbar/users.png',
        selectedIconPath: './assets/tabbar/users-active.png'
      },
      {
        pagePath: 'pages/ranking/index',
        text: '排行',
        iconPath: './assets/tabbar/trophy.png',
        selectedIconPath: './assets/tabbar/trophy-active.png'
      },
      {
        pagePath: 'pages/history/index',
        text: '明细',
        iconPath: './assets/tabbar/list.png',
        selectedIconPath: './assets/tabbar/list-active.png'
      },
      {
        pagePath: 'pages/stats/index',
        text: '战绩',
        iconPath: './assets/tabbar/chart-bar-big.png',
        selectedIconPath: './assets/tabbar/chart-bar-big-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png'
      }
    ]
  },
  // 注意：WechatSI 语音插件需要正式的微信小程序 AppID 才能使用
  // 如果需要语音功能，请在微信公众平台申请插件并配置正确的 AppID
  // plugins: {
  //   WechatSI: {
  //     version: '0.3.5',
  //     provider: 'wx069ba97219f66d99'
  //   }
  // }
})
