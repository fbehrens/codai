import { readFileSync } from 'fs';
import * as path from 'path';
import { Config } from '../codai';
import { CoreMessage } from 'ai';

export type Detail = 'low' | 'high';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converts message to ChatGPT and extracts ![](url) to chatGpts ChatCompletionMessageParam
 */
export function chatGpt(m: CoreMessage, c: Config): CoreMessage {
  function imageTag(url: string) {
    if (!url.startsWith('http')) {
      const filename = path.resolve(c.dir, url);
      return {
        type: 'image',
        image: readFileSync(filename),
      };
    }
    return {
      type: 'image',
      image: new URL(url),
    };
  }

  const regexp = /!\[[^\]]*\]\((.*?)\)/g;
  const content = m.content as string;
  const imagesStr = [...content.matchAll(regexp)].map((match) => match[1]);
  const images = imagesStr.map(imageTag);
  if (images.length) {
    const content_ = content.replaceAll(regexp, '');
    return {
      role: m.role,
      content: [
        {
          type: 'text',
          text: content_,
        },
        ...images,
      ],
    } as CoreMessage;
  }
  return m as CoreMessage;
}

export function parse(dialog: string): CoreMessage[] {
  const roles = 'function:|user:|system:|assistant:|dalle:';
  const dialog1 = dialog.replace(
    new RegExp(`\n(#+ )?(?<role>${roles})`, 'g'),
    '\n$<role>'
  ); // ## user: -> user:
  const paragraphs = dialog1.split(new RegExp(`\n(?=${roles})`));
  //   let result: ChatCompletionMessageParam[] = [];
  const result: CoreMessage[] = [];
  for (const paragraph of paragraphs) {
    const colon = paragraph.indexOf(':');
    const r = paragraph.slice(0, colon);
    const content = paragraph.slice(colon + 1).trim();
    const role = r as 'system' | 'user' | 'assistant';
    const m: CoreMessage = { role, content };
    // const mes = await encodeImage(role, content);
    result.push(m);
  }
  // postprrocessing
  // start from last system prompt
  const lastSystemIndex = result.findLastIndex((e) => e.role === 'system');
  const fromLastS = result.slice(lastSystemIndex);
  if (fromLastS[0].content === '') {
    const lastSystemContentIndex = result.findLastIndex(
      (e) => e.role === 'system' && e.content !== ''
    );
    fromLastS[0].content = result[lastSystemContentIndex].content;
  }

  return fromLastS;
}
