import BlinkCore
@testable import BlinkPeer
import CryptoKit
import Foundation
import Testing

@Suite("Blink encrypted LAN peer protocol")
struct BlinkPeerProtocolTests {
    @Test("snapshot responses survive the peer wire codec")
    func snapshotResponseRoundTrip() throws {
        let snapshot = BlinkSnapshot(
            generatedAt: Date(timeIntervalSince1970: 42),
            etag: "\"snapshot-r1\"",
            notes: [],
            tombstones: [],
            issues: []
        )
        let clientKey = Curve25519.KeyAgreement.PrivateKey()
        let hostKey = Curve25519.KeyAgreement.PrivateKey()
        let clientShared = try BlinkPeerCrypto.symmetricKey(
            privateKey: clientKey,
            peerPublicKey: hostKey.publicKey.rawRepresentation
        )
        let hostShared = try BlinkPeerCrypto.symmetricKey(
            privateKey: hostKey,
            peerPublicKey: clientKey.publicKey.rawRepresentation
        )
        let envelope = BlinkPeerResponseEnvelope(
            id: UUID(),
            sealedPayload: try BlinkPeerCrypto.seal(
                BlinkPeerResponse.snapshot(.snapshot(snapshot)),
                using: hostShared
            )
        )

        let decoded = try JSONDecoder().decode(
            BlinkPeerResponseEnvelope.self,
            from: JSONEncoder().encode(envelope)
        )
        #expect(decoded.id == envelope.id)
        let response = try BlinkPeerCrypto.open(
            BlinkPeerResponse.self,
            from: decoded.sealedPayload,
            using: clientShared
        )
        guard case .snapshot(.snapshot(let result)) = response else {
            Issue.record("Expected a full snapshot response")
            return
        }
        #expect(result == snapshot)
    }

    @Test("device access requests survive the peer wire codec")
    func accessRequestRoundTrip() throws {
        let seed = UUID().uuidString.lowercased()
        let clientKey = Curve25519.KeyAgreement.PrivateKey()
        let hostKey = Curve25519.KeyAgreement.PrivateKey()
        let clientShared = try BlinkPeerCrypto.symmetricKey(
            privateKey: clientKey,
            peerPublicKey: hostKey.publicKey.rawRepresentation
        )
        let hostShared = try BlinkPeerCrypto.symmetricKey(
            privateKey: hostKey,
            peerPublicKey: clientKey.publicKey.rawRepresentation
        )
        let identity = BlinkPeerClientIdentity(
            credential: BlinkPeerCrypto.credential(
                seed: seed,
                hostPublicKey: hostKey.publicKey.rawRepresentation
            ),
            name: "Arach’s iPhone"
        )
        let envelope = BlinkPeerRequestEnvelope(
            id: UUID(),
            clientPublicKey: clientKey.publicKey.rawRepresentation,
            sealedPayload: try BlinkPeerCrypto.seal(
                BlinkPeerRequest.requestAccess(identity),
                using: clientShared
            )
        )

        let decoded = try JSONDecoder().decode(
            BlinkPeerRequestEnvelope.self,
            from: JSONEncoder().encode(envelope)
        )
        #expect(decoded.version == 3)
        let request = try BlinkPeerCrypto.open(
            BlinkPeerRequest.self,
            from: decoded.sealedPayload,
            using: hostShared
        )
        guard case .requestAccess(let result) = request else {
            Issue.record("Expected a device access request")
            return
        }
        #expect(result == identity)
        #expect(decoded.sealedPayload.range(of: Data(seed.utf8)) == nil)
    }

    @Test("credentials are scoped to the authenticated host key")
    func hostScopedCredentials() {
        let seed = UUID().uuidString.lowercased()
        let firstHost = Curve25519.KeyAgreement.PrivateKey().publicKey.rawRepresentation
        let secondHost = Curve25519.KeyAgreement.PrivateKey().publicKey.rawRepresentation

        let first = BlinkPeerCrypto.credential(seed: seed, hostPublicKey: firstHost)
        let firstAgain = BlinkPeerCrypto.credential(seed: seed, hostPublicKey: firstHost)
        let second = BlinkPeerCrypto.credential(seed: seed, hostPublicKey: secondHost)

        #expect(first == firstAgain)
        #expect(first != second)
        #expect(first.count == 64)
        #expect(!first.contains(seed))
    }

    @Test("approved devices persist and can be revoked")
    func trustStoreLifecycle() throws {
        let suiteName = "BlinkPeerTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = BlinkPeerTrustStore(defaults: defaults, storageKey: "trusted")
        let identity = BlinkPeerClientIdentity(
            credential: UUID().uuidString.lowercased(),
            name: "Arach’s iPhone"
        )

        #expect(!store.contains(credential: identity.credential))
        let approved = store.approve(identity)
        #expect(approved.name == identity.name)
        #expect(store.contains(credential: identity.credential))
        #expect(store.peers == [approved])

        let reloaded = BlinkPeerTrustStore(defaults: defaults, storageKey: "trusted")
        #expect(
            store.hostAgreementPrivateKey().rawRepresentation
                == reloaded.hostAgreementPrivateKey().rawRepresentation
        )
        #expect(reloaded.peers == [approved])
        #expect(reloaded.revoke(id: identity.credential))
        #expect(reloaded.peers.isEmpty)
        #expect(!reloaded.revoke(id: identity.credential))
    }
}
