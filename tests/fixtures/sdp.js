// WebRTC data-channel session descriptions used as test fixtures. Public addresses are
// replaced with documentation ranges (RFC 5737 / RFC 3849).

/** Headless Chrome 154 offer: mDNS host + srflx candidate. */
export const CHROME_OFFER = `v=0
o=- 5749566446426812621 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=extmap-allow-mixed
a=msid-semantic: WMS
m=application 55282 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 203.0.113.7
a=candidate:4095599133 1 udp 2113937151 66b0c1bb-8427-4bb0-9b21-09cddf5e0ff8.local 55282 typ host generation 0 network-cost 999
a=candidate:2930694866 1 udp 1677729535 203.0.113.7 55282 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999
a=ice-ufrag:eT2+
a=ice-pwd:9BjEO6zwrgKZ5M0WiuTmhupG
a=ice-options:trickle
a=fingerprint:sha-256 CA:83:87:5A:57:CA:A6:55:C9:1F:0F:D7:A5:E1:4E:D4:6B:12:A1:98:DD:B0:C5:E6:7B:95:4E:35:39:63:AF:CC
a=setup:actpass
a=mid:0
a=sctp-port:5000
a=max-message-size:262144
`;

/** Headless Chrome 154 answer to {@link CHROME_OFFER}: mDNS host candidate only. */
export const CHROME_ANSWER = `v=0
o=- 2545266263692165634 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=extmap-allow-mixed
a=msid-semantic: WMS
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=candidate:1055748078 1 udp 2113937151 66b0c1bb-8427-4bb0-9b21-09cddf5e0ff8.local 33178 typ host generation 0 network-cost 999
a=ice-ufrag:M5V4
a=ice-pwd:dcKWrxUtFezMhU0Brf6Y0IfP
a=ice-options:trickle
a=fingerprint:sha-256 6F:C0:69:FF:92:0E:44:03:1C:82:AE:1D:51:35:50:D5:E4:9C:5F:3F:05:26:4C:8E:45:16:FF:F3:EC:D4:94:ED
a=setup:active
a=mid:0
a=sctp-port:5000
a=max-message-size:262144
`;

/** Firefox-style offer (modelled on Firefox's format): UDP + TCP host, srflx, end-of-candidates. */
export const FIREFOX_OFFER = `v=0
o=mozilla...THIS_IS_SDPARTA-99.0 4730541338235934781 0 IN IP4 0.0.0.0
s=-
t=0 0
a=fingerprint:sha-256 3B:5A:0E:7C:91:44:D2:6F:18:AB:C0:39:7E:52:EE:10:84:6D:F2:A7:33:9B:05:C8:1E:62:D4:7F:A0:58:19:BC
a=group:BUNDLE 0
a=ice-options:trickle
a=msid-semantic:WMS *
m=application 61234 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 198.51.100.23
a=candidate:0 1 UDP 2122252543 2d9b0e4c-6f1a-4b8e-9c3d-5a7e8f0b1c2d.local 52113 typ host
a=candidate:2 1 TCP 2105524479 2d9b0e4c-6f1a-4b8e-9c3d-5a7e8f0b1c2d.local 9 typ host tcptype active
a=candidate:1 1 UDP 1686052863 198.51.100.23 61234 typ srflx raddr 0.0.0.0 rport 0
a=sendrecv
a=end-of-candidates
a=ice-pwd:0f3e9c2b7a6d5e4f1a2b3c4d5e6f7a8b
a=ice-ufrag:9a8b7c6d
a=mid:0
a=setup:actpass
a=sctp-port:5000
a=max-message-size:1073741823
`;

/** Safari-style answer (libwebrtc format) without mDNS: IPv4 + IPv6 host, TCP host, srflx. */
export const SAFARI_ANSWER = `v=0
o=- 8126549302145587342 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=candidate:842163049 1 udp 2122260223 192.168.1.34 49731 typ host generation 0 network-id 1 network-cost 10
a=candidate:2999745851 1 udp 2122194687 2001:db8::5c1e:a2ff:fe11:7b3c 50112 typ host generation 0 network-id 2 network-cost 10
a=candidate:1510613869 1 tcp 1518280447 192.168.1.34 9 typ host tcptype active generation 0 network-id 1 network-cost 10
a=candidate:4233069003 1 udp 1686052607 203.0.113.99 49731 typ srflx raddr 192.168.1.34 rport 49731 generation 0 network-id 1 network-cost 10
a=ice-ufrag:Xq7/
a=ice-pwd:lK3p+9sQa1ZcV0bN4mR8tY2w
a=ice-options:trickle
a=fingerprint:sha-256 0D:9E:61:F4:2B:A8:57:C3:1E:7A:90:B6:4F:22:D1:8C:35:E9:06:7B:AC:13:F8:52:6D:C4:90:2E:7F:31:A5:B8
a=setup:active
a=mid:0
a=sctp-port:5000
a=max-message-size:262144
`;
