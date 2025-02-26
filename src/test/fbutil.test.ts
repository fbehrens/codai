import { describe, it, expect } from 'vitest';
import * as Fbutil from '../lib/fbutil';
import { Config } from '../codai';
import { openai } from '@ai-sdk/openai';
import { DataContent, ImagePart } from 'ai';

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
      const result = Fbutil.parse(dialog);
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
      const result = Fbutil.parse(dialog1);
      expect(result).toStrictEqual([
        { role: 'system', content: 'You are a cat' },
        { role: 'user', content: 'What do you eat' },
      ]);
    });
  });
  describe('Image', async () => {
    it('http', async () => {
      const mes = Fbutil.parse(`user: Hello Hello![](http://image)`);
      const result = Fbutil.chatGpt(mes[0], c);
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
    it('local base64', async () => {
      const m = await Fbutil.parse(`user: Hello Hello![](fbehrens.jpeg)`);
      const mp = await Fbutil.chatGpt(m[0], c);
      const text = mp.content[0];
      expect(text).toStrictEqual({ type: 'text', text: 'Hello Hello' });

      const image = mp.content[1] as ImagePart;
      expect(image.type).toBe('image');
      const dc = image.image as DataContent;
      expect(dc.toString().length).toBe(1336);
    });
  });
});
console.log(new Date().toLocaleTimeString());
