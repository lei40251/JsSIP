CHANGELOG
=========
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

