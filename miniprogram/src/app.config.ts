export default {
  pages: [
    'pages/dashboard/index',
    'pages/library/index',
    'pages/study/index',
    'pages/wordbook/index',
    'pages/stats/index',
    'pages/shop/index',
    'pages/settings/index',
    'pages/game/index',
    'pages/import/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0f3460',
    navigationBarTitleText: 'WordForge',
    navigationBarTextStyle: 'white'
  },
  // 文字版 tabBar（4 个主 tab）。其余页面通过 navigateTo 进入。
  tabBar: {
    color: '#94a3b8',
    selectedColor: '#0f766e',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/dashboard/index', text: '首页' },
      { pagePath: 'pages/library/index', text: '词库' },
      { pagePath: 'pages/study/index', text: '学习' },
      { pagePath: 'pages/stats/index', text: '统计' }
    ]
  }
}
