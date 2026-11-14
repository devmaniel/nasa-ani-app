import { createFileRoute } from '@tanstack/react-router'
import { MapPage } from '@/features/map'

export const Route = createFileRoute('/map')({ component: MapPage })
