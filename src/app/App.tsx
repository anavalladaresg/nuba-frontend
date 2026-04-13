import { RouterProvider } from 'react-router-dom'
import { appRouter } from './navigation/router'

export function App() {
  return <RouterProvider router={appRouter} />
}
