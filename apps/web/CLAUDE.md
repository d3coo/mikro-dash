# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (from apps/web)
bun run dev              # Start dev server on port 3000
bun run check            # Type-check with svelte-check
bun run check:watch      # Type-check in watch mode
bun run build            # Production build

# From monorepo root
turbo run dev            # Run all apps in dev mode
turbo run build          # Build all apps
bun run format           # Format with Prettier
```

## Architecture

MikroTik WiFi Management Dashboard - Arabic RTL web application for managing hotspot vouchers and router settings.

### Tech Stack
- **SvelteKit 2** with **Svelte 5** runes (`$state`, `$derived`, `$effect`, `$props`)
- **TailwindCSS 4** with RTL support
- **SQLite** + **Drizzle ORM** (database at `data.db`)
- **shadcn-svelte** + **bits-ui** components

### Directory Structure
```
src/
├── routes/                    # SvelteKit routes
│   ├── +layout.svelte         # RTL layout with sidebar
│   ├── +page.svelte           # Dashboard
│   ├── vouchers/              # Voucher CRUD + print with QR
│   ├── settings/              # Router connection config
│   └── api/                   # REST endpoints (+server.ts)
├── lib/
│   ├── components/            # Svelte components
│   │   └── ui/                # shadcn-svelte components
│   └── server/                # Server-only code
│       ├── db/schema.ts       # Drizzle schema (vouchers, settings)
│       ├── services/          # Business logic (vouchers.ts, settings.ts)
│       └── mikrotik/client.ts # MikroTik REST API client
```

### Key Patterns

**Server Data Loading:**
```typescript
// +page.server.ts
export const load: PageServerLoad = async () => {
  return { data };
};
```

**Form Actions:**
```typescript
// +page.server.ts
export const actions = {
  save: async ({ request }) => { /* ... */ },
  delete: async ({ request }) => { /* ... */ }
};
```

**Components use Svelte 5 runes:**
```svelte
let { data, form } = $props();
let count = $state(0);
let doubled = $derived(count * 2);
```

### UI/Styling

- **RTL Layout:** `dir="rtl" lang="ar"` on root, sidebar on right
- **Font:** Cairo for Arabic text
- **Theme:** Dark glassmorphism with CSS variables (defined in `app.css`)
- **CSS Classes:** `glass-card`, `input-modern`, `select-modern`, `table-modern`, `badge-success/danger/neutral`
- **Spacing:** Use `start`/`end` instead of `left`/`right` for RTL compatibility

### Database

Two tables in Drizzle schema:
- `vouchers`: id, password, package, priceLE, bytesLimit, status, createdAt, usedAt
- `settings`: key-value pairs for router config (mikrotik_host, mikrotik_user, etc.)

### MikroTik Integration

REST API client at `src/lib/server/mikrotik/client.ts` - uses HTTP Basic Auth to communicate with RouterOS 7.x REST API at `/rest/` endpoint.
