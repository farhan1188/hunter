import { readFile } from "node:fs/promises";
import mammoth from "mammoth";

async function main() {
  const path = process.argv[2] ?? "C:/Users/user/Downloads/Farhan_Ahmed_Khan_Resume.docx";
  const buf = await readFile(path);
  const { value } = await mammoth.extractRawText({ buffer: buf });
  console.log(value);
}
main().catch((e) => { console.error(e); process.exit(1); });
