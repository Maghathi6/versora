import { EvidenceReference, ProjectContextData } from '../assistant.types';

export class EvidenceExtractorService {
  /**
   * Scans model output and validates detected references against real project context entities.
   * Strips any hallucinated references that do not exist in the retrieved context.
   */
  extractAndValidateSources(
    modelOutput: string,
    contextData: ProjectContextData
  ): { sources: EvidenceReference[]; uncertaintyNote?: string | null } {
    const sources: EvidenceReference[] = [];
    const seenKeys = new Set<string>();

    const addSource = (source: EvidenceReference) => {
      const key = `${source.type}:${source.identifier}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        sources.push(source);
      }
    };

    // 1. Artifacts validation:
    // Check both explicit markers `[artifact:foo]` and exact file names/paths mentioned in response
    for (const art of contextData.artifactsSummary.matchedArtifacts) {
      const namePattern = new RegExp(`\\b${this.escapeRegex(art.name)}\\b`, 'i');
      const pathPattern = new RegExp(`\\b${this.escapeRegex(art.path)}\\b`, 'i');
      const tagPattern = new RegExp(`\\[artifact:[^\\]]*${this.escapeRegex(art.name)}[^\\]]*\\]`, 'i');

      if (tagPattern.test(modelOutput) || namePattern.test(modelOutput) || pathPattern.test(modelOutput)) {
        addSource({
          type: 'artifact',
          identifier: art.id,
          title: art.name,
          location: art.path,
          description: `${art.artifactType} (${art.sizeBytes} bytes)`,
        });
      }
    }

    // 2. Git Commits validation:
    if (contextData.gitSummary && contextData.gitSummary.recentCommits) {
      for (const commit of contextData.gitSummary.recentCommits) {
        const shortHash = commit.hash.substring(0, 7);
        const hashPattern = new RegExp(`\\b${this.escapeRegex(shortHash)}[0-9a-f]*\\b`, 'i');
        const tagPattern = new RegExp(`\\[commit:[^\\]]*${this.escapeRegex(shortHash)}[^\\]]*\\]`, 'i');

        if (tagPattern.test(modelOutput) || hashPattern.test(modelOutput)) {
          addSource({
            type: 'commit',
            identifier: commit.hash,
            title: `Commit ${shortHash}`,
            description: commit.message,
            location: commit.author,
          });
        }
      }
    }

    // 3. Tasks validation:
    if (contextData.tasks) {
      for (const task of contextData.tasks) {
        const idPattern = new RegExp(`\\b${this.escapeRegex(task.id)}\\b`, 'i');
        const titlePattern = new RegExp(`\\b${this.escapeRegex(task.title)}\\b`, 'i');
        const tagPattern = new RegExp(`\\[task:[^\\]]*${this.escapeRegex(task.id)}[^\\]]*\\]`, 'i');

        if (tagPattern.test(modelOutput) || idPattern.test(modelOutput) || (task.title.length > 5 && titlePattern.test(modelOutput))) {
          addSource({
            type: 'task',
            identifier: task.id,
            title: task.title,
            description: `Status: ${task.status}, Priority: ${task.priority}`,
          });
        }
      }
    }

    // 4. Reviews validation:
    if (contextData.reviews) {
      for (const rev of contextData.reviews) {
        const idPattern = new RegExp(`\\b${this.escapeRegex(rev.id)}\\b`, 'i');
        const titlePattern = new RegExp(`\\b${this.escapeRegex(rev.title)}\\b`, 'i');
        const tagPattern = new RegExp(`\\[review:[^\\]]*${this.escapeRegex(rev.id)}[^\\]]*\\]`, 'i');

        if (tagPattern.test(modelOutput) || idPattern.test(modelOutput) || (rev.title.length > 5 && titlePattern.test(modelOutput))) {
          addSource({
            type: 'review',
            identifier: rev.id,
            title: rev.title,
            description: `Status: ${rev.status} (${rev.targetType}:${rev.targetRef})`,
          });
        }
      }
    }

    // 5. Detect Uncertainty Note:
    let uncertaintyNote: string | null = null;
    const lowerOutput = modelOutput.toLowerCase();
    const uncertaintyIndicators = [
      'does not contain information',
      'not enough context',
      'unable to determine',
      'cannot determine',
      'no record of',
      'missing information',
      'information is unavailable',
      'further inspection required',
      'potential effect, not guaranteed',
    ];

    for (const phrase of uncertaintyIndicators) {
      if (lowerOutput.includes(phrase)) {
        uncertaintyNote = 'Some details could not be verified directly from accessible project records.';
        break;
      }
    }

    return {
      sources,
      uncertaintyNote,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const evidenceExtractorService = new EvidenceExtractorService();
