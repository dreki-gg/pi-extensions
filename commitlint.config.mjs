export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // packages
        'ask-mode',
        'browser-tools',
        'context7',
        'impeccable',
        'lsp',
        'modes',
        'plan-mode',
        'questionnaire',
        'subagent',
        // cross-cutting
        'deps',
        'ci',
        'tests',
        'release',
      ],
    ],
    'scope-empty': [1, 'never'],
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
  },
};
