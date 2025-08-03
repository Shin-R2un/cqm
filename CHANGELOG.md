# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Actions CI/CD pipeline for automated testing and quality assurance
- Comprehensive test coverage measurement (target: 80%+)
- Security scanning with CodeQL, npm audit, and secret detection
- Automated build and release management workflows
- Biome linting and formatting integration

### Changed
- Migrated from ESLint to Biome for improved performance and unified tooling
- Enhanced package.json scripts for better development experience

### Infrastructure
- Set up monorepo with Turborepo for efficient package management
- Configured TypeScript build pipeline across all packages
- Established quality gates and automated checks

## [0.1.0] - 2025-08-03

### Added
- Initial project structure and monorepo setup
- Core package architecture (`@cqm/shared`, `@cqm/server`, `@cqm/rag`, `@cqm/cli`)
- TypeScript configuration and build system
- Basic MCP (Model Context Protocol) integration foundation
- RAG (Retrieval-Augmented Generation) engine structure
- CLI framework setup with Commander.js

### Infrastructure
- Project documentation and development guidelines
- Package dependency management
- Build and development scripts

### Technical Foundation
- Established type-safe development environment
- Created extensible plugin architecture foundation
- Set up unified configuration management (cqm.yml)

---

## Version History

- **v0.1.0**: Project foundation and architecture establishment
- **Unreleased**: CI/CD pipeline and quality assurance implementation

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Release Process

1. Update version numbers in package.json files
2. Update this CHANGELOG.md with new version changes
3. Create a git tag: `git tag -a v<version> -m "Release v<version>"`
4. Push tag: `git push origin v<version>`
5. GitHub Actions will automatically create a release