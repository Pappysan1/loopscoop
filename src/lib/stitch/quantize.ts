export type Sample = { r: number; g: number; b: number }

export type QuantizeResult = {
  palette: Sample[]
  assign: (sample: Sample) => number
}

function dist2(a: Sample, b: Sample) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
}

function rand(seed: { n: number }) {
  seed.n = (seed.n * 1664525 + 1013904223) >>> 0
  return seed.n / 0xffffffff
}

export function quantize(samples: Sample[], kRaw: number): QuantizeResult {
  const k = Math.max(1, Math.min(32, Math.round(Number.isFinite(kRaw) ? kRaw : 1)))
  if (!samples.length) {
    return {
      palette: [],
      assign: () => -1,
    }
  }

  const seed = { n: 1234567 + samples.length + k }
  const palette: Sample[] = []
  const first = samples[Math.floor(rand(seed) * samples.length)] ?? samples[0]
  palette.push({ ...first })

  const nearest: number[] = new Array(samples.length)
  const minD: number[] = new Array(samples.length)
  for (let i = 0; i < samples.length; i++) minD[i] = dist2(samples[i], palette[0])

  while (palette.length < k) {
    let sum = 0
    for (let i = 0; i < samples.length; i++) sum += minD[i]
    if (sum <= 0) break
    let pick = rand(seed) * sum
    let chosen = samples[0]
    for (let i = 0; i < samples.length; i++) {
      pick -= minD[i]
      if (pick <= 0) {
        chosen = samples[i]
        break
      }
    }
    palette.push({ ...chosen })
    for (let i = 0; i < samples.length; i++) {
      const d = dist2(samples[i], chosen)
      if (d < minD[i]) minD[i] = d
    }
  }

  const counts = new Array(palette.length).fill(0)
  const acc = palette.map(() => ({ r: 0, g: 0, b: 0 }))

  const assignIndex = (s: Sample) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < palette.length; i++) {
      const d = dist2(s, palette[i])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  for (let iter = 0; iter < 12; iter++) {
    counts.fill(0)
    for (const a of acc) {
      a.r = 0
      a.g = 0
      a.b = 0
    }
    for (let i = 0; i < samples.length; i++) {
      const idx = assignIndex(samples[i])
      nearest[i] = idx
      counts[idx]++
      acc[idx].r += samples[i].r
      acc[idx].g += samples[i].g
      acc[idx].b += samples[i].b
    }
    let moved = false
    for (let i = 0; i < palette.length; i++) {
      if (!counts[i]) continue
      const nr = acc[i].r / counts[i]
      const ng = acc[i].g / counts[i]
      const nb = acc[i].b / counts[i]
      if (nr !== palette[i].r || ng !== palette[i].g || nb !== palette[i].b) {
        palette[i] = { r: nr, g: ng, b: nb }
        moved = true
      }
    }
    if (!moved) break
  }

  return {
    palette,
    assign: (sample: Sample) => (palette.length ? assignIndex(sample) : -1),
  }
}

export function rgbToHex(s: Sample) {
  const r = Math.max(0, Math.min(255, Math.round(s.r)))
  const g = Math.max(0, Math.min(255, Math.round(s.g)))
  const b = Math.max(0, Math.min(255, Math.round(s.b)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
