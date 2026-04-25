'use client'

import { useState } from 'react'
import { PageContainer } from '@/_components/page-container'
import { SectionCard } from '@/_components/section-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const SettingsPage = () => {
  const [profile, setProfile] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@school.edu',
    phone: '+1 (555) 123-4567',
  })

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyReports: true,
    classReminders: true,
    studentAlerts: false,
    darkMode: false,
  })

  const [saved, setSaved] = useState(false)

  const handleProfileChange = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handlePreferenceChange = (key: string) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSaveProfile = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <PageContainer
      title="Settings"
      description="Manage your profile and preferences"
    >
      <div className="max-w-2xl space-y-6">
        {/* Profile Section */}
        <SectionCard title="Profile Information">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name
                </label>
                <Input
                  value={profile.firstName}
                  onChange={(e) =>
                    handleProfileChange('firstName', e.target.value)
                  }
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name
                </label>
                <Input
                  value={profile.lastName}
                  onChange={(e) =>
                    handleProfileChange('lastName', e.target.value)
                  }
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => handleProfileChange('email', e.target.value)}
                placeholder="Email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input
                value={profile.phone}
                onChange={(e) => handleProfileChange('phone', e.target.value)}
                placeholder="Phone number"
              />
            </div>

            <div className="pt-4 flex gap-2">
              <Button onClick={handleSaveProfile}>
                {saved ? 'Saved!' : 'Save Changes'}
              </Button>
              <Button variant="outline">Cancel</Button>
            </div>
          </div>
        </SectionCard>

        {/* Notification Preferences */}
        <SectionCard title="Notification Preferences">
          <div className="space-y-4">
            {[
              {
                key: 'emailNotifications',
                label: 'Email Notifications',
                description: 'Receive updates via email',
              },
              {
                key: 'pushNotifications',
                label: 'Push Notifications',
                description: 'Get push alerts on your device',
              },
              {
                key: 'weeklyReports',
                label: 'Weekly Reports',
                description: 'Receive weekly performance reports',
              },
              {
                key: 'classReminders',
                label: 'Class Reminders',
                description: 'Get reminded about upcoming classes',
              },
              {
                key: 'studentAlerts',
                label: 'Student Alerts',
                description: 'Be notified of student issues',
              },
            ].map((pref) => (
              <Card
                key={pref.key}
                className="p-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                onClick={() =>
                  handlePreferenceChange(
                    pref.key as keyof typeof preferences
                  )
                }
              >
                <div>
                  <p className="font-medium text-sm">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {pref.description}
                  </p>
                </div>
                <div className="relative w-10 h-6 bg-muted rounded-full transition-colors" style={{
                  backgroundColor: preferences[pref.key as keyof typeof preferences]
                    ? '#3b82f6'
                    : '#e5e7eb',
                }}>
                  <div
                    className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                    style={{
                      left: preferences[pref.key as keyof typeof preferences]
                        ? '22px'
                        : '2px',
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </SectionCard>

        {/* Display Preferences */}
        <SectionCard title="Display Preferences">
          <Card className="p-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer">
            <div>
              <p className="font-medium text-sm">Dark Mode</p>
              <p className="text-xs text-muted-foreground">
                Use dark theme for the interface
              </p>
            </div>
            <div className="relative w-10 h-6 bg-muted rounded-full transition-colors" style={{
              backgroundColor: preferences.darkMode ? '#3b82f6' : '#e5e7eb',
            }}>
              <div
                className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                style={{
                  left: preferences.darkMode ? '22px' : '2px',
                }}
              />
            </div>
          </Card>
        </SectionCard>
      </div>
    </PageContainer>
  )
}

export default SettingsPage
