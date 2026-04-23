# @dreki-gg/pi-vim-mode

Always-on vim-like modal editor for pi.

It replaces pi's input editor with a modal editor that:
- starts in normal mode
- preserves pi's built-in insert-mode autocomplete
- keeps `@file` completion and slash-command completion in insert mode
- preserves pi's normal `Esc` interrupt behavior when already in normal mode

## Install

```bash
pi install npm:@dreki-gg/pi-vim-mode
```

Reload pi with `/reload` or restart the session after installation.

## What it provides

| Feature | Behavior |
|---|---|
| Startup mode | Normal mode |
| Insert mode | Delegates to pi's built-in editor behavior |
| Escape | Insert → Normal, pending delete → cancel, Normal → pi interrupt |
| Word motions | Reuses pi's existing word classification |
| Line model | `dd`, `dw`, and `db` operate on logical newline-delimited lines |

## Keymap

### Normal mode

- `h` / `l` — move left/right within the current logical line
- `j` / `k` — move down/up using pi's existing vertical navigation
- `w` / `b` — word motions using pi's existing word boundaries
- `0` / `$` — line start / line end
- `x` — delete char under cursor
- `i` — enter insert mode
- `a` — append and enter insert mode
- `o` / `O` — open line below / above and enter insert mode
- `dd` — delete current logical line
- `dw` — delete forward word within current logical line
- `db` — delete backward word within current logical line

### Insert mode

Insert mode is pi's normal editor behavior, so you keep:
- `tab` autocomplete
- `@file` completion
- slash-command completion
- standard pi/editor keybindings

## Notes

This package is intentionally a modal editor extension, not a full vim clone. It does not currently implement:
- visual mode
- registers
- text objects
- counts
- full operator-pending grammar
