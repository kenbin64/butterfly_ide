// bit-metrics.ts

// -----------------------------
// Types
// -----------------------------

export type StageMetric = {
  name: string;        // e.g. "encode_header", "expand_payload"
  inputBits: number;
  outputBits: number;
  overheadBits: number;
};

export type BitMetric = {
  inputBits: number;
  outputBits: number;
  overheadBits: number;
  expansionRatio: number; // outputBits / inputBits
  stages: StageMetric[];
};

// -----------------------------
// Core helpers
// -----------------------------

/**
 * Wraps a transformation step and records its bit usage.
 */
export function withMetrics(
  name: string,
  inputBits: number,
  fn: (inputBits: number) => { outputBits: number; overheadBits: number }
): StageMetric {
  const { outputBits, overheadBits } = fn(inputBits);

  return {
    name,
    inputBits,
    outputBits,
    overheadBits,
  };
}

/**
 * Aggregates stage metrics into a full BitMetric.
 */
export function aggregateMetrics(
  originalInputBits: number,
  stages: StageMetric[]
): BitMetric {
  if (stages.length === 0) {
    return {
      inputBits: originalInputBits,
      outputBits: originalInputBits,
      overheadBits: 0,
      expansionRatio: 1,
      stages: [],
    };
  }

  const finalOutputBits = stages[stages.length - 1].outputBits;
  const totalOverhead = stages.reduce((sum, s) => sum + s.overheadBits, 0);

  return {
    inputBits: originalInputBits,
    outputBits: finalOutputBits,
    overheadBits: totalOverhead,
    expansionRatio: finalOutputBits / originalInputBits,
    stages,
  };
}

// -----------------------------
// Example transformations
// -----------------------------

/**
 * Example: add a fixed-size header.
 */
export function encodeHeaderStep(
  headerBits: number
): (inputBits: number) => { outputBits: number; overheadBits: number } {
  return (inputBits: number) => {
    const outputBits = inputBits + headerBits;
    return {
      outputBits,
      overheadBits: headerBits,
    };
  };
}

/**
 * Example: expand payload by a factor (e.g. decompression or teleport "reconstruction").
 */
export function expandPayloadStep(
  expansionFactor: number
): (inputBits: number) => { outputBits: number; overheadBits: number } {
  return (inputBits: number) => {
    const outputBits = Math.floor(inputBits * expansionFactor);
    const overheadBits = 0;
    return {
      outputBits,
      overheadBits,
    };
  };
}

/**
 * Example: add checksum bits proportional to payload size.
 */
export function checksumStep(
  checksumRatio: number // e.g. 0.01 = 1% of payload size
): (inputBits: number) => { outputBits: number; overheadBits: number } {
  return (inputBits: number) => {
    const checksumBits = Math.floor(inputBits * checksumRatio);
    const outputBits = inputBits + checksumBits;
    return {
      outputBits,
      overheadBits: checksumBits,
    };
  };
}

// -----------------------------
// Example pipeline: "teleport pattern"
// -----------------------------

/**
 * Simulates a teleport/expansion pipeline with full bit accounting.
 */
export function processTeleportPattern(inputBits: number): BitMetric {
  const stages: StageMetric[] = [];

  // Stage 1: encode header
  const headerStage = withMetrics(
    "encode_header",
    inputBits,
    encodeHeaderStep(128) // 128-bit header
  );
  stages.push(headerStage);

  // Stage 2: expand payload (e.g. reconstruction, decompression, or teleport expansion)
  const expandedStage = withMetrics(
    "expand_payload",
    headerStage.outputBits,
    expandPayloadStep(2.0) // 2x expansion
  );
  stages.push(expandedStage);

  // Stage 3: add checksum
  const checksumStage = withMetrics(
    "add_checksum",
    expandedStage.outputBits,
    checksumStep(0.02) // 2% checksum overhead
  );
  stages.push(checksumStage);

  // Aggregate into a single BitMetric
  return aggregateMetrics(inputBits, stages);
}

// -----------------------------
// Display / logging
// -----------------------------

/**
 * Logs the bit metric to console in a human-readable way.
 */
export function logBitMetric(metric: BitMetric): void {
  console.log("=== Bit Metric ===");
  console.log(`Input bits:      ${metric.inputBits}`);
  console.log(`Output bits:     ${metric.outputBits}`);
  console.log(`Overhead bits:   ${metric.overheadBits}`);
  console.log(
    `Expansion ratio: ${metric.expansionRatio.toFixed(6)} (out / in)`
  );
  console.log("Stages:");
  metric.stages.forEach((s, idx) => {
    console.log(
      `  [${idx}] ${s.name}: in=${s.inputBits}, out=${s.outputBits}, overhead=${s.overheadBits}`
    );
  });

  // Optional integrity check: ensure no "mystery bits"
  const totalDeclaredOverhead = metric.stages.reduce(
    (sum, s) => sum + s.overheadBits,
    0
  );
  const netGrowth = metric.outputBits - metric.inputBits;

  console.log("Integrity check:");
  console.log(`  Net growth (out - in):        ${netGrowth}`);
  console.log(`  Sum of declared overhead:     ${totalDeclaredOverhead}`);
  if (netGrowth !== totalDeclaredOverhead) {
    console.warn(
      "  WARNING: net growth != declared overhead. There are undeclared bits in the pipeline."
    );
  } else {
    console.log("  OK: all growth accounted for by overhead.");
  }
}

// -----------------------------
// Example usage
// -----------------------------

// You can call this from your main/game loop or a test harness.
if (require.main === module) {
  const initialBits = 1024; // e.g. original pattern size
  const metric = processTeleportPattern(initialBits);
  logBitMetric(metric);
}