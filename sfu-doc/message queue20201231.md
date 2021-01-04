# 消息队列说明

## 原理与方法

1. UA SDK 或客户的服务端均为订阅者，向消息队列起一个 websocket 连接，用于订阅消息
2. UA 同时作为发布者，发送本端消息给其他订阅者
3. UA 拿到消息后，做对应过滤，过滤出本端的消息做对应事件处理

### 加会

```
// 客户端的消息
// 队列id应对应会议id
// 多个队列，按groupid分组
{
    type: join,
    body: {
        // description :用户id(实际是login_id)
        // length(max):64Byte
        // rule :包含数字和字母，a-z字母大写，不包括加减号、不带人名
        // create ：UA
        "uid": uid,

        // description :用户姓名
        // length:，64byte/32个汉字
        // rule :加密，base64或自编码
        // create ：UA
        "dn": dn,

        // description :会话id
        // length :，16(定值，每次生成都是唯一)
        // rule :包含数字和字母，a-z字母大写，不包括加减号
        // create ：UA
        "sid": sid,

        // description :Sip呼叫的Callid：
        // length :max=32Byte h5=20Byte，其他四个端=10Byte;
        // rule :包含数字和字母，a-z字母大写，不包括加减号
        // create ：1.UA生成 or 2.SFU下发
        "callid": callid,

        // description:本次会议的唯一标识,根据confid找到roomid；
        // length :16Byte(定值)
        // rule :规则：包含数字和字母，a-z字母大写，不包括减号）
        // create ：SFU （X-SFU-confid  在200ok的消息头取值）
        "confid": confid,

        // description:：会议(纯数字)
        // length:号6-12Byte
        // rules:100000-999999999999
        // create ：SFU
        "roomid": roomid,

        // description:时间戳,
        // rules:统一成到毫秒，
        // create:获取服务器时间（服务器心跳或者接口）
        "ts": ts,

        // description:设备
        // create: ua
        "device": device,

        // description:版本
        // create: ua
         "version": version,
    },
    //序号,暂时各自自定
    seq: seq,
}
```

### 离会

```
{
    type: leave,
    body: {
        // description :用户id(实际是login_id)
        // length(max):64Byte
        // rule :包含数字和字母，a-z字母大写，不包括加减号、不带人名
        // create ：UA
        "uid": uid,

        // description :用户姓名
        // length:64byte/32个汉字
        // rule :加密，base64或自编码
        // create ：UA
        "dn": dn,

        // description :会话id
        // length :，16(定值，每次生成都是唯一)
        // rule :包含数字和字母，a-z字母大写，不包括加减号
        // create ：UA
        "sid": sid,

        // description :Sip呼叫的Callid：
        // length :max=32Byte h5=20Byte，其他四个端=10Byte;
        // rule :包含数字和字母，a-z字母大写，不包括加减号
        // create ：1.UA生成 or 2.SFU下发
        "callid": callid,

        // description:本次会议的唯一标识,根据confid找到roomid；
        // length :16Byte(定值)
        // rule :规则：包含数字和字母，a-z字母大写，不包括减号）
        // create ：SFU （X-SFU-confid  在200ok的消息头取值）
        "confid": confid,

        // description:：会议(纯数字)
        // length:号6-12Byte
        // rules:100000-999999999999
        // create ：SFU
        "roomid": roomid,


        // description:时间戳,
        // rules:统一成到毫秒，
        // create:获取服务器时间（服务器心跳或者接口）
        "ts": ts,

        // description:设备
        // create: ua
        "device": device,

        // description:版本
        // create: ua
         "version": version,
    },
    // 序号,暂时各自自定
    seq: seq,
}
```

## 订阅者订阅消息的 step

### 常规流程

1. 先用业务类型 sid 拿有多少场会 gid
2. 每场会 gid 对应的消息队列有多少 cid
3. 鉴权---针对业务类型 serversid 鉴权或综合 servicesid--groupid--channelid 进行鉴权
4. 开始订阅

### 简化流程

1. 通过 cid 获取，前期不鉴权

## UI 呈现

- 各端消息来了在顶部显示一秒，内容：人名\*进会/离会
  - 张三已加入会议
  - 张三已离开会议
