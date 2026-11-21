import { describe, expect, test } from 'bun:test'

import {
  MAX_EVENTS,
  formatEvent,
  formatEventCount,
  formatPingResult,
  prependEvent,
  type WatchEventLike,
} from '#/lib/format'

function ev(seq: number, kind = 'tick(1s)'): WatchEventLike {
  return { seq: BigInt(seq), at: `2026-11-21T15:00:0${seq}Z`, kind }
}

describe('prependEvent', () => {
  test('新事件插到最前面', () => {
    const got = prependEvent([ev(1)], ev(2))
    expect(got.map((e) => e.seq)).toEqual([2n, 1n])
  })

  test('不修改原数组', () => {
    const original = [ev(1)]
    prependEvent(original, ev(2))
    expect(original).toHaveLength(1)
  })

  test('超过上限时丢弃最旧的', () => {
    // 列表约定「最新在前」，所以末尾元素是最旧的。
    const full = Array.from({ length: MAX_EVENTS }, (_, i) => ev(MAX_EVENTS - i))
    const got = prependEvent(full, ev(999))
    expect(got).toHaveLength(MAX_EVENTS)
    expect(got[0].seq).toBe(999n)
    // 最旧的 seq=1 在末尾，应被挤出。
    expect(got.some((e) => e.seq === 1n)).toBe(false)
    // 次旧的 seq=2 仍在列表里。
    expect(got.some((e) => e.seq === 2n)).toBe(true)
  })

  test('自定义上限生效', () => {
    const got = prependEvent([ev(1), ev(2), ev(3)], ev(4), 2)
    expect(got.map((e) => e.seq)).toEqual([4n, 1n])
  })

  test('上限为 0 时返回空数组', () => {
    expect(prependEvent([ev(1)], ev(2), 0)).toEqual([])
  })

  test('上限为负数时返回空数组', () => {
    expect(prependEvent([ev(1)], ev(2), -3)).toEqual([])
  })

  test('空列表也能插入', () => {
    const got = prependEvent([], ev(1))
    expect(got).toHaveLength(1)
    expect(got[0].seq).toBe(1n)
  })
})

describe('formatPingResult', () => {
  test('三个字段用分隔符连接', () => {
    const got = formatPingResult({
      message: 'hello',
      version: 'dev',
      serverTime: '2026-11-21T15:00:00Z',
    })
    expect(got).toBe('hello · dev · 2026-11-21T15:00:00Z')
  })

  test('空字段用占位符替代', () => {
    const got = formatPingResult({ message: '', version: '', serverTime: '' })
    expect(got).toBe('- · - · -')
  })

  test('部分为空时只替换该字段', () => {
    const got = formatPingResult({
      message: 'hi',
      version: '',
      serverTime: '2026-11-21T15:00:00Z',
    })
    expect(got).toBe('hi · - · 2026-11-21T15:00:00Z')
  })
})

describe('formatEvent', () => {
  test('按 seq/kind/at 顺序拼接', () => {
    const got = formatEvent({ seq: 7n, at: 'T', kind: 'tick(2s)' })
    expect(got).toBe('#7 · tick(2s) · T')
  })

  test('bigint 转成不带 n 后缀的十进制', () => {
    const got = formatEvent({ seq: 1234567890123n, at: 'T', kind: 'k' })
    expect(got).toBe('#1234567890123 · k · T')
  })
})

describe('formatEventCount', () => {
  test('0 也照常显示', () => {
    expect(formatEventCount(0)).toBe('0 event(s)')
  })

  test('正数', () => {
    expect(formatEventCount(12)).toBe('12 event(s)')
  })
})
