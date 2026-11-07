import { buildScript } from '../src/script/validate';
import { loadScriptFromDisk } from './harness';

/** One chapter-1 file; `scenes` is the YAML under `scenes:`, already indented two spaces. */
const chapter = (scenes: string, head = '') => `
chapter: 1
title: 測試
start: s1
${head}
scenes:
${scenes}
`;

const build = (source: string) => buildScript([{ name: 'a.yaml', source }]);

describe('reachability from every way into a chapter', () => {
  it('a scene only the morning restart leads to is reachable', () => {
    const source = chapter(`
  - id: s1
    beats:
      - end: reset
  - id: s2
    beats:
      - goto: s3
  - id: s3
    beats:
      - end: reset
`, 'restart: s2');
    expect(build(source).errors).toEqual([]);
  });

  it('a scene neither start nor restart reaches is still an error', () => {
    const source = chapter(`
  - id: s1
    beats:
      - end: reset
  - id: s2
    beats:
      - end: reset
`);
    expect(build(source).errors.join('\n')).toContain('s2：從 start 都無法到達');
  });

  it('a restart that can never reach an end is an error', () => {
    const source = chapter(`
  - id: s1
    beats:
      - end: reset
  - id: s2
    beats:
      - goto: s2
`, 'restart: s2');
    expect(build(source).errors.join('\n')).toContain('restart「s2」走不到任何 end');
  });
});

describe('a choice that could leave her with nothing to pick', () => {
  const stuck = (source: string) => build(source).warnings.filter((warning) => warning.includes('選擇可能卡住'));
  const scene = (choice: string, before = '') => chapter(`
  - id: s1
    beats:
      - set: [a, b]
${before}
      - choice:
${choice}
      - if: flag.a || flag.b
        then: []
      - end: reset
`);

  it('warns when every option can be hidden at once', () => {
    expect(stuck(scene(`          options:
            - { text: 一, if: flag.a }
            - { text: 二, if: flag.b }`))).toHaveLength(1);
  });

  it('warns when the only open option can be disabled and nothing happens on silence', () => {
    expect(stuck(scene(`          timeout: 5
          options:
            - { text: 一, disabled_if: flag.a }`))).toHaveLength(1);
  });

  it('a pair of options that cover each other is fine', () => {
    expect(stuck(scene(`          options:
            - { text: 一, if: "!flag.a" }
            - { text: 二, if: flag.a || flag.b }`))).toEqual([]);
  });

  it('silence with a clock is a way out', () => {
    expect(stuck(scene(`          timeout: 5
          options:
            - { text: 一, if: flag.a }
          silence:
            - pause: 1`))).toEqual([]);
  });

  it('an enclosing if can guarantee an option', () => {
    const source = chapter(`
  - id: s1
    beats:
      - set: a
      - if: flag.a
        then:
          - choice:
              options:
                - { text: 一, if: flag.a }
      - end: reset
`);
    expect(stuck(source)).toEqual([]);
  });

  it('…unless something in between could change what the if checked', () => {
    const source = chapter(`
  - id: s1
    beats:
      - set: a
      - if: "!flag.a"
        then:
          - set: a
          - choice:
              options:
                - { text: 一, if: "!flag.a" }
      - end: reset
`);
    expect(stuck(source)).toHaveLength(1);
  });

  it('a memory to say out loud is not a way out: she may not carry it', () => {
    const source = chapter(`
  - id: s1
    beats:
      - { narr: 一句話, mem: m_x }
      - set: a
      - choice:
          options:
            - { text: 一, if: flag.a }
            - recall:
                accept:
                  - { mem: m_x, then: [] }
      - end: reset
`);
    expect(stuck(source)).toHaveLength(1);
  });
});

describe('state that is written but never read', () => {
  it('warns about a loop flag no condition in its chapter reads', () => {
    const { errors, warnings } = build(chapter(`
  - id: s1
    beats:
      - set: [c1_used, c1_unused]
      - if: flag.c1_used
        then: []
      - end: reset
`));
    expect(errors).toEqual([]);
    expect(warnings.filter((warning) => warning.includes('沒有任何條件讀它'))).toEqual([expect.stringContaining('c1_unused')]);
  });

  it('warns about knowledge nothing ever checks, and counts later.X as a read', () => {
    const { warnings } = build(chapter(`
  - id: s1
    beats:
      - learn: [k_used, k_unused]
      - { narr: 聽見了, learn: k_line }
      - if: know.k_used || know.k_line
        then: []
      - end: reset
`));
    expect(warnings.filter((warning) => warning.includes('從來沒有被'))).toEqual([expect.stringContaining('k_unused')]);
  });
});

describe('the story itself', () => {
  const report = loadScriptFromDisk();
  it('has no choice that can get stuck and no state nobody reads', () => {
    const dead = report.warnings.filter((warning) => /選擇可能卡住|沒有任何條件讀它|從來沒有被 know/.test(warning));
    expect(dead).toEqual([]);
  });
});
