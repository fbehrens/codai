import { describe, it, expect } from 'vitest';
import * as Fbutil from '../lib/fbutil';
import { Config } from '../codai';
import { openai } from '@ai-sdk/openai';
import { DataContent, ImagePart, TextPart } from 'ai';

const c: Config = {
  model: openai('gpt-4o'),
  detail: 'low',
  dir: '/Users/fb/Documents/Github/codai/examples',
  out: (s: string) => {},
  languageId: 'markdown',
};

describe('Fbutil', () => {
  describe('parse', async () => {
    const dialog = `## ignore
this
# system: ignore this sytem message
# system: You are a cat
## user: Hello Hello,
I am here.
assistant:  How are you?
user: I am`;
    it('default', async () => {
      const result = Fbutil.parse(dialog, c);
      expect(result).toStrictEqual([
        { role: 'system', content: 'You are a cat' },
        { role: 'user', content: 'Hello Hello,\nI am here.' },
        { role: 'assistant', content: 'How are you?' },
        { role: 'user', content: 'I am' },
      ]);
    });
    it('empty system message fills itself from last', async () => {
      const dialog1 = `${dialog}
system:
user: What do you eat`;
      const result = Fbutil.parse(dialog1, c);
      expect(result).toStrictEqual([
        { role: 'system', content: 'You are a cat' },
        { role: 'user', content: 'What do you eat' },
      ]);
    });
  });
  describe('Image', async () => {
    it('http', async () => {
      const result = Fbutil.parse(`user: Hello Hello![](http://image)`, c)[0]!;

      expect(result).toStrictEqual({
        role: 'user',
        content: [
          { type: 'text', text: 'Hello Hello' },
          {
            type: 'image',
            image: new URL('http://image'),
          },
        ],
      });
    });
    it('local base64', () => {
      const mp = Fbutil.parse(`user: Hello Hello![](fbehrens.jpeg)`, c)[0]!;
      const [text, { type, image }] = mp.content as [TextPart, ImagePart];
      expect(text).toStrictEqual({ type: 'text', text: 'Hello Hello' });
      expect(type).toBe('image');
      expect((image as DataContent).toString().length).toBe(1336);
    });
  });
});
console.log(new Date().toLocaleTimeString());
