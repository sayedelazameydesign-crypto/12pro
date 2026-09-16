/**
 * @agi-system/skills-registry - Skills Registry: registry, executor, validator, evolution, promotion pipeline
 */
export interface Skill {
  name: string;
  description: string;
  steps: string[];
  successRate: number;
  usageCount: number;
  version: string;
  createdAt: string;
  lastUsedAt?: string;
  tags: string[];
  reusable: boolean;
}

export interface SkillCandidate {
  name: string;
  steps: string[];
  evidence: { missions: string[]; successRate: number };
  status: 'candidate' | 'sandbox' | 'evaluation' | 'approval' | 'promoted' | 'rejected';
}

export class SkillsRegistry {
  private skills = new Map<string, Skill>();
  private candidates = new Map<string, SkillCandidate>();

  async register(skill: Skill): Promise<void> {
    this.skills.set(skill.name, skill);
  }

  async get(name: string): Promise<Skill | null> {
    return this.skills.get(name) || null;
  }

  getAll(): Skill[] { return Array.from(this.skills.values()); }

  async proposeCandidate(name: string, steps: string[], evidence: SkillCandidate['evidence']): Promise<SkillCandidate> {
    const candidate: SkillCandidate = {
      name,
      steps,
      evidence,
      status: 'candidate'
    };
    this.candidates.set(name, candidate);
    return candidate;
  }

  async promoteCandidate(name: string): Promise<Skill> {
    const candidate = this.candidates.get(name);
    if (!candidate) throw new Error(`Candidate ${name} not found`);
    
    // Pipeline: candidate -> sandbox -> evaluation -> approval -> promoted
    candidate.status = 'sandbox';
    // Simulate sandbox test
    await new Promise(r => setTimeout(r, 10));
    
    candidate.status = 'evaluation';
    // Simulate evaluation - must have high success rate
    if (candidate.evidence.successRate < 0.8) {
      candidate.status = 'rejected';
      throw new Error(`Candidate ${name} rejected: successRate ${candidate.evidence.successRate} < 0.8`);
    }

    candidate.status = 'approval';
    // Simulate approval
    await new Promise(r => setTimeout(r, 10));

    candidate.status = 'promoted';
    
    const skill: Skill = {
      name: candidate.name,
      description: `Skill ${candidate.name} promoted from ${candidate.evidence.missions.length} missions`,
      steps: candidate.steps,
      successRate: candidate.evidence.successRate,
      usageCount: candidate.evidence.missions.length,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      tags: [candidate.name.split('_')[0] || 'general'],
      reusable: true
    };

    await this.register(skill);
    return skill;
  }

  async evolveFromExperiences(experiences: { taskPattern: string; steps: string[]; successRate: number; count: number }[]): Promise<SkillCandidate[]> {
    const candidates: SkillCandidate[] = [];
    
    for (const exp of experiences) {
      if (exp.count >= 3 && exp.successRate >= 0.8) {
        // Repeated successful procedure -> reusable skill candidate
        const candidate = await this.proposeCandidate(
          `skill_${exp.taskPattern.replace(/\s+/g, '_').slice(0, 30)}`,
          exp.steps,
          { missions: Array(exp.count).fill('mission'), successRate: exp.successRate }
        );
        candidates.push(candidate);
      }
    }

    return candidates;
  }
}

export const skillsRegistry = new SkillsRegistry();
export default SkillsRegistry;
