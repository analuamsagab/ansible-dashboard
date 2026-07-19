import { RegisterForm } from '../components/auth/RegisterForm'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'

export function RegisterPage() {
  const { register } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">Create Account</h1>
          <p className="text-sm text-gray-400 mt-1">Get started with Ansible Dashboard</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <RegisterForm onRegister={register} />
        </div>
        <p className="text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
