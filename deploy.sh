#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy TikZ AI Node.js backend to IBM Cloud Code Engine
# Usage: cd latex-diagram-gen && bash deploy.sh
# Prerequisites: ibmcloud CLI, code-engine plugin, .env filled in
# =============================================================================
set -e

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  echo "▶ Loading credentials from .env..."
  set -o allexport
  source .env
  set +o allexport
elif [ -f "env.template" ]; then
  echo "✗ ERROR: .env not found. Run: cp env.template .env  then fill in the values."
  exit 1
else
  echo "✗ ERROR: No .env or env.template found."
  exit 1
fi

# ── Validate required vars ────────────────────────────────────────────────────
: "${IBM_API_KEY:?IBM_API_KEY must be set in .env}"
: "${ORCHESTRATE_INSTANCE_ID:?ORCHESTRATE_INSTANCE_ID must be set in .env}"
: "${AGENT_ID:?AGENT_ID must be set in .env}"

REGION="${IBM_REGION:-eu-de}"
APP_NAME="${APP_NAME:-tikzai}"
RESOURCE_GROUP="${IBM_RESOURCE_GROUP:-Default}"

echo ""
echo "=========================================="
echo "  TikZ AI — IBM Code Engine Deploy"
echo "  App:     $APP_NAME"
echo "  Region:  $REGION (Frankfurt)"
echo "=========================================="

# ── Step 1: Login ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 1: Logging into IBM Cloud..."
ibmcloud login --apikey "$IBM_API_KEY" -r "$REGION" -g "$RESOURCE_GROUP" -q

# ── Step 2: Install plugins ───────────────────────────────────────────────────
echo ""
echo "▶ Step 2: Ensuring Code Engine plugin is installed..."
ibmcloud plugin install code-engine -f -q 2>/dev/null || true
ibmcloud plugin install container-registry -f -q 2>/dev/null || true

# ── Step 3: Create or select Code Engine project ─────────────────────────────
echo ""
echo "▶ Step 3: Targeting Code Engine project..."
ibmcloud ce project create --name "$APP_NAME" 2>/dev/null || \
  ibmcloud ce project select --name "$APP_NAME"

# ── Step 4: Create secret with all credentials ───────────────────────────────
echo ""
echo "▶ Step 4: Storing credentials as Code Engine secret..."
ibmcloud ce secret create \
  --name "${APP_NAME}-creds" \
  --from-literal IBM_API_KEY="$IBM_API_KEY" \
  --from-literal ORCHESTRATE_INSTANCE_ID="$ORCHESTRATE_INSTANCE_ID" \
  --from-literal AGENT_ID="$AGENT_ID" \
  --from-literal ORCHESTRATE_URL="${ORCHESTRATE_URL:-https://api.eu-de.assistant.watson.cloud.ibm.com}" \
  2>/dev/null || \
ibmcloud ce secret update \
  --name "${APP_NAME}-creds" \
  --from-literal IBM_API_KEY="$IBM_API_KEY" \
  --from-literal ORCHESTRATE_INSTANCE_ID="$ORCHESTRATE_INSTANCE_ID" \
  --from-literal AGENT_ID="$AGENT_ID" \
  --from-literal ORCHESTRATE_URL="${ORCHESTRATE_URL:-https://api.eu-de.assistant.watson.cloud.ibm.com}"

# ── Step 5: Deploy app from GitHub (buildpacks auto-detect Node.js) ──────────
echo ""
echo "▶ Step 5: Deploying Node.js app to Code Engine..."
echo "   (Code Engine will auto-detect Node.js via package.json)"

ibmcloud ce app create \
  --name "$APP_NAME" \
  --build-source . \
  --build-strategy buildpacks \
  --port 3000 \
  --min-scale 0 \
  --max-scale 1 \
  --env-from-secret "${APP_NAME}-creds" \
  --env PORT=3000 \
  2>/dev/null || \
ibmcloud ce app update \
  --name "$APP_NAME" \
  --build-source . \
  --build-strategy buildpacks \
  --port 3000 \
  --env-from-secret "${APP_NAME}-creds"

# ── Step 6: Get app URL ───────────────────────────────────────────────────────
echo ""
echo "▶ Step 6: Getting deployed app URL..."
APP_URL=$(ibmcloud ce app get --name "$APP_NAME" --output json 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',{}).get('url','Check IBM Console'))" \
  2>/dev/null || echo "Check: https://cloud.ibm.com/codeengine/projects")

echo ""
echo "=========================================="
echo "  ✓ Deployment Complete!"
echo "  App URL:     $APP_URL"
echo "  IBM Console: https://cloud.ibm.com/codeengine/projects"
echo "=========================================="
