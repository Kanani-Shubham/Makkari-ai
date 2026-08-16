---
name: debugging
description: Systematic root cause analysis, stack trace investigation, runtime profiling, and regression resolution
version: 1.0.0
category: engineering
tools:
  - memory
  - code_runner
triggers:
  - debug
  - error
  - fix
  - crash
  - bug
  - trace
  - exception
  - stacktrace
---

# Systematic Debugging & Root Cause Analysis

## Investigation Protocol
1. **Reproduce & Isolate**: Identify the exact minimal trigger that causes the failure.
2. **Trace Data Flow**: Follow inputs from edge boundaries (HTTP/UI) to downstream state and persistence layers.
3. **Inspect Assumptions**: Check for null/undefined assumptions, race conditions, async timing gaps, and API contract discrepancies.
4. **Permanent Fix**: Resolve the underlying architectural defect rather than applying a cosmetic patch. Add test cases that would have caught the regression.
