import { useState } from 'react';
import { loginUser, registerUser } from '../services/authService';
import { FileText, LogIn, UserPlus, Shield, ChevronDown, Lock } from 'lucide-react';
import { useAppStore } from '../../../store';
import type { User } from '../../../shared/types';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../../../shared/firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const ADMIN_ACCOUNTS: Record<string, { displayName: string; pin: string; orgId: string }> = {
  GL: { displayName: 'GL Admin', pin: '8711', orgId: 'gl-admin-org' },
};

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminAccount, setAdminAccount] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginUser(email, password);
      } else {
        await registerUser(email, password, displayName, orgName);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const account = ADMIN_ACCOUNTS[adminAccount];
    if (!account) {
      setError('Please select an account');
      return;
    }
    if (adminPin !== account.pin) {
      setError('Invalid PIN');
      return;
    }
    try {
      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;

      const orgRef = doc(db, 'organisations', account.orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) {
        await setDoc(orgRef, { id: account.orgId, name: account.displayName, createdAt: new Date().toISOString() });
      }

      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        email: `${adminAccount.toLowerCase()}@admin.local`,
        displayName: account.displayName,
        organisationId: account.orgId,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });

      const user: User = {
        uid,
        email: `${adminAccount.toLowerCase()}@admin.local`,
        displayName: account.displayName,
        organisationId: account.orgId,
        role: 'admin',
        createdAt: new Date(),
      };
      setCurrentUser(user);
      setAuthLoading(false);
      setShowAdminLogin(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text">DocCreator</h1>
        </div>

        <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-xl">
          <div className="flex gap-2 mb-6 bg-bg-tertiary rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-indigo-600 text-white' : 'text-text-tertiary hover:text-text'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'register' ? 'bg-indigo-600 text-white' : 'text-text-tertiary hover:text-text'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label="Full Name"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="Jane Smith"
                  required
                />
                <Input
                  label="Organisation Name"
                  type="text"
                  value={orgName}
                  onChange={setOrgName}
                  placeholder="Acme Corp"
                  required
                />
              </>
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
            />

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {mode === 'login' ? (
                <><LogIn className="w-4 h-4" /> Sign In</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAdminLogin(!showAdminLogin)}
              className="w-full flex items-center justify-center gap-2 text-text-tertiary hover:text-text text-sm transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin Login
            </button>
          </div>
        </div>

        {showAdminLogin && (
          <div className="mt-4 bg-bg-secondary border border-border rounded-2xl p-8 shadow-xl">
            <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              Admin Access
            </h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Account</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                    className="w-full flex items-center justify-between bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <span className={adminAccount ? 'text-text' : 'text-text-tertiary'}>
                      {adminAccount || 'Select account...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-text-tertiary" />
                  </button>
                  {adminDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden">
                      {Object.keys(ADMIN_ACCOUNTS).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setAdminAccount(key);
                            setAdminDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-text hover:bg-bg-tertiary transition-colors"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Input
                label="PIN Code"
                type="password"
                value={adminPin}
                onChange={setAdminPin}
                placeholder="••••"
                required
              />

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                <Shield className="w-4 h-4" />
                Admin Sign In
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-bg-input border border-border-secondary rounded-lg px-3 py-2 text-text placeholder-text-tertiary focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />
    </div>
  );
}
