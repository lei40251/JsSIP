import asyncio
import websockets
import json
import wave
import sys
from pathlib import Path
import numpy as np
from datetime import datetime

async def test_audio_stream(server_uri, session_id, pcm_file, sample_rate):
    """
    测试音频流WebSocket连接

    Args:
        server_uri: WebSocket服务器地址，例如 ws://serverip:8010/ws
        session_id: 从offer接口获取的会话ID
        pcm_file: PCM音频文件路径
        sample_rate: 音频采样率
    """
    try:
        # 连接WebSocket服务器
        async with websockets.connect(server_uri) as websocket:
            print(f"已连接到服务器: {server_uri}")

            # 发送登录命令
            login_cmd = {
                'cmd': 'login',
                'sessionid': session_id
            }
            await websocket.send(json.dumps(login_cmd))
            print(f"已发送登录命令: {login_cmd}")

            # 等待服务器响应
            response = await websocket.recv()
            print(f"服务器响应: {response}")

            # 发送设置PCM格式命令
            set_pcm_cmd = {
                'cmd': 'setpcm',
                'samplerate': sample_rate
            }
            await websocket.send(json.dumps(set_pcm_cmd))
            print(f"已发送设置PCM命令: {set_pcm_cmd}")

            # 等待服务器响应
            response = await websocket.recv()
            print(f"服务器响应: {response}")

            # 读取并发送PCM音频数据
            print(f"开始发送音频数据: {pcm_file}")
            with open(pcm_file, 'rb') as f:
                # 分块发送音频数据
                chunk_size = 1920 # 每次发送4KB数据
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break

                    await websocket.send(chunk)
                    # 获取当前时间，包含微秒
                    current_time = datetime.now()
                    # 格式化输出：年-月-日 时:分:秒.毫秒
                    formatted_time = current_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]  # 取前3位毫秒
                    print(f"[{formatted_time}]")
                    print(f"已发送 {len(chunk)} 字节音频数据")

                    # 添加短暂延迟，模拟实时流
                    await asyncio.sleep(0.06)

            print("音频数据发送完成")

            # 等待最终响应
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"最终服务器响应: {response}")
            except asyncio.TimeoutError:
                print("等待最终响应超时")

    except Exception as e:
        print(f"发生错误: {e}")


def generate_test_pcm(filename, duration=5, sample_rate=16000, channels=1):
    """
    生成测试用的PCM文件

    Args:
        filename: 输出文件名
        duration: 音频时长(秒)
        sample_rate: 采样率
        channels: 声道数
    """
    # 生成简单的正弦波作为测试音频
    t = np.linspace(0, duration, int(sample_rate * duration))
    # 生成440Hz的正弦波
    signal = np.sin(2 * np.pi * 440 * t) * 0.5
    # 转换为16位PCM
    signal = (signal * 32767).astype(np.int16)

    # 如果是多声道，复制数据
    if channels > 1:
        signal = np.repeat(signal[:, np.newaxis], channels, axis=1)

    # 保存为原始PCM文件
    with open(filename, 'wb') as f:
        f.write(signal.tobytes())

    print(f"已生成测试PCM文件: {filename}, 时长: {duration}秒, 采样率: {sample_rate}Hz, 声道数: {channels}")


def main():
    # 在这里直接设置参数值
    server_uri = "ws://dev.vsbc.com:9090/ws"  # 替换为实际的服务器地址
    session_id = 797264  # 替换为实际的session ID
    sample_rate = 16000  # 设置采样率

    # 使用现有PCM文件或生成测试文件
    pcm_file = "test.pcm"  # 可以替换为您的PCM文件路径

    # 如果文件不存在，生成测试文件
    if not Path(pcm_file).exists():
        print("生成测试PCM文件...")
        generate_test_pcm(pcm_file, sample_rate=sample_rate)

    # 运行测试
    asyncio.get_event_loop().run_until_complete(
        test_audio_stream(server_uri, session_id, pcm_file, sample_rate)
    )


if __name__ == "__main__":
    # 安装必要的库（如果尚未安装）
    # try:
    #     import websockets
    #     import numpy
    # except ImportError:
    #     print("正在安装所需库...")
    #     import subprocess
    #
    #     subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "numpy"])
    #     import websockets
    #     import numpy as np
    import librosa

    # signal, sr = librosa.load("123.mp3", sr=None)
    # print("采样率:", sr)

    main()
