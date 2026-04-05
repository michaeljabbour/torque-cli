import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function validatePlan(appDir, planName) {
  // Support both standalone app layout (appDir/config/mount_plans/)
  // and monorepo workspace layout (appDir/torque-app/config/mount_plans/)
  let plansDir = join(appDir, 'config', 'mount_plans');
  if (!existsSync(plansDir)) {
    const monorepoPlanDir = join(appDir, 'torque-app', 'config', 'mount_plans');
    if (existsSync(monorepoPlanDir)) {
      plansDir = monorepoPlanDir;
    }
  }

  // Strip .yml extension if present
  const name = planName.endsWith('.yml') ? planName.slice(0, -4) : planName;

  const planPath = join(plansDir, `${name}.yml`);

  if (existsSync(planPath)) {
    return { path: planPath };
  }

  // Not found — build list of available plans from plansDir (if it exists)
  let available = [];
  if (existsSync(plansDir)) {
    available = readdirSync(plansDir)
      .filter((f) => f.endsWith('.yml'))
      .map((f) => f.slice(0, -4));
  }

  return {
    error: `Mount plan "${name}" not found.`,
    available,
  };
}
