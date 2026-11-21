import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

/**
 * 应用外壳：顶部导航 + 内容区。
 *
 * 导航用 TanStack Router 的 Link（保留客户端路由），只是把外观交给
 * Astryx 的文本组件与全局 CSS，避免引入额外的导航组件依赖。
 */
function RootComponent() {
  return (
    <>
      <nav className="app-nav">
        <Heading level={1} type="display-3">
          mypanel
        </Heading>
        <Link to="/" activeProps={{ className: 'active' }}>
          <Text type="body">Home</Text>
        </Link>
        <Link to="/about" activeProps={{ className: 'active' }}>
          <Text type="body">About</Text>
        </Link>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}
