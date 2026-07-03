import {Debug} from 'debug'

import * as C from './Constants'
import * as Exceptions from './Exceptions'
import * as Grammar from './Grammar'
import * as Utils from './Utils'
import {MediaEffectsComposerInstance} from './RTCSession'

export { C, Exceptions, Grammar, Utils };

export {UA} from './UA'
export {URI} from './URI'
export {NameAddrHeader} from './NameAddrHeader'
export {WebSocketInterface, Socket, WeightedSocket} from './WebSocketInterface'
export {MetaHumanClient} from './MetaHumanClient'

export interface MediaEffectsComposerConstructor {
  new(
    videos?: MediaStream | HTMLVideoElement | Array<MediaStream | HTMLVideoElement>,
    options?: Record<string, any>
  ): MediaEffectsComposerInstance;
}

export const MediaEffectsComposer: MediaEffectsComposerConstructor
export const Mixer: MediaEffectsComposerConstructor
export const debug: Debug
export const name: string
export const version: string
