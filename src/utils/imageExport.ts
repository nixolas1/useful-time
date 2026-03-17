import { toPng } from 'html-to-image'

export async function exportChartImage(selector: string = '[data-export]'): Promise<void> {
  const element = document.querySelector(selector) as HTMLElement
  if (!element) return
  const dataUrl = await toPng(element)
  const link = document.createElement('a')
  link.download = `useful-time-${new Date().toISOString().slice(0, 10)}.png`
  link.href = dataUrl
  link.click()
}
