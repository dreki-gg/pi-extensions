import type { ExtensionAPI, Theme } from '@mariozechner/pi-coding-agent';
import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import {
  formatCancelledSummary,
  formatCompletedSummary,
  formatExpandedAnswerLines,
  formatToolContentSummary,
  normalizeQuestions,
  validateQuestions,
} from './format.js';
import { QuestionnaireParamsSchema } from './schema.js';
import type { QuestionInput, QuestionnaireResult, SelectionMode, SelectedOption } from './types.js';
import { runQuestionnaireUI } from './ui.js';

function emptyResult(error?: string): QuestionnaireResult {
  return {
    questions: [],
    answers: [],
    cancelled: true,
    ...(error ? { error } : {}),
  };
}

function buildErrorResult(error: string, details: QuestionnaireResult = emptyResult(error)) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${error}` }],
    details,
    isError: true,
  };
}

function getCallLabels(questions: QuestionInput[]): string[] {
  return questions.map((question, index) => {
    const trimmed = question.label?.trim();
    if (trimmed) return trimmed;
    return question.id.trim() || `Q${index + 1}`;
  });
}

function renderCollapsedCall(questions: QuestionInput[], theme: Theme): string {
  const labels = getCallLabels(questions);
  const count = questions.length;
  const suffix = count === 1 ? 'question' : 'questions';
  const labelsText = labels.length ? ` (${labels.join(', ')})` : '';

  return (
    theme.fg('toolTitle', theme.bold('questionnaire ')) +
    theme.fg('muted', `${count} ${suffix}`) +
    theme.fg('dim', labelsText)
  );
}

function selectedOption(value: string, label: string): SelectedOption {
  return { value, label };
}

function demoQuestions(): QuestionInput[] {
  return [
    {
      id: 'scope',
      label: 'Scope',
      prompt: 'What is the project scope?',
      selectionMode: 'single' satisfies SelectionMode,
      options: [
        selectedOption('small', 'Small'),
        selectedOption('medium', 'Medium'),
        selectedOption('high', 'High'),
      ],
      allowOther: true,
    },
    {
      id: 'priority',
      label: 'Priority',
      prompt: 'What priority should we assign?',
      selectionMode: 'single' satisfies SelectionMode,
      options: [selectedOption('p0', 'P0'), selectedOption('p1', 'P1'), selectedOption('p2', 'P2')],
      allowOther: true,
    },
    {
      id: 'approach',
      label: 'Approach',
      prompt: 'Which implementation approach do you want?',
      selectionMode: 'single' satisfies SelectionMode,
      options: [
        selectedOption('rest', 'REST API'),
        selectedOption('event-driven', 'Event-driven'),
        selectedOption('serverless', 'Serverless'),
      ],
      allowOther: true,
    },
  ];
}

export default function questionnaireExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'questionnaire',
    label: 'Questionnaire',
    description:
      'Collect 1-5 structured user answers in a single interactive questionnaire flow. Supports single and multi-select prompts with optional Other text.',
    promptSnippet:
      'Gather explicit user choices with a structured questionnaire before proceeding with implementation or planning.',
    promptGuidelines: [
      'Use this tool when you need explicit user choices before continuing.',
      'Batch related clarification questions into one questionnaire call instead of many single prompts.',
      'Only call this tool in interactive sessions with UI available.',
    ],
    parameters: QuestionnaireParamsSchema,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const validation = validateQuestions(params.questions);
      if (!validation.valid) {
        return buildErrorResult(validation.error);
      }

      const normalizedQuestions = normalizeQuestions(params.questions);

      if (!ctx.hasUI) {
        return buildErrorResult('UI not available (running in non-interactive mode).', {
          questions: normalizedQuestions,
          answers: [],
          cancelled: true,
          error: 'UI not available (running in non-interactive mode).',
        });
      }

      const uiResult = await runQuestionnaireUI(ctx, normalizedQuestions);

      if (uiResult.cancelled) {
        return {
          content: [{ type: 'text' as const, text: formatCancelledSummary() }],
          details: uiResult,
          isError: false,
          cancelled: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: formatToolContentSummary(uiResult) }],
        details: uiResult,
      };
    },

    renderCall(args, theme, _context) {
      return new Text(renderCollapsedCall(args.questions, theme), 0, 0);
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = result.details as QuestionnaireResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === 'text' ? text.text : '', 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg('error', `Error: ${details.error}`), 0, 0);
      }

      if (details.cancelled) {
        if (!expanded) {
          return new Text(theme.fg('warning', formatCancelledSummary()), 0, 0);
        }

        const container = new Container();
        container.addChild(new Text(theme.fg('warning', formatCancelledSummary()), 0, 0));
        container.addChild(new Spacer(1));
        container.addChild(new Text(theme.fg('muted', 'No submission occurred.'), 0, 0));
        return container;
      }

      if (!expanded) {
        return new Text(theme.fg('success', formatCompletedSummary(details)), 0, 0);
      }

      const container = new Container();
      container.addChild(new Text(theme.fg('success', formatCompletedSummary(details)), 0, 0));
      container.addChild(new Spacer(1));

      for (const line of formatExpandedAnswerLines(details)) {
        container.addChild(new Text(theme.fg('text', line), 0, 0));
      }

      return container;
    },
  });

  pi.registerCommand('questionnaire', {
    description: 'Run a demo questionnaire flow.',
    handler: async (_args, ctx) => {
      const questions = normalizeQuestions(demoQuestions());

      if (!ctx.hasUI) {
        ctx.ui.notify('/questionnaire requires interactive mode.', 'error');
        return;
      }

      const result = await runQuestionnaireUI(ctx, questions);
      if (result.cancelled) {
        ctx.ui.notify(formatCancelledSummary(), 'warning');
        return;
      }

      ctx.ui.notify(formatCompletedSummary(result), 'info');
    },
  });
}
