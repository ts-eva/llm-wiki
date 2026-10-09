#!/usr/bin/env node
/**
 * SessionEnd hook: commit the wiki files this session edited (server/session-commit.js), in a
 * detached process so exiting stays fast. Only the session's own Write/Edit targets are
 * committed, so parallel sessions and the user's staged changes are left alone.
 *
 * Silent and a no-op when no wiki is found or config.yaml sets `git.auto_commit: false`.
 * Log (commits and errors only): ~/.claude/llm-wiki-commit.log.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { resolveWikiPath } from "../server/wiki-path.js";
import { autoCommitEnabled } from "../server/session-commit.js";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let hook;
try { hook = JSON.parse(input); } catch { process.exit(0); }

const wikiPath = resolveWikiPath();
if (!hook.transcript_path || !fs.existsSync(hook.transcript_path)) process.exit(0);
if (!fs.existsSync(path.join(wikiPath, ".git")) || !autoCommitEnabled(wikiPath)) process.exit(0);

const log = fs.openSync(path.join(os.homedir(), ".claude", "llm-wiki-commit.log"), "a");
const script = fileURLToPath(new URL("../server/session-commit.js", import.meta.url));
spawn(process.execPath, [script, hook.transcript_path, wikiPath], { detached: true, stdio: ["ignore", log, log] }).unref();
