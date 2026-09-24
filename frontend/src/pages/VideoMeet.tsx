import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, Menu, MenuItem, Snackbar, Alert, Tooltip, Drawer, CircularProgress } from '@mui/material';
import { Button } from '@mui/material';
import Logo from '../components/Logo';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import PeopleIcon from '@mui/icons-material/People';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import PanToolIcon from '@mui/icons-material/PanTool';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import BlurOffIcon from '@mui/icons-material/BlurOff';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import BrushIcon from '@mui/icons-material/Brush';
import PollIcon from '@mui/icons-material/Poll';
import PushPinIcon from '@mui/icons-material/PushPin';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CropFreeIcon from '@mui/icons-material/CropFree';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import server from '../environment';
import SfuClient from '../utils/sfuClient';
import type { ActiveSpeakerData, NetworkQuality, WhiteboardAction, Poll } from '../types';

const server_url = server;

// Calls are relayed through a mediasoup SFU (Selective Forwarding Unit) on
// the backend instead of the old peer-to-peer mesh (every browser opening a
// direct RTCPeerConnection to every other browser). Each participant now
// opens exactly two WebRTC connections to the server - one to send their
// own mic/cam/screen, one to receive everyone else's - and the server fans
// each stream out to the rest of the room. See src/utils/sfuClient.js for
// the client-side wrapper around mediasoup-client, and
// backend/src/controllers/socketManager.js + backend/src/sfu/ for the
// matching server side. This scales far better than mesh (mesh cost grows
// O(n^2) with participants; SFU cost per participant is flat) and is what
// makes group calls beyond ~4-5 people actually usable.

// TURN server support (6.2 Scalability - TURN server for restrictive
// NATs/firewalls), used as a client-side ICE relay fallback. mediasoup's
// server-side transports are ICE-Lite and don't need STUN, but a
// participant behind a very restrictive NAT/firewall may still need a TURN
// relay to reach the server at all. Configure via REACT_APP_TURN_* env vars
// (see frontend/.env.example); safely falls back to none if not configured.
const buildTurnServers = () => {
    const turnUrl = process.env.REACT_APP_TURN_URL;
    if (!turnUrl) return [];
    return [
        {
            urls: turnUrl,
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_CREDENTIAL,
        },
    ];
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏", "🎉", "😮"];

export default function VideoMeetComponent() {

    var socketRef = useRef<any>(null);
    let socketIdRef = useRef<any>(null);

    let localVideoref = useRef<any>(null);
    let rawVideoRef = useRef<any>(null);

    let [videoAvailable, setVideoAvailable] = useState<any>(true);
    let [audioAvailable, setAudioAvailable] = useState<any>(true);
    let [video, setVideo] = useState<any>(true);
    let [audio, setAudio] = useState<any>(true);
    let [screen, setScreen] = useState<any>(false);
    let [showModal, setModal] = useState<boolean>(false);
    let [screenAvailable, setScreenAvailable] = useState<any>(false);
    let [messages, setMessages] = useState<any[]>([]);
    let [message, setMessage] = useState<string>("");
    let [newMessages, setNewMessages] = useState<number>(0);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [copiedLink, setCopiedLink] = useState<boolean>(false);
    let [askForUsername, setAskForUsername] = useState<boolean>(true);
    let [username, setUsername] = useState<string>("");
    let [videos, setVideos] = useState<any[]>([]);

    let sfuClientRef = useRef<any>(null);
    let remoteCameraStreamsRef = useRef<any>({});

    let [isHost, setIsHost] = useState<boolean>(false);
    let [participantsList, setParticipantsList] = useState<any[]>([]);
    let [showParticipants, setShowParticipants] = useState<boolean>(false);

    let [isWaitingForApproval, setIsWaitingForApproval] = useState<boolean>(false);
    let [joinDenied, setJoinDenied] = useState<boolean>(false);
    let [waitingList, setWaitingList] = useState<any[]>([]);
    let [waitingRoomEnabled, setWaitingRoomEnabled] = useState<boolean>(false);
    let [roomLocked, setRoomLocked] = useState<boolean>(false);
    let [roomLockedOnEntry, setRoomLockedOnEntry] = useState<boolean>(false);

    let [raisedHands, setRaisedHands] = useState<any>({});
    let [handRaisedSelf, setHandRaisedSelf] = useState<boolean>(false);

    let [reactions, setReactions] = useState<any[]>([]);
    let [reactionAnchorEl, setReactionAnchorEl] = useState<any>(null);
    let [hostMenuAnchorEl, setHostMenuAnchorEl] = useState<any>(null);

    let [isRecording, setIsRecording] = useState<boolean>(false);
    let mediaRecorderRef = useRef<any>(null);
    let recordedChunksRef = useRef<any[]>([]);

    let [blurEnabled, setBlurEnabled] = useState<boolean>(false);
    let [blurLoading, setBlurLoading] = useState<boolean>(false);
    let selfieSegRef = useRef<any>(null);
    let blurCanvasRef = useRef<any>(null);
    let blurRunningRef = useRef<boolean>(false);

    // Active Speaker & Spotlight
    let [activeSpeakerSocketId, setActiveSpeakerSocketId] = useState<string | null>(null);
    let [spotlightEnabled, setSpotlightEnabled] = useState<boolean>(false);
    let [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);

    // Network Diagnostics
    let [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null);

    // Collaborative Whiteboard
    let [showWhiteboard, setShowWhiteboard] = useState<boolean>(false);
    let [wbColor, setWbColor] = useState<string>("#000000");
    let [wbWidth, setWbWidth] = useState<number>(3);
    let [wbTool, setWbTool] = useState<"pen" | "eraser">("pen");
    const wbCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef<boolean>(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    // In-Call Live Polls
    let [showPolls, setShowPolls] = useState<boolean>(false);
    let [pollsList, setPollsList] = useState<Poll[]>([]);
    let [pollQuestion, setPollQuestion] = useState<string>("");
    let [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

    let [snack, setSnack] = useState<any>({ open: false, message: "", severity: "info" });
    const showSnack = (message: string, severity: any = "info") => setSnack({ open: true, message, severity });

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        console.log("HELLO")
        getPermissions();

    })

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => {
                        console.log(e)
                        showSnack("Could not start screen sharing.", "warning");
                        setScreen(false);
                    })
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
            // User-facing feedback instead of a silent console.log (6.4 -
            // fix known bugs / surface errors instead of swallowing them).
            showSnack("Camera/microphone access was blocked. Please allow permissions and refresh.", "error");
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);

        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video, audio])
    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();

    }




    // Publishes (or updates, via replaceTrack) our outgoing mic/webcam
    // producers on the SFU. Safe to call before the socket/SfuClient is
    // ready (e.g. camera permission resolves before the socket connects) -
    // it just no-ops and connectToSocketServer() publishes window.localStream
    // itself once it's ready, covering the reverse ordering.
    const publishLocalTracks = (stream) => {
        if (!sfuClientRef.current) return;
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        if (videoTrack) sfuClientRef.current.produce('webcam', videoTrack).catch((e) => console.log("produce webcam failed:", e));
        if (audioTrack) sfuClientRef.current.produce('mic', audioTrack).catch((e) => console.log("produce mic failed:", e));
    };

    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream
        if (rawVideoRef.current) rawVideoRef.current.srcObject = stream;
        if (blurEnabled) {
            // Camera track changed underneath an active blur - re-apply it
            // onto the new stream rather than leaving blur silently disabled.
            enableBlur().catch(() => { });
        } else {
            publishLocalTracks(stream);
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream
            publishLocalTracks(window.localStream)
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => {
                    console.log(e)
                    showSnack("Could not access camera/microphone.", "error");
                })
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
            // Both camera and mic are off - stop publishing to the SFU too,
            // instead of leaving stale producers sending nothing useful.
            if (sfuClientRef.current) {
                sfuClientRef.current.closeProducer('webcam').catch(() => { });
                sfuClientRef.current.closeProducer('mic').catch(() => { });
            }
        }
    }





    let getDislayMediaSuccess = (stream) => {
        // Screen share replaces the outgoing *video* only (matches the
        // original single-video-tile-per-participant behaviour: viewers see
        // your screen instead of your camera while sharing). Your mic audio
        // producer is left untouched, so your voice keeps coming through
        // instead of silently dropping out during the share.
        try {
            window.localStream?.getVideoTracks().forEach((t) => t.stop())
        } catch (e) { console.log(e) }

        const micTrack = window.localStream?.getAudioTracks()[0];
        const screenVideoTrack = stream.getVideoTracks()[0];
        const combined = micTrack ? new MediaStream([screenVideoTrack, micTrack]) : new MediaStream([screenVideoTrack]);

        window.localStream = combined
        localVideoref.current.srcObject = combined

        if (sfuClientRef.current && screenVideoTrack) {
            sfuClientRef.current.produce('webcam', screenVideoTrack).catch((e) => console.log("produce screen failed:", e));
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()

        })
    }

    // Adds (or updates, if a tile for this socket+kind already exists) a
    // consumed remote track into the `videos` list that gets rendered.
    // 'webcam'/'mic' producers land on one combined per-participant
    // MediaStream (one video tile shows both); 'screen' producers get their
    // own separate tile.
    const addOrUpdateRemoteTrack = ({ track, socketId, appData }) => {
        if (!track || socketId === socketIdRef.current) return;
        const isScreen = appData?.source === 'screen' || appData?.source === 'screen-audio';
        const kind = isScreen ? 'screen' : 'camera';

        if (isScreen) {
            setVideos((prev) => {
                const idx = prev.findIndex((v) => v.socketId === socketId && v.kind === 'screen');
                const stream = idx !== -1 ? prev[idx].stream : new MediaStream();
                stream.getTracks().filter((t) => t.kind === track.kind).forEach((t) => stream.removeTrack(t));
                stream.addTrack(track);

                if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], stream };
                    return next;
                }
                return [...prev, { socketId, kind, stream }];
            });
            return;
        }

        let stream = remoteCameraStreamsRef.current[socketId];
        if (!stream) {
            stream = new MediaStream();
            remoteCameraStreamsRef.current[socketId] = stream;
        }
        stream.getTracks().filter((t) => t.kind === track.kind).forEach((t) => stream.removeTrack(t));
        stream.addTrack(track);

        setVideos((prev) => {
            const idx = prev.findIndex((v) => v.socketId === socketId && v.kind === 'camera');
            if (idx !== -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], stream };
                return next;
            }
            return [...prev, { socketId, kind, stream }];
        });
    };

    // Called when the server tells us a producer we were consuming has
    // closed (camera/mic/screen turned off, or the participant left).
    const removeRemoteTrack = ({ socketId, kind, appData }) => {
        const isScreen = appData?.source === 'screen' || appData?.source === 'screen-audio';
        if (isScreen) {
            setVideos((prev) => prev.filter((v) => !(v.socketId === socketId && v.kind === 'screen')));
            return;
        }

        const stream = remoteCameraStreamsRef.current[socketId];
        if (stream) {
            stream.getTracks().filter((t) => t.kind === kind).forEach((t) => stream.removeTrack(t));
            if (stream.getTracks().length === 0) {
                delete remoteCameraStreamsRef.current[socketId];
                setVideos((prev) => prev.filter((v) => !(v.socketId === socketId && v.kind === 'camera')));
            }
        }
    };

    let connectToSocketServer = () => {
        socketRef.current = (io as any)(server_url, { secure: false });

        socketRef.current.on('connect', async () => {
            socketRef.current.emit('join-call', window.location.href, username)
            socketIdRef.current = socketRef.current.id

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('user-left', (id) => {
                delete remoteCameraStreamsRef.current[id];
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            // ---------- Mediasoup SFU wiring ----------

            sfuClientRef.current = new SfuClient(socketRef.current, buildTurnServers());

            const consumeAndRender = async (producerInfo) => {
                // get-producers is called both on join and again on every
                // 'peer-joined' as a catch-all safety net, so the same
                // producer can legitimately be offered to us twice - skip
                // ones we're already consuming instead of double-consuming
                // (which would otherwise show up as doubled/echoing audio).
                if (sfuClientRef.current?.isConsuming(producerInfo.producerId)) return;
                try {
                    const result = await sfuClientRef.current.consume(producerInfo);
                    if (result) addOrUpdateRemoteTrack(result);
                } catch (e) {
                    console.log("Failed to consume remote producer:", e);
                }
            };

            try {
                await sfuClientRef.current.load();

                // If getUserMedia already resolved before the socket
                // finished connecting, publish it now (the reverse
                // ordering is handled by publishLocalTracks() being called
                // directly from getUserMediaSuccess).
                if (window.localStream) publishLocalTracks(window.localStream);

                // Pick up anyone already in the room when we joined.
                const existing = await sfuClientRef.current.getExistingProducers();
                existing.forEach(consumeAndRender);
            } catch (e) {
                console.log("Could not set up the SFU connection:", e);
                showSnack("Could not set up the call connection. Try refreshing.", "error");
            }

            socketRef.current.on('new-producer', consumeAndRender);

            socketRef.current.on('producer-closed', ({ producerId, socketId }) => {
                const info = sfuClientRef.current?.closeConsumerByProducerId(producerId);
                if (info) removeRemoteTrack({ socketId, kind: info.kind, appData: info.appData });
            });

            socketRef.current.on('peer-joined', async () => {
                // A new participant may start producing shortly after
                // joining - re-check for anything new to consume.
                try {
                    const existing = await sfuClientRef.current.getExistingProducers();
                    existing.forEach(consumeAndRender);
                } catch (e) { console.log(e); }
            });

            // ---------- New event listeners (6.2 / 6.3) ----------

            socketRef.current.on('participants-update', (list) => {
                setParticipantsList(list);
                const me = list.find((p) => p.socketId === socketIdRef.current);
                if (me) setIsHost(me.isHost);
            })

            socketRef.current.on('promoted-to-host', () => {
                setIsHost(true);
                showSnack("The previous host left - you are now the host.", "info");
            })

            socketRef.current.on('waiting-room', () => {
                setIsWaitingForApproval(true);
            })

            socketRef.current.on('admitted', () => {
                setIsWaitingForApproval(false);
                showSnack("You've been admitted to the meeting.", "success");
            })

            socketRef.current.on('denied', () => {
                setJoinDenied(true);
                setIsWaitingForApproval(false);
            })

            socketRef.current.on('room-locked', () => {
                setRoomLockedOnEntry(true);
            })

            socketRef.current.on('room-lock-state', (locked) => {
                setRoomLocked(locked);
            })

            socketRef.current.on('waiting-room-update', (list) => {
                setWaitingList(list);
            })

            socketRef.current.on('force-mute', () => {
                setAudio(false);
                showSnack("The host muted your microphone.", "info");
            })

            socketRef.current.on('removed-by-host', () => {
                showSnack("You were removed from the meeting by the host.", "warning");
                setTimeout(() => { window.location.href = "/home" }, 1500);
            })

            socketRef.current.on('reaction', ({ emoji, socketId, name }) => {
                const reactionId = `${socketId}-${Date.now()}-${Math.random()}`;
                setReactions((prev) => [...prev, { id: reactionId, emoji, name }]);
                setTimeout(() => {
                    setReactions((prev) => prev.filter((r) => r.id !== reactionId));
                }, 3000);
            })

            socketRef.current.on('hand-raised', ({ socketId, raised }) => {
                setRaisedHands((prev) => ({ ...prev, [socketId]: raised }));
            })

            socketRef.current.on('active-speaker', (data: ActiveSpeakerData) => {
                setActiveSpeakerSocketId(data.socketId);
            })

            socketRef.current.on('wb-draw', (action: WhiteboardAction) => {
                drawActionOnCanvas(action);
            })

            socketRef.current.on('wb-clear', () => {
                const canvas = wbCanvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext("2d");
                    ctx?.clearRect(0, 0, canvas.width, canvas.height);
                }
            })

            socketRef.current.on('new-poll', (poll: Poll) => {
                setPollsList((prev) => [...prev.filter((p) => p.id !== poll.id), poll]);
                showSnack(`New poll: "${poll.question}"`, "info");
            })

            socketRef.current.on('poll-updated', (poll: Poll) => {
                setPollsList((prev) => prev.map((p) => (p.id === poll.id ? poll : p)));
            })

            socketRef.current.emit('get-polls', {}, (res: any) => {
                if (res?.polls) setPollsList(res.polls);
            })
        })
    }

    let silence = () => {
        let AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        let ctx = new AudioContextClass();
        let oscillator = ctx.createOscillator();
        let dst = ctx.createMediaStreamDestination();
        oscillator.connect(dst);
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d')?.fillRect(0, 0, width, height);
        let stream = (canvas as any).captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    };

    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        stopRecording();
        try { sfuClientRef.current?.close(); } catch (e) { }
        try { socketRef.current?.disconnect(); } catch (e) { }
        window.location.href = "/"
    }

    const addMessage = (data, sender, socketIdSender) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data, socketIdSender: socketIdSender, time: timeStr }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    useEffect(() => {
        if (showModal) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, showModal]);

    const handleCopyInviteLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        showSnack("Meeting link copied to clipboard!", "success");
        setTimeout(() => setCopiedLink(false), 2500);
    };

    let sendMessage = () => {
        if (!message.trim()) return;
        socketRef.current.emit('chat-message', message.trim(), username);
        setMessage("");
    };


    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    // ==================== Host controls (6.3) ====================

    const handleMuteAll = () => {
        socketRef.current.emit('mute-all');
        setHostMenuAnchorEl(null);
        showSnack("Muted all participants.", "success");
    }

    const handleToggleLock = () => {
        socketRef.current.emit(roomLocked ? 'unlock-room' : 'lock-room');
        setHostMenuAnchorEl(null);
    }

    const handleToggleWaitingRoom = () => {
        const next = !waitingRoomEnabled;
        setWaitingRoomEnabled(next);
        socketRef.current.emit('enable-waiting-room', next);
        setHostMenuAnchorEl(null);
        showSnack(`Waiting room ${next ? "enabled" : "disabled"}.`, "info");
    }

    const handleRemoveParticipant = (targetSocketId) => {
        socketRef.current.emit('remove-participant', targetSocketId);
    }

    const handleAdmit = (targetSocketId) => {
        socketRef.current.emit('admit-participant', targetSocketId);
    }

    const handleDeny = (targetSocketId) => {
        socketRef.current.emit('deny-participant', targetSocketId);
    }

    // ==================== Reactions & raise hand (6.3) ====================

    const handleSendReaction = (emoji) => {
        socketRef.current.emit('send-reaction', emoji);
        setReactionAnchorEl(null);
    }

    const handleToggleHand = () => {
        const next = !handRaisedSelf;
        setHandRaisedSelf(next);
        socketRef.current.emit(next ? 'raise-hand' : 'lower-hand');
    }

    // ==================== Recording (6.3) ====================

    const startRecording = () => {
        try {
            if (!window.localStream) {
                showSnack("Nothing to record yet.", "warning");
                return;
            }
            if (typeof MediaRecorder === "undefined") {
                showSnack("Recording is not supported in this browser.", "error");
                return;
            }
            recordedChunksRef.current = [];
            const recorder = new MediaRecorder(window.localStream, { mimeType: 'video/webm' });
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `meeting-recording-${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            showSnack("Recording started (only your local view is recorded).", "info");
        } catch (e) {
            console.log(e);
            showSnack("Could not start recording.", "error");
        }
    }

    const stopRecording = () => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } catch (e) { console.log(e); }
        setIsRecording(false);
    }

    const handleToggleRecording = () => {
        if (isRecording) stopRecording(); else startRecording();
    }

    // ==================== Background blur (6.3) ====================
    // Uses @mediapipe/selfie_segmentation to separate the presenter from the
    // background, then composites a blurred background behind a sharp
    // foreground on a canvas, which is sent to peers via canvas.captureStream().
    // Wrapped defensively end-to-end: if the model fails to load (e.g. no
    // network access to fetch the wasm assets) blur just doesn't turn on and
    // the user gets a clear error, instead of the call breaking.
    const enableBlur = async () => {
        if (!window.localStream || window.localStream.getVideoTracks().length === 0) {
            showSnack("Turn your camera on before enabling background blur.", "warning");
            return;
        }

        setBlurLoading(true);
        try {
            if (!selfieSegRef.current) {
                const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');
                const seg = new SelfieSegmentation({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
                });
                seg.setOptions({ modelSelection: 1 });
                selfieSegRef.current = seg;
            }

            if (!blurCanvasRef.current) {
                blurCanvasRef.current = document.createElement('canvas');
            }
            const canvas = blurCanvasRef.current;
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');

            selfieSegRef.current.onResults((results) => {
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Sharp foreground (person) clipped to the segmentation mask.
                ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-in';
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

                // Blurred full frame drawn *behind* the foreground.
                ctx.globalCompositeOperation = 'destination-over';
                ctx.filter = 'blur(14px)';
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';
                ctx.restore();
            });

            if (rawVideoRef.current) {
                rawVideoRef.current.srcObject = window.localStream;
                try { await rawVideoRef.current.play(); } catch (e) { /* autoplay restrictions - safe to ignore, muted+inline covers most browsers */ }
            }

            blurRunningRef.current = true;
            const processFrame = async () => {
                if (!blurRunningRef.current) return;
                try {
                    if (rawVideoRef.current && rawVideoRef.current.readyState >= 2) {
                        await selfieSegRef.current.send({ image: rawVideoRef.current });
                    }
                } catch (e) {
                    console.log("Blur frame processing error:", e);
                }
                if (blurRunningRef.current) requestAnimationFrame(processFrame);
            };
            processFrame();

            const blurredStream = canvas.captureStream(24);
            const audioTracks = window.localStream.getAudioTracks();
            const combined = new MediaStream([...blurredStream.getVideoTracks(), ...audioTracks]);

            window.localStream = combined;
            localVideoref.current.srcObject = combined;

            // Swap the outgoing webcam producer's track in place - no
            // renegotiation loop needed, mediasoup just re-keys the same
            // RTP stream onto the new (blurred) track.
            const blurredVideoTrack = blurredStream.getVideoTracks()[0];
            if (sfuClientRef.current && blurredVideoTrack) {
                try {
                    await sfuClientRef.current.replaceTrack('webcam', blurredVideoTrack);
                } catch (e) {
                    console.log("Could not publish blurred video track:", e);
                }
            }

            setBlurEnabled(true);
        } catch (e) {
            console.log("Could not enable background blur:", e);
            showSnack("Background blur isn't available right now (couldn't load the AI model).", "error");
            blurRunningRef.current = false;
        } finally {
            setBlurLoading(false);
        }
    }

    const disableBlur = () => {
        blurRunningRef.current = false;
        setBlurEnabled(false);
        // Re-acquire a clean camera stream rather than trying to "unwrap"
        // the canvas stream, so audio/video stay in sync and healthy.
        getUserMedia();
    }

    const handleToggleBlur = () => {
        if (blurLoading) return;
        if (blurEnabled) disableBlur(); else enableBlur();
    }

    useEffect(() => {
        return () => {
            blurRunningRef.current = false;
        }
    }, [])

    // ==================== Whiteboard & Polls & Network Quality ====================

    const drawActionOnCanvas = (action: WhiteboardAction) => {
        const canvas = wbCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (action.type === "clear") {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        if (action.type === "draw" && action.prevX !== undefined && action.prevY !== undefined && action.currX !== undefined && action.currY !== undefined) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(action.prevX, action.prevY);
            ctx.lineTo(action.currX, action.currY);
            ctx.strokeStyle = action.isEraser ? "#ffffff" : (action.color || "#000000");
            ctx.lineWidth = action.width || 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            ctx.restore();
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = wbCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        isDrawingRef.current = true;
        lastPointRef.current = { x, y };
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || !lastPointRef.current || !wbCanvasRef.current) return;
        const rect = wbCanvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const action: WhiteboardAction = {
            type: "draw",
            prevX: lastPointRef.current.x,
            prevY: lastPointRef.current.y,
            currX: x,
            currY: y,
            color: wbColor,
            width: wbWidth,
            isEraser: wbTool === "eraser",
        };

        drawActionOnCanvas(action);
        socketRef.current?.emit("wb-draw", action);
        lastPointRef.current = { x, y };
    };

    const handleCanvasMouseUp = () => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
    };

    const handleClearWhiteboard = () => {
        const canvas = wbCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        socketRef.current?.emit("wb-clear");
    };

    const handleDownloadWhiteboard = () => {
        const canvas = wbCanvasRef.current;
        if (!canvas) return;
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `meeting-whiteboard-${Date.now()}.png`;
        a.click();
    };

    const openWhiteboard = () => {
        const next = !showWhiteboard;
        setShowWhiteboard(next);
        if (next) {
            setTimeout(() => {
                const canvas = wbCanvasRef.current;
                if (canvas && canvas.parentElement) {
                    canvas.width = canvas.parentElement.clientWidth;
                    canvas.height = canvas.parentElement.clientHeight;
                    socketRef.current?.emit("wb-get-state", {}, (res: any) => {
                        (res?.actions || []).forEach(drawActionOnCanvas);
                    });
                }
            }, 100);
        }
    };

    const handleCreatePoll = () => {
        if (!pollQuestion.trim()) {
            showSnack("Please enter a question for the poll.", "warning");
            return;
        }
        const validOpts = pollOptions.filter((o) => o.trim().length > 0);
        if (validOpts.length < 2) {
            showSnack("Please provide at least 2 options.", "warning");
            return;
        }
        socketRef.current?.emit("create-poll", { question: pollQuestion, options: validOpts }, (res: any) => {
            if (res?.error) {
                showSnack(res.error, "error");
            } else {
                setPollQuestion("");
                setPollOptions(["", ""]);
                showSnack("Poll launched successfully!", "success");
            }
        });
    };

    const handleVotePoll = (pollId: string, optionId: number) => {
        socketRef.current?.emit("vote-poll", { pollId, optionId }, (res: any) => {
            if (res?.error) showSnack(res.error, "error");
        });
    };

    const handleEndPoll = (pollId: string) => {
        socketRef.current?.emit("end-poll", { pollId }, (res: any) => {
            if (res?.error) showSnack(res.error, "error");
            else showSnack("Poll ended.", "info");
        });
    };

    useEffect(() => {
        const interval = setInterval(async () => {
            if (sfuClientRef.current) {
                try {
                    const stats = await sfuClientRef.current.getNetworkStats();
                    setNetworkQuality(stats);
                } catch (e) {}
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!sfuClientRef.current) return;
        const mainSocketId = pinnedSocketId || activeSpeakerSocketId || (videos[0]?.socketId);
        videos.forEach((v) => {
            const isMain = v.socketId === mainSocketId;
            sfuClientRef.current.setPreferredLayersBySocketId(v.socketId, isMain ? 2 : 0).catch(() => {});
        });
    }, [spotlightEnabled, pinnedSocketId, activeSpeakerSocketId, videos]);

    // Tear down SFU transports/producers/consumers and the socket if this
    // component unmounts without going through handleEndCall (e.g. the
    // user navigates away directly) - avoids leaking a live mediasoup
    // transport + worker-side resources for a peer that's no longer there.
    useEffect(() => {
        return () => {
            try { sfuClientRef.current?.close(); } catch (e) { }
            try { socketRef.current?.disconnect(); } catch (e) { }
        }
    }, [])


    return (
        <div>

            {askForUsername === true ?

                <div style={{
                    minHeight: '100vh',
                    backgroundColor: '#070a13',
                    backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.18) 0%, transparent 60%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    color: '#f8fafc',
                }}>
                    <div style={{ marginBottom: '24px' }}>
                        <Logo size="lg" onClick={() => window.location.href = "/home"} />
                    </div>

                    {joinDenied ? (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '20px',
                            padding: '32px',
                            maxWidth: '460px',
                            textAlign: 'center',
                        }}>
                            <h2 style={{ color: '#ef4444', fontSize: '1.4rem', margin: '0 0 12px 0' }}>Access Declined</h2>
                            <p style={{ color: '#94a3b8', margin: '0 0 24px 0' }}>The meeting host declined your request to join this session.</p>
                            <Button variant="contained" onClick={() => window.location.href = "/home"} sx={{ borderRadius: '9999px', px: 3, background: 'rgba(255, 255, 255, 0.1)' }}>
                                Back to Home
                            </Button>
                        </div>
                    ) : roomLockedOnEntry ? (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '20px',
                            padding: '32px',
                            maxWidth: '460px',
                            textAlign: 'center',
                        }}>
                            <h2 style={{ color: '#f59e0b', fontSize: '1.4rem', margin: '0 0 12px 0' }}>Meeting Locked</h2>
                            <p style={{ color: '#94a3b8', margin: '0 0 24px 0' }}>This meeting room has been locked by the host to prevent new entries.</p>
                            <Button variant="contained" onClick={() => window.location.href = "/home"} sx={{ borderRadius: '9999px', px: 3, background: 'rgba(255, 255, 255, 0.1)' }}>
                                Back to Home
                            </Button>
                        </div>
                    ) : isWaitingForApproval ? (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            borderRadius: '20px',
                            padding: '32px',
                            maxWidth: '460px',
                            textAlign: 'center',
                        }}>
                            <h2 style={{ fontSize: '1.4rem', margin: '0 0 8px 0' }}>Waiting Room</h2>
                            <p style={{ color: '#94a3b8', margin: '0 0 20px 0' }}>Waiting for the host to admit you to the meeting...</p>
                            <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '16px', background: '#020617' }}>
                                <video ref={localVideoref} autoPlay muted style={{ width: '100%', height: '220px', objectFit: 'cover' }}></video>
                            </div>
                            <CircularProgress size={28} sx={{ color: '#06b6d4' }} />
                        </div>
                    ) : (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '20px',
                            padding: '32px',
                            maxWidth: '480px',
                            width: '100%',
                            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px 0', textAlign: 'center' }}>Ready to Join?</h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 20px 0', textAlign: 'center' }}>
                                Check your camera and enter your display name
                            </p>

                            <div style={{
                                position: 'relative',
                                borderRadius: '14px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                marginBottom: '20px',
                                background: '#020617',
                                height: '220px',
                            }}>
                                <video ref={localVideoref} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    left: '10px',
                                    background: 'rgba(0, 0, 0, 0.65)',
                                    color: '#ffffff',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backdropFilter: 'blur(4px)',
                                }}>
                                    Live Preview
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <TextField
                                    id="outlined-basic"
                                    label="Username"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') connect(); }}
                                    variant="outlined"
                                    inputProps={{ 'aria-label': 'Username' }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            backgroundColor: 'rgba(30, 41, 59, 0.6)',
                                            borderRadius: '12px',
                                            color: '#ffffff',
                                            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                            '&:hover fieldset': { borderColor: '#06b6d4' },
                                        }
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={connect}
                                    aria-label="Connect to meeting"
                                    sx={{
                                        background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                        borderRadius: '9999px',
                                        py: 1.3,
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        textTransform: 'none',
                                        boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)',
                                        }
                                    }}
                                >
                                    Join Meeting
                                </Button>
                            </div>
                        </div>
                    )}

                </div> :


                <div className={styles.meetVideoContainer}>

                    {/* Hidden raw camera feed used only as the blur segmentation source */}
                    <video ref={rawVideoRef} autoPlay muted playsInline style={{ display: 'none' }}></video>

                    {showModal ? (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                {/* Header with dedicated Close Button */}
                                <div className={styles.chatHeader}>
                                    <div className={styles.chatHeaderLeft}>
                                        <ChatIcon sx={{ color: '#06b6d4', fontSize: 20 }} />
                                        <h3 className={styles.chatHeaderTitle}>In-Call Chat</h3>
                                        <span className={styles.chatMessageCount}>{messages.length}</span>
                                    </div>
                                    <IconButton
                                        size="small"
                                        onClick={() => setModal(false)}
                                        className={styles.chatCloseButton}
                                        aria-label="Close chat"
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </div>

                                {/* Chat Message List */}
                                <div className={styles.chattingDisplay}>
                                    {messages.length === 0 ? (
                                        <div className={styles.chatEmptyState}>
                                            <ChatIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1, color: '#06b6d4' }} />
                                            <p style={{ margin: 0, fontWeight: 600, color: '#94a3b8' }}>No messages yet</p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                                Send a message to everyone in the room.
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map((item, index) => {
                                            const isMe = item.socketIdSender === socketIdRef.current || item.sender === username;
                                            return (
                                                <div
                                                    key={index}
                                                    className={`${styles.chatBubbleRow} ${isMe ? styles.chatBubbleRowMe : styles.chatBubbleRowOther}`}
                                                >
                                                    <div className={styles.chatSenderName} style={{ color: isMe ? '#a5b4fc' : '#38bdf8' }}>
                                                        {isMe ? 'You' : item.sender}
                                                    </div>
                                                    <div className={isMe ? styles.chatBubbleMe : styles.chatBubbleOther}>
                                                        <div>{item.data}</div>
                                                        {item.time && <div className={styles.chatTime}>{item.time}</div>}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Chat Input Area */}
                                <div className={styles.chattingArea}>
                                    <div className={styles.chatInputWrapper}>
                                        <input
                                            className={styles.chatInput}
                                            placeholder="Type a message..."
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                                            aria-label="Chat message"
                                        />
                                    </div>
                                    <button
                                        className={styles.chatSendBtn}
                                        onClick={sendMessage}
                                        aria-label="Send message"
                                    >
                                        <SendIcon sx={{ fontSize: 18 }} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {showParticipants ? (
                        <Drawer
                            anchor="right"
                            open={showParticipants}
                            onClose={() => setShowParticipants(false)}
                            PaperProps={{
                                sx: {
                                    backgroundColor: '#0f172a',
                                    color: '#f8fafc',
                                    width: 340,
                                    padding: '20px',
                                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PeopleIcon sx={{ color: '#6366f1', fontSize: 22 }} />
                                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                        Participants ({participantsList.length})
                                    </h3>
                                </div>
                                <IconButton
                                    size="small"
                                    onClick={() => setShowParticipants(false)}
                                    sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }}
                                    aria-label="Close participants"
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {isHost && waitingList.length > 0 && (
                                    <div style={{ marginBottom: 20, background: 'rgba(30, 41, 59, 0.6)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#f59e0b' }}>
                                            Waiting Room ({waitingList.length})
                                        </h4>
                                        {waitingList.map((w) => (
                                            <div key={w.socketId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <span style={{ fontSize: '0.9rem' }}>{w.name}</span>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <Button size="small" variant="contained" onClick={() => handleAdmit(w.socketId)} aria-label={`Admit ${w.name}`} sx={{ fontSize: '0.75rem', py: 0.2, px: 1, background: '#10b981' }}>Admit</Button>
                                                    <Button size="small" variant="outlined" color="error" onClick={() => handleDeny(w.socketId)} aria-label={`Deny ${w.name}`} sx={{ fontSize: '0.75rem', py: 0.2, px: 1 }}>Deny</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {participantsList.map((p) => {
                                        const isMe = p.socketId === socketIdRef.current;
                                        return (
                                            <div
                                                key={p.socketId}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        background: isMe ? 'linear-gradient(135deg, #06b6d4, #6366f1)' : '#334155',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 700,
                                                        fontSize: '0.8rem',
                                                    }}>
                                                        {(p.name || 'U').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                                            {p.name} {isMe ? '(You)' : ''}
                                                            {raisedHands[p.socketId] ? " ✋" : ""}
                                                        </div>
                                                        {p.isHost && (
                                                            <span style={{ fontSize: '0.7rem', color: '#06b6d4', fontWeight: 700 }}>Host</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isHost && !isMe && (
                                                    <Tooltip title="Remove participant">
                                                        <IconButton size="small" onClick={() => handleRemoveParticipant(p.socketId)} sx={{ color: '#ef4444' }} aria-label={`Remove ${p.name}`}>
                                                            <PersonRemoveIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Drawer>
                    ) : null}

                    {/* Floating reaction toasts (6.3 - Reactions/emojis) */}
                    <div className={styles.reactionsOverlay}>
                        {reactions.map((r) => (
                            <div key={r.id} className={styles.reactionBubble}>{r.emoji} <span>{r.name}</span></div>
                        ))}
                    </div>

                    <div className={styles.buttonContainers}>
                        <Tooltip title={video ? "Turn camera off" : "Turn camera on"}>
                            <IconButton onClick={handleVideo} style={{ color: video ? "white" : "#f87171", backgroundColor: video ? "rgba(255, 255, 255, 0.08)" : "rgba(239, 68, 68, 0.2)" }} aria-label={video ? "Turn camera off" : "Turn camera on"}>
                                {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={audio ? "Mute" : "Unmute"}>
                            <IconButton onClick={handleAudio} style={{ color: audio ? "white" : "#f87171", backgroundColor: audio ? "rgba(255, 255, 255, 0.08)" : "rgba(239, 68, 68, 0.2)" }} aria-label={audio ? "Mute microphone" : "Unmute microphone"}>
                                {audio === true ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="End call">
                            <IconButton onClick={handleEndCall} style={{ backgroundColor: "#ef4444", color: "#ffffff", boxShadow: "0 0 16px rgba(239, 68, 68, 0.5)" }} aria-label="End call">
                                <CallEndIcon />
                            </IconButton>
                        </Tooltip>

                        {screenAvailable === true ?
                            <Tooltip title={screen ? "Stop sharing screen" : "Share screen"}>
                                <IconButton onClick={handleScreen} style={{ color: screen ? "#06b6d4" : "white", backgroundColor: screen ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.08)" }} aria-label={screen ? "Stop sharing screen" : "Share screen"}>
                                    {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                                </IconButton>
                            </Tooltip> : <></>}

                        <Badge badgeContent={newMessages} max={999} color='error'>
                            <Tooltip title={showModal ? "Close chat" : "Open chat"}>
                                <IconButton
                                    onClick={() => {
                                        const next = !showModal;
                                        setModal(next);
                                        if (next) setNewMessages(0);
                                    }}
                                    style={{
                                        color: showModal ? "#06b6d4" : "white",
                                        backgroundColor: showModal ? "rgba(6, 182, 212, 0.25)" : "rgba(255, 255, 255, 0.08)",
                                        boxShadow: showModal ? "0 0 14px rgba(6, 182, 212, 0.4)" : "none",
                                    }}
                                    aria-label="Toggle chat"
                                >
                                    <ChatIcon />
                                </IconButton>
                            </Tooltip>
                        </Badge>

                        <Badge badgeContent={isHost ? waitingList.length : 0} color="error">
                            <Tooltip title={showParticipants ? "Close participants" : "View participants"}>
                                <IconButton
                                    onClick={() => setShowParticipants(!showParticipants)}
                                    style={{
                                        color: showParticipants ? "#818cf8" : "white",
                                        backgroundColor: showParticipants ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.08)",
                                        boxShadow: showParticipants ? "0 0 14px rgba(99, 102, 241, 0.4)" : "none",
                                    }}
                                    aria-label="Toggle participants panel"
                                >
                                    <PeopleIcon />
                                </IconButton>
                            </Tooltip>
                        </Badge>

                        <Tooltip title="Send a reaction">
                            <IconButton onClick={(e) => setReactionAnchorEl(e.currentTarget)} style={{ color: "white" }} aria-label="Send a reaction">
                                <EmojiEmotionsIcon />
                            </IconButton>
                        </Tooltip>
                        <Menu anchorEl={reactionAnchorEl} open={Boolean(reactionAnchorEl)} onClose={() => setReactionAnchorEl(null)}>
                            {REACTION_EMOJIS.map((emoji) => (
                                <MenuItem key={emoji} onClick={() => handleSendReaction(emoji)}>{emoji}</MenuItem>
                            ))}
                        </Menu>

                        <Tooltip title={handRaisedSelf ? "Lower hand" : "Raise hand"}>
                            <IconButton onClick={handleToggleHand} style={{ color: handRaisedSelf ? "#ffb300" : "white" }} aria-label={handRaisedSelf ? "Lower hand" : "Raise hand"}>
                                <PanToolIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={isRecording ? "Stop recording" : "Start recording (saved locally)"}>
                            <IconButton onClick={handleToggleRecording} style={{ color: isRecording ? "#e53935" : "white" }} aria-label={isRecording ? "Stop recording" : "Start recording"}>
                                {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={blurEnabled ? "Disable background blur" : "Enable background blur"}>
                            <span>
                                <IconButton onClick={handleToggleBlur} disabled={blurLoading} style={{ color: "white" }} aria-label={blurEnabled ? "Disable background blur" : "Enable background blur"}>
                                    {blurEnabled ? <BlurOffIcon /> : <BlurOnIcon />}
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title={spotlightEnabled ? "Disable speaker spotlight" : "Enable speaker spotlight"}>
                            <IconButton onClick={() => setSpotlightEnabled(!spotlightEnabled)} style={{ color: spotlightEnabled ? "#00e676" : "white" }} aria-label="Toggle speaker spotlight">
                                <CropFreeIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={showWhiteboard ? "Close whiteboard" : "Open collaborative whiteboard"}>
                            <IconButton onClick={openWhiteboard} style={{ color: showWhiteboard ? "#42a5f5" : "white" }} aria-label="Toggle collaborative whiteboard">
                                <BrushIcon />
                            </IconButton>
                        </Tooltip>

                        <Badge badgeContent={pollsList.filter(p => p.active).length} color="primary">
                            <Tooltip title="In-call polls">
                                <IconButton onClick={() => setShowPolls(!showPolls)} style={{ color: "white" }} aria-label="Toggle polls panel">
                                    <PollIcon />
                                </IconButton>
                            </Tooltip>
                        </Badge>

                        {isHost && (
                            <>
                                <Tooltip title="Host controls">
                                    <IconButton onClick={(e) => setHostMenuAnchorEl(e.currentTarget)} style={{ color: "white" }} aria-label="Host controls">
                                        <AdminPanelSettingsIcon />
                                    </IconButton>
                                </Tooltip>
                                <Menu anchorEl={hostMenuAnchorEl} open={Boolean(hostMenuAnchorEl)} onClose={() => setHostMenuAnchorEl(null)}>
                                    <MenuItem onClick={handleMuteAll}>Mute all participants</MenuItem>
                                    <MenuItem onClick={handleToggleLock}>
                                        {roomLocked ? <LockOpenIcon fontSize="small" style={{ marginRight: 8 }} /> : <LockIcon fontSize="small" style={{ marginRight: 8 }} />}
                                        {roomLocked ? "Unlock meeting" : "Lock meeting"}
                                    </MenuItem>
                                    <MenuItem onClick={handleToggleWaitingRoom}>
                                        {waitingRoomEnabled ? "Disable waiting room" : "Enable waiting room"}
                                    </MenuItem>
                                </Menu>
                            </>
                        )}

                    </div>

                    {/* Poor network connection banner */}
                    {networkQuality?.quality === "poor" && (
                        <div className={styles.networkBanner}>
                            ⚠️ Your connection is unstable ({networkQuality.rtt}ms, {networkQuality.packetLoss}% loss). Video quality adapted.
                        </div>
                    )}

                    {/* Collaborative Whiteboard Canvas Overlay */}
                    {showWhiteboard && (
                        <div className={styles.whiteboardContainer}>
                            <div className={styles.whiteboardHeader}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <h3 style={{ margin: 0, marginRight: 8 }}>Whiteboard</h3>
                                    {['#000000', '#1976d2', '#e53935', '#43a047', '#fdd835'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => { setWbColor(color); setWbTool('pen'); }}
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                backgroundColor: color,
                                                border: wbColor === color && wbTool === 'pen' ? '3px solid #111' : '1px solid #ccc',
                                                cursor: 'pointer',
                                            }}
                                            aria-label={`Color ${color}`}
                                        />
                                    ))}
                                    <Button
                                        size="small"
                                        variant={wbTool === 'eraser' ? 'contained' : 'outlined'}
                                        onClick={() => setWbTool(wbTool === 'eraser' ? 'pen' : 'eraser')}
                                    >
                                        Eraser
                                    </Button>
                                    <select
                                        value={wbWidth}
                                        onChange={(e) => setWbWidth(Number(e.target.value))}
                                        style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }}
                                    >
                                        <option value={2}>Thin (2px)</option>
                                        <option value={5}>Medium (5px)</option>
                                        <option value={10}>Thick (10px)</option>
                                    </select>
                                    <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleClearWhiteboard}>
                                        Clear
                                    </Button>
                                    <Button size="small" startIcon={<DownloadIcon />} onClick={handleDownloadWhiteboard}>
                                        Save
                                    </Button>
                                </div>
                                <IconButton onClick={() => setShowWhiteboard(false)} aria-label="Close whiteboard">
                                    <CloseIcon />
                                </IconButton>
                            </div>
                            <div className={styles.whiteboardCanvasArea}>
                                <canvas
                                    ref={wbCanvasRef}
                                    className={styles.whiteboardCanvas}
                                    onMouseDown={handleCanvasMouseDown}
                                    onMouseMove={handleCanvasMouseMove}
                                    onMouseUp={handleCanvasMouseUp}
                                    onMouseLeave={handleCanvasMouseUp}
                                />
                            </div>
                        </div>
                    )}

                    {/* In-Call Polls Drawer */}
                    {showPolls && (
                        <Drawer
                            anchor="right"
                            open={showPolls}
                            onClose={() => setShowPolls(false)}
                            PaperProps={{
                                sx: {
                                    backgroundColor: '#0f172a',
                                    color: '#f8fafc',
                                    width: 360,
                                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                                }
                            }}
                        >
                            <div className={styles.pollsContainer}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <PollIcon sx={{ color: '#06b6d4', fontSize: 22 }} />
                                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>In-Call Polls</h2>
                                    </div>
                                    <IconButton onClick={() => setShowPolls(false)} size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }} aria-label="Close polls">
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </div>

                                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: 16, borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#38bdf8' }}>Create a Poll</h4>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Question"
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                        sx={{
                                            mb: 1.5,
                                            '& .MuiOutlinedInput-root': {
                                                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                            }
                                        }}
                                    />
                                    {pollOptions.map((opt, idx) => (
                                        <TextField
                                            key={idx}
                                            fullWidth
                                            size="small"
                                            label={`Option ${idx + 1}`}
                                            value={opt}
                                            onChange={(e) => {
                                                const next = [...pollOptions];
                                                next[idx] = e.target.value;
                                                setPollOptions(next);
                                            }}
                                            sx={{
                                                mb: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                                    borderRadius: '8px',
                                                    color: '#ffffff',
                                                }
                                            }}
                                        />
                                    ))}
                                    {pollOptions.length < 4 && (
                                        <Button size="small" onClick={() => setPollOptions([...pollOptions, ''])} sx={{ mb: 1, color: '#06b6d4', textTransform: 'none', fontSize: '0.8rem' }}>
                                            + Add Option
                                        </Button>
                                    )}
                                    <div>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={handleCreatePoll}
                                            fullWidth
                                            sx={{
                                                background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                                                borderRadius: '8px',
                                                fontWeight: 700,
                                                py: 1,
                                                textTransform: 'none',
                                            }}
                                        >
                                            Launch Poll
                                        </Button>
                                    </div>
                                </div>

                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                    <h4 style={{ margin: '8px 0' }}>Polls ({pollsList.length})</h4>
                                    {pollsList.length === 0 ? (
                                        <p style={{ color: '#777', fontSize: '0.9rem' }}>No polls created yet.</p>
                                    ) : (
                                        pollsList.map((p) => {
                                            const totalVotes = p.options.reduce((sum, o) => sum + o.votes, 0);
                                            const userVote = p.voters[socketIdRef.current];
                                            return (
                                                <div key={p.id} className={styles.pollCard}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <strong>{p.question}</strong>
                                                        {p.active ? (
                                                            <span style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 'bold' }}>ACTIVE</span>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: '#757575' }}>ENDED</span>
                                                        )}
                                                    </div>
                                                    <div style={{ margin: '8px 0' }}>
                                                        {p.options.map((opt) => {
                                                            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                                            const isSelected = userVote === opt.id;
                                                            return (
                                                                <div
                                                                    key={opt.id}
                                                                    className={styles.pollOptionBar}
                                                                    style={{ border: isSelected ? '2px solid #1976d2' : 'none' }}
                                                                    onClick={() => { if (p.active) handleVotePoll(p.id, opt.id); }}
                                                                >
                                                                    <div className={styles.pollProgressFill} style={{ width: `${pct}%` }} />
                                                                    <div className={styles.pollOptionText}>
                                                                        <span>{opt.text} {isSelected ? '✓' : ''}</span>
                                                                        <span>{pct}% ({opt.votes})</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666' }}>
                                                        <span>Total votes: {totalVotes}</span>
                                                        {(p.createdBy === socketIdRef.current || isHost) && p.active && (
                                                            <Button size="small" color="error" onClick={() => handleEndPoll(p.id)}>
                                                                End Poll
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </Drawer>
                    )}

                    {/* Floating Top Navigation Bar */}
                    <div className={styles.callTopBar}>
                        <div className={styles.callTopBarLeft}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Logo size="sm" showText={true} />
                            </div>
                            <div className={styles.meetingCodeBadge}>
                                <span>{window.location.pathname.split('/').filter(Boolean).pop() || 'room'}</span>
                                <button
                                    className={styles.copyCodeBtn}
                                    onClick={handleCopyInviteLink}
                                    title="Copy meeting link"
                                    aria-label="Copy meeting link"
                                >
                                    {copiedLink ? <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                                </button>
                            </div>
                            {isRecording && (
                                <div className={styles.recBadge}>
                                    <FiberManualRecordIcon sx={{ fontSize: 12 }} /> REC
                                </div>
                            )}
                        </div>

                        <div className={styles.callTopBarRight}>
                            <div
                                className={styles.quickTopPill}
                                onClick={() => setShowWhiteboard(!showWhiteboard)}
                                title="Toggle Whiteboard"
                            >
                                <BrushIcon sx={{ fontSize: 18, color: showWhiteboard ? '#06b6d4' : '#94a3b8' }} />
                                <span>Whiteboard</span>
                            </div>
                            <div
                                className={styles.quickTopPill}
                                onClick={() => setShowPolls(!showPolls)}
                                title="Toggle Polls"
                            >
                                <PollIcon sx={{ fontSize: 18, color: showPolls ? '#06b6d4' : '#94a3b8' }} />
                                <span>Polls</span>
                            </div>
                            <div
                                className={styles.quickTopPill}
                                onClick={() => setShowParticipants(!showParticipants)}
                                title="View Participants"
                            >
                                <PeopleIcon sx={{ fontSize: 18, color: showParticipants ? '#06b6d4' : '#94a3b8' }} />
                                <span>{participantsList.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Spotlight Layout vs Regular Conference View */}
                    {spotlightEnabled && (videos.length > 0) ? (
                        <div className={styles.spotlightLayout}>
                            {(() => {
                                const mainSocketId = pinnedSocketId || activeSpeakerSocketId || (videos[0]?.socketId);
                                const spotlightVideo = videos.find(v => v.socketId === mainSocketId) || videos[0];
                                return (
                                    <>
                                        <div className={`${styles.spotlightMain} ${spotlightVideo.socketId === activeSpeakerSocketId ? styles.activeSpeakerRing : ''}`}>
                                            {spotlightVideo.kind === 'camera' && raisedHands[spotlightVideo.socketId] && <span className={styles.handBadge}>✋</span>}
                                            {spotlightVideo.kind === 'screen' && <span className={styles.handBadge}>🖥️</span>}
                                            {spotlightVideo.socketId === activeSpeakerSocketId && (
                                                <span className={styles.speakerBadge}><VolumeUpIcon fontSize="inherit" /> Speaking</span>
                                            )}
                                            <span className={styles.networkBadge}>
                                                <SignalCellularAltIcon fontSize="inherit" style={{ color: networkQuality?.quality === 'poor' ? '#f44336' : networkQuality?.quality === 'fair' ? '#ff9800' : '#4caf50' }} />
                                                {networkQuality?.rtt || 45}ms
                                            </span>
                                            <Tooltip title={pinnedSocketId === spotlightVideo.socketId ? "Unpin participant" : "Pin participant"}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setPinnedSocketId(pinnedSocketId === spotlightVideo.socketId ? null : spotlightVideo.socketId)}
                                                    style={{ position: 'absolute', top: 6, left: 6, color: pinnedSocketId === spotlightVideo.socketId ? '#ffb300' : 'white', zIndex: 3, background: 'rgba(0,0,0,0.5)' }}
                                                    aria-label="Pin video"
                                                >
                                                    <PushPinIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <video
                                                data-socket={spotlightVideo.socketId}
                                                data-kind={spotlightVideo.kind}
                                                ref={ref => { if (ref && spotlightVideo.stream) ref.srcObject = spotlightVideo.stream; }}
                                                autoPlay
                                            />
                                        </div>

                                        <div className={styles.spotlightStrip}>
                                            <div
                                                className={`${styles.spotlightThumb} ${socketIdRef.current === activeSpeakerSocketId ? styles.activeSpeakerRing : ''}`}
                                                onClick={() => setPinnedSocketId(socketIdRef.current)}
                                            >
                                                <video
                                                    ref={(ref) => {
                                                        localVideoref.current = ref;
                                                        if (ref && window.localStream && ref.srcObject !== window.localStream) {
                                                            ref.srcObject = window.localStream;
                                                        }
                                                    }}
                                                    autoPlay
                                                    muted
                                                />
                                                <span style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4 }}>You</span>
                                            </div>
                                            {videos.filter(v => v !== spotlightVideo).map(v => (
                                                <div
                                                    key={`${v.socketId}-${v.kind}`}
                                                    className={`${styles.spotlightThumb} ${v.socketId === activeSpeakerSocketId ? styles.activeSpeakerRing : ''}`}
                                                    onClick={() => setPinnedSocketId(v.socketId)}
                                                >
                                                    {v.kind === 'camera' && raisedHands[v.socketId] && <span className={styles.handBadge}>✋</span>}
                                                    {v.kind === 'screen' && <span className={styles.handBadge}>🖥️</span>}
                                                    <video
                                                        data-socket={v.socketId}
                                                        data-kind={v.kind}
                                                        ref={ref => { if (ref && v.stream) ref.srcObject = v.stream; }}
                                                        autoPlay
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : videos.length === 0 ? (
                        /* Solo Stage: Attractive centered hero view when testing or waiting for others */
                        <div className={styles.soloStage}>
                            <div className={`${styles.soloHeroWrapper} ${socketIdRef.current === activeSpeakerSocketId ? styles.activeSpeakerRing : ''}`}>
                                <video
                                    ref={(ref) => {
                                        localVideoref.current = ref;
                                        if (ref && window.localStream && ref.srcObject !== window.localStream) {
                                            ref.srcObject = window.localStream;
                                        }
                                    }}
                                    autoPlay
                                    muted
                                />
                                <div className={styles.participantNameBadge}>
                                    <span>You ({username || 'Host'})</span>
                                </div>
                            </div>
                            <div className={styles.soloInviteBanner}>
                                <span>Waiting for others to join... Share code:</span>
                                <strong>{window.location.pathname.split('/').filter(Boolean).pop() || 'room'}</strong>
                                <button
                                    className={styles.copyCodeBtn}
                                    onClick={handleCopyInviteLink}
                                    title="Copy meeting link"
                                    aria-label="Copy meeting link"
                                >
                                    {copiedLink ? <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Multi-party Conference Grid */
                        <>
                            <video
                                className={`${styles.meetUserVideo} ${socketIdRef.current === activeSpeakerSocketId ? styles.activeSpeakerRing : ''}`}
                                ref={(ref) => {
                                    localVideoref.current = ref;
                                    if (ref && window.localStream && ref.srcObject !== window.localStream) {
                                        ref.srcObject = window.localStream;
                                    }
                                }}
                                autoPlay
                                muted
                            />

                            <div className={styles.conferenceView}>
                                {videos.map((video) => (
                                    <div
                                        key={`${video.socketId}-${video.kind}`}
                                        className={`${styles.remoteVideoWrapper} ${video.socketId === activeSpeakerSocketId ? styles.activeSpeakerRing : ''}`}
                                    >
                                        {video.kind === 'camera' && raisedHands[video.socketId] && <span className={styles.handBadge}>✋</span>}
                                        {video.kind === 'screen' && <span className={styles.handBadge}>🖥️</span>}
                                        {video.socketId === activeSpeakerSocketId && (
                                            <span className={styles.speakerBadge}><VolumeUpIcon fontSize="inherit" /> Speaking</span>
                                        )}
                                        <span className={styles.networkBadge}>
                                            <SignalCellularAltIcon fontSize="inherit" style={{ color: networkQuality?.quality === 'poor' ? '#f44336' : networkQuality?.quality === 'fair' ? '#ff9800' : '#4caf50' }} />
                                            {networkQuality?.rtt || 45}ms
                                        </span>
                                        <Tooltip title={pinnedSocketId === video.socketId ? "Unpin participant" : "Pin participant"}>
                                            <IconButton
                                                size="small"
                                                onClick={() => setPinnedSocketId(pinnedSocketId === video.socketId ? null : video.socketId)}
                                                style={{ position: 'absolute', top: 6, left: 6, color: pinnedSocketId === video.socketId ? '#ffb300' : 'white', zIndex: 3, background: 'rgba(0,0,0,0.5)' }}
                                                aria-label="Pin video"
                                            >
                                                <PushPinIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <video
                                            data-socket={video.socketId}
                                            data-kind={video.kind}
                                            ref={ref => {
                                                if (ref && video.stream) {
                                                    ref.srcObject = video.stream;
                                                }
                                            }}
                                            autoPlay
                                        />
                                        <div className={styles.participantNameBadge}>
                                            {video.kind === 'screen' ? '🖥️ Screen Share' : (video.name || video.socketId?.substring(0, 5) || 'Participant')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                </div>

            }

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
                    {snack.message}
                </Alert>
            </Snackbar>

        </div>
    )
}
