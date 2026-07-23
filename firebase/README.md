# Firebase — Collabrain

Substitua as variáveis em `.env` (veja `.env.example`) com o config do console Firebase
(Project settings → Your apps → Web).

Com o `.env` preenchido, o app usa Auth + Firestore + Storage (não o `localStorage`).

## Serviços usados

| Serviço | Uso |
|---------|-----|
| Authentication (Email/Password) | Cadastro / login |
| Cloud Firestore | Grupos, músicas, propostas, votos, sessões |
| Storage | Takes de áudio das estrofes |
| Firestore listeners | Realtime no editor (propostas/votos/presença) |

## Coleções (modelo flat)

```
profiles/{userId}
inviteCodes/{code}          // { groupId, inviteCode }
groups/{groupId}
members/{groupId_userId}    // role, color (única no grupo)
songs/{songId}
participants/{id}           // songId, userId (só private)
stanzas/{id}                // songId, index
slots/{id}                  // songId, stanzaId, index, acceptedProposalId?
proposals/{id}              // songId, stanzaId, slotId, text, segments[], …
votes/{proposalId_userId}  // songId, stanzaId, kind
sessions/{songId_userId}    // color, lastSeenAt
audioTakes/{id}             // songId, stanzaId, audioData (URL), …
```

A cor do músico vive em `members/{groupId_userId}.color`, não no perfil.

## Console Firebase (checklist)

1. Authentication → Email/Password **ativado**
2. Firestore Database criado
3. Storage criado
4. Deploy das regras (abaixo)
5. Se o console pedir índice composto ao entrar/juntar grupos, aceite o link sugerido

## Deploy das regras

```bash
firebase deploy --only firestore:rules,storage
```

Arquivos locais:

- [`firestore.rules`](firestore.rules)
- [`storage.rules`](storage.rules)
