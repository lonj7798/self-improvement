/**
 * team-manager.mjs — High-level commands for managing the teammate registry and handoff logic.
 *
 * @calling-spec
 * - createTeammate(projectRoot, { role, label, round }): Promise<object>
 *   Input: projectRoot string, params with role, label, round
 *   Output: the registry entry that was added
 *   Side effects: writes registry file; writes agent settings if role="continuation"
 *   Depends on: registry-io.mjs, state-io.mjs
 *
 * - killTeammate(projectRoot, { id }): Promise<void>
 *   Input: projectRoot string, params with id
 *   Output: void
 *   Side effects: removes from registry; nulls continuation.planner_id in settings if it was the planner
 *   Depends on: registry-io.mjs, state-io.mjs
 *
 * - listTeammates(projectRoot): Promise<Teammate[]>
 *   Input: projectRoot string
 *   Output: array of active teammate entries (each has id, role, status)
 *   Side effects: none
 *   Depends on: registry-io.mjs
 *
 * - handoff(projectRoot, { winner_id, round, score_before, score_after }): Promise<void>
 *   Input: projectRoot string, handoff params
 *   Output: void
 *   Side effects: updates registry and agent settings based on win scenario
 *   Depends on: registry-io.mjs, state-io.mjs, archiveNotebook
 *
 * - archiveNotebook(projectRoot, { round }): Promise<{ archive_path: string }>
 *   Input: projectRoot string, params with round number
 *   Output: object with archive_path (absolute path to archived file)
 *   Side effects: copies notebook.json to notebooks/round_{round}.json; resets notebook.json
 *   Depends on: state-io.mjs
 */

import path from 'node:path';
import {
  readJSON,
  writeJSON,
  readAgentSettings,
  writeAgentSettings,
} from './state-io.mjs';
import {
  readRegistry,
  writeRegistry,
  addTeammate,
  removeTeammate,
  listActiveTeammates,
} from './registry-io.mjs';

const NOTEBOOK_SUBPATH = path.join('docs', 'agent_defined', 'notebook.json');
const NOTEBOOKS_DIR_SUBPATH = path.join('docs', 'agent_defined', 'notebooks');

const EMPTY_NOTEBOOK = {
  planner_id: null,
  rounds_active: [],
  streak: 0,
  observations: [],
  dead_ends: [],
  current_theory: null,
};

// ---------------------------------------------------------------------------
// createTeammate
// ---------------------------------------------------------------------------

export async function createTeammate(projectRoot, { role, label, round }) {
  if (role === 'continuation') {
    const registry = await readRegistry(projectRoot);
    const existing = registry.teammates.find(
      (t) => t.role === 'continuation' && t.status === 'active'
    );
    if (existing) {
      throw new Error(`A continuation planner already exists (id: ${existing.id}). Remove it before creating another.`);
    }
  }

  const id = `tm_${Date.now()}`;
  const entry = {
    id,
    role,
    label,
    round_created: round,
    status: 'active',
    streak: 0,
  };

  await addTeammate(projectRoot, entry);

  if (role === 'continuation') {
    writeAgentSettings(projectRoot, { continuation: { planner_id: id } });
  }

  return entry;
}

// ---------------------------------------------------------------------------
// killTeammate
// ---------------------------------------------------------------------------

export async function killTeammate(projectRoot, { id }) {
  const settings = readAgentSettings(projectRoot);
  const isContinuationPlanner = settings.continuation.planner_id === id;

  await removeTeammate(projectRoot, id);

  if (isContinuationPlanner) {
    writeAgentSettings(projectRoot, { continuation: { planner_id: null } });
  }
}

// ---------------------------------------------------------------------------
// listTeammates
// ---------------------------------------------------------------------------

export async function listTeammates(projectRoot) {
  return listActiveTeammates(projectRoot);
}

// ---------------------------------------------------------------------------
// archiveNotebook
// ---------------------------------------------------------------------------

export async function archiveNotebook(projectRoot, { round }) {
  const notebookPath = path.join(projectRoot, NOTEBOOK_SUBPATH);
  const archivePath = path.join(projectRoot, NOTEBOOKS_DIR_SUBPATH, `round_${round}.json`);

  const notebook = readJSON(notebookPath) ?? { ...EMPTY_NOTEBOOK };

  writeJSON(archivePath, notebook);
  writeJSON(notebookPath, { ...EMPTY_NOTEBOOK });

  return { archive_path: archivePath };
}

// ---------------------------------------------------------------------------
// handoff
// ---------------------------------------------------------------------------

export async function handoff(projectRoot, { winner_id, round, score_before, score_after }) {
  const settings = readAgentSettings(projectRoot);
  const streak = settings.continuation.streak ?? 0;
  const continuationPlannerId = settings.continuation.planner_id;

  if (streak >= 3) {
    // Force rotation: archive notebook, clear registry, reset continuation
    await archiveNotebook(projectRoot, { round });

    const registry = await readRegistry(projectRoot);
    registry.teammates = [];
    await writeRegistry(projectRoot, registry);

    writeAgentSettings(projectRoot, {
      continuation: { planner_id: null, streak: 0, notebook_path: null },
    });
  } else if (winner_id === continuationPlannerId) {
    // Continuation wins: increment streak, remove all challengers
    const registry = await readRegistry(projectRoot);
    registry.teammates = registry.teammates.filter((t) => t.id === continuationPlannerId);
    await writeRegistry(projectRoot, registry);

    writeAgentSettings(projectRoot, {
      continuation: { streak: streak + 1 },
    });
  } else {
    // Challenger wins: archive notebook, promote winner, remove all others
    await archiveNotebook(projectRoot, { round });

    const registry = await readRegistry(projectRoot);
    const winner = registry.teammates.find((t) => t.id === winner_id);

    // Keep only the winner, updated to continuation role with streak 1
    if (winner) {
      winner.role = 'continuation';
      winner.streak = 1;
    }
    registry.teammates = winner ? [winner] : [];
    await writeRegistry(projectRoot, registry);

    writeAgentSettings(projectRoot, {
      continuation: {
        planner_id: winner_id,
        streak: 1,
        notebook_path: 'docs/agent_defined/notebook.json',
      },
    });
  }
}
