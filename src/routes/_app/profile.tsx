import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { fetchSessionMember } from "@/fn/auth";
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

  async function handleUpdateProfile() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("members")
        .update({ full_name: fullName })
        .eq("user_id", member?.userId);

      if (error) throw error;
      toast.success("Profile updated successfully");
      qc.invalidateQueries({ queryKey: ["session", "member"] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
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
                  onClick={() =>
                    setShowPasswords((p) => ({ ...p, new: !p.new }))
                  }
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.new ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
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
                  onClick={() =>
                    setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))
                  }
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
