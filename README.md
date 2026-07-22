# Brain

App de brainstorm musical colaborativo (Vite + React + PWA + Capacitor).

## Rodar na web

```bash
npm install
npm run dev
```

Dados ficam no `localStorage` (MVP local). Para backend remoto, configure `.env` com Firebase (veja `.env.example` e [`firebase/README.md`](firebase/README.md)).

## Fluxo principal

1. Criar conta / entrar
2. Criar ou entrar em um grupo (código de convite)
3. Criar música (pública no grupo ou privada)
4. Editor: propor versos, votar, fork com diff colorido, aceitar, ver rimas
5. Com estrofe completa: gravar áudio (opcional ouvir estrofe anterior)

## Android (APK / AAB)

```bash
npm run build
npx cap add android   # só na primeira vez
npx cap sync android
npm run android:apk   # debug APK
npm run android:aab   # release bundle (usa android/key.properties)
```

Artefatos gerados:

- APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- AAB release: `android/app/build/outputs/bundle/release/app-release.aab`

Permissão de microfone: `RECORD_AUDIO` em `android/app/src/main/AndroidManifest.xml`.

Keystore de desenvolvimento: ver `android/KEYSTORE.md`. Não versionar `*.keystore` nem `key.properties`.

Requisitos: JDK 17+, Android SDK, `ANDROID_HOME`.

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Dev server |
| `npm run build` | Build web/PWA |
| `npm run cap:sync` | Build + sync Capacitor |
| `npm run android:apk` | APK debug |
| `npm run android:aab` | AAB release |
