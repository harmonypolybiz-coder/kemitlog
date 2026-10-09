import { Compass } from 'lucide-react'
import { ROUTES } from '@/components/layout/navigation'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page introuvable"
      description="Cette adresse ne correspond à aucune page de KEMITLOG."
      actions={
        <ButtonLink to={ROUTES.dashboard} variant="primary">
          Retour au tableau de bord
        </ButtonLink>
      }
    />
  )
}
