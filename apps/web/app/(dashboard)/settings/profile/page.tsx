'use client'

import * as React from 'react'
import { Camera, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/shared/avatar'
import { setTokens } from '@/lib/auth'

export default function ProfilePage() {
  const { user, fetchUser } = useAuthStore()

  const [name, setName] = React.useState(user?.name ?? '')
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)
  const [profileError, setProfileError] = React.useState('')
  const [profileSuccess, setProfileSuccess] = React.useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState('')
  const [avatarSuccess, setAvatarSuccess] = React.useState(false)
  const avatarInputRef = React.useRef<HTMLInputElement>(null)

  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [isSavingPassword, setIsSavingPassword] = React.useState(false)
  const [passwordError, setPasswordError] = React.useState('')
  const [passwordSuccess, setPasswordSuccess] = React.useState(false)

  // Sync name when user loads
  React.useEffect(() => {
    if (user?.name) setName(user.name)
  }, [user?.name])

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    if (!name.trim()) {
      setProfileError('Name is required')
      return
    }
    setIsSavingProfile(true)
    try {
      await api.patch(`/users/${user?.id}`, { name: name.trim() })
      await fetchUser()
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      setProfileError(message)
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleAvatarSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return

    setAvatarError('')
    setAvatarSuccess(false)
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!supportedTypes.includes(file.type)) {
      setAvatarError('Use a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('The image must be 5 MB or smaller.')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const upload = await api.post<{ upload_url: string; key: string }>(
        `/users/${user.id}/avatar-upload?content_type=${encodeURIComponent(file.type)}`,
      )
      const uploadResponse = await fetch(upload.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error('Unable to upload the image')

      await api.post(`/users/${user.id}/avatar-confirm`, { key: upload.key })
      await fetchUser()
      setAvatarSuccess(true)
      setTimeout(() => setAvatarSuccess(false), 3000)
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Unable to upload the image')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setIsSavingPassword(true)
    try {
      const response = await api.patch('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      }) as { access_token: string, refresh_token:string}

      if (response.access_token && response.refresh_token) {
        setTokens(response.access_token, response.refresh_token)
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      setPasswordError(message)
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted">
          <User className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Profile</h1>
          <p className="text-sm text-text-secondary">
            Manage your profile and account settings
          </p>
        </div>
      </div>

      {/* Profile section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          Profile
        </h2>

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar src={user?.avatar_url} name={user?.name} size="lg" />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={!user || isUploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg-secondary bg-accent text-text-inverse transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Upload profile photo"
              title="Upload profile photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {user?.name ?? 'Loading...'}
            </p>
            <p className="text-xs text-text-tertiary">{user?.email ?? ''}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={!user || isUploadingAvatar}
              className="mt-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingAvatar ? 'Uploading photo...' : user?.avatar_url ? 'Change photo' : 'Upload photo'}
            </button>
          </div>
        </div>

        <p className="-mt-2 text-2xs text-text-tertiary">JPG, PNG, or WebP. Maximum 5 MB.</p>
        {avatarError && <p className="text-xs text-status-error">{avatarError}</p>}
        {avatarSuccess && <p className="text-xs text-status-success">Profile photo updated.</p>}

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-medium text-text-secondary">
              Full Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-text-secondary">
              Email
            </label>
            <Input
              id="email"
              value={user?.email ?? ''}
              disabled
              className="opacity-60 cursor-not-allowed"
            />
            <p className="text-2xs text-text-tertiary">
              Email cannot be changed. Contact your admin for help.
            </p>
          </div>

          {profileError && (
            <p className="text-xs text-status-error">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-xs text-status-success">Profile saved successfully.</p>
          )}

          <Button type="submit" variant="primary" size="sm" loading={isSavingProfile}>
            Save Profile
          </Button>
        </form>
      </section>

      {/* Password section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          Change Password
        </h2>

        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="currentPassword" className="text-xs font-medium text-text-secondary">
              Current Password
            </label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-xs font-medium text-text-secondary">
              New Password
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-text-secondary">
              Confirm New Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>

          {passwordError && (
            <p className="text-xs text-status-error">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-xs text-status-success">Password changed successfully.</p>
          )}

          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={isSavingPassword}
          >
            Change Password
          </Button>
        </form>
      </section>
    </div>
  )
}
