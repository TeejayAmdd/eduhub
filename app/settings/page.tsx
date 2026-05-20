'use client'

import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { SettingsPage } from '@/app/_components/settings-page'

export default function LecturerSettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your profile, password, and preferences"
      />
      <SettingsPage role="lecturer" />
    </PageContainer>
  )
}
