var sdp = `v=0
o=- 4303926183234366667 2 IN IP4 127.0.0.1
s=-
t=0 0
a=msid-semantic: WMS wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm
m=audio 63406 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 192.168.3.13
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:1981808687 1 udp 2122260223 192.168.3.13 63406 typ host generation 0 network-id 1
a=ice-ufrag:76N5
a=ice-pwd:EH79WZh28N/zDWq5W2Hvbz6f
a=ice-options:trickle
a=fingerprint:sha-256 02:94:59:8D:01:D6:20:7B:27:FC:17:95:1A:23:97:1C:C1:86:7D:51:E3:C4:6C:70:E5:04:C2:B6:4F:2C:C4:52
a=setup:actpass
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendrecv
a=msid:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm 3437f91f-d1c0-4cd5-9bdb-982035efa13b
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
a=rtpmap:126 telephone-event/8000
a=ssrc:2656864988 cname:J4FunGuN6zgT26ip
a=ssrc:2656864988 msid:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm 3437f91f-d1c0-4cd5-9bdb-982035efa13b
a=ssrc:2656864988 mslabel:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm
a=ssrc:2656864988 label:3437f91f-d1c0-4cd5-9bdb-982035efa13b
m=video 63407 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 121 127 120 125 107 108 109 124 119 123 118 114 115 116
c=IN IP4 192.168.3.13
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:1981808687 1 udp 2122260223 192.168.3.13 63407 typ host generation 0 network-id 1
a=ice-ufrag:76N5
a=ice-pwd:EH79WZh28N/zDWq5W2Hvbz6f
a=ice-options:trickle
a=fingerprint:sha-256 02:94:59:8D:01:D6:20:7B:27:FC:17:95:1A:23:97:1C:C1:86:7D:51:E3:C4:6C:70:E5:04:C2:B6:4F:2C:C4:52
a=setup:actpass
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:13 urn:3gpp:video-orientation
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:11 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=sendrecv
a=msid:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm 1896ede1-248d-45d7-8dc1-4a3119ede64d
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 profile-id=0
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:100 VP9/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 profile-id=2
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:102 H264/90000
a=rtcp-fb:102 goog-remb
a=rtcp-fb:102 transport-cc
a=rtcp-fb:102 ccm fir
a=rtcp-fb:102 nack
a=rtcp-fb:102 nack pli
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f
a=rtpmap:121 rtx/90000
a=fmtp:121 apt=102
a=rtpmap:127 H264/90000
a=rtcp-fb:127 goog-remb
a=rtcp-fb:127 transport-cc
a=rtcp-fb:127 ccm fir
a=rtcp-fb:127 nack
a=rtcp-fb:127 nack pli
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f
a=rtpmap:120 rtx/90000
a=fmtp:120 apt=127
a=rtpmap:125 H264/90000
a=rtcp-fb:125 goog-remb
a=rtcp-fb:125 transport-cc
a=rtcp-fb:125 ccm fir
a=rtcp-fb:125 nack
a=rtcp-fb:125 nack pli
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:107 rtx/90000
a=fmtp:107 apt=125
a=rtpmap:108 H264/90000
a=rtcp-fb:108 goog-remb
a=rtcp-fb:108 transport-cc
a=rtcp-fb:108 ccm fir
a=rtcp-fb:108 nack
a=rtcp-fb:108 nack pli
a=fmtp:108 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f
a=rtpmap:109 rtx/90000
a=fmtp:109 apt=108
a=rtpmap:124 H264/90000
a=rtcp-fb:124 goog-remb
a=rtcp-fb:124 transport-cc
a=rtcp-fb:124 ccm fir
a=rtcp-fb:124 nack
a=rtcp-fb:124 nack pli
a=fmtp:124 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001f
a=rtpmap:119 rtx/90000
a=fmtp:119 apt=124
a=rtpmap:123 H264/90000
a=rtcp-fb:123 goog-remb
a=rtcp-fb:123 transport-cc
a=rtcp-fb:123 ccm fir
a=rtcp-fb:123 nack
a=rtcp-fb:123 nack pli
a=fmtp:123 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f
a=rtpmap:118 rtx/90000
a=fmtp:118 apt=123
a=rtpmap:114 red/90000
a=rtpmap:115 rtx/90000
a=fmtp:115 apt=114
a=rtpmap:116 ulpfec/90000
a=ssrc-group:FID 416153667 3811291749
a=ssrc:416153667 cname:J4FunGuN6zgT26ip
a=ssrc:416153667 msid:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm 1896ede1-248d-45d7-8dc1-4a3119ede64d
a=ssrc:416153667 mslabel:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm
a=ssrc:416153667 label:1896ede1-248d-45d7-8dc1-4a3119ede64d
a=ssrc:3811291749 cname:J4FunGuN6zgT26ip
a=ssrc:3811291749 msid:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm 1896ede1-248d-45d7-8dc1-4a3119ede64d
a=ssrc:3811291749 mslabel:wUGr0VIP5XcTt1vUh4IB78YFTWcYCOH3m6tm
a=ssrc:3811291749 label:1896ede1-248d-45d7-8dc1-4a3119ede64d`;
