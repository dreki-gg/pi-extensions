import type { ExtensionContext } from '@mariozechner/pi-coding-agent';
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from '@mariozechner/pi-tui';
import {
  areAllAnswersValid,
  createInitialQuestionStateById,
  formatAnswerValue,
  isAnswerValid,
  normalizeAnswers,
} from './format.js';
import type {
  NormalizedQuestion,
  QuestionSelectionState,
  QuestionnaireResult,
  QuestionnaireUIState,
} from './types.js';

interface RenderOption {
  kind: 'listed' | 'other';
  value: string;
  label: string;
  description?: string;
}

const REVIEW_LABEL_READY = ' ✓ Review ';
const REVIEW_LABEL_PENDING = ' □ Review ';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isSpaceKey(data: string): boolean {
  return data === ' ' || matchesKey(data, Key.space);
}

function isRKey(data: string): boolean {
  return data === 'r' || data === 'R' || matchesKey(data, 'r');
}

function getRenderOptions(question: NormalizedQuestion): RenderOption[] {
  const listed: RenderOption[] = question.options.map((option) => ({
    kind: 'listed',
    value: option.value,
    label: option.label,
    description: option.description,
  }));

  if (!question.allowOther) return listed;

  listed.push({ kind: 'other', value: '__other__', label: 'Other' });
  return listed;
}

function ensureQuestionState(
  stateById: Record<string, QuestionSelectionState>,
  questionId: string,
): QuestionSelectionState {
  stateById[questionId] ??= { listedSelectedValues: [], otherText: '', wasOtherSelected: false };
  return stateById[questionId];
}

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, 'ui'>,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  const reviewTabIndex = questions.length;

  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    const uiState: QuestionnaireUIState = {
      activeTabIndex: 0,
      lastQuestionTabIndex: 0,
      questionOptionCursorById: Object.fromEntries(questions.map((question) => [question.id, 0])),
      reviewCursor: 0,
      inputMode: 'navigate',
      editingQuestionId: undefined,
      returnToReview: false,
      returnReviewCursor: 0,
      questionStateById: createInitialQuestionStateById(questions),
    };

    const editorTheme: EditorTheme = {
      borderColor: (text) => theme.fg('accent', text),
      selectList: {
        selectedPrefix: (text) => theme.fg('accent', text),
        selectedText: (text) => theme.fg('accent', text),
        description: (text) => theme.fg('muted', text),
        scrollInfo: (text) => theme.fg('dim', text),
        noMatch: (text) => theme.fg('warning', text),
      },
    };

    const editor = new Editor(tui, editorTheme);

    let cachedWidth: number | undefined;
    let cachedLines: string[] | undefined;

    editor.onSubmit = (value) => {
      if (!uiState.editingQuestionId) return;
      const selection = ensureQuestionState(uiState.questionStateById, uiState.editingQuestionId);
      selection.wasOtherSelected = true;
      selection.otherText = value.trim();
      uiState.inputMode = 'navigate';
      uiState.editingQuestionId = undefined;
      invalidate();
    };

    function invalidate() {
      cachedWidth = undefined;
      cachedLines = undefined;
      tui.requestRender();
    }

    function finalize(cancelled: boolean) {
      done({
        questions,
        answers: normalizeAnswers(questions, uiState.questionStateById),
        cancelled,
      });
    }

    function clearInputMode() {
      uiState.inputMode = 'navigate';
      uiState.editingQuestionId = undefined;
    }

    function getActiveQuestion(): NormalizedQuestion | undefined {
      if (uiState.activeTabIndex >= questions.length) return undefined;
      return questions[uiState.activeTabIndex];
    }

    function switchTabs(delta: number) {
      if (questions.length === 0) return;
      const totalTabs = questions.length + 1;
      const nextTab = (uiState.activeTabIndex + delta + totalTabs) % totalTabs;

      if (uiState.activeTabIndex < questions.length) {
        uiState.lastQuestionTabIndex = uiState.activeTabIndex;
      }

      clearInputMode();

      if (nextTab < questions.length) {
        uiState.lastQuestionTabIndex = nextTab;
      }

      uiState.activeTabIndex = nextTab;
      invalidate();
    }

    function jumpToReview() {
      if (uiState.activeTabIndex < questions.length) {
        uiState.lastQuestionTabIndex = uiState.activeTabIndex;
      }

      if (uiState.returnToReview) {
        uiState.reviewCursor = clamp(
          uiState.returnReviewCursor,
          0,
          Math.max(0, questions.length - 1),
        );
      }

      uiState.returnToReview = false;
      uiState.activeTabIndex = reviewTabIndex;
      clearInputMode();
      invalidate();
    }

    function handleQuestionSelection(question: NormalizedQuestion, option: RenderOption) {
      const selection = ensureQuestionState(uiState.questionStateById, question.id);

      if (option.kind === 'other') {
        if (question.selectionMode === 'single') {
          selection.listedSelectedValues = [];
        }
        selection.wasOtherSelected = true;
        uiState.inputMode = 'otherInput';
        uiState.editingQuestionId = question.id;
        editor.setText(selection.otherText);
        invalidate();
        return;
      }

      if (question.selectionMode === 'single') {
        selection.listedSelectedValues = [option.value];
        selection.wasOtherSelected = false;
        selection.otherText = '';
      } else {
        const existing = new Set(selection.listedSelectedValues);
        if (existing.has(option.value)) existing.delete(option.value);
        else existing.add(option.value);
        selection.listedSelectedValues = question.options
          .map((item) => item.value)
          .filter((value) => existing.has(value));
      }

      invalidate();
    }

    function jumpFromReviewToQuestion() {
      const targetIndex = clamp(uiState.reviewCursor, 0, Math.max(0, questions.length - 1));
      uiState.returnReviewCursor = targetIndex;
      uiState.returnToReview = true;
      uiState.activeTabIndex = targetIndex;
      uiState.lastQuestionTabIndex = targetIndex;
      clearInputMode();
      invalidate();
    }

    function moveQuestionCursor(delta: number) {
      const question = getActiveQuestion();
      if (!question) return;
      const options = getRenderOptions(question);
      if (options.length === 0) return;
      const currentCursor = uiState.questionOptionCursorById[question.id] ?? 0;
      uiState.questionOptionCursorById[question.id] = clamp(
        currentCursor + delta,
        0,
        options.length - 1,
      );
      invalidate();
    }

    function handleInput(data: string) {
      if (uiState.inputMode === 'otherInput' && matchesKey(data, Key.escape)) {
        clearInputMode();
        invalidate();
        return;
      }

      if (matchesKey(data, Key.left)) {
        switchTabs(-1);
        return;
      }

      if (matchesKey(data, Key.right)) {
        switchTabs(1);
        return;
      }

      if (isRKey(data)) {
        jumpToReview();
        return;
      }

      if (uiState.inputMode === 'otherInput') {
        editor.handleInput(data);
        invalidate();
        return;
      }

      if (uiState.activeTabIndex === reviewTabIndex) {
        if (matchesKey(data, Key.up)) {
          uiState.reviewCursor = clamp(
            uiState.reviewCursor - 1,
            0,
            Math.max(0, questions.length - 1),
          );
          invalidate();
          return;
        }

        if (matchesKey(data, Key.down)) {
          uiState.reviewCursor = clamp(
            uiState.reviewCursor + 1,
            0,
            Math.max(0, questions.length - 1),
          );
          invalidate();
          return;
        }

        if (isSpaceKey(data)) {
          jumpFromReviewToQuestion();
          return;
        }

        if (matchesKey(data, Key.enter)) {
          if (areAllAnswersValid(questions, uiState.questionStateById)) {
            finalize(false);
          }
          return;
        }

        if (matchesKey(data, Key.escape)) {
          uiState.activeTabIndex = clamp(
            uiState.lastQuestionTabIndex,
            0,
            Math.max(0, questions.length - 1),
          );
          uiState.returnToReview = false;
          invalidate();
        }

        return;
      }

      const question = getActiveQuestion();
      if (!question) return;

      if (matchesKey(data, Key.up)) {
        moveQuestionCursor(-1);
        return;
      }

      if (matchesKey(data, Key.down)) {
        moveQuestionCursor(1);
        return;
      }

      if (isSpaceKey(data)) {
        const options = getRenderOptions(question);
        const cursor = clamp(
          uiState.questionOptionCursorById[question.id] ?? 0,
          0,
          options.length - 1,
        );
        const option = options[cursor];
        if (!option) return;
        handleQuestionSelection(question, option);
        return;
      }

      if (matchesKey(data, Key.escape)) {
        finalize(true);
      }
    }

    function renderTabs(width: number, lines: string[]) {
      const allValid = areAllAnswersValid(questions, uiState.questionStateById);
      const renderedTabs = questions.map((question, index) => {
        const state = ensureQuestionState(uiState.questionStateById, question.id);
        const answered = isAnswerValid(question, state);
        const marker = answered ? '■' : '□';
        const text = ` ${marker} ${question.label} `;
        if (uiState.activeTabIndex === index) {
          return theme.bg('selectedBg', theme.fg('text', text));
        }
        return theme.fg(answered ? 'success' : 'muted', text);
      });

      const reviewText = allValid ? REVIEW_LABEL_READY : REVIEW_LABEL_PENDING;
      const reviewStyled =
        uiState.activeTabIndex === reviewTabIndex
          ? theme.bg('selectedBg', theme.fg('text', reviewText))
          : theme.fg(allValid ? 'success' : 'muted', reviewText);

      const tabLine = renderedTabs.concat(reviewStyled).join(' ');
      lines.push(truncateToWidth(tabLine, width));
      lines.push('');
    }

    function renderQuestionBody(width: number, lines: string[], question: NormalizedQuestion) {
      const selection = ensureQuestionState(uiState.questionStateById, question.id);
      const options = getRenderOptions(question);
      const cursor = clamp(
        uiState.questionOptionCursorById[question.id] ?? 0,
        0,
        options.length - 1,
      );

      lines.push(truncateToWidth(theme.fg('text', question.prompt), width));
      lines.push('');

      for (const [index, option] of options.entries()) {
        const isCursor = cursor === index;
        const prefix = isCursor ? theme.fg('accent', '> ') : '  ';

        if (option.kind === 'other') {
          const activeOtherText = selection.otherText.trim();
          const label = activeOtherText
            ? `Other: "${activeOtherText}"`
            : selection.wasOtherSelected
              ? 'Other (empty)'
              : 'Other';
          const marker = selection.wasOtherSelected ? '[x]' : '[ ]';
          const color = selection.wasOtherSelected ? 'accent' : 'text';
          lines.push(truncateToWidth(`${prefix}${theme.fg(color, `${marker} ${label}`)}`, width));
          continue;
        }

        const selected = selection.listedSelectedValues.includes(option.value);
        const marker = selected ? '[x]' : '[ ]';
        const color = selected ? 'accent' : 'text';
        lines.push(
          truncateToWidth(`${prefix}${theme.fg(color, `${marker} ${option.label}`)}`, width),
        );

        if (option.description) {
          lines.push(truncateToWidth(`    ${theme.fg('muted', option.description)}`, width));
        }
      }

      if (uiState.inputMode === 'otherInput' && uiState.editingQuestionId === question.id) {
        lines.push('');
        lines.push(truncateToWidth(theme.fg('muted', 'Other input:'), width));
        for (const line of editor.render(Math.max(10, width - 2))) {
          lines.push(truncateToWidth(` ${line}`, width));
        }
      }
    }

    function renderReviewBody(width: number, lines: string[]) {
      const ready = areAllAnswersValid(questions, uiState.questionStateById);
      const normalizedAnswers = normalizeAnswers(questions, uiState.questionStateById);

      lines.push(truncateToWidth(theme.fg('accent', theme.bold('Review answers')), width));
      lines.push('');

      for (const [index, question] of questions.entries()) {
        const answer = normalizedAnswers[index];
        const valid = isAnswerValid(
          question,
          ensureQuestionState(uiState.questionStateById, question.id),
        );
        const cursor = uiState.reviewCursor === index ? theme.fg('accent', '> ') : '  ';
        const marker = valid ? theme.fg('success', '■') : theme.fg('warning', '□');
        const value = formatAnswerValue(answer);
        const color = valid ? 'text' : 'muted';
        lines.push(
          truncateToWidth(
            `${cursor}${marker} ${theme.fg('accent', `${question.label}:`)} ${theme.fg(color, value)}`,
            width,
          ),
        );
      }

      lines.push('');
      lines.push(
        truncateToWidth(
          ready
            ? theme.fg('success', 'Press Enter to submit')
            : theme.fg('warning', 'Complete all questions before submitting.'),
          width,
        ),
      );
    }

    function renderHint(width: number, lines: string[]) {
      let hint = '';

      if (uiState.inputMode === 'otherInput') {
        hint = 'Enter submits Other text • Esc exits input mode';
      } else if (uiState.activeTabIndex === reviewTabIndex) {
        hint = '←→ tabs • ↑↓ review row • Space edit • Enter submit • Esc back';
      } else if (uiState.returnToReview) {
        hint = 'Editing from Review • press r to return';
      } else {
        hint = '←→ tabs • ↑↓ options • Space select/edit • r review • Esc cancel';
      }

      lines.push('');
      lines.push(truncateToWidth(theme.fg('dim', hint), width));
    }

    function render(width: number): string[] {
      if (cachedLines && cachedWidth === width) {
        return cachedLines;
      }

      const lines: string[] = [];

      renderTabs(width, lines);

      const activeQuestion = getActiveQuestion();
      if (activeQuestion) {
        renderQuestionBody(width, lines, activeQuestion);
      } else {
        renderReviewBody(width, lines);
      }

      renderHint(width, lines);

      cachedWidth = width;
      cachedLines = lines;
      return lines;
    }

    return {
      render,
      handleInput,
      invalidate: () => {
        cachedWidth = undefined;
        cachedLines = undefined;
      },
    };
  });
}
