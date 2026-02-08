---
name: build
description: Execute a previously created implementation plan. Usage - /skill:build specs/plan-file.md
---

# Build From Plan

Execute an implementation plan that was previously created with the `/skill:plan` command.

## Arguments

1. **Plan file path** (required): Path to the plan markdown file (e.g., `specs/my-feature.md`)

## Workflow

1. **Read the plan** - Load and parse the plan file
2. **Understand the codebase** - Review relevant files mentioned in the plan
3. **Set up tracking** - Use `SetTodoList` to track all tasks from the plan
4. **Execute tasks** - Work through each task in order:
   - Respect dependencies (don't start a task until its dependencies are done)
   - Deploy appropriate agents using `Task` tool
   - Update todo list as tasks complete
5. **Validate** - Run validation commands specified in the plan
6. **Report** - Summarize what was built

## Task Execution

### Sequential Tasks
For tasks that depend on others:
```
Task 1: Setup database (no dependencies) → Execute first
Task 2: Create API (depends on Task 1) → Execute after Task 1 completes
```

### Parallel Tasks
For independent tasks:
```
Task 1: Build frontend components → Execute
Task 2: Write tests (independent) → Execute simultaneously
```

Use `run_in_background: true` in the Task tool for parallel execution.

## Agent Deployment

When deploying agents via `Task`:
- Provide the full task context from the plan
- Include relevant file paths
- Specify the agent type from the plan's Team Members section
- Set `resume: true` to continue context if specified in the plan

## Validation

After all tasks complete, run the validation commands specified in the plan's "Validation Commands" section.

## Report Format

```
✅ Plan Execution Complete

Plan: <plan name>
Tasks Completed: <count>/<total>
Files Modified: <list of key files>

Validation Results:
- <validation 1>: ✅/❌
- <validation 2>: ✅/❌

Summary:
<brief description of what was implemented>
```
