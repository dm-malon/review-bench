// Parses a unified diff (as printed by `gh pr diff`) into added line numbers per file.

export interface ChangedFile {
  path: string;
  /** Line numbers in the new version of the file that were added or changed. */
  addedLines: Set<number>;
}

const FILE_HEADER = /^\+\+\+ (?:b\/)?(.+)$/;
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let current: ChangedFile | null = null;
  // True between "diff --git" and the first "@@": only there "---"/"+++" are file headers.
  let inFileHeader = false;
  let newLine = 0;

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = null;
      inFileHeader = true;
      continue;
    }
    if (inFileHeader) {
      const fileMatch = FILE_HEADER.exec(line);
      if (fileMatch?.[1]) {
        // "+++ /dev/null" means the file was deleted: nothing to review.
        current = fileMatch[1] === '/dev/null' ? null : { path: fileMatch[1], addedLines: new Set() };
        if (current) {
          files.push(current);
        }
      }
    }
    const hunkMatch = HUNK_HEADER.exec(line);
    if (hunkMatch?.[1]) {
      inFileHeader = false;
      newLine = Number(hunkMatch[1]);
      continue;
    }
    if (inFileHeader || !current) {
      continue;
    }
    if (line.startsWith('+')) {
      current.addedLines.add(newLine);
      newLine++;
    } else if (line.startsWith(' ')) {
      newLine++;
    }
    // Lines starting with "-" exist only in the old version; "\" is "No newline at end of file".
  }
  return files.filter((f) => f.addedLines.size > 0);
}
