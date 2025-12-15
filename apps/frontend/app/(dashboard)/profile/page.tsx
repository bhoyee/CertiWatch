"use client";

import { useEffect, useState } from "react";
import { fetchJson, patchJson } from "../../../lib/api";

type ProfileDto = {
  email: string;
  name?: string | null;
  role: string;
  tenantName: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJson<ProfileDto>("/api/profile")
      .then((data) => {
        setProfile(data);
        setName(data.name ?? "");
        setError(null);
      })
      .catch((err) => setError(err.message ?? "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await patchJson("/api/profile", { name: name.trim() });
      setSuccess("Profile updated");
      setProfile((p) => (p ? { ...p, name: name.trim() } : p));
    } catch (err: any) {
      setError(err.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">Your account</p>
        <h1 className="text-xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-600">View your details and update your display name.</p>
      </div>

      {loading && <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">Loading profile...</div>}
      {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      {profile && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email" value={profile.email} readOnly />
            <Field label="Tenant" value={profile.tenantName} readOnly />
            <Field label="Role" value={profile.role} readOnly />
            <div>
              <label className="block text-xs font-semibold text-slate-600">Name</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Login uses magic links; password changes are not required. If you need to change your email, ask an admin.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600">{label}</label>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50"
        value={value}
        readOnly={readOnly}
      />
    </div>
  );
}
