import { For, Show, createSignal } from 'solid-js';
import { usePrStore } from '~/lib/context';

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
      <button type="button" class="ai-chat-toggle" onClick={() => setOpen((value) => !value)}>
        🤖 AI Chat
      </button>

      <Show when={open()}>
        <aside class="ai-chat-panel" aria-label="AI chat">
          <div class="ai-chat-header">
            <h2 class="ai-chat-title">AI Chat</h2>
            <button type="button" class="ai-chat-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div class="ai-chat-messages">
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
            <label class="ai-chat-input-label" for="ai-chat-input">Ask about this PR</label>
            <div class="ai-chat-input-row">
              <input
                id="ai-chat-input"
                class="ai-chat-input"
                value={input()}
                onInput={(event) => setInput(event.currentTarget.value)}
                disabled={store.aiChat.loading}
              />
              <button type="submit" class="ai-chat-submit" disabled={store.aiChat.loading || !input().trim()}>
                Send
              </button>
            </div>
          </form>
        </aside>
      </Show>
    </div>
  );
}
