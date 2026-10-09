import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Fenêtre modale basée sur `<dialog>` : le navigateur gère le piège de focus,
 * la touche Échap et le retour du focus. Un champ portant `data-autofocus` reçoit
 * le focus à l'ouverture. Feuille en bas d'écran sur mobile,
 * fenêtre centrée à partir de la largeur « sm ».
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  /** Nombre d'événements « close » attendus à la suite d'une fermeture par l'application. */
  const pendingAppCloses = useRef(0)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() place le focus sur le premier élément focalisable (le bouton Fermer) :
      // un champ marqué `data-autofocus` est prioritaire pour saisir immédiatement.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) {
      // Fermeture décidée par l'application : l'événement « close » qui suivra est émis
      // en différé par le navigateur (très en retard dans un onglet en arrière-plan). Il ne
      // doit pas être pris pour une action de l'utilisateur, sinon il refermerait une
      // fenêtre rouverte entre-temps.
      pendingAppCloses.current += 1
      dialog.close()
    }
  }, [open])

  function handleClose() {
    if (pendingAppCloses.current > 0) {
      pendingAppCloses.current -= 1
      return
    }
    onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      // Un clic sur le fond (le <dialog> lui-même, hors contenu) ferme la fenêtre.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-line bg-surface p-0 text-fg backdrop:bg-black/70 sm:m-auto sm:max-w-xl sm:rounded-2xl"
    >
      {open && (
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 id={titleId} className="font-display text-2xl font-semibold tracking-wide uppercase">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-raised hover:text-fg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
