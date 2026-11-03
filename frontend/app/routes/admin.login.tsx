import { KeyRound, LockKeyhole, Smartphone } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/primitives';
import { ApiError, refreshSession, staffAuth } from '../lib/admin-api';

export function meta() {
  return [
    { title: 'Staff sign in | Expressions Dental Clinic' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

type Stage =
  | { kind: 'password' }
  | { kind: 'verify'; mfaToken: string }
  | { kind: 'setup'; mfaToken: string; qrCodeDataUrl: string; secret: string };

const codePattern = /^\d{6}$/;

/** Staff sign-in: password, then a TOTP code (or first-time authenticator enrolment). */
export default function AdminLogin() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ kind: 'password' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in (valid refresh cookie)? Go straight to the inbox.
  useEffect(() => {
    void refreshSession().then((ok) => {
      if (ok) navigate('/admin', { replace: true });
    });
  }, [navigate]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not reach the server. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(async () => {
      const result = await staffAuth.login(String(form.get('email')), String(form.get('password')));
      if (result.status === 'ok') {
        navigate('/admin', { replace: true });
      } else if (result.status === 'mfa_required') {
        setStage({ kind: 'verify', mfaToken: result.mfaToken });
      } else {
        const setup = await staffAuth.startSetup(result.mfaToken);
        const secret = new URL(setup.otpauthUrl).searchParams.get('secret') ?? '';
        setStage({
          kind: 'setup',
          mfaToken: result.mfaToken,
          qrCodeDataUrl: setup.qrCodeDataUrl,
          secret,
        });
      }
    });
  };

  const onCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code')).replace(/\s/g, '');
    if (!codePattern.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    void run(async () => {
      if (stage.kind === 'setup') await staffAuth.enable(stage.mfaToken, code);
      if (stage.kind === 'verify') await staffAuth.verify(stage.mfaToken, code);
      navigate('/admin', { replace: true });
    });
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(50rem_30rem_at_90%_-10%,var(--color-primary-50),transparent_60%),radial-gradient(40rem_30rem_at_-10%_110%,var(--color-secondary-50),transparent_60%)] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-[0_24px_60px_-28px_rgb(31_36_43/0.4)] ring-1 ring-neutral-200 sm:p-9">
        <img
          src="/images/brand/logo.png"
          alt="Expressions Dental Clinic"
          width={458}
          height={152}
          className="h-11 w-auto"
        />
        <p className="mt-6 flex items-center gap-2 text-sm font-semibold tracking-wide text-primary-600 uppercase">
          <LockKeyhole size={16} />
          Staff area
        </p>

        {stage.kind === 'password' && (
          <form onSubmit={onPassword} className="mt-2">
            <h1 className="text-2xl font-bold">Sign in</h1>
            <div className="mt-6 space-y-5">
              <TextField label="Email" name="email" type="email" autoComplete="username" required />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm font-medium text-[#B60411]">
                {error}
              </p>
            )}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Continue'}
            </Button>
          </form>
        )}

        {stage.kind === 'setup' && (
          <form onSubmit={onCode} className="mt-2">
            <h1 className="text-2xl font-bold">Set up two-step sign-in</h1>
            <p className="mt-2 text-[0.95rem] text-muted">
              Owner and doctor accounts protect patient data with an authenticator app (Google or
              Microsoft Authenticator). This is a one-time setup.
            </p>
            <ol className="mt-5 space-y-4 text-[0.95rem]">
              <li className="flex gap-3">
                <Smartphone size={20} className="mt-0.5 shrink-0 text-primary-600" />
                <span>Open your authenticator app and scan this code:</span>
              </li>
            </ol>
            <img
              src={stage.qrCodeDataUrl}
              alt="QR code for your authenticator app"
              width={200}
              height={200}
              className="mx-auto mt-3 rounded-2xl ring-1 ring-neutral-200"
            />
            <p className="mt-3 text-center text-sm text-muted">
              Can’t scan? Enter this key instead:
              <code className="mt-1 block font-mono text-base font-semibold tracking-wider break-all text-neutral-950 select-all">
                {stage.secret}
              </code>
            </p>
            <div className="mt-5 flex gap-3">
              <KeyRound size={20} className="mt-0.5 shrink-0 text-primary-600" />
              <span className="text-[0.95rem]">Then enter the 6-digit code it shows:</span>
            </div>
            <TextField
              label="6-digit code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              className="mt-3"
            />
            {error && (
              <p role="alert" className="mt-4 text-sm font-medium text-[#B60411]">
                {error}
              </p>
            )}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Finish setup and sign in'}
            </Button>
          </form>
        )}

        {stage.kind === 'verify' && (
          <form onSubmit={onCode} className="mt-2">
            <h1 className="text-2xl font-bold">Enter your code</h1>
            <p className="mt-2 text-[0.95rem] text-muted">
              Open your authenticator app and enter the current 6-digit code for Expressions Dental.
            </p>
            <TextField
              label="6-digit code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              className="mt-5"
            />
            {error && (
              <p role="alert" className="mt-4 text-sm font-medium text-[#B60411]">
                {error}
              </p>
            )}
            <Button type="submit" className="mt-6 w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
