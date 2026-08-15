const PIPELINE_STAGES = ["install", "lint", "test", "build", "deploy", "docker", "scan", "publish"];
const COMMON_ACTIONS = [
  "actions/checkout", "actions/setup-node", "actions/setup-python", "actions/setup-java",
  "actions/cache", "actions/upload-artifact", "actions/download-artifact",
  "docker/build-push-action", "docker/login-action",
];

const SECRET_PATTERNS: RegExp[] = [
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(AKIA[A-Z0-9]{16})\b/g,
  /\b(ghp_[a-zA-Z0-9]{36})\b/g,
  /\b(github_token|GITHUB_TOKEN|api_key|API_KEY|secret|SECRET|password|PASSWORD|token|TOKEN)\s*[:=]\s*["']?[^\s"']{8,}/gi,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
];

const VULNERABLE_ACTIONS = [
  { action: "actions/checkout@v1", issue: "Uses outdated checkout action (v1)", severity: "medium" },
  { action: "actions/checkout@v2", issue: "Uses outdated checkout action (v2)", severity: "low" },
  { action: "actions/checkout", issue: "Checkout without pinned version", severity: "medium" },
  { action: "pull_request_target", issue: "pull_request_target with checkout - potential code injection", severity: "high" },
  { action: "actions/github-script", issue: "github-script with untrusted input - potential injection", severity: "medium" },
];

function detectStages(yamlContent: string): { stages: string[]; dependencies: Record<string, string[]>; parallelGroups: string[][] } {
  const stages: string[] = [];
  const dependencies: Record<string, string[]> = {};

  const stagePatterns = [
    /\b(install|setup)(?:[_-](?:deps|dependencies|packages))?\b/gi,
    /\b(lint|eslint|prettier|check|format)\b/gi,
    /\b(test|tests|jest|vitest|mocha|pytest|unit[_-]test)\b/gi,
    /\b(build|compile|transpile|bundle)\b/gi,
    /\b(deploy|release|publish|ship)\b/gi,
    /\b(docker|container|image)\b/gi,
    /\b(scan|security|audit|sast|dast)\b/gi,
  ];

  const lower = yamlContent.toLowerCase();
  for (const pattern of stagePatterns) {
    if (pattern.test(lower)) {
      const stageName = pattern.source.split("|")[0].replace(/\\b/g, "");
      if (!stages.includes(stageName)) stages.push(stageName);
    }
  }

  const needsPattern = /needs:\s*(?:\[([^\]]+)\]|(\S+))/gi;
  let match;
  while ((match = needsPattern.exec(yamlContent)) !== null) {
    const deps = match[1] ? match[1].split(",").map(s => s.trim()) : [match[2]];
    const jobPattern = /(\w+):\s*\n\s+needs:/gi;
    const jobMatch = jobPattern.exec(yamlContent);
    if (jobMatch) {
      dependencies[jobMatch[1]] = deps;
    }
  }

  const parallelGroups: string[][] = [];
  if (stages.includes("lint") && stages.includes("test")) {
    parallelGroups.push(["lint", "test"]);
  }

  return { stages, dependencies, parallelGroups };
}

function detectParallelizationOpportunities(stages: string[], dependencies: Record<string, string[]>): { opportunities: string[]; estimatedSpeedup: number } {
  const opportunities: string[] = [];

  if (stages.includes("lint") && stages.includes("test") && !dependencies["test"]?.includes("lint")) {
    opportunities.push("Lint and test can run in parallel (no dependency)");
  }

  if (stages.includes("install")) {
    opportunities.push("Cache node_modules/pip to skip install step on cache hit");
  }

  if (stages.includes("build") && stages.includes("docker")) {
    opportunities.push("Consider combining build and docker stages to reduce context switches");
  }

  if (stages.includes("deploy") && stages.includes("scan")) {
    opportunities.push("Security scan can run in parallel with deployment preparation");
  }

  const estimatedSpeedup = 1 + (opportunities.length * 0.15);
  return { opportunities, estimatedSpeedup: Math.round(estimatedSpeedup * 100) / 100 };
}

function detectSecurityIssues(yamlContent: string): { issues: { severity: string; description: string; line: number }[] } {
  const issues: { severity: string; description: string; line: number }[] = [];

  const lines = yamlContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SECRET_PATTERNS) {
      const matches = line.match(pattern);
      if (matches) {
        issues.push({
          severity: "critical",
          description: `Potential secret detected: ${matches[0].slice(0, 20)}...`,
          line: i + 1,
        });
      }
    }
  }

  for (const vuln of VULNERABLE_ACTIONS) {
    if (yamlContent.includes(vuln.action)) {
      issues.push({
        severity: vuln.severity,
        description: vuln.issue,
        line: lines.findIndex(l => l.includes(vuln.action)) + 1,
      });
    }
  }

  if (yamlContent.includes("run:")) {
    const runPattern = /run:\s*(.+)/gi;
    let match;
    while ((match = runPattern.exec(yamlContent)) !== null) {
      const cmd = match[1].toLowerCase();
      if (cmd.includes("curl") && (cmd.includes("http://") || cmd.includes("-k"))) {
        issues.push({ severity: "medium", description: "Insecure HTTP download in run step", line: yamlContent.slice(0, match.index).split("\n").length });
      }
      if (cmd.includes("sudo") && cmd.includes("npm")) {
        issues.push({ severity: "low", description: "Using sudo with npm - not recommended in CI", line: yamlContent.slice(0, match.index).split("\n").length });
      }
    }
  }

  return { issues };
}

function estimateComputeCost(stages: string[], params: any): { costPerRun: number; estimatedMonthly: number; breakdown: Record<string, number> } {
  const rates: Record<string, number> = {
    install: 0.008, lint: 0.005, test: 0.025, build: 0.015,
    deploy: 0.01, docker: 0.02, scan: 0.012, publish: 0.008,
  };

  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const stage of stages) {
    const cost = rates[stage] || 0.01;
    breakdown[stage] = cost;
    total += cost;
  }

  const runsPerMonth = params.runsPerMonth || 100;
  const monthly = total * runsPerMonth;

  return {
    costPerRun: Math.round(total * 10000) / 10000,
    estimatedMonthly: Math.round(monthly * 100) / 100,
    breakdown,
  };
}

function analyzeYamlStructure(yamlContent: string): { jobCount: number; usesCount: number; matrixCount: number; complexity: string } {
  const jobCount = (yamlContent.match(/^\s*\w+:\s*$/gm) || []).length;
  const usesCount = (yamlContent.match(/uses:/g) || []).length;
  const matrixCount = (yamlContent.match(/matrix:/g) || []).length;

  let complexity = "simple";
  if (usesCount > 5 || matrixCount > 1) complexity = "complex";
  else if (usesCount > 3 || matrixCount > 0) complexity = "moderate";

  return { jobCount, usesCount, matrixCount, complexity };
}

export async function processItem(input: string, params: any = {}): Promise<any> {
  let yamlContent = "";
  try {
    const parsed = JSON.parse(input);
    yamlContent = parsed.yaml || parsed.yamlContent || parsed.content || parsed.pipeline || "";
    if (!yamlContent && parsed.steps) {
      yamlContent = parsed.steps.join("\n");
    }
  } catch {
    yamlContent = input;
  }

  if (!yamlContent) {
    return {
      status: "completed", input, error: "No pipeline content provided",
      pipelineAnalysis: null, optimizations: [], securityIssues: [], costEstimate: null,
    };
  }

  const { stages, dependencies, parallelGroups } = detectStages(yamlContent);
  const structure = analyzeYamlStructure(yamlContent);
  const { opportunities, estimatedSpeedup } = detectParallelizationOpportunities(stages, dependencies);
  const { issues: securityIssues } = detectSecurityIssues(yamlContent);
  const costEstimate = estimateComputeCost(stages, params);

  const bottlenecks: string[] = [];
  if (stages.includes("test") && !parallelGroups.some(g => g.includes("test"))) {
    bottlenecks.push("Test stage is serial - consider sharding or parallelization");
  }
  if (stages.includes("deploy") && stages.includes("scan")) {
    bottlenecks.push("Deploy + scan are sequential - consider running scan in parallel");
  }
  if (structure.matrixCount > 2) {
    bottlenecks.push("Multiple matrix strategies detected - may cause excessive parallel jobs");
  }

  const cacheHints: string[] = [];
  if (stages.includes("install")) {
    cacheHints.push("Cache node_modules or pip dependencies to speed up install");
  }
  if (stages.includes("build")) {
    cacheHints.push("Cache build outputs or dist/ directory");
  }
  if (stages.includes("docker")) {
    cacheHints.push("Use Docker layer caching for base images");
  }

  return {
    status: "completed", input,
    pipelineAnalysis: {
      stages,
      dependencies,
      parallelGroups,
      structure,
      bottlenecks,
    },
    optimizations: [...opportunities, ...cacheHints.map(h => `Cache hint: ${h}`)],
    estimatedSpeedup,
    securityIssues,
    costEstimate,
    timestamp: new Date().toISOString(),
  };
}
