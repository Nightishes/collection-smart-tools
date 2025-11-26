# Documentation Index

Complete documentation for the Collection Smart Tools project.

## 📖 Table of Contents

### Getting Started

1. **[SETUP.md](SETUP.md)** - Complete installation guide

   - Prerequisites (Node.js, Docker)
   - Installation steps
   - Environment configuration
   - ClamAV setup
   - Troubleshooting

2. **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - One-page cheat sheet
   - Essential commands
   - Project structure
   - API endpoints
   - Troubleshooting quick fixes

### Core Documentation

3. **[README.md](README.md)** - Full feature documentation
   - Authentication & authorization
   - Docker container architecture
   - File conversion features (PDF, HTML, DOCX)
   - API endpoints with examples
   - Virus scanning
   - Performance metrics

### Docker

4. **[DOCKER.md](DOCKER.md)** - Docker management guide

   - Available images (pdf2html, puppeteer, ClamAV)
   - Unified commands (`docker:build`, `docker:test`, etc.)
   - Individual container management
   - Troubleshooting
   - Resource usage
   - CI/CD integration

5. **[DOCKER-UNIFICATION-SUMMARY.md](DOCKER-UNIFICATION-SUMMARY.md)** - Implementation details
   - How Docker commands were unified
   - Changes to npm scripts
   - Test script enhancements
   - Migration guide

### Security

6. **[SECURITY.md](SECURITY.md)** - Security policy

   - Reporting vulnerabilities
   - Security update process
   - Supported versions

7. **[SECURITY-AUDIT.md](SECURITY-AUDIT.md)** - Security audit report

   - Implemented security measures
   - Dependency status
   - Recommendations
   - Code quality issues
   - Performance optimizations

8. **[VIRUS-SCANNING.md](VIRUS-SCANNING.md)** - Virus scanning setup

   - ClamAV integration guide
   - Configuration options
   - Testing with EICAR
   - Docker container management
   - Troubleshooting
   - Performance impact

9. **[VIRUS-SCANNING-SUMMARY.md](VIRUS-SCANNING-SUMMARY.md)** - Implementation details
   - What was implemented
   - Route integration
   - Testing instructions
   - Security benefits

### Other

10. **[test-samples-README.md](test-samples-README.md)** - Test files documentation

## 🎯 Quick Links by Task

### I want to...

- **Get started**: Read [SETUP.md](SETUP.md)
- **Learn the commands**: Check [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
- **Understand features**: See [README.md](README.md)
- **Manage Docker**: Read [DOCKER.md](DOCKER.md)
- **Enable virus scanning**: Follow [VIRUS-SCANNING.md](VIRUS-SCANNING.md)
- **Review security**: Check [SECURITY-AUDIT.md](SECURITY-AUDIT.md)
- **Troubleshoot issues**: Start with [QUICK-REFERENCE.md](QUICK-REFERENCE.md) → Troubleshooting section

## 📊 Documentation Statistics

| Document                      | Lines | Purpose                               |
| ----------------------------- | ----- | ------------------------------------- |
| README.md                     | ~270  | Feature documentation & API reference |
| SETUP.md                      | ~100  | Installation guide                    |
| DOCKER.md                     | ~370  | Docker management                     |
| VIRUS-SCANNING.md             | ~365  | Virus scanning setup                  |
| SECURITY-AUDIT.md             | ~225  | Security analysis                     |
| QUICK-REFERENCE.md            | ~210  | Quick reference card                  |
| DOCKER-UNIFICATION-SUMMARY.md | ~200  | Docker unification details            |
| VIRUS-SCANNING-SUMMARY.md     | ~230  | Virus scanning implementation         |
| SECURITY.md                   | ~50   | Security policy                       |

**Total**: ~2,020 lines of documentation

## 🔄 Recently Updated

- **November 26, 2025**: All documentation moved to `documentation/` folder
- **November 26, 2025**: Docker commands unified (`docker:build`, `docker:test`)
- **November 26, 2025**: Virus scanning implemented with ClamAV
- **November 26, 2025**: Security audit completed

## 🤝 Contributing

When adding new documentation:

1. Place `.md` files in this `documentation/` folder
2. Update this `INDEX.md` with links and descriptions
3. Update root `README.md` if adding major features
4. Use relative links within documentation folder
5. Follow existing formatting conventions

## 📝 Documentation Standards

- Use clear, descriptive headings
- Include code examples with PowerShell syntax
- Add troubleshooting sections where applicable
- Keep tables for command/option references
- Use emoji sparingly for visual organization
- Include "Quick Start" sections for setup guides
- Cross-reference related documentation

## 🔍 Search Tips

To find specific information:

1. Check [QUICK-REFERENCE.md](QUICK-REFERENCE.md) first
2. Use `Ctrl+F` in relevant document
3. Check [INDEX.md](INDEX.md) (this file) for topic mapping
4. Review [README.md](README.md) for feature overviews
