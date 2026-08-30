import { createFileRoute } from '@tanstack/react-router'
import { Studio } from '../components/studio/studio'

export const Route = createFileRoute('/')({
  component: Studio,
})
