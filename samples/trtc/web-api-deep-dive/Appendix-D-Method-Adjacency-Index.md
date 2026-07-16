# 附录 D 方法调用邻接

> 本附录是机械静态索引。短变量类型、回调、装饰器、Promise 延续和动态调用必须结合主线专题判断。
> 本索引覆盖与 `Appendix-B-Source-Method-Index.md` 相同的源码方法集合，列出方法词法范围内直接出现的成员调用、函数/构造调用、事件操作和 Web API 类别。
> 它是机械静态索引：调用者为短变量时不能可靠恢复对象类型；回调函数中的调用会计入包围它的方法；装饰器、EventEmitter、Promise 延续和动态属性调用必须结合各专项文档。
当前索引包含 **2490** 个方法标识。`+N` 表示该单元格只展示前 40 个唯一调用，剩余调用需回到对应源码范围继续查看。
## 运行时 Polyfill（L1-L6650）
详见：`00-Reading-Guide-and-Source-Map.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `e — 源码命名函数` | L31-L63 | .forEach()、.isArray()、.keys()、.getOwnPropertyDescriptor()、.defineProperty()、.freeze() | e() | — | — |
| `get — 源码命名函数` | L52-L55 | — | — | — | — |
| `i — 源码命名函数` | L75-L78 | .call() | i() | — | — |
| `s — 源码命名函数` | L95-L105 | — | Boolean()、e() | — | — |
| `get — 源码命名函数` | L110-L113 | — | — | — | — |
| `E — 源码命名函数` | L149-L152 | — | — | — | — |
| `b — 源码命名函数` | L169-L172 | — | C()、R() | — | — |
| `P — 源码命名函数` | L186-L189 | — | — | — | — |
| `x — 源码命名函数` | L192-L197 | — | new L()、M()、L() | — | — |
| `F — 源码命名函数` | L200-L203 | — | V()、U() | — | — |
| `G — 源码命名函数` | L216-L219 | — | W() | — | — |
| `q — 源码命名函数` | L222-L226 | — | J() | — | — |
| `_e — 源码命名函数` | L271-L281 | — | me() | — | — |
| `Te — 源码命名函数` | L285-L289 | — | new Ee()、fe()、Ee() | — | — |
| `Se — 源码命名函数` | L292-L298 | — | ye()、ve() | — | — |
| `we — 源码命名函数` | L306-L318 | — | De() | — | — |
| `Ve — 源码命名函数` | L333-L336 | — | — | — | — |
| `Be — 源码命名函数` | L339-L342 | — | Fe()、Ue() | — | — |
| `Ke — 源码命名函数` | L355-L358 | — | — | — | — |
| `rt — 源码命名函数` | L367-L370 | — | Xe()、it() | — | — |
| `ct — 源码命名函数` | L375-L383 | — | new Ce()、Ae()、Re()、Ie()、Ce() | — | — |
| `ut — 源码命名函数` | L386-L399 | — | new lt()、ot()、st()、at()、nt()、lt()、ct() | — | — |
| `mt — 源码命名函数` | L402-L408 | — | ht()、pt() | — | — |
| `Et — 源码命名函数` | L412-L415 | .createElement() | — | — | — |
| `get — 源码命名函数` | L423-L426 | — | — | — | — |
| `Lt — 源码命名函数` | L463-L467 | — | new Mt()、Ot()、Mt() | — | — |
| `_i — 源码命名函数` | L554-L557 | — | pi() | — | — |
| `enforce — 内部函数` | L619-L622 | — | ci()、ai()、si() | — | — |
| `getterFor — 内部函数` | L625-L635 | — | new Ci()、Ti()、ai()、Ci() | — | — |
| `$i — 源码命名函数` | L687-L707 | .f() | Yi()、Qi()、Zi() | — | — |
| `or — 源码命名函数` | L721-L727 | — | Number()、nr() | — | — |
| `lr — 源码命名函数` | L731-L737 | — | sr()、ar()、cr() | — | — |
| `hr — 源码命名函数` | L740-L746 | — | dr()、ur() | — | — |
| `mr — 源码命名函数` | L748-L751 | — | pr() | — | — |
| `Er — 源码命名函数` | L755-L774 | — | _r()、gr()、fr() | — | — |
| `Rr — 源码命名函数` | L781-L792 | — | yr()、vr()、Ar()、Sr() | — | — |
| `Br — 源码命名函数` | L833-L841 | — | Vr()、xr()、n()、o() | — | — |
| `jr — 源码命名函数` | L845-L851 | — | Jr()、Wr()、Hr()、Boolean() | — | — |
| `nn — 源码命名函数` | L868-L893 | — | en()、Qr()、rn()、tn()、Zr()、$r() | — | — |
| `_n — 源码命名函数` | L939-L944 | — | new TypeError()、pn()、TypeError()、mn() | — | — |
| `En — 源码命名函数` | L947-L950 | .f() | fn() | — | — |
| `Nn — 源码命名函数` | L966-L973 | — | new kn()、Rn()、An()、kn() | — | — |
| `get — 源码命名函数` | L985-L995 | — | Pn()、Sn()、Mn()、Vn()、xn() | — | — |
| `oo — 源码命名函数` | L1036-L1036 | — | — | — | — |
| `so — 源码命名函数` | L1037-L1040 | — | — | — | — |
| `ao — 源码命名函数` | L1041-L1048 | .write()、.close() | so() | — | — |
| `co — 源码命名函数` | L1049-L1081 | .appendChild()、.open()、.write()、.close() | new ActiveXObject()、ActiveXObject()、ao()、to()、String()、so()、co() | — | — |
| `includes — 内部函数` | L1121-L1124 | — | go() | — | — |
| `e — 源码命名函数` | L1134-L1134 | — | e() | — | — |
| `jo — 源码命名函数` | L1186-L1189 | — | Wo()、Ho() | — | — |
| `Xo — 源码命名函数` | L1195-L1198 | — | — | — | — |
| `Qo — 源码命名函数` | L1199-L1205 | — | qo()、zo()、Number()、Ko() | — | — |
| `ts — 源码命名函数` | L1209-L1212 | — | es() | — | — |
| `ns — 源码命名函数` | L1215-L1222 | .getOwnPropertyDescriptor() | Zo()、$o() | — | — |
| `as — 源码命名函数` | L1225-L1229 | — | new rs()、ts()、rs() | — | — |
| `bs — 源码命名函数` | L1269-L1272 | — | — | — | — |
| `ks — 源码命名函数` | L1273-L1329 | .call() | new i()、new e()、hs()、i()、d()、ps()、e()、ms()、us()、gs()、_s()、fs()、ds()、ls() | — | — |
| `d — 源码命名函数` | L1279-L1298 | — | new i()、i() | — | — |
| `Ds — 源码命名函数` | L1330-L1333 | — | — | — | — |
| `Ys — 源码命名函数` | L1385-L1411 | — | new zs()、js()、Js()、qs()、Gs()、zs()、i() | — | — |
| `Zs — 源码命名函数` | L1414-L1434 | .call() | Boolean()、Qs() | — | — |
| `ia — 源码命名函数` | L1438-L1441 | .slice() | — | — | — |
| `reduce — 内部函数` | L1466-L1472 | — | oa() | — | — |
| `reduceRight — 内部函数` | L1481-L1484 | — | arrayReduceRight() | — | — |
| `reverse — 内部函数` | L1503-L1506 | — | da()、ua() | — | — |
| `Ea — 源码命名函数` | L1514-L1533 | — | t()、ga()、Ea()、fa() | — | — |
| `wa — 源码命名函数` | L1545-L1548 | — | new ma()、ma() | — | — |
| `sort — 内部函数` | L1620-L1652 | — | ba()、ka()、Ba()、Da()、Ha()、Pa()、Number()、e()、Na()、wa() | — | — |
| `Ka — 源码命名函数` | L1657-L1662 | — | za() | — | — |
| `Qa — 源码命名函数` | L1665-L1669 | — | new Xa()、Ya()、Xa() | — | — |
| `tc — 源码命名函数` | L1673-L1682 | — | new ec()、Za()、$a()、ec() | — | — |
| `oc — 源码命名函数` | L1694-L1697 | — | — | — | — |
| `ac — 源码命名函数` | L1699-L1711 | — | Number()、sc()、nc()、oc() | — | — |
| `pack — 内部函数` | L1726-L1757 | — | lc()、uc()、dc()、hc()、pc() | — | — |
| `unpack — 内部函数` | L1760-L1782 | — | uc() | — | — |
| `Tc — 源码命名函数` | L1787-L1802 | — | fc()、Ec()、gc() | — | — |
| `Ic — 源码命名函数` | L1806-L1812 | — | vc()、yc()、Sc() | — | — |
| `pl — 源码命名函数` | L1856-L1859 | — | — | — | — |
| `ml — 源码命名函数` | L1860-L1863 | — | — | — | — |
| `_l — 源码命名函数` | L1864-L1867 | — | — | — | — |
| `fl — 源码命名函数` | L1868-L1871 | — | — | — | — |
| `gl — 源码命名函数` | L1872-L1875 | — | ul()、xc() | — | — |
| `El — 源码命名函数` | L1876-L1879 | — | ul() | — | — |
| `Tl — 源码命名函数` | L1880-L1889 | — | Dc()、i() | — | — |
| `get — 源码命名函数` | L1884-L1887 | — | i() | — | — |
| `vl — 源码命名函数` | L1890-L1903 | — | new cl()、$c()、Lc()、Boolean()、cl()、Hc()、dl() | — | — |
| `yl — 源码命名函数` | L1904-L1913 | — | new cl()、$c()、Lc()、r()、Number()、Boolean()、cl() | — | — |
| `setInt8 — 内部函数` | L1949-L1952 | — | Al() | — | — |
| `setUint8 — 内部函数` | L1955-L1958 | — | Al() | — | — |
| `getInt8 — 内部函数` | L1986-L1989 | — | vl() | — | — |
| `getUint8 — 内部函数` | L1992-L1995 | — | vl() | — | — |
| `getInt16 — 内部函数` | L1998-L2004 | — | vl() | — | — |
| `getUint16 — 内部函数` | L2007-L2013 | — | vl() | — | — |
| `getInt32 — 内部函数` | L2016-L2019 | — | fl()、vl() | — | — |
| `getUint32 — 内部函数` | L2022-L2025 | — | fl()、vl() | — | — |
| `getFloat32 — 内部函数` | L2028-L2031 | — | hl()、vl() | — | — |
| `getFloat64 — 内部函数` | L2034-L2037 | — | hl()、vl() | — | — |
| `setInt8 — 内部函数` | L2040-L2043 | — | yl() | — | — |
| `setUint8 — 内部函数` | L2046-L2049 | — | yl() | — | — |
| `setInt16 — 内部函数` | L2052-L2055 | — | yl() | — | — |
| `setUint16 — 内部函数` | L2058-L2061 | — | yl() | — | — |
| `setInt32 — 内部函数` | L2064-L2067 | — | yl() | — | — |
| `setUint32 — 内部函数` | L2070-L2073 | — | yl() | — | — |
| `setFloat32 — 内部函数` | L2076-L2079 | — | yl() | — | — |
| `setFloat64 — 内部函数` | L2082-L2085 | — | yl() | — | — |
| `wl — 源码命名函数` | L2093-L2107 | — | Cl()、bl() | — | — |
| `get — 源码命名函数` | L2102-L2105 | — | — | — | — |
| `xl — 源码命名函数` | L2115-L2118 | — | Ml()、Ll() | — | — |
| `slice — 内部函数` | L2144-L2161 | — | new Gl()、new jl()、ql()、Bl()、Hl()、Gl()、Wl()、jl()、Kl()、zl() | — | — |
| `ed — 源码命名函数` | L2169-L2169 | — | — | — | — |
| `od — 源码命名函数` | L2174-L2185 | — | Ql()、td() | — | — |
| `sd — 源码命名函数` | L2186-L2204 | — | Ql()、Zl()、Boolean()、rd()、$l() | — | — |
| `_d — 源码命名函数` | L2233-L2237 | — | new md()、hd()、md() | — | — |
| `vd — 源码命名函数` | L2242-L2249 | — | fd()、Ed()、gd() | — | — |
| `Dd — 源码命名函数` | L2265-L2278 | .apply() | Cd()、kd() | — | — |
| `Nd — 源码命名函数` | L2280-L2285 | — | new wd()、wd() | — | — |
| `iu — 源码命名函数` | L2323-L2329 | — | handleScheduledTask() | — | — |
| `ru — 源码命名函数` | L2330-L2333 | — | handleScheduledTask() | — | — |
| `nu — 源码命名函数` | L2334-L2337 | .postMessage() | Qd() | — | — |
| `lu — 源码命名函数` | L2391-L2398 | — | cu() | — | — |
| `du — 源码命名函数` | L2399-L2402 | — | — | — | — |
| `add — 源码命名函数` | L2405-L2411 | — | — | — | — |
| `get — 源码命名函数` | L2412-L2417 | — | — | — | — |
| `Mu — 源码命名函数` | L2445-L2459 | .exit()、.get()、.enter() | t()、uu() | — | — |
| `xu — 源码命名函数` | L2492-L2502 | — | e() | — | — |
| `r — 源码命名函数` | L2529-L2535 | — | e() | — | — |
| `eh — 源码命名函数` | L2546-L2557 | — | new e()、new $u()、e()、$u()、Zu() | — | — |
| `Th — 源码命名函数` | L2581-L2588 | .error() | — | — | — |
| `Hh — 源码命名函数` | L2610-L2616 | — | mh()、ph() | — | — |
| `Wh — 源码命名函数` | L2617-L2641 | .enter()、.exit() | new Mh()、zh()、a()、l()、Mh()、Hh()、ah()、c() | — | — |
| `Gh — 源码命名函数` | L2642-L2651 | .get() | Eh()、Wh()、Jh() | — | — |
| `jh — 源码命名函数` | L2652-L2660 | .createEvent()、.initEvent()、.dispatchEvent() | n()、Th() | — | — |
| `Jh — 源码命名函数` | L2661-L2680 | .emit() | ah()、qh()、vh()、jh() | emit('unhandledRejection') | — |
| `qh — 源码命名函数` | L2681-L2684 | — | — | — | — |
| `zh — 源码命名函数` | L2685-L2693 | .emit() | ah()、jh() | emit('rejectionHandled') | — |
| `Kh — 源码命名函数` | L2694-L2700 | — | e() | — | — |
| `Yh — 源码命名函数` | L2701-L2704 | — | Gh() | — | — |
| `Xh — 源码命名函数` | L2705-L2736 | — | new Mh()、Mh()、Hh()、Eh()、ah()、Kh()、Yh()、Gh() | — | — |
| `ep — 源码命名函数` | L2829-L2832 | — | — | — | — |
| `sp — 源码命名函数` | L2838-L2841 | — | rp()、ip()、tp() | — | — |
| `pp — 源码命名函数` | L2848-L2854 | — | new hp()、up()、cp()、lp()、ap()、hp() | — | — |
| `gp — 源码命名函数` | L2858-L2881 | — | _p()、fp()、mp() | — | — |
| `Dp — 源码命名函数` | L2893-L2896 | — | — | — | — |
| `Np — 源码命名函数` | L2898-L2949 | — | new Dp()、new kp()、Ep()、bp()、Dp()、vp()、_()、Cp()、kp()、Sp()、Ip()、g()、Ap()、Rp()、Tp() | — | — |
| `f — 源码命名函数` | L2913-L2916 | — | new Dp()、bp()、Dp() | — | — |
| `g — 源码命名函数` | L2917-L2920 | — | vp()、_() | — | — |
| `next — 执行下一步（迭代器）` | L2958-L2961 | — | Boolean() | — | — |
| `return — 内部函数` | L2964-L2967 | — | — | — | — |
| `next — 执行下一步（迭代器）` | L3000-L3003 | — | — | — | — |
| `all — 源码命名函数` | L3028-L3057 | .f()、.then() | Wp()、Bp()、Gp()、Fp()、r()、n() | — | — |
| `catch — 内部函数` | L3073-L3076 | .then() | — | — | — |
| `race — 内部函数` | L3096-L3113 | .f()、.then() | tm()、$p()、im()、Zp()、r() | — | — |
| `reject — 内部函数` | L3122-L3128 | .f() | — | — | — |
| `am — 源码命名函数` | L3134-L3141 | .f() | requireFunction()、om() | — | — |
| `resolve — 内部函数` | L3151-L3154 | — | dm() | — | — |
| `finally — 内部函数` | L3182-L3208 | .then() | fm()、mm()、_m()、gm()、e() | — | — |
| `Am — 源码命名函数` | L3221-L3227 | — | isObject()、Boolean()、Sm() | — | — |
| `Cm — 源码命名函数` | L3229-L3246 | — | Rm() | — | — |
| `Om — 源码命名函数` | L3252-L3258 | — | km()、Dm()、bm() | — | — |
| `o_ — 源码命名函数` | L3316-L3330 | — | Fm() | — | — |
| `get — 源码命名函数` | L3321-L3324 | — | — | — | — |
| `set — 源码命名函数` | L3325-L3328 | — | — | — | — |
| `sf — 源码命名函数` | L3553-L3563 | — | new tf()、$_()、ef()、Z_()、tf() | — | — |
| `uf — 源码命名函数` | L3568-L3584 | — | of()、af()、nf()、cf()、df()、lf() | — | — |
| `padStart — 内部函数` | L3593-L3596 | — | mf() | — | — |
| `wf — 源码命名函数` | L3614-L3637 | — | Rf()、Cf()、Af()、kf()、bf()、Df() | — | — |
| `Hf — 源码命名函数` | L3648-L3691 | — | Mf()、Vf()、xf()、Uf()、Number()、Lf() | — | — |
| `Qf — 源码命名函数` | L3701-L3761 | — | Tf()、Ef()、t()、_f()、ff()、vf() | — | — |
| `sg — 源码命名函数` | L3770-L3773 | — | Of() | — | — |
| `lg — 源码命名函数` | L3776-L3789 | — | new zf()、jf()、Wf()、Gf()、Jf()、zf() | — | — |
| `gg — 源码命名函数` | L3797-L3800 | — | String() | — | — |
| `kg — 源码命名函数` | L3887-L3896 | — | Ig()、Sg()、Rg() | — | — |
| `trim — 内部函数` | L3917-L3920 | — | Pg() | — | — |
| `gE — 源码命名函数` | L3970-L3981 | — | Xg()、Wg()、tE()、Gg()、gE() | — | — |
| `EE — 源码命名函数` | L3982-L3989 | — | Wg()、jg()、Gg() | — | — |
| `get — 源码命名函数` | L4007-L4010 | — | Wg() | — | — |
| `aTypedArray — 内部函数` | L4019-L4023 | — | new lE()、EE()、lE() | — | — |
| `aTypedArrayConstructor — 内部函数` | L4026-L4030 | — | new lE()、Hg()、Yg()、lE() | — | — |
| `exportTypedArrayMethod — 内部函数` | L4033-L4058 | — | Gg()、zg() | — | — |
| `exportTypedArrayStaticMethod — 内部函数` | L4061-L4086 | — | Gg()、zg() | — | — |
| `isView — 内部函数` | L4090-L4097 | — | Wg()、jg()、Gg() | — | Encoding/binary |
| `OE — 源码命名函数` | L4136-L4143 | — | new NE()、wE()、NE() | — | — |
| `ME — 源码命名函数` | L4145-L4152 | — | new PE()、OE()、PE() | — | — |
| `FE — 源码命名函数` | L4157-L4164 | — | new UE()、VE()、UE()、BigInt() | — | — |
| `KE — 源码命名函数` | L4173-L4179 | — | xE() | — | — |
| `QE — 源码命名函数` | L4182-L4204 | .push() | WE()、GE()、qE()、zE()、JE()、HE()、BE()、jE()、YE()、KE()、h()、XE()、Number() | — | — |
| `rT — 源码命名函数` | L4210-L4221 | — | ZE()、$E()、eT() | — | — |
| `cT — 源码命名函数` | L4226-L4229 | — | rT() | — | — |
| `dT — 源码命名函数` | L4231-L4282 | — | sT()、oT()、aT()、nT()、T()、g()、lT() | — | — |
| `bT — 源码命名函数` | L4308-L4314 | — | LE() | — | — |
| `GT — 源码命名函数` | L4330-L4335 | — | new e()、hT()、e() | — | — |
| `av — 源码命名函数` | L4353-L4362 | — | BT()、JT() | — | — |
| `get — 源码命名函数` | L4357-L4360 | — | JT() | — | — |
| `cv — 源码命名函数` | L4363-L4369 | — | MT()、wT() | — | Encoding/binary |
| `lv — 源码命名函数` | L4370-L4373 | — | nv()、OT()、IT()、Number() | — | — |
| `dv — 源码命名函数` | L4374-L4377 | — | kT()、lv()、yT()、YT() | — | — |
| `uv — 源码命名函数` | L4378-L4391 | — | kT()、lv()、NT()、DT()、KT() | — | — |
| `u — 源码命名函数` | L4406-L4430 | — | KT()、JT()、bT() | — | — |
| `get — 源码命名函数` | L4409-L4418 | — | JT() | — | — |
| `set — 源码命名函数` | L4419-L4427 | — | JT()、bT() | — | — |
| `valueOf — function valueOf() { [native code] }` | L4546-L4549 | — | — | — | — |
| `replaceAll — 内部函数` | L4709-L4737 | — | new cy()、$v()、ty()、iy()、ry()、oy()、ly()、cy()、ny()、Qv()、ey()、uy()、t()、sy()、stringSlice() | — | — |
| `Iy — 源码命名函数` | L4788-L4799 | — | Sy() | — | — |
| `Py — 源码命名函数` | L4811-L4836 | — | Dy()、wy() | — | — |
| `Ky — 源码命名函数` | L4864-L4886 | — | Wy()、Uy()、Gy()、Hy()、Vy()、e() | — | — |
| `get — 源码命名函数` | L4973-L4976 | — | ES() | — | — |
| `DS — 源码命名函数` | L5016-L5026 | — | t()、yS()、SS() | — | — |
| `PS — 源码命名函数` | L5030-L5033 | .f() | RS() | — | — |
| `ZS — 源码命名函数` | L5052-L5055 | — | — | — | — |
| `$S — 源码命名函数` | L5056-L5063 | — | jS() | — | — |
| `eI — 源码命名函数` | L5064-L5126 | — | new WS()、qS()、KS()、JS()、jS()、WS()、ZS()、$S()、zS() | — | — |
| `fromCodePoint — 内部函数` | L5139-L5148 | — | new nI()、Number()、rI()、nI()、oI()、aI() | — | — |
| `dA — 源码命名函数` | L5207-L5213 | — | sA()、aA()、ZI() | — | — |
| `uA — 源码命名函数` | L5214-L5219 | — | — | — | — |
| `hA — 源码命名函数` | L5220-L5240 | — | — | — | — |
| `pA — 源码命名函数` | L5241-L5298 | — | iA()、$I()、dA()、uA()、XI()、tA()、hA()、QI() | — | — |
| `fA — 源码命名函数` | L5301-L5304 | — | — | — | — |
| `gA — 源码命名函数` | L5305-L5308 | — | iA()、YI() | — | — |
| `TA — 源码命名函数` | L5336-L5344 | .parseObject()、.parseQuery() | kI()、$I()、sA()、DI() | — | — |
| `bindURL — 内部函数` | L5350-L5353 | .update() | — | — | — |
| `parseObject — 内部函数` | L5356-L5376 | — | new KI()、PI()、OI()、hI()、bI()、KI()、tA()、DI()、AI() | — | — |
| `parseQuery — 内部函数` | L5379-L5384 | — | oA()、tA()、pA()、rA()、eA() | — | — |
| `serialize — 内部函数` | L5387-L5392 | — | tA()、eA() | — | — |
| `update — 内部函数` | L5395-L5398 | .parseQuery() | — | — | — |
| `updateURL — 内部函数` | L5401-L5404 | .update() | — | — | — |
| `append — 内部函数` | L5420-L5425 | .updateURL() | HI()、LI()、tA()、DI() | — | — |
| `delete — 内部函数` | L5428-L5448 | .updateURL() | HI()、LI()、DI()、nA() | — | — |
| `get — 源码命名函数` | L5449-L5457 | — | HI()、LI()、DI() | — | — |
| `getAll — 内部函数` | L5460-L5468 | — | HI()、LI()、DI()、tA() | — | — |
| `has — 源码命名函数` | L5469-L5488 | — | HI()、LI()、DI() | — | — |
| `set — 源码命名函数` | L5489-L5497 | .updateURL() | HI()、LI()、DI()、nA()、tA() | — | — |
| `sort — 内部函数` | L5500-L5509 | .updateURL() | HI()、xI() | — | — |
| `forEach — 内部函数` | L5512-L5520 | — | HI()、RI()、r() | — | — |
| `keys — 内部函数` | L5523-L5526 | — | new EA()、EA() | — | — |
| `values — 内部函数` | L5529-L5532 | — | new EA()、EA() | — | — |
| `entries — 内部函数` | L5535-L5538 | — | new EA()、EA() | — | — |
| `get — 源码命名函数` | L5554-L5557 | — | HI() | — | — |
| `AA — 源码命名函数` | L5568-L5584 | — | new JI()、kI()、CI()、JI()、SA()、IA()、wI()、NI()、DI() | — | — |
| `fetch — 内部函数` | L5592-L5595 | — | GI()、AA() | — | — |
| `UA — 源码命名函数` | L5623-L5648 | — | new this()、kS()、NS()、CS()、LS()、wS()、OS()、this()、xS()、n()、PS()、MS()、bS()、DS() | — | — |
| `HA — 源码命名函数` | L5651-L5661 | — | XS()、YS()、QS()、KS()、GS()、zS() | — | — |
| `DR — 源码命名函数` | L5703-L5735 | — | pR()、eR()、nR()、oR() | — | — |
| `MR — 源码命名函数` | L5740-L5746 | — | BA()、xA()、encodeURIComponent() | — | — |
| `xR — 源码命名函数` | L5748-L5754 | — | rR()、iR() | — | — |
| `VR — 源码命名函数` | L5755-L5765 | — | xR()、uR()、iR() | — | — |
| `UR — 源码命名函数` | L5766-L5769 | — | hR() | — | — |
| `sC — 源码命名函数` | L5791-L5808 | .parse()、.bindURL() | new ZA()、new sC()、new YA()、WA()、ZA()、sC()、XA()、YA() | — | — |
| `parse — 内部函数` | L5814-L6161 | .isSpecial()、.includesCredentials()、.parseHost()、.shortenPath() | WA()、cR()、UA()、rR()、hR()、xA()、aR()、FA()、iR()、MR()、$A()、VR()、nR()、xR()、UR()、lR() | — | — |
| `parseHost — 内部函数` | L6164-L6306 | .isSpecial() | iR()、h()、rR()、$A()、uR()、HA()、dR()、aR()、tR()、sR()、UA()、MR() | — | — |
| `h — 源码命名函数` | L6185-L6188 | — | iR() | — | — |
| `cannotHaveUsernamePasswordPort — 内部函数` | L6309-L6312 | — | — | — | — |
| `includesCredentials — 内部函数` | L6315-L6318 | — | — | — | — |
| `isSpecial — 内部函数` | L6321-L6324 | — | xA() | — | — |
| `shortenPath — 内部函数` | L6327-L6333 | — | xR() | — | — |
| `serialize — 内部函数` | L6336-L6362 | .includesCredentials() | DR() | — | — |
| `setHref — 内部函数` | L6365-L6371 | .parse()、.update() | new ZA()、ZA() | — | — |
| `getOrigin — 内部函数` | L6374-L6390 | .isSpecial() | new aC()、aC() | — | — |
| `getProtocol — 内部函数` | L6393-L6396 | — | — | — | — |
| `setProtocol — 内部函数` | L6399-L6402 | .parse() | — | — | — |
| `getUsername — 内部函数` | L6405-L6408 | — | — | — | — |
| `setUsername — 内部函数` | L6411-L6420 | .cannotHaveUsernamePasswordPort() | UA()、WA()、MR() | — | — |
| `getPassword — 内部函数` | L6423-L6426 | — | — | — | — |
| `setPassword — 内部函数` | L6429-L6438 | .cannotHaveUsernamePasswordPort() | UA()、WA()、MR() | — | — |
| `getHost — 内部函数` | L6441-L6448 | — | DR() | — | — |
| `setHost — 内部函数` | L6451-L6454 | .parse() | — | — | — |
| `getHostname — 内部函数` | L6457-L6463 | — | DR() | — | — |
| `setHostname — 内部函数` | L6466-L6469 | .parse() | — | — | — |
| `getPort — 内部函数` | L6472-L6478 | — | WA() | — | — |
| `setPort — 内部函数` | L6481-L6484 | .cannotHaveUsernamePasswordPort()、.parse() | WA() | — | — |
| `getPathname — 内部函数` | L6487-L6493 | — | — | — | — |
| `setPathname — 内部函数` | L6496-L6499 | .parse() | — | — | — |
| `getSearch — 内部函数` | L6502-L6508 | — | — | — | — |
| `setSearch — 内部函数` | L6511-L6517 | .parse()、.update() | WA()、iR()、uR() | — | — |
| `getSearchParams — 内部函数` | L6520-L6523 | — | — | — | — |
| `getHash — 内部函数` | L6526-L6532 | — | — | — | — |
| `setHash — 内部函数` | L6535-L6540 | .parse() | WA()、iR()、uR() | — | — |
| `update — 内部函数` | L6543-L6546 | .serialize() | — | — | — |
| `lC — 源码命名函数` | L6569-L6585 | — | KA() | — | — |
| `get — 源码命名函数` | L6572-L6575 | — | KA() | — | — |
| `toJSON — 内部函数` | L6634-L6637 | — | hC() | — | URL/Blob |
| `_C — 源码命名函数` | L6643-L6649 | .match() | _C()、parseInt() | — | — |
## WebRTC Adapter（L6651-L9450）
详见：`02-RTCPeerConnection-usage-analysis.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `fC — 源码命名函数` | L6654-L6707 | .apply()、.handleEvent()、.set()、.has()、.get()、.delete()、.keys()、.defineProperty()、.removeEventListener()、.addEventListener() | new Map()、fC()、i()、r()、Map()、get()、set() | addEventListener(t)、removeEventListener(t) | RTCPeerConnection |
| `o — 源码命名函数` | L6663-L6668 | .handleEvent() | i()、r() | — | — |
| `gC — 内部函数` | L6710-L6715 | — | new Error()、gC()、Error() | — | — |
| `EC — 内部函数` | L6718-L6723 | — | new Error()、EC()、Error() | — | — |
| `TC — 内部函数` | L6726-L6733 | .apply() | TC() | — | — |
| `vC — 内部函数` | L6736-L6739 | .warn() | vC() | — | — |
| `yC — 内部函数` | L6742-L6745 | .call() | yC() | — | — |
| `SC — 内部函数` | L6748-L6761 | .keys()、.reduce()、.assign() | SC()、yC() | — | — |
| `IC — 内部函数` | L6764-L6779 | .has()、.set()、.keys()、.forEach()、.endsWith()、.get() | IC() | — | — |
| `AC — 内部函数` | L6782-L6805 | .forEach()、.push() | new Map()、AC()、Map()、IC() | — | — |
| `CC — 内部函数` | L6810-L6983 | .keys()、.forEach()、.charAt()、.toUpperCase()、.slice()、.push()、.concat()、.parse()、.stringify()、.getSupportedConstraints()、.enumerateDevices()、.then()、.filter()、.find()、.some()、.toLowerCase()、.includes()、.webkitGetUserMedia()、.bind()、.getAudioTracks()、.getVideoTracks()、.getTracks()、.stop()、.reject() | new DOMException()、CC()、n()、t()、r()、RC()、toString()、o()、e()、DOMException() | — | enumerateDevices、Track lifecycle |
| `n — 内部函数` | L6859-L6914 | .parse()、.stringify()、.getSupportedConstraints()、.enumerateDevices()、.then()、.filter()、.find()、.some()、.toLowerCase()、.includes() | n()、t()、r()、RC() | — | enumerateDevices |
| `o — 内部函数` | L6917-L6943 | — | toString() | — | — |
| `bC — 源码命名函数` | L7001-L7004 | — | bC() | — | — |
| `kC — 源码命名函数` | L7009-L7073 | .defineProperty()、.removeEventListener()、.addEventListener()、.getReceivers()、.find()、.dispatchEvent()、.getTracks()、.forEach()、.apply() | new Event()、kC()、get()、set()、Event()、fC() | addEventListener('track')、addEventListener('addtrack')、addEventListener('addstream')、removeEventListener('track') | RTCPeerConnection |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L7030-L7070 | .addEventListener()、.getReceivers()、.find()、.dispatchEvent()、.getTracks()、.forEach()、.apply() | new Event()、Event() | addEventListener('addtrack')、addEventListener('addstream') | RTCPeerConnection |
| `DC — 源码命名函数` | L7079-L7196 | .createDTMFSender()、.slice()、.apply()、.push()、.indexOf()、.splice()、.getTracks()、.forEach()、.find()、.defineProperty() | DC()、dtmf()、t()、get() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、MediaStreamTrack |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7107-L7110 | .slice() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7115-L7121 | .apply()、.push() | t() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | L7126-L7132 | .apply()、.indexOf()、.splice() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L7138-L7146 | .apply()、.getTracks()、.forEach()、.push() | t() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7151-L7161 | .apply()、.getTracks()、.forEach()、.find()、.splice()、.indexOf() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7176-L7182 | .apply()、.forEach() | — | — | RTCPeerConnection |
| `wC — 源码命名函数` | L7202-L7267 | .apply()、.result()、.forEach()、.names()、.stat()、.keys()、.map()、.then() | new Map()、new Promise()、wC()、Map()、i()、o()、n()、Promise()、e() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | L7209-L7266 | .apply()、.result()、.forEach()、.names()、.stat()、.keys()、.map()、.then() | new Map()、new Promise()、Map()、i()、o()、n()、Promise()、e() | — | RTCPeerConnection |
| `o — 内部函数` | L7240-L7243 | .keys()、.map() | new Map()、Map() | — | — |
| `NC — 源码命名函数` | L7273-L7370 | .apply()、.forEach()、.getStats()、.then()、.getSenders()、.getReceivers()、.reject() | new DOMException()、NC()、AC()、fC()、DOMException() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、MediaStreamTrack |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7283-L7289 | .apply()、.forEach() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7295-L7301 | .apply() | — | — | RTCPeerConnection |
| `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | L7304-L7310 | .getStats()、.then() | AC() | — | RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.getReceivers — 获取 RTCRtpReceiver 列表` | L7319-L7325 | .apply()、.forEach() | — | — | RTCPeerConnection |
| `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | L7329-L7335 | .getStats()、.then() | AC() | — | RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | L7342-L7369 | .getSenders()、.forEach()、.getReceivers()、.reject()、.getStats()、.apply() | new DOMException()、DOMException() | — | RTCPeerConnection、MediaStreamTrack |
| `OC — 源码命名函数` | L7376-L7454 | .keys()、.map()、.apply()、.indexOf()、.push()、.getTracks()、.forEach()、.getSenders()、.find()、.filter()、.concat()、.splice() | new DOMException()、OC()、DOMException() | — | RTCPeerConnection、MediaStreamTrack |
| `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | L7379-L7385 | .keys()、.map() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7390-L7403 | .apply()、.indexOf()、.push() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L7408-L7422 | .getTracks()、.forEach()、.getSenders()、.find()、.apply()、.filter()、.indexOf()、.concat() | new DOMException()、DOMException() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7427-L7434 | .apply() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | L7439-L7453 | .keys()、.forEach()、.indexOf()、.splice()、.apply() | — | — | RTCPeerConnection |
| `PC — 源码命名函数` | L7460-L7651 | .apply()、.map()、.getTracks()、.forEach()、.getSenders()、.find()、.MediaStream()、.keys()、.replace()、.call()、.addTrack()、.resolve()、.then()、.dispatchEvent()、.addStream()、.getOwnPropertyDescriptor()、.defineProperty()、.removeStream()、.removeTrack() | new DOMException()、new RegExp()、new RTCSessionDescription()、new Event()、PC()、OC()、DOMException()、o()、RegExp()、RTCSessionDescription()、Event()、get() | — | RTCPeerConnection、RTCSessionDescription、RTCRtpSender/Receiver/Transceiver、MediaStream、MediaStreamTrack |
| `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | L7468-L7474 | .apply()、.map() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L7479-L7497 | .getTracks()、.forEach()、.getSenders()、.find()、.MediaStream()、.apply() | new DOMException()、DOMException() | — | RTCPeerConnection、MediaStream |
| `o — 内部函数` | L7502-L7517 | .keys()、.forEach()、.replace() | new RegExp()、new RTCSessionDescription()、o()、RegExp()、RTCSessionDescription() | — | RTCSessionDescription |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7520-L7527 | .apply() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7530-L7560 | .call()、.getTracks()、.find()、.getSenders()、.addTrack()、.resolve()、.then()、.dispatchEvent()、.MediaStream()、.addStream() | new DOMException()、new Event()、DOMException()、Event() | — | RTCPeerConnection、MediaStream |
| `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | L7594-L7615 | .keys()、.forEach()、.replace()、.apply() | new RegExp()、new RTCSessionDescription()、RegExp()、RTCSessionDescription() | — | RTCPeerConnection、RTCSessionDescription |
| `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | L7629-L7650 | .keys()、.forEach()、.getTracks()、.find()、.removeStream()、.removeTrack()、.dispatchEvent() | new DOMException()、new Event()、DOMException()、Event() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver |
| `MC — 源码命名函数` | L7656-L7678 | .forEach()、.apply() | MC() | — | RTCPeerConnection、RTCSessionDescription、RTCIceCandidate |
| `LC — 源码命名函数` | L7683-L7695 | .getConfiguration() | LC()、fC() | — | — |
| `shimGetDisplayMedia — 内部函数` | L7710-L7735 | .then()、.getUserMedia()、.error() | t() | — | getUserMedia |
| `VC — 源码命名函数` | L7742-L7807 | .getUserMedia()、.then()、.getSupportedConstraints()、.bind()、.parse()、.stringify()、.apply() | VC()、vC()、e()、t() | — | getUserMedia、MediaStreamTrack |
| `r.prototype.getSettings — 原型方法` | L7780-L7786 | .apply() | e() | — | — |
| `r.prototype.applyConstraints — 原型方法` | L7794-L7804 | .parse()、.stringify()、.apply() | e() | — | — |
| `UC — 源码命名函数` | L7811-L7823 | .defineProperty() | UC()、get() | — | — |
| `FC — 源码命名函数` | L7828-L7891 | .forEach()、.apply()、.then()、.set()、.assign() | FC() | — | RTCPeerConnection、RTCSessionDescription、RTCIceCandidate |
| `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | L7861-L7890 | .apply()、.then()、.forEach()、.set()、.assign() | — | — | RTCPeerConnection |
| `BC — 源码命名函数` | L7896-L7930 | .apply()、.forEach()、.getStats()、.resolve() | new Map()、BC()、Map() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、MediaStreamTrack |
| `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | L7905-L7911 | .apply()、.forEach() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L7917-L7923 | .apply() | — | — | RTCPeerConnection |
| `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | L7926-L7929 | .getStats()、.resolve() | new Map()、Map() | — | RTCRtpSender/Receiver/Transceiver |
| `HC — 源码命名函数` | L7934-L7957 | .apply()、.forEach()、.getStats() | HC()、fC() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.getReceivers — 获取 RTCRtpReceiver 列表` | L7943-L7949 | .apply()、.forEach() | — | — | RTCPeerConnection |
| `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | L7953-L7956 | .getStats() | — | — | RTCRtpSender/Receiver/Transceiver |
| `WC — 源码命名函数` | L7961-L7975 | .getSenders()、.forEach()、.getTracks()、.includes()、.removeTrack() | WC()、vC() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L7967-L7974 | .getSenders()、.forEach()、.getTracks()、.includes()、.removeTrack() | vC() | — | RTCPeerConnection |
| `GC — 源码命名函数` | L7980-L7983 | — | GC() | — | RTCDataChannel |
| `jC — 内部函数` | L7986-L8040 | .forEach()、.test()、.apply()、.getParameters()、.keys()、.push()、.setParameters()、.then()、.catch() | new TypeError()、new RangeError()、jC()、TypeError()、parseFloat()、RangeError() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver |
| `RTCPeerConnection.prototype.addTransceiver — 添加 RTCRtpTransceiver` | L7994-L8039 | .forEach()、.test()、.apply()、.getParameters()、.keys()、.push()、.setParameters()、.then()、.catch() | new TypeError()、new RangeError()、TypeError()、parseFloat()、RangeError() | — | RTCPeerConnection |
| `JC — 源码命名函数` | L8045-L8060 | .apply()、.concat() | JC() | — | RTCRtpSender/Receiver/Transceiver |
| `RTCRtpSender.prototype.getParameters — 原型方法` | L8053-L8059 | .apply()、.concat() | — | — | RTCRtpSender/Receiver/Transceiver |
| `qC — 内部函数` | L8063-L8081 | .all()、.then()、.apply()、.finally() | qC() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L8070-L8080 | .all()、.then()、.apply()、.finally() | — | — | RTCPeerConnection |
| `zC — 内部函数` | L8084-L8102 | .all()、.then()、.apply()、.finally() | zC() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.createAnswer — 创建 SDP Answer` | L8091-L8101 | .all()、.then()、.apply()、.finally() | — | — | RTCPeerConnection |
| `shimGetDisplayMedia — 内部函数` | L8118-L8137 | .reject()、.getUserMedia() | new DOMException()、DOMException() | — | getUserMedia |
| `YC — 源码命名函数` | L8144-L8204 | .includes()、.push()、.getAudioTracks()、.forEach()、.call()、.getVideoTracks()、.apply()、.indexOf()、.splice()、.getTracks()、.getSenders()、.removeTrack() | YC() | — | RTCPeerConnection、MediaStreamTrack |
| `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | L8152-L8155 | — | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | L8163-L8169 | .includes()、.push()、.getAudioTracks()、.forEach()、.call()、.getVideoTracks() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | L8172-L8184 | .forEach()、.includes()、.push()、.apply() | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | L8189-L8202 | .indexOf()、.splice()、.getTracks()、.getSenders()、.forEach()、.includes()、.removeTrack() | — | — | RTCPeerConnection |
| `XC — 源码命名函数` | L8209-L8280 | .defineProperty()、.removeEventListener()、.addEventListener()、.forEach()、.includes()、.push()、.dispatchEvent()、.indexOf()、.apply() | new Event()、XC()、get()、set()、Event() | addEventListener('addstream')、addEventListener('track')、removeEventListener('addstream')、removeEventListener('track') | RTCPeerConnection |
| `RTCPeerConnection.prototype.getRemoteStreams — 原型方法` | L8217-L8220 | — | — | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L8255-L8278 | .addEventListener()、.forEach()、.indexOf()、.push()、.dispatchEvent()、.apply() | new Event()、Event() | addEventListener('track') | RTCPeerConnection |
| `QC — 源码命名函数` | L8286-L8337 | .apply()、.then()、.resolve() | QC() | — | RTCPeerConnection |
| `ZC — 源码命名函数` | L8342-L8360 | .bind()、.getUserMedia()、.then() | ZC()、i()、$C() | — | getUserMedia |
| `$C — 源码命名函数` | L8361-L8364 | .assign() | $C()、SC() | — | — |
| `eb — 源码命名函数` | L8369-L8400 | .parse()、.stringify()、.push()、.defineProperty() | new t()、eb()、vC()、t() | — | RTCPeerConnection |
| `tb — 内部函数` | L8403-L8415 | .defineProperty() | tb()、get() | — | — |
| `ib — 内部函数` | L8418-L8452 | .getTransceivers()、.find()、.setDirection()、.addTransceiver()、.apply() | ib()、Boolean() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L8424-L8451 | .getTransceivers()、.find()、.setDirection()、.addTransceiver()、.apply() | Boolean() | — | RTCPeerConnection |
| `rb — 内部函数` | L8455-L8458 | — | rb() | — | AudioContext |
| `generateIdentifier — 内部函数` | L8477-L8481 | .random()、.toString()、.substring() | — | — | — |
| `lb — 内部函数` | L9095-L9141 | .indexOf()、.parse()、.stringify()、.substring()、.parseCandidate()、.defineProperty()、.RTCIceCandidate() | new t()、lb()、t()、fC() | — | RTCIceCandidate |
| `db — 内部函数` | L9144-L9159 | .parseCandidate() | db()、fC() | — | RTCIceCandidate |
| `ub — 内部函数` | L9162-L9271 | .defineProperty()、.getConfiguration()、.splitSections()、.shift()、.some()、.parseMLine()、.indexOf()、.match()、.matchPrefix()、.substring()、.max()、.min()、.apply() | ub()、get()、parseInt() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L9176-L9270 | .getConfiguration()、.defineProperty()、.splitSections()、.shift()、.some()、.parseMLine()、.indexOf()、.match()、.matchPrefix()、.substring()、.max()、.min()、.apply() | get()、parseInt() | — | RTCPeerConnection |
| `i — 内部函数` | L9224-L9243 | — | — | — | — |
| `r — 内部函数` | L9246-L9260 | .matchPrefix()、.substring() | parseInt() | — | — |
| `hb — 内部函数` | L9274-L9306 | .apply() | new TypeError()、hb()、t()、TypeError()、fC() | — | RTCPeerConnection、RTCDataChannel |
| `t — 内部函数` | L9279-L9293 | .apply() | new TypeError()、t()、TypeError() | — | — |
| `RTCPeerConnection.prototype.createDataChannel — 创建 RTCDataChannel 数据通道` | L9298-L9304 | .apply() | t() | — | RTCPeerConnection |
| `pb — 源码命名函数` | L9312-L9367 | .defineProperty()、.removeEventListener()、.addEventListener()、.forEach()、.dispatchEvent()、.apply() | new Event()、pb()、get()、set()、Event() | addEventListener('connectionstatechange')、addEventListener('iceconnectionstatechange')、removeEventListener('connectionstatechange') | RTCPeerConnection |
| `mb — 内部函数` | L9370-L9395 | .indexOf()、.split()、.filter()、.trim()、.join()、.RTCSessionDescription()、.apply() | mb() | — | RTCPeerConnection、RTCSessionDescription |
| `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | L9379-L9394 | .indexOf()、.split()、.filter()、.trim()、.join()、.RTCSessionDescription()、.apply() | — | — | RTCPeerConnection、RTCSessionDescription |
| `_b — 内部函数` | L9398-L9419 | .resolve()、.apply() | _b() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.addIceCandidate — 添加 ICE 候选地址` | L9407-L9418 | .resolve()、.apply() | — | — | RTCPeerConnection |
| `fb — 内部函数` | L9422-L9451 | .apply()、.then() | fb() | — | RTCPeerConnection |
| `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | L9431-L9450 | .apply()、.then() | — | — | RTCPeerConnection |
## SDP 与配置（L9451-L11499）
详见：`02-RTCPeerConnection-usage-analysis.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `r — 内部函数` | L9469-L9489 | .match() | _C()、Chrom() | — | RTCPeerConnection、RTCRtpSender/Receiver/Transceiver、Navigator/UA |
| `setConditionalProp — 内部函数` | L9578-L9578 | — | defineProp() | — | — |
| `objectMixin — 内部函数` | L9581-L9587 | .call() | setConditionalProp()、getOwnPropSymbols() | — | — |
| `assignDescriptors — 内部函数` | L9590-L9601 | .call()、.indexOf() | defineProps()、getDescriptors()、getOwnPropSymbols() | — | — |
| `omitKeys — 内部函数` | L9593-L9601 | .call()、.indexOf() | getOwnPropSymbols() | — | — |
| `defineModule — 内部函数` | L9604-L9604 | — | e() | — | — |
| `defineExports — 内部函数` | L9607-L9610 | — | defineProp() | — | — |
| `importDefault — 内部函数` | L9613-L9614 | — | objectCreate()、getPrototypeOf() | — | — |
| `applyDecorators — 源码命名函数` | L9629-L9635 | — | getDescriptor()、n()、defineProp() | — | — |
| `defineMember — 内部函数` | L9638-L9638 | — | setConditionalProp() | — | — |
| `getModuleExport — 内部函数` | L9641-L9672 | .next()、.throw()、.resolve()、.then()、.apply() | new Promise()、reflectGet()、getPrototypeOf()、Promise()、a()、n()、r() | — | — |
| `asyncGeneratorWrap — 内部函数` | L9644-L9672 | .next()、.throw()、.resolve()、.then()、.apply() | new Promise()、Promise()、a()、n()、r() | — | — |
| `o — 源码命名函数` | L9647-L9657 | .next() | a()、n() | — | — |
| `s — 源码命名函数` | L9658-L9668 | .throw() | a()、n() | — | — |
| `n — 内部函数` | L9680-L9680 | — | n() | — | — |
| `o — 内部函数` | L9683-L9686 | — | o() | 事件属性(once) | — |
| `s — 内部函数` | L9689-L9707 | .push() | new TypeError()、new o()、s()、TypeError()、o() | — | — |
| `a — 内部函数` | L9710-L9713 | — | new n()、a()、n() | — | — |
| `c — 内部函数` | L9716-L9719 | — | new n()、c()、n() | — | — |
| `c.prototype.eventNames — 原型方法` | L9723-L9733 | .call()、.push()、.slice()、.concat()、.getOwnPropertySymbols() | — | — | — |
| `c.prototype.listeners — 原型方法` | L9736-L9746 | — | new Array()、Array() | — | — |
| `c.prototype.listenerCount — 原型方法` | L9749-L9756 | — | — | — | — |
| `c.prototype.emit — 原型方法` | L9759-L9816 | .removeListener()、.call()、.apply() | new Array()、Array() | — | — |
| `c.prototype.on — 原型方法` | L9819-L9822 | — | s() | — | — |
| `c.prototype.once — 原型方法` | L9825-L9828 | — | s() | 事件属性(once) | — |
| `c.prototype.removeListener — 原型方法` | L9831-L9848 | .push() | a() | — | — |
| `c.prototype.removeAllListeners — 原型方法` | L9851-L9862 | — | new n()、a()、n() | — | — |
| `format — 内部函数` | L9910-L9913 | — | — | — | — |
| `format — 内部函数` | L9923-L9926 | — | — | — | — |
| `format — 内部函数` | L9940-L9943 | — | — | — | — |
| `format — 内部函数` | L9951-L9960 | — | — | — | — |
| `format — 内部函数` | L9969-L9972 | — | — | — | Crypto/random |
| `format — 内部函数` | L10010-L10022 | — | — | — | — |
| `format — 内部函数` | L10033-L10039 | — | — | — | — |
| `format — 内部函数` | L10062-L10065 | — | — | — | — |
| `format — 内部函数` | L10074-L10077 | — | — | — | — |
| `format — 内部函数` | L10087-L10090 | — | — | — | — |
| `format — 内部函数` | L10098-L10101 | — | — | — | — |
| `format — 内部函数` | L10121-L10124 | — | — | — | — |
| `format — 内部函数` | L10132-L10143 | — | — | — | — |
| `i — 内部函数` | L10176-L10189 | .match()、.push() | t() | — | — |
| `n — 内部函数` | L10281-L10305 | .replace() | String()、Number() | — | — |
| `o — 内部函数` | L10308-L10322 | .push()、.apply() | — | — | — |
| `format — 内部函数` | L10429-L10432 | — | — | — | — |
| `format — 内部函数` | L10442-L10445 | — | — | — | — |
| `format — 内部函数` | L10459-L10462 | — | — | — | — |
| `format — 内部函数` | L10470-L10479 | — | — | — | — |
| `format — 内部函数` | L10488-L10491 | — | — | — | Crypto/random |
| `format — 内部函数` | L10529-L10541 | — | — | — | — |
| `format — 内部函数` | L10552-L10558 | — | — | — | — |
| `format — 内部函数` | L10581-L10584 | — | — | — | — |
| `format — 内部函数` | L10593-L10596 | — | — | — | — |
| `format — 内部函数` | L10606-L10609 | — | — | — | — |
| `format — 内部函数` | L10617-L10620 | — | — | — | — |
| `format — 内部函数` | L10640-L10643 | — | — | — | — |
| `format — 内部函数` | L10651-L10662 | — | — | — | — |
| `i — 内部函数` | L10695-L10708 | .match()、.push() | t() | — | — |
| `n — 内部函数` | L10796-L10820 | .replace() | String()、Number() | — | — |
| `o — 内部函数` | L10823-L10837 | .push()、.apply() | — | — | — |
| `构造函数` | L10957-L10989 | .concat()、.toString()、.includes() | constructor()、super()、defineMember() | — | — |
| `getCode — 方法` | L10992-L10995 | — | getCode() | — | — |
| `getExtraCode — 方法` | L10998-L11001 | — | getExtraCode() | — | — |
| `toString — function toString() { [native code] }` | L11004-L11007 | — | toString() | — | — |
| `setTimeOffset — 内部函数` | L11014-L11022 | .setTime()、.getTime()、.concat() | new Date()、Date() | — | — |
| `getTimeOffset — 内部函数` | L11025-L11028 | — | — | — | — |
| `getServerTime — 内部函数` | L11031-L11034 | .now() | — | — | — |
| `getServerTimeStr — 内部函数` | L11037-L11043 | .setTime()、.toLocaleString() | new Date()、Date()、getServerTime() | — | — |
| `formatTimeMs — 内部函数` | L11046-L11055 | .getMilliseconds()、.toString()、.padStart()、.concat()、.toTimeString()、.replace() | String() | — | — |
| `setSdkVersion — 设置 SDK 版本号` | L11231-L11242 | .split()、.map()、.concat()、.min()、.toString()、.padStart() | setSdkVersion()、parseInt() | — | — |
| `getScriptDir — 内部函数` | L11249-L11255 | .substring()、.lastIndexOf() | — | — | — |
| `roomMode — 房间模式` | L11367-L11367 | — | — | — | — |
| `setRetryCount — 设置重试次数` | L11401-L11404 | — | setRetryCount() | — | — |
| `getRetryCount — 获取重试次数` | L11407-L11410 | — | getRetryCount() | — | — |
## 二进制与公共工具（L11500-L13050）
详见：`10-Auxiliary-Browser-APIs.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `createAsyncGeneratorRunner — 内部函数` | L11501-L11548 | .next()、.throw()、.then()、.apply() | new i()、resolveStep()、handleStepResult()、o()、throwStep()、n()、i()、t()、c() | — | — |
| `resolveStep — 内部函数` | L11506-L11516 | .next() | resolveStep()、handleStepResult()、o() | — | — |
| `throwStep — 内部函数` | L11519-L11529 | .throw() | throwStep()、handleStepResult()、o() | — | — |
| `handleStepResult — 内部函数` | L11532-L11545 | .then() | new i()、handleStepResult()、n()、i()、t() | — | — |
| `构造函数` | L11561-L11564 | .next() | constructor() | — | — |
| `setG — 设置标志位` | L11567-L11570 | .demand()、.next() | setG() | — | — |
| `consume — 消费/读取指定字节数` | L11573-L11580 | .copyWithin()、.subarray() | consume() | — | — |
| `demand — 请求读取指定字节数（不足时返回 null）` | L11583-L11586 | .consume()、.flush() | demand() | — | — |
| `read — 从缓冲区读取字节序列` | L11589-L11608 | .demand()、.call() | new Promise()、read()、createAsyncGeneratorRunner()、Promise()、t() | — | — |
| `readU32 — 读取 32 位无符号整数（大端序）` | L11611-L11614 | .read() | readU32() | — | — |
| `readU16 — 读取 16 位无符号整数（大端序）` | L11617-L11620 | .read() | readU16() | — | — |
| `readU8 — 读取 8 位无符号整数` | L11623-L11626 | .read() | readU8() | — | — |
| `close — 关闭本地流并释放所有轨道` | L11629-L11637 | .return()、.subarray()、.call() | new Error()、close()、Error() | — | — |
| `flush — 刷新缓冲区（写入/清理缓存数据）` | L11640-L11690 | .subarray()、.set()、.throw()、.demand()、.next()、.resolve() | new Uint8Array()、new Error()、flush()、r()、Uint8Array()、Error() | — | Encoding/binary |
| `e — 内部函数` | L11658-L11666 | — | r() | — | — |
| `e — 内部函数` | L11665-L11671 | — | r() | — | — |
| `write — 向缓冲区写入字节序列` | L11693-L11705 | .malloc()、.set()、.flush() | new Uint8Array()、new Promise()、write()、Uint8Array()、Promise() | — | Encoding/binary |
| `writeU32 — 写入 32 位无符号整数（大端序）` | L11708-L11711 | .malloc()、.set()、.flush() | writeU32() | — | — |
| `writeU16 — 写入 16 位无符号整数（大端序）` | L11714-L11717 | .malloc()、.set()、.flush() | writeU16() | — | — |
| `writeU8 — 写入 8 位无符号整数` | L11720-L11723 | .malloc()、.flush() | writeU8() | — | — |
| `malloc — 分配指定大小的内存空间` | L11726-L11746 | .set()、.subarray() | new Uint8Array()、malloc()、Uint8Array() | — | Encoding/binary |
| `encodeVarint — 内部函数` | L11754-L11761 | .malloc() | new StateMachine()、new Uint8Array()、encodeVarint()、StateMachine()、Uint8Array() | — | Encoding/binary |
| `$D — 源码命名函数` | L11762-L11814 | .malloc()、.write()、.encode()、.isArray() | new StateMachine()、new TextEncoder()、new Uint8Array()、$D()、StateMachine()、encodeVarint()、TextEncoder()、Uint8Array() | — | Encoding/binary |
| `构造函数` | L11824-L11827 | — | constructor()、defineMember() | — | — |
| `writeInt32 — 写入 32 位有符号整数` | L11838-L11844 | .push() | writeInt32() | — | — |
| `writeInt16 — 写入 16 位有符号整数` | L11847-L11850 | .push() | writeInt16() | — | — |
| `writeByte — 写入单字节` | L11853-L11856 | .push() | writeByte() | — | — |
| `writeBytes — 写入多字节序列` | L11859-L11862 | .push() | writeBytes() | — | — |
| `writeUint32BE — 内部函数` | L11867-L11870 | — | writeUint32BE() | — | — |
| `readUint32BE — 内部函数` | L11873-L11876 | — | readUint32BE() | — | — |
| `readUint8 — 内部函数` | L11879-L11882 | — | readUint8() | — | — |
| `decodeUtf8String — 内部函数` | L11885-L11893 | .decode()、.slice() | new TextDecoder()、decodeUtf8String()、TextDecoder() | — | Encoding/binary |
| `decodeTransportData — 内部函数` | L11902-L12037 | .writeInt32()、.writeByte()、.encode()、.writeBytes()、.writeInt16()、.floor()、.random() | new TransportCarrier()、new Uint8Array()、new TextEncoder()、decodeTransportData()、TransportCarrier()、Uint8Array()、TextEncoder()、isString()、uw() | — | Encoding/binary |
| `r — 内部函数` | L11907-L11939 | — | new Uint8Array()、Uint8Array() | — | Encoding/binary |
| `r — 内部函数` | L11995-L12013 | .floor()、.random() | new Uint8Array()、Uint8Array()、uw() | — | Encoding/binary |
| `xorEncryptBlock — 内部函数` | L12040-L12063 | — | xorEncryptBlock()、readUint32BE()、writeUint32BE() | — | — |
| `buildLoggerUrl — 构建日志上报 URL` | L12071-L12084 | .floor()、.random()、.concat() | isSecondsTimestamp()、mathPow() | — | — |
| `getNetworkType — 检测当前网络类型（wifi/4g/3g/ethernet 等）` | L12089-L12108 | .addEventListener()、.match()、.toLowerCase()、.replace() | getNetworkType()、mapToNetworkType() | addEventListener('typechange') | Navigator/UA |
| `netType — 内部函数` | L12100-L12114 | .match()、.toLowerCase()、.replace()、.warn() | mapToNetworkType()、onNetworkTypeChange()、getNetworkType() | — | — |
| `onNetworkTypeChange — 网络类型变化的回调处理` | L12111-L12114 | .warn() | onNetworkTypeChange()、getNetworkType() | — | — |
| `mapToNetworkType — 将原始网络类型值映射到标准网络类型` | L12118-L12131 | — | mapToNetworkType() | — | — |
| `setNetworkTypeFromWebRTC — 从 WebRTC 连接信息设置网络类型` | L12134-L12137 | — | setNetworkTypeFromWebRTC()、mapToNetworkType() | — | — |
| `getNumNetworkType — 内部函数` | L12140-L12143 | — | getNumNetworkType()、getNetworkType() | — | — |
| `copyProperties — 内部函数` | L12146-L12157 | .ownKeys()、.getOwnPropertyDescriptor()、.defineProperty() | copyProperties() | — | — |
| `bytes2ms — 内部函数` | L12160-L12163 | — | bytes2ms()、samples2ms() | — | — |
| `samples2ms — 内部函数` | L12166-L12169 | — | samples2ms() | — | — |
| `ms2bytes — 内部函数` | L12172-L12175 | — | ms2bytes()、ms2samples() | — | — |
| `ms2samples — 内部函数` | L12178-L12181 | — | ms2samples() | — | — |
| `isChinese — 内部函数` | L12184-L12190 | .substring() | — | — | — |
| `isPlainObject — 内部函数` | L12193-L12207 | .call()、.getPrototypeOf() | — | — | — |
| `fibonacci — 内部函数` | L12211-L12217 | — | fibonacci() | — | — |
| `getReconnectionTimeout — 根据重连尝试次数计算指数退避超时时间` | L12220-L12223 | — | getReconnectionTimeout()、fibonacci() | — | — |
| `getValueType — 内部函数` | L12226-L12231 | .apply()、.replace()、.toLowerCase() | getValueType()、s() | — | — |
| `promiseAny — 内部函数` | L12249-L12263 | .forEach()、.then()、.catch()、.push() | new Promise()、promiseAny()、Promise()、reject() | — | — |
| `performanceNow — 内部函数` | L12266-L12269 | .floor()、.now() | performanceNow() | — | Performance |
| `getInternalVersion — 源码命名函数` | L12271-L12281 | .match()、.split()、.concat()、.join() | padTwoDigits() | — | — |
| `isEmpty — 内部函数` | L12286-L12307 | .isArray()、.call() | isEmpty()、isPlainObject() | — | — |
| `getMuteStateFromFlag — 从标志位获取静音状态` | L12310-L12323 | — | getMuteStateFromFlag()、Boolean() | — | — |
| `getTurnServer — 获取 TURN 服务器` | L12326-L12340 | .startsWith()、.concat() | getTurnServer()、isUndefined() | — | — |
| `ipv4ToUint32 — 内部函数` | L12343-L12354 | .split() | ipv4ToUint32()、isString()、Number() | — | — |
| `deepClone — 内部函数` | L12376-L12406 | .forEach()、.keys() | deepClone()、isArray()、isObject() | — | — |
| `getViewListFromView — 源码命名函数` | L12407-L12421 | .getElementById()、.push() | isArray()、isString() | — | DOM |
| `formatedTime — 内部函数` | L12425-L12442 | .concat()、.getFullYear()、.getMonth()、.getDate()、.getHours()、.getMinutes()、.getSeconds() | new Date()、pad()、Date() | — | — |
| `stringify — 内部函数` | L12446-L12472 | .concat()、.map()、.join()、.stringify()、.keys()、.forEach()、.has()、.parse() | new Set()、stringify()、isArray()、isPlainObject()、Set() | — | — |
| `stringifyIncludeValue — 内部函数` | L12475-L12488 | .keys()、.forEach()、.push() | stringifyIncludeValue()、stringify() | — | — |
| `getStringByteLength — 内部函数` | L12491-L12494 | .replace() | getStringByteLength() | — | — |
| `isPortrait — 源码命名函数` | L12495-L12506 | .includes() | — | — | — |
| `loadImage — 源码命名函数` | L12507-L12524 | .concat() | new Promise()、new Image()、new RtcErrorAlias()、asyncGeneratorWrap()、Promise()、isString()、Image()、resolve()、reject()、RtcErrorAlias() | 事件属性(onload)、事件属性(onerror) | — |
| `asyncGeneratorWrap — 方法` | L12510-L12524 | .concat() | new Promise()、new Image()、new RtcErrorAlias()、asyncGeneratorWrap()、Promise()、isString()、Image()、resolve()、reject()、RtcErrorAlias() | 事件属性(onload)、事件属性(onerror) | — |
| `getUint32Version — 源码命名函数` | L12525-L12531 | .split() | Number() | — | — |
| `delay — 延迟执行` | L12544-L12552 | — | new Promise()、delay()、Promise()、setTimeout()、cancelFn() | — | Timers/scheduling |
| `throttlePromise — 内部函数` | L12555-L12566 | .apply()、.finally() | new Array()、throttlePromise()、Array() | — | — |
| `normalizeUrl — 内部函数` | L12569-L12572 | .replace() | normalizeUrl() | — | — |
| `getMediaStreamTrackInfo — 获取 MediaStreamTrack 的详细信息（类型、ID、状态等）` | L12575-L12609 | .call()、.concat()、.stringify()、.replaceAll() | getMediaStreamTrackInfo() | — | — |
| `calculateScaleResolutionDownNumber — 内部函数` | L12612-L12619 | .max() | calculateScaleResolutionDownNumber()、isPortrait() | — | — |
| `isRotate90Or270 — 内部函数` | L12622-L12625 | — | isRotate90Or270() | — | — |
| `loadVideo — 加载视频元素` | L12628-L12648 | .createElement()、.play()、.then() | new Promise()、loadVideo()、asyncGeneratorWrap()、Promise()、resolve()、reject() | 事件属性(onerror) | HTMLMediaElement、Media playback、DOM |
| `deepCloneBasic — 内部函数` | L12651-L12687 | .has()、.get()、.isArray()、.set()、.forEach()、.call()、.ownKeys() | new WeakMap()、deepCloneBasic()、WeakMap() | — | — |
| `buildSSOPackage — 内部函数` | L12697-L12736 | .floor()、.random()、.stringify() | buildSSOPackage()、isUndefined()、assignDescriptors()、objectMixin()、Number()、decodeTransportData()、$D() | — | — |
| `concatArrayBuffers — 内部函数` | L12739-L12745 | .set() | new Uint8Array()、concatArrayBuffers()、Uint8Array() | — | Encoding/binary |
| `getLast16Bits — 内部函数` | L12748-L12751 | — | getLast16Bits() | — | — |
| `getFirst16Bits — 内部函数` | L12754-L12757 | — | getFirst16Bits() | — | — |
| `parseBinaryPacketHeader — 内部函数` | L12760-L12871 | .slice()、.fill() | new Uint8Array()、parseBinaryPacketHeader()、readUint32BE()、readUint8()、decodeUtf8String()、Uint8Array()、parseBinaryLengthFields()、tryDecryptBinaryBlock() | — | Encoding/binary |
| `parseBinaryLengthFields — 内部函数` | L12874-L12902 | — | new Uint8Array()、parseBinaryLengthFields()、Uint8Array() | — | Encoding/binary |
| `r — 内部函数` | L12879-L12915 | .slice() | new Uint8Array()、Uint8Array()、tryDecryptBinaryBlock()、parseBinaryLengthFields() | — | Encoding/binary |
| `tryDecryptBinaryBlock — 内部函数` | L12905-L12915 | .slice() | new Uint8Array()、tryDecryptBinaryBlock()、Uint8Array()、parseBinaryLengthFields() | — | Encoding/binary |
| `sendHttpRequest — 内部函数` | L12920-L12961 | .then()、.clone()、.json()、.arrayBuffer()、.decode()、.parse()、.open()、.send() | new Promise()、new Uint8Array()、new XMLHttpRequest()、sendHttpRequest()、Promise()、fetch()、parseBinaryPacketHeader()、Uint8Array()、XMLHttpRequest()、resolve()、reject() | 事件属性(onreadystatechange) | Track lifecycle、fetch、XMLHttpRequest、Encoding/binary |
| `sendLogDataToServer — 内部函数` | L12964-L12994 | .stringify()、.stream()、.pipeThrough()、.blob()、.arrayBuffer()、.debug()、.concat() | new Blob()、new CompressionStream()、new Response()、sendLogDataToServer()、asyncGeneratorWrap()、performanceNow()、Blob()、CompressionStream()、yield()、Response() | — | Streams、URL/Blob |
| `isPlainObject — 内部函数` | L13002-L13016 | .call()、.getPrototypeOf() | — | — | — |
| `executor — 内部函数` | L13039-L13078 | .apply()、.call()、.setTimeout() | asyncGeneratorWrap()、resolve()、clearTimeout()、reject()、MN()、maxRetries()、executor()、baseTimeout()、doReject()、doRetry() | — | Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L13042-L13078 | .apply()、.call()、.setTimeout() | asyncGeneratorWrap()、resolve()、clearTimeout()、reject()、MN()、maxRetries()、executor()、baseTimeout()、doReject()、doRetry() | — | Timers/scheduling |
## 浏览器检测、日志与存储（L13051-L14290）
详见：`10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `doReject — 源码命名函数` | L13054-L13057 | — | clearTimeout()、reject() | — | Timers/scheduling |
| `doRetry — 内部函数` | L13060-L13074 | .call()、.setTimeout() | MN()、maxRetries()、executor()、baseTimeout()、doReject() | — | Timers/scheduling |
| `构造函数` | L13092-L13107 | — | constructor()、defineMember()、xN() | — | — |
| `getFullId — 获取日志器的完整 ID 标识` | L13110-L13117 | .concat() | getFullId() | — | — |
| `createChild — 创建子日志器（继承父日志器配置）` | L13120-L13133 | .bindParent() | new LocalStream()、createChild()、LocalStream()、LN() | — | — |
| `bindParent — 绑定父日志器` | L13136-L13145 | .getFullId()、.debug()、.concat() | bindParent() | — | — |
| `setUserId — 设置用户 ID（关联日志到用户）` | L13148-L13151 | — | setUserId() | — | — |
| `setSdkAppId — 设置 SDK App ID` | L13154-L13157 | — | setSdkAppId() | — | — |
| `log — 输出日志（自动判断日志级别）` | L13160-L13201 | .getFullId()、.unshift()、.concat()、.log()、.isArray()、.call() | log()、LN()、isPlainObject() | — | — |
| `info — 输出 INFO 级别日志` | L13204-L13208 | .log() | new Array()、info()、Array() | — | — |
| `debug — 输出 DEBUG 级别日志` | L13211-L13215 | .log() | new Array()、debug()、Array() | — | — |
| `warn — 输出 WARN 级别日志` | L13218-L13222 | .log() | new Array()、warn()、Array() | — | — |
| `error — 输出 ERROR 级别日志` | L13225-L13229 | .log() | new Array()、error()、Array() | — | — |
| `getVersionString — 源码命名函数` | L13334-L13345 | .concat()、.match() | new RegExp()、matchUA()、RegExp() | — | — |
| `getVersionNumber — 源码命名函数` | L13346-L13357 | .concat()、.match() | new RegExp()、matchUA()、RegExp()、parseFloat() | — | — |
| `androidVersion — 内部函数` | L13368-L13385 | .match()、.concat() | Android()、parseFloat() | — | — |
| `yO — 内部函数` | L13408-L13420 | .exec()、.test() | s()、parseFloat() | — | — |
| `getChromeVersion — 内部函数` | L13455-L13486 | .test()、.match()、.concat() | getVersionNumber()、matchUA()、getChromeVersion()、getVersionString()、OS()、_() | — | — |
| `osVersion — 内部函数` | L13469-L13486 | .match()、.concat() | OS()、_() | — | — |
| `isVersionLessThan — 内部函数` | L13490-L13505 | .split()、.map()、.max() | isVersionLessThan()、Number() | — | — |
| `isVersionGreaterThan — 内部函数` | L13508-L13524 | .split()、.map()、.max() | isVersionGreaterThan()、Number() | — | — |
| `isSafari13Or14 — 内部函数` | L13530-L13536 | .split() | Number() | — | — |
| `isLocalStorageAvailable — 检查 localStorage 是否可用` | L13543-L13562 | — | Boolean() | — | Storage |
| `detectBrowser — 检测浏览器类型和版本` | L13567-L13597 | .has()、.get() | new Map()、detectBrowser()、Map()、getVersionString() | — | — |
| `isMobile — 内部函数` | L13601-L13604 | — | isMobile() | — | — |
| `fetchUserAgentData — 内部函数` | L13608-L13644 | .getHighEntropyValues()、.concat()、.replace()、.filter()、.map()、.join() | fetchUserAgentData()、asyncGeneratorWrap() | — | Navigator/UA |
| `getGPUInfo — 内部函数` | L13647-L13672 | .createElement()、.getContext()、.getExtension()、.getParameter()、.concat() | getGPUInfo() | — | WebGL、DOM |
| `getDeviceModel — 内部函数` | L13675-L13678 | — | getDeviceModel()、getDeviceModelFromUA() | — | — |
| `getDeviceModelFromUA — 内部函数` | L13681-L13687 | .match()、.trim() | getDeviceModelFromUA() | — | — |
| `getOSName — 内部函数` | L13698-L13701 | .get() | — | — | — |
| `getOSNumber — 内部函数` | L13705-L13708 | — | getOSNumber() | — | — |
| `getBrowserCoreNumber — 内部函数` | L13711-L13714 | — | getBrowserCoreNumber() | — | — |
| `getOSString — 源码命名函数` | L13715-L13730 | .concat()、.split() | getOSName() | — | — |
| `getTerminalType — 内部函数` | L13734-L13737 | — | getTerminalType() | — | — |
| `getOSType — 内部函数` | L13740-L13743 | — | getOSType() | — | — |
| `构造函数` | L13825-L13842 | .on()、.emit() | constructor()、defineMember() | on('22')、on('266')、emit('266') | — |
| `handleUploadFailed — 处理日志上传失败` | L13845-L13848 | .emit() | handleUploadFailed() | emit('266') | — |
| `构造函数` | L13859-L13868 | .checkURLParam()、.installEvents() | new Map()、constructor()、defineMember()、Map() | — | — |
| `installEvents — 安装事件监听器` | L13875-L13899 | .on()、.addJoinedUser()、.startUpload()、.deleteJoinedUser() | installEvents() | on(Events.JOIN_SCHEDULE_SUCCESS)、on(Events.JOIN_START)、on(Events.LEAVE_SUCCESS) | — |
| `startUpload — 开始日志上传` | L13902-L13905 | .uploadInterval() | startUpload() | — | — |
| `addJoinedUser — 添加已加入用户到列表` | L13908-L13911 | .set()、.startUpload() | addJoinedUser() | — | — |
| `deleteJoinedUser — 删除已退出用户` | L13914-L13917 | .delete() | deleteJoinedUser() | — | — |
| `uploadInterval — 定时上传日志` | L13920-L13923 | .upload()、.catch()、.setTimeout()、.uploadInterval() | uploadInterval() | — | Timers/scheduling |
| `getLogsToUpload — 获取待上传的日志队列` | L13926-L13953 | .forEach()、.has()、.get()、.push()、.set()、.splice() | new Map()、getLogsToUpload()、Map()、isString()、isNumber() | — | — |
| `upload — 上传日志数据到服务器` | L13956-L13983 | .getLogsToUpload()、.values()、.map()、.join()、.stringify()、.uploadLogWithRetry()、.forEach()、.filter()、.concat() | upload()、asyncGeneratorWrap()、getServerTimeStr()、String()、buildSSOPackage() | — | Encoding/binary |
| `uploadLogWithRetry — 上传日志（带重试机制）` | L13986-L14002 | .then()、.handleUploadFailed()、.uploadLogWithRetry() | uploadLogWithRetry()、FN()、sendHttpRequest()、buildLoggerUrl()、t() | — | — |
| `getPrefix — 获取日志前缀字符串` | L14005-L14011 | .setTime()、.concat() | new Date()、getPrefix()、Date()、getServerTime()、formatTimeMs() | — | — |
| `getLogLevel — 获取当前日志级别` | L14014-L14017 | — | getLogLevel() | — | — |
| `setLogLevel — 设置日志级别` | L14020-L14023 | .info() | setLogLevel()、isUndefined() | — | — |
| `enableUploadLog — 方法` | L14026-L14029 | — | enableUploadLog() | — | — |
| `disableUploadLog — 方法` | L14032-L14035 | .warn() | disableUploadLog() | — | — |
| `logChunkToString — 日志块转字符串` | L14038-L14049 | .toString()、.stringify() | logChunkToString()、isString() | — | — |
| `addLogToQueue — 方法` | L14052-L14067 | .reduce()、.concat()、.logChunkToString()、.trim()、.emit()、.push() | addLogToQueue() | emit(Events.LOG) | — |
| `log — 输出日志（自动判断日志级别）` | L14070-L14088 | .unshift()、.getPrefix()、.addLogToQueue()、.toLowerCase() | log() | — | — |
| `debug — 输出 DEBUG 级别日志` | L14091-L14095 | .log() | new Array()、debug()、Array() | — | — |
| `info — 输出 INFO 级别日志` | L14098-L14102 | .log() | new Array()、info()、Array() | — | — |
| `warn — 输出 WARN 级别日志` | L14105-L14109 | .log() | new Array()、warn()、Array() | — | — |
| `error — 输出 ERROR 级别日志` | L14112-L14116 | .log() | new Array()、error()、Array() | — | — |
| `createLogger — 方法` | L14119-L14133 | .bindParent() | new LocalStream()、createLogger()、omitKeys()、LocalStream() | — | — |
| `checkURLParam — 方法` | L14136-L14142 | .get() | new URLSearchParams()、checkURLParam()、URLSearchParams()、Number() | — | URL/Blob |
| `getQueue — 获取队列` | L14145-L14148 | — | getQueue() | — | — |
| `generateUUID — 内部函数` | L14154-L14163 | .replace()、.random()、.toString() | — | — | — |
| `构造函数` | L14172-L14175 | — | new Map()、constructor()、defineMember()、Map() | — | — |
| `getRealKey — 获取真实键` | L14178-L14181 | .concat() | getRealKey() | — | — |
| `checkStorage — 检查存储状态` | L14184-L14209 | .bind()、.keys()、.filter()、.startsWith()、.getItem()、.parse()、.now()、.forEach()、.removeItem() | checkStorage()、isLocalStorageAvailable()、setInterval() | — | Storage、Timers/scheduling |
| `doFlush — 方法` | L14212-L14223 | .setItem()、.stringify()、.warn() | doFlush()、isLocalStorageAvailable() | — | Storage |
| `getItem — 获取缓存项` | L14226-L14243 | .getItem()、.getRealKey()、.parse()、.now()、.warn() | getItem()、isLocalStorageAvailable() | — | Storage |
| `setItem — 设置缓存项` | L14246-L14259 | .now()、.set()、.getRealKey()、.warn() | setItem()、isLocalStorageAvailable() | — | — |
| `deleteItem — 删除缓存项` | L14262-L14273 | .getRealKey()、.delete()、.removeItem()、.warn() | deleteItem()、isLocalStorageAvailable() | — | Storage |
| `clear — 清除所有数据` | L14276-L14287 | .clear()、.warn() | clear()、isLocalStorageAvailable() | — | Storage |
## 能力、事件与状态工具（L14291-L17428）
详见：`10-Auxiliary-Browser-APIs.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `frameWorkType — 内部函数` | L14411-L14411 | — | — | — | — |
| `connectionClosedReason — 连接关闭原因` | L14431-L14439 | — | — | — | — |
| `playerState — 播放器状态` | L14477-L14477 | — | — | — | — |
| `trackEvent — 轨道事件` | L14504-L14514 | — | — | — | — |
| `sceneNumber — 内部函数` | L14532-L14532 | — | — | — | — |
| `userRoleNumber — 内部函数` | L14535-L14535 | — | — | — | — |
| `userRole — 内部函数` | L14538-L14538 | — | — | — | — |
| `connectionState — 连接状态` | L14541-L14548 | — | — | — | — |
| `audioDecoderDowngradeState — 音频解码降级状态` | L14551-L14553 | — | — | — | — |
| `videoDecoderDowngradeState — 视频解码降级状态` | L14556-L14558 | — | — | — | — |
| `trackKind — 轨道类型（audio/video）` | L14561-L14561 | — | — | — | — |
| `trackAction — 轨道操作` | L14564-L14564 | — | — | — | — |
| `mediaType — 媒体类型` | L14567-L14574 | — | — | — | — |
| `audioType — 音频类型` | L14578-L14578 | — | — | — | — |
| `videoType — 视频类型` | L14581-L14581 | — | — | — | — |
| `streamType — 流类型（主流/辅流）` | L14584-L14584 | — | — | — | — |
| `remoteStreamType — 远端流类型` | L14587-L14587 | — | — | — | — |
| `multiVideoDataType — 多视频数据类型` | L14590-L14597 | — | — | — | — |
| `networkQualityValue — 内部函数` | L14644-L14653 | — | — | — | — |
| `receiveMode — 内部函数` | L14656-L14662 | — | — | — | — |
| `facingMode — 内部函数` | L14665-L14665 | — | — | — | — |
| `videoPlayerMode — 视频播放器模式` | L14668-L14673 | — | — | — | — |
| `audioPlayerMode — 音频播放器模式` | L14676-L14676 | — | — | — | — |
| `bannedReason — 内部函数` | L14679-L14685 | — | — | — | — |
| `denoiserMode — 内部函数` | L14700-L14700 | — | — | — | — |
| `构造函数` | L14709-L14712 | — | constructor()、defineMember() | — | — |
| `basicType — 内部函数` | L14748-L14755 | — | — | — | — |
| `videoCodec — 视频编码器类型` | L14758-L14758 | — | — | — | — |
| `videoCodecPipelineType — 视频编码管线类型` | L14761-L14767 | — | — | — | — |
| `audioCodecPipelineType — 音频编码管线类型` | L14770-L14776 | — | — | — | — |
| `codecType — 内部函数` | L14779-L14779 | — | — | — | WebAssembly |
| `videoContentHint — 视频内容提示` | L14796-L14796 | — | — | — | — |
| `timerType — 内部函数` | L14799-L14806 | — | — | — | — |
| `smallMode — 内部函数` | L14809-L14809 | — | — | — | — |
| `checkPermissionType — 内部函数` | L14812-L14818 | — | — | — | — |
| `deviceType — 内部函数` | L14821-L14821 | — | — | — | — |
| `alphaStitchingType — 内部函数` | L14824-L14826 | — | — | — | — |
| `INVALID_PARAMETER_REQUIRED — 方法` | L14958-L14967 | .concat() | INVALID_PARAMETER_REQUIRED() | — | — |
| `INVALID_PARAMETER_TYPE — 方法` | L14970-L14985 | .concat()、.isArray()、.join() | INVALID_PARAMETER_TYPE()、getValueType() | — | — |
| `INVALID_PARAMETER_EMPTY — 方法` | L14988-L14997 | .concat() | INVALID_PARAMETER_EMPTY() | — | — |
| `INVALID_PARAMETER_INSTANCE — 方法` | L15000-L15012 | .concat() | INVALID_PARAMETER_INSTANCE()、getValueType() | — | — |
| `INVALID_PARAMETER_RANGE — 方法` | L15015-L15025 | .concat()、.join() | INVALID_PARAMETER_RANGE() | — | — |
| `INVALID_PARAMETER_MIN — 方法` | L15028-L15037 | .concat() | INVALID_PARAMETER_MIN() | — | — |
| `INVALID_PARAMETER_MAX — 方法` | L15040-L15049 | .concat() | INVALID_PARAMETER_MAX() | — | — |
| `ERROR_MESSAGE — 方法` | L15056-L15062 | .concat() | ERROR_MESSAGE() | — | — |
| `JOIN_ROOM_FAILED — 加入房间失败事件处理` | L15083-L15089 | .concat() | JOIN_ROOM_FAILED() | — | — |
| `SUBSCRIBE_FAILED — 方法` | L15107-L15114 | .concat() | SUBSCRIBE_FAILED() | — | — |
| `CANNOT_LESS_THAN_ZERO — 方法` | L15166-L15172 | .concat() | CANNOT_LESS_THAN_ZERO() | — | — |
| `CATCH_HANDLER_ERROR — 方法` | L15223-L15231 | .concat() | CATCH_HANDLER_ERROR() | on('") | — |
| `API_NOT_EXIST — 方法` | L15234-L15240 | .concat() | API_NOT_EXIST() | — | — |
| `CLIENT_DESTROYED — 方法` | L15246-L15252 | .concat() | CLIENT_DESTROYED() | — | — |
| `API_CALL_ABORTED — 方法` | L15270-L15284 | .includes()、.concat() | API_CALL_ABORTED() | — | — |
| `rL — 内部函数` | L15291-L15315 | .concat()、.getItem()、.parse()、.createElement()、.appendChild()、.removeChild() | — | — | Storage、DOM |
| `nL — 内部函数` | L15295-L15315 | .getItem()、.parse()、.createElement()、.appendChild()、.removeChild() | — | — | Storage、DOM |
| `logConfig — 内部函数` | L15319-L15343 | .concat() | logConfig()、isFunction()、isString()、nL()、isChinese()、rL() | — | — |
| `构造函数` | L15354-L15382 | .createLogger()、.on()、.addSuccessEvent()、.addFailedEvent()、.info()、.concat() | new Map()、constructor()、defineMember()、Map() | on('102')、on('103')、on('266') | — |
| `getReportData — 获取上报数据` | L15385-L15425 | .entries()、.map()、.clear() | getReportData()、getUint32Version() | — | — |
| `clear — 清除所有数据` | L15428-L15431 | .clear() | clear() | — | — |
| `isEnumKey — 方法` | L15434-L15440 | .slice() | isEnumKey()、Number()、String() | — | — |
| `isErrorCodeKey — 方法` | L15443-L15449 | .slice() | isErrorCodeKey()、Number()、String() | — | — |
| `isCountKey — 方法` | L15452-L15458 | .slice() | isCountKey()、Number()、String() | — | — |
| `isNumberKey — 方法` | L15461-L15467 | .slice() | isNumberKey()、Number()、String() | — | — |
| `addCount — 递增计数` | L15470-L15477 | .isCountKey()、.has()、.set()、.get()、.debug()、.concat() | addCount() | — | — |
| `addEnum — 方法` | L15480-L15492 | .isEnumKey()、.debug()、.concat()、.has()、.set()、.get() | new Map()、addEnum()、Map() | — | — |
| `addNumber — 增加数值` | L15495-L15516 | .isNumberKey()、.debug()、.concat()、.has()、.set()、.get()、.floor() | new Map()、addNumber()、Map()、isNumber() | — | — |
| `addSuccessEvent — 添加成功事件` | L15519-L15531 | .addEnum()、.slice()、.addNumber()、.debug()、.concat() | addSuccessEvent()、Number()、String() | — | — |
| `addFailedEvent — 添加失败事件` | L15534-L15544 | .addEnum()、.abs() | addFailedEvent()、isNumber()、isUndefined() | — | — |
| `lL — 内部函数` | L15548-L15572 | — | — | — | — |
| `dL — 内部函数` | L15575-L15589 | — | — | — | — |
| `uL — 内部函数` | L15592-L15606 | — | — | — | — |
| `hL — 内部函数` | L15609-L15623 | — | — | — | — |
| `getBrowserInfo — 内部函数` | L15701-L15707 | .get() | getBrowserInfo() | — | — |
| `isWebCodecsApiAvailable — 内部函数` | L15714-L15717 | .every() | — | — | WebCodecs |
| `isMediaDevicesSupported — 内部函数` | L15720-L15727 | .error()、.filter() | warnHttpNotSupported() | — | — |
| `warnHttpNotSupported — 内部函数` | L15732-L15735 | .error() | warnHttpNotSupported()、logConfig() | — | — |
| `isTrackGeneratorSupported — 内部函数` | L15746-L15749 | — | — | — | — |
| `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | L15752-L15793 | .createElement()、.getContext()、.captureStream()、.addTrack()、.getVideoTracks()、.createOffer()、.toLowerCase()、.indexOf()、.close() | new RTCPeerConnection()、asyncGeneratorWrap()、RTCPeerConnection() | — | RTCPeerConnection、Canvas 2D、DOM |
| `detectDecodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的解码格式` | L15796-L15831 | .addTransceiver()、.createOffer()、.toLowerCase()、.indexOf()、.close() | new RTCPeerConnection()、asyncGeneratorWrap()、RTCPeerConnection()、hasAddTransceiver() | — | RTCPeerConnection |
| `asyncGeneratorWrap — 方法` | L15834-L16207 | .now()、.assign()、.createElement()、.getContext()、.concat()、.fillRect()、.fillText()、.all()、.map()、.configure()、.encode()、.close()、.flush()、.warn()、.decode()、.forEach()、.error()、.addNumber()、.stringify()、.floor()、.random()、.getTracks()、.stop()、.captureStream()、.addEventListener()、.addIceCandidate()、.addTrack()、.getVideoTracks()、.createOffer()、.setLocalDescription()、.setRemoteDescription()、.createAnswer()、.parse()、.findIndex()、.filter()、.write()、.getSenders()、.getStats()、.getReceivers()、.then() | new Promise()、new VideoEncoder()、new VideoFrame()、new VideoDecoder()、new RTCPeerConnection()、asyncGeneratorWrap()、checkWebRTCSupport()、isMediaDevicesSupported()、isWebCodecsApiAvailable()、isScreenShareSupported()、isSmallStreamSupported()、yield()、Promise()、e()、clearTimeout()、setTimeout()、o()、VideoEncoder()、t()、a()、VideoFrame()、n()、VideoDecoder()、i()、stringifyIncludeValue()、saveCapabilityResult()、isBrowserNotUnsupported()、detectEncodeByPeerConnection()、detectDecodeByPeerConnection()、setInterval()、clearInterval()、RTCPeerConnection() | addEventListener('icecandidate') | RTCPeerConnection、Track lifecycle、Canvas 2D、WebCodecs、Navigator/UA、DOM、Timers/scheduling |
| `yield — 方法` | L15854-L16024 | .createElement()、.getContext()、.concat()、.fillRect()、.fillText()、.all()、.map()、.configure()、.encode()、.close()、.flush()、.warn()、.decode()、.forEach() | new Promise()、new VideoEncoder()、new VideoFrame()、new VideoDecoder()、yield()、asyncGeneratorWrap()、Promise()、isWebCodecsApiAvailable()、e()、clearTimeout()、setTimeout()、o()、VideoEncoder()、t()、a()、VideoFrame()、n()、VideoDecoder()、i() | — | Canvas 2D、WebCodecs、DOM、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L15863-L16019 | .createElement()、.getContext()、.concat()、.fillRect()、.fillText()、.all()、.map()、.configure()、.encode()、.close()、.flush()、.warn()、.decode()、.forEach() | new Promise()、new VideoEncoder()、new VideoFrame()、new VideoDecoder()、asyncGeneratorWrap()、isWebCodecsApiAvailable()、e()、clearTimeout()、setTimeout()、o()、Promise()、VideoEncoder()、t()、a()、VideoFrame()、n()、VideoDecoder()、i() | — | Canvas 2D、WebCodecs、DOM、Timers/scheduling |
| `o — 内部函数` | L15878-L15881 | — | clearTimeout() | — | Timers/scheduling |
| `a — 内部函数` | L15892-L15902 | .concat()、.fillRect()、.fillText() | — | — | — |
| `asyncGeneratorWrap — 方法` | L15931-L16001 | .configure()、.encode()、.close()、.flush()、.warn()、.concat()、.decode() | new Promise()、new VideoEncoder()、new VideoFrame()、new VideoDecoder()、asyncGeneratorWrap()、Promise()、VideoEncoder()、t()、a()、VideoFrame()、n()、VideoDecoder()、i() | — | WebCodecs |
| `asyncGeneratorWrap — 方法` | L15941-L15962 | .configure()、.encode()、.close()、.flush() | new VideoEncoder()、new VideoFrame()、asyncGeneratorWrap()、VideoEncoder()、t()、a()、VideoFrame()、n() | — | WebCodecs |
| `asyncGeneratorWrap — 方法` | L15974-L15992 | .close()、.configure()、.decode()、.flush() | new VideoDecoder()、asyncGeneratorWrap()、VideoDecoder()、i()、n() | — | WebCodecs |
| `asyncGeneratorWrap — 方法` | L16082-L16172 | .createElement()、.getContext()、.fillText()、.floor()、.random()、.close()、.getTracks()、.forEach()、.stop()、.captureStream()、.addEventListener()、.addIceCandidate()、.addTrack()、.getVideoTracks()、.createOffer()、.setLocalDescription()、.setRemoteDescription()、.createAnswer()、.parse()、.findIndex()、.filter()、.write()、.all()、.getSenders()、.getStats()、.getReceivers()、.warn() | new RTCPeerConnection()、asyncGeneratorWrap()、setInterval()、clearInterval()、clearTimeout()、setTimeout()、i()、e()、RTCPeerConnection() | addEventListener('icecandidate') | RTCPeerConnection、Track lifecycle、Canvas 2D、DOM、Timers/scheduling |
| `i — 内部函数` | L16087-L16087 | — | — | — | — |
| `asyncGeneratorWrap — 方法` | L16140-L16164 | .all()、.getSenders()、.getStats()、.getReceivers()、.forEach() | asyncGeneratorWrap()、i()、e() | — | — |
| `getCapabilityResult — 内部函数` | L16211-L16214 | — | — | — | — |
| `isScreenShareSupported — 检测浏览器是否支持 getDisplayMedia 屏幕共享` | L16217-L16220 | — | — | — | — |
| `disableOnHttp — 源码命名函数` | L16224-L16232 | — | new RtcErrorAlias()、RtcErrorAlias() | — | — |
| `isCandidateSelected — 内部函数` | L16235-L16241 | — | isBoolean() | — | — |
| `getDisplayResolution — 内部函数` | L16245-L16258 | .concat() | getDisplayResolution() | — | — |
| `isGetUserMediaAvailable — 内部函数` | L16261-L16264 | — | isGetUserMediaAvailable() | — | — |
| `isWebAudioSupported — 内部函数` | L16267-L16280 | — | isWebAudioSupported() | — | AudioContext |
| `isCanvasCaptureStreamSupported — 检测是否支持 Canvas.captureStream 捕获` | L16283-L16286 | — | isCanvasCaptureStreamSupported() | — | — |
| `isWebRTCBasedScreenCaptureSupported — 检测是否支持基于 WebRTC 的屏幕捕获` | L16289-L16292 | — | isWebRTCBasedScreenCaptureSupported()、isBrowserNotUnsupported()、isCanvasCaptureStreamSupported() | — | — |
| `isMiniBrowserVersionSupported — 内部函数` | L16295-L16298 | — | isMiniBrowserVersionSupported() | — | — |
| `isSmallStreamSupported — 检测是否支持 Simulcast/SVC 分层编码小流` | L16301-L16304 | — | isSmallStreamSupported()、isWebRTCBasedScreenCaptureSupported()、isMiniBrowserVersionSupported() | — | — |
| `hasGetReceivers — 内部函数` | L16322-L16325 | — | hasGetReceivers() | — | RTCPeerConnection |
| `hasGetSenders — 内部函数` | L16328-L16331 | — | hasGetSenders() | — | RTCPeerConnection |
| `hasGetTransceivers — 内部函数` | L16334-L16337 | — | hasGetTransceivers() | — | RTCPeerConnection |
| `hasAddTransceiver — 内部函数` | L16340-L16345 | — | hasAddTransceiver() | — | RTCPeerConnection |
| `hasTransceiverStop — 内部函数` | L16349-L16352 | — | hasTransceiverStop() | — | RTCRtpSender/Receiver/Transceiver |
| `hasReplaceTrack — 内部函数` | L16357-L16360 | — | hasReplaceTrack() | — | RTCRtpSender/Receiver/Transceiver |
| `hasSetParameters — 内部函数` | L16363-L16366 | — | hasSetParameters()、hasGetSenders() | — | RTCRtpSender/Receiver/Transceiver |
| `checkWebRTCSupport — 内部函数` | L16376-L16379 | .filter() | — | — | RTCPeerConnection |
| `checkWebCodecsSupport — 内部函数` | L16383-L16396 | — | checkWebCodecsSupport()、isUndefined() | — | WebCodecs |
| `isMediaSessionSupported — 内部函数` | L16399-L16402 | — | isMediaSessionSupported()、isUndefined() | — | Navigator/UA |
| `isWebTransportSupported — 内部函数` | L16405-L16408 | — | isWebTransportSupported()、isUndefined() | — | — |
| `isWasmSimdSupported — 内部函数` | L16411-L16421 | .validate() | new Uint8Array()、isWasmSimdSupported()、Uint8Array() | — | WebAssembly、Encoding/binary |
| `getBrowserCapabilityReport — 内部函数` | L16424-L16442 | .concat()、.includes() | getBrowserCapabilityReport()、getOSName()、getDisplayResolution()、isScreenShareSupported()、checkWebRTCSupport()、isGetUserMediaAvailable()、isWebAudioSupported()、checkWebCodecsSupport()、isMediaSessionSupported()、isWebTransportSupported() | — | WebSocket、Navigator/UA |
| `saveCapabilityResult — 内部函数` | L16446-L16451 | .setItem() | saveCapabilityResult() | — | Navigator/UA |
| `loadAndDetectCapabilities — 内部函数` | L16454-L16468 | .getItem()、.keys()、.every() | loadAndDetectCapabilities()、warnHttpNotSupported()、Boolean()、isObject()、detectBrowserCapabilities() | — | Navigator/UA |
| `hasVideoFrameCallback — 内部函数` | L16471-L16474 | — | hasVideoFrameCallback() | — | — |
| `getCodecId — 内部函数` | L16478-L16481 | — | getCodecId() | — | — |
| `detectVideoCodecCapabilities — 内部函数` | L16485-L16554 | .all()、.keys()、.forEach()、.toLowerCase()、.addEnum()、.concat()、.info() | detectVideoCodecCapabilities()、asyncGeneratorWrap()、getOSNumber()、getBrowserCoreNumber()、queryEncodingCapabilities()、queryDecodingCapabilities()、getCodecId()、Number()、getH264ProfileSupport() | — | — |
| `queryEncodingCapabilities — 内部函数` | L16557-L16585 | .encodingInfo()、.concat() | queryEncodingCapabilities()、asyncGeneratorWrap() | — | — |
| `queryDecodingCapabilities — 内部函数` | L16588-L16616 | .decodingInfo()、.concat() | queryDecodingCapabilities()、asyncGeneratorWrap() | — | — |
| `getH264ProfileSupport — 内部函数` | L16619-L16690 | .getCapabilities()、.filter()、.toLowerCase()、.forEach()、.match()、.slice()、.warn() | getH264ProfileSupport() | — | RTCRtpSender/Receiver/Transceiver、Track constraints/settings/capabilities |
| `构造函数` | L16702-L16705 | — | constructor() | — | — |
| `abort — 中止操作` | L16708-L16711 | .call()、.concat() | new Error()、abort()、Error() | — | — |
| `toString — function toString() { [native code] }` | L16714-L16717 | .concat() | toString() | — | — |
| `extends 类 — extends` | L16721-L16728 | — | constructor()、super() | — | — |
| `构造函数` | L16724-L16727 | — | constructor()、super() | — | — |
| `createStateTransition — 创建状态机状态转换函数，定义合法状态转移路径` | L16732-L16843 | .get()、.has()、.set()、.push()、.call()、.resolve()、.abort()、.isArray()、.includes()、.concat()、.join()、.reject()、.apply()、.then()、.catch() | new Array()、new StateError()、new RemoteUser()、new Error()、createStateTransition()、Array()、StateError()、handleError()、RemoteUser()、onSuccess()、onError()、Error()、String() | — | — |
| `handleError — 源码命名函数` | L16785-L16794 | .call()、.resolve()、.reject() | — | — | — |
| `onSuccess — 源码命名函数` | L16801-L16811 | .call() | — | — | — |
| `dispatchStateChange — 内部函数` | L16859-L16869 | .toString()、.emit()、.updateDevTools() | dispatchStateChange()、String() | emit(stateStr)、emit(FSM.STATECHANGED) | — |
| `构造函数` | L16879-L16892 | .now()、.toString()、.setPrototypeOf()、.getPrototypeOf()、.updateDevTools() | constructor()、super() | — | — |
| `updateDevTools — 更新开发者工具信息` | L16970-L16975 | .assign() | updateDevTools()、stateMachineMap() | — | — |
| `e 类 — e` | L17015-L17179 | .toFixed()、.generateTaskID()、.set()、.callback()、.isBreakLoop()、.createObjectURL()、.get()、.postMessage()、.delete()、.floor()、.addEventListener()、.has()、.removeEventListener()、.hasTask()、.clearTask() | new Worker()、new Blob()、generateTaskID()、run()、Number()、objectMixin()、assignDescriptors()、interval()、setInterval()、intervalInWorker()、Worker()、Blob()、timeout()、setTimeout()、ric()、performanceNow()、Lx()、raf()、requestAnimationFrame()、n()、e()、hasTask()、clearTask()、clearInterval()、clearTimeout()、Vx()、cancelIdleCallback()、isBreakLoop() | addEventListener('visibilitychange')、removeEventListener('visibilitychange')、事件属性(onmessage) | Worker、URL/Blob、DOM、Page visibility、Timers/scheduling |
| `i — 源码命名函数` | L17094-L17097 | .callback()、.isBreakLoop() | setTimeout() | — | Timers/scheduling |
| `n — 内部函数` | L17108-L17116 | .floor()、.callback()、.isBreakLoop() | performanceNow()、Lx() | — | — |
| `n — 内部函数` | L17127-L17151 | .callback()、.isBreakLoop()、.floor()、.addEventListener() | performanceNow()、setTimeout()、requestAnimationFrame()、n()、e() | addEventListener('visibilitychange') | DOM、Page visibility、Timers/scheduling |
| `e — 源码命名函数` | L17140-L17148 | — | performanceNow()、n()、setTimeout() | — | Page visibility、Timers/scheduling |
| `createEventDispatcher — 内部函数` | L17204-L17219 | .has()、.set()、.get()、.push()、.bind()、.addEventListener()、.on() | createEventDispatcher() | addEventListener(e)、on(e) | — |
| `destroyEventDispatcher — 内部函数` | L17222-L17227 | .get()、.forEach()、.delete() | destroyEventDispatcher()、e() | — | — |
| `构造函数` | L17231-L17244 | — | new Map()、constructor()、defineMember()、Map() | — | AudioWorklet、Navigator/UA |
| `setConfig — 设置配置` | L17247-L17255 | .set() | setConfig()、String() | — | — |
| `logSuccessEvent — 记录成功事件` | L17258-L17263 | .uploadEventToKibana() | logSuccessEvent()、assignDescriptors()、objectMixin() | — | — |
| `logFailedEvent — 记录失败事件` | L17266-L17279 | .get()、.uploadEventToKibana() | logFailedEvent()、assignDescriptors()、objectMixin() | — | — |
| `uploadEventToKibana — 上传事件到 Kibana 日志系统` | L17282-L17293 | .concat()、.uploadEvent() | uploadEventToKibana() | — | — |
| `uploadEvent — 上传事件` | L17296-L17311 | .concat()、.stringify()、.sendRequest() | uploadEvent()、getServerTimeStr()、buildSSOPackage()、Number()、buildLoggerUrl() | — | — |
| `sendRequest — 发送请求` | L17314-L17317 | .catch() | sendRequest()、setTimeout()、sendHttpRequest() | — | Timers/scheduling |
| `retryOnError — 内部函数` | L17323-L17390 | .call()、.get()、.has()、.set()、.apply()、.finally()、.delete() | new Array()、new Map()、retryOnError()、FN()、onError()、retry()、reject()、onRetrying()、MN()、Array()、Map() | — | — |
| `onError — 错误处理回调` | L17335-L17356 | .call()、.get()、.has() | onError()、retry()、reject() | — | — |
| `onRetrying — 重连中回调` | L17359-L17364 | .call()、.get()、.has() | onRetrying()、MN() | — | — |
| `validateMethodArgs — 内部函数` | L17393-L17427 | .get()、.has()、.find()、.apply()、.delete() | new Array()、validateMethodArgs()、Array()、stopRetry() | — | — |
## HTML 媒体播放与自动播放（L17429-L18540）
详见：`07-Media-Playback-and-Rendering.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `构造函数` | L17446-L17475 | .concat()、.bindTrackEvents()、.info() | constructor()、super()、defineMember() | — | — |
| `setAttr — 设置单个属性` | L17496-L17499 | — | setAttr() | — | — |
| `setUrl — 设置 URL` | L17502-L17508 | .unbindTrackEvents() | setUrl() | — | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L17511-L17537 | .bindTrackEvents()、.bindElementEvents()、.bindAutoPlayEvent()、.play()、.then()、.warn()、.includes() | new Promise()、new RtcErrorAlias()、play()、asyncGeneratorWrap()、clearTimeout()、Promise()、logConfig()、RtcErrorAlias() | — | Media playback、Timers/scheduling |
| `stop — 停止本地流播放` | L17540-L17555 | .unbindEvents()、.remove()、.info()、.concat()、.destroyElement()、.handleStopped()、.clearTask() | stop()、setTimeout() | — | Timers/scheduling |
| `destroyElement — 方法` | L17558-L17568 | .debug()、.remove() | destroyElement()、clearTimeout() | — | Timers/scheduling |
| `pause — 暂停播放` | L17571-L17579 | .info()、.pause()、.setPoster()、.getVideoFrame() | pause() | — | Media playback |
| `resume — 恢复播放` | L17582-L17585 | .doResume() | resume() | — | — |
| `doResume — 执行恢复操作` | L17588-L17599 | .info()、.resolve()、.replay()、.play()、.catch() | new MediaStream()、doResume()、MediaStream() | — | MediaStream、Media playback |
| `setMuted — 方法` | L17602-L17605 | — | setMuted() | — | — |
| `replay — 重新播放` | L17608-L17611 | .stop()、.play()、.catch() | replay() | — | Track lifecycle、Media playback |
| `bindElementEvents — 绑定 DOM 元素事件` | L17614-L17629 | .bind()、.add() | bindElementEvents()、createEventDispatcher() | — | — |
| `bindTrackEvents — 方法` | L17632-L17646 | .bind()、.create()、.add()、.handleTrackEvent() | bindTrackEvents() | — | — |
| `bindAutoPlayEvent — 绑定自动播放事件` | L17649-L17652 | .on() | bindAutoPlayEvent() | on(Events.AUTOPLAY_DIALOG_CLICK_CONFIRM) | — |
| `unbindTrackEvents — 方法` | L17655-L17660 | — | unbindTrackEvents()、destroyEventDispatcher() | — | — |
| `unbindEvents — 解绑所有事件` | L17663-L17668 | .unbindTrackEvents()、.off() | unbindEvents()、destroyEventDispatcher() | — | — |
| `handleElementEvent — 处理 DOM 元素事件` | L17671-L17729 | .info()、.concat()、.handlePlaying()、.clearTask()、.handleStopped()、.handlePaused()、.run()、.doResume()、.error()、.uploadEvent()、.emit()、.replayByRecreateMediaStream() | handleElementEvent()、pV() | emit(Bx.ERROR)、emit(Bx.LOADED_DATA)、emit(Bx.LOADED_META_DATA) | Navigator/UA |
| `replayByRecreateMediaStream — 重新播放（重建 MediaStream）` | L17732-L17757 | .doReplayByRecreateMediaStream()、.then()、.warn()、.uploadEvent()、.addSuccessEvent()、.catch()、.error()、.addFailedEvent()、.emit() | replayByRecreateMediaStream() | emit(Bx.ERROR) | — |
| `doReplayByRecreateMediaStream — 通过重建 MediaStream 重新播放` | L17760-L17798 | .warn()、.concat()、.then()、.finally() | new Promise()、new MediaStream()、doReplayByRecreateMediaStream()、Promise()、delay()、MediaStream()、i()、t() | 事件属性(onerror) | MediaStream |
| `handleTrackEvent — 处理轨道事件` | L17801-L17822 | .handleStopped()、.handlePaused()、.handlePlaying()、.toString()、.warn()、.doResume() | handleTrackEvent()、asyncGeneratorWrap() | — | — |
| `handlePlaying — 播放中回调` | L17825-L17831 | .debug()、.call() | handlePlaying() | — | — |
| `handlePaused — 暂停回调` | L17834-L17837 | .debug() | handlePaused() | — | — |
| `handleStopped — 停止回调` | L17840-L17843 | .debug() | handleStopped() | — | — |
| `getElement — 获取 DOM 元素` | L17846-L17849 | — | getElement() | — | — |
| `onError — 错误处理回调` | L17859-L17862 | — | onError()、t() | — | — |
| `success — 操作成功回调` | L17875-L17878 | .emit() | success() | emit(Bx.PLAYER_STATE_CHANGED) | — |
| `success — 操作成功回调` | L17892-L17895 | .emit() | success() | emit(Bx.PLAYER_STATE_CHANGED) | — |
| `success — 操作成功回调` | L17908-L17911 | .emit() | success() | emit(Bx.PLAYER_STATE_CHANGED) | — |
| `pV — 内部函数` | L17937-L18091 | .concat()、.createElement()、.appendChild()、.addDiaLog()、.trim()、.bind()、.querySelector()、.createDiaLog()、.stopPropagation()、.info()、.uploadEvent()、.removeChild()、.warn()、.emit()、.deleteDialog()、.open() | isChinese()、constructor()、defineMember()、createDiaLog()、addDiaLog()、pV()、deleteDialog()、onConfirm()、onCollapseClick()、onQuestionClick() | emit(Events.AUTOPLAY_DIALOG_CLICK_CONFIRM)、事件属性(onclick) | AudioContext、HTMLMediaElement、Media playback、DOM |
| `构造函数` | L17957-L18002 | .createElement()、.concat()、.appendChild()、.addDiaLog() | constructor()、defineMember()、isChinese() | — | DOM |
| `createDiaLog — 创建弹窗` | L18005-L18039 | .createElement()、.concat()、.trim()、.bind()、.querySelector()、.appendChild() | createDiaLog()、isChinese() | 事件属性(onclick) | DOM |
| `addDiaLog — 添加弹窗` | L18042-L18054 | .createDiaLog()、.appendChild()、.bind()、.querySelector()、.concat()、.stopPropagation()、.info()、.uploadEvent() | addDiaLog()、pV() | 事件属性(onclick) | — |
| `deleteDialog — 删除弹窗` | L18057-L18064 | .removeChild() | deleteDialog() | — | — |
| `onConfirm — 确认按钮回调` | L18067-L18070 | .warn()、.emit()、.deleteDialog() | onConfirm() | emit(Events.AUTOPLAY_DIALOG_CLICK_CONFIRM) | — |
| `onCollapseClick — 折叠点击回调` | L18073-L18082 | .querySelector()、.concat()、.uploadEvent() | onCollapseClick() | — | — |
| `onQuestionClick — 问题点击回调` | L18085-L18090 | .open()、.uploadEvent() | onQuestionClick() | — | — |
| `createAutoPlayDialog — 内部函数` | L18096-L18099 | — | new gV()、createAutoPlayDialog()、gV() | — | — |
| `构造函数` | L18118-L18135 | .initializeElement() | constructor()、super()、defineMember()、isUndefined() | — | — |
| `initializeElement — 方法` | L18149-L18166 | .createElement()、.setAttribute()、.concat()、.appendChild()、.bindElementEvents()、.calculateStat() | new MediaStream()、initializeElement()、MediaStream() | — | MediaStream、DOM |
| `setContainer — 设置容器元素` | L18178-L18184 | .appendChild() | setContainer() | — | — |
| `bindElementEvents — 绑定 DOM 元素事件` | L18187-L18197 | .bindElementEvents()、.bind()、.add() | bindElementEvents() | — | — |
| `handleTrackEvent — 处理轨道事件` | L18200-L18206 | .handleTrackEvent() | handleTrackEvent() | — | — |
| `handleElementEvent — 处理 DOM 元素事件` | L18209-L18265 | .handleElementEvent()、.warn()、.concat()、.then()、.info()、.doResume()、.replace()、.includes()、.emit() | handleElementEvent()、delay()、pV() | emit(Bx.RESIZE) | — |
| `setCanvas — 方法` | L18268-L18282 | .remove()、.setAttribute()、.setTrack()、.captureStream()、.getVideoTracks()、.appendChild() | setCanvas() | — | Canvas 2D |
| `setAttr — 设置单个属性` | L18285-L18290 | .assign()、.setAttr() | setAttr() | — | — |
| `setRect — 设置渲染区域` | L18297-L18302 | .concat() | setRect() | — | — |
| `setViewMirror — 方法` | L18305-L18308 | — | setViewMirror() | — | — |
| `setObjectFit — 设置视频填充模式（contain/cover/fill）` | L18311-L18314 | .concat() | setObjectFit() | — | — |
| `setPoster — 方法` | L18317-L18320 | — | setPoster() | — | — |
| `stop — 停止本地流播放` | L18323-L18329 | .stop()、.remove() | stop() | — | Track lifecycle |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L18332-L18343 | .append()、.initializeElement()、.resolve()、.play() | play() | — | Media playback |
| `setTrack — 方法` | L18350-L18363 | .unbindTrackEvents()、.emit()、.bindTrackEvents()、.remove()、.append() | new MediaStream()、setTrack()、MediaStream() | emit(Bx.MEDIA_TRACK_CHANGED) | MediaStream |
| `getVideoFrame — 方法` | L18366-L18379 | .toDataURL()、.createElement()、.getContext()、.drawImage() | getVideoFrame() | — | Canvas 2D、DOM |
| `getElement — 获取 DOM 元素` | L18382-L18385 | — | getElement() | — | — |
| `calculateStat — 方法` | L18388-L18423 | .round()、.requestVideoFrameCallback()、.warn() | calculateStat()、hasVideoFrameCallback()、setTimeout() | — | Media playback、Timers/scheduling |
| `i — 内部函数` | L18398-L18414 | .round()、.requestVideoFrameCallback() | setTimeout() | — | Media playback、Timers/scheduling |
| `initAudioWorklet — 内部函数` | L18428-L18442 | .reject()、.addModule()、.info()、.concat() | initAudioWorklet()、asyncGeneratorWrap() | — | AudioWorklet |
| `observableCreate — 源码命名函数` | L18492-L18516 | .emit()、.addEventListener()、.addNumber()、.removeEventListener() | performanceNow()、setTimeout()、resumeAudioContext()、clearTimeout() | addEventListener('click')、removeEventListener('visibilitychange')、removeEventListener('click')、emit('155') | DOM、Page visibility、Timers/scheduling |
| `resumeAudioContext — 内部函数` | L18522-L18538 | .now()、.resume()、.then()、.catch()、.warn()、.concat()、.addEventListener() | new Promise()、resumeAudioContext()、Promise()、e()、clearTimeout()、setTimeout() | addEventListener('visibilitychange') | DOM、Page visibility、Timers/scheduling |
## Web Audio 与设备枚举（L18541-L19270）
详见：`06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `构造函数` | L18549-L18560 | — | new Set()、new Map()、constructor()、defineMember()、Set()、Map() | — | — |
| `setChannelCount — 设置声道数` | L18574-L18579 | — | setChannelCount() | — | — |
| `setContext — 方法` | L18582-L18585 | .addMixWeight() | setContext() | — | — |
| `removeContext — 方法` | L18588-L18593 | .reduceMixWeight() | removeContext() | — | — |
| `replaceNode — 方法` | L18596-L18613 | ._disconnect()、.addMixWeight()、.setChannelCount()、.preNodeReconnect()、.reconnect()、.error() | replaceNode() | — | — |
| `setNode — 设置节点` | L18616-L18635 | .addMixWeight()、.setChannelCount()、.preNodeReconnect()、.reconnect()、.addSuccessEvent()、.error()、.addFailedEvent() | setNode() | — | — |
| `deleteNode — 删除节点` | L18638-L18656 | ._disconnect()、.reduceMixWeight()、.preNodeReconnect()、.addSuccessEvent()、.error()、.addFailedEvent() | deleteNode() | — | — |
| `preNodeReconnect — 前节点重连` | L18659-L18665 | .forEach()、.reconnect()、.preNodeReconnect() | preNodeReconnect() | — | — |
| `connectNext — 连接下一个备选地址` | L18668-L18676 | .forEach()、.get()、._connect()、.connectNext() | connectNext() | — | — |
| `_connect — 方法` | L18679-L18685 | .connect()、.add() | _connect() | — | — |
| `_disconnect — 方法` | L18688-L18698 | .forEach()、.disconnect()、.clear() | _disconnect() | — | — |
| `reconnect — 重新建立信令连接` | L18701-L18704 | ._disconnect()、.connectNext() | reconnect() | — | — |
| `pipeTo — 管道输出到目标` | L18707-L18713 | .add()、.set() | pipeTo() | — | — |
| `extends 类 — extends` | L18717-L18762 | .setNode()、.getByteTimeDomainData()、.max()、.concat() | new Uint8Array()、constructor()、super()、defineMember()、Uint8Array()、setNode()、getByteTimeDomainData()、level()、timeDomainPathData() | — | Encoding/binary |
| `构造函数` | L18720-L18725 | — | new Uint8Array()、constructor()、super()、defineMember()、Uint8Array() | — | Encoding/binary |
| `setNode — 设置节点` | L18728-L18731 | .setNode() | new Uint8Array()、setNode()、Uint8Array() | — | Encoding/binary |
| `getByteTimeDomainData — 获取时域音频数据（波形）` | L18734-L18740 | .getByteTimeDomainData() | getByteTimeDomainData() | — | — |
| `构造函数` | L18770-L18773 | — | new AudioNode()、constructor()、defineMember()、AudioNode() | — | — |
| `setVolume — 设置音量` | L18783-L18788 | .setNode()、.createGain()、.deleteNode() | setVolume()、observableValue() | — | Web Audio nodes |
| `replaceSource — 替换音频源` | L18791-L18796 | .replaceNode() | replaceSource()、getOrCreateAudioNode() | — | — |
| `构造函数` | L18821-L18837 | .pipeTo() | new AudioNode()、constructor()、super()、defineMember()、AudioNode() | — | Streams |
| `connect — 建立 WebSocket 信令连接` | L18844-L18856 | .has()、.setNode()、.setContext()、.add() | connect() | — | — |
| `disconnect — 断开 WebSocket 信令连接` | L18859-L18871 | .has()、.deleteNode()、.removeContext()、.delete() | disconnect() | — | — |
| `remove — 方法` | L18874-L18884 | .deleteNode()、.disconnect() | remove() | — | — |
| `setVolume — 设置音量` | L18887-L18893 | .setNode()、.createGain()、.deleteNode() | setVolume() | — | Web Audio nodes |
| `构造函数` | L18903-L18910 | .createMediaStreamDestination() | new Set()、constructor()、defineMember()、observableValue()、Set() | — | Web Audio nodes |
| `addMixWeight — 添加混音权重` | L18913-L18918 | .mixOnChange() | addMixWeight() | — | — |
| `reduceMixWeight — 减少混音权重` | L18921-L18926 | .addMixWeight() | reduceMixWeight() | — | — |
| `close — 关闭本地流并释放所有轨道` | L18929-L18932 | .forEach()、.remove() | close() | — | — |
| `getOrCreateAudioNode — 内部函数` | L18942-L18965 | .get()、.createMediaElementSource()、.createMediaStreamSource()、.set()、.warn() | new MediaStream()、getOrCreateAudioNode()、observableValue()、MediaStream() | — | MediaStream、MediaStreamTrack、Web Audio nodes |
| `构造函数` | L18975-L18987 | .preload()、.on() | constructor()、defineMember() | on(Events.AUDIO_LEVEL_INTERVAL) | — |
| `preload — 预加载资源` | L18998-L19011 | .createObjectURL()、.then()、.initAudioWorklet()、.catch()、.error()、.concat()、.initScriptProcessor() | new Blob()、preload()、initAudioWorklet()、Blob() | 事件属性(onmessage) | AudioWorklet、URL/Blob |
| `initAudioWorklet — 初始化 AudioWorklet（音量检测等）` | L19014-L19037 | .now()、.warn()、.handleAudioLevelInterval()、.error()、.concat()、.logFailedEvent()、.initScriptProcessor() | new AudioWorkletNode()、initAudioWorklet()、AudioWorkletNode() | 事件属性(onmessage) | AudioWorklet |
| `initScriptProcessor — 初始化 ScriptProcessor 音频处理` | L19040-L19060 | .createScriptProcessor()、.now()、.getChannelData()、.sqrt()、.error()、.concat() | initScriptProcessor()、observableValue() | 事件属性(onaudioprocess) | Web Audio nodes |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L19063-L19071 | .postMessage()、.off() | destroy() | 事件属性(onaudioprocess)、事件属性(onmessage) | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19074-L19077 | — | getInternalAudioLevel() | — | — |
| `getCalculatedVolume — 获取计算后的音量值` | L19080-L19083 | .toFixed() | getCalculatedVolume()、parseFloat() | — | — |
| `getVolumeDb — 获取音量分贝值` | L19086-L19089 | .floor() | getVolumeDb() | — | — |
| `handleAudioLevelInterval — 音频电平定时检测` | L19092-L19099 | .postMessage() | handleAudioLevelInterval() | — | — |
| `extends 类 — extends` | L19105-L19157 | .deleteNode()、.destroy()、.preload()、.setNode()、.getCalculatedVolume()、.getInternalAudioLevel()、.getVolumeDb()、.allocationSize()、.copyTo()、.postMessage()、.close() | new volumeMeter()、new Float32Array()、constructor()、super()、defineMember()、volumeMeter()、deleteNode()、init()、asyncGeneratorWrap()、getCalculatedVolume()、getInternalAudioLevel()、getVolumeDb()、write()、Float32Array() | — | Encoding/binary |
| `构造函数` | L19108-L19111 | — | new volumeMeter()、constructor()、super()、defineMember()、volumeMeter() | — | — |
| `deleteNode — 删除节点` | L19114-L19117 | .deleteNode()、.destroy() | deleteNode() | — | — |
| `init — 初始化组件/模块（分配资源和建立内部状态）` | L19120-L19126 | .preload()、.setNode() | init()、asyncGeneratorWrap() | — | — |
| `getCalculatedVolume — 获取计算后的音量值` | L19129-L19132 | .getCalculatedVolume() | getCalculatedVolume() | — | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19135-L19138 | .getInternalAudioLevel() | getInternalAudioLevel() | — | — |
| `getVolumeDb — 获取音量分贝值` | L19141-L19144 | .getVolumeDb() | getVolumeDb() | — | — |
| `write — 向缓冲区写入字节序列` | L19147-L19156 | .allocationSize()、.copyTo()、.postMessage()、.close() | new Float32Array()、write()、Float32Array() | — | Encoding/binary |
| `构造函数` | L19164-L19167 | — | constructor()、defineMember() | — | — |
| `update — 方法` | L19170-L19195 | .filter()、.concat()、.toLocaleLowerCase()、.forEach()、.find()、.warn()、.stringify()、.emit() | update()、$V()、YV() | emit(i) | — |
| `hasDevice — 检查是否有设备` | L19198-L19201 | .find() | hasDevice()、Boolean() | — | — |
| `构造函数` | L19211-L19230 | .init()、.addEventListener()、.update()、.run() | new XV()、constructor()、super()、defineMember()、XV() | addEventListener('devicechange') | — |
| `init — 初始化组件/模块（分配资源和建立内部状态）` | L19233-L19239 | .then()、.update() | init()、handleEncryption() | — | — |
| `update — 方法` | L19242-L19258 | .update() | update()、asyncGeneratorWrap()、handleEncryption() | — | — |
| `hasBlueTooth — 检查蓝牙设备` | L19261-L19273 | .some()、.toLowerCase()、.includes() | hasBlueTooth()、observableValue() | — | — |
## 媒体设备与 Track 基础（L19271-L20450）
详见：`04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `$V — 源码命名函数` | L19277-L19280 | — | $V() | — | — |
| `handleEncryption — 源码命名函数` | L19288-L19346 | .enumerateDevices()、.forEach()、.getUserMedia()、.debug()、.getTracks()、.stop()、.map()、.concat()、.add()、.getCapabilities() | handleEncryption()、asyncGeneratorWrap()、warnHttpNotSupported()、isMediaDevicesSupported()、$V()、resumeAudioContext() | — | getUserMedia、enumerateDevices、Track constraints/settings/capabilities、Track lifecycle |
| `getMicrophoneTrackList — 获取所有可用的麦克风音频轨道列表` | L19349-L19355 | .update()、.then() | getMicrophoneTrackList() | — | — |
| `getCameraTrackList — 获取所有可用的摄像头视频轨道列表` | L19358-L19364 | .update()、.then() | getCameraTrackList() | — | — |
| `checkDeviceAvailability — 内部函数` | L19369-L19378 | .update()、.then() | checkDeviceAvailability()、asyncGeneratorWrap() | — | — |
| `findDeviceById — 内部函数` | L19383-L19394 | .find() | findDeviceById()、asyncGeneratorWrap()、getMicrophoneTrackList() | — | — |
| `构造函数` | L19404-L19416 | .pipeTo() | new UV()、new qV()、new AudioNode()、constructor()、super()、defineMember()、UV()、qV()、AudioNode() | — | Streams |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L19419-L19427 | .deleteNode() | destroy() | — | — |
| `构造函数` | L19445-L19458 | .createMediaStreamDestination() | new CameraTrack()、constructor()、super()、defineMember()、observableValue()、CameraTrack() | — | Web Audio nodes |
| `getMediaStream — 获取当前 MediaStream` | L19479-L19482 | — | new MediaStream()、getMediaStream()、MediaStream() | — | MediaStream |
| `initializeElement — 方法` | L19485-L19501 | .info()、.setAttribute()、.getMediaStream()、.min()、.max()、.emit()、.bindElementEvents() | new Audio()、initializeElement()、Audio()、isNumber() | emit(Bx.TIME_UPDATE)、事件属性(ontimeupdate) | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L19504-L19537 | .replaceSource()、.initializeElement()、.setSinkId()、.init()、.setNode()、.createAnalyser()、.info()、.concat()、.map()、.slice()、.call() | play()、asyncGeneratorWrap()、observableValue()、checkDeviceAvailability()、getModuleExport() | — | Web Audio nodes、Media playback |
| `asyncGeneratorWrap — 方法` | L19519-L19532 | .info()、.concat()、.map()、.slice() | asyncGeneratorWrap()、checkDeviceAvailability() | — | — |
| `stop — 停止本地流播放` | L19540-L19545 | .destroy()、.stop() | stop() | — | Track lifecycle |
| `setVolume — 设置音量` | L19548-L19551 | — | setVolume() | — | — |
| `setSinkId — 设置音频输出设备 ID` | L19554-L19565 | .call() | setSinkId()、asyncGeneratorWrap()、yield() | — | — |
| `setLoop — 设置循环播放` | L19572-L19575 | — | setLoop() | — | — |
| `getAudioLevel — 获取当前音频电平值` | L19578-L19581 | .getCalculatedVolume() | getAudioLevel() | — | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19584-L19587 | .getInternalAudioLevel() | getInternalAudioLevel() | — | — |
| `getInternalAudioLevelAfter3A — 获取经过 3A 处理后的音频电平` | L19590-L19593 | .getInternalAudioLevel() | getInternalAudioLevelAfter3A() | — | — |
| `extends 类 — extends` | L19597-L19608 | .unbindTrackEvents()、.emit()、.bindTrackEvents() | new MediaStream()、setTrack()、MediaStream() | emit(Bx.MEDIA_TRACK_CHANGED) | MediaStream |
| `setTrack — 方法` | L19600-L19607 | .unbindTrackEvents()、.emit()、.bindTrackEvents() | new MediaStream()、setTrack()、MediaStream() | emit(Bx.MEDIA_TRACK_CHANGED) | MediaStream |
| `extends 类 — extends` | L19611-L19726 | .pipeTo()、.setNode()、.write()、.unbindTrackEvents()、.emit()、.bindTrackEvents()、.getSettings()、.replaceSource()、.deleteNode()、.setVolume()、.info()、.concat()、.warn()、.suspend()、.catch()、.addEventListener()、.play()、.destroy()、.stop() | new AudioNode()、new MediaStream()、constructor()、super()、defineMember()、AudioNode()、setOutput()、observableValue()、write()、setTrack()、MediaStream()、setVolume()、performanceNow()、setInterval()、e()、destroyEventDispatcher()、stop() | addEventListener('visibilitychange')、emit(Bx.MEDIA_TRACK_CHANGED) | MediaStream、Track constraints/settings/capabilities、Track lifecycle、Media playback、Streams、DOM、Page visibility、Timers/scheduling |
| `构造函数` | L19614-L19622 | .pipeTo() | new AudioNode()、constructor()、super()、defineMember()、AudioNode() | — | Streams |
| `setOutput — 设置输出目标` | L19625-L19628 | .setNode() | setOutput()、observableValue() | — | — |
| `write — 向缓冲区写入字节序列` | L19631-L19634 | .write() | write() | — | — |
| `setTrack — 方法` | L19637-L19655 | .unbindTrackEvents()、.emit()、.bindTrackEvents()、.getSettings()、.replaceSource()、.deleteNode() | new MediaStream()、setTrack()、MediaStream() | emit(Bx.MEDIA_TRACK_CHANGED) | MediaStream、Track constraints/settings/capabilities |
| `setVolume — 设置音量` | L19658-L19712 | .setVolume()、.info()、.concat()、.warn()、.suspend()、.catch()、.addEventListener()、.setNode()、.play() | setVolume()、performanceNow()、setInterval()、e()、destroyEventDispatcher() | addEventListener('visibilitychange') | Media playback、DOM、Page visibility、Timers/scheduling |
| `e — 源码命名函数` | L19674-L19687 | .warn()、.suspend()、.catch()、.concat() | performanceNow() | — | — |
| `stop — 停止本地流播放` | L19715-L19725 | .destroy()、.stop() | stop() | — | Track lifecycle |
| `构造函数` | L19735-L19834 | .createLogger()、.getLogger()、.concat()、.on()、.emit()、.values()、.deleteDialog()、.emitFirstVideoFrameEvent()、.forEach()、.setTrack()、.bind() | new o()、constructor()、super()、defineMember()、generateUUID()、o()、objectMixin()、pV() | on(Bx.PLAYER_STATE_CHANGED)、on(Bx.LOADED_DATA)、on(Bx.LOADED_META_DATA)、on(Bx.MEDIA_TRACK_CHANGED)、on(Bx.RESIZE)、on(Bx.ERROR)、emit(Events.PLAYER_STATE_CHANGED)、emit('player-state-changed')、emit(Events.VIDEO_LOADED_DATA)、emit('video-size-changed') | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L19866-L19911 | .info()、.concat()、.stringify()、.setPlayerMute()、.setObjectFit()、.setContainer()、.playSubContainer()、.slice()、.setPoster()、.emit()、.setTrack()、.play()、.handleAutoPlayFailed() | play()、asyncGeneratorWrap()、isArray()、isUndefined() | emit(Events.PLAY_TRACK_START) | Media playback |
| `setMirror — 设置镜像模式` | L19914-L19935 | .setViewMirror() | setMirror()、isUndefined()、isBoolean() | — | — |
| `playSubContainer — 方法` | L19938-L19972 | .forEach()、.find()、.stop()、.delete()、.entries()、.get()、.setObjectFit()、.set()、.createChild()、.concat()、.values()、.setViewMirror()、.play() | new Map()、new VideoPlayer()、playSubContainer()、asyncGeneratorWrap()、Map()、isUndefined()、VideoPlayer() | — | Track lifecycle、Media playback |
| `setAudioOutput — 设置音频输出设备` | L19975-L19978 | .setSinkId() | setAudioOutput() | — | Media playback |
| `setAudioVolume — 设置音频音量` | L19981-L19984 | .setVolume() | setAudioVolume() | — | — |
| `getAudioLevel — 获取当前音频电平值` | L19987-L19990 | .getAudioLevel() | getAudioLevel() | — | — |
| `getInternalAudioLevel — 获取内部音频电平（未经 AGC 处理）` | L19993-L19999 | .getInternalAudioLevel() | getInternalAudioLevel() | — | — |
| `stop — 停止本地流播放` | L20002-L20018 | .info()、.concat()、.stop()、.forEach() | stop()、VN() | — | Track lifecycle |
| `resume — 恢复播放` | L20021-L20029 | .resume() | resume()、asyncGeneratorWrap()、yield() | — | — |
| `close — 关闭本地流并释放所有轨道` | L20032-L20035 | .info()、.stop() | close() | — | Track lifecycle |
| `setMute — 设置静音状态` | L20038-L20045 | .emit() | setMute() | emit(e ? 'mute' : 'unmute')、emit(e ? Events.TRACK_MUTED : Events.TRACK_UNMUTED) | — |
| `setPlayerMute — 设置播放器静音` | L20048-L20051 | .setMuted() | setPlayerMute() | — | — |
| `installTrackEvent — 安装轨道事件监听器` | L20066-L20073 | .add()、.onTrackMuted()、.onTrackEnded() | installTrackEvent()、createEventDispatcher() | — | — |
| `uninstallTrackEvent — 卸载轨道事件监听器` | L20076-L20079 | — | uninstallTrackEvent()、destroyEventDispatcher() | — | — |
| `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | L20082-L20097 | .call()、.uninstallTrackEvent()、.installTrackEvent()、.emit()、.changeInput()、.setOutputMediaStreamTrack() | setInputMediaStreamTrack() | emit('input-media-track-changed') | — |
| `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | L20100-L20118 | .debug()、.info()、.call()、.updatePlayingState()、.emit() | setOutputMediaStreamTrack()、Boolean() | emit('output-media-track-changed') | — |
| `setMediaType — 方法` | L20121-L20124 | — | setMediaType() | — | — |
| `updatePlayingState — 更新播放状态` | L20127-L20147 | .setTrack()、.play()、.catch()、.handleAutoPlayFailed()、.info()、.concat()、.stop()、.debug() | updatePlayingState()、VN() | — | Track lifecycle、Media playback |
| `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | L20150-L20179 | .warn()、.resume()、.then()、.removeEventListener()、.addEventListener()、.once()、.emit() | handleAutoPlayFailed()、asyncGeneratorWrap()、delay()、createAutoPlayDialog()、pV()、i() | addEventListener('click')、removeEventListener('click')、once(Events.LOCAL_TRACK_CAPTURE_SUCCESS)、emit('error') | DOM |
| `i — 源码命名函数` | L20157-L20163 | .resume()、.then()、.removeEventListener() | — | removeEventListener('click') | DOM |
| `getVideoFrame — 方法` | L20182-L20185 | .getVideoFrame() | getVideoFrame() | — | — |
| `emitFirstVideoFrameEvent — 发射首帧视频事件` | L20188-L20215 | .getSettings()、.warn()、.emit() | emitFirstVideoFrameEvent()、isRotate90Or270() | emit('first-video-frame') | Track constraints/settings/capabilities |
| `o — 内部函数` | L20196-L20214 | .warn()、.emit() | isRotate90Or270() | emit('first-video-frame') | — |
| `s — 内部函数` | L20199-L20214 | .warn()、.emit() | isRotate90Or270() | emit('first-video-frame') | — |
| `onTrackMuted — 轨道被静音回调` | L20218-L20221 | .warn()、.concat() | onTrackMuted() | — | — |
| `onTrackUnmuted — 轨道取消静音回调` | L20224-L20227 | .info()、.concat() | onTrackUnmuted() | — | — |
| `onTrackEnded — 轨道结束回调` | L20230-L20233 | .warn()、.concat() | onTrackEnded() | — | — |
| `retryFunction — 内部函数` | L20262-L20334 | .info()、.concat()、.stringify()、.map()、.substring()、.filter()、.includes()、.find()、.getUserMedia()、.getTracks()、.forEach()、.getCapabilities()、.indexOf()、.warn() | new RtcErrorAlias()、asyncGeneratorWrap()、isAudioConstraintsValid()、isVideoConstraintsValid()、getMicrophoneTrackList()、stringify()、assignDescriptors()、objectMixin()、getCameraTrackList()、isBoolean()、isUndefined()、resumeAudioContext()、logConfig()、RtcErrorAlias() | — | getUserMedia、Track constraints/settings/capabilities |
| `findTrackByDeviceId — 内部函数` | L20374-L20382 | .find()、.warn()、.getCapabilities() | findTrackByDeviceId()、asyncGeneratorWrap()、getCameraTrackList()、getMicrophoneTrackList()、isFunction()、stringify() | — | Track constraints/settings/capabilities |
| `isAudioConstraintsValid — 内部函数` | L20385-L20401 | — | isAudioConstraintsValid()、mU()、isNumber()、isBoolean()、Boolean() | — | — |
| `isVideoConstraintsValid — 内部函数` | L20404-L20429 | — | isVideoConstraintsValid()、mU()、Boolean() | — | — |
| `createAfterHookDecorator — 内部函数` | L20434-L20448 | .apply() | new Array()、createAfterHookDecorator()、wrapAsyncGenerator()、Array()、asyncGeneratorWrap() | — | — |
| `cleanupAfterUnpublish — 取消推流后的资源清理（关闭轨道、释放 SDP 等）` | L20451-L20468 | .apply()、.call() | new Array()、cleanupAfterUnpublish()、wrapAsyncGenerator()、Array()、asyncGeneratorWrap() | — | — |
## 响应式与内部异步工具（L20451-L23000）
详见：`00-Reading-Guide-and-Source-Map.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `handleAbortError — 处理中止错误（用户取消操作时的清理）` | L20471-L20492 | .apply()、.call() | new Array()、handleAbortError()、wrapAsyncGenerator()、Array()、asyncGeneratorWrap() | — | — |
| `wrapAsyncGenerator — 内部函数` | L20495-L20501 | — | wrapAsyncGenerator()、valueWrapper() | — | — |
| `AU — 源码命名函数` | L20502-L20518 | .info()、.concat()、.addEventListener() | — | addEventListener('visibilitychange') | DOM、Page visibility |
| `构造函数` | L20523-L20526 | .createLogger()、.concat() | constructor()、defineMember() | — | — |
| `push — 方法` | L20537-L20559 | .push()、.then()、.debug()、.concat()、.callNext() | new Promise()、push()、objectMixin()、Promise() | — | — |
| `shift — 方法` | L20562-L20568 | .shift()、.debug()、.concat() | shift() | — | — |
| `callNext — 发送下一个请求` | L20571-L20585 | .debug()、.apply()、.then()、.finally()、.shift()、.callNext() | callNext() | — | — |
| `createKVCacheDecorator — 内部函数` | L20592-L20614 | .get()、.set()、.push() | new CU()、new Array()、createKVCacheDecorator()、CU()、Array() | — | — |
| `logMethodCall — 内部函数` | L20617-L20647 | .get()、.forEach()、.push()、.reject()、.delete()、.apply() | new Array()、new RtcErrorAlias()、logMethodCall()、Array()、RtcErrorAlias() | — | — |
| `extractKeyParam — 提取关键参数` | L20650-L20671 | .get()、.set()、.push() | new Array()、new Map()、new CU()、extractKeyParam()、keyExtractor()、Array()、Map()、getKey()、CU() | — | — |
| `createReportDecorator — 内部函数` | L20674-L20704 | .apply()、.then()、.addSuccessEvent()、.catch()、.addFailedEvent() | new Array()、createReportDecorator()、wrapAsyncGenerator()、Array()、performanceNow()、isPromise() | — | — |
| `noopFunction — 内部函数` | L20709-L20709 | — | noopFunction() | — | — |
| `disposeWrapper — 内部函数` | L20812-L20815 | .dispose() | disposeWrapper() | — | — |
| `toString — function toString() { [native code] }` | L20830-L20833 | .concat()、.join() | toString() | — | — |
| `subscribe — 订阅远端用户的音视频流` | L20836-L20842 | .subscribe() | new KU()、subscribe()、KU()、this() | — | — |
| `构造函数` | L20851-L20854 | — | new Set()、constructor()、Set() | — | — |
| `next — 执行下一步（迭代器）` | L20857-L20857 | — | next() | — | — |
| `complete — 完成操作` | L20860-L20863 | .dispose() | complete() | — | — |
| `error — 输出 ERROR 级别日志` | L20866-L20869 | .dispose() | error() | — | — |
| `dispose — 方法` | L20876-L20885 | .doDefer() | dispose() | — | — |
| `subscribe — 订阅远端用户的音视频流` | L20888-L20891 | .subscribe() | subscribe()、e() | — | — |
| `doDefer — 执行延迟操作` | L20898-L20901 | .forEach()、.clear() | doDefer() | — | — |
| `defer — 创建延迟操作` | L20904-L20907 | .add() | defer() | — | — |
| `removeDefer — 方法` | L20910-L20913 | .delete() | removeDefer() | — | — |
| `reset — 重置房间状态（清理所有内部数据）` | L20916-L20924 | — | reset() | — | — |
| `resetNext — 重置下一个` | L20927-L20930 | — | resetNext() | — | — |
| `resetComplete — 重置完成状态` | L20933-L20936 | — | resetComplete() | — | — |
| `resetError — 方法` | L20939-L20942 | — | resetError() | — | — |
| `构造函数` | L20951-L20954 | .defer() | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L20957-L20960 | .next() | next() | — | — |
| `complete — 完成操作` | L20963-L20966 | .complete() | complete() | — | — |
| `error — 输出 ERROR 级别日志` | L20969-L20972 | .error() | error() | — | — |
| `extends 类 — extends` | L20976-L21037 | .defer()、.create()、.pipe()、.subscribe()、.next()、.complete()、.dispose()、._next()、._complete()、._error() | constructor()、super()、t()、r()、i()、next()、complete()、error() | — | — |
| `构造函数` | L20979-L21018 | .defer()、.create()、.pipe()、.subscribe()、.next()、.complete()、.dispose() | constructor()、super()、t()、r()、i() | — | — |
| `next — 执行下一步（迭代器）` | L21021-L21024 | ._next() | next() | — | — |
| `complete — 完成操作` | L21027-L21030 | .dispose()、._complete() | complete() | — | — |
| `error — 输出 ERROR 级别日志` | L21033-L21036 | .dispose()、._error() | error() | — | — |
| `pipeOperator — 内部函数` | L21041-L21046 | .reduce() | new Array()、pipeOperator()、Array()、op() | — | — |
| `createObservable — 内部函数` | L21049-L21072 | .defineProperties()、.setPrototypeOf()、.create()、.addSource() | createObservable()、UU() | — | — |
| `createOperator — 内部函数` | L21075-L21103 | .subscribe()、.pipe() | new Array()、new OperatorClass()、createOperator()、Array()、createObservable()、OperatorClass()、source() | — | — |
| `postDevToolsMessage — 内部函数` | L21106-L21109 | .postMessage() | postDevToolsMessage() | — | — |
| `extends 类 — extends` | L21112-L21144 | .defer()、.next()、.complete()、.error() | constructor()、super()、next()、complete()、error() | — | — |
| `构造函数` | L21115-L21125 | .defer() | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L21128-L21131 | .next() | next() | — | — |
| `complete — 完成操作` | L21134-L21137 | .complete() | complete() | — | — |
| `error — 输出 ERROR 级别日志` | L21140-L21143 | .complete()、.error() | error() | — | — |
| `addSource — 添加音频源` | L21147-L21150 | .toString() | addSource()、postDevToolsMessage() | — | — |
| `next — 执行下一步（迭代器）` | L21153-L21156 | .toString() | next()、postDevToolsMessage() | — | — |
| `subscribe — 订阅远端用户的音视频流` | L21159-L21164 | — | subscribe()、postDevToolsMessage() | — | — |
| `complete — 完成操作` | L21167-L21170 | .toString() | complete()、postDevToolsMessage() | — | — |
| `defer — 创建延迟操作` | L21173-L21176 | — | defer()、postDevToolsMessage() | — | — |
| `pipe — 管道传输（数据流处理）` | L21179-L21182 | .toString() | pipe()、postDevToolsMessage() | — | — |
| `update — 方法` | L21185-L21188 | .toString() | update()、postDevToolsMessage() | — | — |
| `create — 方法` | L21191-L21194 | .toString() | create()、postDevToolsMessage() | — | — |
| `构造函数` | L21202-L21205 | .concat() | constructor()、super() | — | — |
| `构造函数` | L21213-L21216 | — | new Set()、constructor()、super()、Set() | — | — |
| `add — 方法` | L21219-L21222 | .defer()、.remove()、.add()、.reset()、.subscribe() | add() | — | — |
| `remove — 方法` | L21225-L21228 | .delete()、.dispose() | remove() | — | — |
| `next — 执行下一步（迭代器）` | L21231-L21234 | .forEach()、.next() | next() | — | — |
| `complete — 完成操作` | L21237-L21240 | .forEach()、.complete()、.clear() | complete() | — | — |
| `error — 输出 ERROR 级别日志` | L21243-L21246 | .forEach()、.error()、.clear() | error() | — | — |
| `createSubject — 内部函数` | L21251-L21274 | .add()、.pipe()、.bind() | new QU()、createSubject()、QU()、createObservable() | — | — |
| `$U — 源码命名函数` | L21275-L21294 | .complete()、.forEach() | new Array()、new WU()、$U()、Array()、createObservable()、WU() | — | — |
| `mergeObservables — 内部函数` | L21297-L21325 | .forEach()、.set()、.delete()、.complete()、.dispose()、.resetNext()、.resetComplete()、.next()、.get()、.subscribe() | new Array()、new Map()、new WU()、mergeObservables()、Array()、createObservable()、Map()、WU() | — | — |
| `combineLatestObservables — 内部函数` | L21328-L21348 | .doDefer()、.subscribe()、.complete() | new Array()、new WU()、combineLatestObservables()、Array()、createObservable()、WU() | — | — |
| `bufferObservable — 内部函数` | L21351-L21374 | .push()、.shift()、.forEach()、.next()、.defer()、.remove()、.add() | new QU()、bufferObservable()、QU()、createObservable() | — | — |
| `iifObservable — 内部函数` | L21377-L21380 | — | iifObservable()、createObservable()、condition()、trueObs()、falseObs() | — | — |
| `mergeObservableSources — 内部函数` | L21383-L21421 | .complete()、.forEach()、.next()、.subscribe() | new Array()、new WU()、mergeObservableSources()、Array()、createObservable()、WU() | — | — |
| `checkComplete — 内部函数` | L21396-L21399 | .complete() | — | — | — |
| `concatObservableSources — 内部函数` | L21424-L21458 | .complete()、.forEach()、.push()、.every()、.next()、.map()、.shift()、.subscribe() | new Array()、new WU()、concatObservableSources()、Array()、createObservable()、WU() | — | — |
| `checkComplete — 内部函数` | L21436-L21439 | .complete() | — | — | — |
| `combineObservableSources — 内部函数` | L21461-L21478 | .next()、.subscribe() | new Array()、combineObservableSources()、Array()、createObservable() | — | — |
| `extends 类 — extends` | L21482-L21499 | .subscribe()、.next() | new WU()、new Array()、constructor()、super()、WU()、Array()、mergeObservableSources()、next() | — | — |
| `构造函数` | L21485-L21492 | .subscribe() | new WU()、new Array()、constructor()、super()、WU()、Array()、mergeObservableSources() | — | — |
| `next — 执行下一步（迭代器）` | L21495-L21498 | .next() | next() | — | — |
| `extends 类 — extends` | L21505-L21540 | .push()、.forEach()、.next()、.shift()、.complete() | constructor()、super()、next()、complete() | — | — |
| `构造函数` | L21508-L21516 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L21519-L21530 | .push()、.forEach()、.next()、.shift() | next() | — | — |
| `complete — 完成操作` | L21533-L21539 | .next()、.forEach()、.complete() | complete() | — | — |
| `extends 类 — extends` | L21546-L21573 | .next()、.subscribe()、.push()、.complete() | new WU()、constructor()、super()、WU()、next()、complete() | — | — |
| `构造函数` | L21549-L21560 | .next()、.subscribe() | new WU()、constructor()、super()、WU() | — | — |
| `next — 执行下一步（迭代器）` | L21563-L21566 | .push() | next() | — | — |
| `complete — 完成操作` | L21569-L21572 | .next()、.complete() | complete() | — | — |
| `asyncGeneratorPromiseRunner — 内部函数` | L21578-L21625 | .next()、.throw()、.then()、.apply() | new i()、resolveStep()、handleStepResult()、o()、throwStep()、n()、i()、t()、c() | — | — |
| `resolveStep — 内部函数` | L21583-L21593 | .next() | resolveStep()、handleStepResult()、o() | — | — |
| `throwStep — 内部函数` | L21596-L21606 | .throw() | throwStep()、handleStepResult()、o() | — | — |
| `handleStepResult — 内部函数` | L21609-L21622 | .then() | new i()、handleStepResult()、n()、i()、t() | — | — |
| `createSubjectFromObservable — 内部函数` | L21629-L21648 | .next()、.complete()、.error()、.subscribe() | createSubjectFromObservable()、createSubject()、createObservable() | — | — |
| `deferObservable — 内部函数` | L21651-L21654 | .subscribe() | deferObservable()、createObservable()、e() | — | — |
| `fF — 源码命名函数` | L21668-L21671 | — | — | — | — |
| `gF — 源码命名函数` | L21672-L21677 | .next()、.complete() | _F() | — | — |
| `ofObservable — 内部函数` | L21681-L21686 | — | new Array()、ofObservable()、Array()、createObservable()、gF() | — | — |
| `fromArrayObservable — 内部函数` | L21689-L21692 | — | fromArrayObservable()、createObservable()、gF() | — | — |
| `intervalObservable — 内部函数` | L21695-L21715 | .next()、.defer() | intervalObservable()、createObservable()、setInterval()、clearInterval() | — | Timers/scheduling |
| `timerObservable — 内部函数` | L21718-L21746 | .removeDefer()、.next()、.defer()、.complete() | timerObservable()、createObservable()、setTimeout()、setInterval()、clearInterval()、clearTimeout() | — | Timers/scheduling |
| `o — 内部函数` | L21739-L21757 | .defer()、.next() | clearTimeout()、createEventListener()、t()、e() | — | Timers/scheduling |
| `createEventListener — 内部函数` | L21749-L21757 | .next()、.defer() | createEventListener()、t()、e() | — | — |
| `fromEventPatternObservable — 内部函数` | L21760-L21763 | — | fromEventPatternObservable()、createObservable()、createEventListener() | — | — |
| `fromEventObservable — 内部函数` | L21766-L21796 | .on()、.off()、.addListener()、.removeListener()、.addEventListener()、.removeEventListener() | fromEventObservable()、createObservable()、createEventListener() | addEventListener(t)、removeEventListener(t)、on(t) | — |
| `fromPromiseObservable — 内部函数` | L21799-L21809 | .then()、.bind() | fromPromiseObservable()、createObservable() | — | — |
| `fromFetchObservable — 内部函数` | L21812-L21819 | — | fromFetchObservable()、createObservable()、deferObservable()、fromPromiseObservable()、fetch() | — | fetch |
| `fromIterableObservable — 内部函数` | L21822-L21844 | .next()、.complete()、.error() | fromIterableObservable()、createObservable()、_F() | — | — |
| `fromAsyncGeneratorObservable — 内部函数` | L21847-L21869 | .read()、.complete()、.next() | fromAsyncGeneratorObservable()、dF()、t()、createObservable() | — | — |
| `t — 源码命名函数` | L21849-L21858 | .read()、.complete()、.next() | dF()、t() | — | — |
| `dF — 方法` | L21852-L21858 | .read()、.complete()、.next() | dF()、t() | — | — |
| `abortableObservable — 内部函数` | L21872-L21912 | .defer()、.abort()、.pipeTo()、.next()、.complete()、.error()、.then() | new AbortController()、new WritableStream()、abortableObservable()、createObservable()、AbortController()、WritableStream()、write()、close()、abort() | — | Streams |
| `write — 向缓冲区写入字节序列` | L21885-L21888 | .next() | write() | — | — |
| `close — 关闭本地流并释放所有轨道` | L21891-L21894 | .complete() | close() | — | — |
| `abort — 中止操作` | L21897-L21900 | .error() | abort() | — | — |
| `animationFrameObservable — 内部函数` | L21915-L21930 | .next()、.defer() | animationFrameObservable()、createObservable()、requestAnimationFrame()、i()、cancelAnimationFrame() | — | Timers/scheduling |
| `debounceObservable — 内部函数` | L21933-L21948 | .next()、.complete() | debounceObservable()、createObservable() | — | — |
| `mapObservable — 内部函数` | L21951-L21965 | .concat()、.next()、.complete()、.apply() | new Array()、mapObservable()、Array()、createObservable() | — | — |
| `filterObservable — 内部函数` | L21968-L21982 | .concat()、.error()、.next()、.complete()、.apply() | new Array()、filterObservable()、Array()、createObservable() | — | — |
| `neverObservable — 内部函数` | L21985-L21988 | — | neverObservable()、createObservable() | — | — |
| `throwErrorObservable — 内部函数` | L21991-L21994 | .error() | throwErrorObservable()、createObservable() | — | — |
| `emptyObservable — 内部函数` | L21997-L22000 | .complete() | emptyObservable()、createObservable() | — | — |
| `构造函数` | L22008-L22022 | .next()、.complete()、.resetNext() | constructor()、super() | — | — |
| `r — 源码命名函数` | L22011-L22014 | .next()、.complete() | — | — | — |
| `next — 执行下一步（迭代器）` | L22025-L22028 | .f() | next() | — | — |
| `BF — 内部函数` | L22034-L22057 | .call()、.next() | createOperator()、constructor()、super()、next() | — | — |
| `HF — 内部函数` | L22037-L22057 | .call()、.next() | createOperator()、constructor()、super()、next() | — | — |
| `WF — 内部函数` | L22040-L22057 | .call()、.next() | createOperator()、constructor()、super()、next() | — | — |
| `extends 类 — extends` | L22044-L22057 | .call()、.next() | constructor()、super()、next() | — | — |
| `构造函数` | L22047-L22050 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22053-L22056 | .call()、.next() | next() | — | — |
| `extends 类 — extends` | L22063-L22067 | — | next() | — | — |
| `next — 执行下一步（迭代器）` | L22066-L22066 | — | next() | — | — |
| `extends 类 — extends` | L22073-L22086 | .next()、.doDefer()、.complete() | constructor()、super()、next() | — | — |
| `构造函数` | L22076-L22079 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22082-L22085 | .next()、.doDefer()、.complete() | next() | — | — |
| `extends 类 — extends` | L22092-L22107 | .doDefer()、.complete()、.subscribe() | new WU()、constructor()、super()、WU() | — | — |
| `构造函数` | L22095-L22106 | .doDefer()、.complete()、.subscribe() | new WU()、constructor()、super()、WU() | — | — |
| `extends 类 — extends` | L22113-L22126 | .f()、.next()、.doDefer()、.complete() | constructor()、super()、next() | — | — |
| `构造函数` | L22116-L22119 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22122-L22125 | .f()、.next()、.doDefer()、.complete() | next() | — | — |
| `extends 类 — extends` | L22133-L22146 | — | constructor()、super()、next() | — | — |
| `构造函数` | L22136-L22139 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22142-L22145 | — | next() | — | — |
| `extends 类 — extends` | L22152-L22167 | .doDefer()、.resetNext()、.subscribe() | new WU()、constructor()、super()、WU() | — | — |
| `构造函数` | L22155-L22166 | .doDefer()、.resetNext()、.subscribe() | new WU()、constructor()、super()、WU() | — | — |
| `extends 类 — extends` | L22173-L22186 | .f()、.next() | constructor()、super()、next() | — | — |
| `构造函数` | L22176-L22179 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22182-L22185 | .f()、.next() | next() | — | — |
| `extends 类 — extends` | L22192-L22229 | .throttle()、.next()、.reset()、.subscribe()、.durationSelector()、.complete()、.dispose()、.send() | constructor()、super()、cacheValue()、send()、throttle()、next()、complete() | — | — |
| `构造函数` | L22195-L22198 | — | constructor()、super() | — | — |
| `cacheValue — 缓存值` | L22201-L22204 | .throttle() | cacheValue() | — | — |
| `send — 发送信令消息` | L22207-L22210 | .next()、.throttle() | send() | — | — |
| `throttle — 节流函数` | L22213-L22216 | .reset()、.subscribe()、.durationSelector() | throttle() | — | — |
| `next — 执行下一步（迭代器）` | L22219-L22222 | .complete() | next() | — | — |
| `complete — 完成操作` | L22225-L22228 | .dispose()、.send() | complete() | — | — |
| `extends 类 — extends` | L22232-L22257 | .dispose()、.send()、.cacheValue()、.complete() | new $F()、constructor()、super()、$F()、next()、complete() | — | — |
| `构造函数` | L22235-L22244 | .dispose() | new $F()、constructor()、super()、$F() | — | — |
| `next — 执行下一步（迭代器）` | L22247-L22250 | .send()、.cacheValue() | next() | — | — |
| `complete — 完成操作` | L22253-L22256 | .complete() | complete() | — | — |
| `extends 类 — extends` | L22263-L22276 | .complete()、.dispose()、.next() | next()、complete() | — | — |
| `next — 执行下一步（迭代器）` | L22266-L22269 | .complete() | next() | — | — |
| `complete — 完成操作` | L22272-L22275 | .dispose()、.next() | complete() | — | — |
| `extends 类 — extends` | L22279-L22301 | .dispose()、.reset()、.subscribe()、.durationSelector()、.complete() | new nB()、constructor()、super()、nB()、next()、complete() | — | — |
| `构造函数` | L22282-L22285 | .dispose() | new nB()、constructor()、super()、nB() | — | — |
| `next — 执行下一步（迭代器）` | L22288-L22294 | .dispose()、.reset()、.subscribe()、.durationSelector() | next() | — | — |
| `complete — 完成操作` | L22297-L22300 | .complete() | complete() | — | — |
| `extends 类 — extends` | L22307-L22328 | .doDefer()、.complete()、.next()、.error() | new Error()、constructor()、super()、next()、complete()、Error() | — | — |
| `构造函数` | L22310-L22313 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22316-L22319 | .doDefer()、.complete() | next() | — | — |
| `complete — 完成操作` | L22322-L22327 | .next()、.complete()、.error() | new Error()、complete()、Error() | — | — |
| `extends 类 — extends` | L22335-L22348 | .f()、.next()、.doDefer()、.complete() | constructor()、super()、next() | — | — |
| `构造函数` | L22338-L22341 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22344-L22347 | .f()、.next()、.doDefer()、.complete() | next() | — | — |
| `extends 类 — extends` | L22354-L22375 | .f()、.doDefer()、.complete()、.next()、.error() | new Error()、constructor()、super()、next()、complete()、Error() | — | — |
| `构造函数` | L22357-L22360 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22363-L22366 | .f()、.doDefer()、.complete() | next() | — | — |
| `complete — 完成操作` | L22369-L22374 | .next()、.complete()、.error() | new Error()、complete()、Error() | — | — |
| `extends 类 — extends` | L22381-L22402 | .f()、.next()、.complete()、.error() | new Error()、constructor()、super()、next()、complete()、Error() | — | — |
| `构造函数` | L22384-L22387 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22390-L22393 | .f() | next() | — | — |
| `complete — 完成操作` | L22396-L22401 | .next()、.complete()、.error() | new Error()、complete()、Error() | — | — |
| `extends 类 — extends` | L22408-L22429 | .predicate()、.doDefer()、.complete()、.next()、.error() | new Error()、constructor()、super()、next()、complete()、Error() | — | — |
| `构造函数` | L22411-L22414 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22417-L22420 | .predicate()、.doDefer()、.complete() | next() | — | — |
| `complete — 完成操作` | L22423-L22428 | .next()、.complete()、.error() | new Error()、complete()、Error() | — | — |
| `extends 类 — extends` | L22435-L22455 | .resetNext()、.next()、.f() | constructor()、super()、next() | — | — |
| `构造函数` | L22438-L22448 | .resetNext()、.next() | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22451-L22454 | .next()、.f() | next() | — | — |
| `extends 类 — extends` | L22461-L22474 | .next() | constructor()、super()、next() | — | — |
| `构造函数` | L22464-L22467 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22470-L22473 | .next() | next() | — | — |
| `extends 类 — extends` | L22479-L22492 | .next()、.call() | constructor()、super()、next() | — | — |
| `构造函数` | L22482-L22485 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22488-L22491 | .next()、.call() | next() | — | — |
| `extends 类 — extends` | L22497-L22518 | .next()、.resetComplete()、.dispose() | constructor()、super()、next()、t()、tryComplete() | — | — |
| `构造函数` | L22500-L22503 | — | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22506-L22511 | .next() | next()、t() | — | — |
| `tryComplete — 尝试完成操作` | L22514-L22517 | .resetComplete()、.dispose() | tryComplete() | — | — |
| `e 类 — e` | L22521-L22550 | .subscribe()、.makeSource()、.complete()、.resetComplete()、.dispose() | new i()、constructor()、super()、subInner()、i()、complete()、tryComplete() | — | — |
| `构造函数` | L22524-L22527 | — | constructor()、super() | — | — |
| `subInner — 内部订阅` | L22530-L22537 | .subscribe()、.makeSource() | new i()、subInner()、i() | — | — |
| `complete — 完成操作` | L22540-L22543 | .complete() | complete() | — | — |
| `tryComplete — 尝试完成操作` | L22546-L22549 | .resetComplete()、.dispose() | tryComplete() | — | — |
| `extends 类 — extends` | L22553-L22553 | — | — | — | — |
| `extends 类 — extends` | L22556-L22567 | .subInner()、.dispose() | next() | — | — |
| `next — 执行下一步（迭代器）` | L22559-L22566 | .subInner()、.dispose() | next() | — | — |
| `wrapAsUnaryFunction — 内部函数` | L22572-L22575 | — | wrapAsUnaryFunction()、e() | — | — |
| `extends 类 — extends` | L22578-L22588 | .dispose()、.subNext()、.resetNext()、.resetComplete() | tryComplete() | — | — |
| `tryComplete — 尝试完成操作` | L22581-L22587 | .dispose()、.subNext()、.resetNext()、.resetComplete() | tryComplete() | — | — |
| `extends 类 — extends` | L22591-L22618 | .bind()、.next2()、.subNext()、.subInner()、.shift()、.resetComplete()、.dispose() | constructor()、super()、next()、subNext()、tryComplete() | — | — |
| `构造函数` | L22594-L22597 | .bind() | constructor()、super() | — | — |
| `next — 执行下一步（迭代器）` | L22600-L22603 | .next2()、.subNext() | next() | — | — |
| `subNext — 订阅下一个` | L22606-L22611 | .subInner()、.shift()、.resetComplete() | subNext() | — | — |
| `tryComplete — 尝试完成操作` | L22614-L22617 | .resetComplete()、.dispose() | tryComplete() | — | — |
| `extends 类 — extends` | L22623-L22632 | .delete()、.dispose()、.resetComplete() | tryComplete() | — | — |
| `tryComplete — 尝试完成操作` | L22626-L22631 | .delete()、.dispose()、.resetComplete() | tryComplete() | — | — |
| `extends 类 — extends` | L22635-L22654 | .subInner()、.add()、.forEach()、.resetComplete()、.dispose() | new Set()、constructor()、super()、Set()、next()、tryComplete() | — | — |
| `构造函数` | L22638-L22641 | — | new Set()、constructor()、super()、Set() | — | — |
| `next — 执行下一步（迭代器）` | L22644-L22647 | .subInner()、.add() | next() | — | — |
| `tryComplete — 尝试完成操作` | L22650-L22653 | .forEach()、.resetComplete()、.dispose() | tryComplete() | — | — |
| `extends 类 — extends` | L22659-L22666 | .resetNext()、.dispose() | dispose() | — | — |
| `dispose — 方法` | L22662-L22665 | .resetNext()、.dispose() | dispose() | — | — |
| `extends 类 — extends` | L22669-L22676 | .subInner() | next() | — | — |
| `next — 执行下一步（迭代器）` | L22672-L22675 | .subInner() | next() | — | — |
| `extends 类 — extends` | L22682-L22710 | .f()、.get()、.set()、.next()、.forEach()、.complete()、.error() | new Map()、constructor()、super()、Map()、next()、createSubjectFromObservable()、complete()、error() | — | — |
| `构造函数` | L22685-L22688 | — | new Map()、constructor()、super()、Map() | — | — |
| `next — 执行下一步（迭代器）` | L22691-L22697 | .f()、.get()、.set()、.next() | next()、createSubjectFromObservable() | — | — |
| `complete — 完成操作` | L22700-L22703 | .forEach()、.complete() | complete() | — | — |
| `error — 输出 ERROR 级别日志` | L22706-L22709 | .forEach()、.error() | error() | — | — |
| `extends 类 — extends` | L22716-L22729 | .next() | new Date()、constructor()、super()、Date()、next()、Number() | — | — |
| `构造函数` | L22719-L22722 | — | new Date()、constructor()、super()、Date() | — | — |
| `next — 执行下一步（迭代器）` | L22725-L22728 | .next() | new Date()、next()、Number()、Date() | — | — |
| `extends 类 — extends` | L22735-L22766 | .next()、.concat()、.push()、.complete()、.dispose() | constructor()、super()、setInterval()、next()、complete()、dispose()、clearInterval() | — | Timers/scheduling |
| `构造函数` | L22738-L22747 | .next()、.concat() | constructor()、super()、setInterval() | — | Timers/scheduling |
| `next — 执行下一步（迭代器）` | L22750-L22753 | .push() | next() | — | — |
| `complete — 完成操作` | L22756-L22759 | .next()、.complete() | complete() | — | — |
| `dispose — 方法` | L22762-L22765 | .dispose() | dispose()、clearInterval() | — | Timers/scheduling |
| `extends 类 — extends` | L22772-L22813 | .dispose()、.shift()、.next()、.delay()、.push()、.complete() | new Date()、constructor()、super()、dispose()、clearTimeout()、delay()、setTimeout()、Number()、next()、Date()、complete() | — | Timers/scheduling |
| `构造函数` | L22775-L22778 | — | constructor()、super() | — | — |
| `dispose — 方法` | L22781-L22784 | .dispose() | dispose()、clearTimeout() | — | Timers/scheduling |
| `delay — 延迟执行` | L22787-L22800 | .shift()、.next()、.delay() | delay()、setTimeout()、Number() | — | Timers/scheduling |
| `next — 执行下一步（迭代器）` | L22803-L22806 | .delay()、.push() | new Date()、next()、Date() | — | — |
| `complete — 完成操作` | L22809-L22812 | .complete() | complete()、setTimeout() | — | Timers/scheduling |
| `extends 类 — extends` | L22819-L22832 | .dispose()、.selector() | constructor()、super()、error() | — | — |
| `构造函数` | L22822-L22825 | — | constructor()、super() | — | — |
| `error — 输出 ERROR 级别日志` | L22828-L22831 | .dispose()、.selector() | error() | — | — |
| `extends 类 — extends` | L22837-L22852 | .delete()、.dispose()、.checkComplete()、.next()、.expandValue() | tryComplete()、next() | — | — |
| `tryComplete — 尝试完成操作` | L22840-L22845 | .delete()、.dispose()、.checkComplete() | tryComplete() | — | — |
| `next — 执行下一步（迭代器）` | L22848-L22851 | .next()、.expandValue() | next() | — | — |
| `extends 类 — extends` | L22856-L22899 | .next()、.expandValue()、.add()、.subscribe()、.makeSource()、.checkComplete()、.resetComplete()、.complete() | new Set()、new GB()、constructor()、super()、Set()、next()、expandValue()、GB()、complete()、checkComplete()、tryComplete() | — | — |
| `构造函数` | L22859-L22862 | — | new Set()、constructor()、super()、Set() | — | — |
| `next — 执行下一步（迭代器）` | L22865-L22868 | .next()、.expandValue() | next() | — | — |
| `expandValue — 展开/扩展值` | L22871-L22880 | .add()、.subscribe()、.makeSource() | new GB()、expandValue()、GB() | — | — |
| `complete — 完成操作` | L22883-L22886 | .checkComplete() | complete() | — | — |
| `checkComplete — 方法` | L22889-L22892 | .resetComplete()、.complete() | checkComplete() | — | — |
| `tryComplete — 尝试完成操作` | L22895-L22898 | .checkComplete() | tryComplete() | — | — |
| `JB — 内部函数` | L22904-L22915 | — | new Promise()、new GU()、Promise()、GU()、t() | — | — |
| `qB — 内部函数` | L22918-L22936 | .bind()、.dispose() | new ReadableStream()、new GU()、ReadableStream()、start()、GU()、cancel() | — | Streams |
| `start — 启动组件/模块（开始工作流程）` | L22925-L22928 | .bind() | new GU()、start()、GU() | — | — |
| `cancel — 方法` | L22931-L22934 | .dispose() | cancel() | — | — |
| `createTapOperator — 内部函数` | L22939-L22947 | — | new GU()、GU() | — | — |
| `extends 类 — extends` | L22951-L22978 | .next()、.complete()、.error() | constructor()、super()、t() | — | — |
| `构造函数` | L22954-L22977 | .next()、.complete()、.error() | constructor()、super()、t() | — | — |
| `extends 类 — extends` | L22984-L23003 | .error()、.next()、.dispose() | new XU()、constructor()、super()、setTimeout()、XU()、next()、clearTimeout()、dispose() | — | Timers/scheduling |
| `构造函数` | L22987-L22990 | .error() | new XU()、constructor()、super()、setTimeout()、XU() | — | Timers/scheduling |
| `next — 执行下一步（迭代器）` | L22993-L22996 | .next() | next()、clearTimeout() | — | Timers/scheduling |
| `dispose — 方法` | L22999-L23002 | .dispose() | dispose()、clearTimeout() | — | Timers/scheduling |
## 本地媒体 Track（L23001-L24700）
详见：`05-MediaStreamTrack-Lifecycle.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `createRetryOperator — 内部函数` | L23008-L23050 | .subscribe()、.error()、.pipe() | new WU()、createObservable()、WU()、t() | — | — |
| `QB — 内部函数` | L23053-L23057 | — | — | — | — |
| `e 类 — e` | L23060-L23556 | .toString()、.addEventListener()、.onTrackMuted()、.onTrackEnded()、.removeEventListener()、.emit()、.addTrack()、.stop()、.getTracks()、.setInputMediaStreamTrack()、.updateDeviceIdInUse()、.listenDeviceChange()、.error()、.concat()、.setOutputMediaStreamTrack()、.setStateToReady()、.replaceTrack()、.add()、.bindParent()、.getLogger()、._checkPublishFlag()、.warn()、.toUpperCase()、.addEnum()、.uploadEvent()、.retryEncodeFailed()、.delete()、.info()、.getSettings()、.then()、.find()、.assign()、.toLocaleLowerCase()、.includes()、.has()、.isNeedToRecapture()、.now()、.recapture()、.getRecoverCaptureDeviceId()、.onTrackUnmuted()；+10 | new Error()、new MediaStream()、new Promise()、new RtcErrorAlias()、constructor()、super()、defineMember()、enableEncodeFrame()、isPublishing()、isPublished()、isUseCustomSource()、encodeFrame()、Error()、installTrackEvent()、uninstallTrackEvent()、setStateToReady()、capture()、asyncGeneratorWrap()、performanceNow()、MediaStream()、TU()、setOutputMediaStreamTrack()、hasFlag()、getMuteStateFromFlag()、publish()、_checkPublishFlag()、Promise()、i()、RtcErrorAlias()、t()、a()、pipeOperator()、fromEventObservable()、GF()、qF()、$U()、createTapOperator()、setTimeout()、getOSNumber()、getDeviceModel()；+22 | addEventListener(StreamConstants.MUTE)、addEventListener(StreamConstants.UNMUTE)、addEventListener(StreamConstants.ENDED)、removeEventListener(StreamConstants.MUTE)、removeEventListener(StreamConstants.UNMUTE)、removeEventListener(StreamConstants.ENDED)、emit(Events.LOCAL_TRACK_CAPTURE_START)、emit(Events.LOCAL_TRACK_CAPTURE_SUCCESS)、emit(Events.LOCAL_TRACK_CAPTURE_FAILED)、emit('4')、emit('6')、emit(Events.LOCAL_TRACK_UNPUBLISHED)、emit('2')、emit('7')、emit('1')、emit(Events.LOCAL_TRACK_RECAPTURE)、emit('5') | MediaStream、MediaStreamTrack、Track constraints/settings/capabilities、Track lifecycle、Page visibility、Timers/scheduling |
| `构造函数` | L23063-L23079 | — | constructor()、super()、defineMember() | — | — |
| `encodeFrame — 编码视频帧` | L23098-L23101 | — | new Error()、encodeFrame()、Error() | — | — |
| `installTrackEvent — 安装轨道事件监听器` | L23104-L23111 | .addEventListener()、.onTrackMuted()、.onTrackEnded() | installTrackEvent() | addEventListener(StreamConstants.MUTE)、addEventListener(StreamConstants.UNMUTE)、addEventListener(StreamConstants.ENDED) | — |
| `uninstallTrackEvent — 卸载轨道事件监听器` | L23114-L23119 | .removeEventListener() | uninstallTrackEvent() | removeEventListener(StreamConstants.MUTE)、removeEventListener(StreamConstants.UNMUTE)、removeEventListener(StreamConstants.ENDED) | — |
| `setStateToReady — 设置状态为就绪` | L23122-L23122 | — | setStateToReady() | — | — |
| `capture — 捕获当前帧` | L23125-L23167 | .emit()、.addTrack()、.stop()、.getTracks()、.setInputMediaStreamTrack()、.updateDeviceIdInUse()、.listenDeviceChange()、.error()、.concat() | new MediaStream()、capture()、asyncGeneratorWrap()、performanceNow()、MediaStream()、TU() | emit(Events.LOCAL_TRACK_CAPTURE_START)、emit(Events.LOCAL_TRACK_CAPTURE_SUCCESS)、emit(Events.LOCAL_TRACK_CAPTURE_FAILED) | MediaStream、Track lifecycle |
| `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | L23170-L23176 | .setOutputMediaStreamTrack()、.setStateToReady()、.replaceTrack() | setOutputMediaStreamTrack() | — | — |
| `publish — 发布本地音视频流到房间` | L23194-L23208 | .add()、.emit()、.bindParent()、.getLogger()、._checkPublishFlag() | publish()、asyncGeneratorWrap() | emit('4') | — |
| `_checkPublishFlag — 方法` | L23211-L23315 | .warn()、.toUpperCase()、.addEnum()、.uploadEvent()、.concat()、.retryEncodeFailed()、.emit() | new Promise()、new RtcErrorAlias()、_checkPublishFlag()、Promise()、asyncGeneratorWrap()、i()、RtcErrorAlias()、t()、a()、pipeOperator()、fromEventObservable()、GF()、qF()、$U()、createTapOperator()、setTimeout()、getOSNumber()、getDeviceModel()、getOSString()、delay() | emit('6') | Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L23216-L23313 | .warn()、.toUpperCase()、.addEnum()、.uploadEvent()、.concat()、.retryEncodeFailed()、.emit() | new RtcErrorAlias()、asyncGeneratorWrap()、i()、RtcErrorAlias()、t()、a()、pipeOperator()、fromEventObservable()、GF()、qF()、$U()、createTapOperator()、setTimeout()、getOSNumber()、getDeviceModel()、getOSString()、delay() | emit('6') | Timers/scheduling |
| `l — 内部函数` | L23238-L23310 | .warn()、.toUpperCase()、.addEnum()、.uploadEvent()、.concat()、.retryEncodeFailed()、.emit() | new RtcErrorAlias()、setTimeout()、asyncGeneratorWrap()、t()、getOSNumber()、getDeviceModel()、getOSString()、delay()、i()、RtcErrorAlias() | emit('6') | Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L23244-L23310 | .warn()、.toUpperCase()、.addEnum()、.uploadEvent()、.concat()、.retryEncodeFailed()、.emit() | new RtcErrorAlias()、asyncGeneratorWrap()、t()、getOSNumber()、getDeviceModel()、getOSString()、delay()、i()、RtcErrorAlias() | emit('6') | — |
| `unpublish — 取消发布本地音视频流` | L23318-L23323 | .delete()、.info()、.emit() | unpublish() | emit(Events.LOCAL_TRACK_UNPUBLISHED) | — |
| `updateDeviceIdInUse — 更新当前使用的设备 ID` | L23326-L23371 | .getSettings()、.then()、.find()、.emit() | updateDeviceIdInUse()、asyncGeneratorWrap()、yield()、findDeviceById()、handleEncryption() | emit('2') | Track constraints/settings/capabilities |
| `setProfile — 方法` | L23374-L23377 | .info()、.assign() | setProfile() | — | — |
| `isNeedToRecapture — 检查是否需要重新采集` | L23380-L23415 | .toLocaleLowerCase()、.includes()、.concat()、.getSettings()、.has() | isNeedToRecapture()、Boolean() | — | MediaStreamTrack、Track constraints/settings/capabilities |
| `onTrackMuted — 轨道被静音回调` | L23418-L23440 | .onTrackMuted()、.isNeedToRecapture()、.now()、.recapture()、.getRecoverCaptureDeviceId() | onTrackMuted()、AU()、setTimeout()、asyncGeneratorWrap() | — | Page visibility、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L23427-L23436 | .recapture()、.getRecoverCaptureDeviceId() | asyncGeneratorWrap() | — | Page visibility |
| `onTrackUnmuted — 轨道取消静音回调` | L23443-L23446 | .onTrackUnmuted() | onTrackUnmuted()、clearTimeout() | — | Timers/scheduling |
| `onTrackEnded — 轨道结束回调` | L23449-L23461 | .call()、.isNeedToRecapture()、.now()、.onTrackEnded()、.emit()、.recapture()、.getRecoverCaptureDeviceId() | onTrackEnded()、asyncGeneratorWrap()、getModuleExport()、setTimeout() | emit('7') | Timers/scheduling |
| `recapture — 重新捕获屏幕/设备` | L23464-L23510 | .warn()、.stop()、.now()、.find()、.capture()、.then()、.emit()、.catch()、.concat()、.finally() | recapture()、asyncGeneratorWrap()、getMicrophoneTrackList()、getCameraTrackList() | emit('1')、emit(Events.LOCAL_TRACK_RECAPTURE)、emit('5') | Track lifecycle |
| `getRecoverCaptureDeviceId — 获取恢复捕获的设备 ID` | L23513-L23539 | .get()、.set()、.find()、.has()、.warn()、.concat() | getRecoverCaptureDeviceId()、asyncGeneratorWrap()、getCameraTrackList()、getMicrophoneTrackList() | — | — |
| `stopCapture — 停止捕获` | L23542-L23549 | .stop()、.uninstallTrackEvent()、.removeInput() | stopCapture() | — | Track lifecycle |
| `close — 关闭本地流并释放所有轨道` | L23552-L23555 | .close()、.stopCapture() | close() | — | — |
| `success — 操作成功回调` | L23566-L23571 | .emit()、.info() | success() | emit(Events.LOCAL_TRACK_PUBLISHED)、emit('4') | — |
| `fail — 操作失败回调` | L23574-L23595 | .delete()、.includes()、.emit() | fail() | emit('4') | — |
| `e 类 — e` | L23634-L24062 | .pipeTo()、.bind()、.on()、.getVolumeDb()、.floor()、.max()、.log10()、.getAudioLevel()、.getInternalAudioLevelAfter3A()、.addEnum()、.info()、.concat()、.stringify()、.replaceSource()、.call()、.updatePlayingState()、.stop()、.capture()、.emit()、.error()、.recapture()、.listeners()、.includes()、.warn()、.off()、.getConstraints()、.applyConstraints()、.catch()、.setVolume()、.setAudioVolume()、.setMuted()、.setNode()、.createGain()、.update3A()、.enableTrackANS()、.has()、.set()、.get()、.deleteNode()、.delete()；+8 | new AudioNode()、new Map()、new AudioPipeline()、constructor()、super()、defineMember()、AudioNode()、Map()、AudioPipeline()、dbVolume()、getAudioLevel()、getInternalAudioLevelAfter3A()、updateAfter3aSilenceStartTime()、isUndefined()、performanceNow()、setInputMediaStreamTrack()、asyncGeneratorWrap()、getModuleExport()、Boolean()、capture()、resumeAudioContext()、switchDevice()、findDeviceById()、listenDeviceChange()、handleMicrophoneRemoved()、enqueueReportEvent()、getMicrophoneTrackList()、handleMicrophoneAdded()、update3A()、captureVolume()、setCaptureVolume()、setAudioVolume()、observableValue()、enableTrackANS()、enableTrackAEC()、addDenoiser()、mixAudioReference()、getOrCreateAudioNode()、unMixAudioReference()、setAudioReferenceVolume()；+12 | on(Events.AUDIO_CONTEXT_LONG_SUSPENDED)、on('audioInputRemoved')、on('audioInputAdded')、emit(Events.SWITCH_DEVICE_SUCCESS) | MediaStreamTrack、Track constraints/settings/capabilities、Track lifecycle、AudioContext、Web Audio nodes、Streams |
| `构造函数` | L23637-L23667 | .pipeTo()、.bind()、.on() | new AudioNode()、new Map()、new AudioPipeline()、constructor()、super()、defineMember()、AudioNode()、Map()、AudioPipeline() | on(Events.AUDIO_CONTEXT_LONG_SUSPENDED) | Streams |
| `getAudioLevel — 获取当前音频电平值` | L23676-L23682 | .getAudioLevel() | getAudioLevel() | — | — |
| `getInternalAudioLevelAfter3A — 获取经过 3A 处理后的音频电平` | L23685-L23688 | .getInternalAudioLevelAfter3A() | getInternalAudioLevelAfter3A() | — | — |
| `updateAfter3aSilenceStartTime — 更新 3A 处理后静音开始时间` | L23691-L23697 | — | updateAfter3aSilenceStartTime()、isUndefined()、performanceNow() | — | — |
| `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | L23700-L23717 | .addEnum()、.info()、.concat()、.stringify()、.replaceSource()、.call()、.updatePlayingState() | setInputMediaStreamTrack()、asyncGeneratorWrap()、getModuleExport()、Boolean() | — | — |
| `capture — 捕获当前帧` | L23720-L23753 | .call() | capture()、asyncGeneratorWrap()、getModuleExport()、resumeAudioContext() | — | — |
| `switchDevice — 切换采集设备` | L23756-L23785 | .info()、.concat()、.stop()、.capture()、.emit()、.error()、.recapture() | switchDevice()、asyncGeneratorWrap()、findDeviceById() | emit(Events.SWITCH_DEVICE_SUCCESS) | Track lifecycle |
| `listenDeviceChange — 监听设备插拔事件` | L23788-L23793 | .listeners()、.includes()、.on() | listenDeviceChange() | on('audioInputRemoved') | — |
| `handleMicrophoneRemoved — 麦克风拔出事件回调` | L23796-L23821 | .warn()、.concat()、.stringify()、.recapture()、.on() | handleMicrophoneRemoved()、asyncGeneratorWrap()、enqueueReportEvent()、getMicrophoneTrackList() | on('audioInputAdded') | — |
| `handleMicrophoneAdded — 麦克风插入事件回调` | L23824-L23830 | .off()、.warn()、.concat()、.stringify()、.recapture() | handleMicrophoneAdded() | — | — |
| `update3A — 更新 3A（AGC/AEC/ANS）参数` | L23833-L23864 | .getConstraints()、.applyConstraints()、.catch()、.warn()、.recapture() | update3A()、asyncGeneratorWrap()、isUndefined() | — | Track constraints/settings/capabilities |
| `setCaptureVolume — 设置采集音量` | L23871-L23874 | .setVolume()、.addEnum() | setCaptureVolume() | — | — |
| `setAudioVolume — 设置音频音量` | L23877-L23884 | .setAudioVolume()、.setMuted()、.setNode()、.createGain() | setAudioVolume()、observableValue() | — | Web Audio nodes |
| `enableTrackANS — 启用/禁用轨道噪音抑制（ANS）` | L23887-L23890 | .update3A() | enableTrackANS() | — | — |
| `enableTrackAEC — 启用/禁用轨道回声消除（AEC）` | L23893-L23896 | .update3A() | enableTrackAEC() | — | — |
| `addDenoiser — 添加降噪处理器` | L23899-L23906 | .warn()、.addEnum()、.setNode()、.enableTrackANS() | addDenoiser() | — | — |
| `mixAudioReference — 混音音频参考` | L23909-L23926 | .has()、.info()、.concat()、.createGain()、.pipeTo()、.setNode()、.set() | new AudioNode()、mixAudioReference()、getOrCreateAudioNode()、AudioNode()、observableValue() | — | Web Audio nodes、Streams |
| `unMixAudioReference — 取消混音音频参考` | L23929-L23938 | .get()、.info()、.concat()、.deleteNode()、.delete() | unMixAudioReference() | — | — |
| `setAudioReferenceVolume — 设置音频参考音量` | L23941-L23949 | .get()、.info()、.concat() | setAudioReferenceVolume() | — | — |
| `addAudioProcessor — 添加音频处理器` | L23952-L23955 | .setNode() | addAudioProcessor() | — | — |
| `removeDenoiser — 移除降噪处理器` | L23958-L23961 | .deleteNode()、.enableTrackANS() | removeDenoiser() | — | — |
| `removeAudioProcessor — 移除音频处理器` | L23964-L23968 | .deleteNode() | removeAudioProcessor() | — | — |
| `close — 关闭本地流并释放所有轨道` | L23971-L23987 | .forEach()、.deleteNode()、.clear()、.remove()、.off()、.close() | close() | — | — |
| `recapture — 重新捕获屏幕/设备` | L23990-L24009 | .call()、.find() | recapture()、asyncGeneratorWrap()、getModuleExport()、getMicrophoneTrackList() | — | — |
| `encodeFrame — 编码视频帧` | L24012-L24017 | .reduceRight() | encodeFrame()、t()、getServerTime() | — | — |
| `handleAudioContextLongSuspended — 处理 AudioContext 长时间挂起` | L24028-L24049 | .warn()、.concat()、.setOutputMediaStreamTrack() | handleAudioContextLongSuspended() | — | — |
| `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | L24052-L24061 | .setOutputMediaStreamTrack() | setOutputMediaStreamTrack() | — | — |
| `构造函数` | L24066-L24071 | .addPreventionByte()、.removePreventionByte() | constructor() | — | — |
| `addPreventionByte — 添加防检测字节` | L24074-L24101 | .getInt8()、.push()、.slice() | new DataView()、new Uint8Array()、addPreventionByte()、DataView()、Uint8Array() | — | Encoding/binary |
| `removePreventionByte — 移除防检测字节` | L24104-L24126 | .getInt8()、.push()、.slice() | new DataView()、new Uint8Array()、removePreventionByte()、DataView()、Uint8Array() | — | Encoding/binary |
| `构造函数` | L24171-L24174 | — | constructor()、defineMember() | — | — |
| `encodeSEINalu — 编码 SEI NALU（H264 补充增强信息）` | L24177-L24191 | .push() | new DataView()、new Uint8Array()、new iH()、encodeSEINalu()、parseInt()、String()、DataView()、Uint8Array()、iH() | — | Encoding/binary |
| `sendSEI — 发送 SEI 消息` | L24194-L24199 | .push() | sendSEI() | — | — |
| `isEmpty — 方法` | L24202-L24205 | — | isEmpty() | — | — |
| `getNaluCount — 获取 NALU 单元计数` | L24208-L24228 | .getUint8() | new DataView()、getNaluCount()、DataView() | — | Encoding/binary |
| `encode — 编码视频/音频数据` | L24231-L24256 | .getNaluCount()、.splice()、.reverse()、.map()、.bind()、.reduce()、.setInt8()、.getInt8() | new ArrayBuffer()、new DataView()、encode()、ArrayBuffer()、DataView() | — | Encoding/binary |
| `e 类 — e` | L24260-L24768 | .isAllowed2k4k()、.sendAbilityStatus()、.warn()、.concat()、.setProfile()、.applyProfile()、.on()、.bind()、.getSettings()、.deleteWatermark()、.setWatermark()、.call()、.getDeviceIdWhenUsingBackCamera()、.fallbackProfile()、.recapture()、.applyConstraints()、.changeInput()、.setBandWidth()、.assign()、.isNeedToSwitchDevice()、.stop()、.capture()、.emit()、.info()、.error()、.map()、.filter()、.includes()、.forEach()、.stringify()、.update()、.enableSmall()、.max()、.listeners()、.off()、.reduceRight()、.some()、.setMirror()、.play()、.close()；+1 | new rH()、constructor()、super()、defineMember()、objectMixin()、rH()、isSecondsTimestamp()、assignDescriptors()、facingMode()、contentHint()、isQosClearFirst()、hasSmall()、setMute()、asyncGeneratorWrap()、isString()、yield()、getModuleExport()、capture()、setProfile()、applyProfile()、settings()、scaleResolutionDownBy()、calculateScaleResolutionDownNumber()、isAllowed2k4k()、isNeedToSwitchDevice()、switchDevice()、getDeviceIdWhenUsingBackCamera()、getCameraTrackList()、updateSmallConfig()、fallbackProfile()、isVersionLessThan()、isVersionGreaterThan()、isMobile()、stopSmall()、listenDeviceChange()、handleCameraRemoved()、enqueueReportEvent()、handleCameraAdded()、encodeFrame()、t()；+8 | on('input-media-track-changed')、on('publish')、on('7')、on('videoInputRemoved')、on('videoInputAdded')、emit(Events.SWITCH_DEVICE_SUCCESS) | Track constraints/settings/capabilities、Track lifecycle、Media playback |
| `构造函数` | L24263-L24308 | .isAllowed2k4k()、.sendAbilityStatus()、.warn()、.concat()、.setProfile()、.applyProfile()、.on()、.bind() | new rH()、constructor()、super()、defineMember()、objectMixin()、rH()、isSecondsTimestamp()、assignDescriptors() | on('input-media-track-changed')、on('publish') | — |
| `t — 源码命名函数` | L24285-L24302 | .isAllowed2k4k()、.sendAbilityStatus()、.warn()、.concat()、.setProfile()、.applyProfile() | isSecondsTimestamp()、assignDescriptors()、objectMixin() | — | — |
| `setMute — 设置静音状态` | L24336-L24363 | .deleteWatermark()、.setWatermark()、.call() | setMute()、asyncGeneratorWrap()、isString()、yield()、getModuleExport() | — | — |
| `capture — 捕获当前帧` | L24366-L24405 | .getDeviceIdWhenUsingBackCamera()、.call() | capture()、asyncGeneratorWrap()、getModuleExport() | — | — |
| `setProfile — 方法` | L24408-L24425 | .fallbackProfile()、.isAllowed2k4k()、.setProfile()、.warn()、.concat() | setProfile()、isSecondsTimestamp()、assignDescriptors()、objectMixin() | — | — |
| `applyProfile — 应用编码 Profile 配置` | L24428-L24472 | .getSettings()、.recapture()、.applyConstraints()、.changeInput()、.sendAbilityStatus()、.warn()、.setBandWidth() | applyProfile()、asyncGeneratorWrap()、yield() | — | Track constraints/settings/capabilities |
| `isAllowed2k4k — 检查是否允许 2K/4K 分辨率` | L24487-L24496 | — | isAllowed2k4k() | — | — |
| `isNeedToSwitchDevice — 检查是否需要切换设备` | L24499-L24502 | — | isNeedToSwitchDevice() | — | — |
| `switchDevice — 切换采集设备` | L24505-L24527 | .isNeedToSwitchDevice()、.stop()、.capture()、.emit()、.info()、.error()、.concat()、.recapture() | switchDevice()、asyncGeneratorWrap() | emit(Events.SWITCH_DEVICE_SUCCESS) | Track lifecycle |
| `getDeviceIdWhenUsingBackCamera — 方法` | L24530-L24579 | .map()、.call()、.filter()、.includes()、.forEach()、.info()、.warn() | getDeviceIdWhenUsingBackCamera()、asyncGeneratorWrap()、getCameraTrackList()、assignDescriptors()、objectMixin() | — | — |
| `updateSmallConfig — 更新小流配置` | L24582-L24593 | .info()、.concat()、.stringify()、.fallbackProfile()、.update()、.enableSmall() | updateSmallConfig() | — | — |
| `fallbackProfile — 降级编码 Profile` | L24596-L24648 | .warn()、.concat()、.max()、.on() | fallbackProfile()、objectMixin()、isVersionLessThan()、isVersionGreaterThan()、isMobile() | on('7') | — |
| `stopSmall — 停止小流推送` | L24651-L24657 | .update()、.enableSmall() | stopSmall() | — | — |
| `listenDeviceChange — 监听设备插拔事件` | L24660-L24665 | .listeners()、.includes()、.on() | listenDeviceChange() | on('videoInputRemoved') | — |
| `handleCameraRemoved — 摄像头拔出事件回调` | L24668-L24691 | .warn()、.concat()、.stringify()、.recapture()、.on() | handleCameraRemoved()、asyncGeneratorWrap()、enqueueReportEvent()、getCameraTrackList() | on('videoInputAdded') | — |
| `handleCameraAdded — 摄像头插入事件回调` | L24694-L24703 | .off()、.warn()、.concat()、.stringify()、.recapture() | handleCameraAdded()、asyncGeneratorWrap() | — | — |
## Canvas、WebGL 与混流（L24701-L27600）
详见：`07-Media-Playback-and-Rendering.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `encodeFrame — 编码视频帧` | L24706-L24713 | .reduceRight() | encodeFrame()、t() | — | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L24720-L24723 | .setMirror()、.play() | play()、isUndefined() | — | Media playback |
| `close — 关闭本地流并释放所有轨道` | L24726-L24731 | .off()、.close() | close() | — | — |
| `recapture — 重新捕获屏幕/设备` | L24734-L24750 | .call()、.find() | recapture()、asyncGeneratorWrap()、getModuleExport()、getCameraTrackList() | — | — |
| `setContentHint — 设置轨道内容提示（motion/detail/text）` | L24753-L24760 | .info()、.concat() | setContentHint() | — | — |
| `setRotation — 设置视频旋转角度` | L24763-L24767 | — | setRotation()、isUndefined() | — | — |
| `cleanupAfterUnpublish — 取消发布后清理` | L24774-L24777 | .setContentHint() | cleanupAfterUnpublish() | — | — |
| `e 类 — e` | L24855-L25257 | .on()、.createElement()、.getContext()、.createBuffer()、.createTexture()、.useTexture()、.texParameteri()、.pixelStorei()、.createFramebuffer()、.useBufferFrame()、.texImage2D()、.framebufferTexture2D()、.createShader()、.createProgram()、.destroy()、.concat()、.bindFramebuffer()、.addInput()、.resize()、.now()、.render()、.render2d()、.requestFrame()、.draw2d()、.update()、.removeInput()、.off()、.disconnect()、.deleteBuffer()、.deleteFramebuffer()、.deleteTexture()、.deleteShader()、.deleteProgram()、.removeAllListeners()、.useTextures()、.forEach()、.activeTexture()、.bindTexture()、.useProgram()、.bindBuffer()；+14 | new OffscreenCanvas()、new RtcErrorAlias()、new Array()、new Float32Array()、constructor()、super()、defineMember()、OffscreenCanvas()、RtcErrorAlias()、image()、createFramebuffer()、connect()、Array()、addInput()、requestFrame()、Boolean()、render2d()、update()、disconnect()、removeInput()、close()、useTexture()、useInputTexture()、useTextures()、useProgram()、useBufferFrame()、createBuffer()、Float32Array()、setTexBuffer()、setPosBuffer()、changeBufferData()、setAttributes()、getVertexPoint()、layout2texCoords()、resize()、draw()、draw2d()、isUndefined()、drawBackGround2d()、getInfo()；+2 | on('disconnect')、emit(e.RENDER) | WebSocket、Canvas 2D、WebGL、OffscreenCanvas、WebCodecs、DOM、Encoding/binary |
| `构造函数` | L24858-L24946 | .on()、.createElement()、.getContext()、.createBuffer()、.createTexture()、.useTexture()、.texParameteri()、.pixelStorei()、.createFramebuffer()、.useBufferFrame()、.texImage2D()、.framebufferTexture2D()、.createShader()、.createProgram()、.destroy()、.concat() | new OffscreenCanvas()、new RtcErrorAlias()、constructor()、super()、defineMember()、OffscreenCanvas()、RtcErrorAlias() | on('disconnect') | Canvas 2D、WebGL、OffscreenCanvas、DOM |
| `createFramebuffer — 方法` | L24957-L24968 | .createFramebuffer()、.bindFramebuffer()、.framebufferTexture2D() | createFramebuffer() | — | WebGL |
| `connect — 建立 WebSocket 信令连接` | L24971-L24976 | .addInput() | new Array()、connect()、Array() | — | — |
| `addInput — 添加混音输入` | L24979-L24982 | .resize() | addInput() | — | — |
| `requestFrame — 方法` | L24985-L24994 | .now()、.render()、.render2d() | requestFrame()、Boolean() | — | — |
| `render2d — 2D 渲染视频帧` | L24997-L25006 | .requestFrame()、.draw2d() | render2d() | — | — |
| `update — 方法` | L25009-L25015 | .update() | update() | — | — |
| `disconnect — 断开 WebSocket 信令连接` | L25018-L25022 | .removeInput() | new Array()、disconnect()、Array() | — | — |
| `removeInput — 移除混音输入` | L25025-L25028 | — | removeInput() | — | — |
| `close — 关闭本地流并释放所有轨道` | L25031-L25057 | .off()、.removeInput()、.disconnect()、.deleteBuffer()、.deleteFramebuffer()、.deleteTexture()、.deleteShader()、.deleteProgram()、.removeAllListeners() | close() | — | — |
| `useTexture — 使用指定纹理` | L25060-L25063 | .useTextures() | useTexture() | — | — |
| `useInputTexture — 方法` | L25066-L25071 | .useTextures() | useInputTexture() | — | — |
| `useTextures — 方法` | L25074-L25083 | .forEach()、.activeTexture()、.bindTexture() | new Array()、useTextures()、Array() | — | — |
| `useProgram — 方法` | L25086-L25089 | .useProgram() | useProgram() | — | — |
| `useBufferFrame — 使用缓冲区帧` | L25092-L25097 | .bindFramebuffer() | useBufferFrame() | — | WebGL |
| `createBuffer — 方法` | L25100-L25107 | .createBuffer()、.bindBuffer()、.bufferData() | new Float32Array()、createBuffer()、Float32Array() | — | Encoding/binary |
| `setTexBuffer — 方法` | L25110-L25116 | .bindBuffer()、.bufferData() | new Float32Array()、setTexBuffer()、Float32Array() | — | Encoding/binary |
| `setPosBuffer — 设置位置缓冲区` | L25119-L25125 | .bindBuffer()、.bufferData() | new Float32Array()、setPosBuffer()、Float32Array() | — | Encoding/binary |
| `changeBufferData — 方法` | L25128-L25133 | .bindBuffer()、.bufferData() | new Float32Array()、changeBufferData()、Float32Array() | — | Encoding/binary |
| `setAttributes — 设置属性` | L25136-L25145 | .forEach()、.enableVertexAttribArray()、.bindBuffer()、.vertexAttribPointer() | new Array()、setAttributes()、Array() | — | — |
| `getVertexPoint — 获取顶点坐标` | L25148-L25151 | — | getVertexPoint() | — | — |
| `layout2texCoords — 布局到纹理坐标映射` | L25154-L25162 | .getVertexPoint() | layout2texCoords() | — | — |
| `resize — 调整渲染尺寸` | L25165-L25183 | .useTexture()、.texImage2D()、.resize() | resize() | — | WebGL |
| `draw — 绘制视频帧` | L25186-L25192 | .setAttributes()、.drawArrays() | draw() | — | WebGL |
| `draw2d — 2D 绘制` | L25195-L25210 | .putImageData()、.emit()、.drawImage()、.close() | draw2d()、isUndefined() | emit(e.RENDER) | Canvas 2D、WebCodecs |
| `drawBackGround2d — 绘制 2D 背景` | L25213-L25220 | .save()、.fillRect()、.restore() | drawBackGround2d() | — | — |
| `getInfo — 获取信息` | L25223-L25237 | .now()、.getInfo() | getInfo()、objectMixin() | — | — |
| `l — 内部函数` | L25230-L25234 | — | — | — | — |
| `createTexture — 创建 WebGL 纹理` | L25240-L25256 | .createTexture()、.useTextures()、.texParameteri()、.pixelStorei()、.texImage2D() | createTexture() | — | WebGL |
| `extends 类 — extends` | L25272-L25387 | .assign()、.setTexBuffer()、.info()、.concat()、.clearTask()、.run()、.start()、.requestFrame()、.getError()、.destroy()、.useProgram()、.useBufferFrame()、.useInputTexture()、.draw()、.emit()、.addInput()、.removeEventListener()、.addEventListener()、.removeInput()、.resize()、.setSize()、.close() | new RtcErrorAlias()、new Array()、constructor()、super()、defineMember()、start()、RtcErrorAlias()、render()、addInput()、Array()、update()、removeInput()、resize()、close() | addEventListener('visibilitychange')、removeEventListener('visibilitychange')、emit(dH.RENDER) | DOM、Page visibility |
| `构造函数` | L25275-L25285 | .assign()、.setTexBuffer() | constructor()、super()、defineMember() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L25288-L25320 | .info()、.concat()、.clearTask()、.run()、.start()、.requestFrame()、.getError()、.destroy() | new RtcErrorAlias()、start()、RtcErrorAlias() | — | — |
| `render — 渲染视频帧到画布` | L25323-L25337 | .requestFrame()、.useProgram()、.useBufferFrame()、.useInputTexture()、.draw()、.emit() | render() | emit(dH.RENDER) | — |
| `addInput — 添加混音输入` | L25340-L25344 | .addInput()、.start() | new Array()、addInput()、Array() | — | — |
| `update — 方法` | L25347-L25366 | .clearTask()、.info()、.concat()、.start()、.removeEventListener()、.addEventListener()、.requestFrame() | update() | addEventListener('visibilitychange')、removeEventListener('visibilitychange') | DOM、Page visibility |
| `removeInput — 移除混音输入` | L25369-L25372 | .removeInput()、.clearTask() | removeInput() | — | — |
| `resize — 调整渲染尺寸` | L25375-L25378 | .resize()、.setSize() | resize() | — | — |
| `close — 关闭本地流并释放所有轨道` | L25381-L25386 | .close()、.clearTask()、.removeEventListener() | close() | removeEventListener('visibilitychange') | DOM、Page visibility |
| `extends 类 — extends` | L25390-L25497 | .createElement()、.captureStream()、.getVideoTracks()、.destroy()、.now()、.dispose()、.getElementById()、.info()、.concat()、.appendChild()、.putCanvasIntoDom()、.render()、.render2d()、.close()、.stop()、.remove() | new RtcErrorAlias()、constructor()、super()、defineMember()、fromEventObservable()、Number()、pipeOperator()、qF()、createTapOperator()、RtcErrorAlias()、enableCheckMute()、reportManager()、QF()、JF()、GF()、disableCheckMute()、videoTrack()、putCanvasIntoDom()、render()、render2d()、close() | — | Track lifecycle、Canvas 2D、DOM、Page visibility、Performance |
| `构造函数` | L25393-L25415 | .createElement()、.captureStream()、.getVideoTracks()、.destroy() | new RtcErrorAlias()、constructor()、super()、defineMember()、fromEventObservable()、Number()、pipeOperator()、qF()、createTapOperator()、RtcErrorAlias() | — | Canvas 2D、DOM |
| `enableCheckMute — 方法` | L25418-L25450 | .now()、.destroy() | new RtcErrorAlias()、enableCheckMute()、pipeOperator()、qF()、reportManager()、QF()、JF()、GF()、createTapOperator()、RtcErrorAlias() | — | Page visibility、Performance |
| `disableCheckMute — 方法` | L25453-L25458 | .dispose() | disableCheckMute() | — | — |
| `putCanvasIntoDom — 将 Canvas 插入到 DOM` | L25465-L25473 | .getElementById()、.info()、.concat()、.appendChild() | putCanvasIntoDom() | — | DOM |
| `render — 渲染视频帧到画布` | L25476-L25479 | .putCanvasIntoDom()、.render() | render() | — | — |
| `render2d — 2D 渲染视频帧` | L25482-L25485 | .putCanvasIntoDom()、.render2d() | render2d() | — | — |
| `close — 关闭本地流并释放所有轨道` | L25488-L25496 | .close()、.stop()、.remove() | close() | — | Track lifecycle |
| `extends 类 — extends` | L25500-L25518 | .requestFrame()、.getContext()、.clearRect()、.drawImage() | render() | — | Canvas 2D |
| `render — 渲染视频帧到画布` | L25503-L25517 | .requestFrame()、.getContext()、.clearRect()、.drawImage() | render() | — | Canvas 2D |
| `extends 类 — extends` | L25521-L25555 | .info()、.concat()、.warn()、.resize()、.sqrt() | constructor()、super()、resize() | — | — |
| `构造函数` | L25524-L25527 | — | constructor()、super() | — | — |
| `resize — 调整渲染尺寸` | L25530-L25554 | .info()、.concat()、.warn()、.resize()、.sqrt() | resize() | — | — |
| `extends 类 — extends` | L25558-L25680 | .update()、.cancelVideoFrameCallback()、.requestVideoFrameCallback()、.onFirstFrame()、.tryVideoFrameCallback()、.close()、.useTexture()、.texSubImage2D()、.texImage2D()、.resize()、.next()、._render() | constructor()、super()、objectMixin()、defineMember()、createSubjectFromObservable()、pipeOperator()、combineObservableSources()、IB()、fromEventObservable()、emptyObservable()、qF()、createTapOperator()、onFirstFrame()、tryVideoFrameCallback()、hasVideoFrameCallback()、_render()、image()、render()、render2d() | — | Media playback、WebGL、OffscreenCanvas、WebCodecs、Page visibility |
| `构造函数` | L25561-L25584 | .update() | constructor()、super()、objectMixin()、defineMember()、createSubjectFromObservable()、pipeOperator()、combineObservableSources()、IB()、fromEventObservable()、emptyObservable()、qF()、createTapOperator() | — | — |
| `onFirstFrame — 首帧渲染回调` | L25587-L25590 | — | onFirstFrame() | — | — |
| `tryVideoFrameCallback — 尝试使用 VideoFrameCallback` | L25593-L25606 | .cancelVideoFrameCallback()、.requestVideoFrameCallback()、.onFirstFrame()、.update() | tryVideoFrameCallback()、hasVideoFrameCallback() | — | Media playback、Page visibility |
| `_render — 方法` | L25609-L25657 | .tryVideoFrameCallback()、.close()、.useTexture()、.texSubImage2D()、.texImage2D()、.resize() | _render() | — | WebGL、OffscreenCanvas、WebCodecs |
| `render — 渲染视频帧到画布` | L25670-L25673 | ._render() | render() | — | — |
| `render2d — 2D 渲染视频帧` | L25676-L25679 | ._render() | render2d() | — | — |
| `extends 类 — extends` | L25683-L25711 | .tryVideoFrameCallback() | constructor()、super()、pipeOperator()、fromEventObservable()、qF()、GF()、createTapOperator()、image() | — | — |
| `构造函数` | L25686-L25706 | .tryVideoFrameCallback() | constructor()、super()、pipeOperator()、fromEventObservable()、qF()、GF()、createTapOperator() | — | — |
| `extends 类 — extends` | L25714-L25740 | .play()、.setTrack()、.close()、.stop() | new VideoPlayer()、available()、constructor()、super()、VideoPlayer()、replaceTrack()、close() | — | Track lifecycle、Media playback |
| `构造函数` | L25722-L25727 | .play() | new VideoPlayer()、constructor()、super()、VideoPlayer() | — | Media playback |
| `replaceTrack — 替换本地流中的指定轨道` | L25730-L25733 | .setTrack()、.play() | replaceTrack() | — | Media playback |
| `close — 关闭本地流并释放所有轨道` | L25736-L25739 | .close()、.stop() | close() | — | Track lifecycle |
| `extends 类 — extends` | L25743-L25822 | .clearRect()、.drawMultilineText()、.resize()、.measureText()、.match()、.split()、.fillText() | constructor()、super()、assignDescriptors()、objectMixin()、defineMember()、font()、color()、render2d()、render()、resize()、drawMultilineText()、parseInt() | — | — |
| `构造函数` | L25746-L25755 | — | constructor()、super()、assignDescriptors()、objectMixin()、defineMember() | — | — |
| `render2d — 2D 渲染视频帧` | L25780-L25786 | .clearRect()、.drawMultilineText() | render2d() | — | — |
| `render — 渲染视频帧到画布` | L25789-L25792 | — | render() | — | — |
| `resize — 调整渲染尺寸` | L25795-L25801 | .resize() | resize() | — | — |
| `drawMultilineText — 绘制多行文本` | L25804-L25821 | .measureText()、.match()、.split()、.fillText() | drawMultilineText()、parseInt() | — | — |
| `o — 内部函数` | L25817-L25913 | .split()、.fillText()、.createChild()、.concat()、.assign()、.emit() | new TH()、new mH()、new gH()、new EH()、new vH()、parseInt()、constructor()、super()、defineMember()、canvas()、width()、height()、setSize()、createVideoTrackSource()、TH()、createVideoTrackDestination()、mH()、createVideoImageSource()、gH()、createVideoPlayerSource()、EH()、createTextSource()、vH()、available()、disconnect() | emit('disconnect') | WebSocket |
| `extends 类 — extends` | L25825-L25913 | .createChild()、.concat()、.assign()、.emit() | new TH()、new mH()、new gH()、new EH()、new vH()、constructor()、super()、defineMember()、canvas()、width()、height()、setSize()、createVideoTrackSource()、TH()、createVideoTrackDestination()、mH()、createVideoImageSource()、gH()、createVideoPlayerSource()、EH()、createTextSource()、vH()、available()、disconnect() | emit('disconnect') | WebSocket |
| `构造函数` | L25828-L25840 | .createChild()、.concat() | constructor()、super()、defineMember() | — | — |
| `setSize — 设置画布尺寸` | L25869-L25872 | — | setSize() | — | — |
| `createVideoTrackSource — 创建视频轨道源` | L25875-L25878 | — | new TH()、createVideoTrackSource()、TH() | — | — |
| `createVideoTrackDestination — 创建视频轨道目标` | L25881-L25884 | — | new mH()、createVideoTrackDestination()、mH() | — | — |
| `createVideoImageSource — 创建视频图像源` | L25887-L25890 | .assign() | new gH()、createVideoImageSource()、gH() | — | — |
| `createVideoPlayerSource — 创建视频播放器源` | L25893-L25896 | .assign() | new EH()、createVideoPlayerSource()、EH() | — | — |
| `createTextSource — 创建文字源` | L25899-L25902 | .assign() | new vH()、createTextSource()、vH() | — | — |
| `disconnect — 断开 WebSocket 信令连接` | L25909-L25912 | .emit() | disconnect() | emit('disconnect') | — |
| `extends 类 — extends` | L25928-L26044 | .createElement()、.concat()、.getContext()、.createShader()、.createProgram()、.addEventListener()、.destroy()、.addFailedEvent()、.disconnect()、.info()、.deleteShader()、.deleteProgram()、.viewport()、.setSize()、.shaderSource()、.compileShader()、.attachShader()、.linkProgram()、.getProgramParameter()、.error()、.getProgramInfoLog() | new RtcErrorAlias()、constructor()、super()、defineMember()、canvas()、create()、RtcErrorAlias()、destroy()、width()、height()、setSize()、createShader()、createProgram() | addEventListener('webglcontextlost') | WebGL、DOM |
| `构造函数` | L25931-L25939 | — | constructor()、super()、defineMember() | — | — |
| `create — 方法` | L25946-L25972 | .createElement()、.concat()、.getContext()、.createShader()、.createProgram()、.addEventListener()、.destroy() | new RtcErrorAlias()、create()、RtcErrorAlias() | addEventListener('webglcontextlost') | WebGL、DOM |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L25975-L25991 | .addFailedEvent()、.disconnect()、.info()、.concat()、.deleteShader()、.deleteProgram() | destroy() | — | — |
| `setSize — 设置画布尺寸` | L26010-L26017 | .viewport()、.setSize() | setSize() | — | — |
| `createShader — 方法` | L26020-L26027 | .createShader()、.shaderSource()、.compileShader() | createShader() | — | WebGL |
| `createProgram — 方法` | L26030-L26043 | .createProgram()、.attachShader()、.linkProgram()、.getProgramParameter()、.error()、.getProgramInfoLog() | createProgram() | — | WebGL |
| `fail — 操作失败回调` | L26053-L26057 | .error()、.addFailedEvent() | fail() | — | — |
| `success — 操作成功回调` | L26060-L26063 | .info()、.addSuccessEvent() | success() | — | — |
| `success — 操作成功回调` | L26077-L26080 | .emit()、.removeAllListeners() | success() | emit(IH.UNAVAILABLE) | — |
| `extends 类 — extends` | L26089-L26132 | .createElement()、.concat()、.getContext()、.addEventListener()、.error()、.warn()、.addFailedEvent()、.disconnect()、.info()、.remove()、.removeAllListeners()、.addSuccessEvent() | new RtcErrorAlias()、constructor()、super()、defineMember()、create()、RtcErrorAlias()、destroy() | addEventListener('contextlost')、addEventListener('contextrestored') | Canvas 2D、DOM |
| `构造函数` | L26092-L26095 | — | constructor()、super()、defineMember() | — | — |
| `create — 方法` | L26098-L26116 | .createElement()、.concat()、.getContext()、.addEventListener()、.error()、.warn() | new RtcErrorAlias()、create()、RtcErrorAlias() | addEventListener('contextlost')、addEventListener('contextrestored') | Canvas 2D、DOM |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L26119-L26131 | .addFailedEvent()、.disconnect()、.info()、.concat()、.remove()、.removeAllListeners()、.addSuccessEvent() | destroy() | — | — |
| `calculateCropRect — 内部函数` | L26136-L26164 | .min()、.max() | calculateCropRect() | — | — |
| `fail — 操作失败回调` | L26171-L26175 | .error()、.addFailedEvent() | fail() | — | — |
| `success — 操作成功回调` | L26178-L26181 | .info()、.addSuccessEvent() | success() | — | — |
| `构造函数` | L26192-L26195 | — | constructor()、defineMember() | — | — |
| `extends 类 — extends` | L26235-L26443 | .floor()、.concat()、.splice()、.findIndex()、.some()、.sort()、.resize()、.reduce()、.assign()、.max()、.forEach()、.layout2texCoords()、.changeBufferData()、.createBuffer()、.connect()、.drawBackGround2d()、.filter()、.clearColor()、.requestFrame()、.useProgram()、.enable()、.blendFunc()、.useBufferFrame()、.useTexture()、.draw()、.draw2d()、.save()、.strokeRect()、.restore()、.now()、.map()、.getInfo()、.disconnect()、.deleteBuffer()、.close()、.removeAllInputs() | new Error()、new bH()、new Array()、constructor()、super()、defineMember()、addInput()、Error()、bH()、changeInputLayout()、isUndefined()、hasInput()、hasNoInput()、resize()、connect()、Array()、removeInput()、render()、render2d()、calculateCropRect()、isRotate90Or270()、debugLayout()、getInfo()、objectMixin()、removeAllInputs()、close() | — | WebSocket |
| `构造函数` | L26238-L26243 | — | constructor()、super()、defineMember() | — | — |
| `addInput — 添加混音输入` | L26246-L26266 | .floor()、.concat()、.splice() | new Error()、new bH()、addInput()、Error()、bH() | — | — |
| `changeInputLayout — 更改混音输入布局` | L26269-L26290 | .findIndex()、.some()、.concat()、.sort() | new Error()、changeInputLayout()、isUndefined()、Error() | — | — |
| `hasInput — 检查是否有输入` | L26293-L26296 | .some() | hasInput() | — | — |
| `hasNoInput — 检查是否无输入` | L26299-L26302 | — | hasNoInput() | — | — |
| `resize — 调整渲染尺寸` | L26305-L26327 | .resize()、.reduce()、.assign()、.max()、.forEach()、.layout2texCoords()、.changeBufferData()、.createBuffer() | resize() | — | — |
| `connect — 建立 WebSocket 信令连接` | L26330-L26340 | .connect()、.drawBackGround2d()、.resize() | new Array()、connect()、Array() | — | — |
| `removeInput — 移除混音输入` | L26343-L26347 | .filter()、.drawBackGround2d() | removeInput() | — | — |
| `render — 渲染视频帧到画布` | L26350-L26368 | .clearColor()、.reduce()、.requestFrame()、.useProgram()、.enable()、.blendFunc()、.useBufferFrame()、.useTexture()、.draw() | render() | — | — |
| `render2d — 2D 渲染视频帧` | L26371-L26390 | .forEach()、.requestFrame()、.drawBackGround2d()、.draw2d() | render2d()、calculateCropRect()、isRotate90Or270() | — | — |
| `debugLayout — 方法` | L26393-L26404 | .save()、.strokeRect()、.restore() | debugLayout() | — | — |
| `getInfo — 获取信息` | L26407-L26420 | .now()、.filter()、.map()、.getInfo() | getInfo()、objectMixin() | — | — |
| `a — 内部函数` | L26413-L26417 | — | — | — | — |
| `removeAllInputs — 移除所有混音输入` | L26423-L26436 | .forEach()、.disconnect()、.deleteBuffer() | removeAllInputs() | — | — |
| `close — 关闭本地流并释放所有轨道` | L26439-L26442 | .close()、.removeAllInputs() | close() | — | — |
| `extends 类 — extends` | L26447-L26516 | .setTexBuffer()、.destroy()、.concat()、.clearRect()、.save()、.scale()、.translate()、.rotate()、.draw2d()、.restore()、.requestFrame()、.useProgram()、.useBufferFrame()、.useInputTexture()、.draw()、.resize() | new RtcErrorAlias()、constructor()、super()、defineMember()、RtcErrorAlias()、draw2d()、render()、resize()、isRotate90Or270() | — | — |
| `构造函数` | L26450-L26474 | .setTexBuffer()、.destroy()、.concat() | new RtcErrorAlias()、constructor()、super()、defineMember()、RtcErrorAlias() | — | — |
| `draw2d — 2D 绘制` | L26477-L26497 | .clearRect()、.save()、.scale()、.translate()、.rotate()、.draw2d()、.restore() | draw2d() | — | — |
| `render — 渲染视频帧到画布` | L26500-L26509 | .requestFrame()、.useProgram()、.useBufferFrame()、.useInputTexture()、.draw() | render() | — | — |
| `resize — 调整渲染尺寸` | L26512-L26515 | .resize() | resize()、isRotate90Or270() | — | — |
| `extends 类 — extends` | L26519-L26962 | .create2dVideoContext()、.createVideoTrackDestination()、.on()、.emit()、.run()、.debug()、.getInfo()、.destroy()、.create()、.values()、.start()、.has()、.get()、.cancelVideoFrameCallback()、.tryVideoFrameCallback()、.info()、.resize()、.disconnect()、.connect()、.setCanvas()、.setOutputMediaStreamTrack()、.changeInput()、.concat()、.add()、.setFpsAuto()、.delete()、.updateCameraSource()、.createVideoImageSource()、.createVideoTrackSource()、._connectMix()、.set()、.createTextSource()、.close()、.replaceTrack()、.getSettings()、._changeMixLayout()、.stopVideoElement()、.changeInputLayout()、.checkAfterRemove()、.pause()；+3 | new Map()、new Set()、new kH()、new Error()、new RH()、new wH()、constructor()、super()、defineMember()、Map()、Set()、kH()、listenDeviceChange()、Error()、enablePrintDetail()、create2dVideoContext()、RH()、setFps()、setTimeout()、setFpsAuto()、setMixBackground()、resizeMixCanvas()、startMix()、asyncGeneratorWrap()、addCameraSource()、createEventDispatcher()、addScreenSource()、addTextSource()、addImageSource()、addVideoSource()、updateCameraSource()、updateScreenSource()、updateTextSource()、isUndefined()、updateImageSource()、updateVideoSource()、_connectMix()、wH()、_changeMixLayout()、removeCameraSource()；+8 | on(dH.RENDER)、on('output-media-track-changed')、emit('render') | Track constraints/settings/capabilities、Media playback、Timers/scheduling |
| `构造函数` | L26522-L26553 | .create2dVideoContext()、.createVideoTrackDestination()、.on()、.emit() | new Map()、new Set()、new kH()、constructor()、super()、defineMember()、Map()、Set()、kH() | on(dH.RENDER)、emit('render') | — |
| `listenDeviceChange — 监听设备插拔事件` | L26556-L26559 | — | new Error()、listenDeviceChange()、Error() | — | — |
| `enablePrintDetail — 启用详细日志打印` | L26562-L26574 | .run()、.debug()、.getInfo() | enablePrintDetail() | — | — |
| `create2dVideoContext — 创建 2D 视频渲染上下文` | L26577-L26583 | .destroy()、.create() | new RH()、create2dVideoContext()、RH() | — | — |
| `setFps — 设置视频帧率` | L26586-L26597 | .values()、.start() | setFps()、setTimeout() | — | Timers/scheduling |
| `setFpsAuto — 自动设置视频帧率` | L26600-L26643 | .values()、.has()、.get()、.cancelVideoFrameCallback()、.tryVideoFrameCallback()、.info()、.start() | setFpsAuto() | — | Media playback |
| `setMixBackground — 设置混音背景` | L26646-L26649 | — | setMixBackground() | — | — |
| `resizeMixCanvas — 调整混流画布大小` | L26652-L26657 | .resize() | resizeMixCanvas() | — | — |
| `startMix — 启动音频混音` | L26660-L26673 | .disconnect()、.connect()、.setCanvas()、.setOutputMediaStreamTrack()、.changeInput() | new Error()、startMix()、asyncGeneratorWrap()、Error() | — | — |
| `addCameraSource — 添加摄像头源` | L26676-L26703 | .has()、.concat()、.add()、.setFpsAuto()、.on()、.delete()、.updateCameraSource()、.createVideoImageSource()、.createVideoTrackSource()、.resize()、._connectMix()、.set() | new Error()、addCameraSource()、Error()、createEventDispatcher() | on('output-media-track-changed') | — |
| `addScreenSource — 添加屏幕共享源` | L26706-L26721 | .has()、.concat()、.createVideoTrackSource()、.resize()、._connectMix()、.set()、.setFpsAuto() | new Error()、addScreenSource()、Error() | — | — |
| `addTextSource — 添加文字源` | L26724-L26732 | .has()、.concat()、.createTextSource()、.resize()、._connectMix()、.set() | new Error()、addTextSource()、Error() | — | — |
| `addImageSource — 添加图片源` | L26735-L26741 | .has()、.concat()、.createVideoImageSource()、.resize()、._connectMix()、.set() | new Error()、addImageSource()、Error() | — | — |
| `addVideoSource — 添加视频源` | L26744-L26753 | .has()、.concat()、.createVideoImageSource()、.resize()、._connectMix()、.set() | new Error()、addVideoSource()、Error() | — | — |
| `updateCameraSource — 更新摄像头源` | L26756-L26796 | .get()、.close()、.createVideoImageSource()、.connect()、.set()、.replaceTrack()、.createVideoTrackSource()、.getSettings()、.resize()、.setFpsAuto()、._changeMixLayout() | updateCameraSource() | — | Track constraints/settings/capabilities |
| `updateScreenSource — 更新屏幕共享源` | L26799-L26804 | .get()、._changeMixLayout() | updateScreenSource() | — | — |
| `updateTextSource — 更新文字源` | L26807-L26818 | .get()、.resize()、._changeMixLayout() | updateTextSource()、isUndefined() | — | — |
| `updateImageSource — 更新图片源` | L26821-L26826 | .get()、.resize()、._changeMixLayout() | updateImageSource() | — | — |
| `updateVideoSource — 更新视频源` | L26829-L26845 | .get()、.stopVideoElement()、.resize()、._changeMixLayout() | updateVideoSource() | — | — |
| `_connectMix — 方法` | L26848-L26859 | .disconnect()、.connect() | new wH()、_connectMix()、wH() | — | — |
| `_changeMixLayout — 方法` | L26862-L26870 | .resize()、.changeInputLayout() | _changeMixLayout()、isUndefined() | — | — |
| `removeCameraSource — 移除摄像头源` | L26873-L26883 | .get()、.close()、.delete()、.checkAfterRemove() | removeCameraSource() | — | — |
| `removeScreenSource — 移除屏幕共享源` | L26886-L26896 | .get()、.close()、.delete()、.checkAfterRemove() | removeScreenSource() | — | — |
| `removeTextSource — 移除文字源` | L26899-L26905 | .get()、.close()、.delete()、.checkAfterRemove() | removeTextSource() | — | — |
| `removeImageSource — 移除图片源` | L26908-L26914 | .get()、.close()、.delete()、.checkAfterRemove() | removeImageSource() | — | — |
| `removeVideoSource — 移除视频源` | L26917-L26927 | .get()、.close()、.stopVideoElement()、.delete()、.checkAfterRemove() | removeVideoSource() | — | — |
| `checkAfterRemove — 方法` | L26930-L26933 | .setFpsAuto() | checkAfterRemove() | — | — |
| `stopVideoElement — 停止视频元素` | L26936-L26939 | .pause()、.remove() | stopVideoElement() | — | Media playback |
| `close — 关闭本地流并释放所有轨道` | L26942-L26961 | .close()、.clearTask()、.destroy()、.values()、.clear()、.stopVideoElement()、.info() | close()、destroyEventDispatcher() | — | — |
| `i — 内部函数` | L26978-L27001 | — | Boolean() | — | — |
| `extends 类 — extends` | L27075-L27166 | .concat()、.getCaptureHandle()、.addTrack()、.getVideoTracks()、.setInputMediaStreamTrack()、.error() | new MediaStream()、new RtcErrorAlias()、new Error()、constructor()、super()、defineMember()、isShareCurrentTab()、capture()、asyncGeneratorWrap()、MediaStream()、rtpParameters()、RtcErrorAlias()、switchDevice()、Error() | — | MediaStream |
| `构造函数` | L27078-L27085 | .concat() | constructor()、super()、defineMember() | — | — |
| `capture — 捕获当前帧` | L27103-L27156 | .addTrack()、.getVideoTracks()、.setInputMediaStreamTrack()、.error()、.concat() | new MediaStream()、new RtcErrorAlias()、capture()、asyncGeneratorWrap()、MediaStream()、rtpParameters()、RtcErrorAlias() | — | MediaStream |
| `switchDevice — 切换采集设备` | L27159-L27165 | — | new Error()、switchDevice()、asyncGeneratorWrap()、Error() | — | — |
| `cleanupAfterUnpublish — 取消发布后清理` | L27172-L27175 | .setContentHint() | cleanupAfterUnpublish() | — | — |
| `extends 类 — extends` | L27184-L27210 | .concat()、.setNode()、.enableTrackAEC()、.deleteNode() | constructor()、super()、addAudioProcessor()、removeAudioProcessor() | — | — |
| `构造函数` | L27187-L27190 | .concat() | constructor()、super() | — | — |
| `addAudioProcessor — 添加音频处理器` | L27193-L27199 | .setNode()、.enableTrackAEC() | addAudioProcessor() | — | — |
| `removeAudioProcessor — 移除音频处理器` | L27202-L27209 | .deleteNode()、.enableTrackAEC() | removeAudioProcessor() | — | — |
| `startPCMCapture — 内部函数` | L27214-L27269 | .createObjectURL()、.postMessage()、.forEach()、.connect()、.enqueue()、.disconnect()、.close() | new Blob()、new AudioWorkletNode()、new ReadableStream()、startPCMCapture()、asyncGeneratorWrap()、observableValue()、initAudioWorklet()、Blob()、AudioWorkletNode()、ReadableStream()、start()、cancel() | 事件属性(onmessage) | AudioWorklet、Streams、URL/Blob、Encoding/binary |
| `start — 启动组件/模块（开始工作流程）` | L27253-L27259 | .enqueue() | start() | 事件属性(onmessage) | — |
| `cancel — 方法` | L27262-L27265 | .forEach()、.disconnect()、.close() | cancel() | — | — |
| `extends 类 — extends` | L27272-L27789 | .createLogger()、.getLogger()、.installEvent()、.push()、.createMediaStreamSource()、.info()、.concat()、.abort()、.createObjectURL()、.createElement()、.appendChild()、.click()、.revokeObjectURL()、.remove()、.then()、.pipeTo()、.forEach()、.catch()、.bind()、.warn()、.get()、.floor()、.set()、.subarray()、.addAudioProcessor()、.mixAudioReference()、.connect()、.mixOnChange()、.addDenoiser()、.setOutputMediaStreamTrack()、.unMixAudioReference()、.setAudioReferenceVolume()、.resolve()、.all()、.removeDenoiser()、.setNode()、.deleteNode()、.removeAudioProcessor()、.close()、.clear()；+8 | new Map()、new AbortController()、new Blob()、new WritableStream()、new Float32Array()、new MediaStream()、constructor()、super()、defineMember()、Map()、localAudioTrack()、_localAudioPipline()、_localScreenAudioPipeline()、dump()、AbortController()、setTimeout()、Blob()、clearTimeout()、startPCMCapture()、WritableStream()、write()、getPCM()、Float32Array()、observableValue()、MediaStream()、e()、hasScreenAudioTrack()、isUndefined()、hasAudioTrack()、changeInput()、mixAudioReference()、unMixAudioReference()、setAudioReferenceVolume()、mixOnChange()、removeInput()、addDenoiser()、addAudioProcessor()、removeDenoiser()、addVoiceChanger()、removeVoiceChanger()；+13 | on('input-media-track-changed')、on('113')、on('114')、on('115')、on('116')、emit('audio-frame') | MediaStream、AudioWorklet、Web Audio nodes、Streams、URL/Blob、DOM、Timers/scheduling、Encoding/binary |
| `构造函数` | L27275-L27300 | .createLogger()、.getLogger()、.installEvent() | new Map()、constructor()、super()、defineMember()、Map() | — | — |
| `dump — 导出调试数据` | L27321-L27380 | .push()、.createMediaStreamSource()、.info()、.concat()、.abort()、.createObjectURL()、.createElement()、.appendChild()、.click()、.revokeObjectURL()、.remove()、.then()、.pipeTo()、.forEach()、.catch()、.bind() | new AbortController()、new Blob()、new WritableStream()、dump()、AbortController()、setTimeout()、Blob()、clearTimeout()、startPCMCapture()、WritableStream()、write() | — | Web Audio nodes、Streams、URL/Blob、DOM、Timers/scheduling |
| `c — 内部函数` | L27346-L27362 | .createObjectURL()、.createElement()、.concat()、.appendChild()、.click()、.revokeObjectURL()、.remove()、.abort() | new Blob()、Blob()、clearTimeout() | — | URL/Blob、DOM、Timers/scheduling |
| `write — 向缓冲区写入字节序列` | L27368-L27371 | .forEach()、.concat() | write() | — | — |
| `getPCM — 获取 PCM 音频数据` | L27383-L27450 | .warn()、.get()、.info()、.concat()、.floor()、.createMediaStreamSource()、.then()、.pipeTo()、.set()、.subarray()、.catch() | new Float32Array()、new AbortController()、new MediaStream()、new WritableStream()、getPCM()、Float32Array()、AbortController()、startPCMCapture()、observableValue()、MediaStream()、WritableStream()、write()、e() | — | MediaStream、Web Audio nodes、Streams、Encoding/binary |
| `write — 向缓冲区写入字节序列` | L27423-L27441 | .set()、.subarray() | new Float32Array()、write()、e()、Float32Array() | — | Encoding/binary |
| `changeInput — 切换混音输入源` | L27461-L27502 | .addAudioProcessor()、.forEach()、.mixAudioReference()、.connect()、.mixOnChange()、.addDenoiser()、.setOutputMediaStreamTrack() | changeInput() | — | — |
| `mixAudioReference — 混音音频参考` | L27505-L27510 | .mixAudioReference() | mixAudioReference() | — | — |
| `unMixAudioReference — 取消混音音频参考` | L27513-L27518 | .unMixAudioReference() | unMixAudioReference() | — | — |
| `setAudioReferenceVolume — 设置音频参考音量` | L27521-L27526 | .setAudioReferenceVolume() | setAudioReferenceVolume() | — | — |
| `mixOnChange — 混音配置变化回调` | L27529-L27554 | .resolve()、.then()、.all()、.setOutputMediaStreamTrack() | mixOnChange() | — | — |
| `removeInput — 移除混音输入` | L27557-L27560 | — | removeInput() | — | — |
| `addDenoiser — 添加降噪处理器` | L27563-L27568 | .addDenoiser() | addDenoiser() | — | — |
| `addAudioProcessor — 添加音频处理器` | L27571-L27596 | .addAudioProcessor()、.forEach()、.mixAudioReference() | addAudioProcessor() | — | — |
| `removeDenoiser — 移除降噪处理器` | L27599-L27605 | .removeDenoiser() | removeDenoiser() | — | — |
## 远端 Track 与播放（L27601-L29000）
详见：`05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `addVoiceChanger — 添加变声器` | L27608-L27613 | .setNode() | addVoiceChanger() | — | — |
| `removeVoiceChanger — 移除变声器` | L27616-L27621 | .deleteNode() | removeVoiceChanger() | — | — |
| `removeAudioProcessor — 移除音频处理器` | L27624-L27631 | .removeAudioProcessor() | removeAudioProcessor() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L27634-L27642 | .close()、.clear()、.forEach()、.abort()、.uninstallEvent() | destroy() | — | — |
| `addEncodeProcessor — 添加编码处理器` | L27645-L27652 | .includes()、.enableInsertableStreams() | addEncodeProcessor() | — | — |
| `addDecodeProcessor — 添加解码处理器` | L27655-L27662 | .includes()、.enableInsertableStreams() | addDecodeProcessor() | — | — |
| `removeEncodeProcessor — 移除编码处理器` | L27665-L27670 | — | removeEncodeProcessor() | — | — |
| `removeDecodeProcessor — 移除解码处理器` | L27673-L27678 | — | removeDecodeProcessor() | — | — |
| `handleLocalTrackStarted — 本地轨道开始回调` | L27681-L27711 | .get()、.getPCM()、.emit()、.set()、.on()、.abort() | handleLocalTrackStarted() | on('input-media-track-changed')、emit('audio-frame') | — |
| `handleLocalTrackStopped — 本地轨道停止回调` | L27714-L27722 | .get()、.abort()、.delete() | handleLocalTrackStopped() | — | — |
| `handleRemoteTrackStarted — 远端轨道开始回调` | L27725-L27740 | .get()、.getPCM()、.emit()、.set() | handleRemoteTrackStarted() | emit('audio-frame') | — |
| `handleRemoteTrackStopped — 远端轨道停止回调` | L27743-L27751 | .get()、.abort()、.delete() | handleRemoteTrackStopped() | — | — |
| `installEvent — 安装单个事件监听器` | L27754-L27760 | .on() | installEvent() | on('113')、on('114')、on('115')、on('116') | — |
| `uninstallEvent — 卸载单个事件监听器` | L27763-L27769 | .off() | uninstallEvent() | — | — |
| `updateAudioReference — 方法` | L27772-L27788 | .get()、.set()、.mixAudioReference()、.delete()、.unMixAudioReference()、.setAudioReferenceVolume() | updateAudioReference()、isUndefined() | — | — |
| `checkSubscribeParams — 校验远端订阅请求参数是否合法` | L27793-L27829 | .concat()、.warn()、.add()、.apply()、.then()、.finally()、.delete() | new Array()、new Promise()、new RtcErrorAlias()、new Set()、checkSubscribeParams()、wrapAsyncGenerator()、Array()、Promise()、setTimeout()、RtcErrorAlias()、s()、n()、Set()、clearTimeout() | — | Timers/scheduling |
| `codecParameters 类 — codecParameters` | L27832-L28035 | .concat()、.updatePlayingState()、.getAudioLevel()、.reportDecodeResult()、.setMute()、.setInputMediaStreamTrack()、.setTrack()、.next()、.once()、.toString()、.changeType()、.toUpperCase()、.warn()、.addEnum()、.uploadEvent()、.emit()、.info()、.close()、.uninstallTrackEvent()、.onTrackMuted()、.onTrackUnmuted()、.onTrackEnded() | new FSM()、new Promise()、constructor()、super()、defineMember()、createSubjectFromObservable()、fromEventObservable()、FSM()、pipeOperator()、$U()、gB()、createTapOperator()、GF()、timerObservable()、mergeObservables()、qF()、reportManager()、setMute()、setInputMediaStreamTrack()、checkDecodeResult()、waitHasMediaTrack()、Promise()、e()、ignoreDecodeError()、isSubscribing()、isSubscribed()、isAvailable()、isNeedPlay()、subscribe()、unsubscribe()、reportDecodeResult()、getOSNumber()、getDeviceModel()、getOSString()、updatePlayingState()、Boolean()、close()、onFlagChanged()、onTrackMuted()、onTrackUnmuted()；+1 | once('input-media-track-changed')、emit('decode-failed')、emit('remote-publish-changed') | MediaStreamTrack |
| `构造函数` | L27835-L27889 | .concat()、.updatePlayingState()、.getAudioLevel()、.reportDecodeResult() | new FSM()、constructor()、super()、defineMember()、createSubjectFromObservable()、fromEventObservable()、FSM()、pipeOperator()、$U()、gB()、createTapOperator()、GF()、timerObservable()、mergeObservables()、qF()、reportManager() | — | — |
| `setMute — 设置静音状态` | L27892-L27895 | .setMute() | setMute() | — | — |
| `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | L27898-L27902 | .setInputMediaStreamTrack()、.setTrack() | setInputMediaStreamTrack() | — | — |
| `checkDecodeResult — 检查解码结果` | L27905-L27908 | .next() | checkDecodeResult() | — | — |
| `waitHasMediaTrack — 等待媒体轨道就绪` | L27911-L27917 | .once() | new Promise()、waitHasMediaTrack()、Promise()、e() | once('input-media-track-changed') | — |
| `subscribe — 订阅远端用户的音视频流` | L27946-L27949 | — | subscribe() | — | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L27952-L27956 | .setTrack()、.changeType() | unsubscribe() | — | — |
| `reportDecodeResult — 方法` | L27959-L27987 | .toUpperCase()、.concat()、.warn()、.addEnum()、.uploadEvent()、.getAudioLevel()、.emit() | reportDecodeResult()、getOSNumber()、getDeviceModel()、getOSString() | emit('decode-failed') | — |
| `updatePlayingState — 更新播放状态` | L27990-L28003 | .info()、.concat()、.updatePlayingState() | updatePlayingState()、Boolean() | — | — |
| `close — 关闭本地流并释放所有轨道` | L28006-L28009 | .close()、.uninstallTrackEvent() | close() | — | — |
| `onFlagChanged — 标志位变化回调` | L28012-L28016 | .emit() | onFlagChanged() | emit('remote-publish-changed') | — |
| `onTrackMuted — 轨道被静音回调` | L28019-L28022 | .onTrackMuted() | onTrackMuted() | — | — |
| `onTrackUnmuted — 轨道取消静音回调` | L28025-L28028 | .onTrackUnmuted() | onTrackUnmuted() | — | — |
| `onTrackEnded — 轨道结束回调` | L28031-L28034 | .onTrackEnded() | onTrackEnded() | — | — |
| `success — 操作成功回调` | L28043-L28046 | .info()、.emit() | success() | emit(Events.REMOTE_TRACK_SUBSCRIBED) | — |
| `success — 操作成功回调` | L28061-L28064 | .info()、.emit() | success() | emit(Events.REMOTE_TRACK_UNSUBSCRIBED) | — |
| `extends 类 — extends` | L28073-L28163 | .getVolumeDb()、.floor()、.max()、.log10()、.warn()、.enableInsertableStreams()、.some()、.entries()、.emit()、.getAudioLevel() | constructor()、super()、defineMember()、dbVolume()、onPlayerError()、enableDecodeFrame()、Boolean()、checkWebCodecsSupport()、enableDecryptFrame()、decodeFrame()、r()、getAudioLevel()、isRemotePublished() | emit('audio-frame-with-ntp') | WebCodecs |
| `构造函数` | L28076-L28089 | — | constructor()、super()、defineMember() | — | — |
| `onPlayerError — 播放器错误回调` | L28098-L28101 | .warn()、.enableInsertableStreams() | onPlayerError() | — | — |
| `decodeFrame — 解码视频帧` | L28122-L28149 | .entries()、.emit() | decodeFrame()、r() | emit('audio-frame-with-ntp') | — |
| `getAudioLevel — 获取当前音频电平值` | L28152-L28158 | .getAudioLevel() | getAudioLevel() | — | — |
| `extends 类 — extends` | L28166-L28346 | .bindDragEvents()、.bind()、.renderCanvas()、.removeProperty()、.next()、.requestFrame()、.useProgram()、.useBufferFrame()、.useInputTexture()、.draw()、.preventDefault()、.setContainer()、.setProperty()、.concat()、.min()、.max()、.draw2d()、.getImageData()、.floor()、.clearRect()、.complete() | constructor()、super()、defineMember()、createSubjectFromObservable()、bindDragEvents()、qF()、pipeOperator()、fromEventObservable()、KB()、IB()、createTapOperator()、render()、startDrag()、renderCanvas()、doDrag()、handleZoom()、resetPosition()、onRatioReset()、draw2d()、close() | — | Canvas 2D |
| `构造函数` | L28169-L28188 | .bindDragEvents() | constructor()、super()、defineMember()、createSubjectFromObservable() | — | — |
| `bindDragEvents — 方法` | L28191-L28216 | .bind()、.renderCanvas()、.removeProperty()、.next() | bindDragEvents()、qF()、pipeOperator()、fromEventObservable()、KB()、IB()、createTapOperator() | — | — |
| `render — 渲染视频帧到画布` | L28219-L28228 | .requestFrame()、.useProgram()、.useBufferFrame()、.useInputTexture()、.draw() | render() | — | — |
| `startDrag — 开始拖拽` | L28231-L28235 | .preventDefault() | startDrag() | — | — |
| `renderCanvas — 渲染到 Canvas` | L28238-L28251 | .setContainer()、.setProperty()、.concat() | renderCanvas() | — | — |
| `doDrag — 执行拖拽` | L28254-L28260 | .preventDefault()、.renderCanvas() | doDrag() | — | — |
| `handleZoom — 缩放处理` | L28263-L28274 | .preventDefault()、.min()、.max()、.renderCanvas() | handleZoom() | — | — |
| `resetPosition — 方法` | L28277-L28280 | .renderCanvas() | resetPosition() | — | — |
| `onRatioReset — 比例重置回调` | L28283-L28286 | .renderCanvas() | onRatioReset() | — | — |
| `draw2d — 2D 绘制` | L28289-L28339 | .draw2d()、.getImageData()、.floor()、.clearRect() | draw2d() | — | Canvas 2D |
| `close — 关闭本地流并释放所有轨道` | L28342-L28345 | .next()、.complete() | close() | — | — |
| `extends 类 — extends` | L28349-L28564 | .once()、.emit()、.useCanvasPlayer()、.play()、.then()、.calculateStat()、.isAlphaSei()、.getElement()、.onRatioReset()、.generateAlphaCanvasName()、.concat()、.info()、.create()、.createVideoPlayerSource()、.setCanvas()、.renderCanvas()、.connect()、.bind()、.on()、.reduce()、.abs()、.debug()、.find()、.off()、.close()、.stop()、.changeType()、.setMirror()、.bindDragEvents() | new Uint8Array()、new RH()、new pH()、new GH()、constructor()、super()、defineMember()、isAlphaSei()、Uint8Array()、play()、isBoolean()、updateAlphaRenderInfo()、generateAlphaCanvasName()、useCanvasPlayer()、Boolean()、RH()、pH()、GH()、hasVideoFrameCallback()、updateCanvasPlayerFPS()、isNumber()、decodeFPS()、stop()、decodeFrame()、t()、isBig()、isSmall()、changeType()、isRemotePublished()、setMirror()、setDraggable()、onDecodeDowngradeStateChanged() | on('heartbeat-report')、once('first-video-frame')、emit('first-video-frame')、emit('156')、emit('157')、emit('decode-downgrade-state-changed') | Track lifecycle、Media playback、Encoding/binary |
| `构造函数` | L28352-L28376 | .once()、.emit() | constructor()、super()、defineMember() | once('first-video-frame')、emit('first-video-frame') | — |
| `isAlphaSei — 方法` | L28379-L28386 | — | new Uint8Array()、isAlphaSei()、Uint8Array() | — | Encoding/binary |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L28389-L28400 | .useCanvasPlayer()、.play()、.then()、.calculateStat()、.emit() | play()、isBoolean() | emit('156') | Media playback |
| `updateAlphaRenderInfo — 更新 Alpha 渲染信息` | L28403-L28425 | .isAlphaSei()、.getElement()、.onRatioReset()、.generateAlphaCanvasName()、.useCanvasPlayer() | updateAlphaRenderInfo() | — | — |
| `generateAlphaCanvasName — 生成 Alpha 通道 Canvas 名称` | L28428-L28435 | .concat() | generateAlphaCanvasName() | — | — |
| `useCanvasPlayer — 使用 Canvas 播放器` | L28438-L28471 | .info()、.concat()、.generateAlphaCanvasName()、.create()、.createVideoPlayerSource()、.setCanvas()、.renderCanvas()、.connect()、.bind()、.on() | new RH()、new pH()、new GH()、useCanvasPlayer()、Boolean()、RH()、pH()、GH()、hasVideoFrameCallback() | on('heartbeat-report') | — |
| `r — 源码命名函数` | L28457-L28462 | .renderCanvas() | — | — | — |
| `updateCanvasPlayerFPS — 更新 Canvas 播放器帧率` | L28474-L28491 | .reduce()、.abs()、.debug()、.concat()、.info() | updateCanvasPlayerFPS()、isNumber() | — | — |
| `i — 内部函数` | L28479-L28506 | .reduce()、.abs()、.debug()、.concat()、.info()、.find() | isNumber()、decodeFPS() | — | — |
| `stop — 停止本地流播放` | L28509-L28517 | .off()、.emit()、.close()、.stop() | stop() | emit('157') | Track lifecycle |
| `decodeFrame — 解码视频帧` | L28520-L28526 | — | decodeFrame()、t() | — | — |
| `changeType — 修改订阅流类型（大小流切换）` | L28537-L28540 | .changeType() | changeType() | — | — |
| `setMirror — 设置镜像模式` | L28547-L28550 | .setMirror() | setMirror() | — | — |
| `setDraggable — 设置可拖拽` | L28553-L28557 | .bindDragEvents() | setDraggable() | — | — |
| `onDecodeDowngradeStateChanged — 解码降级状态变化回调` | L28560-L28563 | .emit() | onDecodeDowngradeStateChanged() | emit('decode-downgrade-state-changed') | — |
| `extends 类 — extends` | L28567-L28578 | — | constructor()、super()、defineMember()、isRemotePublished() | — | — |
| `构造函数` | L28570-L28573 | — | constructor()、super()、defineMember() | — | — |
| `enqueueReportEvent — 内部函数` | L28583-L28588 | .has()、.get()、.push()、.set() | enqueueReportEvent()、assignDescriptors()、objectMixin()、getServerTime() | — | — |
| `validateParamRules — 内部函数` | L28591-L28604 | .call()、.error() | validateParamRules()、isArray() | — | — |
| `validateSingleParamRule — 内部函数` | L28607-L28725 | .isArray()、.toLowerCase()、.map()、.isNaN()、.trim()、.includes()、.keys()、.forEach()、.call()、.concat() | new RtcErrorAlias()、validateSingleParamRule()、isUndefined()、RtcErrorAlias()、logConfig()、isFunction()、isString()、getValueType()、isConstructor()、getConstructorName()、isNumber()、isPlainObject()、isObject()、isArray() | — | — |
| `extends 类 — extends` | L28883-L29019 | .values()、.find()、.get()、.has()、.set()、.emit()、.concat()、.info()、.deleteRemotePublishedUser()、.delete()、.forEach()、.findIndex()、.deleteUser()、.addUser()、.stringify()、.clear() | new Map()、constructor()、super()、defineMember()、Map()、hasRobotUser()、Boolean()、getPublishedUser()、addUser()、deleteUser()、isUndefined()、setUserList()、addRemotePublishedUser()、deleteRemotePublishedUser()、setRemotePublishedUserList()、getMuteStateFromFlag()、clear() | emit('1')、emit('5')、emit('6')、emit('2')、emit('7')、emit('3') | — |
| `构造函数` | L28886-L28896 | — | new Map()、constructor()、super()、defineMember()、Map() | — | — |
| `getPublishedUser — 获取已发布用户信息` | L28903-L28906 | .get() | getPublishedUser() | — | — |
| `addUser — 方法` | L28909-L28918 | .has()、.set()、.emit() | addUser() | emit('1') | — |
| `deleteUser — 方法` | L28921-L28941 | .get()、.concat()、.info()、.emit()、.deleteRemotePublishedUser()、.delete() | deleteUser()、isUndefined() | emit('5')、emit('6')、emit('2') | — |
| `setUserList — 设置用户列表` | L28944-L28954 | .forEach()、.findIndex()、.deleteUser()、.has()、.addUser() | setUserList() | — | — |
| `addRemotePublishedUser — 添加远端已发布用户` | L28957-L28960 | .has()、.set() | addRemotePublishedUser() | — | — |
| `deleteRemotePublishedUser — 删除远端已发布用户` | L28963-L28966 | .has()、.delete() | deleteRemotePublishedUser() | — | — |
| `setRemotePublishedUserList — 设置远端已发布用户列表` | L28969-L29012 | .forEach()、.findIndex()、.info()、.concat()、.emit()、.deleteRemotePublishedUser()、.get()、.stringify()、.addUser() | setRemotePublishedUserList()、getMuteStateFromFlag() | emit('5')、emit('6')、emit('7')、emit('3') | — |
## Worker、WASM 与媒体管理（L29001-L34099）
详见：`08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `clear — 清除所有数据` | L29015-L29018 | .clear() | clear() | — | — |
| `createRateLimitDecorator — 内部函数` | L29023-L29074 | .on()、.delete()、.get()、.set()、.now()、.call() | new WeakMap()、new Array()、new RtcErrorAlias()、createRateLimitDecorator()、wrapAsyncGenerator()、WeakMap()、Array()、getSize()、RtcErrorAlias()、logConfig() | on(Events.ROOM_DESTROY) | — |
| `INVALID_PARAMETER — 方法` | L29174-L29183 | .concat() | INVALID_PARAMETER() | — | — |
| `INVALID_PARAMETER_REQUIRED — 方法` | L29186-L29195 | .concat() | INVALID_PARAMETER_REQUIRED() | — | — |
| `INVALID_PARAMETER_TYPE — 方法` | L29198-L29213 | .concat()、.isArray()、.join() | INVALID_PARAMETER_TYPE()、getValueType() | — | — |
| `INVALID_PARAMETER_EMPTY — 方法` | L29216-L29225 | .concat() | INVALID_PARAMETER_EMPTY() | — | — |
| `INVALID_PARAMETER_INSTANCE — 方法` | L29228-L29240 | .concat() | INVALID_PARAMETER_INSTANCE()、getValueType() | — | — |
| `INVALID_PARAMETER_RANGE — 方法` | L29243-L29253 | .concat()、.join() | INVALID_PARAMETER_RANGE() | — | — |
| `INVALID_PARAMETER_LESS_THAN_ZERO — 方法` | L29256-L29262 | .concat() | INVALID_PARAMETER_LESS_THAN_ZERO() | — | — |
| `INVALID_PARAMETER_MIN — 方法` | L29265-L29274 | .concat() | INVALID_PARAMETER_MIN() | — | — |
| `INVALID_PARAMETER_MAX — 方法` | L29277-L29286 | .concat() | INVALID_PARAMETER_MAX() | — | — |
| `INVALID_ELEMENT_ID — 方法` | L29289-L29295 | .concat() | INVALID_ELEMENT_ID() | — | — |
| `INVALID_ELEMENT_ID_TYPE — 方法` | L29298-L29307 | .concat() | INVALID_ELEMENT_ID_TYPE() | — | — |
| `INVALID_STREAM_ID — 方法` | L29310-L29319 | .concat() | INVALID_STREAM_ID() | — | — |
| `INVALID_ROOM_ID_STRING — 方法` | L29322-L29328 | .concat() | INVALID_ROOM_ID_STRING() | — | — |
| `INVALID_ROOM_ID_INTEGER — 方法` | L29331-L29337 | .concat() | INVALID_ROOM_ID_INTEGER() | — | — |
| `INVALID_ROOM_ID_INTEGER_STRING — 方法` | L29340-L29349 | .concat() | INVALID_ROOM_ID_INTEGER_STRING() | — | — |
| `INVALID_ROOM_ID_TYPE_MISMATCH — 方法` | L29354-L29362 | .concat() | INVALID_ROOM_ID_TYPE_MISMATCH() | — | — |
| `INVALID_ROOM_ID_DUPLICATE — 方法` | L29365-L29371 | .concat() | INVALID_ROOM_ID_DUPLICATE() | — | — |
| `INVALID_OPERATION — 方法` | L29382-L29388 | .concat() | INVALID_OPERATION() | — | — |
| `INVALID_OPERATION_NOT_JOINED — 方法` | L29391-L29397 | .concat() | INVALID_OPERATION_NOT_JOINED() | — | — |
| `INVALID_OPERATION_REMOTE_USER_NOT_EXIST — 方法` | L29400-L29406 | .concat() | INVALID_OPERATION_REMOTE_USER_NOT_EXIST() | — | — |
| `INVALID_OPERATION_STREAM_TYPE_NOT_EXIST — 方法` | L29409-L29418 | .concat() | INVALID_OPERATION_STREAM_TYPE_NOT_EXIST() | — | — |
| `INVALID_OPERATION_REPEAT_CALL — 方法` | L29421-L29427 | .concat() | INVALID_OPERATION_REPEAT_CALL() | — | — |
| `INVALID_OPERATION_NEED_VIDEO — 方法` | L29430-L29436 | .concat() | INVALID_OPERATION_NEED_VIDEO() | — | — |
| `INVALID_OPERATION_NEED_AUDIO — 方法` | L29439-L29445 | .concat() | INVALID_OPERATION_NEED_AUDIO() | — | — |
| `ENV_NOT_SUPPORTED — 方法` | L29465-L29474 | .concat() | ENV_NOT_SUPPORTED() | — | — |
| `NOT_SUPPORTED_CHROME_VERSION — 方法` | L29484-L29490 | .concat() | NOT_SUPPORTED_CHROME_VERSION() | — | — |
| `DEVICE_ERROR — 方法` | L29493-L29499 | .concat()、.toString() | DEVICE_ERROR() | — | — |
| `DEVICE_NOT_FOUND_ERROR — 方法` | L29502-L29511 | .concat()、.toString() | DEVICE_NOT_FOUND_ERROR()、normalizeStreamTypeName() | — | — |
| `DEVICE_NOT_ALLOWED_ERROR — 方法` | L29514-L29523 | .concat()、.toString() | DEVICE_NOT_ALLOWED_ERROR()、normalizeStreamTypeName() | — | — |
| `DEVICE_NOT_READABLE_ERROR — 方法` | L29526-L29535 | .concat() | DEVICE_NOT_READABLE_ERROR()、normalizeStreamTypeName() | — | — |
| `DEVICE_OVERCONSTRAINED_ERROR — 方法` | L29538-L29546 | .concat()、.toString() | DEVICE_OVERCONSTRAINED_ERROR()、normalizeStreamTypeName() | — | — |
| `DEVICE_INVALID_STATE_ERROR — 方法` | L29549-L29557 | .concat()、.toString() | DEVICE_INVALID_STATE_ERROR()、normalizeStreamTypeName() | — | — |
| `DEVICE_SECURITY_ERROR — 方法` | L29560-L29569 | .concat()、.toString() | DEVICE_SECURITY_ERROR()、normalizeStreamTypeName() | — | — |
| `DEVICE_ABORT_ERROR — 方法` | L29572-L29580 | .concat()、.toString() | DEVICE_ABORT_ERROR()、normalizeStreamTypeName() | — | — |
| `CAMERA_RECOVER_FAILED — 方法` | L29583-L29591 | .concat() | CAMERA_RECOVER_FAILED() | — | — |
| `MICROPHONE_RECOVER_FAILED — 方法` | L29594-L29602 | .concat() | MICROPHONE_RECOVER_FAILED() | — | — |
| `OPERATION_FAILED — 方法` | L29605-L29611 | .concat()、.toString() | OPERATION_FAILED() | — | — |
| `EVENT_HANDLER_ERROR — 方法` | L29616-L29622 | .concat() | EVENT_HANDLER_ERROR() | on('".concat(t) | — |
| `VIDEO_CONTEXT_ERROR — 方法` | L29625-L29634 | .concat() | VIDEO_CONTEXT_ERROR() | — | — |
| `SERVER_ERROR — 方法` | L29637-L29645 | .concat()、.toString() | SERVER_ERROR() | — | — |
| `NEED_TO_BUY — 方法` | L29648-L29654 | .concat() | NEED_TO_BUY() | — | — |
| `OPERATION_ABORT — 方法` | L29666-L29672 | .concat() | OPERATION_ABORT() | — | — |
| `UNKNOWN_ERROR — 方法` | L29675-L29681 | .concat()、.toString() | UNKNOWN_ERROR() | — | — |
| `normalizeStreamTypeName — 内部函数` | L29686-L29693 | .toLowerCase()、.includes() | normalizeStreamTypeName() | — | — |
| `e 类 — e` | L29696-L29860 | .includes()、.concat()、.createElement()、.click()、.getCode()、.getExtraCode()、.substr()、.indexOf() | new e()、constructor()、isFunction()、t()、isString()、objectMixin()、super()、defineMember()、convertFrom()、e() | — | DOM |
| `构造函数` | L29699-L29767 | .includes()、.concat()、.createElement()、.click() | constructor()、isFunction()、t()、isString()、objectMixin()、super()、defineMember() | — | DOM |
| `convertStreamTypeFormat — 内部函数` | L29865-L29868 | — | convertStreamTypeFormat() | — | — |
| `mapQoSToContentHint — 内部函数` | L29871-L29874 | — | mapQoSToContentHint() | — | — |
| `mergeVideoProfile — 内部函数` | L29877-L29883 | — | mergeVideoProfile()、isPlainObject()、objectMixin() | — | — |
| `validate — 校验/验证数据合法性` | L29926-L29930 | .getElementById() | new aW()、validate()、isString()、aW() | — | DOM |
| `assertValidOperation — 内部函数` | L29952-L29955 | — | new aW()、assertValidOperation()、aW() | — | — |
| `assertStreamExists — 内部函数` | L29958-L29961 | — | new aW()、assertStreamExists()、aW() | — | — |
| `assertValidRoomId — 内部函数` | L29964-L29968 | .test() | new aW()、assertValidRoomId()、String()、aW() | — | — |
| `assertValidUserId — 内部函数` | L29971-L29975 | .test() | new aW()、assertValidUserId()、aW() | — | — |
| `checkSmallStreamConfig — 内部函数` | L29978-L29999 | .warn()、.concat()、.stringify() | checkSmallStreamConfig()、isSmallStreamSupported()、mergeVideoProfile() | — | — |
| `validate — 校验/验证数据合法性` | L30015-L30029 | — | new aW()、validate()、aW()、isString()、assertValidRoomId()、assertValidUserId() | — | — |
| `validate — 校验/验证数据合法性` | L30076-L30083 | — | new aW()、validate()、warnHttpNotSupported()、aW()、checkSmallStreamConfig() | — | — |
| `validate — 校验/验证数据合法性` | L30098-L30103 | — | validate()、checkSmallStreamConfig() | — | — |
| `validate — 校验/验证数据合法性` | L30111-L30117 | — | new aW()、validate()、warnHttpNotSupported()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30131-L30140 | — | new aW()、validate()、warnHttpNotSupported()、aW()、isScreenShareSupported() | — | — |
| `validate — 校验/验证数据合法性` | L30168-L30180 | .get() | new aW()、validate()、assertValidOperation()、assertStreamExists()、Boolean()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30200-L30212 | .get() | new aW()、validate()、assertValidOperation()、assertStreamExists()、Boolean()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30221-L30225 | — | new aW()、validate()、isUndefined()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30233-L30236 | — | validate()、assertValidOperation() | — | — |
| `validate — 校验/验证数据合法性` | L30249-L30257 | — | new aW()、validate()、aW()、assertValidOperation() | — | — |
| `validate — 校验/验证数据合法性` | L30268-L30272 | — | new aW()、validate()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30288-L30293 | — | new aW()、validate()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30298-L30302 | — | new aW()、validate()、assertValidOperation()、aW() | — | — |
| `validate — 校验/验证数据合法性` | L30310-L30336 | — | new aW()、validate()、assertValidOperation()、Number()、aW()、assertValidRoomId()、assertValidUserId() | — | — |
| `extends 类 — extends` | L30349-L30349 | — | — | — | — |
| `deepMergeArrays — 内部函数` | L30353-L30360 | — | deepMergeArrays()、deepClone()、deepMerge() | — | — |
| `createResolvedPromise — 内部函数` | L30363-L30366 | .resolve() | createResolvedPromise() | — | — |
| `createRejectedPromise — 内部函数` | L30369-L30372 | .reject() | createRejectedPromise() | — | — |
| `e 类 — e` | L30375-L30546 | .get()、.set()、.forEach()、.test()、.push()、.shift()、.action()、.reject()、.then()、.cacheOp()、.slice()、.mergeUpdate()、.startSame()、.pop()、.catch() | new Map()、new e()、new IW()、new Promise()、constructor()、defineMember()、Map()、get()、e()、gets()、action()、IW()、t()、cacheOp()、Promise()、lastOp()、lastOpType()、currentOp()、state() | — | — |
| `构造函数` | L30378-L30389 | .get()、.set() | new Map()、constructor()、defineMember()、Map() | — | — |
| `action — 方法` | L30415-L30464 | .shift()、.action()、.reject()、.then()、.cacheOp()、.push() | new IW()、action()、IW()、t() | — | — |
| `r — 源码命名函数` | L30417-L30428 | .shift()、.action() | — | — | — |
| `n — 源码命名函数` | L30429-L30441 | .shift()、.reject()、.action() | new IW()、IW() | — | — |
| `cacheOp — 缓存操作（延迟执行）` | L30467-L30529 | .slice()、.forEach()、.reject()、.mergeUpdate()、.startSame()、.pop()、.then()、.catch()、.push() | new IW()、new Promise()、cacheOp()、IW()、Promise()、t() | — | — |
| `wW — 内部函数` | L30553-L30563 | .concat()、.substr()、.indexOf() | new aW()、aW() | — | — |
| `createStartSameHook — 内部函数` | L30567-L30582 | .get()、.call()、.bind()、.action()、.catch()、.apply() | new Array()、createStartSameHook()、wrapAsyncGenerator()、Array() | — | — |
| `createUpdateMergeHook — 内部函数` | L30585-L30630 | .get()、.call()、.apply()、.bind()、.action()、.catch()、.then()、.has()、.set() | new Array()、new Promise()、new Map()、createUpdateMergeHook()、wrapAsyncGenerator()、Array()、Promise()、getKey()、clearTimeout()、prevResolve()、setTimeout()、resolve()、Map() | — | Timers/scheduling |
| `createStopHookDecorator — 内部函数` | L30633-L30652 | .call()、.all()、.gets()、.map()、.action()、.resolve()、.then()、.get()、.bind()、.catch()、.apply() | new Array()、createStopHookDecorator()、wrapAsyncGenerator()、Array() | — | — |
| `checkDevicePermission — 内部函数` | L30655-L30674 | .concat()、.warn() | checkDevicePermission() | — | — |
| `setScheduleFlag — 内部函数` | L30732-L30735 | .info()、.concat()、.now() | setScheduleFlag()、isBoolean() | — | — |
| `generateRoomConfig — 内部函数` | L30738-L30895 | .now()、.append()、.then()、.catch()、.getEntriesByType()、.round()、.uploadEvent()、.concat()、.join()、.error() | new FormData()、new Promise()、new RtcErrorAlias()、generateRoomConfig()、asyncGeneratorWrap()、FormData()、String()、fetchUserAgentData()、getDeviceModelFromUA()、getOSString()、performanceNow()、yield()、Promise()、promiseAny()、downlinkTransport()、buildReportUrl()、n()、timeout()、fibonacci()、r()、setEnv()、isBoolean()、setScheduleFlag()、assignDescriptors()、objectMixin()、Number()、isArray()、isNumber()、RtcErrorAlias()、logConfig() | — | — |
| `setLogReportUrls — 内部函数` | L30918-L30921 | — | setLogReportUrls()、isArray() | — | — |
| `buildReportUrl — 内部函数` | L30928-L30935 | .concat() | buildReportUrl()、sendKVReport() | — | — |
| `sendLogReport — 内部函数` | L30938-L30948 | .toString()、.concat()、.then()、.json() | new URLSearchParams()、sendLogReport()、buildReportUrl()、URLSearchParams()、fetch()、promiseAny() | — | fetch、URL/Blob |
| `sendKVReport — 内部函数` | L30951-L30972 | — | sendKVReport()、isSecondsTimestamp() | — | — |
| `sendHttpWithRetry — 内部函数` | L30975-L30986 | .then()、.catch() | new Promise()、sendHttpWithRetry()、Promise()、sendHttpRequest()、r()、n() | — | — |
| `构造函数` | L30991-L30994 | .createLogger() | constructor()、defineMember() | — | — |
| `download — 下载文件` | L30997-L31030 | .downloadWithFetch()、.downloadWithXHR()、.info()、.concat()、.addSuccessEvent()、.error()、.addFailedEvent() | new Error()、download()、asyncGeneratorWrap()、normalizeUrl()、performanceNow()、isFunction()、Error() | — | — |
| `downloadWithFetch — 使用 Fetch API 下载` | L31033-L31057 | .info()、.concat()、.arrayBuffer()、.blob() | new Error()、downloadWithFetch()、asyncGeneratorWrap()、fetch()、Error() | — | fetch |
| `downloadWithXHR — 使用 XMLHttpRequest 下载` | L31060-L31084 | .info()、.concat()、.open()、.send() | new Promise()、new XMLHttpRequest()、new Error()、downloadWithXHR()、Promise()、XMLHttpRequest()、i()、Error()、r() | 事件属性(onload)、事件属性(onerror) | XMLHttpRequest |
| `loadWasm — 加载 WebAssembly 模块` | L31087-L31144 | .info()、.concat()、.stringify()、.startsWith()、.instantiateStreaming()、.download()、.instantiate()、.addSuccessEvent()、.error()、.addFailedEvent() | loadWasm()、asyncGeneratorWrap()、performanceNow()、isFunction()、fetch() | — | WebAssembly、fetch |
| `r — 内部函数` | L31108-L31113 | .instantiateStreaming() | — | — | WebAssembly |
| `r — 内部函数` | L31121-L31126 | .instantiate() | — | — | WebAssembly |
| `loadScript — 加载外部脚本` | L31147-L31178 | .info()、.concat()、.createElement()、.addSuccessEvent()、.error()、.stringify()、.addFailedEvent()、.append()、.getElementsByTagName()、.appendChild() | new Promise()、loadScript()、performanceNow()、Promise()、i()、r() | 事件属性(onload)、事件属性(onerror) | DOM |
| `onError — 错误处理回调` | L31187-L31194 | .includes()、.warn() | onError()、i()、t() | — | — |
| `onRetrying — 重连中回调` | L31197-L31200 | .warn()、.concat() | onRetrying() | — | — |
| `onRetrying — 重连中回调` | L31213-L31216 | .warn()、.concat() | onRetrying() | — | — |
| `createPluginContext — 创建插件依赖上下文（包含房间、常量、工具、设备检测等所有 SDK 内部依赖）` | L31226-L31317 | .getLogger()、.loadScript()、.concat()、.replace()、.getInstance()、.preloadModels()、.getAlias()、.get()、.forEach()、.startsWith() | new aW()、createPluginContext()、asyncGeneratorWrap()、yield()、observableValue()、aW() | — | — |
| `initVisionTaskRegistry — 内部函数` | L31258-L31276 | .loadScript()、.concat()、.replace()、.getInstance()、.preloadModels() | asyncGeneratorWrap()、yield() | — | — |
| `createParamValidationDecorator — 内部函数` | L31323-L31344 | .call()、.reject()、.apply() | new Array()、createParamValidationDecorator()、Array()、wrapAsyncGenerator() | — | — |
| `createUnsafeParamValidationDecorator — 内部函数` | L31347-L31368 | .call()、.apply() | new Array()、createUnsafeParamValidationDecorator()、Array()、wrapAsyncGenerator() | — | — |
| `applyValidationRules — 内部函数` | L31371-L31377 | .call() | applyValidationRules()、isArray() | — | — |
| `validateSingleRule — 内部函数` | L31380-L31446 | .call()、.isArray()、.toLowerCase()、.map()、.isNaN()、.trim()、.includes()、.keys()、.forEach()、.concat() | new aW()、validateSingleRule()、createError()、isUndefined()、aW()、isFunction()、isString()、getValueType()、isConstructor()、getConstructorName()、isNumber()、isPlainObject()、isObject()、isArray() | — | — |
| `createError — 内部函数` | L31386-L31389 | — | createError() | — | — |
| `createLoggingDecorator — 内部函数` | L31449-L31565 | .includes()、.concat()、.stringify()、.apply()、.info()、.call()、.then()、.addSuccessEvent()、.catch()、.error()、.addFailedEvent() | new Array()、createLoggingDecorator()、wrapAsyncGenerator()、Array()、maskSensitiveData()、i()、getValueType()、getMediaStreamTrackInfo()、n()、p()、r()、o()、performanceNow()、isPromise() | — | MediaStreamTrack |
| `maskSensitiveData — 内部函数` | L31464-L31486 | .includes()、.concat()、.stringify() | maskSensitiveData()、i()、getValueType()、getMediaStreamTrackInfo() | — | MediaStreamTrack |
| `f — 内部函数` | L31496-L31549 | .apply()、.concat()、.includes()、.call()、.then()、.info()、.addSuccessEvent()、.catch()、.error()、.stringify()、.addFailedEvent() | o()、performanceNow()、isPromise() | — | — |
| `lG — 源码命名函数` | L31567-L31598 | .get()、.error()、.concat()、.isSupported()、.call()、.getValidateRule() | new aW()、wrapAsyncGenerator()、asyncGeneratorWrap()、String()、aW()、isFunction() | — | — |
| `e 类 — e` | L31603-L32030 | .createChild()、.concat()、.getAlias()、.info()、.installEvent()、.doPreload()、.download()、.createObjectURL()、.error()、.revokeObjectURL()、.getStartValidateRule()、.validateSourceNode()、.preload()、.getAuthData()、.initWorkletNode()、.createGain()、.createConstantSource()、.setValueAtTime()、.start()、.postMessage()、.addAudioProcessor()、.forEach()、.set()、.updateAudioReference()、.delete()、.removeAudioProcessor()、.uninstallEvent()、.now()、.slice()、.json()、.join()、.emit()、.hitTest()、.startPlugin()、.warn()、.stopPlugin()、.on()、.off() | new Map()、new aW()、new AudioWorkletNode()、new Date()、constructor()、defineMember()、Map()、observableValue()、getStartValidateRule()、validate()、aW()、preload()、doPreload()、asyncGeneratorWrap()、initAudioWorklet()、getName()、getAlias()、getGroup()、getValidateRule()、start()、AudioWorkletNode()、isUndefined()、update()、stop()、destroy()、getAuthData()、String()、yield()、sendKVReport()、fetch()、isSecondsTimestamp()、initWorkletNode()、formatTimeMs()、Date()、handleLocalAudioStarted()、handleLocalAudioStopped()、installEvent()、uninstallEvent()、hitTest() | on('104')、on('114')、emit('265')、事件属性(onmessage) | AudioWorklet、Web Audio nodes、fetch、URL/Blob |
| `构造函数` | L31606-L31621 | .createChild()、.concat()、.getAlias()、.info()、.installEvent() | new Map()、constructor()、defineMember()、Map()、observableValue() | — | — |
| `validate — 校验/验证数据合法性` | L31635-L31639 | — | new aW()、validate()、aW() | — | — |
| `preload — 预加载资源` | L31644-L31647 | .doPreload() | preload() | — | — |
| `doPreload — 预加载` | L31650-L31670 | .download()、.createObjectURL()、.error()、.concat()、.revokeObjectURL() | doPreload()、asyncGeneratorWrap()、initAudioWorklet() | — | URL/Blob |
| `getName — 获取名称` | L31673-L31676 | — | getName() | — | — |
| `getAlias — 获取别名` | L31679-L31682 | — | getAlias() | — | — |
| `getGroup — 获取分组` | L31685-L31688 | — | getGroup() | — | — |
| `getValidateRule — 获取参数校验规则` | L31691-L31702 | .getStartValidateRule() | getValidateRule() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L31705-L31786 | .validateSourceNode()、.preload()、.concat()、.getAuthData()、.initWorkletNode()、.createGain()、.createConstantSource()、.setValueAtTime()、.start()、.postMessage()、.addAudioProcessor()、.forEach()、.set()、.updateAudioReference() | new aW()、new AudioWorkletNode()、start()、asyncGeneratorWrap()、aW()、AudioWorkletNode()、isUndefined() | — | AudioWorklet、Web Audio nodes |
| `update — 方法` | L31789-L31818 | .forEach()、.delete()、.updateAudioReference()、.set()、.concat()、.postMessage() | update()、asyncGeneratorWrap()、isUndefined() | — | — |
| `stop — 停止本地流播放` | L31821-L31832 | .postMessage()、.removeAudioProcessor() | stop()、asyncGeneratorWrap() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L31835-L31840 | .uninstallEvent() | destroy() | 事件属性(onmessage) | — |
| `getAuthData — 获取认证数据（签名等）` | L31843-L31929 | .now()、.slice()、.concat()、.json()、.info() | new aW()、getAuthData()、asyncGeneratorWrap()、String()、yield()、sendKVReport()、fetch()、isSecondsTimestamp()、aW() | — | fetch |
| `initWorkletNode — 方法` | L31932-L31969 | .postMessage()、.concat()、.join()、.emit() | new Date()、initWorkletNode()、String()、formatTimeMs()、Date() | emit('265')、事件属性(onmessage) | — |
| `handleLocalAudioStarted — 本地音频开始回调` | L31972-L31996 | .hitTest()、.startPlugin()、.warn()、.concat() | handleLocalAudioStarted()、asyncGeneratorWrap() | — | — |
| `handleLocalAudioStopped — 本地音频停止回调` | L31999-L32009 | .hitTest()、.stopPlugin() | handleLocalAudioStopped()、asyncGeneratorWrap() | — | — |
| `installEvent — 安装单个事件监听器` | L32012-L32016 | .on() | installEvent() | on('104')、on('114') | — |
| `uninstallEvent — 卸载单个事件监听器` | L32019-L32023 | .off() | uninstallEvent() | — | — |
| `hitTest — 命中检测` | L32026-L32029 | — | hitTest() | — | — |
| `构造函数` | L32040-L32055 | .replaceSource()、.connect() | new AudioPipeline()、new Audio()、constructor()、defineMember()、AudioPipeline()、Audio() | — | — |
| `updateSettings — 更新播放设置` | L32058-L32064 | — | updateSettings()、isUndefined() | — | — |
| `updateListener — 更新事件监听` | L32067-L32092 | — | updateListener()、t() | 事件属性(ondurationchange)、事件属性(ontimeupdate)、事件属性(onended) | — |
| `reload — 重新加载资源` | L32095-L32117 | .download()、.revokeObjectURL()、.createObjectURL()、.replaceSource()、.updateListener()、.updateSettings() | new Audio()、reload()、asyncGeneratorWrap()、Audio() | — | URL/Blob |
| `reset — 重置房间状态（清理所有内部数据）` | L32120-L32123 | .seek()、.connect() | reset() | — | — |
| `seek — 跳转到指定时间位置` | L32126-L32130 | — | seek() | — | — |
| `play — 播放本地流（渲染到指定 DOM 元素）` | L32133-L32142 | .all()、.play() | play() | — | Media playback |
| `pause — 暂停播放` | L32145-L32150 | .pause() | pause() | — | Media playback |
| `stop — 停止本地流播放` | L32153-L32158 | .pause()、.disconnect() | stop() | — | Media playback |
| `setOperation — 设置播放器操作状态（暂停/恢复/停止）` | L32161-L32166 | .pause()、.play()、.seek() | setOperation() | — | Media playback |
| `validatePluginCallback — 内部函数` | L32183-L32190 | .concat() | new aW()、validatePluginCallback()、aW() | — | — |
| `e 类 — e` | L32193-L32424 | .createChild()、.concat()、.getAlias()、.info()、.validateSourceNode()、.has()、.get()、.reset()、.replaceSource()、.connect()、.set()、.updateListener()、.updateSettings()、.play()、.handleAutoPlayFailed()、.updateAudioReference()、.addEnum()、.kvUpload()、.error()、.reload()、.finally()、.off()、.on()、.emit()、.stringify()、.setOperation()、.seek()、.warn()、.stop()、.delete()、.destroyAllMusic()、.addCount()、.forEach()、.clear()、.destroyAllCache() | new Map()、new mG()、constructor()、defineMember()、Map()、getName()、getAlias()、getGroup()、getValidateRule()、start()、asyncGeneratorWrap()、mG()、handleAutoPlayFailed()、createAutoPlayDialog()、update()、isUndefined()、stop()、kvUpload()、destroyAllMusic()、destroyAllCache()、destroy() | on('154')、emit(transportWrapper.AUTOPLAY_FAILED) | Track lifecycle、Media playback |
| `构造函数` | L32196-L32205 | .createChild()、.concat()、.getAlias()、.info() | new Map()、constructor()、defineMember()、Map() | — | — |
| `getName — 获取名称` | L32208-L32211 | — | getName() | — | — |
| `getAlias — 获取别名` | L32214-L32217 | — | getAlias() | — | — |
| `getGroup — 获取分组` | L32220-L32223 | — | getGroup() | — | — |
| `getValidateRule — 获取参数校验规则` | L32226-L32237 | — | getValidateRule() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L32240-L32280 | .validateSourceNode()、.info()、.concat()、.has()、.get()、.reset()、.replaceSource()、.connect()、.set()、.updateListener()、.updateSettings()、.play()、.handleAutoPlayFailed()、.updateAudioReference()、.addEnum()、.kvUpload() | new mG()、start()、asyncGeneratorWrap()、mG() | — | Media playback |
| `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | L32283-L32321 | .error()、.concat()、.reload()、.play()、.finally()、.off()、.on()、.emit() | handleAutoPlayFailed()、asyncGeneratorWrap()、createAutoPlayDialog() | on('154')、emit(transportWrapper.AUTOPLAY_FAILED) | Media playback |
| `t — 源码命名函数` | L32294-L32303 | .play()、.finally()、.off() | — | — | Media playback |
| `asyncGeneratorWrap — 方法` | L32314-L32317 | .play() | asyncGeneratorWrap() | — | Media playback |
| `update — 方法` | L32324-L32337 | .info()、.concat()、.stringify()、.get()、.updateSettings()、.updateListener()、.setOperation()、.seek()、.kvUpload()、.warn() | update()、asyncGeneratorWrap()、isUndefined() | — | — |
| `stop — 停止本地流播放` | L32340-L32368 | .has()、.info()、.concat()、.get()、.updateAudioReference()、.stop()、.delete()、.destroyAllMusic() | stop()、asyncGeneratorWrap() | — | Track lifecycle |
| `kvUpload — 上传 KV 格式的统计数据` | L32371-L32394 | .addCount() | kvUpload() | — | — |
| `destroyAllMusic — 销毁所有音乐资源` | L32397-L32411 | .info()、.forEach()、.updateAudioReference()、.stop() | destroyAllMusic() | — | Track lifecycle |
| `destroyAllCache — 销毁所有缓存` | L32414-L32417 | .info()、.clear() | destroyAllCache() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L32420-L32423 | .info()、.destroyAllMusic()、.destroyAllCache() | destroy() | — | — |
| `validate — 校验/验证数据合法性` | L32439-L32464 | .split()、.pop()、.indexOf()、.startsWith() | new aW()、validate()、aW()、_G() | — | — |
| `validate — 校验/验证数据合法性` | L32479-L32482 | — | validate()、_G() | — | — |
| `e 类 — e` | L32496-L32770 | .createChild()、.concat()、.getAlias()、.info()、.doPreload()、.download()、.createObjectURL()、.error()、.revokeObjectURL()、.startValidateRule()、.validateSourceNode()、.preload()、.now()、.slice()、.getAbilityConfig()、.postMessage()、.join()、.updateConfig()、.addDenoiser()、.sendAbilityStatus()、.removeDenoiser() | new aW()、new AudioWorkletNode()、new Date()、constructor()、defineMember()、observableValue()、startValidateRule()、validate()、aW()、preload()、doPreload()、asyncGeneratorWrap()、initAudioWorklet()、getName()、getAlias()、getGroup()、getValidateRule()、start()、isWasmSimdSupported()、String()、yield()、isSecondsTimestamp()、assignDescriptors()、objectMixin()、AudioWorkletNode()、formatTimeMs()、Date()、update()、stop()、updateConfig()、isUndefined()、destroy() | 事件属性(onmessage) | AudioWorklet、URL/Blob |
| `构造函数` | L32499-L32509 | .createChild()、.concat()、.getAlias()、.info() | constructor()、defineMember()、observableValue() | — | — |
| `validate — 校验/验证数据合法性` | L32525-L32529 | — | new aW()、validate()、aW() | — | — |
| `preload — 预加载资源` | L32534-L32537 | .doPreload() | preload() | — | — |
| `doPreload — 预加载` | L32540-L32560 | .download()、.createObjectURL()、.error()、.revokeObjectURL() | doPreload()、asyncGeneratorWrap()、initAudioWorklet() | — | URL/Blob |
| `getName — 获取名称` | L32563-L32566 | — | getName() | — | — |
| `getAlias — 获取别名` | L32569-L32572 | — | getAlias() | — | — |
| `getGroup — 获取分组` | L32575-L32578 | — | getGroup() | — | — |
| `getValidateRule — 获取参数校验规则` | L32581-L32592 | .startValidateRule() | getValidateRule() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L32595-L32726 | .validateSourceNode()、.preload()、.concat()、.now()、.slice()、.getAbilityConfig()、.info()、.postMessage()、.join()、.updateConfig()、.addDenoiser()、.sendAbilityStatus() | new aW()、new AudioWorkletNode()、new Date()、start()、asyncGeneratorWrap()、aW()、isWasmSimdSupported()、String()、yield()、isSecondsTimestamp()、assignDescriptors()、objectMixin()、AudioWorkletNode()、formatTimeMs()、Date() | 事件属性(onmessage) | AudioWorklet |
| `update — 方法` | L32729-L32735 | .updateConfig() | update()、asyncGeneratorWrap() | — | — |
| `stop — 停止本地流播放` | L32738-L32747 | .postMessage()、.removeDenoiser() | stop()、asyncGeneratorWrap() | — | — |
| `updateConfig — 更新配置` | L32750-L32763 | .postMessage() | updateConfig()、isUndefined() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L32766-L32769 | — | destroy() | 事件属性(onmessage) | — |
| `extends 类 — extends` | L32784-L32854 | .bind()、.observe()、.uploadEvent()、.info()、.concat()、.emit()、.disconnect() | new PressureObserver()、constructor()、super()、defineMember()、stateNum()、start()、asyncGeneratorWrap()、PressureObserver()、onPressureChange()、destroy() | emit('state-changed') | — |
| `构造函数` | L32787-L32793 | .bind() | constructor()、super()、defineMember() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L32810-L32827 | .observe()、.uploadEvent() | new PressureObserver()、start()、asyncGeneratorWrap()、PressureObserver() | — | — |
| `onPressureChange — 网络压力变化回调` | L32830-L32838 | .info()、.concat()、.emit() | onPressureChange() | emit('state-changed') | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L32841-L32853 | .disconnect()、.uploadEvent() | destroy() | — | — |
| `encodeSEIPayload — 内部函数` | L32859-L32874 | .push() | new DataView()、new Uint8Array()、new iH()、encodeSEIPayload()、parseInt()、String()、DataView()、Uint8Array()、iH() | — | Encoding/binary |
| `isEmptySEIFrame — 内部函数` | L32877-L32880 | — | isEmptySEIFrame() | — | — |
| `isSEIFrame — 内部函数` | L32883-L32886 | .getInt32()、.getInt8() | isSEIFrame() | — | — |
| `countAnnexbStartCodes — 内部函数` | L32889-L32909 | .getUint8() | new DataView()、countAnnexbStartCodes()、DataView() | — | Encoding/binary |
| `encapsulateSEIMessage — 内部函数` | L32912-L32933 | .splice()、.reverse()、.map()、.reduce()、.setInt8()、.getInt8() | new ArrayBuffer()、new DataView()、encapsulateSEIMessage()、countAnnexbStartCodes()、ArrayBuffer()、DataView() | — | Encoding/binary |
| `extractSEIMessage — 内部函数` | L32936-L32981 | .getUint8()、.push()、.slice()、.reverse() | new DataView()、new iH()、extractSEIMessage()、DataView()、isEmptySEIFrame()、isSEIFrame()、iH()、i() | — | Encoding/binary |
| `e 类 — e` | L32984-L33109 | .createChild()、.concat()、.getAlias()、.info()、.bind()、.warn()、.forEach()、.emit()、.debug()、.stop()、.addEncodeProcessor()、.addDecodeProcessor()、.removeEncodeProcessor()、.removeDecodeProcessor()、.push()、.postMessage() | constructor()、defineMember()、encode()、encapsulateSEIMessage()、decode()、extractSEIMessage()、destroy()、getValidateRule()、start()、stop()、update()、Boolean()、getName()、getAlias()、getGroup() | emit(transportWrapper.SEI_MESSAGE) | Track lifecycle |
| `构造函数` | L32987-L32999 | .createChild()、.concat()、.getAlias()、.info()、.bind() | constructor()、defineMember() | — | — |
| `encode — 编码视频/音频数据` | L33002-L33020 | .warn() | encode()、encapsulateSEIMessage() | — | — |
| `decode — 解码视频/音频数据` | L33023-L33043 | .forEach()、.emit() | decode()、extractSEIMessage() | emit(transportWrapper.SEI_MESSAGE) | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L33046-L33049 | .debug()、.stop() | destroy() | — | Track lifecycle |
| `getValidateRule — 获取参数校验规则` | L33052-L33061 | — | getValidateRule() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L33064-L33068 | .addEncodeProcessor()、.addDecodeProcessor() | start() | — | — |
| `stop — 停止本地流播放` | L33071-L33075 | .removeEncodeProcessor()、.removeDecodeProcessor() | stop() | — | — |
| `update — 方法` | L33078-L33090 | .push()、.postMessage() | update()、Boolean() | — | — |
| `getName — 获取名称` | L33093-L33096 | — | getName() | — | — |
| `getAlias — 获取别名` | L33099-L33102 | — | getAlias() | — | — |
| `getGroup — 获取分组` | L33105-L33108 | — | getGroup() | — | — |
| `dumpVideoFrame — 内部函数` | L33115-L33121 | — | dumpVideoFrame()、i() | — | — |
| `dumpSEIFrame — 内部函数` | L33124-L33130 | — | dumpSEIFrame()、i() | — | — |
| `e 类 — e` | L33416-L33607 | .createChild()、.concat()、.getAlias()、.info()、.has()、.getItem()、.openDebugDiaLog()、.addVideoProcessor()、.closeDebugDiaLog()、.removeVideoProcessor()、.stop()、.get()、.loadScript()、.addSuccessEvent()、.addFailedEvent()、.error()、.stringify()、.closeDialog()、.addEncodeProcessor()、.bind()、.addDecodeProcessor()、.removeEncodeProcessor()、.removeDecodeProcessor()、.push()、.slice()、.now()、.onDumpEnd() | new URLSearchParams()、new TRTCDebugDialog()、constructor()、defineMember()、getName()、getAlias()、getGroup()、getValidateRule()、start()、asyncGeneratorWrap()、URLSearchParams()、update()、stop()、destroy()、openDebugDiaLog()、TRTCDebugDialog()、closeDebugDiaLog()、addVideoProcessor()、removeVideoProcessor()、encodeVideo()、dumpVideoFrame()、decodeVideo()、dumpSEIFrame() | — | Track lifecycle、URL/Blob、Storage |
| `构造函数` | L33419-L33430 | .createChild()、.concat()、.getAlias()、.info() | constructor()、defineMember() | — | — |
| `getName — 获取名称` | L33433-L33436 | — | getName() | — | — |
| `getAlias — 获取别名` | L33439-L33442 | — | getAlias() | — | — |
| `getGroup — 获取分组` | L33445-L33448 | — | getGroup() | — | — |
| `getValidateRule — 获取参数校验规则` | L33451-L33462 | — | getValidateRule() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L33465-L33475 | .has()、.getItem()、.openDebugDiaLog()、.addVideoProcessor() | new URLSearchParams()、start()、asyncGeneratorWrap()、URLSearchParams() | — | URL/Blob、Storage |
| `update — 方法` | L33478-L33491 | .openDebugDiaLog()、.addVideoProcessor()、.closeDebugDiaLog()、.removeVideoProcessor() | update()、asyncGeneratorWrap() | — | — |
| `stop — 停止本地流播放` | L33494-L33497 | .closeDebugDiaLog()、.removeVideoProcessor() | stop() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L33500-L33503 | .stop() | destroy() | — | Track lifecycle |
| `openDebugDiaLog — 打开调试弹窗` | L33506-L33539 | .get()、.getItem()、.concat()、.loadScript()、.addSuccessEvent()、.addFailedEvent()、.error()、.stringify() | new URLSearchParams()、new TRTCDebugDialog()、openDebugDiaLog()、asyncGeneratorWrap()、URLSearchParams()、TRTCDebugDialog() | — | URL/Blob、Storage |
| `closeDebugDiaLog — 关闭调试弹窗` | L33542-L33545 | .closeDialog() | closeDebugDiaLog() | — | — |
| `addVideoProcessor — 添加视频处理器` | L33548-L33558 | .addEncodeProcessor()、.bind()、.addDecodeProcessor() | addVideoProcessor() | — | — |
| `removeVideoProcessor — 移除视频处理器` | L33561-L33565 | .removeEncodeProcessor()、.removeDecodeProcessor() | removeVideoProcessor() | — | — |
| `encodeVideo — 编码视频数据` | L33568-L33586 | .push()、.slice()、.now()、.onDumpEnd() | encodeVideo()、dumpVideoFrame() | — | — |
| `decodeVideo — 解码视频数据` | L33589-L33606 | .concat()、.push()、.slice()、.now()、.onDumpEnd() | decodeVideo()、dumpSEIFrame() | — | — |
| `HG — 源码命名函数` | L33611-L33621 | — | new Error()、Error() | — | — |
| `构造函数` | L33625-L33688 | .pipe()、.next()、.info()、.concat()、.error()、.addFailedEvent()、.setOutput()、.addSuccessEvent() | constructor()、defineMember()、fromEventObservable()、createSubjectFromObservable()、pipeOperator()、combineObservableSources()、IB()、qF()、createTapOperator()、HG()、JF()、WB() | — | — |
| `mock — 模拟操作（测试/调试用）` | L33691-L33694 | .error()、.next() | mock() | — | — |
| `close — 关闭本地流并释放所有轨道` | L33697-L33700 | .next() | close() | — | — |
| `pipe — 管道传输（数据流处理）` | L33703-L33740 | .defer()、.close()、.error()、.next()、.write()、.configure() | new AudioDecoder()、pipe()、createSubject()、asyncGeneratorWrap()、AudioDecoder() | — | WebCodecs |
| `asyncGeneratorWrap — 方法` | L33708-L33738 | .defer()、.close()、.error()、.next()、.write()、.configure() | new AudioDecoder()、asyncGeneratorWrap()、AudioDecoder() | — | WebCodecs |
| `decodeFrame — 解码视频帧` | L33743-L33750 | .decode() | new EncodedAudioChunk()、decodeFrame()、EncodedAudioChunk() | — | WebCodecs |
| `e 类 — e` | L33755-L33859 | .createChild()、.concat()、.getAlias()、.set()、.decode()、.addDecodeProcessor()、.has()、.get()、.decodeFrame()、.clearStarted()、.getGroup()、.stop()、.close()、.delete()、.removeDecodeProcessor()、.mock() | new Map()、new WeakMap()、new WG()、constructor()、defineMember()、Map()、WeakMap()、getAlias()、getGroup()、getName()、getValidateRule()、start()、decode()、WG()、pipeOperator()、JF()、createTapOperator()、stop()、update() | — | Track lifecycle |
| `构造函数` | L33758-L33765 | .createChild()、.concat()、.getAlias() | new Map()、new WeakMap()、constructor()、defineMember()、Map()、WeakMap() | — | — |
| `getAlias — 获取别名` | L33768-L33771 | — | getAlias() | — | — |
| `getGroup — 获取分组` | L33774-L33777 | — | getGroup() | — | — |
| `getName — 获取名称` | L33780-L33783 | — | getName() | — | — |
| `getValidateRule — 获取参数校验规则` | L33786-L33789 | — | getValidateRule() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L33792-L33807 | .set()、.decode()、.addDecodeProcessor()、.has()、.get() | start() | — | — |
| `decode — 解码视频/音频数据` | L33810-L33834 | .has()、.get()、.decodeFrame()、.clearStarted()、.getGroup()、.stop()、.set() | new WG()、decode()、WG()、pipeOperator()、JF()、createTapOperator() | — | Track lifecycle |
| `stop — 停止本地流播放` | L33837-L33846 | .get()、.close()、.delete()、.removeDecodeProcessor() | stop() | — | — |
| `update — 方法` | L33849-L33858 | .get()、.mock()、.close()、.set() | new WG()、update()、WG() | — | — |
| `构造函数` | L33866-L33869 | .createLogger() | constructor()、defineMember() | — | — |
| `call — 发送信令请求并等待响应` | L33872-L33882 | .reject() | new RtcErrorAlias()、call()、asyncGeneratorWrap()、isFunction()、RtcErrorAlias()、logConfig() | — | — |
| `enableAudioFrameEvent — 启用音频帧事件通知` | L33885-L33936 | .set()、.forEach()、.get()、.getPCM()、.emit()、.abort()、.delete() | enableAudioFrameEvent()、asyncGeneratorWrap() | emit(transportWrapper.AUDIO_FRAME) | — |
| `resumeRemotePlayer — 恢复远端播放器播放（处理自动播放失败后恢复）` | L33939-L33971 | .forEach()、.push()、.resume()、.all()、.get() | resumeRemotePlayer()、asyncGeneratorWrap() | — | — |
| `pauseRemotePlayer — 暂停远端播放器` | L33974-L33998 | .forEach()、.pause()、.get() | pauseRemotePlayer() | — | Media playback |
| `extends 类 — extends` | L34037-L34106 | .createLogger()、.emit()、.info()、.concat()、.join()、.resolve()、.getUserMedia()、.includes()、.getTracks()、.forEach()、.stop()、.query()、.addEventListener()、.error()、.values()、.removeEventListener() | constructor()、super()、defineMember()、request()、asyncGeneratorWrap()、get()、destroy() | addEventListener('change')、removeEventListener('change')、emit('permission-state-change') | getUserMedia、Track lifecycle、Permissions |
| `构造函数` | L34040-L34056 | .createLogger()、.emit() | constructor()、super()、defineMember() | emit('permission-state-change') | — |
| `request — 发送 HTTP 请求（内部工具方法，含超时和错误处理）` | L34059-L34068 | .info()、.concat()、.join()、.resolve()、.getUserMedia()、.includes()、.getTracks()、.forEach()、.stop() | request()、asyncGeneratorWrap() | — | getUserMedia、Track lifecycle |
| `get — HTTP GET 请求便捷封装` | L34071-L34095 | .query()、.addEventListener()、.info()、.concat()、.error() | get()、asyncGeneratorWrap() | addEventListener('change') | Permissions |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L34098-L34105 | .values()、.forEach()、.removeEventListener() | destroy() | removeEventListener('change') | — |
## SDK 对外门面（L34100-L36520）
详见：`00-Reading-Guide-and-Source-Map.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `构造函数` | L34126-L34249 | .createLogger()、.concat()、.info()、.stringify()、.map()、.defineProperties()、.dump()、.forEach()、._use()、.on()、.find()、.push()、.floor()、.getInternalAudioLevelAfter3A()、.getAudioLevel()、.getInternalAudioLevel()、.get()、.emit()、.sort()、.error()、._listenEvents()、._initActiveSpeaker()、.apply()、.warn() | new Set()、new Map()、new WeakMap()、new RoomClass()、new aW()、new Array()、constructor()、super()、defineMember()、Set()、Map()、WeakMap()、RoomClass()、objectMixin()、isBoolean()、value()、aW()、Array()、logConfig() | on('audio-volume')、on('error')、emit(transportWrapper.AUDIO_VOLUME) | — |
| `value — 方法` | L34159-L34162 | .dump() | value() | — | — |
| `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | L34299-L34540 | .add()、.emit()、._exitRoom()、.finally()、.convertFrom()、.min()、.forEach()、.getCode()、.resume()、.delete()、._removeRemoteVideoConfig()、._onVideoAvailable()、._onVideoUnavailable()、._onAudioAvailable()、._onAudioUnavailable()、.filter()、.map()、.find()、.on()、.get()、.updateAlphaRenderInfo() | new aW()、_listenEvents()、createEventDispatcher()、setScheduleFlag()、assignDescriptors()、objectMixin()、convertStreamTypeFormat()、destroyEventDispatcher()、aW()、asyncGeneratorWrap()、checkDeviceAvailability() | on(transportWrapper.SEI_MESSAGE)、emit(transportWrapper.REMOTE_USER_ENTER)、emit(transportWrapper.REMOTE_USER_EXIT)、emit(transportWrapper.KICKED_OUT)、emit(transportWrapper.ERROR)、emit(transportWrapper.CONNECTION_STATE_CHANGED)、emit(transportWrapper.NETWORK_QUALITY)、emit(t.kind === StreamConstants.AUDIO ? transportWrapper.AUDIO_PLAY_STATE_CHANGED : transportWrapper.VIDEO_PLAY_STATE_CHANGED)、emit(transportWrapper.AUTOPLAY_FAILED)、emit(a ? transportWrapper.REMOTE_VIDEO_AVAILABLE : transportWrapper.REMOTE_VIDEO_UNAVAILABLE)、emit(s ? transportWrapper.REMOTE_AUDIO_AVAILABLE : transportWrapper.REMOTE_AUDIO_UNAVAILABLE)、emit(i.hasAuxiliary ? transportWrapper.REMOTE_VIDEO_AVAILABLE : transportWrapper.REMOTE_VIDEO_UNAVAILABLE)、emit(transportWrapper.SEI_MESSAGE)、emit(transportWrapper.STATISTICS)、emit(transportWrapper.CUSTOM_MESSAGE)、emit(transportWrapper.LAYER_DATA)、emit(transportWrapper.FIRST_VIDEO_FRAME)、emit(transportWrapper.AUDIO_FRAME)、emit(transportWrapper.DEVICE_CHANGED)、emit(transportWrapper.PERMISSION_STATE_CHANGE) | — |
| `asyncGeneratorWrap — 方法` | L34499-L34511 | .emit()、.find() | asyncGeneratorWrap()、checkDeviceAvailability() | emit(transportWrapper.DEVICE_CHANGED) | — |
| `asyncGeneratorWrap — 方法` | L34516-L34526 | .emit() | asyncGeneratorWrap()、checkDeviceAvailability() | emit(transportWrapper.DEVICE_CHANGED) | — |
| `getNetworkTime — 获取校准后的服务器网络时间` | L34543-L34546 | — | getNetworkTime()、getServerTime() | — | — |
| `use — 注册外部插件（按名称/插件对象注册）` | L34549-L34559 | ._use() | use() | — | — |
| `_use — 内部：注册并初始化插件的实现` | L34562-L34578 | .get()、.warn()、.call()、.set()、.startPlugin() | new t()、_use()、t() | — | — |
| `enterRoom — 进入 TRTC 房间，需传入房间 ID 和用户签名（sdkAppId/userId/userSig/roomId）` | L34581-L34628 | .setProxyServer()、.call()、.join()、._checkTrackToPublish()、.start() | enterRoom()、asyncGeneratorWrap()、isString()、isBoolean() | — | — |
| `exitRoom — 退出当前 TRTC 房间，断开信令连接、清理所有推拉流和媒体资源` | L34631-L34637 | ._exitRoom() | exitRoom()、asyncGeneratorWrap() | — | — |
| `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | L34640-L34662 | .isSwitchRoomSupported()、._clearRemoteTracks()、.switchRoom()、.warn()、.concat()、._rejoinRoom() | switchRoom()、asyncGeneratorWrap() | — | — |
| `_rejoinRoom — 内部：网络断开后自动重新加入房间` | L34665-L34674 | .exitRoom()、.enterRoom() | _rejoinRoom()、asyncGeneratorWrap()、objectMixin() | — | — |
| `_clearRemoteTracks — 内部：清理所有远端轨道` | L34677-L34703 | .keys()、.forEach()、._stopRemoteAudio()、.catch()、.includes()、.split()、.concat()、._stopRemoteVideo()、.clear()、.get()、.delete() | new Set()、_clearRemoteTracks()、Set()、clearTimeout()、destroyEventDispatcher() | — | Timers/scheduling |
| `switchRole — 切换用户角色（anchor/audience），影响发布权限和远端可见性` | L34706-L34715 | .switchRole()、._checkTrackToPublish() | switchRole()、asyncGeneratorWrap() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L34718-L34737 | .forEach()、.call()、.clear()、.removeAllListeners()、.destroy()、.delete()、.stopLocalAudio()、.stopLocalVideo()、.stopScreenShare()、.off() | destroy()、destroyEventDispatcher() | — | — |
| `startLocalAudio — 采集本地麦克风音频并推送到房间` | L34740-L34796 | .warn()、.setCaptureVolume()、.setProfile()、.on()、.emit()、.convertFrom()、._listenOutputTrackChanged()、.setAudioOutput()、.capture()、.setMute()、.add()、.publish()、.catch()、._updateAudioPlayOption() | new tH()、new aW()、startLocalAudio()、asyncGeneratorWrap()、tH()、isUndefined()、isNumber()、isString()、isBoolean()、aW()、assignDescriptors()、objectMixin()、createEventDispatcher() | on('5')、on('2')、on('4')、on('6')、emit(transportWrapper.ERROR)、emit(transportWrapper.DEVICE_CHANGED)、emit(transportWrapper.PUBLISH_STATE_CHANGED)、emit(transportWrapper.AUDIO_PLAY_STATE_CHANGED)、emit('113') | — |
| `updateLocalAudio — 更新本地音频采集参数（音量、降噪开关、音频质量等）` | L34799-L34826 | .switchDevice()、.setInputMediaStreamTrack()、.setCaptureVolume()、.update3A()、.publish()、.catch()、.unpublish()、.setMute()、._updateAudioPlayOption() | updateLocalAudio()、asyncGeneratorWrap()、isUndefined()、deepMerge() | — | — |
| `stopLocalAudio — 停止本地麦克风音频采集并取消推送` | L34829-L34843 | .unpublish()、.catch()、.emit()、.stop()、.close()、.removeInput() | stopLocalAudio()、asyncGeneratorWrap()、destroyEventDispatcher() | emit('114') | Track lifecycle |
| `startLocalVideo — 采集本地摄像头视频并推送到房间` | L34846-L34920 | .warn()、.setProfile()、.stopSmall()、.updateSmallConfig()、.setRotation()、.once()、.emit()、.on()、.convertFrom()、._listenOutputTrackChanged()、.capture()、.changeInput()、.setMute()、.add()、.publish()、.catch()、._updateVideoPlayOption() | new oH()、new aW()、startLocalVideo()、asyncGeneratorWrap()、oH()、isBoolean()、isUndefined()、mapQoSToContentHint()、isString()、mergeVideoProfile()、assignDescriptors()、objectMixin()、convertStreamTypeFormat()、aW()、createEventDispatcher() | on('5')、on('2')、on('4')、on('6')、once('first-video-frame')、emit(transportWrapper.FIRST_VIDEO_FRAME)、emit(transportWrapper.ERROR)、emit(transportWrapper.DEVICE_CHANGED)、emit(transportWrapper.PUBLISH_STATE_CHANGED)、emit(transportWrapper.VIDEO_PLAY_STATE_CHANGED)、emit(transportWrapper.VIDEO_SIZE_CHANGED) | — |
| `updateLocalVideo — 更新本地视频参数（分辨率、帧率、码率、渲染视图等）` | L34923-L34996 | .switchDevice()、.setInputMediaStreamTrack()、.stopCapture()、.capture()、.setProfile()、.isNeedToSwitchDevice()、.applyProfile()、.setRotation()、.setContentHint()、.stopSmall()、.updateSmallConfig()、.publish()、.catch()、.unpublish()、.setMute()、._updateVideoPlayOption() | updateLocalVideo()、asyncGeneratorWrap()、isUndefined()、isString()、mapQoSToContentHint()、isBoolean()、mergeVideoProfile()、deepMerge() | — | — |
| `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | L34999-L35011 | .unpublish()、.catch()、.stop()、.close() | stopLocalVideo()、asyncGeneratorWrap()、destroyEventDispatcher() | — | Track lifecycle |
| `updateScreenShare — 更新屏幕共享参数（分辨率、帧率、码率等）` | L35107-L35152 | .setContentHint()、.push()、.forEach()、.publish()、.catch()、.unpublish()、._updateVideoPlayOption() | updateScreenShare()、asyncGeneratorWrap()、isUndefined()、mapQoSToContentHint()、isBoolean()、deepMerge() | — | — |
| `stopScreenShare — 停止屏幕共享采集和推送` | L35155-L35161 | ._stopScreenShare() | stopScreenShare()、asyncGeneratorWrap() | — | — |
| `startRemoteVideo — 开始播放远端视频（触发订阅远端流）` | L35164-L35214 | .concat()、.has()、.warn()、.get()、.on()、.emit()、._listenOutputTrackChanged()、.setMediaType()、.changeType()、.setDraggable()、.subscribe()、._enableVideoDecodeFallback()、._updateVideoPlayOption()、._emitTrackEvent()、.set()、._observeView() | new aW()、startRemoteVideo()、asyncGeneratorWrap()、aW()、assignDescriptors()、objectMixin()、convertStreamTypeFormat()、isUndefined() | on('decode-failed')、on('video-size-changed')、emit(transportWrapper.ERROR)、emit(transportWrapper.VIDEO_SIZE_CHANGED) | — |
| `updateRemoteVideo — 更新远端视频播放参数` | L35217-L35255 | .concat()、.get()、.has()、.changeType()、.setDraggable()、._updateVideoPlayOption()、._observeView() | updateRemoteVideo()、asyncGeneratorWrap()、isUndefined()、deepMerge() | — | — |
| `stopRemoteVideo — 停止远端视频播放` | L35258-L35264 | ._stopRemoteVideo() | stopRemoteVideo()、asyncGeneratorWrap() | — | — |
| `_stopRemoteVideo — 内部：停止远端视频播放` | L35267-L35287 | .get()、.stop()、.push()、.unsubscribe()、.delete()、._removeRemoteVideoConfig() | _stopRemoteVideo()、asyncGeneratorWrap() | — | Track lifecycle |
| `_removeRemoteVideoConfig — 内部：移除远端视频配置项` | L35290-L35296 | .concat()、.get()、.disconnect()、.delete() | _removeRemoteVideoConfig() | — | — |
| `muteRemoteAudio — 静音/取消静音指定远端用户的音频` | L35299-L35327 | .set()、._stopRemoteAudio()、.values()、.has()、._startRemoteAudio()、.delete() | muteRemoteAudio()、asyncGeneratorWrap() | — | — |
| `setRemoteAudioVolume — 设置指定远端用户的音频播放音量` | L35330-L35352 | .set()、.forEach()、.values()、._updateAudioPlayOption()、.get() | setRemoteAudioVolume() | — | — |
| `startPlugin — 启动指定名称的插件` | L35355-L35361 | .start() | startPlugin()、asyncGeneratorWrap() | — | — |
| `updatePlugin — 更新插件配置参数` | L35364-L35370 | .update() | updatePlugin()、asyncGeneratorWrap() | — | — |
| `stopPlugin — 停止并卸载指定名称的插件` | L35373-L35379 | .stop() | stopPlugin()、asyncGeneratorWrap() | — | Track lifecycle |
| `enableAudioVolumeEvaluation — 开启/关闭音量回调通知（设置回调间隔，单位 ms）` | L35382-L35388 | .enableAudioVolumeEvaluation() | enableAudioVolumeEvaluation() | — | — |
| `on — 注册事件监听器` | L35391-L35408 | .listeners()、.includes()、.debug()、.on()、.add()、.get()、.set()、.handleLocalTrackStarted() | on() | on(e) | — |
| `emit — 触发事件通知所有注册的监听器` | L35411-L35421 | .has()、.debug()、.concat()、.stringify()、.emit() | new Array()、emit()、Array() | emit(e) | — |
| `off — 移除指定事件监听器` | L35424-L35442 | .debug()、.clear()、.removeAllListeners()、.off()、.listeners()、.forEach()、.abort() | off() | — | — |
| `getAudioTrack — 获取本地音频 MediaStreamTrack` | L35445-L35466 | .get()、.clone() | getAudioTrack()、isString() | — | Track lifecycle |
| `getVideoTrack — 获取本地视频 MediaStreamTrack` | L35469-L35490 | .get()、.clone() | getVideoTrack() | — | Track lifecycle |
| `getVideoSnapshot — 获取当前视频画面截图（返回 base64 DataURL）` | L35493-L35512 | .get()、.getVideoFrame() | getVideoSnapshot() | — | — |
| `_setCurrentSpeaker — 内部：设置当前音频输出设备` | L35515-L35523 | .setAudioOutput()、.forEach() | _setCurrentSpeaker() | — | — |
| `setCurrentSpeaker — 设置扬声器设备（音频输出设备 ID）` | L35526-L35544 | .forEach()、._setCurrentSpeaker()、.emit()、.warn()、.concat() | setCurrentSpeaker()、asyncGeneratorWrap()、checkDeviceAvailability() | emit(transportWrapper.DEVICE_CHANGED) | — |
| `_startRemoteAudio — 内部：开始远端音频播放` | L35547-L35550 | ._doStartRemoteAudio() | _startRemoteAudio() | — | — |
| `_doStartRemoteAudio — 内部：执行远端音频播放逻辑` | L35553-L35609 | .has()、.warn()、.concat()、.get()、.on()、.emit()、._listenOutputTrackChanged()、.setAudioOutput()、.set()、.subscribe()、.startPlugin()、._updateAudioPlayOption()、.updateAudioReference()、.delete()、._emitTrackEvent() | new aW()、_doStartRemoteAudio()、asyncGeneratorWrap()、aW()、isNumber()、pipeOperator()、fromEventObservable()、qF()、createTapOperator() | on('decode-failed')、emit(transportWrapper.ERROR)、emit('115') | — |
| `_stopRemoteAudio — 内部：停止远端音频播放` | L35612-L35629 | .get()、.stop()、.unsubscribe()、.delete()、.concat()、.emit()、.updateAudioReference() | _stopRemoteAudio()、asyncGeneratorWrap() | emit('116') | Track lifecycle |
| `_enableVideoDecodeFallback — 内部：切换视频解码降级策略（软解/硬解）` | L35632-L35671 | .has()、.debug()、.startPlugin()、.emit()、.error()、.info() | _enableVideoDecodeFallback()、pipeOperator()、fromEventObservable()、qF()、KB()、reportManager()、createTapOperator()、assignDescriptors()、objectMixin() | emit(transportWrapper.VIDEO_DECODE_DOWNGRADE_STATE_CHANGED) | — |
| `_updateVideoPlayOption — 内部：更新视频播放选项` | L35674-L35697 | .setMirror()、.play()、.stop() | _updateVideoPlayOption()、asyncGeneratorWrap()、isUndefined()、isEmpty()、getViewListFromView() | — | Track lifecycle、Media playback |
| `_updateAudioPlayOption — 内部：更新音频播放选项` | L35700-L35739 | .play()、.setPlayerMute()、.setAudioVolume()、.updateAudioReference()、.concat() | _updateAudioPlayOption()、asyncGeneratorWrap()、isUndefined() | — | Media playback |
| `_listenOutputTrackChanged — 内部：监听输出轨道切换事件` | L35742-L35746 | .listeners()、.on()、._emitTrackEvent() | _listenOutputTrackChanged() | on('output-media-track-changed') | — |
| `_emitTrackEvent — 内部：向外部发射轨道状态事件` | L35749-L35763 | .get()、.set()、.emit() | _emitTrackEvent()、convertStreamTypeFormat() | emit(transportWrapper.TRACK) | — |
| `_checkTrackToPublish — 内部：检查待发布轨道的合法性` | L35766-L35782 | .push()、._checkScreenAudioEchoCancellation()、.all()、.map()、.publish()、.catch() | _checkTrackToPublish() | — | — |
| `_observeView — 内部：监听视频渲染 DOM 元素的变化（尺寸适配）` | L35785-L35837 | .get()、.concat()、.disconnect()、.subscribe()、.catch()、.clear()、.forEach()、.set()、.info()、.setTimeout()、.values()、.find()、.unsubscribe()、.has()、.unobserve()、.delete()、.observe()、.takeRecords() | new Map()、new IntersectionObserver()、new Set()、_observeView()、isUndefined()、convertStreamTypeFormat()、isArray()、Map()、IntersectionObserver()、clearTimeout()、Set()、getViewListFromView() | — | DOM、Timers/scheduling |
| `_exitRoom — 内部：执行退出房间的资源清理流程` | L35840-L35846 | .leave()、._clearRemoteTracks() | _exitRoom()、asyncGeneratorWrap() | — | — |
| `_stopScreenShare — 内部：停止屏幕共享的逻辑` | L35849-L35878 | .push()、.all()、.map()、.unpublish()、.catch()、.stop()、.close()、.stopPlugin()、.removeInput() | _stopScreenShare()、asyncGeneratorWrap()、destroyEventDispatcher() | — | Track lifecycle |
| `_checkScreenAudioEchoCancellation — 内部：检查屏幕共享音频回声消除设置` | L35881-L35912 | .warn()、.startPlugin() | _checkScreenAudioEchoCancellation()、asyncGeneratorWrap()、Number() | — | — |
| `_onLocalTrackCaptured — 内部：本地轨道采集完成后的处理（触发布置）` | L35915-L35922 | ._initActiveSpeaker()、.off() | _onLocalTrackCaptured()、$V() | — | — |
| `_initActiveSpeaker — 内部：初始化活跃发言人检测逻辑` | L35925-L35939 | .emit()、.on() | _initActiveSpeaker()、asyncGeneratorWrap()、$V()、checkDeviceAvailability() | on('102')、emit(transportWrapper.DEVICE_CHANGED) | — |
| `_onAudioAvailable — 内部：远端音频可用时的回调` | L35942-L35948 | .has()、.get()、._doStartRemoteAudio()、.catch() | _onAudioAvailable() | — | — |
| `_onVideoAvailable — 内部：远端视频可用时的回调` | L35951-L35972 | .get()、.push()、.subscribe()、.then()、._emitTrackEvent()、.catch() | _onVideoAvailable() | — | — |
| `_onAudioUnavailable — 内部：远端音频不可用时的回调` | L35975-L35980 | ._stopRemoteAudio()、.catch() | _onAudioUnavailable() | — | — |
| `_onVideoUnavailable — 内部：远端视频不可用时的回调` | L35983-L35988 | ._stopRemoteVideo()、.catch() | _onVideoUnavailable() | — | — |
| `sendSEIMessage — 向视频流中嵌入 SEI 消息（补充增强信息，最大 24 字节）` | L35991-L36002 | .get()、.update()、.addCount() | sendSEIMessage()、assignDescriptors()、objectMixin() | — | — |
| `sendCustomMessage — 向房间内其他用户发送自定义消息（二进制数据）` | L36005-L36010 | .call()、.addCount() | sendCustomMessage() | — | — |
| `callExperimentalAPI — 调用实验性内部 API（⚠️ 仅限测试用途）` | L36013-L36022 | .info()、.concat()、.stringify()、.call() | callExperimentalAPI()、asyncGeneratorWrap()、objectMixin() | — | — |
| `asyncGeneratorWrap — 方法` | L36099-L36102 | .updateLocalAudio() | asyncGeneratorWrap() | — | — |
| `getSize — 获取大小/长度` | L36459-L36464 | — | new Array()、Array() | — | — |
| `构造函数` | L36493-L36498 | .on() | new Set()、constructor()、defineMember()、Set() | on(Events.LEAVE_SUCCESS)、on(Events.SWITCH_ROOM_SUCCESS) | — |
| `add — 方法` | L36501-L36509 | .getKey()、.add() | add() | — | — |
| `getKey — 获取键` | L36521-L36526 | .concat() | getKey() | — | — |
## WebSocket 信令（L36521-L37359）
详见：`03-WebSocket-usage-analysis.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `isJoined — 检查是否已加入房间` | L36529-L36535 | .has()、.getKey() | isJoined() | — | — |
| `handleSwitchRoomSuccess — 切换房间成功回调` | L36538-L36545 | .delete()、.getKey()、.add() | handleSwitchRoomSuccess() | — | — |
| `logDeviceAndCapabilities — 记录设备和能力信息` | L36550-L36605 | .basis()、.uploadEvent()、.concat()、.stringify()、.info() | logDeviceAndCapabilities()、asyncGeneratorWrap()、getMicrophoneTrackList()、getCameraTrackList()、detectVideoCodecCapabilities() | — | — |
| `extends 类 — extends` | L36746-L37331 | .add()、.createLogger()、.getLogger()、.bind()、.concat()、.forEach()、.get()、.now()、.resolve()、.info()、.emitConnectionStateChanged()、.connectWS()、.push()、.unbindAndCloseSocket()、.addSuccessEvent()、.bindSocket()、.finally()、.addEventListener()、.removeEventListener()、.unbindSocket()、.close()、.warn()、.startReconnection()、.emit()、.error()、.reconnect()、.parse()、.values()、.keys()、.indexOf()、.includes()、.debug()、.getTime()、.addFailedEvent()、.schedule()、.getSignalChannelUrl()、.connect()、.sendWaitForResponse()、.stopReconnection()、.syncUserList()；+10 | new URLSearchParams()、new WebSocket()、new Promise()、new RtcErrorAlias()、new Date()、constructor()、super()、defineMember()、race()、urlParam()、encodeURIComponent()、Number()、URLSearchParams()、_urlWithParam()、_backupUrlWithParam()、isConnected()、isConnecting()、isOnline()、connect()、asyncGeneratorWrap()、performanceNow()、promiseAny()、connectWS()、WebSocket()、Promise()、e()、setTimeout()、t()、RtcErrorAlias()、clearTimeout()、bindSocket()、unbindSocket()、unbindAndCloseSocket()、onclose()、onerror()、onmessage()、getStringByteLength()、setTimeOffset()、Date()、logConfig()；+20 | addEventListener('close')、addEventListener('error')、addEventListener('message')、removeEventListener('close')、removeEventListener('error')、removeEventListener('message')、on(n)、on(_j.JOIN_ROOM_RESULT)、once(MSG_TYPE_7)、once(MSG_TYPE_8)、emit(MSG_TYPE_5)、emit(MSG_TYPE_8)、emit(MSG_TYPE_1)、emit(a)、emit(String(a)、emit(MSG_TYPE_7)、emit(MSG_TYPE_2)、emit(MSG_TYPE_3) : e === 'DISCONNECTED' && this.emit(MSG_TYPE_6)、事件属性(onmessage)、事件属性(onerror)；+2 | WebSocket、URL/Blob、Timers/scheduling |
| `构造函数` | L36749-L36811 | .add()、.createLogger()、.getLogger()、.bind() | constructor()、super()、defineMember() | 事件属性(onmessage)、事件属性(onerror)、事件属性(onclose) | — |
| `connect — 建立 WebSocket 信令连接` | L36867-L36899 | .resolve()、.info()、.concat()、.emitConnectionStateChanged()、.connectWS()、.push()、.unbindAndCloseSocket()、.addSuccessEvent() | connect()、asyncGeneratorWrap()、Number()、performanceNow()、promiseAny() | — | — |
| `connectWS — 建立 WebSocket 连接` | L36902-L36926 | .bindSocket()、.unbindAndCloseSocket()、.finally() | new WebSocket()、new Promise()、new RtcErrorAlias()、connectWS()、WebSocket()、Promise()、e()、setTimeout()、t()、RtcErrorAlias()、clearTimeout() | 事件属性(onclose)、事件属性(onerror)、事件属性(onopen) | WebSocket、Timers/scheduling |
| `bindSocket — 绑定 WebSocket 实例到连接管理器` | L36929-L36934 | .addEventListener() | bindSocket() | addEventListener('close')、addEventListener('error')、addEventListener('message') | — |
| `unbindSocket — 解绑 WebSocket 实例` | L36937-L36942 | .removeEventListener() | unbindSocket() | removeEventListener('close')、removeEventListener('error')、removeEventListener('message') | — |
| `unbindAndCloseSocket — 解绑并关闭 WebSocket 连接` | L36945-L36970 | .unbindSocket()、.close() | unbindAndCloseSocket() | — | — |
| `onclose — 连接关闭事件回调` | L36973-L36986 | .warn()、.concat()、.emitConnectionStateChanged()、.startReconnection()、.emit() | new RtcErrorAlias()、onclose()、RtcErrorAlias() | emit(MSG_TYPE_5) | — |
| `onerror — 连接错误事件回调` | L36989-L37000 | .error()、.concat()、.emitConnectionStateChanged()、.unbindAndCloseSocket()、.reconnect()、.emit() | new RtcErrorAlias()、onerror()、RtcErrorAlias() | emit(MSG_TYPE_5) | — |
| `onmessage — 收到消息事件回调` | L37003-L37065 | .now()、.emit()、.parse()、.values()、.keys()、.indexOf()、.includes()、.debug()、.concat()、.info()、.getTime()、.addSuccessEvent()、.error()、.close()、.addFailedEvent() | new Date()、new RtcErrorAlias()、onmessage()、getStringByteLength()、setTimeOffset()、Date()、performanceNow()、RtcErrorAlias()、logConfig()、String() | emit(MSG_TYPE_8)、emit(MSG_TYPE_1)、emit(MSG_TYPE_5)、emit(a)、emit(String(a) | — |
| `reGetSignalChannelUrl — 重新获取信令通道 URL` | L37068-L37082 | .schedule()、.getSignalChannelUrl() | reGetSignalChannelUrl()、asyncGeneratorWrap()、setScheduleFlag() | — | — |
| `startReconnection — 开始重连流程` | L37085-L37095 | .close()、.unbindAndCloseSocket()、.emitConnectionStateChanged()、.reconnect() | startReconnection() | 事件属性(onclose) | — |
| `reconnect — 重新建立信令连接` | L37098-L37134 | .close()、.warn()、.connect()、.sendWaitForResponse()、.stopReconnection()、.addSuccessEvent()、.syncUserList()、.checkConnectionsToReconnect()、.addFailedEvent()、.concat()、.reJoin()、.error() | reconnect()、asyncGeneratorWrap()、performanceNow() | — | — |
| `send — 发送信令消息` | L37137-L37149 | .stringify()、.send() | send()、getStringByteLength() | — | — |
| `sendWaitForResponse — 发送请求并等待响应` | L37152-L37193 | .concat()、.once()、.off()、.warn()、.now()、.on()、.send() | new Promise()、new RtcErrorAlias()、sendWaitForResponse()、Promise()、clearTimeout()、c()、RtcErrorAlias()、setTimeout()、logConfig()、e() | on(n)、once(MSG_TYPE_7) | Timers/scheduling |
| `l — 源码命名函数` | L37167-L37171 | .concat() | new RtcErrorAlias()、clearTimeout()、c()、RtcErrorAlias() | — | Timers/scheduling |
| `u — 源码命名函数` | L37184-L37188 | .off()、.now() | clearTimeout()、e() | — | Timers/scheduling |
| `sendWaitForResponseWithRetry — 发送请求并等待响应（带重试）` | L37196-L37225 | .warn()、.concat()、.once() | sendWaitForResponseWithRetry()、FN()、r()、t() | once(MSG_TYPE_8) | — |
| `getCurrentState — 获取当前状态` | L37228-L37231 | — | getCurrentState() | — | — |
| `getSignalInfo — 获取信令连接信息` | L37234-L37237 | — | getSignalInfo() | — | — |
| `stopReconnection — 停止重连` | L37240-L37243 | ._stopConnectRetry() | stopReconnection() | — | — |
| `close — 关闭本地流并释放所有轨道` | L37246-L37271 | .info()、.delete()、.stopReconnection()、._stopConnectRetry()、.unbindAndCloseSocket()、.emitConnectionStateChanged()、.emit() | close()、clearTimeout() | emit(MSG_TYPE_7) | Timers/scheduling |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L37274-L37277 | .close() | destroy() | — | — |
| `getBackupRelayIpPair — 获取备用中继 IP 对` | L37280-L37287 | .shift() | getBackupRelayIpPair() | — | — |
| `clearBakRelayIps — 清除备用中继 IP` | L37290-L37293 | — | clearBakRelayIps() | — | — |
| `stopKeepAliveIn — 停止内部保活机制` | L37296-L37320 | .info()、.concat()、.close()、.off()、.on() | stopKeepAliveIn()、setTimeout()、clearTimeout() | on(_j.JOIN_ROOM_RESULT) | Timers/scheduling |
| `t — 源码命名函数` | L37310-L37316 | .info()、.off() | clearTimeout() | — | Timers/scheduling |
| `emitConnectionStateChanged — 发射连接状态变化事件` | L37323-L37330 | .info()、.concat()、.emit() | emitConnectionStateChanged() | emit(MSG_TYPE_2)、emit(MSG_TYPE_3) : e === 'DISCONNECTED' && this.emit(MSG_TYPE_6) | — |
| `onError — 错误处理回调` | L37339-L37344 | .addFailedEvent() | onError()、t() | — | — |
| `onRetrying — 重连中回调` | L37347-L37352 | .warn()、.concat()、.reGetSignalChannelUrl() | onRetrying()、t() | — | — |
## MPC 与 WebRTC Stats（L37360-L41020）
详见：`02-RTCPeerConnection-usage-analysis.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `构造函数` | L37367-L37404 | .default()、.getLogger()、.createChild() | constructor()、defineMember() | — | — |
| `beforeConnect — 连接前处理` | L37407-L37410 | — | beforeConnect()、performanceNow() | — | — |
| `afterConnect — 连接后处理` | L37413-L37432 | .addSuccessEvent()、.min()、.addFailedEvent() | afterConnect()、performanceNow() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L37435-L37449 | .getIceServers()、.getIceTransportPolicy()、.bind() | new RTCPeerConnection()、initialize()、RTCPeerConnection() | 事件属性(onconnectionstatechange) | RTCPeerConnection |
| `close — 关闭本地流并释放所有轨道` | L37452-L37459 | .info()、.emit()、.stopReconnection()、.closePeerConnection()、.delete() | close() | emit('closed') | — |
| `closePeerConnection — 关闭并清理 RTCPeerConnection 连接` | L37462-L37476 | .info()、.close()、.emitConnectionStateChangedEvent()、._waitForPeerConnectionConnectedPromiseReject() | new RtcErrorAlias()、closePeerConnection()、RtcErrorAlias() | 事件属性(onconnectionstatechange) | — |
| `getDTLSTransportState — 获取 DTLS 传输状态` | L37479-L37496 | .getSenders()、.getReceivers() | getDTLSTransportState()、hasGetSenders()、hasGetReceivers() | — | — |
| `onConnectionStateChange — 连接状态变化回调` | L37499-L37527 | .getDTLSTransportState()、.info()、.concat()、.emitConnectionStateChangedEvent()、.startReconnection()、.emit()、.logSelectedCandidate()、.logSuccessEvent() | new RtcErrorAlias()、onConnectionStateChange()、RtcErrorAlias() | emit('error') | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L37530-L37545 | .add()、.delete()、.emit() | emitConnectionStateChangedEvent() | emit(Events.PEER_CONNECTION_STATE_CHANGED)、emit('connection-state-changed') | — |
| `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | L37548-L37551 | — | getPeerConnection() | — | — |
| `getRoom — 获取房间实例` | L37554-L37557 | — | getRoom() | — | — |
| `getUserId — 获取用户 ID` | L37560-L37563 | — | getUserId() | — | — |
| `getTinyId — 获取 Tiny ID（内部用户标识）` | L37566-L37569 | — | getTinyId() | — | — |
| `logSelectedCandidate — 记录选中的 ICE 候选` | L37572-L37608 | .getStats()、.get()、.info()、.concat() | logSelectedCandidate()、asyncGeneratorWrap()、isCandidateSelected() | — | — |
| `getCurrentState — 获取当前状态` | L37611-L37614 | — | getCurrentState() | — | — |
| `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | L37617-L37674 | .off()、.warn()、.emit()、.on()、.finally() | new Promise()、new RtcErrorAlias()、waitForPeerConnectionConnected()、Promise()、e()、clearTimeout()、n()、t()、RtcErrorAlias()、logConfig()、setTimeout() | on(Events.LEAVE_SUCCESS)、on('connection-state-changed')、emit('firewall-restriction') | Timers/scheduling |
| `i — 源码命名函数` | L37625-L37628 | — | clearTimeout()、n()、e() | — | Timers/scheduling |
| `r — 源码命名函数` | L37629-L37642 | — | new RtcErrorAlias()、clearTimeout()、n()、t()、RtcErrorAlias()、logConfig() | — | Timers/scheduling |
| `n — 内部函数` | L37645-L37648 | .off() | — | — | — |
| `getReconnectionCount — 获取重连次数` | L37677-L37680 | — | getReconnectionCount() | — | — |
| `startReconnection — 开始重连流程` | L37683-L37686 | .reconnect() | startReconnection() | — | — |
| `clearReconnectionTimer — 清除重连定时器` | L37689-L37692 | — | clearReconnectionTimer()、clearTimeout() | — | Timers/scheduling |
| `stopReconnection — 停止重连` | L37695-L37702 | .info()、.clearReconnectionTimer()、.off() | stopReconnection() | — | — |
| `beforeReconnect — 重连前处理` | L37705-L37735 | .warn()、.concat()、.stopReconnection()、.emitConnectionStateChangedEvent()、.emit()、.once() | new RtcErrorAlias()、beforeReconnect()、getRetryCount()、RtcErrorAlias()、logConfig() | once(MSG_TYPE_3)、emit('error') | — |
| `on — 注册事件监听器` | L37738-L37741 | .on() | on() | on(e) | — |
| `off — 移除指定事件监听器` | L37744-L37747 | .off() | off() | — | — |
| `getIsReconnecting — 获取重连状态` | L37750-L37753 | — | getIsReconnecting() | — | — |
| `setOffer — 设置 SDP Offer` | L37765-L37771 | .setLocalDescription() | setOffer() | — | — |
| `setAnswer — 设置 SDP Answer` | L37774-L37780 | .setRemoteDescription() | setAnswer() | — | — |
| `jsonParse — 内部函数` | L37787-L37790 | .parse() | — | — | — |
| `jsonStringify — 内部函数` | L37793-L37796 | .write() | — | — | — |
| `getActiveKeys — 内部函数` | L37800-L37803 | .keys()、.filter() | getActiveKeys() | — | — |
| `e 类 — e` | L37806-L38462 | .includes()、.onFlagChanged()、.initialize()、.installEvents()、.bind()、.close()、.emitConnectionStateChangedEvent()、.uninstallEvents()、.removeAllListeners()、.emit()、.debug()、.concat()、.setInputMediaStreamTrack()、.split()、.forEach()、.test()、.set()、.match()、.splice()、.join()、.filter()、.stringify()、.waitForPeerConnectionConnected()、.isSubscriptionStateNotChanged()、.connect()、.info()、.values()、.find()、.sendSubscription()、.isStreamUnpublished()、.warn()、.closePeerConnection()、.sendWaitForResponse()、.then()、.error()、.exchangeSDP()、.createOffer()、.onSubscribeResult()、.addTransceiver()、.add()；+12 | new WH()、new jH()、new JH()、new Map()、new RtcErrorAlias()、new Set()、constructor()、super()、assignDescriptors()、objectMixin()、defineMember()、WH()、jH()、JH()、videoCodec()、subscribeState()、muteState()、getMuteStateFromFlag()、flag()、hasMainStream()、hasAuxStream()、isMainStreamSubscribed()、isAuxStreamSubscribed()、isSmallStreamSubscribed()、isBigStreamSubscribed()、isStreamUnpublished()、initialize()、close()、installEvents()、uninstallEvents()、emitConnectionStateChangedEvent()、onTrack()、addRRTRLine()、Map()、addSPSDescription()、jsonParse()、jsonStringify()、removeSDESDescription()、isSubscriptionStateNotChanged()、subscribe()；+27 | emit('connection-state-changed')、事件属性(ontrack) | WebSocket、Timers/scheduling |
| `构造函数` | L37809-L37826 | — | new WH()、new jH()、new JH()、constructor()、super()、assignDescriptors()、objectMixin()、defineMember()、WH()、jH()、JH() | — | — |
| `isStreamUnpublished — 检查流是否已取消发布` | L37899-L37902 | — | isStreamUnpublished() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L37905-L37908 | .initialize()、.installEvents()、.bind() | initialize() | 事件属性(ontrack) | — |
| `close — 关闭本地流并释放所有轨道` | L37911-L37919 | .close()、.emitConnectionStateChangedEvent()、.uninstallEvents() | close() | — | — |
| `installEvents — 安装事件监听器` | L37922-L37922 | — | installEvents() | — | — |
| `uninstallEvents — 卸载事件监听器集合` | L37925-L37928 | .removeAllListeners() | uninstallEvents() | — | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L37931-L37945 | .emitConnectionStateChangedEvent()、.emit() | emitConnectionStateChangedEvent() | emit('connection-state-changed') | — |
| `onTrack — 轨道事件回调` | L37948-L37962 | .debug()、.concat()、.setInputMediaStreamTrack() | onTrack() | — | — |
| `addRRTRLine — 添加 RRTR 行` | L37965-L37987 | .split()、.forEach()、.test()、.set()、.concat()、.match()、.splice()、.join() | new Map()、addRRTRLine()、Map() | — | — |
| `addSPSDescription — 添加 SPS 描述信息` | L37990-L38006 | .forEach() | addSPSDescription()、jsonParse()、jsonStringify() | — | — |
| `removeSDESDescription — 移除 SDES 描述信息` | L38009-L38026 | .forEach()、.filter()、.includes() | removeSDESDescription()、jsonParse()、jsonStringify() | — | — |
| `isSubscriptionStateNotChanged — 检查订阅状态是否未变化` | L38029-L38032 | .stringify() | isSubscriptionStateNotChanged() | — | — |
| `subscribe — 订阅远端用户的音视频流` | L38035-L38072 | .waitForPeerConnectionConnected()、.isSubscriptionStateNotChanged()、.initialize()、.connect()、.info()、.concat()、.stringify()、.values()、.find()、.sendSubscription()、.isStreamUnpublished()、.warn() | new RtcErrorAlias()、subscribe()、asyncGeneratorWrap()、RtcErrorAlias() | — | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L38075-L38122 | .info()、.concat()、.forEach()、.values()、.find()、.sendSubscription()、.closePeerConnection()、.emitConnectionStateChangedEvent() | unsubscribe()、asyncGeneratorWrap()、objectMixin()、getActiveKeys() | — | — |
| `sendSubscription — 发送订阅请求` | L38125-L38159 | .sendWaitForResponse()、.then()、.error() | new RtcErrorAlias()、sendSubscription()、RtcErrorAlias()、logConfig() | — | — |
| `connect — 建立 WebSocket 信令连接` | L38162-L38182 | .exchangeSDP()、.waitForPeerConnectionConnected()、.closePeerConnection() | connect()、asyncGeneratorWrap() | — | — |
| `exchangeSDP — 交换 SDP 描述信息` | L38185-L38224 | .createOffer()、.info()、.sendWaitForResponse()、.warn()、.onSubscribeResult() | new RtcErrorAlias()、exchangeSDP()、asyncGeneratorWrap()、RtcErrorAlias()、logConfig() | — | — |
| `createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L38227-L38320 | .addTransceiver()、.createOffer()、.warn()、.forEach()、.add()、.match()、.has()、.filter()、.split()、.join()、.addRRTRLine()、.addSPSDescription()、.removeSDESDescription()、.setOffer() | new Set()、createOffer()、asyncGeneratorWrap()、hasAddTransceiver()、detectDecodeByPeerConnection()、jsonParse()、Set()、Number()、jsonStringify() | — | — |
| `n — 源码命名函数` | L38274-L38280 | .has() | — | — | — |
| `onSubscribeResult — 订阅结果回调` | L38323-L38343 | .debug()、.concat()、.setAnswer()、.updateSSRC()、.error() | new RtcErrorAlias()、onSubscribeResult()、asyncGeneratorWrap()、RtcErrorAlias()、logConfig() | — | — |
| `updateSSRC — 更新 SSRC（同步源标识符）` | L38346-L38387 | .forEach()、.find()、.includes() | updateSSRC()、jsonParse()、Number() | — | — |
| `getMainStreamVideoTrackId — 获取主流视频轨道 ID` | L38390-L38393 | — | getMainStreamVideoTrackId() | — | — |
| `getAuxStreamVideoTrackId — 获取辅流视频轨道 ID` | L38396-L38401 | — | getAuxStreamVideoTrackId() | — | — |
| `reconnect — 重新建立信令连接` | L38404-L38428 | .call()、.closePeerConnection()、.initialize()、.connect()、.stopReconnection()、.warn()、.concat()、.clearReconnectionTimer()、.reconnect() | reconnect()、asyncGeneratorWrap()、getModuleExport()、getReconnectionTimeout()、setTimeout() | — | Timers/scheduling |
| `getIsReconnecting — 获取重连状态` | L38431-L38434 | — | getIsReconnecting() | — | — |
| `clearReconnectionTimer — 清除重连定时器` | L38437-L38440 | — | clearReconnectionTimer()、clearTimeout() | — | Timers/scheduling |
| `getCurrentState — 获取当前状态` | L38443-L38446 | — | getCurrentState() | — | — |
| `setDelay — 设置延迟时间` | L38449-L38454 | — | setDelay() | — | — |
| `n — 源码命名函数` | L38474-L38478 | .off() | new RtcErrorAlias()、r()、RtcErrorAlias()、logConfig() | — | — |
| `e 类 — e` | L38502-L39661 | .toLowerCase()、.initialize()、.installEvents()、.stopReconnection()、.closePeerConnection()、.uninstallEvents()、.close()、.reset()、.emitConnectionStateChangedEvent()、.listeners()、.includes()、.on()、.off()、.emit()、.sendMediaSettings()、.publishByTransceiver()、.publishByAddTrack()、.installTrackMuteEvents()、.sendMutedFlag()、.info()、.addTrack()、.getTransceivers()、.addTransceiver()、.connect()、.push()、.replaceTrack()、.setBandwidth()、.setTransceiverDirection()、.doPublishChange()、.updateMediaSettings()、.forEach()、.removeTrack()、.doUnpublish()、.uninstallTrackMuteEvents()、.getSenders()、.sendWaitForResponse()、.checkPublishResultCode()、.catch()、.getCode()、.resolve()；+41 | new MediaStream()、new Array()、new RegExp()、new RtcErrorAlias()、constructor()、super()、assignDescriptors()、objectMixin()、defineMember()、videoCodec()、isMainStreamPublished()、isAuxStreamPublished()、initialize()、reset()、close()、installEvents()、uninstallEvents()、emitConnectionStateChangedEvent()、publish()、asyncGeneratorWrap()、hasAddTransceiver()、publishByTransceiver()、MediaStream()、publishByAddTrack()、enableSmall()、installTrackMuteEvents()、Array()、uninstallTrackMuteEvents()、unpublish()、hasGetTransceivers()、doPublishChange()、doUnpublish()、updateMediaSettings()、sendMediaSettings()、addTrack()、addTrackByTransceiver()、addTrackBySender()、isNeedToResetOfferOrder()、jsonParse()、Number()；+38 | on('connection-state-changed')、on('mute')、on('unmute')、emit('connection-state-changed')、emit(Events.SEND_FIRST_VIDEO_FRAME) | RTCRtpSender/Receiver/Transceiver、WebSocket、MediaStream、Track constraints/settings/capabilities、Track lifecycle、Timers/scheduling |
| `构造函数` | L38505-L38536 | — | constructor()、super()、assignDescriptors()、objectMixin()、defineMember() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L38551-L38554 | .initialize()、.installEvents() | initialize() | — | — |
| `reset — 重置房间状态（清理所有内部数据）` | L38557-L38560 | .stopReconnection()、.closePeerConnection()、.uninstallEvents() | reset() | — | — |
| `close — 关闭本地流并释放所有轨道` | L38563-L38566 | .close()、.reset()、.emitConnectionStateChangedEvent() | close() | — | — |
| `installEvents — 安装事件监听器` | L38569-L38573 | .listeners()、.includes()、.on() | installEvents() | on('connection-state-changed') | — |
| `uninstallEvents — 卸载事件监听器集合` | L38576-L38579 | .off() | uninstallEvents() | — | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L38582-L38601 | .emitConnectionStateChangedEvent()、.emit() | emitConnectionStateChangedEvent() | emit('connection-state-changed') | — |
| `publish — 发布本地音视频流到房间` | L38604-L38640 | .initialize()、.sendMediaSettings()、.publishByTransceiver()、.publishByAddTrack()、.installTrackMuteEvents()、.sendMutedFlag() | publish()、asyncGeneratorWrap()、hasAddTransceiver() | — | — |
| `publishByTransceiver — 通过 addTransceiver API 推流` | L38643-L38703 | .info()、.addTrack()、.getTransceivers()、.addTransceiver()、.connect()、.push()、.replaceTrack()、.setBandwidth()、.setTransceiverDirection()、.doPublishChange()、.emit() | new MediaStream()、publishByTransceiver()、asyncGeneratorWrap()、MediaStream() | emit('connection-state-changed') | MediaStream |
| `publishByAddTrack — 通过 addTrack API 推流` | L38706-L38738 | .info()、.addTrack()、.connect() | new MediaStream()、publishByAddTrack()、asyncGeneratorWrap()、MediaStream() | — | MediaStream |
| `enableSmall — 启用/禁用小流（Simulcast 分层编码）` | L38741-L38755 | .getTransceivers()、.replaceTrack()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange() | enableSmall()、asyncGeneratorWrap() | — | — |
| `installTrackMuteEvents — 安装轨道静音状态事件监听器` | L38758-L38767 | .forEach()、.on() | new Array()、installTrackMuteEvents()、Array() | on('mute')、on('unmute') | — |
| `uninstallTrackMuteEvents — 卸载轨道静音状态事件监听器` | L38770-L38779 | .forEach()、.off() | new Array()、uninstallTrackMuteEvents()、Array() | — | — |
| `unpublish — 取消发布本地音视频流` | L38782-L38843 | .removeTrack()、.doUnpublish()、.uninstallTrackMuteEvents()、.emitConnectionStateChangedEvent()、.getSenders()、.replaceTrack()、.push()、.setTransceiverDirection()、.doPublishChange()、.emit() | unpublish()、asyncGeneratorWrap()、hasGetTransceivers()、assignDescriptors()、objectMixin() | emit('connection-state-changed') | — |
| `doPublishChange — 执行推流变更（更新 SDP）` | L38846-L38863 | .sendWaitForResponse()、.checkPublishResultCode() | doPublishChange()、asyncGeneratorWrap() | — | — |
| `doUnpublish — 执行取消发布（通知服务器并清理上行资源）` | L38866-L38883 | .sendWaitForResponse()、.catch()、.getCode()、.resolve() | doUnpublish() | — | — |
| `updateMediaSettings — 更新媒体设置` | L38886-L38947 | .getSettings()、.info()、.concat()、.stringify() | updateMediaSettings() | — | Track constraints/settings/capabilities |
| `sendMediaSettings — 发送媒体设置` | L38950-L38964 | .updateMediaSettings()、.sendWaitForResponse()、.then()、.warn()、.catch() | sendMediaSettings() | — | — |
| `addTrack — 添加媒体轨道到发布流` | L38967-L38981 | .info()、.concat()、.addTrackByTransceiver()、.addTrackBySender() | addTrack()、asyncGeneratorWrap()、hasAddTransceiver() | — | — |
| `addTrackByTransceiver — 通过 RTCRtpTransceiver 添加轨道` | L38984-L39007 | .getTransceivers()、.replaceTrack()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange() | addTrackByTransceiver()、asyncGeneratorWrap() | — | — |
| `addTrackBySender — 通过 RTCRtpSender 添加轨道` | L39010-L39041 | .getTransceivers()、.findIndex()、.warn()、.updateOffer()、.getSenders()、.find()、.removeSender()、.addTrack() | new MediaStream()、addTrackBySender()、asyncGeneratorWrap()、hasGetTransceivers()、MediaStream() | — | MediaStream |
| `isNeedToResetOfferOrder — 检查是否需要重置 Offer 顺序` | L39044-L39054 | — | isNeedToResetOfferOrder()、jsonParse()、Number() | — | — |
| `removeSender — 移除发送器` | L39057-L39064 | .getTransceivers()、.find()、.removeTrack()、.info()、.stop() | removeSender()、hasGetTransceivers()、isFunction() | — | Track lifecycle |
| `removeTrack — 从发布流移除媒体轨道` | L39067-L39081 | .info()、.concat()、.removeTrackByTransceiver()、.removeTrackBySender() | removeTrack()、asyncGeneratorWrap()、hasAddTransceiver() | — | — |
| `removeTrackByTransceiver — 通过 RTCRtpTransceiver 移除轨道` | L39084-L39102 | .getTransceivers()、.replaceTrack()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange() | removeTrackByTransceiver()、asyncGeneratorWrap() | — | — |
| `setTransceiverDirection — 设置收发器方向（sendrecv/sendonly/recvonly/inactive）` | L39105-L39153 | .info()、.concat()、.join()、.getTransceivers()、.forEach()、.createOffer()、.setOffer()、.split()、.map()、.match()、.includes()、.setAnswer() | new RegExp()、setTransceiverDirection()、asyncGeneratorWrap()、RegExp() | — | — |
| `removeTrackBySender — 通过 RTCRtpSender 移除轨道` | L39156-L39179 | .isNeedToResetOfferOrder()、.reset()、.initialize()、.publish()、.getSenders()、.find()、.removeSender()、.forEach()、.updateOffer() | removeTrackBySender()、asyncGeneratorWrap() | — | — |
| `replaceTrack — 替换本地流中的指定轨道` | L39182-L39205 | .getSenders()、.find()、.info()、.concat()、.replaceTrack() | replaceTrack()、asyncGeneratorWrap()、hasAddTransceiver() | — | — |
| `updateOffer — 更新 SDP Offer` | L39208-L39248 | .createOffer()、.setSDPDirection()、.setOffer()、.updateMediaSettings()、.info()、.debug()、.concat()、.sendWaitForResponse()、.checkPublishResultCode()、.acceptAnswer()、.updateSSRC()、.error() | updateOffer()、asyncGeneratorWrap() | — | — |
| `setBandwidth — 设置带宽` | L39251-L39307 | .updateVideoBandwidthRestriction()、.updateAudioBandwidthRestriction()、.getSenders()、.find()、.getParameters()、.setParameters()、.info()、.concat() | setBandwidth()、asyncGeneratorWrap()、hasSetParameters()、hasAddTransceiver() | — | — |
| `updateVideoBandwidthRestriction — 更新视频带宽限制` | L39310-L39328 | .replace()、.concat() | updateVideoBandwidthRestriction()、video()、buildSSOPackage() | — | — |
| `updateAudioBandwidthRestriction — 更新音频带宽限制` | L39331-L39343 | .replace()、.concat() | updateAudioBandwidthRestriction()、audio()、buildSSOPackage() | — | — |
| `removeBandwidthRestriction — 移除带宽限制` | L39346-L39349 | .replace() | removeBandwidthRestriction() | — | — |
| `removeVideoOrientation — 移除视频旋转信息` | L39352-L39355 | .replace() | removeVideoOrientation() | — | — |
| `connect — 建立 WebSocket 信令连接` | L39358-L39371 | .exchangeSDP()、.waitForPeerConnectionConnected()、.closePeerConnection()、.uninstallEvents() | connect()、asyncGeneratorWrap() | — | — |
| `exchangeSDP — 交换 SDP 描述信息` | L39374-L39389 | .createOffer()、.info()、.doExchangeSDP() | exchangeSDP()、asyncGeneratorWrap() | — | — |
| `createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | L39392-L39407 | .createOffer()、.setOffer()、.updateSSRC() | createOffer()、asyncGeneratorWrap() | — | — |
| `doExchangeSDP — 执行 SDP 交换（Offer/Answer）` | L39410-L39436 | .removeVideoOrientation()、.debug()、.concat()、.sendWaitForResponse()、.then()、.acceptAnswer()、.checkPublishResultCode() | doExchangeSDP() | — | — |
| `setSDPDirection — 设置 SDP 方向属性` | L39439-L39452 | .forEach() | setSDPDirection()、jsonParse()、jsonStringify() | — | — |
| `acceptAnswer — 接受 SDP Answer` | L39455-L39502 | .setBandwidth()、.removeVideoOrientation()、.setAnswer()、.debug()、.concat()、.error() | acceptAnswer()、asyncGeneratorWrap() | — | — |
| `sendMutedFlag — 发送静音标志` | L39505-L39511 | .info()、.concat()、.stringify()、.send() | sendMutedFlag() | — | — |
| `getIsReconnecting — 获取重连状态` | L39514-L39517 | — | getIsReconnecting() | — | — |
| `reconnect — 重新建立信令连接` | L39520-L39560 | .call()、.sendWaitForResponse()、.closePeerConnection()、.initialize()、.publish()、.warn()、.stopReconnection()、.concat()、.clearReconnectionTimer()、.reconnect() | reconnect()、asyncGeneratorWrap()、getModuleExport()、getReconnectionTimeout()、setTimeout() | — | Timers/scheduling |
| `handleConnectionStateChange — 处理连接状态变化` | L39563-L39568 | .emit() | handleConnectionStateChange() | emit(Events.SEND_FIRST_VIDEO_FRAME) | — |
| `updateSSRC — 更新 SSRC（同步源标识符）` | L39571-L39610 | .forEach()、.split() | updateSSRC()、jsonParse()、Number() | — | — |
| `getVideoTrackId — 获取视频轨道 ID` | L39613-L39638 | .getSenders() | getVideoTrackId() | — | — |
| `getSSRC — 获取 SSRC（同步源标识）` | L39641-L39644 | — | getSSRC() | — | — |
| `checkPublishResultCode — 检查发布结果码` | L39647-L39660 | .error() | new RtcErrorAlias()、checkPublishResultCode()、RtcErrorAlias()、logConfig() | — | — |
| `n — 源码命名函数` | L39673-L39677 | .off() | new RtcErrorAlias()、r()、RtcErrorAlias()、logConfig() | — | — |
| `构造函数` | L39701-L39718 | — | new Map()、constructor()、defineMember()、Map() | — | — |
| `getSenderStats — 获取发送端统计` | L39725-L39947 | .getPeerConnection()、.getSSRC()、.getStats()、.forEach()、.emit()、.info()、.concat()、.floor()、.getVideoTrackId()、.getInternalAudioLevel()、.getInternalAudioLevelAfter3A()、.keys()、.warn() | getSenderStats()、asyncGeneratorWrap()、isUndefined()、isCandidateSelected()、isNumber() | emit('262')、emit('263') | — |
| `getReceiverStats — 获取接收端统计` | L39950-L40161 | .getPeerConnection()、.getStats()、.forEach()、.set()、.get()、.split()、.has()、.info()、.concat()、.emit()、.toLowerCase()、.floor()、.getMainStreamVideoTrackId()、.getAuxStreamVideoTrackId()、.getInternalAudioLevel()、.warn() | getReceiverStats()、asyncGeneratorWrap()、isCandidateSelected()、isNumber()、isUndefined() | emit('262') | — |
| `getStats — 获取 WebRTC 连接统计` | L40164-L40208 | .getPeerConnection()、.getStats()、.warn()、.concat()、.forEach()、.has()、.push()、.getSenderStats()、.getReceiverStats()、.getMediaPlayoutStats() | new Set()、getStats()、asyncGeneratorWrap()、performanceNow()、Set() | — | — |
| `getDifferenceValue — 获取差值` | L40211-L40218 | — | getDifferenceValue()、mU() | — | — |
| `prepareReport — 准备上报数据` | L40221-L40603 | .push()、.forEach()、.get()、.concat()、.parse()、.stringify()、.getDifferenceValue()、.round()、.floor()、.updateAfter3aSilenceStartTime()、.find()、.filter() | prepareReport()、mU()、isUndefined() | — | — |
| `getStatsReport — 获取统计报告` | L40606-L40676 | .getStats()、.stringify()、.parse()、.prepareReport()、.now() | getStatsReport()、asyncGeneratorWrap() | — | — |
| `getMediaPlayoutStats — 获取媒体播放统计` | L40679-L40696 | — | getMediaPlayoutStats()、isArray() | — | — |
| `reset — 重置房间状态（清理所有内部数据）` | L40699-L40711 | — | new Map()、reset()、Map() | — | — |
| `loadScriptAsync — 内部函数` | L40717-L40790 | .now()、.concat()、.getEntriesByType()、.reverse()、.round()、.max() | new Promise()、loadScriptAsync()、Promise()、asyncGeneratorWrap()、setTimeout()、t()、fetch()、clearTimeout()、assignDescriptors()、objectMixin() | — | fetch、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L40722-L40788 | .now()、.concat()、.getEntriesByType()、.reverse()、.round()、.max() | asyncGeneratorWrap()、setTimeout()、t()、fetch()、clearTimeout()、assignDescriptors()、objectMixin() | — | fetch、Timers/scheduling |
| `e 类 — e` | L40793-L41165 | .createLogger()、.getLogger()、.initialize()、.info()、.concat()、.getAverageLossAndRTT()、.values()、.on()、.handleUplinkNetworkQuality()、.bind()、.start()、.updateDelay()、.getPeerConnection()、.isPeerConnectionDisconnected()、.round()、.getNetworkQuality()、.filter()、.getStat()、.has()、.set()、.get()、.getUserId()、.keys()、.forEach()、.delete()、.getReceivers()、.getStats()、.isArray()、.debug()、.run()、.handleDownlinkNetworkQuality()、.emit()、.now()、.map()、.then()、.all()、.some()、.addSuccessEvent()、.warn()、.stringify()；+4 | new Map()、constructor()、super()、defineMember()、Map()、uplinkNetworkQuality()、downlinkNetworkQuality()、initialize()、handleUplinkNetworkQuality()、handleDownlinkNetworkQuality()、asyncGeneratorWrap()、getStat()、hasGetReceivers()、isNumber()、getAverageLossAndRTT()、getNetworkQuality()、handleSignalConnectionStateChange()、handleUplinkConnectionStateChange()、isPeerConnectionDisconnected()、setUplinkConnection()、start()、assignDescriptors()、objectMixin()、loadScriptAsync()、stop()、updateDelay() | on(_j.UPLINK_NETWORK_STATS)、on(MSG_TYPE_2)、on('connection-state-changed')、emit(Events.NETWORK_QUALITY)、emit(e.EVENT_NETWORK_QUALITY) | — |
| `构造函数` | L40796-L40823 | .createLogger()、.getLogger()、.initialize() | new Map()、constructor()、super()、defineMember()、Map() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L40864-L40872 | .on()、.handleUplinkNetworkQuality()、.bind()、.start() | initialize() | on(_j.UPLINK_NETWORK_STATS)、on(MSG_TYPE_2) | — |
| `handleUplinkNetworkQuality — 上行网络质量回调` | L40875-L40900 | .updateDelay()、.getPeerConnection()、.isPeerConnectionDisconnected()、.round()、.getNetworkQuality() | handleUplinkNetworkQuality() | — | — |
| `handleDownlinkNetworkQuality — 处理下行网络质量事件` | L40903-L40959 | .values()、.filter()、.getPeerConnection()、.isPeerConnectionDisconnected()、.getStat()、.has()、.set()、.get()、.round()、.getUserId()、.keys()、.forEach()、.delete()、.getAverageLossAndRTT()、.getNetworkQuality() | handleDownlinkNetworkQuality()、asyncGeneratorWrap() | — | — |
| `getStat — 获取统计数据` | L40962-L40991 | .getReceivers()、.getStats()、.forEach()、.round() | getStat()、asyncGeneratorWrap()、hasGetReceivers()、isNumber() | — | — |
| `getAverageLossAndRTT — 获取平均丢包率和 RTT` | L40994-L41012 | .isArray()、.forEach()、.keys()、.round() | getAverageLossAndRTT() | — | — |
| `getNetworkQuality — 获取当前网络质量等级（uplink/downlink）` | L41015-L41028 | — | getNetworkQuality() | — | — |
## 质量、上报与能力（L41021-L45859）
详见：`10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `handleSignalConnectionStateChange — 信令连接状态变化回调` | L41031-L41036 | — | handleSignalConnectionStateChange() | — | — |
| `handleUplinkConnectionStateChange — 处理上行连接状态变化` | L41039-L41046 | — | handleUplinkConnectionStateChange() | — | — |
| `isPeerConnectionDisconnected — 检查 PeerConnection 是否已断开` | L41049-L41055 | — | isPeerConnectionDisconnected() | — | — |
| `setUplinkConnection — 设置上行连接` | L41058-L41067 | .on()、.bind() | setUplinkConnection() | on('connection-state-changed') | — |
| `start — 启动组件/模块（开始工作流程）` | L41070-L41136 | .debug()、.run()、.handleDownlinkNetworkQuality()、.values()、.emit()、.now()、.map()、.then()、.all()、.some()、.forEach()、.addSuccessEvent()、.warn()、.concat()、.stringify()、.catch()、.info() | start()、assignDescriptors()、objectMixin()、loadScriptAsync() | emit(Events.NETWORK_QUALITY)、emit(e.EVENT_NETWORK_QUALITY) | — |
| `stop — 停止本地流播放` | L41139-L41145 | .debug()、.clearTask()、.clear() | stop() | — | — |
| `updateDelay — 更新延迟参数` | L41148-L41164 | .forEach()、.get()、.setDelay() | updateDelay() | — | — |
| `构造函数` | L41172-L41246 | .createLogger()、.getLogger()、.getOwnPropertyNames()、.forEach()、.startsWith()、.apply()、.catch()、.error()、.concat()、.initData()、.installEvents() | new Map()、new Array()、constructor()、defineMember()、Map()、isFunction()、Array()、isPromise() | — | — |
| `initData — 初始化数据` | L41249-L41323 | .then() | new Map()、initData()、Map()、fetchUserAgentData()、getOSString()、getDeviceModel() | — | Navigator/UA |
| `addEvent — 添加事件` | L41326-L41329 | .set()、.on() | addEvent() | on(e) | — |
| `installEvents — 安装事件监听器` | L41332-L41393 | .bind()、.addEventListener()、.once()、.handleLeaveSuccess()、.addEvent()、.hitTest()、.handleAudioPlaying()、.handleVideoPlaying()、.handleRemoteStreamAdded() | installEvents() | addEventListener('pagehide')、once('banned') | — |
| `uninstallEvents — 卸载事件监听器集合` | L41396-L41401 | .removeEventListener()、.forEach()、.off()、.clear() | uninstallEvents() | removeEventListener('pagehide') | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L41404-L41410 | .uninstallEvents()、.clearTask() | destroy() | — | — |
| `handleUnload — 处理页面卸载事件` | L41413-L41416 | .handleLeaveSuccess() | handleUnload() | — | — |
| `handleJoinStart — 加入房间开始回调` | L41419-L41430 | .hitTest()、.now() | handleJoinStart()、isUndefined() | — | — |
| `handleJoinScheduleSuccess — 加入房间调度成功回调` | L41433-L41449 | .hitTest() | handleJoinScheduleSuccess() | — | — |
| `handleSignalConnectionStart — 信令连接开始回调` | L41452-L41459 | .hitTest()、.now() | handleSignalConnectionStart() | — | — |
| `handleSignalConnectionEnd — 信令连接结束回调` | L41462-L41473 | .hitTest()、.now()、.getExtraCode()、.getCode() | handleSignalConnectionEnd()、Number() | — | — |
| `handleJoinSendCMD — 加入房间发送指令回调` | L41476-L41481 | .hitTest()、.now() | handleJoinSendCMD() | — | — |
| `handleJoinReceivedCMDResponce — 收到加入房间指令响应回调` | L41484-L41491 | .hitTest()、.now() | handleJoinReceivedCMDResponce() | — | — |
| `handleJoinSuccess — 加入房间成功回调` | L41494-L41501 | .hitTest()、.now()、.getSignalInfo() | handleJoinSuccess() | — | — |
| `handleJoinFailed — 处理加入房间失败` | L41504-L41519 | .hitTest()、.now()、.report() | handleJoinFailed()、setTimeout() | — | Timers/scheduling |
| `handleReceivedPublishUserList — 收到已发布用户列表回调` | L41522-L41528 | .hitTest()、.now() | handleReceivedPublishUserList() | — | — |
| `handleSendFirstVideoFrame — 处理首帧视频发送` | L41531-L41539 | .hitTest()、.now() | handleSendFirstVideoFrame() | — | — |
| `handleLeaveStart — 离开房间开始回调` | L41542-L41545 | .hitTest()、.now() | handleLeaveStart() | — | — |
| `handleLeaveSuccess — 离开房间成功回调` | L41548-L41565 | .hitTest()、.now()、.warn()、.report() | handleLeaveSuccess()、performanceNow() | — | — |
| `handleLeaveSendCMD — 处理离开房间指令发送` | L41568-L41573 | .hitTest()、.now() | handleLeaveSendCMD() | — | — |
| `handleSwitchRoomStart — 切换房间开始回调` | L41576-L41588 | .hitTest()、.now()、.report()、.then() | handleSwitchRoomStart() | — | — |
| `handleSwitchRoomSuccess — 切换房间成功回调` | L41591-L41603 | .hitTest()、.now() | handleSwitchRoomSuccess() | — | — |
| `handleSwitchRoomFailed — 切换房间失败回调` | L41606-L41619 | .hitTest()、.now()、.getExtraCode()、.getCode() | handleSwitchRoomFailed()、Number() | — | — |
| `handleRemoteStreamAdded — 处理远端流添加事件` | L41622-L41655 | .concat()、.has()、.now()、.get()、.set() | new vJ()、handleRemoteStreamAdded()、assignDescriptors()、objectMixin()、vJ() | — | — |
| `handleSubscribeStart — 订阅开始回调` | L41658-L41700 | .hitTest()、.now()、.concat()、.get()、.has()、.set() | new vJ()、handleSubscribeStart()、vJ() | — | — |
| `handleSubscribed — 订阅成功回调` | L41703-L41714 | .hitTest()、.concat()、.get()、.now() | handleSubscribed() | — | — |
| `handlePlayStart — 开始播放回调` | L41717-L41726 | .hitTest()、.concat()、.get()、.now() | handlePlayStart() | — | — |
| `handleVideoLoadedData — 视频数据加载完成回调` | L41729-L41740 | .hitTest()、.concat()、.get()、.now() | handleVideoLoadedData() | — | — |
| `handleVideoPlaying — 视频正在播放回调` | L41743-L41767 | .concat()、.now()、.get()、.hasAuxFlag()、.hasVideoFlag()、.addNumber() | handleVideoPlaying() | — | — |
| `handleAudioPlaying — 音频播放中回调` | L41770-L41778 | .concat()、.get()、.now() | handleAudioPlaying() | — | — |
| `handleNetworkQuality — 处理网络质量事件` | L41781-L41819 | .hitTest()、.forEach()、.get()、.set() | handleNetworkQuality() | — | — |
| `handleHeartbeatStats — 处理心跳统计信息` | L41822-L41917 | .hitTest()、.floor()、.forEach()、.get()、.concat()、.has() | handleHeartbeatStats()、mathPow()、isEmpty() | — | — |
| `handlePublishStart — 发布开始回调` | L41920-L41927 | .hitTest()、.now() | handlePublishStart() | — | — |
| `handleTrackCaptureStart — 轨道采集开始处理` | L41930-L41940 | .now() | handleTrackCaptureStart() | — | — |
| `handleTrackCaptureSuccess — 轨道采集成功处理` | L41943-L41954 | .now() | handleTrackCaptureSuccess() | — | — |
| `handleTrackCaptureFailed — 轨道采集失败处理` | L41957-L41979 | .getExtraCode()、.getCode()、.now() | handleTrackCaptureFailed() | — | — |
| `hasVideoFlag — 检查视频标志位` | L41982-L41985 | .findIndex() | hasVideoFlag() | — | — |
| `hasAudioFlag — 检查音频标志位` | L41988-L41991 | .findIndex() | hasAudioFlag() | — | — |
| `hasAuxFlag — 检查辅流标志位` | L41994-L41997 | .findIndex() | hasAuxFlag() | — | — |
| `hitTest — 命中检测` | L42000-L42003 | — | hitTest() | — | — |
| `prepareReport — 准备上报数据` | L42006-L42111 | .floor()、.forEach()、.get()、.getDuration()、.min()、.getDataFreezeDuration()、.getRenderFreezeDuration()、.isBlackStream()、.hasAudioFlag()、.delete()、.hasVideoFlag() | prepareReport() | — | — |
| `getReportData — 获取上报数据` | L42114-L42146 | .now()、.floor()、.random()、.values()、.map() | new vJ()、getReportData()、getNumNetworkType()、Number()、vJ()、ipv4ToUint32()、mathPow()、String()、convertObjectNumberToInt() | — | — |
| `report — 上报数据` | L42149-L42169 | .prepareReport()、.getReportData()、.upload()、.initData()、.warn() | report()、asyncGeneratorWrap() | — | — |
| `upload — 上传日志数据到服务器` | L42172-L42188 | .concat()、.sendBeacon()、.uploadKVStat()、.push()、.all() | upload()、asyncGeneratorWrap()、Number()、buildSSOPackage()、sendLogDataToServer()、buildLoggerUrl()、sendHttpRequest() | — | sendBeacon、Encoding/binary |
| `setConnectionType — 设置连接类型` | L42191-L42194 | — | setConnectionType() | — | — |
| `uploadKVStat — 上传 KV 统计` | L42197-L42218 | .getReportData()、.debug()、.concat()、.sendBeacon() | uploadKVStat()、asyncGeneratorWrap()、assignDescriptors()、objectMixin()、buildSSOPackage()、sendLogDataToServer()、buildLoggerUrl()、Number()、sendHttpRequest() | — | sendBeacon、Encoding/binary |
| `构造函数` | L42247-L42255 | — | constructor()、defineMember()、String() | — | — |
| `构造函数` | L42261-L42264 | .start() | constructor()、defineMember() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L42267-L42270 | — | start()、performanceNow() | — | — |
| `stop — 停止本地流播放` | L42273-L42276 | — | stop()、performanceNow() | — | — |
| `getDuration — 获取持续时间` | L42279-L42282 | — | getDuration()、performanceNow() | — | — |
| `构造函数` | L42295-L42303 | .installEvents() | new Map()、constructor()、defineMember()、Map() | — | — |
| `installEvents — 安装事件监听器` | L42306-L42338 | .set()、.hitTest()、.stopDurationItem()、.concat()、.get()、.addDuractionItem()、.forEach()、.on() | installEvents() | on(t) | — |
| `uninstallEvents — 卸载事件监听器集合` | L42341-L42344 | .forEach()、.off()、.clear() | uninstallEvents() | — | — |
| `handleSubscribed — 订阅成功回调` | L42347-L42355 | .hitTest()、.addDuractionItem()、.stopDurationItem()、.concat() | handleSubscribed() | — | — |
| `handleUnsubscribed — 取消订阅回调` | L42358-L42363 | .hitTest()、.stopDurationItem()、.concat() | handleUnsubscribed() | — | — |
| `isRecording — 检查是否正在录制` | L42366-L42369 | .findIndex() | isRecording() | — | — |
| `addDuractionItem — 添加计时项（持续时间统计）` | L42372-L42386 | .concat()、.get()、.isRecording()、.push()、.set() | new SJ()、addDuractionItem()、SJ() | — | — |
| `stopDurationItem — 停止计时项` | L42389-L42397 | .has()、.get()、.find()、.stop() | stopDurationItem() | — | Track lifecycle |
| `hitTest — 命中检测` | L42400-L42403 | — | hitTest() | — | — |
| `getDuration — 获取持续时间` | L42406-L42409 | .has()、.get()、.reduce()、.getDuration() | getDuration() | — | — |
| `getDurationMap — 获取持续时间映射` | L42412-L42415 | — | getDurationMap() | — | — |
| `reset — 重置房间状态（清理所有内部数据）` | L42418-L42421 | .clear() | reset() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L42424-L42427 | .uninstallEvents() | destroy() | — | — |
| `构造函数` | L42432-L42435 | — | new Map()、constructor()、defineMember()、Map() | — | — |
| `get — HTTP GET 请求便捷封装` | L42438-L42445 | .get() | get() | — | — |
| `set — 设置属性值` | L42448-L42451 | .set() | set() | — | — |
| `clear — 清除所有数据` | L42454-L42457 | .clear() | clear() | — | — |
| `构造函数` | L42462-L42476 | .installEvents() | new Map()、new AJ()、constructor()、defineMember()、Map()、AJ() | — | — |
| `getRenderFreezeMap — 获取渲染卡顿映射` | L42479-L42482 | — | getRenderFreezeMap() | — | — |
| `getDataFreezeMap — 获取数据卡顿映射` | L42485-L42488 | — | getDataFreezeMap() | — | — |
| `installEvents — 安装事件监听器` | L42491-L42552 | .set()、.hitTest()、.stop()、.concat()、.stopDataFreeze()、.onVideoTrackMuted()、.onVideoTrackUnmuted()、.forEach()、.on() | installEvents() | on(t) | Track lifecycle |
| `uninstallEvents — 卸载事件监听器集合` | L42555-L42558 | .forEach()、.off()、.clear() | uninstallEvents() | — | — |
| `stop — 停止本地流播放` | L42561-L42564 | .clear() | stop() | — | — |
| `onVideoTrackMuted — 视频轨道被静音回调` | L42567-L42591 | .concat()、.get()、.push()、.set() | new SJ()、onVideoTrackMuted()、SJ()、isFreezing() | — | — |
| `isFreezing — 检查是否卡顿` | L42583-L42589 | — | isFreezing() | — | — |
| `onVideoTrackUnmuted — 视频轨道取消静音回调` | L42594-L42601 | .concat()、.stopDataFreeze() | onVideoTrackUnmuted() | — | — |
| `onHearBeatReport — 心跳上报回调` | L42604-L42656 | .hitTest()、.from()、.find()、.forEach()、.uploadEvent()、.concat() | onHearBeatReport() | — | — |
| `r — 内部函数` | L42616-L42635 | .forEach()、.uploadEvent()、.concat() | — | — | — |
| `r — 内部函数` | L42643-L42652 | .uploadEvent()、.concat() | — | — | — |
| `stopDataFreeze — 停止数据卡顿检测` | L42659-L42677 | .get()、.isFreezing()、.stop()、.getDuration()、.set()、.pop() | stopDataFreeze() | — | Track lifecycle |
| `getTotalDuration — 获取总持续时间` | L42680-L42689 | .reduce()、.getDuration()、.min() | getTotalDuration() | — | — |
| `onPlayTrackStart — 轨道开始播放回调` | L42692-L42700 | .hitTest()、.concat()、.has()、.set() | onPlayTrackStart() | — | — |
| `getDataFreezeDuration — 获取数据卡顿时长` | L42703-L42720 | .get()、.isFreezing()、.stop()、.getDuration()、.pop()、.getTotalDuration() | getDataFreezeDuration() | — | Track lifecycle |
| `getRenderFreezeDuration — 获取渲染卡顿时长` | L42723-L42730 | .get() | getRenderFreezeDuration() | — | — |
| `getMonitorFreeze — 获取监控卡顿` | L42733-L42736 | — | getMonitorFreeze() | — | — |
| `isBlackStream — 检查是否黑屏流（屏幕分享保护）` | L42739-L42742 | .has()、.get() | isBlackStream()、Boolean() | — | — |
| `onRemoteVideoPlayStart — 远端视频开始播放回调` | L42745-L42791 | .addEventListener()、.min()、.concat()、.get()、.set()、.requestVideoFrameCallback() | onRemoteVideoPlayStart()、hasVideoFrameCallback() | addEventListener('visibilitychange') | Media playback、DOM、Page visibility |
| `o — 内部函数` | L42754-L42757 | — | — | — | Page visibility |
| `s — 源码命名函数` | L42760-L42787 | .min()、.concat()、.get()、.set()、.requestVideoFrameCallback() | — | — | Media playback |
| `onRemoteVideoPlayEnd — 远端视频播放结束回调` | L42794-L42801 | .concat()、.get()、.removeEventListener() | onRemoteVideoPlayEnd() | removeEventListener('visibilitychange') | DOM、Page visibility |
| `resetMonitor — 重置监控器` | L42804-L42807 | .clear() | resetMonitor() | — | — |
| `hitTest — 命中检测` | L42810-L42813 | — | hitTest() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L42816-L42819 | .uninstallEvents() | destroy() | — | — |
| `构造函数` | L42825-L42856 | .addEvent()、.setVideo() | constructor()、defineMember()、Boolean() | — | — |
| `addEvent — 添加事件` | L42859-L42867 | .addSuccessEvent()、.addFailedEvent() | addEvent() | — | — |
| `actionCentering — 居中操作` | L42870-L42904 | .now()、.animation()、.getResult()、.recoverOriginal()、.dualStageCropping()、.movingPortrait()、.error() | actionCentering() | — | — |
| `calculateBoundary — 计算边界` | L42907-L42913 | — | calculateBoundary() | — | — |
| `calculateTargetPosition — 计算目标位置` | L42916-L42938 | .calculateBoundary()、.max()、.min()、.now() | calculateTargetPosition() | — | — |
| `processFacePositionCrop — 处理人脸位置裁剪` | L42941-L42963 | .now()、.positionDistance() | processFacePositionCrop()、clearTimeout()、setTimeout() | — | Timers/scheduling |
| `processFacePositionPortrait — 处理人脸人像位置` | L42966-L42982 | .positionDistance()、.now() | processFacePositionPortrait()、objectMixin()、clearTimeout()、setTimeout() | — | Timers/scheduling |
| `animation — 动画处理` | L42985-L43028 | .now()、.min() | animation()、i()、isNumber() | — | — |
| `positionDistance — 位置距离计算` | L43031-L43034 | .sqrt() | positionDistance()、mathPow() | — | — |
| `recoverOriginal — 恢复到原始状态` | L43037-L43043 | .now() | recoverOriginal() | — | — |
| `dualStageCropping — 双阶段裁剪处理` | L43046-L43054 | .calculateTargetPosition()、.processFacePositionCrop()、.recoverOriginal() | dualStageCropping() | — | — |
| `movingPortrait — 人像移动处理` | L43057-L43093 | .now()、.sqrt()、.processFacePositionPortrait() | movingPortrait() | — | — |
| `extends 类 — extends` | L43113-L43464 | .init()、.catch()、.error()、.destroy()、.concat()、.resolvePreditReady()、.AllIn1()、.setWaterMark()、.setBeauty()、.useProgram()、.setAttributes()、.uniform1i()、.getUniformLocation()、.createTexture()、.uniformMatrix4fv()、.createShader()、.createProgram()、.warn()、.initVisionTasks()、.getInstance()、.register()、.setVideo()、.has()、.preloadModels()、.createFramebuffer()、.getMaskTexture()、.postProcessing()、.useTexture()、.activeTexture()、.bindTexture()、.uniform3fv()、.useBufferFrame()、.centerFace()、.resize()、.viewport()、.drawArrays()、.close()、.getAsWebGLTexture()、.texImage2D()、.tryVideoFrameCallback()；+16 | new RtcErrorAlias()、new Promise()、new Float32Array()、new Error()、new bJ()、constructor()、super()、defineMember()、RtcErrorAlias()、init()、asyncGeneratorWrap()、Promise()、Boolean()、Float32Array()、isMobile()、initVisionTasks()、Error()、bJ()、onPredict()、isRotate90Or270()、getMaskTexture()、onFirstFrame()、render()、centerFace()、drawImage()、close() | — | Canvas 2D、WebGL、Encoding/binary |
| `构造函数` | L43116-L43164 | .init()、.catch()、.error()、.destroy()、.concat()、.resolvePreditReady() | new RtcErrorAlias()、constructor()、super()、defineMember()、RtcErrorAlias() | — | — |
| `init — 初始化组件/模块（分配资源和建立内部状态）` | L43167-L43249 | .AllIn1()、.resolvePreditReady()、.setWaterMark()、.setBeauty()、.init()、.useProgram()、.setAttributes()、.uniform1i()、.getUniformLocation()、.createTexture()、.uniformMatrix4fv()、.createShader()、.createProgram()、.warn()、.initVisionTasks() | new Promise()、new Float32Array()、init()、asyncGeneratorWrap()、Promise()、Boolean()、Float32Array()、isMobile() | — | WebGL、Encoding/binary |
| `initVisionTasks — 初始化视觉任务（人像分割等）` | L43252-L43286 | .getInstance()、.register()、.setVideo()、.has()、.preloadModels()、.error() | new Error()、new bJ()、initVisionTasks()、asyncGeneratorWrap()、Error()、bJ() | — | — |
| `onPredict — 预测回调` | L43289-L43323 | .createTexture()、.createFramebuffer()、.getMaskTexture()、.postProcessing()、.useProgram()、.setAttributes()、.useTexture()、.activeTexture()、.bindTexture()、.uniform3fv()、.useBufferFrame()、.centerFace()、.resize()、.viewport()、.drawArrays()、.close() | onPredict()、isRotate90Or270() | — | WebGL |
| `getMaskTexture — 获取遮罩纹理` | L43326-L43329 | .getAsWebGLTexture() | getMaskTexture() | — | — |
| `onFirstFrame — 首帧渲染回调` | L43332-L43338 | .useTexture()、.texImage2D() | onFirstFrame() | — | WebGL |
| `render — 渲染视频帧到画布` | L43341-L43408 | .tryVideoFrameCallback()、.useTexture()、.texSubImage2D()、.resize()、.texImage2D()、.useProgram()、.getMaskTexture()、.activeTexture()、.bindTexture()、.bindFramebuffer()、.drawArrays()、.copyTexSubImage2D()、.copyTexImage2D()、.getResult()、.resolvePreditReady()、.onPredict()、._onAbort()、.resetHashResults() | render()、isRotate90Or270() | — | WebGL |
| `centerFace — 人脸居中` | L43411-L43432 | .actionCentering()、.drawImage()、.create()、.fromTranslation()、.scale()、.uniformMatrix4fv() | centerFace() | — | Canvas 2D |
| `drawImage — 绘制图像到画布` | L43435-L43446 | .create()、.fromTranslation()、.scale()、.uniformMatrix4fv() | drawImage() | — | — |
| `close — 关闭本地流并释放所有轨道` | L43449-L43463 | .close()、.deleteTexture()、.deleteFramebuffer()、.deleteProgram() | close() | — | — |
| `extends 类 — extends` | L43467-L43562 | .useProgram()、.pixelStorei()、.setTexBuffer()、._initTexture()、.createTexture()、.bindTexture()、.texParameteri()、.uniform1i()、.getUniformLocation()、.viewport()、.activeTexture()、.texSubImage2D()、.draw()、.resize()、.texImage2D() | constructor()、super()、defineMember()、_initTexture()、render()、resize() | — | WebGL |
| `构造函数` | L43470-L43500 | .useProgram()、.pixelStorei()、.setTexBuffer()、._initTexture() | constructor()、super()、defineMember() | — | — |
| `_initTexture — 方法` | L43503-L43519 | .createTexture()、.bindTexture()、.texParameteri()、.uniform1i()、.getUniformLocation() | _initTexture() | — | WebGL |
| `render — 渲染视频帧到画布` | L43522-L43544 | .useProgram()、.viewport()、.activeTexture()、.bindTexture()、.texSubImage2D()、.draw() | render() | — | — |
| `resize — 调整渲染尺寸` | L43547-L43561 | .resize()、.activeTexture()、.bindTexture()、.texImage2D() | resize() | — | WebGL |
| `wJ — 内部函数` | L43565-L43575 | — | new Error()、Error() | — | — |
| `构造函数` | L43580-L43672 | .changeRenderer()、.onDecodeDowngradeStateChanged()、.start() | constructor()、defineMember()、createSubjectFromObservable()、fromEventObservable()、pipeOperator()、mB()、qF()、createTapOperator() | — | — |
| `start — 启动组件/模块（开始工作流程）` | L43675-L43730 | .next()、.pipe()、.error()、.concat()、.addFailedEvent()、.start()、.changeRenderer()、.warn()、.addSuccessEvent()、.handlePlaying() | start()、pipeOperator()、qF()、createSubject()、createTapOperator()、wJ()、JF() | — | — |
| `mock — 模拟操作（测试/调试用）` | L43733-L43736 | .error()、.start() | mock() | — | — |
| `close — 关闭本地流并释放所有轨道` | L43739-L43742 | .next() | close() | — | — |
| `changeRenderer — 切换渲染器` | L43745-L43750 | — | changeRenderer()、isOffscreenCanvasSupported() | — | — |
| `decode — 解码视频/音频数据` | L43753-L43829 | .next()、.close()、.concat()、.subarray()、.debug()、.push()、.forEach()、.decode()、.join()、.now()、.call() | new Uint8Array()、decode()、Uint8Array()、performanceNow() | — | Encoding/binary |
| `checkDowngradeByFrameDiff — 根据帧差检查是否需要降级` | L43832-L43851 | .debug()、.concat()、.now() | checkDowngradeByFrameDiff() | — | — |
| `checkDowngradeByTimestampDiff — 根据时间戳差异检查是否需要降级` | L43854-L43863 | .debug()、.concat() | checkDowngradeByTimestampDiff() | — | — |
| `pipe — 管道传输（数据流处理）` | L43866-L43988 | .defer()、.setCanvas()、.setInputMediaStreamTrack()、.close()、.destroy()、.info()、.concat()、.createDecoder()、.on()、.debug()、.now()、.checkDowngradeByFrameDiff()、.checkDowngradeByTimestampDiff()、.next()、.error()、.initialize()、.configure()、.create()、.resize()、.render()、.getWriter()、.write()、.createVideoImageSource()、.update()、.connect() | new Error()、new receiverWrapper()、new DJ()、new MediaStreamTrackGenerator()、new RH()、new pH()、pipe()、asyncGeneratorWrap()、Error()、receiverWrapper()、DJ()、MediaStreamTrackGenerator()、RH()、pH() | on('videoFrame')、on('error')、on(receiverWrapper.UNAVAILABLE)、on('videoCodecInfo') | — |
| `asyncGeneratorWrap — 方法` | L43871-L43987 | .defer()、.setCanvas()、.setInputMediaStreamTrack()、.close()、.destroy()、.info()、.concat()、.createDecoder()、.on()、.debug()、.now()、.checkDowngradeByFrameDiff()、.checkDowngradeByTimestampDiff()、.next()、.error()、.initialize()、.configure()、.create()、.resize()、.render()、.getWriter()、.write()、.createVideoImageSource()、.update()、.connect() | new Error()、new receiverWrapper()、new DJ()、new MediaStreamTrackGenerator()、new RH()、new pH()、asyncGeneratorWrap()、Error()、receiverWrapper()、DJ()、MediaStreamTrackGenerator()、RH()、pH() | on('videoFrame')、on('error')、on(receiverWrapper.UNAVAILABLE)、on('videoCodecInfo') | — |
| `extends 类 — extends` | L43993-L44901 | .createLogger()、.getLogger()、.enablePrintDetail()、.clear()、.get2dVideoContext()、.getGlVideoContext()、.update()、.destroy()、.create()、.initializeGlVideoContext()、.on()、.emit()、.warn()、.call()、.catch()、.error()、.run()、.debug()、.getInfo()、.clearTask()、.checkOrCreateVideoContext()、.addFailedEvent()、.addSuccessEvent()、.close()、.createVideoImageSource()、.resize()、.connect()、.replaceTrack()、.createVideoTrackSource()、.setCanvas()、.info()、.concat()、.setSmallVideo()、.setOutputMediaStreamTrack()、._setMainOutput()、.createVideoTrackDestination()、.disableCheckMute()、.getWatermarkImage()、.enableCheckMute()、.disconnect()；+23 | new RH()、new receiverWrapper()、new fH()、new _H()、new kJ()、new wH()、new kH()、new RtcErrorAlias()、new Error()、new OJ()、constructor()、super()、defineMember()、RH()、smallMode()、_hasVirtualBg()、Boolean()、_hasWaterMark()、_isRotate()、_isTransform()、renderMode()、cameraResolution()、isRotate90Or270()、get2dVideoContext()、getGlVideoContext()、receiverWrapper()、initializeGlVideoContext()、initVirtualBackground()、enablePrintDetail()、destroy()、needAlpha()、active()、sendCreateResult()、checkOrCreateVideoContext()、smallTrack()、hasSmall()、initialTrack()、setSmallVideo()、fH()、_setMainOutput()；+36 | on(receiverWrapper.UNAVAILABLE)、on(dH.RENDER)、emit('error')、emit('output-track-changed')、emit('render') | Track lifecycle、Canvas 2D、DOM |
| `构造函数` | L43996-L44053 | .createLogger()、.getLogger()、.enablePrintDetail() | new RH()、constructor()、super()、defineMember()、RH() | — | — |
| `get2dVideoContext — 获取 2D 视频渲染上下文` | L44102-L44111 | .destroy()、.create() | new RH()、get2dVideoContext()、RH() | — | — |
| `getGlVideoContext — 获取 WebGL 视频渲染上下文` | L44114-L44123 | .initializeGlVideoContext() | new receiverWrapper()、getGlVideoContext()、receiverWrapper() | — | — |
| `initializeGlVideoContext — 初始化 WebGL 视频渲染上下文` | L44126-L44148 | .create()、.on()、.emit()、.warn()、.call()、.update()、.catch()、.error() | initializeGlVideoContext() | on(receiverWrapper.UNAVAILABLE)、emit('error') | — |
| `initVirtualBackground — 初始化虚拟背景` | L44151-L44154 | — | initVirtualBackground() | — | — |
| `enablePrintDetail — 启用详细日志打印` | L44157-L44169 | .run()、.debug()、.getInfo() | enablePrintDetail() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L44172-L44180 | .destroy()、.clearTask() | destroy() | — | — |
| `sendCreateResult — 发送创建结果` | L44199-L44208 | .addFailedEvent()、.addSuccessEvent() | sendCreateResult() | — | — |
| `checkOrCreateVideoContext — 检查或创建视频上下文` | L44211-L44243 | .clear()、.initializeGlVideoContext()、.warn()、.get2dVideoContext()、.getGlVideoContext() | new receiverWrapper()、checkOrCreateVideoContext()、receiverWrapper() | — | — |
| `setSmallVideo — 设置小流视频轨道` | L44264-L44307 | .create()、.on()、.warn()、.close()、.createVideoImageSource()、.resize()、.connect()、.replaceTrack()、.createVideoTrackSource()、.destroy() | new fH()、setSmallVideo()、fH() | on(receiverWrapper.UNAVAILABLE) | — |
| `_setMainOutput — 方法` | L44310-L44334 | .setCanvas()、.emit()、.info()、.concat()、.setSmallVideo()、.setOutputMediaStreamTrack()、.error() | _setMainOutput() | emit('output-track-changed') | — |
| `update — 方法` | L44337-L44486 | .clear()、._setMainOutput()、.createVideoTrackDestination()、.on()、.emit()、.close()、.createVideoImageSource()、.replaceTrack()、.createVideoTrackSource()、.resize()、.disableCheckMute()、.getWatermarkImage()、.connect()、.enableCheckMute()、.disconnect()、.info()、.concat() | new _H()、new kJ()、new wH()、new kH()、update()、asyncGeneratorWrap()、_H()、kJ()、wH()、kH() | on(dH.RENDER)、emit('render') | — |
| `clearLastFrame — 清除最后一帧缓存` | L44489-L44495 | .clearRect() | clearLastFrame() | — | — |
| `changeInput — 切换混音输入源` | L44498-L44523 | .info()、.setScreenTrack()、.setCameraTrack()、.setOutputMediaStreamTrack()、.setMixTrack()、.warn() | changeInput() | — | — |
| `removeInput — 移除混音输入` | L44526-L44542 | .close()、.update()、.clear()、.destroy() | removeInput() | — | — |
| `setMixTrack — 设置混音轨道` | L44545-L44548 | — | setMixTrack() | — | — |
| `setCameraTrack — 设置摄像头轨道` | L44551-L44554 | .update() | setCameraTrack() | — | — |
| `setScreenTrack — 设置屏幕共享轨道` | L44557-L44567 | .replaceTrack()、.update()、.setOutputMediaStreamTrack() | setScreenTrack()、asyncGeneratorWrap() | — | — |
| `getWatermarkImage — 获取水印图片` | L44570-L44601 | .createElement()、.getContext()、.sort()、.forEach()、.drawImage()、.toDataURL() | new RtcErrorAlias()、getWatermarkImage()、asyncGeneratorWrap()、RtcErrorAlias()、loadImage() | — | Canvas 2D、DOM |
| `d — 内部函数` | L44589-L44622 | .drawImage()、.toDataURL()、.some()、.filter()、.push() | loadImage()、pushWaterMarkImageList() | — | Canvas 2D |
| `u — 内部函数` | L44592-L44622 | .drawImage()、.toDataURL()、.some()、.filter()、.push() | loadImage()、pushWaterMarkImageList() | — | Canvas 2D |
| `pushWaterMarkImageList — 推送水印图片列表` | L44604-L44622 | .some()、.filter()、.push() | pushWaterMarkImageList() | — | — |
| `setBeautyParams — 设置美颜参数` | L44625-L44631 | .update() | setBeautyParams()、asyncGeneratorWrap() | — | — |
| `stopBeauty — 停止美颜效果` | L44634-L44640 | .update() | stopBeauty()、asyncGeneratorWrap() | — | — |
| `setWatermark — 设置水印` | L44643-L44705 | .concat()、.some()、.filter()、.pushWaterMarkImageList()、.getWatermarkImage()、.resize()、.update()、.freshWatermark()、.info()、.stringify() | new RtcErrorAlias()、setWatermark()、asyncGeneratorWrap()、loadImage()、RtcErrorAlias() | — | — |
| `deleteWatermark — 删除水印` | L44708-L44723 | .filter()、.info()、.stringify()、.freshWatermark() | deleteWatermark()、asyncGeneratorWrap() | — | — |
| `freshWatermark — 刷新水印` | L44726-L44738 | .close()、.getWatermarkImage()、.update() | freshWatermark()、asyncGeneratorWrap() | — | — |
| `setVirtualBackground — 设置虚拟背景（人像分割后替换背景）` | L44741-L44779 | .reject()、.info()、.concat()、.update() | new Error()、new RtcErrorAlias()、setVirtualBackground()、asyncGeneratorWrap()、Error()、loadImage()、RtcErrorAlias() | — | — |
| `enableAr — 启用 AR 功能` | L44820-L44823 | .update() | enableAr() | — | — |
| `updateAr — 更新 AR 效果` | L44826-L44836 | .updateInputTrack()、.clone() | updateAr()、asyncGeneratorWrap() | — | Track lifecycle |
| `disableAr — 禁用 AR 功能` | L44839-L44844 | .stop()、.update() | disableAr() | — | Track lifecycle |
| `createDecodeContext — 创建解码上下文` | L44847-L44850 | — | new OJ()、createDecodeContext()、OJ() | — | — |
| `clear — 清除所有数据` | L44853-L44864 | .disconnect()、.removeAllListeners() | clear() | — | — |
| `addEncodeProcessor — 添加编码处理器` | L44867-L44874 | .includes()、.enableInsertableStreams() | addEncodeProcessor() | — | — |
| `addDecodeProcessor — 添加解码处理器` | L44877-L44884 | .includes()、.enableInsertableStreams() | addDecodeProcessor() | — | — |
| `removeEncodeProcessor — 移除编码处理器` | L44887-L44892 | — | removeEncodeProcessor() | — | — |
| `removeDecodeProcessor — 移除解码处理器` | L44895-L44900 | — | removeDecodeProcessor() | — | — |
| `handleAbortError — 处理中止错误（用户取消操作时的清理）` | L44907-L44910 | .error() | handleAbortError() | — | — |
| `extends 类 — extends` | L44948-L45333 | .createLogger()、.concat()、.values()、.forEach()、.toString()、.publish()、.unpublish()、.startsWith()、.once()、.sendAbilityStatus()、.warn()、.info()、.destroy()、.emit()、.addSuccessEvent()、.addFailedEvent()、.resolve()、.reject() | new Set()、new yJ()、new IJ()、new RJ()、new headerExtensions()、new MJ()、new Error()、new RtcErrorAlias()、constructor()、super()、defineMember()、Set()、Boolean()、isBoolean()、yJ()、IJ()、RJ()、headerExtensions()、MJ()、videoCodec()、scriptTransformWorker()、isMainStreamPublished()、isAuxStreamPublished()、hasAuxStream()、localMainAudioTrack()、localMainVideoTrack()、localAuxVideoTrack()、publishState()、muteState()、getLogger()、isJoining()、isJoined()、isLeft()、addTrack()、asyncGeneratorWrap()、removeTrack()、replaceTrack()、setEncodedDataProcessingListener()、Error()、enableAIVoice()；+24 | once(Events.JOIN_RECEIVED_CMD_RES)、emit(Events.ROOM_DESTROY)、emit(Events.JOIN_SCHEDULE_SUCCESS) | — |
| `构造函数` | L44951-L45025 | .createLogger()、.concat() | new Set()、new yJ()、new IJ()、new RJ()、new headerExtensions()、new MJ()、constructor()、super()、defineMember()、Set()、Boolean()、isBoolean()、yJ()、IJ()、RJ()、headerExtensions()、MJ() | — | — |
| `getLogger — 获取日志记录器实例` | L45104-L45107 | — | getLogger() | — | — |
| `addTrack — 添加媒体轨道到发布流` | L45122-L45128 | .publish() | addTrack()、asyncGeneratorWrap() | — | — |
| `removeTrack — 从发布流移除媒体轨道` | L45131-L45137 | .unpublish() | removeTrack()、asyncGeneratorWrap() | — | — |
| `replaceTrack — 替换本地流中的指定轨道` | L45140-L45143 | — | replaceTrack()、asyncGeneratorWrap() | — | — |
| `setEncodedDataProcessingListener — 设置编码数据处理监听器` | L45146-L45149 | — | new Error()、setEncodedDataProcessingListener()、Error() | — | — |
| `enableAIVoice — 启用/禁用 AI 语音处理` | L45152-L45155 | — | new Error()、enableAIVoice()、Error() | — | — |
| `setProxyServer — 设置代理服务器` | L45158-L45177 | .startsWith()、.concat()、.once()、.sendAbilityStatus() | setProxyServer()、isString()、isPlainObject()、setLogReportUrls()、setEnv() | once(Events.JOIN_RECEIVED_CMD_RES) | — |
| `getRemoteAudioStats — 获取远端音频统计信息` | L45180-L45195 | .forEach() | getRemoteAudioStats()、asyncGeneratorWrap() | — | — |
| `getTransportStats — 获取传输层统计信息（RTT、连接类型等）` | L45198-L45209 | — | getTransportStats()、asyncGeneratorWrap() | — | — |
| `getRemoteVideoStats — 获取远端视频统计信息` | L45212-L45236 | .forEach() | getRemoteVideoStats()、asyncGeneratorWrap() | — | — |
| `checkDestroy — 检查实例是否已销毁` | L45239-L45246 | — | new RtcErrorAlias()、checkDestroy()、RtcErrorAlias()、logConfig() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L45249-L45264 | .warn()、.info()、.destroy()、.emit() | new RtcErrorAlias()、destroy()、RtcErrorAlias()、logConfig() | emit(Events.ROOM_DESTROY) | — |
| `schedule — 调度任务` | L45267-L45311 | .info()、.concat()、.once()、.sendAbilityStatus()、.emit()、.addSuccessEvent()、.addFailedEvent() | schedule()、asyncGeneratorWrap()、performanceNow()、generateRoomConfig()、Number()、stringify()、objectMixin()、isNumber()、setRetryCount()、isString()、setEnv() | once(Events.JOIN_RECEIVED_CMD_RES)、emit(Events.JOIN_SCHEDULE_SUCCESS) | — |
| `sendAbilityStatus — 上报能力状态（编解码能力等）` | L45314-L45314 | — | sendAbilityStatus() | — | — |
| `enableInsertableStreams — 启用 Insertable Streams（SEI 功能依赖）` | L45317-L45320 | .resolve() | enableInsertableStreams() | — | — |
| `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | L45323-L45326 | .reject() | switchRoom() | — | — |
| `isSwitchRoomSupported — 检查是否支持切换房间功能` | L45329-L45332 | — | isSwitchRoomSupported() | — | — |
| `sortRtpCodecsByPriority — 内部函数` | L45339-L45368 | .includes()、.filter()、.push()、.map() | sortRtpCodecsByPriority() | — | — |
| `BJ — 源码命名函数` | L45369-L45453 | .map()、.find()、.forEach()、.push()、.shift()、.sortRtpCodecsByPriority()、.filter()、.includes()、.toLocaleLowerCase()、.addTransceiver()、.createOffer()、.close() | new RTCPeerConnection()、asyncGeneratorWrap()、jsonParse()、String()、yield()、RTCPeerConnection()、sortRtpCodecsByPriority() | — | RTCPeerConnection |
| `asyncGeneratorWrap — 方法` | L45372-L45453 | .map()、.find()、.forEach()、.push()、.shift()、.sortRtpCodecsByPriority()、.filter()、.includes()、.toLocaleLowerCase()、.addTransceiver()、.createOffer()、.close() | new RTCPeerConnection()、asyncGeneratorWrap()、jsonParse()、String()、yield()、RTCPeerConnection()、sortRtpCodecsByPriority() | — | RTCPeerConnection |
| `HJ — 源码命名函数` | L45454-L45527 | .now()、.map()、.push()、.forEach()、.find() | jsonParse()、String()、WJ()、jsonStringify() | — | — |
| `WJ — 源码命名函数` | L45528-L45585 | .map()、.forEach()、.findIndex()、.toLowerCase() | String()、GJ() | — | — |
| `GJ — 内部函数` | L45588-L45602 | .concat()、.trim()、.push()、.map()、.toUpperCase() | — | — | — |
| `jJ — 源码命名函数` | L45603-L45681 | .parse()、.forEach()、.push()、.includes()、.filter()、.has()、.replace()、.write() | new Set()、Set()、GJ() | — | — |
| `extends 类 — extends` | L45685-L45752 | .on()、.getLogger()、.createChild()、.off()、.listeners()、.includes()、.now()、.forEach()、.debug()、.concat()、.warn()、.emit() | constructor()、super()、defineMember()、onVideoCodecChanged()、onHeartbeatReport()、destroy() | on('262')、on('heartbeat-report')、emit('1') | — |
| `构造函数` | L45688-L45699 | .on()、.getLogger()、.createChild() | constructor()、super()、defineMember() | on('262') | — |
| `onVideoCodecChanged — 视频编码器切换回调` | L45702-L45712 | .off()、.listeners()、.includes()、.on() | onVideoCodecChanged() | on('heartbeat-report') | — |
| `onHeartbeatReport — 心跳上报数据回调` | L45715-L45745 | .now()、.forEach()、.debug()、.concat()、.warn()、.emit() | onHeartbeatReport() | emit('1') | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L45748-L45751 | .off() | destroy() | — | — |
| `createSEITransformStream — 内部函数` | L45759-L45795 | .forEach()、.postMessage()、.enqueue() | new TransformStream()、createSEITransformStream()、TransformStream()、transform()、e()、r() | — | Streams |
| `transform — 数据转换` | L45766-L45793 | .forEach()、.postMessage()、.enqueue() | transform()、e()、r() | — | — |
| `createInsertableStreamTransform — 内部函数` | L45798-L45847 | .forEach()、.postMessage()、.enqueue() | new TransformStream()、createInsertableStreamTransform()、TransformStream()、transform()、e() | — | Streams |
| `transform — 数据转换` | L45805-L45845 | .forEach()、.postMessage()、.enqueue() | transform()、e() | — | — |
## SPC、DataChannel 与 Encoded Transform（L45860-L49559）
详见：`02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `extends 类 — extends` | L45866-L47387 | .createLogger()、.getLogger()、.concat()、.initScriptTransformWorker()、.on()、.find()、.toLowerCase()、.get()、.abort()、.set()、.includes()、.forEach()、.filter()、.useHWEncoder()、.toString()、.map()、.join()、.push()、.now()、.pipeThrough()、.pipeTo()、.createObjectURL()、.revokeObjectURL()、.emit()、.error()、.getSenders()、.getIceTransportPolicy()、.getConfiguration()、.debug()、.stringify()、.getPeerConnectionConfig()、.clearBakRelayIps()、.addSuccessEvent()、.addFailedEvent()、.bind()、.createDataChannel()、.info()、.warn()、.addTransceiver()、.createOffer()；+54 | new Map()、new Set()、new WeakMap()、new Blob()、new Worker()、new RTCPeerConnection()、new SignalMessage()、new URLSearchParams()、new RtcErrorAlias()、new Promise()、new Error()、constructor()、super()、defineMember()、Map()、Set()、WeakMap()、isH264EncodeSupported()、Boolean()、addAbortController()、isVP8EncodeSupported()、isH265EncodeSupported()、videoCodec()、downlinkVideoCodec()、isUsingH264()、isUsingH265()、isUsingVP8()、is42001fSupported()、uplinkSSRC()、jsonParse()、isUndefined()、Number()、onBadHealth()、initScriptTransformWorker()、createInsertableStreamTransform()、createSEITransformStream()、Blob()、Worker()、isReconnecting()、dtlsTransport()；+79 | removeEventListener('track')、on('1')、on(Events.LEAVE_SUCCESS)、on(XJ.CONNECTION_STATE_CHANGED)、once(MSG_TYPE_3)、once('spc-reconnected')、once('error')、emit('sei-message')、emit('dump')、emit('track')、emit('data_channel_msg')、emit(Events.SPC_RECONNECTED)、emit('spc-reconnected')、emit('error')、emit(Events.SINGLE_CONNECTION_STAT)、emit(XJ.CONNECTION_STATE_CHANGED)、emit(XJ.FIREWALL_RESTRICTION)、事件属性(onmessage)、事件属性(onrtctransform)、事件属性(onerror)；+7 | RTCPeerConnection、WebSocket、RTCDataChannel、Worker、Streams、Encoded Transform、URL/Blob、Timers/scheduling |
| `构造函数` | L45869-L45926 | .createLogger()、.getLogger()、.concat()、.initScriptTransformWorker()、.on() | new Map()、new Set()、new WeakMap()、constructor()、super()、defineMember()、Map()、Set()、WeakMap() | on('1') | — |
| `addAbortController — 添加中止控制器` | L45940-L45946 | .get()、.abort()、.set() | addAbortController() | — | — |
| `onBadHealth — 连接亚健康状态回调` | L46076-L46081 | .useHWEncoder() | onBadHealth() | — | — |
| `initScriptTransformWorker — 初始化脚本转换 Worker` | L46084-L46156 | .concat()、.toString()、.map()、.join()、.push()、.now()、.pipeThrough()、.pipeTo()、.createObjectURL()、.revokeObjectURL()、.emit()、.error() | new Blob()、new Worker()、initScriptTransformWorker()、createInsertableStreamTransform()、createSEITransformStream()、Blob()、Worker() | emit('sei-message')、emit('dump')、事件属性(onmessage)、事件属性(onrtctransform)、事件属性(onerror) | Worker、Streams、Encoded Transform、URL/Blob |
| `getPeerConnectionConfig — 获取 RTCPeerConnection 配置（ICE 服务器等）` | L46171-L46191 | .getIceTransportPolicy()、.getConfiguration()、.debug()、.stringify() | getPeerConnectionConfig()、xN() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L46194-L46283 | .getPeerConnectionConfig()、.debug()、.concat()、.now()、.clearBakRelayIps()、.addSuccessEvent()、.addFailedEvent()、.bind()、.emit()、.createDataChannel()、.info()、.warn()、.addTransceiver()、.createOffer()、.error() | new RTCPeerConnection()、new SignalMessage()、initialize()、asyncGeneratorWrap()、RTCPeerConnection()、SignalMessage()、BJ() | emit('track')、emit('data_channel_msg')、事件属性(oniceconnectionstatechange)、事件属性(onsignalingstatechange)、事件属性(onconnectionstatechange)、事件属性(ontrack)、事件属性(onopen)、事件属性(onclose)、事件属性(onmessage)、事件属性(onerror)、事件属性(onstatechange) | RTCPeerConnection、RTCDataChannel |
| `setIceServers — 设置 ICE 服务器列表` | L46286-L46311 | .info()、.stringify()、.setConfiguration()、.getPeerConnectionConfig()、.warn()、.setOffer() | setIceServers()、asyncGeneratorWrap() | — | — |
| `setPriority — 设置优先级` | L46314-L46338 | .getSenders()、.forEach()、.getParameters()、.setParameters()、.catch()、.warn() | setPriority() | — | — |
| `connect — 建立 WebSocket 信令连接` | L46341-L46392 | .setOffer()、.setAnswer()、.waitForPeerConnectionConnected()、.get()、.setPriority()、.addSuccessEvent()、.error()、.concat()、.reset()、.addFailedEvent()、.emitConnectionStateChangedEvent()、.startReconnection() | new URLSearchParams()、connect()、asyncGeneratorWrap()、performanceNow()、HJ()、URLSearchParams() | — | URL/Blob |
| `reconnect — 重新建立信令连接` | L46395-L46458 | .warn()、.once()、.concat()、.reset()、.getBackupRelayIpPair()、.initialize()、.getIceServers()、.sendWaitForResponse()、.connect()、.addSuccessEvent()、.stopReconnection()、.emit()、.includes()、.clearReconnectionTimer()、.reconnect()、.error()、.addFailedEvent()、.emitConnectionStateChangedEvent() | new RtcErrorAlias()、reconnect()、asyncGeneratorWrap()、objectMixin()、RtcErrorAlias()、getReconnectionTimeout()、delay()、getRetryCount() | once(MSG_TYPE_3)、emit(Events.SPC_RECONNECTED)、emit('spc-reconnected')、emit('error') | — |
| `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | L46461-L46464 | — | getPeerConnection() | — | — |
| `startReconnection — 开始重连流程` | L46467-L46477 | .warn()、.emitConnectionStateChangedEvent()、.reconnect() | startReconnection()、asyncGeneratorWrap() | — | — |
| `stopReconnection — 停止重连` | L46480-L46491 | .info()、.clearReconnectionTimer()、.call()、.off()、.emitConnectionStateChangedEvent() | stopReconnection() | — | — |
| `checkPeerConnectionToReconnect — 检查并触发 PeerConnection 重连` | L46494-L46501 | .startReconnection() | checkPeerConnectionToReconnect() | — | — |
| `clearReconnectionTimer — 清除重连定时器` | L46504-L46507 | — | clearReconnectionTimer()、clearTimeout() | — | Timers/scheduling |
| `onConnectionStateChange — 连接状态变化回调` | L46510-L46536 | .getDTLSTransportState()、.info()、.concat()、.now()、.emitConnectionStateChangedEvent()、.switchRelay()、.startReconnection()、.emit()、.logSelectedCandidate() | onConnectionStateChange() | emit(Events.SINGLE_CONNECTION_STAT) | — |
| `getDTLSTransportState — 获取 DTLS 传输状态` | L46539-L46549 | .getSenders()、.getReceivers() | getDTLSTransportState()、hasGetSenders()、hasGetReceivers() | — | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L46552-L46558 | .emit() | emitConnectionStateChangedEvent() | emit(XJ.CONNECTION_STATE_CHANGED) | — |
| `logSelectedCandidate — 记录选中的 ICE 候选` | L46561-L46596 | .getStats()、.get()、.info()、.concat() | logSelectedCandidate()、asyncGeneratorWrap()、isCandidateSelected()、setNetworkTypeFromWebRTC() | — | — |
| `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | L46599-L46664 | .off()、.warn()、.emit()、.on()、.finally() | new Promise()、new RtcErrorAlias()、waitForPeerConnectionConnected()、Promise()、e()、clearTimeout()、n()、t()、RtcErrorAlias()、logConfig()、setTimeout() | on(Events.LEAVE_SUCCESS)、on(XJ.CONNECTION_STATE_CHANGED)、emit(XJ.FIREWALL_RESTRICTION) | Timers/scheduling |
| `i — 源码命名函数` | L46606-L46609 | — | clearTimeout()、n()、e() | — | Timers/scheduling |
| `r — 源码命名函数` | L46610-L46623 | — | new RtcErrorAlias()、clearTimeout()、n()、t()、RtcErrorAlias()、logConfig() | — | Timers/scheduling |
| `n — 内部函数` | L46626-L46629 | .off() | — | — | — |
| `waitForReconnected — 等待重连完成` | L46667-L46675 | .once()、.resolve() | new Promise()、waitForReconnected()、Promise() | once('spc-reconnected')、once('error') | — |
| `addDownlink — 添加下行连接（接收远端流）` | L46678-L46698 | .info()、.concat()、.waitForReconnected()、.updateLocalAndRemoteSDPConfig()、.updateSDP()、.error()、.startReconnection() | addDownlink()、asyncGeneratorWrap() | — | — |
| `updateLocalAndRemoteSDPConfig — 更新本地和远端的 SDP 配置` | L46701-L46811 | .info()、.concat()、.stringify()、.getTransceivers()、.slice()、.filter()、.map()、.find()、.includes()、.addTransceiver()、.parse()、.push()、.join()、.set() | updateLocalAndRemoteSDPConfig()、Number()、jsonParse()、WJ() | — | — |
| `removeDownlink — 移除下行连接` | L46814-L46841 | .has()、.info()、.concat()、.waitForReconnected()、.get()、.getTransceivers()、.forEach()、.includes()、.updateSDP()、.delete() | removeDownlink()、asyncGeneratorWrap()、Number()、jsonParse() | — | — |
| `setBandwidth — 设置带宽` | L46844-L46879 | .getSenders()、.slice()、.setSenderMaxBitrate()、.setStartBitrate()、.updateSDP()、.setBandwidthBySDP()、.info()、.concat()、.stringify()、.error() | setBandwidth()、asyncGeneratorWrap()、hasSetParameters() | — | — |
| `setStartBitrate — 设置编码起始码率` | L46882-L46896 | .concat() | setStartBitrate()、jsonParse() | — | — |
| `setSenderMaxBitrate — 设置发送器最大码率` | L46899-L46912 | .getParameters()、.setParameters() | setSenderMaxBitrate() | — | — |
| `setBandwidthBySDP — 通过修改 SDP 设置带宽限制` | L46915-L46941 | .updateSDP() | setBandwidthBySDP()、jsonParse()、jsonStringify() | — | — |
| `setScaleResolutionDownBy — 设置分辨率缩放比例` | L46944-L46961 | .getParameters()、.concat()、.warn()、.setParameters() | setScaleResolutionDownBy()、isUndefined() | — | — |
| `setDegradationPreference — 设置编码降级偏好（分辨率优先/帧率优先）` | L46964-L46983 | .getParameters()、.concat()、.info()、.setParameters()、.catch()、.warn() | setDegradationPreference()、isVersionLessThan() | — | — |
| `updateSDP — 更新 SDP 描述` | L46986-L47059 | .resolve()、.info()、.createOffer()、.setOffer()、.setAnswer()、.error()、.warn()、.concat()、.filterSDPDirection()、.stringify()、.getTransceivers()、.map() | new Promise()、updateSDP()、jsonStringify()、Promise()、asyncGeneratorWrap()、i()、r() | — | — |
| `asyncGeneratorWrap — 方法` | L46998-L47055 | .info()、.createOffer()、.setOffer()、.setAnswer()、.error()、.warn()、.concat()、.filterSDPDirection()、.stringify()、.getTransceivers()、.map() | asyncGeneratorWrap()、i()、r() | — | — |
| `setTransceiverDirection — 设置收发器方向（sendrecv/sendonly/recvonly/inactive）` | L47062-L47083 | .info()、.concat()、.join()、.getTransceivers()、.forEach()、.updateSDP() | setTransceiverDirection()、asyncGeneratorWrap() | — | — |
| `filterSDPDirection — 过滤 SDP 中的方向属性` | L47086-L47089 | .map() | filterSDPDirection()、jsonParse() | — | — |
| `setOffer — 设置 SDP Offer` | L47092-L47099 | .info()、.debug()、.setLocalDescription() | setOffer()、jJ() | — | — |
| `setAnswer — 设置 SDP Answer` | L47102-L47105 | .info()、.debug()、.setRemoteDescription() | setAnswer() | — | — |
| `switchVideoEncoder — 切换视频编码器（H264/VP8/VP9 之间切换）` | L47108-L47136 | .forEach()、.find()、.toLowerCase()、.includes()、.warn()、.concat()、.updateSDP() | switchVideoEncoder()、asyncGeneratorWrap()、jsonParse()、String()、GJ() | — | — |
| `useHWEncoder — 使用硬件编码器` | L47139-L47179 | .slice()、.push()、.forEach()、.find()、.includes()、.toLowerCase()、.warn()、.concat()、.updateSDP() | useHWEncoder()、asyncGeneratorWrap()、isUndefined()、String()、GJ() | — | — |
| `setProfileLevelId — 设置 H264 编码的 profile-level-id` | L47182-L47217 | .slice()、.push()、.forEach()、.find()、.includes()、.warn()、.concat()、.updateSDP() | setProfileLevelId()、asyncGeneratorWrap()、isUndefined()、String()、GJ() | — | — |
| `sendDataChannelMessage — 通过数据通道发送消息` | L47220-L47225 | .send() | sendDataChannelMessage() | — | — |
| `reset — 重置房间状态（清理所有内部数据）` | L47228-L47240 | .close()、.removeEventListener()、.call() | reset() | removeEventListener('track') | — |
| `close — 关闭本地流并释放所有轨道` | L47243-L47256 | .info()、.removeRTCListener()、.forEach()、.abort()、.clear()、.reset()、.emitConnectionStateChangedEvent()、.stopReconnection()、.removeAllListeners()、.off() | close()、MN() | — | — |
| `getReceiversByUserId — 按用户 ID 获取接收器` | L47259-L47266 | .getReceivers()、.get()、.map() | getReceiversByUserId() | — | — |
| `detectTCPAndUDP — 检测 TCP/UDP 连接能力` | L47273-L47312 | .getIceServers()、.max()、.floor()、.warn()、.concat()、.switchRelay() | detectTCPAndUDP() | — | — |
| `l — 内部函数` | L47293-L47342 | .warn()、.concat()、.switchRelay()、.now()、.doSwitchRelay()、.addSuccessEvent()、.addFailedEvent()、.reJoin() | switchRelay()、asyncGeneratorWrap() | — | — |
| `switchRelay — 切换中继` | L47315-L47342 | .warn()、.concat()、.now()、.doSwitchRelay()、.addSuccessEvent()、.addFailedEvent()、.reJoin()、.switchRelay() | switchRelay()、asyncGeneratorWrap() | — | — |
| `doSwitchRelay — 切换中继线路` | L47345-L47358 | .stopReconnection()、.concat()、.startReconnection()、.then()、.finally() | new Promise()、new Error()、doSwitchRelay()、Promise()、setTimeout()、i()、Error()、clearTimeout() | — | Timers/scheduling |
| `removeRTCListener — 移除 RTC 监听器` | L47361-L47369 | — | removeRTCListener() | 事件属性(oniceconnectionstatechange)、事件属性(onconnectionstatechange)、事件属性(onsignalingstatechange)、事件属性(ontrack)、事件属性(onstatechange) | — |
| `requestRemoteFallbackToH264 — 请求远端降级到 H264 编码` | L47372-L47386 | .warn()、.sendWaitForResponse()、.then() | requestRemoteFallbackToH264() | — | — |
| `构造函数` | L47418-L47426 | .getUint16()、.slice() | new DataView()、new Uint8Array()、constructor()、defineMember()、DataView()、Uint8Array() | — | Encoding/binary |
| `构造函数` | L47431-L47449 | .getUint16()、.slice()、.push()、.forEach()、.decode() | new DataView()、new SignalPacket()、new Uint8Array()、new TextDecoder()、constructor()、defineMember()、DataView()、SignalPacket()、Uint8Array()、TextDecoder() | — | Encoding/binary |
| `generateUniqueId — 内部函数` | L47455-L47461 | .floor()、.random()、.has()、.add() | generateUniqueId() | — | — |
| `extends 类 — extends` | L47470-L47576 | .createLogger()、.getLogger()、.getPeerConnection()、.info()、.emit()、.includes() | constructor()、super()、defineMember()、_peerConnection()、singlePC()、_signalChannel()、close()、emitConnectionStateChangedEvent()、getPeerConnection()、getRoom()、getUserId()、getTinyId()、getCurrentState()、isH264() | emit('closed')、emit(Events.PEER_CONNECTION_STATE_CHANGED)、emit('connection-state-changed') | RTCPeerConnection |
| `构造函数` | L47473-L47498 | .createLogger()、.getLogger() | constructor()、super()、defineMember() | — | — |
| `close — 关闭本地流并释放所有轨道` | L47516-L47519 | .info()、.emit() | close() | emit('closed') | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L47522-L47536 | .emit() | emitConnectionStateChangedEvent() | emit(Events.PEER_CONNECTION_STATE_CHANGED)、emit('connection-state-changed') | — |
| `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | L47539-L47542 | — | getPeerConnection() | — | — |
| `getRoom — 获取房间实例` | L47545-L47548 | — | getRoom() | — | — |
| `getUserId — 获取用户 ID` | L47551-L47554 | — | getUserId() | — | — |
| `getTinyId — 获取 Tiny ID（内部用户标识）` | L47557-L47560 | — | getTinyId() | — | — |
| `getCurrentState — 获取当前状态` | L47563-L47566 | — | getCurrentState() | — | — |
| `构造函数` | L47580-L47589 | .createLogger() | new Map()、constructor()、defineMember()、Map() | — | — |
| `getWorker — 获取 Worker 实例` | L47592-L47625 | .createObjectURL()、.revokeObjectURL()、.warn()、.get()、.concat() | new Blob()、new Worker()、getWorker()、Blob()、Worker()、t() | 事件属性(onmessage)、事件属性(onerror) | Canvas 2D、OffscreenCanvas、Worker、Streams、URL/Blob、Timers/scheduling |
| `start — 启动组件/模块（开始工作流程）` | L47628-L47681 | .debug()、.warn()、.filter()、.info()、.checkOnce()、.on()、.set()、.off() | start()、isOffscreenCanvasSupported() | on('heartbeat-report') | — |
| `s — 源码命名函数` | L47634-L47671 | .filter()、.info()、.checkOnce() | — | — | — |
| `checkOnce — 单次检查` | L47684-L47699 | .getWorker()、.postMessage()、.warn()、.stop() | new Error()、new MediaStreamTrackProcessor()、checkOnce()、Error()、MediaStreamTrackProcessor() | — | Track lifecycle |
| `stop — 停止本地流播放` | L47702-L47713 | .postMessage()、.delete()、.get() | stop()、t() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L47716-L47719 | .forEach()、.stop()、.terminate() | destroy() | — | Track lifecycle |
| `构造函数` | L47729-L47762 | .initialize() | constructor()、super()、assignDescriptors()、objectMixin()、defineMember() | — | — |
| `checkPublishState — 检查发布状态` | L47805-L47853 | .keys()、.filter()、.run()、.checkPublishState()、.addCount()、.forEach()、.warn()、.concat()、.addEnum()、.clearTask() | checkPublishState()、getOSString()、getDeviceModel() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L47873-L47876 | .installEvents() | initialize() | — | — |
| `close — 关闭本地流并释放所有轨道` | L47879-L47889 | .getSenders()、.replaceTrack()、.close()、.uninstallEvents()、.uninstallTrackMuteEvents()、.emitConnectionStateChangedEvent() | close() | — | — |
| `installEvents — 安装事件监听器` | L47892-L47897 | .listeners()、.includes()、.on()、.installSPCEvents() | installEvents() | on('connection-state-changed') | — |
| `installSPCEvents — 安装单连接模式事件监听器` | L47900-L47907 | .listeners()、.includes()、.on() | installSPCEvents() | on('spc-reconnected') | — |
| `uninstallSPCEvents — 卸载单连接模式事件监听器` | L47910-L47915 | .off() | uninstallSPCEvents() | — | — |
| `uninstallEvents — 卸载事件监听器集合` | L47918-L47921 | .off()、.uninstallSPCEvents() | uninstallEvents() | — | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L47924-L47943 | .emitConnectionStateChangedEvent()、.emit() | emitConnectionStateChangedEvent() | emit('connection-state-changed') | — |
| `onVideoEncodeFailed — 视频编码失败回调` | L47946-L47965 | .warn()、.switchVideoEncoder() | onVideoEncodeFailed()、asyncGeneratorWrap() | — | — |
| `publish — 发布本地音视频流到房间` | L47968-L48051 | .installEvents()、.installTrackMuteEvents()、.bind()、.waitForPeerConnectionConnected()、.warn()、.switchVideoEncoder()、.concat()、.stringify()、.setProfile()、.applyProfile()、.sendWaitForResponseWithRetry()、.publishByTransceiver()、.setDegradationPreference()、.getSenders()、.setScaleResolutionDownBy()、.setBandwidth()、.sendMediaSettings()、.useHWEncoder()、.get()、.setProfileLevelId() | new RtcErrorAlias()、new URLSearchParams()、publish()、asyncGeneratorWrap()、RtcErrorAlias()、logConfig()、getChromeVersion()、assignDescriptors()、objectMixin()、URLSearchParams() | — | URL/Blob |
| `publishByTransceiver — 通过 addTransceiver API 推流` | L48054-L48087 | .info()、.getTransceivers()、.replaceTrack()、.push()、.then()、.createEncodedStreams()、.initSenderTransform()、.publishSmall()、.setTransceiverDirection()、.all() | publishByTransceiver()、hasAddTransceiver()、d() | — | Encoded Transform |
| `d — 内部函数` | L48067-L48078 | .replaceTrack()、.push()、.then()、.createEncodedStreams()、.initSenderTransform() | — | — | Encoded Transform |
| `getTrackByMediaType — 按媒体类型获取轨道` | L48090-L48104 | — | getTrackByMediaType() | — | — |
| `createEncodedStreams — 创建编码流（Insertable Streams）` | L48107-L48144 | .has()、.createEncodedStreams()、.addAbortController()、.getTrackByMediaType()、.pipeThrough()、.enqueue()、.encodeFrame()、.pipeTo()、.catch()、.debug()、.warn() | new AbortController()、new TransformStream()、createEncodedStreams()、AbortController()、TransformStream() | — | Streams、Encoded Transform |
| `initSenderTransform — 初始化发送端 Transform Stream` | L48147-L48160 | — | new RTCRtpScriptTransform()、initSenderTransform()、RTCRtpScriptTransform() | — | Encoded Transform |
| `enableSmall — 启用/禁用小流（Simulcast 分层编码）` | L48163-L48169 | .publishSmall()、.unpublishSmall() | enableSmall()、asyncGeneratorWrap() | — | — |
| `publishSmall — 发布 Simulcast 小流` | L48172-L48217 | .warn()、.getTransceivers()、.doPublishSmall()、.addSuccessEvent()、.createEncodedStreams()、.initSenderTransform()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange()、.start()、.addFailedEvent()、.stop() | publishSmall()、asyncGeneratorWrap()、isWebRTCBasedScreenCaptureSupported() | — | Track lifecycle、Encoded Transform |
| `doPublishSmall — 推小流（Simulcast 分层编码）` | L48220-L48263 | .info()、.getTransceivers()、.replaceTrack()、.getParameters()、.setParameters()、.warn()、.concat() | doPublishSmall()、asyncGeneratorWrap()、calculateScaleResolutionDownNumber()、Boolean() | — | — |
| `unpublishSmall — 取消发布小流` | L48266-L48279 | .info()、.getTransceivers()、.replaceTrack()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange()、.stop() | unpublishSmall()、asyncGeneratorWrap() | — | Track lifecycle |
| `installTrackMuteEvents — 安装轨道静音状态事件监听器` | L48282-L48291 | .forEach()、.on() | new Array()、installTrackMuteEvents()、Array() | on('mute')、on('unmute') | — |
| `uninstallTrackMuteEvents — 卸载轨道静音状态事件监听器` | L48294-L48303 | .forEach()、.off() | new Array()、uninstallTrackMuteEvents()、Array() | — | — |
| `unpublish — 取消发布本地音视频流` | L48306-L48362 | .waitForPeerConnectionConnected()、.getSenders()、.replaceTrack()、.push()、.setTransceiverDirection()、.doPublishChange()、.doUnpublish()、.uninstallTrackMuteEvents()、.emit() | unpublish()、asyncGeneratorWrap()、yield()、assignDescriptors()、objectMixin() | emit('connection-state-changed') | — |
| `doPublishChange — 执行推流变更（更新 SDP）` | L48365-L48383 | .sendWaitForResponseWithRetry()、.checkPublishResultCode() | doPublishChange()、asyncGeneratorWrap() | — | — |
| `doUnpublish — 执行取消发布（通知服务器并清理上行资源）` | L48386-L48403 | .sendWaitForResponse()、.catch()、.getCode()、.resolve() | doUnpublish() | — | — |
| `updateMediaSettings — 更新媒体设置` | L48406-L48468 | .getSettings()、.info()、.concat()、.stringify() | updateMediaSettings() | — | Track constraints/settings/capabilities |
| `sendMediaSettings — 发送媒体设置` | L48471-L48485 | .updateMediaSettings()、.sendWaitForResponse()、.then()、.warn()、.catch() | sendMediaSettings() | — | — |
| `addTrack — 添加媒体轨道到发布流` | L48488-L48502 | .info()、.concat()、.addTrackByTransceiver() | addTrack()、asyncGeneratorWrap()、hasGetTransceivers() | — | — |
| `addTrackByTransceiver — 通过 RTCRtpTransceiver 添加轨道` | L48505-L48529 | .getTransceivers()、.replaceTrack()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange() | addTrackByTransceiver()、asyncGeneratorWrap() | — | — |
| `removeTrack — 从发布流移除媒体轨道` | L48532-L48546 | .info()、.concat()、.removeTrackByTransceiver() | removeTrack()、asyncGeneratorWrap()、hasGetTransceivers() | — | — |
| `removeTrackByTransceiver — 通过 RTCRtpTransceiver 移除轨道` | L48549-L48567 | .getTransceivers()、.replaceTrack()、.setTransceiverDirection()、.updateMediaSettings()、.doPublishChange() | removeTrackByTransceiver()、asyncGeneratorWrap() | — | — |
| `replaceTrack — 替换本地流中的指定轨道` | L48570-L48596 | .getSenders()、.find()、.info()、.concat()、.replaceTrack() | replaceTrack()、asyncGeneratorWrap() | — | — |
| `setBandwidth — 设置带宽` | L48599-L48624 | .setBandwidth() | setBandwidth()、asyncGeneratorWrap() | — | — |
| `sendMutedFlag — 发送静音标志` | L48627-L48640 | .info()、.concat()、.stringify()、.sendWaitForResponseWithRetry()、.catch() | sendMutedFlag() | — | — |
| `handleConnectionStateChange — 处理连接状态变化` | L48643-L48648 | .emit() | handleConnectionStateChange() | emit(Events.SEND_FIRST_VIDEO_FRAME) | — |
| `getVideoTrackId — 获取视频轨道 ID` | L48651-L48676 | .getSenders() | getVideoTrackId() | — | — |
| `getSSRC — 获取 SSRC（同步源标识）` | L48679-L48682 | — | getSSRC() | — | — |
| `checkPublishResultCode — 检查发布结果码` | L48685-L48698 | .error() | new RtcErrorAlias()、checkPublishResultCode()、RtcErrorAlias()、logConfig() | — | — |
| `onSinglePCReconnected — 单连接模式重连成功回调` | L48701-L48720 | .warn()、.publish() | onSinglePCReconnected()、asyncGeneratorWrap() | — | — |
| `getEnabledKeys — 内部函数` | L48747-L48750 | .keys()、.filter() | getEnabledKeys() | — | — |
| `构造函数` | L48759-L48777 | .initialize() | new WH()、new jH()、new JH()、constructor()、super()、assignDescriptors()、objectMixin()、defineMember()、WH()、jH()、JH() | — | — |
| `isStreamUnpublished — 检查流是否已取消发布` | L48847-L48850 | — | isStreamUnpublished() | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L48853-L48856 | .installEvents() | initialize() | — | — |
| `close — 关闭本地流并释放所有轨道` | L48859-L48869 | .close()、.emitConnectionStateChangedEvent()、.uninstallEvents()、.removeDownlink() | close()、clearTimeout() | — | Timers/scheduling |
| `installEvents — 安装事件监听器` | L48872-L48879 | .listeners()、.includes()、.on() | installEvents() | on('track')、on('spc-reconnected')、on('decode-failed') | — |
| `uninstallEvents — 卸载事件监听器集合` | L48882-L48888 | .off() | uninstallEvents() | — | — |
| `emitConnectionStateChangedEvent — 发射连接状态变化事件` | L48891-L48905 | .emitConnectionStateChangedEvent()、.emit() | emitConnectionStateChangedEvent() | emit('connection-state-changed') | — |
| `onTrack — 轨道事件回调` | L48908-L48928 | .includes()、.debug()、.concat()、.set()、.initReceiverTransform()、.createEncodedStreams()、.setInputMediaStreamTrack() | onTrack() | — | Encoded Transform |
| `createEncodedStreams — 创建编码流（Insertable Streams）` | L48931-L48972 | .has()、.createEncodedStreams()、.get()、.decodeFrame()、.pipeThrough()、.enqueue()、.pipeTo()、.catch()、.warn()、.addAbortController() | new AbortController()、new TransformStream()、createEncodedStreams()、AbortController()、TransformStream() | — | Streams、Encoded Transform |
| `initReceiverTransform — 初始化接收端 Transform Stream` | L48975-L48987 | — | new RTCRtpScriptTransform()、initReceiverTransform()、RTCRtpScriptTransform() | — | Encoded Transform |
| `subscribe — 订阅远端用户的音视频流` | L48990-L49064 | .info()、.concat()、.values()、.find()、.sendSubscription()、.get()、.delete()、.doSubscribe()、.checkTrackEnded()、.addSuccessEvent()、.start()、.warn()、.changeType()、.addFailedEvent()、.stop()、.isStreamUnpublished()、.stringify() | new RtcErrorAlias()、subscribe()、asyncGeneratorWrap()、getEnabledKeys()、RtcErrorAlias() | — | Track lifecycle |
| `checkTrackEnded — 检查媒体轨道是否已结束` | L49067-L49082 | .warn()、.startReconnection() | checkTrackEnded() | — | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L49085-L49133 | .info()、.concat()、.forEach()、.values()、.find()、.add()、.sendSubscription()、.stop()、.removeDownlink() | unsubscribe()、asyncGeneratorWrap()、objectMixin()、getEnabledKeys() | — | Track lifecycle |
| `sendSubscription — 发送订阅请求` | L49136-L49172 | .sendWaitForResponseWithRetry()、.then()、.error() | new RtcErrorAlias()、sendSubscription()、RtcErrorAlias()、logConfig() | — | — |
| `getMainStreamVideoTrackId — 获取主流视频轨道 ID` | L49175-L49178 | — | getMainStreamVideoTrackId() | — | — |
| `getAuxStreamVideoTrackId — 获取辅流视频轨道 ID` | L49181-L49186 | — | getAuxStreamVideoTrackId() | — | — |
| `setDelay — 设置延迟时间` | L49189-L49194 | — | setDelay() | — | — |
| `onSinglePCReconnected — 单连接模式重连成功回调` | L49197-L49208 | .warn()、.concat()、.stringify()、.doSubscribe()、.checkDecodeResult() | onSinglePCReconnected()、asyncGeneratorWrap() | — | — |
| `doSubscribe — 执行远端流订阅（发送订阅信令并建立接收连接）` | L49215-L49288 | .add()、.waitForPeerConnectionConnected()、.delete()、.addDownlink()、.sendWaitForResponseWithRetry()、.removeDownlink()、.setJitterBufferDelay() | new RtcErrorAlias()、doSubscribe()、asyncGeneratorWrap()、generateUniqueId()、RtcErrorAlias()、isNumber() | — | — |
| `removeDownlink — 移除下行连接` | L49291-L49304 | .delete()、.setJitterBufferDelay()、.removeDownlink() | removeDownlink()、asyncGeneratorWrap() | — | — |
| `setJitterBufferDelay — 设置抖动缓冲区延迟（抗网络抖动）` | L49307-L49325 | .resolve()、.info()、.concat()、.getReceiversByUserId()、.doSetJitterBufferDelay() | new Promise()、setJitterBufferDelay()、LN()、isNumber()、Promise() | — | — |
| `doSetJitterBufferDelay — 设置抖动缓冲延迟` | L49328-L49377 | .forEach()、.debug()、.concat()、.find()、.info()、.doSetJitterBufferDelay()、.warn() | doSetJitterBufferDelay()、n()、LN()、setTimeout()、clearTimeout() | — | Timers/scheduling |
| `s — 内部函数` | L49347-L49365 | .debug()、.concat()、.find() | — | — | — |
| `onDecodeFailed — 解码失败回调` | L49387-L49390 | .requestRemoteFallbackToH264() | onDecodeFailed() | — | — |
| `n — 源码命名函数` | L49404-L49408 | .off() | new RtcErrorAlias()、r()、RtcErrorAlias()、logConfig() | — | — |
| `MessageManagerBase 类 — MessageManagerBase` | L49432-L49553 | .createLogger()、.getLogger()、.bind()、.on()、.keys()、.forEach()、.split()、.slice()、.join()、.delete()、.get()、.floor()、.random()、.fromCharCode()、.set()、.send()、.debug()、.concat()、.stringify()、.from()、.charCodeAt()、.abs()、.emitMessage()、.has()、.emit()、.warn()、.off()、.onReceiveMsg()、.then()、.values()、.sort() | new Map()、new Uint8Array()、constructor()、super()、defineMember()、Map()、send()、btoa()、Uint8Array()、onReceiveMsg()、atob()、setTimeout()、delay()、emitMessage()、clearTimeout() | on(_j.RECEIVE_CUSTOM_MSG)、on('peer-leave')、on('peer-join')、emit('message') | Timers/scheduling、Encoding/binary |
| `构造函数` | L49435-L49454 | .createLogger()、.getLogger()、.bind()、.on()、.keys()、.forEach()、.split()、.slice()、.join()、.delete() | new Map()、constructor()、super()、defineMember()、Map() | on(_j.RECEIVE_CUSTOM_MSG)、on('peer-leave') | — |
| `send — 发送信令消息` | L49457-L49466 | .get()、.floor()、.random()、.fromCharCode()、.set()、.send()、.debug()、.concat()、.stringify() | new Uint8Array()、send()、btoa()、Uint8Array() | — | Encoding/binary |
| `onReceiveMsg — 收到消息回调` | L49469-L49522 | .get()、.from()、.charCodeAt()、.concat()、.abs()、.set()、.emitMessage()、.has()、.debug()、.emit()、.warn()、.off()、.onReceiveMsg()、.on()、.then() | new Map()、onReceiveMsg()、atob()、Map()、setTimeout()、delay() | on('peer-join')、emit('message') | Timers/scheduling、Encoding/binary |
| `e — 源码命名函数` | L49515-L49518 | .off()、.onReceiveMsg() | — | — | — |
| `emitMessage — 发射消息事件` | L49525-L49552 | .get()、.concat()、.values()、.sort()、.debug()、.delete()、.stringify()、.emit()、.emitMessage() | emitMessage()、clearTimeout() | emit('message') | Timers/scheduling |
## TRTCRoom 与业务编排（L49560-L51908）
详见：`03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md`
| 方法/标识 | 源码范围 | 直接成员调用 | 直接函数/构造调用 | 事件操作 | 直接 Web API |
|---|---:|---|---|---|---|
| `构造函数` | L49572-L49628 | .isUnifiedPlanDefault()、.info()、.concat()、._initBusinessInfo() | new Map()、new hJ()、new QH()、new zJ()、constructor()、super()、defineMember()、Map()、hJ()、QH()、Tq()、vq()、Boolean()、zJ() | — | — |
| `join — 加入 TRTC 房间，初始化连接并开始信令通信` | L49682-L49743 | .on()、.emit()、.closeDownLinkConnection()、.checkDestroy()、.all()、.initialize()、.initSinglePC()、.destroy()、.doJoin()、.addSuccessEvent()、.onPublishedUserList()、.addFailedEvent() | new Promise()、join()、asyncGeneratorWrap()、omitKeys()、objectMixin()、Promise()、i()、performanceNow()、t() | on('1')、on('2')、on('3')、on('5')、on('6')、emit('peer-join')、emit('peer-leave')、emit(Events.REMOTE_PUBLISH_STATE_CHANGED)、emit('remote-publish-state-changed') | — |
| `asyncGeneratorWrap — 方法` | L49709-L49739 | .checkDestroy()、.all()、.initialize()、.initSinglePC()、.destroy()、.doJoin()、.addSuccessEvent()、.onPublishedUserList()、.addFailedEvent() | asyncGeneratorWrap()、i()、performanceNow()、t() | — | — |
| `initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | L49746-L49769 | .on()、.emit()、.once()、.fallbackToMPC()、.initialize() | new SignalTransport()、new RtcErrorAlias()、initSinglePC()、asyncGeneratorWrap()、SignalTransport()、RtcErrorAlias() | on('sei-message')、on('dump')、once('error')、emit('sei-message')、emit('dump') | — |
| `doJoin — 执行实际的加入房间操作（发送信令、等待响应）` | L49772-L49871 | .once()、.clearJoinTimeout()、.emit()、.setConnectionType()、.debug()、.concat()、.stringify()、.setTimeout()、.send()、.info()、.startHeartbeat()、.syncUserList()、.startSyncUserListInterval()、.setIceServers()、.getIceServers()、.then()、.connect()、.catch()、.error() | new Promise()、new RtcErrorAlias()、doJoin()、Promise()、asyncGeneratorWrap()、r()、isBoolean()、String()、getTerminalType()、getNumNetworkType()、Boolean()、isWebCodecsApiAvailable()、RtcErrorAlias()、logConfig()、assignDescriptors()、objectMixin()、i() | once(MSG_TYPE_5)、once(_j.JOIN_ROOM_RESULT)、emit(Events.JOIN_SIGNAL_CONNECTION_END)、emit(Events.JOIN_SEND_CMD)、emit(Events.JOIN_RECEIVED_CMD_RES) | Navigator/UA、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L49777-L49869 | .once()、.clearJoinTimeout()、.emit()、.setConnectionType()、.debug()、.concat()、.stringify()、.setTimeout()、.send()、.info()、.startHeartbeat()、.syncUserList()、.startSyncUserListInterval()、.setIceServers()、.getIceServers()、.then()、.connect()、.catch()、.error() | new RtcErrorAlias()、asyncGeneratorWrap()、r()、isBoolean()、String()、getTerminalType()、getNumNetworkType()、Boolean()、isWebCodecsApiAvailable()、RtcErrorAlias()、logConfig()、assignDescriptors()、objectMixin()、i() | once(MSG_TYPE_5)、once(_j.JOIN_ROOM_RESULT)、emit(Events.JOIN_SIGNAL_CONNECTION_END)、emit(Events.JOIN_SEND_CMD)、emit(Events.JOIN_RECEIVED_CMD_RES) | Navigator/UA、Timers/scheduling |
| `asyncGeneratorWrap — 方法` | L49829-L49867 | .clearJoinTimeout()、.emit()、.info()、.startHeartbeat()、.syncUserList()、.startSyncUserListInterval()、.setIceServers()、.getIceServers()、.then()、.connect()、.catch()、.error()、.concat() | new RtcErrorAlias()、asyncGeneratorWrap()、assignDescriptors()、objectMixin()、Boolean()、i()、r()、RtcErrorAlias()、logConfig() | emit(Events.JOIN_RECEIVED_CMD_RES) | — |
| `reJoin — 断开后重新加入房间` | L49874-L49939 | .warn()、.concat()、.close()、.push()、.initSinglePC()、.then()、.connect()、.all()、.doJoin()、.logSuccessEvent()、.off()、.installEvents()、.onSinglePCReconnected()、.forEach()、.on()、.checkConnectionsToReconnect()、.getIsReconnecting()、.startReconnection()、.reset()、.logFailedEvent()、.emit() | new RtcErrorAlias()、reJoin()、asyncGeneratorWrap()、assignDescriptors()、objectMixin()、RtcErrorAlias()、logConfig() | on(XJ.CONNECTION_STATE_CHANGED)、emit('error') | — |
| `e — 源码命名函数` | L49903-L49915 | .off()、.installEvents()、.onSinglePCReconnected()、.forEach() | — | — | — |
| `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | L49942-L50077 | .getSignalChannelUrl()、.values()、.find()、.isArray()、.info()、.concat()、.close()、.on()、.emit()、.detectTCPAndUDP()、.add()、.reset()、.addUser()、.deleteUser()、.now()、.doHeartbeat()、.onPublishedUserList()、.uploadEvent()、.warn()、.reJoin()、.forEach()、.set()、.resolveSwitchRoomSubedReq()、.addCount()、.switchVideoEncoder()、.sendMediaSettings()、.once()、.connect() | new Xj()、new MessageManager()、new fJ()、initialize()、asyncGeneratorWrap()、Boolean()、Xj()、MessageManager()、fJ()、createEventDispatcher()、objectMixin()、stringify()、yield() | on('message')、on(fJ.EVENT_NETWORK_QUALITY)、once(MSG_TYPE_1)、emit('custom-message')、emit('network-quality')、emit(Events.SIGNAL_CONNECTION_STATE_CHANGED)、emit('signal-connection-state-changed')、emit('error')、emit('banned')、emit(Events.JOIN_SIGNAL_CONNECTION_END)、emit(Events.JOIN_SIGNAL_CONNECTION_START) | Page visibility |
| `asyncGeneratorWrap — 方法` | L50052-L50065 | .warn()、.concat()、.addCount()、.switchVideoEncoder()、.sendMediaSettings() | asyncGeneratorWrap()、yield() | — | — |
| `setSignalChannel — 设置信令通道实例` | L50080-L50083 | — | setSignalChannel()、destroyEventDispatcher() | — | — |
| `leave — 离开当前房间` | L50086-L50102 | .doHeartbeat()、.info()、.emit()、.send() | leave()、asyncGeneratorWrap() | emit(Events.LEAVE_SEND_CMD) | — |
| `clearNetworkQuality — 清除网络质量数据` | L50105-L50108 | .stop() | clearNetworkQuality() | — | Track lifecycle |
| `closeConnections — 关闭所有 WebRTC 连接` | L50111-L50117 | .forEach()、.closeDownLinkConnection() | closeConnections() | — | — |
| `clearJoinTimeout — 清除加入房间超时定时器` | L50120-L50123 | — | clearJoinTimeout()、clearTimeout() | — | Timers/scheduling |
| `startHeartbeat — 启动心跳检测（定期发送心跳包保持连接）` | L50126-L50131 | .run()、.bind()、.startUpdateNTPTime() | startHeartbeat() | — | — |
| `stopHeartbeat — 停止心跳检测` | L50134-L50141 | .info()、.clearTask() | stopHeartbeat() | — | — |
| `doHeartbeat — 执行一次心跳检测并上报状态` | L50144-L50230 | .getMonitorFreeze()、.getStatsReport()、.resetMonitor()、.has()、.get()、.map()、.delete()、.getTime()、.getSignalInfo()、.emit()、.send()、.now()、.warn()、.concat()、.startReconnection()、.isRelayMaybeFailed()、.reJoin() | new Date()、doHeartbeat()、asyncGeneratorWrap()、assignDescriptors()、objectMixin()、Date()、getDeviceModel()、getNumNetworkType() | emit(Events.HEARTBEAT_REPORT)、emit('heartbeat-report') | — |
| `onPublishedUserList — 收到已发布用户列表后的处理` | L50233-L50263 | .filter()、.map()、.emit()、.get()、.checkSubscribeBigSmallVideo()、.forEach()、.unshift()、.push()、.find()、.setRemotePublishedUserList() | onPublishedUserList() | emit('local-publish-flag-changed')、emit(Events.RECEIVED_PUBLISHED_USER_LIST) | — |
| `closeUplink — 关闭上行推流连接` | L50266-L50276 | .doUnpublish()、.catch()、.close()、.forEach()、.unpublish()、.clear() | closeUplink() | — | — |
| `createDownlinkConnection — 创建下行拉流连接（接收远端流）` | L50279-L50293 | .addRemotePublishedUser()、.installDownlinkEvents()、.emit() | createDownlinkConnection() | emit('remote-published') | — |
| `closeDownLinkConnection — 关闭指定下行连接` | L50296-L50302 | .get()、.close()、.emit() | closeDownLinkConnection() | emit('remote-unpublished') | — |
| `installDownlinkEvents — 安装下行连接的事件监听` | L50305-L50322 | .on()、.getCode()、.closeDownLinkConnection()、.emit() | installDownlinkEvents()、assignDescriptors()、objectMixin() | on('error')、on('connection-state-changed')、on('firewall-restriction')、emit('error')、emit('media-connection-state-changed')、emit('firewall-restriction') | — |
| `startSyncUserListInterval — 启动定时同步用户列表` | L50325-L50328 | .run()、.bind() | startSyncUserListInterval() | — | — |
| `stopSyncUserListInterval — 停止同步用户列表` | L50331-L50334 | .clearTask() | stopSyncUserListInterval() | — | — |
| `syncUserList — 向服务器同步当前房间用户列表` | L50337-L50348 | .getUserList()、.then()、.setUserList()、.catch()、.debug()、.concat() | syncUserList() | — | — |
| `getUserList — 获取房间内用户列表` | L50351-L50378 | .sendWaitForResponse()、.then()、.map()、.reject() | getUserList()、logConfig() | — | — |
| `getAllConnections — 获取所有 WebRTC 连接实例` | L50381-L50387 | .values()、.push() | getAllConnections() | — | — |
| `isRelayMaybeFailed — 检查中继连接是否可能失败` | L50390-L50400 | .getAllConnections()、.getReconnectionCount() | isRelayMaybeFailed() | — | — |
| `checkConnectionsToReconnect — 检查并触发需要重连的连接` | L50403-L50423 | .getPeerConnection()、.warn()、.startReconnection()、.getAllConnections()、.forEach()、.getIsReconnecting()、.concat()、.getUserId() | checkConnectionsToReconnect() | — | — |
| `fallbackToMPC — 从单连接模式降级到多连接模式` | L50426-L50485 | .warn()、.uploadEvent()、.close()、.reJoin()、.publish()、.values()、.installDownlinkEvents()、.set()、.subscribe() | new uJ()、new cJ()、fallbackToMPC()、asyncGeneratorWrap()、uJ()、cJ() | — | — |
| `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | L50488-L50506 | .info()、.close()、.destroy()、._joinReject()、.clearJoinTimeout()、.reset()、.removeAllListeners()、.clearTask() | new RtcErrorAlias()、destroy()、RtcErrorAlias()、logConfig() | — | — |
| `switchRole — 切换用户角色（anchor/audience），影响发布权限和远端可见性` | L50509-L50517 | .closeUplink()、.doSwitchRole() | switchRole()、asyncGeneratorWrap() | — | — |
| `doSwitchRole — 执行角色切换操作` | L50520-L50556 | .info()、.concat()、.stringify()、.sendWaitForResponseWithRetry()、.then()、.catch()、.getCode()、.error() | new RtcErrorAlias()、doSwitchRole()、RtcErrorAlias()、logConfig() | — | — |
| `_initUplinkConnection — 初始化上行推流连接` | L50559-L50585 | .on()、.emit()、.getCode()、.closeUplink() | new UplinkTransportAlias()、new uJ()、_initUplinkConnection()、UplinkTransportAlias()、uJ()、assignDescriptors()、objectMixin() | on('connection-state-changed')、on('firewall-restriction')、on('error')、emit('media-connection-state-changed')、emit('firewall-restriction')、emit('error') | — |
| `publish — 发布本地音视频流到房间` | L50588-L50608 | ._initUplinkConnection()、.concat()、.info()、.waitForPeerConnectionConnected()、.publish() | publish()、asyncGeneratorWrap()、yield() | — | — |
| `unpublish — 取消发布本地音视频流` | L50611-L50638 | .concat()、.info()、.unpublish()、.closeUplink() | unpublish()、asyncGeneratorWrap() | — | — |
| `addTrack — 添加媒体轨道到发布流` | L50641-L50648 | .resolve()、.addTrack()、.publish() | addTrack() | — | — |
| `removeTrack — 从发布流移除媒体轨道` | L50651-L50656 | .unpublish()、.removeTrack()、.resolve() | removeTrack() | — | — |
| `replaceTrack — 替换本地流中的指定轨道` | L50659-L50667 | .replaceTrack()、.then()、.emit()、.resolve() | replaceTrack()、hasReplaceTrack() | emit(Events.LOCAL_TRACK_REPLACED) | — |
| `setBandWidth — 设置推流带宽限制` | L50670-L50677 | .setBandwidth()、.sendMediaSettings() | setBandWidth()、asyncGeneratorWrap() | — | — |
| `enableSmall — 启用/禁用小流（Simulcast 分层编码）` | L50680-L50694 | .resolve()、.setBandWidth()、.enableSmall() | enableSmall()、asyncGeneratorWrap() | — | — |
| `subscribe — 订阅远端用户的音视频流` | L50697-L50769 | .filter()、.get()、.find()、.forEach()、.emit()、.info()、.concat()、.subscribe()、.waitHasMediaTrack()、.getCode()、.warn()、.error() | new Array()、new RtcErrorAlias()、subscribe()、Array()、asyncGeneratorWrap()、objectMixin()、getActiveKeys()、RtcErrorAlias()、logConfig() | emit(Events.SUBSCRIBE_START)、emit(Events.SUBSCRIBE_SUCCESS) | — |
| `unsubscribe — 取消订阅远端用户的音视频流` | L50772-L50799 | .get()、.find()、.info()、.concat()、.unsubscribe()、.warn()、.forEach()、.setMediaType()、.emit() | new Array()、unsubscribe()、Array()、asyncGeneratorWrap() | emit(Events.UNSUBSCRIBE_SUCCESS) | — |
| `setEncodedDataProcessingListener — 设置编码数据处理监听器` | L50802-L50805 | — | new Error()、setEncodedDataProcessingListener()、Error() | — | — |
| `enableAudioVolumeEvaluation — 开启/关闭音量回调通知（设置回调间隔，单位 ms）` | L50808-L50844 | .clearTask()、.floor()、.max()、.emit()、.run()、.stopUpdateAudioLevelFromSenderStat()、.updateAudioLevelFromSenderStat()、.forEach()、.updateDownlinkAudioLevelFromReceiver()、.getAudioLevel()、.push()、.getInternalAudioLevel() | enableAudioVolumeEvaluation() | emit(Events.AUDIO_LEVEL_INTERVAL)、emit('audio-volume') | — |
| `updateAudioLevelFromSenderStat — 从发送端统计更新音频电平` | L50847-L50887 | .getPeerConnection()、.getSenders()、.max()、.warn()、.concat()、.run()、.stopUpdateAudioLevelFromSenderStat()、.getStats()、.forEach() | updateAudioLevelFromSenderStat()、asyncGeneratorWrap() | — | — |
| `asyncGeneratorWrap — 方法` | L50870-L50883 | .stopUpdateAudioLevelFromSenderStat()、.getStats()、.forEach() | asyncGeneratorWrap() | — | — |
| `stopUpdateAudioLevelFromSenderStat — 停止从发送端更新音频电平` | L50890-L50901 | .warn()、.clearTask() | stopUpdateAudioLevelFromSenderStat() | — | — |
| `updateDownlinkAudioLevelFromReceiver — 从接收端更新下行音频电平` | L50904-L50921 | .getSynchronizationSources()、.min()、.getStats()、.then()、.forEach() | updateDownlinkAudioLevelFromReceiver()、isNumber() | — | — |
| `getLocalAudioStats — 获取本地音频统计信息（发送量、丢包等）` | L50924-L50940 | — | getLocalAudioStats()、asyncGeneratorWrap() | — | — |
| `getLocalVideoStats — 获取本地视频统计信息（帧率、码率、丢包等）` | L50943-L50966 | — | getLocalVideoStats()、asyncGeneratorWrap() | — | — |
| `getTransportStats — 获取传输层统计信息（RTT、连接类型等）` | L50969-L50990 | .getSenderStats()、.getReceiverStats() | getTransportStats()、asyncGeneratorWrap() | — | — |
| `getRemoteVideoStats — 获取远端视频统计信息` | L50993-L51005 | — | getRemoteVideoStats()、asyncGeneratorWrap() | — | — |
| `getRemoteAudioStats — 获取远端音频统计信息` | L51008-L51018 | — | getRemoteAudioStats()、asyncGeneratorWrap() | — | — |
| `setTurnServer — 设置 TURN 中继服务器地址` | L51021-L51031 | .info()、.concat()、.stringify()、.isArray()、.forEach()、.push()、.getTurnServer()、.isPlainObject() | setTurnServer() | — | — |
| `sendStartMixTranscode — 发送启动云端混流转码请求` | L51034-L51048 | .sendWaitForResponse()、.catch() | sendStartMixTranscode() | — | — |
| `sendStopMixTranscode — 发送停止云端混流转码请求` | L51051-L51065 | .sendWaitForResponse()、.catch() | sendStopMixTranscode() | — | — |
| `sendStartPublishCDN — 发送启动 CDN 推流请求` | L51068-L51085 | .sendWaitForResponse()、.catch() | sendStartPublishCDN() | — | — |
| `sendStopPublishCDN — 发送停止 CDN 推流请求` | L51088-L51105 | .sendWaitForResponse()、.catch() | sendStopPublishCDN() | — | — |
| `sendStartPushStreamToRoom — 发送启动跨房间推流请求` | L51108-L51122 | .sendWaitForResponse()、.catch() | sendStartPushStreamToRoom() | — | — |
| `sendUpdatePushStreamToRoom — 发送更新跨房间推流参数请求` | L51125-L51139 | .sendWaitForResponse()、.catch() | sendUpdatePushStreamToRoom() | — | — |
| `sendStopPushStreamToRoom — 发送停止跨房间推流请求` | L51142-L51156 | .sendWaitForResponse()、.catch() | sendStopPushStreamToRoom() | — | — |
| `sendAbilityStatus — 上报能力状态（编解码能力等）` | L51159-L51173 | .sendWaitForResponse()、.catch() | sendAbilityStatus() | — | — |
| `getIceServers — 获取 ICE 服务器列表（STUN/TURN）` | L51176-L51190 | — | getIceServers() | — | — |
| `getIceTransportPolicy — 获取 ICE 传输策略` | L51193-L51196 | — | getIceTransportPolicy() | — | — |
| `getLogger — 获取日志记录器实例` | L51199-L51202 | — | getLogger() | — | — |
| `enableAIVoice — 启用/禁用 AI 语音处理` | L51205-L51208 | — | new Error()、enableAIVoice()、Error() | — | — |
| `getSignalChannelUrl — 获取信令通道 URL` | L51211-L51231 | .getEnv()、.concat()、.isArray() | getSignalChannelUrl() | — | — |
| `getSignalInfo — 获取信令连接信息` | L51234-L51240 | .getSignalInfo() | getSignalInfo() | — | — |
| `reset — 重置房间状态（清理所有内部数据）` | L51243-L51263 | .stopSyncUserListInterval()、.stopHeartbeat()、.closeConnections()、.clearNetworkQuality()、.closeUplink()、.stopKeepAliveIn()、.close()、.setSignalChannel()、.reset()、.clear()、.removeAllListeners() | reset() | — | — |
| `checkSubscribeBigSmallVideo — 检查是否订阅大流/小流` | L51266-L51323 | .get()、.subscribe()、.setMediaType()、.info()、.concat()、.delete() | checkSubscribeBigSmallVideo()、asyncGeneratorWrap() | — | — |
| `changeType — 修改订阅流类型（大小流切换）` | L51326-L51336 | .set()、.info()、.concat()、.emit()、.get()、.checkSubscribeBigSmallVideo() | changeType() | emit('subscribe-small-video-changed') | — |
| `_initBusinessInfo — 初始化业务信息` | L51343-L51371 | .parse()、.isInteger()、.match()、.stringify() | new RtcErrorAlias()、_initBusinessInfo()、Eq()、Tq()、Number()、RtcErrorAlias()、logConfig()、String()、yq() | — | — |
| `sendCustomMessage — 向房间内其他用户发送自定义消息（二进制数据）` | L51374-L51379 | .send() | sendCustomMessage() | — | — |
| `enableInsertableStreams — 启用 Insertable Streams（SEI 功能依赖）` | L51382-L51393 | .waitForPeerConnectionConnected()、.startReconnection() | enableInsertableStreams()、asyncGeneratorWrap() | — | — |
| `sendSignalMessage — 发送信令消息到服务器` | L51396-L51406 | .sendWaitForResponseWithRetry()、.reject() | new RtcErrorAlias()、sendSignalMessage()、RtcErrorAlias() | — | — |
| `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | L51425-L51499 | .push()、.clear()、.set()、.then()、.emit()、.waitForPeerConnectionConnected()、.sendWaitForResponse()、.error()、.concat()、.resolveSwitchRoomSubedReq() | new Promise()、new RtcErrorAlias()、switchRoom()、asyncGeneratorWrap()、String()、generateUniqueId()、Promise()、delay()、RtcErrorAlias()、Tq() | emit(Events.SWITCH_ROOM_START)、emit(Events.SWITCH_ROOM_FAILED)、emit(Events.SWITCH_ROOM_SUCCESS) | — |
| `isSwitchRoomSupported — 检查是否支持切换房间功能` | L51502-L51521 | .warn()、.concat() | isSwitchRoomSupported()、Boolean() | — | — |
| `requestRemoteFallbackToH264 — 请求远端降级到 H264 编码` | L51524-L51529 | .requestRemoteFallbackToH264() | requestRemoteFallbackToH264() | — | — |
| `startUpdateNTPTime — 启动 NTP 时间同步` | L51532-L51563 | .push()、.updateNTPTime()、.all()、.then()、.forEach()、.min()、.max()、.floor()、.reduce()、.startUpdateNTPTime()、.postMessage()、.debug()、.concat()、.emit()、.catch()、.warn() | startUpdateNTPTime()、setTimeout()、setTimeOffset() | emit('ntp-time-updated') | Timers/scheduling |
| `updateNTPTime — 更新 NTP 时间` | L51566-L51588 | .now()、.sendWaitForResponse()、.then() | updateNTPTime()、String()、Number() | — | — |
| `onRetrying — 重连中回调` | L51600-L51603 | .warn()、.concat() | onRetrying() | — | — |
| `onRetryFailed — 重连失败回调` | L51606-L51609 | .error() | onRetryFailed() | — | — |
| `onError — 错误处理回调` | L51612-L51619 | .warn()、.reset()、.close() | onError()、setScheduleFlag()、t() | — | — |
| `success — 操作成功回调` | L51712-L51715 | .reset() | success() | — | — |
| `onError — 错误处理回调` | L51767-L51777 | .includes()、.warn()、.concat()、.error()、.emit() | onError()、t()、i() | emit(Events.PUBLISH_FAILED) | — |
| `cleanupAfterUnpublish — 取消发布后清理` | L51801-L51809 | .getPeerConnection()、.getSenders()、.forEach()、.replaceTrack() | cleanupAfterUnpublish()、hasGetSenders() | — | — |
| `extractKeyParam — 提取关键参数` | L51831-L51836 | — | new Array()、extractKeyParam()、Array() | — | — |
| `onError — 错误处理回调` | L51853-L51860 | .includes()、.warn()、.error()、.concat()、.emit() | onError()、t()、i() | emit(Events.SUBSCRIBE_FAILED) | — |
| `callback — 通用回调` | L51873-L51883 | .forEach()、.get()、.close() | new Array()、callback()、Array() | — | — |
| `extractKeyParam — 提取关键参数` | L51887-L51892 | — | new Array()、extractKeyParam()、Array() | — | — |
