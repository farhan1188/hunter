import { getProfile } from "@/src/profile/store";
import type { Profile } from "@/src/core/types";
import { PreferencesSchema } from "@/src/core/schemas";
import { UploadForm } from "./upload-form";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let profile: Profile | null = null;
  let dbError: string | null = null;
  try {
    profile = await getProfile();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const fallbackPrefs = PreferencesSchema.parse({});

  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Profile</h1>
      </section>

      {dbError && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <strong>Database not configured yet.</strong> Follow{" "}
          <code>docs/setup.md</code> to set up Turso.
          <div className="mt-1 text-xs text-gray-600">{dbError}</div>
        </div>
      )}

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Resume</h2>
        {profile?.resume_file ? (
          <p className="mt-2 text-sm text-gray-600">
            <strong>{profile.resume_file.filename}</strong>, uploaded{" "}
            {new Date(profile.resume_file.uploaded_at).toLocaleString()}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            No resume uploaded yet.
          </p>
        )}
        {profile?.resume_struct && (
          <p className="mt-1 text-xs text-gray-500">
            Parsed {profile.resume_struct.experience.length} roles,{" "}
            {profile.resume_struct.projects.length} project{profile.resume_struct.projects.length === 1 ? "" : "s"},{" "}
            and {profile.resume_struct.skills.primary.length} core skills.
          </p>
        )}
        <div className="mt-4">
          <UploadForm />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Preferences</h2>
        <PreferencesForm initial={profile?.preferences ?? fallbackPrefs} />
      </section>
    </main>
  );
}
