const editableExtensions = new Set(["md", "txt", "js", "ts"]);

function ext(path: string) {
  const last = path.split(".").pop();
  return last?.toLowerCase() ?? "";
}

export function isEditableText(path: string) {
  return editableExtensions.has(ext(path));
}

export function isPdf(path: string) {
  return ext(path) === "pdf";
}

export function isDocx(path: string) {
  return ext(path) === "docx";
}

export function inferContentType(path: string) {
  if (isPdf(path)) return "application/pdf";
  if (isDocx(path)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (isEditableText(path)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
