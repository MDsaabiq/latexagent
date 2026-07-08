# ⬡ TikZ AI — AI-Powered LaTeX Diagram Generator

> Type a description in plain English → get production-ready LaTeX TikZ code in seconds.
> Powered by **IBM Granite-4** via **IBM Watson Machine Learning**, with your agent visible and tweakable in **IBM watsonx Orchestrate**.

---

## What it does

You describe a diagram in plain English. The app calls IBM Granite AI, which returns clean, valid LaTeX TikZ code you can paste directly into Overleaf or any LaTeX editor.

**Supported diagram types:**
- Flowcharts
- Neural Networks
- Block Diagrams
- Graphs / Trees
- State Machines
- Sequence Diagrams

---

## Quick Start (3 steps)

### 1. Fill in your credentials

Open `.env` and set these values:

```env
IBM_API_KEY=your-ibm-cloud-api-key
WML_PROJECT_ID=your-watson-studio-project-uuid
ORCHESTRATE_INSTANCE_ID=4e8347a4-1eeb-401e-bf86-67ab836dda4d
AGENT_ID=2b603010-b791-4933-ba16-dbc9c953b4fb
WML_URL=https://eu-de.ml.cloud.ibm.com
PORT=3000
```

| Variable | Where to find it |
|----------|-----------------|
| `IBM_API_KEY` | [cloud.ibm.com](https://cloud.ibm.com) → Manage → IAM → API Keys |
| `WML_PROJECT_ID` | [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com) → your project → Manage tab → Project ID |
| `ORCHESTRATE_INSTANCE_ID` | Already set — your watsonx Orchestrate instance GUID |
| `AGENT_ID` | Already set — your LaTeX Diagram Generator Agent ID |

### 2. Start the server

```bash
node server.js
```

### 3. Open the app

```
http://localhost:3000
```

The status bar turns **green** when everything is connected.

---

## How to use

1. **Pick a diagram type** — Flowchart, Neural Network, Block Diagram, etc.
2. **Describe your diagram** — plain English, e.g.:
   > *"A flowchart: Data Collection → Preprocessing → Model Training → Evaluation → if accuracy > 90% deploy, else retrain"*
3. **Add style hints** (optional) — e.g. *"rounded rectangles, IBM blue, thick arrows"*
4. **Click ⚡ Generate** — code appears in ~5 seconds
5. **Copy / Download / Open in Overleaf** — one-click buttons

---

## Architecture

```
Browser (index.html)
  │
  └─ POST /api/chat
       │
       └─ server.js (Node.js — no npm dependencies)
            │
            ├─ IBM IAM → Bearer token
            │
            └─ IBM Watson Machine Learning
                 └─ ibm/granite-4-h-small
                      └─ TikZ code → browser
```

The **LaTeX Diagram Generator Agent** in your IBM watsonx Orchestrate console uses the identical system prompt — you can tweak it there at any time without restarting the server.

---

## Files

```
latex-diagram-gen/
├── server.js          ← Node.js backend (zero npm dependencies)
├── index.html         ← Web UI
├── package.json       ← Project config
├── .env               ← Your credentials (never commit this)
├── deploy.sh          ← Deploy to IBM Code Engine
└── terraform/         ← Provision IBM Cloud services (optional)
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    └── terraform.tfvars
```

---

## Deploy to IBM Cloud (optional)

```bash
bash deploy.sh
```

Deploys the Node.js app to **IBM Code Engine** using buildpacks. Requires IBM Cloud CLI.

---

## IBM Services Used

| Service | Purpose |
|---------|---------|
| IBM Watson Machine Learning | Runs Granite-4 model inference |
| IBM Granite-4 (`ibm/granite-4-h-small`) | Generates the TikZ code |
| IBM Cloud IAM | API key authentication |
| IBM watsonx Orchestrate | Agent UI — view and tweak the system prompt |

---

## Example output

Input:
> *"3 boxes vertically: Input Data → Granite LLM Processing → Output LaTeX"*

Output:
```latex
\documentclass{standalone}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,shapes.geometric,positioning}
\begin{document}
\begin{tikzpicture}[node distance=2cm]
\node (input) [rectangle, draw, minimum width=3cm] {Input Data};
\node (process) [rectangle, draw, below of=input] {Granite LLM Processing};
\node (output) [rectangle, draw, below of=process] {Output LaTeX};
\draw [->] (input) -- (process);
\draw [->] (process) -- (output);
\end{tikzpicture}
\end{document}
```

Paste into [Overleaf](https://overleaf.com) → compile → instant PDF diagram.

---

*IBM watsonx Hackathon — Problem Statement #26 | Shaik Saabiq*
