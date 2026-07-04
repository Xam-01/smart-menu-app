import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(__dirname, '../..');

describe('frontend packaging boundaries', () => {
  it('does not depend on the project-level design reference folder at runtime', () => {
    const mainSource = readFileSync(resolve(frontendRoot, 'src/main.tsx'), 'utf8');
    const viteConfig = readFileSync(resolve(frontendRoot, 'vite.config.ts'), 'utf8');

    expect(mainSource).not.toContain('../../design');
    expect(viteConfig).not.toContain('../design');
  });
});
