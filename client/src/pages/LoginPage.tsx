import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Hotel, Users, Briefcase, Coffee, ChevronLeft } from 'lucide-react';
import type { User } from '../types';

export default function LoginPage() {
  const [departments, setDepartments] = useState<Record<string, User[]>>({});
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    authApi.getUsersByDepartment().then(res => setDepartments(res.data)).catch(() => toast.error('Failed to load users'));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !password) { toast.error('Please enter your password'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.login(selectedUser.email, password);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (selectedUser) setSelectedUser(null);
    else setSelectedDept(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
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
        <div className="bg-white border border-gray-200 rounded-[24px] p-8 shadow-xl shadow-gray-100/50">
          
          {(selectedDept || selectedUser) && (
            <button onClick={handleBack} className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
              <ChevronLeft size={16} className="mr-1" /> Back
            </button>
          )}

          {!selectedDept && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Select Department</h2>
              <p className="text-sm text-gray-500 mb-8 font-medium">Choose your workspace to continue</p>
              
              <div className="grid gap-4">
                <button onClick={() => setSelectedDept('reception')} className="flex items-center p-4 border rounded-xl hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700 transition-all text-left">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-4"><Users size={20} /></div>
                  <div>
                    <div className="font-bold">Reception</div>
                    <div className="text-xs text-gray-500">Front desk & Bookings</div>
                  </div>
                </button>
                <button onClick={() => setSelectedDept('restaurant')} className="flex items-center p-4 border rounded-xl hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700 transition-all text-left">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mr-4"><Coffee size={20} /></div>
                  <div>
                    <div className="font-bold">Restaurant</div>
                    <div className="text-xs text-gray-500">POS & Menu Management</div>
                  </div>
                </button>
                <button onClick={() => setSelectedDept('management')} className="flex items-center p-4 border rounded-xl hover:border-primary-600 hover:bg-primary-50 hover:text-primary-700 transition-all text-left">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-4"><Briefcase size={20} /></div>
                  <div>
                    <div className="font-bold">Management</div>
                    <div className="text-xs text-gray-500">Admin & Operations</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {selectedDept && !selectedUser && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Select User</h2>
              <p className="text-sm text-gray-500 mb-8 font-medium capitalize">{selectedDept} Department</p>
              
              <div className="grid gap-3">
                {departments[selectedDept]?.map(user => (
                  <button key={user.id} onClick={() => setSelectedUser(user)} className="flex items-center p-3 border rounded-xl hover:border-primary-600 hover:bg-primary-50 transition-all text-left">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3 font-bold text-gray-700">{user.name.charAt(0)}</div>
                    <div>
                      <div className="font-bold text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.role.replace('_', ' ')}</div>
                    </div>
                  </button>
                ))}
                {departments[selectedDept]?.length === 0 && (
                  <div className="text-center text-gray-500 py-4">No users found in this department.</div>
                )}
              </div>
            </>
          )}

          {selectedUser && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-500 mb-8 font-medium">Log in as {selectedUser.name}</p>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-900 uppercase tracking-widest mb-2 ml-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoFocus
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

                <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-4 shadow-lg shadow-primary-200">
                  {loading ? 'Processing...' : 'Sign In'}
                </button>
              </form>
            </>
          )}

        </div>
        <p className="text-center text-gray-400 text-xs font-bold uppercase tracking-widest mt-10">
          © 2026 Godiva Rooms • Godivatech
        </p>
      </div>
    </div>
  );
}
