# .codex Agent ???? ? ???? ?? ??

## ??
- ?? agent ?: 135
- ?? ?? agent: 72
- ?? ?? agent: 63
- ?? ?? ??: `gpt-5.4` 106?, `gpt-5.3-codex-spark` 29?

## ??? ??
- `01-core-development`: 12?
- `02-language-specialists`: 26?
- `03-infrastructure`: 16?
- `04-quality-security`: 16?
- `05-data-ai`: 12?
- `06-developer-experience`: 13?
- `07-specialized-domains`: 12?
- `08-business-product`: 11?
- `09-meta-orchestration`: 10?
- `10-research-analysis`: 7?

## ? ???? ?? ??
### ?? ?? ?? ??
- ?? ??: ??? ??, ??? ??, ??? ?? ???? ???? ???? ?? ??? ??
- ?? agent:
  - `code-mapper`: ?? ??? ?? ??? ?? ??
  - `fullstack-developer`: ???? ???? ? ??? ??
  - `reviewer`: ?? ??? ?? ?? ??
- ?? ??: ?? ????? Django API? Next.js UI? ??? ??? ??, ?? ?? ? ?? owner? ??? ???? ??? ?? ??????.

### ??? ?? ?? ??
- ?? ??: ???, AI ??, ????, ??, ?? ???? Django ? ??? ? ??
- ?? agent:
  - `code-mapper`: ??, serializer, view, command ?? ??
  - `django-developer`: Django ??/?/ORM ?? ??
  - `python-pro`: ????, ???, ??? ??
  - `reviewer`: ??? ?? ?? ??
- ?? ??: ? ???? ?? ??? ??? backend/api ?? Django ?? ?? ??? Django ?? agent? ??? ????.

### ??? ?? ?? ??
- ?? ??: admin/crawler, admin/posts, dashboard, post detail ?? ?? ??
- ?? agent:
  - `code-mapper`: ?? ???? API ??? ??
  - `nextjs-developer`: ???? ??/????? ?? ??
  - `react-specialist`: ???? ?? ??? ??? ??
  - `typescript-pro`: ?? ??? ??
  - `reviewer`: UI ??? ?? ?? ??
- ?? ??: ? ???? Next.js App Router? TypeScript ???? Next.js/React/TypeScript ??? ???? ??? ?????.

### ??????? ????? ??
- ?? ??: RSS/HTML ??, ETL, ???, ??? ??, ???? ?? ??
- ?? agent:
  - `django-developer`: API? ?? ?? ??
  - `data-engineer`: ?? ? ?? ????? ???
  - `postgres-pro`: PostgreSQL/pgvector ?? ??
  - `performance-engineer`: ??/?? ?? ??
- ?? ??: ? ????? ???? ???? ??? ??????, ? ??? ??? ??? ?? ?? ??? ??????.

### AI ?? ?? ??
- ?? ??: ?? ????, ?? ??, ??? job, ?? ?? ??
- ?? agent:
  - `ai-engineer`: AI ?? ??
  - `llm-architect`: ??????????????? ??
  - `prompt-engineer`: ?? ??? ???? ?? ??
  - `reviewer`: ?? ??? ?? ?? ??
- ?? ??: ?? AI ??? ??? ??? ??? ??? ????, ?? agent? ?? ?? agent? ?? ?? ?? ????.

### ????? ??? ??
- ?? ??: run_all.bat, ?? ??, Docker, ?? ????, CI/CD ??
- ?? agent:
  - `devops-engineer`: ?? ?? ??
  - `docker-expert`: ????? ? ??????? ??
  - `deployment-engineer`: ?????? ?? ??
  - `security-engineer`: ?? ?? ??
- ?? ??: ? ????? ?? ??? ??? ?? ?? ??? ?? ? ???? ?? ?? ??? ?? ?????.

### ?? ??? ??
- ?? ??: ?? ?? ??, XSS, ??, ????, ??? ?? ??
- ?? agent:
  - `security-auditor`: ??? ?? ??? ??
  - `penetration-tester`: ?? ?? ??? ?? ??
  - `reviewer`: ?? ?? ?? ?? ??
  - `django-developer`: ?? ?? ??
- ?? ??: ? ???? ???, ??, JWT, localStorage, ??? ??? ??? ?? ?? ??? ?? ?? ??? ?? ?? ? ????.

### ??? ?? ?? ??
- ?? ??: ?? ??? ??? ????? ?? agent? ??? ?? ??
- ?? agent:
  - `agent-organizer`: ??? ??? ??
  - `task-distributor`: ?? ?? ??
  - `multi-agent-coordinator`: ?? ?? ?? ??
  - `knowledge-synthesizer`: ?? ??
- ?? ??: ??? agent? ??? ??? ?? ??? ?? ?? agent? ?? ??? ?? ?? ??? ????.

## 01-core-development - 01. Core Development

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `api-designer` | Use when a task needs API contract design, evolution planning, or compatibility review before implementation starts. | `read-only` | `gpt-5.4 / high` |
| `backend-developer` | Use when a task needs scoped backend implementation or backend bug fixes after the owning path is known. | `workspace-write` | `gpt-5.4 / high` |
| `code-mapper` | Use when the parent agent needs a high-confidence map of code paths, ownership boundaries, and execution flow before changes are made. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `electron-pro` | Use when a task needs Electron-specific implementation or debugging across main/renderer/preload boundaries, packaging, and desktop runtime behavior. | `workspace-write` | `gpt-5.4 / high` |
| `frontend-developer` | Use when a task needs scoped frontend implementation or UI bug fixes with production-level behavior and quality. | `workspace-write` | `gpt-5.4 / high` |
| `fullstack-developer` | Use when one bounded feature or bug spans frontend and backend and a single worker should own the entire path. | `workspace-write` | `gpt-5.4 / high` |
| `graphql-architect` | Use when a task needs GraphQL schema evolution, resolver architecture, federation design, or distributed graph performance/security review. | `read-only` | `gpt-5.4 / high` |
| `microservices-architect` | Use when a task needs service-boundary design, inter-service contract review, or distributed-system architecture decisions. | `read-only` | `gpt-5.4 / high` |
| `mobile-developer` | Use when a task needs mobile implementation or debugging across app lifecycle, API integration, and device/platform-specific UX constraints. | `workspace-write` | `gpt-5.4 / high` |
| `ui-designer` | Use when a task needs concrete UI decisions, interaction design, and implementation-ready design guidance before or during development. | `read-only` | `gpt-5.4 / high` |
| `ui-fixer` | Use when a UI issue is already reproduced and the parent agent wants the smallest safe patch. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `websocket-engineer` | Use when a task needs real-time transport and state work across WebSocket lifecycle, message contracts, and reconnect/failure behavior. | `workspace-write` | `gpt-5.4 / high` |

## 02-language-specialists - 02. Language Specialists

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `angular-architect` | Use when a task needs Angular-specific help for component architecture, dependency injection, routing, signals, or enterprise application structure. | `workspace-write` | `gpt-5.4 / high` |
| `cpp-pro` | Use when a task needs C++ work involving performance-sensitive code, memory ownership, concurrency, or systems-level integration. | `workspace-write` | `gpt-5.4 / high` |
| `csharp-developer` | Use when a task needs C# or .NET application work involving services, APIs, async flows, or application architecture. | `workspace-write` | `gpt-5.4 / high` |
| `django-developer` | Use when a task needs Django-specific work across models, views, forms, ORM behavior, or admin and middleware flows. | `workspace-write` | `gpt-5.4 / high` |
| `dotnet-core-expert` | Use when a task needs modern .NET and ASP.NET Core expertise for APIs, hosting, middleware, or cross-platform application behavior. | `workspace-write` | `gpt-5.4 / high` |
| `dotnet-framework-4.8-expert` | Use when a task needs .NET Framework 4.8 expertise for legacy enterprise applications, compatibility constraints, or Windows-bound integrations. | `workspace-write` | `gpt-5.4 / high` |
| `elixir-expert` | Use when a task needs Elixir and OTP expertise for processes, supervision, fault tolerance, or Phoenix application behavior. | `workspace-write` | `gpt-5.4 / high` |
| `flutter-expert` | Use when a task needs Flutter expertise for widget behavior, state management, rendering issues, or mobile cross-platform implementation. | `workspace-write` | `gpt-5.4 / high` |
| `golang-pro` | Use when a task needs Go expertise for concurrency, service implementation, interfaces, tooling, or performance-sensitive backend paths. | `workspace-write` | `gpt-5.4 / high` |
| `java-architect` | Use when a task needs Java application or service architecture help across framework boundaries, JVM behavior, or large codebase structure. | `workspace-write` | `gpt-5.4 / high` |
| `javascript-pro` | Use when a task needs JavaScript-focused work for runtime behavior, browser or Node execution, or application-level code that is not TypeScript-led. | `workspace-write` | `gpt-5.4 / high` |
| `kotlin-specialist` | Use when a task needs Kotlin expertise for JVM applications, Android code, coroutines, or modern strongly typed service logic. | `workspace-write` | `gpt-5.4 / high` |
| `laravel-specialist` | Use when a task needs Laravel-specific work across routing, Eloquent, queues, validation, or application structure. | `workspace-write` | `gpt-5.4 / high` |
| `nextjs-developer` | Use when a task needs Next.js-specific work across routing, rendering modes, server actions, data fetching, or deployment-sensitive frontend behavior. | `workspace-write` | `gpt-5.4 / high` |
| `php-pro` | Use when a task needs PHP expertise for application logic, framework integration, runtime debugging, or server-side code evolution. | `workspace-write` | `gpt-5.4 / high` |
| `powershell-5.1-expert` | Use when a task needs Windows PowerShell 5.1 expertise for legacy automation, full .NET Framework interop, or Windows administration scripts. | `workspace-write` | `gpt-5.4 / high` |
| `powershell-7-expert` | Use when a task needs modern PowerShell 7 expertise for cross-platform automation, scripting, or .NET-based operational tooling. | `workspace-write` | `gpt-5.4 / high` |
| `python-pro` | Use when a task needs a Python-focused subagent for runtime behavior, packaging, typing, testing, or framework-adjacent implementation. | `workspace-write` | `gpt-5.4 / high` |
| `rails-expert` | Use when a task needs Ruby on Rails expertise for models, controllers, jobs, callbacks, or convention-driven application changes. | `workspace-write` | `gpt-5.4 / high` |
| `react-specialist` | Use when a task needs a React-focused agent for component behavior, state flow, rendering bugs, or modern React patterns. | `workspace-write` | `gpt-5.4 / high` |
| `rust-engineer` | Use when a task needs Rust expertise for ownership-heavy systems code, async runtime behavior, or performance-sensitive implementation. | `workspace-write` | `gpt-5.4 / high` |
| `spring-boot-engineer` | Use when a task needs Spring Boot expertise for service behavior, configuration, data access, or enterprise API implementation. | `workspace-write` | `gpt-5.4 / high` |
| `sql-pro` | Use when a task needs SQL query design, query review, schema-aware debugging, or database migration analysis. | `read-only` | `gpt-5.4 / high` |
| `swift-expert` | Use when a task needs Swift expertise for iOS or macOS code, async flows, Apple platform APIs, or strongly typed application logic. | `workspace-write` | `gpt-5.4 / high` |
| `typescript-pro` | Use when a task needs strong TypeScript help for types, interfaces, refactors, or compiler-driven fixes. | `workspace-write` | `gpt-5.4 / high` |
| `vue-expert` | Use when a task needs Vue expertise for component behavior, Composition API patterns, routing, or state and rendering issues. | `workspace-write` | `gpt-5.4 / high` |

## 03-infrastructure - 03. Infrastructure

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `azure-infra-engineer` | Use when a task needs Azure-specific infrastructure review or implementation across resources, networking, identity, or automation. | `read-only` | `gpt-5.4 / high` |
| `cloud-architect` | Use when a task needs cloud architecture review across compute, storage, networking, reliability, or multi-service design. | `read-only` | `gpt-5.4 / high` |
| `database-administrator` | Use when a task needs operational database administration review for availability, backups, recovery, permissions, or runtime health. | `read-only` | `gpt-5.4 / high` |
| `deployment-engineer` | Use when a task needs deployment workflow changes, release strategy updates, or rollout and rollback safety analysis. | `workspace-write` | `gpt-5.4 / high` |
| `devops-engineer` | Use when a task needs CI, deployment pipeline, release automation, or environment configuration work. | `workspace-write` | `gpt-5.4 / high` |
| `devops-incident-responder` | Use when a task needs rapid operational triage across CI, deployments, infrastructure automation, and service delivery failures. | `read-only` | `gpt-5.4 / high` |
| `docker-expert` | Use when a task needs Dockerfile review, image optimization, multi-stage build fixes, or container runtime debugging. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `incident-responder` | Use when a task needs broad production incident triage, containment planning, or evidence-driven root cause analysis. | `read-only` | `gpt-5.4 / high` |
| `kubernetes-specialist` | Use when a task needs Kubernetes manifest review, rollout safety analysis, or cluster workload debugging. | `read-only` | `gpt-5.4 / high` |
| `network-engineer` | Use when a task needs network-path analysis, service connectivity debugging, load-balancer review, or infrastructure network design input. | `read-only` | `gpt-5.4 / high` |
| `platform-engineer` | Use when a task needs internal platform, golden-path, or self-service infrastructure design for developers. | `read-only` | `gpt-5.4 / high` |
| `security-engineer` | Use when a task needs infrastructure and platform security engineering across IAM, secrets, network controls, or hardening work. | `read-only` | `gpt-5.4 / high` |
| `sre-engineer` | Use when a task needs reliability engineering work involving SLOs, alerting, error budgets, operational safety, or service resilience. | `read-only` | `gpt-5.4 / high` |
| `terraform-engineer` | Use when a task needs Terraform module design, plan review, state-aware change analysis, or IaC refactoring. | `read-only` | `gpt-5.4 / high` |
| `terragrunt-expert` | Use when a task needs Terragrunt-specific help for module orchestration, environment layering, dependency wiring, or DRY infrastructure structure. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `windows-infra-admin` | Use when a task needs Windows infrastructure administration across Active Directory, DNS, DHCP, GPO, or Windows automation. | `read-only` | `gpt-5.4 / high` |

## 04-quality-security - 04. Quality & Security

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `accessibility-tester` | Use when a task needs an accessibility audit of UI changes, interaction flows, or component behavior. | `read-only` | `gpt-5.4 / high` |
| `ad-security-reviewer` | Use when a task needs Active Directory security review across identity boundaries, delegation, GPO exposure, or directory hardening. | `read-only` | `gpt-5.4 / high` |
| `architect-reviewer` | Use when a task needs architectural review for coupling, system boundaries, long-term maintainability, or design coherence. | `read-only` | `gpt-5.4 / high` |
| `browser-debugger` | Use when a task needs browser-based reproduction, UI evidence gathering, or client-side debugging through a browser MCP server. | `workspace-write` | `gpt-5.4 / high` |
| `chaos-engineer` | Use when a task needs resilience analysis for dependency failure, degraded modes, recovery behavior, or controlled fault-injection planning. | `read-only` | `gpt-5.4 / high` |
| `code-reviewer` | Use when a task needs a broader code-health review covering maintainability, design clarity, and risky implementation choices in addition to correctness. | `read-only` | `gpt-5.4 / high` |
| `compliance-auditor` | Use when a task needs compliance-oriented review of controls, auditability, policy alignment, or evidence gaps in a regulated workflow. | `read-only` | `gpt-5.4 / high` |
| `debugger` | Use when a task needs deep bug isolation across code paths, stack traces, runtime behavior, or failing tests. | `read-only` | `gpt-5.4 / high` |
| `error-detective` | Use when a task needs log, exception, or stack-trace analysis to identify the most probable failure source quickly. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `penetration-tester` | Use when a task needs adversarial review of an application path for exploitability, abuse cases, or practical attack surface analysis. | `read-only` | `gpt-5.4 / high` |
| `performance-engineer` | Use when a task needs performance investigation for slow requests, hot paths, rendering regressions, or scalability bottlenecks. | `read-only` | `gpt-5.4 / high` |
| `powershell-security-hardening` | Use when a task needs PowerShell-focused hardening across script safety, admin automation, execution controls, or Windows security posture. | `read-only` | `gpt-5.4 / high` |
| `qa-expert` | Use when a task needs test strategy, acceptance coverage planning, or risk-based QA guidance for a feature or release. | `read-only` | `gpt-5.4 / high` |
| `reviewer` | Use when a task needs PR-style review focused on correctness, security, behavior regressions, and missing tests. | `read-only` | `gpt-5.4 / high` |
| `security-auditor` | Use when a task needs focused security review of code, auth flows, secrets handling, input validation, or infrastructure configuration. | `read-only` | `gpt-5.4 / high` |
| `test-automator` | Use when a task needs implementation of automated tests, test harness improvements, or targeted regression coverage. | `workspace-write` | `gpt-5.3-codex-spark / medium` |

## 05-data-ai - 05. Data & AI

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `ai-engineer` | Use when a task needs implementation or debugging of model-backed application features, agent flows, or evaluation hooks. | `workspace-write` | `gpt-5.4 / high` |
| `data-analyst` | Use when a task needs data interpretation, metric breakdown, trend explanation, or decision support from existing analytics outputs. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `data-engineer` | Use when a task needs ETL, ingestion, transformation, warehouse, or data-pipeline implementation and debugging. | `workspace-write` | `gpt-5.4 / high` |
| `data-scientist` | Use when a task needs statistical reasoning, experiment interpretation, feature analysis, or model-oriented data exploration. | `read-only` | `gpt-5.4 / high` |
| `database-optimizer` | Use when a task needs database performance analysis for query plans, schema design, indexing, or data access patterns. | `read-only` | `gpt-5.4 / high` |
| `llm-architect` | Use when a task needs architecture review for prompts, tool use, retrieval, evaluation, or multi-step LLM workflows. | `read-only` | `gpt-5.4 / high` |
| `machine-learning-engineer` | Use when a task needs ML system implementation work across training pipelines, feature flow, model serving, or inference integration. | `workspace-write` | `gpt-5.4 / high` |
| `ml-engineer` | Use when a task needs practical machine learning implementation across feature engineering, inference wiring, and model-backed application logic. | `workspace-write` | `gpt-5.4 / high` |
| `mlops-engineer` | Use when a task needs model deployment, registry, pipeline, monitoring, or environment orchestration for machine learning systems. | `workspace-write` | `gpt-5.4 / high` |
| `nlp-engineer` | Use when a task needs NLP-specific implementation or analysis involving text processing, embeddings, ranking, or language-model-adjacent pipelines. | `workspace-write` | `gpt-5.4 / high` |
| `postgres-pro` | Use when a task needs PostgreSQL-specific expertise for schema design, performance behavior, locking, or operational database features. | `read-only` | `gpt-5.4 / high` |
| `prompt-engineer` | Use when a task needs prompt revision, instruction design, eval-oriented prompt comparison, or prompt-output contract tightening. | `read-only` | `gpt-5.4 / high` |

## 06-developer-experience - 06. Developer Experience

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `build-engineer` | Use when a task needs build-graph debugging, bundling fixes, compiler pipeline work, or CI build stabilization. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `cli-developer` | Use when a task needs a command-line interface feature, UX review, argument parsing change, or shell-facing workflow improvement. | `workspace-write` | `gpt-5.4 / high` |
| `dependency-manager` | Use when a task needs dependency upgrades, package graph analysis, version-policy cleanup, or third-party library risk assessment. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `documentation-engineer` | Use when a task needs technical documentation that must stay faithful to current code, tooling, and operator workflows. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `dx-optimizer` | Use when a task needs developer-experience improvements in setup time, local workflows, feedback loops, or day-to-day tooling friction. | `read-only` | `gpt-5.4 / high` |
| `git-workflow-manager` | Use when a task needs help with branching strategy, merge flow, release branching, or repository collaboration conventions. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `legacy-modernizer` | Use when a task needs a modernization path for older code, frameworks, or architecture without losing behavioral safety. | `read-only` | `gpt-5.4 / high` |
| `mcp-developer` | Use when a task needs work on MCP servers, MCP clients, tool wiring, or protocol-aware integrations. | `workspace-write` | `gpt-5.4 / high` |
| `powershell-module-architect` | Use when a task needs PowerShell module structure, command design, packaging, or profile architecture work. | `workspace-write` | `gpt-5.4 / high` |
| `powershell-ui-architect` | Use when a task needs PowerShell-based UI work for terminals, forms, WPF, or admin-oriented interactive tooling. | `workspace-write` | `gpt-5.4 / high` |
| `refactoring-specialist` | Use when a task needs a low-risk structural refactor that preserves behavior while improving readability, modularity, or maintainability. | `workspace-write` | `gpt-5.4 / high` |
| `slack-expert` | Use when a task needs Slack platform work involving bots, interactivity, events, workflows, or Slack-specific integration behavior. | `workspace-write` | `gpt-5.4 / high` |
| `tooling-engineer` | Use when a task needs internal developer tooling, scripts, automation glue, or workflow support utilities. | `workspace-write` | `gpt-5.3-codex-spark / medium` |

## 07-specialized-domains - 07. Specialized Domains

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `api-documenter` | Use when a task needs consumer-facing API documentation generated from the real implementation, schema, and examples. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `blockchain-developer` | Use when a task needs blockchain or Web3 implementation and review across smart-contract integration, wallet flows, or transaction lifecycle handling. | `workspace-write` | `gpt-5.4 / high` |
| `embedded-systems` | Use when a task needs embedded or hardware-adjacent work involving device constraints, firmware boundaries, timing, or low-level integration. | `workspace-write` | `gpt-5.4 / high` |
| `fintech-engineer` | Use when a task needs financial systems engineering across ledgers, reconciliation, transfers, settlement, or compliance-sensitive transactional flows. | `workspace-write` | `gpt-5.4 / high` |
| `game-developer` | Use when a task needs game-specific implementation or debugging involving gameplay systems, rendering loops, asset flow, or player-state behavior. | `workspace-write` | `gpt-5.4 / high` |
| `iot-engineer` | Use when a task needs IoT system work involving devices, telemetry, edge communication, or cloud-device coordination. | `workspace-write` | `gpt-5.4 / high` |
| `m365-admin` | Use when a task needs Microsoft 365 administration help across Exchange Online, Teams, SharePoint, identity, or tenant-level automation. | `read-only` | `gpt-5.4 / high` |
| `mobile-app-developer` | Use when a task needs app-level mobile product work across screens, state, API integration, and release-sensitive mobile behavior. | `workspace-write` | `gpt-5.4 / high` |
| `payment-integration` | Use when a task needs payment-flow review or implementation for checkout, idempotency, webhooks, retries, or settlement state handling. | `workspace-write` | `gpt-5.4 / high` |
| `quant-analyst` | Use when a task needs quantitative analysis of models, strategies, simulations, or numeric decision logic. | `read-only` | `gpt-5.4 / high` |
| `risk-manager` | Use when a task needs explicit risk analysis for product, operational, financial, or architectural decisions. | `read-only` | `gpt-5.4 / high` |
| `seo-specialist` | Use when a task needs search-focused technical review across crawlability, metadata, rendering, information architecture, or content discoverability. | `read-only` | `gpt-5.3-codex-spark / medium` |

## 08-business-product - 08. Business & Product

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `business-analyst` | Use when a task needs requirements clarified, scope normalized, or acceptance criteria extracted from messy inputs before engineering work starts. | `read-only` | `gpt-5.4 / high` |
| `content-marketer` | Use when a task needs product-adjacent content strategy or messaging that still has to stay grounded in real technical capabilities. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `customer-success-manager` | Use when a task needs support-pattern synthesis, adoption risk analysis, or customer-facing operational guidance from engineering context. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `legal-advisor` | Use when a task needs legal-risk spotting in product or engineering behavior, especially around terms, data handling, or externally visible commitments. | `read-only` | `gpt-5.4 / high` |
| `product-manager` | Use when a task needs product framing, prioritization, or feature-shaping based on engineering reality and user impact. | `read-only` | `gpt-5.4 / high` |
| `project-manager` | Use when a task needs dependency mapping, milestone planning, sequencing, or delivery-risk coordination across multiple workstreams. | `read-only` | `gpt-5.4 / high` |
| `sales-engineer` | Use when a task needs technically accurate solution positioning, customer-question handling, or implementation tradeoff explanation for pre-sales contexts. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `scrum-master` | Use when a task needs process facilitation, iteration planning, or workflow friction analysis for an engineering team. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `technical-writer` | Use when a task needs release notes, migration notes, onboarding material, or developer-facing prose derived from real code changes. | `workspace-write` | `gpt-5.3-codex-spark / medium` |
| `ux-researcher` | Use when a task needs UI feedback synthesized into actionable product and implementation guidance. | `read-only` | `gpt-5.4 / high` |
| `wordpress-master` | Use when a task needs WordPress-specific implementation or debugging across themes, plugins, content architecture, or operational site behavior. | `workspace-write` | `gpt-5.4 / high` |

## 09-meta-orchestration - 09. Meta & Orchestration

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `agent-installer` | Use when a task needs help selecting, copying, or organizing custom agent files from this repository into Codex agent directories. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `agent-organizer` | Use when the parent agent needs help choosing subagents and dividing a larger task into clean delegated threads. | `read-only` | `gpt-5.4 / high` |
| `context-manager` | Use when a task needs a compact project context summary that other subagents can rely on before deeper work begins. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `error-coordinator` | Use when multiple errors or symptoms need to be grouped, prioritized, and assigned to the right debugging or review agents. | `read-only` | `gpt-5.4 / high` |
| `it-ops-orchestrator` | Use when a task needs coordinated operational planning across infrastructure, incident response, identity, endpoint, and admin workflows. | `read-only` | `gpt-5.4 / high` |
| `knowledge-synthesizer` | Use when multiple agents have returned findings and the parent agent needs a distilled, non-redundant synthesis. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `multi-agent-coordinator` | Use when a task needs a concrete multi-agent plan with clear role separation, dependencies, and result integration. | `read-only` | `gpt-5.4 / high` |
| `performance-monitor` | Use when a task needs ongoing performance-signal interpretation across build, runtime, or operational metrics before deeper optimization starts. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `task-distributor` | Use when a broad task needs to be broken into concrete sub-tasks with clear boundaries for multiple agents or contributors. | `read-only` | `gpt-5.4 / high` |
| `workflow-orchestrator` | Use when the parent agent needs an explicit Codex subagent workflow for a complex task with multiple stages. | `read-only` | `gpt-5.4 / high` |

## 10-research-analysis - 10. Research & Analysis

| Agent | ?? ?? | ?? ?? | ?? |
|---|---|---|---|
| `competitive-analyst` | Use when a task needs a grounded comparison of tools, products, libraries, or implementation options. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `data-researcher` | Use when a task needs source gathering and synthesis around datasets, metrics, data pipelines, or evidence-backed quantitative questions. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `docs-researcher` | Use when a task needs documentation-backed verification of APIs, version-specific behavior, or framework options. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `market-researcher` | Use when a task needs market landscape, positioning, or demand-side research tied to a technical product or category. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `research-analyst` | Use when a task needs a structured investigation of a technical topic, implementation approach, or design question. | `read-only` | `gpt-5.4 / high` |
| `search-specialist` | Use when a task needs fast, high-signal searching of the codebase or external sources before deeper analysis begins. | `read-only` | `gpt-5.3-codex-spark / medium` |
| `trend-analyst` | Use when a task needs trend synthesis across technology shifts, adoption patterns, or emerging implementation directions. | `read-only` | `gpt-5.3-codex-spark / medium` |
