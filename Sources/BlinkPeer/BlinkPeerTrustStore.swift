import CryptoKit
import Foundation

/// The private, app-scoped credential an iPhone presents inside an encrypted
/// peer session. The value is random and never shown as part of the pairing UI.
public struct BlinkPeerClientIdentity: Codable, Equatable, Sendable {
    public var credential: String
    public var name: String

    public init(credential: String, name: String) {
        self.credential = credential
        self.name = name
    }
}

/// A device the Mac has explicitly approved for read-only note access.
public struct BlinkTrustedPeer: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var approvedAt: Date

    public init(id: String, name: String, approvedAt: Date = .now) {
        self.id = id
        self.name = name
        self.approvedAt = approvedAt
    }
}

/// Persists approved device credentials. Authorization is still enforced per
/// live encrypted session; this store only decides whether the Mac must ask the
/// person again when that device reconnects.
public final class BlinkPeerTrustStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let storageKey: String
    private let lock = NSLock()

    public init(
        defaults: UserDefaults = .standard,
        storageKey: String = "blink.peer.trusted-devices"
    ) {
        self.defaults = defaults
        self.storageKey = storageKey
    }

    public var peers: [BlinkTrustedPeer] {
        lock.withLock { load() }
    }

    public func contains(credential: String) -> Bool {
        lock.withLock { load().contains { $0.id == credential } }
    }

    @discardableResult
    public func approve(_ identity: BlinkPeerClientIdentity) -> BlinkTrustedPeer {
        lock.withLock {
            var current = load()
            if let index = current.firstIndex(where: { $0.id == identity.credential }) {
                current[index].name = identity.name
                save(current)
                return current[index]
            }

            let peer = BlinkTrustedPeer(id: identity.credential, name: identity.name)
            current.append(peer)
            save(current)
            return peer
        }
    }

    @discardableResult
    public func revoke(id: String) -> Bool {
        lock.withLock {
            var current = load()
            let oldCount = current.count
            current.removeAll { $0.id == id }
            guard current.count != oldCount else { return false }
            save(current)
            return true
        }
    }

    /// A stable app-layer agreement key authenticates this Mac across
    /// Multipeer sessions. The framework still supplies mandatory transport
    /// encryption; this key creates an end-to-end sealed channel that a relay
    /// or lookalike advertiser cannot decrypt.
    func hostAgreementPrivateKey() -> Curve25519.KeyAgreement.PrivateKey {
        lock.withLock {
            let key = "\(storageKey).host-agreement-key"
            if let data = defaults.data(forKey: key),
               let existing = try? Curve25519.KeyAgreement.PrivateKey(rawRepresentation: data) {
                return existing
            }
            let created = Curve25519.KeyAgreement.PrivateKey()
            defaults.set(created.rawRepresentation, forKey: key)
            return created
        }
    }

    private func load() -> [BlinkTrustedPeer] {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([BlinkTrustedPeer].self, from: data)
        else { return [] }
        return decoded.sorted {
            if $0.approvedAt != $1.approvedAt { return $0.approvedAt < $1.approvedAt }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private func save(_ peers: [BlinkTrustedPeer]) {
        guard let data = try? JSONEncoder().encode(peers) else { return }
        defaults.set(data, forKey: storageKey)
    }
}

private extension NSLock {
    func withLock<T>(_ operation: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try operation()
    }
}
