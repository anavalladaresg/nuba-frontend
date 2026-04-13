  import { createBrowserRouter, Navigate } from 'react-router-dom'
  import { AppShell } from '../layout/AppShell'
  import { HomeScreen } from '../../features/work-sessions/screens/HomeScreen'
  import { CalendarScreen } from '../../features/calendar/screens/CalendarScreen'
  import { InsightsScreen } from '../../features/dashboard/screens/DashboardScreen'
  import { SettingsScreen } from '../../features/settings/screens/SettingsScreen'
  import { NotificationsScreen } from '../../features/notifications/screens/NotificationsScreen'
  import { RouteErrorState } from '../../shared/ui/states/RouteErrorState'

  export const appRouter = createBrowserRouter([
    {
      path: '/',
      element: <AppShell />,
      errorElement: <RouteErrorState />,
      children: [
        {
          index: true,
          element: <HomeScreen />,
          handle: {
            title: 'Nuba',
            description:
              'Estado actual de la jornada y acción principal de fichaje.',
          },
        },
        {
          path: 'history',
          element: <Navigate to="/calendar" replace />,
        },
        {
          path: 'history/:sessionId',
          element: <Navigate to="/calendar" replace />,
        },
        {
          path: 'calendar',
          element: <CalendarScreen />,
          handle: {
            title: 'Calendario',
            description:
              'Radar mensual compacto con lectura por color y detalle del día bajo demanda.',
          },
        },
        {
          path: 'dashboard',
          element: <Navigate to="/insights" replace />,
        },
        {
          path: 'insights',
          element: <InsightsScreen />,
          handle: {
            title: 'Insights',
            description:
              'Patrones, hábitos y comparativas ligeras para entender tu tiempo sin duplicar la operativa diaria.',
          },
        },
        {
          path: 'settings',
          element: <SettingsScreen />,
          handle: {
            title: 'Ajustes',
            description:
              'Configuración personal, zona horaria, objetivos diarios y accesos a onboarding, recordatorios y exportes.',
          },
        },
        {
          path: 'settings/notifications',
          element: <NotificationsScreen />,
          handle: {
            title: 'Preferencias de recordatorios',
            description:
              'Avisos inteligentes y eventos importantes del flujo diario de fichaje.',
          },
        },
        {
          path: 'settings/exports',
          element: <Navigate to="/settings" replace />,
        },
        {
          path: 'settings/onboarding',
          element: <Navigate to="/settings" replace />,
        },
      ],
    },
  ])
