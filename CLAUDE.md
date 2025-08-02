# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CQM** (CQ Models! - Contextual Query Manager) is a unified development context manager that provides consistent context to multiple AI models (Claude, GPT, Gemini, etc.) using the metaphor of amateur radio's "CQ" (calling all stations).

**Mission**: "No matter which AI model you use, get the same context for the best development experience"
**Vision**: "CQ CQ CQ - A world where all developers and AI models connect on the same frequency"

## Project Status

This is an **early-stage project** with comprehensive requirements documentation but no implementation yet. The project is designed as a monorepo with multiple packages and plugin architecture.

## Architecture Overview

### Planned Directory Structure
```
cq-models/
├── packages/
│   ├── core/                    # MCP server core
│   ├── rag-engine/             # Generic RAG engine
│   ├── cli/                    # cqm CLI tool
│   └── plugins/                # Official plugins
│       ├── filesystem/
│       ├── github/
│       ├── obsidian/
│       └── webhook-proxy/
├── plugins/                    # Community plugins
├── examples/                   # Configuration examples
├── docs/                       # Documentation
└── docker/                     # Docker configuration
```

### Core Technologies (Planned)
- **Runtime**: Node.js 20.x LTS with TypeScript 5.3+
- **MCP Implementation**: @modelcontextprotocol/sdk
- **CLI Framework**: Commander.js
- **Monorepo**: Turborepo
- **Vector DB**: Qdrant (default), with adapter pattern for others
- **Embeddings**: OpenAI text-embedding-3-small (default), Ollama support
- **Metadata Store**: SQLite 3 + Drizzle ORM
- **Testing**: Vitest
- **Linting/Formatting**: Biome

## Key Concepts

### Plugin Architecture
The system is built around a plugin architecture where each integration (GitHub, Obsidian, filesystem, etc.) is implemented as a plugin with:
- Standard MCP protocol implementation
- Event-driven architecture
- Configurable settings
- Plugin-to-plugin communication

### Multi-Model Support
- Unified context across Claude, GPT-4, Gemini, and other AI models
- Model-specific optimizations (context window, chunk sizes)
- Consistent tool availability regardless of which AI model is being used

### Development Workflows
The system supports complete development workflows:
1. Idea brainstorming → Requirements generation
2. Issue creation → GitHub Projects integration
3. Branch management → Implementation support
4. PR creation → Code review assistance
5. Status tracking → Progress reporting

## Development Commands (When Implemented)

### Core Server Management
```bash
# Start the MCP server
cqm start [--daemon]

# Check server status
cqm status

# View logs
cqm logs [--tail]

# Stop server
cqm stop
```

### Index Management
```bash
# List all indexes
cqm index list [--category <name>] [--repo <name>]

# Show detailed statistics
cqm index stats [--detailed]

# Delete indexes
cqm index delete --category <name>
cqm index delete --repo <owner/name> [--branch <name>]

# Rebuild indexes
cqm index rebuild [--category <name>]
```

### Plugin Management
```bash
# List installed plugins
cqm plugin list [--enabled]

# Install new plugin
cqm plugin install <name>

# Enable/disable plugins
cqm plugin enable/disable <name>

# Configure plugin
cqm plugin config <name> --set <key>=<value>
cqm plugin config <name> --show
```

### Connection Management
```bash
# List active AI model connections
cqm connection list

# Show connection statistics by model
cqm connection stats [--by-model]

# Force disconnect a client
cqm connection kick <client-id>
```

## Configuration

### Main Configuration File (cqm.yml)
```yaml
version: 1.0

core:
  name: "CQ Models!"
  logLevel: info
  port: 3000
  maxConnections: 10

rag:
  vectorDB:
    type: qdrant
    config:
      url: http://localhost:6333
      collection: cqm
  embedding:
    type: openai
    config:
      model: text-embedding-3-small
      apiKey: ${OPENAI_API_KEY}

plugins:
  filesystem:
    enabled: true
    config:
      watchPaths: [./src, ./docs]
      ignore: [node_modules, .git, "*.log"]
  
  github:
    enabled: true
    config:
      token: ${GITHUB_TOKEN}
      owner: ${GITHUB_OWNER}
      repo: ${GITHUB_REPO}
      syncInterval: 300000
```

## MCP Tools (When Implemented)

Key tools that will be available to AI models:
- `getProjectContext` - Get current project status and context
- `searchDocuments` - Search through indexed documentation and code
- `searchIssues` - Find GitHub issues by query, status, labels
- `createIssue` - Create new GitHub issues
- `updateIssueStatus` - Update issue status in project workflow
- `findSimilarCode` - Find similar code patterns in the codebase
- `generateRequirements` - Generate requirements documents from ideas
- `getDailyTasks` - Get prioritized daily task recommendations
- `recordDecision` - Record architectural decisions (ADR)

## Development Guidelines

### Language and Communication
- All user-facing documentation and CLI output should be in Japanese
- Code comments and internal documentation in English
- Maintain the amateur radio theme in messaging and branding

### Implementation Priorities
1. **Phase 1**: Core MCP server + basic RAG engine + filesystem plugin
2. **Phase 2**: GitHub plugin + Obsidian plugin + CLI management
3. **Phase 3**: Plugin development kit + community ecosystem
4. **Phase 4**: Performance optimization + security audit + v1.0 release

### Code Style
- Use TypeScript strict mode
- Follow the plugin interface pattern
- Implement proper error handling and logging
- Write comprehensive tests (target 80%+ coverage)
- Use Biome for consistent formatting

### Testing Strategy
- Unit tests for all core functionality
- Integration tests for plugin interactions
- End-to-end tests for complete workflows
- Plugin compatibility testing across different AI models

## External Integrations

### GitHub Integration
- Real-time webhook processing for issues/PRs
- GitHub Projects V2 full API support
- @claude mention support in comments
- Automated status transitions (todo → progress → in-review → done)

### Obsidian Integration
- Real-time vault monitoring
- Markdown parsing with frontmatter support
- Bidirectional linking support
- Tag extraction and indexing

### n8n Integration (via webhook plugin)
- Automated status reporting
- Discord/Telegram notifications
- Custom workflow triggers
- NotebookLM import support

## Security Considerations

- Never commit API keys or tokens to the repository
- Implement proper input validation for all MCP tools
- Secure webhook endpoints with proper authentication
- Rate limiting for API calls
- Plugin sandboxing where possible

## Contributing

Since this is an early-stage project, focus on:
1. Setting up the monorepo structure with Turborepo
2. Implementing the core MCP server with basic plugin loading
3. Creating the foundational RAG engine with Qdrant integration
4. Building the first plugin (filesystem) as a reference implementation
5. Establishing CI/CD pipelines and development workflows

The project aims to become a major open-source tool in the AI development space, with the tagline: "Your context, on air for all AI"