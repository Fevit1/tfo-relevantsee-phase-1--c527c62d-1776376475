import { Suspense } from 'react'
import { Login } from '@/components/Login'

export const metadata = {
  title: 'Sign In — RelevantSee',
  description: 'Sign in to your RelevantSee account',
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
        </div>
      }
    >
      <Login />
    </Suspense>
  )
}