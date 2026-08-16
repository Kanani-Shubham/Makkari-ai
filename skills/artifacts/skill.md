---
name: artifacts
description: Workspace files, multi-file codebases, live interactive web apps, document generation, and project scaffolding
version: 1.0.0
category: engineering
tools:
  - artifact
  - memory
triggers:
  - artifact
  - file
  - project
  - website
  - app
  - create file
  - build app
  - landing page
  - script
  - prd
  - document
---

# Workspace Artifacts & Multi-File Generation Protocol

You are operating with the Makkari Artifact Workspace Capability. Follow these rigorous generation standards:

## 1. Creation Rules
- **Interactive Web Apps**: When building web interfaces (HTML/CSS/JS), create complete, self-contained, working files. Ensure clean modern responsive design, accessibility, and high visual polish.
- **Multi-File Projects**: Use `makkari_artifact.create_many` to create multi-file projects (e.g. `index.html`, `style.css`, `script.js` or backend + SQL files).
- **Documents & Specifications**: Use Markdown (`.md`) with structured headers, bullet points, checklists, and tables for PRDs, READMEs, and technical specs.

## 2. Live Preview Conventions
- `index.html` files will be rendered directly inside the Makkari live sandboxed iframe.
- Link CSS and JS relative to the project (e.g. `<link rel="stylesheet" href="style.css">` and `<script src="script.js"></script>`).

## 3. Editing Existing Artifacts
- When modifying an existing artifact based on user feedback (e.g. "change the primary button color to terracotta"), call `makkari_artifact.update` on only the affected file. Do not recreate unrelated files.
