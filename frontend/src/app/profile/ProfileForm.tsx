import type { AuthUser } from '@/lib/api';

export default function ProfileForm({
  profile,
  error,
  success,
  onSubmit,
  onChange,
}: {
  profile: AuthUser;
  error: string;
  success: string;
  onSubmit: (event: React.FormEvent) => void;
  onChange: (next: AuthUser) => void;
}) {
  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '2rem' }}>My Profile</h2>
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: 'var(--accent-secondary)', marginBottom: '1rem' }}>{success}</div>}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>User ID</label>
          <input
            type="text"
            value={profile.id || ''}
            disabled
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'not-allowed' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
          <input
            type="text"
            value={profile.username}
            onChange={(event) => onChange({ ...profile, username: event.target.value })}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
          <input
            type="email"
            value={profile.email}
            onChange={(event) => onChange({ ...profile, email: event.target.value })}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', width: '100%' }}>
            Update Information
          </button>
        </div>
      </form>
    </div>
  );
}
