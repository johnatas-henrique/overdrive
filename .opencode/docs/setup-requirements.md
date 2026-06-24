# Setup Requirements

This template requires a few tools to be installed for full functionality.
All hooks fail gracefully if tools are missing — nothing will break, but
you'll lose validation features.

## Required

| Tool            | Purpose                            | Install                                                        |
| --------------- | ---------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| **Git**         | Version control, branch management | [git-scm.com](https://git-scm.com/)                            |
| **OpenCode**    | AI agent CLI                       | `npm install -g opencode`                                      |
| **Node.js 18+** | Module CLI + hooks                 | Runtime for `install.mjs` and the CCGS TypeScript hooks plugin | [nodejs.org](https://nodejs.org/) |

## Recommended

| Tool                     | Used By | Purpose | Install |
| ------------------------ | ------- | ------- | ------- |
| _(none beyond required)_ |         |         |

### Installing Node.js

**Windows** (any of these):

```
winget install OpenJS.NodeJS.LTS
choco install nodejs-lts
scoop install nodejs
```

**macOS**:

```
brew install node
```

**Linux**:

```
sudo apt install nodejs npm     # Debian/Ubuntu
sudo dnf install nodejs         # Fedora
sudo pacman -S nodejs npm       # Arch
```

## Platform Notes

### Windows

- Git for Windows includes **Git Bash**, which provides `bash`
- Ensure Git Bash is on your PATH (default if installed via the Git installer)
- OpenCode runs natively in PowerShell, CMD, Git Bash, and Windows Terminal

### macOS / Linux

- Node.js and npm are available via your package manager
- OpenCode works in any standard terminal

## Verifying Your Setup

Run these commands to check prerequisites:

```bash
git --version          # Should show git version
node --version         # Should show Node.js 18+
npx opencode --version # Should show OpenCode version
```

## What Happens Without Required Tools

| Missing Tool | Effect                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Git**      | No version control — all / commands, hooks, and template tooling assume a git repository.                                                        |
| **OpenCode** | The framework cannot run — agents, skills, and commands are all OpenCode-native.                                                                 |
| **Node.js**  | The module CLI (`install.mjs`) and hooks plugin cannot execute. Without Node.js, module installation and commit/push validation are unavailable. |

## Recommended IDE

OpenCode works with any editor:

- **VS Code** with the OpenCode CLI
- **Cursor** (OpenCode compatible)
- **Terminal** — `opencode` CLI directly in any shell
- **JetBrains IDEs** — via the terminal
