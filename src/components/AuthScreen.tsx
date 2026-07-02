import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

import { ThemeToggle, useThemeMode } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const { configured, signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useThemeMode();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError("Введите email и пароль.");
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === "signin" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.message) setMessage(result.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="fixed right-5 top-5 z-10">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <section>
            <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--gold)]">LIFE IS GOOD</div>
            <h1 className="mt-4 font-display text-5xl leading-tight text-foreground md:text-6xl">
              Дашборд жизни
            </h1>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Аккаунт</div>
              <h2 className="mt-2 font-display text-2xl text-foreground">
                {mode === "signin" ? "Войти" : "Создать доступ"}
              </h2>
            </div>

            {!configured ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Supabase пока не настроен. Добавьте на сервере VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, затем пересоберите сайт.
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</span>
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="name@example.com"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Пароль</span>
                  <span className="mt-2 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5">
                    <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="Минимум 6 символов"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
                {message ? <div className="rounded-md border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 p-3 text-sm text-[color:var(--gold)]">{message}</div> : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Проверяю..." : mode === "signin" ? "Войти" : "Зарегистрироваться"}
                </button>
              </form>
            )}

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setMessage(null);
                }}
                className="text-[color:var(--gold)] hover:underline"
              >
                {mode === "signin" ? "Создать" : "Войти"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
