import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({ component: About })

function About() {
  return (
    <main>
      <h1>About</h1>
      <p>
        This page is defined in <code>src/routes/about.tsx</code>. TanStack
        Router generates <code>src/routeTree.gen.ts</code> from the files in{' '}
        <code>src/routes</code>.
      </p>
    </main>
  )
}
