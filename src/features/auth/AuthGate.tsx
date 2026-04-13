import { useState, type PropsWithChildren } from 'react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { Clock3, LockKeyhole, Sparkles } from 'lucide-react'
import { useAuthSession } from './AuthSessionProvider'
import { LoadingState, ErrorState } from '../../shared/ui/states/StateViews'
import { NUBA_LOGO_SRC } from '../../shared/brand/assets'
import { hasClerk } from '../../config/env'

type AuthMode = 'sign-in' | 'sign-up'

const authModes: { id: AuthMode; label: string }[] = [
  { id: 'sign-in', label: 'Entrar' },
  { id: 'sign-up', label: 'Crear cuenta' },
]

const clerkAppearance = {
  variables: {
    colorPrimary: '#7C9EFF',
    colorBackground: '#121821',
    colorInputBackground: '#1A2330',
    colorInputText: '#E6EDF3',
    colorText: '#E6EDF3',
    colorTextSecondary: '#9FB0C3',
    colorDanger: '#FF5C8A',
    borderRadius: '1rem',
    fontFamily: 'inherit',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'w-full border-0 bg-transparent p-0 shadow-none',
    header: 'hidden',
    socialButtonsBlockButton:
      'h-10 min-h-10 rounded-[1.1rem] border border-[#2A3545]/80 bg-[#1A2330]/78 text-[#E6EDF3] shadow-none transition hover:bg-[#223047]',
    socialButtonsBlockButtonText: 'text-[0.82rem] font-semibold text-[#E6EDF3]',
    dividerLine: 'bg-[#2A3545]',
    dividerText: 'text-[0.62rem] uppercase tracking-[0.18em] text-[#7F8FA3]',
    formFieldRow: 'gap-1.5',
    formFieldLabel: 'text-[0.64rem] font-semibold uppercase tracking-[0.15em] text-[#9FB0C3]',
    formFieldInput:
      'h-10 min-h-10 rounded-[1.1rem] border border-[#2A3545]/90 bg-[#0B0F14]/70 px-3.5 text-sm text-[#E6EDF3] shadow-none outline-none transition focus:border-[#7C9EFF]/80 focus:ring-2 focus:ring-[#7C9EFF]/20',
    formFieldInputShowPasswordButton: 'text-[#9FB0C3] hover:text-[#E6EDF3]',
    formButtonPrimary:
      'h-10 min-h-10 rounded-[1.1rem] bg-[#7C9EFF] text-sm font-bold text-[#0B0F14] shadow-[0_16px_34px_rgba(124,158,255,0.2)] transition hover:bg-[#9BB5FF]',
    footer: 'hidden',
    form: 'gap-3',
    formField: 'gap-1.5',
    formFieldAction: 'text-xs text-[#7C9EFF]',
    main: 'gap-3',
    socialButtons: 'gap-2',
    formFieldInputGroup: 'rounded-[1.1rem]',
    identityPreviewText: 'text-[#E6EDF3]',
    identityPreviewEditButton: 'text-[#7C9EFF]',
    formFieldSuccessText: 'text-[#4ADE80]',
    formFieldErrorText: 'text-[#FF5C8A]',
    alert: 'rounded-2xl border border-[#FF5C8A]/25 bg-[#FF5C8A]/10 text-[#E6EDF3]',
    alertText: 'text-sm text-[#E6EDF3]',
  },
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in')

  const features = [
    { icon: Clock3, label: 'Fichaje rápido' },
    { icon: Sparkles, label: 'Insights útiles' },
    { icon: LockKeyhole, label: 'Cuenta segura' },
  ]

  return (
    <main className="relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#0B0F14] text-[#E6EDF3]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-[-3rem] h-64 w-64 rounded-full bg-[#7C9EFF]/15 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-[#5BE7A9]/9 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,#1A2330_0%,transparent_72%)]" />
      </div>

      <div
        className="
          relative mx-auto w-full max-w-md px-4 sm:max-w-lg sm:px-5
          pt-[clamp(1rem,5svh,3rem)] pb-[clamp(1.25rem,4svh,2.5rem)]
        "
      >
        <div
          className="
            flex flex-col
            gap-[clamp(0.9rem,2.2svh,1.35rem)]
          "
        >
          <section
            className="
              rounded-[1.75rem] border border-[#2A3545]/70 bg-[#121821]/76 backdrop-blur-xl
              shadow-[0_22px_68px_rgba(0,0,0,0.34)]
              p-[clamp(1rem,2.5svh,1.4rem)]
            "
          >
            <div className="flex items-start gap-3">
              <img
                src={NUBA_LOGO_SRC}
                alt="Nuba"
                className="mt-0.5 h-10 w-10 shrink-0 rounded-[1rem] object-contain sm:h-11 sm:w-11"
              />

              <div className="min-w-0 flex-1">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.28em] text-[#7C9EFF]">
                  Nuba
                </p>

                <h1
                  className="
                    mt-1 font-semibold leading-[0.98] tracking-[-0.06em] text-[#E6EDF3]
                    text-[clamp(1.85rem,4.2vw,2.35rem)]
                  "
                >
                  Tu jornada, bajo control.
                </h1>

                <p
                  className="
                    mt-2 max-w-[22rem] text-[#9FB0C3]
                    text-[clamp(0.84rem,2.1vw,0.95rem)]
                    leading-[clamp(1.35rem,2.7vw,1.55rem)]
                  "
                >
                  Ficha, pausa y consulta tus registros desde una cuenta segura.
                </p>
              </div>
            </div>

            <div
              className="
                mt-[clamp(0.85rem,2svh,1.1rem)]
                grid grid-cols-3 gap-2 rounded-[1.35rem]
                border border-[#2A3545]/60 bg-[#0B0F14]/42
                p-[clamp(0.45rem,1.2svh,0.65rem)]
              "
            >
              {features.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className="
                      flex min-h-[4.4rem] flex-col items-center justify-center gap-1.5
                      rounded-[1rem] bg-[#1A2330]/42 px-2 py-2.5 text-center
                    "
                  >
                    <Icon className="h-4 w-4 text-[#7C9EFF]" aria-hidden="true" />
                    <p className="text-[0.63rem] font-bold uppercase leading-3 tracking-[0.08em] text-[#9FB0C3]/82">
                      {item.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section
            className="
              rounded-[1.75rem] border border-[#2A3545]/75 bg-[#121821]/90 backdrop-blur-xl
              shadow-[0_24px_72px_rgba(0,0,0,0.42)]
              p-[clamp(0.85rem,2svh,1rem)]
            "
          >
            <div className="rounded-[1.35rem] border border-[#2A3545]/70 bg-[#0B0F14]/58 p-1">
              <div className="grid grid-cols-2 gap-1">
                {authModes.map((authMode) => {
                  const isActive = mode === authMode.id

                  return (
                    <button
                      key={authMode.id}
                      type="button"
                      onClick={() => setMode(authMode.id)}
                      className={`rounded-[1.05rem] px-3 py-2.5 text-sm font-bold transition ${
                        isActive
                          ? 'bg-[#1A2330] text-[#E6EDF3] shadow-[inset_0_0_0_1px_rgba(124,158,255,0.26)]'
                          : 'text-[#9FB0C3] hover:text-[#E6EDF3]'
                      }`}
                    >
                      {authMode.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div
              className="
                mt-[clamp(0.8rem,1.8svh,1rem)]
                rounded-[1.35rem] border border-[#2A3545]/56 bg-[#1A2330]/38
                p-[clamp(1rem,2.3svh,1.25rem)]
              "
            >
              <p className="mb-3 text-center text-[0.78rem] font-medium text-[#9FB0C3]">
                {mode === 'sign-in'
                  ? 'Accede para continuar con tu jornada.'
                  : 'Crea tu cuenta y empieza a fichar.'}
              </p>

              {mode === 'sign-in' ? (
                <SignIn appearance={clerkAppearance} routing="hash" />
              ) : (
                <SignUp appearance={clerkAppearance} routing="hash" />
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function MissingClerkConfigScreen() {
  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#0B0F14] px-5 py-8 text-[#E6EDF3]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-0 h-72 w-72 rounded-full bg-[#7C9EFF]/16 blur-3xl" />
        <div className="absolute -right-32 bottom-8 h-80 w-80 rounded-full bg-[#5BE7A9]/10 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-[2rem] border border-[#2A3545]/75 bg-[#121821]/88 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.44)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#2A3545]/70 bg-[#1A2330]">
            <img src={NUBA_LOGO_SRC} alt="Nuba" className="h-8 w-8 object-contain" />
          </div>

          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.32em] text-[#7C9EFF]">
              Nuba
            </p>
            <h1 className="text-xl font-semibold tracking-[-0.045em] text-[#E6EDF3]">
              Falta activar el acceso
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-[#9FB0C3]">
          Para mostrar el inicio de sesión real, configura `VITE_CLERK_PUBLISHABLE_KEY` en el
          archivo `.env` y reinicia el servidor de desarrollo.
        </p>
      </section>
    </main>
  )
}

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuthSession()

  if (!auth.isReady) {
    return (
      <LoadingState
        title="Preparando Nuba"
        description="Abriendo tus datos de jornada."
      />
    )
  }

  if (auth.error) {
    return (
      <ErrorState
        title="No se pudo iniciar la autenticación"
        description={auth.error}
      />
    )
  }

  if (!auth.isAuthenticated) {
    if (!hasClerk) {
      return <MissingClerkConfigScreen />
    }

    return <AuthScreen />
  }

  return <>{children}</>
}