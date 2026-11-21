import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Theme } from '@astryxdesign/core/theme'
import ReactDOM from 'react-dom/client'

import { defaultThemeSlug, themes } from './astryx-themes'
import { getRouter } from './router'

/** 全应用共用的 react-query 客户端，`rpc.*.useQuery` 依赖它。 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // RPC 结果变化不频繁，窗口聚焦时不必重新拉取，避免无谓请求。
      refetchOnWindowFocus: false,
    },
  },
})

const router = getRouter()

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    // Theme 由 astryx-themes.ts 生成，切换主题只需改 defaultThemeSlug。
    // mode="system" 跟随操作系统深浅色，Astryx 会把 data-theme 同步到 <html>。
    <Theme theme={themes[defaultThemeSlug]} mode="system">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Theme>,
  )
}
