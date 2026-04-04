import { StringEnum } from '@mariozechner/pi-ai';
import { Type, type Static } from '@sinclair/typebox';
import {
  type QuestionInput as QuestionInputSchema,
  type QuestionOption as QuestionOptionSchema,
  type SelectionMode as SelectionModeSchema,
} from './schema.js';

export type QuestionOption = QuestionOptionSchema;
export type QuestionInput = QuestionInputSchema;
export type SelectionMode = SelectionModeSchema;

export interface NormalizedQuestion {
  id: string;
  label: string;
  prompt: string;
  selectionMode: SelectionMode;
  options: QuestionOption[];
  allowOther: boolean;
}

export const SelectedOptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
});

export type SelectedOption = Static<typeof SelectedOptionSchema>;

export interface NormalizedAnswer {
  questionId: string;
  questionLabel: string;
  selectedOptions: SelectedOption[];
  otherText: string | null;
  wasOtherSelected: boolean;
}

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  answers: NormalizedAnswer[];
  cancelled: boolean;
  error?: string;
}

export interface QuestionSelectionState {
  listedSelectedValues: string[];
  otherText: string;
  wasOtherSelected: boolean;
}

export const QuestionnaireInputModeSchema = StringEnum(['navigate', 'otherInput'] as const, {
  description: 'Current input mode for questionnaire UI state.',
  default: 'navigate',
});

export type QuestionnaireInputMode = Static<typeof QuestionnaireInputModeSchema>;

export interface QuestionnaireUIState {
  activeTabIndex: number;
  lastQuestionTabIndex: number;
  questionOptionCursorById: Record<string, number>;
  reviewCursor: number;
  inputMode: QuestionnaireInputMode;
  editingQuestionId?: string;
  returnToReview: boolean;
  returnReviewCursor: number;
  questionStateById: Record<string, QuestionSelectionState>;
}
