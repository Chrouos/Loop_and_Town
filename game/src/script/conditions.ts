import type { Cond } from './types';

export type CondContext = {
  know: (id: string) => boolean;
  flag: (id: string) => boolean;
  mem: (id: string) => boolean;
  seen: (id: string) => boolean;
  loop: number;
  chloop: number;
};

// Grammar: or := and ('||' and)* ; and := unary ('&&' unary)* ; unary := '!' unary | '(' or ')' | atom
export function parseCond(source: string): Cond {
  const tokens = source.match(/\(|\)|&&|\|\||!(?!=)|>=|<=|==|>|<|[A-Za-z_][\w.]*|\d+/g) ?? [];
  const leftover = source.replace(/\(|\)|&&|\|\||!|>=|<=|==|>|<|[A-Za-z_][\w.]*|\d+|\s+/g, '');
  if (leftover.length > 0) throw new Error(`無法解析條件「${source}」`);
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const parseOr = (): Cond => {
    const args = [parseAnd()];
    while (peek() === '||') { take(); args.push(parseAnd()); }
    return args.length === 1 ? args[0] : { op: 'or', args };
  };
  const parseAnd = (): Cond => {
    const args = [parseUnary()];
    while (peek() === '&&') { take(); args.push(parseUnary()); }
    return args.length === 1 ? args[0] : { op: 'and', args };
  };
  const parseUnary = (): Cond => {
    const token = take();
    if (token === undefined) throw new Error(`條件不完整「${source}」`);
    if (token === '!') return { op: 'not', arg: parseUnary() };
    if (token === '(') {
      const inner = parseOr();
      if (take() !== ')') throw new Error(`括號不成對「${source}」`);
      return inner;
    }
    if (token === 'true') return { op: 'true' };
    if (token === 'false') return { op: 'false' };
    if (token === 'loop' || token === 'chloop') {
      const cmp = take();
      const value = take();
      if (!cmp || !['>=', '<=', '==', '>', '<'].includes(cmp) || !value || !/^\d+$/.test(value)) {
        throw new Error(`比較式錯誤「${source}」`);
      }
      return { op: 'cmp', left: token, cmp: cmp as '>=', value: Number(value) };
    }
    const match = /^(know|later|flag|mem|seen)\.(\w+)$/.exec(token);
    if (!match) throw new Error(`未知的條件「${token}」（在「${source}」）`);
    // later.X: something she can only know here by coming back to this day from a later chapter.
    if (match[1] === 'later') return { op: 'know', id: match[2], later: true };
    return { op: match[1] as 'know', id: match[2] };
  };

  const result = parseOr();
  if (index !== tokens.length) throw new Error(`條件多出內容「${source}」`);
  return result;
}

export function evalCond(cond: Cond, ctx: CondContext): boolean {
  switch (cond.op) {
    case 'true': return true;
    case 'false': return false;
    case 'know': return ctx.know(cond.id);
    case 'flag': return ctx.flag(cond.id);
    case 'mem': return ctx.mem(cond.id);
    case 'seen': return ctx.seen(cond.id);
    case 'not': return !evalCond(cond.arg, ctx);
    case 'and': return cond.args.every((arg) => evalCond(arg, ctx));
    case 'or': return cond.args.some((arg) => evalCond(arg, ctx));
    case 'cmp': {
      const left = ctx[cond.left];
      switch (cond.cmp) {
        case '>=': return left >= cond.value;
        case '<=': return left <= cond.value;
        case '==': return left === cond.value;
        case '>': return left > cond.value;
        case '<': return left < cond.value;
      }
    }
  }
  return false;
}

export function condRefs(cond: Cond, out: { op: string; id: string; later?: boolean }[] = []): { op: string; id: string; later?: boolean }[] {
  switch (cond.op) {
    case 'know': case 'flag': case 'mem': case 'seen': out.push(cond.later ? { op: cond.op, id: cond.id, later: true } : { op: cond.op, id: cond.id }); break;
    case 'not': condRefs(cond.arg, out); break;
    case 'and': case 'or': cond.args.forEach((arg) => condRefs(arg, out)); break;
    default: break;
  }
  return out;
}
