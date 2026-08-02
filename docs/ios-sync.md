# Blink iOS: local-first snapshot contract

## Scope

The first iOS surface is a read-only, offline-capable view of the same note files
the Mac app and `blink` CLI use. It starts with LAN as its only enabled route,
but its transport boundary can later use Hudson's Tailscale or managed-relay
providers without changing Blink's replication model.

## Ownership

- Hudson owns generic peer identity/trust models, route providers, route
  settings, cascade, and diagnostics.
- Blink owns snapshots, note revisions, tombstones, quarantine, workspace/style
  projection, attachment policy, offline cache, iOS UI, and the first proven LAN
  peer channel in `BlinkPeer`.
- OpenScout donates generic route and connection behavior to Hudson while OSN
  remains an OpenScout provider.

## V1 snapshot

The Mac returns one complete `BlinkSnapshot`:

- exact UTF-8 bytes of each frontmattered Markdown file;
- a SHA-256 revision for each note;
- a strong whole-snapshot ETag;
- parsed summary fields for native list rendering;
- durable tombstones for absent notes;
- quarantine issues for unreadable, malformed, or identity-divergent files.

Each quarantine issue names the expected filename identity. An iOS cache keeps
its last known value for that identity until the file becomes readable again or
an explicit tombstone arrives; quarantine is never interpreted as deletion.

The mobile app atomically replaces its cached snapshot on a successful changed
response and retains it on an authenticated not-modified response. The cache is
bound to the Mac host identity that produced it: connecting to a different Mac
forces a full snapshot and never merges quarantined notes across hosts.

`generatedAt` is diagnostic and is excluded from the ETag. A corpus that has not
changed therefore remains cacheable across requests and app launches.

## Consistency

V1 deliberately avoids a manifest-then-live-file race: note bodies travel in the
same snapshot response as their revisions. `BlinkSnapshotBuilder` requires two
identical consecutive directory reads before publishing. Atomic note writes
prevent torn individual files; the repeated capture prevents a directory change
from being presented as a stable snapshot.

If the corpus later becomes too large for full snapshots, the replacement must
use immutable snapshot leases keyed by generation. Fetching a manifest and then
reading current live files by id is not an acceptable incremental design.

## Encrypted LAN transport

The iOS feature depends only on `BlinkPeerTransport`. The first implementation
uses Bonjour discovery through Multipeer Connectivity with
`MCEncryptionPreference.required`; there is no plaintext HTTP listener. Bonjour
advertises a stable Mac host identity and Curve25519 agreement public key. Every
application payload is then sealed end to end with a per-connection key using
ChaChaPoly, independently of the Multipeer transport encryption.

The Mac accepts a peer session but serves nothing until the mobile app requests
access inside that sealed channel. Each app installation keeps a private random
seed and derives a different credential for each Mac public key; the reusable
seed never leaves the device. The Mac shows a native approval alert naming the
nearby device. Allowing the request stores only that host-scoped credential, so
later connections from the same installation do not repeat the prompt. A relay,
lookalike host, or same-network observer cannot decrypt the payload or reuse the
credential. Same-network presence is discovery, never authorization.

Approved devices are listed under **Mobile Access** in Blink's right-click menu.
Revoking a device deletes its stored credential and disconnects its live session;
the device must be explicitly approved again before it can fetch another
snapshot. The offline snapshot already on the device remains available because it
is a replaceable local cache, not continuing access to the Mac.

`BlinkPeer` is kept separate from the app UI so the encrypted peer channel can be
proven here and later donated to Hudson without moving Blink's snapshot model.
Ordinary LAN HTTP with only a bearer token or request MAC remains prohibited
because it can expose note contents to passive network observers.

The initial Hudson route policy is LAN-first. Tailscale and hosted relays are
providers added to the same cascade, not new Blink sync implementations.

## Building the companion

The checked-in XcodeGen source lives at `apps/ios/project.yml`:

```sh
cd apps/ios
xcodegen generate
xcodebuild -project BlinkMobile.xcodeproj -scheme BlinkMobile \
  -destination 'generic/platform=iOS Simulator' build
```

The generated project consumes the repository's local `BlinkCore` and
`BlinkPeer` Swift package products. The fixture in `apps/ios/Fixtures` documents
representative offline list and detail states without pretending to be
production data.
