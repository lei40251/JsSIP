/* Demo 共享白板与屏幕标注：绘制、同步和白板生命周期。
 *
 * 本文件实现基于 Konva 的共享白板和屏幕标注功能，通过 SIP INFO 消息
 * 在通话参与者之间实时同步标注操作。核心设计要点：
 *
 * 1. Konva 只负责浏览器端绘制，标注数据以归一化矢量操作发送
 * 2. 通过 RTCSession.sendInfo() 同步标注，不合成进屏幕视频轨
 * 3. 自由画笔在 pointerup 时按完整笔画发送（避免 pointermove 高频占用信令）
 * 4. 归一化坐标（0~1）存储，渲染时按当前舞台尺寸换算为像素
 * 5. 用户身份用于操作去重、作者权限判断和稳定配色
 * 6. 三方模式下 A 负责转发 B/C 之间的操作，排除来源 session 防止回环
 */
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

// SIP INFO 消息的 Content-Type，用于标注数据同步
const INK_TYPE = 'application/vnd.crtc.annotation+json';
// 标注协议版本号，用于前后向兼容校验
const INK_VERSION = 1;
// 单条 SIP INFO 消息的最大字节数（64KB），超出则拒绝发送
const MAX_INK_SIZE = 64 * 1024;
// 单个 board 最多保存的图形数量，防止无限增长
const MAX_SHAPES = 500;
// 单个自由笔画最多包含的坐标点数，防止高频绘制产生过大消息
const MAX_POINTS = 1200;
// 线宽按固定参考短边归一化，避免小屏发起的标注在大屏端被成比例放粗。
const INK_WIDTH_REFERENCE_SIZE = 640;
// 白板比例协议允许的范围，超出则兼容回退到本端容器比例。
const MIN_BOARD_ASPECT_RATIO = 0.25;
const MAX_BOARD_ASPECT_RATIO = 4;
// 8 种标注颜色，通过用户 ID 哈希取模分配，保证同一用户颜色稳定
const INK_COLORS = [
  '#e5484d', '#2f6fdd', '#16a36a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#475569'
];

// 双 board 状态容器：screen（屏幕标注）和 whiteboard（共享白板），
// 各自独立维护图形列表和撤销栈
const boards = {
  screen     : { shapes: [], redo: [] },
  whiteboard : { shapes: [], redo: [] }
};

// 已绑定 newInfo / ended / failed 事件的会话集合（WeakSet 防重复绑定）
const boundLegs = new WeakSet();
// 已处理的操作 ID 集合（上限 1000 条），用于远端消息去重
const seenOps = new Set();
// 共享白板的当前目标会话集合，白板操作通过此集合确定发送范围
const boardLegs = new Set();

// Konva.Stage 实例，标注画布的根容器
let inkStage = null;
// Konva.Layer 实例，所有标注图形所在的图层
let inkLayer = null;
// 当前标注模式：''|'local'|'remote'|'whiteboard'
let inkMode = '';
// 进入白板模式前的上一个标注模式，用于关闭白板后恢复
let prevMode = '';
// 屏幕标注开关：true 表示在屏幕共享画面上开启了标注工具
let inkOn = false;
// 当前选中的绘制工具：'pen'|'arrow'|'rect'|'ellipse'|'eraser'
let inkTool = 'pen';
// 是否正在绘制中（pointerdown 到 pointerup/cancel 之间）
let drawing = false;
// 绘制过程中的预览节点，pointerup 时销毁并转为正式图形存入 board
let draftNode = null;
// 绘制过程中的预览图形数据对象
let draftShape = null;
// 全局自增操作序号，makeOp() 每次调用 +1，用于生成唯一 operationId
let opSeq = 0;
// Konva Stage 的 ResizeObserver 实例，监听容器尺寸变化自动重绘
let inkResize = null;
// 上一次更新颜色选择器的用户 ID 缓存，避免同用户重复 DOM 操作
let colorUserId = '';
// 共享白板发起方的用户 ID，只有发起方可以广播 board:close
let boardUserId = '';
// 白板由发起方锁定的画布比例；0 表示兼容回退到本端容器比例。
let boardAspectRatio = 0;

// =============================================================================
// 1. 画布状态、用户身份与基础取值
//
// 这一组函数只读取或规范化本地状态，不发送 SIP INFO，也不修改 RTCSession。
// 用户标识同时用于操作去重、作者权限判断和稳定配色，接入方替换身份来源时应
// 保证同一用户在一次白板会话中返回稳定值。
// =============================================================================

/**
 * 将数值限制在 [min, max] 范围内。
 * 用于归一化坐标和图形尺寸的边界保护。
 *
 * @param {number} value - 输入值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
function clamp(value, min, max)
{
  return Math.min(max, Math.max(min, value));
}

/**
 * 获取当前标注模式对应的 board ID。
 * 'whiteboard' 模式返回 'whiteboard'，屏幕标注模式返回 'screen'。
 *
 * @returns {'whiteboard'|'screen'} board 标识符
 */
function getBoardId()
{
  return inkMode === 'whiteboard' ? 'whiteboard' : 'screen';
}

/**
 * 根据 boardId 获取对应的 board 状态对象。
 *
 * @param {'whiteboard'|'screen'} boardId - board 标识符
 * @returns {object} 包含 shapes 和 redo 数组的 board 对象
 */
function getBoard(boardId)
{
  return boards[boardId === 'whiteboard' ? 'whiteboard' : 'screen'];
}

/**
 * 重置指定 board 的图形和撤销栈。
 *
 * @param {'whiteboard'|'screen'} boardId - 要重置的 board
 */
function resetBoard(boardId)
{
  boards[boardId].shapes = [];
  boards[boardId].redo = [];
}

/**
 * 获取当前用户标识，用于标注操作的作者归属和颜色分配。
 * 优先级：UA 配置的 SIP URI 用户名 > account 变量 > 'demo'。
 *
 * @returns {string} 用户标识符
 */
function getInkUser()
{
  const uri = typeof ua !== 'undefined' && ua && ua.configuration ? ua.configuration.uri : null;

  if (uri && uri.user) return String(uri.user);
  if (typeof account !== 'undefined' && account) return String(account);

  return 'demo';
}

/**
 * 获取当前用户的展示名称（display name），用于远端标注参与者列表。
 * 回退链路：UA display_name → getInkUser()。
 *
 * @returns {string} 用户展示名称
 */
function getAnnotUserLabel()
{
  const displayName = typeof ua !== 'undefined' && ua && ua.configuration ?
    ua.configuration.display_name : '';
  const label = displayName === undefined || displayName === null ? '' : String(displayName);

  return cleanId(label, 32) || getInkUser();
}

/**
 * 清理字符串：去首尾空白并截断到指定长度。
 * 用于 SIP INFO 字段的安全截断，防止超长字符串。
 *
 * @param {string} value - 原始字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 清理后的字符串
 */
function cleanId(value, maxLength)
{
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/**
 * 为用户分配稳定的标注颜色（基于用户 ID 的哈希取色）。
 * 同一用户在同一会话中始终获得相同颜色，便于远端区分参与者。
 *
 * @param {string} senderId - 用户标识符
 * @returns {string} CSS 颜色值（如 '#e5484d'）
 */
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

/**
 * 更新颜色选择器的值为当前用户的默认标注颜色。
 * 仅当用户标识变化时才更新（通过 colorUserId 缓存比较），避免频繁 DOM 操作。
 */
function setInkColor()
{
  const senderId = getInkUser();
  const colorInput = document.querySelector('#inkColor');

  if (!colorInput || colorUserId === senderId) return;

  colorInput.value = getInkColor(senderId);
  colorInput.title = `${senderId} 的默认标注颜色`;
  colorUserId = senderId;
}

// =============================================================================
// 2. 标注操作封装、目标会话选择与 SIP INFO 发送
//
// 所有本端操作都使用同一 operationId 规则，并在发送前序列化为 INK_TYPE。
// 三方模式发送给全部有效 leg；共享白板可传入固定 targets 做定向同步。
// =============================================================================

/**
 * 构造标注操作对象，包含操作元数据和业务参数。
 * 自动递增全局序号 opSeq，生成全局唯一的 operationId。
 *
 * @param {string} action - 操作类型（如 'shape:add'、'clear'）
 * @param {string} boardId - 目标 board 标识符
 * @param {object} [payload] - 操作携带的业务数据
 * @returns {object} 可 JSON 序列化的标注操作对象
 */
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
    senderLabel : getAnnotUserLabel(),
    sequence    : opSeq,
    payload     : payload || {}
  };
}

/**
 * 记录已处理的操作 ID，用于远端消息去重。
 * seenOps 集合限制最大 1000 条，超出时删除最早记录。
 *
 * @param {string} operationId - 操作唯一标识
 */
function rememberOp(operationId)
{
  if (!operationId) return;

  seenOps.add(operationId);
  if (seenOps.size > 1000)
  {
    seenOps.delete(seenOps.values().next().value);
  }
}

/**
 * 获取当前上下文中可用于标注同步的 RTCSession 列表。
 * 三方模式返回所有有效成员的会话；点对点模式返回 rtcSession（如果有效）。
 *
 * @returns {object[]} RTCSession 实例数组
 */
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

/**
 * 检查共享白板是否已打开（当前模式为 whiteboard 且至少有一个白板成员）。
 *
 * @returns {boolean}
 */
function isBoardOpen()
{
  return inkMode === 'whiteboard' && boardLegs.size > 0;
}

/**
 * 检查指定会话是否属于共享白板目标集合。
 *
 * @param {object} session - RTCSession 实例
 * @returns {boolean}
 */
function isBoardLeg(session)
{
  return boardLegs.has(session);
}

/**
 * 刷新共享/白板相关的会议 UI（仅三方模式）。
 * 在白板开关状态变化后，确保会议控制栏中的共享按钮状态正确。
 */
function refreshShare()
{
  if (typeof appMode !== 'undefined' && appMode === 'conference' &&
    typeof updateConfUi === 'function')
  {
    updateConfUi();
  }
}

/**
 * 把标注操作作为 SIP INFO 发送给目标会话。
 *
 * @param {object} op - 已由 makeOp() 构造且可 JSON 序列化的操作
 * @param {object|null} except - 三方转发时需要排除的来源 RTCSession
 * @param {object[]} [targets] - 指定目标；省略时使用当前有效标注会话
 * @returns {boolean|undefined} 数据过大时返回 false，其余情况逐路尝试发送
 */
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

// =============================================================================
// 3. 远端数据校验与归一化
//
// SIP INFO 来自远端，不能直接交给 Konva。这里限制操作类型、字符串长度、
// 点数量和归一化坐标范围，避免异常消息创建过多节点或越界图形。
// =============================================================================

/**
 * 检查值是否为有限数字。
 *
 * @param {*} value - 待检查的值
 * @returns {boolean}
 */
function isNumber(value)
{
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 将线宽滑块值换算为与本端画布尺寸无关的归一化线宽。
 *
 * @param {number|string} value - 线宽滑块值
 * @returns {number} 归一化线宽
 */
function getInkWidthNorm(value)
{
  const width = Number(value);

  return clamp((isNumber(width) ? width : 4) / INK_WIDTH_REFERENCE_SIZE, 0.001, 0.08);
}

function cleanBoardAspectRatio(value)
{
  return isNumber(value) && value >= MIN_BOARD_ASPECT_RATIO &&
    value <= MAX_BOARD_ASPECT_RATIO ? value : 0;
}

/**
 * 清理和归一化坐标点，确保值为 [0, 1] 范围内的有限数字。
 * 格式不合法的点（非数组、长度不为 2、值不是数字）返回 null。
 * 这是远端数据进入 Konva 前的第一道防线。
 *
 * @param {*} point - 待清理的坐标点（期望格式为 [x, y]）
 * @returns {number[]|null} 归一化后的 [x, y] 坐标，非法时返回 null
 */
function cleanPoint(point)
{
  if (!Array.isArray(point) || point.length !== 2 ||
    !isNumber(point[0]) || !isNumber(point[1]))
  {
    return null;
  }

  return [ clamp(point[0], 0, 1), clamp(point[1], 0, 1) ];
}

/**
 * 清理和归一化标注图形数据，限制字段长度、类型白名单、坐标范围。
 * 这是远端图形数据进入 Board 前的唯一校验入口：
 * - 校验 id 长度 ≤ 120 字符
 * - 校验 type 在白名单内（pen/eraser/arrow/rect/ellipse）
 * - 笔画的点数量在 [2, MAX_POINTS] 之间
 * - 非笔画的 start/end 坐标必须合法
 * - authorId/authorLabel 截断到安全长度
 * - color 若不是合法的 #rrggbb 格式则用 hash 自动分配
 *
 * @param {object} shape - 待清理的图形数据
 * @returns {object|null} 清理后的图形对象，非法时返回 null
 */
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

/**
 * 校验 SIP INFO 解析出的标注操作的完整性和合法性。
 * 校验项：event/version/boardId/action 字段存在且合法、
 * operationId 为字符串且 ≤ 160 字符、payload 为对象。
 * 这是 onInkInfo 处理远端消息前的最外层防线。
 *
 * @param {*} op - 从 JSON.parse 得到的原始操作对象
 * @returns {boolean} 操作是否通过了所有校验
 */
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

// =============================================================================
// 4. Konva 节点创建与画布渲染
//
// 协议层保存的是 0~1 的归一化坐标；只有渲染时才按当前舞台尺寸换算为像素。
// 因此窗口缩放后可以直接重新 renderBoard()，无需改写已保存的 shape 数据。
// =============================================================================

function isInkViewRotated()
{
  return typeof isShareViewRotated === 'function' && isShareViewRotated();
}

function toViewPoint(point)
{
  if (!isInkViewRotated()) return [ point[0], point[1] ];

  return [ clamp(1 - point[1], 0, 1), clamp(point[0], 0, 1) ];
}

function toSourcePoint(point)
{
  if (!isInkViewRotated()) return [ point[0], point[1] ];

  return [ clamp(point[1], 0, 1), clamp(1 - point[0], 0, 1) ];
}

function getBoardViewAspectRatio(aspectRatio)
{
  const ratio = cleanBoardAspectRatio(aspectRatio);

  return ratio && isInkViewRotated() ? 1 / ratio : ratio;
}

/**
 * 根据 shape 数据创建 Konva 图形节点（不添加到画布）。
 *
 * 将归一化坐标（0~1）乘以当前舞台尺寸换算为像素坐标，
 * 支持笔画（Line，含预览橡皮模式）、箭头（Arrow）、矩形（Rect）和椭圆（Ellipse）。
 *
 * preview 参数仅在 type='eraser' 时生效：预览时显示为灰色虚线，
 * 正式提交后使用 destination-out 合成模式擦除。
 *
 * @param {object} shape - 已通过 cleanShape() 校验的图形数据
 * @param {boolean} [preview=false] - 是否为预览模式（绘制中尚未提交）
 * @returns {Konva.Shape|null} Konva 节点，舞台不存在时返回 null
 */
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
      const viewPoint = toViewPoint(point);

      points.push(viewPoint[0] * width, viewPoint[1] * height);
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

  const start = toViewPoint(shape.start);
  const end = toViewPoint(shape.end);
  const startX = start[0] * width;
  const startY = start[1] * height;
  const endX = end[0] * width;
  const endY = end[1] * height;

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

/**
 * 按当前 Board 的 shapes 数组完全重绘 Konva 画布。
 *
 * 每位参与者使用独立的 Konva.Group + cache，使橡皮（destination-out）
 * 只影响自己的标注，不会擦除其他人的图形。绘制完成后刷新标注参与者
 * 图例和工具栏状态。
 */
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

/**
 * 在标注工具栏旁渲染远端参与者图例。
 * 遍历当前 Board 中非本人、非橡皮的图形，按作者去重后
 * 显示色块和名称，帮助用户识别每位参与者的标注颜色。
 */
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

// =============================================================================
// 5. 远端操作应用、会话事件绑定与白板快照
//
// onInkInfo() 的顺序固定为“校验 → 去重 → 应用 → 必要时转发”。A 端在三方
// 模式下负责把 B/C 的操作转发给其他目标，但会排除来源 session，避免回环。
// =============================================================================

/**
 * 将一个已校验操作写入对应 board，并在当前画布受影响时重新渲染。
 *
 * 图形作者始终取 op.senderId，不能信任 payload.shape.authorId；删除和清空同样
 * 受作者身份限制，因此参与者只能修改自己的标注。
 *
 * @param {object} op - 通过 validOp() 校验后的标注操作
 * @returns {boolean} 操作已应用返回 true；非法、重复或越权操作返回 false
 */
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

    const aspectRatio = cleanBoardAspectRatio(
      payload.whiteboard && payload.whiteboard.aspectRatio
    );

    if (aspectRatio) boardAspectRatio = aspectRatio;
  }
  else if (op.action === 'board:open')
  {
    if (op.boardId === 'whiteboard')
    {
      boardAspectRatio = cleanBoardAspectRatio(payload.aspectRatio);
      openBoard(false);
    }
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

/**
 * 处理远端 SIP INFO 标注消息。
 *
 * 处理流程严格按顺序：校验 Content-Type → 解析 JSON → validOp() 全字段校验 →
 * seenOps 去重 → 白板成员校验 → 白板 open/close 状态更新 → applyOp() 写入 Board →
 * 三方模式转发给其他目标（排除来源 session，保持 operationId 不变防回环）。
 *
 * @param {object} session - 消息来源的 RTCSession 实例
 * @param {object} data - newInfo 事件数据对象
 */
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

/**
 * 为一条 RTCSession 绑定标注 INFO 和结束清理事件。
 *
 * WeakSet 保证同一会话只绑定一次；会话结束后从白板目标集合移除，最后一条
 * 点对点会话结束时再重置本地标注状态。
 *
 * @param {object} session - SDK RTCSession 实例
 * @returns {void}
 */
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

/**
 * 向指定会话发送当前完整的白板和屏幕标注快照。
 * 用于新加入白板的成员同步现有标注内容，避免从零开始接收增量操作。
 *
 * @param {object} session - 目标 RTCSession 实例
 */
function sendSnapshot(session)
{
  if (!session) return;

  const op = makeOp('snapshot', 'whiteboard', {
    screen     : { shapes: boards.screen.shapes },
    whiteboard : { shapes: boards.whiteboard.shapes, aspectRatio: boardAspectRatio }
  });

  sendOp(op, null, [ session ]);
}

// =============================================================================
// 6. 指针绘制与本端操作提交
//
// pointermove 只更新本地预览节点；pointerup 才生成一次 shape:add 并通过
// sendOp() 同步完整笔画，避免自由画笔产生高频 SIP INFO。
// =============================================================================

/**
 * 获取当前指针在画布上的归一化坐标 [x, y]（0~1）。
 * 舞台不存在或尺寸为 0 时返回 null。
 *
 * @returns {number[]|null} 归一化坐标，无法获取时返回 null
 */
function getPointer()
{
  if (!inkStage) return null;

  const position = inkStage.getPointerPosition();

  if (!position || inkStage.width() <= 0 || inkStage.height() <= 0) return null;

  return toSourcePoint([
    clamp(position.x / inkStage.width(), 0, 1),
    clamp(position.y / inkStage.height(), 0, 1)
  ]);
}

/**
 * pointerdown 事件处理：开始绘制。
 *
 * 仅在白板模式或开启标注的屏幕模式下响应。创建 draftShape（含工具类型、
 * 颜色、线宽和起始点），生成预览节点并添加到 inkLayer。
 * 笔/橡皮工具额外初始化 points 数组。
 */
function startDraw()
{
  if (!inkStage || (inkMode !== 'whiteboard' && !inkOn)) return;

  setInkColor();

  const point = getPointer();

  if (!point) return;

  const colorInput = document.querySelector('#inkColor');
  const widthInput = document.querySelector('#inkWidth');
  const authorId = getInkUser();

  opSeq++;

  drawing = true;
  draftShape = {
    id          : `shape-${authorId}-${Date.now()}-${opSeq}`,
    type        : inkTool,
    color       : colorInput ? colorInput.value : '#ff3b30',
    authorId,
    authorLabel : getAnnotUserLabel(),
    widthNorm   : getInkWidthNorm(widthInput ? widthInput.value : 4),
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

/**
 * pointermove 事件处理：更新绘制预览。
 *
 * 笔/橡皮：限制最小采样距离（2/舞台短边）避免冗余点，限制最大点数 MAX_POINTS。
 * 形状工具（箭头/矩形/椭圆）：实时更新 end 坐标。每次移动销毁旧预览节点并创建新节点。
 */
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

/**
 * pointerup / pointercancel 事件处理：结束绘制并提交。
 *
 * 销毁预览节点，将 draftShape 通过 cleanShape() 校验后写入 Board
 * 并清空 redo 栈，最后通过 runOp() 同步给远端。
 * 校验失败的绘制（如点太少）直接丢弃并重绘画布。
 */
function endDraw()
{
  if (!drawing) return;

  drawing = false;
  if (draftNode) draftNode.destroy();

  const shape = cleanShape(draftShape);

  draftNode = null;
  draftShape = null;

  if (shape)
  {
    const boardId = getBoardId();
    const board = getBoard(boardId);

    board.redo = [];
    runOp('shape:add', { shape }, boardId);
  }
  else
  {
    renderBoard();
  }
}

/**
 * 统一入口：记录去重 → 更新本地画布 → 发送 SIP INFO 同步远端。
 * 所有本端标注操作（绘制、撤销、重做、清空）都应通过此函数提交。
 *
 * @param {string} action - 操作类型（如 'shape:add'）
 * @param {object} payload - 操作携带的业务数据
 * @param {string} [boardId] - 目标 board，省略时使用当前 mode 对应的 board
 */
// 本端绘制操作统一走”记录去重 → 更新画布 → SIP INFO 同步”。
function runOp(action, payload, boardId)
{
  const op = makeOp(action, boardId || getBoardId(), payload);

  rememberOp(op.operationId);
  if (applyOp(op)) sendOp(op);
}

// =============================================================================
// 7. 撤销、重做与作者范围清理
//
// Demo 只允许用户撤销或清除自己创建的图形。redo 栈属于各自 board，新的绘制
// 会清空该 board 的 redo，避免把另一条编辑分支重新插回画布。
// =============================================================================

/**
 * 获取当前用户在 board 中最新的自有图形（从后往前遍历）。
 * 用于判断撤销/重做/清空按钮的可用性和实际操作。
 *
 * @param {object} board - Board 状态对象
 * @returns {object|null} 最新的自有图形，没有时返回 null
 */
function getOwnShape(board)
{
  const senderId = getInkUser();

  for (let index = board.shapes.length - 1; index >= 0; index--)
  {
    if (board.shapes[index].authorId === senderId) return board.shapes[index];
  }

  return null;
}

/**
 * 撤销当前用户最后一个图形（移入 redo 栈，发送 shape:remove）。
 */
function undoInk()
{
  const boardId = getBoardId();
  const board = getBoard(boardId);
  const shape = getOwnShape(board);

  if (!shape) return;

  board.redo.push(shape);
  runOp('shape:remove', { shapeId: shape.id }, boardId);
}

/**
 * 重做最近一次撤销操作（从 redo 栈弹出，发送 shape:add）。
 */
function redoInk()
{
  const boardId = getBoardId();
  const board = getBoard(boardId);
  const shape = board.redo.pop();

  if (!shape) return;

  runOp('shape:add', { shape }, boardId);
}

/**
 * 清除当前用户在当前 Board 中的所有图形（发送 author:clear）。
 */
function clearMine()
{
  const boardId = getBoardId();
  const board = getBoard(boardId);
  const senderId = getInkUser();

  if (!board.shapes.some((shape) => shape.authorId === senderId)) return;

  runOp('author:clear', {}, boardId);
}

// =============================================================================
// 8. 白板工具栏、提示与自适应布局
//
// 这一组函数只负责 DOM/Konva 展示状态；SDK 调用仍集中在 sendOp()、bindInk()
// 和白板生命周期函数中，方便从页面操作定位真实的 SDK 接入点。
// =============================================================================

/**
 * 显示或隐藏清空确认弹窗。
 * 显示时自动聚焦确认按钮；隐藏时恢复工具栏状态。
 *
 * @param {boolean} visible - true 显示确认弹窗，false 隐藏
 */
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

/**
 * 根据当前工具类型更新操作提示文字。
 * 传入 message 参数时直接显示该文本；否则按 inkTool 显示预设提示。
 * 各工具的预设提示：笔—拖动画布绘制、箭头—拖动设置方向、矩形/椭圆—拖动绘制、橡皮—拖动擦除。
 *
 * @param {string} [message] - 自定义提示文本，省略时使用预设
 */
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

/**
 * 统一更新标注工具栏的所有 UI 状态。
 *
 * 根据当前 inkMode（白板/屏幕）、inkOn（标注开关）、boardUserId（白板发起方）
 * 综合决策：画布显隐、工具栏显隐、标注开关按钮、白板关闭按钮、工具激活状态、
 * 撤销/重做/清空按钮的禁用状态、提示文字。
 *
 * 每次标注操作后都应调用此函数同步 UI。
 */
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

/**
 * 计算等比包含矩形（白板模式 Stage 定位用）。
 *
 * @param {number} containerWidth - 容器宽度
 * @param {number} containerHeight - 容器高度
 * @param {number} aspectRatio - 目标宽高比
 * @returns {{left:number, top:number, width:number, height:number}} 居中后的矩形
 */
function getContainedBoardRect(containerWidth, containerHeight, aspectRatio)
{
  let width = containerWidth;
  let height = containerHeight;
  const ratio = cleanBoardAspectRatio(aspectRatio);

  if (ratio)
  {
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
  }

  return {
    left   : (containerWidth - width) / 2,
    top    : (containerHeight - height) / 2,
    width  : width,
    height : height
  };
}

function getShareVideoLayout(containerWidth, containerHeight, videoWidth, videoHeight, rotated)
{
  const viewWidth = rotated ? videoHeight : videoWidth;
  const viewHeight = rotated ? videoWidth : videoHeight;
  const scale = Math.min(containerWidth / viewWidth, containerHeight / viewHeight);
  const stageWidth = viewWidth * scale;
  const stageHeight = viewHeight * scale;
  const videoBoxWidth = rotated ? stageHeight : stageWidth;
  const videoBoxHeight = rotated ? stageWidth : stageHeight;

  return {
    stage : {
      left   : (containerWidth - stageWidth) / 2,
      top    : (containerHeight - stageHeight) / 2,
      width  : stageWidth,
      height : stageHeight
    },
    video : {
      left   : (containerWidth - videoBoxWidth) / 2,
      top    : (containerHeight - videoBoxHeight) / 2,
      width  : videoBoxWidth,
      height : videoBoxHeight
    },
    rotation : rotated ? 90 : 0
  };
}

/**
 * 根据容器尺寸自适应调整 Konva Stage 大小和位置。
 *
 * 白板模式：Stage 保持发起方比例并居中显示在共享浮层容器内。
 * 屏幕标注模式：Stage 按视频原始比例居中缩放，覆盖在视频元素上方。
 * 尺寸变化超过 1px 时触发 Konva 舞台重设和全量重绘。
 *
 * 触发时机：容器 ResizeObserver 回调、窗口 resize、视频 loadedmetadata。
 */
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
  const rotated = isInkViewRotated();
  let video = null;
  let videoLayout = null;

  if (inkMode === 'whiteboard')
  {
    const rect = getContainedBoardRect(
      container.clientWidth, container.clientHeight, getBoardViewAspectRatio(boardAspectRatio)
    );

    left = rect.left;
    top = rect.top;
    width = rect.width;
    height = rect.height;
  }
  else if (inkMode === 'local' || inkMode === 'remote')
  {
    video = document.querySelector(inkMode === 'local' ? '#screen' : '#shareVid');
    const videoWidth = video && video.videoWidth ? video.videoWidth : 16;
    const videoHeight = video && video.videoHeight ? video.videoHeight : 9;

    videoLayout = getShareVideoLayout(
      container.clientWidth, container.clientHeight, videoWidth, videoHeight, rotated
    );

    left = videoLayout.stage.left;
    top = videoLayout.stage.top;
    width = videoLayout.stage.width;
    height = videoLayout.stage.height;
  }

  const background = document.querySelector('#boardBg');

  [ stageEl, background ].forEach((element) =>
  {
    if (!element || (element === background && inkMode !== 'whiteboard')) return;
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  });

  if (video && videoLayout)
  {
    video.style.left = `${videoLayout.video.left}px`;
    video.style.top = `${videoLayout.video.top}px`;
    video.style.right = 'auto';
    video.style.bottom = 'auto';
    video.style.width = `${videoLayout.video.width}px`;
    video.style.height = `${videoLayout.video.height}px`;
    video.style.transform = `rotate(${videoLayout.rotation}deg)`;
  }

  const stageW = Math.max(1, Math.round(width));
  const stageH = Math.max(1, Math.round(height));

  if (inkStage.width() !== stageW || inkStage.height() !== stageH)
  {
    inkStage.size({ width: stageW, height: stageH });
    renderBoard();
  }
}

function onShareRotationChanged()
{
  drawing = false;
  if (draftNode) draftNode.destroy();
  draftNode = null;
  draftShape = null;
  resizeInk();
  renderBoard();
}

// =============================================================================
// 9. 标注模式、共享白板生命周期与初始化
//
// screen 模式依附本端/远端共享画面；whiteboard 模式使用独立画布并保存固定
// 目标集合。只有共享白板发起方可以广播 board:close，防止参与方误关全局白板。
// =============================================================================

/**
 * 切换标注模式并更新 Stage 背景和画布渲染。
 * 进入白板模式时显示白色背景，退出时隐藏。立即触发 resizeInk 和 renderBoard。
 *
 * @param {string} mode - 新标注模式：''|'local'|'remote'|'whiteboard'
 */
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

/**
 * 屏幕共享开始时初始化 screen board（清空图形、关闭标注开关）。
 * 由 showShare() 在显示共享画面前调用。
 */
function startInk()
{
  resetBoard('screen');
  inkOn = false;
}

/**
 * 屏幕共享停止时清理 screen board（清空图形、关闭标注开关）。
 * 由 hideShare() 在隐藏共享画面时调用。
 */
function stopInk()
{
  resetBoard('screen');
  inkOn = false;
}

/**
 * 切换屏幕标注开关。
 *
 * 仅 screen 模式下有效。开启时自动设置色板为当前用户配色。
 * 关闭时清除当前用户的所有标注并退出标注模式。
 */
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

/**
 * 打开共享白板。
 *
 * @param {boolean} notify - true 表示本端发起并发送 board:open 与快照；false
 *   表示响应远端通知，只更新本地页面，避免再次发送 INFO 形成回环
 * @returns {void}
 */
function openBoard(notify)
{
  if (notify !== false && (typeof appMode === 'undefined' || appMode !== 'conference'))
  {
    setStatus('共享白板仅在三方模式下由 A 端发起');

    return;
  }

  const targets = notify === false ? [] :
    (typeof appMode !== 'undefined' && appMode === 'conference' &&
      typeof getShareLegs === 'function' ?
      getShareLegs().map((leg) => leg.session) : getInkLegs());

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
    const box = document.querySelector('.screen-share-dialog-stage');

    boardAspectRatio = cleanBoardAspectRatio(
      box && box.clientHeight > 0 ? box.clientWidth / box.clientHeight : 0
    );
  }

  if (notify !== false)
  {
    boardLegs.clear();
    targets.forEach((session) => boardLegs.add(session));
    refreshShare();

    const op = makeOp('board:open', 'whiteboard', { aspectRatio: boardAspectRatio });

    rememberOp(op.operationId);
    sendOp(op, null, targets);
    targets.forEach(sendSnapshot);
    setStatus(`共享白板已发送给 ${targets.length} 个目标`);
  }
}

/**
 * 关闭共享白板。
 *
 * @param {boolean} notify - true 表示由白板发起方广播 board:close；false 表示
 *   响应远端关闭通知。两种路径都会恢复之前的共享画面模式并清理目标集合。
 * @returns {void}
 */
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

  drawing = false;
  if (draftNode) draftNode.destroy();
  draftNode = null;
  draftShape = null;
  resetBoard('whiteboard');
  boardUserId = '';
  boardAspectRatio = 0;

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

/**
 * 完全重置所有标注状态到初始值。
 *
 * 清空两个 Board、去重集合、白板目标集合、刷新 UI，
 * 重置所有模式、开关、用户缓存和绘制状态。
 * 在最后一个会话结束或手动重置时调用。
 */
function resetInk()
{
  resetBoard('screen');
  resetBoard('whiteboard');
  seenOps.clear();
  boardLegs.clear();
  refreshShare();
  boardUserId = '';
  boardAspectRatio = 0;
  colorUserId = '';
  prevMode = '';
  inkOn = false;
  drawing = false;
  draftNode = null;
  draftShape = null;
  if (inkMode === 'whiteboard') closeShareBox('whiteboard');
  setInkMode('');
}

/**
 * 初始化 Konva 舞台并绑定白板工具栏事件。
 *
 * 该函数只在页面脚本加载后调用一次。绘制事件使用 pointer 系列，同时兼容
 * 鼠标、触控笔和触摸；ResizeObserver 不可用时退回 window.resize。
 * SDK 会话事件不在这里绑定，而是在 newRTCSession 时调用 bindInk(session)。
 *
 * @returns {void}
 */
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
  document.querySelector('#inkClear').onclick = function()
  {
    if (getOwnShape(getBoard(getBoardId()))) showClearBox(true);
  };
  document.querySelector('#inkClearOk').onclick = function()
  {
    clearMine();
    showClearBox(false);
  };
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

// 标注模块负责初始化自己的 Konva 画布和白板工具栏事件。
initInk();
