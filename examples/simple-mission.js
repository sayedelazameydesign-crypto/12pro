/**
 * Example: Simple autonomous mission
 */
import { createMission } from '../apps/api/src/index.ts';

const mission = await createMission({
  goal: "Research AGI-OS repository best practices and summarize",
  constraints: { maxSpend: 0, maxSteps: 10 }
});

console.log(mission);
