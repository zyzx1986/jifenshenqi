# 积分小程序设计指南

## 品牌定位

**应用名称**：积分管理

**应用定位**：团队成员积分管理工具，支持成员加入、相互给分、积分明细查看

**设计风格**：简洁、专业、高效

**目标用户**：团队成员、项目组成员

## 配色方案

### 主色调
- 主色：`bg-blue-500` / `text-blue-500` - 用于按钮、链接、强调元素
- 主色深色：`bg-blue-600` / `text-blue-600` - 按钮悬停状态
- 主色浅色：`bg-blue-50` / `text-blue-600` - 背景色块

### 中性色
- 背景：`bg-gray-50` - 页面背景
- 卡片背景：`bg-white` - 卡片容器
- 边框：`border-gray-200` - 分隔线
- 主要文本：`text-gray-900` - 标题、正文
- 次要文本：`text-gray-500` - 辅助信息
- 占位符：`text-gray-400` - 输入框占位符

### 语义色
- 成功：`bg-green-500` / `text-green-500` - 正面反馈
- 警告：`bg-yellow-500` / `text-yellow-500` - 提醒信息
- 错误：`bg-red-500` / `text-red-500` - 错误提示
- 增加：`text-green-600` - 积分增加
- 减少：`text-red-600` - 积分减少

## 字体规范

使用 Tailwind 默认字体系统：
- 标题：`text-2xl font-bold text-gray-900`
- 副标题：`text-lg font-semibold text-gray-900`
- 正文：`text-base text-gray-700`
- 辅助文本：`text-sm text-gray-500`
- 标签文本：`text-xs text-gray-400`

## 间距系统

- 页面边距：`px-4 py-6`
- 卡片间距：`gap-4`
- 卡片内边距：`p-4`
- 元素间距：`gap-2`、`gap-3`
- 列表项间距：`divide-y divide-gray-100`

## 组件使用原则

**通用 UI 组件优先使用 `@/components/ui/*`**：

### 必须优先复用的组件：
- **按钮**：使用 `Button` - 所有点击操作入口
- **输入框**：使用 `Input` - 用户名、积分输入
- **卡片**：使用 `Card` - 成员卡片、积分记录卡片
- **标签**：使用 `Badge` - 状态标签、分类标签
- **弹窗**：使用 `Dialog` - 给分确认、详情展示
- **提示**：使用 `Toast` / `Sonner` - 操作反馈
- **表单字段**：使用 `Field` - 统一表单布局
- **分隔线**：使用 `Separator` - 内容区块分隔

### 页面组件选型规划：

#### 成员列表页面
- 卡片（`Card`）- 成员信息展示
- 标签（`Badge`）- 积分数值、排名
- 按钮（`Button`）- 给分操作

#### 给分界面
- 输入框（`Input`）- 积分数值输入
- 按钮（`Button`）- 确认、取消
- 弹窗（`Dialog`）- 给分确认

#### 积分明细页面
- 卡片（`Card`）- 积分记录展示
- 分隔线（`Separator`）- 记录间分隔
- 标签（`Badge`）- 增加/减少标识

#### 加入/创建群组页面
- 输入框（`Input`）- 群组名称、邀请码
- 按钮（`Button`）- 加入、创建操作
- 字段（`Field`）- 表单布局

**禁止用 View/Text 手搓按钮、输入框、卡片、标签、Tabs、弹层等通用 UI**

## 容器样式

### 页面容器
```tsx
<View className="min-h-screen bg-gray-50 px-4 py-6">
  {/* 内容 */}
</View>
```

### 卡片样式
```tsx
<Card className="bg-white rounded-xl shadow-sm">
  {/* 内容 */}
</Card>
```

### 圆角规范
- 卡片：`rounded-xl`
- 按钮：`rounded-lg`
- 输入框：`rounded-xl`
- 标签：`rounded-full`

### 阴影规范
- 卡片：`shadow-sm`
- 弹窗：`shadow-lg`

## 导航结构

### TabBar 配置
```typescript
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
      pagePath: 'pages/profile/index',
      text: '我的',
      iconPath: './assets/tabbar/user.png',
      selectedIconPath: './assets/tabbar/user-active.png'
    }
  ]
}
```

### 页面跳转规范
- TabBar 页面：使用 `Taro.switchTab()`
- 普通页面：使用 `Taro.navigateTo()`

## 状态展示

### 加载态
使用 `Skeleton` 组件：
```tsx
<Skeleton className="h-20 w-full" />
```

### 空状态
```tsx
<View className="flex flex-col items-center justify-center py-12">
  <Text className="block text-sm text-gray-500">暂无数据</Text>
</View>
```

## 小程序约束

### 包体积限制
- 主包体积 ≤ 2MB
- 使用 TabBar 图标本地 PNG，其他资源走 TOS

### 性能优化
- 列表数据量大时考虑虚拟列表
- 图片使用懒加载 `lazyLoad`
- 避免频繁的 setData 操作
