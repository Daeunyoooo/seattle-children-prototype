import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const AUTO_STOP_MS = 90000;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function appendText(baseText, transcript) {
  const base = String(baseText || "");
  const separator = base.trim() ? " " : "";
  return `${base.trimEnd()}${separator}${transcript}`;
}

// Records audio, sends it to POST /api/transcribe, and appends the returned
// text onto whatever the field already contained ("base") via onAppendText.
export function useVoiceToText({ getTarget, onAppendText, disabled } = {}) {
  const [state, setState] = useState("idle"); // idle | recording | transcribing
  const [error, setError] = useState(null);

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef("");
  const targetRef = useRef({ baseText: "" });
  const autoStopTimerRef = useRef(null);

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
    clearAutoStopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
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

  const start = useCallback(async () => {
    if (!supported || disabled || state !== "idle") return;

    setError(null);
    targetRef.current = getTarget ? getTarget() : { baseText: "" };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("permission_denied");
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
    };

    recorder.onstop = async () => {
      clearAutoStopTimer();
      stopTracks();
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      chunksRef.current = [];
      mediaRecorderRef.current = null;

      if (!blob.size) {
        setState("idle");
        return;
      }

      setState("transcribing");
      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Audio-Type": mimeTypeRef.current || "audio/webm"
          },
          body: blob
        });

        if (response.status === 503) {
          setError("not_configured");
          setState("idle");
          return;
        }

        if (!response.ok) {
          setError("transcription_failed");
          setState("idle");
          return;
        }

        const data = await response.json();
        if (!data.ok) {
          setError("transcription_failed");
          setState("idle");
          return;
        }

        const text = String(data.text || "").trim();
        if (!text) {
          setError("no_speech");
          setState("idle");
          return;
        }

        onAppendText?.(appendText(targetRef.current.baseText, text), targetRef.current);
        setState("idle");
      } catch {
        setError("transcription_failed");
        setState("idle");
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setState("recording");

    autoStopTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, AUTO_STOP_MS);
  }, [supported, disabled, state, getTarget, onAppendText, stopTracks, clearAutoStopTimer]);

  const stop = useCallback(() => {
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
