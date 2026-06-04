import { useCallback, useRef, useState } from "react";
import HandCamera from "../components/HandCamera";
import { classifyHandLandmarks } from "../utils/signClassifier";
import {
  createSession,
  saveTranslation,
  saveFeedback,
} from "../services/api";
import "../App.css";

function Translator() {
  const [session, setSession] = useState(null);
  const [textBuffer, setTextBuffer] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [message, setMessage] = useState("");
  const [currentSign, setCurrentSign] = useState("Sin seña");

  const lastPredictionRef = useRef({
    label: null,
    time: 0,
  });

  const handleLandmarksDetected = useCallback(
    async (landmarks) => {
      const prediction = classifyHandLandmarks(landmarks);

      if (!prediction) {
        setCurrentSign("Mano detectada, pero sin clasificar");
        return;
      }

      setCurrentSign(
        `${prediction.label} (${Math.round(prediction.confidence * 100)}%)`
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
    try {
      const newSession = await createSession();
      setSession(newSession);
      setTextBuffer("");
      setIsRunning(true);
      setMessage("Sesión iniciada correctamente con backend");
    } catch (error) {
      console.error(error);

      setSession({
        id: null,
        demo: true,
      });

      setTextBuffer("");
      setIsRunning(true);
      setMessage("Modo demo activo: cámara y MediaPipe funcionando sin backend");
    }
  };

  const pauseConversation = () => {
    setIsRunning(false);
    setMessage("Reconocimiento pausado");
  };

  const resumeConversation = () => {
    if (!session) {
      setMessage("Primero debes iniciar una sesión");
      return;
    }

    setIsRunning(true);
    setMessage("Reconocimiento activo");
  };

  const clearText = () => {
    setTextBuffer("");
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

    setIsRunning(false);
    setShowFeedback(true);
  };

  const sendFeedback = async (rating) => {
    try {
      if (session?.id) {
        await saveFeedback(session.id, rating);
        setMessage(`Feedback guardado: ${rating}/5`);
      } else {
        setMessage(`Feedback registrado en modo demo: ${rating}/5`);
      }

      setShowFeedback(false);
      setSession(null);
      setIsRunning(false);
      setTextBuffer("");
    } catch (error) {
      console.error(error);
      setMessage(`Feedback registrado localmente: ${rating}/5`);
      setShowFeedback(false);
      setSession(null);
      setIsRunning(false);
      setTextBuffer("");
    }
  };

  return (
    <main className="app-container">
      <section className="phone-frame">
        <header className="app-header">
          <h1>EnseñaVos</h1>
          <p>Traductor en tiempo real</p>
        </header>

        <section className="camera-box">
          <HandCamera
            isRunning={isRunning}
            onLandmarksDetected={handleLandmarksDetected}
          />
        </section>

        <section className="subtitle-box">
          <p className="label">Texto detectado</p>
          <div className="detected-text">
            {textBuffer || "Aquí aparecerá la traducción..."}
          </div>
        </section>

        <p className="message">Seña actual: {currentSign}</p>

        <section className="controls">
          {!session && <button onClick={startConversation}>Iniciar</button>}

          {session && !isRunning && (
            <button onClick={resumeConversation}>Continuar</button>
          )}

          {session && isRunning && (
            <button onClick={pauseConversation}>Pausar</button>
          )}

          <button onClick={clearText}>Limpiar</button>
          <button onClick={finishConversation}>Finalizar</button>
        </section>

        <section className="fake-signs">
          <p>Prueba temporal de señas:</p>
          <button onClick={() => detectFakeSign("A")}>A</button>
          <button onClick={() => detectFakeSign("B")}>B</button>
          <button onClick={() => detectFakeSign("C")}>C</button>
          <button onClick={() => detectFakeSign(" HOLA ")}>HOLA</button>
        </section>

        {message && <p className="message">{message}</p>}

        {showFeedback && (
          <section className="feedback-modal">
            <div className="feedback-card">
              <h2>¿Qué tan útil fue la aplicación?</h2>
              <div className="stars">
                <button onClick={() => sendFeedback(1)}>1</button>
                <button onClick={() => sendFeedback(2)}>2</button>
                <button onClick={() => sendFeedback(3)}>3</button>
                <button onClick={() => sendFeedback(4)}>4</button>
                <button onClick={() => sendFeedback(5)}>5</button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default Translator;