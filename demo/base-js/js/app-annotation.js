/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 共享白板与屏幕标注
//
// Konva 只负责浏览器端绘制。标注以归一化矢量操作通过 RTCSession.sendInfo()
// 同步，不会合成进屏幕视频轨。SIP INFO 适合 Demo 和低频操作，因此自由画笔在
// pointerup 时按完整笔画发送，避免 pointermove 持续占用 SIP 信令链路。
// =============================================================================

const INK_TYPE = 'application/vnd.crtc.annotation+json';
const INK_VERSION = 1;
const MAX_INK_SIZE = 64 * 1024;
const MAX_SHAPES = 500;
const MAX_POINTS = 1200;
const INK_COLORS = [
  '#e5484d', '#2f6fdd', '#16a36a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#475569'
];

const boards = {
  screen     : { shapes: [], redo: [] },
  whiteboard : { shapes: [], redo: [] }
};

const boundLegs = new WeakSet();
const seenOps = new Set();
const boardLegs = new Set();

let inkStage = null;
let inkLayer = null;
let inkMode = '';
let prevMode = '';
let inkOn = false;
let inkTool = 'pen';
let drawing = false;
let draftNode = null;
let draftShape = null;
let opSeq = 0;
let inkResize = null;
let colorUserId = '';
let boardUserId = '';

function clamp(value, min, max)
{
  return Math.min(max, Math.max(min, value));
}

function getBoardId()
{
  return inkMode === 'whiteboard' ? 'whiteboard' : 'screen';
}

function getBoard(boardId)
{
  return boards[boardId === 'whiteboard' ? 'whiteboard' : 'screen'];
}

function resetBoard(boardId)
{
  boards[boardId].shapes = [];
  boards[boardId].redo = [];
}

function getInkUser()
{
  const uri = typeof ua !== 'undefined' && ua && ua.configuration ? ua.configuration.uri : null;

  if (uri && uri.user) return String(uri.user);
  if (typeof account !== 'undefined' && account) return String(account);

  return 'demo';
}

function cleanId(value, maxLength)
{
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getInkColor(senderId)
{
  const identity = senderId || 'demo';
  let hash = 0;

  for (let index = 0; index < identity.length; index++)
  {
    hash = ((hash * 31) + identity.charCodeAt(index)) >>> 0;
  }

  return INK_COLORS[hash % INK_COLORS.length];
}

function setInkColor()
{
  const senderId = getInkUser();
  const colorInput = document.querySelector('#inkColor');

  if (!colorInput || colorUserId === senderId) return;

  colorInput.value = getInkColor(senderId);
  colorInput.title = `${senderId} 的默认标注颜色`;
  colorUserId = senderId;
}

function makeOp(action, boardId, payload)
{
  opSeq++;
  const senderId = getInkUser();

  return {
    event       : 'annotation',
    version     : INK_VERSION,
    action,
    boardId,
    operationId : `${senderId}-${Date.now()}-${opSeq}`,
    senderId,
    senderLabel : senderId,
    sequence    : opSeq,
    payload     : payload || {}
  };
}

function rememberOp(operationId)
{
  if (!operationId) return;

  seenOps.add(operationId);
  if (seenOps.size > 1000)
  {
    seenOps.delete(seenOps.values().next().value);
  }
}

function getInkLegs()
{
  if (typeof appMode !== 'undefined' && appMode === 'conference' &&
    typeof getLiveLegs === 'function')
  {
    return getLiveLegs().map((leg) => leg.session);
  }

  if (typeof rtcSession !== 'undefined' && rtcSession &&
    (!rtcSession.isEnded || !rtcSession.isEnded()) &&
    (!rtcSession.isEstablished || rtcSession.isEstablished()))
  {
    return [ rtcSession ];
  }

  return [];
}

function getBoardLegs()
{
  if (typeof appMode !== 'undefined' && appMode === 'conference' &&
    typeof getShareLegs === 'function')
  {
    return getShareLegs().map((leg) => leg.session);
  }

  return getInkLegs();
}

function isBoardOpen()
{
  return inkMode === 'whiteboard' && boardLegs.size > 0;
}

function isBoardLeg(session)
{
  return boardLegs.has(session);
}

function refreshShare()
{
  if (typeof appMode !== 'undefined' && appMode === 'conference' &&
    typeof updateConfUi === 'function')
  {
    updateConfUi();
  }
}

function sendOp(op, except, targets)
{
  const body = JSON.stringify(op);

  if (body.length > MAX_INK_SIZE)
  {
    console.warn('[annotation] operation is too large, ignored', op.action, body.length);
    setStatus('标注数据过大，已停止发送本次操作');

    return false;
  }

  const sessions = targets || (op.boardId === 'whiteboard' ?
    Array.from(boardLegs) : getInkLegs());

  sessions.forEach((session) =>
  {
    if (!session || session === except || (session.isEnded && session.isEnded())) return;

    try
    {
      session.sendInfo(INK_TYPE, body);
    }
    catch (error)
    {
      console.warn('[annotation] send INFO failed', error);
    }
  });

}

function isNumber(value)
{
  return typeof value === 'number' && Number.isFinite(value);
}

function cleanPoint(point)
{
  if (!Array.isArray(point) || point.length !== 2 ||
    !isNumber(point[0]) || !isNumber(point[1]))
  {
    return null;
  }

  return [ clamp(point[0], 0, 1), clamp(point[1], 0, 1) ];
}

function cleanShape(shape)
{
  const types = [ 'pen', 'eraser', 'arrow', 'rect', 'ellipse' ];

  if (!shape || typeof shape !== 'object' ||
    typeof shape.id !== 'string' || shape.id.length === 0 || shape.id.length > 120 ||
    types.indexOf(shape.type) === -1)
  {
    return null;
  }

  const authorId = cleanId(shape.authorId, 80);
  const authorLabel = cleanId(shape.authorLabel, 32);
  const sanitized = {
    id    : shape.id,
    type  : shape.type,
    color : /^#[0-9a-f]{6}$/i.test(shape.color || '') ? shape.color :
      getInkColor(authorId),
    authorId    : authorId,
    authorLabel : authorLabel || authorId,
    widthNorm   : isNumber(shape.widthNorm) ? clamp(shape.widthNorm, 0.001, 0.08) : 0.006
  };

  if (shape.type === 'pen' || shape.type === 'eraser')
  {
    if (!Array.isArray(shape.points) || shape.points.length < 2 || shape.points.length > MAX_POINTS)
    {
      return null;
    }

    sanitized.points = shape.points.map(cleanPoint).filter(Boolean);
    if (sanitized.points.length < 2) return null;
  }
  else
  {
    sanitized.start = cleanPoint(shape.start);
    sanitized.end = cleanPoint(shape.end);
    if (!sanitized.start || !sanitized.end) return null;
  }

  return sanitized;
}

function makeNode(shape, preview)
{
  if (!inkStage) return null;

  const width = inkStage.width();
  const height = inkStage.height();
  const minSize = Math.max(1, Math.min(width, height));
  const strokeWidth = clamp(shape.widthNorm * minSize, 1, 40);

  if (shape.type === 'pen' || shape.type === 'eraser')
  {
    const points = [];
    const eraser = shape.type === 'eraser' && preview;

    shape.points.forEach((point) =>
    {
      points.push(point[0] * width, point[1] * height);
    });

    return new Konva.Line({
      id                       : shape.id,
      points,
      stroke                   : eraser ? '#64748b' : shape.color,
      strokeWidth              : shape.type === 'eraser' ? strokeWidth * 3 : strokeWidth,
      lineCap                  : 'round',
      lineJoin                 : 'round',
      tension                  : 0.35,
      listening                : false,
      dash                     : eraser ? [ 8, 6 ] : [],
      opacity                  : eraser ? 0.8 : 1,
      globalCompositeOperation : shape.type === 'eraser' && !preview ? 'destination-out' : 'source-over'
    });
  }

  const startX = shape.start[0] * width;
  const startY = shape.start[1] * height;
  const endX = shape.end[0] * width;
  const endY = shape.end[1] * height;

  if (shape.type === 'arrow')
  {
    return new Konva.Arrow({
      id            : shape.id,
      points        : [ startX, startY, endX, endY ],
      stroke        : shape.color,
      fill          : shape.color,
      strokeWidth,
      pointerLength : strokeWidth * 3,
      pointerWidth  : strokeWidth * 3,
      lineCap       : 'round',
      listening     : false
    });
  }

  if (shape.type === 'rect')
  {
    return new Konva.Rect({
      id          : shape.id,
      x           : Math.min(startX, endX),
      y           : Math.min(startY, endY),
      width       : Math.abs(endX - startX),
      height      : Math.abs(endY - startY),
      stroke      : shape.color,
      strokeWidth : strokeWidth,
      listening   : false
    });
  }

  return new Konva.Ellipse({
    id          : shape.id,
    x           : (startX + endX) / 2,
    y           : (startY + endY) / 2,
    radiusX     : Math.abs(endX - startX) / 2,
    radiusY     : Math.abs(endY - startY) / 2,
    stroke      : shape.color,
    strokeWidth : strokeWidth,
    listening   : false
  });
}

function renderBoard()
{
  if (!inkLayer || !inkStage) return;

  inkLayer.destroyChildren();
  const groups = new Map();

  getBoard(getBoardId()).shapes.forEach((shape) =>
  {
    const authorId = shape.authorId || 'anonymous';
    let group = groups.get(authorId);

    if (!group)
    {
      group = new Konva.Group({ listening: false });
      groups.set(authorId, group);
      inkLayer.add(group);
    }

    const node = makeNode(shape);

    if (node) group.add(node);
  });
  groups.forEach((group) =>
  {
    // 每位参与者使用独立缓存画布，使 destination-out 橡皮只影响自己的标注。
    group.cache({
      x          : 0,
      y          : 0,
      width      : inkStage.width(),
      height     : inkStage.height(),
      pixelRatio : 1
    });
  });
  inkLayer.batchDraw();
  showInkUsers();
  updateInkUi();
}

function showInkUsers()
{
  const legend = document.querySelector('#inkUsers');

  if (!legend) return;

  const userId = getInkUser();
  const participants = new Map();

  getBoard(getBoardId()).shapes.forEach((shape) =>
  {
    if (!shape.authorId || shape.authorId === userId || shape.type === 'eraser') return;

    participants.set(shape.authorId, {
      color : shape.color,
      label : shape.authorLabel || shape.authorId
    });
  });

  legend.textContent = '';
  legend.classList.toggle('hide', participants.size === 0);
  if (participants.size === 0) return;

  const title = document.createElement('span');

  title.className = 'annotation-participant-legend-title';
  title.textContent = '远端标注';
  legend.appendChild(title);

  participants.forEach((participant) =>
  {
    const chip = document.createElement('span');
    const color = document.createElement('span');
    const label = document.createElement('span');

    chip.className = 'annotation-participant-chip';
    color.className = 'annotation-participant-color';
    color.style.backgroundColor = participant.color;
    label.textContent = participant.label;
    chip.appendChild(color);
    chip.appendChild(label);
    legend.appendChild(chip);
  });
}

function applyOp(op)
{
  const board = getBoard(op.boardId);
  const payload = op.payload || {};

  if (op.action === 'shape:add')
  {
    const data = Object.assign({}, payload.shape);
    const senderId = cleanId(op.senderId, 80);
    const senderLabel = cleanId(op.senderLabel, 32);

    if (!senderId) return false;

    // 图形归属始终以操作发送方为准，不能通过 payload 修改其他参与者的内容。
    data.authorId = senderId;
    data.authorLabel = senderLabel || senderId;

    const shape = cleanShape(data);

    if (!shape || board.shapes.some((item) => item.id === shape.id) || board.shapes.length >= MAX_SHAPES)
    {
      return false;
    }
    board.shapes.push(shape);
  }
  else if (op.action === 'shape:remove')
  {
    if (typeof payload.shapeId !== 'string') return false;

    const senderId = cleanId(op.senderId, 80);
    const index = board.shapes.findIndex((shape) => shape.id === payload.shapeId);

    if (!senderId || index === -1 || board.shapes[index].authorId !== senderId) return false;
    board.shapes.splice(index, 1);
  }
  else if (op.action === 'author:clear' || op.action === 'clear')
  {
    const authorId = cleanId(op.senderId, 80);

    if (!authorId) return false;

    board.shapes = board.shapes.filter((shape) => shape.authorId !== authorId);
    board.redo = board.redo.filter((shape) => shape.authorId !== authorId);
  }
  else if (op.action === 'snapshot')
  {
    const screenInk = payload.screen && Array.isArray(payload.screen.shapes) ? payload.screen.shapes : [];
    const boardInk = payload.whiteboard && Array.isArray(payload.whiteboard.shapes) ? payload.whiteboard.shapes : [];

    boards.screen.shapes = screenInk.slice(0, MAX_SHAPES)
      .map(cleanShape)
      .filter(Boolean);
    boards.whiteboard.shapes = boardInk.slice(0, MAX_SHAPES)
      .map(cleanShape)
      .filter(Boolean);
    boards.screen.redo = [];
    boards.whiteboard.redo = [];
  }
  else if (op.action === 'board:open')
  {
    if (op.boardId === 'whiteboard') openBoard(false);
  }
  else if (op.action === 'board:close')
  {
    if (op.boardId === 'whiteboard') closeBoard(false);
  }
  else
  {
    return false;
  }

  if (op.boardId === getBoardId() || op.action === 'snapshot')
  {
    renderBoard();
  }

  return true;
}

function validOp(op)
{
  const actions = [
    'shape:add', 'shape:remove', 'author:clear', 'clear', 'snapshot', 'board:open', 'board:close'
  ];

  return op && typeof op === 'object' &&
    op.event === 'annotation' &&
    op.version === INK_VERSION &&
    (op.boardId === 'screen' || op.boardId === 'whiteboard') &&
    actions.indexOf(op.action) !== -1 &&
    typeof op.operationId === 'string' && op.operationId.length <= 160 &&
    op.payload && typeof op.payload === 'object';
}

function onInkInfo(session, data)
{
  if (!data || data.originator !== 'remote' || !data.info) return;

  const contentType = String(data.info.contentType || '').toLowerCase();
  const body = data.info.body;

  if (contentType.indexOf(INK_TYPE) !== 0 ||
    typeof body !== 'string' || body.length > MAX_INK_SIZE)
  {
    return;
  }

  let op;

  try
  {
    op = JSON.parse(body);
  }
  catch (error)
  {
    console.warn('[annotation] invalid JSON ignored');

    return;
  }

  if (!validOp(op) || seenOps.has(op.operationId)) return;

  if (op.boardId === 'whiteboard' && op.action !== 'board:open' &&
    !boardLegs.has(session))
  {
    return;
  }
  if (op.boardId === 'whiteboard' && op.action === 'board:close' &&
    boardUserId && op.senderId !== boardUserId)
  {
    return;
  }

  let targets = null;

  if (op.boardId === 'whiteboard')
  {
    if (op.action === 'board:open')
    {
      boardUserId = cleanId(op.senderId, 80);
      boardLegs.add(session);
      if (typeof appMode !== 'undefined' && appMode === 'conference' &&
        typeof getShareLegs === 'function')
      {
        getShareLegs().forEach((leg) => boardLegs.add(leg.session));
      }
    }
    targets = Array.from(boardLegs);
    refreshShare();
  }

  rememberOp(op.operationId);
  applyOp(op);

  // 三方 Demo 的 A 同时维护 A-B、A-C 两条会话，需要把一路收到的操作转发给
  // 另一条已确认会话。operationId 保持不变，防止重复操作。
  if (typeof appMode !== 'undefined' && appMode === 'conference')
  {
    sendOp(op, session, targets);
  }
  if (op.boardId === 'whiteboard' && op.action === 'board:close')
  {
    boardLegs.clear();
    refreshShare();
  }
}

function bindInk(session)
{
  if (!session || boundLegs.has(session)) return;

  boundLegs.add(session);
  session.on('newInfo', (data) => onInkInfo(session, data));

  const cleanup = function()
  {
    boardLegs.delete(session);
    refreshShare();
    if (typeof appMode !== 'undefined' && appMode === 'conference') return;

    // 呼转场景可能同时存在 rtcSession/tmpSession；其中一路结束时不能清掉另一路
    // 仍在使用的白板。只有没有其他存活会话时才重置本次标注状态。
    const hasOtherLeg = [
      typeof rtcSession !== 'undefined' ? rtcSession : null,
      typeof tmpSession !== 'undefined' ? tmpSession : null
    ].some((item) => item && item !== session && (!item.isEnded || !item.isEnded()));

    if (!hasOtherLeg) resetInk();
  };

  session.on('ended', cleanup);
  session.on('failed', cleanup);
}

function sendSnapshot(session)
{
  if (!session) return;

  const op = makeOp('snapshot', 'whiteboard', {
    screen     : { shapes: boards.screen.shapes },
    whiteboard : { shapes: boards.whiteboard.shapes }
  });

  sendOp(op, null, [ session ]);
}

function getPointer()
{
  if (!inkStage) return null;

  const position = inkStage.getPointerPosition();

  if (!position || inkStage.width() <= 0 || inkStage.height() <= 0) return null;

  return [
    clamp(position.x / inkStage.width(), 0, 1),
    clamp(position.y / inkStage.height(), 0, 1)
  ];
}

function getTool()
{
  const colorInput = document.querySelector('#inkColor');
  const widthInput = document.querySelector('#inkWidth');
  const minSize = Math.max(1, Math.min(inkStage.width(), inkStage.height()));

  return {
    color     : colorInput ? colorInput.value : '#ff3b30',
    widthNorm : clamp(Number(widthInput ? widthInput.value : 4) / minSize, 0.001, 0.08)
  };
}

function makeShapeId()
{
  opSeq++;

  return `shape-${getInkUser()}-${Date.now()}-${opSeq}`;
}

function startDraw()
{
  if (!inkStage || (inkMode !== 'whiteboard' && !inkOn)) return;

  setInkColor();

  const point = getPointer();

  if (!point) return;

  const config = getTool();

  drawing = true;
  draftShape = {
    id          : makeShapeId(),
    type        : inkTool,
    color       : config.color,
    authorId    : getInkUser(),
    authorLabel : getAnnotUserLabel(),
    widthNorm   : config.widthNorm,
    start       : point,
    end         : point
  };

  if (inkTool === 'pen' || inkTool === 'eraser')
  {
    draftShape.points = [ point, point ];
  }

  draftNode = makeNode(draftShape, true);
  if (draftNode)
  {
    inkLayer.add(draftNode);
    inkLayer.batchDraw();
  }
}

function moveDraw()
{
  if (!drawing || !draftShape || !draftNode) return;

  const point = getPointer();

  if (!point) return;

  if (draftShape.type === 'pen' || draftShape.type === 'eraser')
  {
    const previous = draftShape.points[draftShape.points.length - 1];
    const minDistance = 2 / Math.max(1, Math.min(inkStage.width(), inkStage.height()));

    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < minDistance) return;
    if (draftShape.points.length >= MAX_POINTS) return;

    draftShape.points.push(point);
  }
  else
  {
    draftShape.end = point;
  }

  const replacement = makeNode(draftShape, true);

  draftNode.destroy();
  draftNode = replacement;
  if (replacement) inkLayer.add(replacement);
  inkLayer.batchDraw();
}

function endDraw()
{
  if (!drawing) return;

  drawing = false;
  if (draftNode) draftNode.destroy();

  const shape = cleanShape(draftShape);

  draftNode = null;
  draftShape = null;

  if (shape) addShape(shape);
  else renderBoard();
}

function addShape(shape)
{
  if (!shape) return;

  const boardId = getBoardId();
  const board = getBoard(boardId);

  board.redo = [];
  runOp('shape:add', { shape }, boardId);
}

// 本端绘制操作统一走“记录去重 → 更新画布 → SIP INFO 同步”。
function runOp(action, payload, boardId)
{
  const op = makeOp(action, boardId || getBoardId(), payload);

  rememberOp(op.operationId);
  if (applyOp(op)) sendOp(op);
}

function getOwnShape(board)
{
  const senderId = getInkUser();

  for (let index = board.shapes.length - 1; index >= 0; index--)
  {
    if (board.shapes[index].authorId === senderId) return board.shapes[index];
  }

  return null;
}

function undoInk()
{
  const boardId = getBoardId();
  const board = getBoard(boardId);
  const shape = getOwnShape(board);

  if (!shape) return;

  board.redo.push(shape);
  runOp('shape:remove', { shapeId: shape.id }, boardId);
}

function redoInk()
{
  const boardId = getBoardId();
  const board = getBoard(boardId);
  const shape = board.redo.pop();

  if (!shape) return;

  runOp('shape:add', { shape }, boardId);
}

function askClear()
{
  const board = getBoard(getBoardId());

  if (!getOwnShape(board)) return;

  showClearBox(true);
}

function clearMine()
{
  const boardId = getBoardId();
  const board = getBoard(boardId);
  const senderId = getInkUser();

  if (!board.shapes.some((shape) => shape.authorId === senderId)) return;

  runOp('author:clear', {}, boardId);
}

function doClear()
{
  clearMine();
  showClearBox(false);
}

function showClearBox(visible)
{
  const confirmation = document.querySelector('#inkClearBox');

  if (confirmation) confirmation.classList.toggle('hide', !visible);
  updateInkUi();

  if (visible)
  {
    const confirmButton = document.querySelector('#inkClearOk');

    if (confirmButton) confirmButton.focus();
  }
}

function setInkHint(message)
{
  const hint = document.querySelector('#inkHint');

  if (!hint) return;

  if (message && hint)
  {
    hint.textContent = message;

    return;
  }

  const hints = {
    pen     : '按住并拖动画布开始绘制',
    arrow   : '按住并拖动设置箭头方向',
    rect    : '按住并拖动绘制矩形',
    ellipse : '按住并拖动绘制椭圆',
    eraser  : '按住并拖动擦除自己的标注'
  };

  if (hint) hint.textContent = hints[inkTool] || '';
}

function updateInkUi()
{
  const stageEl = document.querySelector('#inkStage');
  const toolbar = document.querySelector('#inkTools');
  const toggle = document.querySelector('#inkToggle');
  const closeBtn = document.querySelector('#boardClose');
  const clearBox = document.querySelector('#inkClearBox');
  const toolHint = document.querySelector('#inkHint');
  const hint = document.querySelector('.annotation-toolbar-feedback');
  const isBoard = inkMode === 'whiteboard';
  const isScreen = inkMode === 'local' || inkMode === 'remote';
  const canClose = isBoard && boardUserId === getInkUser();
  const interactive = isBoard || (isScreen && inkOn);
  const clearing = clearBox && !clearBox.classList.contains('hide');
  const board = getBoard(getBoardId());

  if (stageEl)
  {
    stageEl.classList.toggle('hide', !isBoard && !isScreen && board.shapes.length === 0);
    stageEl.classList.toggle('is-interactive', interactive);
  }
  if (toolbar) toolbar.classList.toggle('hide', !interactive);
  if (toggle)
  {
    toggle.classList.toggle('hide', !isScreen);
    toggle.innerHTML = `<i class="bi bi-pencil" aria-hidden="true"></i>${
      inkOn ? '关闭标注' : '开启标注'}`;
    toggle.setAttribute('aria-pressed', String(inkOn));
  }
  if (closeBtn) closeBtn.classList.toggle('hide', !canClose);
  if (toolHint)
  {
    toolHint.classList.toggle('hide', !interactive || clearing);
  }
  if (hint) hint.classList.toggle('hide', !interactive || clearing);

  document.querySelectorAll('.annotation-tool').forEach((button) =>
  {
    const active = button.dataset.inkTool === inkTool;

    button.classList.toggle('active', active);
    button.classList.toggle('btn-primary', active);
    button.classList.toggle('btn-outline-primary', !active);
  });

  const undo = document.querySelector('#inkUndo');
  const redo = document.querySelector('#inkRedo');
  const clear = document.querySelector('#inkClear');

  if (undo) undo.disabled = !getOwnShape(board);
  if (redo) redo.disabled = board.redo.length === 0;
  if (clear) clear.disabled = !getOwnShape(board);
  setInkHint();
}

function resizeInk()
{
  if (!inkStage) return;

  const stageEl = document.querySelector('#inkStage');
  const container = document.querySelector('.screen-share-dialog-stage');

  if (!stageEl || !container || container.clientWidth === 0 || container.clientHeight === 0) return;

  let left = 0;
  let top = 0;
  let width = container.clientWidth;
  let height = container.clientHeight;

  if (inkMode === 'local' || inkMode === 'remote')
  {
    const video = document.querySelector(inkMode === 'local' ? '#screen' : '#shareVid');
    const videoWidth = video && video.videoWidth ? video.videoWidth : 16;
    const videoHeight = video && video.videoHeight ? video.videoHeight : 9;
    const scale = Math.min(width / videoWidth, height / videoHeight);

    width = videoWidth * scale;
    height = videoHeight * scale;
    left = (container.clientWidth - width) / 2;
    top = (container.clientHeight - height) / 2;
  }

  stageEl.style.left = `${left}px`;
  stageEl.style.top = `${top}px`;
  stageEl.style.width = `${width}px`;
  stageEl.style.height = `${height}px`;

  const stageW = Math.max(1, Math.round(width));
  const stageH = Math.max(1, Math.round(height));

  if (inkStage.width() !== stageW || inkStage.height() !== stageH)
  {
    inkStage.size({ width: stageW, height: stageH });
    renderBoard();
  }
}

function setInkMode(mode)
{
  inkMode = mode || '';
  const confirmation = document.querySelector('#inkClearBox');

  const background = document.querySelector('#boardBg');

  if (confirmation) confirmation.classList.add('hide');
  if (background) background.classList.toggle('hide', inkMode !== 'whiteboard');
  setTimeout(resizeInk, 0);
  renderBoard();
}

function startInk()
{
  resetBoard('screen');
  inkOn = false;
}

function stopInk()
{
  resetBoard('screen');
  inkOn = false;
}

function toggleInk()
{
  if (inkMode !== 'local' && inkMode !== 'remote')
  {
    setStatus('请先打开屏幕共享画面');

    return;
  }

  if (inkOn)
  {
    clearMine();
    inkOn = false;
  }
  else
  {
    inkOn = true;
    setInkColor();
  }
  updateInkUi();
}

function openBoard(notify)
{
  if (notify !== false && (typeof appMode === 'undefined' || appMode !== 'conference'))
  {
    setStatus('共享白板仅在三方模式下由 A 端发起');

    return;
  }

  const targets = notify === false ? [] : getBoardLegs();

  if (notify !== false && targets.length === 0)
  {
    setStatus('请至少选择一个白板共享目标');

    return;
  }

  if (notify !== false) boardUserId = getInkUser();

  if (inkMode === 'local' || inkMode === 'remote') prevMode = inkMode;

  setInkColor();

  openShareBox('whiteboard');

  if (notify !== false)
  {
    boardLegs.clear();
    targets.forEach((session) => boardLegs.add(session));
    refreshShare();

    const op = makeOp('board:open', 'whiteboard', {});

    rememberOp(op.operationId);
    sendOp(op, null, targets);
    targets.forEach(sendSnapshot);
    setStatus(`共享白板已发送给 ${targets.length} 个目标`);
  }
}

function closeBoard(notify)
{
  if (inkMode !== 'whiteboard') return;
  if (notify !== false && boardUserId !== getInkUser())
  {
    setStatus('只有共享白板发起方可以关闭白板');

    return;
  }

  if (notify !== false)
  {
    const op = makeOp('board:close', 'whiteboard', {});

    rememberOp(op.operationId);
    sendOp(op);
    boardLegs.clear();
    refreshShare();
  }

  boardUserId = '';

  const oldMode = prevMode;
  const oldVideo = oldMode === 'local' ? document.querySelector('#screen') :
    (oldMode === 'remote' ? document.querySelector('#shareVid') : null);

  prevMode = '';
  if (oldMode && oldVideo && oldVideo.srcObject)
  {
    openShareBox(oldMode);
  }
  else
  {
    closeShareBox('whiteboard');
  }
}

function resetInk()
{
  resetBoard('screen');
  resetBoard('whiteboard');
  seenOps.clear();
  boardLegs.clear();
  refreshShare();
  boardUserId = '';
  colorUserId = '';
  prevMode = '';
  inkOn = false;
  drawing = false;
  draftNode = null;
  draftShape = null;
  if (inkMode === 'whiteboard') closeShareBox('whiteboard');
  setInkMode('');
}

function initInk()
{
  if (typeof Konva === 'undefined')
  {
    console.warn('[annotation] Konva is not loaded');

    return;
  }

  const stageEl = document.querySelector('#inkStage');
  const box = document.querySelector('.screen-share-dialog-stage');

  if (!stageEl || !box) return;

  inkStage = new Konva.Stage({ container: stageEl, width: 1, height: 1 });
  inkLayer = new Konva.Layer();
  inkStage.add(inkLayer);

  inkStage.on('pointerdown', startDraw);
  inkStage.on('pointermove', moveDraw);
  inkStage.on('pointerup pointercancel', endDraw);
  window.addEventListener('pointerup', endDraw);

  document.querySelectorAll('.annotation-tool').forEach((button) =>
  {
    button.onclick = function()
    {
      inkTool = this.dataset.inkTool;
      showClearBox(false);
      updateInkUi();
    };
  });

  document.querySelector('#inkToggle').onclick = toggleInk;
  document.querySelector('#openBoard').onclick = () => openBoard(true);
  document.querySelector('#boardClose').onclick = () => closeBoard(true);
  document.querySelector('#inkUndo').onclick = undoInk;
  document.querySelector('#inkRedo').onclick = redoInk;
  document.querySelector('#inkClear').onclick = askClear;
  document.querySelector('#inkClearOk').onclick = doClear;
  document.querySelector('#inkCancel').onclick = () =>
  {
    showClearBox(false);
    document.querySelector('#inkClear').focus();
  };
  document.querySelector('#inkClearBox').addEventListener('keydown', (event) =>
  {
    if (event.key !== 'Escape') return;

    showClearBox(false);
    document.querySelector('#inkClear').focus();
  });

  [ '#screen', '#shareVid' ].forEach((selector) =>
  {
    const video = document.querySelector(selector);

    if (video) video.addEventListener('loadedmetadata', resizeInk);
  });

  if (typeof ResizeObserver !== 'undefined')
  {
    inkResize = new ResizeObserver(resizeInk);
    inkResize.observe(box);
  }
  else
  {
    window.addEventListener('resize', resizeInk);
  }

  updateInkUi();
}
