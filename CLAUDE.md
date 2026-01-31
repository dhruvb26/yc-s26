# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Package Manager**: Use Bun instead of npm/pnpm/yarn for all operations.

```bash
# Install dependencies
bun install

# Development server
bun run dev          # Starts Next.js dev server on http://localhost:3000

# Build and production
bun run build        # Build for production
bun run start        # Start production server

# Code quality
bun run lint         # Run Biome linter/formatter checks
bun run lint:fix     # Auto-fix linting issues
bun run format       # Format code with Biome

# Testing
bun test             # Run tests (when test files exist)
```

## Project Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode enabled)
- **Runtime**: Bun (not Node.js)
- **Authentication**: Clerk
- **UI**: shadcn/ui components with Tailwind CSS 4
- **Icons**: Lucide React
- **Styling**: Tailwind CSS with custom design system
- **Fonts**: Geist Sans and Geist Mono
- **Code Quality**: Biome (linter + formatter), Lefthook (git hooks)
- **Error Handling**: oxide.ts (Rust-like Result/Option types)

### Key Dependencies
- `@clerk/nextjs` - Authentication with custom JWT claims
- `@composio/core` - Composio integration
- `@langchain/core` + `@langchain/langgraph` - LangChain/LangGraph
- `@mendable/firecrawl-js` - Firecrawl web scraping
- `reductoai` - Reducto AI integration
- `resend` - Email sending
- `oxide.ts` - Functional error handling (see oxide.ts rule for full guide)

### Directory Structure

```
app/
├── (auth)/              # Auth-related pages (sign-in, etc.)
├── dashboard/           # Main dashboard pages
├── onboarding/          # Onboarding flow
│   ├── _actions.ts      # Server actions for onboarding
│   ├── layout.tsx
│   └── page.tsx
├── styles/
│   └── globals.css      # Global styles with Tailwind directives
├── layout.tsx           # Root layout with ClerkProvider
└── page.tsx             # Landing page

components/
├── auth/                # Authentication components
├── ui/                  # shadcn/ui components (auto-generated)
└── navbar.tsx           # Main navigation

lib/
└── utils.ts             # Shared utilities (cn function for class merging)

types/
└── globals.d.ts         # Global TypeScript declarations (Clerk JWT customization)
```

### Path Aliases
```typescript
@/*       // Root directory (configured in tsconfig.json)
```

### Authentication Architecture
- Uses Clerk for authentication with custom JWT session claims
- Custom metadata stored in Clerk: `onboardingComplete`, `applicationName`, `applicationType`
- ClerkProvider wraps the entire app in `app/layout.tsx`
- Server actions in `app/onboarding/_actions.ts` demonstrate how to update user metadata
- Custom JWT claims defined in `types/globals.d.ts` for type safety

### Error Handling with oxide.ts
This project uses oxide.ts for Rust-like error handling with `Result<T, E>` and `Option<T>` types:
- Prefer `Result` for operations that can fail with typed errors
- Use `Option` for nullable values instead of `T | null`
- See `.cursor/rules/oxide-ts.mdc` for comprehensive usage patterns
- Chain operations with `map`, `andThen`, `filter` instead of imperative code
- Use `match()` for exhaustive pattern matching

### UI Components
- Uses shadcn/ui component library (New York style)
- Components live in `components/ui/` (auto-generated via shadcn CLI)
- Custom components use the `cn()` utility from `lib/utils.ts` for class merging
- Tailwind v4 with CSS variables for theming
- Base color: neutral, supports RTL: false

## Code Standards

### Bun-First Development
- Always use `bun` commands, not `node`, `npm`, `pnpm`, or `yarn`
- Bun auto-loads `.env` files (no need for dotenv)
- Prefer Bun built-ins: `Bun.file()` over `fs`, `Bun.serve()` for servers, `bun:sqlite` for SQLite
- See `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc` for full Bun API guidance

### Code Style
- **Formatter**: Biome with 2-space indentation
- **Quotes**: Double quotes for JavaScript/TypeScript
- **Line endings**: LF (enforced by Biome)
- Pre-commit hooks auto-format staged files via Lefthook + Biome

### TypeScript Configuration
- Strict mode enabled
- Target: ES2017
- JSX: react-jsx (not preserve)
- Module resolution: bundler
- Path alias `@/*` maps to project root

### Git Workflow
- Pre-commit hooks run automatically via Lefthook
- Biome formats and lints staged files before commit
- Fixed files are auto-staged
- Hooks run in parallel for performance
