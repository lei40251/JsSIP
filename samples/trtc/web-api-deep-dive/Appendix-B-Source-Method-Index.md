# 附录 B 源码方法索引

> 本附录用于从源码方法反查所属层和直接 Web API，不替代主线文档中的对象关系和间接调用链。
> 目标：看到 `trtc.deobfuscated.js` 中的方法名或方法注释后，可以按源码行号找到所属子系统、直接使用的 Web API 和对应专项。
> `直接 Web API` 来自方法源码区间的机械扫描；`—` 表示该方法主要做内部计算/编排，或 Web API 位于它调用的下游方法。详细间接调用链以对应专项为准。
当前索引包含 **2490** 个带 JSDoc 标识的方法、构造器或内部函数。
## 运行时 Polyfill（L1-L6650）
详见：`00-Reading-Guide-and-Source-Map.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `e — 源码命名函数` | L31 | `function e(e, t)` | — |
| `get — 源码命名函数` | L52 | `get        : function()` | — |
| `i — 源码命名函数` | L75 | `function i(e)` | — |
| `s — 源码命名函数` | L95 | `s = function(e)` | — |
| `get — 源码命名函数` | L110 | `get : function()` | — |
| `E — 源码命名函数` | L149 | `E = function(e, t)` | — |
| `b — 源码命名函数` | L169 | `b = function(e)` | — |
| `P — 源码命名函数` | L186 | `P = function(e)` | — |
| `x — 源码命名函数` | L192 | `x = function(e)` | — |
| `F — 源码命名函数` | L200 | `F = function(e)` | — |
| `G — 源码命名函数` | L216 | `G = function(e)` | — |
| `q — 源码命名函数` | L222 | `q = function(e, t)` | — |
| `_e — 源码命名函数` | L271 | `_e = function(e)` | — |
| `Te — 源码命名函数` | L285 | `Te = function(e)` | — |
| `Se — 源码命名函数` | L292 | `Se = function(e, t)` | — |
| `we — 源码命名函数` | L306 | `we = function(e, t)` | — |
| `Ve — 源码命名函数` | L333 | `Ve = function(e, t)` | — |
| `Be — 源码命名函数` | L339 | `Be = function(e)` | — |
| `Ke — 源码命名函数` | L355 | `Ke = function(e)` | — |
| `rt — 源码命名函数` | L367 | `rt = function(e)` | — |
| `ct — 源码命名函数` | L375 | `ct = function(e, t)` | — |
| `ut — 源码命名函数` | L386 | `ut = function(e, t)` | — |
| `mt — 源码命名函数` | L402 | `mt = function(e)` | — |
| `Et — 源码命名函数` | L412 | `Et = function(e)` | — |
| `get — 源码命名函数` | L423 | `get : function()` | — |
| `Lt — 源码命名函数` | L463 | `Lt = function(e)` | — |
| `_i — 源码命名函数` | L554 | `_i = function(e)` | — |
| `enforce — 内部函数` | L618 | `enforce : function(e)` | — |
| `getterFor — 内部函数` | L624 | `getterFor : function(e)` | — |
| `$i — 源码命名函数` | L687 | `$i = function(e, t, i, r)` | — |
| `or — 源码命名函数` | L721 | `or = function(e)` | — |
| `lr — 源码命名函数` | L731 | `lr = function(e, t)` | — |
| `hr — 源码命名函数` | L740 | `hr = function(e)` | — |
| `mr — 源码命名函数` | L748 | `mr = function(e)` | — |
| `Er — 源码命名函数` | L755 | `Er = function(e)` | — |
| `Rr — 源码命名函数` | L781 | `Rr = function(e, t)` | — |
| `Br — 源码命名函数` | L833 | `Br = function(e, t, i)` | — |
| `jr — 源码命名函数` | L845 | `jr = function(e, t)` | — |
| `nn — 源码命名函数` | L868 | `nn = function(e, t)` | — |
| `_n — 源码命名函数` | L939 | `_n = function(e)` | — |
| `En — 源码命名函数` | L947 | `En = function(e, t, i)` | — |
| `Nn — 源码命名函数` | L966 | `Nn = function()` | — |
| `get — 源码命名函数` | L985 | `get          : function()` | — |
| `oo — 源码命名函数` | L1036 | `oo = function() {},` | — |
| `so — 源码命名函数` | L1037 | `so = function(e)` | — |
| `ao — 源码命名函数` | L1041 | `ao = function(e)` | — |
| `co — 源码命名函数` | L1049 | `co = function()` | — |
| `includes — 内部函数` | L1120 | `includes : function(e)` | — |
| `e — 源码命名函数` | L1134 | `function e() {}` | — |
| `jo — 源码命名函数` | L1186 | `jo = function(e, t, i)` | — |
| `Xo — 源码命名函数` | L1195 | `Xo = function()` | — |
| `Qo — 源码命名函数` | L1199 | `Qo = function(e, t, i, r)` | — |
| `ts — 源码命名函数` | L1209 | `ts = function(e)` | — |
| `ns — 源码命名函数` | L1215 | `ns = function(e, t, i)` | — |
| `as — 源码命名函数` | L1225 | `as = function(e)` | — |
| `bs — 源码命名函数` | L1269 | `bs = function()` | — |
| `ks — 源码命名函数` | L1273 | `ks = function(e, t, i, r, n, o, s)` | — |
| `d — 源码命名函数` | L1279 | `d = function(e)` | — |
| `Ds — 源码命名函数` | L1330 | `Ds = function(e, t)` | — |
| `Ys — 源码命名函数` | L1385 | `Ys = function(e)` | — |
| `Zs — 源码命名函数` | L1414 | `Zs = function(e, t)` | — |
| `ia — 源码命名函数` | L1438 | `ia = function(e)` | — |
| `reduce — 内部函数` | L1465 | `reduce : function(e)` | — |
| `reduceRight — 内部函数` | L1480 | `reduceRight : function(e)` | — |
| `reverse — 内部函数` | L1502 | `reverse : function()` | — |
| `Ea — 源码命名函数` | L1514 | `Ea = function(e, t)` | — |
| `wa — 源码命名函数` | L1545 | `wa = function(e, t)` | — |
| `sort — 内部函数` | L1619 | `sort : function(e)` | — |
| `Ka — 源码命名函数` | L1657 | `Ka = function(e, t, i)` | — |
| `Qa — 源码命名函数` | L1665 | `Qa = function(e, t)` | — |
| `tc — 源码命名函数` | L1673 | `tc = function(e)` | — |
| `oc — 源码命名函数` | L1694 | `oc = function(e)` | — |
| `ac — 源码命名函数` | L1699 | `ac = function(e, t, i, r)` | — |
| `pack — 内部函数` | L1725 | `pack : function(e, t, i)` | — |
| `unpack — 内部函数` | L1759 | `unpack : function(e, t)` | — |
| `Tc — 源码命名函数` | L1787 | `Tc = function(e)` | — |
| `Ic — 源码命名函数` | L1806 | `Ic = function(e, t, i)` | — |
| `pl — 源码命名函数` | L1856 | `pl = function(e)` | — |
| `ml — 源码命名函数` | L1860 | `ml = function(e)` | — |
| `_l — 源码命名函数` | L1864 | `_l = function(e)` | — |
| `fl — 源码命名函数` | L1868 | `fl = function(e)` | — |
| `gl — 源码命名函数` | L1872 | `gl = function(e)` | — |
| `El — 源码命名函数` | L1876 | `El = function(e)` | — |
| `Tl — 源码命名函数` | L1880 | `Tl = function(e, t, i)` | — |
| `get — 源码命名函数` | L1884 | `get          : function()` | — |
| `vl — 源码命名函数` | L1890 | `vl = function(e, t, i, r)` | — |
| `yl — 源码命名函数` | L1904 | `yl = function(e, t, i, r, n, o)` | — |
| `setInt8 — 内部函数` | L1948 | `setInt8 : function(e, t)` | — |
| `setUint8 — 内部函数` | L1954 | `setUint8 : function(e, t)` | — |
| `getInt8 — 内部函数` | L1985 | `getInt8 : function(e)` | — |
| `getUint8 — 内部函数` | L1991 | `getUint8 : function(e)` | — |
| `getInt16 — 内部函数` | L1997 | `getInt16 : function(e)` | — |
| `getUint16 — 内部函数` | L2006 | `getUint16 : function(e)` | — |
| `getInt32 — 内部函数` | L2015 | `getInt32 : function(e)` | — |
| `getUint32 — 内部函数` | L2021 | `getUint32 : function(e)` | — |
| `getFloat32 — 内部函数` | L2027 | `getFloat32 : function(e)` | — |
| `getFloat64 — 内部函数` | L2033 | `getFloat64 : function(e)` | — |
| `setInt8 — 内部函数` | L2039 | `setInt8 : function(e, t)` | — |
| `setUint8 — 内部函数` | L2045 | `setUint8 : function(e, t)` | — |
| `setInt16 — 内部函数` | L2051 | `setInt16 : function(e, t)` | — |
| `setUint16 — 内部函数` | L2057 | `setUint16 : function(e, t)` | — |
| `setInt32 — 内部函数` | L2063 | `setInt32 : function(e, t)` | — |
| `setUint32 — 内部函数` | L2069 | `setUint32 : function(e, t)` | — |
| `setFloat32 — 内部函数` | L2075 | `setFloat32 : function(e, t)` | — |
| `setFloat64 — 内部函数` | L2081 | `setFloat64 : function(e, t)` | — |
| `wl — 源码命名函数` | L2093 | `wl = function(e)` | — |
| `get — 源码命名函数` | L2102 | `get          : function()` | — |
| `xl — 源码命名函数` | L2115 | `xl = function(e)` | — |
| `slice — 内部函数` | L2143 | `slice : function(e, t)` | — |
| `ed — 源码命名函数` | L2169 | `ed = function() {},` | — |
| `od — 源码命名函数` | L2174 | `od = function(e)` | — |
| `sd — 源码命名函数` | L2186 | `sd = function(e)` | — |
| `_d — 源码命名函数` | L2233 | `_d = function(e)` | — |
| `vd — 源码命名函数` | L2242 | `vd = function(e, t)` | — |
| `Dd — 源码命名函数` | L2265 | `Dd = function(e, t)` | — |
| `Nd — 源码命名函数` | L2280 | `Nd = function(e, t)` | — |
| `iu — 源码命名函数` | L2323 | `iu = function(e)` | — |
| `ru — 源码命名函数` | L2330 | `ru = function(e)` | — |
| `nu — 源码命名函数` | L2334 | `nu = function(e)` | — |
| `lu — 源码命名函数` | L2391 | `lu = function(e)` | — |
| `du — 源码命名函数` | L2399 | `du = function()` | — |
| `add — 源码命名函数` | L2405 | `add : function(e)` | — |
| `get — 源码命名函数` | L2412 | `get : function()` | — |
| `Mu — 源码命名函数` | L2445 | `Mu = function()` | — |
| `xu — 源码命名函数` | L2492 | `xu = function(e)` | — |
| `r — 源码命名函数` | L2529 | `r = function(e)` | — |
| `eh — 源码命名函数` | L2546 | `eh = function(e)` | — |
| `Th — 源码命名函数` | L2581 | `Th = function(e, t)` | — |
| `Hh — 源码命名函数` | L2610 | `Hh = function(e)` | — |
| `Wh — 源码命名函数` | L2617 | `Wh = function(e, t)` | — |
| `Gh — 源码命名函数` | L2642 | `Gh = function(e, t)` | — |
| `jh — 源码命名函数` | L2652 | `jh = function(e, t, i)` | — |
| `Jh — 源码命名函数` | L2661 | `Jh = function(e)` | — |
| `qh — 源码命名函数` | L2681 | `qh = function(e)` | — |
| `zh — 源码命名函数` | L2685 | `zh = function(e)` | — |
| `Kh — 源码命名函数` | L2694 | `Kh = function(e, t, i)` | — |
| `Yh — 源码命名函数` | L2701 | `Yh = function(e, t, i)` | — |
| `Xh — 源码命名函数` | L2705 | `Xh = function(e, t, i)` | — |
| `ep — 源码命名函数` | L2829 | `ep = function(e)` | — |
| `sp — 源码命名函数` | L2838 | `sp = function(e)` | — |
| `pp — 源码命名函数` | L2848 | `pp = function(e, t)` | — |
| `gp — 源码命名函数` | L2858 | `gp = function(e, t, i)` | — |
| `Dp — 源码命名函数` | L2893 | `Dp = function(e, t)` | — |
| `Np — 源码命名函数` | L2898 | `Np = function(e, t, i)` | — |
| `f — 源码命名函数` | L2913 | `f = function(e)` | — |
| `g — 源码命名函数` | L2917 | `g = function(e)` | — |
| `next — 执行下一步（迭代器）` | L2957 | `next : function()` | — |
| `return — 内部函数` | L2963 | `return : function()` | — |
| `next — 执行下一步（迭代器）` | L2999 | `next : function()` | — |
| `all — 源码命名函数` | L3028 | `all : function(e)` | — |
| `catch — 内部函数` | L3072 | `catch : function(e)` | — |
| `race — 内部函数` | L3095 | `race : function(e)` | — |
| `reject — 内部函数` | L3121 | `reject : function(e)` | — |
| `am — 源码命名函数` | L3134 | `am = function(e, t)` | — |
| `resolve — 内部函数` | L3150 | `resolve : function(e)` | — |
| `finally — 内部函数` | L3181 | `finally : function(e)` | — |
| `Am — 源码命名函数` | L3221 | `Am = function(e)` | — |
| `Cm — 源码命名函数` | L3229 | `Cm = function()` | — |
| `Om — 源码命名函数` | L3252 | `Om = function(e)` | — |
| `o_ — 源码命名函数` | L3316 | `o_ = function(e, t, i)` | — |
| `get — 源码命名函数` | L3321 | `get          : function()` | — |
| `set — 源码命名函数` | L3325 | `set : function(e)` | — |
| `sf — 源码命名函数` | L3553 | `sf = function(e)` | — |
| `uf — 源码命名函数` | L3568 | `uf = function(e)` | — |
| `padStart — 内部函数` | L3592 | `padStart : function(e)` | — |
| `wf — 源码命名函数` | L3614 | `wf = function(e)` | — |
| `Hf — 源码命名函数` | L3648 | `Hf = function(e, t, i, r, n, o)` | — |
| `Qf — 源码命名函数` | L3701 | `Qf = function(e, t, i, r)` | — |
| `sg — 源码命名函数` | L3770 | `sg = function(e, t, i)` | — |
| `lg — 源码命名函数` | L3776 | `lg = function(e, t)` | — |
| `gg — 源码命名函数` | L3797 | `gg = function(e)` | — |
| `kg — 源码命名函数` | L3887 | `kg = function(e)` | — |
| `trim — 内部函数` | L3916 | `trim : function()` | — |
| `gE — 源码命名函数` | L3970 | `gE = function(e)` | — |
| `EE — 源码命名函数` | L3982 | `EE = function(e)` | — |
| `get — 源码命名函数` | L4007 | `get          : function()` | — |
| `aTypedArray — 内部函数` | L4018 | `aTypedArray : function(e)` | — |
| `aTypedArrayConstructor — 内部函数` | L4025 | `aTypedArrayConstructor : function(e)` | — |
| `exportTypedArrayMethod — 内部函数` | L4032 | `exportTypedArrayMethod : function(e, t, i, r)` | — |
| `exportTypedArrayStaticMethod — 内部函数` | L4060 | `exportTypedArrayStaticMethod : function(e, t, i)` | — |
| `isView — 内部函数` | L4089 | `isView : function(e)` | Encoding/binary |
| `OE — 源码命名函数` | L4136 | `OE = function(e)` | — |
| `ME — 源码命名函数` | L4145 | `ME = function(e, t)` | — |
| `FE — 源码命名函数` | L4157 | `FE = function(e)` | — |
| `KE — 源码命名函数` | L4173 | `KE = function(e)` | — |
| `QE — 源码命名函数` | L4182 | `QE = function(e)` | — |
| `rT — 源码命名函数` | L4210 | `rT = function(e)` | — |
| `cT — 源码命名函数` | L4226 | `cT = function(e, t)` | — |
| `dT — 源码命名函数` | L4231 | `dT = function(e)` | — |
| `bT — 源码命名函数` | L4308 | `bT = function(e)` | — |
| `GT — 源码命名函数` | L4330 | `GT = function(e, t, i)` | — |
| `av — 源码命名函数` | L4353 | `av = function(e, t)` | — |
| `get — 源码命名函数` | L4357 | `get          : function()` | — |
| `cv — 源码命名函数` | L4363 | `cv = function(e)` | Encoding/binary |
| `lv — 源码命名函数` | L4370 | `lv = function(e, t)` | — |
| `dv — 源码命名函数` | L4374 | `dv = function(e, t)` | — |
| `uv — 源码命名函数` | L4378 | `uv = function(e, t, i)` | — |
| `u — 源码命名函数` | L4406 | `u = function(e, t)` | — |
| `get — 源码命名函数` | L4409 | `get : function()` | — |
| `set — 源码命名函数` | L4419 | `set : function(e)` | — |
| `valueOf — function valueOf() { [native code] }` | L4545 | `valueOf : function()` | — |
| `replaceAll — 内部函数` | L4708 | `replaceAll : function(e, t)` | — |
| `Iy — 源码命名函数` | L4788 | `Iy = function(e)` | — |
| `Py — 源码命名函数` | L4811 | `Py = function(e, t)` | — |
| `Ky — 源码命名函数` | L4864 | `Ky = function(e, t)` | — |
| `get — 源码命名函数` | L4973 | `get        : function()` | — |
| `DS — 源码命名函数` | L5016 | `DS = function(e, t, i, r)` | — |
| `PS — 源码命名函数` | L5030 | `PS = function(e, t, i)` | — |
| `ZS — 源码命名函数` | L5052 | `ZS = function(e)` | — |
| `$S — 源码命名函数` | L5056 | `$S = function(e, t, i)` | — |
| `eI — 源码命名函数` | L5064 | `eI = function(e)` | — |
| `fromCodePoint — 内部函数` | L5138 | `fromCodePoint : function(e)` | — |
| `dA — 源码命名函数` | L5207 | `dA = function(e, t)` | — |
| `uA — 源码命名函数` | L5214 | `uA = function(e)` | — |
| `hA — 源码命名函数` | L5220 | `hA = function(e)` | — |
| `pA — 源码命名函数` | L5241 | `pA = function(e)` | — |
| `fA — 源码命名函数` | L5301 | `fA = function(e)` | — |
| `gA — 源码命名函数` | L5305 | `gA = function(e)` | — |
| `TA — 源码命名函数` | L5336 | `TA = function(e)` | — |
| `bindURL — 内部函数` | L5349 | `bindURL : function(e)` | — |
| `parseObject — 内部函数` | L5355 | `parseObject : function(e)` | — |
| `parseQuery — 内部函数` | L5378 | `parseQuery : function(e)` | — |
| `serialize — 内部函数` | L5386 | `serialize : function()` | — |
| `update — 内部函数` | L5394 | `update : function()` | — |
| `updateURL — 内部函数` | L5400 | `updateURL : function()` | — |
| `append — 内部函数` | L5419 | `append : function(e, t)` | — |
| `delete — 内部函数` | L5427 | `delete : function(e)` | — |
| `get — 源码命名函数` | L5449 | `get : function(e)` | — |
| `getAll — 内部函数` | L5459 | `getAll : function(e)` | — |
| `has — 源码命名函数` | L5469 | `has : function(e)` | — |
| `set — 源码命名函数` | L5489 | `set : function(e, t)` | — |
| `sort — 内部函数` | L5499 | `sort : function()` | — |
| `forEach — 内部函数` | L5511 | `forEach : function(e)` | — |
| `keys — 内部函数` | L5522 | `keys : function()` | — |
| `values — 内部函数` | L5528 | `values : function()` | — |
| `entries — 内部函数` | L5534 | `entries : function()` | — |
| `get — 源码命名函数` | L5554 | `get : function()` | — |
| `AA — 源码命名函数` | L5568 | `AA = function(e)` | — |
| `fetch — 内部函数` | L5591 | `fetch : function(e)` | — |
| `UA — 源码命名函数` | L5623 | `UA = function(e)` | — |
| `HA — 源码命名函数` | L5651 | `HA = function(e)` | — |
| `DR — 源码命名函数` | L5703 | `DR = function(e)` | — |
| `MR — 源码命名函数` | L5740 | `MR = function(e, t)` | — |
| `xR — 源码命名函数` | L5748 | `xR = function(e, t)` | — |
| `VR — 源码命名函数` | L5755 | `VR = function(e)` | — |
| `UR — 源码命名函数` | L5766 | `UR = function(e)` | — |
| `sC — 源码命名函数` | L5791 | `sC = function(e, t, i)` | — |
| `parse — 内部函数` | L5813 | `parse : function(e, t, i)` | — |
| `parseHost — 内部函数` | L6163 | `parseHost : function(e)` | — |
| `h — 源码命名函数` | L6185 | `h = function()` | — |
| `cannotHaveUsernamePasswordPort — 内部函数` | L6308 | `cannotHaveUsernamePasswordPort : function()` | — |
| `includesCredentials — 内部函数` | L6314 | `includesCredentials : function()` | — |
| `isSpecial — 内部函数` | L6320 | `isSpecial : function()` | — |
| `shortenPath — 内部函数` | L6326 | `shortenPath : function()` | — |
| `serialize — 内部函数` | L6335 | `serialize : function()` | — |
| `setHref — 内部函数` | L6364 | `setHref : function(e)` | — |
| `getOrigin — 内部函数` | L6373 | `getOrigin : function()` | — |
| `getProtocol — 内部函数` | L6392 | `getProtocol : function()` | — |
| `setProtocol — 内部函数` | L6398 | `setProtocol : function(e)` | — |
| `getUsername — 内部函数` | L6404 | `getUsername : function()` | — |
| `setUsername — 内部函数` | L6410 | `setUsername : function(e)` | — |
| `getPassword — 内部函数` | L6422 | `getPassword : function()` | — |
| `setPassword — 内部函数` | L6428 | `setPassword : function(e)` | — |
| `getHost — 内部函数` | L6440 | `getHost : function()` | — |
| `setHost — 内部函数` | L6450 | `setHost : function(e)` | — |
| `getHostname — 内部函数` | L6456 | `getHostname : function()` | — |
| `setHostname — 内部函数` | L6465 | `setHostname : function(e)` | — |
| `getPort — 内部函数` | L6471 | `getPort : function()` | — |
| `setPort — 内部函数` | L6480 | `setPort : function(e)` | — |
| `getPathname — 内部函数` | L6486 | `getPathname : function()` | — |
| `setPathname — 内部函数` | L6495 | `setPathname : function(e)` | — |
| `getSearch — 内部函数` | L6501 | `getSearch : function()` | — |
| `setSearch — 内部函数` | L6510 | `setSearch : function(e)` | — |
| `getSearchParams — 内部函数` | L6519 | `getSearchParams : function()` | — |
| `getHash — 内部函数` | L6525 | `getHash : function()` | — |
| `setHash — 内部函数` | L6534 | `setHash : function(e)` | — |
| `update — 内部函数` | L6542 | `update : function()` | — |
| `lC — 源码命名函数` | L6569 | `lC = function(e, t)` | — |
| `get — 源码命名函数` | L6572 | `get : function()` | — |
| `toJSON — 内部函数` | L6633 | `toJSON : function()` | URL/Blob |
| `_C — 源码命名函数` | L6643 | `function _C(e, t, i)` | — |
## WebRTC Adapter（L6651-L9450）
详见：`02-RTCPeerConnection-usage-analysis.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `fC — 源码命名函数` | L6654 | `function fC(e, t, i)` | RTCPeerConnection |
| `o — 源码命名函数` | L6663 | `const o = (e) =>` | — |
| `gC — 内部函数` | L6709 | `function gC(e)` | — |
| `EC — 内部函数` | L6717 | `function EC(e)` | — |
| `TC — 内部函数` | L6725 | `function TC()` | — |
| `vC — 内部函数` | L6735 | `function vC(e, t)` | — |
| `yC — 内部函数` | L6741 | `function yC(e)` | — |
| `SC — 内部函数` | L6747 | `function SC(e)` | — |
| `IC — 内部函数` | L6763 | `function IC(e, t, i)` | — |
| `AC — 内部函数` | L6781 | `function AC(e, t, i)` | — |
| `CC — 内部函数` | L6808 | `function CC(e, t)` | enumerateDevices、Track lifecycle |
| `n — 内部函数` | L6858 | `n = function(e, n)` | enumerateDevices |
| `o — 内部函数` | L6916 | `o = function(e)` | — |
| `bC — 源码命名函数` | L7001 | `function bC(e)` | — |
| `kC — 源码命名函数` | L7009 | `function kC(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L7028 | `e.RTCPeerConnection.prototype.setRemoteDescription = function()` | RTCPeerConnection |
| `DC — 源码命名函数` | L7079 | `function DC(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、MediaStreamTrack |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7106 | `e.RTCPeerConnection.prototype.getSenders = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7113 | `e.RTCPeerConnection.prototype.addTrack = function(e, r)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | L7124 | `e.RTCPeerConnection.prototype.removeTrack = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L7136 | `e.RTCPeerConnection.prototype.addStream = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7149 | `e.RTCPeerConnection.prototype.removeStream = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7174 | `(e.RTCPeerConnection.prototype.getSenders = function()` | RTCPeerConnection |
| `wC — 源码命名函数` | L7202 | `function wC(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | L7207 | `e.RTCPeerConnection.prototype.getStats = function()` | RTCPeerConnection |
| `o — 内部函数` | L7239 | `o = function(e)` | — |
| `NC — 源码命名函数` | L7273 | `function NC(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、MediaStreamTrack |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7282 | `(e.RTCPeerConnection.prototype.getSenders = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7294 | `(e.RTCPeerConnection.prototype.addTrack = function()` | RTCPeerConnection |
| `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | L7303 | `(e.RTCRtpSender.prototype.getStats = function()` | RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.getReceivers — 获取 RTCRtpReceiver 列表` | L7318 | `(e.RTCPeerConnection.prototype.getReceivers = function()` | RTCPeerConnection |
| `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | L7328 | `(e.RTCRtpReceiver.prototype.getStats = function()` | RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | L7340 | `e.RTCPeerConnection.prototype.getStats = function()` | RTCPeerConnection、MediaStreamTrack |
| `OC — 源码命名函数` | L7376 | `function OC(e)` | RTCPeerConnection、MediaStreamTrack |
| `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | L7378 | `e.RTCPeerConnection.prototype.getLocalStreams = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7388 | `e.RTCPeerConnection.prototype.addTrack = function(e, i)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L7406 | `e.RTCPeerConnection.prototype.addStream = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7425 | `e.RTCPeerConnection.prototype.removeStream = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | L7437 | `e.RTCPeerConnection.prototype.removeTrack = function(e)` | RTCPeerConnection |
| `PC — 源码命名函数` | L7460 | `function PC(e, t)` | RTCPeerConnection、RTCSessionDescription、RTCRtpSender/Receiver/Transceiver、MediaStream、MediaStreamTrack |
| `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | L7466 | `e.RTCPeerConnection.prototype.getLocalStreams = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L7477 | `e.RTCPeerConnection.prototype.addStream = function(t)` | RTCPeerConnection、MediaStream |
| `o — 内部函数` | L7500 | `function o(e, t)` | RTCSessionDescription |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7519 | `(e.RTCPeerConnection.prototype.removeStream = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7529 | `(e.RTCPeerConnection.prototype.addTrack = function(t, i)` | RTCPeerConnection、MediaStream |
| `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | L7592 | `e.RTCPeerConnection.prototype.setLocalDescription = function()` | RTCPeerConnection、RTCSessionDescription |
| `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | L7628 | `(e.RTCPeerConnection.prototype.removeTrack = function(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver |
| `MC — 源码命名函数` | L7656 | `function MC(e, t)` | RTCPeerConnection、RTCSessionDescription、RTCIceCandidate |
| `LC — 源码命名函数` | L7683 | `function LC(e, t)` | — |
| `shimGetDisplayMedia — 内部函数` | L7709 | `shimGetDisplayMedia : function(e, t)` | getUserMedia |
| `VC — 源码命名函数` | L7742 | `function VC(e, t)` | getUserMedia、MediaStreamTrack |
| `r.prototype.getSettings — 原型方法` | L7778 | `r.prototype.getSettings = function()` | — |
| `r.prototype.applyConstraints — 原型方法` | L7792 | `r.prototype.applyConstraints = function(i)` | — |
| `UC — 源码命名函数` | L7811 | `function UC(e)` | — |
| `FC — 源码命名函数` | L7828 | `function FC(e, t)` | RTCPeerConnection、RTCSessionDescription、RTCIceCandidate |
| `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | L7859 | `e.RTCPeerConnection.prototype.getStats = function()` | RTCPeerConnection |
| `BC — 源码命名函数` | L7896 | `function BC(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、MediaStreamTrack |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7904 | `(e.RTCPeerConnection.prototype.getSenders = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7916 | `(e.RTCPeerConnection.prototype.addTrack = function()` | RTCPeerConnection |
| `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | L7925 | `(e.RTCRtpSender.prototype.getStats = function()` | RTCRtpSender/Receiver/Transceiver |
| `HC — 源码命名函数` | L7934 | `function HC(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.getReceivers — 获取 RTCRtpReceiver 列表` | L7942 | `(e.RTCPeerConnection.prototype.getReceivers = function()` | RTCPeerConnection |
| `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | L7952 | `(e.RTCRtpReceiver.prototype.getStats = function()` | RTCRtpSender/Receiver/Transceiver |
| `WC — 源码命名函数` | L7961 | `function WC(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7966 | `(e.RTCPeerConnection.prototype.removeStream = function(e)` | RTCPeerConnection |
| `GC — 源码命名函数` | L7980 | `function GC(e)` | RTCDataChannel |
| `jC — 内部函数` | L7985 | `function jC(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.addTransceiver — 添加 RTCRtpTransceiver` | L7993 | `(e.RTCPeerConnection.prototype.addTransceiver = function()` | RTCPeerConnection |
| `JC — 源码命名函数` | L8045 | `function JC(e)` | RTCRtpSender/Receiver/Transceiver |
| `RTCRtpSender.prototype.getParameters — 原型方法` | L8052 | `(e.RTCRtpSender.prototype.getParameters = function()` | RTCRtpSender/Receiver/Transceiver |
| `qC — 内部函数` | L8062 | `function qC(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L8068 | `e.RTCPeerConnection.prototype.createOffer = function()` | RTCPeerConnection |
| `zC — 内部函数` | L8083 | `function zC(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.createAnswer — 创建 SDP Answer` | L8089 | `e.RTCPeerConnection.prototype.createAnswer = function()` | RTCPeerConnection |
| `shimGetDisplayMedia — 内部函数` | L8117 | `shimGetDisplayMedia : function(e, t)` | getUserMedia |
| `YC — 源码命名函数` | L8144 | `function YC(e)` | RTCPeerConnection、MediaStreamTrack |
| `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | L8151 | `(e.RTCPeerConnection.prototype.getLocalStreams = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L8161 | `(e.RTCPeerConnection.prototype.addStream = function(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L8171 | `(e.RTCPeerConnection.prototype.addTrack = function(e, ...i)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L8188 | `(e.RTCPeerConnection.prototype.removeStream = function(e)` | RTCPeerConnection |
| `XC — 源码命名函数` | L8209 | `function XC(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.getRemoteStreams — 原型方法` | L8216 | `(e.RTCPeerConnection.prototype.getRemoteStreams = function()` | RTCPeerConnection |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L8253 | `e.RTCPeerConnection.prototype.setRemoteDescription = function()` | RTCPeerConnection |
| `QC — 源码命名函数` | L8286 | `function QC(e)` | RTCPeerConnection |
| `ZC — 源码命名函数` | L8342 | `function ZC(e)` | getUserMedia |
| `$C — 源码命名函数` | L8361 | `function $C(e)` | — |
| `eb — 源码命名函数` | L8369 | `function eb(e)` | RTCPeerConnection |
| `tb — 内部函数` | L8402 | `function tb(e)` | — |
| `ib — 内部函数` | L8417 | `function ib(e)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L8422 | `e.RTCPeerConnection.prototype.createOffer = function(e)` | RTCPeerConnection |
| `rb — 内部函数` | L8454 | `function rb(e)` | AudioContext |
| `generateIdentifier — 内部函数` | L8476 | `generateIdentifier : function()` | — |
| `lb — 内部函数` | L9093 | `function lb(e)` | RTCIceCandidate |
| `db — 内部函数` | L9143 | `function db(e)` | RTCIceCandidate |
| `ub — 内部函数` | L9161 | `function ub(e, t)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L9174 | `e.RTCPeerConnection.prototype.setRemoteDescription = function()` | RTCPeerConnection |
| `i — 内部函数` | L9223 | `i = (function(e)` | — |
| `r — 内部函数` | L9245 | `r = (function(e, i)` | — |
| `hb — 内部函数` | L9273 | `function hb(e)` | RTCPeerConnection、RTCDataChannel |
| `t — 内部函数` | L9278 | `function t(e, t)` | — |
| `RTCPeerConnection.prototype.createDataChannel — 创建 RTCDataChannel 数据通道` | L9296 | `(e.RTCPeerConnection.prototype.createDataChannel = function()` | RTCPeerConnection |
| `pb — 源码命名函数` | L9312 | `function pb(e)` | RTCPeerConnection |
| `mb — 内部函数` | L9369 | `function mb(e, t)` | RTCPeerConnection、RTCSessionDescription |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L9377 | `e.RTCPeerConnection.prototype.setRemoteDescription = function(t)` | RTCPeerConnection、RTCSessionDescription |
| `_b — 内部函数` | L9397 | `function _b(e, t)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.addIceCandidate — 添加 ICE 候选地址` | L9406 | `(e.RTCPeerConnection.prototype.addIceCandidate = function()` | RTCPeerConnection |
| `fb — 内部函数` | L9421 | `function fb(e, t)` | RTCPeerConnection |
| `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | L9430 | `(e.RTCPeerConnection.prototype.setLocalDescription = function()` | RTCPeerConnection |
## SDP 与配置（L9451-L11499）
详见：`02-RTCPeerConnection-usage-analysis.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `r — 内部函数` | L9468 | `r = (function(e)` | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、Navigator/UA |
| `setConditionalProp — 内部函数` | L9577 | `setConditionalProp = (e, t, i) => (t in e ? defineProp(e, t, { enumerable: !0, configurable: !0, writable: !0, value: i }) : (e[t] = i)),` | — |
| `objectMixin — 内部函数` | L9580 | `objectMixin = (e, t) =>` | — |
| `assignDescriptors — 内部函数` | L9589 | `assignDescriptors = (e, t) => defineProps(e, getDescriptors(t)),` | — |
| `omitKeys — 内部函数` | L9592 | `omitKeys = (e, t) =>` | — |
| `defineModule — 内部函数` | L9603 | `defineModule = (e, t) => () => (t \|\| e((t = { exports: {} }).exports, t), t.exports),` | — |
| `defineExports — 内部函数` | L9606 | `defineExports = (e, t) =>` | — |
| `importDefault — 内部函数` | L9612 | `importDefault = (e, t, i) => (` | — |
| `applyDecorators — 源码命名函数` | L9629 | `applyDecorators = (e, t, i, r) =>` | — |
| `defineMember — 内部函数` | L9637 | `defineMember = (e, t, i) => setConditionalProp(e, typeof t != 'symbol' ? `${t }` : t, i),` | — |
| `getModuleExport — 内部函数` | L9640 | `getModuleExport = (e, t, i) => reflectGet(getPrototypeOf(e), i, t),` | — |
| `asyncGeneratorWrap — 内部函数` | L9643 | `asyncGeneratorWrap = (e, t, i) =>` | — |
| `o — 源码命名函数` | L9647 | `var o = (e) =>` | — |
| `s — 源码命名函数` | L9658 | `s = (e) =>` | — |
| `n — 内部函数` | L9678 | `function n() {}` | — |
| `o — 内部函数` | L9682 | `function o(e, t, i)` | — |
| `s — 内部函数` | L9688 | `function s(e, t, i, n, s)` | — |
| `a — 内部函数` | L9709 | `function a(e, t)` | — |
| `c — 内部函数` | L9715 | `function c()` | — |
| `c.prototype.eventNames — 原型方法` | L9722 | `(c.prototype.eventNames = function()` | — |
| `c.prototype.listeners — 原型方法` | L9735 | `(c.prototype.listeners = function(e)` | — |
| `c.prototype.listenerCount — 原型方法` | L9748 | `(c.prototype.listenerCount = function(e)` | — |
| `c.prototype.emit — 原型方法` | L9758 | `(c.prototype.emit = function(e, t, i, n, o, s)` | — |
| `c.prototype.on — 原型方法` | L9818 | `(c.prototype.on = function(e, t, i)` | — |
| `c.prototype.once — 原型方法` | L9824 | `(c.prototype.once = function(e, t, i)` | — |
| `c.prototype.removeListener — 原型方法` | L9830 | `(c.prototype.removeListener = function(e, t, i, n)` | — |
| `c.prototype.removeAllListeners — 原型方法` | L9850 | `(c.prototype.removeAllListeners = function(e)` | — |
| `format — 内部函数` | L9909 | `format : function(e)` | — |
| `format — 内部函数` | L9922 | `format : function(e)` | — |
| `format — 内部函数` | L9939 | `format : function(e)` | — |
| `format — 内部函数` | L9950 | `format : function(e)` | — |
| `format — 内部函数` | L9968 | `format : function(e)` | Crypto/random |
| `format — 内部函数` | L10009 | `format : function(e)` | — |
| `format — 内部函数` | L10032 | `format : function(e)` | — |
| `format — 内部函数` | L10061 | `format : function(e)` | — |
| `format — 内部函数` | L10073 | `format : function(e)` | — |
| `format — 内部函数` | L10086 | `format : function(e)` | — |
| `format — 内部函数` | L10097 | `format : function(e)` | — |
| `format — 内部函数` | L10120 | `format : function(e)` | — |
| `format — 内部函数` | L10131 | `format : function(e)` | — |
| `i — 内部函数` | L10175 | `i = function(e, i, r)` | — |
| `n — 内部函数` | L10280 | `n = function(e)` | — |
| `o — 内部函数` | L10307 | `o = function(e, t, i)` | — |
| `format — 内部函数` | L10428 | `format : function(e)` | — |
| `format — 内部函数` | L10441 | `format : function(e)` | — |
| `format — 内部函数` | L10458 | `format : function(e)` | — |
| `format — 内部函数` | L10469 | `format : function(e)` | — |
| `format — 内部函数` | L10487 | `format : function(e)` | Crypto/random |
| `format — 内部函数` | L10528 | `format : function(e)` | — |
| `format — 内部函数` | L10551 | `format : function(e)` | — |
| `format — 内部函数` | L10580 | `format : function(e)` | — |
| `format — 内部函数` | L10592 | `format : function(e)` | — |
| `format — 内部函数` | L10605 | `format : function(e)` | — |
| `format — 内部函数` | L10616 | `format : function(e)` | — |
| `format — 内部函数` | L10639 | `format : function(e)` | — |
| `format — 内部函数` | L10650 | `format : function(e)` | — |
| `i — 内部函数` | L10694 | `i = function(e, i, r)` | — |
| `n — 内部函数` | L10795 | `n = function(e)` | — |
| `o — 内部函数` | L10822 | `o = function(e, t, i)` | — |
| `构造函数` | L10956 | `constructor(e)` | — |
| `getCode — 方法` | L10991 | `getCode()` | — |
| `getExtraCode — 方法` | L10997 | `getExtraCode()` | — |
| `toString — function toString() { [native code] }` | L11003 | `toString()` | — |
| `setTimeOffset — 内部函数` | L11013 | `setTimeOffset = function(e)` | — |
| `getTimeOffset — 内部函数` | L11024 | `getTimeOffset = function()` | — |
| `getServerTime — 内部函数` | L11030 | `getServerTime = function()` | — |
| `getServerTimeStr — 内部函数` | L11036 | `getServerTimeStr = function()` | — |
| `formatTimeMs — 内部函数` | L11045 | `formatTimeMs = function(e)` | — |
| `setSdkVersion — 设置 SDK 版本号` | L11229 | `function setSdkVersion(e)` | — |
| `getScriptDir — 内部函数` | L11248 | `getScriptDir = () =>` | — |
| `roomMode — 房间模式` | L11366 | `roomMode = (((mode = roomMode \|\| {}).LIVE = 'live'), (mode.RTC = 'rtc'), mode),` | — |
| `setRetryCount — 设置重试次数` | L11399 | `function setRetryCount(e)` | — |
| `getRetryCount — 获取重试次数` | L11406 | `function getRetryCount()` | — |
## 二进制与公共工具（L11500-L13050）
详见：`10-Auxiliary-Browser-APIs.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `createAsyncGeneratorRunner — 内部函数` | L11500 | `createAsyncGeneratorRunner = function(e, t, i, r)` | — |
| `resolveStep — 内部函数` | L11505 | `function resolveStep(e)` | — |
| `throwStep — 内部函数` | L11518 | `function throwStep(e)` | — |
| `handleStepResult — 内部函数` | L11531 | `function handleStepResult(e)` | — |
| `构造函数` | L11560 | `constructor(e)` | — |
| `setG — 设置标志位` | L11566 | `setG(e)` | — |
| `consume — 消费/读取指定字节数` | L11572 | `consume()` | — |
| `demand — 请求读取指定字节数（不足时返回 null）` | L11582 | `demand(e, t)` | — |
| `read — 从缓冲区读取字节序列` | L11588 | `read(e)` | — |
| `readU32 — 读取 32 位无符号整数（大端序）` | L11610 | `readU32()` | — |
| `readU16 — 读取 16 位无符号整数（大端序）` | L11616 | `readU16()` | — |
| `readU8 — 读取 8 位无符号整数` | L11622 | `readU8()` | — |
| `close — 关闭本地流并释放所有轨道` | L11628 | `close()` | — |
| `flush — 刷新缓冲区（写入/清理缓存数据）` | L11639 | `flush()` | Encoding/binary |
| `e — 内部函数` | L11657 | `e = (t[0] << 24) \| (t[1] << 16) \| (t[2] << 8) \| t[3];` | — |
| `e — 内部函数` | L11664 | `e = (t[0] << 8) \| t[1];` | — |
| `write — 向缓冲区写入字节序列` | L11692 | `write(e)` | Encoding/binary |
| `writeU32 — 写入 32 位无符号整数（大端序）` | L11707 | `writeU32(e)` | — |
| `writeU16 — 写入 16 位无符号整数（大端序）` | L11713 | `writeU16(e)` | — |
| `writeU8 — 写入 8 位无符号整数` | L11719 | `writeU8(e)` | — |
| `malloc — 分配指定大小的内存空间` | L11725 | `malloc(e)` | Encoding/binary |
| `encodeVarint — 内部函数` | L11752 | `function encodeVarint(e)` | Encoding/binary |
| `$D — 源码命名函数` | L11762 | `function $D(e)` | Encoding/binary |
| `构造函数` | L11823 | `constructor()` | — |
| `writeInt32 — 写入 32 位有符号整数` | L11837 | `writeInt32(e)` | — |
| `writeInt16 — 写入 16 位有符号整数` | L11846 | `writeInt16(e)` | — |
| `writeByte — 写入单字节` | L11852 | `writeByte(e)` | — |
| `writeBytes — 写入多字节序列` | L11858 | `writeBytes(e)` | — |
| `writeUint32BE — 内部函数` | L11865 | `function writeUint32BE(e, t, i)` | — |
| `readUint32BE — 内部函数` | L11872 | `function readUint32BE(e, t)` | — |
| `readUint8 — 内部函数` | L11878 | `function readUint8(e, t)` | — |
| `decodeUtf8String — 内部函数` | L11884 | `function decodeUtf8String(e, t, i)` | Encoding/binary |
| `decodeTransportData — 内部函数` | L11900 | `function decodeTransportData(e, t)` | Encoding/binary |
| `r — 内部函数` | L11906 | `r = (function(e, t, i)` | Encoding/binary |
| `r — 内部函数` | L11994 | `r = (i + 1 + xxteaShift + xxTeaShift2) % 8;` | Encoding/binary |
| `xorEncryptBlock — 内部函数` | L12039 | `function xorEncryptBlock(e, t, i, r, n, o)` | — |
| `buildLoggerUrl — 构建日志上报 URL` | L12070 | `buildLoggerUrl = function(e, t)` | — |
| `getNetworkType — 检测当前网络类型（wifi/4g/3g/ethernet 等）` | L12087 | `function getNetworkType()` | Navigator/UA |
| `netType — 内部函数` | L12099 | `netType = (ua.match(/NetType\/\S+/) \|\| [])[0] \|\| '';` | — |
| `onNetworkTypeChange — 网络类型变化的回调处理` | L12110 | `function onNetworkTypeChange()` | — |
| `mapToNetworkType — 将原始网络类型值映射到标准网络类型` | L12116 | `function mapToNetworkType(netType, effectiveType)` | — |
| `setNetworkTypeFromWebRTC — 从 WebRTC 连接信息设置网络类型` | L12133 | `function setNetworkTypeFromWebRTC(type)` | — |
| `getNumNetworkType — 内部函数` | L12139 | `function getNumNetworkType()` | — |
| `copyProperties — 内部函数` | L12145 | `function copyProperties(target, source)` | — |
| `bytes2ms — 内部函数` | L12159 | `function bytes2ms(bytes)` | — |
| `samples2ms — 内部函数` | L12165 | `function samples2ms(samples)` | — |
| `ms2bytes — 内部函数` | L12171 | `function ms2bytes(ms)` | — |
| `ms2samples — 内部函数` | L12177 | `function ms2samples(ms)` | — |
| `isChinese — 内部函数` | L12183 | `isChinese = () =>` | — |
| `isPlainObject — 内部函数` | L12192 | `isPlainObject = function(obj)` | — |
| `fibonacci — 内部函数` | L12209 | `function fibonacci(n)` | — |
| `getReconnectionTimeout — 根据重连尝试次数计算指数退避超时时间` | L12219 | `function getReconnectionTimeout(attempt)` | — |
| `getValueType — 内部函数` | L12225 | `function getValueType(val)` | — |
| `promiseAny — 内部函数` | L12247 | `function promiseAny(promises)` | — |
| `performanceNow — 内部函数` | L12265 | `function performanceNow()` | Performance |
| `getInternalVersion — 源码命名函数` | L12271 | `getInternalVersion = (ver) =>` | — |
| `isEmpty — 内部函数` | L12284 | `function isEmpty(val)` | — |
| `getMuteStateFromFlag — 从标志位获取静音状态` | L12309 | `function getMuteStateFromFlag(flag, userId)` | — |
| `getTurnServer — 获取 TURN 服务器` | L12325 | `function getTurnServer(serverConfig)` | — |
| `ipv4ToUint32 — 内部函数` | L12342 | `function ipv4ToUint32(ipStr)` | — |
| `deepClone — 内部函数` | L12374 | `function deepClone(value)` | — |
| `getViewListFromView — 源码命名函数` | L12407 | `var getViewListFromView = (view) =>` | DOM |
| `formatedTime — 内部函数` | L12424 | `formatedTime = () =>` | — |
| `stringify — 内部函数` | L12444 | `function stringify(value, options)` | — |
| `stringifyIncludeValue — 内部函数` | L12474 | `function stringifyIncludeValue(value)` | — |
| `getStringByteLength — 内部函数` | L12490 | `function getStringByteLength(str)` | — |
| `isPortrait — 源码命名函数` | L12495 | `var isPortrait = () =>` | — |
| `loadImage — 源码命名函数` | L12507 | `loadImage = (url) =>` | — |
| `asyncGeneratorWrap — 方法` | L12509 | `asyncGeneratorWrap(void 0, null, function *()` | — |
| `getUint32Version — 源码命名函数` | L12525 | `getUint32Version = (verStr) =>` | — |
| `delay — 延迟执行` | L12542 | `function delay(ms, cancelFn)` | Timers/scheduling |
| `throttlePromise — 内部函数` | L12554 | `function throttlePromise(fn, context)` | — |
| `normalizeUrl — 内部函数` | L12568 | `function normalizeUrl(url)` | — |
| `getMediaStreamTrackInfo — 获取 MediaStreamTrack 的详细信息（类型、ID、状态等）` | L12574 | `function getMediaStreamTrackInfo(track)` | — |
| `calculateScaleResolutionDownNumber — 内部函数` | L12611 | `function calculateScaleResolutionDownNumber(resolution, targetResolution)` | — |
| `isRotate90Or270 — 内部函数` | L12621 | `function isRotate90Or270(angle)` | — |
| `loadVideo — 加载视频元素` | L12627 | `function loadVideo(url)` | HTMLMediaElement、Media playback、DOM |
| `deepCloneBasic — 内部函数` | L12650 | `function deepCloneBasic(value)` | — |
| `buildSSOPackage — 内部函数` | L12695 | `function buildSSOPackage(data, type, sdkAppId, gzip)` | — |
| `concatArrayBuffers — 内部函数` | L12738 | `function concatArrayBuffers(buffer1, buffer2)` | Encoding/binary |
| `getLast16Bits — 内部函数` | L12747 | `function getLast16Bits(value)` | — |
| `getFirst16Bits — 内部函数` | L12753 | `function getFirst16Bits(value)` | — |
| `parseBinaryPacketHeader — 内部函数` | L12759 | `function parseBinaryPacketHeader(e)` | Encoding/binary |
| `parseBinaryLengthFields — 内部函数` | L12873 | `function parseBinaryLengthFields(e, t)` | Encoding/binary |
| `r — 内部函数` | L12878 | `r = (e[4] << 24) \| (e[5] << 16) \| (e[6] << 8) \| e[7];` | Encoding/binary |
| `tryDecryptBinaryBlock — 内部函数` | L12904 | `function tryDecryptBinaryBlock(e, t, i, r, n, o)` | Encoding/binary |
| `sendHttpRequest — 内部函数` | L12918 | `function sendHttpRequest(requestOptions)` | Track lifecycle、fetch、XMLHttpRequest、Encoding/binary |
| `sendLogDataToServer — 内部函数` | L12963 | `function sendLogDataToServer(data)` | Streams、URL/Blob |
| `isPlainObject — 内部函数` | L13001 | `isPlainObject = function(value)` | — |
| `executor — 内部函数` | L13038 | `executor = (resolve, reject) =>` | Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L13041 | `asyncGeneratorWrap(this, null, function *()` | Timers/scheduling |
## 浏览器检测、日志与存储（L13051-L14290）
详见：`10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `doReject — 源码命名函数` | L13054 | `const doReject = () =>` | Timers/scheduling |
| `doRetry — 内部函数` | L13059 | `doRetry = () =>` | Timers/scheduling |
| `构造函数` | L13091 | `constructor(config)` | — |
| `getFullId — 获取日志器的完整 ID 标识` | L13109 | `getFullId()` | — |
| `createChild — 创建子日志器（继承父日志器配置）` | L13119 | `createChild(childConfig)` | — |
| `bindParent — 绑定父日志器` | L13135 | `bindParent(parent)` | — |
| `setUserId — 设置用户 ID（关联日志到用户）` | L13147 | `setUserId(userId)` | — |
| `setSdkAppId — 设置 SDK App ID` | L13153 | `setSdkAppId(sdkAppId)` | — |
| `log — 输出日志（自动判断日志级别）` | L13159 | `log(level, messages)` | — |
| `info — 输出 INFO 级别日志` | L13203 | `info()` | — |
| `debug — 输出 DEBUG 级别日志` | L13210 | `debug()` | — |
| `warn — 输出 WARN 级别日志` | L13217 | `warn()` | — |
| `error — 输出 ERROR 级别日志` | L13224 | `error()` | — |
| `getVersionString — 源码命名函数` | L13334 | `getVersionString = (name) =>` | — |
| `getVersionNumber — 源码命名函数` | L13346 | `getVersionNumber = (name) =>` | — |
| `androidVersion — 内部函数` | L13367 | `androidVersion = (function()` | — |
| `yO — 内部函数` | L13407 | `yO = (function()` | — |
| `getChromeVersion — 内部函数` | L13454 | `getChromeVersion = () => getVersionNumber('Chrome'),` | — |
| `osVersion — 内部函数` | L13468 | `osVersion = (() =>` | — |
| `isVersionLessThan — 内部函数` | L13488 | `function isVersionLessThan(versionA, versionB)` | — |
| `isVersionGreaterThan — 内部函数` | L13507 | `function isVersionGreaterThan(versionA, versionB)` | — |
| `isSafari13Or14 — 内部函数` | L13529 | `isSafari13Or14 = (() =>` | — |
| `isLocalStorageAvailable — 检查 localStorage 是否可用` | L13542 | `isLocalStorageAvailable = (() =>` | Storage |
| `detectBrowser — 检测浏览器类型和版本` | L13565 | `function detectBrowser()` | — |
| `isMobile — 内部函数` | L13599 | `function isMobile()` | — |
| `fetchUserAgentData — 内部函数` | L13606 | `function fetchUserAgentData()` | Navigator/UA |
| `getGPUInfo — 内部函数` | L13646 | `function getGPUInfo()` | WebGL、DOM |
| `getDeviceModel — 内部函数` | L13674 | `function getDeviceModel()` | — |
| `getDeviceModelFromUA — 内部函数` | L13680 | `function getDeviceModelFromUA()` | — |
| `getOSName — 内部函数` | L13697 | `getOSName = function()` | — |
| `getOSNumber — 内部函数` | L13703 | `function getOSNumber()` | — |
| `getBrowserCoreNumber — 内部函数` | L13710 | `function getBrowserCoreNumber()` | — |
| `getOSString — 源码命名函数` | L13715 | `var getOSString = () =>` | — |
| `getTerminalType — 内部函数` | L13732 | `function getTerminalType()` | — |
| `getOSType — 内部函数` | L13739 | `function getOSType()` | — |
| `构造函数` | L13824 | `constructor()` | — |
| `handleUploadFailed — 处理日志上传失败` | L13844 | `handleUploadFailed()` | — |
| `构造函数` | L13858 | `constructor()` | — |
| `installEvents — 安装事件监听器` | L13874 | `installEvents()` | — |
| `startUpload — 开始日志上传` | L13901 | `startUpload()` | — |
| `addJoinedUser — 添加已加入用户到列表` | L13907 | `addJoinedUser(e)` | — |
| `deleteJoinedUser — 删除已退出用户` | L13913 | `deleteJoinedUser(e)` | — |
| `uploadInterval — 定时上传日志` | L13919 | `uploadInterval()` | Timers/scheduling |
| `getLogsToUpload — 获取待上传的日志队列` | L13925 | `getLogsToUpload()` | — |
| `upload — 上传日志数据到服务器` | L13955 | `upload()` | Encoding/binary |
| `uploadLogWithRetry — 上传日志（带重试机制）` | L13985 | `uploadLogWithRetry(e, t, i, r)` | — |
| `getPrefix — 获取日志前缀字符串` | L14004 | `getPrefix(e)` | — |
| `getLogLevel — 获取当前日志级别` | L14013 | `getLogLevel()` | — |
| `setLogLevel — 设置日志级别` | L14019 | `setLogLevel(e)` | — |
| `enableUploadLog — 方法` | L14025 | `enableUploadLog()` | — |
| `disableUploadLog — 方法` | L14031 | `disableUploadLog()` | — |
| `logChunkToString — 日志块转字符串` | L14037 | `logChunkToString(e)` | — |
| `addLogToQueue — 方法` | L14051 | `addLogToQueue(e, t)` | — |
| `log — 输出日志（自动判断日志级别）` | L14069 | `log(t, i)` | — |
| `debug — 输出 DEBUG 级别日志` | L14090 | `debug()` | — |
| `info — 输出 INFO 级别日志` | L14097 | `info()` | — |
| `warn — 输出 WARN 级别日志` | L14104 | `warn()` | — |
| `error — 输出 ERROR 级别日志` | L14111 | `error()` | — |
| `createLogger — 方法` | L14118 | `createLogger(e)` | — |
| `checkURLParam — 方法` | L14135 | `checkURLParam()` | URL/Blob |
| `getQueue — 获取队列` | L14144 | `getQueue()` | — |
| `generateUUID — 内部函数` | L14153 | `generateUUID = function()` | — |
| `构造函数` | L14171 | `constructor()` | — |
| `getRealKey — 获取真实键` | L14177 | `getRealKey(e)` | — |
| `checkStorage — 检查存储状态` | L14183 | `checkStorage()` | Storage、Timers/scheduling |
| `doFlush — 方法` | L14211 | `doFlush()` | Storage |
| `getItem — 获取缓存项` | L14225 | `getItem(e)` | Storage |
| `setItem — 设置缓存项` | L14245 | `setItem(e, t)` | — |
| `deleteItem — 删除缓存项` | L14261 | `deleteItem(e)` | Storage |
| `clear — 清除所有数据` | L14275 | `clear()` | Storage |
## 能力、事件与状态工具（L14291-L17428）
详见：`10-Auxiliary-Browser-APIs.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `frameWorkType — 内部函数` | L14410 | `frameWorkType = ((e) => ((e[(e.WEBRTC = 30)] = 'WEBRTC'), (e[(e.WASM = 37)] = 'WASM'), e))(frameWorkType \|\| {}),` | — |
| `connectionClosedReason — 连接关闭原因` | L14430 | `connectionClosedReason = ((e) => (` | — |
| `playerState — 播放器状态` | L14476 | `playerState = ((e) => ((e.PAUSED = 'PAUSED'), (e.PLAYING = 'PLAYING'), (e.STOPPED = 'STOPPED'), e))(playerState \|\| {}),` | — |
| `trackEvent — 轨道事件` | L14503 | `trackEvent = ((e) => (` | — |
| `sceneNumber — 内部函数` | L14531 | `sceneNumber = ((e) => ((e[(e.RTC = 1)] = 'RTC'), (e[(e.LIVE = 2)] = 'LIVE'), e))(sceneNumber \|\| {}),` | — |
| `userRoleNumber — 内部函数` | L14534 | `userRoleNumber = ((e) => ((e[(e.ANCHOR = 20)] = 'ANCHOR'), (e[(e.AUDIENCE = 21)] = 'AUDIENCE'), e))(userRoleNumber \|\| {}),` | — |
| `userRole — 内部函数` | L14537 | `userRole = ((e) => ((e.ANCHOR = 'anchor'), (e.AUDIENCE = 'audience'), e))(userRole \|\| {}),` | — |
| `connectionState — 连接状态` | L14540 | `connectionState = ((e) => (` | — |
| `audioDecoderDowngradeState — 音频解码降级状态` | L14550 | `audioDecoderDowngradeState = ((e) => (` | — |
| `videoDecoderDowngradeState — 视频解码降级状态` | L14555 | `videoDecoderDowngradeState = ((e) => (` | — |
| `trackKind — 轨道类型（audio/video）` | L14560 | `trackKind = ((e) => ((e.AUDIO = 'audio'), (e.VIDEO = 'video'), (e.AUXILIARY = 'auxVideo'), e))(trackKind \|\| {}),` | — |
| `trackAction — 轨道操作` | L14563 | `trackAction = ((e) => ((e.ADD = 'add'), (e.REMOVE = 'remove'), e))(trackAction \|\| {}),` | — |
| `mediaType — 媒体类型` | L14566 | `mediaType = ((e) => (` | — |
| `audioType — 音频类型` | L14577 | `audioType = (((ZP = audioType \|\| {})[(ZP.opus = 111)] = 'opus'), ZP),` | — |
| `videoType — 视频类型` | L14580 | `videoType = ((e) => ((e[(e.h264 = 100)] = 'h264'), (e[(e.vp8 = 101)] = 'vp8'), e))(videoType \|\| {}),` | — |
| `streamType — 流类型（主流/辅流）` | L14583 | `streamType = ((e) => ((e.Big = 'big'), (e.Small = 'small'), e))(streamType \|\| {}),` | — |
| `remoteStreamType — 远端流类型` | L14586 | `remoteStreamType = ((e) => ((e.Main = 'main'), (e.Aux = 'auxiliary'), e))(remoteStreamType \|\| {}),` | — |
| `multiVideoDataType — 多视频数据类型` | L14589 | `multiVideoDataType = ((e) => (` | — |
| `networkQualityValue — 内部函数` | L14643 | `networkQualityValue = ((e) => (` | — |
| `receiveMode — 内部函数` | L14655 | `receiveMode = ((e) => (` | — |
| `facingMode — 内部函数` | L14664 | `facingMode = ((e) => ((e.user = 'user'), (e.environment = 'environment'), e))(facingMode \|\| {}),` | — |
| `videoPlayerMode — 视频播放器模式` | L14667 | `videoPlayerMode = ((e) => (` | — |
| `audioPlayerMode — 音频播放器模式` | L14675 | `audioPlayerMode = ((e) => ((e[(e.ELEMENT = 0)] = 'ELEMENT'), (e[(e.CONTEXT = 1)] = 'CONTEXT'), e))(audioPlayerMode \|\| {}),` | — |
| `bannedReason — 内部函数` | L14678 | `bannedReason = ((e) => (` | — |
| `denoiserMode — 内部函数` | L14699 | `denoiserMode = ((e) => ((e[(e.NORMAL = 0)] = 'NORMAL'), (e[(e.FAR_FIELD_REDUCTION = 1)] = 'FAR_FIELD_REDUCTION'), e))(denoiserMode \|\| {}),` | — |
| `构造函数` | L14708 | `constructor()` | — |
| `basicType — 内部函数` | L14747 | `basicType = ((e) => (` | — |
| `videoCodec — 视频编码器类型` | L14757 | `videoCodec = ((e) => ((e.H264 = 'h264'), (e.H265 = 'h265'), (e.VP8 = 'vp8'), (e.VP9 = 'vp9'), (e.AV1 = 'av1'), e))(videoCodec \|\| {}),` | — |
| `videoCodecPipelineType — 视频编码管线类型` | L14760 | `videoCodecPipelineType = ((e) => (` | — |
| `audioCodecPipelineType — 音频编码管线类型` | L14769 | `audioCodecPipelineType = ((e) => (` | — |
| `codecType — 内部函数` | L14778 | `codecType = ((e) => ((e.WebRTC = 'webrtc'), (e.WebCodecs = 'webcodecs'), (e.WebAssembly = 'webassembly'), e))(codecType \|\| {}),` | WebAssembly |
| `videoContentHint — 视频内容提示` | L14795 | `videoContentHint = ((e) => ((e.NONE = ''), (e.DETAIL = 'detail'), (e.MOTION = 'motion'), (e.TEXT = 'text'), e))(videoContentHint \|\| {}),` | — |
| `timerType — 内部函数` | L14798 | `timerType = ((e) => (` | — |
| `smallMode — 内部函数` | L14808 | `smallMode = ((e) => ((e.CANVAS = 'canvas'), (e.API = 'api'), e))(smallMode \|\| {}),` | — |
| `checkPermissionType — 内部函数` | L14811 | `checkPermissionType = ((e) => (` | — |
| `deviceType — 内部函数` | L14820 | `deviceType = ((e) => ((e.CAMERA = 'camera'), (e.MICROPHONE = 'microphone'), e))(deviceType \|\| {}),` | — |
| `alphaStitchingType — 内部函数` | L14823 | `alphaStitchingType = ((e) => (` | — |
| `INVALID_PARAMETER_REQUIRED — 方法` | L14957 | `INVALID_PARAMETER_REQUIRED(e)` | — |
| `INVALID_PARAMETER_TYPE — 方法` | L14969 | `INVALID_PARAMETER_TYPE(e)` | — |
| `INVALID_PARAMETER_EMPTY — 方法` | L14987 | `INVALID_PARAMETER_EMPTY(e)` | — |
| `INVALID_PARAMETER_INSTANCE — 方法` | L14999 | `INVALID_PARAMETER_INSTANCE(e)` | — |
| `INVALID_PARAMETER_RANGE — 方法` | L15014 | `INVALID_PARAMETER_RANGE(e)` | — |
| `INVALID_PARAMETER_MIN — 方法` | L15027 | `INVALID_PARAMETER_MIN(e)` | — |
| `INVALID_PARAMETER_MAX — 方法` | L15039 | `INVALID_PARAMETER_MAX(e)` | — |
| `ERROR_MESSAGE — 方法` | L15055 | `ERROR_MESSAGE(e)` | — |
| `JOIN_ROOM_FAILED — 加入房间失败事件处理` | L15082 | `JOIN_ROOM_FAILED(e)` | — |
| `SUBSCRIBE_FAILED — 方法` | L15106 | `SUBSCRIBE_FAILED(e)` | — |
| `CANNOT_LESS_THAN_ZERO — 方法` | L15165 | `CANNOT_LESS_THAN_ZERO(e)` | — |
| `CATCH_HANDLER_ERROR — 方法` | L15222 | `CATCH_HANDLER_ERROR(e)` | — |
| `API_NOT_EXIST — 方法` | L15233 | `API_NOT_EXIST(e)` | — |
| `CLIENT_DESTROYED — 方法` | L15245 | `CLIENT_DESTROYED(e)` | — |
| `API_CALL_ABORTED — 方法` | L15269 | `API_CALL_ABORTED(e)` | — |
| `rL — 内部函数` | L15290 | `rL = (e, t) => (t ? ''.concat(baseDocUrl, '/').concat(e, '/')` | Storage、DOM |
| `nL — 内部函数` | L15294 | `nL = () =>` | Storage、DOM |
| `logConfig — 内部函数` | L15317 | `function logConfig(config)` | — |
| `构造函数` | L15353 | `constructor()` | — |
| `getReportData — 获取上报数据` | L15384 | `getReportData(e, t)` | — |
| `clear — 清除所有数据` | L15427 | `clear()` | — |
| `isEnumKey — 方法` | L15433 | `isEnumKey(e)` | — |
| `isErrorCodeKey — 方法` | L15442 | `isErrorCodeKey(e)` | — |
| `isCountKey — 方法` | L15451 | `isCountKey(e)` | — |
| `isNumberKey — 方法` | L15460 | `isNumberKey(e)` | — |
| `addCount — 递增计数` | L15469 | `addCount(e)` | — |
| `addEnum — 方法` | L15479 | `addEnum(e)` | — |
| `addNumber — 增加数值` | L15494 | `addNumber(e)` | — |
| `addSuccessEvent — 添加成功事件` | L15518 | `addSuccessEvent(e)` | — |
| `addFailedEvent — 添加失败事件` | L15533 | `addFailedEvent(e)` | — |
| `lL — 内部函数` | L15547 | `lL = ((e) => (` | — |
| `dL — 内部函数` | L15574 | `dL = ((e) => (` | — |
| `uL — 内部函数` | L15591 | `uL = ((e) => (` | — |
| `hL — 内部函数` | L15608 | `hL = ((e) => (` | — |
| `getBrowserInfo — 内部函数` | L15699 | `function getBrowserInfo()` | — |
| `isWebCodecsApiAvailable — 内部函数` | L15713 | `isWebCodecsApiAvailable = function()` | WebCodecs |
| `isMediaDevicesSupported — 内部函数` | L15719 | `isMediaDevicesSupported = function()` | — |
| `warnHttpNotSupported — 内部函数` | L15730 | `function warnHttpNotSupported()` | — |
| `isTrackGeneratorSupported — 内部函数` | L15745 | `isTrackGeneratorSupported = function()` | — |
| `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | L15751 | `detectEncodeByPeerConnection = function()` | RTCPeerConnection、Canvas 2D、DOM |
| `detectDecodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的解码格式` | L15795 | `detectDecodeByPeerConnection = function()` | RTCPeerConnection |
| `asyncGeneratorWrap — 方法` | L15833 | `asyncGeneratorWrap(void 0, null, function *()` | RTCPeerConnection、Track lifecycle、Canvas 2D、WebCodecs、Navigator/UA、DOM、Timers/scheduling |
| `yield — 方法` | L15853 | `yield (function()` | Canvas 2D、WebCodecs、DOM、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L15862 | `asyncGeneratorWrap(this, null, function *()` | Canvas 2D、WebCodecs、DOM、Timers/scheduling |
| `o — 内部函数` | L15877 | `o = () =>` | Timers/scheduling |
| `a — 内部函数` | L15891 | `a = () =>` | — |
| `asyncGeneratorWrap — 方法` | L15930 | `asyncGeneratorWrap(this, null, function *()` | WebCodecs |
| `asyncGeneratorWrap — 方法` | L15940 | `asyncGeneratorWrap(this, null, function *()` | WebCodecs |
| `asyncGeneratorWrap — 方法` | L15973 | `asyncGeneratorWrap(this, null, function *()` | WebCodecs |
| `asyncGeneratorWrap — 方法` | L16081 | `asyncGeneratorWrap(this, null, function *()` | RTCPeerConnection、Track lifecycle、Canvas 2D、DOM、Timers/scheduling |
| `i — 内部函数` | L16086 | `i = () => {};` | — |
| `asyncGeneratorWrap — 方法` | L16139 | `asyncGeneratorWrap(this, null, function *()` | — |
| `getCapabilityResult — 内部函数` | L16210 | `getCapabilityResult = function()` | — |
| `isScreenShareSupported — 检测浏览器是否支持 getDisplayMedia 屏幕共享` | L16216 | `isScreenShareSupported = function()` | — |
| `disableOnHttp — 源码命名函数` | L16224 | `var disableOnHttp = (e, t, i) =>` | — |
| `isCandidateSelected — 内部函数` | L16234 | `isCandidateSelected = function(e)` | — |
| `getDisplayResolution — 内部函数` | L16243 | `function getDisplayResolution()` | — |
| `isGetUserMediaAvailable — 内部函数` | L16260 | `function isGetUserMediaAvailable()` | — |
| `isWebAudioSupported — 内部函数` | L16266 | `function isWebAudioSupported()` | AudioContext |
| `isCanvasCaptureStreamSupported — 检测是否支持 Canvas.captureStream 捕获` | L16282 | `function isCanvasCaptureStreamSupported()` | — |
| `isWebRTCBasedScreenCaptureSupported — 检测是否支持基于 WebRTC 的屏幕捕获` | L16288 | `function isWebRTCBasedScreenCaptureSupported()` | — |
| `isMiniBrowserVersionSupported — 内部函数` | L16294 | `function isMiniBrowserVersionSupported()` | — |
| `isSmallStreamSupported — 检测是否支持 Simulcast/SVC 分层编码小流` | L16300 | `function isSmallStreamSupported()` | — |
| `hasGetReceivers — 内部函数` | L16320 | `function hasGetReceivers()` | RTCPeerConnection |
| `hasGetSenders — 内部函数` | L16327 | `function hasGetSenders()` | RTCPeerConnection |
| `hasGetTransceivers — 内部函数` | L16333 | `function hasGetTransceivers()` | RTCPeerConnection |
| `hasAddTransceiver — 内部函数` | L16339 | `function hasAddTransceiver()` | RTCPeerConnection |
| `hasTransceiverStop — 内部函数` | L16347 | `function hasTransceiverStop()` | RTCRtpSender/Receiver/Transceiver |
| `hasReplaceTrack — 内部函数` | L16355 | `function hasReplaceTrack()` | RTCRtpSender/Receiver/Transceiver |
| `hasSetParameters — 内部函数` | L16362 | `function hasSetParameters()` | RTCRtpSender/Receiver/Transceiver |
| `checkWebRTCSupport — 内部函数` | L16375 | `checkWebRTCSupport = function()` | RTCPeerConnection |
| `checkWebCodecsSupport — 内部函数` | L16381 | `function checkWebCodecsSupport()` | WebCodecs |
| `isMediaSessionSupported — 内部函数` | L16398 | `function isMediaSessionSupported()` | Navigator/UA |
| `isWebTransportSupported — 内部函数` | L16404 | `function isWebTransportSupported()` | — |
| `isWasmSimdSupported — 内部函数` | L16410 | `function isWasmSimdSupported()` | WebAssembly、Encoding/binary |
| `getBrowserCapabilityReport — 内部函数` | L16423 | `function getBrowserCapabilityReport()` | WebSocket、Navigator/UA |
| `saveCapabilityResult — 内部函数` | L16444 | `function saveCapabilityResult()` | Navigator/UA |
| `loadAndDetectCapabilities — 内部函数` | L16453 | `function loadAndDetectCapabilities(e)` | Navigator/UA |
| `hasVideoFrameCallback — 内部函数` | L16470 | `function hasVideoFrameCallback()` | — |
| `getCodecId — 内部函数` | L16476 | `function getCodecId(e)` | — |
| `detectVideoCodecCapabilities — 内部函数` | L16483 | `function detectVideoCodecCapabilities()` | — |
| `queryEncodingCapabilities — 内部函数` | L16556 | `function queryEncodingCapabilities(e)` | — |
| `queryDecodingCapabilities — 内部函数` | L16587 | `function queryDecodingCapabilities(e)` | — |
| `getH264ProfileSupport — 内部函数` | L16618 | `function getH264ProfileSupport()` | RTCRtpSender/Receiver/Transceiver、Track constraints/settings/capabilities |
| `构造函数` | L16701 | `constructor(e, t, i)` | — |
| `abort — 中止操作` | L16707 | `abort(e)` | — |
| `toString — function toString() { [native code] }` | L16713 | `toString()` | — |
| `extends 类 — extends` | L16720 | `StateError = class extends Error` | — |
| `构造函数` | L16723 | `constructor(e, t, i)` | — |
| `createStateTransition — 创建状态机状态转换函数，定义合法状态转移路径` | L16730 | `function createStateTransition(fromState, toState)` | — |
| `handleError — 源码命名函数` | L16785 | `const handleError = (e) =>` | — |
| `onSuccess — 源码命名函数` | L16801 | `const onSuccess = (result) =>` | — |
| `dispatchStateChange — 内部函数` | L16857 | `function dispatchStateChange(newState, err)` | — |
| `构造函数` | L16878 | `constructor(t, i, r)` | — |
| `updateDevTools — 更新开发者工具信息` | L16969 | `updateDevTools()` | — |
| `e 类 — e` | L17014 | `Ux = class e` | Worker、URL/Blob、DOM、Page visibility、Timers/scheduling |
| `i — 源码命名函数` | L17094 | `const i = () =>` | Timers/scheduling |
| `n — 内部函数` | L17107 | `n = () =>` | — |
| `n — 内部函数` | L17126 | `n = () =>` | DOM、Page visibility、Timers/scheduling |
| `e — 源码命名函数` | L17140 | `const e = () =>` | Page visibility、Timers/scheduling |
| `createEventDispatcher — 内部函数` | L17202 | `function createEventDispatcher(e, t)` | — |
| `destroyEventDispatcher — 内部函数` | L17221 | `function destroyEventDispatcher(e)` | — |
| `构造函数` | L17230 | `constructor()` | AudioWorklet、Navigator/UA |
| `setConfig — 设置配置` | L17246 | `setConfig(e)` | — |
| `logSuccessEvent — 记录成功事件` | L17257 | `logSuccessEvent(e)` | — |
| `logFailedEvent — 记录失败事件` | L17265 | `logFailedEvent(e)` | — |
| `uploadEventToKibana — 上传事件到 Kibana 日志系统` | L17281 | `uploadEventToKibana(e)` | — |
| `uploadEvent — 上传事件` | L17295 | `uploadEvent(e)` | — |
| `sendRequest — 发送请求` | L17313 | `sendRequest(e, t)` | Timers/scheduling |
| `retryOnError — 内部函数` | L17321 | `function retryOnError(config)` | — |
| `onError — 错误处理回调` | L17334 | `onError(errCtx)` | — |
| `onRetrying — 重连中回调` | L17358 | `onRetrying(err, stopRetryFn)` | — |
| `validateMethodArgs — 内部函数` | L17392 | `function validateMethodArgs(config)` | — |
## HTML 媒体播放与自动播放（L17429-L18540）
详见：`07-Media-Playback-and-Rendering.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `构造函数` | L17445 | `constructor(e, t)` | — |
| `setAttr — 设置单个属性` | L17495 | `setAttr(e)` | — |
| `setUrl — 设置 URL` | L17501 | `setUrl(e)` | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L17510 | `play()` | Media playback、Timers/scheduling |
| `stop — 停止本地流播放` | L17539 | `stop()` | Timers/scheduling |
| `destroyElement — 方法` | L17557 | `destroyElement()` | Timers/scheduling |
| `pause — 暂停播放` | L17570 | `pause()` | Media playback |
| `resume — 恢复播放` | L17581 | `resume()` | — |
| `doResume — 执行恢复操作` | L17587 | `doResume()` | MediaStream、Media playback |
| `setMuted — 方法` | L17601 | `setMuted(e)` | — |
| `replay — 重新播放` | L17607 | `replay()` | Track lifecycle、Media playback |
| `bindElementEvents — 绑定 DOM 元素事件` | L17613 | `bindElementEvents()` | — |
| `bindTrackEvents — 方法` | L17631 | `bindTrackEvents()` | — |
| `bindAutoPlayEvent — 绑定自动播放事件` | L17648 | `bindAutoPlayEvent()` | — |
| `unbindTrackEvents — 方法` | L17654 | `unbindTrackEvents()` | — |
| `unbindEvents — 解绑所有事件` | L17662 | `unbindEvents()` | — |
| `handleElementEvent — 处理 DOM 元素事件` | L17670 | `handleElementEvent(e)` | Navigator/UA |
| `replayByRecreateMediaStream — 重新播放（重建 MediaStream）` | L17731 | `replayByRecreateMediaStream(e)` | — |
| `doReplayByRecreateMediaStream — 通过重建 MediaStream 重新播放` | L17759 | `doReplayByRecreateMediaStream(e)` | MediaStream |
| `handleTrackEvent — 处理轨道事件` | L17800 | `handleTrackEvent(e)` | — |
| `handlePlaying — 播放中回调` | L17824 | `handlePlaying(e)` | — |
| `handlePaused — 暂停回调` | L17833 | `handlePaused(e)` | — |
| `handleStopped — 停止回调` | L17839 | `handleStopped(e)` | — |
| `getElement — 获取 DOM 元素` | L17845 | `getElement()` | — |
| `onError — 错误处理回调` | L17858 | `onError(e, t, i, r)` | — |
| `success — 操作成功回调` | L17874 | `success(e)` | — |
| `success — 操作成功回调` | L17891 | `success(e)` | — |
| `success — 操作成功回调` | L17907 | `success(e)` | — |
| `pV — 内部函数` | L17936 | `pV = () => hV,` | AudioContext、HTMLMediaElement、Media playback、DOM |
| `构造函数` | L17956 | `constructor()` | DOM |
| `createDiaLog — 创建弹窗` | L18004 | `createDiaLog()` | DOM |
| `addDiaLog — 添加弹窗` | L18041 | `addDiaLog()` | — |
| `deleteDialog — 删除弹窗` | L18056 | `deleteDialog()` | — |
| `onConfirm — 确认按钮回调` | L18066 | `onConfirm()` | — |
| `onCollapseClick — 折叠点击回调` | L18072 | `onCollapseClick()` | — |
| `onQuestionClick — 问题点击回调` | L18084 | `onQuestionClick()` | — |
| `createAutoPlayDialog — 内部函数` | L18094 | `function createAutoPlayDialog()` | — |
| `构造函数` | L18117 | `constructor(e)` | — |
| `initializeElement — 方法` | L18148 | `initializeElement()` | MediaStream、DOM |
| `setContainer — 设置容器元素` | L18177 | `setContainer(e)` | — |
| `bindElementEvents — 绑定 DOM 元素事件` | L18186 | `bindElementEvents()` | — |
| `handleTrackEvent — 处理轨道事件` | L18199 | `handleTrackEvent(e)` | — |
| `handleElementEvent — 处理 DOM 元素事件` | L18208 | `handleElementEvent(e)` | — |
| `setCanvas — 方法` | L18267 | `setCanvas(e)` | Canvas 2D |
| `setAttr — 设置单个属性` | L18284 | `setAttr(e)` | — |
| `setRect — 设置渲染区域` | L18296 | `setRect(e, t)` | — |
| `setViewMirror — 方法` | L18304 | `setViewMirror(e)` | — |
| `setObjectFit — 设置视频填充模式（contain/cover/fill）` | L18310 | `setObjectFit(e)` | — |
| `setPoster — 方法` | L18316 | `setPoster(e)` | — |
| `stop — 停止本地流播放` | L18322 | `stop()` | Track lifecycle |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L18331 | `play()` | Media playback |
| `setTrack — 方法` | L18349 | `setTrack(e)` | MediaStream |
| `getVideoFrame — 方法` | L18365 | `getVideoFrame()` | Canvas 2D、DOM |
| `getElement — 获取 DOM 元素` | L18381 | `getElement()` | — |
| `calculateStat — 方法` | L18387 | `calculateStat()` | Media playback、Timers/scheduling |
| `i — 内部函数` | L18397 | `i = (r, n) =>` | Media playback、Timers/scheduling |
| `initAudioWorklet — 内部函数` | L18426 | `function initAudioWorklet(e, t)` | AudioWorklet |
| `observableCreate — 源码命名函数` | L18492 | `var observableCreate = () =>` | DOM、Page visibility、Timers/scheduling |
| `resumeAudioContext — 内部函数` | L18520 | `function resumeAudioContext()` | DOM、Page visibility、Timers/scheduling |
## Web Audio 与设备枚举（L18541-L19270）
详见：`06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `构造函数` | L18548 | `constructor(e)` | — |
| `setChannelCount — 设置声道数` | L18573 | `setChannelCount(e, t)` | — |
| `setContext — 方法` | L18581 | `setContext(e)` | — |
| `removeContext — 方法` | L18587 | `removeContext()` | — |
| `replaceNode — 方法` | L18595 | `replaceNode(e)` | — |
| `setNode — 设置节点` | L18615 | `setNode(e, t)` | — |
| `deleteNode — 删除节点` | L18637 | `deleteNode()` | — |
| `preNodeReconnect — 前节点重连` | L18658 | `preNodeReconnect()` | — |
| `connectNext — 连接下一个备选地址` | L18667 | `connectNext(e)` | — |
| `_connect — 方法` | L18678 | `_connect(e)` | — |
| `_disconnect — 方法` | L18687 | `_disconnect()` | — |
| `reconnect — 重新建立信令连接` | L18700 | `reconnect()` | — |
| `pipeTo — 管道输出到目标` | L18706 | `pipeTo(e)` | — |
| `extends 类 — extends` | L18716 | `UV = class extends AudioNode` | Encoding/binary |
| `构造函数` | L18719 | `constructor()` | Encoding/binary |
| `setNode — 设置节点` | L18727 | `setNode(e)` | Encoding/binary |
| `getByteTimeDomainData — 获取时域音频数据（波形）` | L18733 | `getByteTimeDomainData()` | — |
| `构造函数` | L18769 | `constructor()` | — |
| `setVolume — 设置音量` | L18782 | `setVolume(e)` | Web Audio nodes |
| `replaceSource — 替换音频源` | L18790 | `replaceSource(e)` | — |
| `构造函数` | L18820 | `constructor(e)` | Streams |
| `connect — 建立 WebSocket 信令连接` | L18843 | `connect()` | — |
| `disconnect — 断开 WebSocket 信令连接` | L18858 | `disconnect()` | — |
| `remove — 方法` | L18873 | `remove()` | — |
| `setVolume — 设置音量` | L18886 | `setVolume(e)` | Web Audio nodes |
| `构造函数` | L18902 | `constructor()` | Web Audio nodes |
| `addMixWeight — 添加混音权重` | L18912 | `addMixWeight()` | — |
| `reduceMixWeight — 减少混音权重` | L18920 | `reduceMixWeight()` | — |
| `close — 关闭本地流并释放所有轨道` | L18928 | `close()` | — |
| `getOrCreateAudioNode — 内部函数` | L18940 | `function getOrCreateAudioNode(source)` | MediaStream、MediaStreamTrack、Web Audio nodes |
| `构造函数` | L18974 | `constructor(config)` | — |
| `preload — 预加载资源` | L18997 | `preload()` | AudioWorklet、URL/Blob |
| `initAudioWorklet — 初始化 AudioWorklet（音量检测等）` | L19013 | `initAudioWorklet()` | AudioWorklet |
| `initScriptProcessor — 初始化 ScriptProcessor 音频处理` | L19039 | `initScriptProcessor()` | Web Audio nodes |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L19062 | `destroy()` | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19073 | `getInternalAudioLevel()` | — |
| `getCalculatedVolume — 获取计算后的音量值` | L19079 | `getCalculatedVolume()` | — |
| `getVolumeDb — 获取音量分贝值` | L19085 | `getVolumeDb()` | — |
| `handleAudioLevelInterval — 音频电平定时检测` | L19091 | `handleAudioLevelInterval(e)` | — |
| `extends 类 — extends` | L19104 | `qV = class extends AudioNode` | Encoding/binary |
| `构造函数` | L19107 | `constructor(e)` | — |
| `deleteNode — 删除节点` | L19113 | `deleteNode()` | — |
| `init — 初始化组件/模块（分配资源和建立内部状态）` | L19119 | `init()` | — |
| `getCalculatedVolume — 获取计算后的音量值` | L19128 | `getCalculatedVolume()` | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19134 | `getInternalAudioLevel()` | — |
| `getVolumeDb — 获取音量分贝值` | L19140 | `getVolumeDb()` | — |
| `write — 向缓冲区写入字节序列` | L19146 | `write(e)` | Encoding/binary |
| `构造函数` | L19163 | `constructor(e, t)` | — |
| `update — 方法` | L19169 | `update(e, t)` | — |
| `hasDevice — 检查是否有设备` | L19197 | `hasDevice(e)` | — |
| `构造函数` | L19210 | `constructor()` | — |
| `init — 初始化组件/模块（分配资源和建立内部状态）` | L19232 | `init()` | — |
| `update — 方法` | L19241 | `update()` | — |
| `hasBlueTooth — 检查蓝牙设备` | L19260 | `hasBlueTooth()` | — |
## 媒体设备与 Track 基础（L19271-L20450）
详见：`04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `$V — 源码命名函数` | L19277 | `function $V(e)` | — |
| `handleEncryption — 源码命名函数` | L19288 | `function handleEncryption()` | getUserMedia、enumerateDevices、Track constraints/settings/capabilities、Track lifecycle |
| `getMicrophoneTrackList — 获取所有可用的麦克风音频轨道列表` | L19348 | `function getMicrophoneTrackList()` | — |
| `getCameraTrackList — 获取所有可用的摄像头视频轨道列表` | L19357 | `function getCameraTrackList()` | — |
| `checkDeviceAvailability — 内部函数` | L19367 | `function checkDeviceAvailability()` | — |
| `findDeviceById — 内部函数` | L19381 | `function findDeviceById(e, t)` | — |
| `构造函数` | L19403 | `constructor(e)` | Streams |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L19418 | `destroy()` | — |
| `构造函数` | L19444 | `constructor(e)` | Web Audio nodes |
| `getMediaStream — 获取当前 MediaStream` | L19478 | `getMediaStream()` | MediaStream |
| `initializeElement — 方法` | L19484 | `initializeElement(e)` | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L19503 | `play(t)` | Web Audio nodes、Media playback |
| `asyncGeneratorWrap — 方法` | L19518 | `asyncGeneratorWrap(this, null, function *()` | — |
| `stop — 停止本地流播放` | L19539 | `stop()` | Track lifecycle |
| `setVolume — 设置音量` | L19547 | `setVolume(e)` | — |
| `setSinkId — 设置音频输出设备 ID` | L19553 | `setSinkId(e)` | — |
| `setLoop — 设置循环播放` | L19571 | `setLoop(e)` | — |
| `getAudioLevel — 获取当前音频电平值` | L19577 | `getAudioLevel()` | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19583 | `getInternalAudioLevel()` | — |
| `getInternalAudioLevelAfter3A — 获取经过 3A 处理后的音频电平` | L19589 | `getInternalAudioLevelAfter3A()` | — |
| `extends 类 — extends` | L19596 | `dU = class extends MicrophoneTrack` | MediaStream |
| `setTrack — 方法` | L19599 | `setTrack(e)` | MediaStream |
| `extends 类 — extends` | L19610 | `uU = class extends MicrophoneTrack` | MediaStream、Track constraints/settings/capabilities、Track lifecycle、Media playback、Streams、DOM、Page visibility、Timers/scheduling |
| `构造函数` | L19613 | `constructor(e)` | Streams |
| `setOutput — 设置输出目标` | L19624 | `setOutput()` | — |
| `write — 向缓冲区写入字节序列` | L19630 | `write(e)` | — |
| `setTrack — 方法` | L19636 | `setTrack(e)` | MediaStream、Track constraints/settings/capabilities |
| `setVolume — 设置音量` | L19657 | `setVolume(e)` | Media playback、DOM、Page visibility、Timers/scheduling |
| `e — 源码命名函数` | L19674 | `const e = () =>` | — |
| `stop — 停止本地流播放` | L19714 | `stop()` | Track lifecycle |
| `构造函数` | L19734 | `constructor(e)` | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L19865 | `play(e, t)` | Media playback |
| `setMirror — 设置镜像模式` | L19913 | `setMirror(e, t)` | — |
| `playSubContainer — 方法` | L19937 | `playSubContainer(e, t)` | Track lifecycle、Media playback |
| `setAudioOutput — 设置音频输出设备` | L19974 | `setAudioOutput(e)` | Media playback |
| `setAudioVolume — 设置音频音量` | L19980 | `setAudioVolume(e)` | — |
| `getAudioLevel — 获取当前音频电平值` | L19986 | `getAudioLevel()` | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19992 | `getInternalAudioLevel()` | — |
| `stop — 停止本地流播放` | L20001 | `stop()` | Track lifecycle |
| `resume — 恢复播放` | L20020 | `resume()` | — |
| `close — 关闭本地流并释放所有轨道` | L20031 | `close()` | Track lifecycle |
| `setMute — 设置静音状态` | L20037 | `setMute(e)` | — |
| `setPlayerMute — 设置播放器静音` | L20047 | `setPlayerMute(e)` | — |
| `installTrackEvent — 安装轨道事件监听器` | L20065 | `installTrackEvent(e)` | — |
| `uninstallTrackEvent — 卸载轨道事件监听器` | L20075 | `uninstallTrackEvent(e)` | — |
| `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | L20081 | `setInputMediaStreamTrack(e)` | — |
| `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | L20099 | `setOutputMediaStreamTrack(e)` | — |
| `setMediaType — 方法` | L20120 | `setMediaType(e)` | — |
| `updatePlayingState — 更新播放状态` | L20126 | `updatePlayingState(e)` | Track lifecycle、Media playback |
| `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | L20149 | `handleAutoPlayFailed(e)` | DOM |
| `i — 源码命名函数` | L20157 | `const i = () =>` | DOM |
| `getVideoFrame — 方法` | L20181 | `getVideoFrame()` | — |
| `emitFirstVideoFrameEvent — 发射首帧视频事件` | L20187 | `emitFirstVideoFrameEvent(e)` | Track constraints/settings/capabilities |
| `o — 内部函数` | L20195 | `o = (n == null ? void 0 : n.width) \|\| ((i = this.player.element) == null ? void 0 : i.videoWidth) \|\| 0,` | — |
| `s — 内部函数` | L20198 | `s = (n == null ? void 0 : n.height) \|\| ((r = this.player.element) == null ? void 0 : r.videoHeight) \|\| 0;` | — |
| `onTrackMuted — 轨道被静音回调` | L20217 | `onTrackMuted()` | — |
| `onTrackUnmuted — 轨道取消静音回调` | L20223 | `onTrackUnmuted()` | — |
| `onTrackEnded — 轨道结束回调` | L20229 | `onTrackEnded()` | — |
| `retryFunction — 内部函数` | L20261 | `retryFunction : function(e)` | getUserMedia、Track constraints/settings/capabilities |
| `findTrackByDeviceId — 内部函数` | L20372 | `function findTrackByDeviceId(e, t)` | Track constraints/settings/capabilities |
| `isAudioConstraintsValid — 内部函数` | L20384 | `function isAudioConstraintsValid(e)` | — |
| `isVideoConstraintsValid — 内部函数` | L20403 | `function isVideoConstraintsValid(e)` | — |
| `createAfterHookDecorator — 内部函数` | L20432 | `function createAfterHookDecorator(afterHook)` | — |
| `cleanupAfterUnpublish — 取消推流后的资源清理（关闭轨道、释放 SDP 等）` | L20450 | `function cleanupAfterUnpublish(cleanupFn)` | — |
## 响应式与内部异步工具（L20451-L23000）
详见：`00-Reading-Guide-and-Source-Map.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `handleAbortError — 处理中止错误（用户取消操作时的清理）` | L20470 | `function handleAbortError(errorHandler)` | — |
| `wrapAsyncGenerator — 内部函数` | L20494 | `function wrapAsyncGenerator(valueWrapper)` | — |
| `AU — 源码命名函数` | L20502 | `let AU = (() =>` | DOM、Page visibility |
| `构造函数` | L20522 | `constructor()` | — |
| `push — 方法` | L20536 | `push(e)` | — |
| `shift — 方法` | L20561 | `shift()` | — |
| `callNext — 发送下一个请求` | L20570 | `callNext()` | — |
| `createKVCacheDecorator — 内部函数` | L20590 | `function createKVCacheDecorator()` | — |
| `logMethodCall — 内部函数` | L20616 | `function logMethodCall(abortReason)` | — |
| `extractKeyParam — 提取关键参数` | L20649 | `function extractKeyParam(keyExtractor)` | — |
| `createReportDecorator — 内部函数` | L20673 | `function createReportDecorator(reportKey, reportCost)` | — |
| `noopFunction — 内部函数` | L20707 | `function noopFunction() {}` | — |
| `disposeWrapper — 内部函数` | L20810 | `function disposeWrapper()` | — |
| `toString — function toString() { [native code] }` | L20829 | `toString()` | — |
| `subscribe — 订阅远端用户的音视频流` | L20835 | `subscribe(e)` | — |
| `构造函数` | L20850 | `constructor()` | — |
| `next — 执行下一步（迭代器）` | L20856 | `next(e) {}` | — |
| `complete — 完成操作` | L20859 | `complete()` | — |
| `error — 输出 ERROR 级别日志` | L20865 | `error(e)` | — |
| `dispose — 方法` | L20875 | `dispose()` | — |
| `subscribe — 订阅远端用户的音视频流` | L20887 | `subscribe(e)` | — |
| `doDefer — 执行延迟操作` | L20897 | `doDefer()` | — |
| `defer — 创建延迟操作` | L20903 | `defer(e)` | — |
| `removeDefer — 方法` | L20909 | `removeDefer(e)` | — |
| `reset — 重置房间状态（清理所有内部数据）` | L20915 | `reset()` | — |
| `resetNext — 重置下一个` | L20926 | `resetNext()` | — |
| `resetComplete — 重置完成状态` | L20932 | `resetComplete()` | — |
| `resetError — 方法` | L20938 | `resetError()` | — |
| `构造函数` | L20950 | `constructor(e)` | — |
| `next — 执行下一步（迭代器）` | L20956 | `next(e)` | — |
| `complete — 完成操作` | L20962 | `complete()` | — |
| `error — 输出 ERROR 级别日志` | L20968 | `error(e)` | — |
| `extends 类 — extends` | L20975 | `GU = class extends HU` | — |
| `构造函数` | L20978 | `constructor(e)` | — |
| `next — 执行下一步（迭代器）` | L21020 | `next(e)` | — |
| `complete — 完成操作` | L21026 | `complete()` | — |
| `error — 输出 ERROR 级别日志` | L21032 | `error(e)` | — |
| `pipeOperator — 内部函数` | L21039 | `function pipeOperator(source)` | — |
| `createObservable — 内部函数` | L21048 | `function createObservable(subscribeFn, name, args)` | — |
| `createOperator — 内部函数` | L21074 | `function createOperator(OperatorClass, operatorName)` | — |
| `postDevToolsMessage — 内部函数` | L21105 | `function postDevToolsMessage(e, t)` | — |
| `extends 类 — extends` | L21111 | `var KU = class extends WU` | — |
| `构造函数` | L21114 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L21127 | `next(e)` | — |
| `complete — 完成操作` | L21133 | `complete()` | — |
| `error — 输出 ERROR 级别日志` | L21139 | `error(e)` | — |
| `addSource — 添加音频源` | L21146 | `addSource(e, t)` | — |
| `next — 执行下一步（迭代器）` | L21152 | `next(e, t, i)` | — |
| `subscribe — 订阅远端用户的音视频流` | L21158 | `subscribe(e, t)` | — |
| `complete — 完成操作` | L21166 | `complete(e, t, i)` | — |
| `defer — 创建延迟操作` | L21172 | `defer(e, t)` | — |
| `pipe — 管道传输（数据流处理）` | L21178 | `pipe(e)` | — |
| `update — 方法` | L21184 | `update(e)` | — |
| `create — 方法` | L21190 | `create(e)` | — |
| `构造函数` | L21201 | `constructor(e)` | — |
| `构造函数` | L21212 | `constructor(e)` | — |
| `add — 方法` | L21218 | `add(e)` | — |
| `remove — 方法` | L21224 | `remove(e)` | — |
| `next — 执行下一步（迭代器）` | L21230 | `next(e)` | — |
| `complete — 完成操作` | L21236 | `complete()` | — |
| `error — 输出 ERROR 级别日志` | L21242 | `error(e)` | — |
| `createSubject — 内部函数` | L21249 | `function createSubject()` | — |
| `$U — 源码命名函数` | L21275 | `function $U()` | — |
| `mergeObservables — 内部函数` | L21296 | `function mergeObservables()` | — |
| `combineLatestObservables — 内部函数` | L21327 | `function combineLatestObservables()` | — |
| `bufferObservable — 内部函数` | L21350 | `function bufferObservable(bufferSize)` | — |
| `iifObservable — 内部函数` | L21376 | `function iifObservable(condition, trueObs, falseObs)` | — |
| `mergeObservableSources — 内部函数` | L21382 | `function mergeObservableSources()` | — |
| `checkComplete — 内部函数` | L21395 | `checkComplete = () =>` | — |
| `concatObservableSources — 内部函数` | L21423 | `function concatObservableSources()` | — |
| `checkComplete — 内部函数` | L21435 | `checkComplete = () =>` | — |
| `combineObservableSources — 内部函数` | L21460 | `function combineObservableSources()` | — |
| `extends 类 — extends` | L21481 | `class extends WU` | — |
| `构造函数` | L21484 | `constructor(observer)` | — |
| `next — 执行下一步（迭代器）` | L21494 | `next(val)` | — |
| `extends 类 — extends` | L21504 | `class extends WU` | — |
| `构造函数` | L21507 | `constructor(sink, bufferSize, startBufferEvery)` | — |
| `next — 执行下一步（迭代器）` | L21518 | `next(val)` | — |
| `complete — 完成操作` | L21532 | `complete()` | — |
| `extends 类 — extends` | L21545 | `class extends WU` | — |
| `构造函数` | L21548 | `constructor(sink, notifier)` | — |
| `next — 执行下一步（迭代器）` | L21562 | `next(val)` | — |
| `complete — 完成操作` | L21568 | `complete()` | — |
| `asyncGeneratorPromiseRunner — 内部函数` | L21577 | `asyncGeneratorPromiseRunner = function(e, t, i, r)` | — |
| `resolveStep — 内部函数` | L21582 | `function resolveStep(e)` | — |
| `throwStep — 内部函数` | L21595 | `function throwStep(e)` | — |
| `handleStepResult — 内部函数` | L21608 | `function handleStepResult(e)` | — |
| `createSubjectFromObservable — 内部函数` | L21627 | `function createSubjectFromObservable(e)` | — |
| `deferObservable — 内部函数` | L21650 | `function deferObservable(e)` | — |
| `fF — 源码命名函数` | L21668 | `fF = (e) =>` | — |
| `gF — 源码命名函数` | L21672 | `gF = (e) =>` | — |
| `ofObservable — 内部函数` | L21679 | `function ofObservable()` | — |
| `fromArrayObservable — 内部函数` | L21688 | `function fromArrayObservable(e)` | — |
| `intervalObservable — 内部函数` | L21694 | `function intervalObservable(e)` | Timers/scheduling |
| `timerObservable — 内部函数` | L21717 | `function timerObservable(e, t)` | Timers/scheduling |
| `o — 内部函数` | L21738 | `o = () => clearTimeout(n);` | Timers/scheduling |
| `createEventListener — 内部函数` | L21748 | `function createEventListener(e, t)` | — |
| `fromEventPatternObservable — 内部函数` | L21759 | `function fromEventPatternObservable(e, t)` | — |
| `fromEventObservable — 内部函数` | L21765 | `function fromEventObservable(e, t)` | — |
| `fromPromiseObservable — 内部函数` | L21798 | `function fromPromiseObservable(e)` | — |
| `fromFetchObservable — 内部函数` | L21811 | `function fromFetchObservable(e, t)` | fetch |
| `fromIterableObservable — 内部函数` | L21821 | `function fromIterableObservable(e)` | — |
| `fromAsyncGeneratorObservable — 内部函数` | L21846 | `function fromAsyncGeneratorObservable(e)` | — |
| `t — 源码命名函数` | L21849 | `const t = (i) =>` | — |
| `dF — 方法` | L21851 | `dF(this, void 0, void 0, function *()` | — |
| `abortableObservable — 内部函数` | L21871 | `function abortableObservable(e)` | Streams |
| `write — 向缓冲区写入字节序列` | L21884 | `write(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L21890 | `close()` | — |
| `abort — 中止操作` | L21896 | `abort(e)` | — |
| `animationFrameObservable — 内部函数` | L21914 | `function animationFrameObservable()` | Timers/scheduling |
| `debounceObservable — 内部函数` | L21932 | `function debounceObservable(e, t)` | — |
| `mapObservable — 内部函数` | L21950 | `function mapObservable(e, t)` | — |
| `filterObservable — 内部函数` | L21967 | `function filterObservable(e, t)` | — |
| `neverObservable — 内部函数` | L21984 | `function neverObservable()` | — |
| `throwErrorObservable — 内部函数` | L21990 | `function throwErrorObservable(e)` | — |
| `emptyObservable — 内部函数` | L21996 | `function emptyObservable()` | — |
| `构造函数` | L22007 | `constructor(e, t, i)` | — |
| `r — 源码命名函数` | L22011 | `const r = () =>` | — |
| `next — 执行下一步（迭代器）` | L22024 | `next(e)` | — |
| `BF — 内部函数` | L22033 | `BF = () => createOperator(trackFactory, 'max')(Math.max),` | — |
| `HF — 内部函数` | L22036 | `HF = () => createOperator(trackFactory, 'min')(Math.min),` | — |
| `WF — 内部函数` | L22039 | `WF = () => createOperator(trackFactory, 'sum')((e, t) => e + t, 0),` | — |
| `extends 类 — extends` | L22043 | `class extends WU` | — |
| `构造函数` | L22046 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22052 | `next(e)` | — |
| `extends 类 — extends` | L22062 | `class extends WU` | — |
| `next — 执行下一步（迭代器）` | L22065 | `next(e) {}` | — |
| `extends 类 — extends` | L22072 | `class extends WU` | — |
| `构造函数` | L22075 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22081 | `next(e)` | — |
| `extends 类 — extends` | L22091 | `class extends WU` | — |
| `构造函数` | L22094 | `constructor(e, t)` | — |
| `extends 类 — extends` | L22112 | `class extends WU` | — |
| `构造函数` | L22115 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22121 | `next(e)` | — |
| `extends 类 — extends` | L22132 | `class extends WU` | — |
| `构造函数` | L22135 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22141 | `next(e)` | — |
| `extends 类 — extends` | L22151 | `class extends WU` | — |
| `构造函数` | L22154 | `constructor(e, t)` | — |
| `extends 类 — extends` | L22172 | `class extends WU` | — |
| `构造函数` | L22175 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22181 | `next(e)` | — |
| `extends 类 — extends` | L22191 | `$F = class extends WU` | — |
| `构造函数` | L22194 | `constructor(e, t, i)` | — |
| `cacheValue — 缓存值` | L22200 | `cacheValue(e)` | — |
| `send — 发送信令消息` | L22206 | `send(e)` | — |
| `throttle — 节流函数` | L22212 | `throttle(e)` | — |
| `next — 执行下一步（迭代器）` | L22218 | `next()` | — |
| `complete — 完成操作` | L22224 | `complete()` | — |
| `extends 类 — extends` | L22231 | `eB = class extends WU` | — |
| `构造函数` | L22234 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22246 | `next(e)` | — |
| `complete — 完成操作` | L22252 | `complete()` | — |
| `extends 类 — extends` | L22262 | `nB = class extends WU` | — |
| `next — 执行下一步（迭代器）` | L22265 | `next()` | — |
| `complete — 完成操作` | L22271 | `complete()` | — |
| `extends 类 — extends` | L22278 | `oB = class extends WU` | — |
| `构造函数` | L22281 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22287 | `next(e)` | — |
| `complete — 完成操作` | L22296 | `complete()` | — |
| `extends 类 — extends` | L22306 | `class extends WU` | — |
| `构造函数` | L22309 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22315 | `next(e)` | — |
| `complete — 完成操作` | L22321 | `complete()` | — |
| `extends 类 — extends` | L22334 | `class extends WU` | — |
| `构造函数` | L22337 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22343 | `next(e)` | — |
| `extends 类 — extends` | L22353 | `class extends WU` | — |
| `构造函数` | L22356 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22362 | `next(e)` | — |
| `complete — 完成操作` | L22368 | `complete()` | — |
| `extends 类 — extends` | L22380 | `class extends WU` | — |
| `构造函数` | L22383 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22389 | `next(e)` | — |
| `complete — 完成操作` | L22395 | `complete()` | — |
| `extends 类 — extends` | L22407 | `class extends WU` | — |
| `构造函数` | L22410 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22416 | `next(e)` | — |
| `complete — 完成操作` | L22422 | `complete()` | — |
| `extends 类 — extends` | L22434 | `class extends WU` | — |
| `构造函数` | L22437 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22450 | `next(e)` | — |
| `extends 类 — extends` | L22460 | `class extends WU` | — |
| `构造函数` | L22463 | `constructor()` | — |
| `next — 执行下一步（迭代器）` | L22469 | `next(e)` | — |
| `extends 类 — extends` | L22478 | `fB = class extends WU` | — |
| `构造函数` | L22481 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22487 | `next(e)` | — |
| `extends 类 — extends` | L22496 | `TB = class extends WU` | — |
| `构造函数` | L22499 | `constructor(e, t, i)` | — |
| `next — 执行下一步（迭代器）` | L22505 | `next(e)` | — |
| `tryComplete — 尝试完成操作` | L22513 | `tryComplete()` | — |
| `e 类 — e` | L22520 | `vB = class e extends WU` | — |
| `构造函数` | L22523 | `constructor(e, t, i)` | — |
| `subInner — 内部订阅` | L22529 | `subInner(t, i)` | — |
| `complete — 完成操作` | L22539 | `complete()` | — |
| `tryComplete — 尝试完成操作` | L22545 | `tryComplete()` | — |
| `extends 类 — extends` | L22552 | `yB = class extends TB {},` | — |
| `extends 类 — extends` | L22555 | `SB = class extends vB` | — |
| `next — 执行下一步（迭代器）` | L22558 | `next(e)` | — |
| `wrapAsUnaryFunction — 内部函数` | L22570 | `function wrapAsUnaryFunction(e)` | — |
| `extends 类 — extends` | L22577 | `CB = class extends TB` | — |
| `tryComplete — 尝试完成操作` | L22580 | `tryComplete()` | — |
| `extends 类 — extends` | L22590 | `bB = class extends vB` | — |
| `构造函数` | L22593 | `constructor()` | — |
| `next — 执行下一步（迭代器）` | L22599 | `next(e)` | — |
| `subNext — 订阅下一个` | L22605 | `subNext()` | — |
| `tryComplete — 尝试完成操作` | L22613 | `tryComplete()` | — |
| `extends 类 — extends` | L22622 | `wB = class extends TB` | — |
| `tryComplete — 尝试完成操作` | L22625 | `tryComplete()` | — |
| `extends 类 — extends` | L22634 | `NB = class extends vB` | — |
| `构造函数` | L22637 | `constructor()` | — |
| `next — 执行下一步（迭代器）` | L22643 | `next(e)` | — |
| `tryComplete — 尝试完成操作` | L22649 | `tryComplete()` | — |
| `extends 类 — extends` | L22658 | `MB = class extends TB` | — |
| `dispose — 方法` | L22661 | `dispose()` | — |
| `extends 类 — extends` | L22668 | `LB = class extends vB` | — |
| `next — 执行下一步（迭代器）` | L22671 | `next(e)` | — |
| `extends 类 — extends` | L22681 | `class extends WU` | — |
| `构造函数` | L22684 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22690 | `next(e)` | — |
| `complete — 完成操作` | L22699 | `complete()` | — |
| `error — 输出 ERROR 级别日志` | L22705 | `error(e)` | — |
| `extends 类 — extends` | L22715 | `class extends WU` | — |
| `构造函数` | L22718 | `constructor()` | — |
| `next — 执行下一步（迭代器）` | L22724 | `next(e)` | — |
| `extends 类 — extends` | L22734 | `class extends WU` | Timers/scheduling |
| `构造函数` | L22737 | `constructor(e, t)` | Timers/scheduling |
| `next — 执行下一步（迭代器）` | L22749 | `next(e)` | — |
| `complete — 完成操作` | L22755 | `complete()` | — |
| `dispose — 方法` | L22761 | `dispose()` | Timers/scheduling |
| `extends 类 — extends` | L22771 | `class extends WU` | Timers/scheduling |
| `构造函数` | L22774 | `constructor(e, t)` | — |
| `dispose — 方法` | L22780 | `dispose()` | Timers/scheduling |
| `delay — 延迟执行` | L22786 | `delay(e)` | Timers/scheduling |
| `next — 执行下一步（迭代器）` | L22802 | `next(e)` | — |
| `complete — 完成操作` | L22808 | `complete()` | Timers/scheduling |
| `extends 类 — extends` | L22818 | `class extends WU` | — |
| `构造函数` | L22821 | `constructor(e, t)` | — |
| `error — 输出 ERROR 级别日志` | L22827 | `error(e)` | — |
| `extends 类 — extends` | L22836 | `GB = class extends TB` | — |
| `tryComplete — 尝试完成操作` | L22839 | `tryComplete()` | — |
| `next — 执行下一步（迭代器）` | L22847 | `next(e)` | — |
| `extends 类 — extends` | L22855 | `class extends vB` | — |
| `构造函数` | L22858 | `constructor(e, t)` | — |
| `next — 执行下一步（迭代器）` | L22864 | `next(e)` | — |
| `expandValue — 展开/扩展值` | L22870 | `expandValue(e)` | — |
| `complete — 完成操作` | L22882 | `complete()` | — |
| `checkComplete — 方法` | L22888 | `checkComplete()` | — |
| `tryComplete — 尝试完成操作` | L22894 | `tryComplete()` | — |
| `JB — 内部函数` | L22903 | `JB = () => (e) =>` | — |
| `qB — 内部函数` | L22917 | `qB = () => (e) =>` | Streams |
| `start — 启动组件/模块（开始工作流程）` | L22924 | `start(i)` | — |
| `cancel — 方法` | L22930 | `cancel()` | — |
| `createTapOperator — 内部函数` | L22938 | `createTapOperator = function()` | — |
| `extends 类 — extends` | L22950 | `class extends WU` | — |
| `构造函数` | L22953 | `constructor(e, t)` | — |
| `extends 类 — extends` | L22983 | `class extends WU` | Timers/scheduling |
| `构造函数` | L22986 | `constructor(e, t)` | Timers/scheduling |
| `next — 执行下一步（迭代器）` | L22992 | `next(e)` | Timers/scheduling |
| `dispose — 方法` | L22998 | `dispose()` | Timers/scheduling |
## 本地媒体 Track（L23001-L24700）
详见：`05-MediaStreamTrack-Lifecycle.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `createRetryOperator — 内部函数` | L23007 | `createRetryOperator = function()` | — |
| `QB — 内部函数` | L23052 | `QB = ((e) => (` | — |
| `e 类 — e` | L23059 | `ZB = class e extends hU` | MediaStream、MediaStreamTrack、Track constraints/settings/capabilities、Track lifecycle、Page visibility、Timers/scheduling |
| `构造函数` | L23062 | `constructor(e, t)` | — |
| `encodeFrame — 编码视频帧` | L23097 | `encodeFrame(e, t)` | — |
| `installTrackEvent — 安装轨道事件监听器` | L23103 | `installTrackEvent(e)` | — |
| `uninstallTrackEvent — 卸载轨道事件监听器` | L23113 | `uninstallTrackEvent(e)` | — |
| `setStateToReady — 设置状态为就绪` | L23121 | `setStateToReady() {}` | — |
| `capture — 捕获当前帧` | L23124 | `capture(e)` | MediaStream、Track lifecycle |
| `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | L23169 | `setOutputMediaStreamTrack(e)` | — |
| `publish — 发布本地音视频流到房间` | L23193 | `publish(e, t)` | — |
| `_checkPublishFlag — 方法` | L23210 | `_checkPublishFlag(e)` | Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L23215 | `asyncGeneratorWrap(this, null, function *()` | Timers/scheduling |
| `l — 内部函数` | L23237 | `l = ((s = (o = this.mediaTrack) == null ? void 0 : o.stats) == null ? void 0 : s.totalFrames) \|\| 0;` | Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L23243 | `asyncGeneratorWrap(this, null, function *()` | — |
| `unpublish — 取消发布本地音视频流` | L23317 | `unpublish()` | — |
| `updateDeviceIdInUse — 更新当前使用的设备 ID` | L23325 | `updateDeviceIdInUse()` | Track constraints/settings/capabilities |
| `setProfile — 方法` | L23373 | `setProfile(e)` | — |
| `isNeedToRecapture — 检查是否需要重新采集` | L23379 | `isNeedToRecapture()` | MediaStreamTrack、Track constraints/settings/capabilities |
| `onTrackMuted — 轨道被静音回调` | L23417 | `onTrackMuted()` | Page visibility、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L23426 | `asyncGeneratorWrap(this, null, function *()` | Page visibility |
| `onTrackUnmuted — 轨道取消静音回调` | L23442 | `onTrackUnmuted()` | Timers/scheduling |
| `onTrackEnded — 轨道结束回调` | L23448 | `onTrackEnded()` | Timers/scheduling |
| `recapture — 重新捕获屏幕/设备` | L23463 | `recapture(e)` | Track lifecycle |
| `getRecoverCaptureDeviceId — 获取恢复捕获的设备 ID` | L23512 | `getRecoverCaptureDeviceId()` | — |
| `stopCapture — 停止捕获` | L23541 | `stopCapture()` | Track lifecycle |
| `close — 关闭本地流并释放所有轨道` | L23551 | `close()` | — |
| `success — 操作成功回调` | L23565 | `success()` | — |
| `fail — 操作失败回调` | L23573 | `fail(e)` | — |
| `e 类 — e` | L23633 | `const tH = class e extends auxiliaryManager` | MediaStreamTrack、Track constraints/settings/capabilities、Track lifecycle、AudioContext、Web Audio nodes、Streams |
| `构造函数` | L23636 | `constructor(e)` | Streams |
| `getAudioLevel — 获取当前音频电平值` | L23675 | `getAudioLevel()` | — |
| `getInternalAudioLevelAfter3A — 获取经过 3A 处理后的音频电平` | L23684 | `getInternalAudioLevelAfter3A()` | — |
| `updateAfter3aSilenceStartTime — 更新 3A 处理后静音开始时间` | L23690 | `updateAfter3aSilenceStartTime(e)` | — |
| `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | L23699 | `setInputMediaStreamTrack(t)` | — |
| `capture — 捕获当前帧` | L23719 | `capture(t)` | — |
| `switchDevice — 切换采集设备` | L23755 | `switchDevice(e)` | Track lifecycle |
| `listenDeviceChange — 监听设备插拔事件` | L23787 | `listenDeviceChange()` | — |
| `handleMicrophoneRemoved — 麦克风拔出事件回调` | L23795 | `handleMicrophoneRemoved(e)` | — |
| `handleMicrophoneAdded — 麦克风插入事件回调` | L23823 | `handleMicrophoneAdded(e)` | — |
| `update3A — 更新 3A（AGC/AEC/ANS）参数` | L23832 | `update3A(e)` | Track constraints/settings/capabilities |
| `setCaptureVolume — 设置采集音量` | L23870 | `setCaptureVolume(e)` | — |
| `setAudioVolume — 设置音频音量` | L23876 | `setAudioVolume(e)` | Web Audio nodes |
| `enableTrackANS — 启用/禁用轨道噪音抑制（ANS）` | L23886 | `enableTrackANS(e)` | — |
| `enableTrackAEC — 启用/禁用轨道回声消除（AEC）` | L23892 | `enableTrackAEC(e)` | — |
| `addDenoiser — 添加降噪处理器` | L23898 | `addDenoiser(e)` | — |
| `mixAudioReference — 混音音频参考` | L23908 | `mixAudioReference(e, t)` | Web Audio nodes、Streams |
| `unMixAudioReference — 取消混音音频参考` | L23928 | `unMixAudioReference(e)` | — |
| `setAudioReferenceVolume — 设置音频参考音量` | L23940 | `setAudioReferenceVolume(e, t)` | — |
| `addAudioProcessor — 添加音频处理器` | L23951 | `addAudioProcessor(e, t, i)` | — |
| `removeDenoiser — 移除降噪处理器` | L23957 | `removeDenoiser(e)` | — |
| `removeAudioProcessor — 移除音频处理器` | L23963 | `removeAudioProcessor(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L23970 | `close()` | — |
| `recapture — 重新捕获屏幕/设备` | L23989 | `recapture(t)` | — |
| `encodeFrame — 编码视频帧` | L24011 | `encodeFrame(e)` | — |
| `handleAudioContextLongSuspended — 处理 AudioContext 长时间挂起` | L24027 | `handleAudioContextLongSuspended(e)` | — |
| `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | L24051 | `setOutputMediaStreamTrack(e)` | — |
| `构造函数` | L24065 | `constructor(e)` | — |
| `addPreventionByte — 添加防检测字节` | L24073 | `addPreventionByte()` | Encoding/binary |
| `removePreventionByte — 移除防检测字节` | L24103 | `removePreventionByte()` | Encoding/binary |
| `构造函数` | L24170 | `constructor()` | — |
| `encodeSEINalu — 编码 SEI NALU（H264 补充增强信息）` | L24176 | `encodeSEINalu(e)` | Encoding/binary |
| `sendSEI — 发送 SEI 消息` | L24193 | `sendSEI(e, t)` | — |
| `isEmpty — 方法` | L24201 | `isEmpty()` | — |
| `getNaluCount — 获取 NALU 单元计数` | L24207 | `getNaluCount(e)` | Encoding/binary |
| `encode — 编码视频/音频数据` | L24230 | `encode(e, t)` | Encoding/binary |
| `e 类 — e` | L24259 | `nH = class e extends auxiliaryManager` | Track constraints/settings/capabilities、Track lifecycle、Media playback |
| `构造函数` | L24262 | `constructor(e)` | — |
| `t — 源码命名函数` | L24285 | `const t = () =>` | — |
| `setMute — 设置静音状态` | L24335 | `setMute(t)` | — |
| `capture — 捕获当前帧` | L24365 | `capture(t)` | — |
| `setProfile — 方法` | L24407 | `setProfile(e)` | — |
| `applyProfile — 应用编码 Profile 配置` | L24427 | `applyProfile()` | Track constraints/settings/capabilities |
| `isAllowed2k4k — 检查是否允许 2K/4K 分辨率` | L24486 | `isAllowed2k4k(e)` | — |
| `isNeedToSwitchDevice — 检查是否需要切换设备` | L24498 | `isNeedToSwitchDevice(e)` | — |
| `switchDevice — 切换采集设备` | L24504 | `switchDevice(e)` | Track lifecycle |
| `getDeviceIdWhenUsingBackCamera — 方法` | L24529 | `getDeviceIdWhenUsingBackCamera()` | — |
| `updateSmallConfig — 更新小流配置` | L24581 | `updateSmallConfig(e)` | — |
| `fallbackProfile — 降级编码 Profile` | L24595 | `fallbackProfile(e)` | — |
| `stopSmall — 停止小流推送` | L24650 | `stopSmall()` | — |
| `listenDeviceChange — 监听设备插拔事件` | L24659 | `listenDeviceChange()` | — |
| `handleCameraRemoved — 摄像头拔出事件回调` | L24667 | `handleCameraRemoved(e)` | — |
| `handleCameraAdded — 摄像头插入事件回调` | L24693 | `handleCameraAdded(e)` | — |
## Canvas、WebGL 与混流（L24701-L27600）
详见：`07-Media-Playback-and-Rendering.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `encodeFrame — 编码视频帧` | L24705 | `encodeFrame(e, t)` | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L24719 | `play(e, t)` | Media playback |
| `close — 关闭本地流并释放所有轨道` | L24725 | `close()` | — |
| `recapture — 重新捕获屏幕/设备` | L24733 | `recapture(t)` | — |
| `setContentHint — 设置轨道内容提示（motion/detail/text）` | L24752 | `setContentHint(e)` | — |
| `setRotation — 设置视频旋转角度` | L24762 | `setRotation(e)` | — |
| `cleanupAfterUnpublish — 取消发布后清理` | L24773 | `cleanupAfterUnpublish(function(e)` | — |
| `e 类 — e` | L24854 | `lH = class e extends FSM` | WebSocket、Canvas 2D、WebGL、OffscreenCanvas、WebCodecs、DOM、Encoding/binary |
| `构造函数` | L24857 | `constructor(e, t)` | Canvas 2D、WebGL、OffscreenCanvas、DOM |
| `createFramebuffer — 方法` | L24956 | `createFramebuffer(e)` | WebGL |
| `connect — 建立 WebSocket 信令连接` | L24970 | `connect(e)` | — |
| `addInput — 添加混音输入` | L24978 | `addInput(e)` | — |
| `requestFrame — 方法` | L24984 | `requestFrame(e)` | — |
| `render2d — 2D 渲染视频帧` | L24996 | `render2d(e)` | — |
| `update — 方法` | L25008 | `update()` | — |
| `disconnect — 断开 WebSocket 信令连接` | L25017 | `disconnect()` | — |
| `removeInput — 移除混音输入` | L25024 | `removeInput(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L25030 | `close()` | — |
| `useTexture — 使用指定纹理` | L25059 | `useTexture()` | — |
| `useInputTexture — 方法` | L25065 | `useInputTexture()` | — |
| `useTextures — 方法` | L25073 | `useTextures()` | — |
| `useProgram — 方法` | L25085 | `useProgram()` | — |
| `useBufferFrame — 使用缓冲区帧` | L25091 | `useBufferFrame()` | WebGL |
| `createBuffer — 方法` | L25099 | `createBuffer(e)` | Encoding/binary |
| `setTexBuffer — 方法` | L25109 | `setTexBuffer(e)` | Encoding/binary |
| `setPosBuffer — 设置位置缓冲区` | L25118 | `setPosBuffer(e)` | Encoding/binary |
| `changeBufferData — 方法` | L25127 | `changeBufferData(e, t)` | Encoding/binary |
| `setAttributes — 设置属性` | L25135 | `setAttributes()` | — |
| `getVertexPoint — 获取顶点坐标` | L25147 | `getVertexPoint(e, t)` | — |
| `layout2texCoords — 布局到纹理坐标映射` | L25153 | `layout2texCoords(e)` | — |
| `resize — 调整渲染尺寸` | L25164 | `resize(e, t)` | WebGL |
| `draw — 绘制视频帧` | L25185 | `draw(e, t)` | WebGL |
| `draw2d — 2D 绘制` | L25194 | `draw2d(t, i, r, n, o, s, a, c, l)` | Canvas 2D、WebCodecs |
| `drawBackGround2d — 绘制 2D 背景` | L25212 | `drawBackGround2d(e)` | — |
| `getInfo — 获取信息` | L25222 | `getInfo()` | — |
| `l — 内部函数` | L25229 | `l = ((t - this.lastInfo.totalFrames) / ((c - this.lastInfo.timestamp) / 1e3)) \| 0;` | — |
| `createTexture — 创建 WebGL 纹理` | L25239 | `createTexture(e)` | WebGL |
| `extends 类 — extends` | L25271 | `pH = class extends dH` | DOM、Page visibility |
| `构造函数` | L25274 | `constructor(e, t)` | — |
| `start — 启动组件/模块（开始工作流程）` | L25287 | `start(e)` | — |
| `render — 渲染视频帧到画布` | L25322 | `render(e)` | — |
| `addInput — 添加混音输入` | L25339 | `addInput(e)` | — |
| `update — 方法` | L25346 | `update()` | DOM、Page visibility |
| `removeInput — 移除混音输入` | L25368 | `removeInput(e)` | — |
| `resize — 调整渲染尺寸` | L25374 | `resize(e, t)` | — |
| `close — 关闭本地流并释放所有轨道` | L25380 | `close()` | DOM、Page visibility |
| `extends 类 — extends` | L25389 | `mH = class extends pH` | Track lifecycle、Canvas 2D、DOM、Page visibility、Performance |
| `构造函数` | L25392 | `constructor(e, t)` | Canvas 2D、DOM |
| `enableCheckMute — 方法` | L25417 | `enableCheckMute()` | Page visibility、Performance |
| `disableCheckMute — 方法` | L25452 | `disableCheckMute()` | — |
| `putCanvasIntoDom — 将 Canvas 插入到 DOM` | L25464 | `putCanvasIntoDom()` | DOM |
| `render — 渲染视频帧到画布` | L25475 | `render(e)` | — |
| `render2d — 2D 渲染视频帧` | L25481 | `render2d(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L25487 | `close()` | Track lifecycle |
| `extends 类 — extends` | L25499 | `_H = class extends mH` | Canvas 2D |
| `render — 渲染视频帧到画布` | L25502 | `render(e)` | Canvas 2D |
| `extends 类 — extends` | L25520 | `fH = class extends mH` | — |
| `构造函数` | L25523 | `constructor(e, t, i)` | — |
| `resize — 调整渲染尺寸` | L25529 | `resize(e, t)` | — |
| `extends 类 — extends` | L25557 | `gH = class extends dH` | Media playback、WebGL、OffscreenCanvas、WebCodecs、Page visibility |
| `构造函数` | L25560 | `constructor(e, t)` | — |
| `onFirstFrame — 首帧渲染回调` | L25586 | `onFirstFrame()` | — |
| `tryVideoFrameCallback — 尝试使用 VideoFrameCallback` | L25592 | `tryVideoFrameCallback()` | Media playback、Page visibility |
| `_render — 方法` | L25608 | `_render(e, t)` | WebGL、OffscreenCanvas、WebCodecs |
| `render — 渲染视频帧到画布` | L25669 | `render(e)` | — |
| `render2d — 2D 渲染视频帧` | L25675 | `render2d(e)` | — |
| `extends 类 — extends` | L25682 | `EH = class extends gH` | — |
| `构造函数` | L25685 | `constructor(e, t, i)` | — |
| `extends 类 — extends` | L25713 | `TH = class extends EH` | Track lifecycle、Media playback |
| `构造函数` | L25721 | `constructor(e, t, i)` | Media playback |
| `replaceTrack — 替换本地流中的指定轨道` | L25729 | `replaceTrack(e)` | Media playback |
| `close — 关闭本地流并释放所有轨道` | L25735 | `close()` | Track lifecycle |
| `extends 类 — extends` | L25742 | `vH = class extends dH` | — |
| `构造函数` | L25745 | `constructor(e, t, i)` | — |
| `render2d — 2D 渲染视频帧` | L25779 | `render2d(e)` | — |
| `render — 渲染视频帧到画布` | L25788 | `render(e)` | — |
| `resize — 调整渲染尺寸` | L25794 | `resize(e, t)` | — |
| `drawMultilineText — 绘制多行文本` | L25803 | `drawMultilineText()` | — |
| `o — 内部函数` | L25816 | `o = (n ? parseInt(n[1], 10) : 16) * i,` | WebSocket |
| `extends 类 — extends` | L25824 | `yH = class extends FSM` | WebSocket |
| `构造函数` | L25827 | `constructor(e)` | — |
| `setSize — 设置画布尺寸` | L25868 | `setSize(e, t)` | — |
| `createVideoTrackSource — 创建视频轨道源` | L25874 | `createVideoTrackSource(e, t)` | — |
| `createVideoTrackDestination — 创建视频轨道目标` | L25880 | `createVideoTrackDestination(e)` | — |
| `createVideoImageSource — 创建视频图像源` | L25886 | `createVideoImageSource(e, t)` | — |
| `createVideoPlayerSource — 创建视频播放器源` | L25892 | `createVideoPlayerSource(e, t)` | — |
| `createTextSource — 创建文字源` | L25898 | `createTextSource(e, t)` | — |
| `disconnect — 断开 WebSocket 信令连接` | L25908 | `disconnect()` | — |
| `extends 类 — extends` | L25927 | `IH = class extends yH` | WebGL、DOM |
| `构造函数` | L25930 | `constructor()` | — |
| `create — 方法` | L25945 | `create()` | WebGL、DOM |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L25974 | `destroy(e)` | — |
| `setSize — 设置画布尺寸` | L26009 | `setSize(e, t)` | — |
| `createShader — 方法` | L26019 | `createShader(e, t)` | WebGL |
| `createProgram — 方法` | L26029 | `createProgram(e, t)` | WebGL |
| `fail — 操作失败回调` | L26052 | `fail(e)` | — |
| `success — 操作成功回调` | L26059 | `success()` | — |
| `success — 操作成功回调` | L26076 | `success(e)` | — |
| `extends 类 — extends` | L26088 | `RH = class extends yH` | Canvas 2D、DOM |
| `构造函数` | L26091 | `constructor()` | — |
| `create — 方法` | L26097 | `create(e)` | Canvas 2D、DOM |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L26118 | `destroy(e)` | — |
| `calculateCropRect — 内部函数` | L26134 | `function calculateCropRect(e, t, i, r, n)` | — |
| `fail — 操作失败回调` | L26170 | `fail(e)` | — |
| `success — 操作成功回调` | L26177 | `success()` | — |
| `构造函数` | L26191 | `constructor(e, t)` | — |
| `extends 类 — extends` | L26234 | `kH = class extends dH` | WebSocket |
| `构造函数` | L26237 | `constructor(e, t)` | — |
| `addInput — 添加混音输入` | L26245 | `addInput(e, t)` | — |
| `changeInputLayout — 更改混音输入布局` | L26268 | `changeInputLayout(e, t)` | — |
| `hasInput — 检查是否有输入` | L26292 | `hasInput(e)` | — |
| `hasNoInput — 检查是否无输入` | L26298 | `hasNoInput()` | — |
| `resize — 调整渲染尺寸` | L26304 | `resize(e, t)` | — |
| `connect — 建立 WebSocket 信令连接` | L26329 | `connect(e)` | — |
| `removeInput — 移除混音输入` | L26342 | `removeInput(e)` | — |
| `render — 渲染视频帧到画布` | L26349 | `render(e)` | — |
| `render2d — 2D 渲染视频帧` | L26370 | `render2d(e)` | — |
| `debugLayout — 方法` | L26392 | `debugLayout(e, t, i, r)` | — |
| `getInfo — 获取信息` | L26406 | `getInfo()` | — |
| `a — 内部函数` | L26412 | `a = ((e - this.lastInfo.totalFrames) / ((s - this.lastInfo.timestamp) / 1e3)) \| 0;` | — |
| `removeAllInputs — 移除所有混音输入` | L26422 | `removeAllInputs()` | — |
| `close — 关闭本地流并释放所有轨道` | L26438 | `close()` | — |
| `extends 类 — extends` | L26446 | `wH = class extends dH` | — |
| `构造函数` | L26449 | `constructor(e, t, i, r)` | — |
| `draw2d — 2D 绘制` | L26476 | `draw2d(e, t, i, r, n)` | — |
| `render — 渲染视频帧到画布` | L26499 | `render(e)` | — |
| `resize — 调整渲染尺寸` | L26511 | `resize(e, t)` | — |
| `extends 类 — extends` | L26518 | `NH = class extends auxiliaryManager` | Track constraints/settings/capabilities、Media playback、Timers/scheduling |
| `构造函数` | L26521 | `constructor(e)` | — |
| `listenDeviceChange — 监听设备插拔事件` | L26555 | `listenDeviceChange()` | — |
| `enablePrintDetail — 启用详细日志打印` | L26561 | `enablePrintDetail()` | — |
| `create2dVideoContext — 创建 2D 视频渲染上下文` | L26576 | `create2dVideoContext()` | — |
| `setFps — 设置视频帧率` | L26585 | `setFps(e)` | Timers/scheduling |
| `setFpsAuto — 自动设置视频帧率` | L26599 | `setFpsAuto()` | Media playback |
| `setMixBackground — 设置混音背景` | L26645 | `setMixBackground(e)` | — |
| `resizeMixCanvas — 调整混流画布大小` | L26651 | `resizeMixCanvas(e, t)` | — |
| `startMix — 启动音频混音` | L26659 | `startMix()` | — |
| `addCameraSource — 添加摄像头源` | L26675 | `addCameraSource(e, t, i)` | — |
| `addScreenSource — 添加屏幕共享源` | L26705 | `addScreenSource(e, t, i)` | — |
| `addTextSource — 添加文字源` | L26723 | `addTextSource(e)` | — |
| `addImageSource — 添加图片源` | L26734 | `addImageSource(e, t, i)` | — |
| `addVideoSource — 添加视频源` | L26743 | `addVideoSource(e, t, i)` | — |
| `updateCameraSource — 更新摄像头源` | L26755 | `updateCameraSource(e, t)` | Track constraints/settings/capabilities |
| `updateScreenSource — 更新屏幕共享源` | L26798 | `updateScreenSource(e, t)` | — |
| `updateTextSource — 更新文字源` | L26806 | `updateTextSource(e)` | — |
| `updateImageSource — 更新图片源` | L26820 | `updateImageSource(e, t, i)` | — |
| `updateVideoSource — 更新视频源` | L26828 | `updateVideoSource(e, t, i)` | — |
| `_connectMix — 方法` | L26847 | `_connectMix(e, t)` | — |
| `_changeMixLayout — 方法` | L26861 | `_changeMixLayout(e, t)` | — |
| `removeCameraSource — 移除摄像头源` | L26872 | `removeCameraSource(e)` | — |
| `removeScreenSource — 移除屏幕共享源` | L26885 | `removeScreenSource(e)` | — |
| `removeTextSource — 移除文字源` | L26898 | `removeTextSource(e)` | — |
| `removeImageSource — 移除图片源` | L26907 | `removeImageSource(e)` | — |
| `removeVideoSource — 移除视频源` | L26916 | `removeVideoSource(e)` | — |
| `checkAfterRemove — 方法` | L26929 | `checkAfterRemove()` | — |
| `stopVideoElement — 停止视频元素` | L26935 | `stopVideoElement(e)` | Media playback |
| `close — 关闭本地流并释放所有轨道` | L26941 | `close()` | — |
| `i — 内部函数` | L26977 | `i = (function(e)` | — |
| `extends 类 — extends` | L27074 | `MH = class extends oH` | MediaStream |
| `构造函数` | L27077 | `constructor(e)` | — |
| `capture — 捕获当前帧` | L27102 | `capture(e)` | MediaStream |
| `switchDevice — 切换采集设备` | L27158 | `switchDevice(e)` | — |
| `cleanupAfterUnpublish — 取消发布后清理` | L27171 | `cleanupAfterUnpublish(function(e)` | — |
| `extends 类 — extends` | L27183 | `xH = class extends tH` | — |
| `构造函数` | L27186 | `constructor(e)` | — |
| `addAudioProcessor — 添加音频处理器` | L27192 | `addAudioProcessor(e, t, i)` | — |
| `removeAudioProcessor — 移除音频处理器` | L27201 | `removeAudioProcessor(e)` | — |
| `startPCMCapture — 内部函数` | L27212 | `function startPCMCapture(e)` | AudioWorklet、Streams、URL/Blob、Encoding/binary |
| `start — 启动组件/模块（开始工作流程）` | L27252 | `start(e)` | — |
| `cancel — 方法` | L27261 | `cancel()` | — |
| `extends 类 — extends` | L27271 | `const headerExtensions = class extends AudioWorkletNode` | MediaStream、AudioWorklet、Web Audio nodes、Streams、URL/Blob、DOM、Timers/scheduling、Encoding/binary |
| `构造函数` | L27274 | `constructor(e)` | — |
| `dump — 导出调试数据` | L27320 | `dump(e)` | Web Audio nodes、Streams、URL/Blob、DOM、Timers/scheduling |
| `c — 内部函数` | L27345 | `c = () =>` | URL/Blob、DOM、Timers/scheduling |
| `write — 向缓冲区写入字节序列` | L27367 | `write(e)` | — |
| `getPCM — 获取 PCM 音频数据` | L27382 | `getPCM(e, t)` | MediaStream、Web Audio nodes、Streams、Encoding/binary |
| `write — 向缓冲区写入字节序列` | L27422 | `write(i)` | Encoding/binary |
| `changeInput — 切换混音输入源` | L27460 | `changeInput(e)` | — |
| `mixAudioReference — 混音音频参考` | L27504 | `mixAudioReference(e, t)` | — |
| `unMixAudioReference — 取消混音音频参考` | L27512 | `unMixAudioReference(e)` | — |
| `setAudioReferenceVolume — 设置音频参考音量` | L27520 | `setAudioReferenceVolume(e, t)` | — |
| `mixOnChange — 混音配置变化回调` | L27528 | `mixOnChange()` | — |
| `removeInput — 移除混音输入` | L27556 | `removeInput(e)` | — |
| `addDenoiser — 添加降噪处理器` | L27562 | `addDenoiser(e)` | — |
| `addAudioProcessor — 添加音频处理器` | L27570 | `addAudioProcessor(e, t, i, r)` | — |
| `removeDenoiser — 移除降噪处理器` | L27598 | `removeDenoiser(e)` | — |
## 远端 Track 与播放（L27601-L29000）
详见：`05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `addVoiceChanger — 添加变声器` | L27607 | `addVoiceChanger(e, t)` | — |
| `removeVoiceChanger — 移除变声器` | L27615 | `removeVoiceChanger()` | — |
| `removeAudioProcessor — 移除音频处理器` | L27623 | `removeAudioProcessor(e, t)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L27633 | `destroy()` | — |
| `addEncodeProcessor — 添加编码处理器` | L27644 | `addEncodeProcessor(e)` | — |
| `addDecodeProcessor — 添加解码处理器` | L27654 | `addDecodeProcessor(e)` | — |
| `removeEncodeProcessor — 移除编码处理器` | L27664 | `removeEncodeProcessor(e)` | — |
| `removeDecodeProcessor — 移除解码处理器` | L27672 | `removeDecodeProcessor(e)` | — |
| `handleLocalTrackStarted — 本地轨道开始回调` | L27680 | `handleLocalTrackStarted(e)` | — |
| `handleLocalTrackStopped — 本地轨道停止回调` | L27713 | `handleLocalTrackStopped(e)` | — |
| `handleRemoteTrackStarted — 远端轨道开始回调` | L27724 | `handleRemoteTrackStarted(e)` | — |
| `handleRemoteTrackStopped — 远端轨道停止回调` | L27742 | `handleRemoteTrackStopped(e)` | — |
| `installEvent — 安装单个事件监听器` | L27753 | `installEvent()` | — |
| `uninstallEvent — 卸载单个事件监听器` | L27762 | `uninstallEvent()` | — |
| `updateAudioReference — 方法` | L27771 | `updateAudioReference(e)` | — |
| `checkSubscribeParams — 校验远端订阅请求参数是否合法` | L27791 | `function checkSubscribeParams()` | Timers/scheduling |
| `codecParameters 类 — codecParameters` | L27831 | `const codecParameters = class codecParameters extends hU` | MediaStreamTrack |
| `构造函数` | L27834 | `constructor(t, i, r)` | — |
| `setMute — 设置静音状态` | L27891 | `setMute(e)` | — |
| `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | L27897 | `setInputMediaStreamTrack(e)` | — |
| `checkDecodeResult — 检查解码结果` | L27904 | `checkDecodeResult()` | — |
| `waitHasMediaTrack — 等待媒体轨道就绪` | L27910 | `waitHasMediaTrack()` | — |
| `subscribe — 订阅远端用户的音视频流` | L27945 | `subscribe(e)` | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L27951 | `unsubscribe()` | — |
| `reportDecodeResult — 方法` | L27958 | `reportDecodeResult(e, t)` | — |
| `updatePlayingState — 更新播放状态` | L27989 | `updatePlayingState(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L28005 | `close()` | — |
| `onFlagChanged — 标志位变化回调` | L28011 | `onFlagChanged()` | — |
| `onTrackMuted — 轨道被静音回调` | L28018 | `onTrackMuted()` | — |
| `onTrackUnmuted — 轨道取消静音回调` | L28024 | `onTrackUnmuted()` | — |
| `onTrackEnded — 轨道结束回调` | L28030 | `onTrackEnded()` | — |
| `success — 操作成功回调` | L28042 | `success()` | — |
| `success — 操作成功回调` | L28060 | `success()` | — |
| `extends 类 — extends` | L28072 | `WH = class extends rtcpFeedback` | WebCodecs |
| `构造函数` | L28075 | `constructor(e, t)` | — |
| `onPlayerError — 播放器错误回调` | L28097 | `onPlayerError(e)` | — |
| `decodeFrame — 解码视频帧` | L28121 | `decodeFrame(e)` | — |
| `getAudioLevel — 获取当前音频电平值` | L28151 | `getAudioLevel()` | — |
| `extends 类 — extends` | L28165 | `GH = class extends dH` | Canvas 2D |
| `构造函数` | L28168 | `constructor(e, t, i, r, n)` | — |
| `bindDragEvents — 方法` | L28190 | `bindDragEvents()` | — |
| `render — 渲染视频帧到画布` | L28218 | `render(e)` | — |
| `startDrag — 开始拖拽` | L28230 | `startDrag(e)` | — |
| `renderCanvas — 渲染到 Canvas` | L28237 | `renderCanvas()` | — |
| `doDrag — 执行拖拽` | L28253 | `doDrag(e)` | — |
| `handleZoom — 缩放处理` | L28262 | `handleZoom(e)` | — |
| `resetPosition — 方法` | L28276 | `resetPosition()` | — |
| `onRatioReset — 比例重置回调` | L28282 | `onRatioReset()` | — |
| `draw2d — 2D 绘制` | L28288 | `draw2d(e, t, i, r, n)` | Canvas 2D |
| `close — 关闭本地流并释放所有轨道` | L28341 | `close()` | — |
| `extends 类 — extends` | L28348 | `const jH = class extends rtcpFeedback` | Track lifecycle、Media playback、Encoding/binary |
| `构造函数` | L28351 | `constructor(e, t)` | — |
| `isAlphaSei — 方法` | L28378 | `isAlphaSei(e)` | Encoding/binary |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L28388 | `play(e, t)` | Media playback |
| `updateAlphaRenderInfo — 更新 Alpha 渲染信息` | L28402 | `updateAlphaRenderInfo(e)` | — |
| `generateAlphaCanvasName — 生成 Alpha 通道 Canvas 名称` | L28427 | `generateAlphaCanvasName(e)` | — |
| `useCanvasPlayer — 使用 Canvas 播放器` | L28437 | `useCanvasPlayer(e)` | — |
| `r — 源码命名函数` | L28457 | `const r = () =>` | — |
| `updateCanvasPlayerFPS — 更新 Canvas 播放器帧率` | L28473 | `updateCanvasPlayerFPS(e)` | — |
| `i — 内部函数` | L28478 | `i = ((r = t), [ 15, 30, 45, 60 ].reduce((e, t) => (Math.abs(t - r) < Math.abs(e - r) ? t : e)));` | — |
| `stop — 停止本地流播放` | L28508 | `stop()` | Track lifecycle |
| `decodeFrame — 解码视频帧` | L28519 | `decodeFrame(e)` | — |
| `changeType — 修改订阅流类型（大小流切换）` | L28536 | `changeType(e)` | — |
| `setMirror — 设置镜像模式` | L28546 | `setMirror(e)` | — |
| `setDraggable — 设置可拖拽` | L28552 | `setDraggable(e)` | — |
| `onDecodeDowngradeStateChanged — 解码降级状态变化回调` | L28559 | `onDecodeDowngradeStateChanged(e)` | — |
| `extends 类 — extends` | L28566 | `JH = class extends jH` | — |
| `构造函数` | L28569 | `constructor(e, t)` | — |
| `enqueueReportEvent — 内部函数` | L28581 | `function enqueueReportEvent(e, t)` | — |
| `validateParamRules — 内部函数` | L28590 | `function validateParamRules(e, t, i, r)` | — |
| `validateSingleParamRule — 内部函数` | L28606 | `function validateSingleParamRule(validationCtx)` | — |
| `extends 类 — extends` | L28882 | `QH = class extends streamsManager.EventEmitter` | — |
| `构造函数` | L28885 | `constructor(e, t)` | — |
| `getPublishedUser — 获取已发布用户信息` | L28902 | `getPublishedUser(e)` | — |
| `addUser — 方法` | L28908 | `addUser(e)` | — |
| `deleteUser — 方法` | L28920 | `deleteUser(e, t)` | — |
| `setUserList — 设置用户列表` | L28943 | `setUserList(e)` | — |
| `addRemotePublishedUser — 添加远端已发布用户` | L28956 | `addRemotePublishedUser(e)` | — |
| `deleteRemotePublishedUser — 删除远端已发布用户` | L28962 | `deleteRemotePublishedUser(e)` | — |
| `setRemotePublishedUserList — 设置远端已发布用户列表` | L28968 | `setRemotePublishedUserList(e)` | — |
## Worker、WASM 与媒体管理（L29001-L34099）
详见：`08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `clear — 清除所有数据` | L29014 | `clear()` | — |
| `createRateLimitDecorator — 内部函数` | L29021 | `function createRateLimitDecorator(config)` | — |
| `INVALID_PARAMETER — 方法` | L29173 | `INVALID_PARAMETER(e)` | — |
| `INVALID_PARAMETER_REQUIRED — 方法` | L29185 | `INVALID_PARAMETER_REQUIRED(e)` | — |
| `INVALID_PARAMETER_TYPE — 方法` | L29197 | `INVALID_PARAMETER_TYPE(e)` | — |
| `INVALID_PARAMETER_EMPTY — 方法` | L29215 | `INVALID_PARAMETER_EMPTY(e)` | — |
| `INVALID_PARAMETER_INSTANCE — 方法` | L29227 | `INVALID_PARAMETER_INSTANCE(e)` | — |
| `INVALID_PARAMETER_RANGE — 方法` | L29242 | `INVALID_PARAMETER_RANGE(e)` | — |
| `INVALID_PARAMETER_LESS_THAN_ZERO — 方法` | L29255 | `INVALID_PARAMETER_LESS_THAN_ZERO(e)` | — |
| `INVALID_PARAMETER_MIN — 方法` | L29264 | `INVALID_PARAMETER_MIN(e)` | — |
| `INVALID_PARAMETER_MAX — 方法` | L29276 | `INVALID_PARAMETER_MAX(e)` | — |
| `INVALID_ELEMENT_ID — 方法` | L29288 | `INVALID_ELEMENT_ID(e)` | — |
| `INVALID_ELEMENT_ID_TYPE — 方法` | L29297 | `INVALID_ELEMENT_ID_TYPE(e)` | — |
| `INVALID_STREAM_ID — 方法` | L29309 | `INVALID_STREAM_ID(e)` | — |
| `INVALID_ROOM_ID_STRING — 方法` | L29321 | `INVALID_ROOM_ID_STRING(e)` | — |
| `INVALID_ROOM_ID_INTEGER — 方法` | L29330 | `INVALID_ROOM_ID_INTEGER(e)` | — |
| `INVALID_ROOM_ID_INTEGER_STRING — 方法` | L29339 | `INVALID_ROOM_ID_INTEGER_STRING(e)` | — |
| `INVALID_ROOM_ID_TYPE_MISMATCH — 方法` | L29353 | `INVALID_ROOM_ID_TYPE_MISMATCH(e)` | — |
| `INVALID_ROOM_ID_DUPLICATE — 方法` | L29364 | `INVALID_ROOM_ID_DUPLICATE(e)` | — |
| `INVALID_OPERATION — 方法` | L29381 | `INVALID_OPERATION(e)` | — |
| `INVALID_OPERATION_NOT_JOINED — 方法` | L29390 | `INVALID_OPERATION_NOT_JOINED(e)` | — |
| `INVALID_OPERATION_REMOTE_USER_NOT_EXIST — 方法` | L29399 | `INVALID_OPERATION_REMOTE_USER_NOT_EXIST(e)` | — |
| `INVALID_OPERATION_STREAM_TYPE_NOT_EXIST — 方法` | L29408 | `INVALID_OPERATION_STREAM_TYPE_NOT_EXIST(e)` | — |
| `INVALID_OPERATION_REPEAT_CALL — 方法` | L29420 | `INVALID_OPERATION_REPEAT_CALL(e)` | — |
| `INVALID_OPERATION_NEED_VIDEO — 方法` | L29429 | `INVALID_OPERATION_NEED_VIDEO(e)` | — |
| `INVALID_OPERATION_NEED_AUDIO — 方法` | L29438 | `INVALID_OPERATION_NEED_AUDIO(e)` | — |
| `ENV_NOT_SUPPORTED — 方法` | L29464 | `ENV_NOT_SUPPORTED(e)` | — |
| `NOT_SUPPORTED_CHROME_VERSION — 方法` | L29483 | `NOT_SUPPORTED_CHROME_VERSION(e)` | — |
| `DEVICE_ERROR — 方法` | L29492 | `DEVICE_ERROR(e)` | — |
| `DEVICE_NOT_FOUND_ERROR — 方法` | L29501 | `DEVICE_NOT_FOUND_ERROR(e)` | — |
| `DEVICE_NOT_ALLOWED_ERROR — 方法` | L29513 | `DEVICE_NOT_ALLOWED_ERROR(e)` | — |
| `DEVICE_NOT_READABLE_ERROR — 方法` | L29525 | `DEVICE_NOT_READABLE_ERROR(e)` | — |
| `DEVICE_OVERCONSTRAINED_ERROR — 方法` | L29537 | `DEVICE_OVERCONSTRAINED_ERROR(e)` | — |
| `DEVICE_INVALID_STATE_ERROR — 方法` | L29548 | `DEVICE_INVALID_STATE_ERROR(e)` | — |
| `DEVICE_SECURITY_ERROR — 方法` | L29559 | `DEVICE_SECURITY_ERROR(e)` | — |
| `DEVICE_ABORT_ERROR — 方法` | L29571 | `DEVICE_ABORT_ERROR(e)` | — |
| `CAMERA_RECOVER_FAILED — 方法` | L29582 | `CAMERA_RECOVER_FAILED(e)` | — |
| `MICROPHONE_RECOVER_FAILED — 方法` | L29593 | `MICROPHONE_RECOVER_FAILED(e)` | — |
| `OPERATION_FAILED — 方法` | L29604 | `OPERATION_FAILED(e)` | — |
| `EVENT_HANDLER_ERROR — 方法` | L29615 | `EVENT_HANDLER_ERROR(e)` | — |
| `VIDEO_CONTEXT_ERROR — 方法` | L29624 | `VIDEO_CONTEXT_ERROR(e)` | — |
| `SERVER_ERROR — 方法` | L29636 | `SERVER_ERROR(e)` | — |
| `NEED_TO_BUY — 方法` | L29647 | `NEED_TO_BUY(e)` | — |
| `OPERATION_ABORT — 方法` | L29665 | `OPERATION_ABORT(e)` | — |
| `UNKNOWN_ERROR — 方法` | L29674 | `UNKNOWN_ERROR(e)` | — |
| `normalizeStreamTypeName — 内部函数` | L29684 | `function normalizeStreamTypeName(e)` | — |
| `e 类 — e` | L29695 | `const sW = class e extends Error` | DOM |
| `构造函数` | L29698 | `constructor(e)` | DOM |
| `convertStreamTypeFormat — 内部函数` | L29863 | `function convertStreamTypeFormat(e)` | — |
| `mapQoSToContentHint — 内部函数` | L29870 | `function mapQoSToContentHint(e)` | — |
| `mergeVideoProfile — 内部函数` | L29876 | `function mergeVideoProfile(e, t)` | — |
| `validate — 校验/验证数据合法性` | L29925 | `validate(e, t, i)` | DOM |
| `assertValidOperation — 内部函数` | L29950 | `function assertValidOperation(e, t)` | — |
| `assertStreamExists — 内部函数` | L29957 | `function assertStreamExists(e, t, i)` | — |
| `assertValidRoomId — 内部函数` | L29963 | `function assertValidRoomId(e, t, i)` | — |
| `assertValidUserId — 内部函数` | L29970 | `function assertValidUserId(e, t, i)` | — |
| `checkSmallStreamConfig — 内部函数` | L29977 | `function checkSmallStreamConfig(e)` | — |
| `validate — 校验/验证数据合法性` | L30014 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30075 | `validate(e)` | — |
| `validate — 校验/验证数据合法性` | L30097 | `validate(e)` | — |
| `validate — 校验/验证数据合法性` | L30110 | `validate(e)` | — |
| `validate — 校验/验证数据合法性` | L30130 | `validate(e, t, i, r, n)` | — |
| `validate — 校验/验证数据合法性` | L30167 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30199 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30220 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30232 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30248 | `validate(e, t, i, r)` | — |
| `validate — 校验/验证数据合法性` | L30267 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30287 | `validate(e, t, i, r)` | — |
| `validate — 校验/验证数据合法性` | L30297 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L30309 | `validate(e, t, i)` | — |
| `extends 类 — extends` | L30348 | `IW = class extends Error {};` | — |
| `deepMergeArrays — 内部函数` | L30351 | `function deepMergeArrays(e, t)` | — |
| `createResolvedPromise — 内部函数` | L30362 | `function createResolvedPromise(e)` | — |
| `createRejectedPromise — 内部函数` | L30368 | `function createRejectedPromise(e)` | — |
| `e 类 — e` | L30374 | `const bW = class e` | — |
| `构造函数` | L30377 | `constructor(t, i)` | — |
| `action — 方法` | L30414 | `action(e, t, i)` | — |
| `r — 源码命名函数` | L30417 | `const r = (t) =>` | — |
| `n — 源码命名函数` | L30429 | `n = (t) =>` | — |
| `cacheOp — 缓存操作（延迟执行）` | L30466 | `cacheOp(e)` | — |
| `wW — 内部函数` | L30552 | `wW = (e, t) =>` | — |
| `createStartSameHook — 内部函数` | L30565 | `function createStartSameHook(opKey, startSameHook)` | — |
| `createUpdateMergeHook — 内部函数` | L30584 | `function createUpdateMergeHook(opKey, options)` | Timers/scheduling |
| `createStopHookDecorator — 内部函数` | L30632 | `function createStopHookDecorator(opKey)` | — |
| `checkDevicePermission — 内部函数` | L30654 | `function checkDevicePermission()` | — |
| `setScheduleFlag — 内部函数` | L30730 | `function setScheduleFlag(e)` | — |
| `generateRoomConfig — 内部函数` | L30737 | `function generateRoomConfig(e)` | — |
| `setLogReportUrls — 内部函数` | L30916 | `function setLogReportUrls(e)` | — |
| `buildReportUrl — 内部函数` | L30926 | `function buildReportUrl(e, t)` | — |
| `sendLogReport — 内部函数` | L30937 | `function sendLogReport(e, t, i)` | fetch、URL/Blob |
| `sendKVReport — 内部函数` | L30950 | `function sendKVReport(e)` | — |
| `sendHttpWithRetry — 内部函数` | L30974 | `function sendHttpWithRetry(e, t, i)` | — |
| `构造函数` | L30990 | `constructor()` | — |
| `download — 下载文件` | L30996 | `download(e, t)` | — |
| `downloadWithFetch — 使用 Fetch API 下载` | L31032 | `downloadWithFetch(e, t)` | fetch |
| `downloadWithXHR — 使用 XMLHttpRequest 下载` | L31059 | `downloadWithXHR(e, t)` | XMLHttpRequest |
| `loadWasm — 加载 WebAssembly 模块` | L31086 | `loadWasm(e, t)` | WebAssembly、fetch |
| `r — 内部函数` | L31106 | `r = (yield WebAssembly.instantiateStreaming(i, t)).instance;` | WebAssembly |
| `r — 内部函数` | L31119 | `r = (yield WebAssembly.instantiate(i, t)).instance;` | WebAssembly |
| `loadScript — 加载外部脚本` | L31146 | `loadScript(e)` | DOM |
| `onError — 错误处理回调` | L31186 | `onError(e, t, i)` | — |
| `onRetrying — 重连中回调` | L31196 | `onRetrying(e)` | — |
| `onRetrying — 重连中回调` | L31212 | `onRetrying(e)` | — |
| `createPluginContext — 创建插件依赖上下文（包含房间、常量、工具、设备检测等所有 SDK 内部依赖）` | L31224 | `function createPluginContext(ctx)` | — |
| `initVisionTaskRegistry — 内部函数` | L31257 | `initVisionTaskRegistry : function(visAssetPath)` | — |
| `createParamValidationDecorator — 内部函数` | L31321 | `function createParamValidationDecorator()` | — |
| `createUnsafeParamValidationDecorator — 内部函数` | L31346 | `function createUnsafeParamValidationDecorator()` | — |
| `applyValidationRules — 内部函数` | L31370 | `function applyValidationRules(rules, args, fnName, className)` | — |
| `validateSingleRule — 内部函数` | L31379 | `function validateSingleRule(validationCtx)` | — |
| `createError — 内部函数` | L31384 | `function createError(extraCode)` | — |
| `createLoggingDecorator — 内部函数` | L31448 | `function createLoggingDecorator()` | MediaStreamTrack |
| `maskSensitiveData — 内部函数` | L31462 | `function maskSensitiveData(e, t, r)` | MediaStreamTrack |
| `f — 内部函数` | L31495 | `f = (o == null ? void 0 : o(...c)) \|\| !1;` | — |
| `lG — 源码命名函数` | L31567 | `lG = (e) =>` | — |
| `e 类 — e` | L31602 | `uG = class e` | AudioWorklet、Web Audio nodes、fetch、URL/Blob |
| `构造函数` | L31605 | `constructor(e)` | — |
| `validate — 校验/验证数据合法性` | L31634 | `validate(t, i, r, n)` | — |
| `preload — 预加载资源` | L31643 | `preload(e)` | — |
| `doPreload — 预加载` | L31649 | `doPreload(e)` | URL/Blob |
| `getName — 获取名称` | L31672 | `getName()` | — |
| `getAlias — 获取别名` | L31678 | `getAlias()` | — |
| `getGroup — 获取分组` | L31684 | `getGroup()` | — |
| `getValidateRule — 获取参数校验规则` | L31690 | `getValidateRule(t)` | — |
| `start — 启动组件/模块（开始工作流程）` | L31704 | `start(e)` | AudioWorklet、Web Audio nodes |
| `update — 方法` | L31788 | `update(e)` | — |
| `stop — 停止本地流播放` | L31820 | `stop()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L31834 | `destroy()` | — |
| `getAuthData — 获取认证数据（签名等）` | L31842 | `getAuthData(e, t, i)` | fetch |
| `initWorkletNode — 方法` | L31931 | `initWorkletNode(e, t, i, r, n, o, s, a)` | — |
| `handleLocalAudioStarted — 本地音频开始回调` | L31971 | `handleLocalAudioStarted(e)` | — |
| `handleLocalAudioStopped — 本地音频停止回调` | L31998 | `handleLocalAudioStopped(e)` | — |
| `installEvent — 安装单个事件监听器` | L32011 | `installEvent()` | — |
| `uninstallEvent — 卸载单个事件监听器` | L32018 | `uninstallEvent()` | — |
| `hitTest — 命中检测` | L32025 | `hitTest(e)` | — |
| `构造函数` | L32039 | `constructor(e, t)` | — |
| `updateSettings — 更新播放设置` | L32057 | `updateSettings(e)` | — |
| `updateListener — 更新事件监听` | L32066 | `updateListener(e)` | — |
| `reload — 重新加载资源` | L32094 | `reload(e)` | URL/Blob |
| `reset — 重置房间状态（清理所有内部数据）` | L32119 | `reset()` | — |
| `seek — 跳转到指定时间位置` | L32125 | `seek(e)` | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L32132 | `play()` | Media playback |
| `pause — 暂停播放` | L32144 | `pause()` | Media playback |
| `stop — 停止本地流播放` | L32152 | `stop()` | Media playback |
| `setOperation — 设置播放器操作状态（暂停/恢复/停止）` | L32160 | `setOperation(e)` | Media playback |
| `validatePluginCallback — 内部函数` | L32181 | `function validatePluginCallback(e, t)` | — |
| `e 类 — e` | L32192 | `const fG = class e` | Track lifecycle、Media playback |
| `构造函数` | L32195 | `constructor(e)` | — |
| `getName — 获取名称` | L32207 | `getName()` | — |
| `getAlias — 获取别名` | L32213 | `getAlias()` | — |
| `getGroup — 获取分组` | L32219 | `getGroup(e)` | — |
| `getValidateRule — 获取参数校验规则` | L32225 | `getValidateRule(t)` | — |
| `start — 启动组件/模块（开始工作流程）` | L32239 | `start(e)` | Media playback |
| `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | L32282 | `handleAutoPlayFailed(e, t, i)` | Media playback |
| `t — 源码命名函数` | L32294 | `const t = () =>` | Media playback |
| `asyncGeneratorWrap — 方法` | L32313 | `asyncGeneratorWrap(this, null, function *()` | Media playback |
| `update — 方法` | L32323 | `update(e)` | — |
| `stop — 停止本地流播放` | L32339 | `stop(e)` | Track lifecycle |
| `kvUpload — 上传 KV 格式的统计数据` | L32370 | `kvUpload(e)` | — |
| `destroyAllMusic — 销毁所有音乐资源` | L32396 | `destroyAllMusic()` | Track lifecycle |
| `destroyAllCache — 销毁所有缓存` | L32413 | `destroyAllCache()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L32419 | `destroy()` | — |
| `validate — 校验/验证数据合法性` | L32438 | `validate(e, t, i)` | — |
| `validate — 校验/验证数据合法性` | L32478 | `validate(e, t, i)` | — |
| `e 类 — e` | L32495 | `vG = class e` | AudioWorklet、URL/Blob |
| `构造函数` | L32498 | `constructor(e)` | — |
| `validate — 校验/验证数据合法性` | L32524 | `validate(t, i, r, n)` | — |
| `preload — 预加载资源` | L32533 | `preload(e)` | — |
| `doPreload — 预加载` | L32539 | `doPreload(e)` | URL/Blob |
| `getName — 获取名称` | L32562 | `getName()` | — |
| `getAlias — 获取别名` | L32568 | `getAlias()` | — |
| `getGroup — 获取分组` | L32574 | `getGroup()` | — |
| `getValidateRule — 获取参数校验规则` | L32580 | `getValidateRule(t)` | — |
| `start — 启动组件/模块（开始工作流程）` | L32594 | `start(e)` | AudioWorklet |
| `update — 方法` | L32728 | `update(e)` | — |
| `stop — 停止本地流播放` | L32737 | `stop()` | — |
| `updateConfig — 更新配置` | L32749 | `updateConfig(e)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L32765 | `destroy()` | — |
| `extends 类 — extends` | L32783 | `IG = class extends signalClient.EventEmitter` | — |
| `构造函数` | L32786 | `constructor()` | — |
| `start — 启动组件/模块（开始工作流程）` | L32809 | `start()` | — |
| `onPressureChange — 网络压力变化回调` | L32829 | `onPressureChange(e)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L32840 | `destroy()` | — |
| `encodeSEIPayload — 内部函数` | L32857 | `function encodeSEIPayload(e)` | Encoding/binary |
| `isEmptySEIFrame — 内部函数` | L32876 | `function isEmptySEIFrame(e)` | — |
| `isSEIFrame — 内部函数` | L32882 | `function isSEIFrame(e)` | — |
| `countAnnexbStartCodes — 内部函数` | L32888 | `function countAnnexbStartCodes(e)` | Encoding/binary |
| `encapsulateSEIMessage — 内部函数` | L32911 | `function encapsulateSEIMessage(e)` | Encoding/binary |
| `extractSEIMessage — 内部函数` | L32935 | `function extractSEIMessage(e)` | Encoding/binary |
| `e 类 — e` | L32983 | `OG = class e` | Track lifecycle |
| `构造函数` | L32986 | `constructor(e)` | — |
| `encode — 编码视频/音频数据` | L33001 | `encode(e)` | — |
| `decode — 解码视频/音频数据` | L33022 | `decode(e)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L33045 | `destroy()` | Track lifecycle |
| `getValidateRule — 获取参数校验规则` | L33051 | `getValidateRule(e)` | — |
| `start — 启动组件/模块（开始工作流程）` | L33063 | `start()` | — |
| `stop — 停止本地流播放` | L33070 | `stop()` | — |
| `update — 方法` | L33077 | `update(e)` | — |
| `getName — 获取名称` | L33092 | `getName()` | — |
| `getAlias — 获取别名` | L33098 | `getAlias()` | — |
| `getGroup — 获取分组` | L33104 | `getGroup()` | — |
| `dumpVideoFrame — 内部函数` | L33113 | `function dumpVideoFrame(e)` | — |
| `dumpSEIFrame — 内部函数` | L33123 | `function dumpSEIFrame(e)` | — |
| `e 类 — e` | L33415 | `FG = class e` | Track lifecycle、URL/Blob、Storage |
| `构造函数` | L33418 | `constructor(e)` | — |
| `getName — 获取名称` | L33432 | `getName()` | — |
| `getAlias — 获取别名` | L33438 | `getAlias()` | — |
| `getGroup — 获取分组` | L33444 | `getGroup()` | — |
| `getValidateRule — 获取参数校验规则` | L33450 | `getValidateRule(e)` | — |
| `start — 启动组件/模块（开始工作流程）` | L33464 | `start()` | URL/Blob、Storage |
| `update — 方法` | L33477 | `update(e)` | — |
| `stop — 停止本地流播放` | L33493 | `stop()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L33499 | `destroy()` | Track lifecycle |
| `openDebugDiaLog — 打开调试弹窗` | L33505 | `openDebugDiaLog()` | URL/Blob、Storage |
| `closeDebugDiaLog — 关闭调试弹窗` | L33541 | `closeDebugDiaLog()` | — |
| `addVideoProcessor — 添加视频处理器` | L33547 | `addVideoProcessor()` | — |
| `removeVideoProcessor — 移除视频处理器` | L33560 | `removeVideoProcessor()` | — |
| `encodeVideo — 编码视频数据` | L33567 | `encodeVideo(e)` | — |
| `decodeVideo — 解码视频数据` | L33588 | `decodeVideo(e)` | — |
| `HG — 源码命名函数` | L33611 | `HG = (e) =>` | — |
| `构造函数` | L33624 | `constructor(e, t, i)` | — |
| `mock — 模拟操作（测试/调试用）` | L33690 | `mock(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L33696 | `close(e)` | — |
| `pipe — 管道传输（数据流处理）` | L33702 | `pipe(e)` | WebCodecs |
| `asyncGeneratorWrap — 方法` | L33707 | `asyncGeneratorWrap(this, null, function *()` | WebCodecs |
| `decodeFrame — 解码视频帧` | L33742 | `decodeFrame(e)` | WebCodecs |
| `e 类 — e` | L33754 | `jG = class e` | Track lifecycle |
| `构造函数` | L33757 | `constructor(e)` | — |
| `getAlias — 获取别名` | L33767 | `getAlias()` | — |
| `getGroup — 获取分组` | L33773 | `getGroup(e)` | — |
| `getName — 获取名称` | L33779 | `getName()` | — |
| `getValidateRule — 获取参数校验规则` | L33785 | `getValidateRule(e)` | — |
| `start — 启动组件/模块（开始工作流程）` | L33791 | `start(e)` | — |
| `decode — 解码视频/音频数据` | L33809 | `decode(e)` | Track lifecycle |
| `stop — 停止本地流播放` | L33836 | `stop(e)` | — |
| `update — 方法` | L33848 | `update(e)` | — |
| `构造函数` | L33865 | `constructor()` | — |
| `call — 发送信令请求并等待响应` | L33871 | `call(e, t)` | — |
| `enableAudioFrameEvent — 启用音频帧事件通知` | L33884 | `enableAudioFrameEvent(e)` | — |
| `resumeRemotePlayer — 恢复远端播放器播放（处理自动播放失败后恢复）` | L33938 | `resumeRemotePlayer(e)` | — |
| `pauseRemotePlayer — 暂停远端播放器` | L33973 | `pauseRemotePlayer(e)` | Media playback |
| `extends 类 — extends` | L34036 | `YG = class extends KG.EventEmitter` | getUserMedia、Track lifecycle、Permissions |
| `构造函数` | L34039 | `constructor()` | — |
| `request — 发送 HTTP 请求（内部工具方法，含超时和错误处理）` | L34058 | `request(e)` | getUserMedia、Track lifecycle |
| `get — HTTP GET 请求便捷封装` | L34070 | `get(e)` | Permissions |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L34097 | `destroy()` | — |
## SDK 对外门面（L34100-L36520）
详见：`00-Reading-Guide-and-Source-Map.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `构造函数` | L34125 | `constructor(RoomClass, config)` | — |
| `value — 方法` | L34158 | `value(e)` | — |
| `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | L34298 | `_listenEvents()` | — |
| `asyncGeneratorWrap — 方法` | L34498 | `asyncGeneratorWrap(this, null, function *()` | — |
| `asyncGeneratorWrap — 方法` | L34515 | `asyncGeneratorWrap(this, null, function *()` | — |
| `getNetworkTime — 获取校准后的服务器网络时间` | L34542 | `getNetworkTime()` | — |
| `use — 注册外部插件（按名称/插件对象注册）` | L34548 | `use(e)` | — |
| `_use — 内部：注册并初始化插件的实现` | L34561 | `_use(t, i)` | — |
| `enterRoom — 进入 TRTC 房间，需传入房间 ID 和用户签名（sdkAppId/userId/userSig/roomId）` | L34580 | `enterRoom(params)` | — |
| `exitRoom — 退出当前 TRTC 房间，断开信令连接、清理所有推拉流和媒体资源` | L34630 | `exitRoom()` | — |
| `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | L34639 | `switchRoom(params)` | — |
| `_rejoinRoom — 内部：网络断开后自动重新加入房间` | L34664 | `_rejoinRoom(e)` | — |
| `_clearRemoteTracks — 内部：清理所有远端轨道` | L34676 | `_clearRemoteTracks()` | Timers/scheduling |
| `switchRole — 切换用户角色（anchor/audience），影响发布权限和远端可见性` | L34705 | `switchRole(role, config)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L34717 | `destroy()` | — |
| `startLocalAudio — 采集本地麦克风音频并推送到房间` | L34739 | `startLocalAudio()` | — |
| `updateLocalAudio — 更新本地音频采集参数（音量、降噪开关、音频质量等）` | L34798 | `updateLocalAudio(e)` | — |
| `stopLocalAudio — 停止本地麦克风音频采集并取消推送` | L34828 | `stopLocalAudio()` | Track lifecycle |
| `startLocalVideo — 采集本地摄像头视频并推送到房间` | L34845 | `startLocalVideo()` | — |
| `updateLocalVideo — 更新本地视频参数（分辨率、帧率、码率、渲染视图等）` | L34922 | `updateLocalVideo(config)` | — |
| `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | L34998 | `stopLocalVideo()` | Track lifecycle |
| `updateScreenShare — 更新屏幕共享参数（分辨率、帧率、码率等）` | L35106 | `updateScreenShare(e)` | — |
| `stopScreenShare — 停止屏幕共享采集和推送` | L35154 | `stopScreenShare()` | — |
| `startRemoteVideo — 开始播放远端视频（触发订阅远端流）` | L35163 | `startRemoteVideo(e)` | — |
| `updateRemoteVideo — 更新远端视频播放参数` | L35216 | `updateRemoteVideo(e)` | — |
| `stopRemoteVideo — 停止远端视频播放` | L35257 | `stopRemoteVideo(e)` | — |
| `_stopRemoteVideo — 内部：停止远端视频播放` | L35266 | `_stopRemoteVideo(e)` | Track lifecycle |
| `_removeRemoteVideoConfig — 内部：移除远端视频配置项` | L35289 | `_removeRemoteVideoConfig(e, t)` | — |
| `muteRemoteAudio — 静音/取消静音指定远端用户的音频` | L35298 | `muteRemoteAudio(e, t)` | — |
| `setRemoteAudioVolume — 设置指定远端用户的音频播放音量` | L35329 | `setRemoteAudioVolume(e, t)` | — |
| `startPlugin — 启动指定名称的插件` | L35354 | `startPlugin(e, t)` | — |
| `updatePlugin — 更新插件配置参数` | L35363 | `updatePlugin(e, t)` | — |
| `stopPlugin — 停止并卸载指定名称的插件` | L35372 | `stopPlugin(e, t)` | Track lifecycle |
| `enableAudioVolumeEvaluation — 开启/关闭音量回调通知（设置回调间隔，单位 ms）` | L35381 | `enableAudioVolumeEvaluation()` | — |
| `on — 注册事件监听器` | L35390 | `on(e, t, i)` | — |
| `emit — 触发事件通知所有注册的监听器` | L35410 | `emit(e)` | — |
| `off — 移除指定事件监听器` | L35423 | `off(t, i, r)` | — |
| `getAudioTrack — 获取本地音频 MediaStreamTrack` | L35444 | `getAudioTrack()` | Track lifecycle |
| `getVideoTrack — 获取本地视频 MediaStreamTrack` | L35468 | `getVideoTrack()` | Track lifecycle |
| `getVideoSnapshot — 获取当前视频画面截图（返回 base64 DataURL）` | L35492 | `getVideoSnapshot()` | — |
| `_setCurrentSpeaker — 内部：设置当前音频输出设备` | L35514 | `_setCurrentSpeaker(e)` | — |
| `setCurrentSpeaker — 设置扬声器设备（音频输出设备 ID）` | L35525 | `setCurrentSpeaker(e)` | — |
| `_startRemoteAudio — 内部：开始远端音频播放` | L35546 | `_startRemoteAudio(e)` | — |
| `_doStartRemoteAudio — 内部：执行远端音频播放逻辑` | L35552 | `_doStartRemoteAudio(e)` | — |
| `_stopRemoteAudio — 内部：停止远端音频播放` | L35611 | `_stopRemoteAudio(e)` | Track lifecycle |
| `_enableVideoDecodeFallback — 内部：切换视频解码降级策略（软解/硬解）` | L35631 | `_enableVideoDecodeFallback(e, t)` | — |
| `_updateVideoPlayOption — 内部：更新视频播放选项` | L35673 | `_updateVideoPlayOption(e)` | Track lifecycle、Media playback |
| `_updateAudioPlayOption — 内部：更新音频播放选项` | L35699 | `_updateAudioPlayOption(e)` | Media playback |
| `_listenOutputTrackChanged — 内部：监听输出轨道切换事件` | L35741 | `_listenOutputTrackChanged(e)` | — |
| `_emitTrackEvent — 内部：向外部发射轨道状态事件` | L35748 | `_emitTrackEvent(e)` | — |
| `_checkTrackToPublish — 内部：检查待发布轨道的合法性` | L35765 | `_checkTrackToPublish()` | — |
| `_observeView — 内部：监听视频渲染 DOM 元素的变化（尺寸适配）` | L35784 | `_observeView(e)` | DOM、Timers/scheduling |
| `_exitRoom — 内部：执行退出房间的资源清理流程` | L35839 | `_exitRoom()` | — |
| `_stopScreenShare — 内部：停止屏幕共享的逻辑` | L35848 | `_stopScreenShare()` | Track lifecycle |
| `_checkScreenAudioEchoCancellation — 内部：检查屏幕共享音频回声消除设置` | L35880 | `_checkScreenAudioEchoCancellation(e, t)` | — |
| `_onLocalTrackCaptured — 内部：本地轨道采集完成后的处理（触发布置）` | L35914 | `_onLocalTrackCaptured(e)` | — |
| `_initActiveSpeaker — 内部：初始化活跃发言人检测逻辑` | L35924 | `_initActiveSpeaker()` | — |
| `_onAudioAvailable — 内部：远端音频可用时的回调` | L35941 | `_onAudioAvailable(e)` | — |
| `_onVideoAvailable — 内部：远端视频可用时的回调` | L35950 | `_onVideoAvailable(e)` | — |
| `_onAudioUnavailable — 内部：远端音频不可用时的回调` | L35974 | `_onAudioUnavailable(e)` | — |
| `_onVideoUnavailable — 内部：远端视频不可用时的回调` | L35982 | `_onVideoUnavailable(e)` | — |
| `sendSEIMessage — 向视频流中嵌入 SEI 消息（补充增强信息，最大 24 字节）` | L35990 | `sendSEIMessage(e, t)` | — |
| `sendCustomMessage — 向房间内其他用户发送自定义消息（二进制数据）` | L36004 | `sendCustomMessage(e)` | — |
| `callExperimentalAPI — 调用实验性内部 API（⚠️ 仅限测试用途）` | L36012 | `callExperimentalAPI(e, t)` | — |
| `asyncGeneratorWrap — 方法` | L36098 | `asyncGeneratorWrap(this, null, function *()` | — |
| `getSize — 获取大小/长度` | L36458 | `getSize : function()` | — |
| `构造函数` | L36492 | `constructor()` | — |
| `add — 方法` | L36500 | `add(e)` | — |
| `getKey — 获取键` | L36520 | `getKey(e, t, i, r)` | — |
## WebSocket 信令（L36521-L37359）
详见：`03-WebSocket-usage-analysis.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `isJoined — 检查是否已加入房间` | L36528 | `isJoined(e)` | — |
| `handleSwitchRoomSuccess — 切换房间成功回调` | L36537 | `handleSwitchRoomSuccess(e)` | — |
| `logDeviceAndCapabilities — 记录设备和能力信息` | L36548 | `function logDeviceAndCapabilities()` | — |
| `extends 类 — extends` | L36745 | `Xj = class extends nativeRtcModule.default` | WebSocket、URL/Blob、Timers/scheduling |
| `构造函数` | L36748 | `constructor(e)` | — |
| `connect — 建立 WebSocket 信令连接` | L36866 | `connect()` | — |
| `connectWS — 建立 WebSocket 连接` | L36901 | `connectWS(e)` | WebSocket、Timers/scheduling |
| `bindSocket — 绑定 WebSocket 实例到连接管理器` | L36928 | `bindSocket(e)` | — |
| `unbindSocket — 解绑 WebSocket 实例` | L36936 | `unbindSocket(e)` | — |
| `unbindAndCloseSocket — 解绑并关闭 WebSocket 连接` | L36944 | `unbindAndCloseSocket(e)` | — |
| `onclose — 连接关闭事件回调` | L36972 | `onclose(e)` | — |
| `onerror — 连接错误事件回调` | L36988 | `onerror(e)` | — |
| `onmessage — 收到消息事件回调` | L37002 | `onmessage(e)` | — |
| `reGetSignalChannelUrl — 重新获取信令通道 URL` | L37067 | `reGetSignalChannelUrl()` | — |
| `startReconnection — 开始重连流程` | L37084 | `startReconnection()` | — |
| `reconnect — 重新建立信令连接` | L37097 | `reconnect()` | — |
| `send — 发送信令消息` | L37136 | `send(e)` | — |
| `sendWaitForResponse — 发送请求并等待响应` | L37151 | `sendWaitForResponse(e)` | Timers/scheduling |
| `l — 源码命名函数` | L37167 | `const l = () =>` | Timers/scheduling |
| `u — 源码命名函数` | L37184 | `u = (t) =>` | Timers/scheduling |
| `sendWaitForResponseWithRetry — 发送请求并等待响应（带重试）` | L37195 | `sendWaitForResponseWithRetry(e)` | — |
| `getCurrentState — 获取当前状态` | L37227 | `getCurrentState()` | — |
| `getSignalInfo — 获取信令连接信息` | L37233 | `getSignalInfo()` | — |
| `stopReconnection — 停止重连` | L37239 | `stopReconnection()` | — |
| `close — 关闭本地流并释放所有轨道` | L37245 | `close()` | Timers/scheduling |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L37273 | `destroy()` | — |
| `getBackupRelayIpPair — 获取备用中继 IP 对` | L37279 | `getBackupRelayIpPair()` | — |
| `clearBakRelayIps — 清除备用中继 IP` | L37289 | `clearBakRelayIps()` | — |
| `stopKeepAliveIn — 停止内部保活机制` | L37295 | `stopKeepAliveIn()` | Timers/scheduling |
| `t — 源码命名函数` | L37310 | `const t = (e) =>` | Timers/scheduling |
| `emitConnectionStateChanged — 发射连接状态变化事件` | L37322 | `emitConnectionStateChanged(e)` | — |
| `onError — 错误处理回调` | L37338 | `onError(e, t)` | — |
| `onRetrying — 重连中回调` | L37346 | `onRetrying(e, t)` | — |
## MPC 与 WebRTC Stats（L37360-L41020）
详见：`02-RTCPeerConnection-usage-analysis.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `构造函数` | L37366 | `constructor(e)` | — |
| `beforeConnect — 连接前处理` | L37406 | `beforeConnect()` | — |
| `afterConnect — 连接后处理` | L37412 | `afterConnect()` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L37434 | `initialize()` | RTCPeerConnection |
| `close — 关闭本地流并释放所有轨道` | L37451 | `close(e)` | — |
| `closePeerConnection — 关闭并清理 RTCPeerConnection 连接` | L37461 | `closePeerConnection()` | — |
| `getDTLSTransportState — 获取 DTLS 传输状态` | L37478 | `getDTLSTransportState()` | — |
| `onConnectionStateChange — 连接状态变化回调` | L37498 | `onConnectionStateChange(e)` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L37529 | `emitConnectionStateChangedEvent(e)` | — |
| `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | L37547 | `getPeerConnection()` | — |
| `getRoom — 获取房间实例` | L37553 | `getRoom()` | — |
| `getUserId — 获取用户 ID` | L37559 | `getUserId()` | — |
| `getTinyId — 获取 Tiny ID（内部用户标识）` | L37565 | `getTinyId()` | — |
| `logSelectedCandidate — 记录选中的 ICE 候选` | L37571 | `logSelectedCandidate()` | — |
| `getCurrentState — 获取当前状态` | L37610 | `getCurrentState()` | — |
| `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | L37616 | `waitForPeerConnectionConnected()` | Timers/scheduling |
| `i — 源码命名函数` | L37625 | `const i = (t) =>` | Timers/scheduling |
| `r — 源码命名函数` | L37629 | `r = (e) =>` | Timers/scheduling |
| `n — 内部函数` | L37644 | `n = () =>` | — |
| `getReconnectionCount — 获取重连次数` | L37676 | `getReconnectionCount()` | — |
| `startReconnection — 开始重连流程` | L37682 | `startReconnection()` | — |
| `clearReconnectionTimer — 清除重连定时器` | L37688 | `clearReconnectionTimer()` | Timers/scheduling |
| `stopReconnection — 停止重连` | L37694 | `stopReconnection()` | — |
| `beforeReconnect — 重连前处理` | L37704 | `beforeReconnect()` | — |
| `on — 注册事件监听器` | L37737 | `on(e, t, i)` | — |
| `off — 移除指定事件监听器` | L37743 | `off(e, t, i)` | — |
| `getIsReconnecting — 获取重连状态` | L37749 | `getIsReconnecting()` | — |
| `setOffer — 设置 SDP Offer` | L37764 | `setOffer(e)` | — |
| `setAnswer — 设置 SDP Answer` | L37773 | `setAnswer(e)` | — |
| `jsonParse — 内部函数` | L37786 | `jsonParse = function(e)` | — |
| `jsonStringify — 内部函数` | L37792 | `jsonStringify = function(e)` | — |
| `getActiveKeys — 内部函数` | L37798 | `function getActiveKeys(e)` | — |
| `e 类 — e` | L37805 | `const aJ = class e extends iJ` | WebSocket、Timers/scheduling |
| `构造函数` | L37808 | `constructor(e)` | — |
| `isStreamUnpublished — 检查流是否已取消发布` | L37898 | `isStreamUnpublished(e)` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L37904 | `initialize()` | — |
| `close — 关闭本地流并释放所有轨道` | L37910 | `close(e)` | — |
| `installEvents — 安装事件监听器` | L37921 | `installEvents() {}` | — |
| `uninstallEvents — 卸载事件监听器集合` | L37924 | `uninstallEvents()` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L37930 | `emitConnectionStateChangedEvent(e)` | — |
| `onTrack — 轨道事件回调` | L37947 | `onTrack(e)` | — |
| `addRRTRLine — 添加 RRTR 行` | L37964 | `addRRTRLine(e)` | — |
| `addSPSDescription — 添加 SPS 描述信息` | L37989 | `addSPSDescription(e)` | — |
| `removeSDESDescription — 移除 SDES 描述信息` | L38008 | `removeSDESDescription(e)` | — |
| `isSubscriptionStateNotChanged — 检查订阅状态是否未变化` | L38028 | `isSubscriptionStateNotChanged(e)` | — |
| `subscribe — 订阅远端用户的音视频流` | L38034 | `subscribe(e, t)` | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L38074 | `unsubscribe(e)` | — |
| `sendSubscription — 发送订阅请求` | L38124 | `sendSubscription(e)` | — |
| `connect — 建立 WebSocket 信令连接` | L38161 | `connect()` | — |
| `exchangeSDP — 交换 SDP 描述信息` | L38184 | `exchangeSDP(e)` | — |
| `createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L38226 | `createOffer()` | — |
| `n — 源码命名函数` | L38274 | `const n = (e) =>` | — |
| `onSubscribeResult — 订阅结果回调` | L38322 | `onSubscribeResult(e)` | — |
| `updateSSRC — 更新 SSRC（同步源标识符）` | L38345 | `updateSSRC(e)` | — |
| `getMainStreamVideoTrackId — 获取主流视频轨道 ID` | L38389 | `getMainStreamVideoTrackId()` | — |
| `getAuxStreamVideoTrackId — 获取辅流视频轨道 ID` | L38395 | `getAuxStreamVideoTrackId()` | — |
| `reconnect — 重新建立信令连接` | L38403 | `reconnect()` | Timers/scheduling |
| `getIsReconnecting — 获取重连状态` | L38430 | `getIsReconnecting()` | — |
| `clearReconnectionTimer — 清除重连定时器` | L38436 | `clearReconnectionTimer()` | Timers/scheduling |
| `getCurrentState — 获取当前状态` | L38442 | `getCurrentState()` | — |
| `setDelay — 设置延迟时间` | L38448 | `setDelay(e)` | — |
| `n — 源码命名函数` | L38474 | `const n = (e) =>` | — |
| `e 类 — e` | L38501 | `dJ = class e extends iJ` | RTCRtpSender/Receiver/Transceiver、WebSocket、MediaStream、Track constraints/settings/capabilities、Track lifecycle、Timers/scheduling |
| `构造函数` | L38504 | `constructor(e)` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L38550 | `initialize()` | — |
| `reset — 重置房间状态（清理所有内部数据）` | L38556 | `reset()` | — |
| `close — 关闭本地流并释放所有轨道` | L38562 | `close(e)` | — |
| `installEvents — 安装事件监听器` | L38568 | `installEvents()` | — |
| `uninstallEvents — 卸载事件监听器集合` | L38575 | `uninstallEvents()` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L38581 | `emitConnectionStateChangedEvent(e, t)` | — |
| `publish — 发布本地音视频流到房间` | L38603 | `publish(e)` | — |
| `publishByTransceiver — 通过 addTransceiver API 推流` | L38642 | `publishByTransceiver(e)` | MediaStream |
| `publishByAddTrack — 通过 addTrack API 推流` | L38705 | `publishByAddTrack(e)` | MediaStream |
| `enableSmall — 启用/禁用小流（Simulcast 分层编码）` | L38740 | `enableSmall(e)` | — |
| `installTrackMuteEvents — 安装轨道静音状态事件监听器` | L38757 | `installTrackMuteEvents()` | — |
| `uninstallTrackMuteEvents — 卸载轨道静音状态事件监听器` | L38769 | `uninstallTrackMuteEvents()` | — |
| `unpublish — 取消发布本地音视频流` | L38781 | `unpublish(e)` | — |
| `doPublishChange — 执行推流变更（更新 SDP）` | L38845 | `doPublishChange()` | — |
| `doUnpublish — 执行取消发布（通知服务器并清理上行资源）` | L38865 | `doUnpublish()` | — |
| `updateMediaSettings — 更新媒体设置` | L38885 | `updateMediaSettings()` | Track constraints/settings/capabilities |
| `sendMediaSettings — 发送媒体设置` | L38949 | `sendMediaSettings()` | — |
| `addTrack — 添加媒体轨道到发布流` | L38966 | `addTrack(e)` | — |
| `addTrackByTransceiver — 通过 RTCRtpTransceiver 添加轨道` | L38983 | `addTrackByTransceiver(e, t)` | — |
| `addTrackBySender — 通过 RTCRtpSender 添加轨道` | L39009 | `addTrackBySender(e)` | MediaStream |
| `isNeedToResetOfferOrder — 检查是否需要重置 Offer 顺序` | L39043 | `isNeedToResetOfferOrder()` | — |
| `removeSender — 移除发送器` | L39056 | `removeSender(e)` | Track lifecycle |
| `removeTrack — 从发布流移除媒体轨道` | L39066 | `removeTrack(e)` | — |
| `removeTrackByTransceiver — 通过 RTCRtpTransceiver 移除轨道` | L39083 | `removeTrackByTransceiver(e, t)` | — |
| `setTransceiverDirection — 设置收发器方向（sendrecv/sendonly/recvonly/inactive）` | L39104 | `setTransceiverDirection(e, t)` | — |
| `removeTrackBySender — 通过 RTCRtpSender 移除轨道` | L39155 | `removeTrackBySender(e)` | — |
| `replaceTrack — 替换本地流中的指定轨道` | L39181 | `replaceTrack(e)` | — |
| `updateOffer — 更新 SDP Offer` | L39207 | `updateOffer(e, t)` | — |
| `setBandwidth — 设置带宽` | L39250 | `setBandwidth(e)` | — |
| `updateVideoBandwidthRestriction — 更新视频带宽限制` | L39309 | `updateVideoBandwidthRestriction(e, t, i)` | — |
| `updateAudioBandwidthRestriction — 更新音频带宽限制` | L39330 | `updateAudioBandwidthRestriction(e, t)` | — |
| `removeBandwidthRestriction — 移除带宽限制` | L39345 | `removeBandwidthRestriction(e)` | — |
| `removeVideoOrientation — 移除视频旋转信息` | L39351 | `removeVideoOrientation(e)` | — |
| `connect — 建立 WebSocket 信令连接` | L39357 | `connect()` | — |
| `exchangeSDP — 交换 SDP 描述信息` | L39373 | `exchangeSDP()` | — |
| `createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L39391 | `createOffer()` | — |
| `doExchangeSDP — 执行 SDP 交换（Offer/Answer）` | L39409 | `doExchangeSDP()` | — |
| `setSDPDirection — 设置 SDP 方向属性` | L39438 | `setSDPDirection(e, t)` | — |
| `acceptAnswer — 接受 SDP Answer` | L39454 | `acceptAnswer(e)` | — |
| `sendMutedFlag — 发送静音标志` | L39504 | `sendMutedFlag(e)` | — |
| `getIsReconnecting — 获取重连状态` | L39513 | `getIsReconnecting()` | — |
| `reconnect — 重新建立信令连接` | L39519 | `reconnect()` | Timers/scheduling |
| `handleConnectionStateChange — 处理连接状态变化` | L39562 | `handleConnectionStateChange(e)` | — |
| `updateSSRC — 更新 SSRC（同步源标识符）` | L39570 | `updateSSRC(e)` | — |
| `getVideoTrackId — 获取视频轨道 ID` | L39612 | `getVideoTrackId()` | — |
| `getSSRC — 获取 SSRC（同步源标识）` | L39640 | `getSSRC()` | — |
| `checkPublishResultCode — 检查发布结果码` | L39646 | `checkPublishResultCode(e, t)` | — |
| `n — 源码命名函数` | L39673 | `const n = (e) =>` | — |
| `构造函数` | L39700 | `constructor(e, t)` | — |
| `getSenderStats — 获取发送端统计` | L39724 | `getSenderStats(e)` | — |
| `getReceiverStats — 获取接收端统计` | L39949 | `getReceiverStats(e)` | — |
| `getStats — 获取 WebRTC 连接统计` | L40163 | `getStats(e, t)` | — |
| `getDifferenceValue — 获取差值` | L40210 | `getDifferenceValue(e, t)` | — |
| `prepareReport — 准备上报数据` | L40220 | `prepareReport(e)` | — |
| `getStatsReport — 获取统计报告` | L40605 | `getStatsReport(e)` | — |
| `getMediaPlayoutStats — 获取媒体播放统计` | L40678 | `getMediaPlayoutStats(e)` | — |
| `reset — 重置房间状态（清理所有内部数据）` | L40698 | `reset()` | — |
| `loadScriptAsync — 内部函数` | L40715 | `function loadScriptAsync(e)` | fetch、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L40721 | `asyncGeneratorWrap(this, null, function *()` | fetch、Timers/scheduling |
| `e 类 — e` | L40792 | `const _J = class e extends pJ.default` | — |
| `构造函数` | L40795 | `constructor(e)` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L40863 | `initialize()` | — |
| `handleUplinkNetworkQuality — 上行网络质量回调` | L40874 | `handleUplinkNetworkQuality(e)` | — |
| `handleDownlinkNetworkQuality — 处理下行网络质量事件` | L40902 | `handleDownlinkNetworkQuality()` | — |
| `getStat — 获取统计数据` | L40961 | `getStat(e)` | — |
| `getAverageLossAndRTT — 获取平均丢包率和 RTT` | L40993 | `getAverageLossAndRTT(e)` | — |
| `getNetworkQuality — 获取当前网络质量等级（uplink/downlink）` | L41014 | `getNetworkQuality(e, t)` | — |
## 质量、上报与能力（L41021-L45859）
详见：`10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `handleSignalConnectionStateChange — 信令连接状态变化回调` | L41030 | `handleSignalConnectionStateChange(e)` | — |
| `handleUplinkConnectionStateChange — 处理上行连接状态变化` | L41038 | `handleUplinkConnectionStateChange(e)` | — |
| `isPeerConnectionDisconnected — 检查 PeerConnection 是否已断开` | L41048 | `isPeerConnectionDisconnected(e)` | — |
| `setUplinkConnection — 设置上行连接` | L41057 | `setUplinkConnection(e)` | — |
| `start — 启动组件/模块（开始工作流程）` | L41069 | `start()` | — |
| `stop — 停止本地流播放` | L41138 | `stop()` | — |
| `updateDelay — 更新延迟参数` | L41147 | `updateDelay(e)` | — |
| `构造函数` | L41171 | `constructor(e)` | — |
| `initData — 初始化数据` | L41248 | `initData()` | Navigator/UA |
| `addEvent — 添加事件` | L41325 | `addEvent(e, t)` | — |
| `installEvents — 安装事件监听器` | L41331 | `installEvents()` | — |
| `uninstallEvents — 卸载事件监听器集合` | L41395 | `uninstallEvents()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L41403 | `destroy()` | — |
| `handleUnload — 处理页面卸载事件` | L41412 | `handleUnload()` | — |
| `handleJoinStart — 加入房间开始回调` | L41418 | `handleJoinStart(e)` | — |
| `handleJoinScheduleSuccess — 加入房间调度成功回调` | L41432 | `handleJoinScheduleSuccess(e)` | — |
| `handleSignalConnectionStart — 信令连接开始回调` | L41451 | `handleSignalConnectionStart(e)` | — |
| `handleSignalConnectionEnd — 信令连接结束回调` | L41461 | `handleSignalConnectionEnd(e)` | — |
| `handleJoinSendCMD — 加入房间发送指令回调` | L41475 | `handleJoinSendCMD(e)` | — |
| `handleJoinReceivedCMDResponce — 收到加入房间指令响应回调` | L41483 | `handleJoinReceivedCMDResponce(e)` | — |
| `handleJoinSuccess — 加入房间成功回调` | L41493 | `handleJoinSuccess(e)` | — |
| `handleJoinFailed — 处理加入房间失败` | L41503 | `handleJoinFailed(e)` | Timers/scheduling |
| `handleReceivedPublishUserList — 收到已发布用户列表回调` | L41521 | `handleReceivedPublishUserList(e)` | — |
| `handleSendFirstVideoFrame — 处理首帧视频发送` | L41530 | `handleSendFirstVideoFrame(e)` | — |
| `handleLeaveStart — 离开房间开始回调` | L41541 | `handleLeaveStart(e)` | — |
| `handleLeaveSuccess — 离开房间成功回调` | L41547 | `handleLeaveSuccess(e)` | — |
| `handleLeaveSendCMD — 处理离开房间指令发送` | L41567 | `handleLeaveSendCMD(e)` | — |
| `handleSwitchRoomStart — 切换房间开始回调` | L41575 | `handleSwitchRoomStart(e)` | — |
| `handleSwitchRoomSuccess — 切换房间成功回调` | L41590 | `handleSwitchRoomSuccess(e)` | — |
| `handleSwitchRoomFailed — 切换房间失败回调` | L41605 | `handleSwitchRoomFailed(e)` | — |
| `handleRemoteStreamAdded — 处理远端流添加事件` | L41621 | `handleRemoteStreamAdded(e, t)` | — |
| `handleSubscribeStart — 订阅开始回调` | L41657 | `handleSubscribeStart(e)` | — |
| `handleSubscribed — 订阅成功回调` | L41702 | `handleSubscribed(e)` | — |
| `handlePlayStart — 开始播放回调` | L41716 | `handlePlayStart(e)` | — |
| `handleVideoLoadedData — 视频数据加载完成回调` | L41728 | `handleVideoLoadedData(e)` | — |
| `handleVideoPlaying — 视频正在播放回调` | L41742 | `handleVideoPlaying(e)` | — |
| `handleAudioPlaying — 音频播放中回调` | L41769 | `handleAudioPlaying(e)` | — |
| `handleNetworkQuality — 处理网络质量事件` | L41780 | `handleNetworkQuality(e)` | — |
| `handleHeartbeatStats — 处理心跳统计信息` | L41821 | `handleHeartbeatStats(e)` | — |
| `handlePublishStart — 发布开始回调` | L41919 | `handlePublishStart(e)` | — |
| `handleTrackCaptureStart — 轨道采集开始处理` | L41929 | `handleTrackCaptureStart(e)` | — |
| `handleTrackCaptureSuccess — 轨道采集成功处理` | L41942 | `handleTrackCaptureSuccess(e)` | — |
| `handleTrackCaptureFailed — 轨道采集失败处理` | L41956 | `handleTrackCaptureFailed(e)` | — |
| `hasVideoFlag — 检查视频标志位` | L41981 | `hasVideoFlag(e)` | — |
| `hasAudioFlag — 检查音频标志位` | L41987 | `hasAudioFlag(e)` | — |
| `hasAuxFlag — 检查辅流标志位` | L41993 | `hasAuxFlag(e)` | — |
| `hitTest — 命中检测` | L41999 | `hitTest(e)` | — |
| `prepareReport — 准备上报数据` | L42005 | `prepareReport()` | — |
| `getReportData — 获取上报数据` | L42113 | `getReportData()` | — |
| `report — 上报数据` | L42148 | `report()` | — |
| `upload — 上传日志数据到服务器` | L42171 | `upload(e)` | sendBeacon、Encoding/binary |
| `setConnectionType — 设置连接类型` | L42190 | `setConnectionType(e)` | — |
| `uploadKVStat — 上传 KV 统计` | L42196 | `uploadKVStat(e)` | sendBeacon、Encoding/binary |
| `构造函数` | L42246 | `constructor(e)` | — |
| `构造函数` | L42260 | `constructor()` | — |
| `start — 启动组件/模块（开始工作流程）` | L42266 | `start()` | — |
| `stop — 停止本地流播放` | L42272 | `stop()` | — |
| `getDuration — 获取持续时间` | L42278 | `getDuration()` | — |
| `构造函数` | L42294 | `constructor(e)` | — |
| `installEvents — 安装事件监听器` | L42305 | `installEvents()` | — |
| `uninstallEvents — 卸载事件监听器集合` | L42340 | `uninstallEvents()` | — |
| `handleSubscribed — 订阅成功回调` | L42346 | `handleSubscribed(e)` | — |
| `handleUnsubscribed — 取消订阅回调` | L42357 | `handleUnsubscribed(e)` | — |
| `isRecording — 检查是否正在录制` | L42365 | `isRecording(e)` | — |
| `addDuractionItem — 添加计时项（持续时间统计）` | L42371 | `addDuractionItem(e, t, i)` | — |
| `stopDurationItem — 停止计时项` | L42388 | `stopDurationItem(e, t)` | Track lifecycle |
| `hitTest — 命中检测` | L42399 | `hitTest(e)` | — |
| `getDuration — 获取持续时间` | L42405 | `getDuration(e, t)` | — |
| `getDurationMap — 获取持续时间映射` | L42411 | `getDurationMap()` | — |
| `reset — 重置房间状态（清理所有内部数据）` | L42417 | `reset()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L42423 | `destroy()` | — |
| `构造函数` | L42431 | `constructor()` | — |
| `get — HTTP GET 请求便捷封装` | L42437 | `get(e, t)` | — |
| `set — 设置属性值` | L42447 | `set(e, t, i)` | — |
| `clear — 清除所有数据` | L42453 | `clear()` | — |
| `构造函数` | L42461 | `constructor(e)` | — |
| `getRenderFreezeMap — 获取渲染卡顿映射` | L42478 | `getRenderFreezeMap()` | — |
| `getDataFreezeMap — 获取数据卡顿映射` | L42484 | `getDataFreezeMap()` | — |
| `installEvents — 安装事件监听器` | L42490 | `installEvents()` | Track lifecycle |
| `uninstallEvents — 卸载事件监听器集合` | L42554 | `uninstallEvents()` | — |
| `stop — 停止本地流播放` | L42560 | `stop()` | — |
| `onVideoTrackMuted — 视频轨道被静音回调` | L42566 | `onVideoTrackMuted(e)` | — |
| `isFreezing — 检查是否卡顿` | L42582 | `isFreezing()` | — |
| `onVideoTrackUnmuted — 视频轨道取消静音回调` | L42593 | `onVideoTrackUnmuted(e)` | — |
| `onHearBeatReport — 心跳上报回调` | L42603 | `onHearBeatReport(e)` | — |
| `r — 内部函数` | L42615 | `r = (t == null ? void 0 : t.stat.bytesSent) \|\| 0;` | — |
| `r — 内部函数` | L42642 | `r = (t == null ? void 0 : t.stat.bytesSent) \|\| 0;` | — |
| `stopDataFreeze — 停止数据卡顿检测` | L42658 | `stopDataFreeze(e)` | Track lifecycle |
| `getTotalDuration — 获取总持续时间` | L42679 | `getTotalDuration(e)` | — |
| `onPlayTrackStart — 轨道开始播放回调` | L42691 | `onPlayTrackStart(e)` | — |
| `getDataFreezeDuration — 获取数据卡顿时长` | L42702 | `getDataFreezeDuration(e)` | Track lifecycle |
| `getRenderFreezeDuration — 获取渲染卡顿时长` | L42722 | `getRenderFreezeDuration(e)` | — |
| `getMonitorFreeze — 获取监控卡顿` | L42732 | `getMonitorFreeze()` | — |
| `isBlackStream — 检查是否黑屏流（屏幕分享保护）` | L42738 | `isBlackStream(e)` | — |
| `onRemoteVideoPlayStart — 远端视频开始播放回调` | L42744 | `onRemoteVideoPlayStart(e)` | Media playback、DOM、Page visibility |
| `o — 内部函数` | L42753 | `o = () =>` | Page visibility |
| `s — 源码命名函数` | L42760 | `const s = (e, r) =>` | Media playback |
| `onRemoteVideoPlayEnd — 远端视频播放结束回调` | L42793 | `onRemoteVideoPlayEnd(e)` | DOM、Page visibility |
| `resetMonitor — 重置监控器` | L42803 | `resetMonitor()` | — |
| `hitTest — 命中检测` | L42809 | `hitTest(e)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L42815 | `destroy()` | — |
| `构造函数` | L42824 | `constructor(e, t, i, r, n)` | — |
| `addEvent — 添加事件` | L42858 | `addEvent(e, t, i)` | — |
| `actionCentering — 居中操作` | L42869 | `actionCentering(e)` | — |
| `calculateBoundary — 计算边界` | L42906 | `calculateBoundary(e, t, i, r)` | — |
| `calculateTargetPosition — 计算目标位置` | L42915 | `calculateTargetPosition(e, t, i, r, n, o)` | — |
| `processFacePositionCrop — 处理人脸位置裁剪` | L42940 | `processFacePositionCrop(e, t, i)` | Timers/scheduling |
| `processFacePositionPortrait — 处理人脸人像位置` | L42965 | `processFacePositionPortrait(e)` | Timers/scheduling |
| `animation — 动画处理` | L42984 | `animation()` | — |
| `positionDistance — 位置距离计算` | L43030 | `positionDistance(e, t)` | — |
| `recoverOriginal — 恢复到原始状态` | L43036 | `recoverOriginal(e, t)` | — |
| `dualStageCropping — 双阶段裁剪处理` | L43045 | `dualStageCropping(e, t, i, r, n, o)` | — |
| `movingPortrait — 人像移动处理` | L43056 | `movingPortrait(e, t, i, r, n, o)` | — |
| `extends 类 — extends` | L43112 | `kJ = class extends TH` | Canvas 2D、WebGL、Encoding/binary |
| `构造函数` | L43115 | `constructor(e, t)` | — |
| `init — 初始化组件/模块（分配资源和建立内部状态）` | L43166 | `init(e)` | WebGL、Encoding/binary |
| `initVisionTasks — 初始化视觉任务（人像分割等）` | L43251 | `initVisionTasks(e)` | — |
| `onPredict — 预测回调` | L43288 | `onPredict(e)` | WebGL |
| `getMaskTexture — 获取遮罩纹理` | L43325 | `getMaskTexture(e)` | — |
| `onFirstFrame — 首帧渲染回调` | L43331 | `onFirstFrame()` | WebGL |
| `render — 渲染视频帧到画布` | L43340 | `render(e)` | WebGL |
| `centerFace — 人脸居中` | L43410 | `centerFace()` | Canvas 2D |
| `drawImage — 绘制图像到画布` | L43434 | `drawImage(e, t, i, r)` | — |
| `close — 关闭本地流并释放所有轨道` | L43448 | `close()` | — |
| `extends 类 — extends` | L43466 | `DJ = class extends dH` | WebGL |
| `构造函数` | L43469 | `constructor(e)` | — |
| `_initTexture — 方法` | L43502 | `_initTexture(e, t)` | WebGL |
| `render — 渲染视频帧到画布` | L43521 | `render(e)` | — |
| `resize — 调整渲染尺寸` | L43546 | `resize(e, t)` | WebGL |
| `wJ — 内部函数` | L43564 | `wJ = (e, t) =>` | — |
| `构造函数` | L43579 | `constructor(e)` | — |
| `start — 启动组件/模块（开始工作流程）` | L43674 | `start()` | — |
| `mock — 模拟操作（测试/调试用）` | L43732 | `mock(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L43738 | `close(e)` | — |
| `changeRenderer — 切换渲染器` | L43744 | `changeRenderer(e)` | — |
| `decode — 解码视频/音频数据` | L43752 | `decode(e)` | Encoding/binary |
| `checkDowngradeByFrameDiff — 根据帧差检查是否需要降级` | L43831 | `checkDowngradeByFrameDiff()` | — |
| `checkDowngradeByTimestampDiff — 根据时间戳差异检查是否需要降级` | L43853 | `checkDowngradeByTimestampDiff(e)` | — |
| `pipe — 管道传输（数据流处理）` | L43865 | `pipe(e)` | — |
| `asyncGeneratorWrap — 方法` | L43870 | `asyncGeneratorWrap(this, null, function *()` | — |
| `extends 类 — extends` | L43992 | `MJ = class extends CJ.EventEmitter` | Track lifecycle、Canvas 2D、DOM |
| `构造函数` | L43995 | `constructor(e)` | — |
| `get2dVideoContext — 获取 2D 视频渲染上下文` | L44101 | `get2dVideoContext()` | — |
| `getGlVideoContext — 获取 WebGL 视频渲染上下文` | L44113 | `getGlVideoContext()` | — |
| `initializeGlVideoContext — 初始化 WebGL 视频渲染上下文` | L44125 | `initializeGlVideoContext()` | — |
| `initVirtualBackground — 初始化虚拟背景` | L44150 | `initVirtualBackground(e, t, i)` | — |
| `enablePrintDetail — 启用详细日志打印` | L44156 | `enablePrintDetail()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L44171 | `destroy()` | — |
| `sendCreateResult — 发送创建结果` | L44198 | `sendCreateResult()` | — |
| `checkOrCreateVideoContext — 检查或创建视频上下文` | L44210 | `checkOrCreateVideoContext()` | — |
| `setSmallVideo — 设置小流视频轨道` | L44263 | `setSmallVideo(e, t)` | — |
| `_setMainOutput — 方法` | L44309 | `_setMainOutput(e)` | — |
| `update — 方法` | L44336 | `update()` | — |
| `clearLastFrame — 清除最后一帧缓存` | L44488 | `clearLastFrame()` | — |
| `changeInput — 切换混音输入源` | L44497 | `changeInput(e)` | — |
| `removeInput — 移除混音输入` | L44525 | `removeInput(e)` | — |
| `setMixTrack — 设置混音轨道` | L44544 | `setMixTrack(e)` | — |
| `setCameraTrack — 设置摄像头轨道` | L44550 | `setCameraTrack(e)` | — |
| `setScreenTrack — 设置屏幕共享轨道` | L44556 | `setScreenTrack(e)` | — |
| `getWatermarkImage — 获取水印图片` | L44569 | `getWatermarkImage(e, t)` | Canvas 2D、DOM |
| `d — 内部函数` | L44588 | `d = (l && e) \|\| a,` | Canvas 2D |
| `u — 内部函数` | L44591 | `u = (l && t) \|\| c,` | Canvas 2D |
| `pushWaterMarkImageList — 推送水印图片列表` | L44603 | `pushWaterMarkImageList(e)` | — |
| `setBeautyParams — 设置美颜参数` | L44624 | `setBeautyParams(e)` | — |
| `stopBeauty — 停止美颜效果` | L44633 | `stopBeauty()` | — |
| `setWatermark — 设置水印` | L44642 | `setWatermark(e)` | — |
| `deleteWatermark — 删除水印` | L44707 | `deleteWatermark()` | — |
| `freshWatermark — 刷新水印` | L44725 | `freshWatermark()` | — |
| `setVirtualBackground — 设置虚拟背景（人像分割后替换背景）` | L44740 | `setVirtualBackground(e)` | — |
| `enableAr — 启用 AR 功能` | L44819 | `enableAr(e)` | — |
| `updateAr — 更新 AR 效果` | L44825 | `updateAr()` | Track lifecycle |
| `disableAr — 禁用 AR 功能` | L44838 | `disableAr()` | Track lifecycle |
| `createDecodeContext — 创建解码上下文` | L44846 | `createDecodeContext(e)` | — |
| `clear — 清除所有数据` | L44852 | `clear()` | — |
| `addEncodeProcessor — 添加编码处理器` | L44866 | `addEncodeProcessor(e)` | — |
| `addDecodeProcessor — 添加解码处理器` | L44876 | `addDecodeProcessor(e)` | — |
| `removeEncodeProcessor — 移除编码处理器` | L44886 | `removeEncodeProcessor(e)` | — |
| `removeDecodeProcessor — 移除解码处理器` | L44894 | `removeDecodeProcessor(e)` | — |
| `handleAbortError — 处理中止错误（用户取消操作时的清理）` | L44906 | `handleAbortError(function(e)` | — |
| `extends 类 — extends` | L44947 | `RoomBase = class extends FSM` | — |
| `构造函数` | L44950 | `constructor(e)` | — |
| `getLogger — 获取日志记录器实例` | L45103 | `getLogger()` | — |
| `addTrack — 添加媒体轨道到发布流` | L45121 | `addTrack(e)` | — |
| `removeTrack — 从发布流移除媒体轨道` | L45130 | `removeTrack(e)` | — |
| `replaceTrack — 替换本地流中的指定轨道` | L45139 | `replaceTrack(e)` | — |
| `setEncodedDataProcessingListener — 设置编码数据处理监听器` | L45145 | `setEncodedDataProcessingListener(e)` | — |
| `enableAIVoice — 启用/禁用 AI 语音处理` | L45151 | `enableAIVoice(e)` | — |
| `setProxyServer — 设置代理服务器` | L45157 | `setProxyServer(e)` | — |
| `getRemoteAudioStats — 获取远端音频统计信息` | L45179 | `getRemoteAudioStats()` | — |
| `getTransportStats — 获取传输层统计信息（RTT、连接类型等）` | L45197 | `getTransportStats()` | — |
| `getRemoteVideoStats — 获取远端视频统计信息` | L45211 | `getRemoteVideoStats()` | — |
| `checkDestroy — 检查实例是否已销毁` | L45238 | `checkDestroy()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L45248 | `destroy()` | — |
| `schedule — 调度任务` | L45266 | `schedule(e, t)` | — |
| `sendAbilityStatus — 上报能力状态（编解码能力等）` | L45313 | `sendAbilityStatus(e) {}` | — |
| `enableInsertableStreams — 启用 Insertable Streams（SEI 功能依赖）` | L45316 | `enableInsertableStreams()` | — |
| `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | L45322 | `switchRoom(e)` | — |
| `isSwitchRoomSupported — 检查是否支持切换房间功能` | L45328 | `isSwitchRoomSupported()` | — |
| `sortRtpCodecsByPriority — 内部函数` | L45337 | `function sortRtpCodecsByPriority(e)` | — |
| `BJ — 源码命名函数` | L45369 | `var BJ = (e, t) =>` | RTCPeerConnection |
| `asyncGeneratorWrap — 方法` | L45371 | `asyncGeneratorWrap(void 0, null, function *()` | RTCPeerConnection |
| `HJ — 源码命名函数` | L45454 | `HJ = (e) =>` | — |
| `WJ — 源码命名函数` | L45528 | `WJ = (e) =>` | — |
| `GJ — 内部函数` | L45587 | `GJ = (e, t) =>` | — |
| `jJ — 源码命名函数` | L45603 | `const jJ = (e, t, i) =>` | — |
| `extends 类 — extends` | L45684 | `qJ = class extends JJ.EventEmitter` | — |
| `构造函数` | L45687 | `constructor(e)` | — |
| `onVideoCodecChanged — 视频编码器切换回调` | L45701 | `onVideoCodecChanged(e)` | — |
| `onHeartbeatReport — 心跳上报数据回调` | L45714 | `onHeartbeatReport(e)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L45747 | `destroy()` | — |
| `createSEITransformStream — 内部函数` | L45757 | `function createSEITransformStream(e)` | Streams |
| `transform — 数据转换` | L45765 | `transform(e, o)` | — |
| `createInsertableStreamTransform — 内部函数` | L45797 | `function createInsertableStreamTransform(e)` | Streams |
| `transform — 数据转换` | L45804 | `transform(e, n)` | — |
## SPC、DataChannel 与 Encoded Transform（L45860-L49559）
详见：`02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `extends 类 — extends` | L45865 | `SignalTransport = class extends EventEmitter2.default` | RTCPeerConnection、WebSocket、RTCDataChannel、Worker、Streams、Encoded Transform、URL/Blob、Timers/scheduling |
| `构造函数` | L45868 | `constructor(e)` | — |
| `addAbortController — 添加中止控制器` | L45939 | `addAbortController(e, t)` | — |
| `onBadHealth — 连接亚健康状态回调` | L46075 | `onBadHealth(e)` | — |
| `initScriptTransformWorker — 初始化脚本转换 Worker` | L46083 | `initScriptTransformWorker()` | Worker、Streams、Encoded Transform、URL/Blob |
| `getPeerConnectionConfig — 获取 RTCPeerConnection 配置（ICE 服务器等）` | L46170 | `getPeerConnectionConfig(e)` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L46193 | `initialize(e)` | RTCPeerConnection、RTCDataChannel |
| `setIceServers — 设置 ICE 服务器列表` | L46285 | `setIceServers(e)` | — |
| `setPriority — 设置优先级` | L46313 | `setPriority()` | — |
| `connect — 建立 WebSocket 信令连接` | L46340 | `connect(e)` | URL/Blob |
| `reconnect — 重新建立信令连接` | L46394 | `reconnect()` | — |
| `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | L46460 | `getPeerConnection()` | — |
| `startReconnection — 开始重连流程` | L46466 | `startReconnection()` | — |
| `stopReconnection — 停止重连` | L46479 | `stopReconnection()` | — |
| `checkPeerConnectionToReconnect — 检查并触发 PeerConnection 重连` | L46493 | `checkPeerConnectionToReconnect()` | — |
| `clearReconnectionTimer — 清除重连定时器` | L46503 | `clearReconnectionTimer()` | Timers/scheduling |
| `onConnectionStateChange — 连接状态变化回调` | L46509 | `onConnectionStateChange(e)` | — |
| `getDTLSTransportState — 获取 DTLS 传输状态` | L46538 | `getDTLSTransportState()` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L46551 | `emitConnectionStateChangedEvent(e)` | — |
| `logSelectedCandidate — 记录选中的 ICE 候选` | L46560 | `logSelectedCandidate()` | — |
| `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | L46598 | `waitForPeerConnectionConnected()` | Timers/scheduling |
| `i — 源码命名函数` | L46606 | `const i = (t) =>` | Timers/scheduling |
| `r — 源码命名函数` | L46610 | `r = (e) =>` | Timers/scheduling |
| `n — 内部函数` | L46625 | `n = () =>` | — |
| `waitForReconnected — 等待重连完成` | L46666 | `waitForReconnected()` | — |
| `addDownlink — 添加下行连接（接收远端流）` | L46677 | `addDownlink(e)` | — |
| `updateLocalAndRemoteSDPConfig — 更新本地和远端的 SDP 配置` | L46700 | `updateLocalAndRemoteSDPConfig(e)` | — |
| `removeDownlink — 移除下行连接` | L46813 | `removeDownlink(e)` | — |
| `setBandwidth — 设置带宽` | L46843 | `setBandwidth(e)` | — |
| `setStartBitrate — 设置编码起始码率` | L46881 | `setStartBitrate(e, t)` | — |
| `setSenderMaxBitrate — 设置发送器最大码率` | L46898 | `setSenderMaxBitrate(e, t)` | — |
| `setBandwidthBySDP — 通过修改 SDP 设置带宽限制` | L46914 | `setBandwidthBySDP(e)` | — |
| `setScaleResolutionDownBy — 设置分辨率缩放比例` | L46943 | `setScaleResolutionDownBy(e, t, i)` | — |
| `setDegradationPreference — 设置编码降级偏好（分辨率优先/帧率优先）` | L46963 | `setDegradationPreference(sender, contentHint, streamType)` | — |
| `updateSDP — 更新 SDP 描述` | L46985 | `updateSDP()` | — |
| `asyncGeneratorWrap — 方法` | L46997 | `asyncGeneratorWrap(this, null, function *()` | — |
| `setTransceiverDirection — 设置收发器方向（sendrecv/sendonly/recvonly/inactive）` | L47061 | `setTransceiverDirection(e, t)` | — |
| `filterSDPDirection — 过滤 SDP 中的方向属性` | L47085 | `filterSDPDirection()` | — |
| `setOffer — 设置 SDP Offer` | L47091 | `setOffer(e)` | — |
| `setAnswer — 设置 SDP Answer` | L47101 | `setAnswer(e)` | — |
| `switchVideoEncoder — 切换视频编码器（H264/VP8/VP9 之间切换）` | L47107 | `switchVideoEncoder(e)` | — |
| `useHWEncoder — 使用硬件编码器` | L47138 | `useHWEncoder()` | — |
| `setProfileLevelId — 设置 H264 编码的 profile-level-id` | L47181 | `setProfileLevelId()` | — |
| `sendDataChannelMessage — 通过数据通道发送消息` | L47219 | `sendDataChannelMessage(e)` | — |
| `reset — 重置房间状态（清理所有内部数据）` | L47227 | `reset()` | — |
| `close — 关闭本地流并释放所有轨道` | L47242 | `close()` | — |
| `getReceiversByUserId — 按用户 ID 获取接收器` | L47258 | `getReceiversByUserId(e)` | — |
| `detectTCPAndUDP — 检测 TCP/UDP 连接能力` | L47272 | `detectTCPAndUDP(e)` | — |
| `l — 内部函数` | L47292 | `l = (this._isRelayTried \|\| c > s) && o > a;` | — |
| `switchRelay — 切换中继` | L47314 | `switchRelay(e)` | — |
| `doSwitchRelay — 切换中继线路` | L47344 | `doSwitchRelay(e)` | Timers/scheduling |
| `removeRTCListener — 移除 RTC 监听器` | L47360 | `removeRTCListener()` | — |
| `requestRemoteFallbackToH264 — 请求远端降级到 H264 编码` | L47371 | `requestRemoteFallbackToH264()` | — |
| `构造函数` | L47417 | `constructor(e)` | Encoding/binary |
| `构造函数` | L47430 | `constructor(e)` | Encoding/binary |
| `generateUniqueId — 内部函数` | L47453 | `function generateUniqueId()` | — |
| `extends 类 — extends` | L47469 | `TransportBase = class extends signalTransportModule.default` | RTCPeerConnection |
| `构造函数` | L47472 | `constructor(e)` | — |
| `close — 关闭本地流并释放所有轨道` | L47515 | `close(e)` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L47521 | `emitConnectionStateChangedEvent(e)` | — |
| `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | L47538 | `getPeerConnection()` | — |
| `getRoom — 获取房间实例` | L47544 | `getRoom()` | — |
| `getUserId — 获取用户 ID` | L47550 | `getUserId()` | — |
| `getTinyId — 获取 Tiny ID（内部用户标识）` | L47556 | `getTinyId()` | — |
| `getCurrentState — 获取当前状态` | L47562 | `getCurrentState()` | — |
| `构造函数` | L47579 | `constructor()` | — |
| `getWorker — 获取 Worker 实例` | L47591 | `getWorker()` | Canvas 2D、OffscreenCanvas、Worker、Streams、URL/Blob、Timers/scheduling |
| `start — 启动组件/模块（开始工作流程）` | L47627 | `start(e)` | — |
| `s — 源码命名函数` | L47634 | `const s = (e) =>` | — |
| `checkOnce — 单次检查` | L47683 | `checkOnce(e, t)` | Track lifecycle |
| `stop — 停止本地流播放` | L47701 | `stop(e)` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L47715 | `destroy()` | Track lifecycle |
| `构造函数` | L47728 | `constructor(e)` | — |
| `checkPublishState — 检查发布状态` | L47804 | `checkPublishState()` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L47872 | `initialize()` | — |
| `close — 关闭本地流并释放所有轨道` | L47878 | `close(e)` | — |
| `installEvents — 安装事件监听器` | L47891 | `installEvents()` | — |
| `installSPCEvents — 安装单连接模式事件监听器` | L47899 | `installSPCEvents()` | — |
| `uninstallSPCEvents — 卸载单连接模式事件监听器` | L47909 | `uninstallSPCEvents()` | — |
| `uninstallEvents — 卸载事件监听器集合` | L47917 | `uninstallEvents()` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L47923 | `emitConnectionStateChangedEvent(e, t)` | — |
| `onVideoEncodeFailed — 视频编码失败回调` | L47945 | `onVideoEncodeFailed(e)` | — |
| `publish — 发布本地音视频流到房间` | L47967 | `publish(e)` | URL/Blob |
| `publishByTransceiver — 通过 addTransceiver API 推流` | L48053 | `publishByTransceiver(e)` | Encoded Transform |
| `d — 内部函数` | L48066 | `d = (e, t, i) =>` | Encoded Transform |
| `getTrackByMediaType — 按媒体类型获取轨道` | L48089 | `getTrackByMediaType(e)` | — |
| `createEncodedStreams — 创建编码流（Insertable Streams）` | L48106 | `createEncodedStreams(e, t)` | Streams、Encoded Transform |
| `initSenderTransform — 初始化发送端 Transform Stream` | L48146 | `initSenderTransform(e, t)` | Encoded Transform |
| `enableSmall — 启用/禁用小流（Simulcast 分层编码）` | L48162 | `enableSmall(e)` | — |
| `publishSmall — 发布 Simulcast 小流` | L48171 | `publishSmall(e)` | Track lifecycle、Encoded Transform |
| `doPublishSmall — 推小流（Simulcast 分层编码）` | L48219 | `doPublishSmall(e)` | — |
| `unpublishSmall — 取消发布小流` | L48265 | `unpublishSmall()` | Track lifecycle |
| `installTrackMuteEvents — 安装轨道静音状态事件监听器` | L48281 | `installTrackMuteEvents()` | — |
| `uninstallTrackMuteEvents — 卸载轨道静音状态事件监听器` | L48293 | `uninstallTrackMuteEvents()` | — |
| `unpublish — 取消发布本地音视频流` | L48305 | `unpublish(e)` | — |
| `doPublishChange — 执行推流变更（更新 SDP）` | L48364 | `doPublishChange()` | — |
| `doUnpublish — 执行取消发布（通知服务器并清理上行资源）` | L48385 | `doUnpublish()` | — |
| `updateMediaSettings — 更新媒体设置` | L48405 | `updateMediaSettings()` | Track constraints/settings/capabilities |
| `sendMediaSettings — 发送媒体设置` | L48470 | `sendMediaSettings()` | — |
| `addTrack — 添加媒体轨道到发布流` | L48487 | `addTrack(e)` | — |
| `addTrackByTransceiver — 通过 RTCRtpTransceiver 添加轨道` | L48504 | `addTrackByTransceiver(e, t)` | — |
| `removeTrack — 从发布流移除媒体轨道` | L48531 | `removeTrack(e)` | — |
| `removeTrackByTransceiver — 通过 RTCRtpTransceiver 移除轨道` | L48548 | `removeTrackByTransceiver(e, t)` | — |
| `replaceTrack — 替换本地流中的指定轨道` | L48569 | `replaceTrack(e)` | — |
| `setBandwidth — 设置带宽` | L48598 | `setBandwidth(e)` | — |
| `sendMutedFlag — 发送静音标志` | L48626 | `sendMutedFlag(e)` | — |
| `handleConnectionStateChange — 处理连接状态变化` | L48642 | `handleConnectionStateChange(e)` | — |
| `getVideoTrackId — 获取视频轨道 ID` | L48650 | `getVideoTrackId()` | — |
| `getSSRC — 获取 SSRC（同步源标识）` | L48678 | `getSSRC()` | — |
| `checkPublishResultCode — 检查发布结果码` | L48684 | `checkPublishResultCode(e, t)` | — |
| `onSinglePCReconnected — 单连接模式重连成功回调` | L48700 | `onSinglePCReconnected()` | — |
| `getEnabledKeys — 内部函数` | L48745 | `function getEnabledKeys(e)` | — |
| `构造函数` | L48758 | `constructor(e)` | — |
| `isStreamUnpublished — 检查流是否已取消发布` | L48846 | `isStreamUnpublished(e)` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L48852 | `initialize()` | — |
| `close — 关闭本地流并释放所有轨道` | L48858 | `close(e)` | Timers/scheduling |
| `installEvents — 安装事件监听器` | L48871 | `installEvents()` | — |
| `uninstallEvents — 卸载事件监听器集合` | L48881 | `uninstallEvents()` | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L48890 | `emitConnectionStateChangedEvent(e)` | — |
| `onTrack — 轨道事件回调` | L48907 | `onTrack(e)` | Encoded Transform |
| `createEncodedStreams — 创建编码流（Insertable Streams）` | L48930 | `createEncodedStreams(e)` | Streams、Encoded Transform |
| `initReceiverTransform — 初始化接收端 Transform Stream` | L48974 | `initReceiverTransform(e, t, i)` | Encoded Transform |
| `subscribe — 订阅远端用户的音视频流` | L48989 | `subscribe(e, t)` | Track lifecycle |
| `checkTrackEnded — 检查媒体轨道是否已结束` | L49066 | `checkTrackEnded(e)` | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L49084 | `unsubscribe(e)` | Track lifecycle |
| `sendSubscription — 发送订阅请求` | L49135 | `sendSubscription(e)` | — |
| `getMainStreamVideoTrackId — 获取主流视频轨道 ID` | L49174 | `getMainStreamVideoTrackId()` | — |
| `getAuxStreamVideoTrackId — 获取辅流视频轨道 ID` | L49180 | `getAuxStreamVideoTrackId()` | — |
| `setDelay — 设置延迟时间` | L49188 | `setDelay(e)` | — |
| `onSinglePCReconnected — 单连接模式重连成功回调` | L49196 | `onSinglePCReconnected()` | — |
| `doSubscribe — 执行远端流订阅（发送订阅信令并建立接收连接）` | L49214 | `doSubscribe()` | — |
| `removeDownlink — 移除下行连接` | L49290 | `removeDownlink()` | — |
| `setJitterBufferDelay — 设置抖动缓冲区延迟（抗网络抖动）` | L49306 | `setJitterBufferDelay(e)` | — |
| `doSetJitterBufferDelay — 设置抖动缓冲延迟` | L49327 | `doSetJitterBufferDelay(e)` | Timers/scheduling |
| `s — 内部函数` | L49346 | `s = (e.jitterBufferTarget \|\| 0) + 100;` | — |
| `onDecodeFailed — 解码失败回调` | L49386 | `onDecodeFailed()` | — |
| `n — 源码命名函数` | L49404 | `const n = (e) =>` | — |
| `MessageManagerBase 类 — MessageManagerBase` | L49431 | `const MessageManagerBase = class MessageManagerBase extends _q.EventEmitter` | Timers/scheduling、Encoding/binary |
| `构造函数` | L49434 | `constructor(e, t)` | — |
| `send — 发送信令消息` | L49456 | `send(e)` | Encoding/binary |
| `onReceiveMsg — 收到消息回调` | L49468 | `onReceiveMsg(t)` | Timers/scheduling、Encoding/binary |
| `e — 源码命名函数` | L49515 | `const e = (r) =>` | — |
| `emitMessage — 发射消息事件` | L49524 | `emitMessage(e)` | Timers/scheduling |
## TRTCRoom 与业务编排（L49560-L51908）
详见：`03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md`
| 方法/注释标识 | 行号 | 紧邻源码签名 | 直接 Web API |
|---|---:|---|---|
| `构造函数` | L49571 | `constructor(e)` | — |
| `join — 加入 TRTC 房间，初始化连接并开始信令通信` | L49681 | `join(e, t, i)` | — |
| `asyncGeneratorWrap — 方法` | L49708 | `asyncGeneratorWrap(this, null, function *()` | — |
| `initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | L49745 | `initSinglePC()` | — |
| `doJoin — 执行实际的加入房间操作（发送信令、等待响应）` | L49771 | `doJoin(e, t)` | Navigator/UA、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L49776 | `asyncGeneratorWrap(this, null, function *()` | Navigator/UA、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L49828 | `asyncGeneratorWrap(this, null, function *()` | — |
| `reJoin — 断开后重新加入房间` | L49873 | `reJoin()` | — |
| `e — 源码命名函数` | L49903 | `const e = (t) =>` | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L49941 | `initialize()` | Page visibility |
| `asyncGeneratorWrap — 方法` | L50051 | `asyncGeneratorWrap(this, null, function *()` | — |
| `setSignalChannel — 设置信令通道实例` | L50079 | `setSignalChannel(e)` | — |
| `leave — 离开当前房间` | L50085 | `leave()` | — |
| `clearNetworkQuality — 清除网络质量数据` | L50104 | `clearNetworkQuality()` | Track lifecycle |
| `closeConnections — 关闭所有 WebRTC 连接` | L50110 | `closeConnections()` | — |
| `clearJoinTimeout — 清除加入房间超时定时器` | L50119 | `clearJoinTimeout()` | Timers/scheduling |
| `startHeartbeat — 启动心跳检测（定期发送心跳包保持连接）` | L50125 | `startHeartbeat()` | — |
| `stopHeartbeat — 停止心跳检测` | L50133 | `stopHeartbeat()` | — |
| `doHeartbeat — 执行一次心跳检测并上报状态` | L50143 | `doHeartbeat()` | — |
| `onPublishedUserList — 收到已发布用户列表后的处理` | L50232 | `onPublishedUserList(e)` | — |
| `closeUplink — 关闭上行推流连接` | L50265 | `closeUplink()` | — |
| `createDownlinkConnection — 创建下行拉流连接（接收远端流）` | L50278 | `createDownlinkConnection(e)` | — |
| `closeDownLinkConnection — 关闭指定下行连接` | L50295 | `closeDownLinkConnection(e)` | — |
| `installDownlinkEvents — 安装下行连接的事件监听` | L50304 | `installDownlinkEvents(e, t)` | — |
| `startSyncUserListInterval — 启动定时同步用户列表` | L50324 | `startSyncUserListInterval()` | — |
| `stopSyncUserListInterval — 停止同步用户列表` | L50330 | `stopSyncUserListInterval()` | — |
| `syncUserList — 向服务器同步当前房间用户列表` | L50336 | `syncUserList()` | — |
| `getUserList — 获取房间内用户列表` | L50350 | `getUserList()` | — |
| `getAllConnections — 获取所有 WebRTC 连接实例` | L50380 | `getAllConnections()` | — |
| `isRelayMaybeFailed — 检查中继连接是否可能失败` | L50389 | `isRelayMaybeFailed()` | — |
| `checkConnectionsToReconnect — 检查并触发需要重连的连接` | L50402 | `checkConnectionsToReconnect()` | — |
| `fallbackToMPC — 从单连接模式降级到多连接模式` | L50425 | `fallbackToMPC()` | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L50487 | `destroy()` | — |
| `switchRole — 切换用户角色（anchor/audience），影响发布权限和远端可见性` | L50508 | `switchRole(e)` | — |
| `doSwitchRole — 执行角色切换操作` | L50519 | `doSwitchRole(e)` | — |
| `_initUplinkConnection — 初始化上行推流连接` | L50558 | `_initUplinkConnection()` | — |
| `publish — 发布本地音视频流到房间` | L50587 | `publish(e)` | — |
| `unpublish — 取消发布本地音视频流` | L50610 | `unpublish(e)` | — |
| `addTrack — 添加媒体轨道到发布流` | L50640 | `addTrack(e)` | — |
| `removeTrack — 从发布流移除媒体轨道` | L50650 | `removeTrack(e)` | — |
| `replaceTrack — 替换本地流中的指定轨道` | L50658 | `replaceTrack(e)` | — |
| `setBandWidth — 设置推流带宽限制` | L50669 | `setBandWidth(e)` | — |
| `enableSmall — 启用/禁用小流（Simulcast 分层编码）` | L50679 | `enableSmall(e)` | — |
| `subscribe — 订阅远端用户的音视频流` | L50696 | `subscribe()` | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L50771 | `unsubscribe()` | — |
| `setEncodedDataProcessingListener — 设置编码数据处理监听器` | L50801 | `setEncodedDataProcessingListener(e)` | — |
| `enableAudioVolumeEvaluation — 开启/关闭音量回调通知（设置回调间隔，单位 ms）` | L50807 | `enableAudioVolumeEvaluation()` | — |
| `updateAudioLevelFromSenderStat — 从发送端统计更新音频电平` | L50846 | `updateAudioLevelFromSenderStat(e, t)` | — |
| `asyncGeneratorWrap — 方法` | L50869 | `asyncGeneratorWrap(this, null, function *()` | — |
| `stopUpdateAudioLevelFromSenderStat — 停止从发送端更新音频电平` | L50889 | `stopUpdateAudioLevelFromSenderStat()` | — |
| `updateDownlinkAudioLevelFromReceiver — 从接收端更新下行音频电平` | L50903 | `updateDownlinkAudioLevelFromReceiver(e)` | — |
| `getLocalAudioStats — 获取本地音频统计信息（发送量、丢包等）` | L50923 | `getLocalAudioStats()` | — |
| `getLocalVideoStats — 获取本地视频统计信息（帧率、码率、丢包等）` | L50942 | `getLocalVideoStats()` | — |
| `getTransportStats — 获取传输层统计信息（RTT、连接类型等）` | L50968 | `getTransportStats()` | — |
| `getRemoteVideoStats — 获取远端视频统计信息` | L50992 | `getRemoteVideoStats(e)` | — |
| `getRemoteAudioStats — 获取远端音频统计信息` | L51007 | `getRemoteAudioStats()` | — |
| `setTurnServer — 设置 TURN 中继服务器地址` | L51020 | `setTurnServer(e, t)` | — |
| `sendStartMixTranscode — 发送启动云端混流转码请求` | L51033 | `sendStartMixTranscode(e)` | — |
| `sendStopMixTranscode — 发送停止云端混流转码请求` | L51050 | `sendStopMixTranscode(e)` | — |
| `sendStartPublishCDN — 发送启动 CDN 推流请求` | L51067 | `sendStartPublishCDN(e)` | — |
| `sendStopPublishCDN — 发送停止 CDN 推流请求` | L51087 | `sendStopPublishCDN(e)` | — |
| `sendStartPushStreamToRoom — 发送启动跨房间推流请求` | L51107 | `sendStartPushStreamToRoom(e)` | — |
| `sendUpdatePushStreamToRoom — 发送更新跨房间推流参数请求` | L51124 | `sendUpdatePushStreamToRoom(e)` | — |
| `sendStopPushStreamToRoom — 发送停止跨房间推流请求` | L51141 | `sendStopPushStreamToRoom(e)` | — |
| `sendAbilityStatus — 上报能力状态（编解码能力等）` | L51158 | `sendAbilityStatus(e)` | — |
| `getIceServers — 获取 ICE 服务器列表（STUN/TURN）` | L51175 | `getIceServers(e)` | — |
| `getIceTransportPolicy — 获取 ICE 传输策略` | L51192 | `getIceTransportPolicy()` | — |
| `getLogger — 获取日志记录器实例` | L51198 | `getLogger()` | — |
| `enableAIVoice — 启用/禁用 AI 语音处理` | L51204 | `enableAIVoice()` | — |
| `getSignalChannelUrl — 获取信令通道 URL` | L51210 | `getSignalChannelUrl()` | — |
| `getSignalInfo — 获取信令连接信息` | L51233 | `getSignalInfo()` | — |
| `reset — 重置房间状态（清理所有内部数据）` | L51242 | `reset()` | — |
| `checkSubscribeBigSmallVideo — 检查是否订阅大流/小流` | L51265 | `checkSubscribeBigSmallVideo(e)` | — |
| `changeType — 修改订阅流类型（大小流切换）` | L51325 | `changeType(e, t)` | — |
| `_initBusinessInfo — 初始化业务信息` | L51342 | `_initBusinessInfo(e)` | — |
| `sendCustomMessage — 向房间内其他用户发送自定义消息（二进制数据）` | L51373 | `sendCustomMessage(e)` | — |
| `enableInsertableStreams — 启用 Insertable Streams（SEI 功能依赖）` | L51381 | `enableInsertableStreams()` | — |
| `sendSignalMessage — 发送信令消息到服务器` | L51395 | `sendSignalMessage(e)` | — |
| `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | L51424 | `switchRoom(e)` | — |
| `isSwitchRoomSupported — 检查是否支持切换房间功能` | L51501 | `isSwitchRoomSupported()` | — |
| `requestRemoteFallbackToH264 — 请求远端降级到 H264 编码` | L51523 | `requestRemoteFallbackToH264()` | — |
| `startUpdateNTPTime — 启动 NTP 时间同步` | L51531 | `startUpdateNTPTime()` | Timers/scheduling |
| `updateNTPTime — 更新 NTP 时间` | L51565 | `updateNTPTime()` | — |
| `onRetrying — 重连中回调` | L51599 | `onRetrying(e)` | — |
| `onRetryFailed — 重连失败回调` | L51605 | `onRetryFailed(e)` | — |
| `onError — 错误处理回调` | L51611 | `onError(e, t)` | — |
| `success — 操作成功回调` | L51711 | `success()` | — |
| `onError — 错误处理回调` | L51766 | `onError(e, t, i, r)` | — |
| `cleanupAfterUnpublish — 取消发布后清理` | L51800 | `cleanupAfterUnpublish(function()` | — |
| `extractKeyParam — 提取关键参数` | L51830 | `extractKeyParam(function()` | — |
| `onError — 错误处理回调` | L51852 | `onError(e, t, i, r)` | — |
| `callback — 通用回调` | L51872 | `callback()` | — |
| `extractKeyParam — 提取关键参数` | L51886 | `extractKeyParam(function()` | — |
