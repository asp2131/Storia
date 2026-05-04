---
name: linear
description: Use when creating, viewing, listing, commenting on, or updating Linear tickets for the Storia web project via LINEAR_API_KEY.
---

# Linear Tickets for Storia Web

## Overview

Use Linear's GraphQL API directly with `LINEAR_API_KEY`. Default all work to the Storia web project slug `storia-web-ccc39fafc20d` unless the user explicitly asks otherwise.

**Never print, echo, log, or commit `LINEAR_API_KEY`.** Use it only in the Authorization header.

## Quick Start

```bash
: "${LINEAR_API_KEY:?Set LINEAR_API_KEY first}"
PROJECT_SLUG="${PROJECT_SLUG:-storia-web-ccc39fafc20d}"

linear_gql() {
  local query="$1" vars="${2:-{}}"
  jq -nc --arg q "$query" --argjson v "$vars" '{query:$q, variables:$v}' |
    curl -fsS https://api.linear.app/graphql \
      -H "Authorization: $LINEAR_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @- |
    jq .
}
```

## Resolve Project, Team, States

Run this before creating or updating tickets. Use state names from the result instead of guessing IDs.

```bash
q='query($slug: String!) {
  project(id: $slug) {
    id name slugId
    teams(first: 5) {
      nodes {
        id name key
        states(first: 50) { nodes { id name type } }
      }
    }
  }
}'
linear_gql "$q" "$(jq -nc --arg slug "$PROJECT_SLUG" '{slug:$slug}')"
```

Common Storia workflow names from `WORKFLOW.md`: `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Canceled`, `Duplicate`.

## Common Operations

| Task | Pattern |
|---|---|
| View ticket | `issue(id: $id)` using identifier like `STO-123` or UUID |
| List project tickets | `issues(filter: { project: { id: { eq: $projectId }}})` |
| Create ticket | `issueCreate(input: { teamId, projectId, title, description })` |
| Update ticket | `issueUpdate(id, input: { title, description, stateId })` |
| Comment | `commentCreate(input: { issueId, body })` |

## View a Ticket

```bash
ISSUE_ID="STO-123"
q='query($id: String!) {
  issue(id: $id) {
    id identifier title description url
    state { id name type }
    assignee { id name email }
    project { id name slugId }
    labels { nodes { id name } }
    comments(first: 20) { nodes { id body createdAt user { name } } }
  }
}'
linear_gql "$q" "$(jq -nc --arg id "$ISSUE_ID" '{id:$id}')"
```

## List Storia Web Tickets

First resolve `project.id`, then:

```bash
PROJECT_ID="<project-id>"
q='query($pid: ID!) {
  issues(
    filter: { project: { id: { eq: $pid } } }
    first: 50
    orderBy: updatedAt
  ) {
    nodes { id identifier title url state { name } updatedAt }
  }
}'
linear_gql "$q" "$(jq -nc --arg pid "$PROJECT_ID" '{pid:$pid}')"
```

## Create a Ticket

Use a clear title and a description with context, acceptance criteria, and validation. Default new implementation work to `Todo` when the user does not specify a state.

```bash
TEAM_ID="<team-id-from-project>"
PROJECT_ID="<project-id>"
TODO_STATE_ID="<todo-state-id>" # optional but recommended
TITLE='Short imperative ticket title'
DESCRIPTION=$(cat <<'MD'
## Context
What problem should be solved and why.

## Acceptance Criteria
- [ ] Observable outcome 1
- [ ] Observable outcome 2

## Validation
- Run targeted tests or `./bin/verify.sh` when practical.
MD
)

q='mutation($teamId: String!, $projectId: String!, $stateId: String, $title: String!, $description: String!) {
  issueCreate(input: {
    teamId: $teamId
    projectId: $projectId
    stateId: $stateId
    title: $title
    description: $description
  }) {
    success
    issue { id identifier title url state { name } }
  }
}'
linear_gql "$q" "$(jq -nc \
  --arg teamId "$TEAM_ID" \
  --arg projectId "$PROJECT_ID" \
  --arg stateId "$TODO_STATE_ID" \
  --arg title "$TITLE" \
  --arg description "$DESCRIPTION" \
  '{teamId:$teamId, projectId:$projectId, stateId:$stateId, title:$title, description:$description}')"
```

## Update a Ticket

Resolve the target ticket first and confirm it belongs to Storia web. Resolve state IDs by name before changing workflow state.

```bash
ISSUE_ID="STO-123"
STATE_ID="<state-id>" # omit or set null if not changing state
TITLE='Updated title'
DESCRIPTION='Updated markdown description'

q='mutation($id: String!, $title: String, $description: String, $stateId: String) {
  issueUpdate(id: $id, input: {
    title: $title
    description: $description
    stateId: $stateId
  }) {
    success
    issue { id identifier title url state { name } updatedAt }
  }
}'
linear_gql "$q" "$(jq -nc \
  --arg id "$ISSUE_ID" \
  --arg title "$TITLE" \
  --arg description "$DESCRIPTION" \
  --arg stateId "$STATE_ID" \
  '{id:$id, title:$title, description:$description, stateId:$stateId}')"
```

To update only one field, remove the unused variables and input fields instead of sending empty strings.

## Add a Comment or Workpad Note

```bash
ISSUE_UUID="<issue-uuid-not-identifier>"
BODY=$(cat <<'MD'
## Symphony Workpad
- Plan:
- Validation:
- Blockers:
MD
)

q='mutation($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
    comment { id url }
  }
}'
linear_gql "$q" "$(jq -nc --arg issueId "$ISSUE_UUID" --arg body "$BODY" '{issueId:$issueId, body:$body}')"
```

## Safety Rules

- Do not expose `LINEAR_API_KEY` in output, shell history snippets, logs, screenshots, or committed files.
- Read before mutate: view the issue/project/team/state first.
- Confirm project is Storia web before updates: `project.slugId == storia-web-ccc39fafc20d`.
- Avoid changing terminal tickets (`Done`, `Canceled`, `Duplicate`) unless the user explicitly asks.
- Prefer adding a comment over overwriting ticket descriptions when preserving history matters.
- If Linear returns GraphQL errors, show sanitized errors and variables only; never show headers.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Guessing state IDs | Query project team states first. |
| Creating in the wrong team | Use the team returned by the Storia web project query. |
| Passing an empty description/title during update | Omit fields that should not change. |
| Using identifier where UUID is required for comments | Query `issue(id: "STO-123") { id }`, then use that UUID. |
| Logging curl command with expanded env vars | Keep commands quoted; never use `set -x` around API calls. |
