import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { CustomEditor } from '@mariozechner/pi-coding-agent';
import { matchesKey, truncateToWidth, visibleWidth } from '@mariozechner/pi-tui';

type Mode = 'normal' | 'insert';
type PendingOperator = 'd' | null;

interface CursorContext {
  lines: string[];
  lineIndex: number;
  col: number;
  line: string;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const PUNCTUATION_REGEX = /[(){}[\]<>.,;:'"!?+\-=*/\\|&%^$#@~`]/;

const KEY_LEFT = '\x1b[D';
const KEY_RIGHT = '\x1b[C';
const KEY_UP = '\x1b[A';
const KEY_DOWN = '\x1b[B';
const KEY_WORD_BACKWARD = '\x1bb';
const KEY_WORD_FORWARD = '\x1bf';
const KEY_LINE_START = '\x01';
const KEY_LINE_END = '\x05';
const KEY_DELETE_FORWARD = '\x1b[3~';
const KEY_DELETE_TO_LINE_END = '\x0b';
const KEY_BACKSPACE = '\x7f';
const KEY_NEW_LINE = '\n';

function isWhitespaceChar(char: string): boolean {
  return /\s/.test(char);
}

function isPunctuationChar(char: string): boolean {
  return PUNCTUATION_REGEX.test(char);
}

function getGraphemes(text: string): string[] {
  return [...segmenter.segment(text)].map((segment) => segment.segment);
}

class VimModeEditor extends CustomEditor {
  private mode: Mode = 'normal';
  private pendingOperator: PendingOperator = null;

  handleInput(data: string): void {
    if (this.pendingOperator) {
      this.handlePendingOperator(data);
      return;
    }

    if (matchesKey(data, 'escape')) {
      if (this.mode === 'insert') {
        this.mode = 'normal';
      } else {
        super.handleInput(data);
      }
      return;
    }

    if (this.mode === 'insert') {
      super.handleInput(data);
      return;
    }

    const command = this.getPrintableCommand(data);
    if (command) {
      this.handleNormalModeCommand(command);
      return;
    }

    super.handleInput(data);
  }

  private handlePendingOperator(data: string): void {
    if (matchesKey(data, 'escape')) {
      this.pendingOperator = null;
      return;
    }

    const command = this.getPrintableCommand(data);
    this.pendingOperator = null;

    switch (command) {
      case 'd':
        this.deleteCurrentLogicalLine();
        return;
      case 'w':
        this.deleteWordForwardWithinLine();
        return;
      case 'b':
        this.deleteWordBackwardWithinLine();
        return;
      default:
        return;
    }
  }

  private handleNormalModeCommand(command: string): void {
    switch (command) {
      case 'h':
        this.moveLeftWithinLine();
        return;
      case 'j':
        this.moveVertically(KEY_DOWN);
        return;
      case 'k':
        this.moveVertically(KEY_UP);
        return;
      case 'l':
        this.moveRightWithinLine();
        return;
      case 'w':
        super.handleInput(KEY_WORD_FORWARD);
        return;
      case 'b':
        super.handleInput(KEY_WORD_BACKWARD);
        return;
      case '0':
        super.handleInput(KEY_LINE_START);
        return;
      case '$':
        super.handleInput(KEY_LINE_END);
        return;
      case 'x':
        this.deleteCharUnderCursor();
        return;
      case 'o':
        this.openLineBelow();
        return;
      case 'O':
        this.openLineAbove();
        return;
      case 'i':
        this.mode = 'insert';
        return;
      case 'a':
        this.appendAndInsert();
        return;
      case 'd':
        this.pendingOperator = 'd';
        return;
      default:
        return;
    }
  }

  private getPrintableCommand(data: string): string | undefined {
    return data.length === 1 && data.charCodeAt(0) >= 32 ? data : undefined;
  }

  private getCursorContext(): CursorContext {
    const { line, col } = this.getCursor();
    const lines = this.getLines();
    return {
      lines,
      lineIndex: line,
      col,
      line: lines[line] ?? '',
    };
  }

  private moveLeftWithinLine(): void {
    const { col } = this.getCursorContext();
    if (col > 0) {
      super.handleInput(KEY_LEFT);
    }
  }

  private moveRightWithinLine(): void {
    const { col, line } = this.getCursorContext();
    if (col < line.length) {
      super.handleInput(KEY_RIGHT);
    }
  }

  private moveVertically(sequence: string): void {
    if (this.getText().length === 0) return;
    super.handleInput(sequence);
  }

  private deleteCharUnderCursor(): void {
    const { col, line } = this.getCursorContext();
    if (col < line.length) {
      super.handleInput(KEY_DELETE_FORWARD);
    }
  }

  private appendAndInsert(): void {
    const { col, line } = this.getCursorContext();
    if (col < line.length) {
      super.handleInput(KEY_RIGHT);
    }
    this.mode = 'insert';
  }

  private openLineBelow(): void {
    super.handleInput(KEY_LINE_END);
    super.handleInput(KEY_NEW_LINE);
    this.mode = 'insert';
  }

  private openLineAbove(): void {
    super.handleInput(KEY_LINE_START);
    super.handleInput(KEY_NEW_LINE);
    this.mode = 'insert';
  }

  private deleteCurrentLogicalLine(): void {
    const { lines, lineIndex } = this.getCursorContext();
    super.handleInput(KEY_LINE_START);
    super.handleInput(KEY_DELETE_TO_LINE_END);

    if (lineIndex < lines.length - 1) {
      super.handleInput(KEY_DELETE_FORWARD);
    } else if (lineIndex > 0) {
      super.handleInput(KEY_BACKSPACE);
    }
  }

  private deleteWordForwardWithinLine(): void {
    const { col, line } = this.getCursorContext();
    const boundary = this.findWordForwardBoundary(line, col);
    const deleteText = line.slice(col, boundary);
    this.repeatKey(KEY_DELETE_FORWARD, getGraphemes(deleteText).length);
  }

  private deleteWordBackwardWithinLine(): void {
    const { col, line } = this.getCursorContext();
    const boundary = this.findWordBackwardBoundary(line, col);
    const deleteText = line.slice(boundary, col);
    this.repeatKey(KEY_BACKSPACE, getGraphemes(deleteText).length);
  }

  private repeatKey(sequence: string, times: number): void {
    for (let index = 0; index < times; index++) {
      super.handleInput(sequence);
    }
  }

  private findWordForwardBoundary(line: string, col: number): number {
    if (col >= line.length) {
      return col;
    }

    const graphemes = getGraphemes(line.slice(col));
    let offset = 0;
    let index = 0;

    while (index < graphemes.length && isWhitespaceChar(graphemes[index]!)) {
      offset += graphemes[index]!.length;
      index++;
    }

    if (index >= graphemes.length) {
      return col + offset;
    }

    const firstGrapheme = graphemes[index]!;
    if (isPunctuationChar(firstGrapheme)) {
      while (index < graphemes.length && isPunctuationChar(graphemes[index]!)) {
        offset += graphemes[index]!.length;
        index++;
      }
    } else {
      while (
        index < graphemes.length &&
        !isWhitespaceChar(graphemes[index]!) &&
        !isPunctuationChar(graphemes[index]!)
      ) {
        offset += graphemes[index]!.length;
        index++;
      }
    }

    return col + offset;
  }

  private findWordBackwardBoundary(line: string, col: number): number {
    if (col <= 0) {
      return col;
    }

    const graphemes = getGraphemes(line.slice(0, col));
    let offset = col;
    let index = graphemes.length - 1;

    while (index >= 0 && isWhitespaceChar(graphemes[index]!)) {
      offset -= graphemes[index]!.length;
      index--;
    }

    if (index < 0) {
      return offset;
    }

    const lastGrapheme = graphemes[index]!;
    if (isPunctuationChar(lastGrapheme)) {
      while (index >= 0 && isPunctuationChar(graphemes[index]!)) {
        offset -= graphemes[index]!.length;
        index--;
      }
    } else {
      while (
        index >= 0 &&
        !isWhitespaceChar(graphemes[index]!) &&
        !isPunctuationChar(graphemes[index]!)
      ) {
        offset -= graphemes[index]!.length;
        index--;
      }
    }

    return offset;
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    const label =
      this.pendingOperator === 'd' ? ' DELETE ' : this.mode === 'normal' ? ' NORMAL ' : ' INSERT ';
    const last = lines.length - 1;
    if (visibleWidth(lines[last]!) >= label.length) {
      lines[last] = truncateToWidth(lines[last]!, width - label.length, '') + label;
    }
    return lines;
  }
}

export default function vimModeExtension(pi: ExtensionAPI) {
  pi.on('session_start', (_event, ctx) => {
    ctx.ui.setEditorComponent(
      (tui, theme, keybindings) => new VimModeEditor(tui, theme, keybindings),
    );
  });
}
