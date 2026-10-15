# BloodStock: Time-Aware Allocation of Perishable Blood Components

> **Architecture, Optimization Formulation, and 36-Hour Hackathon Implementation Plan**  
> *Target: Code-e-Manipal 2.0 (Track 02 — HealthTech)*  
> *Synthetic simulation only — Not a clinical decision-making or transfusion authorization system.*

---

## Executive Summary & System Conception

**BloodStock** is an explainable decision-support and time-aware simulation platform designed to solve the critical logistics bottleneck in multi-hospital blood banking. Blood components—particularly platelets (which expire in ~5–7 days) and red blood cells (42 days)—are highly perishable biological resources. When an urgent request occurs at Hospital A, stock may exist at Hospital B or C, but simple proximity is insufficient:
1. A closer hospital's unit may expire *before or during transit*.
2. A unit may be biologically incompatible under configured ABO/Rh compatibility rules.
3. The unit may already be reserved for an in-progress patient surgery.
4. Transferring the unit may dangerously deplete the source hospital below its protected emergency safety reserve.

BloodStock combines a **feasibility sieve**, an **exact mathematical solver (Google OR-Tools CP-SAT)**, a **nearest-available baseline heuristic**, and an **explainable rule engine** to compare outcomes, explain every accepted and rejected unit with plain-language causal reasoning, and simulate dynamic operational disruptions (transport failures, demand spikes, stock arrivals, cancellations) without double-allocation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BLOODSTOCK PLATFORM                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
       ┌──────────────────────────────┴──────────────────────────────┐
       ▼                                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  React 19 + Tailwind Client  │              │   Node.js / Express Server   │
│  - Hospital Admin View       │ ◄──────────► │   - REST API & Data Store    │
│  - Requesting Clinician View │  (JSON/REST) │   - Feasibility Sieve        │
│  - Dispatch & Network Map    │              │   - Nearest-Baseline Engine  │
│  - Baseline vs Solver Radar  │              │   - Safe Reservation Manager │
│  - Scenario Control Sandbox  │              │   - Concurrency Lock & Audit │
└──────────────────────────────┘              └──────────────┬───────────────┘
                                                             │ (Internal API)
                                                             ▼
                                              ┌──────────────────────────────┐
                                              │   Optimization Engine        │
                                              │   - Google OR-Tools CP-SAT   │
                                              │   - Multi-Objective ILP      │
                                              │   - Hard Constraint Enforcer │
                                              │   - Rejection Cause Logger   │
                                              └──────────────────────────────┘
```

---

## 1. Problem Statement Requirements Breakdown

### Mandatory Requirements
- **Multi-Hospital Inventory Simulation**: Model at least 5–8 synthetic hospitals, 60–100 individual blood units, and 10–20 requests with unique IDs, coordinates, component types, expiry timestamps, and transit times.
- **Hard Constraints Enforcement**: Zero tolerance for double-allocation, expiry violations during transit, biological incompatibility, delivery deadline misses, or breaching source hospital protected minimum stocks.
- **Dual Engine Implementation**: 
  1. *Baseline Heuristic*: Simple greedy nearest-available search.
  2. *Constraint Optimization Model*: Google OR-Tools CP-SAT multi-objective integer solver.
- **Comparative Metrics**: Total demand fulfilled, urgent demand fulfilled, average/total transit minutes, wasted/expired units avoided, and rejected transfer counts.
- **Transparent Explainability**: Every recommendation and every rejected candidate must return structured diagnostic reasons (e.g., *"Rejected: Estimated transit 45m + 30m handling buffer arrives at T+75m, exceeding unit expiration at T+60m"*).
- **Safe Reservation Lifecycle**: Two-phase proposal & commit cycle (`AVAILABLE` → `RESERVED` → `IN_TRANSIT` → `RECEIVED`), with atomic locking to prevent race conditions during replanning.
- **9 Deterministic Demonstration Scenarios**: Preset scenarios (A through I) demonstrating stock sharing, transit expiration rejections, concurrent demand rivalry, transport breakdown, cancellations, and infeasible demand.

### Suggestions vs Mandatory Guardrails
- **Mandatory**: Purely synthetic data; prominent disclaimer that this is a planning simulator, not a clinical diagnostic or transfusion authorization system.
- **Suggestion**: Use an embedded microservice architecture where Node.js spawns/calls the Python CP-SAT solver via a clean JSON CLI or REST bridge, with an immediate pure-TypeScript fallback solver to guarantee 100% zero-downtime execution in any judge's sandbox.

---

## 2. Core Mathematical Optimization Formulation

We model the allocation as a **Bipartite Multi-Commodity Matching Problem with Time Windows and Capacity Constraints**.

### Indices & Sets
- $R$: Set of active pending blood requests $r \in R$, each with component type $c_r$, required group $g_r$, requested units $D_r$, delivery deadline $T^{\text{dl}}_r$, urgency weight $W_r$, and destination hospital $H_r$.
- $U$: Set of candidate synthetic blood units $u \in U$, located at source hospital $S_u$, with component type $c_u$, group $g_u$, expiration timestamp $T^{\text{exp}}_u$, and reserve status.
- $H$: Set of fictional hospitals $h \in H$, each with protected safety reserve $P_{h,c}$ for component $c$.
- $\tau(S_u, H_r)$: Simulated travel time from hospital $S_u$ to $H_r$, plus handling/thawing buffer $\delta$.

### Decision Variables
- Binary variable $x_{u,r} \in \{0, 1\}$: Equals $1$ if unit $u$ is allocated to request $r$, $0$ otherwise.
- Slack variable $s_r \ge 0$: Integer unmet quantity for request $r$.

### Hard Constraints (Never Relaxed)
1. **Unit Uniqueness (No Double Allocation)**:
   $$\sum_{r \in R} x_{u,r} \le 1 \quad \forall u \in U$$
2. **Demand Upper Bound**:
   $$\sum_{u \in U} x_{u,r} + s_r = D_r \quad \forall r \in R$$
3. **Biological & Component Compatibility**:
   $$x_{u,r} = 0 \quad \text{if } \text{Compatible}(g_u, g_r) = \text{False or } c_u \ne c_r$$
4. **Time-Aware Expiration & Delivery Window**:
   $$x_{u,r} = 0 \quad \text{if } t_{\text{now}} + \tau(S_u, H_r) > \min(T^{\text{exp}}_u, T^{\text{dl}}_r)$$
5. **Protected Hospital Safety Reserve**:
   $$\sum_{u \in U : S_u = h, c_u = c} \left(1 - \sum_{r \in R : H_r \ne h} x_{u,r}\right) \ge P_{h,c} \quad \forall h \in H, c \in C$$
6. **Existing Confirmed Reservations**:
   $$x_{u,r} = 0 \quad \forall u \text{ with status } \ne \text{'AVAILABLE'}$$

### Objective Function (Hierarchical Lexicographic Optimization)
$$\text{Maximize } Z = \sum_{r \in R} \left[ 10^5 \cdot W_r \cdot (D_r - s_r) \right] - \sum_{u,r} \left[ 10^2 \cdot \tau(S_u, H_r) \cdot x_{u,r} \right] - \sum_{u,r} \left[ 10 \cdot (T^{\text{exp}}_u - t_{\text{now}}) \cdot x_{u,r} \right]$$
- **Tier 1 ($10^5$)**: Maximize fulfilled demand, scaled by clinical urgency ($W_r = 10$ for Critical, $5$ for Urgent, $1$ for Routine).
- **Tier 2 ($10^2$)**: Minimize total transit time (faster delivery, fresher arrival).
- **Tier 3 ($10^1$)**: Issue units closest to expiration first (FEFO: First Expired, First Out) to minimize network-wide blood spoilage, provided they safely reach the destination before expiring.

---

## 3. Database & Entity Relational Schema

```
┌────────────────────┐            ┌────────────────────┐
│     hospitals      │ 1        * │    blood_units     │
├────────────────────┤────────────├────────────────────┤
│ id (PK)            │            │ id (PK)            │
│ name               │            │ hospital_id (FK)   │
│ latitude           │            │ component_type     │
│ longitude          │            │ blood_group        │
│ protected_reserves │            │ expires_at         │
└────────────────────┘            │ status             │
         │ 1                      │ handling_buffer_m  │
         │                        └────────────────────┘
         │                                   │ 1
         │ *                                 │
┌────────────────────┐                       │ *
│   blood_requests   │ 1          * ┌────────────────────┐
├────────────────────┤──────────────├──── reservations   │
│ id (PK)            │              ├────────────────────┤
│ hospital_id (FK)   │              │ id (PK)            │
│ component_type     │              │ unit_id (FK)       │
│ blood_group        │              │ request_id (FK)    │
│ quantity           │              │ status             │
│ urgency            │              │ created_at         │
│ deadline_at        │              │ locked_until       │
│ status             │              └────────────────────┘
└────────────────────┘                         │ 1
         │ 1                                   │
         │                                     │ 1
         │ *                                   ▼
┌────────────────────┐              ┌────────────────────┐
│  allocation_runs   │ 1          * │     transfers      │
├────────────────────┤──────────────├────────────────────┤
│ id (PK)            │              │ id (PK)            │
│ mode (opt/base)    │              │ reservation_id(FK) │
│ solver_status      │              │ source_hosp_id(FK) │
│ runtime_ms         │              │ dest_hosp_id (FK)  │
│ metrics_summary    │              │ eta_at             │
└────────────────────┘              │ transfer_status    │
                                    └────────────────────┘
```

- **`hospitals`**: Simulated facilities, geographic coordinates, and component minimum stock thresholds.
- **`blood_units`**: Discrete synthetic blood units with component (`PRBC`, `Platelets`, `FFP`, `Cryoprecipitate`), ABO/Rh, precise expiry timestamp, and status (`AVAILABLE`, `RESERVED`, `IN_TRANSIT`, `RECEIVED`, `EXPIRED`, `DISCARDED`).
- **`blood_requests`**: Requests with urgency (`CRITICAL_TRAUMA`, `URGENT_SURGERY`, `ROUTINE`), component, quantity, and strict delivery deadline.
- **`reservations`**: Two-phase reservation links with transactional locking and lease expiry.
- **`transfers`**: Simulated physical dispatches with travel state machine (`DISPATCHED` $\to$ `IN_TRANSIT` $\to$ `DELIVERED` or `FAILED`).
- **`allocation_runs` & `allocation_logs`**: Full audit trail recording why each unit was selected or rejected.

---

## 4. User Experience & Scientific Interface Architecture

Following the **Universal Frontend Design Constitution** and **Science & Biotech Design Reference**:
- **Palette**: Clean clinical slate (`bg-slate-50`, structural panels `bg-white`, borders `border-slate-200`), with Cobalt (`#2563EB`) as primary interactive accent and Crimson (`#DC2626`) strictly for critical/urgency markers.
- **Anti-Slop Discipline**: No decorative pulsing dots, no floating marketing pills, no code-comment titles. All metadata rendered as clean unboxed text with `·` dividers and `font-mono tabular-nums`.
- **Three-Zone Top Bar**: Single wordmark (`BloodStock`), concise navigation (`Network Overview`, `Allocation Studio`, `Scenario Sandbox`, `Audit Logs`), and one primary action (`New Request`).
- **Interactive Views**:
  1. **Network Map & Stock Matrix**: Visual map of fictional hospitals connected by simulated transit corridors with travel-time arcs and real-time inventory levels.
  2. **Allocation Engine Studio**: Side-by-side run of **OR-Tools Optimizer** vs. **Nearest-Available Baseline**, with interactive Recharts showing demand fulfillment, transit time, and spoilage prevention.
  3. **Explainability Inspector**: Expandable breakdown of every unit evaluated, showing passing checks and exact rejection causes.
  4. **Scenario Control Sandbox**: 1-click trigger cards for Scenarios A through I to demonstrate resilience live to judges.

---

## 5. 36-Hour Hackathon Implementation Roadmap (3 Developers)

| Time Window | Dev 1: Optimization & Algorithms | Dev 2: Backend, State & Simulation | Dev 3: Frontend & Visualization |
| :--- | :--- | :--- | :--- |
| **Hours 0–8** *(Foundation)* | Implement compatibility matrix, time-window logic, and OR-Tools CP-SAT formulation + baseline heuristic. | Setup Express server, synthetic dataset generator (8 hospitals, 80 units, 15 requests), and in-memory schema. | Setup React layout, Top Bar, Hospital Stock Matrix, and Request creation modal. |
| **Hours 8–18** *(Core Logic)* | Integrate solver with rejection cause diagnostic engine; generate structured explanations for every candidate. | Build REST endpoints: `/api/optimize`, `/api/baseline`, `/api/commit-reservation`, `/api/scenarios`. | Build Dual-Engine Comparison Studio with Recharts (Fulfillment vs Transit vs Wastage). |
| **Hours 18–28** *(Reactivity & Scenarios)*| Implement dynamic replanning on inventory change and safe reservation state preservation. | Implement the 9 test scenarios (transport failure, stock arrival, cancellations, demand surge) and safety lock. | Build Scenario Sandbox with live event triggers and transit state machine visualization. |
| **Hours 28–34** *(Hardening & Audit)* | Add unit tests for constraint non-violation (zero double-allocation, zero expiry violations). | Persist allocation logs, execution history, and audit export (JSON/CSV). | Refine UI typography, tabular numbers, explainability cards, and empty/loading states. |
| **Hours 34–36** *(Rehearsal & Polish)* | Verify edge cases (infeasible demand, simultaneous expiry). | Final end-to-end integration run-through and latency benchmarking. | Pitch deck alignment, demo script walk-through, and UI presentation polish. |

---

## 6. High-Risk Technical Challenges & Verification Protocol

1. **Double-Allocation Under Concurrent Requests**:
   - *Risk*: Two simultaneous requests or rapid replanning allocating the same blood unit.
   - *Defense & Test*: Two-phase transaction lock. Unit tests simulating parallel allocation calls asserting zero duplicate unit IDs across active reservations.
2. **Expiry During Transit Edge Case**:
   - *Risk*: A unit arrives with 2 minutes remaining, rendering it clinically unusable by the time it reaches the patient bedside.
   - *Defense & Test*: Hard handling buffer ($\delta = 30\text{ min}$) added to transit time. Units with $T^{\text{exp}} < t_{\text{now}} + \tau + \delta$ are hard-rejected by the feasibility sieve before entering the solver.
3. **Solver Latency & Sandbox Failure**:
   - *Risk*: Judge environment without Python OR-Tools or solver timeout under large request bursts.
   - *Defense & Test*: Set a 2000ms CP-SAT search timeout; pair with a high-performance pure-TypeScript constraint propagation solver fallback that executes identically in any browser or Node.js environment.
4. **Invalidating Confirmed Reservations During Replanning**:
   - *Risk*: Replanning reshuffles units already in transit or promised to surgical teams.
   - *Defense & Test*: Pin confirmed units as immovable boundary conditions in the CP-SAT model. Only uncommitted candidate units are subject to reallocation.
5. **Explainability Drift**:
   - *Risk*: Optimization engine picks an optimal unit, but the textual explanation invents reasons that do not match the mathematical objective.
   - *Defense & Test*: Deterministic constraint audit logs generated directly from the solver's dual values, slack variables, and pre-solve rejection filters.
