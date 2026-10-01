// Rules and enumerations both the web app and the API rely on.

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

// 'mine' is everything synced from your GitHub solutions (tools/sync).
export const LIST_KEYS = ['blind75', 'neetcode150', 'mine'] as const;

export const SESSION_ORDERS = ['weakest', 'random', 'inorder'] as const;

// Checks allowed per problem before it counts as failed.
export const MAX_CHECKS = 3;

// Horizontal distance between indent levels in the solution panel.
export const INDENT_WIDTH_PX = 44;

// Deepest indent a block can be dragged to, whatever the problem says.
export const MAX_INDENT = 4;

export const DEFAULT_FILTERS = {
  list: 'blind75',
  difficulties: ['Easy', 'Medium'],
  length: 10,
  order: 'weakest',
} as const;
