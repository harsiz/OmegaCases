"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"

const BASE = "https://omegacases.com"

// ─── Shared primitives ────────────────────────────────────────────────────────

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold mb-1">{children}</h1>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold mt-8 mb-3">{children}</h2>
}
function Desc({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground mb-6">{children}</p>
}
function Code({ children }: { children: string }) {
  return <code className="bg-muted border border-border px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
}
function Block({ label, lang = "text", children }: { label?: string; lang?: string; children: string }) {
  return (
    <div className="mb-4">
      {label && <p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>}
      <pre className={`rounded-lg p-4 text-xs font-mono whitespace-pre-wrap break-all ${lang === "js" ? "bg-slate-900 text-blue-300" : lang === "response" ? "bg-slate-900 text-green-300" : "bg-muted text-foreground"}`}>
        {children}
      </pre>
    </div>
  )
}
function Row({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = { GET: "bg-green-700", POST: "bg-blue-700", DELETE: "bg-red-700" }
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <span className={`${colors[method] ?? "bg-muted"} text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0`}>{method}</span>
      <div>
        <code className="text-xs font-mono font-semibold">{path}</code>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border rounded-xl overflow-hidden mb-6">{children}</div>
}
function CardHead({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 bg-muted border-b border-border/60 text-sm font-semibold">{children}</div>
}
function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400 mb-4">
      {children}
    </div>
  )
}
function ScopeTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-4">
      <div className="grid grid-cols-[140px_1fr] text-xs font-bold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted border-b border-border/60">
        <span>Scope</span><span>What it allows</span>
      </div>
      {rows.map(([scope, desc]) => (
        <div key={scope} className="grid grid-cols-[140px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
          <code className="text-xs font-mono text-primary">{scope}</code>
          <span className="text-xs text-muted-foreground">{desc}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Section content ──────────────────────────────────────────────────────────

function Overview() {
  return (
    <>
      <H1>Overview</H1>
      <Desc>OmegaCases developer API — integrate balance, OAuth, and game data into your apps.</Desc>

      <Card>
        <CardHead>Base URL</CardHead>
        <CardBody>
          <code className="text-sm font-mono">{BASE}</code>
        </CardBody>
      </Card>

      <H2>Authentication</H2>
      <p className="text-sm text-muted-foreground mb-4">
        Two auth methods depending on context:
      </p>
      <div className="border border-border rounded-xl overflow-hidden mb-6">
        <div className="grid grid-cols-[120px_1fr] text-xs font-bold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted border-b border-border/60">
          <span>Method</span><span>When to use</span>
        </div>
        {[
          ["User ID",     "Authenticated endpoints where the caller is a Plus user (query param ?user_id=)"],
          ["OAuth Token", "Acting on behalf of another user — returned after OAuth authorization"],
        ].map(([m, d]) => (
          <div key={m} className="grid grid-cols-[120px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <code className="text-xs font-mono font-semibold">{m}</code>
            <span className="text-xs text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      <H2>Endpoints at a glance</H2>
      <div className="border border-border rounded-xl overflow-hidden">
        <Row method="GET"  path="/api/oauth/me?token=xxx"        desc="Fetch authorized user info" />
        <Row method="POST" path="/api/oauth/spend"               desc="Spend balance on behalf of user" />
        <Row method="GET"  path="/api/admin/items"               desc="All items (public)" />
        <Row method="GET"  path="/api/rolls?limit=50"            desc="Recent rolls (public)" />
        <Row method="GET"  path="/api/leaderboard"               desc="Leaderboard (public)" />
        <Row method="GET"  path="/api/users?username=x"         desc="User profile lookup" />
        <Row method="GET"  path="/api/inventory/{userId}"        desc="User inventory" />
      </div>
    </>
  )
}

function OAuthDocs() {
  return (
    <>
      <H1>OAuth</H1>
      <Desc>Let users sign in with their OmegaCases account. Create an app on the Developer Dashboard first.</Desc>

      <Card>
        <CardHead>Step 1 — Redirect the user</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">
            Build a URL with your <Code>client_id</Code>, a <Code>redirect_uri</Code>, and the <Code>scope</Code> you need.
          </p>
          <Block lang="js" label="Example">{`const url = new URL("${BASE}/oauth/authorize")
url.searchParams.set("client_id",    "YOUR_CLIENT_ID")
url.searchParams.set("redirect_uri", "https://yourapp.com/callback")
url.searchParams.set("scope",        "read_id,read_username")
url.searchParams.set("state",        crypto.randomUUID())

window.location.href = url.toString()`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>Step 2 — Handle the callback</CardHead>
        <CardBody>
          <p className="text-sm text-muted-foreground mb-3">
            After the user authorizes, they're redirected to your <Code>redirect_uri</Code> with query params including a <Code>token</Code>.
          </p>
          <Block lang="js" label="Callback URL example">{`https://yourapp.com/callback
  ?token=a3f9...
  &user_id=uuid-here
  &username=player1
  &state=your-state-value`}
          </Block>
          <Block lang="js" label="Parse it">{`const p = new URLSearchParams(window.location.search)
const token    = p.get("token")    // store this!
const userId   = p.get("user_id")
const username = p.get("username")
const state    = p.get("state")    // verify matches what you sent`}
          </Block>
          <Warn>Store the <strong>token</strong> — it's how you make future API calls without asking the user again.</Warn>
        </CardBody>
      </Card>

      <H2>Scopes</H2>
      <ScopeTable rows={[
        ["read_id",       "User UUID — returned in callback"],
        ["read_username", "Username — returned in callback"],
        ["read_balance",  "Balance — returned in callback and /api/oauth/me"],
        ["spend_balance", "Deduct balance and credit app owner via /api/oauth/spend"],
        ["write_cases",   "Open cases on behalf of the user"],
      ]} />
    </>
  )
}

function TokensDocs() {
  return (
    <>
      <H1>Tokens</H1>
      <Desc>A token is generated when a user authorizes your app. Use it to make API calls without re-authorizing.</Desc>

      <Card>
        <CardHead>GET /api/oauth/me — fetch user info</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/me?token=TOKEN_HERE")`}
          </Block>
          <Block lang="response" label="Response">{`{
  "user_id":  "uuid-here",
  "username": "player1",
  "balance":  42.50
}`}
          </Block>
          <p className="text-xs text-muted-foreground">Only returns fields the token has scope for.</p>
        </CardBody>
      </Card>

      <H2>Token behaviour</H2>
      <div className="border border-border rounded-xl overflow-hidden mb-6">
        {[
          ["Persistent",    "Tokens don't expire — they last until the user revokes them"],
          ["Scoped",        "Each token only grants the scopes the user approved"],
          ["last_used_at",  "Updated automatically on every API call"],
          ["Revocation",    "Users can revoke tokens from their account settings"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[140px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <span className="text-xs font-semibold">{k}</span>
            <span className="text-xs text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>

      <Warn>
        <strong>Treat tokens like passwords.</strong> Never log them, expose them client-side, or commit them to source control.
      </Warn>
    </>
  )
}

function SpendDocs() {
  return (
    <>
      <H1>Spend Balance</H1>
      <Desc>Deduct balance from an authorized user. The amount is transferred to your account (app owner).</Desc>

      <Card>
        <CardHead>POST /api/oauth/spend</CardHead>
        <CardBody>
          <Block lang="js" label="Request">{`fetch("${BASE}/api/oauth/spend", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token:  "user_token_here",
    amount: 2.50
  })
})`}
          </Block>
          <Block lang="response" label="Success response">{`{ "ok": true, "spent": 2.50, "new_balance": 47.50 }`}
          </Block>
          <Block lang="response" label="Error responses">{`{ "error": "Invalid or revoked token" }       // 401
{ "error": "Token does not have spend_balance scope" } // 403
{ "error": "Insufficient balance" }           // 402`}
          </Block>
        </CardBody>
      </Card>

      <H2>Rules</H2>
      <div className="border border-border rounded-xl overflow-hidden mb-4">
        {[
          ["Amount",       "Must be a positive number — you can only spend, never add"],
          ["Transfer",     "Deducted from user, credited to app owner account"],
          ["Notification", "User receives an in-app notification every time balance is spent"],
          ["Requires",     "spend_balance scope on the token"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] px-4 py-2.5 border-b border-border/40 last:border-0 items-start">
            <span className="text-xs font-semibold">{k}</span>
            <span className="text-xs text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>

      <Warn>
        Only call <Code>/api/oauth/spend</Code> from your <strong>server</strong>. Tokens exposed client-side can be abused.
      </Warn>
    </>
  )
}

function PublicDocs() {
  return (
    <>
      <H1>Public API</H1>
      <Desc>These endpoints require no authentication. Safe to call from client-side code.</Desc>

      <Card>
        <CardHead>GET /api/admin/items — all items</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "id":           "uuid",
    "name":         "Dragon Claw",
    "image_url":    "https://...",
    "rarity":       "Legendary",
    "likelihood":   2.5,
    "market_price": 49.99,
    "rap":          45.00
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/rolls?limit=50 — recent rolls</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "id":         "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "user":       { "username": "player1" },
    "item":       { "name": "Dragon Claw", "rarity": "Legendary" }
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/leaderboard — top players by RAP</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "username":  "topplayer",
    "plus":      true,
    "rap":       1234.56,
    "itemCount": 42
  }
]`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/users?username=x — user profile</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`{
  "id":          "uuid",
  "username":    "player1",
  "balance":     12.50,
  "plus":        false,
  "cases":       100
}`}
          </Block>
        </CardBody>
      </Card>

      <Card>
        <CardHead>GET /api/inventory/{"{userId}"} — user inventory</CardHead>
        <CardBody>
          <Block lang="response" label="Response">{`[
  {
    "id":   "uuid",
    "item": { "name": "Dragon Claw", "rarity": "Omega", "rap": 99.99 }
  }
]`}
          </Block>
        </CardBody>
      </Card>
    </>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

const PAGES: Record<string, React.FC> = {
  overview: Overview,
  oauth:    OAuthDocs,
  tokens:   TokensDocs,
  spend:    SpendDocs,
  public:   PublicDocs,
}

export default function DocsSection() {
  const { section } = useParams<{ section: string }>()
  const Page = PAGES[section]
  if (!Page) return notFound()
  return (
    <div className="max-w-2xl px-8 py-10">
      <Page />
    </div>
  )
}
