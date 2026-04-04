import { StringEnum } from '@mariozechner/pi-ai';
import { Type, type Static } from '@sinclair/typebox';

export const SelectionModeSchema = StringEnum(['single', 'multiple'] as const, {
  description: 'Selection mode: single choice or multiple choices.',
  default: 'single',
});

export const QuestionOptionSchema = Type.Object({
  value: Type.String({ description: 'Stable value returned when this option is selected.' }),
  label: Type.String({ description: 'User-facing label for this option.' }),
  description: Type.Optional(
    Type.String({ description: 'Optional helper text displayed under the label.' }),
  ),
});

export const QuestionSchema = Type.Object({
  id: Type.String({ description: 'Unique question identifier.' }),
  label: Type.Optional(
    Type.String({ description: 'Short label shown in tabs and summaries (defaults to id).' }),
  ),
  prompt: Type.String({ description: 'Full prompt shown for this question.' }),
  selectionMode: Type.Optional(SelectionModeSchema),
  options: Type.Array(QuestionOptionSchema, {
    minItems: 1,
    description: 'Options available to the user.',
  }),
  allowOther: Type.Optional(
    Type.Boolean({
      description: 'Whether the question includes an Other free-text option (default true).',
    }),
  ),
});

export const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: 1,
    maxItems: 5,
    description: 'Question list. Must contain between 1 and 5 questions.',
  }),
});

export type SelectionMode = Static<typeof SelectionModeSchema>;
export type QuestionOption = Static<typeof QuestionOptionSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
export type QuestionnaireParams = Static<typeof QuestionnaireParamsSchema>;
