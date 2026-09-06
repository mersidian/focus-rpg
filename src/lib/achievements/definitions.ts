/**
 * The 131 achievements of SPEC.md §5, in the thirteen families the spec names.
 *
 * The spec fixes what each one is for but not what it pays, which carry a
 * wearable title, or which grant freezes. Those are set here:
 *
 *   XP follows a five-step rarity ladder, so a 365-day streak and a 3-day
 *   streak are not paid from the same curve.
 *   Titles go to the 44 that describe a person rather than a number — you can
 *   wear "Night Shift", not "50 sessions".
 *   Freezes go to Consistency and Recovery, the two families about surviving
 *   time away, so the reward matches what the achievement is about.
 */

import type { Stats } from "./stats";

export const FAMILIES = [
  "volume",
  "consistency",
  "feats",
  "time",
  "discipline",
  "recovery",
  "mastery",
  "journal",
  "calendar",
  "longhaul",
  "prestige",
  "meta",
  "hidden",
] as const;

export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABEL: Record<Family, string> = {
  volume: "Volume",
  consistency: "Consistency",
  feats: "Feats",
  time: "Time of day",
  discipline: "Discipline",
  recovery: "Recovery",
  mastery: "Session mastery",
  journal: "Journal",
  calendar: "Calendar",
  longhaul: "Long haul",
  prestige: "Prestige",
  meta: "Meta",
  hidden: "Hidden",
};

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/**
 * What each rarity pays. One place to argue with.
 *
 * Kept deliberately small. The ladder is calibrated in focused hours — Mythic V
 * *is* ten thousand of them (§4.1) — so achievements must stay a garnish rather
 * than a second income. The whole set of 131 is worth about 27,000 XP, under 5%
 * of the 600,000 the ladder runs to; earning every one of them advances you
 * roughly as far as 450 hours of work, not 2,600.
 */
export const RARITY_XP: Record<Rarity, number> = {
  common: 15,
  uncommon: 40,
  rare: 100,
  epic: 250,
  legendary: 700,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export type Achievement = {
  id: string;
  family: Family;
  name: string;
  description: string;
  rarity: Rarity;
  /** Wearable in place of the level title (§5). */
  title?: string;
  /** Freezes granted on unlock (§7). */
  freezes?: number;
  /** Shown as a silhouette with only a family hint until earned (§5). */
  hidden?: boolean;
  /** Cannot fire until prestige exists in Phase 4. */
  deferred?: boolean;
  check: (s: Stats) => boolean;
};

const HOUR = 3_600_000;

function a(
  id: string,
  family: Family,
  name: string,
  description: string,
  rarity: Rarity,
  check: (s: Stats) => boolean,
  extra: Partial<Achievement> = {},
): Achievement {
  return { id, family, name, description, rarity, check, ...extra };
}

/* ------------------------------------------------------- volume (14) */

const volume: Achievement[] = [
  a("vol-first", "volume", "First Light", "Finish your first session.", "common", (s) => s.sessions >= 1),
  a("vol-10", "volume", "Ten Down", "Finish 10 sessions.", "common", (s) => s.sessions >= 10),
  a("vol-25", "volume", "Two Dozen and One", "Finish 25 sessions.", "common", (s) => s.sessions >= 25),
  a("vol-50", "volume", "Half a Hundred", "Finish 50 sessions.", "uncommon", (s) => s.sessions >= 50),
  a("vol-100", "volume", "Century", "Finish 100 sessions.", "uncommon", (s) => s.sessions >= 100),
  a("vol-250", "volume", "Deep Bench", "Finish 250 sessions.", "rare", (s) => s.sessions >= 250),
  a("vol-500", "volume", "Five Hundred", "Finish 500 sessions.", "rare", (s) => s.sessions >= 500),
  a("vol-1000", "volume", "Four Figures", "Finish 1,000 sessions.", "epic", (s) => s.sessions >= 1000),
  a("vol-2500", "volume", "Twenty-Five Hundred", "Finish 2,500 sessions.", "legendary", (s) => s.sessions >= 2500, { title: "the Relentless" }),
  a("vol-10h", "volume", "Ten Hours", "Focus for 10 hours.", "common", (s) => s.focusedMs >= 10 * HOUR),
  a("vol-50h", "volume", "Fifty Hours", "Focus for 50 hours.", "uncommon", (s) => s.focusedMs >= 50 * HOUR),
  a("vol-100h", "volume", "Hundred Hours", "Focus for 100 hours.", "rare", (s) => s.focusedMs >= 100 * HOUR),
  a("vol-500h", "volume", "Five Hundred Hours", "Focus for 500 hours.", "epic", (s) => s.focusedMs >= 500 * HOUR),
  a("vol-1000h", "volume", "A Tenth of the Way", "Focus for 1,000 hours — a tenth of the number the ladder ends on.", "legendary", (s) => s.focusedMs >= 1000 * HOUR, { title: "the Tenth Part" }),
];

/* -------------------------------------------------- consistency (14) */

const consistency: Achievement[] = [
  a("con-3", "consistency", "Three in a Row", "Keep a 3-day streak.", "common", (s) => s.longestStreak >= 3),
  a("con-7", "consistency", "A Full Week", "Keep a 7-day streak.", "common", (s) => s.longestStreak >= 7, { freezes: 1 }),
  a("con-14", "consistency", "Fortnight", "Keep a 14-day streak.", "uncommon", (s) => s.longestStreak >= 14, { freezes: 1 }),
  a("con-30", "consistency", "Thirty Days", "Keep a 30-day streak.", "rare", (s) => s.longestStreak >= 30, { freezes: 2 }),
  a("con-60", "consistency", "Two Months Unbroken", "Keep a 60-day streak.", "rare", (s) => s.longestStreak >= 60, { freezes: 2 }),
  a("con-100", "consistency", "Hundred Days", "Keep a 100-day streak.", "epic", (s) => s.longestStreak >= 100, { title: "the Unbroken", freezes: 3 }),
  a("con-200", "consistency", "Two Hundred Days", "Keep a 200-day streak.", "epic", (s) => s.longestStreak >= 200, { freezes: 3 }),
  a("con-365", "consistency", "A Year to the Day", "Keep a 365-day streak.", "legendary", (s) => s.longestStreak >= 365, { title: "the Yearlong", freezes: 5 }),
  a("con-500", "consistency", "Five Hundred Days", "Keep a 500-day streak.", "legendary", (s) => s.longestStreak >= 500, { title: "the Immovable", freezes: 5 }),
  a("con-clean-month", "consistency", "Nothing Abandoned", "Finish a calendar month without abandoning a single session.", "rare", (s) => s.cleanMonths >= 1, { title: "the Clean" }),
  a("con-4x10", "consistency", "Four Weeks at Ten", "Four straight weeks with 10 or more sessions each.", "rare", (s) => s.maxConsecutiveWeeksWith10Plus >= 4),
  a("con-12-weeks", "consistency", "A Quarter of Weeks", "Twelve straight weeks each containing a session.", "rare", (s) => s.maxConsecutiveWeeksWithSession >= 12),
  a("con-full-year", "consistency", "No Week Missed", "A full year without missing a week.", "legendary", (s) => s.maxConsecutiveWeeksWithSession >= 52, { title: "the Perennial" }),
  a("con-30-fifties", "consistency", "Thirty Deep Days", "Thirty days that each contained a 50-minute session.", "epic", (s) => s.daysWithFiftyMinSession >= 30),
];

/* -------------------------------------------------------- feats (15) */

const feats: Achievement[] = [
  a("feat-3-day", "feats", "Three Before Dark", "Three sessions in one day.", "common", (s) => s.maxSessionsInDay >= 3),
  a("feat-5-day", "feats", "Five in a Day", "Five sessions in one day.", "uncommon", (s) => s.maxSessionsInDay >= 5),
  a("feat-8-day", "feats", "Eight in a Day", "Eight sessions in one day.", "rare", (s) => s.maxSessionsInDay >= 8),
  a("feat-12-day", "feats", "Twelve in a Day", "Twelve sessions in one day.", "epic", (s) => s.maxSessionsInDay >= 12, { title: "the Possessed" }),
  a("feat-6h-day", "feats", "Six Hours", "Six focused hours in one day.", "rare", (s) => s.maxFocusedMsInDay >= 6 * HOUR),
  a("feat-10h-day", "feats", "Ten Hours in a Day", "Ten focused hours in one day.", "epic", (s) => s.maxFocusedMsInDay >= 10 * HOUR, { title: "the Marathoner" }),
  a("feat-4-hours", "feats", "Four Straight Hours", "Four consecutive clock hours each containing a session.", "uncommon", (s) => s.maxConsecutiveHoursWithSession >= 4),
  a("feat-all-50", "feats", "Nothing But Fifties", "A day of two or more sessions where every one ran the full fifty.", "rare", (s) => s.allFiftyDays >= 1),
  a("feat-all-15", "feats", "Nothing But Fifteens", "A day of two or more sessions, all of them fifteens.", "uncommon", (s) => s.allFifteenDays >= 1, { title: "the Sprinter" }),
  a("feat-20-week", "feats", "Twenty in a Week", "Twenty sessions inside one week.", "rare", (s) => s.maxSessionsInWeek >= 20),
  a("feat-100-month", "feats", "A Hundred in a Month", "A hundred sessions inside one month.", "epic", (s) => s.maxSessionsInMonth >= 100),
  a("feat-weekend-8h", "feats", "Lost Weekend", "Eight focused hours across a single weekend.", "rare", (s) => s.maxFocusedMsInWeekend >= 8 * HOUR, { title: "of the Lost Weekend" }),
  a("feat-3-fifties", "feats", "Two and a Half Hours", "Three fifty-minute sessions back to back.", "rare", (s) => s.maxConsecutiveFifties >= 3),
  a("feat-9-to-5", "feats", "Office Hours", "A session in every hour from nine to five.", "epic", (s) => s.nineToFiveSweepDays >= 1, { title: "the Clerk" }),
  a("feat-300-month", "feats", "Three Hundred in a Month", "Three hundred sessions inside one month.", "legendary", (s) => s.maxSessionsInMonth >= 300, { title: "the Insatiable" }),
];

/* ------------------------------------------------- time of day (10) */

const time: Achievement[] = [
  a("time-6am", "time", "Before Six", "Start a session before 6am.", "common", (s) => s.sessionsBefore6am >= 1),
  a("time-5am", "time", "Before Five", "Start a session before 5am.", "uncommon", (s) => s.sessionsBefore5am >= 1),
  a("time-11pm", "time", "After Eleven", "Start a session after 11pm.", "common", (s) => s.sessionsAfter11pm >= 1),
  a("time-2am", "time", "The Small Hours", "Start a session after 2am.", "uncommon", (s) => s.sessionsAfter2am >= 1, { title: "the Nocturnal" }),
  a("time-all-hours", "time", "Round the Clock", "A session begun in all twenty-four clock hours, over a lifetime.", "legendary", (s) => s.hoursCovered >= 24, { title: "of All Hours" }),
  a("time-25-early", "time", "Twenty-Five Mornings", "Twenty-five sessions begun before 8am.", "rare", (s) => s.sessionsBefore8am >= 25, { title: "the Lark" }),
  a("time-25-late", "time", "Twenty-Five Nights", "Twenty-five sessions begun after 10pm.", "rare", (s) => s.sessionsAfter10pm >= 25, { title: "Night Shift" }),
  a("time-wake", "time", "Straight to It", "Begin a session within ten minutes of your usual start time.", "uncommon", (s) => s.startedWithin10minOfUsualWake),
  a("time-on-hour", "time", "On the Hour", "Finish a session exactly on the hour.", "rare", (s) => s.finishedOnTheHour),
  a("time-midnight-cross", "time", "Across the Line", "Work a session that begins on one day and ends on the next.", "uncommon", (s) => s.crossedMidnight),
];

/* --------------------------------------------------- discipline (12) */

const discipline: Achievement[] = [
  a("dis-20-nopause", "discipline", "Twenty Unbroken", "Twenty sessions finished without a pause.", "common", (s) => s.zeroPauseSessions >= 20),
  a("dis-50-nopause", "discipline", "Fifty Unbroken", "Fifty sessions finished without a pause.", "uncommon", (s) => s.zeroPauseSessions >= 50),
  a("dis-200-nopause", "discipline", "Two Hundred Unbroken", "Two hundred sessions finished without a pause.", "epic", (s) => s.zeroPauseSessions >= 200),
  a("dis-recover", "discipline", "Back on the Horse", "Abandon a session and finish another the same day.", "common", (s) => s.sameDayRecoveries >= 1),
  a("dis-recover-3", "discipline", "Three Times Over", "Recover from a same-day abandon three times.", "uncommon", (s) => s.sameDayRecoveries >= 3),
  a("dis-10-honest", "discipline", "Ten Straight Answers", "Ten consecutive sessions reported honest.", "common", (s) => s.maxConsecutiveHonest >= 10),
  a("dis-100-honest", "discipline", "A Hundred Straight Answers", "A hundred consecutive honest reports.", "rare", (s) => s.maxConsecutiveHonest >= 100),
  a("dis-500-honest", "discipline", "Five Hundred Straight Answers", "Five hundred consecutive honest reports.", "legendary", (s) => s.maxConsecutiveHonest >= 500, { title: "the Incorruptible" }),
  a("dis-nopause-50", "discipline", "Fifty Minutes, No Stops", "Finish a fifty-minute session without pausing.", "uncommon", (s) => s.noPauseFiftySessions >= 1),
  a("dis-pause-free-week", "discipline", "A Week Without Stopping", "A whole week of sessions with no pause used.", "rare", (s) => s.pauseFreeWeeks >= 1),
  a("dis-100-month", "discipline", "Everything Finished", "A calendar month where every session you started, you finished.", "rare", (s) => s.perfectCompletionMonths >= 1),
  a("dis-50-untouched", "discipline", "Budget Untouched", "Fifty sessions where the pause budget was never touched at all.", "rare", (s) => s.untouchedPauseBudgetSessions >= 50),
];

/* ----------------------------------------------------- recovery (7) */

const recovery: Achievement[] = [
  a("rec-3", "recovery", "Three Days Later", "Come back after three days away.", "common", (s) => s.longestAbsenceDays >= 3),
  a("rec-7", "recovery", "A Week Later", "Come back after a week away.", "uncommon", (s) => s.longestAbsenceDays >= 7, { freezes: 1 }),
  a("rec-30", "recovery", "A Month Later", "Come back after a month away.", "rare", (s) => s.longestAbsenceDays >= 30, { freezes: 2 }),
  a("rec-90", "recovery", "A Season Later", "Come back after ninety days away.", "epic", (s) => s.longestAbsenceDays >= 90, { title: "the Prodigal", freezes: 3 }),
  a("rec-rebuild-7", "recovery", "Rebuilt", "Break a streak, then build a new one to seven days.", "uncommon", (s) => s.rebuiltStreak7, { freezes: 1 }),
  a("rec-rebuild-30", "recovery", "Rebuilt in Full", "Break a streak, then build a new one to thirty days.", "rare", (s) => s.rebuiltStreak30, { title: "the Rebuilt", freezes: 2 }),
  a("rec-beat-own", "recovery", "Your Own Record", "Beat your own longest streak.", "rare", (s) => s.beatOwnLongestStreak),
];

/* ---------------------------------------------- session mastery (9) */

const mastery: Achievement[] = [
  a("mas-50x50", "mastery", "Fifty Fifties", "Finish fifty of the fifty-minute sessions.", "uncommon", (s) => (s.countByLength[50] ?? 0) >= 50),
  a("mas-200x50", "mastery", "Two Hundred Fifties", "Finish two hundred fifty-minute sessions.", "rare", (s) => (s.countByLength[50] ?? 0) >= 200),
  a("mas-500x50", "mastery", "Five Hundred Fifties", "Finish five hundred fifty-minute sessions.", "legendary", (s) => (s.countByLength[50] ?? 0) >= 500, { title: "the Immersed" }),
  a("mas-100x25", "mastery", "A Hundred Twenty-Fives", "Finish a hundred twenty-five-minute sessions.", "uncommon", (s) => (s.countByLength[25] ?? 0) >= 100),
  a("mas-500x25", "mastery", "Five Hundred Twenty-Fives", "Finish five hundred twenty-five-minute sessions.", "epic", (s) => (s.countByLength[25] ?? 0) >= 500),
  a("mas-100x15", "mastery", "A Hundred Fifteens", "Finish a hundred fifteen-minute sessions.", "uncommon", (s) => (s.countByLength[15] ?? 0) >= 100),
  a("mas-all-three", "mastery", "All Three Lengths", "Use all three session lengths in one day.", "common", (s) => s.allThreeLengthsDays >= 1),
  a("mas-1000-clean", "mastery", "A Clean Hundred", "A thousand sessions in, with the last hundred all finished.", "legendary", (s) => s.sessions >= 1000 && s.cleanFinalSessions >= 100, { title: "the Surefooted" }),
  a("mas-10-days-full", "mastery", "Every Planned Minute", "Ten straight days finishing every minute you planned.", "rare", (s) => s.maxConsecutiveCleanDays >= 10),
];

/* ------------------------------------------------------ journal (8) */

const journal: Achievement[] = [
  a("jou-long-note", "journal", "Something Worth Saying", "Write a session note over a hundred characters.", "common", (s) => s.longNotes >= 1),
  a("jou-50-long", "journal", "Fifty Worth Saying", "Fifty notes over a hundred characters.", "rare", (s) => s.longNotes >= 50, { title: "the Chronicler" }),
  a("jou-project-10", "journal", "Ten on One Thing", "Log ten sessions against a single project.", "common", (s) => s.maxSessionsOnOneProject >= 10),
  a("jou-project-50", "journal", "Fifty on One Thing", "Log fifty sessions against a single project.", "uncommon", (s) => s.maxSessionsOnOneProject >= 50),
  a("jou-project-200", "journal", "Two Hundred on One Thing", "Log two hundred sessions against a single project.", "epic", (s) => s.maxSessionsOnOneProject >= 200, { title: "the Devoted" }),
  a("jou-30-days", "journal", "A Month of Notes", "Write a note on thirty consecutive days.", "rare", (s) => s.maxConsecutiveDaysWithNote >= 30),
  a("jou-first-slack", "journal", "Owned It", "Admit, once, that you slacked.", "common", (s) => s.slackedAdmissions >= 1),
  a("jou-25-slack", "journal", "Twenty-Five Admissions", "Twenty-five honest admissions that you slacked.", "rare", (s) => s.slackedAdmissions >= 25, { title: "the Candid" }),
];

/* ----------------------------------------------------- calendar (9) */

const calendar: Achievement[] = [
  a("cal-new-year", "calendar", "First of January", "Work a session on New Year's Day.", "uncommon", (s) => s.calendarDaysCovered.has("01-01")),
  a("cal-birthday", "calendar", "Many Happy Returns", "Work a session on your birthday.", "rare", (s) => s.birthdayWorked === true, { title: "the Unsentimental" }),
  a("cal-holiday", "calendar", "Working the Holiday", "Work a session on a public holiday.", "uncommon", (s) => s.holidayWorked === true),
  a("cal-full-month", "calendar", "Every Day of a Month", "Work on every single day of one calendar month.", "epic", (s) => s.fullCalendarMonths >= 1, { title: "the Unmissed" }),
  a("cal-12-months", "calendar", "All Twelve", "Work a session in all twelve months.", "rare", (s) => s.monthsCovered.size >= 12),
  a("cal-seasons", "calendar", "All Four Seasons", "Work in all four seasons.", "uncommon", (s) => s.seasonsCovered.size >= 4),
  a("cal-leap", "calendar", "The Extra Day", "Work a session on the 29th of February.", "epic", (s) => s.calendarDaysCovered.has("02-29"), { title: "the Intercalary" }),
  a("cal-sunday-morning", "calendar", "Sunday Morning", "Work a session on a Sunday morning.", "common", (s) => s.sundayMorning),
  a("cal-12-mondays", "calendar", "Twelve Mondays", "Work twelve Mondays in a row.", "rare", (s) => s.maxConsecutiveMondays >= 12),
];

/* ---------------------------------------------------- long haul (8) */

const longhaul: Achievement[] = [
  a("lh-3m", "longhaul", "Three Months In", "Still here three months after you started.", "uncommon", (s) => s.activeMonthsSpan >= 3),
  a("lh-6m", "longhaul", "Half a Year In", "Still here six months after you started.", "rare", (s) => s.activeMonthsSpan >= 6),
  a("lh-1y", "longhaul", "One Year In", "Still here a year after you started.", "epic", (s) => s.activeMonthsSpan >= 12),
  a("lh-2y", "longhaul", "Two Years In", "Still here two years after you started.", "epic", (s) => s.activeMonthsSpan >= 24),
  a("lh-3y", "longhaul", "Three Years In", "Still here three years after you started.", "legendary", (s) => s.activeMonthsSpan >= 36, { title: "the Long-Standing" }),
  a("lh-100h-month", "longhaul", "A Hundred Hours in a Month", "A hundred focused hours inside one calendar month.", "epic", (s) => s.maxFocusedMsInMonth >= 100 * HOUR),
  a("lh-200h-quarter", "longhaul", "Two Hundred Hours in a Quarter", "Two hundred focused hours inside one quarter.", "epic", (s) => s.maxFocusedMsInQuarter >= 200 * HOUR),
  a("lh-1000h-clean", "longhaul", "A Thousand Hours, Nothing Dropped", "A thousand lifetime hours with no abandon in the last two hundred sessions.", "legendary", (s) => s.focusedMs >= 1000 * HOUR && s.abandonsInLast200 === 0, { title: "the Unfaltering" }),
];

/* ---------------------------------------------------- prestige (10) */

const prestige: Achievement[] = [
  a("pre-50", "prestige", "Sage V", "Reach level 50, where the choice appears.", "epic", (s) => s.peakLevel >= 50),
  a("pre-once", "prestige", "Begin Again", "Prestige for the first time.", "epic", (s) => s.prestigeStars >= 1, { title: "the Reborn" }),
  a("pre-2", "prestige", "Two Stars", "Reach two prestige stars.", "epic", (s) => s.prestigeStars >= 2),
  a("pre-3", "prestige", "Three Stars", "Reach three prestige stars.", "legendary", (s) => s.prestigeStars >= 3),
  a("pre-5", "prestige", "Five Stars", "Reach five prestige stars.", "legendary", (s) => s.prestigeStars >= 5, { deferred: true,  }),
  a("pre-10", "prestige", "Eternal Recurrence", "Reach ten prestige stars.", "legendary", (s) => s.prestigeStars >= 10, { title: "Eternal Recurrence" }),
  a("pre-clean-cycle", "prestige", "A Clean Cycle", "Prestige with no abandoned session in the whole cycle.", "legendary", (s) => s.prestigedCleanCycles >= 1, { title: "the Spotless" }),
  a("pre-twice-in-year", "prestige", "Twice Around", "Reach level 50 twice, each inside a year.", "legendary", (s) => s.cyclesToFiftyWithinAYear >= 2),
  a("pre-decline-75", "prestige", "The Road Not Taken", "Decline prestige and climb to level 75 instead.", "legendary", (s) => s.declinedPrestige && s.level >= 75, { title: "the Undivided" }),
  a("pre-mythic", "prestige", "Mythic V", "Reach level 100 — ten thousand focused hours.", "legendary", (s) => s.peakLevel >= 100, { title: "the Mythic" }),
];

/* -------------------------------------------------------- meta (7) */

const meta: Achievement[] = [
  a("meta-10", "meta", "Ten Earned", "Earn ten achievements.", "common", (s) => s.unlockedCount >= 10),
  a("meta-25", "meta", "Twenty-Five Earned", "Earn twenty-five achievements.", "uncommon", (s) => s.unlockedCount >= 25),
  a("meta-50", "meta", "Fifty Earned", "Earn fifty achievements.", "rare", (s) => s.unlockedCount >= 50),
  a("meta-75", "meta", "Seventy-Five Earned", "Earn seventy-five achievements.", "epic", (s) => s.unlockedCount >= 75, { title: "the Collector" }),
  a("meta-100", "meta", "A Hundred Earned", "Earn a hundred achievements.", "legendary", (s) => s.unlockedCount >= 100, { title: "the Compleat" }),
  a("meta-first-hidden", "meta", "Something Unlisted", "Trip a hidden achievement without knowing it was there.", "rare", (s) => s.unlockedHidden >= 1),
  a("meta-family", "meta", "One Family Whole", "Complete an entire family.", "epic", (s) => s.completedFamilies >= 1),
];

/* ------------------------------------------------------ hidden (8) */

const hidden: Achievement[] = [
  a("hid-midnight", "hidden", "The Stroke of Twelve", "Finish a session at exactly midnight.", "epic", (s) => s.exactMidnightFinish, { hidden: true, title: "of the Witching Hour" }),
  a("hid-same-minute", "hidden", "Clockwork", "Begin a session at the same minute seven days running.", "epic", (s) => s.sameMinuteStartRun >= 7, { hidden: true, title: "the Clockwork" }),
  a("hid-404", "hidden", "Not Found", "Reach exactly 404 sessions.", "rare", (s) => s.sessions === 404, { hidden: true, title: "the Missing" }),
  a("hid-palindrome", "hidden", "Reads Both Ways", "Reach a session count that reads the same backwards, at three digits or more.", "rare", (s) => { const n = String(s.sessions); return n.length >= 3 && n === [...n].reverse().join(""); }, { hidden: true }),
  a("hid-mirror-day", "hidden", "Mirror Day", "A day whose session lengths read the same in both directions.", "rare", (s) => s.mirrorDays >= 1, { hidden: true, title: "the Symmetrical" }),
  a("hid-watchnight", "hidden", "Watchnight", "Work a session that starts in one year and ends in the next.", "legendary", (s) => s.yearCrossingSession, { hidden: true, title: "of the Watchnight" }),
  a("hid-full-budget", "hidden", "Every Last Second", "Finish a session having spent the entire pause budget — both pauses, all five minutes.", "epic", (s) => s.fullPauseBudgetCompletions >= 1, { hidden: true, title: "the Brinkman" }),
  a("hid-cold-open", "hidden", "Cold Open", "Begin a session in the first minute of a new game day, at 4am exactly.", "epic", (s) => s.coldOpens >= 1, { hidden: true, title: "the First Awake" }),
];

export const ACHIEVEMENTS: Achievement[] = [
  ...volume,
  ...consistency,
  ...feats,
  ...time,
  ...discipline,
  ...recovery,
  ...mastery,
  ...journal,
  ...calendar,
  ...longhaul,
  ...prestige,
  ...meta,
  ...hidden,
];

export const BY_ID = new Map(ACHIEVEMENTS.map((x) => [x.id, x]));

export function achievementXp(x: Achievement): number {
  return RARITY_XP[x.rarity];
}
