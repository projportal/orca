import { G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg'
import {
  arrowHeadLength,
  arrowHeadPoints,
  estimateLabelWidth,
  polylinePathData
} from './markup-geometry'
import type { MarkupShape } from './markup-model'

const DARK_INKS = new Set(['#111111'])

/** One markup shape in image-pixel coordinates; the parent Svg's viewBox maps it onto the frame. */
export function MobileMarkupShape({ shape }: { shape: MarkupShape }) {
  switch (shape.kind) {
    case 'pen':
      return (
        <Path
          d={polylinePathData(shape.points)}
          stroke={shape.color}
          strokeWidth={shape.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )
    case 'arrow': {
      const [left, right] = arrowHeadPoints(
        shape.from,
        shape.to,
        arrowHeadLength(shape.from, shape.to, shape.width)
      )
      return (
        <G>
          <Line
            x1={shape.from.x}
            y1={shape.from.y}
            x2={shape.to.x}
            y2={shape.to.y}
            stroke={shape.color}
            strokeWidth={shape.width}
            strokeLinecap="round"
          />
          <Polyline
            points={`${left.x},${left.y} ${shape.to.x},${shape.to.y} ${right.x},${right.y}`}
            stroke={shape.color}
            strokeWidth={shape.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      )
    }
    case 'rect':
      return (
        <Rect
          x={shape.rect.x}
          y={shape.rect.y}
          width={shape.rect.width}
          height={shape.rect.height}
          stroke={shape.color}
          strokeWidth={shape.width}
          strokeLinejoin="round"
          fill="none"
        />
      )
    case 'text': {
      const pad = shape.fontSize * 0.35
      const width = estimateLabelWidth(shape.text, shape.fontSize)
      const height = shape.fontSize + pad * 2
      const backing = DARK_INKS.has(shape.color) ? 'rgba(255,255,255,0.88)' : 'rgba(17,17,17,0.78)'
      return (
        <G>
          <Rect
            x={shape.at.x}
            y={shape.at.y - height / 2}
            width={width}
            height={height}
            rx={height / 4}
            fill={backing}
          />
          <SvgText
            x={shape.at.x + shape.fontSize * 0.4}
            y={shape.at.y + shape.fontSize * 0.35}
            fill={shape.color}
            fontSize={shape.fontSize}
            fontWeight="600"
          >
            {shape.text}
          </SvgText>
        </G>
      )
    }
  }
}
