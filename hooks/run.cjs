/**
 * Hook dispatcher — routes Claude Code hook events to their .mjs handler files.
 *
 * @calling-spec
 * - dispatch(eventName, payload, projectRoot): Promise<any>
 *   Input: eventName (string), payload (object), projectRoot (string)
 *   Output: return value of the handler's default export, or undefined
 *   Side effects: writes to stderr on handler load/execution errors
 *   Depends on: node:path, handler .mjs files (resolved at import time)
 */

'use strict';

const path = require('node:path');

const ROUTES = {
  SessionStart: path.join(__dirname, 'si-loop-resume.mjs'),
  SubagentStop: path.join(__dirname, 'si-agent-tracker.mjs'),
  TeammateIdle: path.join(__dirname, 'si-teammate-dispatch.mjs'),
  PreCompact: path.join(__dirname, 'si-state-flush.mjs'),
  Stop: path.join(__dirname, 'si-stop-guard.mjs'),
  SessionEnd: path.join(__dirname, 'si-session-end.mjs'),
  PostToolUse: path.join(__dirname, 'si-state-validator.mjs'),
};

async function dispatch(eventName, payload, projectRoot) {
  if (!ROUTES[eventName]) return undefined;
  try {
    const handler = await import(ROUTES[eventName]);
    return await handler.default(payload, projectRoot);
  } catch (err) {
    process.stderr.write(err.message || String(err));
  }
}

module.exports = { ROUTES, dispatch };
