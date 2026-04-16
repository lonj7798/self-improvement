/**
 * registry-io.mjs — CRUD operations for the teammate registry JSON file.
 *
 * @calling-spec
 * - readRegistry(projectRoot): Promise<{teammates: Teammate[], updated_at: string}>
 *   Input: absolute path to project root
 *   Output: registry object; returns default if file missing
 *   Side effects: none
 *   Depends on: state-io.mjs readJSON
 *
 * - writeRegistry(projectRoot, registry): Promise<void>
 *   Input: projectRoot, full registry object
 *   Output: void
 *   Side effects: writes registry file to disk
 *   Depends on: state-io.mjs writeJSON
 *
 * - addTeammate(projectRoot, entry): Promise<void>
 *   Input: projectRoot, teammate entry object with unique id
 *   Output: void — throws Error on duplicate id
 *   Side effects: reads then writes registry file
 *   Depends on: readRegistry, writeRegistry
 *
 * - removeTeammate(projectRoot, teammateId): Promise<void>
 *   Input: projectRoot, id string to remove
 *   Output: void — no-op if id not found
 *   Side effects: reads then writes registry file
 *   Depends on: readRegistry, writeRegistry
 *
 * - getTeammateByRole(projectRoot, role): Promise<Teammate|null>
 *   Input: projectRoot, role string
 *   Output: first active teammate with matching role, or null
 *   Side effects: none
 *   Depends on: readRegistry
 *
 * - listActiveTeammates(projectRoot): Promise<Teammate[]>
 *   Input: projectRoot
 *   Output: array of teammates with status === "active"
 *   Side effects: none
 *   Depends on: readRegistry
 *
 * - updateTeammateStatus(projectRoot, teammateId, status): Promise<void>
 *   Input: projectRoot, id string, new status string
 *   Output: void — no-op if id not found
 *   Side effects: reads then writes registry file
 *   Depends on: readRegistry, writeRegistry
 */

import path from 'node:path';
import { readJSON, writeJSON } from './state-io.mjs';

const REGISTRY_SUBPATH = path.join('docs', 'agent_defined', 'teammate_registry.json');

function registryPath(projectRoot) {
  return path.join(projectRoot, REGISTRY_SUBPATH);
}

export async function readRegistry(projectRoot) {
  const data = readJSON(registryPath(projectRoot));
  if (data === null) {
    return { teammates: [], updated_at: new Date().toISOString() };
  }
  return data;
}

export async function writeRegistry(projectRoot, registry) {
  writeJSON(registryPath(projectRoot), registry);
}

export async function addTeammate(projectRoot, entry) {
  const registry = await readRegistry(projectRoot);
  const exists = registry.teammates.some((t) => t.id === entry.id);
  if (exists) {
    throw new Error(`Duplicate teammate id: ${entry.id}`);
  }
  registry.teammates.push(entry);
  await writeRegistry(projectRoot, registry);
}

export async function removeTeammate(projectRoot, teammateId) {
  const registry = await readRegistry(projectRoot);
  registry.teammates = registry.teammates.filter((t) => t.id !== teammateId);
  await writeRegistry(projectRoot, registry);
}

export async function getTeammateByRole(projectRoot, role) {
  const registry = await readRegistry(projectRoot);
  return registry.teammates.find((t) => t.role === role && t.status === 'active') ?? null;
}

export async function listActiveTeammates(projectRoot) {
  const registry = await readRegistry(projectRoot);
  return registry.teammates.filter((t) => t.status === 'active');
}

export async function updateTeammateStatus(projectRoot, teammateId, status) {
  const registry = await readRegistry(projectRoot);
  const teammate = registry.teammates.find((t) => t.id === teammateId);
  if (teammate) {
    teammate.status = status;
    await writeRegistry(projectRoot, registry);
  }
}
