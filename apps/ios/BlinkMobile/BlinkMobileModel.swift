import BlinkCore
import BlinkPeer
import Foundation
import UIKit

@MainActor
final class BlinkMobileModel: ObservableObject {
    private static let cacheHostIDKey = "blink.peer.cache-host-id"

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
    @Published var presentedError: String?

    private let client: BlinkLANPeerClient
    private let cache: BlinkSnapshotCache
    private var discoveryTask: Task<Void, Never>?
    private var hasLoadedCache = false
    private var discoveryStartedAt = Date()
    private var cacheGeneration = 0

    init() {
        let defaults = UserDefaults.standard
        let credentialKey = "blink.peer.device-credential"
        let credential: String
        if let saved = defaults.string(forKey: credentialKey), UUID(uuidString: saved) != nil {
            credential = saved
        } else {
            credential = UUID().uuidString.lowercased()
            defaults.set(credential, forKey: credentialKey)
        }
        client = BlinkLANPeerClient(
            identity: BlinkPeerClientIdentity(
                credential: credential,
                name: UIDevice.current.name
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

    var lastSyncedAt: Date? { snapshot?.generatedAt }

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
        client.disconnect()
        connectionState = .disconnected
    }

    @discardableResult
    func refresh() async -> Bool {
        guard let host = connectionState.host, !isSyncing else { return false }
        isSyncing = true
        defer { isSyncing = false }
        do {
            let defaults = UserDefaults.standard
            let isSameHost = defaults.string(forKey: Self.cacheHostIDKey) == host.id
            switch try await client.fetchSnapshot(ifNoneMatch: isSameHost ? snapshot?.etag : nil) {
            case .notModified:
                guard connectionState.host?.id == host.id else { return false }
            case .snapshot(let incoming):
                guard connectionState.host?.id == host.id else { return false }
                cacheGeneration += 1
                let generation = cacheGeneration
                if !isSameHost {
                    try await cache.removeAll()
                }
                let cached = try await cache.apply(incoming)
                guard generation == cacheGeneration else { return false }
                snapshot = cached
                cacheState = .ready
                defaults.set(host.id, forKey: Self.cacheHostIDKey)
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
            cacheState = .ready
            UserDefaults.standard.removeObject(forKey: Self.cacheHostIDKey)
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
            let cached = try await cache.load()
            guard generation == cacheGeneration else { return }
            snapshot = cached
            cacheState = .ready
        } catch {
            guard generation == cacheGeneration else { return }
            cacheState = .failed(error.localizedDescription)
        }
    }
}
