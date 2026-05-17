import { useState } from 'react'
import { Activity } from 'lucide-react'

export default function Login({ setToken }) {
  const [view, setView] = useState('login') // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (view === 'forgot') {
      // Mock forgot password for MVP
      setTimeout(() => {
        setMessage("If an account exists, a password reset link has been sent to your email.")
        setView('login')
      }, 1000)
      return
    }

    const endpoint = view === 'register' ? 'register' : 'login'
    
    try {
      let response;
      if (view === 'register') {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!passwordRegex.test(password)) {
          setError("Password must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character.")
          return
        }

        response = await fetch(`http://127.0.0.1:8000/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName })
        })
        if (response.ok) {
           // Auto login after register
           setView('login')
           setMessage("Registration successful! Please login.")
           return
        }
      } else {
        const formData = new URLSearchParams()
        formData.append('username', email)
        formData.append('password', password)
        response = await fetch(`http://127.0.0.1:8000/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        })
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || "Authentication failed")
      }

      if (view === 'login') {
        const data = await response.json()
        localStorage.setItem('token', data.access_token)
        setToken(data.access_token)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans text-gray-900">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
           <Activity size={40} color="white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">MediLens</h1>
        <p className="text-gray-500 mt-2 text-center">Global Medication Intelligence</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-xl mx-4 sm:mx-0">
        <h2 className="text-2xl font-semibold mb-6">
          {view === 'register' ? 'Create Account' : view === 'forgot' ? 'Reset Password' : 'Welcome Back'}
        </h2>
        
        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm border border-red-500/30">{error}</div>}
        {message && <div className="bg-green-500/20 text-green-400 p-3 rounded-xl mb-4 text-sm border border-green-500/30">{message}</div>}

        {view === 'register' && (
          <div className="mb-4">
            <label className="block text-gray-600 text-sm mb-2 font-medium">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-600 text-sm mb-2 font-medium">Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
        </div>

        {view !== 'forgot' && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-gray-600 text-sm font-medium">Password</label>
              {view === 'login' && (
                <button type="button" onClick={() => setView('forgot')} className="text-blue-600 font-medium text-sm hover:underline">
                  Forgot Password?
                </button>
              )}
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
          </div>
        )}

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-[0_4px_14px_0_rgba(37,99,235,0.39)]">
          {view === 'register' ? 'Sign Up' : view === 'forgot' ? 'Send Reset Link' : 'Log In'}
        </button>

        <div className="text-center text-gray-600 mt-6 text-sm">
          {view === 'register' ? 'Already have an account?' : view === 'forgot' ? 'Remember your password?' : "Don't have an account?"}
          <button type="button" onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-blue-600 font-bold ml-2 hover:underline">
            {view === 'login' ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </form>
    </div>
  )
}
