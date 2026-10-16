# Tłumacz rozmowy polski ↔ francuski

Aplikacja dla dwóch osób, każda na swoim telefonie lub komputerze. Uczestnicy dołączają do tego samego pokoju, wybierają swój język i słyszą tłumaczenie drugiej osoby. Zalecane słuchawki, również podczas testu dwóch kart na jednym komputerze.

## Uruchomienie

Wymagany Node.js 20 lub nowszy.

```powershell
npm install
# Tylko jeśli .env jeszcze nie istnieje — nie nadpisuj istniejących kluczy:
Copy-Item .env.example .env
npm run dev
```

Otwórz http://localhost:3000. Tryb domyślny `mock` nie używa płatnego API.

## OpenAI: tłumaczenie głosu

W istniejącym lokalnym `.env` ustaw:

```env
TRANSLATION_PROVIDER=openai
OPENAI_API_KEY=tu_wpisz_klucz
OPENAI_TRANSLATION_MODEL=gpt-realtime-translate
MAX_SESSION_SECONDS=300
OPENAI_SOURCE_TRANSCRIPTION=false
```

Ustaw też własny `DEMO_PIN`, szczególnie przed udostępnieniem aplikacji w internecie. Zrestartuj serwer po zmianie `.env`. Klucz pozostaje na serwerze; nie wpisuj go do przeglądarki, czatu ani repozytorium.

1. Otwórz dwie karty lub dwa urządzenia na tym samym adresie aplikacji.
2. W obu wybierz ten sam pokój i podaj PIN. Pierwsza osoba wybiera polski, druga francuski.
3. Obie osoby klikają **Dołącz**. Dołączenie nie otwiera sesji OpenAI.
4. Każda osoba klika **Start mowy** i udziela dostępu do mikrofonu. Płatna sesja rozpoczyna się dopiero wtedy.
5. Mów po polsku — druga osoba słyszy francuski. Odpowiedź po francusku jest odtwarzana po polsku. Tłumaczone napisy widzą obie strony.
6. **Stop mowy** zatrzymuje własną sesję; można nadal słuchać drugiej strony. **Rozłącz** zatrzymuje mikrofon i odtwarzanie; wyjście rozmówcy zatrzymuje też drugą sesję.

Limit jednego uruchomienia mikrofonu domyślnie wynosi 300 sekund i jest egzekwowany na serwerze. Po limicie można rozpocząć kolejny test. To limit pojedynczej sesji, nie całkowitego budżetu konta. Serwer zamyka także sesje bez napływającego audio. Zamknięcie sesji może potrwać do 3 sekund, aby odebrać końcówkę tłumaczenia.

Na telefonach i zdalnych komputerach wymagany jest HTTPS; zwykły adres HTTP w sieci lokalnej zwykle nie udostępnia mikrofonu. `localhost` jest wyjątkiem. Do testu zdalnego można użyć istniejącego hostingu Render; zmiany nie zostały automatycznie wdrożone.

Jeśli przeglądarka wstrzymała dźwięk, kliknij **Włącz dźwięk**. Ukrycie karty lub blokada telefonu mogą wstrzymać audio; testuj aplikację na aktywnym ekranie. Aplikacja nie przechwytuje automatycznie Teams, WhatsApp ani połączenia telefonicznego.

## Koszt

Przy stawce 0,034 USD/min za strumień dwa stale aktywne mikrofony to około 0,34 USD/5 min lub 0,68 USD/10 min. Wysyłana jest również cisza, zgodnie z protokołem modelu. Ekran pokazuje szacowany koszt **własnego mikrofonu** w bieżącym połączeniu strony, nie rachunek całego pokoju lub konta. Ostateczny koszt sprawdzaj w OpenAI Usage.

Opcjonalnie `OPENAI_SOURCE_TRANSCRIPTION=true` dodaje zapis oryginału przez `gpt-realtime-whisper` (dodatkowo 0,017 USD/min strumienia według cennika z 15.10.2026). Domyślnie ta opcja jest wyłączona. Tłumaczone napisy nie wymagają jej włączenia.

Dostępność modelu i jakość polski ↔ francuski trzeba potwierdzić na swoim koncie w rzeczywistym teście audio. Testy automatyczne nie używają OpenAI ani kredytów.

Źródła:
- https://developers.openai.com/api/docs/guides/realtime-translation
- https://developers.openai.com/api/docs/models/gpt-realtime-translate
- https://developers.openai.com/api/reference/resources/realtime/translation-client-events
- https://developers.openai.com/api/reference/resources/realtime/translation-server-events

## Pozostałe tryby

`TRANSLATION_PROVIDER=mock`: przykładowe tłumaczenia tekstu bez API. Przetestuj `to jest test` oraz `ceci est un test`.

`TRANSLATION_PROVIDER=groq`: mikrofon → Groq Whisper → tłumaczenie tekstu → głos przeglądarki. Wymaga `GROQ_API_KEY`; modele i długość fragmentu są w `.env.example`.

W trybie OpenAI pole tekstowe i wybór głosu przeglądarki są ukryte, ponieważ dźwięk generuje model tłumaczący.

## Sprawdzenie zmian

```powershell
npm run typecheck
npm test
```

Testy używają lokalnego symulatora połączenia OpenAI i sprawdzają oba kierunki, izolację pokoi, PIN, zamykanie sesji, ograniczenia audio i regresję trybu mock.

## Hosting Render

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Zmienne: `TRANSLATION_PROVIDER=openai`, `OPENAI_API_KEY`, własny `DEMO_PIN`, opcjonalnie pozostałe ustawienia powyżej.
- Render ustawia `PORT`.

## Architektura

`src/server.ts` utrzymuje pokoje i przekazuje audio przez WebSocket. `src/openaiTranslation.ts` otwiera osobną sesję `/v1/realtime/translations` dla każdego kierunku. `public/capture-worklet.js` przygotowuje porcje 200 ms PCM16 mono 24 kHz, a `public/openai-audio.js` obsługuje mikrofon i kolejkę odtwarzania. Sekret OpenAI nigdy nie jest wysyłany do klienta.

`src/openaiRealtime.ts` to stary, nieużywany prototyp asystenta Realtime; nowa integracja korzysta z dedykowanego modelu tłumaczącego.

## Wersja do testów zdalnych

Interfejs **Entre nous** obsługuje zaproszenia, automatyczny wybór języka z linku, widoczny stan mikrofonów obu osób, lokalny test mikrofonu i dźwięku oraz odliczanie czasu. Zaproszenie przenosi kod w fragmencie URL (`#`), który nie trafia do żądania HTTP; po otwarciu jest usuwany z paska adresu. Udostępniaj link wyłącznie rozmówcy. Nie wysyłaj go publicznie.

### Test krok po kroku

1. Organizator wpisuje kod dostępu i dołącza do pokoju.
2. Kliknięcie **Kopiuj zaproszenie** przygotowuje link dla drugiej osoby, z przeciwnym językiem.
3. Rozmówca otwiera link. Interfejs francuski i pokój są ustawione automatycznie. Kliknięcie **Rejoindre le salon** potwierdza dołączenie.
4. Każda osoba może sprawdzić mikrofon i dźwięk bez płatnego API. Zalecane słuchawki.
5. Po dołączeniu obu osób można włączyć mikrofony. Test kończy się po 5 minutach; kolejną sesję włącza się ręcznie.
6. Ukrycie strony zatrzymuje mikrofon. Pozostaw aplikację na ekranie; to zachowanie chroni przed niezamierzonym dalszym przesyłaniem dźwięku.
7. Po utracie połączenia mikrofon pozostaje wyłączony. Ponownie dołącz do pokoju, a następnie uruchom mikrofon.

### Publikacja na Render

Gotowy `render.yaml` opisuje bezpłatny serwer Node.js w regionie Frankfurt, HTTPS oraz losowy kod dostępu. W repozytorium muszą znajdować się wyłącznie źródła, manifesty i plik blokady zależności; `.env`, kopie zapasowe oraz klucze są wykluczone. `OPENAI_API_KEY` podaje się jako sekret serwera, nigdy w publicznych plikach.

Render uruchamia jedną instancję. Pokoje i limity są w pamięci, więc restart przerywa połączenia. Darmowa usługa może usypiać po bezczynności; otwórz link przed umówioną rozmową i poczekaj na gotowość. Zmiana na płatny plan nie jest wymagana do pierwszego testu i nie jest wykonywana automatycznie.

Serwer produkcyjny wymaga kodu dostępu o długości minimum 8 znaków. Ogranicza nieudane próby kodu, zalew wiadomości, rozmiar ramek i liczbę równoległych sesji (domyślnie 2). `MAX_TOTAL_AUDIO_SECONDS=3600` ogranicza łączny przesłany dźwięk od startu procesu (około 30 minut rozmowy z dwoma stale aktywnymi mikrofonami). Limit resetuje się po restarcie, dlatego nie jest limitem wydatków konta OpenAI. Wartości kosztu w aplikacji są szacunkami.

`Dockerfile` umożliwia też wdrożenie na innym hostingu kontenerowym. Kontener potrzebuje sekretów `OPENAI_API_KEY` i `DEMO_PIN` oraz `TRANSLATION_PROVIDER=openai`. Aplikacja nie ma bazy nagrań i nie zapisuje rozmów na dysku.
