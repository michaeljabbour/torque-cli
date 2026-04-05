/**
 * Per-bundle seed for pipeline (standard template).
 * Exports seedPipeline(pipeline, ctx) that lists stages.
 */

export function seedPipeline(pipeline, ctx) {
  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  console.log('   Pipeline stages:', stages.join(', '));
  return stages;
}
