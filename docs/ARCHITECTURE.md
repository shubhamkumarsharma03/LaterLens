# 🏗️ Architecture & Technical Documentation

This document provides a deep dive into the internal design, data flow, and processing pipeline of **LaterLens**.

---

## 🚦 User Flow
Visualises the user journey from app launch through onboarding and daily interaction.

```mermaid
flowchart TD
    A([App Launch]) --> B[Splash Screen]
    B --> C{First Time User?}
    C -- Yes --> D[Permissions Screen<br/>Onboarding]
    C -- No --> E{Permissions<br/>Granted?}
    D --> F[Grant Media Library<br/>& Notification Permissions]
    F --> E
    E -- No --> G[Permission Denied<br/>Limited Mode]
    E -- Yes --> H[Home Queue Screen<br/>Action Feed]
    G --> H

    H --> I{User Action}
    I --> J[View Action Card]
    I --> K[Collections Tab]
    I --> L[Ask AI Tab]
    I --> M[Insights Tab]
    I --> N[Settings]

    J --> O{Card Action}
    O --> P[Complete]
    O --> Q[Snooze]
    O --> R[Archive]
    O --> S[View Detail<br/>ActionDetailScreen]

    S --> T[Full Analysis View]
    T --> U[Suggested Next Steps<br/>e.g. Add to Calendar / Buy Now]

    K --> V[Browse by Category<br/>Product / Study / Idea / Code / Event / Receipt]
    L --> W[Chat with AI<br/>about Screenshots]
    M --> X[Productivity Stats<br/>and Streaks]
    N --> Y[Wi-Fi Only Mode<br/>Privacy Rules<br/>Quiet Hours<br/>Auto-Archive]
```

---

## 🏛️ System Architecture
The high-level interaction between local device capabilities and external AI processing.

```mermaid
flowchart TB
    subgraph Device["Mobile Device (React Native / Expo)"]
        UI[UI Layer<br/>Screens + Components]
        CTX[State Layer<br/>QueueContext + SettingsContext]
        SVC[Services Layer<br/>aiProcessingEngine<br/>notificationService<br/>dataManagementService]
        OCR[On-Device OCR<br/>react-native-ml-kit]
        STORE[Local Storage<br/>AsyncStorage]
        MEDIA[Media Library<br/>expo-media-library]
    end

    subgraph External["External Services"]
        GROQ[Groq Cloud API<br/>Llama 3.1 8B Instant]
        NOTIF[Expo Push<br/>Notification Service]
    end

    MEDIA -->|Raw Screenshot Image| OCR
    OCR -->|Extracted Text| SVC
    SVC -->|Text Payload Only| GROQ
    GROQ -->|AI Classification + Intent + Actions| SVC
    SVC --> CTX
    CTX --> UI
    SVC --> STORE
    STORE --> CTX
    CTX -->|Schedule Digests| NOTIF
    NOTIF -->|Push Notification| Device
```

---

## 🧬 Processing Sequence
The lifecycle of a single screenshot analysis request.

```mermaid
sequenceDiagram
    actor User
    participant UI as HomeQueueScreen
    participant CTX as QueueContext
    participant SVC as aiProcessingEngine
    participant OCR as ML Kit OCR On-Device
    participant GROQ as Groq Cloud API
    participant DB as AsyncStorage

    User->>UI: Opens App / Taps Analyse
    UI->>SVC: processLatestScreenshot()
    SVC->>OCR: runOCR(imagePath)
    OCR-->>SVC: extractedText
    SVC->>GROQ: POST /chat/completions model llama-3.1 text extractedText
    GROQ-->>SVC: category, intent, suggestedActions, priority
    SVC->>SVC: buildActionItem(ocrResult, aiResult)
    SVC->>DB: saveActionItem(actionItem)
    DB-->>SVC: OK
    SVC->>CTX: dispatch ADD_ACTION payload actionItem
    CTX-->>UI: updated queue state
    UI-->>User: New Action Card appears in Feed with haptic feedback
```

---

## 📊 Data Models (ERD)
Logic schema for how data is structured within local storage.

```mermaid
erDiagram
    USER {
        string userId PK
        string deviceId
        object settings
        datetime createdAt
    }

    ACTION_ITEM {
        string itemId PK
        string userId FK
        string rawText
        string imagePath
        string category
        string intent
        string status
        int priority
        datetime capturedAt
        datetime processedAt
        datetime archivedAt
    }

    CATEGORY {
        string categoryId PK
        string name
        string colorToken
        string icon
    }

    SUGGESTED_ACTION {
        string actionId PK
        string itemId FK
        string label
        string actionType
        boolean completed
    }

    SETTINGS {
        string settingsId PK
        string userId FK
        boolean wifiOnlyMode
        boolean autoArchiveEnabled
        int autoArchiveDays
        string quietHoursStart
        string quietHoursEnd
        array privacyExclusionRules
    }

    USER ||--o{ ACTION_ITEM : "has"
    USER ||--|| SETTINGS : "has"
    ACTION_ITEM }o--|| CATEGORY : "belongs to"
    ACTION_ITEM ||--o{ SUGGESTED_ACTION : "has"
```

---

## 🔄 Screenshot State Lifecycle
Transitions of an action item from capture to final archive/deletion.

```mermaid
stateDiagram-v2
    [*] --> Pending : Screenshot Captured

    Pending --> Processing : aiProcessingEngine triggered
    Processing --> Failed : OCR or Groq API Error
    Failed --> Processing : User Retries

    Processing --> Unread : AI classification success Item added to Queue

    Unread --> InProgress : User opens detail view
    Unread --> Snoozed : User taps Snooze
    Unread --> Archived : User taps Archive

    InProgress --> Completed : User marks Complete
    InProgress --> Snoozed : User taps Snooze
    InProgress --> Archived : User taps Archive

    Snoozed --> Unread : Snooze timer expires Notification fired
    Snoozed --> Archived : User manually archives

    Completed --> Archived : Auto-archive after N days if enabled in Settings
    Archived --> [*] : Bulk delete or Data clear
    Completed --> [*] : Bulk delete or Data clear
```

---

## 🧩 Internal Component Map
Module structure and internal dependency flow.

```mermaid
flowchart TB
    subgraph Navigation["Navigation Layer"]
        AppNav[AppNavigator.js<br/>Tab + Stack Navigators]
        Routes[routeNames.js]
    end

    subgraph Screens["Screens"]
        Perm[PermissionsScreen]
        HomeQ[HomeQueueScreen]
        Detail[ActionDetailScreen]
        Coll[CollectionsScreen]
        AskAI[AskAIScreen]
        Insights[InsightsScreen]
    end

    subgraph Components["Shared Components"]
        ActionCard[ActionCard.js<br/>Haptics + Animations]
    end

    subgraph State["State Management<br/>React Context + useReducer"]
        QCtx[QueueContext.js<br/>Action Queue State]
        SCtx[SettingsContext.js<br/>App Settings State]
    end

    subgraph Services["Services"]
        AI[aiProcessingEngine.js<br/>OCR + Groq Pipeline]
        Notif[notificationService.js<br/>Quiet Hours + Digest]
        Data[dataManagementService.js<br/>Export + Bulk Import]
        Storage[actionQueueStorage.js<br/>AsyncStorage Wrapper]
    end

    subgraph Theme["Theme"]
        Colors[colors.js<br/>Design Tokens]
        UseTheme[useTheme.js<br/>System Theme Hook]
    end

    subgraph Models["Models"]
        ActionModels[actionModels.js<br/>Types + Statuses + Intents]
    end

    AppNav --> Screens
    Screens --> Components
    Screens --> State
    HomeQ --> AI
    AI --> Storage
    Storage --> QCtx
    QCtx --> HomeQ
    QCtx --> Detail
    SCtx --> Notif
    SCtx --> AI
    Theme --> Screens
    Theme --> Components
    ActionModels --> AI
    ActionModels --> QCtx
```

---

## 🌍 Edge & Cloud Deployment
Distribution through app stores and cloud-hosted AI inference.

```mermaid
flowchart TB
    subgraph UserDevice["User Device iOS and Android"]
        App[LaterLens<br/>React Native / Expo]
        OCREngine[ML Kit OCR<br/>On-Device]
        LocalDB[AsyncStorage<br/>On-Device]
        FileSystem[expo-file-system<br/>Local Image Cache]
    end

    subgraph GroqCloud["Groq Cloud Infrastructure"]
        GroqAPI[Groq REST API<br/>api.groq.com/v1/chat/completions]
        LlamaModel[Llama 3.1 8B Instant<br/>Hosted Model]
        GroqAPI --> LlamaModel
    end

    subgraph ExpoServices["Expo / EAS Services"]
        EASBuild[EAS Build<br/>Cloud Build Service]
        ExpoPush[Expo Push Notification Service<br/>exp.host/api/v2/push]
    end

    subgraph Distribution["App Distribution"]
        PlayStore[Google Play Store]
        AppStore[Apple App Store]
    end

    App -->|HTTPS POST Text Only No Images| GroqAPI
    GroqAPI -->|JSON Response Classification + Actions| App
    App -->|Push Token Registration + Dispatch| ExpoPush
    ExpoPush -->|Push Notification| UserDevice
    EASBuild -->|Signed APK / IPA| PlayStore
    EASBuild -->|Signed APK / IPA| AppStore
    OCREngine --> App
    App --> LocalDB
    App --> FileSystem
```

---

## 🔒 Privacy & Data Boundary (Additional)
Visualises the "Privacy-First" approach by showing exactly what leaves the device.

```mermaid
flowchart LR
    subgraph Local["ON-DEVICE (PRIVATE)"]
        Images[Screenshot Images]
        OCR_Engine[ML-Kit OCR Engine]
        Keys[Groq API Key]
        Storage[AsyncStorage DB]
    end

    subgraph Cloud["CLOUD (EXTERNAL)"]
        Groq[Groq AI Llama 3.1]
    end

    Images -- x NO IMAGES LEAVE DEVICE x --> Groq
    Images --> OCR_Engine
    OCR_Engine --> Text[Extracted Raw Text]
    Text -- "ONLY TEXT & USER PROMPT" --> Groq
    Groq -- JSON Results --> Storage
    
    style Images fill:#f96,stroke:#333,stroke-width:2px
    style Cloud fill:#fdd,stroke:#f66,stroke-dasharray: 5 5
    style Local fill:#dfd,stroke:#3c3
```
