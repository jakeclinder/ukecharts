import { useState } from 'react';
import { X, Mail, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

export function SignInModal({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <X size={18} />
        </button>

        {sent ? (
          <div className="text-center py-4">
            <Mail size={40} className="mx-auto mb-3 text-amber-500" />
            <h2 className="text-lg font-semibold text-stone-800 mb-2">Check your email!</h2>
            <p className="text-sm text-stone-500">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-stone-800 mb-1">Sign in to UkeCharts</h2>
            <p className="text-sm text-stone-500 mb-5">
              We'll send a magic link to your email — no password needed.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-stone-600 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Send magic link
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
