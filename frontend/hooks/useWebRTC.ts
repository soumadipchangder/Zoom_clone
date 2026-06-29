import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface WebRTCMessage {
  type: string;
  sender?: string;
  payload?: any;
}

export function useWebRTC(
  meetingId: string,
  clientId: string,
  localAudioStream: MediaStream | null,
  localVideoStream: MediaStream | null,
  localScreenStream: MediaStream | null,
  onPeerEvent?: (type: 'joined' | 'left', peerId: string) => void,
  onMessage?: (msg: WebRTCMessage) => void
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  // Track the first stream ID per peer so we can distinguish camera from screen share
  const peerFirstStreamIdRef = useRef<Record<string, string>>({});

  // ── Keep refs to current streams so WebSocket handler never sees stale closures ──
  const audioRef = useRef(localAudioStream);
  const videoRef = useRef(localVideoStream);
  const screenRef = useRef(localScreenStream);
  const onPeerEventRef = useRef(onPeerEvent);
  const onMessageRef = useRef(onMessage);

  useEffect(() => { audioRef.current = localAudioStream; }, [localAudioStream]);
  useEffect(() => { videoRef.current = localVideoStream; }, [localVideoStream]);
  useEffect(() => { screenRef.current = localScreenStream; }, [localScreenStream]);
  useEffect(() => { onPeerEventRef.current = onPeerEvent; }, [onPeerEvent]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  // Helper: get all current local tracks
  const getActiveStreamsAndTracks = useCallback(() => {
    const streams = [audioRef.current, videoRef.current, screenRef.current].filter(Boolean) as MediaStream[];
    const tracks = streams.flatMap(s => s.getTracks());
    return { streams, tracks };
  }, []);

  // ── Create a peer connection for a remote peer ──
  const createPeerConnection = useCallback((peerId: string) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          target: peerId,
          payload: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0];
      const streamId = remoteStream?.id || 'default';

      // First stream from a peer = camera/audio, subsequent streams = screen share
      if (!peerFirstStreamIdRef.current[peerId]) {
        peerFirstStreamIdRef.current[peerId] = streamId;
      }

      const isFirstStream = streamId === peerFirstStreamIdRef.current[peerId];
      const setter = isFirstStream ? setRemoteStreams : setRemoteScreenStreams;

      setter(prev => {
        const existing = prev[peerId];
        if (existing && existing.getTracks().find(t => t.id === event.track.id)) {
          return prev; // already added
        }
        const stream = existing ? new MediaStream(existing.getTracks()) : new MediaStream();
        stream.addTrack(event.track);
        return { ...prev, [peerId]: stream };
      });
    };

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({
          type: 'offer',
          target: peerId,
          payload: pc.localDescription
        }));
      } catch (e) {
        console.error('Negotiation error:', e);
      }
    };

    return pc;
  }, []);

  // Helper: add all current local tracks to a peer connection
  const addLocalTracksToPeer = useCallback((pc: RTCPeerConnection) => {
    const { streams, tracks } = getActiveStreamsAndTracks();
    const senders = pc.getSenders();
    tracks.forEach(track => {
      if (!senders.find(s => s.track?.id === track.id)) {
        const parentStream = streams.find(s => s.getTracks().includes(track));
        pc.addTrack(track, parentStream || new MediaStream([track]));
      }
    });
  }, [getActiveStreamsAndTracks]);

  // ── Sync local tracks with ALL existing peer connections when streams change ──
  useEffect(() => {
    const { streams, tracks: activeTracks } = getActiveStreamsAndTracks();

    Object.entries(peersRef.current).forEach(([, pc]) => {
      const senders = pc.getSenders();

      // Remove tracks that are no longer active
      senders.forEach(sender => {
        if (sender.track && !activeTracks.find(t => t.id === sender.track!.id)) {
          try { pc.removeTrack(sender); } catch (e) { /* connection may be closed */ }
        }
      });

      // Add new tracks
      activeTracks.forEach(track => {
        if (!senders.find(s => s.track?.id === track.id)) {
          const parentStream = streams.find(s => s.getTracks().includes(track));
          try {
            pc.addTrack(track, parentStream || new MediaStream([track]));
          } catch (e) { /* connection may be closed */ }
        }
      });
    });
  }, [localAudioStream, localVideoStream, localScreenStream, getActiveStreamsAndTracks]);

  // ── Send arbitrary message over WebSocket ──
  const sendMessage = useCallback((data: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ── WebSocket connection ──
  useEffect(() => {
    if (!meetingId || !clientId || clientId === 'local') return;

    // Derive WebSocket URL from NEXT_PUBLIC_WS_URL or NEXT_PUBLIC_API_URL
    const apiBase = process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
        .replace(/^https/, 'wss')
        .replace(/^http/, 'ws');
    const wsUrl = `${apiBase}/ws/meeting/${meetingId}/${clientId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebRTC] WebSocket connected as', clientId);
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'existing-peers') {
        // We just joined — initiate connections to everyone already in the room
        const peerIds: string[] = data.peerIds || [];
        console.log('[WebRTC] existing peers in room:', peerIds);
        for (const peerId of peerIds) {
          const pc = createPeerConnection(peerId);
          addLocalTracksToPeer(pc);
        }
        onPeerEventRef.current?.('joined', 'bulk');

      } else if (data.type === 'user-joined') {
        const peerId = data.clientId;
        console.log('[WebRTC] user-joined:', peerId);
        onPeerEventRef.current?.('joined', peerId);

        // As the existing peer, create a connection and initiate offer
        const pc = createPeerConnection(peerId);
        addLocalTracksToPeer(pc);

      } else if (data.type === 'user-left') {
        const peerId = data.clientId;
        console.log('[WebRTC] user-left:', peerId);
        onPeerEventRef.current?.('left', peerId);

        if (peersRef.current[peerId]) {
          peersRef.current[peerId].close();
          delete peersRef.current[peerId];
        }
        delete peerFirstStreamIdRef.current[peerId];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
        setRemoteScreenStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });

      } else if (data.type === 'offer') {
        const peerId = data.sender;
        console.log('[WebRTC] received offer from:', peerId);
        const pc = createPeerConnection(peerId);

        // Add our local tracks BEFORE answering so they're included in the SDP
        addLocalTracksToPeer(pc);

        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'answer',
            target: peerId,
            payload: pc.localDescription
          }));
        }

      } else if (data.type === 'answer') {
        const peerId = data.sender;
        const pc = peersRef.current[peerId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        }

      } else if (data.type === 'ice-candidate') {
        const peerId = data.sender;
        const pc = peersRef.current[peerId];
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.payload));
          } catch (e) {
            console.error('[WebRTC] ICE candidate error:', e);
          }
        }

      } else if (
        data.type === 'chat-message' ||
        data.type === 'media-state' ||
        data.type === 'force-mute' ||
        data.type === 'screen-share-started' ||
        data.type === 'screen-share-stopped'
      ) {
        // Forward application-level messages to the parent component
        onMessageRef.current?.(data);
      }
    };

    ws.onerror = (e) => {
      console.error('[WebRTC] WebSocket error:', e);
    };

    return () => {
      ws.close();
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      peerFirstStreamIdRef.current = {};
      setRemoteStreams({});
      setRemoteScreenStreams({});
    };
  }, [meetingId, clientId, createPeerConnection, addLocalTracksToPeer]);

  return { remoteStreams, remoteScreenStreams, sendMessage };
}
