import type { CSSProperties } from 'react'
import type { MillimeterPoint, MillimeterRect } from '../../../contracts/design-spec/design-spec'

export type DisplayRect = {
  left: number
  top: number
  width: number
  height: number
}

export function millimetersToPixels(valueMm: number, displayWidthPx: number, physicalWidthMm: number) {
  return valueMm * (displayWidthPx / physicalWidthMm)
}

export function pointToDisplayPixels(point: MillimeterPoint, displayWidthPx: number, physicalWidthMm: number) {
  return {
    x: millimetersToPixels(point.xMm, displayWidthPx, physicalWidthMm),
    y: millimetersToPixels(point.yMm, displayWidthPx, physicalWidthMm),
  }
}

export function rectToDisplayPixels(rect: MillimeterRect, displayWidthPx: number, physicalWidthMm: number): DisplayRect {
  return {
    left: millimetersToPixels(rect.xMm, displayWidthPx, physicalWidthMm),
    top: millimetersToPixels(rect.yMm, displayWidthPx, physicalWidthMm),
    width: millimetersToPixels(rect.widthMm, displayWidthPx, physicalWidthMm),
    height: millimetersToPixels(rect.heightMm, displayWidthPx, physicalWidthMm),
  }
}

export function displayRectStyle(rect: DisplayRect): CSSProperties {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}
