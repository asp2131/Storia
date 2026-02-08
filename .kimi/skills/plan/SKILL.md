---
name: plan
description: Creates a concise engineering implementation plan based on user requirements and saves it to specs directory. Usage - /skill:plan "user prompt" "orchestration prompt (optional)"
---

# Plan With Team

Create a detailed implementation plan based on the user's requirements. Analyze the request, think through the implementation approach, and save a comprehensive specification document to `specs/<name-of-plan>.md` that can be used as a blueprint for actual development work.

**CRITICAL RULES:**
- **PLANNING ONLY**: Do NOT build, write code, or deploy agents. Your only output is a plan document saved to `specs/`.
- If no user prompt is provided, stop and ask the user to provide it.
- Carefully analyze the user's requirements
- Determine the task type (chore|feature|refactor|fix|enhancement) and complexity (simple|medium|complex)
- Think deeply about the best approach to implement the requested functionality
- Understand the codebase directly without subagents to understand existing patterns and architecture
- Generate a descriptive, kebab-case filename based on the main topic of the plan
- Save the complete implementation plan to `specs/<descriptive-name>.md`

## Argument Parsing

The user provides arguments after `/skill:plan`. Parse them as:
1. **First argument** (required): USER_PROMPT - The main requirement/feature to plan
2. **Second argument** (optional): ORCHESTRATION_PROMPT - Guidance for team assembly, task structure, and execution strategy

If the user provides a single argument, treat it as USER_PROMPT only.

## Workflow

1. **Validate Input** - Ensure USER_PROMPT is provided; if not, ask for it
2. **Analyze Requirements** - Parse the USER_PROMPT to understand the core problem and desired outcome
3. **Understand Codebase** - Without subagents, directly explore existing patterns, architecture, and relevant files
4. **Design Solution** - Develop technical approach including architecture decisions and implementation strategy
5. **Define Team Members** - Use ORCHESTRATION_PROMPT (if provided) to guide team composition. Identify from `.claude/agents/team/*.md` or use `general-purpose`. Document in plan.
6. **Define Step by Step Tasks** - Use ORCHESTRATION_PROMPT (if provided) to guide task granularity and parallel/sequential structure. Write out tasks with IDs, dependencies, assignments. Document in plan.
7. **Generate Filename** - Create a descriptive kebab-case filename based on the plan's main topic
8. **Save Plan** - Write the plan to `specs/<filename>.md`
9. **Validate Output** - Run validation hooks to ensure the plan meets requirements
10. **Report** - Provide a summary of the created plan

## Plan Format

**IMPORTANT:** Replace `<requested content>` with the actual content. Follow this EXACT format:

```md
# Plan: <task name>

## Task Description
<describe the task in detail based on the prompt>

## Objective
<clearly state what will be accomplished when this plan is complete>

## Problem Statement
<clearly define the specific problem or opportunity this task addresses - include for feature or medium/complex complexity>

## Solution Approach
<describe the proposed solution approach and how it addresses the objective - include for feature or medium/complex complexity>

## Relevant Files
Use these files to complete the task:

- `<file-path>`: <explanation of why this file is relevant>
- `<file-path>`: <explanation>

### New Files
- `<new-file-path>`: <description of what this new file will contain>

## Implementation Phases

### Phase 1: Foundation
<describe any foundational work needed - include for medium/complex complexity>

### Phase 2: Core Implementation
<describe the main implementation work>

### Phase 3: Integration & Polish
<describe integration, testing, and final touches>

## Team Orchestration

As the team lead, you have access to powerful tools for coordinating work across multiple agents. You NEVER write code directly - you orchestrate team members.

### Team Management Approach

- Use `SetTodoList` to track tasks and their status
- Deploy agents using `Task` tool for parallel execution
- Monitor progress through todo list updates
- Assign clear ownership for each task

### Task Dependency Management

When creating tasks, consider:
- **Sequential tasks**: Later tasks depend on earlier ones completing
- **Parallel tasks**: Independent work that can happen simultaneously
- **Blockers**: Identify what must complete before other work can start

### Team Members

List the team members you'll use to execute the plan:

- **Builder: <unique-name>**
  - Role: <the single role and focus>
  - Agent Type: <general-purpose or specific agent from .claude/agents/team/*.md>
  - Resume: <true/false - whether to continue with same context>
  
- <continue with additional team members as needed>

## Step by Step Tasks

**IMPORTANT:** Execute every step in order, top to bottom. Each task maps to a todo item.

### 1. <First Task Name>
- **Task ID**: <unique-kebab-case-identifier>
- **Depends On**: <Task ID(s) this depends on, or "none">
- **Assigned To**: <team member name from Team Members section>
- **Agent Type**: <agent type>
- **Parallel**: <true if can run alongside other tasks, false if sequential>
- <specific action to complete>
- <specific action to complete>

### 2. <Second Task Name>
- **Task ID**: <unique-id>
- **Depends On**: <previous Task ID>
- **Assigned To**: <team member name>
- **Agent Type**: <agent type>
- **Parallel**: <true/false>
- <specific action>

### N. <Final Validation Task>
- **Task ID**: validate-all
- **Depends On**: <all previous Task IDs>
- **Assigned To**: <validator team member>
- **Agent Type**: <validator agent>
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met

## Acceptance Criteria

- [ ] <specific, measurable criterion 1>
- [ ] <specific, measurable criterion 2>
- [ ] <specific, measurable criterion 3>

## Validation Commands

Execute these commands to validate the task is complete:

```bash
# Example validations
<command 1> - <what it validates>
<command 2> - <what it validates>
```

## Notes

<optional additional context, considerations, or dependencies>
<if new libraries are needed, specify using `npm install` or `uv add`>
```

## After Writing the Plan

You MUST run these validation commands:

1. Validate a new .md file was created in specs/:
   ```bash
   python3 .kimi/hooks/validators/validate_new_file.py --directory specs --extension .md
   ```

2. Validate the file contains all required sections:
   ```bash
   python3 .kimi/hooks/validators/validate_file_contains.py \
     --directory specs \
     --extension .md \
     --contains '## Task Description' \
     --contains '## Objective' \
     --contains '## Relevant Files' \
     --contains '## Step by Step Tasks' \
     --contains '## Acceptance Criteria' \
     --contains '## Team Orchestration' \
     --contains '### Team Members'
   ```

## Report Format

After successful validation, provide this report:

```
✅ Implementation Plan Created

File: specs/<filename>.md
Topic: <brief description of what the plan covers>
Complexity: <simple|medium|complex>
Type: <chore|feature|refactor|fix|enhancement>

Key Components:
- <main component 1>
- <main component 2>
- <main component 3>

Team Task List:
- <task name> → <assigned owner>
- <task name> → <assigned owner>

Team Members:
- <name>: <role>
- <name>: <role>

When you're ready to execute, run:
/skill:build specs/<filename>.md
```
