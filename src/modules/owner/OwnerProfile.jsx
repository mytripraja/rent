import { useState } from 'react'
import { updateOwnProfile } from '../../services/authService'
import { uploadUnsigned } from '../../services/cloudinaryService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'
import PhotoCropper from '../shared/ui/PhotoCropper'

export default function OwnerProfile() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [photoUrl, setPhotoUrl] = useState(user?.profilePhotoUrl || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cropFile, setCropFile] = useState(null)

  async function handleCropDone(blob) {
    setCropFile(null)
    setUploading(true)
    try {
      const { url } = await uploadUnsigned(blob, 'profile-photos')
      setPhotoUrl(url)
      showToast({ message: "Photo uploaded successfully", type: "success" })
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to upload photo", type: "error" })
    } finally {
      setUploading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateOwnProfile({ uid: user.uid, name, phone, profilePhotoUrl: photoUrl })
      showToast({ message: "Profile saved successfully", type: "success" })
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to save profile", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-ink">My Profile</h2>

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-paper overflow-hidden flex items-center justify-center text-lg text-ink-soft shrink-0">
            {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : name?.[0] || '?'}
          </div>
          <div>
            <label className="text-xs text-brand font-medium cursor-pointer">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                if (e.target.files[0]) setCropFile(e.target.files[0])
              }} disabled={uploading} />
            </label>
            <p className="text-xs text-ink-soft mt-1">{user?.role === 'admin' ? 'Super Admin' : 'Owner'}</p>
          </div>
        </div>

        {cropFile && (
          <PhotoCropper 
            file={cropFile} 
            onCancel={() => setCropFile(null)} 
            onCrop={handleCropDone} 
          />
        )}

        <div>
          <label className="text-sm text-ink-soft">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-sm text-ink-soft">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-sm text-ink-soft">Email</label>
          <input value={user?.email || ''} disabled
            className="mt-1 w-full border border-brass/25 bg-paper rounded-lg px-3 py-2 text-sm text-ink-soft" />
        </div>

        <div className="pt-2 border-t border-brass/20">
          <label className="flex items-center justify-between text-sm font-medium text-ink cursor-pointer">
            <span className="flex items-center gap-2">
              Two-Factor Authentication
              {user?.twoFactorEnabled && <span className="px-2 py-0.5 bg-stamp-green/10 text-stamp-green rounded-full text-xs">Enabled</span>}
            </span>
            <input 
              type="checkbox" 
              className="toggle-checkbox"
              checked={user?.twoFactorEnabled || false}
              onChange={(e) => {
                showToast({ message: "2FA configuration flow requires custom OTP UI (Scaffold active)", type: "info" })
                // updateOwnProfile({ uid: user.uid, twoFactorEnabled: e.target.checked, twoFactorPhone: phone })
              }}
            />
          </label>
          <p className="text-xs text-ink-soft mt-1">When enabled, you'll receive an OTP on your phone during login.</p>
        </div>

        <button disabled={saving} className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
