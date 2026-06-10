import {Debug} from 'debug'

import * as C from './Constants'
import * as Exceptions from './Exceptions'
import * as Grammar from './Grammar'
import * as Utils from './Utils'
import {MediaStreamComposerInstance} from './RTCSession'

export { C, Exceptions, Grammar, Utils };

export {UA} from './UA'
export {URI} from './URI'
export {NameAddrHeader} from './NameAddrHeader'
export {WebSocketInterface, Socket, WeightedSocket} from './WebSocketInterface'

export interface MediaStreamComposerConstructor {
  new(
    videos?: MediaStream | HTMLVideoElement | Array<MediaStream | HTMLVideoElement>,
    options?: Record<string, any>
  ): MediaStreamComposerInstance;
}

export const MediaStreamComposer: MediaStreamComposerConstructor
export const Mixer: MediaStreamComposerConstructor
export const debug: Debug
export const name: string
export const version: string
