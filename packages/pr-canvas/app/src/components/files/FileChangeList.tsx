import { For, Show } from 'solid-js';
import type { PrFile } from '~/lib/types';

interface FileChangeListProps {
  files: PrFile[];
  selected: string;
  onSelect: (path: string) => void;
}

const STATUS_LABEL: Record<PrFile['status'], string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

// Split a path into directory + filename for two-line display.
function splitPath(path: string) {
  const idx = path.lastIndexOf('/');
  if (idx === -1) return { dir: '', name: path };
  return { dir: path.slice(0, idx + 1), name: path.slice(idx + 1) };
}

export default function FileChangeList(props: FileChangeListProps) {
  return (
    <ul class="file-change-list">
      <For each={props.files}>
        {(file) => {
          const parts = splitPath(file.path);
          return (
            <li>
              <button
                type="button"
                class="file-change-row"
                classList={{ 'file-change-row-active': props.selected === file.path }}
                aria-current={props.selected === file.path ? 'true' : undefined}
                onClick={() => props.onSelect(file.path)}
                title={file.path}
              >
                <span class={`file-status file-status-${file.status}`}>
                  {STATUS_LABEL[file.status]}
                </span>
                <span class="file-change-path">
                  <span class="file-change-name">{parts.name}</span>
                  <Show when={parts.dir}>
                    <span class="file-change-dir">{parts.dir}</span>
                  </Show>
                </span>
                <span class="file-change-stats">
                  <Show when={file.additions > 0}>
                    <span class="stat-add">+{file.additions}</span>
                  </Show>
                  <Show when={file.deletions > 0}>
                    <span class="stat-del">−{file.deletions}</span>
                  </Show>
                </span>
              </button>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
