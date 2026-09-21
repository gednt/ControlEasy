<!-- generated-by: gsd-doc-writer -->
# ControlEasy Reborn

ControlEasy Reborn is a multi-tenant condominium access-control web platform for managing residents, visitors, vehicles, service providers, apartments, photos, consent policies, and gatehouse ("portaria") operations.

## Overview

Built as a high-performance modular monolith with an Angular 18 SPA frontend and an ASP.NET Core 8 minimal API backend, ControlEasy Reborn enforces strict tenant isolation, role- and permission-based authorization, and Docker-driven local and production workflows.

### Technology Stack

- **Backend:** ASP.NET Core 8 (C# 12 minimal API endpoints, Clean Architecture per module)
- **Frontend:** Angular 18 SPA (standalone components, signals, OnPush change detection, Lucide icons)
- **Data Access:** [DBTools](https://www.nuget.org/packages/DBTools) 1.4.3 (`Linq<T>`, `IAsyncSqlClient`) — Custom open-source ORM created by Felipe Coelho (in development since 2014) — No EF Core
- **Database:** MySQL 8
- **Reverse Proxy & Gateway:** Traefik v3.1
- **Logging & Diagnostics:** Serilog (Console JSON + Seq)
- **Client Generation:** OpenAPI 3 schema via Swashbuckle → Angular services via `ng-openapi-gen`
- **Testing:** xUnit, FluentAssertions, NSubstitute, Testcontainers.MySql, NetArchTest.Rules, Playwright, Karma/Jasmine

## Origin & Evolution

**ControlEasy Reborn** is the modern evolution of the original **ControlEasy** project, which originated as a final course completion project (*Trabalho de Conclusão de Curso — TCC*) at **ETEC** (Escola Técnica Estadual), developed as a graduation requirement to obtain the technical degree.

Following the conclusion of the course, custody and ownership of the code remained with **Felipe Coelho**, who continued its development and architectural transformation across three software generations:

1. **First Generation (VB.NET & Windows Forms):** Developed originally as a desktop application in Visual Basic .NET (VB.NET) with Windows Forms, handling basic gatehouse logging and local desktop-based condominium administration.
2. **Second Generation (C# Windows Forms):** Ported to C# to improve type safety, maintainability, and code structure, continuing desktop-based operations.
3. **Third Generation — ControlEasy Reborn (Modern Web & Multi-Tenancy):** Complete architectural rebirth into a high-performance web platform — engineered as a Clean Architecture modular monolith on ASP.NET Core 8 minimal APIs, an Angular 18 SPA with reactive signals, and native multi-tenancy supporting multiple condominium complexes on a shared, isolated infrastructure.

> 📜 **Historical Archive:** For the complete chronological release chronicle of the classic desktop era (from v0.1 to v3.6.0.6), see the [Historical Changelog](docs/HISTORICAL-CHANGELOG.md).

### The Core Objective: True Enterprise-Grade Engineering

A central objective of this rebirth was to showcase what **genuine enterprise-grade software engineering** looks like when built from first principles — deliberately moving beyond corporate bureaucracy and default framework templates in favor of uncompromised architectural rigor:

- **Modular Monolith over Premature Microservices:** Avoids the network latency, distributed transaction failures, and eventual-consistency nightmares of premature microservices by structuring the platform into 11 cleanly decoupled bounded contexts within a unified, high-performance runtime.
- **Architectural Fitness Automated via Tests (`NetArchTest`):** Rather than treating Clean Architecture as aspirational documentation, layer boundaries and module independence are programmatically enforced via automated architecture tests — any illicit cross-module or cross-layer dependency immediately fails the build.
- **Root-Level Multi-Tenant Isolation (`ITenantAwareLinqFactory`):** Multi-tenancy is not an afterthought left to developer diligence or error-prone manual `WHERE` clauses. Tenant filters are injected at the query factory level, rendering cross-tenant data leakage architecturally impossible.
- **Predictable Data Access over Heavyweight ORMs (DBTools):** While commodity enterprise shops default to Entity Framework Core, ControlEasy deliberately leverages DBTools (`Linq<TModel>`, `IAsyncSqlClient`). This eliminates change-tracker memory bloat, Cartesian explosions, and opaque query generation in favor of predictable, high-throughput LINQ-to-SQL execution.
- **Zero Schema Drift by Design:** Strong typing is guaranteed across the network boundary by automatically compiling backend OpenAPI 3 specifications into Angular client services (`ng-openapi-gen`), with CI verification (`openapi-check`) blocking any frontend/backend model divergence.
- **High-Fidelity Integration Testing (`Testcontainers`):** Replaces unrealistic in-memory database mocks with disposable MySQL 8 Docker containers spun up dynamically during test execution, ensuring 100% production database parity.
- **Accessible, Reactive Frontend Architecture:** Combines Angular 18 reactive Signals and `OnPush` change detection with automated Axe Core accessibility audits integrated directly into Playwright end-to-end suites.

### The Story of DBTools (Custom ORM)

A defining architectural characteristic across ControlEasy's history is the intentional use of **[DBTools](https://www.nuget.org/packages/DBTools)** instead of standard heavyweight ORMs like Entity Framework Core. 

DBTools was created by **Felipe Coelho** in **2014** during the initial development of ControlEasy. It was conceived to provide fast, predictable, LINQ-to-SQL query composition tailored specifically to access-control workflows without the hidden magic, complex change-tracking, and runtime overhead of general-purpose ORMs. Over more than a decade of active use and refinement, DBTools evolved naturally alongside ControlEasy from internal data-access utilities into the standalone, open-source NuGet package utilized across the solution today. In ControlEasy Reborn, DBTools underpins tenant-isolated query generation through `ITenantAwareLinqFactory` while sustaining high-throughput gatehouse operations.

### AI-Augmented Engineering (Not "Vibe Coding")

It is important to emphasize: **ControlEasy Reborn was not "vibe coded" — it was rigorously AI-augmented.**

Rather than unconstrained, prompt-and-pray code generation, the modernization from legacy desktop codebases into a modular monolith was executed through disciplined, human-architected software engineering amplified by AI. Every component conforms to strict architectural invariants, verified specifications, and automated quality gates:

- **Specification-First, Not Prompt-Driven:** No feature or refactoring is built without upfront requirements elicitation, design specifications, and dependency-ordered tasks (`.specs/`).
- **Constitutional Architectural Invariants:** Strict architectural boundaries and Clean Architecture rules are codified in a binding project constitution (`.specify/memory/constitution.md`) and automatically validated on every build via `NetArchTest.Rules`.
- **Exhaustive Automated Verification:** Every task must pass comprehensive automated test suites (xUnit unit tests, Testcontainers MySQL integration tests, Playwright E2E suites, and Axe Core accessibility checks) before completion.
- **Adversarial Multi-Agent Review:** Proposed changes are systematically stress-tested by parallel adversarial review personas (Blind Hunter, Edge-Case Hunter, Acceptance Auditor) prior to human review and commit.
- **The Author as Product Owner & Director:** The author did not merely prompt an AI; he actively functioned as **Product Owner (PO)** and **Director** across the entire project lifecycle. As PO, he defined domain models, condominium access-control rules, acceptance criteria, and operational scenarios. As Director, he steered the architectural vision, orchestrated specialized agent workflows, established constitutional guardrails, and held strict review and veto authority over every design artifact and commit.
- **Handcrafted Code Style & Direct Authorship:** The codebase — particularly throughout the backend — intimately reflects the author's preferred engineering aesthetics, structural idioms, and clean-code standards. Far from generic machine-generated boilerplate, the code reads entirely as if the author wrote it by hand; in fact, he directly authored many parts of the system, from core kernel abstractions and LINQ patterns to critical business handlers.
- **Uncompromising Standards (and Authorial Stubbornness):** It is worth stating candidly that the author is notoriously meticulous — at times to the point of being downright annoying — whenever any part of the codebase is not strictly to his liking. This perfectionism can be readily evidenced throughout the repository: zero-tolerance compiler warnings (`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`), automated NetArchTest architectural boundaries, rigid Docker-only and Git worktree isolation rules, and relentless refactoring passes across every module.

The agent frameworks facilitating this AI-augmented development include:

- **[GSD-core](.planning/) (Get Stuff Done):** Orchestrates the macro-level migration roadmap across 18 development phases spanning multiple milestones (v1.0–v2.2 shipped milestones; Phases 14-15 reserved for v2.2), tracking live project state, decision logs, codebase maps, and milestone verifications.
- **[spec-kit](.specify/) (Specification-Driven Development):** Enforces a specification-first engineering methodology anchored by the project constitution. Every non-trivial feature or refactoring undergoes rigorous requirement clarification, architecture planning (`spec.md`, `plan.md`), and ordered task execution (`tasks.md`).
- **[BMAD Method](_bmad/) & WDS (Multi-Agent Role Collaboration):** Deploys collaborative agent personas (System Architect Winston, Senior Developer Amelia, Test Architect Murat, Business Analyst Mary, and UX Designers) for adversarial code reviews, edge-case hunting, and automated quality audits.
- **[agents-template](AGENTS.md) & [Impeccable](.impeccable/):** Defines the binding runtime contract and governance invariants for all AI coding assistants (strict Docker-only development, Git worktree isolation, pre-commit adversarial review gates) alongside design system and frontend excellence standards.

For an overview of how these agent workflows interoperate, refer to the [Agent Flow Cheat Sheet](docs/agent-flow-cheatsheet.md).

## Prerequisites

- **Docker Engine 24+** with **Docker Compose v2** (`docker compose`)
- **Git**
- Available host ports: `8080` (HTTP), `8443` (HTTPS), `8082` (Traefik dashboard)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone http://192.168.15.5:3030/reisfelipe18/ControlEasy.git
   cd ControlEasy
   ```
   <!-- VERIFY: clone URL is the current Git origin (LAN-hosted Git server at http://192.168.15.5:3030/reisfelipe18/ControlEasy, per `git remote -v`). No public GitHub mirror is currently reachable (github.com/gednt/ControlEasy and github.com/reisfelipe18/ControlEasy both return 404); update this URL if a public remote is published. -->

2. **Configure environment (optional for local development):**
   ```bash
   cp docker/.env.example docker/.env
   ```

3. **Start the complete stack:**
   ```bash
   docker compose -f docker/docker-compose.yml up -d --build
   ```
   Or using the Makefile shortcut:
   ```bash
   make up
   ```

4. **Retrieve first-boot credentials & sign in:**
   Inspect the API container logs to obtain the generated PlatformAdmin credentials:
   ```bash
   docker compose -f docker/docker-compose.yml logs api | grep "CHANGE IMMEDIATELY"
   ```
   Open [http://localhost:8080](http://localhost:8080) to sign in and set your new password.

## Demo Mode

To evaluate ControlEasy Reborn with pre-populated sample data (two themed condominiums, residents, visitors, attendant profiles, and fixed credentials `demo123`):

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml up -d --build
```

Access personas and sample scenarios:
- **Portaria / Attendant:** `porteiro@controleasy.app` / `demo123`
- **Tenant Administrator:** `admin@controleasy.app` / `demo123`
- **Platform Administrator:** `platform@controleasy.app` / `demo123`

> **Security Warning:** Never use the demo signing key or demo overlay in production environments.

## Repository Layout

```
ControlEasy/
├── src/
│   ├── Host/ControlEasyReborn.Api/             # API entrypoint, DI, hosting, endpoint mapping
│   ├── Web/ControlEasyReborn.Web/              # Angular 18 SPA (standalone components & signals)
│   ├── BuildingBlocks/                         # Shared kernel, data access, auth, middleware
│   └── Modules/                                # Feature modules (Clean Architecture)
│       ├── AccessControl/                      # Access events, QR credentials, gatehouse access & visit destinations
│       ├── Administration/                     # Condominium & system administration
│       ├── Apartments/                         # Units, blocks, occupancy
│       ├── Photos/                             # Photo capture, storage, and consent policies
│       ├── Reports/                            # Operational reports & dashboard analytics
│       ├── Residents/                          # Resident profiles, contacts, units
│       ├── Security/                           # Users, authentication, shifts, gatehouses
│       ├── ServiceProviders/                   # Contractors, companies, authorizations
│       ├── Tenants/                            # Multi-tenancy isolation and tenant admins
│       ├── Vehicles/                           # Vehicle registration and license plates
│       └── Visits/                             # Visitor registration, check-in, check-out
├── tests/
│   ├── ControlEasyReborn.UnitTests/            # Domain & Application unit tests
│   ├── ControlEasyReborn.IntegrationTests/     # Database integration tests (Testcontainers)
│   ├── ControlEasyReborn.ArchitectureTests/    # NetArchTest Clean Architecture validation
│   ├── a11y/                                   # Axe core accessibility tests
│   └── visual/                                 # Playwright visual regression tests
├── docker/                                     # Docker compose, Dockerfiles, MySQL init SQL
└── docs/                                       # Project documentation
```

## Documentation Directory

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- [Architecture Guide](docs/ARCHITECTURE.md) — Modular monolith architecture, data flow, key abstractions
- [Getting Started Guide](docs/GETTING-STARTED.md) — First boot, database initialization, access URLs, troubleshooting
- [Configuration Reference](docs/CONFIGURATION.md) — Environment variables, appsettings, secrets, and overrides
- [Development Guide](docs/DEVELOPMENT.md) — Local development workflow, build commands, code standards
- [Testing Guide](docs/TESTING.md) — Test suites, running tests, writing new tests, CI pipeline
- [API Documentation](docs/API.md) — REST API endpoints, authentication, request/response formats
- [Deployment Guide](docs/DEPLOYMENT.md) — Docker container deployment, CI/CD pipeline, and monitoring
- [AccessControl Module](docs/access-control.md) — Access events, QR credentials, and manual lookup
- [Demo Mode Specification](docs/demo-mode.md) — Demo data schemas, credentials, walkthroughs
- [Changelog](CHANGELOG.md) — Release notes and milestone deliveries for ControlEasy Reborn (v1.0.0 to v2.0.0+)
- [Historical Changelog](docs/HISTORICAL-CHANGELOG.md) — Complete desktop release chronicle (v0.1 to v3.6.0.6)
- [Agent Flow Cheatsheet](docs/agent-flow-cheatsheet.md) — Multi-agent orchestrations and lifecycle conventions
- [AGENTS.md](AGENTS.md) — Authoritative contributor rules and architectural invariants

## License

This project is **Source-Available**.

The application source code is publicly accessible for evaluation, inspection, security auditing, and educational reference. However, **modifications, derivative works, and production or commercial use require prior written authorization** from the copyright holder.

For complete license terms, restrictions, and authorization inquiries, please see [LICENSE.md](LICENSE.md).

Copyright (c) 2026 Felipe Coelho R. Silva. All rights reserved.

---

## Open-Source Acknowledgments

ControlEasy Reborn builds upon and acknowledges the open-source ecosystem, incorporating the following open-source frameworks, libraries, and tools:

### Data Access & Custom ORM
- **[DBTools](https://www.nuget.org/packages/DBTools)** — High-performance LINQ-to-SQL custom ORM authored by Felipe Coelho R. Silva (in development since 2014)

### Backend & Core (.NET)
- **[ASP.NET Core & .NET 8](https://github.com/dotnet/aspnetcore)** — Web framework and runtime (MIT)
- **[MySqlConnector](https://mysqlconnector.net/)** — High-performance asynchronous ADO.NET provider for MySQL (MIT)
- **[Serilog](https://serilog.net/)** — Structured diagnostic logging framework and sinks (`Serilog.AspNetCore`, Console, Seq, File) (Apache 2.0)
- **[FluentValidation](https://fluentvalidation.net/)** — Fluent business rule and request validation (Apache 2.0)
- **[Mapster](https://github.com/MapsterMapper/Mapster)** — High-performance object-to-object mapping (MIT)
- **[Swashbuckle.AspNetCore](https://github.com/domaindrivendev/Swashbuckle.AspNetCore)** — OpenAPI 3 / Swagger documentation tooling (MIT)
- **[BCrypt.Net-Next](https://github.com/BcryptNet/bcrypt.net)** — Secure password hashing (Apache 2.0 / MIT)
- **[NPOI](https://github.com/nissl-lab/npoi)** & **[SharpZipLib](https://github.com/icsharpcode/SharpZipLib)** — Excel spreadsheet generation and zip archive management (Apache 2.0 / MIT)
- **[AWSSDK.S3](https://github.com/aws/aws-sdk-net)** — S3-compatible photo and blob storage client (Apache 2.0)

### Frontend (Angular & Web)
- **[Angular 18](https://angular.dev/)** — Single-page web application framework (MIT)
- **[RxJS](https://rxjs.dev/)** — Reactive extensions for asynchronous streams (Apache 2.0)
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling framework (MIT)
- **[Lucide Angular](https://lucide.dev/)** — Icon set for Angular (ISC)
- **[clsx](https://github.com/lukeed/clsx)** — Dynamic class binding utility (MIT)
- **[exifr](https://github.com/MikeKovarik/exifr)** — Client-side image metadata/EXIF parser (MIT)
- **[ng-openapi-gen](https://github.com/cyclosproject/ng-openapi-gen)** — Angular HTTP client generator from OpenAPI 3 specs (MIT)

### Testing & Code Quality
- **[xUnit](https://xunit.net/)** — .NET unit testing framework (Apache 2.0)
- **[FluentAssertions](https://fluentassertions.com/)** — Fluent assertion library for .NET tests (Apache 2.0)
- **[NSubstitute](https://nsubstitute.github.io/)** — Mocking framework for .NET (BSD-3-Clause)
- **[Testcontainers for .NET](https://dotnet.testcontainers.org/)** — Disposable containerized MySQL testing (MIT)
- **[NetArchTest.Rules](https://github.com/BenMorris/NetArchTest)** — Architectural fitness and Clean Architecture rules engine (MIT)
- **[Playwright](https://playwright.dev/)** — Cross-browser end-to-end testing framework (Apache 2.0)
- **[Axe Core](https://github.com/dequelabs/axe-core)** (`@axe-core/playwright`) — Automated accessibility testing engine (MPL 2.0)
- **[ESLint](https://eslint.org/)** & **[Prettier](https://prettier.io/)** — Code linting and formatting (MIT)
- **[Karma](https://karma-runner.github.io/)** & **[Jasmine](https://jasmine.github.io/)** — Frontend unit testing runner and assertion framework (MIT)

### Infrastructure & Operations
- **[MySQL 8](https://www.mysql.com/)** — Relational database engine (GPL v2 with FOSS Exception)
- **[Traefik](https://traefik.io/)** — Edge router and reverse proxy (MIT)
- **[Adminer](https://www.adminer.org/)** — Database management tool (Apache 2.0 / GPL 2)
- **[Seq](https://datalust.co/seq)** — Centralized structured log server (Free development license)

### Agentic Engineering & Workflow Tooling
- **[BMAD Method](https://github.com/bmad-code/bmad)** — Multi-agent persona collaboration, sprint tracking, and adversarial code-review framework (MIT)
- **[spec-kit](https://github.com/github/spec-kit)** — Specification-driven software development methodology and lifecycle tooling (MIT)
- **[agents-template](https://github.com/agents-template/agents-template)** — Standardized runtime contract schema and governance invariants for AI coding agents (MIT)