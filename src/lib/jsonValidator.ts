export function validateSkillManifest(manifest: any) {
  if (!manifest || typeof manifest !== "object") return { valid: false, errors: ["Invalid manifest object"] };
  const errors: string[] = [];
  if (!manifest.name) errors.push("Missing required field 'name'");
  if (!manifest.description) errors.push("Missing required field 'description'");
  return { valid: errors.length === 0, errors };
}
