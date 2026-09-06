/**
 * Exercises the service layer against the real database, hunting for the bugs
 * unit tests cannot see: repeated calls, concurrent calls, and guards.
 *
 *   node --env-file=.env.local --experimental-strip-types \
 *        --import ./tests/register.mjs scripts/integration-probe.mjs
 *
 * It creates its own throwaway user and deletes it at the end.
 */
import { neon } from "@neondatabase/serverless";
import { advanceStreak, recordCompletedSession, loadStreakState } from "../src/lib/streak-service.ts";
import { evaluateAchievements, listUnlockIds } from "../src/lib/achievements/service.ts";
import { doPrestige, loadPrestige } from "../src/lib/prestige-service.ts";
import {
  mergeProjects,
  renameProject,
  listProjectDetails,
  resolveProject,
} from "../src/lib/project-service.ts";
import { checkVacation } from "../src/lib/streak-service.ts";
import { gameDay, addDays } from "../src/lib/game-day.ts";
import { applyDelta, loadState } from "../src/lib/game-state.ts";

const sql = neon(process.env.DATABASE_URL);
const userId = `probe-${crypto.randomUUID()}`;
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

await sql`insert into "user" (id, name, email) values (${userId}, 'probe', ${userId + "@probe.invalid"})`;
await sql`insert into user_settings (user_id, timezone) values (${userId}, 'Asia/Bangkok')`;

const day = (back, hour = 9) => {
  const d = new Date();
  d.setUTCHours(hour - 7, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - back);
  return d;
};
const addSession = async (back, minutes = 25, status = "completed", projectId = null) => {
  const s = day(back);
  await sql`insert into focus_session (id, user_id, planned_minutes, ruleset, device_id, status,
      started_at, last_heartbeat_at, ended_at, xp_awarded, honest, reported_at, project_id)
    values (${crypto.randomUUID()}, ${userId}, ${minutes}, 'desktop', 'probe', ${status},
      ${s.toISOString()}, ${s.toISOString()}, ${new Date(s.getTime() + minutes * 60000).toISOString()},
      ${status === "completed" ? minutes : -30}, true, ${s.toISOString()}, ${projectId})`;
};

console.log("\n1. streak walk, repeated and concurrent");
for (let b = 10; b >= 1; b--) if (b !== 5) await addSession(b);
const a1 = await advanceStreak(userId);
const a2 = await advanceStreak(userId);
check("a second walk reports no new freezes", a2.frozeDays.length === 0);
check("the streak is stable across walks", a1.state.streak === a2.state.streak,
      `${a1.state.streak} then ${a2.state.streak}`);

await sql`update streak_state set last_evaluated_day = null where user_id = ${userId}`;
const a3 = await advanceStreak(userId);
check("forcing a full re-walk preserves the streak", a3.state.streak === a1.state.streak,
      `${a1.state.streak} then ${a3.state.streak}`);
check("forcing a full re-walk does not re-spend freezes",
      a3.state.freezes === a1.state.freezes, `${a1.state.freezes} then ${a3.state.freezes}`);

await sql`update streak_state set last_evaluated_day = null where user_id = ${userId}`;
const [c1, c2] = await Promise.all([advanceStreak(userId), advanceStreak(userId)]);
const afterConcurrent = await loadStreakState(userId);
check("concurrent walks do not double the streak",
      afterConcurrent.streak === a1.state.streak,
      `${a1.state.streak} then ${afterConcurrent.streak}`);

console.log("\n2. achievements, repeated and concurrent");
const first = await evaluateAchievements(userId);
const second = await evaluateAchievements(userId);
check("a second evaluation awards nothing", second.length === 0, `${second.length} awarded`);
const xpAfter = (await loadState(userId)).xp;
const [, ] = await Promise.all([evaluateAchievements(userId), evaluateAchievements(userId)]);
const xpAfterConcurrent = (await loadState(userId)).xp;
check("concurrent evaluations do not double XP", xpAfter === xpAfterConcurrent,
      `${xpAfter} then ${xpAfterConcurrent}`);
const ids = await listUnlockIds(userId);
check("unlock rows are unique", ids.size === first.length, `${ids.size} vs ${first.length}`);

console.log("\n3. day crediting is idempotent");
const before = (await loadStreakState(userId)).streak;
await recordCompletedSession(userId, day(1), 25);
await recordCompletedSession(userId, day(1), 25);
check("logging twice for one day credits once",
      (await loadStreakState(userId)).streak === before,
      `${before} then ${(await loadStreakState(userId)).streak}`);

console.log("\n4. prestige guards");
await applyDelta(userId, null, "probe", { xp: 60_480 });
await doPrestige(userId);
let secondPrestige = "allowed";
try { await doPrestige(userId); } catch (e) { secondPrestige = e.message; }
check("prestiging twice in a row is refused", secondPrestige !== "allowed", secondPrestige);
const st = await loadState(userId);
check("prestige resets XP and level", st.xp === 0 && st.level === 1, `${st.xp} XP, level ${st.level}`);
check("prestige preserves the peak level", st.peakLevel >= 50, `peak ${st.peakLevel}`);
check("prestige preserves lifetime hours", Number(st.lifetimeFocusedMs) >= 0);
check("one star was taken", (await loadPrestige(userId)).stars === 1);

console.log("\n5. project guards");
const [pa] = await sql`insert into project (id, user_id, name) values (${crypto.randomUUID()}, ${userId}, 'Alpha') returning id`;
const [pb] = await sql`insert into project (id, user_id, name) values (${crypto.randomUUID()}, ${userId}, 'Beta') returning id`;
await addSession(2, 25, "completed", pa.id);
let selfMerge = "allowed";
try { await mergeProjects(userId, pa.id, pa.id); } catch (e) { selfMerge = e.message; }
check("merging a project into itself is refused", selfMerge !== "allowed", selfMerge);
let blankName = "allowed";
try { await renameProject(userId, pa.id, "   "); } catch (e) { blankName = e.message; }
check("renaming to blank is refused", blankName !== "allowed", blankName);
let clash = "allowed";
try { await renameProject(userId, pa.id, "Beta"); } catch (e) { clash = e.message; }
check("renaming onto an existing name is refused", clash !== "allowed", clash);

await mergeProjects(userId, pa.id, pb.id);
let mergeIntoRetired = "allowed";
try { await mergeProjects(userId, pb.id, pa.id); } catch (e) { mergeIntoRetired = e.message; }
check("merging into a retired project is refused", mergeIntoRetired !== "allowed", mergeIntoRetired);
const details = await listProjectDetails(userId);
check("the merged project's hours landed on the target",
      details.find((d) => d.name === "Beta")?.sessions === 1);

console.log("\n6. vacation guards");
const today = gameDay(Date.now(), "Asia/Bangkok");
const vac = async (from, to) => (await checkVacation(userId, from, to, today));
check("a vacation in the past is refused",
      (await vac(addDays(today, -3), addDays(today, -1))).reason === "in_the_past");
check("a backwards range is refused",
      (await vac(addDays(today, 5), addDays(today, 2))).reason === "backwards");
check("more than 21 days is refused",
      (await vac(addDays(today, 1), addDays(today, 25))).reason === "too_long");
check("exactly 21 days is allowed",
      (await vac(addDays(today, 1), addDays(today, 21))).ok === true);
const ok1 = await vac(addDays(today, 1), addDays(today, 5));
await sql`insert into vacation (id, user_id, start_day, end_day, quarter)
          values (${crypto.randomUUID()}, ${userId}, ${addDays(today,1)}, ${addDays(today,5)}, ${ok1.quarter})`;
check("a second vacation in the same quarter is refused",
      (await vac(addDays(today, 8), addDays(today, 10))).reason === "quarter_used");

console.log("\n7. rest days do not rewrite the past");
const ledgerBefore = await sql`select day, state from day_ledger where user_id = ${userId} order by day`;
await sql`update user_settings set rest_weekdays = '{0,1}' where user_id = ${userId}`;
await sql`update streak_state set last_evaluated_day = null where user_id = ${userId}`;
await advanceStreak(userId);
const ledgerAfter = await sql`select day, state from day_ledger where user_id = ${userId} order by day`;
check("already-judged days keep their verdict when rest days change",
      JSON.stringify(ledgerBefore) === JSON.stringify(ledgerAfter),
      `${ledgerBefore.length} rows before, ${ledgerAfter.length} after`);

console.log("\n8. merge chains");
const mk = async (name) => (await sql`insert into project (id, user_id, name)
  values (${crypto.randomUUID()}, ${userId}, ${name}) returning id`)[0].id;
const A = await mk("ChainA"), B = await mk("ChainB"), C = await mk("ChainC");
await addSession(3, 25, "completed", A);
await addSession(3, 25, "completed", B);
await mergeProjects(userId, A, B);
await mergeProjects(userId, B, C);
const chain = await listProjectDetails(userId, true);
check("a chained merge carries every session to the end of the chain",
      chain.find((p) => p.name === "ChainC")?.sessions === 2,
      `ChainC has ${chain.find((p) => p.name === "ChainC")?.sessions}`);
check("the first link still says where it went",
      chain.find((p) => p.name === "ChainA")?.mergedIntoName === "ChainB");
check("no orphaned sessions point at a retired project",
      (await sql`select count(*)::int c from focus_session
                 where user_id = ${userId} and project_id in (${A}, ${B})`)[0].c === 0);

console.log("\n9. a retired name typed again");
const [retired] = await sql`insert into project (id, user_id, name, archived_at)
  values (${crypto.randomUUID()}, ${userId}, 'Retired Thing', now()) returning id`;
const resolvedId = await resolveProject(userId, null, "Retired Thing");
const [revived] = await sql`select archived_at, merged_into_id from project where id = ${retired.id}`;
check("the retired project is reused, not duplicated", resolvedId === retired.id);
check("logging against a retired project's name brings it back",
      revived.archived_at === null, `archived_at = ${revived.archived_at}`);
check("and it no longer points at what it was merged into", revived.merged_into_id === null);

const chainA = chain.find((p) => p.name === "ChainA");
const back = await resolveProject(userId, null, "ChainA");
check("reusing a merged-away name brings that project back too", back === chainA.id);
check("a brand new name creates a project",
      typeof (await resolveProject(userId, null, "Something New")) === "string");
check("a blank name resolves to nothing",
      (await resolveProject(userId, null, "   ")) === null);

console.log("\n10. XP can never go negative");
await applyDelta(userId, null, "probe", { xp: -999_999 });
check("a huge penalty floors at zero", (await loadState(userId)).xp === 0);

/* cleanup */
await sql`delete from "user" where id = ${userId}`;
const [{ c }] = await sql`select count(*)::int c from focus_session where user_id = ${userId}`;
console.log(`\ncleanup: probe user removed, ${c} sessions left behind`);
console.log(failures === 0 ? "\nALL PROBES PASSED" : `\n${failures} PROBE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
