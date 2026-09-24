import type { MarkupTool } from './markup-model'

/** The gesture the canvas answers for this tool, in the words a first-time user needs. */
export function markupToolHint(tool: MarkupTool, hasCrop: boolean): string {
  switch (tool) {
    case 'pen':
      return 'Draw freehand'
    case 'arrow':
      return 'Drag to point'
    case 'rect':
      return 'Drag a box'
    case 'text':
      return 'Tap to label'
    case 'crop':
      // A drag draws the crop; once one exists its corner handles resize it.
      return hasCrop ? 'Drag a corner to resize' : 'Drag to select the area'
  }
}
