import { LoginForm } from '../components/auth/LoginForm'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'

export function LoginPage() {
  const { login } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">Ansible Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to manage your servers</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <LoginForm onLogin={login} />
        </div>
        <p className="text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300">Register</Link>
        </p>
      </div>
    </div>
  )
}
