import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SpatialTextLayer } from '../../src/player/SpatialTextLayer';
import { compileSpatialScript } from '../../src/player/spatialText';

it('renders active dialogue and prior echo on the same spatial stage', () => {
  const script = compileSpatialScript([
    { type: 'dialogue', speaker: 'protagonist', text: '……柏勳。', presentation: { beats: ['……柏勳。'], beatMs: 200, pauseAfterMs: 50, echoMs: 1000 } },
    { type: 'dialogue', speaker: 'wakaharu', text: '柏勳？', presentation: { beats: ['柏勳？'], beatMs: 300, echoMs: 800 } },
  ]);

  const { container } = render(<SpatialTextLayer script={script} elapsedMs={260} />);
  expect(screen.getByLabelText('場景文字')).toBeDefined();
  expect(screen.getByText('柏勳？')).toBeDefined();

  const active = container.querySelector('[data-speaker="wakaharu"]:not(.text-echo)');
  const echo = container.querySelector('[data-speaker="protagonist"].text-echo');
  expect(active?.getAttribute('data-anchor')).toBe('right');
  expect(echo?.getAttribute('data-anchor')).toBe('lower-left');
});
