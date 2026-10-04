/**
 * Versora Dual-Mode Terminology Dictionary
 * Provides clean translation between human-centered Beginner Mode and raw Git Advanced Mode.
 */

export type TerminologyMode = 'beginner' | 'advanced';

export type TerminologyKey =
  | 'project'
  | 'projects'
  | 'workspace'
  | 'workspaces'
  | 'commit'
  | 'checkout'
  | 'pull'
  | 'push'
  | 'merge'
  | 'changeRequest'
  | 'changeRequests'
  | 'review'
  | 'reviews'
  | 'task'
  | 'tasks'
  | 'version'
  | 'versions'
  | 'history'
  | 'diff';

export interface TermDefinition {
  beginner: string;
  advanced: string;
  description: string;
}

export const TERMINOLOGY_DICTIONARY: Record<TerminologyKey, TermDefinition> = {
  project: {
    beginner: 'Project',
    advanced: 'Repository',
    description: 'The root container for all tracked files, assets, and version history.',
  },
  projects: {
    beginner: 'Projects',
    advanced: 'Repositories',
    description: 'Collections of code, documents, and data artifacts.',
  },
  workspace: {
    beginner: 'Workspace',
    advanced: 'Branch',
    description: 'An isolated line of development to make changes without disturbing the main track.',
  },
  workspaces: {
    beginner: 'Workspaces',
    advanced: 'Branches',
    description: 'Parallel working environments within a project.',
  },
  commit: {
    beginner: 'Save Changes',
    advanced: 'Commit',
    description: 'Create an immutable checkpoint snapshot with an explanatory note.',
  },
  checkout: {
    beginner: 'Switch Workspace',
    advanced: 'Checkout',
    description: 'Switch the active working directory to a different workspace.',
  },
  pull: {
    beginner: 'Get Latest',
    advanced: 'Pull / Fetch',
    description: 'Download the latest updates made by teammates or collaborators.',
  },
  push: {
    beginner: 'Send Changes',
    advanced: 'Push',
    description: 'Upload your saved local checkpoints to the remote server.',
  },
  merge: {
    beginner: 'Combine Changes',
    advanced: 'Merge',
    description: 'Integrate work from one workspace into another target workspace.',
  },
  changeRequest: {
    beginner: 'Change Request',
    advanced: 'Pull Request',
    description: 'Propose combining workspace changes and request peer review.',
  },
  changeRequests: {
    beginner: 'Change Requests',
    advanced: 'Pull Requests',
    description: 'Proposed updates awaiting peer verification and merge.',
  },
  review: {
    beginner: 'Review Changes',
    advanced: 'Code Review',
    description: 'Examine diffs, leave comments, and approve or request modifications.',
  },
  reviews: {
    beginner: 'Reviews',
    advanced: 'Code Reviews',
    description: 'Peer verification threads on proposed changes.',
  },
  task: {
    beginner: 'Task / Problem',
    advanced: 'Issue',
    description: 'Track bugs, feature requests, or project requirements.',
  },
  tasks: {
    beginner: 'Tasks & Problems',
    advanced: 'Issues',
    description: 'Items requiring work or investigation.',
  },
  version: {
    beginner: 'Project Version',
    advanced: 'Tag / Release',
    description: 'A frozen milestone release of the entire project ecosystem.',
  },
  versions: {
    beginner: 'Project Versions',
    advanced: 'Tags / Releases',
    description: 'Milestone releases across the project history.',
  },
  history: {
    beginner: 'Change History',
    advanced: 'Commit Log',
    description: 'The chronological audit trail of all saved checkpoints.',
  },
  diff: {
    beginner: 'View Differences',
    advanced: 'Git Diff',
    description: 'Line-by-line comparison of what changed between states.',
  },
};

/**
 * Returns the terminology string corresponding to the user's active mode.
 */
export function getTerm(key: TerminologyKey, mode: TerminologyMode): string {
  const definition = TERMINOLOGY_DICTIONARY[key];
  if (!definition) return key;
  return mode === 'beginner' ? definition.beginner : definition.advanced;
}
