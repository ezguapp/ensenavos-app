import { useCallback, useRef, useState } from "react";
import HandCamera from "../components/HandCamera";
import { classifyHandLandmarks } from "../utils/signClassifier";
import {
  createSession,
  saveTranslation,
  saveFeedback,
  updateSession,
  savePendingFeedbackLocally,
} from "../services/api";

function Translator() {
  const [session, setSession] = useState(null);
  const [textBuffer, setTextBuffer] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [message, setMessage] = useState("");
  const [currentSign, setCurrentSign] = useState("Sin seña");

  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [translationsCount, setTranslationsCount] = useState(0);
  const [finalSessionData, setFinalSessionData] = useState(null);

  const lastPredictionRef = useRef({
    label: null,
    time: 0,
  });

  const handleLandmarksDetected = useCallback(
    async (landmarks) => {
      const prediction = classifyHandLandmarks(landmarks);

      if (!prediction) {
        setCurrentSign("Mano detectada");
        return;
      }

      setCurrentSign(
        `${prediction.label} · ${Math.round(prediction.confidence * 100)}%`
      );

      if (prediction.confidence < 0.85) {
        return;
      }

      const now = Date.now();
      const lastPrediction = lastPredictionRef.current;

      if (
        lastPrediction.label === prediction.label &&
        now - lastPrediction.time < 1500
      ) {
        return;
      }

      lastPredictionRef.current = {
        label: prediction.label,
        time: now,
      };

      if (!isRunning) {
        return;
      }

      setTextBuffer((prev) => prev + prediction.label);
      setTranslationsCount((prev) => prev + 1);

      if (session?.id) {
        try {
          await saveTranslation(
            session.id,
            prediction.label,
            prediction.confidence
          );
          setMessage(`Se detectó y guardó: ${prediction.label}`);
        } catch (error) {
          console.error(error);
          setMessage(`Se detectó: ${prediction.label}, pero no se guardó`);
        }
      } else {
        setMessage(`Se detectó en modo demo: ${prediction.label}`);
      }
    },
    [isRunning, session]
  );

  const startConversation = async () => {
    if (session && isRunning) {
      setMessage("La traducción ya está activa");
      return;
    }

    if (session && !isRunning) {
      setIsRunning(true);
      setMessage("Traducción reanudada");
      return;
    }

    try {
      const newSession = await createSession();
      setSession(newSession);
      setTextBuffer("");
      setIsRunning(true);
      setSessionStartedAt(Date.now());
      setTranslationsCount(0);
      setMessage("Sesión iniciada correctamente con backend");
    } catch (error) {
      console.error(error);

      setSession({
        id: null,
        demo: true,
      });

      setTextBuffer("");
      setIsRunning(true);
      setSessionStartedAt(Date.now());
      setTranslationsCount(0);
      setMessage("Modo demo activo: cámara y MediaPipe funcionando sin backend");
    }
  };

  const clearText = () => {
    setTextBuffer("");
    setTranslationsCount(0);
    setMessage("Texto limpiado");
  };

  const detectFakeSign = async (detectedText) => {
    if (!session) {
      setMessage("Primero debes iniciar una sesión");
      return;
    }

    if (!isRunning) {
      setMessage("El reconocimiento está pausado");
      return;
    }

    const confidence = 0.95;

    try {
      setTextBuffer((prev) => prev + detectedText);
      setTranslationsCount((prev) => prev + 1);

      if (session?.id) {
        await saveTranslation(session.id, detectedText, confidence);
        setMessage(`Se detectó y guardó: ${detectedText}`);
      } else {
        setMessage(`Se detectó en modo demo: ${detectedText}`);
      }
    } catch (error) {
      setMessage("Se detectó, pero no se pudo guardar en backend");
      console.error(error);
    }
  };

  const finishConversation = () => {
    if (!session) {
      setMessage("No hay una sesión activa");
      return;
    }

    const durationSeconds = sessionStartedAt
      ? Math.round((Date.now() - sessionStartedAt) / 1000)
      : 0;

    const data = {
      duration_seconds: durationSeconds,
      translations_count: translationsCount,
    };

    setFinalSessionData(data);
    setIsRunning(false);
    setShowFeedback(true);
  };

  const sendFeedback = async (rating) => {
    const dataToSave = {
      rating,
      duration_seconds: finalSessionData?.duration_seconds || 0,
      translations_count:
        finalSessionData?.translations_count || translationsCount,
    };

    try {
      if (session?.id) {
        await updateSession(session.id, {
          duration_seconds: dataToSave.duration_seconds,
          translations_count: dataToSave.translations_count,
        });

        await saveFeedback(session.id, rating);
        setMessage(`Feedback guardado: ${rating}/5`);
      } else {
        setMessage(`Feedback registrado en modo demo: ${rating}/5`);
      }

      setShowFeedback(false);
      setSession(null);
      setIsRunning(false);
      setTextBuffer("");
      setTranslationsCount(0);
      setSessionStartedAt(null);
      setFinalSessionData(null);
      setCurrentSign("Sin seña");
    } catch (error) {
      console.error(error);

      savePendingFeedbackLocally({
        sessionId: session?.id || null,
        rating,
        duration_seconds: dataToSave.duration_seconds,
        translations_count: dataToSave.translations_count,
      });

      setMessage("Sin conexión: feedback guardado temporalmente");
      setShowFeedback(false);
      setSession(null);
      setIsRunning(false);
      setTextBuffer("");
      setTranslationsCount(0);
      setSessionStartedAt(null);
      setFinalSessionData(null);
      setCurrentSign("Sin seña");
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.phone}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>EnseñaVos</p>
            <h1 style={styles.title}>Traductor</h1>
          </div>

          <div style={isRunning ? styles.liveBadge : styles.idleBadge}>
            <span style={isRunning ? styles.liveDot : styles.idleDot}></span>
            {isRunning ? "En vivo" : "Listo"}
          </div>
        </header>

        <section style={styles.cameraShell}>
          <HandCamera
            isRunning={isRunning}
            onLandmarksDetected={handleLandmarksDetected}
          />

          <div style={styles.topCameraOverlay}>
            <span style={styles.cameraStatusLabel}>Seña actual</span>
            <strong style={styles.cameraStatusText}>{currentSign}</strong>
          </div>

          <div style={styles.translationOverlay}>
            <p style={styles.overlayLabel}>Traducción</p>
            <div style={styles.overlayText}>
              {textBuffer || "Aquí aparecerá la traducción..."}
            </div>
          </div>
        </section>

        <section style={styles.infoRow}>
          <div style={styles.infoCard}>
            <strong>{translationsCount}</strong>
            <span>Traducciones</span>
          </div>

          <div style={styles.infoCard}>
            <strong>
              {sessionStartedAt
                ? Math.round((Date.now() - sessionStartedAt) / 1000)
                : 0}
              s
            </strong>
            <span>Sesión</span>
          </div>
        </section>

        <section style={styles.controls}>
          <button style={styles.primaryButton} onClick={startConversation}>
            {session && isRunning ? "Iniciado" : "Iniciar"}
          </button>

          <button style={styles.secondaryButton} onClick={clearText}>
            Limpiar
          </button>

          <button style={styles.finishButton} onClick={finishConversation}>
            Finalizar
          </button>
        </section>

        {/* 
        BOTONES TEMPORALES DE PRUEBA.
        Los dejo comentados para no perderlos, pero ya no se muestran en la interfaz.

        <section className="fake-signs">
          <p>Prueba temporal de señas:</p>
          <button onClick={() => detectFakeSign("A")}>A</button>
          <button onClick={() => detectFakeSign("B")}>B</button>
          <button onClick={() => detectFakeSign("C")}>C</button>
          <button onClick={() => detectFakeSign(" HOLA ")}>HOLA</button>
        </section>
        */}

        {message && <p style={styles.message}>{message}</p>}

        {showFeedback && (
          <section style={styles.modalBackdrop}>
            <div style={styles.feedbackCard}>
              <p style={styles.feedbackLabel}>Fin de la conversación</p>

              <h2 style={styles.feedbackTitle}>
                ¿Qué tan útil fue la aplicación?
              </h2>

              <p style={styles.feedbackDescription}>
                Tu evaluación ayuda a mejorar la experiencia de comunicación.
              </p>

              <div style={styles.feedbackSummary}>
                <div style={styles.summaryCard}>
                  <strong>{finalSessionData?.duration_seconds || 0}s</strong>
                  <span>Duración</span>
                </div>

                <div style={styles.summaryCard}>
                  <strong>
                    {finalSessionData?.translations_count || translationsCount}
                  </strong>
                  <span>Traducciones</span>
                </div>
              </div>

              <div style={styles.emojiGrid}>
                <button style={styles.emojiButton} onClick={() => sendFeedback(1)}>
                  <span>😞</span>
                  <small>1</small>
                </button>

                <button style={styles.emojiButton} onClick={() => sendFeedback(2)}>
                  <span>😕</span>
                  <small>2</small>
                </button>

                <button style={styles.emojiButton} onClick={() => sendFeedback(3)}>
                  <span>😐</span>
                  <small>3</small>
                </button>

                <button style={styles.emojiButton} onClick={() => sendFeedback(4)}>
                  <span>🙂</span>
                  <small>4</small>
                </button>

                <button style={styles.emojiButton} onClick={() => sendFeedback(5)}>
                  <span>😍</span>
                  <small>5</small>
                </button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "18px",
    background:
      "radial-gradient(circle at 20% 0%, rgba(96,165,250,0.35), transparent 32%), radial-gradient(circle at 90% 20%, rgba(251,146,60,0.22), transparent 30%), linear-gradient(145deg, #f7efe4 0%, #eef4ff 45%, #fffaf3 100%)",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
  },

  phone: {
    width: "390px",
    minHeight: "760px",
    maxHeight: "92vh",
    position: "relative",
    overflow: "hidden",
    borderRadius: "38px",
    padding: "20px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,250,243,0.88))",
    border: "1px solid rgba(255,255,255,0.85)",
    boxShadow:
      "0 34px 80px rgba(55,65,81,0.26), inset 0 1px 0 rgba(255,255,255,0.95)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },

  eyebrow: {
    margin: "0 0 4px",
    color: "#b7794f",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#111827",
    fontSize: "34px",
    lineHeight: 1,
    letterSpacing: "-0.055em",
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "9px 12px",
    borderRadius: "999px",
    color: "#166534",
    background: "rgba(220,252,231,0.92)",
    fontSize: "12px",
    fontWeight: 800,
    boxShadow: "0 8px 18px rgba(34,197,94,0.16)",
  },

  idleBadge: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "9px 12px",
    borderRadius: "999px",
    color: "#475569",
    background: "rgba(241,245,249,0.92)",
    fontSize: "12px",
    fontWeight: 800,
  },

  liveDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 5px rgba(34,197,94,0.16)",
  },

  idleDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#94a3b8",
  },

  cameraShell: {
    height: "510px",
    position: "relative",
    overflow: "hidden",
    borderRadius: "34px",
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.7)",
    boxShadow:
      "0 24px 55px rgba(15,23,42,0.24), inset 0 1px 0 rgba(255,255,255,0.16)",
  },

  topCameraOverlay: {
    position: "absolute",
    top: "14px",
    left: "14px",
    right: "14px",
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "18px",
    color: "white",
    background: "rgba(0,0,0,0.38)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  cameraStatusLabel: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.72)",
    fontWeight: 700,
  },

  cameraStatusText: {
    fontSize: "13px",
    color: "white",
  },

  translationOverlay: {
    position: "absolute",
    left: "14px",
    right: "14px",
    bottom: "14px",
    zIndex: 10,
    padding: "16px",
    borderRadius: "24px",
    background: "rgba(0,0,0,0.58)",
    color: "white",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  },

  overlayLabel: {
    margin: "0 0 8px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.68)",
  },

  overlayText: {
    minHeight: "42px",
    maxHeight: "110px",
    overflowY: "auto",
    fontSize: "30px",
    fontWeight: 850,
    letterSpacing: "-0.04em",
    lineHeight: 1.12,
    wordBreak: "break-word",
  },

  infoRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "14px",
  },

  infoCard: {
    padding: "13px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(226,217,205,0.86)",
    boxShadow: "0 10px 24px rgba(67,56,46,0.08)",
  },

  controls: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: "10px",
    marginTop: "14px",
  },

  primaryButton: {
    height: "52px",
    border: "none",
    borderRadius: "19px",
    color: "white",
    cursor: "pointer",
    fontWeight: 850,
    fontSize: "15px",
    background: "linear-gradient(145deg, #315f9e, #4479b7)",
    boxShadow: "0 14px 28px rgba(49,95,158,0.28)",
  },

  secondaryButton: {
    height: "52px",
    border: "none",
    borderRadius: "19px",
    color: "#1f2937",
    cursor: "pointer",
    fontWeight: 850,
    fontSize: "15px",
    background: "rgba(255,255,255,0.86)",
    border: "1px solid rgba(226,217,205,0.9)",
  },

  finishButton: {
    height: "52px",
    border: "none",
    borderRadius: "19px",
    color: "#991b1b",
    cursor: "pointer",
    fontWeight: 850,
    fontSize: "15px",
    background: "rgba(254,226,226,0.92)",
  },

  message: {
    margin: "12px 4px 0",
    textAlign: "center",
    color: "#6b5f55",
    fontSize: "13px",
    fontWeight: 700,
  },

  modalBackdrop: {
    position: "absolute",
    inset: 0,
    zIndex: 50,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    background: "rgba(15,23,42,0.62)",
    backdropFilter: "blur(10px)",
  },

  feedbackCard: {
    width: "100%",
    padding: "24px",
    borderRadius: "30px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,250,243,0.94))",
    boxShadow: "0 28px 70px rgba(15,23,42,0.38)",
    border: "1px solid rgba(255,255,255,0.78)",
  },

  feedbackLabel: {
    margin: "0 0 8px",
    color: "#c08457",
    fontSize: "12px",
    fontWeight: 850,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  feedbackTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "25px",
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
  },

  feedbackDescription: {
    margin: "12px 0 18px",
    color: "#6b5f55",
    fontSize: "14px",
    lineHeight: 1.4,
  },

  feedbackSummary: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "18px",
  },

  summaryCard: {
    padding: "13px",
    borderRadius: "18px",
    background: "#f8fafc",
    border: "1px solid rgba(226,232,240,0.9)",
  },

  emojiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "8px",
  },

  emojiButton: {
    border: "none",
    borderRadius: "18px",
    padding: "10px 4px",
    background: "#f3f4f6",
    cursor: "pointer",
    color: "#111827",
    fontWeight: 850,
  },
};

export default Translator;