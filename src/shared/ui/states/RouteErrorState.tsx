import { useRouteError } from 'react-router-dom'
import { ErrorState } from './StateViews'

export function RouteErrorState() {
  const error = useRouteError()
  const description =
    error instanceof Error ? error.message : 'No se pudo renderizar la ruta solicitada.'

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <ErrorState
        title="Algo falló al abrir esta pantalla"
        description={description}
      />
    </div>
  )
}
