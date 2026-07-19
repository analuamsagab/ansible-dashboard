import { motion } from 'framer-motion'
import { RegisterForm } from '../components/auth/RegisterForm'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { Terminal } from 'lucide-react'

export function RegisterPage() {
  const { register } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6 relative"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4"
          >
            <Terminal className="w-6 h-6 text-emerald-400" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-100">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Get started with Ansible Dashboard</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900/80 backdrop-blur-sm p-6 rounded-xl border border-gray-800 shadow-xl"
        >
          <RegisterForm onRegister={register} />
        </motion.div>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
