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
    <div class="ai-chat" classList={{ 'ai-chat-open': open() }}>
      <button
        type="button"
        class="ai-chat-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open()}
      >
        <Icon name="robot" size={18} />
        <span>Ask AI</span>
      </button>

      <Show when={open()}>
        <aside class="ai-chat-window" aria-label="AI chat">
          <div class="ai-chat-header">
            <h2 class="ai-chat-title">
              <Icon name="robot" size={16} />
              Ask about this PR
            </h2>
            <button
              type="button"
              class="ai-chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <div class="ai-chat-messages">
            <Show when={store.aiChat.messages.length === 0 && !store.aiChat.loading}>
              <p class="ai-chat-hint">
                Ask anything about the changes, the diff, or why something was done.
              </p>
            </Show>
            <For each={store.aiChat.messages}>
              {(message) => (
                <div class={`ai-chat-message ai-chat-message-${message.role}`}>
                  <p>{message.content}</p>
                </div>
              )}
            </For>
            <Show when={store.aiChat.loading && store.aiChat.streamingContent}>
              <div class="ai-chat-message ai-chat-message-assistant ai-chat-message-streaming">
                <p>{store.aiChat.streamingContent}</p>
              </div>
            </Show>
          </div>

          <form class="ai-chat-form" onSubmit={submit}>
            <div class="ai-chat-input-row">
              <input
                id="ai-chat-input"
                class="ai-chat-input"
                placeholder="Ask about this PR"
                value={input()}
                onInput={(event) => setInput(event.currentTarget.value)}
                disabled={store.aiChat.loading}
              />
              <button
                type="submit"
                class="ai-chat-submit"
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
