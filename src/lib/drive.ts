import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";

let cached: ReturnType<typeof google.drive> | null = null;

export function getDrive() {
  if (cached) return cached;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_PATH required");
  const credentials = JSON.parse(readFileSync(keyPath, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

export async function uploadToDrive(opts: {
  name: string;
  mimeType: string;
  body: Buffer | NodeJS.ReadableStream;
  parentFolderId?: string;
}): Promise<string> {
  const drive = getDrive();
  const parent = opts.parentFolderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parent) throw new Error("GOOGLE_DRIVE_FOLDER_ID required");
  const body =
    Buffer.isBuffer(opts.body) ? Readable.from(opts.body) : opts.body;
  const res = await drive.files.create({
    requestBody: { name: opts.name, parents: [parent] },
    media: { mimeType: opts.mimeType, body },
    fields: "id",
  });
  return res.data.id!;
}

export async function listFiles(folderId?: string) {
  const drive = getDrive();
  const parent = folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parent) throw new Error("GOOGLE_DRIVE_FOLDER_ID required");
  const res = await drive.files.list({
    q: `'${parent}' in parents and trashed = false`,
    fields: "files(id,name,createdTime,size)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });
  return res.data.files ?? [];
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}
