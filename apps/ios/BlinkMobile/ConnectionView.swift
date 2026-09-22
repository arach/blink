import BlinkPeer
import SwiftUI
import UIKit

struct ConnectionView: View {
    @ObservedObject var model: BlinkMobileModel
    @State private var pendingPeer: BlinkLANPeerCandidate?

    var body: some View {
        List {
            if let host = model.connectionState.host {
                Section("Mac") {
                    Label(host.name, systemImage: "desktopcomputer")
                    LabeledContent("Transport", value: "Local network")
                    LabeledContent("Security", value: "Encrypted")
                }
                .listRowBackground(BlinkMobileTheme.surface)
                Section {
                    Button("Sync Now") {
                        Task { await model.refresh() }
                    }
                    .disabled(model.isSyncing)
                    Button("Disconnect", role: .destructive) {
                        model.disconnect()
                    }
                }
                .listRowBackground(BlinkMobileTheme.surface)
            } else {
                nearbySection
                approvalSection
            }
        }
        .scrollContentBackground(.hidden)
        .background(BlinkBackdrop())
        .navigationTitle("Connection")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(BlinkMobileTheme.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .alert(
            "Connect to \(pendingPeer?.name ?? "this Mac")?",
            isPresented: Binding(
                get: { pendingPeer != nil },
                set: { if !$0 { pendingPeer = nil } }
            )
        ) {
            Button("Cancel", role: .cancel) { pendingPeer = nil }
            Button("Request Access") {
                guard let peer = pendingPeer else { return }
                pendingPeer = nil
                Task {
                    _ = await model.connect(to: peer)
                }
            }
        } message: {
            Text("Your Mac will ask you to allow this device. Access remains until you revoke it on the Mac.")
        }
    }

    @ViewBuilder
    private var nearbySection: some View {
        Section {
            switch model.discoveryState {
            case .searching:
                HStack(spacing: 12) {
                    ProgressView()
                    Text("Looking for Blink on your network…")
                        .foregroundStyle(BlinkMobileTheme.secondaryInk)
                }
            case .found:
                ForEach(model.nearbyPeers) { peer in
                    Button {
                        pendingPeer = peer
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Label(peer.name, systemImage: "desktopcomputer")
                                Text("Nearby")
                                    .font(.caption)
                                    .foregroundStyle(BlinkMobileTheme.secondaryInk)
                            }
                            Spacer()
                            if case .requestingAccess(let name) = model.connectionState,
                               name == peer.name {
                                ProgressView()
                            } else {
                                Image(systemName: "chevron.forward")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(BlinkMobileTheme.faintInk)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                    .disabled(model.connectionState != .disconnected)
                }
            case .noPeers:
                Label("No Macs found", systemImage: "desktopcomputer.trianglebadge.exclamationmark")
                    .foregroundStyle(BlinkMobileTheme.secondaryInk)
                Button("Look Again") { model.retryDiscovery() }
            case .failed(let message):
                Label("Discovery unavailable", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(BlinkMobileTheme.secondaryInk)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(BlinkMobileTheme.secondaryInk)
                Button("Try Again") { model.retryDiscovery() }
                Button("Open Settings") {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                }
            }
        } header: {
            Text("Nearby Macs")
        } footer: {
            Text("Open Blink on your Mac. Both devices must be on the same network.")
        }
        .listRowBackground(BlinkMobileTheme.surface)
    }

    @ViewBuilder
    private var approvalSection: some View {
        switch model.connectionState {
        case .requestingAccess(let name):
            Section {
                HStack(alignment: .top, spacing: 12) {
                    ProgressView()
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Approve on \(name)")
                            .font(.headline)
                        Text("Waiting for approval")
                            .font(.subheadline)
                            .foregroundStyle(BlinkMobileTheme.secondaryInk)
                    }
                }
            } header: {
                Text("Access")
            }
            .listRowBackground(BlinkMobileTheme.surface)
        case .disconnected:
            Section {
                Label("Approval is required on the Mac.", systemImage: "lock.shield")
                    .foregroundStyle(BlinkMobileTheme.secondaryInk)
            } footer: {
                Text("The Mac remembers this device until you revoke access.")
            }
            .listRowBackground(BlinkMobileTheme.surface)
        case .connected:
            EmptyView()
        }
    }
}
