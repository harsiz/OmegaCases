/**
 * Public chat word filter.
 * Each matched character is replaced with "#" (Roblox-style).
 * Add more words to BLOCKED_WORDS — the user promised a full list later.
 * Words are matched case-insensitively and catch substrings
 * (e.g. "fuck" catches "fucking", "fucker", etc.).
 */

export const BLOCKED_WORDS: string[] = [
  // ── core ──────────────────────────────────────────────────────────────────
  "fuck", "fucking", "fucker", "fucked", "fucks", "mfucker",
  "motherfucker", "motherfucking",
  "shit", "shitting", "shitter", "shitted", "shits",
  "bitch", "bitches", "bitching", "bitchy", "cum", "cumming", "bust",
  "cunt", "cunts",
  "cock", "cocks", "hentai", "orgasm", "orgy", "",
  "dick", "dicks",
  "pussy", "pussies", "clit",
  "asshole", "assholes", "arsehole", "arseholes",
  "ass", "arse",
  "bastard", "bastards",
  "whore", "whores",
  "slut", "sluts",
  "prick", "pricks",
  "faggot", "faggots", "fag", "fags", "cûm", "black people", "cotton pick", "cotton field", "",
  // ── slurs ─────────────────────────────────────────────────────────────────
  "nigger", "niggers", "nigga", "niggas", "niggà", "n1gg", "nga", "nigg", "negro", "neg", 
  "chink", "chinks", "paki", "gipsy",
  "spic", "spics",
  "kike", "kikes",
  "wetback",
  "tranny", "trannies",
  // ── misc ──────────────────────────────────────────────────────────────────
  "retard", "retarded", "retards", "卍",
  // ── names ─────────────────────────────────────────────────────────────────
  "hitler", "nazi", "diddy", "adolf", "epstein", "stalin", "bin laden", "osama",
]

// Sort by length descending so longer phrases match before shorter substrings
const SORTED = [...BLOCKED_WORDS].sort((a, b) => b.length - a.length)

const FILTER_RE = new RegExp(
  SORTED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
)

export function filterChat(content: string): string {
  return content.replace(FILTER_RE, (match) => "#".repeat(match.length))
}
