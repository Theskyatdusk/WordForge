import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import request from '../../utils/request'
import { storage } from '../../utils/storage'
import Icon from '../../components/Icon'
import './index.scss'

interface Overview {
  streak: number
  mastered: number
  accuracy: number
  wordbook: number
}

// tabBar 内的页面用 switchTab，其余用 navigateTo
const TAB_PAGES = ['dashboard', 'library', 'study', 'stats']

export default function Dashboard() {
  const [dark, setDark] = useState(storage.get<boolean>('theme_dark') || false)
  const [stats, setStats] = useState<Overview>({ streak: 0, mastered: 0, accuracy: 0, wordbook: 0 })

  const loadStats = () => {
    request<Overview>({ url: '/stats/overview' })
      .then(setStats)
      .catch(() => Taro.showToast({ title: '加载失败，请检查网络', icon: 'none' }))
  }

  useEffect(loadStats, [])
  useDidShow(loadStats)

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    storage.set('theme_dark', next)
  }

  const go = (page: string) => {
    if (TAB_PAGES.includes(page)) {
      Taro.switchTab({ url: `/pages/${page}/index` })
    } else {
      Taro.navigateTo({ url: `/pages/${page}/index` })
    }
  }

  const cells = [
    { key: 'library', icon: 'book', label: '词库' },
    { key: 'study', icon: 'graduation', label: '学习' },
    { key: 'stats', icon: 'chart', label: '统计' },
    { key: 'wordbook', icon: 'bookmark', label: '生词本' },
    { key: 'shop', icon: 'bag', label: '商城' },
    { key: 'game', icon: 'gamepad', label: '游戏' },
    { key: 'import', icon: 'upload', label: '导入' },
    { key: 'settings', icon: 'settings', label: '设置' }
  ]

  return (
    <View className={`dash ${dark ? 'theme-dark' : ''}`}>
      <View className='dash-hero'>
        <View className='dash-hero-top'>
          <Text className='dash-greeting'>你好，继续背单词</Text>
          <Icon name={dark ? 'sun' : 'moon'} size={44} color='#ffffff' onClick={toggleTheme} />
        </View>
        <View className='dash-stats'>
          <View className='dash-stat'>
            <Text className='num'>{stats.streak}</Text>
            <Text className='label'>连续打卡</Text>
          </View>
          <View className='dash-stat'>
            <Text className='num'>{stats.mastered}</Text>
            <Text className='label'>已掌握</Text>
          </View>
          <View className='dash-stat'>
            <Text className='num'>{stats.accuracy}%</Text>
            <Text className='label'>准确率</Text>
          </View>
          <View className='dash-stat'>
            <Text className='num'>{stats.wordbook}</Text>
            <Text className='label'>生词本</Text>
          </View>
        </View>
      </View>

      <View className='dash-grid'>
        {cells.map((c) => (
          <View className='dash-cell' key={c.key} onClick={() => go(c.key)}>
            <View className='dash-cell-icon'>
              <Icon name={c.icon} size={44} color='#0f766e' />
            </View>
            <Text className='dash-cell-label'>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
