/**
 * si-state-validator.mjs — PostToolUse(Write|Edit) hook that validates critical JSON files after writes.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<void>
 *   Input:  payload { tool_name: string, file_path: string }, projectRoot (absolute path)
 *   Output: void (side effects only)
 *   Side effects:
 *     - Creates a backup of monitored files before validation
 *     - Reverts file from backup if JSON is corrupt or schema invalid
 *     - Reverts agent_defined/settings.json if iterations field decreases
 *   Depends on: ./lib/state-io.mjs (readJSON, writeJSON, validateSchema, backupFile, readAgentSettings)
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJSON, validateSchema, backupFile } from './lib/state-io.mjs';

const MONITORED_TARGETS = [
  { suffix: path.join('docs', 'user_defined', 'settings.json'),  schema: 'user_settings' },
  { suffix: path.join('docs', 'agent_defined', 'settings.json'), schema: 'agent_settings' },
  { suffix: path.join('docs', 'agent_defined', 'notebook.json'), schema: 'notebook' },
];

/**
 * Find the most recent backup file in the .backup/ sibling directory
 * that contains valid JSON matching the given schema.
 * Returns the backup path string or null if none found.
 */
function findLatestValidBackup(filePath, schemaName, excludePath) {
  const backupDir = path.join(path.dirname(filePath), '.backup');
  if (!fs.existsSync(backupDir)) return null;

  const base = path.basename(filePath);
  const candidates = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith(base))
    .sort()
    .reverse(); // most recent timestamp first

  for (const candidate of candidates) {
    const candidatePath = path.join(backupDir, candidate);
    if (excludePath && candidatePath === excludePath) continue;
    const data = readJSON(candidatePath);
    if (data === null) continue;
    const { valid } = validateSchema(schemaName, data);
    if (valid) return candidatePath;
  }
  return null;
}

/**
 * Revert filePath by copying backupPath back to filePath.
 */
function revertFromBackup(filePath, backupPath) {
  fs.copyFileSync(backupPath, filePath);
}

export default async function handler(payload, projectRoot) {
  const { file_path: filePath } = payload;

  // Determine if this file is a monitored target
  const target = MONITORED_TARGETS.find((t) =>
    filePath.endsWith(path.sep + t.suffix) || filePath.endsWith('/' + t.suffix)
  );
  if (!target) return;

  // Step 1: Create backup of current file (may be corrupt)
  const currentBackupPath = backupFile(filePath);

  // Step 2: Read the written file
  const data = readJSON(filePath);

  // Step 3: If null (corrupt JSON) → find latest valid backup and revert
  if (data === null) {
    const validBackup = findLatestValidBackup(filePath, target.schema);
    if (validBackup) revertFromBackup(filePath, validBackup);
    return;
  }

  // Step 4: Validate schema → if invalid → find latest valid backup and revert
  const { valid } = validateSchema(target.schema, data);
  if (!valid) {
    const validBackup = findLatestValidBackup(filePath, target.schema);
    if (validBackup) revertFromBackup(filePath, validBackup);
    return;
  }

  // Step 5: For agent settings only — enforce monotonicity of iterations field
  // Exclude the backup just created (it contains the current write's data) so we
  // compare against the PRIOR state, not the value we are validating.
  if (target.schema === 'agent_settings') {
    const validBackup = findLatestValidBackup(filePath, target.schema, currentBackupPath);
    if (validBackup) {
      const backupData = readJSON(validBackup);
      if (backupData !== null && typeof backupData.iterations === 'number') {
        if (data.iterations < backupData.iterations) {
          revertFromBackup(filePath, validBackup);
        }
      }
    }
  }
}
