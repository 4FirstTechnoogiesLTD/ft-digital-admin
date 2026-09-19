import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, ImagePlus } from "lucide-react";
import { fetchSessionMember } from "@/fn/auth";
import { updateMyProfile } from "@/fn/profile";
import { UserAvatar } from "@/components/user-avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: member } = useQuery({
    queryKey: ["session", "member"],
    queryFn: () => fetchSessionMember(),
  });

  const [fullName, setFullName] = useState("");

  // Update fullName when member data loads
  useEffect(() => {
    if (member?.fullName) {
      setFullName(member.fullName);
    }
  }, [member?.fullName]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  async function handleUpdateProfile() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setLoading(true);
    try {
      await updateMyProfile({ data: { fullName } });
      toast.success("Profile updated successfully");
      qc.invalidateQueries({ queryKey: ["session", "member"] });
      qc.invalidateQueries({ queryKey: ["mail"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file || !member) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image is larger than 2 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = member.userId + "/avatar-" + Date.now() + "." + ext;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateMyProfile({ data: { avatarUrl: publicUrl } });
      toast.success("Profile photo updated");
      qc.invalidateQueries({ queryKey: ["session", "member"] });
      qc.invalidateQueries({ queryKey: ["mail"] });
    } catch (err) {
      console.error(err);
      toast.error("Could not upload that image");
    } finally {
      setUploadingAvatar(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    try {
      await updateMyProfile({ data: { avatarUrl: null } });
      toast.success("Profile photo removed");
      qc.invalidateQueries({ queryKey: ["session", "member"] });
      qc.invalidateQueries({ queryKey: ["mail"] });
    } catch {
      toast.error("Could not remove the photo");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  if (!member) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate({ to: "/" })}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-4"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <h1 className="text-display text-2xl">Profile Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Profile Info Section */}
        <div className="border border-border rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium mb-6">Profile Information</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={member.email}
                disabled
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm opacity-60"
              />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Profile photo</label>
              <div className="flex items-center gap-4">
                <UserAvatar
                  email={member.email}
                  name={member.fullName}
                  src={member.avatarUrl}
                  size={64}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:border-signal disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="size-4" />
                    )}
                    {member.avatarUrl ? "Replace" : "Upload"}
                  </button>
                  {member.avatarUrl && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={uploadingAvatar}
                      className="px-3 py-2 text-sm text-muted-foreground transition hover:text-destructive disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    hidden
                    onChange={(e) => uploadAvatar(e.target.files?.[0])}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Shown next to your messages in the mailbox. PNG, JPG or WebP up to 2 MB.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-signal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <input
                type="text"
                value={member.role}
                disabled
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm opacity-60 capitalize"
              />
            </div>

            <button
              onClick={handleUpdateProfile}
              disabled={loading}
              className="px-4 py-2 bg-signal text-signal-foreground rounded-md text-sm font-medium transition hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-6">Change Password</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.new ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters long
            </p>

            <button
              onClick={handleChangePassword}
              disabled={loading || !newPassword || !confirmPassword}
              className="px-4 py-2 bg-signal text-signal-foreground rounded-md text-sm font-medium transition hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
