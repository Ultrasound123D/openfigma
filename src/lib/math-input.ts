/**
 * PHASE 23 (F9) — math expressions in number inputs.
 * Source parity: `evaluateMathExpression(e,t){let i=(0,so.O4)(e,t);
 *   return i.error?null:i.value}` (9456/3835 shared editor bundles,
 * properties_panel namespace). Figma evaluates simple arithmetic on commit.
 *
 * Supported grammar (safe, no eval):
 *   numbers (int/decimal), + - * / % operators, parentheses, unary minus.
 *   Relative forms resolved against `current`:
 *     "+20"   → current + 20
 *     "-5"    → current - 5   (only when current is provided)
 *     "*2"    → current * 2
 *     "/3"    → current / 3
 *   Plain expressions: "100/2" → 50, "(8+2)*3" → 30
 */

/** Tokens: numbers, operators, parens. */
type Token = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'paren'; v: '(' | ')' }

function tokenize(src: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  const s = src.replace(/\s+/g, '')
  while (i < s.length) {
    const c = s[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const numStr = s.slice(i, j)
      if ((numStr.match(/\./g) || []).length > 1) return null
      const n = parseFloat(numStr)
      if (isNaN(n)) return null
      tokens.push({ t: 'num', v: n })
      i = j
    } else if ('+-*/%'.includes(c)) {
      tokens.push({ t: 'op', v: c })
      i++
    } else if (c === '(' || c === ')') {
      tokens.push({ t: 'paren', v: c })
      i++
    } else {
      return null // any other character → not a math expression
    }
  }
  return tokens.length ? tokens : null
}

/** Recursive-descent parser: expr := term (('+'|'-') term)* ; term := factor (('*'|'/'|'%') factor)* ; factor := ('-'|'+')* primary ; primary := num | '(' expr ')' */
function parse(tokens: Token[]): number | null {
  let pos = 0
  const peek = () => tokens[pos]

  function primary(): number | null {
    const tk = peek()
    if (!tk) return null
    if (tk.t === 'num') { pos++; return tk.v }
    if (tk.t === 'paren' && tk.v === '(') {
      pos++
      const v = expr()
      const close = peek()
      if (v === null || !close || close.t !== 'paren' || close.v !== ')') return null
      pos++
      return v
    }
    return null
  }

  function factor(): number | null {
    const tk = peek()
    if (tk && tk.t === 'op' && (tk.v === '-' || tk.v === '+')) {
      pos++
      const f = factor()
      if (f === null) return null
      return tk.v === '-' ? -f : f
    }
    return primary()
  }

  function term(): number | null {
    let left = factor()
    if (left === null) return null
    for (;;) {
      const tk = peek()
      if (tk && tk.t === 'op' && (tk.v === '*' || tk.v === '/' || tk.v === '%')) {
        pos++
        const right = factor()
        if (right === null) return null
        if (tk.v === '*') left = left * right
        else if (tk.v === '/') {
          if (right === 0) return null
          left = left / right
        } else left = left % right
      } else break
    }
    return left
  }

  function expr(): number | null {
    let left = term()
    if (left === null) return null
    for (;;) {
      const tk = peek()
      if (tk && tk.t === 'op' && (tk.v === '+' || tk.v === '-')) {
        pos++
        const right = term()
        if (right === null) return null
        left = tk.v === '+' ? left + right : left - right
      } else break
    }
    return left
  }

  const result = expr()
  if (result === null || pos !== tokens.length || !isFinite(result)) return null
  return result
}

/** Full evaluation: returns the resolved number, or null when the input is
 *  not a valid expression (caller keeps the last valid value). */
export function evaluateMathExpression(raw: string, current?: number): number | null {
  const s = raw.trim()
  if (!s) return null

  // Relative forms — only when a current value is supplied.
  if (current !== undefined && isFinite(current)) {
    const rel = /^([+\-*/])\s*(\d+(?:\.\d+)?)$/.exec(s)
    if (rel) {
      const operand = parseFloat(rel[2])
      switch (rel[1]) {
        case '+': return current + operand
        case '-': return current - operand
        case '*': return current * operand
        case '/': return operand === 0 ? null : current / operand
      }
    }
  }

  const tokens = tokenize(s)
  if (!tokens) return null
  return parse(tokens)
}

/** True when the string is a plain number (no expression) — used to decide
 *  whether to forward live keystrokes to the parent as-is. */
export function isPlainNumber(raw: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(raw.trim())
}
