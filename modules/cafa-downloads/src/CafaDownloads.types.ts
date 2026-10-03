export type SavedFileResult = {
  /** content:// URI of the saved file; usable with openFile / fileExists. */
  contentUri: string;
  /** Name the file ended up with (the system adds "(1)" if the name was taken). */
  fileName: string;
  /** Human-readable location, e.g. "Download/Cafa AI/report.pdf". */
  displayPath: string;
  /** Folder only, e.g. "Download/Cafa AI". */
  folder: string;
};
