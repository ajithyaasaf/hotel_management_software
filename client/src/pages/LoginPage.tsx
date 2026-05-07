import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Hotel } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-[420px] animate-scaleIn">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-lg shadow-primary-200">
            <Hotel size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tighter">Godiva Rooms</h1>
          <p className="text-gray-500 text-sm font-medium mt-2">The future of hotel management</p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-gray-200 rounded-[24px] p-10 shadow-xl shadow-gray-100/50">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Login</h2>
          <p className="text-sm text-gray-500 mb-8 font-medium">Please enter your credentials to manage your hotel</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-900 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-900 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full btn-lg mt-4 shadow-lg shadow-primary-200"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Processing...
                </span>
              ) : 'Continue'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs font-bold uppercase tracking-widest mt-10">
          © 2026 Godiva Rooms • Godivatech
        </p>
      </div>
    </div>
  );
}
