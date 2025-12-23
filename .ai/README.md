# AI IDE Configuration Files

This directory contains configuration files for various AI coding assistants. These files ensure consistent behavior and adherence to OpenStatus coding standards across different AI tools.

## Available Configurations

### 📂 File Overview

| File | AI Tool | Status | Auto-loads? |
|------|---------|--------|-------------|
| `/.cursorrules` | **Cursor** | ✅ Active | Yes |
| `/.github/copilot-instructions.md` | **GitHub Copilot** | ✅ Active | Yes |
| `/.continue/config.json` | **Continue.dev** | ✅ Active | Yes |
| `/.codeiumrc` | **Codeium** | ✅ Active | Yes |
| `/.aider.conf.yml` | **Aider** | ✅ Active | Yes |
| `/.ai/instructions.md` | **Generic/Manual** | ✅ Active | No |
| `/AGENTS.md` | **Complete Reference** | ✅ Active | No |

## Configuration Details

### Cursor (`.cursorrules`)

**Location:** `/.cursorrules`  
**Format:** Markdown  
**Character Limit:** ~8,000 recommended

Cursor automatically reads this file from the workspace root. Contains:
- Critical context about monorepo structure
- Coding standards and patterns
- Common commands
- Allowed/forbidden actions
- Code examples

**Testing:**
```bash
# Open Cursor in the project directory
# Rules are automatically applied
# No additional setup required
```

### GitHub Copilot (`.github/copilot-instructions.md`)

**Location:** `/.github/copilot-instructions.md`  
**Format:** Markdown  
**Character Limit:** ~1,500 recommended (organization) / ~4,000 (repository)

GitHub Copilot reads instructions from:
1. Organization level: `.github/copilot-instructions.md` (if organization access)
2. Repository level: `.github/copilot-instructions.md` (this file)

**Testing:**
```bash
# In VS Code with GitHub Copilot installed
# Open a file and start typing - suggestions should follow guidelines
# Use Copilot Chat to ask questions about the codebase
```

### Continue.dev (`.continue/config.json`)

**Location:** `/.continue/config.json`  
**Format:** JSON  
**Documentation:** https://continue.dev/docs/reference/config

Continue reads configuration from the workspace `.continue/` directory. Features:
- Custom rules array
- Document references
- Context providers
- Slash commands

**Testing:**
```bash
# Install Continue extension in VS Code
# Open Command Palette (Cmd+Shift+P)
# Type "Continue: Open Config" to verify config is loaded
```

### Codeium (`.codeiumrc`)

**Location:** `/.codeiumrc`  
**Format:** Markdown/YAML-style comments  

Codeium reads this file for project-specific context and rules.

**Testing:**
```bash
# Install Codeium extension
# Open a file and check if autocomplete suggestions respect guidelines
# Use Codeium Chat to verify it understands project context
```

### Aider (`.aider.conf.yml`)

**Location:** `/.aider.conf.yml`  
**Format:** YAML  
**Documentation:** https://aider.chat/docs/config.html

Aider is a command-line AI pair programming tool. Configuration includes:
- Model selection
- Commit settings
- Lint and test commands
- Context files

**Testing:**
```bash
# Install Aider: pip install aider-chat
cd /path/to/openstatus
aider

# Aider will automatically load .aider.conf.yml
# Verify with: /help or /config
```

### Generic Instructions (`.ai/instructions.md`)

**Location:** `/.ai/instructions.md`  
**Format:** Markdown  
**Purpose:** Manual reference for any AI tool

This file serves as a comprehensive yet concise reference that can be:
- Manually pasted into ChatGPT, Claude, or other web-based AI assistants
- Used by developers to brief new AI tools
- Shared in documentation or onboarding materials

**Usage:**
```bash
# Copy contents to clipboard
cat .ai/instructions.md | pbcopy  # macOS
cat .ai/instructions.md | xclip   # Linux

# Then paste into any AI chat interface
```

## Master Documentation

### AGENTS.md

**Location:** `/AGENTS.md`  
**Format:** Markdown  
**Purpose:** Complete, authoritative reference

The master documentation file that all AI-specific configs are derived from. Contains:
- Detailed project overview
- Complete tech stack breakdown
- Comprehensive coding conventions
- Decision-making guidelines
- Common patterns with examples
- Troubleshooting guide

**When to use:**
- As reference for creating new AI configs
- For deep-diving into specific topics
- When AI-specific configs seem outdated
- For onboarding human developers

## Maintenance

### Updating Configurations

When project standards change:

1. **Update AGENTS.md first** (source of truth)
2. **Update AI-specific configs** to reflect changes
3. **Test with each AI tool** to verify behavior
4. **Update this README** if new tools are added

### Consistency Checks

Periodically verify consistency across configs:

```bash
# Check for outdated version numbers
grep -r "Next.js 16" .cursorrules .github/copilot-instructions.md .continue/config.json

# Check for outdated dependency versions
grep -r "pnpm 10.26.0" .cursorrules .github/copilot-instructions.md

# Verify critical rules are present in all configs
grep -r "NEVER.*raw SQL" .cursorrules .github/copilot-instructions.md
```

### Version History

| Date | Change | Files Updated |
|------|--------|---------------|
| 2025-12 | Initial creation | All files |

## For Contributors

### Using These Configurations

If you're contributing to OpenStatus:

1. **Install your preferred AI coding assistant**
2. **No additional setup needed** - configs auto-load
3. **Verify it's working:**
   - Ask your AI about project structure
   - Request code that follows conventions
   - Check if it warns about forbidden actions

### Common Issues

**Q: My AI isn't following the rules**

A: 
- Cursor: Restart Cursor after adding `.cursorrules`
- Copilot: Wait ~5 minutes for GitHub to sync instructions
- Continue: Reload VS Code window (Cmd+Shift+P → "Reload Window")
- Check file locations match exactly

**Q: Can I modify these configs?**

A:
- Local changes: Yes, for your workflow
- Committing changes: Submit PR with justification
- Keep consistent with AGENTS.md

**Q: My AI tool isn't listed**

A:
- Use `.ai/instructions.md` as a template
- Create a config for your tool
- Submit a PR to add it!

## Resources

- **OpenStatus Docs:** https://docs.openstatus.dev
- **OpenStatus Website:** https://www.openstatus.dev
- **Contributing Guide:** `/CONTRIBUTING.MD`
- **Docker Setup:** `/DOCKER.md`

---

**Maintained by:** OpenStatus Team  
**Last Updated:** December 2025

