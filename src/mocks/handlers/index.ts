import { accountHandlers } from './account'
import { catalogHandlers } from './catalog'
import { commerceHandlers } from './commerce'
import { controlHandlers } from './control'
import { realtimeHandler } from '../realtime'

// Controle primeiro: /__mock/* não deve cair em nenhum outro handler.
export const handlers = [
  ...controlHandlers,
  ...accountHandlers,
  ...catalogHandlers,
  ...commerceHandlers,
  realtimeHandler,
]
