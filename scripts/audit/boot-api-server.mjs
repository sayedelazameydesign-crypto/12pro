/**
 * AUDIT TOOLING (not shipped runtime code): boots the real api-server on a chosen port so the
 * knowledge API audit can talk to it over HTTP.
 *
 *   AUDIT_PORT=3101 node scripts/audit/boot-api-server.mjs
 *
 * Why .mjs and not .ts: the server's own entrypoint hardcodes port 3001, so the audit needs a thin
 * launcher. Keeping the launcher in plain JS means Node's type stripping loads the TypeScript source
 * directly (no tsx, no build step, no network) and the launcher itself adds nothing to the typecheck
 * surface (tsconfig.typecheck.json includes scripts/**\/*).
 *
 * KNOWLEDGE_DIR is resolved from process.cwd() by the server, so the audit controls degradation by
 * choosing the working directory: cwd=<repo> serves the real files, cwd=/tmp proves the 503 path.
 */
const { startApiServer, stopApiServer } = await import('../../services/api-server/src/index.ts');

const port = Number(process.env.AUDIT_PORT || 3101);
const { server } = await startApiServer(port);

console.log(`AUDIT_BOOT_OK port=${port} cwd=${process.cwd()} knowledgeDirFromCwd=true`);

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`AUDIT_BOOT_STOP signal=${signal}`);
  await stopApiServer(server);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
