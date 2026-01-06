# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js RTSP streaming application with a client-server architecture:

- server-main.js - Main entry point and RTSPStreamer class
- logger.js - Structured logging module with file rotation
- config.js - Centralized configuration management
- public/index.html - Frontend player interface
- public/streams/ - Runtime HLS segment storage (auto-created)
- logs/ - Application log files (auto-created)
- config.example.js - Configuration template for new deployments

## Build, Test, and Development Commands

```bash
npm install              # Install dependencies
npm start               # Run production server
npm run dev             # Run with auto-reload (nodemon)
npm run test:ffmpeg     # Verify FFmpeg installation
npm run diagnose        # Run diagnostics script
```

Development mode uses nodemon for automatic restarts on file changes.

## Coding Style & Naming Conventions

- Language: JavaScript (CommonJS modules with require/module.exports)
- Indentation: 4 spaces
- Naming: camelCase for variables/functions, PascalCase for classes
- Comments: Document public methods and complex logic
- Error Handling: Use try-catch with structured logging via logger instance

No linting or formatting tools are currently configured.

## Testing Guidelines

Testing infrastructure is not yet established. When adding tests:

- Name test files with .test.js or .spec.js suffix
- Test critical paths: WebSocket message handling, FFmpeg stream lifecycle, error scenarios
- Verify FFmpeg integration using npm run test:ffmpeg

## Commit & Pull Request Guidelines

Use conventional commit prefixes:

- feat: - New features
- fix: - Bug fixes
- docs: - Documentation updates
- refactor: - Code restructuring
- chore: - Build/tooling changes

Pull requests should include:
- Clear description of changes
- Related issue references
- Testing notes for modified functionality

## Architecture Notes

The RTSPStreamer class manages WebSocket connections, FFmpeg transcoding, and HLS segment generation. Configuration supports environment variables (PORT, HOST, LOG_LEVEL) for deployment flexibility. FFmpeg requires system-level installation and must be available in PATH.
