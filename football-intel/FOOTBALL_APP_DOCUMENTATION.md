# Football Match Intelligence & MatchMind AI — Complete Technical & Product Specification

> **Version:** 2.0.0 (Production & Hackathon Master Edition)  
> **Classification:** Full Stack AI Football Match Intelligence & Premier League Studio System  
> **Authors:** MatchMind AI Engineering & Analytics Team  
> **Date:** October 2026  

---

## Table of Contents

1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Target Audiences & UX Modes](#2-target-audiences--ux-modes)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Tactical Intelligence Engine](#4-tactical-intelligence-engine)
   - 4 Core Tactical States (Control, Pressure, Chaos, Swing)
   - Mathematical Formulations & State Triggers
   - Telemetry Metrics (Possession, Pass Quality, Tempo, Territory, xG)
5. [The Decision Lab (Predictive "What-If" Simulation)](#5-the-decision-lab-predictive-what-if-simulation)
   - Decision Actions & Tactical Horizons
   - Scoring Rubric, Risk vs. Reward & Evidence Linkage
6. [Real-Time Streaming Engine (SSE & Ingestion)](#6-real-time-streaming-engine-sse--ingestion)
   - Event Stream Architecture & Scenarios
   - Clock Synchronizer & Replay Buffers
7. [Explainable AI & Multilingual Narrative Studio](#7-explainable-ai--multilingual-narrative-studio)
   - Dual Persona Generation (Analyst vs Fan)
   - Multilingual Engine (English, Spanish, French, Hindi)
   - Explainability & Traceable Grounding
   - LLM Integration (OpenAI GPT-4o-mini + Resilient Offline Fallback)
8. [Broadcast Overlay Studio & Graphic Telemetry](#8-broadcast-overlay-studio--graphic-telemetry)
   - Lower-Thirds, Tactical Banners, Player Spotlight
   - Broadcast Graphic JSON Payloads & On-Air Controller
9. [Performance Lab & Data Science Pipeline](#9-performance-lab--data-science-pipeline)
   - Player Performance Tracking
   - Synthetic Realism Engine & Dataset Export
10. [Technology Stack & Dependency Matrix](#10-technology-stack--dependency-matrix)
11. [Complete Codebase File Manifest](#11-complete-codebase-file-manifest)
12. [API Reference & Contracts](#12-api-reference--contracts)
13. [Step-by-Step Installation & Execution Guide](#13-step-by-step-installation--execution-guide)
    - Option A: Modern React + Vite Studio (MatchMind AI)
    - Option B: Next.js 16 AI Intelligence App (`football-intel`)
    - Option C: Multi-Package Monorepo with Express SSE API Server
    - Option D: Docker & Container Deployment
14. [Azure Cloud Architecture & Production Roadmap](#14-azure-cloud-architecture--production-roadmap)
15. [Suggested Demo & Judging Script](#15-suggested-demo--judging-script)

---

## 1. Executive Summary & Product Vision

**MatchMind AI & Football Match Intelligence** is a dual-tier, state-of-the-art football analytics and broadcast augmentation platform. Designed for Premier League broadcast studios, tactical coaching staffs, and global football fans, the application transforms raw, sub-second match event streams into:

- **Instant Tactical Insight:** Understand the hidden tactical shifts beyond the basic scoreline.
- **Explainable Narratives:** Connect high-level strategic takeaways directly back to granular telemetry events.
- **Predictive Decision Support:** Enable tacticians to run "What-If" simulations during live matches to evaluate tactical adjustments before making substitutions or positional shifts.
- **Broadcast-Ready Telemetry:** Render real-time television lower-thirds, tactical overlays, and social-ready infographics.
- **Global Inclusivity:** Dynamic multilingual narrative generation across 4 global languages (English, Spanish, French, and Hindi).

Rather than reporting *what* happened (e.g., "Pass completed"), MatchMind AI explains *why it matters* (e.g., "Northbridge is forcing a turnover trap in the middle third, shifting the tactical state into High Pressure").

---

## 2. Target Audiences & UX Modes

The user interface adapts dynamically based on who is viewing:

| Persona | Primary Goal | UI Customization & Data Delivery |
| :--- | :--- | :--- |
| **Studio Tactical Analyst** | Deep tactical trends, spatial structures, and data evidence. | High-density metric graphs, xG maps, passing quality indexes, tactical state transition logs, and raw mathematical confidence scores. |
| **Passionate Fan / Casual Viewer** | High-energy, contextual storytelling without academic jargon. | Dynamic emotional narratives, goal probability meters, momentum meters, instant highlight callouts, and simplified explainers. |
| **Broadcast Producer & Director** | Quick-fire television graphics and chyron generation. | Real-time Overlay Lab, lower-third graphic previews, on-air toggle switches, and standard JSON broadcast protocol payloads. |
| **Manager / Tactical Staff** | Live game management and tactical intervention testing. | Decision Lab testing: compare "Press Higher", "Hold Shape", and "Attack Wide" over 3, 5, or 10-minute tactical horizons. |

---

## 3. System Architecture & Data Flow

```
                      +------------------------------------------+
                      |       Raw Match Telemetry / SSE Feed     |
                      |  (Position, Velocity, Events, xG, Zone)  |
                      +--------------------+---------------------+
                                           |
                                           v
                      +--------------------+---------------------+
                      |    MatchMind Ingestion & State Engine    |
                      |  (Calculates Possession, Tempo, Pressure)|
                      +--------------------+---------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+-------------------+-------------------+   +---------------------+-------------------+
|       Tactical State Classifier       |   |       Predictive Decision Lab           |
| (CONTROL / PRESSURE / CHAOS / SWING)  |   | (Simulates 'What-If' Tactical Horizons) |
+-------------------+-------------------+   +---------------------+-------------------+
                    |                                             |
                    +----------------------+----------------------+
                                           |
                                           v
                      +--------------------+---------------------+
                      |       Explainable Insight Synthesizer    |
                      | (Grounds Insights with Event Evidence)   |
                      +--------------------+---------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+-------------------+-------------------+   +---------------------+-------------------+
| Multilingual AI Commentary Engine     |   | Broadcast Graphics Engine               |
| (EN, ES, FR, HI + Analyst/Fan Persona)|   | (Lower-Third, Tactical, Player Overlays)|
+-------------------+-------------------+   +---------------------+-------------------+
                    |                                             |
                    +----------------------+----------------------+
                                           |
                                           v
                      +--------------------+---------------------+
                      | Reactive Studio UI (React 19 / Next.js)  |
                      | - Live Studio          - Decision Lab    |
                      | - Insight Library      - Recaps Timeline |
                      | - Overlay Lab          - Performance Lab |
                      +------------------------------------------+
```

---

## 4. Tactical Intelligence Engine

At the core of the platform is a deterministic, rule-grounded state classifier that continuously computes a 60-second rolling match telemetry snapshot.

### 4.1 The Four Core Tactical States

1. **`CONTROL` (Dominant Structure & Ball Retention)**
   - **Characteristics:** High possession (>58%), high passing accuracy (>84%), stable tempo, low opposition recovery rate.
   - **Tactical Meaning:** One team is dictating match rhythm, recycling possession, and forcing the opposition into a low defensive block.
   - **Narrative Trigger:** Emphasizes patience, spatial stretching, and defensive exhaustion.

2. **`PRESSURE` (High-Intensity Pressing & Turnover Traps)**
   - **Characteristics:** Sustained pressure actions (>68%), ball speeds spiking, final-third spatial concentration, forced long balls.
   - **Tactical Meaning:** Defending team is executing a synchronized counter-press or aggressive pressing trap in the middle or attacking third.
   - **Narrative Trigger:** Highlights vulnerability of the ball-carrier, risk of catastrophic turnover, and physical workload.

3. **`CHAOS` (End-to-End Transitions & High Turnover Volatility)**
   - **Characteristics:** Rapid possession changes (>4 in 90 seconds), high vertical pass distances (>35m), low passing accuracy (<70%), extreme transitional speed.
   - **Tactical Meaning:** Structural breakdown. Both midfields are bypassed; both defensive lines are stretched; game is wide open.
   - **Narrative Trigger:** Highlights heightened xG volatility, counter-attacking peril, and frantic defensive recovery runs.

4. **`SWING` (Momentum Reversal & Shift in Game State)**
   - **Characteristics:** Abrupt shift in territory or possession (>25% swing over 3 minutes), key set-piece or goal scored against the run of play.
   - **Tactical Meaning:** The game's psychological and tactical equilibrium has flipped.
   - **Narrative Trigger:** Focuses on tactical readjustment, tactical timeouts, and psychological resilience.

### 4.2 Derived Telemetry Metrics

- **Possession (%):** Rolling ratio of completed actions per team over window.
- **Pass Quality Index (0 - 100):** Weighted by pass distance, receiver pressure, and zone (Defensive-Third: 1.0x, Middle-Third: 1.2x, Final-Third: 1.6x).
- **Pressing Intensity Index (0 - 100):** Calculated from proximity of defenders to ball-carrier within 1.5 seconds of possession receipt.
- **Match Tempo (actions/min):** Frequency of ball movements, tackles, and shots per rolling minute.
- **Expected Goals (xG):** Shot quality evaluation based on distance to goal, angle, shot speed, and goalkeeper position.

---

## 5. The Decision Lab (Predictive "What-If" Simulation)

The Decision Lab allows coaching staff and studio pundits to test tactical interventions in real-time.

### 5.1 Tactical Actions Tested

1. **`press-higher` (Aggressive High-Block Press):**
   - *Target:* Force immediate turnovers in the opponent's defensive third.
   - *Positive Signals:* Increases Regain Signal and Territory Signal.
   - *Negative Signals:* Spikes Exposure Risk (space behind high defensive line) and Player Workload.

2. **`hold-shape` (Mid-Block Compactness & Rest Defense):**
   - *Target:* Protect central spaces, deny line-breaking passes, preserve energy.
   - *Positive Signals:* Minimizes Exposure Risk, stabilizes Workload.
   - *Negative Signals:* Cedes territory, reduces immediate regain probability.

3. **`attack-wide` (Flank Overloads & Wing Play):**
   - *Target:* Exploit wide channels, stretch opponent backline, generate cut-backs.
   - *Positive Signals:* Boosts final-third entries and cross delivery quality.
   - *Negative Signals:* Leaves fullbacks exposed to rapid counter-attacks down the flanks.

### 5.2 Tactical Horizons

Simulations can be projected over 3 distinct operational horizons:
- **3 Minutes:** Immediate tactical shock & set-piece vulnerability.
- **5 Minutes:** Standard tactical adaptation phase.
- **10 Minutes:** Structural stamina depletion and cumulative exposure.

### 5.3 Transparent Scoring Rubric

Each action outputs a **Fit Score (0-100)** calculated using real match evidence:
$$\text{Fit Score} = w_1 \cdot \text{Regain} + w_2 \cdot \text{Territory} - w_3 \cdot \text{Exposure} - w_4 \cdot \text{Workload}$$
Every score provides a list of **supporting match events** as verifiable proof.

---

## 6. Real-Time Streaming Engine (SSE & Ingestion)

### 6.1 Server-Sent Events (SSE) Protocol

The backend broadcasts event updates over a standard HTTP Server-Sent Events stream:
- **Route:** `GET /matches/match-001/events/stream`
- **Content-Type:** `text/event-stream`
- **Cadence:** Heartbeat / event broadcast every 1,800 ms.
- **Payload Structure:**
  ```json
  {
    "cursor": 42,
    "scenario": "pressure-pulse",
    "event": {
      "id": "evt_42",
      "minute": 18,
      "second": 42,
      "team": "northbridge",
      "player": "Marcus Vance",
      "type": "pressure",
      "zone": "final-third",
      "outcome": "Turnover forced",
      "modelConfidence": 0.94
    },
    "snapshot": {
      "clock": 1122,
      "possession": [64, 36],
      "state": "PRESSURE",
      "insight": { ... }
    }
  }
  ```

### 6.2 Pre-Configured Replay Scenarios

1. **`pressure-pulse`:** Demonstrates synchronized high-pressing waves, sudden turnovers, and defensive recovery sprints.
2. **`rhythm-control`:** Demonstrates structured positional play, high pass completion, spatial dominance, and low turnover frequency.
3. **`open-match`:** Demonstrates high-volatility transitions, continuous counter-attacks, shots, and chaotic end-to-end sequences.

---

## 7. Explainable AI & Multilingual Narrative Studio

### 7.1 Dual Persona Narrative Engine

- **Analyst Persona:**
  > *"Northbridge's PPDA drops to 7.2 as Vance triggers a synchronized midfield press, forcing Riverside into 3 turnovers within 90 seconds. Territory dominance is at 68%."*
- **Fan Persona:**
  > *"Northbridge is suffocating Riverside right now! Marcus Vance is leading the charge, and Riverside can barely escape their own half!"*

### 7.2 Multilingual Engine

Native, culturally authentic football commentary generated in 4 languages:
- **English (EN):** Standard broadcast UK/US commentary.
- **Spanish (ES):** Latin/European broadcast phrasing (*"¡Presión asfixiante de Northbridge!..."*).
- **French (FR):** Detailed tactical phrasing (*"Le pressing haut de Northbridge étouffe la relance adverse..."*).
- **Hindi (HI):** Accessible, energetic Hindi football broadcast commentary (*"नॉर्थब्रिज का ज़बरदस्त दबाव..."*).

### 7.3 Traceable Evidence & Explainability

No insight is a "black box". Each tactical card exposes an **Evidence Bar**:
- Specific match event IDs that triggered the insight.
- Quantitative confidence level (e.g., `Confidence: 94%`).
- Spatial zone tag (e.g., `Final Third (Right Half-Space)`).

### 7.4 OpenAI GPT-4o-mini & Resilient Offline Fallback

The Next.js integration features an AI route (`/api/narrate`):
- Connects to OpenAI (`gpt-4o-mini`) when `OPENAI_API_KEY` is present.
- If offline, unconfigured, or experiencing rate limits, the deterministic rule-based template engine provides seamless, zero-latency commentary without any downtime.

---

## 8. Broadcast Overlay Studio & Graphic Telemetry

The Overlay Lab allows producers to preview and trigger broadcast graphics:

1. **Lower-Third Chyron:**
   - Displays current minute, match score, tactical state tag, and 1-sentence narrative.
2. **Tactical Telestration Banner:**
   - Displays possession breakdown, pressing intensity bar, pass accuracy comparison, and tactical recommendations.
3. **Player Spotlight Card:**
   - Individual player tracking: current speed (km/h), pass completion %, distance covered (km), and xG contribution.
4. **Broadcast Protocol Output:**
   - Single-click copy of JSON payload formatted for direct ingestion into Vizrt, Chyron, or OBS streaming software.

---

## 9. Performance Lab & Data Science Pipeline

- **Speed Tracking:** Real-time velocity telemetry (sprints, jogs, top speed up to 34.8 km/h).
- **Passing Difficulty Model:** Pass success probability based on distance, angle, and defensive pressure.
- **Automated Eventing Confidence:** Simulated computer vision tracking confidence score (e.g., `92% Auto-Detection`).
- **Dataset Export:** Instant download of all match events as structured JSON for post-match pandas / Python data science analysis.

---

## 10. Technology Stack & Dependency Matrix

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework (Studio)** | React 19 + TypeScript + Vite | Ultra-fast, responsive single-page studio control center. |
| **Frontend Framework (Companion)**| Next.js 16 (App Router) | Server-side rendering, AI streaming route handlers. |
| **Styling & Design System** | Tailwind CSS v4 + Vanilla CSS | Glassmorphism, Premier League dark mode aesthetic, vibrant status tones. |
| **UI Components & Primitives** | Radix UI + Lucide Icons | Accessible dialogs, tabs, accordions, tooltips, and crisp iconography. |
| **State Management & Querying** | TanStack React Query + React Hooks | Live streaming synchronization and reactive state caching. |
| **Backend API Server** | Node.js + Express 5 | Server-Sent Events (SSE) broadcaster, scenario controller, health probes. |
| **Validation & Schema** | Zod + drizzle-zod | Strict runtime schema validation for event payloads. |
| **Containerization & IaC** | Docker + Docker Compose + Azure Bicep | One-command reproducible local and cloud deployment. |

---

## 11. Complete Codebase File Manifest

Below is the directory map of the entire project:

```
football-intelligence-suite/
│
├── matchmind/                          # MatchMind AI - Full Premier League Studio
│   ├── artifacts/
│   │   ├── matchmind-ai/               # React 19 + Vite Broadcast Studio
│   │   │   ├── src/
│   │   │   │   ├── App.tsx             # Master Studio component (Live, Decision, Overlay, Recaps)
│   │   │   │   ├── decision.ts         # Decision Lab simulation & scoring algorithms
│   │   │   │   ├── platform.ts         # Azure pipeline services & proof status
│   │   │   │   ├── data.ts             # Core data re-exporter
│   │   │   │   ├── styles.css          # Broadcast control room CSS theme
│   │   │   │   └── main.tsx            # React application entry point
│   │   │   ├── package.json            # Studio dependencies
│   │   │   └── vite.config.ts          # Vite build & proxy configuration
│   │   │
│   │   └── api-server/                 # Express 5 SSE Event Engine
│   │       ├── src/
│   │       │   ├── routes/
│   │       │   │   ├── matchmind.ts    # SSE event stream & scenario routes
│   │       │   │   └── health.ts       # Health & Azure readiness checks
│   │       │   ├── lib/
│   │       │   │   ├── replay.ts       # Simulation clock & event broadcaster
│   │       │   │   └── azure.ts        # Azure Event Hubs / Cosmos adapters
│   │       │   ├── app.ts              # Express application configuration
│   │       │   └── index.ts            # Server entry point
│   │       └── package.json            # API server dependencies
│   │
│   ├── lib/
│   │   └── matchmind/                  # Shared Domain Logic & Telemetry Engine
│   │       └── src/
│   │           └── index.ts            # Event generator, tactical state classifier, snapshot builder
│   │
│   ├── infra/
│   │   └── azure/
│   │       └── main.bicep              # Azure Infrastructure-as-Code template
│   │
│   ├── package.json                    # Monorepo root configuration
│   ├── pnpm-workspace.yaml             # pnpm workspace definition
│   └── compose.yaml                    # Docker Compose orchestrator
│
├── football-intel/                     # Next.js 16 AI Commentator Companion App
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/narrate/route.ts    # OpenAI GPT-4o-mini commentary API endpoint
│   │   │   ├── page.tsx                # Interactive match viewer & telemetry dashboard
│   │   │   ├── layout.tsx              # Root HTML layout & fonts
│   │   │   └── globals.css             # Tailwind base styles
│   │   └── lib/
│   │       ├── events.ts               # Sub-second football event simulator
│   │       ├── stats.ts                # Player & team statistics aggregation engine
│   │       ├── insights.ts             # Tactical explainability generator
│   │       └── types.ts                # TypeScript interface definitions
│   ├── package.json                    # Next.js package config
│   ├── tsconfig.json                   # TypeScript config
│   └── next.config.js                  # Next.js runtime configuration
│
└── FOOTBALL_APP_DOCUMENTATION.md       # Master specification (this document)
```

---

## 12. API Reference & Contracts

### 1. Match Stream (Server-Sent Events)
- **Endpoint:** `GET /api/matches/match-001/events/stream`
- **Description:** Real-time push stream of match telemetry and tactical snapshots.
- **Headers:** `Accept: text/event-stream`, `Cache-Control: no-store`

### 2. Match Snapshot
- **Endpoint:** `GET /api/matches/match-001`
- **Response:**
  ```json
  {
    "cursor": 34,
    "scenario": "pressure-pulse",
    "event": { "type": "pass", "player": "Haaland", ... },
    "snapshot": { "clock": 980, "possession": [54, 46], "state": "CONTROL" }
  }
  ```

### 3. Scenario Controller
- **Endpoint:** `POST /api/replay/reset?scenario={pressure-pulse|rhythm-control|open-match}`
- **Description:** Resets match clock and swaps tactical replay scenario.

### 4. AI Commentary Endpoint
- **Endpoint:** `POST /api/narrate` (in `football-intel`)
- **Body:**
  ```json
  {
    "events": [ ... ],
    "state": { "homeScore": 1, "awayScore": 0, "minute": 23 },
    "mode": "analyst",
    "language": "en"
  }
  ```
- **Response:**
  ```json
  {
    "narrative": "Manchester City's sustained ball retention in the final third creates an overload...",
    "type": "play_by_play"
  }
  ```

### 5. Health & Cloud Readiness
- **Endpoint:** `GET /api/ready`
- **Response:**
  ```json
  {
    "ready": true,
    "service": "matchmind-event-engine",
    "integrations": {
      "eventHubs": false,
      "foundry": false,
      "cosmos": false,
      "fabric": false
    }
  }
  ```

---

## 13. Step-by-Step Installation & Execution Guide

### Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **Package Manager:** `npm` or `pnpm` (Docker is optional)

---

### Option A: Running MatchMind AI Broadcast Studio (Vite + React 19)

1. Open your terminal in the `matchmind` directory:
   ```bash
   cd matchmind/artifacts/matchmind-ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open your browser at:
   ```
   http://localhost:5173
   ```
   *You can now switch between Live Studio, Decision Lab, Insight Library, Match Recaps, Overlay Lab, Cloud Pipeline, and Performance Lab!*

---

### Option B: Running the Next.js 16 AI Commentator App (`football-intel`)

1. Open your terminal in the `football-intel` directory:
   ```bash
   cd football-intel
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Set your OpenAI API key for live GPT-4o-mini commentary:
   ```bash
   # On Windows PowerShell
   $env:OPENAI_API_KEY="your-api-key-here"
   # On Linux/macOS
   export OPENAI_API_KEY="your-api-key-here"
   ```
   *(Note: The app runs 100% smoothly without an API key using the built-in deterministic fallback engine!)*
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open your browser at:
   ```
   http://localhost:3005
   ```

---

### Option C: Running the Full Monorepo (Frontend Studio + SSE API Server)

1. In the `matchmind` root directory:
   ```bash
   pnpm install
   ```
2. Start both the API Server and Studio:
   ```bash
   # Terminal 1: API Server (port 5000)
   pnpm --filter @workspace/api-server run dev

   # Terminal 2: Web Studio
   pnpm --filter @workspace/matchmind-ai run dev
   ```

---

### Option D: Running via Docker Compose

If Docker Desktop is installed:
```bash
cd matchmind
docker compose up --build
```
The unified container builds and serves both the client app and the synthetic API stream on `http://localhost:8787`.

---

## 14. Azure Cloud Architecture & Production Roadmap

MatchMind AI is architected from day one for seamless cloud deployment on Microsoft Azure:

| Component | Local Proof | Target Azure Service |
| :--- | :--- | :--- |
| **Telemetry Ingestion** | Synthetic SSE Engine | **Azure Event Hubs** (Sub-second event stream partitioning) |
| **State & Metric Processing** | TypeScript State Reducer | **Azure Functions** & **Microsoft Fabric** (Real-time analytics) |
| **AI Insights & Translation**| Deterministic Engine | **Microsoft Foundry** & **Azure AI Services** (GPT-4o fine-tuned) |
| **State Persistence** | In-memory replay buffer | **Azure Cosmos DB** (Serverless document storage) |
| **Grounding & Search** | Structured evidence arrays | **Azure AI Search** (Vector & semantic event retrieval) |
| **Application Hosting** | Vite / Node HTTP | **Azure Container Apps** (Autoscaling container clusters) |

The included `infra/azure/main.bicep` script provides full Infrastructure-as-Code to provision this cloud architecture with a single CLI command:
```bash
az deployment group create --resource-group MatchMind-RG --template-file infra/azure/main.bicep
```

---

## 15. Suggested Demo & Judging Script

For hackathon presentations or executive demonstrations, follow this sequence:

1. **The Hook (Live Studio):**
   - Open Live Studio. Hit **Play**.
   - Show sub-second event telemetry streaming in (passes, tackles, pressure pulses).
   - Point out the **Tactical State badge** transitioning between `CONTROL` and `PRESSURE`.
2. **Explainability in Action:**
   - Click on an Insight card.
   - Show the **Evidence Bar** — highlight how the insight cites exact match minutes and event IDs rather than guessing.
3. **The "What-If" Decision Lab:**
   - Navigate to the **Decision Lab**.
   - Select `"Press Higher"` vs `"Hold Shape"`. Change horizon from 3 min to 10 min.
   - Show how the **Exposure Risk** and **Workload** scores adapt dynamically with supporting event proof.
4. **Multilingual & Personalization:**
   - Switch language to **Spanish**, **French**, or **Hindi**.
   - Toggle persona from **Analyst** to **Fan** — demonstrate how tone shifts from statistical rigor to emotional stadium excitement.
5. **Broadcast Readiness (Overlay Lab):**
   - Open **Overlay Lab**. Toggle **Lower-Third** and **Tactical Telestration**.
   - Hit **"Copy Broadcast Payload"** to demonstrate integration readiness with live TV production switchers.
6. **Cloud Architecture (Pipeline View):**
   - Click on **Cloud Pipeline** to show the Azure Event Hubs, Foundry, Cosmos DB, and Fabric integration blueprint.

---

*MatchMind AI — Transforming Live Match Telemetry into Strategic Clarity.*
