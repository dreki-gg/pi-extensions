import { describe, test, expect } from 'bun:test';
import {
  formatChannelList,
  formatMessages,
  formatThread,
  formatSearchResults,
  formatFileInfo,
  formatDownloadedFile,
  formatPostedMessage,
  formatEditedMessage,
} from '../extensions/slack/format.js';
import type { SlackChannel, ReadMessagesResult } from '../extensions/slack/client/channels.js';
import type { SearchResult } from '../extensions/slack/client/search.js';
import type { SlackFileInfo, DownloadedFile } from '../extensions/slack/client/files.js';

describe('formatChannelList', () => {
  test('handles empty list', () => {
    expect(formatChannelList([])).toBe('No channels found.');
  });

  test('formats channels with visibility icon', () => {
    const channels: SlackChannel[] = [
      {
        id: 'C123',
        name: 'general',
        isPrivate: false,
        isMember: true,
        topic: 'General discussion',
        purpose: '',
        numMembers: 42,
      },
      {
        id: 'C456',
        name: 'secret',
        isPrivate: true,
        isMember: true,
        topic: '',
        purpose: '',
        numMembers: 3,
      },
    ];

    const output = formatChannelList(channels);
    expect(output).toContain('# **general**');
    expect(output).toContain('🔒 **secret**');
    expect(output).toContain('42 members');
    expect(output).toContain('General discussion');
  });
});

describe('formatMessages', () => {
  test('handles empty messages', () => {
    const result: ReadMessagesResult = { messages: [], hasMore: false };
    expect(formatMessages(result, 'C123')).toContain('No messages');
  });

  test('formats messages with reactions and files', () => {
    const result: ReadMessagesResult = {
      messages: [
        {
          user: 'U123',
          text: 'Check this out',
          ts: '1700000000.000000',
          replyCount: 5,
          reactions: [{ name: 'thumbsup', count: 3 }],
          files: [
            {
              id: 'F001',
              name: 'screenshot.png',
              mimetype: 'image/png',
              urlPrivate: 'https://...',
            },
          ],
        },
      ],
      hasMore: true,
    };

    const output = formatMessages(result, 'C123');
    expect(output).toContain('U123');
    expect(output).toContain('Check this out');
    expect(output).toContain('[5 replies]');
    expect(output).toContain(':thumbsup:');
    expect(output).toContain('📎');
    expect(output).toContain('more available');
  });
});

describe('formatThread', () => {
  test('shows thread header', () => {
    const result: ReadMessagesResult = {
      messages: [{ user: 'U1', text: 'parent', ts: '1700000000.000' }],
      hasMore: false,
    };

    const output = formatThread(result, 'C123', '1700000000.000');
    expect(output).toContain('**Thread**');
    expect(output).toContain('1700000000.000');
  });
});

describe('formatSearchResults', () => {
  test('handles no results', () => {
    const result: SearchResult = { matches: [], total: 0 };
    expect(formatSearchResults(result, 'test')).toContain('No results');
  });

  test('formats matches with permalinks', () => {
    const result: SearchResult = {
      matches: [
        {
          channel: { id: 'C1', name: 'general' },
          user: 'alice',
          text: 'found it',
          ts: '1700000000.000',
          permalink: 'https://slack.com/archives/C1/p1700000000000',
        },
      ],
      total: 1,
    };

    const output = formatSearchResults(result, 'found');
    expect(output).toContain('alice');
    expect(output).toContain('#general');
    expect(output).toContain('🔗');
  });
});

describe('formatFileInfo', () => {
  test('formats image with dimensions', () => {
    const info: SlackFileInfo = {
      id: 'F001',
      name: 'design.png',
      title: 'Design Mockup',
      mimetype: 'image/png',
      filetype: 'png',
      size: 1048576,
      urlPrivate: 'https://...',
      permalink: 'https://slack.com/files/...',
      isImage: true,
      imageWidth: 1920,
      imageHeight: 1080,
    };

    const output = formatFileInfo(info);
    expect(output).toContain('1920×1080');
    expect(output).toContain('1.0 MB');
    expect(output).toContain('Design Mockup');
  });
});

describe('formatDownloadedFile', () => {
  test('includes read hint for images', () => {
    const result: DownloadedFile = {
      info: {
        id: 'F001',
        name: 'photo.jpg',
        title: 'Photo',
        mimetype: 'image/jpeg',
        filetype: 'jpg',
        size: 500000,
        urlPrivate: 'https://...',
        permalink: 'https://...',
        isImage: true,
      },
      localPath: '/tmp/pi-slack-files/F001-photo.jpg',
    };

    const output = formatDownloadedFile(result);
    expect(output).toContain('`read');
    expect(output).toContain('/tmp/pi-slack-files/F001-photo.jpg');
  });

  test('shows download path for non-images', () => {
    const result: DownloadedFile = {
      info: {
        id: 'F002',
        name: 'doc.pdf',
        title: 'Document',
        mimetype: 'application/pdf',
        filetype: 'pdf',
        size: 100000,
        urlPrivate: 'https://...',
        permalink: 'https://...',
        isImage: false,
      },
      localPath: '/tmp/pi-slack-files/F002-doc.pdf',
    };

    const output = formatDownloadedFile(result);
    expect(output).toContain('📁 Downloaded to:');
    expect(output).not.toContain('`read');
  });
});

describe('formatPostedMessage', () => {
  test('formats a top-level post', () => {
    const output = formatPostedMessage({ channel: 'C123', ts: '1700000000.000100' });
    expect(output).toContain('✅ Message posted to C123');
    expect(output).toContain('1700000000.000100');
    expect(output).not.toContain('thread');
  });

  test('formats a thread reply', () => {
    const output = formatPostedMessage(
      { channel: 'C123', ts: '1700000000.000200' },
      '1700000000.000100',
    );
    expect(output).toContain('thread 1700000000.000100 in C123');
  });
});

describe('formatEditedMessage', () => {
  test('formats an edited message', () => {
    const output = formatEditedMessage({ channel: 'C123', ts: '1700000000.000100' });
    expect(output).toContain('✏️');
    expect(output).toContain('C123');
    expect(output).toContain('1700000000.000100');
  });
});
