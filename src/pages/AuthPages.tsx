import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, X } from 'lucide-react'
import { toast } from 'sonner'
import { loginInputSchema, registerInputSchema, type LoginInput, type RegisterInput } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin, useRegister } from '@/features/auth/useAuthActions'
import { focusFirstInvalid } from '@/lib/forms'
import { cn } from '@/lib/utils'

/** Só aceita redirecionamentos internos (evita open redirect). */
export function safeRedirect(r: string | undefined) {
  if (!r || !r.startsWith('/') || r.startsWith('//')) return '/'
  if (r.startsWith('/login') || r.startsWith('/register')) return '/'
  return r
}

export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (!(err instanceof ApiError)) return false
  const entries = Object.entries(err.fieldErrors)
  entries.forEach(([k, message], i) => setError(k as Path<T>, { type: 'server', message }, { shouldFocus: i === 0 }))
  return entries.length > 0
}

function AuthShell({
  mode,
  children,
  description,
}: {
  mode: 'login' | 'register'
  children: React.ReactNode
  description: string
}) {
  const search = useSearch({ strict: false }) as { redirect?: string }
  const navigate = useNavigate()
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => titleRef.current?.focus(), [mode])
  return (
    <div className="container-page flex justify-center py-6 md:py-16">
      <section
        aria-labelledby="auth-title"
        className="relative w-full max-w-[500px] md:border-b-8 md:border-primary md:bg-surface md:pt-12 md:pb-10"
      >
        <p className="mt-12 mb-10 text-center text-3xl font-bold tracking-[0.15em] md:hidden" aria-hidden>
          KURIO
        </p>
        <button
          type="button"
          onClick={() =>
            navigate({ to: safeRedirect(search.redirect) === '/checkout' ? '/cart' : safeRedirect(search.redirect) })
          }
          className="absolute top-4 right-4 hidden rounded-sm p-1 text-primary hover:bg-surface-2 md:block"
          aria-label="Fechar e voltar"
        >
          <X className="size-5" aria-hidden />
        </button>
        <h1 id="auth-title" ref={titleRef} tabIndex={-1} className="text-center text-xl focus:outline-none">
          <span className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</span>
          <span aria-hidden className="hidden md:inline">
            <Link
              to="/login"
              search={search}
              className={cn(mode === 'login' ? 'text-primary-strong' : 'text-foreground')}
            >
              Entrar
            </Link>
            <span className="mx-2 text-primary">|</span>
            <Link
              to="/register"
              search={search}
              className={cn(mode === 'register' ? 'text-primary-strong' : 'text-foreground')}
            >
              Criar conta
            </Link>
          </span>
          <span aria-hidden className="font-bold md:hidden">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </span>
        </h1>
        <p className="mx-auto mt-8 hidden max-w-[420px] px-6 text-center text-xs leading-4 md:block">{description}</p>
        <div className="mx-auto mt-8 max-w-[340px] md:mt-6">{children}</div>
        <div className="relative mx-auto mt-8 max-w-[340px] md:max-w-none">
          <div className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden />
          <p className="relative mx-auto w-fit bg-background px-3 text-xs md:bg-surface">Ou continue com</p>
        </div>
        <div className="mx-auto mt-4 flex max-w-[340px] flex-col gap-3">
          {['Google', 'Facebook'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toast.info(`Login com ${p} não está disponível nesta demonstração.`)}
              className="h-10 rounded-sm border border-line text-xs text-muted hover:border-primary"
            >
              Continuar com {p}
            </button>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted md:hidden">
          {mode === 'login' ? (
            <Link to="/register" search={search}>
              Novo na Kurio? Crie uma conta
            </Link>
          ) : (
            <Link to="/login" search={search}>
              Já tem conta? Entrar
            </Link>
          )}
        </p>
      </section>
    </div>
  )
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center text-subtle hover:text-primary"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs text-danger">
      <span aria-hidden>⚠ </span>
      {message}
    </p>
  )
}

export function LoginPage() {
  const search = useSearch({ from: '/login' })
  const navigate = useNavigate()
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  })
  const e = form.formState.errors

  const onSubmit = form.handleSubmit(
    (values) => {
      setFormError(null)
      login.mutate(values, {
        onSuccess: () => {
          toast.success('Bem-vindo de volta!')
          void navigate({ to: safeRedirect(search.redirect), replace: true })
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) setFormError(err.message)
        },
      })
    },
    () => focusFirstInvalid(),
  )

  return (
    <AuthShell mode="login" description="Entre para gerenciar sua carteira, coleção e perfil de criador.">
      {search.reason === 'expired' && (
        <p role="alert" className="mb-4 border border-warning px-3 py-2 text-sm" data-testid="session-expired-banner">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-3"
        aria-describedby={formError ? 'login-error' : undefined}
      >
        <div>
          <label htmlFor="login-email" className="sr-only">
            E-mail
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="contato@email.com"
            aria-invalid={Boolean(e.email)}
            aria-describedby={e.email ? 'login-email-err' : undefined}
            {...form.register('email')}
          />
          <FieldError id="login-email-err" message={e.email?.message} />
        </div>
        <div>
          <label htmlFor="login-password" className="sr-only">
            Senha
          </label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="Senha"
            aria-invalid={Boolean(e.password)}
            aria-describedby={e.password ? 'login-password-err' : undefined}
            {...form.register('password')}
          />
          <FieldError id="login-password-err" message={e.password?.message} />
        </div>
        <button
          type="button"
          onClick={() => toast.info('Recuperação de senha não faz parte desta demonstração.')}
          className="self-end text-xs text-primary-strong hover:underline"
        >
          Esqueceu a senha?
        </button>
        {formError && (
          <p id="login-error" role="alert" className="text-sm text-danger" data-testid="login-error">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          loading={login.isPending}
          className="mt-4 h-14 rounded-xl text-base md:h-11 md:rounded-sm"
        >
          Entrar
        </Button>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const search = useSearch({ from: '/register' })
  const navigate = useNavigate()
  const register = useRegister()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const e = form.formState.errors

  const onSubmit = form.handleSubmit(
    (values) => {
      setFormError(null)
      register.mutate(values, {
        onSuccess: () => {
          toast.success('Conta criada! Bem-vindo à Kurio.')
          void navigate({ to: safeRedirect(search.redirect), replace: true })
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) setFormError(err.message)
        },
      })
    },
    () => focusFirstInvalid(),
  )

  const fields: Array<{ name: keyof RegisterInput; label: string; type: string; auto: string }> = [
    { name: 'username', label: 'Nome de usuário', type: 'text', auto: 'username' },
    { name: 'email', label: 'Digite seu e-mail', type: 'email', auto: 'email' },
    { name: 'password', label: 'Senha', type: 'password', auto: 'new-password' },
    { name: 'confirmPassword', label: 'Confirmar senha', type: 'password', auto: 'new-password' },
  ]

  return (
    <AuthShell mode="register" description="Crie seu perfil de colecionador e conecte uma carteira quando quiser.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {fields.map((f) => {
          const id = `reg-${f.name}`
          const err = e[f.name]?.message
          const common = {
            id,
            autoComplete: f.auto,
            placeholder: f.label,
            'aria-invalid': Boolean(err),
            'aria-describedby': err ? `${id}-err` : f.name === 'password' ? `${id}-hint` : undefined,
            ...form.register(f.name),
          }
          return (
            <div key={f.name}>
              <label htmlFor={id} className="sr-only">
                {f.label}
              </label>
              {f.type === 'password' ? <PasswordInput {...common} /> : <Input type={f.type} {...common} />}
              {f.name === 'password' && !err && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">
                  Mínimo de 8 caracteres, com letras e números.
                </p>
              )}
              <FieldError id={`${id}-err`} message={err} />
            </div>
          )
        })}
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          loading={register.isPending}
          className="mt-4 h-14 rounded-xl text-base md:h-11 md:rounded-sm"
        >
          Criar conta
        </Button>
      </form>
    </AuthShell>
  )
}
