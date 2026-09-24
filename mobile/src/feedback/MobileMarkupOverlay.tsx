import { useMemo, useReducer, useRef, useState } from 'react'
import { Image, PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import Svg from 'react-native-svg'
import { TextInputModal } from '../components/TextInputModal'
import { colors } from '../theme/mobile-theme'
import type { FeedbackCapture } from './feedback-capture'
import {
  captureFeedbackView,
  cropFeedbackImage,
  feedbackCaptureStore,
  feedbackPixelRatio
} from './feedback-platform'
import { flattenMarkup, type FeedbackComposedImage } from './markup-flatten'
import {
  MARKUP_MIN_SHAPE_POINTS,
  MARKUP_STROKE_POINTS,
  MARKUP_TEXT_POINTS,
  canvasToImagePoint,
  computeContainFit,
  normalizeRect,
  pointsToImagePixels,
  type MarkupFit,
  type MarkupPoint,
  type MarkupRect,
  type MarkupSize
} from './markup-geometry'
import {
  canUndoMarkup,
  createMarkupState,
  draftShape,
  markupReducer,
  type MarkupState
} from './markup-model'
import { MobileMarkupShape } from './MobileMarkupShapes'
import { MobileMarkupToolbar } from './MobileMarkupToolbar'

type Props = {
  capture: FeedbackCapture
  onCancel: () => void
  onDone: (image: FeedbackComposedImage) => void
  onError: (message: string) => void
  /** Seeds the drawing (the demo route shows a drawn arrow and box without touch input). */
  initialState?: MarkupState
}

/**
 * The drawing surface over the frozen screenshot. It covers the browser viewport, so it takes
 * every touch there; the pane's own responder is also gated off while it is up.
 */
export function MobileMarkupOverlay({ capture, onCancel, onDone, onError, initialState }: Props) {
  const [state, dispatch] = useReducer(markupReducer, initialState ?? createMarkupState())
  const [area, setArea] = useState<MarkupSize | null>(null)
  const [busy, setBusy] = useState(false)
  const [textAt, setTextAt] = useState<MarkupPoint | null>(null)
  const canvasRef = useRef<View | null>(null)
  const image = useMemo(() => ({ width: capture.width, height: capture.height }), [capture])
  const fit = area ? computeContainFit(area, image) : null
  const fitRef = useRef<MarkupFit | null>(fit)
  fitRef.current = fit
  const stateRef = useRef(state)
  stateRef.current = state

  const responder = useMemo(() => {
    const toImage = (event: GestureResponderEvent): MarkupPoint | null => {
      const current = fitRef.current
      if (!current) {
        return null
      }
      const { locationX, locationY } = event.nativeEvent
      return canvasToImagePoint({ x: locationX, y: locationY }, current, image)
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const point = toImage(event)
        const current = fitRef.current
        if (!point || !current) {
          return
        }
        if (stateRef.current.tool === 'text') {
          setTextAt(point)
          return
        }
        dispatch({
          type: 'begin',
          point,
          strokeWidth: pointsToImagePixels(MARKUP_STROKE_POINTS, current)
        })
      },
      onPanResponderMove: (event) => {
        const point = toImage(event)
        if (point) {
          dispatch({ type: 'extend', point })
        }
      },
      onPanResponderRelease: () => {
        const current = fitRef.current
        dispatch({
          type: 'end',
          minSize: current ? pointsToImagePixels(MARKUP_MIN_SHAPE_POINTS, current) : 0
        })
      },
      onPanResponderTerminate: () => dispatch({ type: 'cancel-draft' })
    })
  }, [image])

  const finish = async () => {
    setBusy(true)
    try {
      const result = await flattenMarkup(capture, stateRef.current, {
        captureCanvas: (size) => captureFeedbackView(canvasRef, size),
        pixelRatio: feedbackPixelRatio(),
        store: feedbackCaptureStore,
        crop: cropFeedbackImage
      })
      onDone(result)
    } catch (error) {
      setBusy(false)
      onError(error instanceof Error ? error.message : 'Could not save the markup')
    }
  }

  const draft = state.draft ? draftShape(state.draft) : null
  const cropDraft =
    state.draft?.kind === 'crop' ? normalizeRect(state.draft.from, state.draft.to) : null
  const cropShown = cropDraft ?? state.crop

  return (
    <View style={styles.root}>
      <MobileMarkupToolbar
        tool={state.tool}
        color={state.color}
        canUndo={canUndoMarkup(state)}
        hasCrop={state.crop !== null}
        busy={busy}
        onTool={(tool) => dispatch({ type: 'set-tool', tool })}
        onColor={(color) => dispatch({ type: 'set-color', color })}
        onUndo={() => dispatch({ type: 'undo' })}
        onResetCrop={() => dispatch({ type: 'reset-crop' })}
        onCancel={onCancel}
        onDone={() => void finish()}
      />
      <View
        style={styles.area}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setArea((current) =>
            current && current.width === width && current.height === height
              ? current
              : { width, height }
          )
        }}
      >
        {fit ? (
          <>
            {/* The snapshot target: exactly the frame and the drawing, never the crop shading. */}
            <View
              ref={canvasRef}
              collapsable={false}
              style={[
                styles.canvas,
                { left: fit.x, top: fit.y, width: fit.width, height: fit.height }
              ]}
            >
              <Image source={{ uri: capture.uri }} style={styles.fill} resizeMode="stretch" />
              <Svg
                style={StyleSheet.absoluteFill}
                width={fit.width}
                height={fit.height}
                viewBox={`0 0 ${image.width} ${image.height}`}
              >
                {state.shapes.map((shape, index) => (
                  // oxlint-disable-next-line react/no-array-index-key -- shapes are append-only; undo pops the last, so an index is stable.
                  <MobileMarkupShape key={index} shape={shape} />
                ))}
                {draft ? <MobileMarkupShape shape={draft} /> : null}
              </Svg>
            </View>
            {cropShown ? <CropShade fit={fit} crop={cropShown} image={image} /> : null}
            <View
              style={[
                styles.canvas,
                { left: fit.x, top: fit.y, width: fit.width, height: fit.height }
              ]}
              accessibilityLabel="Markup canvas"
              {...responder.panHandlers}
            />
          </>
        ) : null}
      </View>
      <TextInputModal
        visible={textAt !== null}
        title="Text label"
        placeholder="Label"
        submitLabel="Add"
        onSubmit={(value) => {
          const current = fitRef.current
          if (textAt && current) {
            dispatch({
              type: 'add-text',
              at: textAt,
              text: value,
              fontSize: pointsToImagePixels(MARKUP_TEXT_POINTS, current)
            })
          }
          setTextAt(null)
        }}
        onCancel={() => setTextAt(null)}
      />
    </View>
  )
}

/** Shades everything outside the crop; drawn beside the canvas so the snapshot never has it. */
function CropShade({ fit, crop, image }: { fit: MarkupFit; crop: MarkupRect; image: MarkupSize }) {
  const x = fit.x + crop.x * fit.scale
  const y = fit.y + crop.y * fit.scale
  const width = crop.width * fit.scale
  const height = crop.height * fit.scale
  const right = fit.x + image.width * fit.scale
  const bottom = fit.y + image.height * fit.scale
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[styles.shade, { left: fit.x, top: fit.y, width: fit.width, height: y - fit.y }]}
      />
      <View
        style={[
          styles.shade,
          { left: fit.x, top: y + height, width: fit.width, height: bottom - y - height }
        ]}
      />
      <View style={[styles.shade, { left: fit.x, top: y, width: x - fit.x, height }]} />
      <View style={[styles.shade, { left: x + width, top: y, width: right - x - width, height }]} />
      <View style={[styles.cropFrame, { left: x, top: y, width, height }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 40, backgroundColor: colors.bgBase },
  area: { flex: 1, overflow: 'hidden' },
  canvas: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  cropFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'dashed'
  }
})
