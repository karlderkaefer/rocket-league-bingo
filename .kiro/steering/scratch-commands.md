# Scratch Folder for Commands

## MANDATORY RULE — NO EXCEPTIONS

When executing shell commands via `execute_bash`, within sub-agents, or via any tool that runs shell commands:

- **≤ 3 lines**: Run inline directly. No scratch file needed.
- **> 3 lines**: You **MUST** write the script to `.scratch/<name>.sh` using `fs_write` FIRST, then execute with `bash .scratch/<name>.sh` as a SEPARATE tool call. **NEVER** pass more than 3 lines directly to `execute_bash`.

**This applies to:**
- The orchestrator agent
- All sub-agents (spec-task-execution, general-task-execution, etc.)
- Any delegated or nested agent work
- ANY shell execution regardless of context

**When dispatching sub-agents**, include this reminder in the prompt:
> "IMPORTANT: Shell commands longer than 3 lines must be written to `.scratch/` files before execution. Short commands (≤3 lines) can run inline."

## What counts as "lines"

Count every distinct command:
- Each newline-separated command = 1 line
- Each `&&`-chained command = 1 line per segment
- Each `;`-separated command = 1 line per segment
- A heredoc/here-string = count ALL lines of content + the cat/echo line
- A `for` loop or `if` block = count all lines in the block
- Piped commands (`cmd1 | cmd2`) = 1 line total (single pipeline)

Examples:
- `npm install foo && npm run build` = 2 lines ✓ inline OK
- `npm install foo bar baz` = 1 line ✓ inline OK
- `mkdir -p a b c && touch a/.gitkeep b/.gitkeep c/.gitkeep && npm run build` = 3 lines ✓ inline OK
- 4 separate commands = **MUST use scratch file**

## Violations — DO NOT DO THIS

```bash
# ❌ BAD: 4+ lines passed directly to execute_bash
npm install foo
mkdir -p src/features/auth
echo "export {}" > src/features/auth/index.ts
npm run build

# ❌ BAD: Heredoc with inline content (counts as many lines)
cat << 'EOF' > src/lib/client.ts
import { createClient } from '...'
export const client = createClient(...)
EOF

# ❌ BAD: Multi-line for loop inline
for dir in auth rooms game categories; do
  mkdir -p "src/features/$dir"
  touch "src/features/$dir/.gitkeep"
done

# ❌ BAD: Disguising multiple commands as a single string
echo "line1" && echo "line2" && echo "line3" && echo "line4"
```

## Correct Usage

```bash
# ✅ GOOD: ≤ 3 lines inline
npm run build

# ✅ GOOD: 2 commands inline
npm install @supabase/supabase-js zod
npm run build

# ✅ GOOD: 3 commands inline
npm install foo
npm run build
npm test

# ✅ GOOD: > 3 lines → write to .scratch/ first
# Step 1: Use fs_write to create .scratch/setup.sh with the full script
# Step 2: execute_bash "bash .scratch/setup.sh"
```

## Self-Check Before Every execute_bash Call

Before passing a command to `execute_bash`, ask yourself:
1. How many distinct commands/lines am I about to run?
2. Is it > 3? → STOP. Write to `.scratch/` first.
3. Does it contain a heredoc, loop, or multi-line content? → STOP. Write to `.scratch/` first.

## Important Notes

- The `.scratch/` folder is gitignored — scripts there are disposable.
- Prefer descriptive names: `.scratch/install-deps.sh`, `.scratch/create-dirs.sh`, `.scratch/run-tests.sh`
- If in doubt, use a scratch file. It's always safe; inline is only a convenience for short commands.
