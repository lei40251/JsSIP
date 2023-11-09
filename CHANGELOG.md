CHANGELOG
=========
### 1.10.0
* 修复ice状态异常重新协商bug
* 优化SDK内部发送和接收SDP内容
* 修复统计信息显示里面的 mic 数量
* 恢复媒体轨道保持原来的muted状态
* 修复摄像头失效重新获取逻辑问题，修复媒体不通情况下的统计数据0改为null
### 1.9.12
* 如果使用sdk获取媒体流会启用适配iOS15.1&15.2的canvas
* 发起呼叫媒体不通 iceConnectionState == 'failed'后自动挂断通话并报媒体超时，如果已经正常通话过程中异常则自动重新协商
* 新增 peerconnection:iceConnectionState 事件，详见API文档 session 事件
* 日志:减少初始记录媒体属性为开始的一次，实时获取改为定时记录并间隔记录全量report日志
### 1.9.11
* 优化合并部分冗余日志
### 1.9.10
* session.mute() & session.unmute() 两个方法去掉判断当前状态，改为直接执行设置
### 1.9.9
* getStreams 新增响应参数 mediaStream，包含远端媒体音频及视频
* 新增通话结束自动释放媒体统计报告定时器
* 日志记录优化
### 1.9.8
* 新增ua.start()调用后5秒信令连接未建立事件
### 1.9.7
* videoTrackState 因为muted属性变化的触发条件，改为muted变化或者muted == true
* 日志记录优化
### 1.9.6
* 修复单向被叫bug
* 增加通话中的网络状态统计事件 network-quality, 调整了原来通话状态统计 report事件返回参数
* 增加通话前网络检测示例
* 增加了通话开始5秒左右输出一次完整getStats Report
### 1.9.5
* 修复增加mid造成被叫无SDP问题.
### 1.9.4
* 解决部分手机呼叫无法接通提示488问题.
* SDK demo 增加turn配置，解决488问题手机偶现媒体不通问题.

