import { describe, test, expect } from 'bun:test';
import {
  formatChannelList,
  formatMessages,
  formatDownloadedAttachment,
} from '../extensions/discord/format.js';
import type { DiscordChannel, ReadMessagesResult } from '../extensions/discord/client/channels.js';
import type { DownloadedAttachment } from '../extensions/discord/client/attachments.js';

describe('formatChannelList', () => {
  test('handles empty list', () => {
    expect(formatChannelList([], '999')).toContain('No text channels');
  });

  test('formats channels with type marker and topic', () => {
    const channels: DiscordChannel[] = [
      { id: '1', name: 'general', type: 0, topic: 'General chat' },
      { id: '2', name: 'announcements', type: 5, topic: '' },
    ];

    const output = formatChannelList(channels, '999');
    expect(output).toContain('# **general**');
    expect(output).toContain('📣 **announcements**');
    expect(output).toContain('General chat');
    expect(output).toContain('(1)');
  });
});

describe('formatMessages', () => {
  test('handles empty messages', () => {
    const result: ReadMessagesResult = { messages: [] };
    expect(formatMessages(result, '123')).toContain('No messages');
  });

  test('formats messages oldest-first with reactions and attachments', () => {
    // Input is newest-first (as Discord returns it).
    const result: ReadMessagesResult = {
      messages: [
        {
          id: '200',
          author: 'bob',
          authorId: 'u2',
          isBot: false,
          content: 'second',
          timestamp: '2024-01-01T00:01:00.000Z',
        },
        {
          id: '100',
          author: 'alice',
          authorId: 'u1',
          isBot: false,
          content: 'first',
          timestamp: '2024-01-01T00:00:00.000Z',
          reactions: [{ name: '👍', count: 3 }],
          attachments: [
            {
              id: 'a1',
              filename: 'screenshot.png',
              size: 1000,
              url: 'https://cdn.discordapp.com/x/screenshot.png',
            },
          ],
        },
      ],
    };

    const output = formatMessages(result, '123');
    // oldest ("first") should appear before newest ("second")
    expect(output.indexOf('first')).toBeLessThan(output.indexOf('second'));
    expect(output).toContain('alice');
    expect(output).toContain('👍 3');
    expect(output).toContain('📎');
    expect(output).toContain('screenshot.png');
  });

  test('marks bot authors and edits', () => {
    const result: ReadMessagesResult = {
      messages: [
        {
          id: '1',
          author: 'webhook',
          authorId: 'u3',
          isBot: true,
          content: 'hi',
          timestamp: '2024-01-01T00:00:00.000Z',
          editedTimestamp: '2024-01-01T00:05:00.000Z',
        },
      ],
    };
    const output = formatMessages(result, '123');
    expect(output).toContain('[bot]');
    expect(output).toContain('(edited)');
  });
});

describe('formatDownloadedAttachment', () => {
  test('includes read hint for images', () => {
    const result: DownloadedAttachment = {
      url: 'https://cdn.discordapp.com/x/photo.png',
      filename: 'photo.png',
      localPath: '/tmp/pi-discord-files/123-photo.png',
      isImage: true,
    };
    const output = formatDownloadedAttachment(result);
    expect(output).toContain('`read');
    expect(output).toContain('/tmp/pi-discord-files/123-photo.png');
  });

  test('shows download path for non-images', () => {
    const result: DownloadedAttachment = {
      url: 'https://cdn.discordapp.com/x/doc.pdf',
      filename: 'doc.pdf',
      localPath: '/tmp/pi-discord-files/123-doc.pdf',
      isImage: false,
    };
    const output = formatDownloadedAttachment(result);
    expect(output).toContain('📁 Downloaded to:');
    expect(output).not.toContain('`read');
  });
});
