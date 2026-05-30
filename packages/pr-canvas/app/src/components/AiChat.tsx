import { For, Show, createSignal } from 'solid-js';
import { usePrStore } from '~/lib/context';
import Icon from '~/components/Icon';

interface AiChatProps {
  prNumber: number;
}

export default function AiChat(props: AiChatProps) {
  const { store, sendAiChat } = usePrStore();
  const [open, setOpen] = createSignal(false);
  const [input, setInput] = createSignal('');

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const message = input().trim();
    if (!message || store.aiChat.loading) return;
    sendAiChat(message, props.prNumber);
    setInput('');
  };

  return (
    <div class="pointer-events-none" classList={{ 'ai-chat-open': open() }}>
      <button
        type="button"
        class="fixed bottom-5 right-5 z-[35] inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-light bg-bg-tertiary px-4 py-2.5 font-semibold text-text-primary shadow-[0_8px_24px_rgba(1,4,9,0.5)] transition-[border-color,background-color,transform] duration-[120ms] pointer-events-auto hover:border-accent hover:bg-[#222831] active:translate-y-px"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open()}
      >
        <Icon name="robot" size={18} />
        <span>Ask AI</span>
      </button>

      <Show when={open()}>
        <aside class="chat-window-enter fixed bottom-[76px] right-5 z-40 grid h-[min(60vh,520px)] w-[min(calc(100vw-40px),380px)] grid-rows-[auto_1fr_auto] rounded-[10px] border border-border bg-bg-secondary shadow-[0_16px_48px_rgba(1,4,9,0.55)] pointer-events-auto" aria-label="AI chat">
          <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
            <h2 class="m-0 inline-flex items-center gap-2 text-[15px] font-semibold">
              <Icon name="robot" size={16} />
              Ask about this PR
            </h2>
            <button
              type="button"
              class="icon-button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <div class="grid content-start gap-2.5 overflow-y-auto p-4">
            <Show when={store.aiChat.messages.length === 0 && !store.aiChat.loading}>
              <p class="m-0 text-[13px] text-text-muted">
                Ask anything about the changes, the diff, or why something was done.
              </p>
            </Show>
            <For each={store.aiChat.messages}>
              {(message) => (
                <div class={`max-w-[90%] rounded-xl border border-border bg-bg-tertiary px-3 py-2.5 ${message.role === 'user' ? 'justify-self-end border-accent/40 bg-blue/[0.18]' : 'justify-self-start'}`}>
                  <p class="m-0 whitespace-pre-wrap">{message.content}</p>
                </div>
              )}
            </For>
            <Show when={store.aiChat.loading && store.aiChat.streamingContent}>
              <div class="max-w-[90%] justify-self-start rounded-xl border border-purple/40 bg-bg-tertiary px-3 py-2.5">
                <p class="m-0 whitespace-pre-wrap">{store.aiChat.streamingContent}</p>
              </div>
            </Show>
          </div>

          <form class="border-t border-border px-4 py-3.5" onSubmit={submit}>
            <div class="flex gap-2">
              <input
                id="ai-chat-input"
                class="h-9 min-w-0 flex-1 rounded-sm border border-border bg-bg-primary px-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:shadow-[0_0_0_2px_rgba(88,166,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ask about this PR"
                value={input()}
                onInput={(event) => setInput(event.currentTarget.value)}
                disabled={store.aiChat.loading}
              />
              <button
                type="submit"
                class="inline-flex w-10 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border bg-accent text-[#04101f] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={store.aiChat.loading || !input().trim()}
                aria-label="Send message"
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          </form>
        </aside>
      </Show>
    </div>
  );
}
