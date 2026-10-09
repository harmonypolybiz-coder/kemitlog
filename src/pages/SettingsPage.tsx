import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { BackupSection } from '@/components/settings/BackupSection'
import { DangerSection, DemoSection, StorageSection } from '@/components/settings/DataSections'
import { PreferencesSection } from '@/components/settings/PreferencesSection'
import { PageHeader } from '@/components/ui/PageHeader'

export default function SettingsPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <>
      <PageHeader title="Paramètres" description="Préférences, sauvegarde et gestion de vos données." />
      <div className="space-y-5">
        <PreferencesSection />
        <BackupSection />
        <StorageSection />
        <DemoSection />
        <DangerSection />
      </div>
      <p className="mt-8 text-center text-xs text-subtle">KEMITLOG v{__APP_VERSION__}</p>
    </>
  )
}
