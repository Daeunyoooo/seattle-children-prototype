import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const AUTO_STOP_MS = 90000;
const LIVE_TIMESLICE_MS = 1800;
const MIN_LIVE_BYTES = 2500;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function appendText(baseText, transcript) {
  const base = String(baseText || "");
  const separator = base.trim() ? " " : "";
  return `${base.trimEnd()}${separator}${transcript}`;
}

async function transcribeBlob(blob, mimeType) {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Audio-Type": mimeType || "audio/webm"
    },
    body: blob
  });

  if (response.status === 503) {
    const error = new Error("not_configured");
    error.code = "not_configured";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("transcription_failed");
    error.code = "transcription_failed";
    throw error;
  }

  const data = await response.json();
  if (!data.ok) {
    const error = new Error("transcription_failed");
    error.code = "transcription_failed";
    throw error;
  }

  return String(data.text || "").trim();
}

// Records audio, streams growing clips to POST /api/transcribe while the mic
// is on, and appends returned text onto the field's starting value.
export function useVoiceToText({ getTarget, onAppendText, disabled } = {}) {
  const [state, setState] = useState("idle"); // idle | recording | transcribing
  const [error, setError] = useState(null);

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef("");
  const targetRef = useRef({ baseText: "" });
  const autoStopTimerRef = useRef(null);
  const sessionRef = useRef(0);
  const liveBusyRef = useRef(false);
  const liveQueuedRef = useRef(false);
  const stoppedRef = useRef(false);
  const hadLiveTextRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const stopTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    liveQueuedRef.current = false;
    stoppedRef.current = true;
    clearAutoStopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopTracks();
    setState("idle");
  }, [clearAutoStopTimer, stopTracks]);

  useEffect(() => () => cancel(), [cancel]);

  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);

  const applyTranscript = useCallback(
    (text) => {
      if (!text) return false;
      hadLiveTextRef.current = true;
      onAppendText?.(appendText(targetRef.current.baseText, text), targetRef.current);
      return true;
    },
    [onAppendText]
  );

  const transcribeCurrent = useCallback(
    async (sessionId, { final = false } = {}) => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      if (!blob.size || (!final && blob.size < MIN_LIVE_BYTES)) return "";
      try {
        const text = await transcribeBlob(blob, mimeTypeRef.current);
        if (sessionRef.current !== sessionId) return "";
        return text;
      } catch (error) {
        if (sessionRef.current !== sessionId) return "";
        if (final) throw error;
        return "";
      }
    },
    []
  );

  const pumpLiveTranscript = useCallback(async (sessionId) => {
    if (liveBusyRef.current) {
      liveQueuedRef.current = true;
      return;
    }
    liveBusyRef.current = true;
    try {
      do {
        liveQueuedRef.current = false;
        if (sessionRef.current !== sessionId || stoppedRef.current) return;
        const text = await transcribeCurrent(sessionId);
        if (sessionRef.current !== sessionId || stoppedRef.current) return;
        applyTranscript(text);
      } while (liveQueuedRef.current && sessionRef.current === sessionId && !stoppedRef.current);
    } finally {
      liveBusyRef.current = false;
    }
  }, [applyTranscript, transcribeCurrent]);

  const start = useCallback(async () => {
    if (!supported || disabled || state !== "idle") return;

    setError(null);
    targetRef.current = getTarget ? getTarget() : { baseText: "" };
    stoppedRef.current = false;
    liveQueuedRef.current = false;
    hadLiveTextRef.current = false;
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("permission_denied");
      return;
    }
    if (sessionRef.current !== sessionId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    mediaStreamRef.current = stream;

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setError("transcription_failed");
      stopTracks();
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      if (!stoppedRef.current && recorder.state === "recording") {
        void pumpLiveTranscript(sessionId);
      }
    };

    recorder.onstop = async () => {
      clearAutoStopTimer();
      stopTracks();
      mediaRecorderRef.current = null;
      stoppedRef.current = true;
      liveQueuedRef.current = false;

      if (sessionRef.current !== sessionId) {
        chunksRef.current = [];
        setState("idle");
        return;
      }

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      chunksRef.current = [];
      if (!blob.size) {
        setState("idle");
        return;
      }

      setState("transcribing");
      try {
        const text = await transcribeBlob(blob, mimeTypeRef.current);
        if (sessionRef.current !== sessionId) {
          setState("idle");
          return;
        }
        if (text) {
          applyTranscript(text);
        } else if (!hadLiveTextRef.current) {
          setError("no_speech");
        }
        setState("idle");
      } catch (error) {
        if (sessionRef.current !== sessionId) {
          setState("idle");
          return;
        }
        setError(error.code || "transcription_failed");
        setState("idle");
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(LIVE_TIMESLICE_MS);
    setState("recording");

    autoStopTimerRef.current = setTimeout(() => {
      stoppedRef.current = true;
      liveQueuedRef.current = false;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, AUTO_STOP_MS);
  }, [
    supported,
    disabled,
    state,
    getTarget,
    stopTracks,
    clearAutoStopTimer,
    pumpLiveTranscript,
    applyTranscript
  ]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    liveQueuedRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (state === "recording") {
      stop();
    } else if (state === "idle") {
      start();
    }
  }, [state, start, stop]);

  return { state, error, supported, toggle, cancel };
}
