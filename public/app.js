import { OpenAIAudio } from "./openai-audio.js";
const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const LANGUAGE_LABELS = {
  pl: "Polski",
  fr: "Francuski",
};

const SPEECH_RECOGNITION_LANG = {
  pl: "pl-PL",
  fr: "fr-FR",
};

const SPEECH_SYNTHESIS_LANG = {
  pl: "pl-PL",
  fr: "fr-FR",
};

const VOICE_TEST_TEXT = {
  pl: "Dzien dobry, to jest test glosu.",
  fr: "Bonjour, ceci est un test de voix.",
};

const UI_TEXT = {
  pl: {
    eyebrow: "Realtime Voice Translator MVP",
    title: "Rozmowa PL <-> FR",
    modeNote: "Tryb testowy bez GPT: sprawdzamy pokoj, dwie strony rozmowy i glos z przegladarki.",
    roomLabel: "Pokoj",
    myLanguageLabel: "Moj jezyk",
    peerLanguageLabel: "Jezyk rozmowcy",
    pinLabel: "PIN testowy",
    statusLabel: "Status",
    roomStatusLabel: "Pokoj",
    mySpeechTitle: "Moja wypowiedz",
    listeningBadge: "nasluch",
    peerPlaybackTitle: "Odsluch rozmowcy",
    voiceLabel: "Glos dla mojego jezyka",
    originalTitle: "Oryginal",
    translationTitle: "Tlumaczenie",
    eventsTitle: "Zdarzenia",
    connect: "Dolacz",
    disconnect: "Rozlacz",
    startSpeech: "Start mowy",
    stopSpeech: "Stop mowy",
    send: "Wyslij",
    testVoice: "Test glosu",
    clear: "Wyczysc",
    ready: "Gotowe",
    connecting: "Laczenie",
    connected: "Polaczono",
    disconnected: "Rozlaczono",
    roomRequired: "Podaj nazwe pokoju.",
    pinRequired: "Wpisz PIN testowy.",
    roomConnectFailed: "Nie udalo sie polaczyc z pokojem.",
    joinFirst: "Najpierw dolacz do pokoju.",
    speechUnsupported: "Ta przegladarka nie obsluguje lokalnego rozpoznawania mowy.",
    noRoomConnection: "Brak aktywnego polaczenia z pokojem.",
    defaultVoice: "Domyslny glos",
    manualPlaceholderPl: "Napisz po polsku",
    manualPlaceholderFr: "Ecris en francais",
    participantJoined: "Dolaczono jako uczestnik",
    roomConnectingLog: "Laczenie z pokojem",
    connectionClosedLog: "Polaczenie zamkniete",
    restartConnectionLog: "Restart polaczenia",
    closingPageLog: "Zamykanie strony",
    speechStartedLog: "Rozpoznawanie mowy aktywne",
    speechStoppedLog: "Rozpoznawanie mowy zatrzymane",
    audioCaptureStartedLog: "Nagrywanie audio do Groq aktywne",
    audioCaptureStoppedLog: "Nagrywanie audio zatrzymane",
    speechProcessingLog: "Groq przetwarza fragment audio",
    speechIgnoredLog: "Pominieto pusty fragment audio",
    translationModeLog: "Tryb tlumaczenia",
    mediaRecorderUnsupported: "Ta przegladarka nie obsluguje nagrywania audio.",
    microphoneError: "Nie udalo sie uzyskac dostepu do mikrofonu.",
    audioSendError: "Nie udalo sie wyslac fragmentu audio.",
    audioBusyLog: "Pomijam fragment, poprzedni nadal sie przetwarza",
    unknownEventLog: "Nieznane zdarzenie",
    errorPrefix: "Blad",
    me: "Ja",
    peer: "Rozmowca",
    forMe: "Dla mnie",
    forPeer: "Dla rozmowcy",
    people: "osoby",
  },
  fr: {
    eyebrow: "MVP Traducteur vocal en temps reel",
    title: "Conversation FR <-> PL",
    modeNote: "Mode test sans GPT : nous verifions le salon, les deux participants et la voix du navigateur.",
    roomLabel: "Salon",
    myLanguageLabel: "Ma langue",
    peerLanguageLabel: "Langue de l'autre personne",
    pinLabel: "PIN de test",
    statusLabel: "Statut",
    roomStatusLabel: "Salon",
    mySpeechTitle: "Ma phrase",
    listeningBadge: "ecoute",
    peerPlaybackTitle: "Ecoute de l'autre personne",
    voiceLabel: "Voix dans ma langue",
    originalTitle: "Original",
    translationTitle: "Traduction",
    eventsTitle: "Evenements",
    connect: "Rejoindre",
    disconnect: "Quitter",
    startSpeech: "Demarrer la voix",
    stopSpeech: "Arreter la voix",
    send: "Envoyer",
    testVoice: "Tester la voix",
    clear: "Effacer",
    ready: "Pret",
    connecting: "Connexion",
    connected: "Connecte",
    disconnected: "Deconnecte",
    roomRequired: "Indique le nom du salon.",
    pinRequired: "Saisis le PIN de test.",
    roomConnectFailed: "Impossible de se connecter au salon.",
    joinFirst: "Rejoins d'abord le salon.",
    speechUnsupported: "Ce navigateur ne prend pas en charge la reconnaissance vocale locale.",
    noRoomConnection: "Aucune connexion active au salon.",
    defaultVoice: "Voix par defaut",
    manualPlaceholderPl: "Napisz po polsku",
    manualPlaceholderFr: "Ecris en francais",
    participantJoined: "Connecte comme participant",
    roomConnectingLog: "Connexion au salon",
    connectionClosedLog: "Connexion fermee",
    restartConnectionLog: "Redemarrage de la connexion",
    closingPageLog: "Fermeture de la page",
    speechStartedLog: "Reconnaissance vocale active",
    speechStoppedLog: "Reconnaissance vocale arretee",
    audioCaptureStartedLog: "Enregistrement audio vers Groq actif",
    audioCaptureStoppedLog: "Enregistrement audio arrete",
    speechProcessingLog: "Groq traite un fragment audio",
    speechIgnoredLog: "Fragment audio vide ignore",
    translationModeLog: "Mode de traduction",
    mediaRecorderUnsupported: "Ce navigateur ne prend pas en charge l'enregistrement audio.",
    microphoneError: "Impossible d'acceder au microphone.",
    audioSendError: "Impossible d'envoyer le fragment audio.",
    audioBusyLog: "Fragment ignore, le precedent est encore en traitement",
    unknownEventLog: "Evenement inconnu",
    errorPrefix: "Erreur",
    me: "Moi",
    peer: "Interlocuteur",
    forMe: "Pour moi",
    forPeer: "Pour l'autre personne",
    people: "personnes",
  },
};

const elements = {
  roomId: document.querySelector("#roomId"),
  myLanguage: document.querySelector("#myLanguage"),
  peerLanguage: document.querySelector("#peerLanguage"),
  demoPin: document.querySelector("#demoPin"),
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  startSpeechButton: document.querySelector("#startSpeechButton"),
  stopSpeechButton: document.querySelector("#stopSpeechButton"),
  sendTextButton: document.querySelector("#sendTextButton"),
  manualForm: document.querySelector("#manualForm"),
  manualText: document.querySelector("#manualText"),
  testVoiceButton: document.querySelector("#testVoiceButton"),
  voiceSelect: document.querySelector("#voiceSelect"),
  clearLogButton: document.querySelector("#clearLogButton"),
  connectionStatus: document.querySelector("#connectionStatus"),
  roomStatus: document.querySelector("#roomStatus"),
  errorBanner: document.querySelector("#errorBanner"),
  sourceTranscript: document.querySelector("#sourceTranscript"),
  targetTranscript: document.querySelector("#targetTranscript"),
  sourcePartial: document.querySelector("#sourcePartial"),
  speechStatus: document.querySelector("#speechStatus"),
  eventLog: document.querySelector("#eventLog"),
};

const i18nElements = [...document.querySelectorAll("[data-i18n]")];

const state = {
  socket: null,
  clientId: "",
  roomId: "",
  myLanguage: "pl",
  recognition: null,
  audioContext: null,
  audioSourceNode: null,
  audioProcessorNode: null,
  audioBuffers: [],
  audioSampleCount: 0,
  audioEnergy: 0,
  mediaStream: null,
  audioChunkInFlight: false,
  pendingAudioBlob: null,
  audioChunkMs: 2500,
  translationMode: "mock",
  requiresDemoPin: true,
  sourceTranscription: false,
  maxSessionSeconds: 300,
  estimatedUsdPerMinute: 0.034,
  openaiPending: false,
  openaiRequested: false,
  openaiClosing: false,
  openaiAttempt: 0,
  openaiSessionId: "",
  sentSeconds: 0,
  totalEstimatedUsd: 0,
  transcriptLines: new Map(),
  connected: false,
  connecting: false,
  peerPresent: false,
  peerSpeaking: false,
  testingMic: false,
  sessionStartedAt: 0,
  joinTimer: null,
  wakeLock: null,
  voices: [],
};

const openaiAudio = new OpenAIAudio(audio => {
  if (!state.openaiSessionId || !state.connected) return;
  if (state.socket.bufferedAmount > 256000) { stopOpenAI(); showError(t("audio_backpressure")); return; }
  sendSocket({ type: "openai_audio", audio, sessionId: state.openaiSessionId });
  state.sentSeconds += 0.2;
  updateUsage();
}, code => { stopOpenAI(); showError(t(code)); }, level => { document.querySelector("#micLevel").value = level; });

Object.assign(UI_TEXT.pl, {
  openaiNote: "Tłumaczenie głosowe polski ↔ francuski. Dołączcie do tego samego pokoju, wybierzcie różne języki i użyjcie słuchawek. Każdy włącza swój mikrofon przyciskiem Start mowy.",
  groqNote: "Tłumaczenie przez Groq; głos odczytuje przeglądarka.",
  missing_openai_key: "Brak klucza OpenAI na serwerze. Uzupełnij OPENAI_API_KEY w pliku .env i uruchom ponownie serwer.",
  peer_required: "Poczekaj, aż do pokoju dołączy rozmówca z drugim językiem.",
  room_full: "Ten język jest już zajęty lub pokój ma dwóch uczestników.",
  openai_connection_failed: "Nie udało się połączyć z OpenAI. Sprawdź klucz, dostęp do modelu, saldo i połączenie internetowe.",
  openai_rejected: "OpenAI odrzuciło sesję. Sprawdź dostęp do modelu i wybranej pary języków na swoim koncie.",
  openai_timeout: "OpenAI nie odpowiedziało na czas. Spróbuj ponownie.",
  start_rate_limit: "Odczekaj chwilę przed ponownym uruchomieniem.",
  secure_microphone_required: "Mikrofon wymaga aktualnej przeglądarki oraz HTTPS lub localhost.",
  audio_backpressure: "Połączenie nie nadąża z dźwiękiem. Mikrofon został zatrzymany.",
  playback_blocked: "Odtwarzanie jest zablokowane. Kliknij Włącz dźwięk.",
  playback_delayed: "Zbyt duże opóźnienie dźwięku. Zatrzymajcie i ponówcie test.",
  microphone_ended: "Mikrofon został odłączony.",
  openaiStarting: "Łączenie z tłumaczem…", openaiStarted: "Tłumaczenie głosu aktywne",
  time_limit: "Zakończono test po osiągnięciu limitu czasu.", peer_left: "Rozmówca wyszedł. Mikrofon zatrzymany.",
  audio_timeout: "Brak dźwięku z mikrofonu. Sesja zatrzymana.", upstream_closed: "OpenAI zakończyło połączenie.",
  usageLabel: "Szacowany koszt mojego mikrofonu", sessionLimit: "Limit jednego testu",
  sourceOff: "Zapis oryginału wyłączony, aby ograniczyć koszt. Tłumaczenie pojawi się po prawej.",
  enableAudio: "Włącz dźwięk", stopped: "Mikrofon zatrzymany", voice_only: "W tym trybie użyj mikrofonu.",
  healthFailed: "Nie można odczytać konfiguracji serwera. Odśwież stronę.",
});
Object.assign(UI_TEXT.fr, {
  openaiNote: "Traduction vocale polonais ↔ français. Rejoignez le même salon, choisissez des langues différentes et utilisez un casque. Chaque personne active son microphone avec Démarrer la voix.",
  groqNote: "Traduction via Groq ; lecture par la voix du navigateur.",
  missing_openai_key: "Clé OpenAI manquante sur le serveur. Renseignez OPENAI_API_KEY dans .env et redémarrez le serveur.",
  peer_required: "Attendez une personne parlant l'autre langue dans le salon.",
  room_full: "Cette langue est déjà occupée ou le salon contient deux personnes.",
  openai_connection_failed: "Connexion à OpenAI impossible. Vérifiez la clé, l'accès au modèle, le solde et Internet.",
  openai_rejected: "OpenAI a refusé la session. Vérifiez l'accès au modèle et aux langues sur votre compte.",
  openai_timeout: "OpenAI ne répond pas. Réessayez.", start_rate_limit: "Patientez avant de redémarrer.",
  secure_microphone_required: "Le microphone nécessite un navigateur récent et HTTPS ou localhost.",
  audio_backpressure: "Connexion trop lente. Le microphone a été arrêté.",
  playback_blocked: "Lecture bloquée. Cliquez sur Activer le son.",
  playback_delayed: "Le son a trop de retard. Arrêtez puis relancez le test.",
  microphone_ended: "Microphone déconnecté.", openaiStarting: "Connexion au traducteur…", openaiStarted: "Traduction vocale active",
  time_limit: "La durée maximale du test est atteinte.", peer_left: "L'autre personne est partie. Microphone arrêté.",
  audio_timeout: "Aucun son reçu du microphone. Session arrêtée.", upstream_closed: "OpenAI a fermé la connexion.",
  usageLabel: "Coût estimé de mon microphone", sessionLimit: "Durée maximale par test",
  sourceOff: "Transcription originale désactivée pour réduire le coût. La traduction apparaît à droite.",
  enableAudio: "Activer le son", stopped: "Microphone arrêté", voice_only: "Utilisez le microphone dans ce mode.",
  healthFailed: "Configuration du serveur indisponible. Actualisez la page.",
});


Object.assign(UI_TEXT.pl, {
  eyebrow:"DWA JĘZYKI. JEDNA ROZMOWA.", title:"Porozmawiajmy.",
  openaiNote:"Ty mówisz po polsku. Druga osoba słyszy po francusku — i odwrotnie. Spotkajcie się tutaj, każde na swoim urządzeniu.",
  setupTitle:"Wasze miejsce do rozmowy", callTitle:"Słuchamy się nawzajem", roomLabel:"Nazwa pokoju", myLanguageLabel:"Mój język", pinLabel:"Kod dostępu", pinRequired:"Wpisz kod dostępu otrzymany od organizatora.",
  connect:"Dołącz do rozmowy", disconnect:"Wyjdź", startSpeech:"Włącz mikrofon", stopSpeech:"Wyłącz mikrofon", connected:"W pokoju", connecting:"Łączymy…", disconnected:"Rozłączono", ready:"Gotowe",
  mySpeechTitle:"Twój mikrofon", peerPlaybackTitle:"Twój rozmówca", listeningBadge:"Na żywo", translationTitle:"Wasza rozmowa", captions:"Napisy na żywo", emptyTranscript:"Pierwsze słowa pojawią się tutaj.",
  invite:"Kopiuj zaproszenie ↗", inviteNote:"Zaproszenie zawiera kod dostępu. Udostępnij je tylko rozmówcy.", inviteCopied:"Link skopiowany. Otworzy rozmówcy ten sam pokój i drugi język.", copyLink:"Skopiuj ten link", inviteFirst:"Wpisz kod dostępu przed skopiowaniem zaproszenia.",
  micOff:"Wyłączony", micOn:"Mów swobodnie", peerWaiting:"Czekamy na drugą osobę", peerReady:"W pokoju · mikrofon wyłączony", peerOn:"Mikrofon włączony", joinHint:"Dołącz do pokoju, a następnie zaproś drugą osobę.", waitingHint:"Gdy rozmówca dołączy, możecie włączyć mikrofony.", readyHint:"Jesteście razem. Każda osoba włącza swój mikrofon.", activeHint:"Tłumaczenie trwa. Cisza także wlicza się do czasu sesji.",
  micTest:"Sprawdź mikrofon", micTesting:"Powiedz kilka słów — sprawdzamy mikrofon lokalnie.", micPassed:"Mikrofon działa. Test zakończony, dźwięk nie został wysłany do API.", micQuiet:"Mikrofon nie wykrył głosu. Sprawdź wybrane urządzenie i spróbuj ponownie.",
  microphoneError:"Nie udało się uruchomić mikrofonu. Zezwól na dostęp w ustawieniach strony i sprawdź, czy mikrofon jest podłączony.",
  enableAudio:"Sprawdź dźwięk", soundPassed:"Dźwięk włączony. Powinien być słyszalny krótki sygnał.",
  headphonesTitle:"Załóżcie słuchawki.", headphonesNote:"Mówcie naturalnie, zostawiając chwilę na tłumaczenie. Podczas testu pozostawcie stronę otwartą i ekran odblokowany.",
  privacyNote:"Po włączeniu mikrofonu dźwięk trafia do OpenAI w celu tłumaczenia. Aplikacja nie zapisuje nagrań. Tłumaczenie może zawierać błędy.",
  eventsTitle:"Szczegóły połączenia", clear:"Wyczyść", usageLabel:"Szacunkowo za Twój mikrofon", sessionLimit:"Limit sesji",
  connectionLost:"Połączenie zostało przerwane. Mikrofon jest wyłączony. Kliknij Dołącz do rozmowy, aby spróbować ponownie.", hiddenPause:"Mikrofon zatrzymany po ukryciu strony. Po powrocie możesz go włączyć ponownie.",
  invalid_demo_pin:"Nieprawidłowy kod dostępu. Sprawdź zaproszenie.", too_many_attempts:"Zbyt wiele błędnych kodów. Spróbuj ponownie za minutę.", server_busy:"Trwa już inna rozmowa. Spróbuj ponownie za chwilę.", budget_limit:"Osiągnięto limit czasu dostępny na testy. Skontaktuj się z organizatorem.",
  invalid_audio:"Wystąpił problem z dźwiękiem. Wyłącz i ponownie włącz mikrofon.", unsupported_output_audio:"Nie można odtworzyć dźwięku tłumaczenia.", invalid_openai_response:"Usługa tłumaczenia zwróciła nieprawidłową odpowiedź. Spróbuj ponownie.",
  missing_openai_key:"Tłumaczenie nie jest jeszcze skonfigurowane. Skontaktuj się z organizatorem.", openai_rejected:"Usługa nie przyjęła tłumaczenia. Organizator powinien sprawdzić saldo i dostęp do modelu.",
  stopped:"Mikrofon zatrzymany", setup_failed:"Nie udało się rozpocząć tłumaczenia.", disconnected:"Rozłączono", already_joined:"Jesteś już w pokoju.",
});
Object.assign(UI_TEXT.fr, {
  eyebrow:"DEUX LANGUES. UNE CONVERSATION.", title:"On se parle ?",
  openaiNote:"Vous parlez français. L’autre personne vous entend en polonais — et inversement. Retrouvez-vous ici, chacun sur son appareil.",
  setupTitle:"Votre espace de conversation", callTitle:"À l’écoute, ensemble", roomLabel:"Nom du salon", myLanguageLabel:"Ma langue", pinLabel:"Code d’accès", pinRequired:"Saisissez le code d’accès reçu de l’organisateur.",
  connect:"Rejoindre le salon", disconnect:"Quitter", startSpeech:"Activer le micro", stopSpeech:"Couper le micro", connected:"Dans le salon", connecting:"Connexion…", disconnected:"Déconnecté", ready:"Prêt",
  mySpeechTitle:"Votre microphone", peerPlaybackTitle:"Votre interlocuteur", listeningBadge:"En direct", translationTitle:"Votre conversation", captions:"Sous-titres en direct", emptyTranscript:"Les premiers mots apparaîtront ici.",
  invite:"Copier l’invitation ↗", inviteNote:"L’invitation contient le code d’accès. Partagez-la uniquement avec votre interlocuteur.", inviteCopied:"Lien copié. Il ouvre le même salon dans l’autre langue.", copyLink:"Copiez ce lien", inviteFirst:"Saisissez le code d’accès avant de copier l’invitation.",
  micOff:"Désactivé", micOn:"Parlez naturellement", peerWaiting:"En attente de l’autre personne", peerReady:"Dans le salon · micro coupé", peerOn:"Microphone activé", joinHint:"Rejoignez le salon, puis invitez l’autre personne.", waitingHint:"Vous pourrez activer les micros quand l’autre personne sera là.", readyHint:"Vous êtes ensemble. Chaque personne active son micro.", activeHint:"Traduction en cours. Le silence compte aussi dans la durée.",
  micTest:"Tester le micro", micTesting:"Dites quelques mots — test local du microphone.", micPassed:"Le microphone fonctionne. Test terminé, aucun son envoyé à l’API.", micQuiet:"Aucune voix détectée. Vérifiez votre microphone puis réessayez.",
  microphoneError:"Impossible d’activer le micro. Autorisez son accès dans les paramètres du site et vérifiez qu’il est branché.",
  enableAudio:"Tester le son", soundPassed:"Son activé. Vous devriez entendre un bref signal.",
  headphonesTitle:"Utilisez un casque.", headphonesNote:"Parlez naturellement en laissant un instant à la traduction. Gardez cette page ouverte et l’écran déverrouillé pendant le test.",
  privacyNote:"Lorsque le micro est activé, le son est transmis à OpenAI pour être traduit. L’application ne sauvegarde pas les enregistrements. La traduction peut contenir des erreurs.",
  eventsTitle:"Détails de la connexion", clear:"Effacer", usageLabel:"Estimation pour votre micro", sessionLimit:"Durée par session",
  connectionLost:"Connexion interrompue. Le microphone est coupé. Cliquez sur Rejoindre le salon pour réessayer.", hiddenPause:"Micro coupé car la page est masquée. Vous pouvez le réactiver à votre retour.",
  invalid_demo_pin:"Code d’accès incorrect. Vérifiez votre invitation.", too_many_attempts:"Trop de codes incorrects. Réessayez dans une minute.", server_busy:"Une autre conversation est en cours. Réessayez dans un instant.", budget_limit:"La durée disponible pour les tests est épuisée. Contactez l’organisateur.",
  invalid_audio:"Problème audio. Coupez puis réactivez le microphone.", unsupported_output_audio:"Impossible de lire le son traduit.", invalid_openai_response:"Réponse incorrecte du service de traduction. Réessayez.",
  missing_openai_key:"La traduction n’est pas encore configurée. Contactez l’organisateur.", openai_rejected:"Traduction refusée. L’organisateur doit vérifier le solde et l’accès au modèle.",
  stopped:"Microphone arrêté", setup_failed:"Impossible de démarrer la traduction.", already_joined:"Vous êtes déjà dans le salon.",
});
const invitation = new URLSearchParams(location.hash.slice(1));
elements.roomId.value = normalizeRoomId(invitation.get("room") ?? "") || "salon-" + crypto.randomUUID().slice(0,8);
elements.myLanguage.value = invitation.get("lang") === "fr" || (!invitation.has("lang") && navigator.language.startsWith("fr")) ? "fr" : "pl";
elements.demoPin.value = invitation.get("pin") ?? "";
// A fragment is not sent to the server. Remove the access code from the address bar after importing it.
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
document.querySelector("#setupForm").addEventListener("submit", event => { event.preventDefault(); void connectRoom(); });
document.querySelector("#inviteButton").addEventListener("click", copyInvitation);
document.querySelector("#micTestButton").addEventListener("click", testMicrophone);
window.addEventListener("offline", () => { disconnectRoom(t("connectionLost")); showError(t("connectionLost")); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (state.openaiRequested || state.openaiPending)) { stopOpenAI(); logEvent(t("hiddenPause")); }
});
setInterval(updateCallUi, 500);

elements.connectButton.addEventListener("click", connectRoom);
elements.disconnectButton.addEventListener("click", () => disconnectRoom(t("disconnected")));
elements.startSpeechButton.addEventListener("click", startSpeechRecognition);
elements.stopSpeechButton.addEventListener("click", stopSpeechRecognition);
elements.testVoiceButton.addEventListener("click", () => {
  if (state.translationMode === "openai") openaiAudio.testSound().then(() => { clearError(); document.querySelector("#micTestResult").textContent = t("soundPassed"); }).catch(() => showError(t("playback_blocked")));
  else speakText(VOICE_TEST_TEXT[state.myLanguage]);
});
elements.manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendManualText();
});
elements.clearLogButton.addEventListener("click", () => {
  elements.eventLog.innerHTML = "";
});
elements.myLanguage.addEventListener("change", () => {
  state.myLanguage = getSelectedLanguage();
  updateLanguageUi();
  loadVoices();
});

window.addEventListener("beforeunload", () => disconnectRoom("Zamykanie strony"));

state.myLanguage = getSelectedLanguage();
loadVoices();
updateLanguageUi();
setConnectionState(false);
let healthReady = loadBackendHealth();

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

async function connectRoom() {
  if (state.connecting || state.connected || state.testingMic) return;
  state.connecting = true; updateCallUi();
  if (!await healthReady) healthReady = loadBackendHealth();
  if (!await healthReady) { state.connecting = false; updateCallUi(); showError(t("healthFailed")); return; }
  clearError();
  resetTranscripts();

  const roomId = normalizeRoomId(elements.roomId.value);
  const myLanguage = getSelectedLanguage();

  if (!roomId) {
    showError(t("roomRequired")); state.connecting = false; updateCallUi();
    return;
  }

  if (state.requiresDemoPin && !elements.demoPin.value.trim()) {
    showError(t("pinRequired")); state.connecting = false; updateCallUi();
    return;
  }

  disconnectRoom(t("restartConnectionLog"), { silent: true });
  state.connecting = true; updateCallUi();

  if (state.translationMode === "openai") {
    try { await openaiAudio.unlock(); } catch { state.connecting = false; updateCallUi(); showError(t("playback_blocked")); return; }
  }
  const socket = new WebSocket(WS_URL);
  state.socket = socket;
  state.joinTimer = setTimeout(() => { if (state.socket === socket && !state.connected) { disconnectRoom(t("connectionLost")); showError(t("connectionLost")); } }, 15000);
  state.roomId = roomId;
  state.myLanguage = myLanguage;

  setStatus(t("connecting"));
  logEvent(`${t("roomConnectingLog")} ${roomId}`);

  socket.addEventListener("open", () => {
    if (state.socket !== socket) return;
    sendSocket({
      type: "join",
      roomId,
      language: myLanguage,
      demoPin: elements.demoPin.value,
    });
  });

  socket.addEventListener("message", (event) => {
    if (state.socket !== socket) return;
    const message = JSON.parse(event.data);
    handleRoomMessage(message);
  });

  socket.addEventListener("close", () => {
    if (state.socket !== socket) return;
    clearTimeout(state.joinTimer);
    state.connecting = false; state.peerPresent = false;
    stopSpeechRecognition();
    showError(t("connectionLost"));
    state.openaiClosing = false;
    state.openaiRequested = false;
    openaiAudio.close();
    setConnectionState(false);
    setStatus(t("disconnected"));
    logEvent(t("connectionClosedLog"));
  });

  socket.addEventListener("error", () => {
    if (state.socket !== socket) return;
    showError(t("roomConnectFailed"));
  });
}

function disconnectRoom(reason, options = {}) {
  stopSpeechRecognition();
  openaiAudio.close();

  if (state.socket && state.socket.readyState <= WebSocket.OPEN) {
    state.socket.close();
  }

  clearTimeout(state.joinTimer);
  state.connecting = false; state.peerPresent = false; state.peerSpeaking = false;
  state.socket = null;
  state.clientId = "";
  state.connected = false;
  state.openaiClosing = false;
  state.openaiRequested = false;
  setConnectionState(false);
  setStatus(t("ready"));
  elements.roomStatus.textContent = "-";

  if (!options.silent) {
    logEvent(reason);
  }
}

function handleRoomMessage(message) {
  switch (message.type) {
    case "joined":
      clearTimeout(state.joinTimer); state.connecting = false;
      state.translationMode = message.translationMode ?? state.translationMode;
      renderProviderUi();
      state.clientId = message.clientId;
      setConnectionState(true);
      setStatus(t("connected"));
      updateRoomStatus(message.room);
      logEvent(`${t("participantJoined")}: ${LANGUAGE_LABELS[state.myLanguage]}`);
      break;
    case "presence":
      updateRoomStatus(message.room);
      break;
    case "openai_started":
      if (!state.openaiPending) { sendSocket({ type: "openai_stop" }); break; }
      state.openaiPending = false;
      state.openaiSessionId = message.sessionId;
      state.sentSeconds = 0;
      state.sessionStartedAt = Date.now();
      requestWakeLock();
      openaiAudio.start();
      elements.speechStatus.hidden = false;
      logEvent(t("openaiStarted"));
      break;
    case "openai_stopped":
      state.totalEstimatedUsd += Number(message.estimatedUsd ?? 0);
      state.sentSeconds = 0;
      stopOpenAI(false);
      updateUsage();
      logEvent(t(message.reason ?? "stopped"));
      if (["time_limit","budget_limit","audio_timeout","upstream_closed"].includes(message.reason)) showError(t(message.reason));
      break;
    case "openai_delta":
      handleOpenAIDelta(message);
      break;
    case "translation":
      handleTranslation(message);
      break;
    case "speech_processing":
      state.audioChunkInFlight = true;
      logEvent(t("speechProcessingLog"));
      break;
    case "speech_ignored":
      state.audioChunkInFlight = false;
      sendPendingAudioChunk();
      logEvent(t("speechIgnoredLog"));
      break;
    case "speech_processed":
      state.audioChunkInFlight = false;
      sendPendingAudioChunk();
      break;
    case "error":
      if (!state.connected) { clearTimeout(state.joinTimer); state.connecting = false; }
      state.audioChunkInFlight = false;
      sendPendingAudioChunk();
      if (state.translationMode === "openai" && message.code !== "session_active") { stopOpenAI(); state.openaiClosing = false; state.openaiRequested = false; elements.startSpeechButton.disabled = !state.connected; }
      showError(UI_TEXT[state.myLanguage][message.code] ?? message.message ?? t("roomConnectFailed"));
      break;
    case "pong":
      break;
    default:
      logEvent(message.type ?? "Nieznane zdarzenie");
  }
}

function handleTranslation(message) {
  const isMine = message.speakerId === state.clientId;
  const speakerLabel = isMine ? t("me") : t("peer");
  const sourceLanguage = LANGUAGE_LABELS[message.sourceLanguage] ?? message.sourceLanguage;
  const targetLanguage = LANGUAGE_LABELS[message.targetLanguage] ?? message.targetLanguage;

  appendTranscript(
    elements.sourceTranscript,
    `${speakerLabel} (${sourceLanguage}): ${message.sourceText}`,
    isMine,
  );
  appendTranscript(
    elements.targetTranscript,
    `${isMine ? t("forPeer") : t("forMe")} (${targetLanguage}): ${message.translatedText}`,
    isMine,
  );

  if (!isMine) {
    speakText(message.translatedText);
  }

  logEvent(`${t("translationModeLog")}: ${message.mode}`);
}

async function loadBackendHealth() {
  try {
    const response = await fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("health");
    const health = await response.json();
    state.translationMode = health.translationMode ?? "mock";
    state.audioChunkMs = Number(health.audioChunkMs ?? 2500);
    state.requiresDemoPin = health.requiresDemoPin;
    state.sourceTranscription = health.sourceTranscription;
    state.maxSessionSeconds = health.maxSessionSeconds ?? 300;
    state.estimatedUsdPerMinute = health.estimatedUsdPerMinute ?? 0.034;
    renderProviderUi();
    logEvent(`${t("translationModeLog")}: ${state.translationMode}`);
    return true;
  } catch (error) {
    console.warn("[health] failed", error);
    return false;
  }
}

function startSpeechRecognition() {
  clearError();

  if (!state.connected) {
    showError(t("joinFirst"));
    return;
  }

  if (state.translationMode === "openai") { void startOpenAI(); return; }

  if (state.translationMode === "groq") {
    startGroqAudioCapture();
    return;
  }

  if (!SpeechRecognition) {
    showError(t("speechUnsupported"));
    return;
  }

  stopSpeechRecognition();

  const recognition = new SpeechRecognition();
  recognition.lang = SPEECH_RECOGNITION_LANG[state.myLanguage];
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.addEventListener("start", () => {
    elements.speechStatus.hidden = false;
    elements.startSpeechButton.disabled = true;
    elements.stopSpeechButton.disabled = false;
    logEvent(t("speechStartedLog"));
  });

  recognition.addEventListener("result", (event) => {
    let interim = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript?.trim() ?? "";

      if (!transcript) {
        continue;
      }

      if (event.results[index].isFinal) {
        elements.sourcePartial.textContent = "";
        sendSourceText(transcript);
      } else {
        interim = transcript;
      }
    }

    elements.sourcePartial.textContent = interim;
  });

  recognition.addEventListener("error", (event) => {
    showError(`${t("startSpeech")}: ${event.error}`);
  });

  recognition.addEventListener("end", () => {
    elements.speechStatus.hidden = true;
    elements.stopSpeechButton.disabled = true;
    elements.startSpeechButton.disabled = !state.connected;
    logEvent(t("speechStoppedLog"));
  });

  state.recognition = recognition;
  recognition.start();
}

function stopSpeechRecognition() {
  if (state.translationMode === "openai") { stopOpenAI(); return; }
  if (!state.recognition) {
    stopGroqAudioCapture();
    return;
  }

  state.recognition.stop();
  state.recognition = null;
}

async function startGroqAudioCapture() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

  if (!navigator.mediaDevices?.getUserMedia || !AudioContextCtor) {
    showError(t("mediaRecorderUnsupported"));
    return;
  }

  stopGroqAudioCapture();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const audioContext = new AudioContextCtor();
    const sourceNode = audioContext.createMediaStreamSource(stream);
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    state.audioBuffers = [];
    state.audioSampleCount = 0;
    state.audioEnergy = 0;

    processorNode.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);

      state.audioBuffers.push(copy);
      state.audioSampleCount += copy.length;

      for (const sample of copy) {
        state.audioEnergy += sample * sample;
      }

      const chunkSamples = Math.floor(audioContext.sampleRate * (state.audioChunkMs / 1000));

      if (state.audioSampleCount >= chunkSamples) {
        flushWavSegment(audioContext.sampleRate);
      }
    };

    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    state.mediaStream = stream;
    state.audioContext = audioContext;
    state.audioSourceNode = sourceNode;
    state.audioProcessorNode = processorNode;

    elements.speechStatus.hidden = false;
    elements.startSpeechButton.disabled = true;
    elements.stopSpeechButton.disabled = false;
    logEvent(t("audioCaptureStartedLog"));
  } catch (error) {
    console.error("[audio] capture failed", error);
    showError(t("microphoneError"));
  }
}

function stopGroqAudioCapture() {
  const hadCapture = Boolean(
    state.audioContext ||
      state.audioProcessorNode ||
      state.audioSourceNode ||
      state.mediaStream,
  );

  if (state.audioSampleCount > 0 && state.audioContext) {
    flushWavSegment(state.audioContext.sampleRate);
  }

  if (state.audioProcessorNode) {
    state.audioProcessorNode.disconnect();
    state.audioProcessorNode.onaudioprocess = null;
  }

  if (state.audioSourceNode) {
    state.audioSourceNode.disconnect();
  }

  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close().catch(() => {});
  }

  if (state.mediaStream) {
    for (const track of state.mediaStream.getTracks()) {
      track.stop();
    }
  }

  state.audioContext = null;
  state.audioSourceNode = null;
  state.audioProcessorNode = null;
  state.audioBuffers = [];
  state.audioSampleCount = 0;
  state.audioEnergy = 0;
  state.mediaStream = null;
  state.audioChunkInFlight = false;
  state.pendingAudioBlob = null;
  elements.speechStatus.hidden = true;
  elements.stopSpeechButton.disabled = true;
  elements.startSpeechButton.disabled = !state.connected;

  if (hadCapture) {
    logEvent(t("audioCaptureStoppedLog"));
  }
}

function flushWavSegment(sampleRate) {
  if (!state.audioSampleCount) {
    return;
  }

  const samples = mergeAudioBuffers(state.audioBuffers, state.audioSampleCount);
  const rms = Math.sqrt(state.audioEnergy / state.audioSampleCount);

  state.audioBuffers = [];
  state.audioSampleCount = 0;
  state.audioEnergy = 0;

  if (rms < 0.01) {
    logEvent(t("speechIgnoredLog"));
    return;
  }

  const wavBlob = encodeWavBlob(samples, sampleRate, 16000);
  queueAudioChunk(wavBlob);
}

function queueAudioChunk(blob) {
  if (state.audioChunkInFlight) {
    state.pendingAudioBlob = blob;
    logEvent(t("audioBusyLog"));
    return;
  }

  sendAudioChunk(blob);
}

function sendPendingAudioChunk() {
  if (!state.pendingAudioBlob || !state.connected || !state.audioContext) {
    state.pendingAudioBlob = null;
    return;
  }

  const blob = state.pendingAudioBlob;
  state.pendingAudioBlob = null;
  sendAudioChunk(blob);
}

async function sendAudioChunk(blob) {
  try {
    state.audioChunkInFlight = true;
    const audioBase64 = await blobToBase64(blob);
    sendSocket({
      type: "source_audio",
      mimeType: blob.type || "audio/wav",
      audioBase64,
    });
  } catch (error) {
    state.audioChunkInFlight = false;
    console.error("[audio] send chunk failed", error);
    showError(t("audioSendError"));
  }
}

function mergeAudioBuffers(buffers, sampleCount) {
  const merged = new Float32Array(sampleCount);
  let offset = 0;

  for (const buffer of buffers) {
    merged.set(buffer, offset);
    offset += buffer.length;
  }

  return merged;
}

function resampleLinear(samples, sourceRate, targetRate) {
  if (sourceRate === targetRate) {
    return samples;
  }

  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const weight = sourceIndex - leftIndex;
    output[index] = samples[leftIndex] * (1 - weight) + samples[rightIndex] * weight;
  }

  return output;
}

function encodeWavBlob(samples, sourceRate, targetRate) {
  const resampled = resampleLinear(samples, sourceRate, targetRate);
  const buffer = new ArrayBuffer(44 + resampled.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + resampled.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, resampled.length * 2, true);

  let offset = 44;
  for (const sample of resampled) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function sendManualText() {
  const text = elements.manualText.value.trim();

  if (!text) {
    return;
  }

  sendSourceText(text);
  elements.manualText.value = "";
}

function sendSourceText(text) {
  if (!state.connected) {
    showError(t("joinFirst"));
    return;
  }

  sendSocket({
    type: "source_text",
    text,
  });
}

function sendSocket(message) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    showError(t("noRoomConnection"));
    return;
  }

  state.socket.send(JSON.stringify(message));
}

function speakText(text) {
  if (!text) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_SYNTHESIS_LANG[state.myLanguage];

  const selectedVoice = state.voices.find(
    (voice) => voice.name === elements.voiceSelect.value,
  );

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function loadVoices() {
  state.voices = speechSynthesis.getVoices();
  const langPrefix = state.myLanguage === "fr" ? "fr" : "pl";
  const matchingVoices = state.voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(langPrefix),
  );
  const voices = matchingVoices.length ? matchingVoices : state.voices;

  elements.voiceSelect.innerHTML = "";

  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    elements.voiceSelect.append(option);
  }

  if (!voices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("defaultVoice");
    elements.voiceSelect.append(option);
  }
}

function appendTranscript(container, text, isMine) {
  if (!text) {
    return;
  }

  const line = document.createElement("p");
  line.className = isMine ? "line line-own" : "line";
  line.textContent = text;
  container.append(line);
  container.scrollTop = container.scrollHeight;
}

function setConnectionState(connected) {
  state.connected = connected;
  elements.connectButton.disabled = connected;
  elements.disconnectButton.disabled = !connected;
  elements.roomId.disabled = connected;
  elements.myLanguage.disabled = connected;
  elements.demoPin.disabled = connected;
  elements.startSpeechButton.disabled = !connected;
  elements.stopSpeechButton.disabled = true;
  elements.sendTextButton.disabled = !connected;
  elements.manualText.disabled = !connected;
  elements.testVoiceButton.disabled = false;
  renderProviderUi();
}

function updateRoomStatus(room) {
  if (!room) {
    elements.roomStatus.textContent = "-";
    return;
  }

  elements.roomStatus.textContent = room.roomId;
  state.peerPresent = state.myLanguage === "pl" ? room.frenchSpeakers > 0 : room.polishSpeakers > 0;
  state.peerSpeaking = Boolean(room.members?.some(member => member.id !== state.clientId && member.speaking));
  updateCallUi();
}

function updateLanguageUi() {
  const myLanguage = getSelectedLanguage();
  const peerLanguage = myLanguage === "pl" ? "fr" : "pl";
  elements.peerLanguage.value = myLanguage === "fr" ? "Polonais" : "Français";
  elements.myLanguage.querySelector('[value="pl"]').textContent = "Polski / Polonais";
  elements.myLanguage.querySelector('[value="fr"]').textContent = "Français / Francuski";
  elements.manualText.placeholder =
    myLanguage === "pl" ? t("manualPlaceholderPl") : t("manualPlaceholderFr");
  document.documentElement.lang = myLanguage;
  applyTranslations();
}

function getSelectedLanguage() {
  return elements.myLanguage.value === "fr" ? "fr" : "pl";
}

function normalizeRoomId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

function setStatus(status) {
  elements.connectionStatus.textContent = status;
}

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
  logEvent(`${t("errorPrefix")}: ${message}`);
}

function clearError() {
  elements.errorBanner.textContent = "";
  elements.errorBanner.hidden = true;
}

function resetTranscripts() {
  elements.sourceTranscript.innerHTML = "";
  elements.targetTranscript.innerHTML = "";
  elements.sourcePartial.textContent = "";
  state.transcriptLines.clear();
  document.querySelector("#transcriptEmpty").hidden = false;
}

function logEvent(message) {
  console.log(`[translator] ${message}`);

  const item = document.createElement("li");
  const timestamp = new Date().toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  item.textContent = `${timestamp} ${message}`;
  elements.eventLog.prepend(item);
  while (elements.eventLog.children.length > 100) elements.eventLog.lastChild.remove();
}

function t(key) {
  return UI_TEXT[state.myLanguage]?.[key] ?? UI_TEXT.pl[key] ?? key;
}

function applyTranslations() {
  for (const element of i18nElements) {
    const key = element.dataset.i18n;
    element.textContent = t(key);
  }

  elements.connectButton.textContent = t("connect");
  elements.disconnectButton.textContent = t("disconnect");
  elements.startSpeechButton.textContent = t("startSpeech");
  elements.stopSpeechButton.textContent = t("stopSpeech");
  elements.sendTextButton.textContent = t("send");
  elements.testVoiceButton.textContent = t("testVoice");
  elements.clearLogButton.textContent = t("clear");

  if (!state.connected) {
    elements.connectionStatus.textContent = t("ready");
  }
  renderProviderUi();
}

async function startOpenAI() {
  if (!state.peerPresent || state.testingMic || state.openaiPending || state.openaiSessionId || state.openaiClosing) return;
  const attempt = ++state.openaiAttempt;
  state.openaiPending = true;
  elements.startSpeechButton.disabled = true;
  elements.stopSpeechButton.disabled = false;
  logEvent(t("openaiStarting"));
  try {
    if (!await openaiAudio.prepare() || !state.connected || !state.openaiPending) return;
    state.openaiRequested = true;
    sendSocket({ type: "openai_start" });
  } catch (error) {
    if (attempt !== state.openaiAttempt) return;
    stopOpenAI();
    showError(t(error.message === "secure_microphone_required" ? error.message : "microphoneError"));
  }
}
function stopOpenAI(notify = true) {
  const running = state.openaiRequested;
  state.openaiAttempt++;
  if (notify && running) state.openaiClosing = true;
  if (!notify) { state.openaiClosing = false; state.openaiRequested = false; }
  openaiAudio.stopCapture();
  state.wakeLock?.release().catch(() => {}); state.wakeLock = null;
  state.sessionStartedAt = 0;
  document.querySelector("#micLevel").value = 0;
  state.openaiPending = false;
  state.openaiSessionId = "";
  if (notify && running && state.socket?.readyState === WebSocket.OPEN) sendSocket({ type: "openai_stop" });
  elements.speechStatus.hidden = true;
  elements.stopSpeechButton.disabled = true;
  elements.startSpeechButton.disabled = !state.connected || state.openaiClosing;
}
function handleOpenAIDelta(message) {
  if (message.kind === "audio") {
    if (message.speakerId !== state.clientId && message.targetLanguage === state.myLanguage) openaiAudio.play(message.delta);
    return;
  }
  const key = message.sessionId + ":" + message.kind;
  let line = state.transcriptLines.get(key);
  if (line && line.textContent.length > 240 && /[.!?]\s*$/.test(line.textContent)) line = null;
  if (!line) {
    line = document.createElement("p");
    const own = message.speakerId === state.clientId;
    line.className = own ? "line line-own" : "line";
    line.textContent = (own ? t("me") : t("peer")) + ": ";
    const container = message.kind === "source" ? elements.sourceTranscript : elements.targetTranscript;
    container.append(line);
    state.transcriptLines.set(key, line);
  }
  line.textContent += message.delta;
  document.querySelector("#transcriptEmpty").hidden = true;
  line.parentElement.scrollTop = line.parentElement.scrollHeight;
}
function renderProviderUi() {
  const openai = state.translationMode === "openai";
  document.querySelector('[data-i18n="modeNote"]').textContent = t(openai ? "openaiNote" : state.translationMode === "groq" ? "groqNote" : "modeNote");
  elements.manualForm.hidden = openai;
  elements.voiceSelect.closest("label").hidden = openai;
  elements.testVoiceButton.textContent = t(openai ? "enableAudio" : "testVoice");
  document.querySelector("#usageInfo").hidden = !openai;
  document.querySelector("#sourceHint").hidden = !openai || state.sourceTranscription;
  document.querySelector("#sourceHint").textContent = t("sourceOff");
  elements.sourceTranscript.closest("article").hidden = openai && !state.sourceTranscription;
  document.querySelector(".conversation-grid").style.gridTemplateColumns = openai && !state.sourceTranscription ? "minmax(0, 1fr)" : "";
  updateUsage();
}
function updateUsage() {
  const estimate = state.totalEstimatedUsd + state.sentSeconds / 60 * state.estimatedUsdPerMinute;
  document.querySelector("#usageInfo").textContent = t("usageLabel") + ": $" + estimate.toFixed(4) + " · " + t("sessionLimit") + ": " + state.maxSessionSeconds + " s";
}

function updateCallUi() {
  const running = Boolean(state.openaiSessionId);
  if (state.translationMode === "openai") {
    elements.startSpeechButton.disabled = !state.connected || !state.peerPresent || running || state.openaiPending || state.openaiClosing || state.testingMic;
    elements.stopSpeechButton.disabled = !running && !state.openaiPending;
  }
  elements.connectButton.disabled = state.connected || state.connecting || state.testingMic;
  document.querySelector("#micTestButton").disabled = running || state.openaiPending || state.openaiClosing || state.testingMic;
  document.querySelector("#myMicState").textContent = t(running ? "micOn" : state.openaiPending ? "openaiStarting" : "micOff");
  document.querySelector("#peerState").textContent = t(!state.peerPresent ? "peerWaiting" : state.peerSpeaking ? "peerOn" : "peerReady");
  document.querySelector("#callHint").textContent = t(!state.connected ? "joinHint" : !state.peerPresent ? "waitingHint" : running ? "activeHint" : "readyHint");
  const remaining = Math.max(0, state.maxSessionSeconds - (state.sessionStartedAt ? Math.floor((Date.now()-state.sessionStartedAt)/1000) : 0));
  document.querySelector("#sessionTimer").textContent = Math.floor(remaining/60).toString().padStart(2,"0") + ":" + (remaining%60).toString().padStart(2,"0");
}
async function copyInvitation() {
  if (state.requiresDemoPin && !elements.demoPin.value.trim()) { showError(t("inviteFirst")); return; }
  const room = normalizeRoomId(elements.roomId.value);
  if (!room) { showError(t("roomRequired")); return; }
  const url = new URL(location.href);
  url.hash = new URLSearchParams({ room, lang:getSelectedLanguage()==="pl"?"fr":"pl", pin:elements.demoPin.value.trim() }).toString();
  try {
    await navigator.clipboard.writeText(url.toString());
    document.querySelector("#inviteFeedback").textContent = t("inviteCopied");
    document.querySelector("#inviteFallback").hidden = true;
  } catch {
    document.querySelector("#inviteFallback").hidden = false;
    document.querySelector("#inviteUrl").value = url.toString();
    document.querySelector("#inviteUrl").select();
  }
}
async function testMicrophone() {
  if (state.openaiRequested || state.openaiPending || state.testingMic) return;
  clearError(); state.testingMic = true; updateCallUi();
  let peak = 0;
  const oldLevel = openaiAudio.onLevel;
  openaiAudio.onLevel = level => { peak = Math.max(peak,level); oldLevel(level); };
  document.querySelector("#micTestResult").textContent = t("micTesting");
  try {
    if (await openaiAudio.prepare()) {
      await new Promise(resolve=>setTimeout(resolve,4000));
      document.querySelector("#micTestResult").textContent = t(peak > 0.03 ? "micPassed" : "micQuiet");
    }
  } catch { showError(t("microphoneError")); }
  finally { openaiAudio.stopCapture(); openaiAudio.onLevel = oldLevel; state.testingMic = false; document.querySelector("#micLevel").value = 0; updateCallUi(); }
}
async function requestWakeLock() {
  try { if ("wakeLock" in navigator && !document.hidden) state.wakeLock = await navigator.wakeLock.request("screen"); } catch { /* Optional browser capability. */ }
}
