```flow
st=>start: 开始
op=>operation: 初始化
cond=>condition: 初始化完成(是或否?)
sub1=>subroutine: 等待
io=>operation: 发起呼叫
e=>end: 结束框

st->op->cond
cond(yes)->io->e
cond(no)->sub1(right)->cond
```
