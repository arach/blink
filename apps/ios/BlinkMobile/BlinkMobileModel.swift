import BlinkCore
import BlinkPeer
import CryptoKit
import Foundation
import Security
import UIKit

@MainActor
final class BlinkMobileModel: ObservableObject {
    enum CacheState: Equatable {
        case loading
        case ready
        case failed(String)
    }

    enum DiscoveryState: Equatable {
        case searching
        case found
        case noPeers
        case failed(String)
    }

    enum ConnectionState: Equatable {
        case disconnected
        case requestingAccess(String)
        case connected(BlinkPeerHost)

        var host: BlinkPeerHost? {
            guard case .connected(let host) = self else { return nil }
            return host
        }
    }

    @Published private(set) var snapshot: BlinkSnapshot?
    @Published private(set) var nearbyPeers: [BlinkLANPeerCandidate] = []
    @Published private(set) var connectionState: ConnectionState = .disconnected
    @Published private(set) var isSyncing = false
    @Published private(set) var cacheState: CacheState = .loading
    @Published private(set) var discoveryState: DiscoveryState = .searching
    @Published private(set) var lastSuccessfulSyncAt: Date?
    @Published var presentedError: String?

    private let client: BlinkLANPeerClient
    private let cache: BlinkSnapshotCache
    private var discoveryTask: Task<Void, Never>?
    private var hasLoadedCache = false
    private var discoveryStartedAt = Date()
    private var cacheGeneration = 0
    private var cacheSourceIdentity: String?

    init() {
        let credential = BlinkDeviceCredentialSeed.loadOrCreate()
        client = BlinkLANPeerClient(
            identity: BlinkPeerClientIdentity(
                credential: credential,
                name: BlinkDeviceCredentialSeed.displayName(for: credential)
            )
        )

        let support = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!
        cache = BlinkSnapshotCache(
            fileURL: support
                .appendingPathComponent("Blink", isDirectory: true)
                .appendingPathComponent("snapshot.json", isDirectory: false)
        )
        client.observeConnection { [weak self] isConnected in
            guard !isConnected else { return }
            Task { @MainActor [weak self] in
                self?.connectionState = .disconnected
            }
        }
        activate()
    }

    var notes: [BlinkSnapshotNote] {
        snapshot?.notes.sorted {
            if $0.updatedAt != $1.updatedAt { return $0.updatedAt > $1.updatedAt }
            return $0.id < $1.id
        } ?? []
    }

    var lastSyncedAt: Date? { lastSuccessfulSyncAt ?? snapshot?.generatedAt }

    func activate() {
        if !hasLoadedCache {
            hasLoadedCache = true
            cacheGeneration += 1
            let generation = cacheGeneration
            Task { await loadCache(generation: generation) }
        }
        guard discoveryTask == nil else { return }
        discoveryStartedAt = Date()
        discoveryState = .searching
        client.startBrowsing()
        discoveryTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                self.nearbyPeers = self.client.availablePeers()
                if let failure = self.client.browsingFailure {
                    self.discoveryState = .failed(failure)
                } else if !self.nearbyPeers.isEmpty {
                    self.discoveryState = .found
                } else if Date().timeIntervalSince(self.discoveryStartedAt) >= 5 {
                    self.discoveryState = .noPeers
                } else {
                    self.discoveryState = .searching
                }
                try? await Task.sleep(for: .milliseconds(500))
            }
        }
    }

    func deactivate() {
        client.stopBrowsing()
        discoveryTask?.cancel()
        discoveryTask = nil
    }

    func retryDiscovery() {
        client.stopBrowsing()
        discoveryStartedAt = Date()
        discoveryState = .searching
        client.startBrowsing()
    }

    func connect(to candidate: BlinkLANPeerCandidate) async -> Bool {
        cacheGeneration += 1
        connectionState = .requestingAccess(candidate.name)
        do {
            let host = try await client.connect(to: candidate.id)
            connectionState = .connected(host)
            return await refresh()
        } catch {
            connectionState = .disconnected
            presentedError = error.localizedDescription
            return false
        }
    }

    func disconnect() {
        cacheGeneration += 1
        client.disconnect()
        connectionState = .disconnected
    }

    @discardableResult
    func refresh() async -> Bool {
        guard let host = connectionState.host, !isSyncing else { return false }
        isSyncing = true
        defer { isSyncing = false }
        cacheGeneration += 1
        let generation = cacheGeneration
        let sourceIdentity = host.publicKey
        let isSameHost = cacheSourceIdentity == sourceIdentity
        do {
            switch try await client.fetchSnapshot(ifNoneMatch: isSameHost ? snapshot?.etag : nil) {
            case .notModified:
                guard generation == cacheGeneration,
                      connectionState.host?.publicKey == sourceIdentity
                else { return false }
                let syncedAt = Date()
                guard try await cache.recordSuccessfulSync(
                    sourceIdentity: sourceIdentity,
                    at: syncedAt
                ) else {
                    throw BlinkSnapshotCacheError.decodingFailed(
                        "The peer-bound cache is missing. Sync again to restore it."
                    )
                }
                guard generation == cacheGeneration,
                      connectionState.host?.publicKey == sourceIdentity
                else { return false }
                lastSuccessfulSyncAt = syncedAt
            case .snapshot(let incoming):
                guard generation == cacheGeneration,
                      connectionState.host?.publicKey == sourceIdentity
                else { return false }
                let syncedAt = Date()
                let cached = try await cache.apply(
                    incoming,
                    sourceIdentity: sourceIdentity,
                    syncedAt: syncedAt
                )
                guard generation == cacheGeneration,
                      connectionState.host?.publicKey == sourceIdentity
                else { return false }
                snapshot = cached
                cacheSourceIdentity = sourceIdentity
                lastSuccessfulSyncAt = syncedAt
                cacheState = .ready
            }
            return true
        } catch {
            if (error as? BlinkPeerError) == .unauthorized {
                disconnect()
            }
            presentedError = error.localizedDescription
            return false
        }
    }

    func clearOfflineNotes() async {
        do {
            cacheGeneration += 1
            let generation = cacheGeneration
            try await cache.removeAll()
            guard generation == cacheGeneration else { return }
            snapshot = nil
            cacheSourceIdentity = nil
            lastSuccessfulSyncAt = nil
            cacheState = .ready
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func retryCacheLoad() {
        cacheState = .loading
        cacheGeneration += 1
        let generation = cacheGeneration
        Task { await loadCache(generation: generation) }
    }

    private func loadCache(generation: Int) async {
        do {
            let record = try await cache.loadRecord()
            guard generation == cacheGeneration else { return }
            snapshot = record?.snapshot
            cacheSourceIdentity = record?.sourceIdentity
            lastSuccessfulSyncAt = record?.lastSuccessfulSyncAt
            cacheState = .ready
        } catch {
            guard generation == cacheGeneration else { return }
            cacheState = .failed(error.localizedDescription)
        }
    }
}

private enum BlinkDeviceCredentialSeed {
    private static let service = "dev.arach.blink.mobile.peer"
    private static let account = "device-seed"
    private static let legacyDefaultsKey = "blink.peer.device-credential"

    static func loadOrCreate() -> String {
        // The old UserDefaults value is intentionally not migrated: defaults
        // can travel in a device backup and clone an already approved identity.
        UserDefaults.standard.removeObject(forKey: legacyDefaultsKey)

        var item: CFTypeRef?
        var readQuery = baseQuery
        readQuery[kSecReturnData as String] = true
        readQuery[kSecMatchLimit as String] = kSecMatchLimitOne
        if SecItemCopyMatching(readQuery as CFDictionary, &item) == errSecSuccess,
           let data = item as? Data,
           let saved = String(data: data, encoding: .utf8),
           UUID(uuidString: saved) != nil {
            return saved.lowercased()
        }

        SecItemDelete(baseQuery as CFDictionary)
        let generated = UUID().uuidString.lowercased()
        var addQuery = baseQuery
        addQuery[kSecValueData as String] = Data(generated.utf8)
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        _ = SecItemAdd(addQuery as CFDictionary, nil)
        return generated
    }

    @MainActor
    static func displayName(for seed: String) -> String {
        let trimmed = UIDevice.current.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
        let base = trimmed.isEmpty ? fallback : trimmed
        let suffix = SHA256.hash(data: Data(seed.utf8)).prefix(2)
            .map { String(format: "%02X", $0) }
            .joined()
        return "\(base) · \(suffix)"
    }

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
        ]
    }
}
